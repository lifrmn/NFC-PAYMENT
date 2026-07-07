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

const express = require('express'); // const membuat variabel tetap; require('express') memanggil module Express.js ...
// const membuat variabel tetap; require('express') memanggil module Express.js yang sudah terinstall di node_modules; digunakan untuk membuat router HTTP
const { body, validationResult } = require('express-validator'); // const dengan destructuring { body, validationResult }; body adalah fungsi unt...
// const dengan destructuring { body, validationResult }; body adalah fungsi untuk mendefinisikan aturan validasi input; validationResult mengambil hasil validasi dari request
const { PrismaClient } = require('@prisma/client'); // destructuring { PrismaClient } dari module @prisma/client; PrismaClient adala...
// destructuring { PrismaClient } dari module @prisma/client; PrismaClient adalah kelas ORM yang digunakan untuk query database SQLite secara aman

const router = express.Router(); // const membuat variabel tetap; express.Router() membuat instance router baru y...
// const membuat variabel tetap; express.Router() membuat instance router baru yang akan menampung semua endpoint /api/users
const prisma = new PrismaClient(); // const membuat variabel tetap; new PrismaClient() membuat instance koneksi ke ...
// const membuat variabel tetap; new PrismaClient() membuat instance koneksi ke database; operator new memanggil constructor class PrismaClient

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
router.get('/', async (req, res) => { // router.get mendaftarkan endpoint HTTP GET pada path '/'; async berarti handle...
  // router.get mendaftarkan endpoint HTTP GET pada path '/'; async berarti handler ini adalah fungsi asynchronous yang bisa menggunakan await; req adalah objek request dari client; res adalah objek response untuk mengirim data balik
  try { // try memulai blok yang akan dicoba; jika ada error di dalam blok ini, eksekusi...
    // try memulai blok yang akan dicoba; jika ada error di dalam blok ini, eksekusi loncat ke blok catch
    // STEP 1: Query database untuk ambil semua user
    // Gunakan Prisma ORM - lebih aman dari SQL injection
    const users = await prisma.user.findMany({ // const membuat variabel tetap; await menunggu Promise selesai sebelum lanjut; ...
      // const membuat variabel tetap; await menunggu Promise selesai sebelum lanjut; prisma.user.findMany() adalah method Prisma ORM yang setara SQL SELECT * FROM users
      select: { // select adalah objek Prisma untuk memilih kolom mana saja yang dikembalikan — ...
        // select adalah objek Prisma untuk memilih kolom mana saja yang dikembalikan — seperti SELECT id, name, ... di SQL
        id: true, // true berarti kolom id IKUT dikembalikan
        // true berarti kolom id IKUT dikembalikan
        name: true, // Nama lengkap
        // Nama lengkap
        username: true, // Username untuk login
        // Username untuk login
        balance: true, // Saldo e-wallet (dalam Rupiah)
        // Saldo e-wallet (dalam Rupiah)
        deviceId: true, // ID perangkat Android yang digunakan
        // ID perangkat Android yang digunakan
        isActive: true, // Status aktif/diblokir
        // Status aktif/diblokir
        createdAt: true, // Tanggal registrasi
        // Tanggal registrasi
        _count: { // _count adalah fitur Prisma untuk menghitung jumlah relasi — seperti COUNT() d...
          // _count adalah fitur Prisma untuk menghitung jumlah relasi — seperti COUNT() di SQL
          select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
            // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
            sentTransactions: true, // Hitung jumlah transaksi yang dikirim user
            // Hitung jumlah transaksi yang dikirim user
            receivedTransactions: true // Hitung jumlah transaksi yang diterima user
            // Hitung jumlah transaksi yang diterima user
          }
        }
      },
      orderBy: { // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya ...
        // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya berdasarkan createdAt DESC untuk menampilkan terbaru
        createdAt: 'desc' // orderBy adalah klausa pengurutan Prisma — setara ORDER BY createdAt DESC di S...
        // orderBy adalah klausa pengurutan Prisma — setara ORDER BY createdAt DESC di SQL; 'desc' berarti terbaru di atas
      }
    });

    // STEP 2: Kirim response berupa array JSON ke client
    res.json(users); // res.json() mengirim respons dengan Content-Type: application/json dan mengonv...
    // res.json() mengirim respons dengan Content-Type: application/json dan mengonversi array users ke string JSON otomatis
  } catch (error) { // catch menangkap error yang terjadi di dalam blok try; variabel error berisi o...
    // catch menangkap error yang terjadi di dalam blok try; variabel error berisi objek Error
    console.error('\u274c Gagal mendapatkan data pengguna:', error); // console.error mencetak pesan error ke terminal server dengan format merah
    // console.error mencetak pesan error ke terminal server dengan format merah
    res.status(500).json({ error: 'Gagal mendapatkan data pengguna' }); // res.status(500) mengatur HTTP status 500 (Internal Server Error); .json() men...
    // res.status(500) mengatur HTTP status 500 (Internal Server Error); .json() mengirim pesan error sebagai JSON
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
  // GET /username/:username → cari user berdasarkan username
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Ambil username dari URL parameter
    const { username } = req.params; // Destructure: ambil value username dari URL params
    // Destructure: ambil value username dari URL params
    
    const user = await prisma.user.findUnique({ // Query: cari user unik berdasarkan username
      // Query: cari user unik berdasarkan username
      where: { username }, // Shorthand ES6: sama dengan { username: username }
      // Shorthand ES6: sama dengan { username: username }
      select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        id: true, // ID numerik user di database
        // ID numerik user di database
        name: true, // Nama lengkap user
        // Nama lengkap user
        username: true, // Username untuk login
        // Username untuk login
        balance: true, // Saldo e-wallet saat ini
        // Saldo e-wallet saat ini
        isActive: true // Status aktif (true) atau diblokir (false)
        // Status aktif (true) atau diblokir (false)
      }
    });

    if (!user) { // Jika user tidak ditemukan di database
      // Jika user tidak ditemukan di database
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' }); // Return 404 Not Found
      // Return 404 Not Found
    }

    res.json(user); // Kirim data user sebagai JSON response
    // Kirim data user sebagai JSON response
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('\u274c Gagal mendapatkan pengguna berdasarkan username:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan data pengguna' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terd...
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// ============================================================
// ENDPOINT 2: GET /:id - AMBIL DETAIL PENGGUNA BERDASARKAN ID
// ============================================================
// URL PARAMETER:
// - id: integer (contoh: /api/users/5)
// ============================================================
router.get('/:id', async (req, res) => { // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET k...
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { id } = req.params; // destructuring req.params: mengambil parameter URL dinamis
    // destructuring req.params: mengambil parameter URL dinamis
    
    const user = await prisma.user.findUnique({ // const user: menyimpan data user yang diambil dari database secara async
      // const user: menyimpan data user yang diambil dari database secara async
      where: { id: parseInt(id) }, // parseInt() mengubah string ID dari URL parameter ke integer; diperlukan karen...
      // parseInt() mengubah string ID dari URL parameter ke integer; diperlukan karena req.params selalu string
      select: { // select: { } menentukan field yang diambil; mencegah pengambilan data sensitif...
        // select: { } menentukan field yang diambil; mencegah pengambilan data sensitif seperti password
        id: true, name: true, username: true, balance: true, // field dasar profil user
        // field dasar profil user
        deviceId: true, isActive: true, createdAt: true, updatedAt: true // field tambahan untuk monitoring
        // field tambahan untuk monitoring
      }
    });

    if (!user) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' }); // 404 Not Found jika user tidak ada di database
      // 404 Not Found jika user tidak ada di database
    }

    // ✅ DIPERBAIKI: Auto-sync user.balance dari NFC card balance.
    // Masalah sebelumnya: admin top-up menambah saldo kartu (NFCCard.balance) tapi
    // user.balance di tabel User tidak selalu ikut update → mobile app tampilkan Rp 0.
    // Solusi: setiap GET /api/users/:id, cek kartu aktif user, update user.balance jika berbeda.
    const cards = await prisma.nFCCard.findMany({ // prisma.nFCCard.findMany(): mengambil semua kartu aktif milik user untuk penge...
      // prisma.nFCCard.findMany(): mengambil semua kartu aktif milik user untuk pengecekan saldo
      where: { userId: parseInt(id), cardStatus: 'ACTIVE' }, // ambil semua kartu aktif milik user ini
      // ambil semua kartu aktif milik user ini
      select: { balance: true } // hanya butuh field balance, tidak perlu data lain
      // hanya butuh field balance, tidak perlu data lain
    }); // Jumlahkan semua saldo kartu aktif user sebagai saldo efektif
    // Jumlahkan semua saldo kartu aktif user sebagai saldo efektif
    const cardBalance = cards.reduce((sum, c) => sum + (c.balance || 0), 0); // .reduce() menjumlahkan semua balance kartu; || 0 fallback jika balance null
    // .reduce() menjumlahkan semua balance kartu; || 0 fallback jika balance null

    if (cardBalance > 0 && cardBalance !== user.balance) { // cek apakah saldo kartu berbeda dengan saldo user dan tidak nol
      // cek apakah saldo kartu berbeda dengan saldo user dan tidak nol
      // Saldo kartu berbeda dari saldo user → perbarui user.balance agar sinkron
      await prisma.user.update({ // prisma.user.update(): memperbarui saldo user di database
        // prisma.user.update(): memperbarui saldo user di database
        where: { id: parseInt(id) }, // WHERE id = userId
        // WHERE id = userId
        data: { balance: cardBalance } // set user.balance = total saldo kartu aktif
        // set user.balance = total saldo kartu aktif
      });
      user.balance = cardBalance; // perbarui nilai lokal sebelum dikirim ke mobile app
      // perbarui nilai lokal sebelum dikirim ke mobile app
      console.log(`\ud83d\udd04 Auto-synced user ${id} balance: ${user.balance} \u2192 ${cardBalance}`); // log sinkronisasi saldo
      // log sinkronisasi saldo
    }

    res.json(user); // res.json(user) mengirim data user sebagai JSON response
    // res.json(user) mengirim data user sebagai JSON response
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
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
  // GET /:id/cards → ambil semua kartu NFC milik user
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { id } = req.params; // Ambil ID user dari URL param
    // Ambil ID user dari URL param
    
    // STEP 1: Cek apakah pengguna ada di database
    const user = await prisma.user.findUnique({ // Query: cek keberadaan user
      // Query: cek keberadaan user
      where: { id: parseInt(id) } // Filter by ID (konversi string → integer)
      // Filter by ID (konversi string → integer)
    });

    if (!user) { // Jika user tidak ditemukan
      // Jika user tidak ditemukan
      return res.status(404).json({ // Return 404 Not Found
        // Return 404 Not Found
        success: false, // success: false menandakan operasi gagal; frontend memeriksa field ini untuk m...
        // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
        error: 'Pengguna tidak ditemukan' // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend u...
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
      });
    }

    // Ambil semua kartu untuk pengguna ini
    const cards = await prisma.nFCCard.findMany({ // Query: ambil semua kartu NFC milik user ini
      // Query: ambil semua kartu NFC milik user ini
      where: { userId: parseInt(id) }, // Filter: hanya kartu yang dimiliki user ini
      // Filter: hanya kartu yang dimiliki user ini
      select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        cardId: true, // UID kartu (hex string, misal "04A1B2C3D4E5F6")
        // UID kartu (hex string, misal "04A1B2C3D4E5F6")
        cardStatus: true, // Status kartu: ACTIVE / BLOCKED / LOST / EXPIRED
        // Status kartu: ACTIVE / BLOCKED / LOST / EXPIRED
        balance: true, // Saldo kartu (dalam Rupiah)
        // Saldo kartu (dalam Rupiah)
        registeredAt: true, // Tanggal kartu pertama kali didaftarkan
        // Tanggal kartu pertama kali didaftarkan
        lastUsed: true // Tanggal terakhir kartu digunakan
        // Tanggal terakhir kartu digunakan
      },
      orderBy: { // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya ...
        // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya berdasarkan createdAt DESC untuk menampilkan terbaru
        registeredAt: 'desc' // Urutkan: yang terbaru didaftarkan di atas
        // Urutkan: yang terbaru didaftarkan di atas
      }
    });

    res.json({ // Kirim response sukses
      // Kirim response sukses
      success: true, // Flag sukses
      // Flag sukses
      cards: cards // Array kartu milik user
      // Array kartu milik user
    });
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('\u274c Gagal mendapatkan kartu pengguna:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ // mengirim response error 500 Internal Server Error; status 500 menandakan kesa...
      // mengirim response error 500 Internal Server Error; status 500 menandakan kesalahan tak terduga di sisi server
      success: false, // success: false menandakan operasi gagal; frontend memeriksa field ini untuk m...
      // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
      error: 'Gagal mendapatkan kartu pengguna' // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend u...
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
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
// PUT /:id/balance → update saldo user (admin only)
  // Validasi input menggunakan express-validator
  body('amount').isNumeric().withMessage('Jumlah harus berupa angka'), // amount harus berupa angka
  // amount harus berupa angka
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan') // adminPassword wajib ada
  // adminPassword wajib ada
], async (req, res) => { // array middleware diikuti route handler; [] berisi middleware yang dijalankan ...
  // array middleware diikuti route handler; [] berisi middleware yang dijalankan sebelum handler utama async (req, res)
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const errors = validationResult(req); // Cek hasil validasi dari middleware di atas
    // Cek hasil validasi dari middleware di atas
    if (!errors.isEmpty()) { // Jika ada error validasi
      // Jika ada error validasi
      return res.status(400).json({ errors: errors.array() }); // Return 400 dengan detail error
      // Return 400 dengan detail error
    }

    const { id } = req.params; // Ambil ID user dari URL
    // Ambil ID user dari URL
    const { amount, adminPassword, reason } = req.body; // Ambil data dari request body
    // Ambil data dari request body

    // Verifikasi password admin
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // Cek password dari .env
      // Cek password dari .env
      return res.status(401).json({ error: 'Password admin tidak valid' }); // Return 401 jika salah
      // Return 401 jika salah
    }

    // Validasi jumlah
    if (amount < 0) { // Saldo tidak boleh negatif
      // Saldo tidak boleh negatif
      return res.status(400).json({ error: 'Jumlah tidak boleh negatif' }); // Return 400
      // Return 400
    }

    // Perbarui saldo pengguna
    const user = await prisma.user.update({ // Update record user di database
      // Update record user di database
      where: { id: parseInt(id) }, // Identifikasi user berdasarkan ID
      // Identifikasi user berdasarkan ID
      data: { balance: amount }, // Set saldo ke nilai baru (bukan increment)
      // Set saldo ke nilai baru (bukan increment)
      select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        id: true, // Kembalikan ID
        // Kembalikan ID
        name: true, // Kembalikan nama
        // Kembalikan nama
        username: true, // Kembalikan username
        // Kembalikan username
        balance: true // Kembalikan saldo baru
        // Kembalikan saldo baru
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({ // Simpan log ke tabel AdminLog
      // Simpan log ke tabel AdminLog
      data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat updat...
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'BALANCE_UPDATE', // Jenis aksi
        // Jenis aksi
        details: JSON.stringify({ // Detail aksi sebagai JSON string
          // Detail aksi sebagai JSON string
          userId: user.id, // ID user yang diubah saldonya
          // ID user yang diubah saldonya
          username: user.username, // Username untuk referensi
          // Username untuk referensi
          newBalance: amount, // Saldo baru yang diset
          // Saldo baru yang diset
          reason: reason || 'Pembaruan saldo oleh admin' // Alasan (default jika tidak diisi)
          // Alasan (default jika tidak diisi)
        }),
        ipAddress: req.ip, // IP address admin
        // IP address admin
        userAgent: req.headers['user-agent'] // Browser/device admin
        // Browser/device admin
      }
    });

    // Kirim notifikasi ke dashboard admin dan perangkat pengguna
    if (req.io) { // Cek apakah Socket.IO tersedia
      // Cek apakah Socket.IO tersedia
      req.io.to('admin-room').emit('balance-updated', { user }); // Notifikasi admin dashboard
      // Notifikasi admin dashboard
      req.io.to(`device-${user.deviceId}`).emit('balance-updated', { // Notifikasi device user
        // Notifikasi device user
        balance: user.balance // Saldo terbaru
        // Saldo terbaru
      });
    }

    res.json({ // Return response sukses
      // Return response sukses
      message: 'Saldo berhasil diperbarui', // pesan sukses update saldo; dikonfirmasi setelah balance user berhasil diperba...
      // pesan sukses update saldo; dikonfirmasi setelah balance user berhasil diperbarui di database
      user // Data user dengan saldo baru
      // Data user dengan saldo baru
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('\u274c Gagal memperbarui saldo:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memperbarui saldo' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terd...
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
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
  // GET /:id/transactions → riwayat transaksi user
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { id } = req.params; // Ambil ID user dari URL param
    // Ambil ID user dari URL param
    const { limit = 10, offset = 0 } = req.query; // Pagination: default 10 data, mulai dari awal
    // Pagination: default 10 data, mulai dari awal

    const transactions = await prisma.transaction.findMany({ // Query: ambil transaksi yang melibatkan user
      // Query: ambil transaksi yang melibatkan user
      where: { // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record...
        // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
        OR: [ // Kondisi OR: user bisa sebagai sender ATAU receiver
        // Kondisi OR: user bisa sebagai sender ATAU receiver
          { senderId: parseInt(id) }, // Transaksi yang dikirim user (user = pengirim)
          // Transaksi yang dikirim user (user = pengirim)
          { receiverId: parseInt(id) } // Transaksi yang diterima user (user = penerima)
          // Transaksi yang diterima user (user = penerima)
        ]
      },
      include: { // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambi...
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        sender: { // Sertakan data pengirim
          // Sertakan data pengirim
          select: { id: true, name: true, username: true } // Hanya field yang aman
          // Hanya field yang aman
        },
        receiver: { // Sertakan data penerima
          // Sertakan data penerima
          select: { id: true, name: true, username: true } // select { id, name, username } memilih hanya 3 field yang diperlukan; tidak me...
          // select { id, name, username } memilih hanya 3 field yang diperlukan; tidak mengambil password atau field sensitif lainnya
        }
      },
      orderBy: { // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya ...
        // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya berdasarkan createdAt DESC untuk menampilkan terbaru
        createdAt: 'desc' // Terbaru di atas
        // Terbaru di atas
      },
      take: parseInt(limit), // LIMIT: maksimal N transaksi
      // LIMIT: maksimal N transaksi
      skip: parseInt(offset) // OFFSET: skip N transaksi (untuk pagination)
      // OFFSET: skip N transaksi (untuk pagination)
    });

    res.json(transactions); // Kirim array transaksi sebagai JSON
    // Kirim array transaksi sebagai JSON
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('Get user transactions error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to get transactions' }); // mengirim response error 500 dengan pesan gagal ambil transaksi; status 500 me...
    // mengirim response error 500 dengan pesan gagal ambil transaksi; status 500 menandakan error server
  }
});

// Perbarui profil pengguna
router.put('/:id', [ // PUT /:id → update profil user (nama)
// PUT /:id → update profil user (nama)
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Nama minimal 2 karakter') // Nama opsional, min 2 char
  // Nama opsional, min 2 char
], async (req, res) => { // array middleware diikuti route handler; [] berisi middleware yang dijalankan ...
  // array middleware diikuti route handler; [] berisi middleware yang dijalankan sebelum handler utama async (req, res)
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const errors = validationResult(req); // Cek hasil validasi
    // Cek hasil validasi
    if (!errors.isEmpty()) { // Jika ada error
      // Jika ada error
      return res.status(400).json({ errors: errors.array() }); // Return detail error
      // Return detail error
    }

    const { id } = req.params; // Ambil ID user dari URL
    // Ambil ID user dari URL
    const { name } = req.body; // Ambil nama baru dari request body
    // Ambil nama baru dari request body

    // Cek apakah pengguna dapat memperbarui profil ini (hanya profil sendiri atau admin)
    if (req.user && req.user.id !== parseInt(id)) { // Jika ada token tapi bukan pemilik profil
      // Jika ada token tapi bukan pemilik profil
      return res.status(403).json({ error: 'Akses ditolak' }); // Return 403 Forbidden
      // Return 403 Forbidden
    }

    const user = await prisma.user.update({ // Update record user di database
      // Update record user di database
      where: { id: parseInt(id) }, // Identifikasi user berdasarkan ID
      // Identifikasi user berdasarkan ID
      data: { name }, // Update hanya field nama
      // Update hanya field nama
      select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        id: true, // Kembalikan ID
        // Kembalikan ID
        name: true, // Kembalikan nama baru
        // Kembalikan nama baru
        username: true, // Kembalikan username
        // Kembalikan username
        balance: true // Kembalikan saldo
        // Kembalikan saldo
      }
    });

    res.json({ // Return response sukses
      // Return response sukses
      message: 'Profil berhasil diperbarui', // pesan sukses update profil; dikonfirmasi setelah data user berhasil diperbaru...
      // pesan sukses update profil; dikonfirmasi setelah data user berhasil diperbarui di database
      user // Data user dengan nama baru
      // Data user dengan nama baru
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('\u274c Gagal memperbarui profil:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memperbarui profil' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terd...
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Nonaktifkan pengguna (khusus admin)
router.put('/:id/deactivate', async (req, res) => { // PUT /:id/deactivate → blokir akun user
  // PUT /:id/deactivate → blokir akun user
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { id } = req.params; // Ambil ID user dari URL
    // Ambil ID user dari URL
    const { adminPassword } = req.body; // Ambil admin password dari request body
    // Ambil admin password dari request body

    // Verify admin password
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // Cek password dari environment variable
      // Cek password dari environment variable
      return res.status(401).json({ error: 'Invalid admin password' }); // Return 401 jika salah
      // Return 401 jika salah
    }

    const user = await prisma.user.update({ // Update record user di database
      // Update record user di database
      where: { id: parseInt(id) }, // Identifikasi user berdasarkan ID
      // Identifikasi user berdasarkan ID
      data: { isActive: false }, // Set isActive = false (menonaktifkan akun)
      // Set isActive = false (menonaktifkan akun)
      select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        id: true, // Kembalikan ID
        // Kembalikan ID
        name: true, // Kembalikan nama
        // Kembalikan nama
        username: true, // Kembalikan username
        // Kembalikan username
        isActive: true // Kembalikan status baru (false)
        // Kembalikan status baru (false)
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({ // Simpan log ke tabel AdminLog untuk audit trail
      // Simpan log ke tabel AdminLog untuk audit trail
      data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat updat...
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'USER_DEACTIVATE', // Jenis aksi: nonaktifkan user
        // Jenis aksi: nonaktifkan user
        details: JSON.stringify({ // Detail sebagai JSON string
          // Detail sebagai JSON string
          userId: user.id, // ID user yang dinonaktifkan
          // ID user yang dinonaktifkan
          username: user.username // Username untuk referensi
          // Username untuk referensi
        }),
        ipAddress: req.ip, // IP address admin
        // IP address admin
        userAgent: req.headers['user-agent'] // Browser/device admin
        // Browser/device admin
      }
    });

    // Kirim notifikasi ke dashboard admin
    if (req.io) { // Cek apakah Socket.IO tersedia
      // Cek apakah Socket.IO tersedia
      req.io.to('admin-room').emit('user-deactivated', { user }); // Notifikasi real-time ke admin
      // Notifikasi real-time ke admin
    }

    res.json({ // Return response sukses
      // Return response sukses
      message: 'Pengguna berhasil dinonaktifkan', // pesan sukses deactivate user; dikonfirmasi setelah status user diubah menjadi...
      // pesan sukses deactivate user; dikonfirmasi setelah status user diubah menjadi INACTIVE di database
      user // Data user dengan isActive = false
      // Data user dengan isActive = false
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('\u274c Gagal menonaktifkan pengguna:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal menonaktifkan pengguna' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terd...
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
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
  // DELETE /:id → hapus user permanen beserta semua data terkait
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { id } = req.params; // Ambil ID user dari URL
    // Ambil ID user dari URL
    const userId = parseInt(id); // Konversi string → integer untuk query Prisma
    // Konversi string → integer untuk query Prisma

    console.log(`\uD83D\uDDD1\uFE0F [Backend] Delete user request for ID: ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // Check if user exists
    const user = await prisma.user.findUnique({ // Cari user yang akan dihapus
      // Cari user yang akan dihapus
      where: { id: userId }, // Filter berdasarkan ID
      // Filter berdasarkan ID
      select: { // select: { } menentukan field mana yang diambil dari database; hanya field yan...
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        id: true, // ID untuk referensi di log
        // ID untuk referensi di log
        name: true, // Nama untuk log
        // Nama untuk log
        username: true // Username untuk log
        // Username untuk log
      }
    });

    if (!user) { // Jika user tidak ditemukan
      // Jika user tidak ditemukan
      console.log(`\u274c [Backend] User ${userId} not found`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return res.status(404).json({ error: 'User tidak ditemukan' }); // Return 404
      // Return 404
    }

    console.log(`\u2705 [Backend] User found: ${user.username}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // CASCADE DELETE: Hapus semua record terkait terlebih dahulu
    // URUTAN PENTING: Hapus dari tabel anak ke tabel induk
    
    // 1. Hapus transaksi NFC (anak dari NFCCard)
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Deleting NFC transactions for user ${userId}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    const userCards = await prisma.nFCCard.findMany({ // Ambil semua kartu NFC milik user
      // Ambil semua kartu NFC milik user
      where: { userId: userId }, // Filter: hanya kartu user ini
      // Filter: hanya kartu user ini
      select: { cardId: true } // Hanya perlu cardId untuk delete transaksinya
      // Hanya perlu cardId untuk delete transaksinya
    });
    
    if (userCards.length > 0) { // Jika user punya kartu NFC
      // Jika user punya kartu NFC
      const cardIds = userCards.map(card => card.cardId); // Ekstrak array cardId
      // Ekstrak array cardId
      await prisma.nFCTransaction.deleteMany({ // Hapus semua transaksi dari semua kartu user
        // Hapus semua transaksi dari semua kartu user
        where: { cardId: { in: cardIds } } // Filter: cardId ada di array cardIds
        // Filter: cardId ada di array cardIds
      });
      console.log(`\u2705 [Backend] Deleted ${cardIds.length} card transactions`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    }
    
    // 2. Hapus kartu NFC pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus kartu NFC untuk pengguna ${userId}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    await prisma.nFCCard.deleteMany({ // Hapus semua kartu NFC milik user
      // Hapus semua kartu NFC milik user
      where: { userId: userId } // Filter: hanya kartu user ini
      // Filter: hanya kartu user ini
    });

    // 3. Hapus transaksi pengguna (yang dikirim dan diterima)
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus transaksi untuk pengguna ${userId}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    await prisma.transaction.deleteMany({ // Hapus semua transaksi yang melibatkan user
      // Hapus semua transaksi yang melibatkan user
      where: { // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record...
        // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
        OR: [ // User bisa sebagai sender ATAU receiver
        // User bisa sebagai sender ATAU receiver
          { senderId: userId }, // Transaksi di mana user adalah pengirim
          // Transaksi di mana user adalah pengirim
          { receiverId: userId } // Transaksi di mana user adalah penerima
          // Transaksi di mana user adalah penerima
        ]
      }
    });

    // 4. Hapus peringatan fraud pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus peringatan fraud untuk pengguna ${userId}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    await prisma.fraudAlert.deleteMany({ // Hapus semua fraud alert milik user
      // Hapus semua fraud alert milik user
      where: { userId: userId } // Filter: hanya fraud alert user ini
      // Filter: hanya fraud alert user ini
    });

    // 5. Hapus sesi pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus sesi untuk pengguna ${userId}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    await prisma.userSession.deleteMany({ // Hapus semua sesi login user
      // Hapus semua sesi login user
      where: { userId: userId } // Filter: hanya sesi user ini
      // Filter: hanya sesi user ini
    });

    // 6. Hapus pengguna
    console.log(`\uD83D\uDDD1\uFE0F [Backend] Menghapus pengguna ${userId}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    await prisma.user.delete({ // Hapus record user dari tabel User
      // Hapus record user dari tabel User
      where: { id: userId } // Identifikasi berdasarkan ID
      // Identifikasi berdasarkan ID
    });

    // 7. Catat aksi admin
    console.log(`\uD83D\uDCDD [Backend] Mencatat aksi admin...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    await prisma.adminLog.create({ // Simpan log aksi delete ke tabel AdminLog
      // Simpan log aksi delete ke tabel AdminLog
      data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat updat...
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'USER_DELETE', // Jenis aksi: hapus user
        // Jenis aksi: hapus user
        details: JSON.stringify({ // Detail aksi sebagai JSON string
          // Detail aksi sebagai JSON string
          userId: user.id, // ID user yang dihapus
          // ID user yang dihapus
          username: user.username, // Username
          // Username
          name: user.name // Nama lengkap
          // Nama lengkap
        }),
        ipAddress: req.ip, // IP address admin
        // IP address admin
        userAgent: req.headers['user-agent'] // Browser/device admin
        // Browser/device admin
      }
    });

    // Kirim notifikasi ke dashboard admin
    if (req.io) { // Cek apakah Socket.IO tersedia
      // Cek apakah Socket.IO tersedia
      req.io.to('admin-room').emit('user-deleted', { userId: user.id }); // Notifikasi ke admin dashboard
      // Notifikasi ke admin dashboard
    }

    console.log(`\u2705 [Backend] Pengguna ${user.username} (ID: ${user.id}) berhasil dihapus (cascade complete)`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    res.json({ // Return response sukses
      // Return response sukses
      success: true, // Flag sukses
      // Flag sukses
      message: 'Pengguna berhasil dihapus', // pesan konfirmasi bahwa user dan semua data terkait telah dihapus permanen dar...
      // pesan konfirmasi bahwa user dan semua data terkait telah dihapus permanen dari database
      user: { // Data user yang dihapus (untuk konfirmasi)
        // Data user yang dihapus (untuk konfirmasi)
        id: user.id, // ID
        // ID
        name: user.name, // Nama
        // Nama
        username: user.username // Username
        // Username
      }
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('\u274c [Backend] Kesalahan saat menghapus pengguna:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    console.error('\u274c [Backend] Detail kesalahan:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    console.error('\u274c [Backend] Stack trace:', error.stack); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ // Return 500 dengan detail error untuk debugging
      // Return 500 dengan detail error untuk debugging
      error: 'Gagal menghapus pengguna', // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend u...
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
      details: error.message // menyertakan pesan error JavaScript asli untuk memudahkan debugging; mengungka...
      // menyertakan pesan error JavaScript asli untuk memudahkan debugging; mengungkap penyebab teknis error
    });
  }
});

module.exports = router; // Export router agar bisa di-mount di server.js sebagai /api/users
// Export router agar bisa di-mount di server.js sebagai /api/users
