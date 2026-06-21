/**
 * SEED USERS SIMULASI
 * Membersihkan database dan mengisi ulang dengan 3 pengguna simulasi:
 * - Andri (simulasi ALLOW - risiko rendah)
 * - Ibu (simulasi REVIEW - risiko sedang)  
 * - Adit (simulasi BLOCK - risiko kritis)
 * 
 * Jalankan: node backend/seed_users.js
 */

const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'prisma/prisma/dev.db');

const USERS = [
  {
    name: 'Andri',
    username: 'andri',
    password: 'andri123',
    balance: 500000,
    isActive: 1,
  },
  {
    name: 'Ibu',
    username: 'ibu',
    password: 'ibu123',
    balance: 200000,
    isActive: 1,
  },
  {
    name: 'Adit',
    username: 'adit',
    password: 'adit123',
    balance: 300000,
    isActive: 1,
  },
];

async function main() {
  console.log('🚀 Memulai seed database...\n');

  const db = new sqlite3.Database(DB_PATH);

  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

  const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  // Hapus semua user yang ada
  await run('DELETE FROM users');
  await run("DELETE FROM sqlite_sequence WHERE name='users'");
  console.log('✅ Tabel users dikosongkan\n');

  // Hapus transaksi dan fraud alerts yang terkait
  try {
    await run('DELETE FROM transactions');
    await run("DELETE FROM sqlite_sequence WHERE name='transactions'");
    await run('DELETE FROM fraud_alerts');
    await run("DELETE FROM sqlite_sequence WHERE name='fraud_alerts'");
    await run('DELETE FROM nfc_cards');
    await run("DELETE FROM sqlite_sequence WHERE name='nfc_cards'");
    await run('DELETE FROM user_sessions');
    await run("DELETE FROM sqlite_sequence WHERE name='user_sessions'");
    console.log('✅ Data transaksi lama dihapus\n');
  } catch (e) {
    console.log('⚠️ Beberapa tabel tidak ada, lanjut...\n');
  }

  // Tambahkan user simulasi
  const now = new Date().toISOString();
  for (const user of USERS) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await run(
      `INSERT INTO users (name, username, password, balance, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.name, user.username, hashedPassword, user.balance, user.isActive, now, now]
    );
    console.log(`  ✅ User dibuat: ${user.name} (${user.username}) - Saldo: Rp ${user.balance.toLocaleString('id-ID')}`);
  }

  const users = await all('SELECT id, name, username, balance FROM users');
  console.log('\n📋 Daftar User di Database:');
  console.table(users);

  db.close();
  console.log('\n✅ Seed selesai! Database siap untuk demo simulasi.');
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
