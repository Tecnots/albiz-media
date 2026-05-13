const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const conns = await prisma.socialConnection.findMany();
  console.log('Connections:', conns);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
