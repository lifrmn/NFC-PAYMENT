// ============================================================
// DEVICES.JS - ROUTES UNTUK MANAJEMEN PERANGKAT (DEVICES)
// ============================================================
// File ini berisi endpoint untuk manajemen perangkat mobile (Android/iOS)
// yang terhubung ke sistem pembayaran NFC
//
// ENDPOINT:
// - POST /register -> Daftarkan perangkat baru (first-time setup)
// - POST /sync-device -> Sinkronisasi data perangkat dengan server
// - GET / -> Ambil semua perangkat (admin dashboard)
// - GET /:deviceId -> Detail perangkat tertentu
// - PUT /:deviceId/status -> Update status online/offline perangkat
// - DELETE /:deviceId -> Hapus perangkat (admin only)
// - GET /stats/summary -> Statistik perangkat (total, online, offline)
//
// KONSEP PENTING:
// 1. DEVICE TRACKING: Setiap perangkat Android yang install app harus register
// 2. SYNC MECHANISM: Perangkat sync data (users, transactions) ke server
// 3. ONLINE STATUS: Server track perangkat mana yang online (lastSeen < 5 menit)
// 4. REAL-TIME: Perubahan status dikirim via Socket.IO ke admin dashboard
//
// FLOW REGISTRASI PERANGKAT:
// Mobile App (Android) -> POST /api/devices/register -> Server
// Server save device info -> Return success -> App siap digunakan
// ============================================================

const express = require('express');
// const membuat variabel tetap; require('express') memanggil module Express.js dari node_modules; digunakan untuk membuat router HTTP endpoint devices
const { PrismaClient } = require('@prisma/client');
// destructuring { PrismaClient } dari module Prisma; PrismaClient adalah kelas ORM yang digunakan untuk query database SQLite secara aman tanpa SQL mentah
const { authenticateDevice, authenticateAdmin } = require('../middleware/auth');
// authenticateDevice memvalidasi JWT user dan sesi aktif sebelum endpoint device sensitif diakses.

const router = express.Router();
// const membuat variabel tetap; express.Router() membuat instance router baru untuk menampung semua endpoint /api/devices
const prisma = new PrismaClient();
// const membuat variabel tetap; new PrismaClient() membuat instance baru koneksi Prisma ke database

// ============================================================
// ENDPOINT 1: POST /register - DAFTARKAN PERANGKAT BARU
// ============================================================
// Endpoint ini dipanggil saat user pertama kali install & buka app
//
// REQUEST BODY:
// {
//   "deviceId": "ABC123XYZ789",      // Unique ID perangkat (dari Android)
//   "deviceName": "Samsung Galaxy",   // Nama perangkat (optional)
//   "platform": "android",            // Platform (android/ios)
//   "appVersion": "1.0.0"             // Versi aplikasi (optional)
// }
//
// CARA KERJA:
// 1. Validasi deviceId (wajib ada)
// 2. UPSERT: Update jika sudah ada, Create jika belum ada
//    - Ini mencegah error jika user re-install app
// 3. Set isOnline = true (perangkat baru dianggap online)
// 4. Update lastSeen dengan waktu sekarang
// 5. Return data perangkat
//
// RESPONSE:
// {
//   "success": true,
//   "message": "Perangkat berhasil didaftarkan",
//   "device": { ... }
// }
// ============================================================
router.post('/register', authenticateDevice, async (req, res) => {
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { deviceId, deviceName, platform, appVersion } = req.body;
    // Destructuring data perangkat dari request body
    
    if (!deviceId) {
      // Validasi: deviceId wajib ada
      return res.status(400).json({ error: 'ID Perangkat diperlukan' });
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }

    const sessionDeviceId = req.user.userSessions.find(session => session.token === req.token)?.deviceId;
    const allowedDeviceIds = [req.user.deviceId, sessionDeviceId].filter(id => id && id !== 'unknown');
    if (!allowedDeviceIds.includes(deviceId)) {
      return res.status(403).json({ error: 'DEVICE_ACCESS_DENIED' });
    }

    const now = new Date();
    // Catat waktu sekarang untuk lastSeen
    
    // Daftarkan atau perbarui catatan perangkat
    const deviceRecord = await prisma.device.upsert({
      // UPSERT: update jika ada, create jika belum ada
      where: { deviceId: deviceId },
      // Cari berdasarkan deviceId unik
      update: {
        // update: { } dalam upsert menentukan data yang diperbarui jika record sudah ada; digunakan saat data conflict (duplicate key)
        deviceName: deviceName || `Perangkat ${platform} ${deviceId.slice(-6)}`,
        // Nama perangkat, ambil 6 karakter terakhir jika tidak ada nama
        platform: platform || 'unknown',
        // Platform android/ios
        ipAddress: req.ip,
        // IP address perangkat saat ini
        isOnline: true,
        // Tandai perangkat online
        lastSeen: now,
        // Update waktu terakhir aktif
        // Simpan data pengguna/saldo yang ada saat update
      },
      create: {
        // create: { } dalam upsert menentukan data yang dibuat jika record belum ada; digunakan saat insert baru dalam operasi upsert
        deviceId: deviceId,
        // ID unik perangkat
        deviceName: deviceName || `Perangkat ${platform} ${deviceId.slice(-6)}`,
        // Nama perangkat dengan fallback
        platform: platform || 'unknown',
        // Platform dengan fallback
        ipAddress: req.ip,
        // IP address perangkat
        isOnline: true,
        // Status online saat pertama daftar
        lastSeen: now,
        // Waktu pertama kali daftar
        totalUsers: 0,
        // Inisialisasi total user = 0
        totalBalance: 0
        // Inisialisasi total saldo = 0
      }
    });

    console.log(`📱 Device registered: ${deviceId} (${platform})`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Perangkat berhasil didaftarkan',
      // pesan sukses registrasi perangkat; dikirim ke frontend setelah device berhasil disimpan ke database
      device: deviceRecord
      // Kembalikan data perangkat yang baru didaftarkan
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan pendaftaran perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 Internal Server Error; status 500 menandakan kesalahan tak terduga di sisi server
      error: 'Gagal mendaftarkan perangkat'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});

// Sinkronkan data perangkat (kompatibel dengan aplikasi mobile yang ada)
router.post('/sync-device', authenticateDevice, async (req, res) => {
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { device } = req.body;
    // Device sync hanya menerima telemetry perangkat; saldo dan transaksi tetap dikelola backend.
    
    if (!device || !device.deviceId) {
      // Validasi: data device dan deviceId wajib ada
      return res.status(400).json({ error: 'ID Perangkat diperlukan' });
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }

    const sessionDeviceId = req.user.userSessions.find(session => session.token === req.token)?.deviceId;
    const allowedDeviceIds = [req.user.deviceId, sessionDeviceId].filter(id => id && id !== 'unknown');
    if (!allowedDeviceIds.includes(device.deviceId)) {
      return res.status(403).json({ error: 'DEVICE_ACCESS_DENIED' });
    }

    const serverStats = await prisma.user.aggregate({
      where: { deviceId: device.deviceId },
      _count: { id: true },
      _sum: { balance: true }
    });
    const totalUsers = serverStats._count.id;
    const totalBalance = serverStats._sum.balance || 0;

    const now = new Date();
    // Catat waktu sekarang untuk lastSeen
    
    // Perbarui atau buat catatan perangkat
    const deviceRecord = await prisma.device.upsert({
      // UPSERT device: update atau buat baru
      where: { deviceId: device.deviceId },
      // Cari berdasarkan deviceId
      update: {
        // update: { } dalam upsert menentukan data yang diperbarui jika record sudah ada; digunakan saat data conflict (duplicate key)
        deviceName: device.deviceName || `Android Device ${device.deviceId.slice(-6)}`,
        // Nama perangkat dengan fallback
        platform: device.platform || 'android',
        // Platform dengan default android
        ipAddress: req.ip,
        // IP address saat ini
        isOnline: true,
        // Tandai perangkat online
        lastSeen: now,
        // Update waktu terakhir sync
        totalUsers,
        // Jumlah user dihitung dari database, bukan dipercaya dari payload client.
        totalBalance
        // Total saldo dihitung dari database sebagai source of truth.
      },
      create: {
        // create: { } dalam upsert menentukan data yang dibuat jika record belum ada; digunakan saat insert baru dalam operasi upsert
        deviceId: device.deviceId,
        // ID unik perangkat
        deviceName: device.deviceName || `Android Device ${device.deviceId.slice(-6)}`,
        // Nama perangkat
        platform: device.platform || 'android',
        // Platform
        ipAddress: req.ip,
        // IP address
        isOnline: true,
        // Status online
        lastSeen: now,
        // Waktu pertama sync
        totalUsers,
        // Jumlah user dari database
        totalBalance
        // Total saldo dari database
      }
    });

    console.log(`📱 Device sync: ${device.deviceId.slice(-8)} | Users: ${totalUsers} | Balance: Rp ${totalBalance.toLocaleString('id-ID')} | IP: ${req.ip}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // Periksa pembaruan saldo yang tertunda
    const pendingUpdates = await prisma.adminLog.findMany({
      // Cari log admin dengan aksi BALANCE_UPDATE_PENDING
      where: {
        // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
        action: 'BALANCE_UPDATE_PENDING',
        // Filter berdasarkan tipe aksi
        details: {
          // objek details berisi informasi tambahan kondisi filter; digunakan untuk WHERE dengan kondisi nested di Prisma
          contains: device.deviceId
          // Filter yang berkaitan dengan deviceId ini
        }
      },
      orderBy: { createdAt: 'desc' },
      // Urutkan dari terbaru
      take: 10
      // Ambil maksimal 10 pending updates
    });

    // Kirim ke dashboard admin
    if (req.io) {
      // Hanya kirim jika Socket.IO tersedia
      req.io.to('admin-room').emit('device-sync', {
        // Broadcast ke semua admin di admin-room
        device: deviceRecord,
        // Data perangkat yang baru sync
        stats: { totalUsers, totalBalance }
        // Statistik perangkat yang dihitung oleh backend
      });
    }

    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Perangkat berhasil disinkronkan',
      // pesan sukses sinkronisasi perangkat; dikonfirmasi setelah data perangkat diperbarui dari backend
      balanceUpdates: pendingUpdates.map(update => JSON.parse(update.details)),
      // Parse details dari JSON string
      deviceId: device.deviceId,
      // Echo kembali deviceId
      timestamp: now.toISOString()
      // Waktu sync dalam format ISO
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan sinkronisasi perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal menyinkronkan perangkat' });
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Dapatkan semua perangkat
router.get('/', authenticateAdmin, async (req, res) => {
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const devices = await prisma.device.findMany({
      // Ambil semua record Device dari database
      orderBy: {
        // orderBy: { } menentukan urutan hasil query; setara ORDER BY di SQL; biasanya berdasarkan createdAt DESC untuk menampilkan terbaru
        lastSeen: 'desc'
        // Urutkan dari yang paling baru sync
      }
    });

    // Perbarui status online berdasarkan terakhir terlihat
    const now = new Date();
    // Waktu sekarang untuk menghitung status online
    const devicesWithStatus = devices.map(device => ({
      // Map setiap device dan tambahkan field isOnline
      ...device,
      // Spread semua field device yang ada
      isOnline: (now - new Date(device.lastSeen)) < 300000
      // Device online jika sync dalam 5 menit terakhir
    }));

    res.json(devicesWithStatus);
    // Kirim array devices dengan status online
  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan perangkat' });
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Dapatkan perangkat berdasarkan ID
router.get('/:deviceId', authenticateAdmin, async (req, res) => {
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { deviceId } = req.params;
    // Ambil deviceId dari URL parameter
    
    const device = await prisma.device.findUnique({
      // Cari satu device berdasarkan deviceId
      where: { deviceId }
      // Kondisi pencarian
    });

    if (!device) {
      // Jika device tidak ditemukan
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' });
      // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
    }

    // Dapatkan pengguna untuk perangkat ini
    const users = await prisma.user.findMany({
      // Ambil semua user yang terhubung ke device ini
      where: { deviceId },
      // Filter berdasarkan deviceId
      select: {
        // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
        id: true,
        // Hanya ambil field yang diperlukan (tidak include password)
        name: true,
        // Nama user
        username: true,
        // Username
        balance: true,
        // Saldo
        isActive: true,
        // Status aktif
        createdAt: true
        // Waktu dibuat
      }
    });

    // Dapatkan transaksi terbaru untuk perangkat ini
    const transactions = await prisma.transaction.findMany({
      // Ambil transaksi yang dilakukan dari device ini
      where: { deviceId },
      // Filter berdasarkan deviceId
      include: {
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        sender: {
          // Join data pengirim
          select: { id: true, name: true, username: true }
          // Hanya ambil field yang diperlukan
        },
        receiver: {
          // Join data penerima
          select: { id: true, name: true, username: true }
          // Hanya ambil field yang diperlukan
        }
      },
      orderBy: { createdAt: 'desc' },
      // Urutkan dari transaksi terbaru
      take: 10
      // Ambil maksimal 10 transaksi terakhir
    });

    const now = new Date();
    // Waktu sekarang
    const isOnline = (now - new Date(device.lastSeen)) < 300000;
    // Device online jika sync dalam 5 menit terakhir

    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      ...device,
      // Spread semua field device
      isOnline,
      // Tambahkan status online yang sudah dihitung
      users,
      // Array user yang terhubung ke device ini
      recentTransactions: transactions
      // 10 transaksi terbaru
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan perangkat' });
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Perbarui status perangkat
router.put('/:deviceId/status', authenticateAdmin, async (req, res) => {
  // router.put() mendaftarkan endpoint HTTP PUT; untuk memperbarui data yang sudah ada
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { deviceId } = req.params;
    // Ambil deviceId dari URL parameter
    const { isOnline } = req.body;
    // Ambil status online/offline dari request body

    const device = await prisma.device.update({
      // Update record device di database
      where: { deviceId },
      // Cari berdasarkan deviceId
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        isOnline: Boolean(isOnline),
        // Konversi ke boolean (true/false)
        lastSeen: new Date()
        // Update waktu terakhir terlihat
      }
    });

    // Kirim ke dashboard admin
    if (req.io) {
      // Hanya kirim jika Socket.IO tersedia
      req.io.to('admin-room').emit('device-status-updated', { device });
      // Broadcast perubahan status ke admin
    }

    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      message: 'Status perangkat berhasil diperbarui',
      // pesan sukses perubahan status perangkat; dikirim setelah field status device diperbarui di database
      device
      // Kembalikan data device yang sudah diupdate
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan memperbarui status perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memperbarui status perangkat' });
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Hapus perangkat (khusus admin)
router.delete('/:deviceId', authenticateAdmin, async (req, res) => {
  // router.delete() mendaftarkan endpoint HTTP DELETE; untuk menghapus data
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { deviceId } = req.params;
    // Ambil deviceId dari URL parameter

    // Verifikasi bahwa middleware bearer JWT telah mengisi identitas admin.
    if (!req.admin) {
      // Guard defensif menolak penghapusan jika identitas admin tidak tersedia.
      return res.status(401).json({ error: 'Password admin tidak valid' });
      // Return menghentikan route sebelum perangkat dihapus.
    }

    await prisma.device.delete({
      // Hapus record device dari database
      where: { deviceId }
      // Hapus berdasarkan deviceId
    });

    // Catat aksi admin
    await prisma.adminLog.create({
      // Simpan log bahwa admin menghapus device
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'DEVICE_DELETE',
        // Tipe aksi
        details: JSON.stringify({ deviceId }),
        // Simpan deviceId yang dihapus sebagai JSON
        ipAddress: req.ip,
        // IP admin yang menghapus
        userAgent: req.headers['user-agent']
        // Browser/client admin
      }
    });

    // Kirim ke dashboard admin
    if (req.io) {
      // Hanya kirim jika Socket.IO tersedia
      req.io.to('admin-room').emit('device-deleted', { deviceId });
      // Broadcast penghapusan ke semua admin
    }

    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      message: 'Perangkat berhasil dihapus'
      // Konfirmasi penghapusan
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan menghapus perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal menghapus perangkat' });
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

// Dapatkan statistik perangkat
router.get('/stats/summary', authenticateAdmin, async (req, res) => {
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const [totalDevices, onlineDevices, totalUsers, totalBalance] = await Promise.all([
    // Jalankan 4 query secara paralel
      prisma.device.count(),
      // Hitung total semua device
      prisma.device.count({
        // Hitung device yang sedang online (sync dalam 5 menit terakhir)
        where: {
          // where: { } menentukan kondisi filter query; setara WHERE di SQL; hanya record yang memenuhi kondisi yang dikembalikan
          lastSeen: {
            // field lastSeen: timestamp terakhir kali device melakukan sinkronisasi; filter untuk menentukan device 'online'
            gte: new Date(Date.now() - 300000)
            // 5 menit terakhir dalam milliseconds
          }
        }
      }),
      prisma.user.count({
        // Hitung total user yang aktif
        where: { isActive: true }
        // Filter hanya user yang isActive = true
      }),
      prisma.user.aggregate({
        // Hitung total saldo semua user aktif
        _sum: { balance: true },
        // Agregasi: jumlahkan field balance
        where: { isActive: true }
        // Filter hanya user aktif
      })
    ]);

    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      totalDevices,
      // Total semua device yang pernah terdaftar
      onlineDevices,
      // Device yang online (sync dalam 5 menit)
      offlineDevices: totalDevices - onlineDevices,
      // Device yang offline = total - online
      totalUsers,
      // Total user aktif di sistem
      totalBalance: totalBalance._sum.balance || 0
      // Total saldo (fallback 0 jika null)
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan statistik perangkat:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan statistik perangkat' });
    // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
  }
});

module.exports = router;
// Export router agar bisa di-mount di server.js
