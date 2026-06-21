const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { id:true, name:true, username:true } });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
