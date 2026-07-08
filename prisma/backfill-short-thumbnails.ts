import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// One-time backfill: enqueues thumbnail generation for every existing Short
// that predates the auto-thumbnail feature and never got one. The per-minute
// cron dispatcher (app/api/cron/route.ts) picks these up the same way it
// would a freshly-created short.
async function main() {
  const shorts = await prisma.short.findMany({
    where: { thumbnailUrl: null },
    select: { id: true },
  });

  if (!shorts.length) {
    console.log("No thumbnail-less shorts found — nothing to backfill.");
    return;
  }

  for (const s of shorts) {
    await prisma.job.create({
      data: {
        type: "generate-short-thumbnail",
        payload: { shortId: s.id },
        maxAttempts: 3,
        priority: 4,
      },
    });
    console.log(`  ✓  Queued thumbnail generation for short #${s.id}`);
  }

  console.log(`\nDone. Queued ${shorts.length} short(s). They'll be processed on the next cron tick.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
