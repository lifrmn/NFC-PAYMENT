// ============================================================
// USERS.JS - ROUTES UNTUK MANAJEMEN PENGGUNA
// ============================================================
// File ini berisi semua endpoint untuk manajemen pengguna (user):
// - GET / -> Ambil semua data pengguna (untuk admin dashboard)
// - GET /:id -> Ambil detail pengguna berdasarkan ID
// - GET /username/:username -> Cari pengguna berdasarkan username
// - GET /:id/cards -> Ambil daftar kartu NFC milik pengguna
// - GET /:id/transactions -> Ambil riwayat transaksi pengguna
// - PUT /:id/balance -> Update saldo pengguna (khusus admin)
// - PUT /:id -> Update profil pengguna (nama, dll)
// - PUT /:id/deactivate -> Nonaktifkan pengguna (blokir akun)
// - DELETE /:id -> Hapus pengguna secara permanen (CASCADE)
//
// KONSEP PENTING:
// 1. CASCADE DELETE: Saat hapus user, otomatis hapus semua data terkait
//    (transaksi, kartu NFC, fraud alerts, sessions)
// 2. BALANCE MANAGEMENT: Saldo hanya bisa diubah oleh admin dengan password
// 3. REAL-TIME SYNC: Perubahan data langsung dikirim ke client via Socket.IO
// ============================================================

const express = require('express'); // Framework untuk membuat API routes
const { body, validationResult } = require('express-validator'); // Validasi input dari client
const { PrismaClient } = require('@prisma/client'); // ORM untuk akses database SQLite

const router = express.Router(); // Buat router baru untuk endpoint /api/users
const prisma = new PrismaClient(); // Buat koneksi ke database

// ============================================================
// ENDPOINT 1: GET / - AMBIL SEMUA DATA PENGGUNA
// ============================================================
// Endpoint ini digunakan oleh admin dashboard untuk melihat daftar semua pengguna
//
// CARA KERJA:
// 1. Query ke database mengambil semua user
// 2. Sertakan hitungan transaksi (sent & received) untuk setiap user
// 3. Urutkan berdasarkan tanggal registrasi (yang terbaru dulu)
// 4. Return array of user objects
//
// RESPONSE EXAMPLE:
// [
//   {
//     "id": 1,
//     "name": "John Doe",
//     "username": "john",
//     "balance": 50000,
//     "deviceId": "ABC123",
//     "isActive": true,
//     "createdAt": "2025-01-01T10:00:00Z",
//     "_count": {
//       "sentTransactions": 15,
//       "receivedTransactions": 8
//     }
//   }
// ]
// ============================================================
router.get('/', async (req, res) => {
  try {
    // STEP 1: Query database untuk ambil semua user
    // Gunakan Prisma ORM - lebih aman dari SQL injection
    const users = await prisma.user.findMany({
      select: {
        id: true,                    // ID unik pengguna
        name: true,                  // Nama lengkap
        username: true,              // Username untuk login
        balance: true,               // Saldo e-wallet (dalam Rupiah)
        deviceId: true,              // ID perangkat Android yang digunakan
        isActive: true,              // Status aktif/diblokir
        createdAt: true,             // Tanggal registrasi
        _count: {                    // Hitung jumlah transaksi
          select: {
            sentTransactions: true,    // Transaksi yang dikirim user
            receivedTransactions: true // Transaksi yang diterima user
          }
        }
      },
      orderBy: {
        createdAt: 'desc'            // Urutkan: yang terbaru dulu (DESC)
      }
    });

    // STEP 2: Kirim response berupa array JSON ke client
    res.json(users);
  } catch (error) {
    console.error('❌ Gagal mendapatkan data pengguna:', error);
    res.status(500).json({ error: 'Gagal mendapatkan data pengguna' });
  }
});

// ============================================================
// ENDPOINT 2: GET /:id - AMBIL DETAIL PENGGUNA BERDASARKAN ID
// ============================================================
// Endpoint ini untuk mendapatkan informasi detail satu pengguna
//
// URL PARAMETER:
// - id: integer (contoh: /api/users/5)
//
// CARA KERJA:
// 1. Ambil ID dari URL parameter
// 2. Query database cari user dengan ID tersebut
// 3. Jika tidak ada, return 404 Not Found
// 4. Jika ada, return data user
//
// CONTOH PENGGUNAAN:
// GET /api/users/5
//
// RESPONSE:
// {
//   "id": 5,
//   "name": "Jane Doe",
//   "username": "jane",
//   "balance": 100000,
//   "deviceId": "XYZ789",
//   "isActive": true,
//   "createdAt": "2025-01-15T08:30:00Z",
//   "updatedAt": "2025-01-20T10:00:00Z"
// }
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    // STEP 1: Ambil parameter 'id' dari URL
    // Contoh: jika URL = /api/users/5, maka id = "5"
    const { id } = req.params;
    
    // STEP 2: Query database untuk cari user berdasarkan ID
    // parseInt(id) mengubah string "5" menjadi number 5
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },  // WHERE id = 5
      select: {                      // SELECT (pilih field yang mau diambil)
        id: true,                    // ID pengguna
        name: true,                  // Nama lengkap
        username: true,              // Username
        balance: true,               // Saldo
        deviceId: true,              // Device ID
        isActive: true,              // Status aktif/blokir
        createdAt: true,             // Tanggal registrasi
        updatedAt: true              // Tanggal update terakhir
      }
    });

    // STEP 3: Validasi - jika user tidak ditemukan
    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    // STEP 4: Return data user ke client
    res.json(user);
  } catch (error) {
    console.error('❌ Gagal mendapatkan data pengguna:', error);
    res.status(500).json({ error: 'Gagal mendapatkan data pengguna' });
  }
});

// ============================================================
// ENDPOINT 3: GET /username/:username - CARI PENGGUNA BERDASARKAN USERNAME
// ============================================================
// Endpoint ini digunakan untuk mencari pengguna berdasarkan username
// Berguna saat kirim uang (cari penerima by username)
//
// URL PARAMETER:
// - username: string (contoh: /api/users/username/john)
//
// CONTOH PENGGUNAAN:
// GET /api/users/username/john
//
// RESPONSE:
// {
//   "id": 5,
//   "name": "John Doe",
//   "username": "john",
//   "balance": 75000,
//   "isActive": true
// }
// ============================================================
router.get('/username/:username', async (req, res) => {
  try {
    // STEP 1: Ambil username dari URL parameter
    const { username } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        balance: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.json(user);
  } catch (error) {
    console.error('❌ Gagal mendapatkan pengguna berdasarkan username:', error);
    res.status(500).json({ error: 'Gagal mendapatkan data pengguna' });
  }
});

// ============================================================
// ENDPOINT 4: GET /:id/cards - AMBIL DAFTAR KARTU NFC PENGGUNA
// ============================================================
// Endpoint ini untuk mendapatkan semua kartu NFC yang dimiliki pengguna
//
// BUSINESS RULE:
// - 1 user dapat punya banyak kartu NFC (1:N relationship)
// - Setiap kartu punya saldo sendiri (bisa beda dengan saldo user)
// - Kartu bisa dalam status: ACTIVE, BLOCKED, LOST
//
// URL PARAMETER:
// - id: integer (user ID)
//
// RESPONSE:
// {
//   "success": true,
//   "cards": [
//     {
//       "cardId": "04A1B2C3D4E5F6",
//       "cardStatus": "ACTIVE",
//       "balance": 50000,
//       "registeredAt": "2025-01-10T12:00:00Z",
//       "lastUsed": "2025-01-20T15:30:00Z"
//     }
//   ]
// }
// ============================================================
router.get('/:id/cards', async (req, res) => {
  try {
    const { id } = req.params;
    
    // STEP 1: Cek apakah pengguna ada di database
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Pengguna tidak ditemukan' 
      });
    }

    // Ambil semua kartu untuk pengguna ini
    const cards = await prisma.nFCCard.findMany({
      where: { userId: parseInt(id) },
      select: {
        cardId: true,
        cardStatus: true,
        balance: true,
        registeredAt: true,
        lastUsed: true
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    res.json({ 
      success: true,
      cards: cards 
    });
  } catch (error) {
    console.error('❌ Gagal mendapatkan kartu pengguna:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mendapatkan kartu pengguna' 
    });
  }
});

// ============================================================
// ENDPOINT 5: PUT /:id/balance - UPDATE SALDO PENGGUNA (ADMIN ONLY)
// ============================================================
// Endpoint ini untuk admin melakukan TOP-UP atau SET saldo pengguna
//
// SECURITY:
// - Memerlukan admin password (ENV: ADMIN_PASSWORD)
// - Hanya admin yang bisa ubah saldo user
// - Semua perubahan dicatat di AdminLog (audit trail)
//
// REQUEST BODY:
// {
//   "amount": 100000,           // Saldo baru (bukan increment!)
//   "adminPassword": "admin123", // Password admin
//   "reason": "Top-up manual"   // Alasan (optional)
// }
//
// FLOW:
// 1. Validasi input (amount harus angka, password wajib)
// 2. Verifikasi admin password
// 3. Validasi amount tidak negatif
// 4. Update saldo user di database
// 5. Catat log admin action
// 6. Kirim notifikasi real-time ke user & admin dashboard
//
// RESPONSE:
// {
//   "message": "Saldo berhasil diperbarui",
//   "user": { ... }
// }
// ============================================================
router.put('/:id/balance', [
  // Validasi input menggunakan express-validator
  body('amount').isNumeric().withMessage('Jumlah harus berupa angka'),
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { amount, adminPassword, reason } = req.body;

    // Verifikasi password admin
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Password admin tidak valid' });
    }

    // Validasi jumlah
    if (amount < 0) {
      return res.status(400).json({ error: 'Jumlah tidak boleh negatif' });
    }

    // Perbarui saldo pengguna
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { balance: amount },
      select: {
        id: true,
        name: true,
        username: true,
        balance: true
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({
      data: {
        action: 'BALANCE_UPDATE',
        details: JSON.stringify({
          userId: user.id,
          username: user.username,
          newBalance: amount,
          reason: reason || 'Pembaruan saldo oleh admin'
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Kirim notifikasi ke dashboard admin dan perangkat pengguna
    if (req.io) {
      req.io.to('admin-room').emit('balance-updated', { user });
      req.io.to(`device-${user.deviceId}`).emit('balance-updated', { 
        balance: user.balance 
      });
    }

    res.json({
      message: 'Saldo berhasil diperbarui',
      user
    });

  } catch (error) {
    console.error('❌ Gagal memperbarui saldo:', error);
    res.status(500).json({ error: 'Gagal memperbarui saldo' });
  }
});

// ============================================================
// ENDPOINT 6: GET /:id/transactions - AMBIL RIWAYAT TRANSAKSI PENGGUNA
// ============================================================
// Endpoint untuk mendapatkan semua transaksi yang dilakukan pengguna
// (baik sebagai pengirim maupun penerima)
//
// URL PARAMETER:
// - id: integer (user ID)
//
// QUERY PARAMETER (optional):
// - limit: jumlah data yang diambil (default: 10)
// - offset: skip berapa data (untuk pagination)
//
// CONTOH:
// GET /api/users/5/transactions?limit=20&offset=0
//
// CARA KERJA:
// 1. Cari semua transaksi dimana user adalah sender ATAU receiver
// 2. Sertakan data lengkap sender dan receiver
// 3. Tambahkan field "transactionType" (sent/received)
// 4. Urutkan dari yang terbaru
//
// RESPONSE:
// [
//   {
//     "id": 100,
//     "amount": 50000,
//     "sender": { "id": 5, "name": "John", "username": "john" },
//     "receiver": { "id": 8, "name": "Jane", "username": "jane" },
//     "createdAt": "2025-01-20T10:00:00Z",
//     "transactionType": "sent"  // atau "received"
//   }
// ]
// ============================================================
router.get('/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { senderId: parseInt(id) },
          { receiverId: parseInt(id) }
        ]
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true }
        },
        receiver: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    res.json(transactions);
  } catch (error) {
    console.error('Get user transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Perbarui profil pengguna
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Nama minimal 2 karakter')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name } = req.body;

    // Cek apakah pengguna dapat memperbarui profil ini (hanya profil sendiri atau admin)
    if (req.user && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { name },
      select: {
        id: true,
        name: true,
        username: true,
        balance: true
      }
    });

    res.json({
      message: 'Profil berhasil diperbarui',
      user
    });

  } catch (error) {
    console.error('❌ Gagal memperbarui profil:', error);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// Nonaktifkan pengguna (khusus admin)
router.put('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword } = req.body;

    // Verify admin password
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        username: true,
        isActive: true
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({
      data: {
        action: 'USER_DEACTIVATE',
        details: JSON.stringify({
          userId: user.id,
          username: user.username
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Kirim notifikasi ke dashboard admin
    if (req.io) {
      req.io.to('admin-room').emit('user-deactivated', { user });
    }

    res.json({
      message: 'Pengguna berhasil dinonaktifkan',
      user
    });

  } catch (error) {
    console.error('❌ Gagal menonaktifkan pengguna:', error);
    res.status(500).json({ error: 'Gagal menonaktifkan pengguna' });
  }
});

// ============================================================
// ENDPOINT 7: DELETE /:id - HAPUS PENGGUNA SECARA PERMANEN
// ============================================================
// Endpoint ini untuk menghapus pengguna dan SEMUA data terkait
//
// ⚠️ PERINGATAN: INI ADALAH OPERASI IRREVERSIBLE!
// Data yang terhapus TIDAK BISA dikembalikan!
//
// CASCADE DELETE - Data yang akan terhapus:
// 1. Transaksi NFC (NFCTransaction) - semua transaksi dari kartu user
// 2. Kartu NFC (NFCCard) - semua kartu yang dimiliki user
// 3. Transaksi (Transaction) - transaksi sebagai sender/receiver
// 4. Fraud Alerts (FraudAlert) - peringatan fraud untuk user
// 5. Sessions (UserSession) - semua sesi login user
// 6. User record itu sendiri
//
// URUTAN PENTING:
// Harus hapus dari CHILD table ke PARENT table
// (karena ada foreign key constraints)
//
// CONTOH:
// DELETE /api/users/5
//
// FLOW:
// 1. Cek user exists
// 2. Hapus NFC transactions
// 3. Hapus NFC cards
// 4. Hapus transactions
// 5. Hapus fraud alerts
// 6. Hapus sessions
// 7. Hapus user
// 8. Log admin action
// 9. Emit real-time event ke dashboard
//
// RESPONSE:
// {
//   "success": true,
//   "message": "Pengguna berhasil dihapus",
//   "user": { ... }
// }
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    console.log(`🗑️ [Backend] Delete user request for ID: ${userId}`);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true
      }
    });

    if (!user) {
      console.log(`❌ [Backend] User ${userId} not found`);
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    console.log(`✅ [Backend] User found: ${user.username}`);

    // CASCADE DELETE: Hapus semua record terkait terlebih dahulu
    // URUTAN PENTING: Hapus dari tabel anak ke tabel induk
    
    // 1. Hapus transaksi NFC (anak dari NFCCard)
    console.log(`🗑️ [Backend] Deleting NFC transactions for user ${userId}...`);
    const userCards = await prisma.nFCCard.findMany({
      where: { userId: userId },
      select: { cardId: true }
    });
    
    if (userCards.length > 0) {
      const cardIds = userCards.map(card => card.cardId);
      await prisma.nFCTransaction.deleteMany({
        where: { cardId: { in: cardIds } }
      });
      console.log(`✅ [Backend] Deleted ${cardIds.length} card transactions`);
    }
    
    // 2. Hapus kartu NFC pengguna
    console.log(`🗑️ [Backend] Menghapus kartu NFC untuk pengguna ${userId}...`);
    await prisma.nFCCard.deleteMany({
      where: { userId: userId }
    });

    // 3. Hapus transaksi pengguna (yang dikirim dan diterima)
    console.log(`🗑️ [Backend] Menghapus transaksi untuk pengguna ${userId}...`);
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }
    });

    // 4. Hapus peringatan fraud pengguna
    console.log(`🗑️ [Backend] Menghapus peringatan fraud untuk pengguna ${userId}...`);
    await prisma.fraudAlert.deleteMany({
      where: { userId: userId }
    });

    // 5. Hapus sesi pengguna
    console.log(`🗑️ [Backend] Menghapus sesi untuk pengguna ${userId}...`);
    await prisma.userSession.deleteMany({
      where: { userId: userId }
    });

    // 6. Hapus pengguna
    console.log(`🗑️ [Backend] Menghapus pengguna ${userId}...`);
    await prisma.user.delete({
      where: { id: userId }
    });

    // 7. Catat aksi admin
    console.log(`📝 [Backend] Mencatat aksi admin...`);
    await prisma.adminLog.create({
      data: {
        action: 'USER_DELETE',
        details: JSON.stringify({
          userId: user.id,
          username: user.username,
          name: user.name
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Kirim notifikasi ke dashboard admin
    if (req.io) {
      req.io.to('admin-room').emit('user-deleted', { userId: user.id });
    }

    console.log(`✅ [Backend] Pengguna ${user.username} (ID: ${user.id}) berhasil dihapus (cascade complete)`);

    res.json({
      success: true,
      message: 'Pengguna berhasil dihapus',
      user: {
        id: user.id,
        name: user.name,
        username: user.username
      }
    });

  } catch (error) {
    console.error('❌ [Backend] Kesalahan saat menghapus pengguna:', error);
    console.error('❌ [Backend] Detail kesalahan:', error.message);
    console.error('❌ [Backend] Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Gagal menghapus pengguna',
      details: error.message 
    });
  }
});

module.exports = router;