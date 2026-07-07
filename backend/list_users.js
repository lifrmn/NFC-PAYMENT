const { PrismaClient } = require('@prisma/client'); // Import Prisma ORM untuk akses database
// Import Prisma ORM untuk akses database
const prisma = new PrismaClient(); // Buat instance Prisma client untuk query
// Buat instance Prisma client untuk query

async function main() {
  const users = await prisma.user.findMany({ select: { id:true, name:true, username:true } }); // Ambil semua user, hanya field id, name, username
  // Ambil semua user, hanya field id, name, username
  console.log(JSON.stringify(users, null, 2)); // Tampilkan hasil dalam format JSON yang rapi (indent 2)
  // Tampilkan hasil dalam format JSON yang rapi (indent 2)
  await prisma.$disconnect(); // Putuskan koneksi Prisma setelah selesai
  // Putuskan koneksi Prisma setelah selesai
}

main().catch(e => { console.error(e.message); process.exit(1); }); // Jalankan fungsi main, exit dengan code 1 jika ada error
// Jalankan fungsi main, exit dengan code 1 jika ada error
