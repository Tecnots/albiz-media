import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // @ts-expect-error -- earlyAccess required by prisma v7 but not yet typed
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  datasource: {
    url: process.env.DIRECT_URL!,
  },

  migrations: {
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
