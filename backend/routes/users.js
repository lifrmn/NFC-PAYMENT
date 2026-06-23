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
// ENDPOINT 3: GET /username/:username - CARI PENGGUNA BERDASARKAN USERNAME
// ============================================================
// PENTING: Endpoint ini harus didefinisikan SEBELUM GET /:id agar tidak
// terhalang oleh route dinamis /:id (Express mencocokkan route secara urutan).
// Contoh: GET /username/john harus cocok di sini, bukan di /:id dengan id="username".
// ============================================================
router.get('/username/:username', async (req, res) => { // GET /username/:username → cari user berdasarkan username
  try {
    // STEP 1: Ambil username dari URL parameter
    const { username } = req.params; // Destructure: ambil value username dari URL params
    
    const user = await prisma.user.findUnique({ // Query: cari user unik berdasarkan username
      where: { username }, // Shorthand ES6: sama dengan { username: username }
      select: {
        id: true, // ID numerik user di database
        name: true, // Nama lengkap user
        username: true, // Username untuk login
        balance: true, // Saldo e-wallet saat ini
        isActive: true // Status aktif (true) atau diblokir (false)
      }
    });

    if (!user) { // Jika user tidak ditemukan di database
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' }); // Return 404 Not Found
    }

    res.json(user); // Kirim data user sebagai JSON response
  } catch (error) {
    console.error('\u274c Gagal mendapatkan pengguna berdasarkan username:', error);
    res.status(500).json({ error: 'Gagal mendapatkan data pengguna' });
  }
});

// ============================================================
// ENDPOINT 2: GET /:id - AMBIL DETAIL PENGGUNA BERDASARKAN ID
// ============================================================
// URL PARAMETER:
// - id: integer (contoh: /api/users/5)
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
router.get('/:id/cards', async (req, res) => { // GET /:id/cards → ambil semua kartu NFC milik user
  try {
    const { id } = req.params; // Ambil ID user dari URL param
    
    // STEP 1: Cek apakah pengguna ada di database
    const user = await prisma.user.findUnique({ // Query: cek keberadaan user
      where: { id: parseInt(id) } // Filter by ID (konversi string → integer)
    });

    if (!user) { // Jika user tidak ditemukan
      return res.status(404).json({ // Return 404 Not Found
        success: false,
        error: 'Pengguna tidak ditemukan' 
      });
    }

    // Ambil semua kartu untuk pengguna ini
    const cards = await prisma.nFCCard.findMany({ // Query: ambil semua kartu NFC milik user ini
      where: { userId: parseInt(id) }, // Filter: hanya kartu yang dimiliki user ini
      select: {
        cardId: true, // UID kartu (hex string, misal "04A1B2C3D4E5F6")
        cardStatus: true, // Status kartu: ACTIVE / BLOCKED / LOST / EXPIRED
        balance: true, // Saldo kartu (dalam Rupiah)
        registeredAt: true, // Tanggal kartu pertama kali didaftarkan
        lastUsed: true // Tanggal terakhir kartu digunakan
      },
      orderBy: {
        registeredAt: 'desc' // Urutkan: yang terbaru didaftarkan di atas
      }
    });

    res.json({ // Kirim response sukses
      success: true, // Flag sukses
      cards: cards  // Array kartu milik user
    });
  } catch (error) {
    console.error('\u274c Gagal mendapatkan kartu pengguna:', error);
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
router.put('/:id/balance', [ // PUT /:id/balance → update saldo user (admin only)
  // Validasi input menggunakan express-validator
  body('amount').isNumeric().withMessage('Jumlah harus berupa angka'), // amount harus berupa angka
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan') // adminPassword wajib ada
], async (req, res) => {
  try {
    const errors = validationResult(req); // Cek hasil validasi dari middleware di atas
    if (!errors.isEmpty()) { // Jika ada error validasi
      return res.status(400).json({ errors: errors.array() }); // Return 400 dengan detail error
    }

    const { id } = req.params; // Ambil ID user dari URL
    const { amount, adminPassword, reason } = req.body; // Ambil data dari request body

    // Verifikasi password admin
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // Cek password dari .env
      return res.status(401).json({ error: 'Password admin tidak valid' }); // Return 401 jika salah
    }

    // Validasi jumlah
    if (amount < 0) { // Saldo tidak boleh negatif
      return res.status(400).json({ error: 'Jumlah tidak boleh negatif' }); // Return 400
    }

    // Perbarui saldo pengguna
    const user = await prisma.user.update({ // Update record user di database
      where: { id: parseInt(id) }, // Identifikasi user berdasarkan ID
      data: { balance: amount }, // Set saldo ke nilai baru (bukan increment)
      select: {
        id: true, // Kembalikan ID
        name: true, // Kembalikan nama
        username: true, // Kembalikan username
        balance: true // Kembalikan saldo baru
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({ // Simpan log ke tabel AdminLog
      data: {
        action: 'BALANCE_UPDATE', // Jenis aksi
        details: JSON.stringify({ // Detail aksi sebagai JSON string
          userId: user.id, // ID user yang diubah saldonya
          username: user.username, // Username untuk referensi
          newBalance: amount, // Saldo baru yang diset
          reason: reason || 'Pembaruan saldo oleh admin' // Alasan (default jika tidak diisi)
        }),
        ipAddress: req.ip, // IP address admin
        userAgent: req.headers['user-agent'] // Browser/device admin
      }
    });

    // Kirim notifikasi ke dashboard admin dan perangkat pengguna
    if (req.io) { // Cek apakah Socket.IO tersedia
      req.io.to('admin-room').emit('balance-updated', { user }); // Notifikasi admin dashboard
      req.io.to(`device-${user.deviceId}`).emit('balance-updated', { // Notifikasi device user
        balance: user.balance // Saldo terbaru
      });
    }

    res.json({ // Return response sukses
      message: 'Saldo berhasil diperbarui',
      user // Data user dengan saldo baru
    });

  } catch (error) {
    console.error('\u274c Gagal memperbarui saldo:', error);
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
router.get('/:id/transactions', async (req, res) => { // GET /:id/transactions → riwayat transaksi user
  try {
    const { id } = req.params; // Ambil ID user dari URL param
    const { limit = 10, offset = 0 } = req.query; // Pagination: default 10 data, mulai dari awal

    const transactions = await prisma.transaction.findMany({ // Query: ambil transaksi yang melibatkan user
      where: {
        OR: [ // Kondisi OR: user bisa sebagai sender ATAU receiver
          { senderId: parseInt(id) }, // Transaksi yang dikirim user (user = pengirim)
          { receiverId: parseInt(id) } // Transaksi yang diterima user (user = penerima)
        ]
      },
      include: {
        sender: { // Sertakan data pengirim
          select: { id: true, name: true, username: true } // Hanya field yang aman
        },
        receiver: { // Sertakan data penerima
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: {
        createdAt: 'desc' // Terbaru di atas
      },
      take: parseInt(limit), // LIMIT: maksimal N transaksi
      skip: parseInt(offset) // OFFSET: skip N transaksi (untuk pagination)
    });

    res.json(transactions); // Kirim array transaksi sebagai JSON
  } catch (error) {
    console.error('Get user transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Perbarui profil pengguna
router.put('/:id', [ // PUT /:id → update profil user (nama)
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Nama minimal 2 karakter') // Nama opsional, min 2 char
], async (req, res) => {
  try {
    const errors = validationResult(req); // Cek hasil validasi
    if (!errors.isEmpty()) { // Jika ada error
      return res.status(400).json({ errors: errors.array() }); // Return detail error
    }

    const { id } = req.params; // Ambil ID user dari URL
    const { name } = req.body; // Ambil nama baru dari request body

    // Cek apakah pengguna dapat memperbarui profil ini (hanya profil sendiri atau admin)
    if (req.user && req.user.id !== parseInt(id)) { // Jika ada token tapi bukan pemilik profil
      return res.status(403).json({ error: 'Akses ditolak' }); // Return 403 Forbidden
    }

    const user = await prisma.user.update({ // Update record user di database
      where: { id: parseInt(id) }, // Identifikasi user berdasarkan ID
      data: { name }, // Update hanya field nama
      select: {
        id: true, // Kembalikan ID
        name: true, // Kembalikan nama baru
        username: true, // Kembalikan username
        balance: true // Kembalikan saldo
      }
    });

    res.json({ // Return response sukses
      message: 'Profil berhasil diperbarui',
      user // Data user dengan nama baru
    });

  } catch (error) {
    console.error('\u274c Gagal memperbarui profil:', error);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// Nonaktifkan pengguna (khusus admin)
router.put('/:id/deactivate', async (req, res) => { // PUT /:id/deactivate → blokir akun user
  try {
    const { id } = req.params; // Ambil ID user dari URL
    const { adminPassword } = req.body; // Ambil admin password dari request body

    // Verify admin password
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // Cek password dari environment variable
      return res.status(401).json({ error: 'Invalid admin password' }); // Return 401 jika salah
    }

    const user = await prisma.user.update({ // Update record user di database
      where: { id: parseInt(id) }, // Identifikasi user berdasarkan ID
      data: { isActive: false }, // Set isActive = false (menonaktifkan akun)
      select: {
        id: true, // Kembalikan ID
        name: true, // Kembalikan nama
        username: true, // Kembalikan username
        isActive: true // Kembalikan status baru (false)
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({ // Simpan log ke tabel AdminLog untuk audit trail
      data: {
        action: 'USER_DEACTIVATE', // Jenis aksi: nonaktifkan user
        details: JSON.stringify({ // Detail sebagai JSON string
          userId: user.id, // ID user yang dinonaktifkan
          username: user.username // Username untuk referensi
        }),
        ipAddress: req.ip, // IP address admin
        userAgent: req.headers['user-agent'] // Browser/device admin
      }
    });

    // Kirim notifikasi ke dashboard admin
    if (req.io) { // Cek apakah Socket.IO tersedia
      req.io.to('admin-room').emit('user-deactivated', { user }); // Notifikasi real-time ke admin
    }

    res.json({ // Return response sukses
      message: 'Pengguna berhasil dinonaktifkan',
      user // Data user dengan isActive = false
    });

  } catch (error) {
    console.error('\u274c Gagal menonaktifkan pengguna:', error);
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
router.delete('/:id', async (req, res) => { // DELETE /:id → hapus user permanen beserta semua data terkait
  try {
    const { id } = req.params; // Ambil ID user dari URL
    const userId = parseInt(id); // Konversi string → integer untuk query Prisma

    console.log(`\uD83D\uDDD1\uFE0F [Backend] Delete user request for ID: ${userId}`);

    // Check if user exists
    const user = await prisma.user.findUnique({ // Cari user yang akan dihapus
      where: { id: userId }, // Filter berdasarkan ID
      select: {
        id: true, // ID untuk referensi di log
        name: true, // Nama untuk log
        username: true // Username untuk log
      }
    });

    if (!user) { // Jika user tidak ditemukan
      console.log(`\u274c [Backend] User ${userId} not found`);
      return res.status(404).json({ error: 'User tidak ditemukan' }); // Return 404
    }

    console.log(`\u2705 [Backend] User found: ${user.username}`);

    // CASCADE DELETE: Hapus semua record terkait terlebih dahulu
    // URUTAN PENTING: Hapus dari tabel anak ke tabel induk
    
    // 1. Hapus transaksi NFC (anak dari NFCCard)
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Deleting NFC transactions for user ${userId}...`);
    const userCards = await prisma.nFCCard.findMany({ // Ambil semua kartu NFC milik user
      where: { userId: userId }, // Filter: hanya kartu user ini
      select: { cardId: true } // Hanya perlu cardId untuk delete transaksinya
    });
    
    if (userCards.length > 0) { // Jika user punya kartu NFC
      const cardIds = userCards.map(card => card.cardId); // Ekstrak array cardId
      await prisma.nFCTransaction.deleteMany({ // Hapus semua transaksi dari semua kartu user
        where: { cardId: { in: cardIds } } // Filter: cardId ada di array cardIds
      });
      console.log(`\u2705 [Backend] Deleted ${cardIds.length} card transactions`);
    }
    
    // 2. Hapus kartu NFC pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus kartu NFC untuk pengguna ${userId}...`);
    await prisma.nFCCard.deleteMany({ // Hapus semua kartu NFC milik user
      where: { userId: userId } // Filter: hanya kartu user ini
    });

    // 3. Hapus transaksi pengguna (yang dikirim dan diterima)
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus transaksi untuk pengguna ${userId}...`);
    await prisma.transaction.deleteMany({ // Hapus semua transaksi yang melibatkan user
      where: {
        OR: [ // User bisa sebagai sender ATAU receiver
          { senderId: userId }, // Transaksi di mana user adalah pengirim
          { receiverId: userId } // Transaksi di mana user adalah penerima
        ]
      }
    });

    // 4. Hapus peringatan fraud pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus peringatan fraud untuk pengguna ${userId}...`);
    await prisma.fraudAlert.deleteMany({ // Hapus semua fraud alert milik user
      where: { userId: userId } // Filter: hanya fraud alert user ini
    });

    // 5. Hapus sesi pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus sesi untuk pengguna ${userId}...`);
    await prisma.userSession.deleteMany({ // Hapus semua sesi login user
      where: { userId: userId } // Filter: hanya sesi user ini
    });

    // 6. Hapus pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus pengguna ${userId}...`);
    await prisma.user.delete({ // Hapus record user dari tabel User
      where: { id: userId } // Identifikasi berdasarkan ID
    });

    // 7. Catat aksi admin
    console.log(`\uD83D\uDCDD [Backend] Mencatat aksi admin...`);
    await prisma.adminLog.create({ // Simpan log aksi delete ke tabel AdminLog
      data: {
        action: 'USER_DELETE', // Jenis aksi: hapus user
        details: JSON.stringify({ // Detail aksi sebagai JSON string
          userId: user.id, // ID user yang dihapus
          username: user.username, // Username
          name: user.name // Nama lengkap
        }),
        ipAddress: req.ip, // IP address admin
        userAgent: req.headers['user-agent'] // Browser/device admin
      }
    });

    // Kirim notifikasi ke dashboard admin
    if (req.io) { // Cek apakah Socket.IO tersedia
      req.io.to('admin-room').emit('user-deleted', { userId: user.id }); // Notifikasi ke admin dashboard
    }

    console.log(`\u2705 [Backend] Pengguna ${user.username} (ID: ${user.id}) berhasil dihapus (cascade complete)`);

    res.json({ // Return response sukses
      success: true, // Flag sukses
      message: 'Pengguna berhasil dihapus',
      user: { // Data user yang dihapus (untuk konfirmasi)
        id: user.id, // ID
        name: user.name, // Nama
        username: user.username // Username
      }
    });

  } catch (error) {
    console.error('\u274c [Backend] Kesalahan saat menghapus pengguna:', error);
    console.error('\u274c [Backend] Detail kesalahan:', error.message);
    console.error('\u274c [Backend] Stack trace:', error.stack);
    res.status(500).json({ // Return 500 dengan detail error untuk debugging
      error: 'Gagal menghapus pengguna',
      details: error.message 
    });
  }
});

module.exports = router; // Export router agar bisa di-mount di server.js sebagai /api/users