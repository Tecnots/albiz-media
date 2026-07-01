import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: number | undefined;
};

const PRISMA_VERSION = 28; // bump to force re-creation after schema changes

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (globalForPrisma.prismaVersion !== PRISMA_VERSION) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaVersion = PRISMA_VERSION;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
export { Prisma };

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
