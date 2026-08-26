const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log("No user found");
    console.log("User:", user.email);

    const rawProjects = await prisma.project.findMany({
      where: { ownerId: user.id },
      include: {
        roles: {
          include: {
            _count: { select: { applications: true } },
          },
        },
        team: {
          include: { members: { select: { id: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    console.log("Found projects:", rawProjects.length);
    console.log(JSON.stringify(rawProjects, null, 2));
  } catch (e) {
    console.error("PRISMA ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
