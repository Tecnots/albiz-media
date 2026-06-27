const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'EDITOR' }});
  console.log("DB Role for user", user?.id, ":", user?.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
