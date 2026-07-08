// Run: node scripts/seed-admin-notifs.mjs
// Seeds sample admin notifications via the API (needs dev server running)
// OR run directly with: node -r dotenv/config scripts/seed-admin-notifs.mjs

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load env
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const now = new Date();
const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
const earlier = new Date(now); earlier.setDate(earlier.getDate() - 3);

const data = [
  { type: "NEW_USER",       title: "New user registered",   message: "Priya Sharma joined Albiz Media",                             metadata: { userId: 42 }, unread: true,  createdAt: new Date(now.getTime()       - 1000*60*5)   },
  { type: "CIRCLE_UPGRADE", title: "Circle upgrade request", message: "Rahul Nair submitted a circle upgrade request",              metadata: { requestId: 18 }, unread: true, createdAt: new Date(now.getTime()      - 1000*60*23)  },
  { type: "CONTENT_REPORT", title: "Post reported",          message: "A post by @alex_writer was reported for misinformation",     metadata: { postId: 204 }, unread: true,  createdAt: new Date(now.getTime()       - 1000*60*47)  },
  { type: "NEW_USER",       title: "New user registered",   message: "Mohammed Al-Farsi joined Albiz Media",                       metadata: { userId: 43 }, unread: true,  createdAt: new Date(now.getTime()       - 1000*60*90)  },
  { type: "AUTHOR_REQUEST", title: "Author application",    message: "Deepa Nair applied to become an author",                     metadata: { userId: 38 }, unread: false, createdAt: new Date(yesterday.getTime() - 1000*60*120) },
  { type: "CIRCLE_UPGRADE", title: "Circle upgrade request", message: "Samuel Torres submitted a circle upgrade request",          metadata: { requestId: 17 }, unread: false, createdAt: new Date(yesterday.getTime() - 1000*60*300) },
  { type: "SYSTEM",         title: "Storage usage warning", message: "Blob storage is at 82% capacity",                            metadata: {},             unread: false, createdAt: new Date(yesterday.getTime() - 1000*60*540) },
  { type: "CONTENT_REPORT", title: "Post reported",          message: "A story by @circle_hub was reported for spam",              metadata: { postId: 188 }, unread: false, createdAt: new Date(earlier.getTime()  - 1000*60*180) },
  { type: "NEW_USER",       title: "New user registered",   message: "Fatima Hassan joined Albiz Media",                          metadata: { userId: 29 }, unread: false, createdAt: new Date(earlier.getTime()  - 1000*60*360) },
  { type: "SYSTEM",         title: "Maintenance completed", message: "Scheduled maintenance window completed successfully",        metadata: {},             unread: false, createdAt: new Date(earlier.getTime()  - 1000*60*600) },
];

await prisma.adminNotification.deleteMany({});
for (const item of data) {
  await prisma.adminNotification.create({ data: item });
}
console.log(`Seeded ${data.length} admin notifications`);
await prisma.$disconnect();
