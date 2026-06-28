import { prisma } from "../lib/prisma";

async function main() {
  const convs = await prisma.conversation.findMany({
    include: { messages: true },
  });
  console.log(JSON.stringify(convs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
