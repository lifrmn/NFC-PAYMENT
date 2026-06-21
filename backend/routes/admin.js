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

const express = require('express'); // Express framework untuk routing
const { body, validationResult } = require('express-validator'); // Untuk validasi input request
const { PrismaClient } = require('@prisma/client'); // Prisma ORM untuk database access

const router = express.Router(); // Buat instance Express Router
const prisma = new PrismaClient(); // Buat instance Prisma client

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
router.get('/dashboard', async (req, res) => {
  try {
    // STEP 1: Query berbagai data secara parallel menggunakan Promise.all
    // Promise.all menjalankan semua query sekaligus (lebih cepat dari serial)
    const [
      totalUsers, // Total user aktif
      totalDevices, // Total device terdaftar
      onlineDevices, // Device online (lastSeen < 5 menit yang lalu)
      totalTransactions, // Total transaksi
      totalBalance, // Sum total balance semua user
      fraudAlerts, // Fraud alerts terakhir (window monitoring)
      recentTransactions, // 10 transaksi terbaru
      recentAlerts // 5 fraud alert terbaru
    ] = await Promise.all([
      // Query 1: Count total user yang aktif (isActive = true)
      prisma.user.count({ where: { isActive: true } }),
      
      // Query 2: Count total device
      prisma.device.count(),
      
      // Query 3: Count device online (lastSeen dalam 5 menit terakhir)
      prisma.device.count({
        where: {
          lastSeen: {
            gte: new Date(Date.now() - 300000) // Last 5 minutes (300,000 ms = 5 menit)
          }
        }
      }),
      
      // Query 4: Count total transaksi
      prisma.transaction.count(),
      
      // Query 5: Sum total balance semua user aktif
      prisma.user.aggregate({
        _sum: { balance: true }, // SUM(balance)
        where: { isActive: true } // WHERE isActive = true
      }),
      
      // Query 6: Count fraud alerts dalam window monitoring (1 hari terakhir)
      prisma.fraudAlert.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      
      // Query 7: Get 10 transaksi terbaru dengan data sender & receiver
      prisma.transaction.findMany({
        include: { // JOIN dengan tabel user (sender dan receiver)
          sender: { select: { id: true, name: true, username: true } }, // Data sender
          receiver: { select: { id: true, name: true, username: true } } // Data receiver
        },
        orderBy: { createdAt: 'desc' }, // ORDER BY createdAt DESC
        take: 10 // LIMIT 10
      }),
      
      // Query 8: Get 5 fraud alert terbaru dengan data user
      prisma.fraudAlert.findMany({
        include: { // JOIN dengan tabel user
          user: { select: { id: true, name: true, username: true } } // Data user yang kena fraud alert
        },
        orderBy: { createdAt: 'desc' }, // ORDER BY createdAt DESC
        take: 5 // LIMIT 5
      })
    ]);

    // STEP 2: Format response data dan kirim ke client
    res.json({
      summary: { // Summary statistik
        totalUsers, // Total user aktif
        totalDevices, // Total device
        onlineDevices, // Device online
        offlineDevices: totalDevices - onlineDevices, // Device offline (total - online)
        totalTransactions, // Total transaksi
        totalBalance: totalBalance._sum.balance || 0, // Total balance (atau 0 jika null)
        fraudAlertsRecent: fraudAlerts // Fraud alerts (window monitoring 1 hari)
      },
      recentTransactions, // Array 10 transaksi terbaru
      recentFraudAlerts: recentAlerts, // Array 5 fraud alert terbaru
      timestamp: new Date().toISOString() // Waktu response generated
    });

  } catch (error) {
    console.error('❌ Kesalahan mendapatkan statistik dashboard:', error); // Log error
    res.status(500).json({ error: 'Gagal mendapatkan statistik dashboard' });
  }
});

// Perbarui saldo pengguna (aksi admin)
router.post('/balance-update', [
  body('deviceId').notEmpty().withMessage('ID Perangkat diperlukan'),
  body('amount').isFloat({ min: 0 }).withMessage('Jumlah harus positif'),
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, amount, adminPassword, reason } = req.body;

    // Verifikasi password admin
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Password admin tidak valid' });
    }

    // Validasi jumlah
    if (amount <= 0) {
      return res.status(400).json({ error: 'Jumlah harus positif' });
    }

    if (amount > 10000000) { // Maksimal 10 juta
      return res.status(400).json({ error: 'Jumlah melebihi batas maksimum' });
    }

    // Cari perangkat dan pengguna
    const device = await prisma.device.findUnique({
      where: { deviceId }
    });

    if (!device) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan' });
    }

    // Dapatkan semua pengguna untuk perangkat ini
    const users = await prisma.user.findMany({
      where: { deviceId, isActive: true }
    });

    if (users.length === 0) {
      return res.status(404).json({ error: 'Tidak ada pengguna aktif untuk perangkat ini' });
    }

    // Perbarui saldo untuk semua pengguna di perangkat
    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { balance: { increment: amount } }
        });

        return updatedUser;
      })
    );

    // Catat aksi admin
    await prisma.adminLog.create({
      data: {
        action: 'BALANCE_UPDATE',
        details: JSON.stringify({
          deviceId,
          amount,
          usersAffected: users.length,
          userIds: users.map(u => u.id),
          reason: reason || 'Top-up saldo oleh admin'
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Perbarui total saldo perangkat
    await prisma.device.update({
      where: { deviceId },
      data: {
        totalBalance: {
          increment: amount * users.length
        }
      }
    });

    console.log(`💰 Admin menambahkan Rp ${amount.toLocaleString('id-ID')} ke perangkat ${deviceId.substring(0, 8)}... untuk ${users.length} pengguna`);

    // Kirim pembaruan real-time
    if (req.io) {
      req.io.to('admin-room').emit('balance-bulk-update', {
        deviceId,
        amount,
        usersAffected: users.length,
        updatedUsers
      });

      // Notifikasi perangkat tertentu
      req.io.to(`device-${deviceId}`).emit('balance-updated', {
        amount,
        users: updatedUsers.map(u => ({ id: u.id, balance: u.balance }))
      });
    }

    res.json({
      success: true,
      message: `Saldo diperbarui untuk ${users.length} pengguna di perangkat ${deviceId}`,
      details: {
        deviceId,
        amount,
        usersAffected: users.length,
        totalAdded: amount * users.length
      }
    });

  } catch (error) {
    console.error('❌ Kesalahan pembaruan saldo:', error);
    res.status(500).json({ error: 'Gagal memperbarui saldo' });
  }
});

// Dapatkan log admin
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0, action } = req.query;
    
    const whereClause = {};
    if (action) whereClause.action = action;

    const logs = await prisma.adminLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    res.json(logs);
  } catch (error) {
    console.error('❌ Kesalahan mendapatkan log admin:', error);
    res.status(500).json({ error: 'Gagal mendapatkan log admin' });
  }
});

// Manajemen pengaturan sistem
router.get('/settings', async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany();
    
    const settingsObject = settings.reduce((acc, setting) => {
      let value = setting.value;
      
      // Parse nilai berdasarkan tipe
      switch (setting.type) {
        case 'number':
          value = parseFloat(setting.value);
          break;
        case 'boolean':
          value = setting.value === 'true';
          break;
        case 'json':
          try {
            value = JSON.parse(setting.value);
          } catch (e) {
            value = setting.value;
          }
          break;
        default:
          value = setting.value;
      }
      
      acc[setting.key] = value;
      return acc;
    }, {});

    res.json(settingsObject);
  } catch (error) {
    console.error('❌ Kesalahan mendapatkan pengaturan:', error);
    res.status(500).json({ error: 'Gagal mendapatkan pengaturan' });
  }
});

// Perbarui pengaturan sistem
router.put('/settings/:key', [
  body('value').notEmpty().withMessage('Nilai diperlukan'),
  body('adminPassword').notEmpty().withMessage('Password admin diperlukan')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { key } = req.params;
    const { value, type = 'string', adminPassword } = req.body;

    // Verify admin password
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: { value: String(value), type },
      create: { key, value: String(value), type }
    });

    // Catat aksi admin
    await prisma.adminLog.create({
      data: {
        action: 'SETTING_UPDATE',
        details: JSON.stringify({
          key,
          newValue: value,
          type
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Kirim ke dashboard admin
    if (req.io) {
      req.io.to('admin-room').emit('setting-updated', { key, value, type });
    }

    res.json({
      message: 'Pengaturan berhasil diperbarui',
      setting
    });

  } catch (error) {
    console.error('❌ Kesalahan memperbarui pengaturan:', error);
    res.status(500).json({ error: 'Gagal memperbarui pengaturan' });
  }
});

// Bersihkan perangkat tidak aktif
router.post('/cleanup-devices', async (req, res) => {
  try {
    const { adminPassword } = req.body;

    // Verifikasi password admin
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Password admin tidak valid' });
    }

    // Hapus perangkat tidak aktif lebih dari 1 hari (86400 detik)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const deletedDevices = await prisma.device.deleteMany({
      where: {
        lastSeen: {
          lt: cutoffTime
        }
      }
    });

    // Catat aksi admin
    await prisma.adminLog.create({
      data: {
        action: 'DEVICES_CLEANUP',
        details: JSON.stringify({
          deletedCount: deletedDevices.count,
          cutoffTime
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.json({
      message: `Membersihkan ${deletedDevices.count} perangkat tidak aktif`,
      deletedCount: deletedDevices.count
    });

  } catch (error) {
    console.error('Cleanup devices error:', error);
    res.status(500).json({ error: 'Failed to cleanup devices' });
  }
});

// ===============================================================
// ENDPOINT: GET /users - Get all users untuk admin dashboard
// ===============================================================
// Endpoint PUBLIC (bypass auth) untuk admin dashboard ambil semua user
// Usage: GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    console.log('📋 Admin request: Get all users (bypass auth)');
    
    // STEP 1: Query semua user dari database
    const users = await prisma.user.findMany({
      select: { // SELECT field yang diperlukan
        id: true, // User ID
        name: true, // Nama lengkap
        username: true, // Username
        balance: true, // Saldo
        isActive: true, // Status aktif/blokir
        createdAt: true, // Waktu dibuat
        updatedAt: true, // Waktu terakhir diupdate
        deviceId: true // Device ID
      },
      orderBy: { // ORDER BY createdAt DESC (user terbaru di atas)
        createdAt: 'desc'
      }
    });

    // STEP 2: Log jumlah user ke console
    console.log(`✅ Found ${users.length} users in database`);

    // STEP 3: Return response dengan array users
    res.json({
      success: true,
      users: users,
      total: users.length
    });

  } catch (error) {
    console.error('❌ Get admin users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// ===============================================================
// ENDPOINT: POST /bulk-topup - Bulk topup untuk semua users
// ===============================================================
// Endpoint untuk top-up saldo ke semua user aktif sekaligus
// Usage: POST /api/admin/bulk-topup
// Body: { amount: 50000 }
router.post('/bulk-topup', async (req, res) => {
  try {
    // STEP 1: Ambil amount dari request body
    const { amount } = req.body;
    
    console.log(`💰 Admin bulk topup request: ${amount} to all users`);
    
    // STEP 2: Validasi amount (wajib ada dan > 0)
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    
    // STEP 3: Update balance semua users aktif
    // updateMany = Update multiple records sekaligus
    const updateResult = await prisma.user.updateMany({
      where: { // WHERE clause (filter user mana yang diupdate)
        isActive: true // Hanya user aktif (tidak termasuk yang diblokir)
      },
      data: { // Data yang akan diupdate
        balance: { // UPDATE balance
          increment: parseInt(amount) // balance = balance + amount
        }
      }
    });
    
    // STEP 4: Log hasil ke console
    console.log(`✅ Bulk topup success: ${updateResult.count} users updated with ${amount}`);
    
    // STEP 5: Hitung total amount yang ditambahkan
    const totalAmount = updateResult.count * amount; // Total = jumlah user * amount
    
    // STEP 6: Return response sukses
    res.json({
      success: true,
      message: `Successfully topped up ${updateResult.count} users`,
      updatedUsers: updateResult.count, // Jumlah user yang diupdate
      amount: amount, // Amount per user
      totalAmount: totalAmount // Total amount semua user
    });
    
  } catch (error) {
    console.error('❌ Bulk topup error:', error);
    res.status(500).json({ error: 'Failed to perform bulk topup' });
  }
});

// ===============================================================
// ENDPOINT: POST /reset-balance - Reset balance user tertentu
// ===============================================================
// Endpoint untuk reset balance user ke nilai tertentu (bukan increment)
// Usage: POST /api/admin/reset-balance
// Body: { userId: 123, newBalance: 1000000, password: 'admin123' }
router.post('/reset-balance', async (req, res) => {
  try {
    // STEP 1: Ambil data dari request body
    const { userId, newBalance, password } = req.body;
    
    // STEP 2: Validasi admin password
    if (password !== 'admin123') {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    // STEP 3: Update balance user ke newBalance (bukan increment, tapi SET)
    const user = await prisma.user.update({
      where: { id: parseInt(userId) }, // WHERE id = userId
      data: { balance: parseInt(newBalance) } // SET balance = newBalance
    });
    
    // STEP 4: Log action ke console
    console.log(`💰 Reset balance: ${user.username} -> Rp ${parseInt(newBalance).toLocaleString('id-ID')}`);
    
    // STEP 5: Return response sukses
    res.json({
      success: true,
      message: `Balance reset for ${user.username}`,
      user: user
    });
    
  } catch (error) {
    console.error('❌ Reset balance error:', error);
    res.status(500).json({ error: 'Failed to reset balance' });
  }
});

// ===============================================================
// ENDPOINT: POST /block-user - Block user
// ===============================================================
// Endpoint untuk block user (set isActive = false)
// User yang diblokir tidak bisa login dan transaksi
// Usage: POST /api/admin/block-user
// Body: { userId: 123, password: 'admin123' }
router.post('/block-user', async (req, res) => {
  try {
    // STEP 1: Ambil data dari request body
    const { userId, password } = req.body;
    
    // STEP 2: Validasi admin password
    if (password !== 'admin123') {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    // STEP 3: Update user - set isActive = false
    const user = await prisma.user.update({
      where: { id: parseInt(userId) }, // WHERE id = userId
      data: { isActive: false } // SET isActive = false (user diblokir)
    });
    
    // STEP 4: Log action ke console
    console.log(`🚫 User blocked: ${userId} (${user.username})`);
    
    // STEP 5: Return response sukses
    res.json({
      success: true,
      message: `User ${user.username} has been blocked`,
      user: user
    });
    
  } catch (error) {
    console.error('❌ Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// ===============================================================
// ENDPOINT: POST /unblock-user - Unblock user
// ===============================================================
// Endpoint untuk unblock user (set isActive = true)
// User yang di-unblock bisa login dan transaksi lagi
// Usage: POST /api/admin/unblock-user
// Body: { userId: 123, password: 'admin123' }
router.post('/unblock-user', async (req, res) => {
  try {
    // STEP 1: Ambil data dari request body
    const { userId, password } = req.body;
    
    // STEP 2: Validasi admin password
    if (password !== 'admin123') {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    // STEP 3: Update user - set isActive = true
    const user = await prisma.user.update({
      where: { id: parseInt(userId) }, // WHERE id = userId
      data: { isActive: true } // SET isActive = true (user di-unblock)
    });
    
    // STEP 4: Log action ke console
    console.log(`✅ User unblocked: ${userId} (${user.username})`);
    
    // STEP 5: Return response sukses
    res.json({
      success: true,
      message: `User ${user.username} has been unblocked`,
      user: user
    });
    
  } catch (error) {
    console.error('❌ Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// ===============================================================
// ENDPOINT: POST /clear-fraud-alerts - Clear fraud alerts
// ===============================================================
// Endpoint untuk hapus semua fraud alerts dari database
// Berguna untuk cleanup setelah review fraud alerts
// Usage: POST /api/admin/clear-fraud-alerts
router.post('/clear-fraud-alerts', async (req, res) => {
  try {
    // STEP 1: Count fraud alerts sebelum deletion (untuk info berapa yang dihapus)
    const alertCount = await prisma.fraudAlert.count();
    
    // STEP 2: Delete semua fraud alerts
    // deleteMany tanpa where clause = DELETE semua records
    await prisma.fraudAlert.deleteMany({});
    
    // STEP 3: Log action ke console
    console.log(`🗑️ Cleared ${alertCount} fraud alerts`);
    
    // STEP 4: Return response sukses
    res.json({
      success: true,
      message: `Cleared ${alertCount} fraud alerts`,
      clearedCount: alertCount // Jumlah fraud alerts yang dihapus
    });
    
  } catch (error) {
    console.error('❌ Clear fraud alerts error:', error);
    res.status(500).json({ error: 'Failed to clear fraud alerts' });
  }
});

// STEP: Export router agar bisa diimport di server.js
module.exports = router;