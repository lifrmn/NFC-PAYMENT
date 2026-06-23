const express = require('express'); // Express framework untuk membuat HTTP routes
const { body, validationResult } = require('express-validator'); // Library validasi input dari client
const { PrismaClient } = require('@prisma/client'); // Prisma ORM untuk akses database SQLite
const { analyzeZScoreAnomaly, HISTORY_SIZE } = require('../utils/fraudDetection'); // Engine Z-Score fraud detection

const router = express.Router(); // Buat instance router untuk grouping endpoint /api/transactions
const prisma = new PrismaClient(); // Buat koneksi Prisma ke database

/* -------------------------------------------------------------------------- */
/*                    Z-SCORE BASED ANOMALY DETECTION                         */
/*          Deteksi anomali transaksi berdasarkan 20 histori terakhir         */
/* -------------------------------------------------------------------------- */
/**
 * Fraud Detection menggunakan Z-Score Based Anomaly Detection.
 * Metode: Ambil 20 transaksi historis terakhir sebagai baseline,
 * hitung mean/variance/stddev, lalu Z-Score transaksi baru.
 * Keputusan: Z<=2 ALLOW | 2<Z<=3 REVIEW | Z>3 BLOCK
 *
 * REFERENSI AKADEMIS:
 *   [1] Bolton & Hand (2002). Statistical fraud detection. Statistical Science.
 *       https://doi.org/10.1214/ss/1042727940
 *   [2] Chandola et al. (2009). Anomaly detection: A survey. ACM Comput. Surv.
 *       https://doi.org/10.1145/1541880.1541882
 *   [3] Tagle (2024). ML for Real-time Fraud Detection in NFC Transactions.
 *       https://doi.org/10.62718/vmca.tech-gjtdsi.3.1.sc-1124-009
 *   [4] Vanini et al. (2023). Online payment fraud. Financial Innovation.
 *       https://doi.org/10.1186/s40854-023-00470-w
 *   [5] Zhukabayeva et al. (2025). Anomaly detection via Z-Score.
 */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                          DAPATKAN SEMUA TRANSAKSI                          */
/* -------------------------------------------------------------------------- */
router.get('/', async (req, res) => { // GET / → ambil semua transaksi dengan filter opsional
  try {
    const { limit = 20, offset = 0, userId, status } = req.query; // Ambil query params: limit, offset, userId, status

    const where = {}; // Object filter WHERE yang akan dibangun secara dinamis
    if (userId) { // Jika filter userId disertakan
      const uid = parseInt(String(userId), 10); // Konversi userId dari string ke integer
      if (!Number.isNaN(uid)) { // Validasi: pastikan hasil konversi bukan NaN
        where.OR = [{ senderId: uid }, { receiverId: uid }]; // Filter: transaksi di mana user = sender ATAU receiver
      }
    }
    if (status) where.status = status; // Filter by status jika disertakan (completed/pending/failed)

    const transactions = await prisma.transaction.findMany({ // Query semua transaksi yang sesuai filter
      where, // Gunakan filter dinamis yang dibangun di atas
      include: {
        sender: { select: { id: true, name: true, username: true } }, // Include data sender (hanya field yang diperlukan)
        receiver: { select: { id: true, name: true, username: true } }, // Include data receiver
      },
      orderBy: { createdAt: 'desc' }, // Urutkan dari terbaru ke terlama
      take: parseInt(String(limit), 10), // LIMIT: maksimal N data
      skip: parseInt(String(offset), 10), // OFFSET: skip N data pertama (untuk pagination)
    });

    res.json(transactions); // Kirim array transaksi sebagai JSON response
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi:', error); // Log error ke console
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' }); // Return 500 Internal Server Error
  }
});

/* -------------------------------------------------------------------------- */
/*                   DAPATKAN TRANSAKSI BERDASARKAN ID PENGGUNA               */
/* -------------------------------------------------------------------------- */
router.get('/user/:userId', async (req, res) => { // GET /user/:userId → transaksi milik user tertentu
  try {
    const userId = parseInt(req.params.userId, 10); // Konversi userId URL param dari string ke integer
    if (isNaN(userId)) { // Validasi: jika bukan angka, tolak request
      return res.status(400).json({ error: 'ID pengguna tidak valid' }); // Return 400 Bad Request
    }

    const { limit = 20, offset = 0, status } = req.query; // Ambil query params untuk pagination dan filter

    const where = { // Bangun filter WHERE: cari transaksi sebagai sender ATAU receiver
      OR: [
        { senderId: userId }, // User sebagai pengirim uang
        { receiverId: userId } // User sebagai penerima uang
      ]
    };
    
    if (status) where.status = status; // Tambahkan filter status jika disertakan

    const transactions = await prisma.transaction.findMany({ // Query transaksi user dari database
      where, // Gunakan filter yang sudah dibangun
      include: {
        sender: { // Sertakan data pengirim
          select: { id: true, name: true, username: true } // Hanya ambil field yang aman (tanpa password)
        },
        receiver: { // Sertakan data penerima
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }, // Terbaru di atas
      take: parseInt(String(limit), 10), // Limit jumlah hasil
      skip: parseInt(String(offset), 10), // Offset untuk pagination
    });

    // Tambahkan info tipe transaksi (terkirim/diterima) untuk pengguna yang meminta
    const transactionsWithType = transactions.map(transaction => ({ // Transform setiap transaksi
      ...transaction, // Salin semua field asli
      transactionType: transaction.senderId === userId ? 'sent' : 'received' // Tentukan apakah dikirim atau diterima
    }));

    res.json(transactionsWithType); // Kirim hasil dengan field transactionType tambahan
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi pengguna:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi pengguna' });
  }
});

/* -------------------------------------------------------------------------- */
/*           STATISTIK TRANSAKSI (TEMPATKAN SEBELUM /:id)                    */
/* -------------------------------------------------------------------------- */
router.get('/stats/summary', async (req, res) => { // GET /stats/summary → ringkasan statistik transaksi
  try {
    const { userId, period = '7d' } = req.query; // Ambil filter userId dan period (default 7 hari)
    const now = new Date(); // Waktu sekarang sebagai acuan perhitungan periode
    let from; // Akan diisi batas waktu awal periode

    if (period === '1d') from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 jam = 86.400.000 ms
    else if (period === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 hari
    else from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 hari terakhir

    const where = { createdAt: { gte: from } }; // Filter: hanya transaksi yang dibuat setelah 'from'

    if (userId) { // Jika filter userId disertakan
      const uid = parseInt(String(userId), 10); // Konversi ke integer
      if (!Number.isNaN(uid)) where.OR = [{ senderId: uid }, { receiverId: uid }]; // Filter: sender atau receiver
    }

    const [count, sum, avg] = await Promise.all([ // Jalankan 3 query paralel sekaligus (lebih cepat)
      prisma.transaction.count({ where }), // Query 1: hitung jumlah transaksi
      prisma.transaction.aggregate({ where, _sum: { amount: true } }), // Query 2: jumlahkan total amount
      prisma.transaction.aggregate({ where, _avg: { amount: true } }), // Query 3: hitung rata-rata amount
    ]);

    res.json({ // Kirim statistik sebagai response
      period, // Periode yang digunakan (1d/7d/30d)
      totalTransactions: count, // Jumlah transaksi dalam periode
      totalAmount: sum._sum.amount || 0, // Total nilai semua transaksi (default 0 jika kosong)
      averageAmount: avg._avg.amount || 0, // Rata-rata nilai per transaksi
    });
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan statistik transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan statistik transaksi' });
  }
});

/* -------------------------------------------------------------------------- */
/*                          BUAT TRANSAKSI BARU                               */
/* -------------------------------------------------------------------------- */
router.post(
  '/', // POST / → buat transaksi baru (transfer uang antar user)
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Jumlah harus lebih dari 0'), // Validasi: amount harus float positif
    body('receiverUsername').optional().isString(), // receiverUsername opsional, harus string jika ada
    body('receiverId').optional().isInt(), // receiverId opsional, harus integer jika ada
    // catatan: senderId dari body tidak dipercaya, hanya fallback
    body('senderId').optional().isInt(), // senderId dari body hanya fallback (utama dari JWT token)
    body('description').optional().isString(), // Deskripsi transaksi opsional
    body('deviceId').optional().isString(), // ID perangkat opsional untuk tracking
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req); // Cek hasil validasi express-validator
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() }); // Return error jika validasi gagal

      const {
        receiverUsername, // Username penerima (prioritas utama untuk identifikasi receiver)
        receiverId, // ID penerima (fallback jika tidak ada username)
        senderId: senderIdFromBody, // Sender dari body (tidak aman, hanya fallback)
        amount, // Jumlah transfer dalam Rupiah
        description, // Catatan/deskripsi transaksi
        deviceId, // ID perangkat Android pengirim
      } = req.body;

      // Ambil sender dari token (authenticateToken), kalau tidak ada baru fallback body
      const senderId = req.user?.id ?? senderIdFromBody; // Prioritas: token > body
      if (!senderId) return res.status(401).json({ error: 'Pengirim tidak terautentikasi' }); // Wajib ada sender

      const amountNum = Number(amount); // Konversi amount ke number
      if (!Number.isFinite(amountNum) || amountNum <= 0) { // Validasi: harus angka terhingga dan positif
        return res.status(400).json({ error: 'Invalid amount' }); // Tolak jika tidak valid
      }

      // Cari receiver (username lebih diutamakan)
      let receiver = null; // Akan diisi dengan data user penerima
      if (receiverUsername) { // Mode 1: cari berdasarkan username
        receiver = await prisma.user.findUnique({ where: { username: receiverUsername } }); // Query by username
      } else if (receiverId) { // Mode 2: cari berdasarkan ID
        receiver = await prisma.user.findUnique({ where: { id: Number(receiverId) } }); // Query by ID
      }
      if (!receiver) return res.status(404).json({ error: 'Receiver not found' }); // Penerima tidak ditemukan
      if (receiver.id === Number(senderId)) return res.status(400).json({ error: 'Cannot send money to yourself' }); // Tidak bisa transfer ke diri sendiri

      // Cek awal saldo sender (untuk early reject sebelum fraud check — bukan pengganti cek atomik)
      const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } }); // Ambil data sender dari DB
      if (!sender) return res.status(404).json({ error: 'Sender not found' }); // Sender tidak ditemukan
      if (sender.balance < amountNum) { // Cek cepat — saldo akan dicek ulang secara atomik di dalam $transaction
        return res.status(400).json({ error: 'Insufficient balance' }); // Return 400 jika saldo kurang
      }

      // ======================================================================
      // DETEKSI FRAUD: Z-Score Based Anomaly Detection
      // Ambil 20 transaksi historis terakhir pengguna sebagai baseline
      // Transaksi baru (amountNum) adalah X = transaksi ke-21
      // ======================================================================
      const historicalTxs = await prisma.transaction.findMany({ // Query 20 transaksi historis user
        where: { senderId: Number(senderId), status: 'completed' }, // Filter: hanya transaksi completed milik sender
        select: { amount: true, createdAt: true }, // Hanya ambil field yang diperlukan untuk Z-Score
        orderBy: { createdAt: 'desc' }, // Terbaru di atas (paling relevan untuk baseline)
        take: HISTORY_SIZE, // Ambil maksimal 20 transaksi (HISTORY_SIZE = 20)
      });

      const fraudResult = analyzeZScoreAnomaly(amountNum, historicalTxs); // Hitung Z-Score untuk amount ini
      // Handle edge case: zScore null (σ=0, amount≠mean) → Z tidak terdefinisi → ANOMALY/BLOCK
      const zScoreLevel = (fraudResult.zScore === null) // Cek apakah Z tidak terdefinisi
        ? 'ANOMALY' // Jika null: anomali (distribusi degenerasi)
        : (fraudResult.zScore <= 2 ? 'NORMAL' : fraudResult.zScore <= 3 ? 'SUSPICIOUS' : 'ANOMALY'); // Three-sigma rule

      // BLOCK: Tolak transaksi, catat sebagai percobaan fraud
      if (fraudResult.decision === 'BLOCK') { // Z > 3: anomali ekstrem, blokir transaksi
        await prisma.fraudAlert.create({ // Simpan fraud alert ke database
          data: {
            userId: Number(senderId), // User yang melakukan transaksi mencurigakan
            deviceId: deviceId || 'unknown', // Device yang digunakan
            deviceName: 'Mobile App', // Nama perangkat
            // zScore null = edge case sigma=0 (Z tidak terdefinisi). Simpan -1 sebagai sentinel.
            riskScore: fraudResult.zScore ?? -1, // Z-Score atau -1 jika tidak terdefinisi
            riskLevel: 'ANOMALY', // Level risiko tertinggi untuk BLOCK
            decision: 'BLOCK', // Keputusan: blokir
            reasons: JSON.stringify(fraudResult.reasons), // Alasan dalam JSON string
            confidence: 0.997, // 99.7% confidence (3-sigma rule)
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore, // Nilai Z
              mean: fraudResult.mean, // Rata-rata historis
              stdDev: fraudResult.stdDev, // Standar deviasi
              variance: fraudResult.variance, // Varians
              n: fraudResult.n, // Jumlah data historis
              currentAmount: amountNum, // Amount yang diblokir
              algorithm: 'Z-Score Based Anomaly Detection', // Nama algoritma
              thresholds: { allow: 2, review: 3 } // Threshold Z-Score
            }),
            ipAddress: req.ip, // IP address pengirim
            userAgent: req.headers['user-agent'], // Browser/app info
          },
        });
        return res.status(403).json({ // Return 403 Forbidden: transaksi ditolak
          error: 'Transaksi diblokir \u2013 anomali terdeteksi (Z-Score > 3)',
          zScore: fraudResult.zScore, // Nilai Z untuk informasi user
          riskLevel: 'ANOMALY', // Level risiko
          decision: 'BLOCK', // Keputusan sistem
          reasons: fraudResult.reasons, // Penjelasan alasan pemblokiran
          mean: fraudResult.mean, // Rata-rata historis (untuk konteks)
          stdDev: fraudResult.stdDev, // Standar deviasi historis
          historyCount: fraudResult.n // Jumlah data yang dipakai
        });
      }

      // ALLOW / REVIEW: Proses transaksi, perbarui saldo
      const transaction = await prisma.$transaction(async (tx) => { // Jalankan operasi atomik (semua berhasil atau semua dibatalkan)
        // Atomic check-and-decrement: kurangi saldo HANYA jika masih cukup
        // Mencegah TOCTOU race condition — jika dua transaksi diproses bersamaan,
        // hanya satu yang berhasil karena updateMany dengan WHERE balance >= amount.
        const deducted = await tx.user.updateMany({
          where: { id: Number(senderId), balance: { gte: amountNum } }, // Kondisi: saldo harus cukup
          data: { balance: { decrement: amountNum } }, // Atomic decrement
        });
        if (deducted.count === 0) { // Jika tidak ada row yang terupdate, saldo tidak cukup
          throw new Error('INSUFFICIENT_BALANCE'); // Lempar error agar $transaction di-rollback
        }

        await tx.user.update({ // Tambah saldo receiver
          where: { id: receiver.id }, // Identifikasi receiver berdasarkan ID
          data: { balance: { increment: amountNum } }, // Atomic increment: tambah saldo
        });

        const created = await tx.transaction.create({ // Simpan record transaksi ke database
          data: {
            senderId: Number(senderId), // ID pengirim
            receiverId: receiver.id, // ID penerima
            amount: amountNum, // Jumlah transfer
            description, // Catatan transaksi (opsional)
            deviceId, // ID perangkat yang digunakan
            fraudRiskScore: fraudResult.zScore ?? null,  // Float? di schema — null saat edge case sigma=0
            fraudRiskLevel: zScoreLevel, // NORMAL/SUSPICIOUS/ANOMALY
            fraudReasons: JSON.stringify(fraudResult.reasons), // Alasan deteksi fraud sebagai JSON string
            ipAddress: req.ip, // IP address untuk audit
          },
          include: {
            sender: { // Include data sender dalam response
              select: { id: true, name: true, username: true, balance: true, deviceId: true }, // Field yang dikembalikan
            },
            receiver: { // Include data receiver dalam response
              select: { id: true, name: true, username: true, balance: true, deviceId: true },
            },
          },
        });

        return created; // Return transaksi yang dibuat untuk digunakan di luar blok
      });

      // REVIEW: Buat fraud alert untuk admin
      if (fraudResult.decision === 'REVIEW') { // 2 < Z ≤ 3: mencurigakan, perlu review admin
        await prisma.fraudAlert.create({ // Simpan fraud alert dengan status SUSPICIOUS
          data: {
            userId: Number(senderId), // User yang melakukan transaksi mencurigakan
            transactionId: transaction.id, // Link ke transaksi yang baru dibuat
            deviceId: deviceId || 'unknown', // ID perangkat
            deviceName: 'Mobile App', // Nama perangkat
            riskScore: fraudResult.zScore ?? -1,  // -1 = sentinel: Z tidak terdefinisi (\u03c3=0)
            riskLevel: 'SUSPICIOUS', // Level: mencurigakan (bukan anomali penuh)
            decision: 'REVIEW', // Keputusan: perlu ditinjau admin
            reasons: JSON.stringify(fraudResult.reasons), // Alasan
            confidence: 0.95, // 95% confidence (2-sigma rule)
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore, // Nilai Z
              mean: fraudResult.mean, // Rata-rata
              stdDev: fraudResult.stdDev, // Standar deviasi
              variance: fraudResult.variance, // Varians
              n: fraudResult.n, // Jumlah data historis
              currentAmount: amountNum, // Amount transaksi
              algorithm: 'Z-Score Based Anomaly Detection', // Algoritma
              thresholds: { allow: 2, review: 3 } // Threshold
            }),
            ipAddress: req.ip, // IP address
            userAgent: req.headers['user-agent'], // Info browser/app
          },
        });
      }

      // Emit realtime
      if (req.io) { // Cek apakah Socket.IO tersedia (disetup di server.js)
        req.io.to('admin-room').emit('new-transaction', { transaction, fraudResult }); // Notifikasi admin dashboard: transaksi baru
        if (transaction.sender?.deviceId) { // Jika sender punya device terdaftar
          req.io.to(`device-${transaction.sender.deviceId}`).emit('balance-updated', { // Kirim update saldo ke device sender
            balance: transaction.sender.balance, // Saldo terbaru setelah transfer
          });
        }
        if (transaction.receiver?.deviceId) { // Jika receiver punya device terdaftar
          req.io.to(`device-${transaction.receiver.deviceId}`).emit('balance-updated', { // Kirim update saldo ke device receiver
            balance: transaction.receiver.balance, // Saldo terbaru setelah menerima
          });
        }
      }

      res.status(201).json({ // Return 201 Created: transaksi berhasil dibuat
        success: true, // Flag sukses untuk client
        message: 'Transaksi berhasil diselesaikan', // Pesan konfirmasi
        transaction, // Data transaksi lengkap
        fraudResult, // Hasil analisis fraud (untuk ditampilkan di receipt)
      });
    } catch (error) {
      console.error('\u274c Kesalahan membuat transaksi:', error);
      // Tangani error INSUFFICIENT_BALANCE yang dilempar dari dalam $transaction (race condition)
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      res.status(500).json({ error: 'Gagal membuat transaksi' }); // Return 500 ke client
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                      DAPATKAN TRANSAKSI BERDASARKAN ID                     */
/* -------------------------------------------------------------------------- */
router.get('/:id', async (req, res) => { // GET /:id → ambil detail transaksi berdasarkan ID
  try {
    const id = parseInt(String(req.params.id), 10); // Konversi ID dari URL param ke integer
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Validasi: harus angka valid

    const transaction = await prisma.transaction.findUnique({ // Cari transaksi berdasarkan ID unik
      where: { id }, // Filter: id harus sama
      include: {
        sender: { select: { id: true, name: true, username: true } }, // Include data sender
        receiver: { select: { id: true, name: true, username: true } }, // Include data receiver
      },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' }); // Return 404 jika tidak ditemukan
    res.json(transaction); // Return detail transaksi
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' });
  }
});

module.exports = router; // Export router agar bisa di-mount di server.js sebagai /api/transactions
