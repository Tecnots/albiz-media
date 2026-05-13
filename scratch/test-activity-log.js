const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config({ path: ".env" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
  const p = new PrismaClient({ adapter });
  
  console.log("Has activityLog:", "activityLog" in p);
  console.log("Prisma keys:", Object.keys(p).filter(k => !k.startsWith("_") && !k.startsWith("$")));
  
  try {
    const count = await p.activityLog.count();
    console.log("ActivityLog count:", count);
  } catch(e) {
    console.error("Error:", e.message);
  }
  
  await p.$disconnect();
}

main();
