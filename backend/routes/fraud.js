// ============================================================
// FRAUD.JS - ROUTES UNTUK DETEKSI & MANAJEMEN FRAUD
// ============================================================
// File ini menangani semua operasi terkait fraud detection (pendeteksian penipuan)
//
// ⚠️  CATATAN PENTING - PERAN FILE INI:
// File ini adalah ROUTER LAYER (pengatur rute/endpoint HTTP).
// File ini TIDAK melakukan perhitungan Z-Score secara langsung.
// Perhitungan Z-Score yang sebenarnya ada di: utils/fraudDetection.js
// File ini hanya: menerima request → ambil data → panggil fungsi perhitungan → kirim response
//
// ENDPOINT:
// - GET  /api/fraud/alerts          → Ambil semua peringatan fraud (dengan filter & pagination)
// - POST /api/fraud/alert           → Buat peringatan fraud baru (dikirim dari mobile app)
// - PUT  /api/fraud/alerts/:id/status → Update status fraud alert (NEW/REVIEWED/RESOLVED)
// - GET  /api/fraud/stats           → Statistik fraud (total alerts, risk breakdown, dll)
// - POST /api/fraud/analyze         → Analisa risiko transaksi secara manual (admin)
// - POST /api/fraud/check           → Alias /analyze, dipakai oleh mobile app
//
// ============================================================
// 📐 KONSEP Z-SCORE ANOMALY DETECTION (PENJELASAN LENGKAP)
// ============================================================
//
// RUMUS UTAMA:
//   Z = |X - μ| / σ
//
//   Keterangan:
//   - X  = nilai transaksi yang sedang dianalisa (amount baru)
//   - μ  = mean (rata-rata) dari 20 transaksi historis user
//   - σ  = standard deviation (simpangan baku) dari 20 transaksi historis
//   - |.| = nilai absolut (selalu positif)
//
// CONTOH PERHITUNGAN:
//   Misalnya user biasanya transaksi: Rp 10.000, Rp 12.000, Rp 11.000, Rp 9.000, ...
//   μ (mean)     = Rp 10.500
//   σ (std dev)  = Rp 1.200
//
//   Transaksi baru = Rp 50.000
//   Z = |50.000 - 10.500| / 1.200 = 39.500 / 1.200 = 32.9 → ANOMALY (sangat mencurigakan)
//
//   Transaksi baru = Rp 13.000
//   Z = |13.000 - 10.500| / 1.200 = 2.500 / 1.200 = 2.08 → SUSPICIOUS (agak mencurigakan)
//
//   Transaksi baru = Rp 11.500
//   Z = |11.500 - 10.500| / 1.200 = 1.000 / 1.200 = 0.83 → NORMAL (wajar)
//
// KLASIFIKASI HASIL Z-SCORE:
//   Z ≤ 2.0          → NORMAL    → Decision: ALLOW  (transaksi diizinkan)
//   2.0 < Z ≤ 3.0    → SUSPICIOUS → Decision: REVIEW (perlu ditinjau admin)
//   Z > 3.0           → ANOMALY   → Decision: BLOCK  (transaksi diblokir)
//
// EDGE CASES (kasus khusus):
//   1. Riwayat < 2 transaksi:
//      - Tidak cukup data untuk hitung Z-Score
//      - Hasil: NORMAL (ALLOW) karena belum ada pola yang bisa dibandingkan
//
//   2. σ = 0 (semua transaksi historis jumlahnya sama persis):
//      - Jika X = μ (transaksi baru sama dengan rata-rata) → Z = 0 → NORMAL
//      - Jika X ≠ μ (berbeda meski sedikit) → Z = -1 (sentinel/penanda khusus) → BLOCK
//        Alasan: distribusi terdegenerasi, penyimpangan sekecil apapun dianggap anomali
//
// SUMBER DATA HISTORIS:
//   - Diambil 20 transaksi terakhir user dengan status 'completed'
//   - Semakin banyak data historis, semakin akurat deteksi fraud
// ============================================================
//
// FLOW LENGKAP FRAUD DETECTION:
//
//  [Mobile App]
//      │
//      ├─ Sebelum transaksi: POST /api/fraud/check
//      │    └─ Cek apakah amount mencurigakan
//      │
//      ├─ Jika SUSPICIOUS/ANOMALY: POST /api/fraud/alert
//      │    └─ Simpan alert ke database
//      │
//      └─ Admin Dashboard: GET /api/fraud/alerts
//           └─ Admin review dan tindak lanjut
//
// ============================================================

const express = require('express'); // const membuat variabel tetap; require('express') memanggil module Express.js dari node_modules; digunakan untuk membuat router endpoint fraud
const { PrismaClient } = require('@prisma/client'); // destructuring { PrismaClient } dari module Prisma; PrismaClient adalah kelas ORM yang menyediakan akses type-safe ke database SQLite
const { analyzeZScoreAnomaly } = require('../utils/fraudDetection'); // destructuring { analyzeZScoreAnomaly } dari file lokal fraudDetection.js — mengambil fungsi utama perhitungan Z-Score yang akan dipanggil di endpoint /analyze dan /check

const router = express.Router(); // const membuat variabel tetap; express.Router() membuat instance router baru untuk menampung semua endpoint /api/fraud
const prisma = new PrismaClient(); // const membuat variabel tetap; new PrismaClient() membuat instance Prisma baru untuk koneksi ke database

// ============================================================
// ENDPOINT 1: GET /alerts - AMBIL SEMUA PERINGATAN FRAUD
// ============================================================
// Endpoint untuk admin melihat daftar fraud alerts dari database.
// Data diambil dari tabel FraudAlert (Prisma ORM).
//
// QUERY PARAMETERS (opsional, bisa dikombinasi):
// - limit    : jumlah data per halaman (default: 50, maks disarankan: 100)
// - offset   : skip N data pertama (untuk pagination halaman ke-2, ke-3, dst)
// - status   : filter by status → NEW | REVIEWED | RESOLVED
//              NEW      = alert baru, belum ditangani admin
//              REVIEWED = sudah dilihat admin, belum selesai
//              RESOLVED = sudah diselesaikan
// - riskLevel: filter by tingkat risiko → NORMAL | SUSPICIOUS | ANOMALY
//
// CONTOH REQUEST:
//   GET /api/fraud/alerts                         → semua alert, 50 terbaru
//   GET /api/fraud/alerts?limit=20&offset=20      → halaman 2 (data ke 21-40)
//   GET /api/fraud/alerts?status=NEW              → hanya alert baru
//   GET /api/fraud/alerts?riskLevel=ANOMALY       → hanya yang anomali
//   GET /api/fraud/alerts?status=NEW&riskLevel=SUSPICIOUS → kombinasi filter
//
// RESPONSE FORMAT (array of objects):
// [
//   {
//     "id": 1,                           → ID alert di database
//     "userId": 5,                        → ID user yang bertransaksi
//     "riskScore": 2.6333,               → Nilai Z-Score hasil perhitungan
//                                           (nilai -1 = σ=0 edge case)
//     "riskLevel": "SUSPICIOUS",         → NORMAL / SUSPICIOUS / ANOMALY
//     "decision": "REVIEW",              → ALLOW / REVIEW / BLOCK
//     "reasons": ["Transaksi mencurigakan (2 < Z ≤ 3)"],  → alasan array
//     "amount": 150000,                  → jumlah transaksi (Rupiah)
//     "userName": "John Doe",            → nama user (dari relasi)
//     "userEmail": "john123",            → username user (dari relasi)
//     "createdAt": "2025-01-20T10:00:00Z"
//   }
// ]
//
// CATATAN TEKNIS - NORMALISASI DATA:
// - Field `reasons` disimpan di DB sebagai JSON string → perlu di-parse
// - Field `riskFactors` disimpan di DB sebagai JSON string → perlu di-parse
// - Field `amount` tidak ada kolom tersendiri di DB, tapi disimpan
//   di dalam riskFactors JSON (key: "amount") → diekstrak saat response
// - Field `userName` dan `userEmail` di-flatten dari relasi user (JOIN)
// ============================================================
router.get('/alerts', async (req, res) => { // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // Ambil query parameters dengan nilai default jika tidak diberikan
    const { limit = 50, offset = 0, status, riskLevel } = req.query;
    
    // Bangun filter WHERE secara dinamis (hanya tambahkan jika parameter ada)
    const whereClause = {};
    if (status) whereClause.status = status;         // Filter by status jika ada
    if (riskLevel) whereClause.riskLevel = riskLevel; // Filter by risk level jika ada

    // Query ke database: ambil alert dengan relasi user dan urut dari terbaru
    const alerts = await prisma.fraudAlert.findMany({
      where: whereClause,
      include: {
        // JOIN ke tabel User: ambil hanya field yang diperlukan (bukan password dll)
        user: { // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: {
        createdAt: 'desc' // Terbaru di atas (descending)
      },
      take: parseInt(limit),  // Batasi jumlah data (LIMIT SQL)
      skip: parseInt(offset)  // Lewati N data pertama (OFFSET SQL, untuk pagination)
    });

    // ---------------------------------------------------------------
    // NORMALISASI RESPONSE
    // Mengubah format raw DB menjadi format yang mudah dibaca frontend
    // ---------------------------------------------------------------
    const normalized = alerts.map(alert => {
      let parsedReasons = [];     // Array alasan fraud (e.g. ["Z-Score tinggi", "..."])
      let parsedRiskFactors = {}; // Object detail faktor risiko (e.g. {mean, stdDev, amount})
      let amount = null;          // Jumlah transaksi yang akan diekstrak dari riskFactors

      // Parse reasons: DB menyimpan sebagai string JSON → ubah ke array JavaScript
      // Contoh DB: '["Transaksi mencurigakan"]' → ['Transaksi mencurigakan']
      try { parsedReasons = JSON.parse(alert.reasons); } catch { parsedReasons = [alert.reasons]; } // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan

      // Parse riskFactors: DB menyimpan sebagai string JSON → ubah ke object JavaScript
      // Contoh DB: '{"mean":10000,"stdDev":1200,"amount":50000}' → object
      try { parsedRiskFactors = JSON.parse(alert.riskFactors); } catch { parsedRiskFactors = {}; } // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan

      // Ekstrak amount dari riskFactors (tidak ada kolom amount tersendiri di DB)
      // Operator ?? = nullish coalescing: pakai null jika amount undefined/null
      amount = parsedRiskFactors.amount ?? null;

      return {
        ...alert,                                    // Semua field asli dari DB
        reasons: parsedReasons,                      // Override: dari string → array
        riskFactors: parsedRiskFactors,              // Override: dari string → object
        amount,                                      // Tambah field amount yang diekstrak
        userName: alert.user?.name || null,          // Flatten: dari relasi user.name
        userEmail: alert.user?.username || null      // Flatten: dari relasi user.username
      };
    });

    res.json(normalized); // Kirim response JSON ke client
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan peringatan fraud:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan peringatan fraud' });
  }
});

// ============================================================
// ENDPOINT 2: POST /alert - BUAT PERINGATAN FRAUD BARU
// ============================================================
// Endpoint ini dipanggil oleh MOBILE APP setelah deteksi fraud di sisi client.
//
// ALUR PEMANGGILAN:
//   1. User melakukan transaksi di mobile app
//   2. Mobile app hitung Z-Score secara lokal (atau via /check endpoint)
//   3. Jika hasil = SUSPICIOUS atau ANOMALY → mobile app POST ke sini
//   4. Alert disimpan ke database
//   5. Admin dashboard menerima notifikasi real-time (via Socket.IO)
//
// REQUEST BODY (JSON):
// {
//   "device": {
//     "deviceId": "android_abc123",      → ID unik perangkat Android
//     "deviceName": "Samsung Galaxy S21" → Nama perangkat
//   },
//   "fraudDetection": {
//     "userId": 5,                        → ID user yang bertransaksi
//     "transactionId": 42,               → ID transaksi terkait (opsional)
//     "riskScore": 3.75,                 → Nilai Z-Score (-1 untuk edge case σ=0)
//     "riskLevel": "ANOMALY",            → NORMAL / SUSPICIOUS / ANOMALY
//     "decision": "BLOCK",               → ALLOW / REVIEW / BLOCK
//     "reasons": ["Z > 3, transaksi jauh dari rata-rata"],  → array alasan
//     "confidence": 0.95,                → tingkat kepercayaan deteksi (0-1)
//     "riskFactors": {                   → detail statistik untuk audit
//       "mean": 10000,                   → rata-rata historis (μ)
//       "stdDev": 1200,                  → simpangan baku (σ)
//       "amount": 50000                  → jumlah transaksi yang diperiksa (X)
//     }
//   }
// }
//
// RESPONSE (sukses):
// { "success": true, "message": "...", "alertId": 101 }
//
// PENYIMPANAN KE DATABASE (tabel FraudAlert):
// - Semua field fraudDetection disimpan
// - reasons & riskFactors disimpan sebagai JSON string (bukan array/object)
// - ipAddress & userAgent diambil otomatis dari request header
//
// NOTIFIKASI REAL-TIME:
// - Menggunakan Socket.IO (req.io)
// - Emit event 'fraud-alert' ke room 'admin-room'
// - Admin dashboard langsung update tanpa refresh halaman
// ============================================================

// Buat peringatan fraud (dari aplikasi mobile)
router.post('/alert', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { device, fraudDetection } = req.body;
    
    // Validasi: pastikan data fraud ada
    if (!fraudDetection) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ error: 'Data deteksi fraud diperlukan' });
    }

    // Simpan alert ke database via Prisma ORM
    // reasons dan riskFactors di-stringify karena DB menyimpan sebagai text/JSON string
    const alert = await prisma.fraudAlert.create({
      data: {
        userId: fraudDetection.userId || null,              // null jika tidak ada user login
        transactionId: fraudDetection.transactionId || null, // null jika belum ada ID transaksi
        deviceId: device?.deviceId || 'unknown',   // ID perangkat Android (default 'unknown' jika tidak ada)
        deviceName: device?.deviceName || 'Unknown Device', // Nama perangkat (default jika tidak dikirim)
        riskScore: fraudDetection.riskScore,                // Nilai Z-Score (atau -1 untuk edge case)
        riskLevel: fraudDetection.riskLevel,                // NORMAL / SUSPICIOUS / ANOMALY
        decision: fraudDetection.decision,                  // ALLOW / REVIEW / BLOCK
        reasons: JSON.stringify(fraudDetection.reasons || []),          // Array → JSON string
        confidence: fraudDetection.confidence,              // Tingkat kepercayaan (0-1)
        riskFactors: JSON.stringify(fraudDetection.riskFactors || {}),  // Object → JSON string
        ipAddress: req.ip,                                  // IP perangkat yang kirim request
        userAgent: req.headers['user-agent']                // Info browser/app pengirim
      }
    });

    // Kirim notifikasi real-time ke admin dashboard via Socket.IO
    // req.io diset oleh server.js saat setup Socket.IO
    if (req.io) {
      req.io.to('admin-room').emit('fraud-alert', {
        alert: {
          ...alert,
          // Parse kembali ke array/object sebelum dikirim ke dashboard
          reasons: JSON.parse(alert.reasons), // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
          riskFactors: JSON.parse(alert.riskFactors) // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
        }
      });
    }

    // Log ke console untuk monitoring server
    console.log(`🚨 PERINGATAN FRAUD: risiko ${fraudDetection.riskLevel} (Z=${fraudDetection.riskScore}) dari perangkat ${device?.deviceId?.slice(-8) || 'unknown'}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    res.json({
      success: true,
      message: 'Peringatan fraud diterima dan disimpan',
      alertId: alert.id // Kembalikan ID alert yang baru dibuat
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan membuat peringatan fraud:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memproses peringatan fraud' });
  }
});

// ============================================================
// ENDPOINT 3: PUT /alerts/:id/status - UPDATE STATUS FRAUD ALERT
// ============================================================
// Endpoint untuk admin mengubah status penanganan fraud alert.
//
// ALUR PENGGUNAAN:
//   1. Admin buka dashboard → lihat daftar fraud alerts
//   2. Admin klik alert yang ingin ditangani
//   3. Admin pilih tindakan: REVIEWED atau RESOLVED
//   4. Dashboard kirim PUT request ke endpoint ini
//   5. Status diupdate di DB + dicatat di AdminLog
//
// URL PARAMETER:
//   :id → ID numerik dari fraud alert yang akan diupdate
//   Contoh: PUT /api/fraud/alerts/42/status
//
// REQUEST BODY:
// {
//   "status": "REVIEWED",        → Status baru: NEW | REVIEWED | RESOLVED
//   "adminPassword": "admin123"  → Password admin untuk verifikasi (keamanan)
// }
//
// STATUS LIFECYCLE:
//   NEW → REVIEWED → RESOLVED
//   NEW      = Alert baru masuk, belum ada yang menangani
//   REVIEWED = Admin sudah melihat dan sedang menangani
//   RESOLVED = Kasus selesai ditangani (diblokir/diizinkan manual)
//
// RESPONSE (sukses):
// { "message": "Peringatan fraud berhasil diperbarui", "alert": {...} }
//
// RESPONSE (error):
// 401 → Password admin salah
// 400 → Status tidak valid (selain NEW/REVIEWED/RESOLVED)
// 500 → Error database
//
// AUDIT TRAIL (AdminLog):
// Setiap perubahan status dicatat di tabel AdminLog dengan:
// - Action: 'FRAUD_ALERT_UPDATE'
// - Detail: alertId, newStatus, riskLevel
// - IP address admin
// - User agent browser admin
// ============================================================

// Perbarui status peringatan fraud
router.put('/alerts/:id/status', async (req, res) => { // router.put() mendaftarkan endpoint HTTP PUT; untuk memperbarui data yang sudah ada
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { id } = req.params;
    const { status, adminPassword } = req.body;

    // Verifikasi password admin sebelum izinkan perubahan
    // ADMIN_PASSWORD diambil dari environment variable (.env)
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) {
      return res.status(401).json({ error: 'Password admin tidak valid' });
    }

    // Validasi status harus salah satu dari enum yang valid
    if (!['NEW', 'REVIEWED', 'RESOLVED'].includes(status)) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    // Update status di database
    const alert = await prisma.fraudAlert.update({
      where: { id: parseInt(id) }, // Cari by ID (konversi string → integer)
      data: { status },            // Hanya update field status
      include: {
        user: { // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
          select: { id: true, name: true, username: true }
        }
      }
    });

    // Catat aksi admin ke tabel AdminLog (audit trail)
    // Berguna untuk tracking siapa yang mengubah apa dan kapan
    await prisma.adminLog.create({
      data: {
        action: 'FRAUD_ALERT_UPDATE',
        details: JSON.stringify({ // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          alertId: alert.id,
          newStatus: status,
          riskLevel: alert.riskLevel
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Kirim notifikasi real-time ke dashboard (agar tabel langsung update)
    if (req.io) {
      req.io.to('admin-room').emit('fraud-alert-updated', { alert });
    }

    res.json({
      message: 'Peringatan fraud berhasil diperbarui',
      alert
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan memperbarui peringatan fraud:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal memperbarui peringatan fraud' });
  }
});

// ============================================================
// ENDPOINT 4: GET /stats - STATISTIK FRAUD
// ============================================================
// Endpoint untuk menampilkan ringkasan statistik fraud di dashboard.
// Semua query dijalankan PARALEL (Promise.all) untuk efisiensi.
//
// QUERY PARAMETER:
//   period → Periode waktu: '1d' | '7d' | '30d' (default: '7d')
//   Contoh: GET /api/fraud/stats?period=30d
//
// RESPONSE:
// {
//   "period": "7d",
//   "totalAlerts": 25,               → Total fraud alert dalam periode
//   "blockedTransactions": 10,       → Jumlah transaksi yang diblokir (BLOCK)
//   "reviewTransactions": 8,         → Jumlah yang perlu ditinjau (REVIEW)
//   "riskLevelBreakdown": {          → Breakdown per level risiko
//     "NORMAL": 7,
//     "SUSPICIOUS": 8,
//     "ANOMALY": 10
//   },
//   "decisionBreakdown": {           → Breakdown per keputusan
//     "ALLOW": 7,
//     "REVIEW": 8,
//     "BLOCK": 10
//   },
//   "recentAlerts": [...],           → 5 alert terbaru (preview)
//   "lastAlert": "2025-01-20T10:00:00Z" → Waktu alert terakhir
// }
//
// OPTIMASI PERFORMA (Promise.all):
// 4 query database dijalankan BERSAMAAN (bukan satu per satu):
//   - Count total alerts
//   - Group by riskLevel
//   - Group by decision
//   - Ambil 10 alert terbaru
// Jika dijalankan serial: ~4x lebih lambat
// Dengan Promise.all: waktu = query terlama (bukan jumlah semua query)
// ============================================================

// Dapatkan statistik fraud
router.get('/stats', async (req, res) => { // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { period = '7d' } = req.query;
    
    // Hitung batas waktu berdasarkan period yang dipilih
    let dateFilter;
    const now = new Date(); // new Date() membuat objek tanggal JavaScript dari timestamp atau string; untuk format tanggal transaksi
    
    switch (period) {
      case '1d':
        // 24 jam terakhir (24 * 60 menit * 60 detik * 1000 ms)
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000); // new Date() membuat objek tanggal JavaScript dari timestamp atau string; untuk format tanggal transaksi
        break;
      case '7d':
        // 7 hari terakhir
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // new Date() membuat objek tanggal JavaScript dari timestamp atau string; untuk format tanggal transaksi
        break;
      case '30d':
        // 30 hari terakhir
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // new Date() membuat objek tanggal JavaScript dari timestamp atau string; untuk format tanggal transaksi
        break;
      default:
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // new Date() membuat objek tanggal JavaScript dari timestamp atau string; untuk format tanggal transaksi
    }

    // Jalankan 4 query database secara PARALEL (lebih cepat dari serial)
    const [totalAlerts, riskLevelStats, decisionStats, recentAlerts] = await Promise.all([
      
      // Query 1: Hitung total alert dalam periode
      prisma.fraudAlert.count({
        where: { createdAt: { gte: dateFilter } } // gte = greater than or equal
      }),
      
      // Query 2: Group by riskLevel → hitung jumlah per level risiko
      // Hasil: [{ riskLevel: 'NORMAL', _count: 7 }, { riskLevel: 'ANOMALY', _count: 10 }, ...]
      prisma.fraudAlert.groupBy({
        by: ['riskLevel'],
        where: { createdAt: { gte: dateFilter } },
        _count: true
      }),
      
      // Query 3: Group by decision → hitung jumlah per keputusan
      // Hasil: [{ decision: 'ALLOW', _count: 7 }, { decision: 'BLOCK', _count: 10 }, ...]
      prisma.fraudAlert.groupBy({
        by: ['decision'],
        where: { createdAt: { gte: dateFilter } },
        _count: true
      }),
      
      // Query 4: Ambil 10 alert terbaru untuk preview
      prisma.fraudAlert.findMany({
        where: { createdAt: { gte: dateFilter } },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    // Ekstrak jumlah transaksi BLOCK dan REVIEW dari hasil groupBy
    // Operator ?. = optional chaining (tidak error jika tidak ada data BLOCK)
    // Operator || 0 = default ke 0 jika undefined
    const blockedTransactions = decisionStats.find(d => d.decision === 'BLOCK')?._count || 0;
    const reviewTransactions = decisionStats.find(d => d.decision === 'REVIEW')?._count || 0;

    res.json({
      period,
      totalAlerts,
      blockedTransactions,
      reviewTransactions,
      // Ubah array hasil groupBy menjadi object yang mudah dibaca
      // Dari: [{ riskLevel: 'NORMAL', _count: 7 }]
      // Ke:   { NORMAL: 7, SUSPICIOUS: 8, ANOMALY: 10 }
      riskLevelBreakdown: riskLevelStats.reduce((acc, item) => {
        acc[item.riskLevel] = item._count;
        return acc;
      }, {}),
      decisionBreakdown: decisionStats.reduce((acc, item) => {
        acc[item.decision] = item._count;
        return acc;
      }, {}),
      recentAlerts: recentAlerts.slice(0, 5), // Hanya 5 terbaru untuk response
      lastAlert: recentAlerts[0]?.createdAt || null // Waktu alert paling baru
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan mendapatkan statistik fraud:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal mendapatkan statistik fraud' });
  }
});

// ============================================================
// ENDPOINT 5: POST /analyze - ANALISA RISIKO TRANSAKSI (MANUAL)
// ============================================================
// ⚠️  PENTING: Endpoint ini MEMANGGIL fungsi perhitungan, BUKAN menghitung sendiri.
//    Fungsi perhitungan Z-Score ada di: utils/fraudDetection.js → analyzeZScoreAnomaly()
//
// KEGUNAAN:
//   - Admin ingin cek apakah transaksi tertentu mencurigakan (manual check)
//   - Testing/debugging sistem fraud detection
//   - Tidak otomatis menyimpan alert (berbeda dengan /alert)
//
// ALUR KERJA:
//   1. Terima senderId dan amount dari request
//   2. Ambil 20 transaksi historis user dari database
//   3. Kirim data ke analyzeZScoreAnomaly() di utils/fraudDetection.js
//   4. analyzeZScoreAnomaly() hitung: mean (μ), stdDev (σ), Z-Score, decision
//   5. Kembalikan hasil analisis ke requester
//
// REQUEST BODY:
// {
//   "senderId": 5,        → ID user yang akan dianalisa
//   "amount": 150000      → Jumlah transaksi yang ingin dicek (Rupiah)
// }
//
// RESPONSE:
// {
//   "message": "Analisis transaksi selesai",
//   "analysis": {
//     "algorithm": "Z-Score Anomaly Detection",
//     "zScore": 3.75,          → Nilai Z = |X - μ| / σ yang dihitung
//                                 (-1 = edge case σ=0 dengan X≠μ)
//     "decision": "BLOCK",     → ALLOW / REVIEW / BLOCK
//     "riskLevel": "ANOMALY",  → NORMAL / SUSPICIOUS / ANOMALY
//     "mean": 10000,           → μ = rata-rata 20 transaksi historis
//     "stdDev": 1200,          → σ = simpangan baku historis
//     "variance": 1440000,     → σ² = kuadrat dari stdDev
//     "n": 20,                 → Jumlah data historis yang dipakai
//     "historySize": 20,       → Sama dengan n
//     "thresholds": {          → Batas klasifikasi Z-Score
//       "suspicious": 2,       → Z > 2 → SUSPICIOUS
//       "anomaly": 3           → Z > 3 → ANOMALY
//     },
//     "reasons": ["Z-Score 3.75 melebihi threshold ANOMALY (3)"]
//   }
// }
//
// PERBEDAAN /analyze vs /check:
//   /analyze → Untuk admin (response detail, ada field variance, historySize, dll)
//   /check   → Untuk mobile app (response ringkas, hanya field yang dibutuhkan)
// ============================================================
router.post('/analyze', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { senderId, amount } = req.body;

    // Validasi input wajib
    if (!senderId || !amount) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ error: 'senderId dan amount wajib diisi' });
    }

    // Validasi amount harus angka positif (tidak bisa transaksi negatif atau nol)
    const amountNum = parseFloat(amount); // parseFloat() mengubah string menjadi angka desimal; digunakan untuk nilai Z-Score atau saldo
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'amount harus angka positif' });
    }

    // Ambil 20 transaksi historis terakhir user dari database
    // Hanya transaksi yang sudah selesai (status: 'completed')
    // Diurutkan terbaru dulu, ambil 20 → ini yang jadi data statistik μ dan σ
    const historicalTxs = await prisma.transaction.findMany({
      where: { senderId: parseInt(senderId), status: 'completed' }, // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
      orderBy: { createdAt: 'desc' },
      take: 20,                                    // Maksimal 20 data historis
      select: { amount: true, createdAt: true }    // Hanya ambil field yang diperlukan
    });

    // ---------------------------------------------------------------
    // PANGGIL ENGINE PERHITUNGAN Z-SCORE
    // ---------------------------------------------------------------
    // analyzeZScoreAnomaly() ada di utils/fraudDetection.js
    // Parameter: (amount baru, array historis transaksi)
    // Return: { zScore, decision, mean, stdDev, variance, n, reasons, ... }
    //
    // Di dalam fungsi tersebut dihitung:
    //   μ (mean)   = jumlah semua amount historis / n
    //   σ (stdDev) = sqrt( Σ(xi - μ)² / n )
    //   Z          = |amount - μ| / σ
    //   decision   = ALLOW/REVIEW/BLOCK berdasarkan Z
    // ---------------------------------------------------------------
    const analysis = analyzeZScoreAnomaly(amountNum, historicalTxs);

    res.json({
      message: 'Analisis transaksi selesai',
      analysis: {
        algorithm: analysis.algorithm,
        zScore: analysis.zScore,       // Nilai Z (hasil perhitungan utama)
        decision: analysis.decision,   // Keputusan: ALLOW/REVIEW/BLOCK
        // Mapping decision → riskLevel untuk konsistensi dengan field lain
        riskLevel: analysis.decision === 'ALLOW' ? 'NORMAL' : analysis.decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY',
        mean: analysis.mean,           // μ: rata-rata historis
        stdDev: analysis.stdDev,       // σ: simpangan baku
        variance: analysis.variance,   // σ²: varians
        n: analysis.n,                 // Jumlah data historis
        historySize: analysis.historySize,
        thresholds: analysis.thresholds, // { suspicious: 2, anomaly: 3 }
        reasons: analysis.reasons      // Array penjelasan keputusan
      }
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan menganalisa transaksi:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal menganalisa transaksi' });
  }
});

// ============================================================
// ENDPOINT 6: POST /check - CEK FRAUD UNTUK MOBILE APP
// ============================================================
// Alias dari /analyze, khusus untuk dipanggil mobile app sebelum transaksi.
// Logika perhitungan SAMA PERSIS dengan /analyze (pakai analyzeZScoreAnomaly).
// Perbedaannya hanya pada format response (lebih ringkas, tanpa field detail).
//
// DIPANGGIL DARI: src/utils/apiService.ts (mobile app)
//
// ALUR PENGGUNAAN DI MOBILE APP:
//   1. User input jumlah transfer di layar
//   2. Sebelum eksekusi transaksi, app POST ke /check
//   3. Jika response decision = 'ALLOW' → lanjutkan transaksi
//   4. Jika decision = 'REVIEW' → tampilkan peringatan ke user
//   5. Jika decision = 'BLOCK' → batalkan transaksi + tampilkan error
//
// REQUEST BODY (sama dengan /analyze):
// {
//   "senderId": 5,
//   "amount": 150000
// }
//
// RESPONSE (lebih ringkas dari /analyze):
// {
//   "zScore": 3.75,           → Nilai Z-Score hasil perhitungan
//   "decision": "BLOCK",      → ALLOW / REVIEW / BLOCK
//   "riskLevel": "ANOMALY",   → NORMAL / SUSPICIOUS / ANOMALY
//   "mean": 10000,            → μ rata-rata historis
//   "stdDev": 1200,           → σ simpangan baku
//   "n": 20,                  → Jumlah data historis yang dipakai
//   "reasons": ["..."],       → Alasan keputusan
//   "algorithm": "Z-Score Anomaly Detection",
//   "thresholds": { "suspicious": 2, "anomaly": 3 }
// }
//
// PERBEDAAN RESPONSE vs /analyze:
//   /check  → TIDAK ada: variance, historySize (field dipersingkat untuk mobile)
//   /analyze → ADA semua field (lebih lengkap untuk debugging admin)
// ============================================================
router.post('/check', async (req, res) => { // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const { senderId, amount } = req.body;

    // Validasi input
    if (!senderId || !amount) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ error: 'senderId dan amount wajib diisi' });
    }

    const amountNum = parseFloat(amount); // parseFloat() mengubah string menjadi angka desimal; digunakan untuk nilai Z-Score atau saldo
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'amount harus angka positif' });
    }

    // Ambil 20 transaksi historis completed milik sender (sama dengan /analyze)
    const historicalTxs = await prisma.transaction.findMany({
      where: { senderId: parseInt(senderId), status: 'completed' }, // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { amount: true, createdAt: true }
    });

    // Panggil engine Z-Score yang sama dengan /analyze
    // Seluruh perhitungan (mean, stdDev, Z, decision) dilakukan di sini
    const analysis = analyzeZScoreAnomaly(amountNum, historicalTxs);

    // Response lebih ringkas (tanpa variance, historySize) → cocok untuk mobile app
    res.json({
      zScore: analysis.zScore,       // Nilai Z-Score (inti hasil perhitungan)
      decision: analysis.decision,   // ALLOW / REVIEW / BLOCK
      riskLevel: analysis.decision === 'ALLOW' ? 'NORMAL' : analysis.decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY',
      mean: analysis.mean,           // μ: rata-rata historis
      stdDev: analysis.stdDev,       // σ: simpangan baku
      n: analysis.n,                 // Jumlah data historis
      reasons: analysis.reasons,     // Alasan keputusan
      algorithm: analysis.algorithm,  // Nama algoritma: 'Z-Score Anomaly Detection'
      thresholds: analysis.thresholds  // Batas Z-Score { suspicious:2, anomaly:3 }
    });

  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Kesalahan fraud check:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({ error: 'Gagal melakukan fraud check' });
  }
});

module.exports = router; // module.exports mengekspor router agar bisa di-import di server.js menggunakan require()