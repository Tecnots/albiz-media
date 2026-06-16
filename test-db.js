require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to DB with URL:", process.env.DATABASE_URL);
  const maxId = await prisma.user.aggregate({ _max: { id: true } });
  console.log("Result:", maxId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
