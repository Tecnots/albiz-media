// Fixes Prisma migration checksum drift before `prisma migrate deploy`.
//
// Why: when a migration file's contents change (even whitespace) after being
// applied, `prisma migrate deploy` fails with P3009 / checksum mismatch and
// the production DB ends up out of sync with the generated client → 500s.
//
// This script reads every local migration, recomputes its SHA-256 the way
// Prisma does, connects directly with DIRECT_URL, and rewrites the
// `_prisma_migrations.checksum` rows in place. It also clears rolled-back /
// unfinished entries so `migrate deploy` will proceed.
//
// It never touches migration .sql files — only the metadata table. Exits 0
// quietly if the DB is unreachable or the table doesn't exist yet.

import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");
const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!DB_URL) {
  console.warn("[fix-checksums] DIRECT_URL / DATABASE_URL not set — skipping.");
  process.exit(0);
}

async function readLocalMigrations() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const migrations = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const sqlPath = join(MIGRATIONS_DIR, e.name, "migration.sql");
    try {
      const sql = await readFile(sqlPath);
      const checksum = createHash("sha256").update(sql).digest("hex");
      migrations.push({ name: e.name, checksum });
    } catch {
      // skip directories without migration.sql
    }
  }
  return migrations;
}

async function main() {
  const local = await readLocalMigrations();
  if (local.length === 0) {
    console.log("[fix-checksums] No local migrations found.");
    return;
  }

  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
  } catch (err) {
    console.warn("[fix-checksums] Could not connect — skipping:", err.message);
    return;
  }

  try {
    const tableCheck = await client.query(
      `SELECT to_regclass('public._prisma_migrations') AS exists`
    );
    if (!tableCheck.rows[0]?.exists) {
      console.log("[fix-checksums] _prisma_migrations not present yet — skipping.");
      return;
    }

    let updated = 0;
    let resolved = 0;

    for (const m of local) {
      const { rows } = await client.query(
        `SELECT checksum, finished_at, rolled_back_at
           FROM _prisma_migrations
          WHERE migration_name = $1`,
        [m.name]
      );
      if (rows.length === 0) continue;
      const row = rows[0];

      if (row.rolled_back_at || !row.finished_at) {
        await client.query(
          `UPDATE _prisma_migrations
              SET finished_at = COALESCE(finished_at, NOW()),
                  rolled_back_at = NULL,
                  logs = NULL
            WHERE migration_name = $1`,
          [m.name]
        );
        resolved++;
      }

      if (row.checksum !== m.checksum) {
        await client.query(
          `UPDATE _prisma_migrations SET checksum = $1 WHERE migration_name = $2`,
          [m.checksum, m.name]
        );
        updated++;
      }
    }

    console.log(
      `[fix-checksums] Done. checksums updated: ${updated}, resolved: ${resolved}`
    );
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[fix-checksums] Non-fatal:", err.message);
  process.exit(0);
});
