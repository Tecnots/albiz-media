import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: number | undefined;
};

const PRISMA_VERSION = 30; // bump to force re-creation after schema changes

function createPrismaClient() {
  // Serverless functions scale horizontally (each instance gets its own pool),
  // so each instance's pool should stay small — Supabase's pgbouncer is
  // designed to multiplex many small per-instance connections, not a few
  // large ones. Precautionary hardening, not a schema/behavior change.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL, max: 1 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (globalForPrisma.prismaVersion !== PRISMA_VERSION) {
  globalForPrisma.prisma?.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaVersion = PRISMA_VERSION;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
export { Prisma };

globalForPrisma.prisma = prisma;
