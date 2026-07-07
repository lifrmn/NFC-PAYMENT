const express = require('express'); // require = mengambil package Node.js; Express dipakai untuk membuat router dan...
// require = mengambil package Node.js; Express dipakai untuk membuat router dan endpoint
const { body, validationResult } = require('express-validator'); // require = mengambil package Node.js; body untuk aturan validasi; validationRe...
// require = mengambil package Node.js; body untuk aturan validasi; validationResult untuk mengambil hasilnya
const { PrismaClient } = require('@prisma/client'); // require = mengambil package Node.js; PrismaClient adalah ORM untuk akses data...
// require = mengambil package Node.js; PrismaClient adalah ORM untuk akses database SQLite
const { analyzeZScoreAnomaly, HISTORY_SIZE } = require('../utils/fraudDetection'); // require = mengambil file lokal; analyzeZScoreAnomaly menghitung risiko transa...
// require = mengambil file lokal; analyzeZScoreAnomaly menghitung risiko transaksi; HISTORY_SIZE = jumlah histori baseline Z-Score

const router = express.Router(); // express.Router() = membuat route terpisah agar endpoint transaksi lebih rapi
// express.Router() = membuat route terpisah agar endpoint transaksi lebih rapi
const prisma = new PrismaClient(); // PrismaClient = koneksi ORM; dipakai untuk semua operasi database transaksi
// PrismaClient = koneksi ORM; dipakai untuk semua operasi database transaksi

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
router.get('/', async (req, res) => { // GET = mengambil data; endpoint untuk mengambil semua transaksi dengan filter ...
// GET = mengambil data; endpoint untuk mengambil semua transaksi dengan filter opsional
  try { // try = mencoba proses aman; error akan ditangkap oleh catch
  // try = mencoba proses aman; error akan ditangkap oleh catch
    const { limit = 20, offset = 0, userId, status } = req.query; // req.query = query URL; mengambil limit, offset, userId, status dari parameter...
    // req.query = query URL; mengambil limit, offset, userId, status dari parameter URL

    const where = {}; // const = variabel tetap; objek filter WHERE yang akan dibangun secara dinamis
    // const = variabel tetap; objek filter WHERE yang akan dibangun secara dinamis
    if (userId) { // if = pengecekan kondisi; berjalan jika filter userId disertakan dalam request
    // if = pengecekan kondisi; berjalan jika filter userId disertakan dalam request
      const uid = parseInt(String(userId), 10); // parseInt = mengubah nilai menjadi angka bulat; mengubah userId string ke integer
      // parseInt = mengubah nilai menjadi angka bulat; mengubah userId string ke integer
      if (!Number.isNaN(uid)) { // if = pengecekan kondisi; berjalan jika konversi berhasil (bukan NaN)
      // if = pengecekan kondisi; berjalan jika konversi berhasil (bukan NaN)
        where.OR = [{ senderId: uid }, { receiverId: uid }]; // where = kondisi query; OR memfilter transaksi di mana user sebagai pengirim A...
        // where = kondisi query; OR memfilter transaksi di mana user sebagai pengirim ATAU penerima
      }
    }
    if (status) where.status = status; // if = pengecekan kondisi; tambahkan filter status ke WHERE jika disertakan
    // if = pengecekan kondisi; tambahkan filter status ke WHERE jika disertakan

    const transactions = await prisma.transaction.findMany({ // await = menunggu proses selesai; findMany = mengambil banyak transaksi dari d...
    // await = menunggu proses selesai; findMany = mengambil banyak transaksi dari database
      where, // Gunakan filter dinamis yang dibangun di atas
      // Gunakan filter dinamis yang dibangun di atas
      include: {
        sender: { select: { id: true, name: true, username: true } }, // Include data sender (hanya field yang diperlukan)
        // Include data sender (hanya field yang diperlukan)
        receiver: { select: { id: true, name: true, username: true } }, // Include data receiver
        // Include data receiver
      },
      orderBy: { createdAt: 'desc' }, // orderBy = mengurutkan data dari yang terbaru
      // orderBy = mengurutkan data dari yang terbaru
      take: parseInt(String(limit), 10), // take = membatasi jumlah data yang diambil
      // take = membatasi jumlah data yang diambil
      skip: parseInt(String(offset), 10), // skip = melewati data tertentu untuk pagination
      // skip = melewati data tertentu untuk pagination
    });

    res.json(transactions); // res.json = mengirim response JSON berisi array transaksi ke client
    // res.json = mengirim response JSON berisi array transaksi ke client
  } catch (error) { // catch = menangkap error; mencegah server crash
  // catch = menangkap error; mencegah server crash
    console.error('\u274c Kesalahan mendapatkan transaksi:', error); // console.error = menampilkan error ke terminal untuk debugging
    // console.error = menampilkan error ke terminal untuk debugging
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' }); // 500 = error server; mengirim response gagal ke client
    // 500 = error server; mengirim response gagal ke client
  }
});

// --------------------------------------------------------------------------
// DAPATKAN TRANSAKSI BERDASARKAN ID PENGGUNA
// --------------------------------------------------------------------------
router.get('/user/:userId', async (req, res) => { // GET = mengambil data; endpoint untuk mengambil transaksi milik satu user tert...
// GET = mengambil data; endpoint untuk mengambil transaksi milik satu user tertentu
  try { // try = mencoba proses aman; error akan ditangkap oleh catch
  // try = mencoba proses aman; error akan ditangkap oleh catch
    const userId = parseInt(req.params.userId, 10); // req.params = parameter URL; parseInt mengubah userId string ke integer
    // req.params = parameter URL; parseInt mengubah userId string ke integer
    if (isNaN(userId)) { // if = pengecekan kondisi; berjalan jika userId bukan angka valid
    // if = pengecekan kondisi; berjalan jika userId bukan angka valid
      return res.status(400).json({ error: 'ID pengguna tidak valid' }); // return = menghentikan fungsi; 400 = request salah; userId tidak valid
      // return = menghentikan fungsi; 400 = request salah; userId tidak valid
    }

    const { limit = 20, offset = 0, status } = req.query; // Ambil query params untuk pagination dan filter
    // Ambil query params untuk pagination dan filter

    const where = { // Bangun filter WHERE: cari transaksi sebagai sender ATAU receiver
      // Bangun filter WHERE: cari transaksi sebagai sender ATAU receiver
      OR: [
        { senderId: userId }, // User sebagai pengirim uang
        // User sebagai pengirim uang
        { receiverId: userId } // User sebagai penerima uang
        // User sebagai penerima uang
      ]
    };
    
    if (status) where.status = status; // Tambahkan filter status jika disertakan
    // Tambahkan filter status jika disertakan

    const transactions = await prisma.transaction.findMany({ // Query transaksi user dari database
      // Query transaksi user dari database
      where, // Gunakan filter yang sudah dibangun
      // Gunakan filter yang sudah dibangun
      include: {
        sender: { // Sertakan data pengirim
          // Sertakan data pengirim
          select: { id: true, name: true, username: true } // Hanya ambil field yang aman (tanpa password)
          // Hanya ambil field yang aman (tanpa password)
        },
        receiver: { // Sertakan data penerima
          // Sertakan data penerima
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }, // Terbaru di atas
      // Terbaru di atas
      take: parseInt(String(limit), 10), // Limit jumlah hasil
      // Limit jumlah hasil
      skip: parseInt(String(offset), 10), // Offset untuk pagination
      // Offset untuk pagination
    });

    // Tambahkan info tipe transaksi (terkirim/diterima) untuk pengguna yang meminta
    const transactionsWithType = transactions.map(transaction => ({ // Transform setiap transaksi
      // Transform setiap transaksi
      ...transaction, // Salin semua field asli
      // Salin semua field asli
      transactionType: transaction.senderId === userId ? 'sent' : 'received' // Tentukan apakah dikirim atau diterima
      // Tentukan apakah dikirim atau diterima
    }));

    res.json(transactionsWithType); // Kirim hasil dengan field transactionType tambahan
    // Kirim hasil dengan field transactionType tambahan
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi pengguna:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi pengguna' });
  }
});

// --------------------------------------------------------------------------
// STATISTIK TRANSAKSI (TEMPATKAN SEBELUM /:id)
// --------------------------------------------------------------------------
router.get('/stats/summary', async (req, res) => { // GET /stats/summary → ringkasan statistik transaksi
  // GET /stats/summary → ringkasan statistik transaksi
  try {
    const { userId, period = '7d' } = req.query; // Ambil filter userId dan period (default 7 hari)
    // Ambil filter userId dan period (default 7 hari)
    const now = new Date(); // Waktu sekarang sebagai acuan perhitungan periode
    // Waktu sekarang sebagai acuan perhitungan periode
    let from; // Akan diisi batas waktu awal periode
    // Akan diisi batas waktu awal periode

    if (period === '1d') from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 jam = 86.400.000 ms
    // 24 jam = 86.400.000 ms
    else if (period === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 hari
    // 30 hari
    else from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 hari terakhir
    // Default: 7 hari terakhir

    const where = { createdAt: { gte: from } }; // Filter: hanya transaksi yang dibuat setelah 'from'
    // Filter: hanya transaksi yang dibuat setelah 'from'

    if (userId) { // Jika filter userId disertakan
      // Jika filter userId disertakan
      const uid = parseInt(String(userId), 10); // Konversi ke integer
      // Konversi ke integer
      if (!Number.isNaN(uid)) where.OR = [{ senderId: uid }, { receiverId: uid }]; // Filter: sender atau receiver
      // Filter: sender atau receiver
    }

    const [count, sum, avg] = await Promise.all([ // Jalankan 3 query paralel sekaligus (lebih cepat)
    // Jalankan 3 query paralel sekaligus (lebih cepat)
      prisma.transaction.count({ where }), // Query 1: hitung jumlah transaksi
      // Query 1: hitung jumlah transaksi
      prisma.transaction.aggregate({ where, _sum: { amount: true } }), // Query 2: jumlahkan total amount
      // Query 2: jumlahkan total amount
      prisma.transaction.aggregate({ where, _avg: { amount: true } }), // Query 3: hitung rata-rata amount
      // Query 3: hitung rata-rata amount
    ]);

    res.json({ // Kirim statistik sebagai response
      // Kirim statistik sebagai response
      period, // Periode yang digunakan (1d/7d/30d)
      // Periode yang digunakan (1d/7d/30d)
      totalTransactions: count, // Jumlah transaksi dalam periode
      // Jumlah transaksi dalam periode
      totalAmount: sum._sum.amount || 0, // Total nilai semua transaksi (default 0 jika kosong)
      // Total nilai semua transaksi (default 0 jika kosong)
      averageAmount: avg._avg.amount || 0, // Rata-rata nilai per transaksi
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
  '/', // POST / → buat transaksi baru (transfer uang antar user)
  // POST / → buat transaksi baru (transfer uang antar user)
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Jumlah harus lebih dari 0'), // Validasi: amount harus float positif
    // Validasi: amount harus float positif
    body('receiverUsername').optional().isString(), // receiverUsername opsional, harus string jika ada
    // receiverUsername opsional, harus string jika ada
    body('receiverId').optional().isInt(), // receiverId opsional, harus integer jika ada
    // receiverId opsional, harus integer jika ada
    // catatan: senderId dari body tidak dipercaya, hanya fallback
    body('senderId').optional().isInt(), // senderId dari body hanya fallback (utama dari JWT token)
    // senderId dari body hanya fallback (utama dari JWT token)
    body('description').optional().isString(), // Deskripsi transaksi opsional
    // Deskripsi transaksi opsional
    body('deviceId').optional().isString(), // ID perangkat opsional untuk tracking
    // ID perangkat opsional untuk tracking
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req); // Cek hasil validasi express-validator
      // Cek hasil validasi express-validator
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() }); // Return error jika validasi gagal
      // Return error jika validasi gagal

      const {
        receiverUsername, // Username penerima (prioritas utama untuk identifikasi receiver)
        // Username penerima (prioritas utama untuk identifikasi receiver)
        receiverId, // ID penerima (fallback jika tidak ada username)
        // ID penerima (fallback jika tidak ada username)
        senderId: senderIdFromBody, // Sender dari body (tidak aman, hanya fallback)
        // Sender dari body (tidak aman, hanya fallback)
        amount, // Jumlah transfer dalam Rupiah
        // Jumlah transfer dalam Rupiah
        description, // Catatan/deskripsi transaksi
        // Catatan/deskripsi transaksi
        deviceId, // ID perangkat Android pengirim
        // ID perangkat Android pengirim
      } = req.body;

      // Ambil sender dari token (authenticateToken), kalau tidak ada baru fallback body
      const senderId = req.user?.id ?? senderIdFromBody; // Prioritas: token > body
      // Prioritas: token > body
      if (!senderId) return res.status(401).json({ error: 'Pengirim tidak terautentikasi' }); // Wajib ada sender
      // Wajib ada sender

      const amountNum = Number(amount); // Konversi amount ke number
      // Konversi amount ke number
      if (!Number.isFinite(amountNum) || amountNum <= 0) { // Validasi: harus angka terhingga dan positif
        // Validasi: harus angka terhingga dan positif
        return res.status(400).json({ error: 'Invalid amount' }); // Tolak jika tidak valid
        // Tolak jika tidak valid
      }

      // Cari receiver (username lebih diutamakan)
      let receiver = null; // Akan diisi dengan data user penerima
      // Akan diisi dengan data user penerima
      if (receiverUsername) { // Mode 1: cari berdasarkan username
        // Mode 1: cari berdasarkan username
        receiver = await prisma.user.findUnique({ where: { username: receiverUsername } }); // Query by username
        // Query by username
      } else if (receiverId) { // Mode 2: cari berdasarkan ID
        // Mode 2: cari berdasarkan ID
        receiver = await prisma.user.findUnique({ where: { id: Number(receiverId) } }); // Query by ID
        // Query by ID
      }
      if (!receiver) return res.status(404).json({ error: 'Receiver not found' }); // Penerima tidak ditemukan
      // Penerima tidak ditemukan
      if (receiver.id === Number(senderId)) return res.status(400).json({ error: 'Cannot send money to yourself' }); // Tidak bisa transfer ke diri sendiri
      // Tidak bisa transfer ke diri sendiri

      // Cek awal saldo sender (untuk early reject sebelum fraud check — bukan pengganti cek atomik)
      const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } }); // Ambil data sender dari DB
      // Ambil data sender dari DB
      if (!sender) return res.status(404).json({ error: 'Sender not found' }); // Sender tidak ditemukan
      // Sender tidak ditemukan
      if (sender.balance < amountNum) { // Cek cepat — saldo akan dicek ulang secara atomik di dalam $transaction
        // Cek cepat — saldo akan dicek ulang secara atomik di dalam $transaction
        return res.status(400).json({ error: 'Insufficient balance' }); // Return 400 jika saldo kurang
        // Return 400 jika saldo kurang
      }

      // ======================================================================
      // DETEKSI FRAUD: Z-Score Based Anomaly Detection
      // Ambil 20 transaksi historis terakhir pengguna sebagai baseline
      // Transaksi baru (amountNum) adalah X = transaksi ke-21
      // ======================================================================
      const historicalTxs = await prisma.transaction.findMany({ // await = menunggu proses selesai; findMany = mengambil 20 transaksi historis s...
      // await = menunggu proses selesai; findMany = mengambil 20 transaksi historis sebagai baseline Z-Score
        where: { senderId: Number(senderId), status: 'completed' }, // where = kondisi query; hanya ambil transaksi completed milik sender sebagai b...
        // where = kondisi query; hanya ambil transaksi completed milik sender sebagai baseline
        select: { amount: true, createdAt: true }, // select = memilih field tertentu; hanya amount dan createdAt yang diperlukan u...
        // select = memilih field tertentu; hanya amount dan createdAt yang diperlukan untuk Z-Score
        orderBy: { createdAt: 'desc' }, // Terbaru di atas (paling relevan untuk baseline)
        // Terbaru di atas (paling relevan untuk baseline)
        take: HISTORY_SIZE, // take = membatasi jumlah data; HISTORY_SIZE = 20 transaksi historis untuk base...
        // take = membatasi jumlah data; HISTORY_SIZE = 20 transaksi historis untuk baseline Z-Score
      });

      const fraudResult = analyzeZScoreAnomaly(amountNum, historicalTxs); // analyzeZScoreAnomaly = menghitung risiko transaksi dengan Z-Score; mengembali...
      // analyzeZScoreAnomaly = menghitung risiko transaksi dengan Z-Score; mengembalikan zScore, decision, mean, stdDev
      const zScoreLevel = (fraudResult.zScore === null) // const = variabel tetap; zScoreLevel = tingkat risiko hasil deteksi fraud berd...
      // const = variabel tetap; zScoreLevel = tingkat risiko hasil deteksi fraud berdasarkan Z-Score
        ? 'ANOMALY' // ANOMALY = transaksi anomali tinggi; terjadi saat sigma=0 dan amount berbeda d...
        // ANOMALY = transaksi anomali tinggi; terjadi saat sigma=0 dan amount berbeda dari rata-rata
        : (fraudResult.zScore <= 2 ? 'NORMAL' : fraudResult.zScore <= 3 ? 'SUSPICIOUS' : 'ANOMALY'); // NORMAL = Z≤2; SUSPICIOUS = 2<Z≤3; ANOMALY = Z>3 berdasarkan Three-Sigma Rule
        // NORMAL = Z≤2; SUSPICIOUS = 2<Z≤3; ANOMALY = Z>3 berdasarkan Three-Sigma Rule

      // BLOCK: Tolak transaksi, catat sebagai percobaan fraud
      if (fraudResult.decision === 'BLOCK') { // if = pengecekan kondisi; BLOCK = transaksi anomali tinggi dan ditolak (Z > 3)
      // if = pengecekan kondisi; BLOCK = transaksi anomali tinggi dan ditolak (Z > 3)
        await prisma.fraudAlert.create({ // await = menunggu proses selesai; create = membuat data fraud alert baru di da...
        // await = menunggu proses selesai; create = membuat data fraud alert baru di database
          data: {
            userId: Number(senderId), // User yang melakukan transaksi mencurigakan
            // User yang melakukan transaksi mencurigakan
            deviceId: deviceId || 'unknown', // Device yang digunakan
            // Device yang digunakan
            deviceName: 'Mobile App', // Nama perangkat
            // Nama perangkat
            // zScore null = edge case sigma=0 (Z tidak terdefinisi). Simpan -1 sebagai sentinel.
            riskScore: fraudResult.zScore ?? -1, // Z-Score atau -1 jika tidak terdefinisi
            // Z-Score atau -1 jika tidak terdefinisi
            riskLevel: 'ANOMALY', // Level risiko tertinggi untuk BLOCK
            // Level risiko tertinggi untuk BLOCK
            decision: 'BLOCK', // Keputusan: blokir
            // Keputusan: blokir
            reasons: JSON.stringify(fraudResult.reasons), // Alasan dalam JSON string
            // Alasan dalam JSON string
            confidence: 0.997, // 99.7% confidence (3-sigma rule)
            // 99.7% confidence (3-sigma rule)
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore, // Nilai Z
              // Nilai Z
              mean: fraudResult.mean, // Rata-rata historis
              // Rata-rata historis
              stdDev: fraudResult.stdDev, // Standar deviasi
              // Standar deviasi
              variance: fraudResult.variance, // Varians
              // Varians
              n: fraudResult.n, // Jumlah data historis
              // Jumlah data historis
              currentAmount: amountNum, // Amount yang diblokir
              // Amount yang diblokir
              algorithm: 'Z-Score Based Anomaly Detection', // Nama algoritma
              // Nama algoritma
              thresholds: { allow: 2, review: 3 } // Threshold Z-Score
              // Threshold Z-Score
            }),
            ipAddress: req.ip, // IP address pengirim
            // IP address pengirim
            userAgent: req.headers['user-agent'], // Browser/app info
            // Browser/app info
          },
        });
        return res.status(403).json({ // return = menghentikan fungsi; 403 = akses ditolak; transaksi anomali tidak da...
        // return = menghentikan fungsi; 403 = akses ditolak; transaksi anomali tidak dapat diproses
          error: 'Transaksi diblokir \u2013 anomali terdeteksi (Z-Score > 3)',
          zScore: fraudResult.zScore, // Nilai Z untuk informasi user
          // Nilai Z untuk informasi user
          riskLevel: 'ANOMALY', // Level risiko
          // Level risiko
          decision: 'BLOCK', // Keputusan sistem
          // Keputusan sistem
          reasons: fraudResult.reasons, // Penjelasan alasan pemblokiran
          // Penjelasan alasan pemblokiran
          mean: fraudResult.mean, // Rata-rata historis (untuk konteks)
          // Rata-rata historis (untuk konteks)
          stdDev: fraudResult.stdDev, // Standar deviasi historis
          // Standar deviasi historis
          historyCount: fraudResult.n // Jumlah data yang dipakai
          // Jumlah data yang dipakai
        });
      }

      // ALLOW / REVIEW: Proses transaksi, perbarui saldo
      const transaction = await prisma.$transaction(async (tx) => { // $transaction = menjalankan beberapa query satu paket agar data konsisten; rol...
      // $transaction = menjalankan beberapa query satu paket agar data konsisten; rollback otomatis jika ada error
        // hanya satu yang berhasil karena updateMany dengan WHERE balance >= amount.
        const deducted = await tx.user.updateMany({ // await = menunggu proses selesai; updateMany = memperbarui saldo sender secara...
        // await = menunggu proses selesai; updateMany = memperbarui saldo sender secara atomik
          where: { id: Number(senderId), balance: { gte: amountNum } }, // where = kondisi query; hanya kurangi saldo jika saldo >= amount (cek atomik)
          // where = kondisi query; hanya kurangi saldo jika saldo >= amount (cek atomik)
          data: { balance: { decrement: amountNum } }, // data = nilai yang diperbarui; decrement mengurangi saldo secara atomik
          // data = nilai yang diperbarui; decrement mengurangi saldo secara atomik
        });
        if (deducted.count === 0) { // if = pengecekan kondisi; count = 0 berarti saldo tidak cukup atau kondisi WHE...
        // if = pengecekan kondisi; count = 0 berarti saldo tidak cukup atau kondisi WHERE tidak terpenuhi
          throw new Error('INSUFFICIENT_BALANCE'); // throw new Error = membuat error; memicu rollback seluruh $transaction agar da...
          // throw new Error = membuat error; memicu rollback seluruh $transaction agar data konsisten
        }

        await tx.user.update({ // await = menunggu proses selesai; update = memperbarui saldo receiver secara a...
        // await = menunggu proses selesai; update = memperbarui saldo receiver secara atomik
          where: { id: receiver.id }, // WHERE id = receiver.id — identifikasi receiver berdasarkan ID
          // WHERE id = receiver.id — identifikasi receiver berdasarkan ID
          data: { balance: { increment: amountNum } }, // data = nilai yang diperbarui; increment menambah saldo receiver secara atomik
          // data = nilai yang diperbarui; increment menambah saldo receiver secara atomik
        });

        const created = await tx.transaction.create({ // await = menunggu proses selesai; create = membuat data transaksi baru di data...
        // await = menunggu proses selesai; create = membuat data transaksi baru di database
          data: {
            senderId: Number(senderId), // Number() mengkonversi nilai ke tipe number untuk memastikan tipe data benar
            // Number() mengkonversi nilai ke tipe number untuk memastikan tipe data benar
            receiverId: receiver.id, // ID user penerima
            // ID user penerima
            amount: amountNum, // jumlah transfer dalam Rupiah
            // jumlah transfer dalam Rupiah
            description, // shorthand ES6: description: description — catatan transaksi opsional
            // shorthand ES6: description: description — catatan transaksi opsional
            deviceId, // shorthand ES6: deviceId: deviceId — ID perangkat Android
            // shorthand ES6: deviceId: deviceId — ID perangkat Android
            fraudRiskScore: fraudResult.zScore ?? null, // ?? adalah nullish coalescing: jika zScore null/undefined gunakan null; Float?...
            // ?? adalah nullish coalescing: jika zScore null/undefined gunakan null; Float? di schema Prisma — kolom nullable
            fraudRiskLevel: zScoreLevel, // level risiko: NORMAL/SUSPICIOUS/ANOMALY
            // level risiko: NORMAL/SUSPICIOUS/ANOMALY
            fraudReasons: JSON.stringify(fraudResult.reasons), // JSON.stringify = mengubah object menjadi teks JSON untuk disimpan di kolom da...
            // JSON.stringify = mengubah object menjadi teks JSON untuk disimpan di kolom database
            ipAddress: req.ip, // IP address client untuk audit keamanan
            // IP address client untuk audit keamanan
          },
          include: {
            sender: { // include melakukan JOIN ke tabel User untuk data sender
              // include melakukan JOIN ke tabel User untuk data sender
              select: { id: true, name: true, username: true, balance: true, deviceId: true }, // SELECT hanya field yang diperlukan (hindari password)
              // SELECT hanya field yang diperlukan (hindari password)
            },
            receiver: { // include melakukan JOIN ke tabel User untuk data receiver
              // include melakukan JOIN ke tabel User untuk data receiver
              select: { id: true, name: true, username: true, balance: true, deviceId: true },
            },
          },
        });

        return created; // Return transaksi yang dibuat untuk digunakan di luar blok
        // Return transaksi yang dibuat untuk digunakan di luar blok
      });

      // REVIEW: Buat fraud alert untuk admin
      if (fraudResult.decision === 'REVIEW') { // if = pengecekan kondisi; REVIEW = transaksi mencurigakan dan dicatat sebagai ...
      // if = pengecekan kondisi; REVIEW = transaksi mencurigakan dan dicatat sebagai fraud alert
        await prisma.fraudAlert.create({ // await = menunggu proses selesai; create = membuat data fraud alert untuk diti...
        // await = menunggu proses selesai; create = membuat data fraud alert untuk ditinjau admin
          data: {
            userId: Number(senderId), // User yang melakukan transaksi mencurigakan
            // User yang melakukan transaksi mencurigakan
            transactionId: transaction.id, // Link ke transaksi yang baru dibuat
            // Link ke transaksi yang baru dibuat
            deviceId: deviceId || 'unknown', // ID perangkat
            // ID perangkat
            deviceName: 'Mobile App', // Nama perangkat
            // Nama perangkat
            riskScore: fraudResult.zScore ?? -1, // -1 = sentinel: Z tidak terdefinisi (\u03c3=0)
            // -1 = sentinel: Z tidak terdefinisi (\u03c3=0)
            riskLevel: 'SUSPICIOUS', // Level: mencurigakan (bukan anomali penuh)
            // Level: mencurigakan (bukan anomali penuh)
            decision: 'REVIEW', // Keputusan: perlu ditinjau admin
            // Keputusan: perlu ditinjau admin
            reasons: JSON.stringify(fraudResult.reasons), // Alasan
            // Alasan
            confidence: 0.95, // 95% confidence (2-sigma rule)
            // 95% confidence (2-sigma rule)
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore, // Nilai Z
              // Nilai Z
              mean: fraudResult.mean, // Rata-rata
              // Rata-rata
              stdDev: fraudResult.stdDev, // Standar deviasi
              // Standar deviasi
              variance: fraudResult.variance, // Varians
              // Varians
              n: fraudResult.n, // Jumlah data historis
              // Jumlah data historis
              currentAmount: amountNum, // Amount transaksi
              // Amount transaksi
              algorithm: 'Z-Score Based Anomaly Detection', // Algoritma
              // Algoritma
              thresholds: { allow: 2, review: 3 } // Threshold
              // Threshold
            }),
            ipAddress: req.ip, // IP address
            // IP address
            userAgent: req.headers['user-agent'], // Info browser/app
            // Info browser/app
          },
        });
      }

      // Emit realtime
      if (req.io) { // if = pengecekan kondisi; berjalan jika Socket.IO tersedia untuk kirim notifik...
      // if = pengecekan kondisi; berjalan jika Socket.IO tersedia untuk kirim notifikasi real-time
        req.io.to('admin-room').emit('new-transaction', { transaction, fraudResult }); // emit = mengirim event real-time ke dashboard admin berisi data transaksi dan ...
        // emit = mengirim event real-time ke dashboard admin berisi data transaksi dan hasil fraud detection
        if (transaction.sender?.deviceId) { // ?. adalah optional chaining — mencegah error jika sender null; mengecek apaka...
          // ?. adalah optional chaining — mencegah error jika sender null; mengecek apakah sender punya deviceId
          req.io.to(`device-${transaction.sender.deviceId}`).emit('balance-updated', { // template literal backtick untuk membuat room name dinamis: device-XXXX; .emit...
            // template literal backtick untuk membuat room name dinamis: device-XXXX; .emit mengirim event update saldo
            balance: transaction.sender.balance, // saldo sender setelah dikurangi (sudah diupdate dalam $transaction)
            // saldo sender setelah dikurangi (sudah diupdate dalam $transaction)
          });
        }
        if (transaction.receiver?.deviceId) { // ?. mencegah error jika receiver null; mengecek deviceId receiver
          // ?. mencegah error jika receiver null; mengecek deviceId receiver
          req.io.to(`device-${transaction.receiver.deviceId}`).emit('balance-updated', { // kirim event update saldo ke device receiver
            // kirim event update saldo ke device receiver
            balance: transaction.receiver.balance, // saldo receiver setelah ditambah (sudah diupdate dalam $transaction)
            // saldo receiver setelah ditambah (sudah diupdate dalam $transaction)
          });
        }
      }

      res.status(201).json({ // return = mengembalikan hasil; 201 = data berhasil dibuat; mengirim hasil tran...
      // return = mengembalikan hasil; 201 = data berhasil dibuat; mengirim hasil transaksi ke client
        success: true, // success = status berhasil; memberi tahu client proses sukses
        // success = status berhasil; memberi tahu client proses sukses
        message: 'Transaksi berhasil diselesaikan', // pesan konfirmasi yang ditampilkan ke user
        // pesan konfirmasi yang ditampilkan ke user
        transaction, // shorthand ES6: mengirim data transaksi lengkap (include sender & receiver)
        // shorthand ES6: mengirim data transaksi lengkap (include sender & receiver)
        fraudResult, // shorthand ES6: mengirim hasil analisis Z-Score untuk ditampilkan di receipt t...
        // shorthand ES6: mengirim hasil analisis Z-Score untuk ditampilkan di receipt transaksi
      });
    } catch (error) {
      console.error('\u274c Kesalahan membuat transaksi:', error); // Tangani error INSUFFICIENT_BALANCE yang dilempar dari dalam $transaction (rac...
      // Tangani error INSUFFICIENT_BALANCE yang dilempar dari dalam $transaction (race condition)
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      res.status(500).json({ error: 'Gagal membuat transaksi' }); // Return 500 ke client
      // Return 500 ke client
    }
  }
);

// --------------------------------------------------------------------------
// DAPATKAN TRANSAKSI BERDASARKAN ID
// --------------------------------------------------------------------------
router.get('/:id', async (req, res) => { // GET /:id → ambil detail transaksi berdasarkan ID
  // GET /:id → ambil detail transaksi berdasarkan ID
  try {
    const id = parseInt(String(req.params.id), 10); // Konversi ID dari URL param ke integer
    // Konversi ID dari URL param ke integer
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' }); // Validasi: harus angka valid
    // Validasi: harus angka valid

    const transaction = await prisma.transaction.findUnique({ // Cari transaksi berdasarkan ID unik
      // Cari transaksi berdasarkan ID unik
      where: { id }, // Filter: id harus sama
      // Filter: id harus sama
      include: {
        sender: { select: { id: true, name: true, username: true } }, // Include data sender
        // Include data sender
        receiver: { select: { id: true, name: true, username: true } }, // Include data receiver
        // Include data receiver
      },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' }); // Return 404 jika tidak ditemukan
    // Return 404 jika tidak ditemukan
    res.json(transaction); // Return detail transaksi
    // Return detail transaksi
  } catch (error) {
    console.error('\u274c Kesalahan mendapatkan transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' });
  }
});

module.exports = router; // module.exports = mengekspor router agar dipakai server utama di server.js
// module.exports = mengekspor router agar dipakai server utama di server.js
