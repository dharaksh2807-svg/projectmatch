const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    where: { email: 'owner@example.com' },
    data: { role: 'ADMIN' },
  });
  console.log('User made admin');
}
main();
