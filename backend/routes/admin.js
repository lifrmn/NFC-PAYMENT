// ============================================================
// ADMIN.JS - ROUTES UNTUK ADMIN DASHBOARD
// ============================================================
// File ini berisi semua endpoint untuk admin dashboard:
// - GET /dashboard -> Statistik sistem (total users, devices, transaksi, dll)
// - POST /balance-update -> Top-up saldo untuk device/user tertentu
// - GET /logs -> History log admin actions
// - GET /settings -> Get system settings
// - PUT /settings/:key -> Update system setting
// - POST /cleanup-devices -> Hapus device yang inactive
// - GET /users -> Get all users (untuk admin dashboard)
// - POST /bulk-topup -> Top-up saldo ke semua user sekaligus
// - POST /reset-balance -> Reset balance user tertentu
// - POST /block-user -> Blokir user
// - POST /unblock-user -> Unblock user
// - POST /clear-fraud-alerts -> Hapus semua fraud alerts
//
// Semua endpoint di file ini memerlukan authenticateAdmin middleware
// (kecuali yang dibuat public untuk debugging)

const express = require('express'); // const membuat variabel tetap; require('express') memanggil module Express.js dari node_modules; Express digunakan untuk membuat router HTTP dan mendefinisikan endpoint
// const membuat variabel tetap; require('express') memanggil module Express.js dari node_modules; Express digunakan untuk membuat router HTTP dan mendefinisikan endpoint
const { body, validationResult } = require('express-validator'); // const dengan destructuring; body adalah fungsi pembuat aturan validasi input; validationResult mengambil hasil validasi dari request — mencegah data tidak valid masuk ke database
// const dengan destructuring; body adalah fungsi pembuat aturan validasi input; validationResult mengambil hasil validasi dari request — mencegah data tidak valid masuk ke database
const { PrismaClient } = require('@prisma/client'); // destructuring { PrismaClient } dari module Prisma; PrismaClient adalah kelas ORM yang digunakan untuk query database dengan type-safe
// destructuring { PrismaClient } dari module Prisma; PrismaClient adalah kelas ORM yang digunakan untuk query database dengan type-safe

const router = express.Router(); // const membuat variabel tetap; express.Router() membuat instance router baru yang akan menampung semua endpoint /api/admin
// const membuat variabel tetap; express.Router() membuat instance router baru yang akan menampung semua endpoint /api/admin
const prisma = new PrismaClient(); // const membuat variabel tetap; new PrismaClient() membuat instance baru koneksi Prisma ke database SQLite
// const membuat variabel tetap; new PrismaClient() membuat instance baru koneksi Prisma ke database SQLite

// ===============================================================
// ENDPOINT 1: GET /dashboard - Statistik sistem untuk admin dashboard
// ===============================================================
// Endpoint ini return berbagai statistik sistem:
// - Total users, devices, transaksi
// - Total balance semua user
// - Fraud alerts terakhir (window monitoring 1 hari)
// - Recent transactions (10 terbaru)
// - Recent fraud alerts (5 terbaru)
//
// Usage: GET /api/admin/dashboard
// Headers: x-admin-password: admin123, x-app-key: NFC2025SecureApp
router.get('/dashboard', async (req, res) => { // router.get mendaftarkan endpoint HTTP GET; '/dashboard' adalah path relatif endpoint ini di bawah /api/admin; async berarti handler adalah fungsi asynchronous
  // router.get mendaftarkan endpoint HTTP GET; '/dashboard' adalah path relatif endpoint ini di bawah /api/admin; async berarti handler adalah fungsi asynchronous
  try { // try memulai blok percobaan; jika ada error di dalamnya, eksekusi loncat ke blok catch
    // try memulai blok percobaan; jika ada error di dalamnya, eksekusi loncat ke blok catch
    // STEP 1: Query berbagai data secara parallel menggunakan Promise.all
    // Promise.all menjalankan semua query sekaligus (lebih cepat dari serial)
    const [ // const membuat variabel tetap; array destructuring untuk mengambil hasil masing-masing query dari Promise.all secara berurutan
    // const membuat variabel tetap; array destructuring untuk mengambil hasil masing-masing query dari Promise.all secara berurutan
      totalUsers, // Total user aktif
      // Total user aktif
      totalDevices, // Total device terdaftar
      // Total device terdaftar
      onlineDevices, // Device online (lastSeen < 5 menit yang lalu)
      // Device online (lastSeen < 5 menit yang lalu)
      totalTransactions, // Total transaksi
      // Total transaksi
      totalBalance, // Sum total balance semua user
      // Sum total balance semua user
      fraudAlerts, // Fraud alerts terakhir (window monitoring)
      // Fraud alerts terakhir (window monitoring)
      recentTransactions, // 10 transaksi terbaru
      // 10 transaksi terbaru
      recentAlerts // 5 fraud alert terbaru
      // 5 fraud alert terbaru
    ] = await Promise.all([ // await menunggu semua Promise selesai; Promise.all menerima array Promise dan menjalankan SEMUA secara paralel — lebih efisien dari await satu per satu
    // await menunggu semua Promise selesai; Promise.all menerima array Promise dan menjalankan SEMUA secara paralel — lebih efisien dari await satu per satu
      // Query 1: Count total user yang aktif (isActive = true)
      prisma.user.count({ where: { isActive: true } }), // prisma.user.count() adalah setara SQL SELECT COUNT(*) FROM users WHERE isActive = true
      // prisma.user.count() adalah setara SQL SELECT COUNT(*) FROM users WHERE isActive = true
      
      // Query 2: Count total device
      prisma.device.count(), // prisma.device.count() menghitung semua baris di tabel device
      // prisma.device.count() menghitung semua baris di tabel device
      
      // Query 3: Count device online (lastSeen dalam 5 menit terakhir)
      prisma.device.count({ // prisma.device.count() dengan kondisi where: menghitung device yang aktif (online) dalam 5 menit terakhir
        // prisma.device.count() dengan kondisi where: menghitung device yang aktif (online) dalam 5 menit terakhir
        where: { // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
          // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
          lastSeen: { // lastSeen: timestamp terakhir device melakukan sync; digunakan untuk menentukan apakah device masih 'online'
            // lastSeen: timestamp terakhir device melakukan sync; digunakan untuk menentukan apakah device masih 'online'
            gte: new Date(Date.now() - 300000) // gte berarti greater than or equal (>=); Date.now() mengembalikan timestamp sekarang dalam milidetik; 300000 = 5 menit dalam milidetik
            // gte berarti greater than or equal (>=); Date.now() mengembalikan timestamp sekarang dalam milidetik; 300000 = 5 menit dalam milidetik
          }
        }
      }),
      
      // Query 4: Count total transaksi
      prisma.transaction.count(), // menghitung semua baris di tabel transaction
      // menghitung semua baris di tabel transaction
      
      // Query 5: Sum total balance semua user aktif
      prisma.user.aggregate({ // prisma.user.aggregate(): menghitung agregat pada tabel user; setara SELECT SUM(balance) WHERE isActive=true
        // prisma.user.aggregate(): menghitung agregat pada tabel user; setara SELECT SUM(balance) WHERE isActive=true
        _sum: { balance: true }, // _sum adalah operasi agregasi Prisma — setara SQL SUM(balance); true berarti field balance ikut dihitung
        // _sum adalah operasi agregasi Prisma — setara SQL SUM(balance); true berarti field balance ikut dihitung
        where: { isActive: true } // filter hanya user aktif
        // filter hanya user aktif
      }),
      
      // Query 6: Count fraud alerts dalam window monitoring (1 hari terakhir)
      prisma.fraudAlert.count({ // prisma.fraudAlert.count() dengan filter waktu: menghitung fraud alert dalam 24 jam terakhir untuk monitoring harian
        // prisma.fraudAlert.count() dengan filter waktu: menghitung fraud alert dalam 24 jam terakhir untuk monitoring harian
        where: { // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
          // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
          createdAt: { // createdAt: field timestamp pembuatan record; difilter untuk mendapatkan alert dalam rentang waktu tertentu
            // createdAt: field timestamp pembuatan record; difilter untuk mendapatkan alert dalam rentang waktu tertentu
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours — 24 jam × 60 menit × 60 detik × 1000 milidetik
            // Last 24 hours — 24 jam × 60 menit × 60 detik × 1000 milidetik
          }
        }
      }),
      
      // Query 7: Get 10 transaksi terbaru dengan data sender & receiver
      prisma.transaction.findMany({ // prisma.transaction.findMany(): mengambil 10 transaksi terbaru dengan JOIN ke user sender dan receiver untuk ditampilkan di dashboard
        // prisma.transaction.findMany(): mengambil 10 transaksi terbaru dengan JOIN ke user sender dan receiver untuk ditampilkan di dashboard
        include: { // include adalah fitur Prisma untuk JOIN tabel relasi — setara SQL INNER JOIN
          // include adalah fitur Prisma untuk JOIN tabel relasi — setara SQL INNER JOIN
          sender: { select: { id: true, name: true, username: true } }, // JOIN ke tabel user sebagai sender; select memilih kolom yang dikembalikan
          // JOIN ke tabel user sebagai sender; select memilih kolom yang dikembalikan
          receiver: { select: { id: true, name: true, username: true } } // JOIN ke tabel user sebagai receiver
          // JOIN ke tabel user sebagai receiver
        },
        orderBy: { createdAt: 'desc' }, // ORDER BY createdAt DESC — terbaru di atas
        // ORDER BY createdAt DESC — terbaru di atas
        take: 10 // take adalah LIMIT di Prisma — ambil maksimal 10 baris
        // take adalah LIMIT di Prisma — ambil maksimal 10 baris
      }),
      
      // Query 8: Get 5 fraud alert terbaru dengan data user
      prisma.fraudAlert.findMany({ // prisma.fraudAlert.findMany(): mengambil 5 fraud alert terbaru dengan data user untuk preview di dashboard admin
        // prisma.fraudAlert.findMany(): mengambil 5 fraud alert terbaru dengan data user untuk preview di dashboard admin
        include: { // JOIN ke tabel relasi
          // JOIN ke tabel relasi
          user: { select: { id: true, name: true, username: true } } // Data user yang terkena fraud alert
          // Data user yang terkena fraud alert
        },
        orderBy: { createdAt: 'desc' }, // terbaru di atas
        // terbaru di atas
        take: 5 // ambil 5 baris teratas
        // ambil 5 baris teratas
      })
    ]);

    // STEP 2: Format response data dan kirim ke client
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      summary: { // Summary statistik
        // Summary statistik
        totalUsers, // Total user aktif
        // Total user aktif
        totalDevices, // Total device
        // Total device
        onlineDevices, // Device online
        // Device online
        offlineDevices: totalDevices - onlineDevices, // Device offline (total - online)
        // Device offline (total - online)
        totalTransactions, // Total transaksi
        // Total transaksi
        totalBalance: totalBalance._sum.balance || 0, // Total balance (atau 0 jika null)
        // Total balance (atau 0 jika null)
        fraudAlertsRecent: fraudAlerts // Fraud alerts (window monitoring 1 hari)
        // Fraud alerts (window monitoring 1 hari)
      },
      recentTransactions, // Array 10 transaksi terbaru
      // Array 10 transaksi terbaru
      recentFraudAlerts: recentAlerts, // Array 5 fraud alert terbaru
      // Array 5 fraud alert terbaru
      timestamp: new Date().toISOString() // Waktu response generated
      // Waktu response generated
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan statistik dashboard:', error); // Log error
    // Log error
    res.status(500).json({ error: 'Gagal mendapatkan statistik dashboard' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Perbarui saldo pengguna (aksi admin)
router.post('/balance-update', [ // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
// router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  body('deviceId').notEmpty().withMessage('ID Perangkat diperlukan'), // validasi: deviceId tidak boleh kosong; withMessage() menentukan pesan error jika validasi gagal
  // validasi: deviceId tidak boleh kosong; withMessage() menentukan pesan error jika validasi gagal
  body('amount').isFloat({ min: 0 }).withMessage('Jumlah harus positif'), // validasi: amount harus angka float; min: 0 memastikan tidak negatif
  // validasi: amount harus angka float; min: 0 memastikan tidak negatif
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan') // validasi: adminPassword wajib ada untuk memastikan hanya admin yang bisa ubah setting
  // validasi: adminPassword wajib ada untuk memastikan hanya admin yang bisa ubah setting
  // validasi: adminPassword wajib ada untuk mencegah akses tidak terotorisasi
], async (req, res) => { // array middleware diikuti route handler; [] berisi middleware yang dijalankan sebelum handler utama async (req, res)
  // array middleware diikuti route handler; [] berisi middleware yang dijalankan sebelum handler utama async (req, res)
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const errors = validationResult(req); // validationResult() mengumpulkan semua hasil validasi dari middleware body() yang dijalankan sebelumnya
    // validationResult() mengumpulkan semua hasil validasi dari middleware body() yang dijalankan sebelumnya
    if (!errors.isEmpty()) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ errors: errors.array() }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }

    const { deviceId, amount, adminPassword, reason } = req.body; // destructuring req.body: mengambil 4 field dari body request untuk proses update saldo
    // destructuring req.body: mengambil 4 field dari body request untuk proses update saldo

    // Verifikasi password admin
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // validasi admin password dari body request; !== memastikan kecocokan persis; fallback ke 'admin123' jika env tidak ada
      // validasi admin password dari body request; !== memastikan kecocokan persis; fallback ke 'admin123' jika env tidak ada
      return res.status(401).json({ error: 'Password admin tidak valid' }); // return + 401: menghentikan eksekusi dan mengirim error autentikasi jika password admin salah
      // return + 401: menghentikan eksekusi dan mengirim error autentikasi jika password admin salah
    }

    // Validasi jumlah
    if (amount <= 0) { // validasi tambahan: amount harus lebih dari 0; meski ada validasi body(), ini sebagai lapisan keamanan tambahan
      // validasi tambahan: amount harus lebih dari 0; meski ada validasi body(), ini sebagai lapisan keamanan tambahan
      return res.status(400).json({ error: 'Jumlah harus positif' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }

    if (amount > 10000000) { // Maksimal 10 juta
      // Maksimal 10 juta
      return res.status(400).json({ error: 'Jumlah melebihi batas maksimum' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }

    // Cari perangkat dan pengguna
    const device = await prisma.device.findUnique({ // prisma.device.findUnique(): mencari satu device unik berdasarkan deviceId untuk verifikasi device terdaftar
      // prisma.device.findUnique(): mencari satu device unik berdasarkan deviceId untuk verifikasi device terdaftar
      where: { deviceId } // shorthand ES6: { deviceId: deviceId }; mencari record dengan deviceId yang cocok
      // shorthand ES6: { deviceId: deviceId }; mencari record dengan deviceId yang cocok
    });

    if (!device) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' }); // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
      // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
    }

    // Dapatkan semua pengguna untuk perangkat ini
    const users = await prisma.user.findMany({ // prisma.user.findMany(): mengambil semua user dari database untuk ditampilkan di halaman manajemen user admin
      // prisma.user.findMany(): mengambil semua user dari database untuk ditampilkan di halaman manajemen user admin
    // prisma.user.findMany(): mengambil semua user yang terdaftar pada device tertentu dan masih aktif
      where: { deviceId, isActive: true } // filter: hanya user dengan deviceId tersebut AND isActive=true; shorthand ES6 untuk { deviceId: deviceId }
      // filter: hanya user dengan deviceId tersebut AND isActive=true; shorthand ES6 untuk { deviceId: deviceId }
    });

    if (users.length === 0) { // memeriksa apakah array kosong — jika kosong tidak ada data yang perlu ditampilkan
      // memeriksa apakah array kosong — jika kosong tidak ada data yang perlu ditampilkan
      return res.status(404).json({ error: 'Tidak ada pengguna aktif untuk perangkat ini' }); // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
      // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
    }

    // Perbarui saldo untuk semua pengguna di perangkat
    const updatedUsers = await Promise.all( // Promise.all(): menjalankan update saldo semua user secara paralel; lebih efisien dari loop serial
    // Promise.all(): menjalankan update saldo semua user secara paralel; lebih efisien dari loop serial
      users.map(async (user) => { // .map() mengubah setiap user menjadi Promise update; async karena setiap update ke database bersifat asynchronous
        // .map() mengubah setiap user menjadi Promise update; async karena setiap update ke database bersifat asynchronous
        const updatedUser = await prisma.user.update({ // prisma.user.update(): memperbarui saldo satu user; await karena operasi database async
          // prisma.user.update(): memperbarui saldo satu user; await karena operasi database async
          where: { id: user.id }, // identifikasi user berdasarkan ID untuk update yang tepat sasaran
          // identifikasi user berdasarkan ID untuk update yang tepat sasaran
          data: { balance: { increment: amount } } // increment: menambahkan amount ke saldo existing; lebih aman dari set langsung (menghindari race condition)
          // increment: menambahkan amount ke saldo existing; lebih aman dari set langsung (menghindari race condition)
        });

        return updatedUser; // mengembalikan objek user yang telah diperbarui; dikumpulkan Promise.all() menjadi array updatedUsers
        // mengembalikan objek user yang telah diperbarui; dikumpulkan Promise.all() menjadi array updatedUsers
      })
    );

    // Catat aksi admin
    await prisma.adminLog.create({ // await prisma.adminLog.create(): mencatat aksi admin ke tabel AdminLog untuk audit trail; setiap aksi admin dicatat
      // await prisma.adminLog.create(): mencatat aksi admin ke tabel AdminLog untuk audit trail; setiap aksi admin dicatat
      data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'BALANCE_UPDATE', // label aksi untuk audit trail; BALANCE_UPDATE menandakan admin mengubah saldo via dashboard
        // label aksi untuk audit trail; BALANCE_UPDATE menandakan admin mengubah saldo via dashboard
        details: JSON.stringify({ // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          deviceId, // deviceId: ID perangkat yang saldonya diperbarui; disimpan untuk referensi audit
          // deviceId: ID perangkat yang saldonya diperbarui; disimpan untuk referensi audit
          amount, // amount: jumlah saldo yang ditambahkan; shorthand ES6 untuk amount: amount
          // amount: jumlah saldo yang ditambahkan; shorthand ES6 untuk amount: amount
          usersAffected: users.length, // jumlah user yang terpengaruh update saldo ini
          // jumlah user yang terpengaruh update saldo ini
          userIds: users.map(u => u.id), // array ID semua user yang diperbarui; untuk keperluan investigasi jika ada masalah
          // array ID semua user yang diperbarui; untuk keperluan investigasi jika ada masalah
          reason: reason || 'Top-up saldo oleh admin' // reason: alasan update saldo; || sebagai fallback jika tidak dikirim
          // reason: alasan update saldo; || sebagai fallback jika tidak dikirim
        }),
        ipAddress: req.ip, // req.ip: alamat IP admin yang memperbarui saldo; dicatat untuk audit trail keamanan
        // req.ip: alamat IP admin yang memperbarui saldo; dicatat untuk audit trail keamanan
        userAgent: req.headers['user-agent'] // req.headers['user-agent']: identifikasi browser admin; dicatat di log
        // req.headers['user-agent']: identifikasi browser admin; dicatat di log
      }
    });

    // Perbarui total saldo perangkat
    await prisma.device.update({ // prisma.device.update(): memperbarui total saldo device setelah saldo semua user-nya diperbarui
      // prisma.device.update(): memperbarui total saldo device setelah saldo semua user-nya diperbarui
      where: { deviceId }, // identifikasi device yang diperbarui berdasarkan deviceId
      // identifikasi device yang diperbarui berdasarkan deviceId
      data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        totalBalance: { // totalBalance: field agregat di tabel device yang merupakan total saldo semua user yang terdaftar
          // totalBalance: field agregat di tabel device yang merupakan total saldo semua user yang terdaftar
          increment: amount * users.length // increment: menambahkan total saldo (amount × jumlah user) ke totalBalance device
          // increment: menambahkan total saldo (amount × jumlah user) ke totalBalance device
        }
      }
    });

    console.log(`💰 Admin menambahkan Rp ${amount.toLocaleString('id-ID')} ke perangkat ${deviceId.substring(0, 8)}... untuk ${users.length} pengguna`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // Kirim pembaruan real-time
    if (req.io) { // memeriksa apakah Socket.IO (req.io) tersedia; jika ada kirim notifikasi real-time ke admin dashboard yang terhubung
      // memeriksa apakah Socket.IO (req.io) tersedia; jika ada kirim notifikasi real-time ke admin dashboard yang terhubung
      req.io.to('admin-room').emit('balance-bulk-update', { // Socket.IO: mengirim event 'balance-bulk-update' ke admin dashboard untuk update tampilan saldo secara real-time
        // Socket.IO: mengirim event 'balance-bulk-update' ke admin dashboard untuk update tampilan saldo secara real-time
        deviceId, // deviceId perangkat yang saldo user-nya diperbarui; dikirim ke dashboard untuk filter tampilan
        // deviceId perangkat yang saldo user-nya diperbarui; dikirim ke dashboard untuk filter tampilan
        amount, // jumlah saldo yang ditambahkan per user
        // jumlah saldo yang ditambahkan per user
        usersAffected: users.length, // jumlah user yang terpengaruh; ditampilkan di notifikasi dashboard
        // jumlah user yang terpengaruh; ditampilkan di notifikasi dashboard
        updatedUsers // array data user yang diperbarui; dashboard memperbarui tampilan saldo masing-masing user
        // array data user yang diperbarui; dashboard memperbarui tampilan saldo masing-masing user
      });

      // Notifikasi perangkat tertentu
      req.io.to(`device-${deviceId}`).emit('balance-updated', { // Socket.IO: mengirim event ke room khusus device ini; device dapat update saldo user di perangkatnya
        // Socket.IO: mengirim event ke room khusus device ini; device dapat update saldo user di perangkatnya
        amount, // jumlah saldo yang ditambahkan; dikirim ke device untuk ditampilkan
        // jumlah saldo yang ditambahkan; dikirim ke device untuk ditampilkan
        users: updatedUsers.map(u => ({ id: u.id, balance: u.balance })) // .map() membuat array ringkas dengan hanya id dan balance; dikirim ke device untuk update lokal
        // .map() membuat array ringkas dengan hanya id dan balance; dikirim ke device untuk update lokal
      });
    }

    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `Saldo diperbarui untuk ${users.length} pengguna di perangkat ${deviceId}`, // template literal: pesan konfirmasi dinamis dengan jumlah user dan deviceId yang terpengaruh
      // template literal: pesan konfirmasi dinamis dengan jumlah user dan deviceId yang terpengaruh
      details: { // objek details berisi informasi teknis operasi untuk referensi dan audit lebih lanjut
        // objek details berisi informasi teknis operasi untuk referensi dan audit lebih lanjut
        deviceId, // deviceId yang diperbarui; konfirmasi operasi ke perangkat yang benar
        // deviceId yang diperbarui; konfirmasi operasi ke perangkat yang benar
        amount, // jumlah saldo per user
        // jumlah saldo per user
        usersAffected: users.length, // total user yang saldo-nya berhasil diperbarui
        // total user yang saldo-nya berhasil diperbarui
        totalAdded: amount * users.length // total saldo yang ditambahkan ke seluruh sistem (amount × jumlah user)
        // total saldo yang ditambahkan ke seluruh sistem (amount × jumlah user)
      }
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan pembaruan saldo:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memperbarui saldo' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Dapatkan log admin
router.get('/logs', async (req, res) => { // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { limit = 50, offset = 0, action } = req.query; // destructuring req.query dengan default: limit=50 untuk pagination, offset=0 untuk halaman pertama, action untuk filter tipe aksi
    // destructuring req.query dengan default: limit=50 untuk pagination, offset=0 untuk halaman pertama, action untuk filter tipe aksi
    
    const whereClause = {}; // whereClause: objek kosong yang akan diisi kondisi WHERE secara dinamis berdasarkan query parameter yang dikirim
    // whereClause: objek kosong yang akan diisi kondisi WHERE secara dinamis berdasarkan query parameter yang dikirim
    if (action) whereClause.action = action; // kondisional: hanya tambahkan filter action ke whereClause jika parameter action dikirim; filter dinamis
    // kondisional: hanya tambahkan filter action ke whereClause jika parameter action dikirim; filter dinamis

    const logs = await prisma.adminLog.findMany({ // prisma.adminLog.findMany(): mengambil log aktivitas admin dari database untuk ditampilkan di halaman audit
      // prisma.adminLog.findMany(): mengambil log aktivitas admin dari database untuk ditampilkan di halaman audit
      where: whereClause, // filter dinamis berdasarkan parameter query yang dikirim; jika kosong ambil semua
      // filter dinamis berdasarkan parameter query yang dikirim; jika kosong ambil semua
      orderBy: { createdAt: 'desc' }, // urutkan dari terbaru; admin biasanya ingin lihat aksi terbaru lebih dulu
      // urutkan dari terbaru; admin biasanya ingin lihat aksi terbaru lebih dulu
      take: parseInt(limit), // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
      // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
      skip: parseInt(offset) // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
      // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
    });

    res.json(logs); // mengirim array log admin sebagai JSON response ke client; tanpa transformasi tambahan
    // mengirim array log admin sebagai JSON response ke client; tanpa transformasi tambahan
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan log admin:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan log admin' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Manajemen pengaturan sistem
router.get('/settings', async (req, res) => { // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const settings = await prisma.systemSettings.findMany(); // prisma.systemSettings.findMany(): mengambil semua pengaturan sistem dari database; disimpan sebagai key-value pairs
    // prisma.systemSettings.findMany(): mengambil semua pengaturan sistem dari database; disimpan sebagai key-value pairs
    
    const settingsObject = settings.reduce((acc, setting) => { // .reduce() mengubah array [{key, value, type}] menjadi object {key: parsedValue}; lebih mudah dikonsumsi frontend
      // .reduce() mengubah array [{key, value, type}] menjadi object {key: parsedValue}; lebih mudah dikonsumsi frontend
      let value = setting.value; // let (bukan const) karena value akan dikonversi tipenya di switch di bawah berdasarkan field type
      // let (bukan const) karena value akan dikonversi tipenya di switch di bawah berdasarkan field type
      
      // Parse nilai berdasarkan tipe
      switch (setting.type) { // switch: memeriksa tipe data setting; string, number, boolean, json perlu penanganan konversi yang berbeda
        // switch: memeriksa tipe data setting; string, number, boolean, json perlu penanganan konversi yang berbeda
        case 'number': // jika setting bertipe number: konversi dari string (disimpan di DB) ke tipe Number JavaScript
          // jika setting bertipe number: konversi dari string (disimpan di DB) ke tipe Number JavaScript
          value = parseFloat(setting.value); // parseFloat() mengubah string menjadi angka desimal; digunakan untuk nilai Z-Score atau saldo
          // parseFloat() mengubah string menjadi angka desimal; digunakan untuk nilai Z-Score atau saldo
          break; // break: keluar dari switch setelah case number dieksekusi
          // break: keluar dari switch setelah case number dieksekusi
        case 'boolean': // jika setting bertipe boolean: konversi string 'true'/'false' ke tipe boolean JavaScript
          // jika setting bertipe boolean: konversi string 'true'/'false' ke tipe boolean JavaScript
          value = setting.value === 'true'; // strict comparison: === 'true' menghasilkan true jika string sama persis 'true', false jika 'false' atau lainnya
          // strict comparison: === 'true' menghasilkan true jika string sama persis 'true', false jika 'false' atau lainnya
          break; // break: keluar dari switch setelah case boolean dieksekusi
          // break: keluar dari switch setelah case boolean dieksekusi
        case 'json': // jika setting bertipe json: parse string JSON menjadi objek/array JavaScript
          // jika setting bertipe json: parse string JSON menjadi objek/array JavaScript
          try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
            // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
            value = JSON.parse(setting.value); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
            // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
          } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
            // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
            value = setting.value; // fallback: jika JSON.parse gagal, gunakan string asli untuk menghindari crash
            // fallback: jika JSON.parse gagal, gunakan string asli untuk menghindari crash
          }
          break; // break: keluar dari case json
          // break: keluar dari case json
        default: // default: tipe lainnya (string, dll) tidak perlu konversi; value tetap sebagai string
          // default: tipe lainnya (string, dll) tidak perlu konversi; value tetap sebagai string
        // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
          value = setting.value; // untuk tipe default (string): gunakan value apa adanya tanpa konversi
          // untuk tipe default (string): gunakan value apa adanya tanpa konversi
      }
      
      acc[setting.key] = value; // dynamic key assignment: menggunakan setting.key sebagai nama properti di objek accumulator
      // dynamic key assignment: menggunakan setting.key sebagai nama properti di objek accumulator
      return acc; // kembalikan accumulator yang sudah ditambah satu entry baru
      // kembalikan accumulator yang sudah ditambah satu entry baru
    }, {}); // {} sebagai nilai awal: objek kosong yang diisi tiap iterasi .reduce()
    // {} sebagai nilai awal: objek kosong yang diisi tiap iterasi .reduce()

    res.json(settingsObject); // mengirim objek pengaturan sistem sebagai JSON; frontend dapat langsung akses nilai dengan settingsObject.key
    // mengirim objek pengaturan sistem sebagai JSON; frontend dapat langsung akses nilai dengan settingsObject.key
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan pengaturan:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan pengaturan' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Perbarui pengaturan sistem
router.put('/settings/:key', [ // router.put() mendaftarkan endpoint HTTP PUT; untuk memperbarui data yang sudah ada
// router.put() mendaftarkan endpoint HTTP PUT; untuk memperbarui data yang sudah ada
  body('value').notEmpty().withMessage('Nilai diperlukan'), // validasi: field value wajib ada; tidak boleh string kosong
  // validasi: field value wajib ada; tidak boleh string kosong
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan') // validasi: adminPassword wajib ada untuk memastikan hanya admin yang bisa ubah pengaturan sistem
  // validasi: adminPassword wajib ada untuk memastikan hanya admin yang bisa ubah pengaturan sistem
], async (req, res) => { // array middleware diikuti route handler; [] berisi middleware yang dijalankan sebelum handler utama async (req, res)
  // array middleware diikuti route handler; [] berisi middleware yang dijalankan sebelum handler utama async (req, res)
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const errors = validationResult(req); // validationResult() mengumpulkan semua error validasi dari middleware body() di atas
    // validationResult() mengumpulkan semua error validasi dari middleware body() di atas
    if (!errors.isEmpty()) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ errors: errors.array() }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }

    const { key } = req.params; // destructuring req.params: mengambil parameter key dari URL dinamis /settings/:key
    // destructuring req.params: mengambil parameter key dari URL dinamis /settings/:key
    const { value, type = 'string', adminPassword } = req.body; // destructuring req.body: value=nilai baru, type dengan default 'string', adminPassword untuk verifikasi
    // destructuring req.body: value=nilai baru, type dengan default 'string', adminPassword untuk verifikasi

    // Verify admin password
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // validasi admin password dari body request; !== memastikan kecocokan persis; fallback ke 'admin123' jika env tidak ada
      // validasi admin password dari body request; !== memastikan kecocokan persis; fallback ke 'admin123' jika env tidak ada
      return res.status(401).json({ error: 'Invalid admin password' }); // tolak request dengan 401 Unauthorized jika password admin tidak sesuai
      // tolak request dengan 401 Unauthorized jika password admin tidak sesuai
    }

    const setting = await prisma.systemSettings.upsert({ // prisma.systemSettings.upsert(): buat setting baru atau update jika sudah ada; INSERT OR UPDATE berdasarkan key
      // prisma.systemSettings.upsert(): buat setting baru atau update jika sudah ada; INSERT OR UPDATE berdasarkan key
      where: { key }, // identifikasi setting berdasarkan key yang unik; shorthand ES6 untuk { key: key }
      // identifikasi setting berdasarkan key yang unik; shorthand ES6 untuk { key: key }
      update: { value: String(value), type }, // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      create: { key, value: String(value), type } // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
    });

    // Catat aksi admin
    await prisma.adminLog.create({ // await prisma.adminLog.create(): mencatat aksi admin ke tabel AdminLog untuk audit trail; setiap aksi admin dicatat
      // await prisma.adminLog.create(): mencatat aksi admin ke tabel AdminLog untuk audit trail; setiap aksi admin dicatat
      data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'SETTING_UPDATE', // label aksi audit: mencatat bahwa admin mengubah setting sistem
        // label aksi audit: mencatat bahwa admin mengubah setting sistem
        details: JSON.stringify({ // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          key,
          newValue: value, // nilai baru yang ditetapkan; disimpan di log untuk pelacakan perubahan
          // nilai baru yang ditetapkan; disimpan di log untuk pelacakan perubahan
          type
        }),
        ipAddress: req.ip, // req.ip: IP admin yang mengubah pengaturan; dicatat untuk audit trail
        // req.ip: IP admin yang mengubah pengaturan; dicatat untuk audit trail
        userAgent: req.headers['user-agent'] // user-agent browser admin; disimpan di log untuk investigasi
        // user-agent browser admin; disimpan di log untuk investigasi
      }
    });

    // Kirim ke dashboard admin
    if (req.io) { // memeriksa apakah Socket.IO (req.io) tersedia; jika ada kirim notifikasi real-time ke admin dashboard yang terhubung
      // memeriksa apakah Socket.IO (req.io) tersedia; jika ada kirim notifikasi real-time ke admin dashboard yang terhubung
      req.io.to('admin-room').emit('setting-updated', { key, value, type }); // Socket.IO: mengirim event ke admin room agar pengaturan langsung diperbarui di dashboard tanpa refresh
      // Socket.IO: mengirim event ke admin room agar pengaturan langsung diperbarui di dashboard tanpa refresh
    }

    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      message: 'Pengaturan berhasil diperbarui', // pesan konfirmasi untuk admin bahwa setting sistem berhasil disimpan
      // pesan konfirmasi untuk admin bahwa setting sistem berhasil disimpan
      setting // objek setting yang baru disimpan; dikembalikan sebagai konfirmasi data yang tersimpan
      // objek setting yang baru disimpan; dikembalikan sebagai konfirmasi data yang tersimpan
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan memperbarui pengaturan:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memperbarui pengaturan' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Bersihkan perangkat tidak aktif
router.post('/cleanup-devices', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { adminPassword } = req.body; // destructuring req.body: mengambil adminPassword dari body request untuk verifikasi sebelum operasi destruktif
    // destructuring req.body: mengambil adminPassword dari body request untuk verifikasi sebelum operasi destruktif

    // Verifikasi password admin
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) { // validasi admin password dari body request; !== memastikan kecocokan persis; fallback ke 'admin123' jika env tidak ada
      // validasi admin password dari body request; !== memastikan kecocokan persis; fallback ke 'admin123' jika env tidak ada
      return res.status(401).json({ error: 'Password admin tidak valid' }); // return + 401: menghentikan eksekusi dan mengirim error autentikasi jika password admin salah
      // return + 401: menghentikan eksekusi dan mengirim error autentikasi jika password admin salah
    }

    // Hapus perangkat tidak aktif lebih dari 1 hari (86400 detik)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Date.now() mengembalikan timestamp milidetik saat ini; digunakan untuk cap waktu operasi
    // Date.now() mengembalikan timestamp milidetik saat ini; digunakan untuk cap waktu operasi
    
    const deletedDevices = await prisma.device.deleteMany({ // prisma.device.deleteMany(): menghapus banyak device sekaligus yang tidak aktif; setara DELETE WHERE di SQL
      // prisma.device.deleteMany(): menghapus banyak device sekaligus yang tidak aktif; setara DELETE WHERE di SQL
      where: { // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
        // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
        lastSeen: { // lastSeen: timestamp terakhir device sync; field yang menjadi kriteria penghapusan device tidak aktif
          // lastSeen: timestamp terakhir device sync; field yang menjadi kriteria penghapusan device tidak aktif
          lt: cutoffTime // lt = less than (<); hapus device yang lastSeen-nya SEBELUM cutoffTime (tidak aktif lebih dari batas waktu)
          // lt = less than (<); hapus device yang lastSeen-nya SEBELUM cutoffTime (tidak aktif lebih dari batas waktu)
        }
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({ // await prisma.adminLog.create(): mencatat aksi cleanup device ke tabel AdminLog untuk audit trail
      // await prisma.adminLog.create(): mencatat aksi cleanup device ke tabel AdminLog untuk audit trail
      data: { // data: { } berisi field yang akan diisi saat create
        // data: { } berisi field yang akan diisi saat create
        action: 'DEVICES_CLEANUP', // label aksi audit: cleanup device tidak aktif
        // label aksi audit: cleanup device tidak aktif
        details: JSON.stringify({ // JSON.stringify() mengubah objek menjadi string JSON untuk disimpan di database
          // JSON.stringify() mengubah objek menjadi string JSON untuk disimpan di database
          deletedCount: deletedDevices.count, // jumlah device yang berhasil dihapus; disimpan di log untuk referensi audit
          // jumlah device yang berhasil dihapus; disimpan di log untuk referensi audit
          cutoffTime // waktu batas device dianggap tidak aktif; shorthand ES6
          // waktu batas device dianggap tidak aktif; shorthand ES6
        }),
        ipAddress: req.ip, // req.ip: IP admin yang meminta cleanup device
        // req.ip: IP admin yang meminta cleanup device
        userAgent: req.headers['user-agent'] // user-agent browser admin; dicatat untuk keamanan
        // user-agent browser admin; dicatat untuk keamanan
      }
    });

    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      message: `Membersihkan ${deletedDevices.count} perangkat tidak aktif`, // template literal: pesan konfirmasi dinamis berapa device tidak aktif yang berhasil dihapus
      // template literal: pesan konfirmasi dinamis berapa device tidak aktif yang berhasil dihapus
      deletedCount: deletedDevices.count // jumlah device yang berhasil dihapus; dikembalikan ke client untuk konfirmasi
      // jumlah device yang berhasil dihapus; dikembalikan ke client untuk konfirmasi
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('Cleanup devices error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to cleanup devices' }); // mengirim 500 Internal Server Error jika proses cleanup device gagal
    // mengirim 500 Internal Server Error jika proses cleanup device gagal
  }
});

// ===============================================================
// ENDPOINT: GET /users - Get all users untuk admin dashboard
// ===============================================================
// Endpoint PUBLIC (bypass auth) untuk admin dashboard ambil semua user
// Usage: GET /api/admin/users
router.get('/users', async (req, res) => { // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    console.log('📋 Admin request: Get all users (bypass auth)'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 1: Query semua user dari database
    const users = await prisma.user.findMany({ // prisma.user.findMany(): mengambil semua user dari database untuk halaman manajemen user admin
      // prisma.user.findMany(): mengambil semua user dari database untuk halaman manajemen user admin
      select: { // SELECT field yang diperlukan
        // SELECT field yang diperlukan
        id: true, // User ID
        // User ID
        name: true, // Nama lengkap
        // Nama lengkap
        username: true, // Username
        // Username
        balance: true, // Saldo
        // Saldo
        isActive: true, // Status aktif/blokir
        // Status aktif/blokir
        createdAt: true, // Waktu dibuat
        // Waktu dibuat
        updatedAt: true, // Waktu terakhir diupdate
        // Waktu terakhir diupdate
        deviceId: true // Device ID
        // Device ID
      },
      orderBy: { // ORDER BY createdAt DESC (user terbaru di atas)
        // ORDER BY createdAt DESC (user terbaru di atas)
        createdAt: 'desc' // urutkan berdasarkan tanggal dibuat terbaru; admin biasanya ingin lihat user terbaru di atas
        // urutkan berdasarkan tanggal dibuat terbaru; admin biasanya ingin lihat user terbaru di atas
      }
    });

    // STEP 2: Log jumlah user ke console
    console.log(`✅ Found ${users.length} users in database`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 3: Return response dengan array users
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      users: users, // array semua user yang diambil dari database; dikirim ke admin frontend
      // array semua user yang diambil dari database; dikirim ke admin frontend
      total: users.length // jumlah total user; digunakan oleh admin untuk info total dan pagination
      // jumlah total user; digunakan oleh admin untuk info total dan pagination
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Get admin users error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to get users' }); // mengirim 500 jika query user gagal; terjadi jika ada error database
    // mengirim 500 jika query user gagal; terjadi jika ada error database
  }
});

// ===============================================================
// ENDPOINT: POST /bulk-topup - Bulk topup untuk semua users
// ===============================================================
// Endpoint untuk top-up saldo ke semua user aktif sekaligus
// Usage: POST /api/admin/bulk-topup
// Body: { amount: 50000 }
router.post('/bulk-topup', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Ambil amount dari request body
    const { amount } = req.body; // destructuring req.body: mengambil amount (jumlah saldo) yang akan ditambahkan ke semua user aktif
    // destructuring req.body: mengambil amount (jumlah saldo) yang akan ditambahkan ke semua user aktif
    
    console.log(`💰 Admin bulk topup request: ${amount} to all users`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 2: Validasi amount (wajib ada dan > 0)
    if (!amount || amount <= 0) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ error: 'Valid amount required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }
    
    // STEP 3: Update balance semua users aktif
    // updateMany = Update multiple records sekaligus
    const updateResult = await prisma.user.updateMany({ // prisma.user.updateMany(): memperbarui banyak record sekaligus; setara UPDATE ... WHERE ... di SQL; lebih efisien dari loop
      // prisma.user.updateMany(): memperbarui banyak record sekaligus; setara UPDATE ... WHERE ... di SQL; lebih efisien dari loop
      where: { // WHERE clause (filter user mana yang diupdate)
        // WHERE clause (filter user mana yang diupdate)
        isActive: true // Hanya user aktif (tidak termasuk yang diblokir)
        // Hanya user aktif (tidak termasuk yang diblokir)
      },
      data: { // Data yang akan diupdate
        // Data yang akan diupdate
        balance: { // UPDATE balance
          // UPDATE balance
          increment: parseInt(amount) // balance = balance + amount
          // balance = balance + amount
        }
      }
    });
    
    // STEP 4: Log hasil ke console
    console.log(`✅ Bulk topup success: ${updateResult.count} users updated with ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 5: Hitung total amount yang ditambahkan
    const totalAmount = updateResult.count * amount; // Total = jumlah user * amount
    // Total = jumlah user * amount
    
    // STEP 6: Return response sukses
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `Successfully topped up ${updateResult.count} users`, // template literal: pesan konfirmasi dinamis dengan jumlah user yang berhasil di-topup
      // template literal: pesan konfirmasi dinamis dengan jumlah user yang berhasil di-topup
      updatedUsers: updateResult.count, // Jumlah user yang diupdate
      // Jumlah user yang diupdate
      amount: amount, // Amount per user
      // Amount per user
      totalAmount: totalAmount // Total amount semua user
      // Total amount semua user
    });
    
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Bulk topup error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to perform bulk topup' }); // mengirim 500 jika operasi bulk topup gagal; misalnya karena error database
    // mengirim 500 jika operasi bulk topup gagal; misalnya karena error database
  }
});

// ===============================================================
// ENDPOINT: POST /reset-balance - Reset balance user tertentu
// ===============================================================
// Endpoint untuk reset balance user ke nilai tertentu (bukan increment)
// Usage: POST /api/admin/reset-balance
// Body: { userId: 123, newBalance: 1000000, password: 'admin123' }
router.post('/reset-balance', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Ambil data dari request body
    const { userId, newBalance, password } = req.body; // destructuring req.body: userId=target user, newBalance=saldo baru, password=verifikasi admin
    // destructuring req.body: userId=target user, newBalance=saldo baru, password=verifikasi admin
    
    // STEP 2: Validasi admin password
    if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) { // verifikasi password admin; !== kecocokan string persis; fallback 'admin123' jika env tidak diset
      // verifikasi password admin; !== kecocokan string persis; fallback 'admin123' jika env tidak diset
      return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password salah
      // tolak dengan 401 jika password salah
    }
    
    // STEP 3: Update balance user ke newBalance (bukan increment, tapi SET)
    const user = await prisma.user.update({ // const user: menyimpan data user yang diambil dari database secara async
      // const user: menyimpan data user yang diambil dari database secara async
      where: { id: parseInt(userId) }, // WHERE id = userId
      // WHERE id = userId
      data: { balance: parseInt(newBalance) } // SET balance = newBalance
      // SET balance = newBalance
    });
    
    // STEP 4: Log action ke console
    console.log(`💰 Reset balance: ${user.username} -> Rp ${parseInt(newBalance).toLocaleString('id-ID')}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 5: Return response sukses
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `Balance reset for ${user.username}`, // template literal: pesan konfirmasi dengan username user yang saldo-nya direset
      // template literal: pesan konfirmasi dengan username user yang saldo-nya direset
      user: user // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
      // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
    });
    
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Reset balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to reset balance' }); // mengirim 500 jika operasi reset saldo gagal
    // mengirim 500 jika operasi reset saldo gagal
  }
});

// ===============================================================
// ENDPOINT: POST /block-user - Block user
// ===============================================================
// Endpoint untuk block user (set isActive = false)
// User yang diblokir tidak bisa login dan transaksi
// Usage: POST /api/admin/block-user
// Body: { userId: 123, password: 'admin123' }
router.post('/block-user', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Ambil data dari request body
    const { userId, password } = req.body; // destructuring req.body: userId=user yang akan diblokir, password=verifikasi admin
    // destructuring req.body: userId=user yang akan diblokir, password=verifikasi admin
    
    // STEP 2: Validasi admin password
    if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) { // verifikasi password admin sebelum blokir user
      // verifikasi password admin sebelum blokir user
      return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password tidak valid
      // tolak dengan 401 jika password tidak valid
    }
    
    // STEP 3: Update user - set isActive = false
    const user = await prisma.user.update({ // const user: menyimpan data user yang diambil dari database secara async
      // const user: menyimpan data user yang diambil dari database secara async
      where: { id: parseInt(userId) }, // WHERE id = userId
      // WHERE id = userId
      data: { isActive: false } // SET isActive = false (user diblokir)
      // SET isActive = false (user diblokir)
    });
    
    // STEP 4: Log action ke console
    console.log(`🚫 User blocked: ${userId} (${user.username})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 5: Return response sukses
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `User ${user.username} has been blocked`, // template literal: konfirmasi pemblokiran dengan username yang diblokir
      // template literal: konfirmasi pemblokiran dengan username yang diblokir
      user: user // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
      // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
    });
    
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Block user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to block user' }); // mengirim 500 jika operasi blokir user gagal
    // mengirim 500 jika operasi blokir user gagal
  }
});

// ===============================================================
// ENDPOINT: POST /unblock-user - Unblock user
// ===============================================================
// Endpoint untuk unblock user (set isActive = true)
// User yang di-unblock bisa login dan transaksi lagi
// Usage: POST /api/admin/unblock-user
// Body: { userId: 123, password: 'admin123' }
router.post('/unblock-user', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Ambil data dari request body
    const { userId, password } = req.body; // destructuring req.body: userId=user yang akan di-unblock, password=verifikasi admin
    // destructuring req.body: userId=user yang akan di-unblock, password=verifikasi admin
    
    // STEP 2: Validasi admin password
    if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) { // verifikasi password admin sebelum unblock user
      // verifikasi password admin sebelum unblock user
      return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password tidak valid
      // tolak dengan 401 jika password tidak valid
    }
    
    // STEP 3: Update user - set isActive = true
    const user = await prisma.user.update({ // const user: menyimpan data user yang diambil dari database secara async
      // const user: menyimpan data user yang diambil dari database secara async
      where: { id: parseInt(userId) }, // WHERE id = userId
      // WHERE id = userId
      data: { isActive: true } // SET isActive = true (user di-unblock)
      // SET isActive = true (user di-unblock)
    });
    
    // STEP 4: Log action ke console
    console.log(`✅ User unblocked: ${userId} (${user.username})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 5: Return response sukses
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `User ${user.username} has been unblocked`, // template literal: konfirmasi pembukaan blokir dengan username
      // template literal: konfirmasi pembukaan blokir dengan username
      user: user // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
      // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
    });
    
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Unblock user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to unblock user' }); // mengirim 500 jika operasi unblock user gagal
    // mengirim 500 jika operasi unblock user gagal
  }
});

// ===============================================================
// ENDPOINT: POST /clear-fraud-alerts - Clear fraud alerts
// ===============================================================
// Endpoint untuk hapus semua fraud alerts dari database
// Berguna untuk cleanup setelah review fraud alerts
// Usage: POST /api/admin/clear-fraud-alerts
router.post('/clear-fraud-alerts', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Count fraud alerts sebelum deletion (untuk info berapa yang dihapus)
    const alertCount = await prisma.fraudAlert.count(); // prisma.fraudAlert.count(): hitung jumlah alert sebelum dihapus; digunakan dalam pesan konfirmasi
    // prisma.fraudAlert.count(): hitung jumlah alert sebelum dihapus; digunakan dalam pesan konfirmasi
    
    // STEP 2: Delete semua fraud alerts
    // deleteMany tanpa where clause = DELETE semua records
    await prisma.fraudAlert.deleteMany({}); // prisma.fraudAlert.deleteMany() dengan objek kosong: hapus SEMUA record dari tabel fraudAlert; {} berarti tanpa kondisi WHERE
    // prisma.fraudAlert.deleteMany() dengan objek kosong: hapus SEMUA record dari tabel fraudAlert; {} berarti tanpa kondisi WHERE
    
    // STEP 3: Log action ke console
    console.log(`🗑️ Cleared ${alertCount} fraud alerts`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    // STEP 4: Return response sukses
    res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `Cleared ${alertCount} fraud alerts`, // template literal: pesan konfirmasi berapa alert yang berhasil dihapus
      // template literal: pesan konfirmasi berapa alert yang berhasil dihapus
      clearedCount: alertCount // Jumlah fraud alerts yang dihapus
      // Jumlah fraud alerts yang dihapus
    });
    
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Clear fraud alerts error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Failed to clear fraud alerts' }); // mengirim 500 jika operasi hapus semua fraud alert gagal
    // mengirim 500 jika operasi hapus semua fraud alert gagal
  }
});

// STEP: Export router agar bisa diimport di server.js
module.exports = router; // module.exports mengekspor router agar bisa di-import di server.js menggunakan require()
// module.exports mengekspor router agar bisa di-import di server.js menggunakan require()
