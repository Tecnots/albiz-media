const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  console.log("Users:", users.map(u => ({ id: u.id, handle: u.handle, name: u.name })));
}).catch(e => {
  console.error(e);
}).finally(() => {
  prisma.$disconnect();
});
