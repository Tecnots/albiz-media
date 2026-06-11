import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: number | undefined;
};

const PRISMA_VERSION = 28; // bump to force re-creation after schema changes

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
  return new PrismaClient({ adapter });
}

if (globalForPrisma.prismaVersion !== PRISMA_VERSION) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaVersion = PRISMA_VERSION;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
