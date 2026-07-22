const express = require('express');
// require = mengambil package Node.js; Express dipakai untuk membuat router dan endpoint
const { body, validationResult } = require('express-validator');
// require = mengambil package Node.js; body untuk aturan validasi; validationResult untuk mengambil hasilnya
const { PrismaClient } = require('@prisma/client');
// require = mengambil package Node.js; PrismaClient adalah ORM untuk akses database SQLite
const { analyzeZScoreAnomaly, HISTORY_SIZE } = require('../utils/fraudDetection');
// require = mengambil file lokal; analyzeZScoreAnomaly menghitung risiko transaksi; HISTORY_SIZE = jumlah histori baseline Z-Score

const router = express.Router();
// express.Router() = membuat route terpisah agar endpoint transaksi lebih rapi
const prisma = new PrismaClient();
// PrismaClient = koneksi ORM; dipakai untuk semua operasi database transaksi
const requireAdmin = (req, res, next) => req.admin
  ? next()
  : res.status(403).json({ error: 'ADMIN_REQUIRED' });
const requireTransactionUserOrAdmin = (req, res, next) => {
  const requestedUserId = Number(req.params.userId);
  if (req.admin || (req.user && req.user.id === requestedUserId)) return next();
  return res.status(403).json({ error: 'TRANSACTION_ACCESS_DENIED' });
};
const matchesTransferFingerprint = (record, senderId, receiverId, amount) =>
  record.senderId === senderId &&
  record.receiverId === receiverId &&
  record.amount === amount;
const matchesBlockedTransferFingerprint = (alert, senderId, receiverId, amount) => {
  try {
    const riskFactors = JSON.parse(alert.riskFactors || '{}');
    return alert.userId === senderId &&
      riskFactors.receiverId === receiverId &&
      riskFactors.currentAmount === amount;
  } catch {
    return false;
  }
};
const parsePagination = (limit, offset) => {
  const limitNum = Number(limit);
  const offsetNum = Number(offset);
  if (!Number.isSafeInteger(limitNum) || limitNum < 1 || limitNum > 100) return null;
  if (!Number.isSafeInteger(offsetNum) || offsetNum < 0) return null;
  return { limit: limitNum, offset: offsetNum };
};

router.param('userId', (req, res, next, userId) => {
  const parsedUserId = Number(userId);
  if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ error: 'INVALID_USER_ID' });
  }
  req.params.userId = String(parsedUserId);
  return next();
});

router.param('id', (req, res, next, id) => {
  const transactionId = Number(id);
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return res.status(400).json({ error: 'INVALID_TRANSACTION_ID' });
  }
  req.params.id = String(transactionId);
  return next();
});

// --------------------------------------------------------------------------
// Z-SCORE BASED ANOMALY DETECTION
// Deteksi anomali transaksi berdasarkan 20 histori terakhir
// --------------------------------------------------------------------------
//
// Fraud Detection menggunakan Z-Score Based Anomaly Detection.
// Metode: Ambil 20 transaksi historis terakhir sebagai baseline,
// hitung mean/variance/stddev, lalu Z-Score transaksi baru.
// Keputusan: Z<=2 ALLOW | 2<Z<=3 REVIEW | Z>3 BLOCK
//
// REFERENSI AKADEMIS:
//   [1] Bolton & Hand (2002). Statistical fraud detection. Statistical Science.
//       https://doi.org/10.1214/ss/1042727940
//   [2] Chandola et al. (2009). Anomaly detection: A survey. ACM Comput. Surv.
//       https://doi.org/10.1145/1541880.1541882
//   [3] Tagle (2024). ML for Real-time Fraud Detection in NFC Transactions.
//       https://doi.org/10.62718/vmca.tech-gjtdsi.3.1.sc-1124-009
//   [4] Vanini et al. (2023). Online payment fraud. Financial Innovation.
//       https://doi.org/10.1186/s40854-023-00470-w
//   [5] Zhukabayeva et al. (2025). Anomaly detection via Z-Score.
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// DAPATKAN SEMUA TRANSAKSI
// --------------------------------------------------------------------------
router.get('/', requireAdmin, async (req, res) => {
// GET = mengambil data; endpoint untuk mengambil semua transaksi dengan filter opsional
  try {
  // try = mencoba proses aman; error akan ditangkap oleh catch
    const { limit = 20, offset = 0, userId, status } = req.query;
    // req.query = query URL; mengambil limit, offset, userId, status dari parameter URL

    const pagination = parsePagination(limit, offset);
    if (!pagination) {
      return res.status(400).json({ error: 'INVALID_PAGINATION' });
    }

    const where = {};
    // const = variabel tetap; objek filter WHERE yang akan dibangun secara dinamis
    if (userId) {
    // if = pengecekan kondisi; berjalan jika filter userId disertakan dalam request
      const uid = parseInt(String(userId), 10);
      // parseInt = mengubah nilai menjadi angka bulat; mengubah userId string ke integer
      if (!Number.isNaN(uid)) {
      // if = pengecekan kondisi; berjalan jika konversi berhasil (bukan NaN)
        where.OR = [{ senderId: uid }, { receiverId: uid }];
        // where = kondisi query; OR memfilter transaksi di mana user sebagai pengirim ATAU penerima
      }
    }
    if (status) where.status = status;
    // if = pengecekan kondisi; tambahkan filter status ke WHERE jika disertakan

    const transactions = await prisma.transaction.findMany({
    // await = menunggu proses selesai; findMany = mengambil banyak transaksi dari database
      where,
      // Gunakan filter dinamis yang dibangun di atas
      include: {
        sender: { select: { id: true, name: true, username: true } },
        // Include data sender (hanya field yang diperlukan)
        receiver: { select: { id: true, name: true, username: true } },
        // Include data receiver
      },
      orderBy: { createdAt: 'desc' },
      // orderBy = mengurutkan data dari yang terbaru
      take: pagination.limit,
      // take = membatasi jumlah data yang diambil
      skip: pagination.offset,
      // skip = melewati data tertentu untuk pagination
    });

    res.json(transactions);
    // res.json = mengirim response JSON berisi array transaksi ke client
  } catch (error) {
  // catch = menangkap error; mencegah server crash
    console.error('\u274c Kesalahan mendapatkan transaksi:', error);
    // console.error = menampilkan error ke terminal untuk debugging
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' });
    // 500 = error server; mengirim response gagal ke client
  }
});

// --------------------------------------------------------------------------
// DAPATKAN TRANSAKSI BERDASARKAN ID PENGGUNA
// --------------------------------------------------------------------------
router.get('/user/:userId', requireTransactionUserOrAdmin, async (req, res) => {
// GET = mengambil data; endpoint untuk mengambil transaksi milik satu user tertentu
  try {
  // try = mencoba proses aman; error akan ditangkap oleh catch
    const userId = Number(req.params.userId);
    // req.params = parameter URL; parseInt mengubah userId string ke integer
    if (isNaN(userId)) {
    // if = pengecekan kondisi; berjalan jika userId bukan angka valid
      return res.status(400).json({ error: 'ID pengguna tidak valid' });
      // return = menghentikan fungsi; 400 = request salah; userId tidak valid
    }

    const { limit = 20, offset = 0, status } = req.query;
    // Ambil query params untuk pagination dan filter

    const pagination = parsePagination(limit, offset);
    if (!pagination) {
      return res.status(400).json({ error: 'INVALID_PAGINATION' });
    }

    const where = {
      // Bangun filter WHERE: cari transaksi sebagai sender ATAU receiver
      OR: [
        { senderId: userId },
        // User sebagai pengirim uang
        { receiverId: userId }
        // User sebagai penerima uang
      ]
    };
    
    if (status) where.status = status;
    // Tambahkan filter status jika disertakan

    const transactions = await prisma.transaction.findMany({
      // Query transaksi user dari database
      where,
      // Gunakan filter yang sudah dibangun
      include: {
        sender: {
          // Sertakan data pengirim
          select: { id: true, name: true, username: true }
          // Hanya ambil field yang aman (tanpa password)
        },
        receiver: {
          // Sertakan data penerima
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      // Terbaru di atas
      take: pagination.limit,
      // Limit jumlah hasil
      skip: pagination.offset,
      // Offset untuk pagination
    });

    // Tambahkan info tipe transaksi (terkirim/diterima) untuk pengguna yang meminta
    const transactionsWithType = transactions.map(transaction => ({
      // Transform setiap transaksi
      ...transaction,
      // Salin semua field asli
      transactionType: transaction.senderId === userId ? 'sent' : 'received'
      // Tentukan apakah dikirim atau diterima
    }));

    res.json(transactionsWithType);
    // Kirim hasil dengan field transactionType tambahan
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi pengguna:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi pengguna' });
  }
});

// --------------------------------------------------------------------------
// STATISTIK TRANSAKSI (TEMPATKAN SEBELUM /:id)
// --------------------------------------------------------------------------
router.get('/stats/summary', requireAdmin, async (req, res) => {
  // GET /stats/summary → ringkasan statistik transaksi
  try {
    const { userId, period = '7d' } = req.query;
    // Ambil filter userId dan period (default 7 hari)
    const now = new Date();
    // Waktu sekarang sebagai acuan perhitungan periode
    let from;
    // Akan diisi batas waktu awal periode

    if (period === '1d') from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // 24 jam = 86.400.000 ms
    else if (period === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    // 30 hari
    else from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Default: 7 hari terakhir

    const where = { createdAt: { gte: from } };
    // Filter: hanya transaksi yang dibuat setelah 'from'

    if (userId) {
      // Jika filter userId disertakan
      const uid = parseInt(String(userId), 10);
      // Konversi ke integer
      if (!Number.isNaN(uid)) where.OR = [{ senderId: uid }, { receiverId: uid }];
      // Filter: sender atau receiver
    }

    const [count, sum, avg] = await Promise.all([
    // Jalankan 3 query paralel sekaligus (lebih cepat)
      prisma.transaction.count({ where }),
      // Query 1: hitung jumlah transaksi
      prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      // Query 2: jumlahkan total amount
      prisma.transaction.aggregate({ where, _avg: { amount: true } }),
      // Query 3: hitung rata-rata amount
    ]);

    res.json({
      // Kirim statistik sebagai response
      period,
      // Periode yang digunakan (1d/7d/30d)
      totalTransactions: count,
      // Jumlah transaksi dalam periode
      totalAmount: sum._sum.amount || 0,
      // Total nilai semua transaksi (default 0 jika kosong)
      averageAmount: avg._avg.amount || 0,
      // Rata-rata nilai per transaksi
    });
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan statistik transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan statistik transaksi' });
  }
});

// --------------------------------------------------------------------------
// BUAT TRANSAKSI BARU
// --------------------------------------------------------------------------
router.post(
  '/',
  // POST / → buat transaksi baru (transfer uang antar user)
  [
    body('amount').custom(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
      .withMessage('Jumlah Rupiah harus berupa angka positif'),
    body('receiverUsername').optional().isString(),
    // receiverUsername opsional, harus string jika ada
    body('receiverId').optional().isInt(),
    // receiverId opsional, harus integer jika ada
    body('description').optional().isString(),
    // Deskripsi transaksi opsional
    body('deviceId').optional().isString(),
    // ID perangkat opsional untuk tracking
  ],
  async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'];
    const senderId = req.user?.id;
    let transferFingerprint = null;
    try {
      const errors = validationResult(req);
      // Cek hasil validasi express-validator
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      // Return error jika validasi gagal

      const {
        receiverUsername,
        // Username penerima (prioritas utama untuk identifikasi receiver)
        receiverId,
        // ID penerima (fallback jika tidak ada username)
        amount,
        // Jumlah transfer dalam Rupiah
        description,
        // Catatan/deskripsi transaksi
        deviceId,
        // ID perangkat Android pengirim
      } = req.body;

      // Identitas sender hanya berasal dari JWT yang sudah diverifikasi middleware.
      if (!senderId) return res.status(401).json({ error: 'Pengirim tidak terautentikasi' });
      // Wajib ada sender
      // Idempotency-Key mengikat satu percobaan transfer agar retry client tidak mendebit saldo dua kali.
      if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
        return res.status(400).json({ error: 'Idempotency-Key wajib berisi 16-128 karakter yang valid' });
      }

      const amountNum = amount;
      if (typeof amountNum !== 'number' || !Number.isFinite(amountNum) || amountNum <= 0) {
        // Validasi: harus angka terhingga dan positif
        return res.status(400).json({ error: 'Invalid amount' });
        // Tolak jika tidak valid
      }

      // Cari receiver (username lebih diutamakan)
      let receiver = null;
      // Akan diisi dengan data user penerima
      if (receiverUsername) {
        // Mode 1: cari berdasarkan username
        receiver = await prisma.user.findUnique({ where: { username: receiverUsername } });
        // Query by username
      } else if (receiverId) {
        // Mode 2: cari berdasarkan ID
        receiver = await prisma.user.findUnique({ where: { id: Number(receiverId) } });
        // Query by ID
      }
      if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
      // Penerima tidak ditemukan
      if (receiver.id === Number(senderId)) return res.status(400).json({ error: 'Cannot send money to yourself' });
      // Tidak bisa transfer ke diri sendiri

      transferFingerprint = { senderId, receiverId: receiver.id, amount: amountNum };
  // Cari hasil transaksi atau BLOCK sebelumnya secara paralel sebelum menjalankan side effect baru.
  // Key yang sama hanya boleh diputar ulang bila sender, receiver, dan nominalnya tetap identik.
      const [existingTransaction, existingAlert] = await Promise.all([
        prisma.transaction.findUnique({
          where: { idempotencyKey },
          include: {
            sender: { select: { id: true, name: true, username: true, balance: true, deviceId: true } },
            receiver: { select: { id: true, name: true, username: true, balance: true, deviceId: true } }
          }
        }),
        prisma.fraudAlert.findUnique({ where: { idempotencyKey } })
      ]);
      if (existingTransaction) {
        if (!matchesTransferFingerprint(existingTransaction, senderId, receiver.id, amountNum)) {
          return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
        }
        return res.json({ success: true, duplicate: true, transaction: existingTransaction });
      }
      if (existingAlert?.decision === 'BLOCK') {
        if (!matchesBlockedTransferFingerprint(existingAlert, senderId, receiver.id, amountNum)) {
          return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
        }
        return res.status(403).json({
          error: 'Transaksi diblokir - anomali terdeteksi',
          duplicate: true,
          zScore: existingAlert.riskScore === -1 ? null : existingAlert.riskScore,
          riskLevel: existingAlert.riskLevel,
          decision: existingAlert.decision,
          reasons: JSON.parse(existingAlert.reasons)
        });
      }

      // Cek awal saldo sender (untuk early reject sebelum fraud check — bukan pengganti cek atomik)
      const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } });
      // Ambil data sender dari DB
      if (!sender) return res.status(404).json({ error: 'Sender not found' });
      // Sender tidak ditemukan
      if (sender.balance < amountNum) {
        // Cek cepat — saldo akan dicek ulang secara atomik di dalam $transaction
        return res.status(400).json({ error: 'Insufficient balance' });
        // Return 400 jika saldo kurang
      }
      if (!Number.isFinite(receiver.balance + amountNum)) {
        return res.status(400).json({ error: 'BALANCE_OVERFLOW' });
      }

      // ======================================================================
      // DETEKSI FRAUD: Z-Score Based Anomaly Detection
      // Ambil 20 transaksi historis terakhir pengguna sebagai baseline
      // Transaksi baru (amountNum) adalah X = transaksi ke-21
      // Filter senderId hanya memakai transaksi keluar; status completed mengecualikan transaksi gagal.
      // Query berjalan sebelum INSERT transaksi baru sehingga nilai X tidak masuk ke baseline sendiri.
      // ======================================================================
      const historicalTxs = await prisma.transaction.findMany({
      // await = menunggu proses selesai; findMany = mengambil 20 transaksi historis sebagai baseline Z-Score
        where: { senderId: Number(senderId), status: 'completed' },
        // where = kondisi query; hanya ambil transaksi completed milik sender sebagai baseline
        select: { amount: true, createdAt: true },
        // select = memilih field tertentu; hanya amount dan createdAt yang diperlukan untuk Z-Score
        orderBy: { createdAt: 'desc' },
        // Terbaru di atas (paling relevan untuk baseline)
        take: HISTORY_SIZE,
        // take = membatasi jumlah data; HISTORY_SIZE = 20 transaksi historis untuk baseline Z-Score
      });

      const fraudResult = analyzeZScoreAnomaly(amountNum, historicalTxs);
      // analyzeZScoreAnomaly = menghitung risiko transaksi dengan Z-Score; mengembalikan zScore, decision, mean, stdDev
      const zScoreLevel = fraudResult.riskLevel;
      // const = membuat referensi variabel tetap; zScoreLevel = label tingkat risiko transaksi yang akan disimpan.
      // fraudResult.riskLevel berasal langsung dari engine fraud: ALLOW menjadi NORMAL, REVIEW menjadi SUSPICIOUS,
      // dan BLOCK menjadi ANOMALY. Route tidak menghitung ulang dari zScore agar decision dan riskLevel selalu konsisten.

      // BLOCK: Tolak transaksi, catat sebagai percobaan fraud
      if (fraudResult.decision === 'BLOCK') {
      // if = pengecekan kondisi; BLOCK = transaksi anomali tinggi dan ditolak (Z > 3)
        await prisma.fraudAlert.create({
        // await = menunggu proses selesai; create = membuat data fraud alert baru di database
          data: {
            userId: Number(senderId),
            // User yang melakukan transaksi mencurigakan
            deviceId: deviceId || 'unknown',
            // Device yang digunakan
            deviceName: 'Mobile App',
            // Nama perangkat
            // zScore null = edge case sigma=0 (Z tidak terdefinisi). Simpan -1 sebagai sentinel.
            riskScore: fraudResult.zScore ?? -1,
            // Z-Score atau -1 jika tidak terdefinisi
            riskLevel: 'ANOMALY',
            // Level risiko tertinggi untuk BLOCK
            decision: 'BLOCK',
            // Keputusan: blokir
            reasons: JSON.stringify(fraudResult.reasons),
            // Alasan dalam JSON string
            confidence: 0.997,
            idempotencyKey,
            // Nilai 0.997 adalah metadata kebijakan BLOCK, bukan probabilitas fraud terukur.
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore,
              // Nilai Z
              mean: fraudResult.mean,
              // Rata-rata historis
              stdDev: fraudResult.stdDev,
              // Standar deviasi
              variance: fraudResult.variance,
              // Varians
              n: fraudResult.n,
              // Jumlah data historis
              receiverId: receiver.id,
              currentAmount: amountNum,
              // Amount yang diblokir
              algorithm: 'Z-Score Based Anomaly Detection',
              // Nama algoritma
              thresholds: { allow: 2, review: 3 }
              // Threshold Z-Score
            }),
            ipAddress: req.ip,
            // IP address pengirim
            userAgent: req.headers['user-agent'],
            // Browser/app info
          },
        });
        return res.status(403).json({
        // return = menghentikan fungsi; 403 = akses ditolak; transaksi anomali tidak dapat diproses
          error: 'Transaksi diblokir \u2013 anomali terdeteksi (Z-Score > 3)',
          zScore: fraudResult.zScore,
          // Nilai Z untuk informasi user
          riskLevel: 'ANOMALY',
          // Level risiko
          decision: 'BLOCK',
          // Keputusan sistem
          reasons: fraudResult.reasons,
          // Penjelasan alasan pemblokiran
          mean: fraudResult.mean,
          // Rata-rata historis (untuk konteks)
          stdDev: fraudResult.stdDev,
          // Standar deviasi historis
          historyCount: fraudResult.n
          // Jumlah data yang dipakai
        });
      }

      // ALLOW / REVIEW: Proses transaksi, perbarui saldo
      const transaction = await prisma.$transaction(async (tx) => {
      // $transaction = menjalankan beberapa query satu paket agar data konsisten; rollback otomatis jika ada error
        // hanya satu yang berhasil karena updateMany dengan WHERE balance >= amount.
        const deducted = await tx.user.updateMany({
        // await = menunggu proses selesai; updateMany = memperbarui saldo sender secara atomik
          where: { id: Number(senderId), balance: { gte: amountNum } },
          // where = kondisi query; hanya kurangi saldo jika saldo >= amount (cek atomik)
          data: { balance: { decrement: amountNum } },
          // data = nilai yang diperbarui; decrement mengurangi saldo secara atomik
        });
        if (deducted.count === 0) {
        // if = pengecekan kondisi; count = 0 berarti saldo tidak cukup atau kondisi WHERE tidak terpenuhi
          throw new Error('INSUFFICIENT_BALANCE');
          // throw new Error = membuat error; memicu rollback seluruh $transaction agar data konsisten
        }

        const credited = await tx.user.updateMany({
          where: {
            id: receiver.id,
            balance: { lte: Number.MAX_VALUE - amountNum }
          },
          data: { balance: { increment: amountNum } }
        });
        if (credited.count === 0) {
          const overflowError = new Error('BALANCE_OVERFLOW');
          overflowError.code = 'BALANCE_OVERFLOW';
          throw overflowError;
        }

        const [updatedSender, updatedReceiver] = await Promise.all([
          tx.user.findUnique({ where: { id: Number(senderId) }, select: { balance: true } }),
          tx.user.findUnique({ where: { id: receiver.id }, select: { balance: true } })
        ]);
        // Salin saldo User hasil debit/kredit ke setiap NFCCard terkait dalam transaksi database yang sama.
        await Promise.all([
          tx.nFCCard.updateMany({
            where: { userId: Number(senderId) },
            data: { balance: updatedSender.balance }
          }),
          tx.nFCCard.updateMany({
            where: { userId: receiver.id },
            data: { balance: updatedReceiver.balance }
          })
        ]);

        const created = await tx.transaction.create({
        // await = menunggu proses selesai; create = membuat data transaksi baru di database
          data: {
            senderId: Number(senderId),
            // Number() mengkonversi nilai ke tipe number untuk memastikan tipe data benar
            receiverId: receiver.id,
            // ID user penerima
            amount: amountNum,
            // jumlah transfer dalam Rupiah
            description,
            // shorthand ES6: description: description — catatan transaksi opsional
            deviceId,
            // shorthand ES6: deviceId: deviceId — ID perangkat Android
            fraudRiskScore: fraudResult.zScore ?? null,
            // ?? adalah nullish coalescing: jika zScore null/undefined gunakan null; Float? di schema Prisma — kolom nullable
            fraudRiskLevel: zScoreLevel,
            // level risiko: NORMAL/SUSPICIOUS/ANOMALY
            fraudReasons: JSON.stringify(fraudResult.reasons),
            // JSON.stringify = mengubah object menjadi teks JSON untuk disimpan di kolom database
            ipAddress: req.ip,
            idempotencyKey,
            // IP address client untuk audit keamanan
          },
          include: {
            sender: {
              // include melakukan JOIN ke tabel User untuk data sender
              select: { id: true, name: true, username: true, balance: true, deviceId: true },
              // SELECT hanya field yang diperlukan (hindari password)
            },
            receiver: {
              // include melakukan JOIN ke tabel User untuk data receiver
              select: { id: true, name: true, username: true, balance: true, deviceId: true },
            },
          },
        });

        if (fraudResult.decision === 'REVIEW') {
          // REVIEW harus menyimpan transaksi, perubahan saldo, dan Fraud Alert dalam satu operasi atomik.
          await tx.fraudAlert.create({
            data: {
              userId: Number(senderId),
              transactionId: created.id,
              deviceId: deviceId || 'unknown',
              deviceName: 'Mobile App',
              riskScore: fraudResult.zScore ?? -1,
              riskLevel: fraudResult.riskLevel,
              decision: fraudResult.decision,
              reasons: JSON.stringify(fraudResult.reasons),
              confidence: 0.95,
              idempotencyKey,
              riskFactors: JSON.stringify({
                zScore: fraudResult.zScore,
                mean: fraudResult.mean,
                stdDev: fraudResult.stdDev,
                variance: fraudResult.variance,
                n: fraudResult.n,
                currentAmount: amountNum,
                algorithm: 'Z-Score Based Anomaly Detection',
                thresholds: fraudResult.thresholds
              }),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            }
          });
          // Jika alert gagal disimpan, Prisma membatalkan saldo dan record transaksi agar client tidak menerima keadaan setengah berhasil.
        }

        return created;
        // Return transaksi yang dibuat untuk digunakan di luar blok
      });

      // Emit realtime
      if (req.io) {
      // if = pengecekan kondisi; berjalan jika Socket.IO tersedia untuk kirim notifikasi real-time
        req.io.to('admin-room').emit('new-transaction', { transaction, fraudResult });
        // emit = mengirim event real-time ke dashboard admin berisi data transaksi dan hasil fraud detection
        if (transaction.sender?.deviceId) {
          // ?. adalah optional chaining — mencegah error jika sender null; mengecek apakah sender punya deviceId
          req.io.to(`device-${transaction.sender.deviceId}`).emit('balance-updated', {
            // template literal backtick untuk membuat room name dinamis: device-XXXX; .emit mengirim event update saldo
            balance: transaction.sender.balance,
            // saldo sender setelah dikurangi (sudah diupdate dalam $transaction)
          });
        }
        if (transaction.receiver?.deviceId) {
          // ?. mencegah error jika receiver null; mengecek deviceId receiver
          req.io.to(`device-${transaction.receiver.deviceId}`).emit('balance-updated', {
            // kirim event update saldo ke device receiver
            balance: transaction.receiver.balance,
            // saldo receiver setelah ditambah (sudah diupdate dalam $transaction)
          });
        }
      }

      res.status(201).json({
      // return = mengembalikan hasil; 201 = data berhasil dibuat; mengirim hasil transaksi ke client
        success: true,
        // success = status berhasil; memberi tahu client proses sukses
        message: 'Transaksi berhasil diselesaikan',
        // pesan konfirmasi yang ditampilkan ke user
        transaction,
        // shorthand ES6: mengirim data transaksi lengkap (include sender & receiver)
        fraudResult,
        // shorthand ES6: mengirim hasil analisis Z-Score untuk ditampilkan di receipt transaksi
      });
    } catch (error) {
      console.error('\u274c Kesalahan membuat transaksi:', error);
      // Tangani error INSUFFICIENT_BALANCE yang dilempar dari dalam $transaction (race condition)
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      if (error.code === 'BALANCE_OVERFLOW') {
        return res.status(400).json({ error: 'BALANCE_OVERFLOW' });
      }
      // P2002 dapat terjadi ketika request paralel lolos pemeriksaan awal tetapi key unik sudah dimenangkan request lain.
      // Baca pemenang dan cocokkan fingerprint sebelum mengembalikan replay agar key tidak dapat dipakai untuk payload lain.
      if (error.code === 'P2002' && idempotencyKey && transferFingerprint) {
        const [existingTransaction, existingAlert] = await Promise.all([
          prisma.transaction.findUnique({
            where: { idempotencyKey },
            include: {
              sender: { select: { id: true, name: true, username: true, balance: true, deviceId: true } },
              receiver: { select: { id: true, name: true, username: true, balance: true, deviceId: true } }
            }
          }),
          prisma.fraudAlert.findUnique({ where: { idempotencyKey } })
        ]);
        if (existingTransaction && matchesTransferFingerprint(
          existingTransaction,
          transferFingerprint.senderId,
          transferFingerprint.receiverId,
          transferFingerprint.amount
        )) {
          return res.json({ success: true, duplicate: true, transaction: existingTransaction });
        }
        if (existingAlert?.decision === 'BLOCK' && matchesBlockedTransferFingerprint(
          existingAlert,
          transferFingerprint.senderId,
          transferFingerprint.receiverId,
          transferFingerprint.amount
        )) {
          return res.status(403).json({
            error: 'Transaksi diblokir - anomali terdeteksi',
            duplicate: true,
            zScore: existingAlert.riskScore === -1 ? null : existingAlert.riskScore,
            riskLevel: existingAlert.riskLevel,
            decision: existingAlert.decision,
            reasons: JSON.parse(existingAlert.reasons)
          });
        }
        return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
      }
      res.status(500).json({ error: 'Gagal membuat transaksi' });
      // Return 500 ke client
    }
  }
);

// --------------------------------------------------------------------------
// DAPATKAN TRANSAKSI BERDASARKAN ID
// --------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  // GET /:id → ambil detail transaksi berdasarkan ID
  try {
    const id = Number(req.params.id);
    // Konversi ID dari URL param ke integer
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    // Validasi: harus angka valid

    const transaction = await prisma.transaction.findUnique({
      // Cari transaksi berdasarkan ID unik
      where: { id },
      // Filter: id harus sama
      include: {
        sender: { select: { id: true, name: true, username: true } },
        // Include data sender
        receiver: { select: { id: true, name: true, username: true } },
        // Include data receiver
      },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    // Return 404 jika tidak ditemukan
    if (!req.admin && transaction.senderId !== req.user?.id && transaction.receiverId !== req.user?.id) {
      return res.status(403).json({ error: 'TRANSACTION_ACCESS_DENIED' });
    }
    res.json(transaction);
    // Return detail transaksi
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' });
  }
});

module.exports = router;
// module.exports = mengekspor router agar dipakai server utama di server.js
