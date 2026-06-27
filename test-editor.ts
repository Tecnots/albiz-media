import { prisma } from "./lib/prisma";

async function main() {
  let user = await prisma.user.findFirst({ where: { role: 'EDITOR' }});
  if (user) {
    console.log("SUCCESS: Found Editor in DB -> id:", user.id, "email:", user.email, "role:", user.role);
  } else {
    console.log("No Editor found in DB. I will create one or update one.");
    // Update user 11 (Sarah Johnson) to be an editor for testing
    user = await prisma.user.update({
      where: { email: 'sarahjohnson@demo.albiz.com' },
      data: { role: 'EDITOR' }
    });
    console.log("Updated user to EDITOR -> id:", user.id, "email:", user.email, "role:", user.role);
  }

  // Also query the users API directly, acting as an Admin. Wait, we can't easily act as Admin via curl because of session cookies.
  // Instead, let's fetch directly from the DB using the exact Prisma query in the users route:
  const usersRouteQuery = await prisma.user.findMany({
    where: { id: user.id },
    select: { id: true, role: true }
  });
  console.log("API Query Result ->", usersRouteQuery[0]);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
