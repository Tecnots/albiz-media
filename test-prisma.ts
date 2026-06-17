import { config } from 'dotenv';
config();
import { prisma } from './lib/prisma';

async function run() {
  const user = await prisma.user.findUnique({where: {handle: 'ranaparvin'}});
  console.log('user:', user?.id);
  
  if (!user) return;

  try { 
    const res = await prisma.$queryRaw`SELECT "showBranding" FROM "User" WHERE id = ${user.id} LIMIT 1`;
    console.log('showBranding:', res);
  } catch(e) { 
    console.error('Error 1:', e); 
  } 

  try { 
    const res2 = await prisma.$queryRaw`SELECT id FROM "UserHighlight" LIMIT 1`;
    console.log('UserHighlight:', res2);
  } catch(e) { 
    console.error('Error 2:', e); 
  } 
} 

run();
