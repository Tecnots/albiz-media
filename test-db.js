const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("Connection successful!");

    const userId = 1; // Default user ID
    const name = "Test Folder " + Date.now();

    console.log("Testing Prisma client insert...");
    const resultClient = await prisma.userCollection.create({
      data: {
        userId,
        name: name + " Prisma",
        image: '',
      }
    });
    console.log("Prisma client insert successful:", resultClient);

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
