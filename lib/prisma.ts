import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: number | undefined;
};

<<<<<<< HEAD
const PRISMA_VERSION = 23; // bump to force re-creation after schema changes
=======
const PRISMA_VERSION = 27; // bump to force re-creation after schema changes
>>>>>>> efd3e02cd92e79252f920a387792772aff4cf23f

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
