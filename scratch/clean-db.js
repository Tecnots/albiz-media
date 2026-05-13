const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.socialMessage.deleteMany({});
  await prisma.socialThread.deleteMany({});
  console.log('Deleted all social threads and messages');
  const conns = await prisma.socialConnection.findMany();
  console.log('Connections:', conns);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
