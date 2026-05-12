const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, circleWelcomeSeen: true } });
  console.log(users);
}

check().catch(console.error).finally(() => prisma.$disconnect());
