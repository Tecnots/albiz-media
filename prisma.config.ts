/// <reference types="node" />
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // @ts-ignore -- earlyAccess required by prisma v7 but not yet typed
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },

  migrations: {
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
