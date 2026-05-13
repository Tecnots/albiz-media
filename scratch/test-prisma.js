
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

async function test() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Testing prisma.circleUpgradeRequest.findFirst()...');
    const result = await prisma.circleUpgradeRequest.findFirst({
      where: {
        userId: 1, // Using a dummy ID
        status: {
          in: ['PENDING', 'APPROVED']
        }
      }
    });
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
