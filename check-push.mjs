import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const count = await p.pushToken.count();
  console.log('PushToken table accessible. Row count:', count);
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await p.$disconnect();
}
