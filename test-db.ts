const { prisma } = require('./lib/prisma');

async function main() {
  console.log("Connecting to DB...");
  const maxId = await prisma.user.aggregate({ _max: { id: true } });
  console.log("Result:", maxId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
