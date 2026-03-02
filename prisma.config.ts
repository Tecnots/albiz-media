import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  datasource: {
    url: process.env.DIRECT_URL!,
  },

  migrations: {
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
