import { prisma } from "./lib/prisma";
async function main() {
  const tokens = await prisma.pushToken.findMany({
    select: { userId: true, token: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log("Tokens count:", tokens.length);
  console.log(tokens.map(t => ({...t, token: t.token.substring(0, 15) + "..."})));
}
main();
