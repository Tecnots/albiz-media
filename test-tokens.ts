import { prisma } from "./lib/prisma";
async function main() {
  const tokens = await prisma.pushToken.findMany({ include: { user: true } });
  console.log(JSON.stringify(tokens, null, 2));
}
main();
