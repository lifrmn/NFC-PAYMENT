// ============================================================
// NFCCARDS.JS - ROUTES UNTUK NFC CARD MANAGEMENT
// ============================================================
// File ini berisi semua endpoint untuk management NFC cards:
// - POST /register -> Register NFC card baru ke sistem
// - POST /link -> Link NFC card ke user account
// - POST /tap -> Scan NFC card (get card info)
// - POST /payment -> Proses pembayaran via NFC card
// - POST /topup -> Top-up saldo NFC card
// - PUT /status -> Update status NFC card (active/blocked/lost)
// - GET /list -> Get all NFC cards (dengan pagination & filter)
// - GET /:cardId/transactions -> Get transaction history card
// - GET /:cardId/info -> Get detail info NFC card
// - DELETE /delete/:cardId -> Delete NFC card dari sistem
//
// Teknologi NFC Card:
// - NFC Tags: NTag215 (RFID 13.56MHz ISO14443A)
// - Memory: 540 bytes
// - UID: 7 bytes (unique identifier)
// - Android NFC API: android.nfc.tech.MifareUltralight

const express = require('express');
// const membuat variabel tetap; require('express') memanggil module Express.js dari node_modules; digunakan untuk membuat router HTTP endpoint NFC cards
const { PrismaClient } = require('@prisma/client');
// destructuring { PrismaClient } dari Prisma; PrismaClient adalah kelas ORM untuk query database secara type-safe tanpa raw SQL
const crypto = require('crypto');
// require('crypto') memanggil module bawaan Node.js (built-in); crypto menyediakan AES-256-GCM dan scryptSync untuk derivasi kunci
const { analyzeZScoreAnomaly, HISTORY_SIZE } = require('../utils/fraudDetection');
// Fungsi dan ukuran window berasal dari engine yang sama agar kebijakan NFC tidak berbeda dari transfer biasa.
const { authenticateToken, authenticateAdmin, authenticateUserOrAdmin } = require('../middleware/auth');
// destructuring { authenticateToken } dari middleware auth.js — middleware yang memverifikasi JWT token sebelum endpoint sensitif dijalankan

const router = express.Router();
// const membuat variabel tetap; express.Router() membuat instance router baru untuk menampung semua endpoint /api/nfc-cards
const prisma = new PrismaClient();
// const membuat variabel tetap; new PrismaClient() membuat instance Prisma untuk koneksi ke database

// ============================================================================
// HELPER FUNCTIONS - Utility functions untuk NFC Card operations
// ============================================================================

// HELPER 1: normalizeCardId dan validateCardId - Normalisasi dan validasi UID NFC card
// UID NFC card format: 14-20 karakter hexadecimal (7-10 bytes)
// Contoh: "04539DE2763C80" (NTag215 UID)
const normalizeCardId = (cardId) => {
  if (typeof cardId !== 'string') return null;
  const normalized = cardId.replace(/[:\-\s]/g, '').toUpperCase();
  return /^[0-9A-F]{14,20}$/.test(normalized) ? normalized : null;
};

const validateCardId = (cardId) => {
  return normalizeCardId(cardId) !== null;
};

const parsePagination = (limit, offset) => {
  const limitNumber = Number(limit);
  const offsetNumber = Number(offset);
  if (!Number.isSafeInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) return null;
  if (!Number.isSafeInteger(offsetNumber) || offsetNumber < 0) return null;
  return { limit: limitNumber, offset: offsetNumber };
};

const matchesPaymentFingerprint = (record, senderId, receiverId, amount) =>
  record.senderId === senderId &&
  record.receiverId === receiverId &&
  record.amount === amount;

const matchesBlockedPaymentFingerprint = (alert, senderId, receiverId, amount) => {
  try {
    const riskFactors = JSON.parse(alert.riskFactors || '{}');
    return alert.userId === senderId &&
      riskFactors.receiverId === receiverId &&
      riskFactors.amount === amount;
  } catch {
    return false;
  }
};

router.use((req, _res, next) => {
  for (const field of ['cardId', 'receiverCardId']) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
      const normalized = normalizeCardId(req.body[field]);
      if (normalized) req.body[field] = normalized;
    }
  }
  next();
});

router.param('cardId', (req, res, next, cardId) => {
  const normalized = normalizeCardId(cardId);
  if (!normalized) return res.status(400).json({ error: 'INVALID_CARD_ID' });
  req.params.cardId = normalized;
  return next();
});

// HELPER 2: encryptCardData - Encrypt sensitive card data
// Algorithm: AES-256-GCM (authenticated encryption)
// Digunakan untuk encrypt data sensitif seperti PIN, security code, dll
const encryptCardData = (data) => {
  // Fungsi mengenkripsi data kartu dengan AES-256-GCM sebelum disimpan dan melempar error jika konfigurasi gagal.
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Derive encryption key dari password menggunakan scrypt
    const encryptionSecret = process.env.NFC_ENCRYPTION_KEY;
    if (!encryptionSecret) throw new Error('NFC_ENCRYPTION_KEY is not configured');
    const key = crypto.scryptSync(
    // crypto.scryptSync(): mendapatkan kunci enkripsi dari password menggunakan algoritma scrypt; 'Sync' berarti sinkron (blokir)
      encryptionSecret,
      // Password/passphrase
      'nfc-payment-card-data-v1',
      // Salt untuk key derivation
      32
      // Key length: 32 bytes (256 bits untuk AES-256)
    );
    
    // STEP 2: Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(12);
    // 12 bytes adalah ukuran nonce yang direkomendasikan untuk GCM
    
    // STEP 3: Buat cipher AES-256-GCM dengan nonce acak untuk authenticated encryption.
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    // GCM menghasilkan authentication tag agar perubahan ciphertext dapat dideteksi
    
    // STEP 4: Encrypt data
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    // Buffer.concat(): menggabungkan dua buffer; cipher.update() enkripsi data, cipher.final() finalisasi enkripsi
    
    // STEP 5: Simpan versi, IV, authentication tag, dan ciphertext agar payload dapat diverifikasi saat dekripsi.
    const authTag = cipher.getAuthTag();
    return ['v1', iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
    // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('Encryption error:', error.message);
    throw new Error('CARD_DATA_ENCRYPTION_FAILED');
  }
};

// HELPER 3: validateUser - Validasi apakah user ada di database
// Return user object jika ada, null jika tidak ada
const validateUser = async (userId) => {
  // fungsi helper async: mencari user di database berdasarkan userId; mengembalikan objek user atau null jika tidak ditemukan
  return await prisma.user.findUnique({ where: { id: parseInt(userId) } });
  // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
};

// HELPER 4: checkUserHasCard - Cek apakah user sudah punya NFC card
// Return array NFC cards yang dimiliki user
const checkUserHasCard = async (userId) => {
  // fungsi helper async: mengambil semua kartu NFC milik user; digunakan untuk enforce kebijakan 1 user = 1 kartu
  return await prisma.nFCCard.findMany({ where: { userId: parseInt(userId) } });
  // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
};

// HELPER 5: formatCurrency - Format angka ke Rupiah format
// Contoh: 50000 -> "Rp 50.000"
const formatCurrency = (amount) => {
  // fungsi helper: memformat angka menjadi string Rupiah Indonesia; contoh: 50000 → 'Rp 50.000'
  return `Rp ${amount.toLocaleString('id-ID')}`;
  // Locale Indonesia untuk format Rupiah
};

// ============================================================================
// FRAUD DETECTION: Z-Score Based Anomaly Detection
// ============================================================================
// Engine utama: backend/utils/fraudDetection.js (analyzeZScoreAnomaly)
// Semua analisis fraud di route ini menggunakan engine yang sama.
// Tidak ada fungsi fraud lokal di file ini.
// ============================================================================

// ============================================================================
// ENDPOINT: POST /register - Registrasi kartu NFC baru ke sistem
// ============================================================================
// FLOW REGISTRASI KARTU NFC:
//
// STEP 1: Extract data dari request body
//         - cardId: UID kartu NFC (7-10 bytes hex string, contoh: "04:A1:B2:C3:D4:E5:F6")
//         - userId (optional): ID user yang akan memiliki kartu
//         - cardData (optional): Data tambahan yang akan dienkripsi ke kartu
//         - deviceId: Identifier device NFC reader (Android app)
//         - metadata (optional): Data tambahan (object JSON)
//
// STEP 2: Validasi cardId format dengan regex
//         - Harus 14-20 karakter hexadecimal (0-9, A-F)
//         - Format NTag215: 7 bytes UID = 14 hex chars
//         - Jika invalid, return 400 Bad Request
//
// STEP 3: Check duplikasi - pastikan cardId belum terdaftar
//         - Query ke database: SELECT * FROM NFCCard WHERE cardId = ?
//         - Jika sudah ada, return 409 Conflict dengan info kartu existing
//         - Prevent double registration (1 UID hanya bisa 1 kartu)
//
// STEP 4: Validasi user (jika userId provided)
//         - Check apakah user exists di database
//         - Jika tidak ada, return 404 Not Found
//
// STEP 5: POLICY CHECK - 1 USER = 1 CARD
//         - Query: SELECT * FROM NFCCard WHERE userId = ?
//         - Jika user sudah punya kartu, return 409 Conflict
//         - Business rule: Setiap user hanya boleh punya 1 kartu NFC aktif
//         - Alasan: Keamanan & simplicity (prevent abuse)
//
// STEP 6: Enkripsi cardData jika provided
//         - Gunakan fungsi encryptCardData() (AES-256-CBC)
//         - Data sensitif di kartu harus terenkripsi
//         - Contoh data: PIN, biometric hash, security token
//
// STEP 7: Sync balance dengan user (jika ada userId)
//         - Query user balance dari database
//         - Initial card balance = user balance (sinkronisasi)
//         - Jika no userId, initial balance = 0
//         - Log balance sync untuk audit trail
//
// STEP 8: Insert kartu NFC baru ke database
//         - Table: NFCCard
//         - Fields: cardId, cardType (NTag215), frequency (13.56MHz),
//                  userId, cardStatus (ACTIVE), balance, cardData (encrypted),
//                  metadata (JSON string), isPhysical (true)
//         - Include user relation untuk response
//
// STEP 9: Log registration event
//         - Console log untuk monitoring
//         - Format: "🎴 NFC Card registered: {UID}... for user {userId} with balance Rp {balance}"
//
// STEP 10: Return success response
//          - HTTP 201 Created
//          - JSON: { success, message, card: {...} }
//          - Card object berisi: id, cardId, cardType, frequency, status, balance, user, registeredAt
// ============================================================================
router.post('/register', authenticateToken, async (req, res) => {
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract data dari request body
    const { cardId, userId, cardData, deviceId, metadata } = req.body;
        if (!userId || Number(userId) !== req.user.id) {
          return res.status(403).json({ error: 'CARD_USER_MUST_MATCH_AUTHENTICATED_USER' });
        }

    // Destructuring: ambil semua input dari JSON body HTTP request

    // STEP 2: Validasi cardId format (harus ada dan valid hex string 14-20 chars)
    if (!cardId) return res.status(400).json({ error: 'Card ID (UID) required' });
    // Wajib ada: UID adalah primary key kartu NFC
    if (!validateCardId(cardId)) {
      // Cek format UID: harus 14-20 karakter hexadecimal
      // Format invalid - kembalikan error dengan expected format
      return res.status(400).json({ error: 'Invalid NTag215 UID format', expected: '7-10 bytes hex string' });
      // Format salah: bukan hex 14-20 chars
    }

    // STEP 3: Check duplikasi - pastikan UID belum terdaftar di sistem
    const existingCard = await prisma.nFCCard.findUnique({ where: { cardId } });
    // Query DB: cari kartu dengan UID ini
    if (existingCard) {
      // Jika ditemukan: UID sudah ada di DB (duplikat)
      // Kartu sudah terdaftar - kembalikan 409 Conflict dengan info kartu existing
      return res.status(409).json({ error: 'Kartu sudah terdaftar', card: { id: existingCard.id, cardId: existingCard.cardId, status: existingCard.cardStatus, userId: existingCard.userId } });
      // 409 Conflict: prevent double registration
    }

    // STEP 4 & 5: Validasi user dan POLICY CHECK (1 USER = 1 CARD)
    if (userId) {
      // Hanya validasi jika userId disediakan (kartu boleh unassigned)
      // STEP 4: Validate user exists di database
      const user = await validateUser(userId);
      // Cari user berdasarkan ID di tabel User
      if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      // User tidak ada: return 404 Not Found

      // STEP 5: 🔒 BUSINESS RULE - 1 USER = 1 CARD POLICY
      // Alasan policy ini:
      // 1. Keamanan: Prevent user dari abuse system dengan multiple cards
      // 2. Simplicity: 1-to-1 mapping memudahkan tracking & fraud detection
      // 3. User experience: relasi kartu jelas (1 user tepat 1 kartu fisik)
      const userExistingCards = await checkUserHasCard(userId);
      // Ambil semua kartu milik user ini
      if (userExistingCards.length > 0) {
        // Jika ada kartu: user sudah punya 1 kartu (policy dilanggar)
        // User sudah punya kartu - reject registration
        return res.status(409).json({
          // 409 Conflict: 1 user hanya boleh punya 1 kartu
          error: 'Pengguna sudah memiliki kartu terdaftar',
          // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
          message: 'Each user can only register ONE NFC card',
          // pesan error kebijakan 1 kartu per user; dikembalikan jika user sudah memiliki kartu yang terdaftar
          existingCard: { cardId: userExistingCards[0].cardId, cardStatus: userExistingCards[0].cardStatus, balance: userExistingCards[0].balance, registeredAt: userExistingCards[0].registeredAt }
          // Info kartu yang sudah ada
        });
      }
    }

    // STEP 6: Enkripsi cardData jika tersedia menggunakan AES-256-GCM.
    const encryptedData = cardData ? encryptCardData(cardData) : null;
    // Jika ada cardData: enkripsi dengan AES-256, jika tidak: null
    // cardData bisa berisi: PIN, biometric data, security tokens
    // Format tersimpan: "v1:iv:authTag:ciphertext" untuk membawa metadata dekripsi dan autentikasi.

    // STEP 7: Sync initial balance dengan user balance (jika userId provided)
    let initialBalance = 0;
    // Default 0 jika tidak ada user (kartu unassigned)
    if (userId) {
      // Hanya sync jika kartu dihubungkan ke user
      // Query user balance dari database
      const userWithBalance = await prisma.user.findUnique({
        // Ambil data user dengan hanya field balance
        where: { id: parseInt(userId) },
        // Konversi userId string ke integer
        select: { balance: true }
        // Hanya ambil field balance (efisiensi query)
      });
      // Set card balance = user balance (sinkronisasi)
      // Ini memastikan balance kartu selalu match dengan balance user
      initialBalance = userWithBalance?.balance || 0;
      // Optional chaining: jika null gunakan 0
      console.log(`💰 Syncing card balance with user balance: Rp ${initialBalance.toLocaleString('id-ID')}`);
      // Log sinkronisasi untuk monitoring
    }
    // Jika no userId: initialBalance = 0 (kartu unassigned/guest)

    // STEP 8: Insert kartu NFC baru ke database (Prisma ORM create operation)
    const nfcCard = await prisma.nFCCard.create({
      // Simpan record kartu baru ke tabel NFCCard
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        cardId,
        // UID kartu (unique identifier)
        cardType: 'NTag215',
        // Tipe chip NFC
        frequency: '13.56MHz',
        // Frekuensi RFID ISO14443A
        userId: userId ? parseInt(userId) : null,
        // Foreign key ke User (nullable)
        cardStatus: 'ACTIVE',
        // Status awal: ACTIVE (dapat digunakan)
        balance: initialBalance,
        // ✅ Balance card = balance user (sync)
        cardData: encryptedData,
        // Data terenkripsi (nullable)
        metadata: metadata ? JSON.stringify(metadata) : null,
        // Extra data as JSON string
        isPhysical: true
        // Flag: kartu fisik (bukan virtual)
      },
      include: {
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        user: {
          // Include user relation dalam response
          select: {
            // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
            id: true,
            // ID user terkait kartu untuk referensi
            name: true,
            // nama lengkap user terkait kartu
            username: true,
            // username login user
            balance: true
            // saldo user yang disinkronkan dengan kartu
          }
        }
      }
    });
    // Prisma akan auto-generate: id (auto-increment), registeredAt (timestamp), updatedAt

    // STEP 9: Log registration event untuk monitoring & debugging
    console.log(`🎴 NFC Card registered: ${cardId.slice(0, 8)}... ${userId ? `for user ${userId} with balance Rp ${initialBalance.toLocaleString('id-ID')}` : '(unassigned)'}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // Format log: "🎴 NFC Card registered: 04A1B2C3... for user 123 with balance Rp 500.000"

    // STEP 10: Return success response dengan HTTP 201 Created
    res.status(201).json({
      // mengirim response 201 Created; resource baru berhasil dibuat di database
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'NFC card registered successfully',
      // pesan sukses registrasi kartu; dikembalikan setelah kartu berhasil disimpan di database
      card: {
        // objek card berisi detail kartu yang baru didaftarkan untuk ditampilkan di frontend
        id: nfcCard.id,
        // Database primary key (auto-increment)
        cardId: nfcCard.cardId,
        // UID kartu (hex string)
        cardType: nfcCard.cardType,
        // "NTag215"
        frequency: nfcCard.frequency,
        // "13.56MHz"
        status: nfcCard.cardStatus,
        // "ACTIVE"
        balance: nfcCard.balance,
        // Current balance (synced dengan user)
        user: nfcCard.user,
        // User object (jika linked) atau null
        registeredAt: nfcCard.registeredAt
        // Timestamp registration
      }
    });
    // Client akan menerima response ini dan bisa simpan cardId untuk transaksi selanjutnya

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // STEP 11: Error handling - tangkap semua error dan return 500 Internal Server Error
    console.error('❌ Card registration error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Pengguna atau kartu sudah memiliki registrasi aktif' });
    }
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika registrasi kartu NFC gagal karena error database atau validasi
      error: 'Gagal mendaftarkan kartu'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
    // Error bisa dari: Prisma (DB error), encryption error, validation error, dll
  }
});
// ============================================================================
// END OF ENDPOINT: POST /register
// ============================================================================

// ============================================================================
// ENDPOINT: POST /link - Link kartu NFC yang sudah terdaftar ke user
// ============================================================================
// USE CASE: Kartu NFC sudah di-register tapi belum terhubung user (userId = null)
//           Endpoint ini untuk menghubungkan kartu ke user tertentu
//
// FLOW LINKING KARTU:
//
// STEP 1: Extract cardId & userId dari request body
//         Kedua parameter ini WAJIB ada
//
// STEP 2: Validate card exists di database
//         Query: SELECT * FROM NFCCard WHERE cardId = ?
//         Jika tidak ada, return 404 Not Found
//
// STEP 3: Check card status - hanya ACTIVE card yang bisa di-link
//         Status BLOCKED/LOST/EXPIRED tidak bisa di-link ke user baru
//         Alasan: Keamanan & data integrity
//
// STEP 4: Validate user exists di database
//         Gunakan helper validateUser(userId)
//         Jika user tidak ada, return 404 Not Found
//
// STEP 5: Update NFCCard record
//         SET userId = {userId}, updatedAt = NOW()
//         WHERE cardId = {cardId}
//         Include user relation dalam response
//
// STEP 6: Log linking event
//         Format: "🔗 Card {UID}... linked to user {username}"
//
// STEP 7: Return success response
//         JSON: { success, message, card: {...} }
// ============================================================================
router.post('/link', authenticateToken, async (req, res) => {
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract required parameters dari request body
    const { cardId, userId } = req.body;
    // Ambil cardId (UID kartu) dan userId dari request body
    if (!cardId || !userId) return res.status(400).json({ error: 'ID Kartu dan ID Pengguna diperlukan' });
    // Kedua parameter wajib ada
    if (Number(userId) !== req.user.id) {
      return res.status(403).json({ error: 'CARD_USER_MUST_MATCH_AUTHENTICATED_USER' });
    }
    if (!validateCardId(cardId)) {
      return res.status(400).json({ error: 'INVALID_CARD_ID' });
    }

    // STEP 2: Validate card exists (Prisma findUnique query)
    const card = await prisma.nFCCard.findUnique({
      where: { cardId },
      include: { user: { select: { balance: true } } }
    });
    // Cari kartu berdasarkan UID di database
    if (!card) return res.status(404).json({ error: 'Card not found' });
    // Kartu tidak ditemukan: return 404
    
    // STEP 3: Check card status - hanya ACTIVE card yang bisa di-link
    if (card.cardStatus !== 'ACTIVE') {
      // Status selain ACTIVE tidak bisa di-link
      // BLOCKED/LOST/EXPIRED card tidak bisa di-link ke user baru
      return res.status(400).json({ error: `Tidak dapat menghubungkan kartu berstatus ${card.cardStatus.toLowerCase()}` });
      // Return status sebenarnya ke client
    }
    if (card.userId && card.userId !== req.user.id) {
      return res.status(409).json({ error: 'CARD_ALREADY_LINKED' });
    }

    // STEP 4: Validate user exists (gunakan helper function)
    const user = await validateUser(userId);
    // Cari user berdasarkan userId di tabel User
    if (!user) return res.status(404).json({ error: 'User not found' });
    // User tidak ada: return 404

    const existingCardsForUser = await checkUserHasCard(userId);
    const hasDifferentCard = existingCardsForUser.some((existing) => existing.cardId !== cardId);
    if (hasDifferentCard) {
      return res.status(409).json({
        error: 'USER_ALREADY_HAS_CARD',
        message: 'Setiap pengguna hanya boleh memiliki satu kartu NFC'
      });
    }

    // STEP 5: Update card - assign userId (Prisma update operation)
    const updatedCard = await prisma.nFCCard.update({
      // Update record kartu di database
      where: { cardId, userId: card.userId },
      // Identifikasi kartu berdasarkan UID
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        userId: parseInt(userId),
        // Foreign key ke User table (string → int)
        balance: user.balance,
        updatedAt: new Date()
        // Update timestamp waktu saat ini
      },
      include: {
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        user: {
          // Include user data dalam response agar client tidak perlu query lagi
          select: { id: true, name: true, username: true, balance: true }
          // Hanya field yang dibutuhkan
        } 
      }
    });
    // Setelah update: card.userId not null, berarti card sudah terhubung ke user

    // STEP 6: Log linking event untuk audit trail
    console.log(`🔗 Card ${cardId.slice(0, 8)}... linked to user ${user.username}`);
    // Log: 8 char pertama UID + username
    
    // STEP 7: Return success response
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Card linked to user successfully',
      // pesan sukses linking kartu ke user; dikembalikan setelah relasi kartu-user berhasil dibuat di database
      card: updatedCard
      // Include updated card dengan user relation
    });
    // Client akan terima card object dengan user property terisi
    
  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // Error handling - tangkap semua error (Prisma, validation, dll)
    console.error('❌ Card linking error:', error);
    // Log error ke console untuk debugging
    if (error.code === 'P2025') {
      return res.status(409).json({ error: 'CARD_LINK_CONFLICT' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'USER_ALREADY_HAS_CARD' });
    }
    res.status(500).json({ error: 'Gagal menghubungkan kartu' });
    // Return 500 dengan detail error
  }
});
// ============================================================================
// END OF ENDPOINT: POST /link
// ============================================================================

// ============================================================================
// ENDPOINT: POST /tap - Proses tap/scan kartu NFC (read operation)
// ============================================================================
// USE CASE: User tap kartu NFC ke reader (Android app dengan NFC sensor)
//           untuk membaca data kartu, cek saldo, dan validasi status
//
// FLOW TAP/SCAN KARTU:
//
// STEP 1: Extract data dari request body
//         - cardId: UID kartu yang di-scan (7 bytes hex)
//         - deviceId: Identifier device reader (Android device ID)
//         - location (optional): Lokasi tap (GPS coordinates atau deskripsi)
//         - signalStrength (optional): Kekuatan sinyal RFID (dBm)
//         - readTime (optional): Waktu yang dibutuhkan untuk read (ms)
//
// STEP 2: Validate card exists dan query data lengkap
//         Include user relation untuk mendapatkan balance & user info
//
// STEP 3: Check card status - validasi apakah kartu dapat digunakan
//         Ada 4 status: ACTIVE, BLOCKED, EXPIRED, LOST
//         Hanya ACTIVE yang bisa digunakan untuk transaksi
//
// STEP 4: Handle BLOCKED card
//         Return 403 Forbidden dengan pesan "Contact admin"
//         User harus menghubungi admin untuk unblock
//
// STEP 5: Handle EXPIRED card
//         Return 403 Forbidden dengan info expiry date
//         Kartu sudah kadaluarsa (jika ada mekanisme expiry)
//
// STEP 6: Handle LOST card - KEAMANAN KRITIS
//         Jika kartu reported as LOST, ini bisa jadi fraud attempt!
//         Create fraud alert dengan riskLevel ANOMALY (kartu hilang = anomali ekstrem)
//         Log location & device info untuk investigation
//         Block transaction dan return 403
//
// STEP 7: Update lastUsed timestamp
//         Track kapan terakhir kali kartu digunakan
//         Helpful untuk: inactivity detection, user activity tracking
//
// STEP 8: Log tap transaction ke NFCTransaction table
//         Type: TAP_IN (read operation, no balance change)
//         Log: balanceBefore = balanceAfter (no deduction)
//         Metadata: signalStrength, readTime, timestamp
//
// STEP 9: Return card info ke client
//         Response berisi: status, balance, user info, lastUsed
//         Client akan display info ini ke user via UI
// ============================================================================
router.post('/tap', authenticateToken, async (req, res) => {
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract request data
    const { cardId, deviceId, location, signalStrength, readTime } = req.body;
    // Destructuring: ambil semua data dari request body
    if (!cardId || !deviceId) return res.status(400).json({ error: 'ID Kartu dan ID Perangkat diperlukan' });
    // Dua parameter wajib: UID kartu + ID device NFC reader

    // STEP 2: Query card dari database dengan user relation
    const card = await prisma.nFCCard.findUnique({
      // Cari kartu di database berdasarkan UID
      where: { cardId },
      // Kondisi: cardId = UID yang dikirim
      include: { user: { select: { id: true, name: true, username: true, balance: true } } }
      // Sertakan data user terkait kartu
    });
    // Include user: untuk mendapatkan balance & user info tanpa query terpisah

    // Validasi: card tidak ditemukan
    if (!card) {
      // Jika kartu tidak ada di database: belum pernah didaftarkan
      return res.status(404).json({
        // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
        error: 'Kartu tidak dikenali',
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
        suggestion: 'Register this card first'
        // Guide user untuk register kartu
      });
      // Return 404: kartu tidak dikenali sistem
    }

    // STEP 3-6: Check card status dengan berbagai scenario
    
    // STEP 4: Handle BLOCKED card (diblokir oleh admin karena fraud/violation)
    if (card.cardStatus === 'BLOCKED') {
      // Kartu dalam status BLOCKED: tidak bisa digunakan
      return res.status(403).json({
        // 403 Forbidden: kartu BLOCKED tidak boleh digunakan untuk transaksi apapun
        error: 'Kartu diblokir',
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
        reason: 'Contact admin for assistance'
        // Suruh user hubungi admin
      });
      // Return 403 Forbidden: akses ditolak
    }

    // STEP 5: Handle EXPIRED card (kartu sudah kadaluarsa)
    if (card.cardStatus === 'EXPIRED') {
      // Kartu kadaluarsa: melewati tanggal expired
      return res.status(403).json({
        // 403 Forbidden: kartu EXPIRED tidak bisa digunakan; user perlu minta kartu baru
        error: 'Kartu telah kadaluarsa',
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
        expiredAt: card.expiresAt
        // Inform user kapan expired
      });
      // Return 403 Forbidden: kartu tidak lagi valid
    }

    // STEP 6: 🚨 Handle LOST card - CRITICAL SECURITY EVENT
    if (card.cardStatus === 'LOST') {
      // memeriksa apakah kartu dilaporkan hilang; kartu hilang diblokir dan transaksi dicatat sebagai fraud alert
      // Kartu dilaporkan hilang tapi ada yang coba pakai = FRAUD ATTEMPT!
      // Create fraud alert untuk notifikasi admin
      await prisma.fraudAlert.create({
        // prisma.fraudAlert.create(): menyimpan fraud alert ke database; dipanggil otomatis saat kartu hilang digunakan
        data: {
          // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
          userId: card.userId,
          // ID user kartu yang hilang; diambil dari data kartu yang ditemukan
          deviceId,
          // shorthand ES6: ID perangkat yang melakukan scan kartu hilang
          deviceName: 'NFC Reader',
          // nama perangkat NFC yang melakukan scan
          // Status LOST memicu BLOCK berbasis kebijakan; simpan Z sentinel -1 karena tidak dihitung.
          riskScore: -1,
          // sentinel value -1: kartu hilang tidak perlu Z-Score; langsung BLOCK
          riskLevel: 'ANOMALY',
          // Anomali kritis - kartu hilang
          decision: 'BLOCK',
          // keputusan BLOCK otomatis: kartu hilang selalu diblokir tanpa analisis Z-Score
          reasons: JSON.stringify(['Card reported as LOST', `Tap attempt at ${location || 'unknown location'}`]),
          // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          confidence: 1.0,
          // Nilai 1.0 menandai keputusan kebijakan untuk status LOST, bukan probabilitas fraud terukur.
          riskFactors: JSON.stringify({
            // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
            cardStatus: 'LOST',
            // mencatat status kartu sebagai LOST; disimpan di riskFactors untuk konteks investigasi
            tapAttempt: true
            // Someone trying to use lost card = suspicious
          }),
          ipAddress: req.ip
          // Track IP untuk investigation
        }
      });
      // Alert ini akan muncul di admin dashboard untuk immediate action
      // Admin bisa track: location, device, IP address dari attacker

      return res.status(403).json({
        // 403 Forbidden: kartu yang dilaporkan hilang tidak boleh digunakan; fraud attempt terdeteksi
        error: 'Card reported as lost',
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
        action: 'Transaction blocked for security'
        // informasi tambahan: alasan transaksi diblokir; dikirim ke frontend untuk ditampilkan
      });
    }
    // Jika pass semua check di atas, berarti card.cardStatus = 'ACTIVE' (OK untuk transaksi)

    // STEP 7: Update lastUsed timestamp untuk activity tracking
    await prisma.nFCCard.update({
      // memperbarui data kartu setelah read berhasil; mencatat lastUsed dan statistik penggunaan
      where: { cardId },
      // identifikasi kartu yang diperbarui berdasarkan cardId; shorthand ES6
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        lastUsed: new Date(),
        // Track waktu terakhir kartu di-tap
        updatedAt: new Date()
        // Standard updated timestamp
      }
    });
    // lastUsed berguna untuk: inactive card detection, usage pattern analysis

    // STEP 8: Log tap transaction ke NFCTransaction table (audit trail)
    await prisma.nFCTransaction.create({
      // mencatat transaksi baca NFC ke tabel NFCTransaction; setiap scan kartu dicatat untuk audit trail
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        cardId,
        // UID kartu yang di-tap
        transactionType: 'TAP_IN',
        // Tipe: TAP_IN (read operation, bukan payment)
        balanceBefore: card.balance,
        // Balance sebelum = balance saat ini (no change)
        balanceAfter: card.balance,
        // Balance setelah = sama (tap tidak mengubah balance)
        deviceId,
        // Device reader yang digunakan
        location,
        // Lokasi tap (GPS atau deskripsi)
        status: 'SUCCESS',
        // Transaction berhasil
        metadata: JSON.stringify({
          // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          signalStrength,
          // Kekuatan sinyal RFID (dBm)
          readTime,
          // Waktu baca (milliseconds)
          timestamp: new Date().toISOString()
          // Timestamp exact
        }),
        ipAddress: req.ip
        // IP address device/client
      }
    });
    // Transaction log ini untuk: audit trail, analytics, usage tracking
    // Admin bisa analyze: kapan kartu digunakan, di mana, device apa

    // STEP 9: Log ke console untuk monitoring real-time
    console.log(`📱 Card tapped: ${cardId.slice(0, 8)}... on ${deviceId.slice(-8)}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // Format log: "📱 Card tapped: 04A1B2C3... on device ...abc12345"

    // STEP 10: Return success response dengan card info lengkap
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Card read successfully',
      // pesan sukses baca kartu; dikembalikan setelah data kartu berhasil dibaca dari database
      card: {
        // objek card berisi detail kartu yang dibaca untuk ditampilkan di frontend
        id: card.id,
        // Database ID (auto-increment)
        cardId: card.cardId,
        // UID kartu (hex string)
        cardType: card.cardType,
        // "NTag215"
        status: card.cardStatus,
        // "ACTIVE"
        balance: card.balance,
        // Current balance (dalam Rupiah)
        user: card.user,
        // User object (id, name, username, balance)
        lastUsed: new Date()
        // Timestamp tap (just now)
      }
    });
    // Client (Android app) akan display info ini ke user:
    // - Balance: untuk ditampilkan di UI
    // - User info: untuk konfirmasi "Kartu milik [nama]"
    // - Status: untuk validasi (jika BLOCKED/LOST, show warning)

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // Error handling - tangkap semua error (Prisma, validation, network, dll)
    console.error('❌ Card tap error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika proses tap kartu NFC gagal
      error: 'Failed to process card tap'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: POST /tap
// ============================================================================

// ============================================================================
// ENDPOINT: POST /payment - Proses pembayaran NFC card-to-card atau card-to-user
// ============================================================================
// KOMPLEKSITAS TINGGI - Endpoint ini mengimplementasikan:
// 1. Statistical Fraud Detection (Z-Score anomaly detection)
// 2. Atomic Transaction (Prisma $transaction untuk ensure consistency)
// 3. Balance Synchronization (user ↔ card balance always in sync)
// 4. Multi-receiver support (card-to-card atau user-to-user transfer)
// 5. Comprehensive logging & audit trail
//
// FLOW PEMBAYARAN NFC:
//
// STEP 1: Extract & validate request parameters
//         Required: cardId (sender), amount, deviceId
//         Optional: receiverCardId OR receiverId, location, description
//
// STEP 2: Validate amount (must be positive number)
//
// STEP 3: Query sender card dengan user relation
//         Untuk mendapatkan: user balance, user ID, card status
//
// STEP 4: Validate sender card status (must be ACTIVE)
//
// STEP 5: Check USER balance (not card balance!)
//         ⚠️ PENTING: Balance source adalah USER, bukan CARD
//         Alasan: User balance adalah single source of truth
//         Card balance hanya untuk sync/cache purposes
//
// STEP 6: FRAUD DETECTION - Z-Score Anomaly Detection
//         Algoritma: Statistical outlier detection based on historical patterns
//         Input: sender card history (last 20 transactions)
//         Output: Z-Score, riskLevel (NORMAL/SUSPICIOUS/ANOMALY), decision (ALLOW/REVIEW/BLOCK)
//         Reference: Tagle (2024) - NFC Fraud Detection with Z-Score
//
//         6a. Analyze transaction amount vs historical mean
//         6b. Calculate Z-Score: Z = |X - μ| / σ
//         6c. Apply business thresholds pada nilai absolut Z:
//             - Z > 3 → BLOCK (penyimpangan melewati threshold kebijakan)
//             - 2 < Z ≤ 3 → REVIEW (significant deviation)
//             - Z ≤ 2 → ALLOW (normal transaction pattern)
//         6d. If REVIEW or BLOCK: Create fraud alert untuk admin
//         6e. If BLOCK: Return 403 Forbidden, stop transaction immediately
//
// STEP 7: Validate receiver (card OR user)
//         Dua kemungkinan:
//         - receiverCardId: Card-to-card transfer (tap receiver card)
//         - receiverId: User-to-user transfer (pilih user dari list)
//
// STEP 8: Execute ATOMIC TRANSACTION (Prisma $transaction)
//         ⚠️ CRITICAL: Semua DB operations harus atomic (all-or-nothing)
//         Jika 1 operation gagal, semua di-rollback
//
//         8a. Deduct balance dari sender USER (not card!)
//         8b. Update sender CARD: sync balance + update lastUsed
//         8c. Add balance ke receiver USER
//         8d. Update receiver CARD (if applicable): sync balance + update lastUsed
//         8e. Log sender NFCTransaction (type: PAYMENT, negative amount)
//         8f. Log receiver NFCTransaction (type: TAP_IN, positive amount)
//         8g. Create Transaction record (untuk transaction history)
//
// STEP 9: Log transaction success
//         Format: "✅ Transfer Success! Pengirim: [user] → Penerima: [user] | Amount: Rp X"
//
// STEP 10: Return success response
//          Response: transaction amount, updated balances, timestamp
// ============================================================================
// POST /payment dilindungi JWT: user yang terautentikasi wajib hadir
// sebagai penerima (merchant) yang memulai transaksi penerimaan.
router.post('/payment', authenticateToken, async (req, res) => {
  // Endpoint payment: dilindungi JWT middleware
  const idempotencyKey = req.headers['idempotency-key'];
  let paymentFingerprint = null;
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract request parameters
    const {
      // Destructuring semua parameter dari JSON body
      cardId,
      // Sender card UID
      amount,
      // Transfer amount (Rupiah)
      receiverCardId,
      // Receiver card UID (optional, untuk card-to-card)
      receiverId,
      // Receiver user ID (optional, untuk user-to-user)
      deviceId,
      // Device reader ID (Android device)
      location,
      // Location of transaction (GPS atau deskripsi)
      description
      // Transaction description (optional)
    } = req.body;
    // destructuring lanjutan: mengambil semua field dari body request payment NFC

    // Validate required parameters
    if (!cardId || !amount || !deviceId) {
      // Tiga parameter wajib: cardId, amount, deviceId
      return res.status(400).json({
        // Return 400 jika salah satu parameter wajib tidak ada
        error: 'Card ID, amount, and device ID required'
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
      });
      // Informasi parameter mana yang kurang
    }

    // STEP 2: Nominal Rupiah harus berupa angka finite positif.
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    const amountNum = amount;

    if (!validateCardId(cardId)) {
      return res.status(400).json({ error: 'INVALID_SENDER_CARD_ID' });
    }

    // STEP 3: Query sender card dengan user relation (Prisma include)
    const senderCard = await prisma.nFCCard.findUnique({
      // Cari kartu pengirim di database
      where: { cardId },
      // Cari berdasarkan UID kartu pengirim
      include: { user: true }
      // Include untuk mendapatkan user balance & info
    });

    if (!senderCard) {
      // Kartu pengirim tidak ditemukan di database
      return res.status(404).json({ error: 'Sender card not found' });
      // Return 404: kartu belum terdaftar
    }

    // STEP 4: Validate sender card status
    if (senderCard.cardStatus !== 'ACTIVE') {
      // Hanya ACTIVE card yang bisa melakukan payment
      return res.status(403).json({ error: 'Sender card is not active' });
      // Return 403: kartu tidak aktif
    }

    if (!senderCard.user) {
      return res.status(400).json({ error: 'SENDER_CARD_HAS_NO_USER' });
    }

    if (!senderCard.user.isActive) {
      return res.status(403).json({ error: 'SENDER_ACCOUNT_INACTIVE' });
    }

    // Merchant yang login adalah penerima. Validasi penerima dilakukan sebelum fraud
    // agar request manipulatif tidak dapat membuat FraudAlert untuk pembayaran yang tidak sah.
    if (Boolean(receiverCardId) === Boolean(receiverId)) {
      return res.status(400).json({ error: 'EXACTLY_ONE_RECEIVER_REQUIRED' });
    }

    let receiverCard = null;
    let receiverUser = null;

    if (receiverCardId) {
      if (!validateCardId(receiverCardId)) {
        return res.status(400).json({ error: 'INVALID_RECEIVER_CARD_ID' });
      }

      receiverCard = await prisma.nFCCard.findUnique({
        where: { cardId: receiverCardId },
        include: { user: true }
      });

      if (!receiverCard) {
        return res.status(404).json({ error: 'Receiver card not found' });
      }

      if (receiverCard.cardStatus !== 'ACTIVE') {
        return res.status(403).json({ error: 'RECEIVER_CARD_INACTIVE' });
      }

      if (!receiverCard.user || !receiverCard.user.isActive) {
        return res.status(403).json({ error: 'RECEIVER_ACCOUNT_INACTIVE' });
      }

      receiverUser = receiverCard.user;
    } else {
      const parsedReceiverId = Number(receiverId);
      if (!Number.isSafeInteger(parsedReceiverId) || parsedReceiverId <= 0) {
        return res.status(400).json({ error: 'INVALID_RECEIVER_ID' });
      }

      receiverUser = await prisma.user.findUnique({ where: { id: parsedReceiverId } });
      if (!receiverUser) {
        return res.status(404).json({ error: 'Receiver not found' });
      }

      if (!receiverUser.isActive) {
        return res.status(403).json({ error: 'RECEIVER_ACCOUNT_INACTIVE' });
      }
    }

    if (receiverUser.id !== req.user.id) {
      return res.status(403).json({ error: 'RECEIVER_USER_MISMATCH' });
    }

    if (senderCard.userId === receiverUser.id) {
      return res.status(400).json({ error: 'SELF_PAYMENT_NOT_ALLOWED' });
    }

    paymentFingerprint = {
      senderId: senderCard.userId,
      receiverId: receiverUser.id,
      amount: amountNum
    };

    // Key idempotensi terikat pada fingerprint sender, receiver, dan amount.
    // Retry dengan fingerprint sama mengulang hasil tersimpan; penggunaan key untuk pembayaran
    // berbeda ditolak 409. Unique constraint menangani dua request yang lolos cek awal bersamaan,
    // lalu catch P2002 di bawah mengambil dan mengembalikan transaksi pemenang.
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY' });
    }

    const existingTransaction = await prisma.transaction.findUnique({
      where: { idempotencyKey },
      include: { sender: true, receiver: true }
    });
    if (existingTransaction) {
      if (!matchesPaymentFingerprint(
        existingTransaction,
        senderCard.userId,
        receiverUser.id,
        amountNum
      )) {
        return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
      }
      return res.json({
        success: true,
        replayed: true,
        message: 'Payment already processed',
        transaction: {
          id: existingTransaction.id,
          amount: existingTransaction.amount,
          senderName: existingTransaction.sender.name || existingTransaction.sender.username,
          senderBalance: existingTransaction.sender.balance,
          receiverBalance: existingTransaction.receiver.balance,
          timestamp: existingTransaction.createdAt,
          fraudRiskLevel: existingTransaction.fraudRiskLevel || 'NORMAL',
          fraudRiskScore: existingTransaction.fraudRiskScore,
          fraudDecision: existingTransaction.fraudDecision || 'ALLOW'
        }
      });
    }

    const existingBlockedAlert = await prisma.fraudAlert.findUnique({
      where: { idempotencyKey }
    });
    if (existingBlockedAlert) {
      if (!matchesBlockedPaymentFingerprint(
        existingBlockedAlert,
        senderCard.userId,
        receiverUser.id,
        amountNum
      )) {
        return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
      }
      return res.status(403).json({
        error: 'TRANSACTION_BLOCKED',
        replayed: true,
        message: 'Transaksi sebelumnya telah diblokir.',
        amount: amountNum,
        senderName: senderCard.user.name || senderCard.user.username,
        senderBalance: senderCard.user.balance,
        receiverBalance: receiverUser.balance,
        zScore: existingBlockedAlert.riskScore === -1 ? null : existingBlockedAlert.riskScore,
        riskLevel: existingBlockedAlert.riskLevel,
        decision: existingBlockedAlert.decision,
        reasons: JSON.parse(existingBlockedAlert.reasons)
      });
    }

    if (!Number.isFinite(receiverUser.balance + amountNum)) {
      return res.status(400).json({ error: 'BALANCE_OVERFLOW' });
    }

    // STEP 5: Check USER balance (bukan card balance!)
    // ⚠️ IMPORTANT DESIGN DECISION: User balance adalah single source of truth
    const userBalance = senderCard.user?.balance || 0;
    // Ambil balance user (null-safe, default 0)
    console.log(`💰 Balance Check: User ${senderCard.userId} has Rp ${userBalance.toLocaleString('id-ID')}, trying to send Rp ${amountNum.toLocaleString('id-ID')}`);
    // Log balance check untuk monitoring
    
    // Validate sufficient balance
    if (userBalance < amountNum) {
      // Saldo tidak cukup: user tidak bisa membayar
      return res.status(400).json({
        // Return 400: insufficient balance
        error: 'Insufficient balance',
        // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
        balance: userBalance,
        // Saldo saat ini
        required: amountNum
        // Saldo yang dibutuhkan
      });
      // Client akan show: "Saldo tidak cukup. Saldo: Rp X, Dibutuhkan: Rp Y"
    }

    // STEP 6: FRAUD DETECTION — Z-Score Anomaly Detection
    // =========================================================================
    // REFERENSI AKADEMIS:
    //   Tagle, R. A. (2024). Machine Learning Integration for Real-time Fraud
    //   Detection in Near Field Communication (NFC) Card Transactions.
    //   Technologique, 3(1), 69–76.
    //   https://doi.org/10.62718/vmca.tech-gjtdsi.3.1.sc-1124-009
    //
    // FORMULA Z-SCORE YANG DIPAKAI ENGINE:
    //   Z = |X − μ| / σ
    //   X = nominal saat ini, μ = rata-rata historis, σ = std deviasi sampel
    //
    // THRESHOLD BISNIS BERBASIS NILAI ABSOLUT Z:
    //   Z ≤ 2 → ALLOW
    //   2 < Z ≤ 3 → REVIEW
    //   Z > 3 → BLOCK
    //
    // SAMPLE VARIANCE (Bessel's Correction):
    //   σ = √[Σ(xᵢ−μ)²/(n−1)] — memakai pembagi n−1 untuk estimasi dari sampel
    // =========================================================================
    let lastFraudAnalysis = null;
    // untuk dikirim ke response client (null jika no fraud analysis)
    if (senderCard.userId) {
      // Hanya lakukan fraud detection jika kartu terhubung ke user
      try {
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // STEP 6a: Ambil 20 transaksi historis terakhir sebelum transaksi baru disimpan
        // PENTING: historis diambil SEBELUM transaksi baru disimpan agar X tidak ikut baseline
        // senderId membatasi baseline ke transaksi keluar; status completed mengecualikan transaksi gagal.
        // Transaksi masuk dan top-up tidak digunakan sebagai pola nominal pembayaran sender.
        const historicalTxs = await prisma.transaction.findMany({
          // Query transaksi historis user
          where: { senderId: senderCard.userId, status: 'completed' },
          // Hanya transaksi sukses milik sender
          orderBy: { createdAt: 'desc' },
          // Urutkan dari terbaru ke terlama
          take: HISTORY_SIZE,
          // Ambil window histori sesuai konfigurasi tunggal pada engine Z-Score.
          select: { amount: true, createdAt: true }
          // Hanya field yang dibutuhkan untuk Z-Score
        });

        // STEP 6b: Panggil engine utama Z-Score (satu-satunya engine, tidak ada duplikat)
        const fraudAnalysis = analyzeZScoreAnomaly(amountNum, historicalTxs);
        // Hitung Z-Score anomali
        lastFraudAnalysis = fraudAnalysis;
        // Simpan hasil untuk dikirim ke response

        // Log hasil analisis
        console.log('🔍 Fraud Detection Analysis (Z-Score Based Anomaly Detection):');
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        console.log(`   └─ Z-Score: ${fraudAnalysis.zScore} | Decision: ${fraudAnalysis.decision} | Risk: ${fraudAnalysis.riskLevel}`);
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        console.log(`   └─ Mean: ${fraudAnalysis.mean} | StdDev: ${fraudAnalysis.stdDev} | n: ${fraudAnalysis.n}`);
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        console.log(`   └─ Threshold: Z≤2 ALLOW | 2<Z≤3 REVIEW | Z>3 BLOCK`);
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

        // STEP 6c: Buat FraudAlert BLOCK sebelum payment transaction karena BLOCK tidak membuat Transaction.
        // REVIEW dibuat di dalam payment transaction setelah transactionId tersedia agar semuanya atomik.
        const riskLevelMapped = fraudAnalysis.riskLevel;
        // Gunakan riskLevel dari engine agar route NFC tidak mengulang klasifikasi sendiri.
        if (fraudAnalysis.decision === 'BLOCK') {
          // Hanya buat FraudAlert jika BLOCK (sebelum transaction)
          // BLOCK: Tidak ada transaction yang dibuat sehingga transactionId tetap null.
          const blockedAlert = await prisma.fraudAlert.create({
              // membuat fraud alert otomatis saat kartu hilang digunakan; mencatat upaya penggunaan kartu yang dilaporkan hilang
            // Buat record fraud alert di database
              data: {
                // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
                userId: senderCard.userId,
                // ID user yang melakukan transaksi mencurigakan
                // transactionId null: BLOCK mencegah transaksi dibuat
                deviceId,
                // shorthand ES6: ID perangkat yang digunakan; disimpan untuk melacak perangkat mana yang melakukan transaksi
                // ID device NFC reader yang digunakan
                deviceName: 'NFC Card Reader',
                // Nama perangkat
                // Sentinel -1 jika Z null (σ=0, X≠μ). Jangan simpan 0 karena bisa diartikan normal.
                riskScore: fraudAnalysis.zScore !== null ? fraudAnalysis.zScore : -1,
                // Z-Score aktual, -1 jika undefined
                riskLevel: fraudAnalysis.riskLevel,
                // Level tertinggi karena BLOCK
                decision: fraudAnalysis.decision,
                idempotencyKey,
                // keputusan BLOCK otomatis: kartu hilang selalu diblokir tanpa perlu hitung Z-Score
                // Keputusan: blokir transaksi
                reasons: JSON.stringify(fraudAnalysis.reasons),
                // Alasan deteksi anomali
                confidence: 0.997,
                // Metadata confidence mengikuti kebijakan route dan bukan bukti bahwa transaksi pasti fraud.
                riskFactors: JSON.stringify({
                  // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
                  cardId: cardId.slice(0, 8) + '...',
                  // truncate cardId untuk keamanan; hanya 8 karakter pertama yang disimpan di log
                  // UID disamarkan (keamanan)
                  amount: amountNum,
                  // jumlah transaksi yang dianalisis Z-Score
                  // jumlah transaksi dalam satuan Rupiah; sudah divalidasi dan dikonversi ke float
                  // Jumlah transaksi
                  receiverId: receiverUser.id,
                  zScore: fraudAnalysis.zScore,
                  // Nilai Z
                  mean: fraudAnalysis.mean,
                  // Rata-rata historis
                  stdDev: fraudAnalysis.stdDev,
                  // Standar deviasi
                  n: fraudAnalysis.n,
                  // Jumlah data historis
                  algorithm: 'Z-Score Based Anomaly Detection',
                  // nama algoritma deteksi anomali yang digunakan
                  // Algoritma yang digunakan
                  thresholds: fraudAnalysis.thresholds
                  // batas Z-Score: ≤2 ALLOW, ≤3 REVIEW, >3 BLOCK; disimpan untuk transparansi
                  // Threshold Z-Score
                }),
                ipAddress: req.ip
                // req.ip: IP address perangkat yang melakukan transaksi; dicatat untuk audit trail keamanan
                // IP address pengirim
              }
          });
          req.io?.to('admin-room').emit('fraud-alert', blockedAlert);
          console.log(`🚨 BLOCK Fraud Alert Created (sebelum transaction): Z=${fraudAnalysis.zScore ?? 'null(σ=0)'} → BLOCK`);
          // Kegagalan penyimpanan alert masuk ke catch fraud dan menghentikan route sebelum saldo berubah.
        }

        // STEP 6d: Jika BLOCK → tolak transaksi, jangan ubah saldo
        if (fraudAnalysis.decision === 'BLOCK') {
          // BLOCK: transaksi dihentikan, saldo tidak berubah
          return res.status(403).json({
            // Return 403 Forbidden: transaksi ditolak sistem
            error: 'TRANSACTION_BLOCKED',
            // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
            message: 'Transaksi diblokir – anomali terdeteksi oleh Z-Score. Silakan hubungi Customer Service.',
            // pesan error user-friendly saat Z-Score mendeteksi anomali; ditampilkan di aplikasi mobile
            amount: amountNum,
            senderName: senderCard.user.name || senderCard.user.username,
            senderBalance: senderCard.user.balance,
            receiverBalance: receiverUser.balance,
            zScore: fraudAnalysis.zScore,
            // Nilai Z-Score untuk referensi user
            riskLevel: riskLevelMapped,
            // 'ANOMALY'
            decision: fraudAnalysis.decision,
            reasons: fraudAnalysis.reasons,
            // Alasan pemblokiran
          });
          // Client akan tampilkan pesan ini ke user
        }

        // STEP 6e: Jika REVIEW → transaksi tetap diproses, admin akan review di dashboard
        if (fraudAnalysis.decision === 'REVIEW') {
          // REVIEW: transaksi lanjut tapi ditandai suspicious
          console.log(`⚠️ Review Required: Card ${cardId.slice(0, 8)}... | Z-Score: ${fraudAnalysis.zScore}σ`);
          // Log untuk monitoring
        }

      } catch (fraudError) {
        if (fraudError.code === 'P2002') {
          const blockedAlert = await prisma.fraudAlert.findUnique({ where: { idempotencyKey } });
          if (blockedAlert?.decision === 'BLOCK') {
            if (!matchesBlockedPaymentFingerprint(
              blockedAlert,
              senderCard.userId,
              receiverUser.id,
              amountNum
            )) {
              return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
            }
            return res.status(403).json({
              error: 'TRANSACTION_BLOCKED',
              replayed: true,
              message: 'Transaksi sebelumnya telah diblokir.',
              amount: amountNum,
              senderName: senderCard.user.name || senderCard.user.username,
              senderBalance: senderCard.user.balance,
              receiverBalance: receiverUser.balance,
              zScore: blockedAlert.riskScore === -1 ? null : blockedAlert.riskScore,
              riskLevel: blockedAlert.riskLevel,
              decision: blockedAlert.decision,
              reasons: JSON.parse(blockedAlert.reasons)
            });
          }
        }
        // Gagal tertutup: jangan proses pembayaran jika baseline atau engine fraud tidak dapat diperiksa.
        console.error('Fraud detection error:', fraudError);
        return res.status(503).json({
          error: 'FRAUD_ANALYSIS_UNAVAILABLE',
          message: 'Analisis keamanan tidak tersedia. Saldo tidak berubah; silakan coba kembali.'
        });
        // Return menghentikan route sebelum validasi penerima dan sebelum transaksi saldo dimulai.
      }
    }
    // Jika ALLOW decision atau fraud detection disabled: lanjut ke payment processing

    // STEP 8: Execute ATOMIC TRANSACTION - All-or-Nothing Database Operations
    // =========================================================================
    // ⚠️ CRITICAL: Gunakan Prisma $transaction untuk ensure data consistency
    //
    // ACID Properties:
    // - Atomicity: Semua operations sukses ATAU semua di-rollback
    // - Consistency: Database tetap dalam valid state
    // - Isolation: Transaction tidak interfere dengan transaction lain
    // - Durability: Changes dipersist ke database setelah commit
    //
    // WHY ATOMIC?: Untuk prevent inconsistent state seperti:
    // - Money deducted from sender tapi tidak masuk ke receiver
    // - Card balance out of sync dengan user balance
    // - Transaction log incomplete
    //
    // OPERATIONS DALAM TRANSACTION:
    // 1. Deduct sender user balance
    // 2. Sync sender card balance
    // 3. Add receiver user balance
    // 4. Sync receiver card balance (jika card-to-card)
    // 5. Log sender NFCTransaction
    // 6. Log receiver NFCTransaction (jika card-to-card)
    // 7. Create Transaction record (main transaction table)
    // =========================================================================
    const result = await prisma.$transaction(async (tx) => {
      // Mulai Prisma transaction — semua operasi dalam blok ini adalah atomic
      // Prisma transaction: 'tx' adalah isolated Prisma client
      // Semua operations menggunakan 'tx', bukan 'prisma'
      
      // STEP 8a: Deduct balance dari SENDER USER (not card!)
      // Atomic conditional update: only decrement if balance is still sufficient
      // Prevents TOCTOU race condition where concurrent requests could deplete balance below 0
      const senderUpdateResult = await tx.user.updateMany({
        // tx.user.updateMany() dalam transaksi atomik: mengurangi saldo pengirim; updateMany digunakan untuk verifikasi atomic (dengan where balance >=)
        where: { id: senderCard.userId, balance: { gte: amountNum } },
        // Atomic balance check
        data: { balance: { decrement: amountNum } }
        // decrement: mengurangi saldo pengirim sebesar amountNum; operasi atomic di dalam transaksi database
      });
      if (senderUpdateResult.count === 0) {
        // count=0 berarti tidak ada record yang diperbarui; terjadi saat saldo tidak cukup (WHERE balance >= amount gagal)
        // Another concurrent transaction depleted the balance between our pre-check and now
        const err = new Error('Insufficient balance (concurrent transaction)');
        // membuat objek Error custom; pesan menjelaskan kemungkinan race condition dalam transaksi bersamaan
        err.code = 'INSUFFICIENT_BALANCE';
        // menambahkan property code ke objek Error; digunakan di catch block untuk identifikasi jenis error
        throw err;
        // melempar error ke catch tx (Prisma transaction); ini akan rollback semua perubahan dalam transaksi atomik
      }
      // Fetch updated sender user to get the new balance for card sync
      const updatedSenderUser = await tx.user.findUnique({ where: { id: senderCard.userId } });
      // membaca ulang data user pengirim setelah update; diperlukan untuk mendapatkan saldo terkini

      // STEP 8b: Update sender CARD - sync balance dengan user + update lastUsed
      const updatedSenderCard = await tx.nFCCard.update({
        // Update record NFCCard di database
        where: { cardId },
        // Identifikasi kartu berdasarkan UID
        data: {
          // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
          lastUsed: new Date(),
          // Track last activity
          balance: updatedSenderUser.balance
          // ✅ Sync: card balance = user balance
        }
      });
      // IMPORTANT: Card balance selalu sama dengan user balance (single source of truth)

      // STEP 8c & 8d: Add balance ke receiver (card atau user tergantung mode)
      let updatedReceiverCard = null;
      // Akan diisi jika mode card-to-card
      let updatedReceiverUser = null;
      // Akan selalu diisi (kedua mode update user balance)

      if (receiverCard) {
        // MODE 1: Penerima menggunakan kartu NFC (card-to-card)
        // MODE 1: Card-to-Card Transfer
        
        // Validate: receiver card harus linked ke user
        if (!receiverCard.userId) {
          // Kartu penerima belum diassign ke user manapun
          throw new Error('Receiver card not linked to any user');
          // Throw error: trigger rollback
          // Error ini akan trigger rollback seluruh transaction
        }
        
        // Update receiver USER balance
        const receiverUpdateResult = await tx.user.updateMany({
          where: {
            id: receiverCard.userId,
            balance: { lte: Number.MAX_VALUE - amountNum }
          },
          data: { balance: { increment: amountNum } }
        });
        if (receiverUpdateResult.count === 0) {
          const overflowError = new Error('BALANCE_OVERFLOW');
          overflowError.code = 'BALANCE_OVERFLOW';
          throw overflowError;
        }
        updatedReceiverUser = await tx.user.findUnique({ where: { id: receiverCard.userId } });

        // Update receiver CARD - sync balance dengan user + update lastUsed
        updatedReceiverCard = await tx.nFCCard.update({
          // Update kartu penerima
          where: { cardId: receiverCardId },
          // Identifikasi kartu berdasarkan UID penerima
          data: {
            // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
            lastUsed: new Date(),
            // Track last activity
            balance: updatedReceiverUser.balance
            // ✅ Sync: card balance = user balance
          }
        });
      } else {
        // MODE 2: Penerima hanya user (tidak ada kartu)
        // MODE 2: User-to-User Transfer
        const receiverUpdateResult = await tx.user.updateMany({
          where: {
            id: parseInt(receiverId),
            balance: { lte: Number.MAX_VALUE - amountNum }
          },
          data: { balance: { increment: amountNum } }
        });
        if (receiverUpdateResult.count === 0) {
          const overflowError = new Error('BALANCE_OVERFLOW');
          overflowError.code = 'BALANCE_OVERFLOW';
          throw overflowError;
        }
        updatedReceiverUser = await tx.user.findUnique({ where: { id: parseInt(receiverId) } });
        await tx.nFCCard.updateMany({
          where: { userId: updatedReceiverUser.id },
          data: { balance: updatedReceiverUser.balance }
        });
        // Semua kartu milik penerima mengikuti saldo user sebagai source of truth.
      }

      // STEP 8e: Log SENDER NFCTransaction (audit trail untuk sender)
      const senderBalanceBefore = senderCard.user?.balance || 0;
      // saldo pengirim sebelum transaksi; optional chaining jika relasi user tidak ada; || 0 sebagai fallback
      const senderBalanceAfter = updatedSenderUser.balance;
      // saldo pengirim setelah dikurangi amountNum; diambil dari hasil findUnique setelah update
      
      await tx.nFCTransaction.create({
        // mencatat transaksi topup NFC dalam transaction atomik; memastikan saldo update dan histori tersimpan bersama
      // mencatat transaksi NFC pengirim di dalam Prisma transaction; pastikan semua data tersimpan atomik
        data: {
          // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
          cardId,
          // Sender card UID
          transactionType: 'PAYMENT',
          // Type: PAYMENT (outgoing)
          amount: -amountNum,
          // Negative amount (deduction)
          balanceBefore: senderBalanceBefore,
          // Balance before payment
          balanceAfter: senderBalanceAfter,
          // Balance after payment
          deviceId,
          // Device yang digunakan
          location,
          // Location of transaction
          status: 'SUCCESS',
          // Transaction successful
          metadata: JSON.stringify({
            // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
            description,
            // Custom description dari user
            receiver: receiverCardId || `user:${receiverId}`,
            // Receiver identifier
            timestamp: new Date().toISOString()
            // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
          }),
          ipAddress: req.ip
          // IP address untuk security tracking
        }
      });
      // Log ini untuk: transaction history, receipt generation, analytics

      // STEP 8f: Log RECEIVER NFCTransaction (jika card-to-card transfer)
      if (updatedReceiverCard) {
        // memeriksa apakah penerima ada; kartu penerima opsional (bisa transfer ke account tanpa kartu)
        const receiverBalanceBefore = receiverCard.user?.balance || 0;
        // saldo penerima sebelum menerima transfer; optional chaining jika user tidak ada
        const receiverBalanceAfter = updatedReceiverUser.balance;
        // saldo penerima setelah menerima transfer; diambil dari updatedReceiverUser
        
        await tx.nFCTransaction.create({
          // mencatat transaksi NFC penerima; setiap sisi transfer (kirim/terima) dicatat terpisah untuk audit trail
          data: {
            // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
            cardId: receiverCardId,
            // Receiver card UID
            transactionType: 'TAP_IN',
            // Type: TAP_IN (incoming)
            amount: amountNum,
            // Positive amount (addition)
            balanceBefore: receiverBalanceBefore,
            // Balance before receive
            balanceAfter: receiverBalanceAfter,
            // Balance after receive
            deviceId,
            // Same device sebagai sender
            location,
            // Same location
            status: 'SUCCESS',
            // status SUCCESS: transaksi berhasil; dicatat sebagai bagian dari audit trail
            metadata: JSON.stringify({
              // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
              description,
              // shorthand ES6: deskripsi transaksi; bisa null jika tidak dikirim oleh client
              sender: cardId,
              // Sender card UID
              timestamp: new Date().toISOString()
              // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
            }),
            ipAddress: req.ip
            // IP perangkat yang memproses transaksi penerima; dicatat untuk audit trail
          }
        });
      }
      // Jika user-to-user transfer: no receiver card log (receiver tidak pakai card)

      // STEP 8g: Create main Transaction record — sertakan hasil fraud Z-Score
      // fraudRiskScore: nilai Z aktual, atau -1 jika Z tidak terdefinisi (σ=0, X≠μ)
      // fraudRiskLevel: NORMAL/SUSPICIOUS/ANOMALY
      // fraudReasons: JSON array alasan analisis
      // txRecord: digunakan sebagai transactionId pada FraudAlert REVIEW di dalam blok atomik ini
      let txRecord = null;
      // txRecord: menyimpan objek Transaction yang dibuat; null jika transaksi tidak memiliki user (anonymous)
      if (senderCard.userId && (receiverCard?.userId || receiverId)) {
        // kondisi: hanya buat Transaction record jika pengirim DAN penerima memiliki userId; transaksi anonymous tidak dicatat
        const fraudRiskMapped = lastFraudAnalysis?.riskLevel || null;
        // Gunakan label hasil engine; null hanya jika kartu tidak terhubung ke user dan analisis tidak dijalankan.
        txRecord = await tx.transaction.create({
          // membuat record Transaction di tabel transactions; berbeda dari NFCTransaction; ini untuk laporan keuangan
          data: {
            // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
            senderId: senderCard.userId,
            // ID user pengirim; diambil dari relasi kartu NFC
            receiverId: receiverCard?.userId || parseInt(receiverId),
            // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
            amount: amountNum,
            // jumlah yang ditransfer dalam Rupiah; digunakan dalam laporan keuangan
            type: 'nfc_payment',
            // tipe transaksi: pembayaran via NFC; membedakan dari transaksi transfer biasa
            status: 'completed',
            // status completed: transaksi selesai dan saldo sudah berubah; dicatat setelah update saldo berhasil
            description: description || 'NFC Card Payment',
            // deskripsi transaksi; fallback ke 'NFC Card Payment' jika tidak dikirim client
            deviceId,
            // shorthand ES6: ID perangkat yang melakukan transaksi NFC
            ipAddress: req.ip,
            // IP address perangkat transaksi; dicatat untuk audit trail
            // Hasil Z-Score tersimpan di Transaction untuk audit & histori
            fraudRiskScore: lastFraudAnalysis
            // nilai Z-Score dari analisis; histori kurang dari 20 menghasilkan sentinel 0 dan ALLOW sementara
              ? (lastFraudAnalysis.zScore !== null ? lastFraudAnalysis.zScore : -1)
              // nested ternary: gunakan zScore jika ada, -1 untuk edge case σ=0
              : null,
              // null hanya jika engine tidak dijalankan; histori kurang tetap menghasilkan hasil ALLOW/NORMAL
            fraudRiskLevel: fraudRiskMapped,
            // label risiko fraud yang sudah di-mapping; NORMAL/SUSPICIOUS/ANOMALY atau null
            fraudDecision: lastFraudAnalysis?.decision || 'ALLOW',
            idempotencyKey,
            fraudReasons: lastFraudAnalysis ? JSON.stringify(lastFraudAnalysis.reasons || []) : null
            // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          }
        });
      }
      // Transaction record ini untuk: user transaction history, accounting, reports

      let fraudAlertRecord = null;
      if (lastFraudAnalysis?.decision === 'REVIEW' && senderCard.userId) {
        // REVIEW wajib memiliki Transaction dan Fraud Alert dalam transaksi database yang sama.
        if (!txRecord) throw new Error('REVIEW_TRANSACTION_RECORD_MISSING');

        fraudAlertRecord = await tx.fraudAlert.create({
          data: {
            userId: senderCard.userId,
            transactionId: txRecord.id,
            deviceId,
            deviceName: 'NFC Card Reader',
            riskScore: lastFraudAnalysis.zScore ?? -1,
            riskLevel: lastFraudAnalysis.riskLevel,
            decision: lastFraudAnalysis.decision,
            idempotencyKey,
            reasons: JSON.stringify(lastFraudAnalysis.reasons),
            confidence: 0.95,
            riskFactors: JSON.stringify({
              cardId: cardId.slice(0, 8) + '...',
              amount: amountNum,
              zScore: lastFraudAnalysis.zScore,
              mean: lastFraudAnalysis.mean,
              stdDev: lastFraudAnalysis.stdDev,
              n: lastFraudAnalysis.n,
              algorithm: 'Z-Score Based Anomaly Detection',
              thresholds: lastFraudAnalysis.thresholds
            }),
            ipAddress: req.ip
          }
        });
        // Jika alert gagal, Prisma membatalkan mutasi saldo, log NFC, dan Transaction secara bersamaan.
      }

      // Return hasil atomic transaction untuk response sukses
      return { updatedSenderCard, updatedSenderUser, updatedReceiverCard, updatedReceiverUser, txRecord, fraudAlertRecord };
      // shorthand ES6: mengembalikan semua hasil update sebagai satu objek dari Prisma transaction
    });
    // Prisma $transaction auto-commit jika semua operations sukses
    // Jika ada error: auto-rollback (semua changes di-revert)

    // STEP 9: Log transaction success dengan detail lengkap
    const senderUsername = senderCard.user?.username || 'Unknown';
    // optional chaining: ambil username pengirim; fallback 'Unknown' jika relasi user tidak ada
    const receiverUsername = receiverCard?.user?.username || 'Unknown';
    // optional chaining ganda: kartu penerima mungkin tidak ada, user-nya juga mungkin tidak ada
    
    console.log(`✅ Transfer Success!`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    console.log(`   Pengirim: ${senderUsername} (${cardId.slice(0, 8)}...)`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    console.log(`   Penerima: ${receiverUsername} (${receiverCardId?.slice(0, 8) || 'user'}...)`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    console.log(`   💸 Amount: ${formatCurrency(amountNum)}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    console.log(`   💰 Saldo Pengirim: ${formatCurrency(result.updatedSenderUser.balance)}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    console.log(`   💵 Saldo Penerima: ${formatCurrency(result.updatedReceiverUser?.balance || 0)}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // Log format: Easy to read untuk real-time monitoring

    if (result.txRecord) req.io?.to('admin-room').emit('new-transaction', result.txRecord);
    if (result.fraudAlertRecord) req.io?.to('admin-room').emit('fraud-alert', result.fraudAlertRecord);
    req.io?.to('admin-room').emit('balance-updated', {
      senderId: senderCard.userId,
      senderBalance: result.updatedSenderUser.balance,
      receiverId: receiverUser.id,
      receiverBalance: result.updatedReceiverUser?.balance
    });

    // STEP 10: Return success response ke client (201 Created: transaksi baru berhasil dibuat)
    res.status(201).json({
      // mengirim response 201 Created; resource baru berhasil dibuat di database
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Payment processed successfully',
      // pesan sukses pembayaran NFC; dikirim setelah semua operasi database dalam transaksi atomik berhasil
      transaction: {
        // objek transaction berisi detail pembayaran yang dikirim ke aplikasi mobile
        amount: amountNum,
        // Transfer amount
        senderName: senderCard.user.name || senderCard.user.username,
        senderBalance: result.updatedSenderUser.balance,
        // Sender balance setelah payment
        receiverBalance: result.updatedReceiverUser?.balance,
        // Receiver balance setelah payment
        timestamp: new Date(),
        // Transaction timestamp
        // Fraud detection results (untuk ditampilkan di mobile app)
        fraudRiskLevel: lastFraudAnalysis?.riskLevel || 'NORMAL',
        // Gunakan riskLevel hasil engine; default NORMAL hanya jika kartu tidak memiliki user untuk dianalisis.
        fraudRiskScore: lastFraudAnalysis ? (lastFraudAnalysis.zScore !== null ? lastFraudAnalysis.zScore : null) : null,
        // Z-Score aktual; null jika σ=0
        fraudDecision: lastFraudAnalysis?.decision || 'ALLOW'
        // ALLOW/REVIEW/BLOCK
      }
    });
    // Client akan display success message dan updated balances ke user

  } catch (error) {
    // Error handling - tangkap semua error (Prisma, validation, network, dll)
    console.error('❌ Payment error:', error);
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance', message: 'Saldo tidak mencukupi (transaksi bersamaan)' });
    }
    if (error.code === 'BALANCE_OVERFLOW') {
      return res.status(400).json({ error: 'BALANCE_OVERFLOW' });
    }
    if (error.code === 'P2002' && idempotencyKey) {
      const existingTransaction = await prisma.transaction.findUnique({
        where: { idempotencyKey },
        include: { sender: true, receiver: true }
      });
      if (existingTransaction) {
        if (!paymentFingerprint || !matchesPaymentFingerprint(
          existingTransaction,
          paymentFingerprint.senderId,
          paymentFingerprint.receiverId,
          paymentFingerprint.amount
        )) {
          return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
        }
        return res.json({
          success: true,
          replayed: true,
          message: 'Payment already processed',
          transaction: {
            id: existingTransaction.id,
            amount: existingTransaction.amount,
            senderName: existingTransaction.sender.name || existingTransaction.sender.username,
            senderBalance: existingTransaction.sender.balance,
            receiverBalance: existingTransaction.receiver.balance,
            timestamp: existingTransaction.createdAt,
            fraudRiskLevel: existingTransaction.fraudRiskLevel || 'NORMAL',
            fraudRiskScore: existingTransaction.fraudRiskScore,
            fraudDecision: existingTransaction.fraudDecision || 'ALLOW'
          }
        });
      }
    }
    res.status(500).json({ error: 'Payment failed' });
    // Jika error terjadi dalam $transaction: automatic rollback (no partial updates)
  }
});
// ============================================================================
// END OF ENDPOINT: POST /payment
// ============================================================================
// SUMMARY: Endpoint ini handle complex payment flow dengan:
// - Statistical fraud detection (Z-Score algorithm)
// - Atomic transactions (ACID compliance)
// - Balance synchronization (user ↔ card)
// - Comprehensive logging & audit trail
// Total ~200 lines of code untuk ensure secure & reliable payments
// ============================================================================

// ============================================================================
// ENDPOINT: POST /topup - Top up saldo kartu NFC (Admin only)
// ============================================================================
// USE CASE: Admin menambahkan saldo ke kartu user (manual top-up)
// AUTHORIZATION: Require bearer admin JWT
//
// FLOW TOP-UP:
//
// STEP 1: Extract & validate parameters (cardId, amount)
// STEP 2: Verify admin JWT untuk authorization
// STEP 3: Parse & validate amount (must be positive)
// STEP 4: Validate card exists di database
// STEP 5: Execute atomic transaction:
//         5a. Increment card balance
//         5b. Log NFCTransaction (type: TOP_UP)
//         5c. Log AdminLog (audit trail untuk admin action)
// STEP 6: Log success
// STEP 7: Return success response dengan old & new balance
// ============================================================================
router.post('/topup', authenticateAdmin, async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract required parameters
    const { cardId, amount } = req.body;
    // Authorization berasal dari bearer admin JWT yang diverifikasi middleware.
    if (!cardId || !amount) return res.status(400).json({ error: 'Card ID and amount required' });
    // validasi singkat: keduanya wajib ada; return inline tanpa blok untuk efisiensi
    
    // STEP 2: Verify admin identity from bearer JWT (AUTHORIZATION CHECK)
    if (!req.admin) {
      // Guard defensif menolak top-up jika middleware tidak menyediakan identitas admin.
      return res.status(401).json({ error: 'Invalid admin password' });
      // Tolak request sebelum saldo kartu diubah.
    }
    // Only admin dapat melakukan top-up (prevent unauthorized balance manipulation)

    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY' });
    }

    // STEP 3: Parse & validate amount
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    const amountNum = amount;

    // STEP 4: Validate card exists
    const card = await prisma.nFCCard.findUnique({ where: { cardId } });
    // const card: menyimpan data kartu NFC yang diambil dari database secara async
    if (!card) return res.status(404).json({ error: 'Card not found' });
    // 404 jika kartu tidak ditemukan di database

    const existingTopup = await prisma.nFCTransaction.findUnique({ where: { idempotencyKey } });
    if (existingTopup) {
      if (existingTopup.cardId !== cardId || existingTopup.amount !== amountNum) {
        return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
      }
      const currentCard = await prisma.nFCCard.findUnique({ where: { cardId } });
      return res.json({
        success: true,
        replayed: true,
        message: 'Card top-up already processed',
        card: {
          cardId: currentCard.cardId,
          balance: existingTopup.balanceAfter,
          previousBalance: existingTopup.balanceBefore
        }
      });
    }

    const currentBalance = card.user?.balance ?? card.balance;
    if (!Number.isFinite(currentBalance + amountNum)) {
      return res.status(400).json({ error: 'BALANCE_OVERFLOW' });
    }

    // STEP 5: Execute atomic transaction (3 operations: update balance, log transaction, log admin action)
    const updatedCard = await prisma.$transaction(async (tx) => {
      // prisma.$transaction(): memastikan update saldo, log NFC, dan log admin tersimpan bersama secara atomik
      let updated;
      if (card.userId) {
        const userUpdateResult = await tx.user.updateMany({
          where: {
            id: card.userId,
            balance: { lte: Number.MAX_VALUE - amountNum }
          },
          data: { balance: { increment: amountNum } },
        });
        if (userUpdateResult.count === 0) {
          const overflowError = new Error('BALANCE_OVERFLOW');
          overflowError.code = 'BALANCE_OVERFLOW';
          throw overflowError;
        }
        const updatedUser = await tx.user.findUnique({
          where: { id: card.userId },
          select: { balance: true }
        });
        await tx.nFCCard.updateMany({
          where: { userId: card.userId },
          data: { balance: updatedUser.balance }
        });
        updated = await tx.nFCCard.update({
          where: { cardId },
          data: { lastUsed: new Date() }
        });
      } else {
        const cardUpdateResult = await tx.nFCCard.updateMany({
          where: {
            cardId,
            balance: { lte: Number.MAX_VALUE - amountNum }
          },
          data: { balance: { increment: amountNum }, lastUsed: new Date() }
        });
        if (cardUpdateResult.count === 0) {
          const overflowError = new Error('BALANCE_OVERFLOW');
          overflowError.code = 'BALANCE_OVERFLOW';
          throw overflowError;
        }
        updated = await tx.nFCCard.findUnique({ where: { cardId } });
      }

      // STEP 5b: Log top-up transaction ke NFCTransaction table
      await tx.nFCTransaction.create({
        // tx.nFCTransaction.create(): mencatat transaksi topup dalam transaction atomik; tersimpan bersama update saldo
        data: {
          // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
          cardId,
          // Card yang di-topup
          transactionType: 'TOP_UP',
          // Type: TOP_UP (incoming balance)
          amount: amountNum,
          // Positive amount (addition)
          balanceBefore: card.balance,
          // Balance before top-up
          balanceAfter: updated.balance,
          // Balance after top-up
          deviceId: 'admin',
          // Device: 'admin' (manual top-up from dashboard)
          status: 'SUCCESS',
          // status SUCCESS karena dalam Prisma transaction yang sudah berhasil
          ipAddress: req.ip,
          // Admin IP address
          idempotencyKey
        }
      });

      // STEP 5c: Log admin action ke AdminLog table (audit trail)
      await tx.adminLog.create({
        // mencatat aksi topup admin ke AdminLog dalam transaction yang sama; audit trail tersimpan atomik bersama perubahan saldo
        data: {
          // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
          action: 'CARD_TOP_UP',
          // Action type
          details: JSON.stringify({
            // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
            cardId,
            // ID kartu yang di-topup; shorthand ES6
            amount: amountNum,
            // jumlah saldo yang ditambahkan
            oldBalance: card.balance,
            // saldo sebelum topup; dari objek card yang diambil sebelum update
            newBalance: updated.balance
            // saldo setelah topup; dari hasil update
          }),
          ipAddress: req.ip,
          // IP admin yang melakukan topup
          userAgent: req.headers['user-agent']
          // Track admin browser/device
        }
      });
      // AdminLog untuk: compliance, security audits, admin activity tracking

      return updated;
      // Return updated card
    });
    // Transaction selesai - semua 3 operations committed atomically

    // STEP 6: Log success ke console
    console.log(`💰 Card topped up: ${cardId.slice(0, 8)}... +${formatCurrency(amountNum)}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 7: Return success response
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Card topped up successfully',
      // pesan sukses topup kartu; dikirim setelah semua operasi dalam transaction berhasil
      card: {
        // objek card berisi data kartu setelah topup
        cardId: updatedCard.cardId,
        // ID kartu yang di-topup
        balance: updatedCard.balance,
        // New balance kartu
        previousBalance: card.balance
        // Old balance (untuk comparison)
      }
    });

  } catch (error) {
    if (error.code === 'BALANCE_OVERFLOW') {
      return res.status(400).json({ error: 'BALANCE_OVERFLOW' });
    }
    if (error.code === 'P2002' && idempotencyKey) {
      const existingTopup = await prisma.nFCTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTopup && existingTopup.cardId === req.body.cardId && existingTopup.amount === req.body.amount) {
        return res.json({
          success: true,
          replayed: true,
          message: 'Card top-up already processed',
          card: {
            cardId: existingTopup.cardId,
            balance: existingTopup.balanceAfter,
            previousBalance: existingTopup.balanceBefore
          }
        });
      }
      return res.status(409).json({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
    }
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Top-up error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika proses topup kartu gagal
      error: 'Top-up failed'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: POST /topup
// ============================================================================

// ============================================================================
// ENDPOINT: PUT /my-status - Update status kartu NFC (User only, own card)
// ============================================================================
// USE CASE: User memblokir atau mengaktifkan kembali kartu miliknya sendiri
// AUTHORIZATION: JWT token (user hanya bisa ubah kartu yang terhubung ke akunnya)
// ============================================================================
router.put('/my-status', authenticateToken, async (req, res) => {
  try {
    const { cardId, status } = req.body;
    if (!cardId || !status) return res.status(400).json({ error: 'Card ID and status required' });

    const validStatuses = ['ACTIVE', 'BLOCKED', 'LOST'];
    // array status kartu yang valid; digunakan untuk validasi input agar hanya status resmi yang bisa di-set
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', validStatuses });
    }

    // Cari kartu dan pastikan kartu terhubung ke user yang request
    const card = await prisma.nFCCard.findUnique({ where: { cardId } });
    // query kartu dari DB berdasarkan cardId; findUnique mengembalikan null jika tidak ditemukan
    if (!card) return res.status(404).json({ error: 'Card not found' });
    if (card.userId !== req.user.id) {
      return res.status(403).json({ error: 'CARD_ACCESS_DENIED' });
    }

    // Keterhubungan kartu sudah diverifikasi terhadap userId dari JWT.
    const updatedCard = await prisma.nFCCard.update({
    // update cardStatus di DB; mengembalikan data kartu yang sudah diperbarui
      where: { cardId },
      data: { cardStatus: status, updatedAt: new Date() },
    });

    console.log(`🔒 User card status updated: ${cardId.slice(0, 8)}... → ${status}`);
    res.json({ success: true, message: `Card ${status.toLowerCase()} successfully`, card: updatedCard });
  } catch (error) {
    console.error('❌ User status update error:', error);
    res.status(500).json({ error: 'Failed to update card status' });
  }
});

// ============================================================================
// ENDPOINT: DELETE /my-card/:cardId - Hapus kartu NFC user sendiri
// ============================================================================
// USE CASE: User menghapus kartunya (kartu hilang, ingin daftar kartu baru)
// AUTHORIZATION: JWT token (user hanya bisa hapus kartu yang terhubung ke akunnya)
// Setelah dihapus, user bisa daftar kartu baru via /register
// ============================================================================
router.delete('/my-card/:cardId', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;

    const card = await prisma.nFCCard.findUnique({ where: { cardId }, include: { user: true } });
    // query kartu beserta data user terkait; include: { user: true } melakukan JOIN ke tabel User
    if (!card) return res.status(404).json({ error: 'Card not found' });
    if (card.userId !== req.user.id) {
      return res.status(403).json({ error: 'CARD_ACCESS_DENIED' });
    }

    // Hapus transaksi terkait dulu (cascade manual)
    await prisma.nFCTransaction.deleteMany({ where: { cardId } });
    await prisma.nFCCard.delete({ where: { cardId } });

    console.log(`🗑️ User deleted own card: ${cardId} (User: ${card.user?.username})`);
    res.json({
      success: true,
      message: 'Card deleted successfully. You can now register a new card.',
      deletedCardId: cardId,
    });
  } catch (error) {
    console.error('❌ User delete card error:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// ============================================================================
// ENDPOINT: PUT /status - Update status kartu NFC (Admin only)
// ============================================================================
// USE CASE: Admin mengubah status kartu (block, unblock, mark as lost, expire)
// AUTHORIZATION: Require bearer JWT admin
//
// STATUS OPTIONS:
// - ACTIVE:  Kartu normal, dapat digunakan untuk transaksi
// - BLOCKED: Kartu diblokir (fraud, violation, user request), tidak dapat transaksi
// - LOST:    Kartu dilaporkan hilang, trigger fraud alert jika digunakan
// - EXPIRED: Kartu kadaluarsa, tidak dapat digunakan
//
// FLOW UPDATE STATUS:
//
// STEP 1: Extract & validate parameters (cardId, status, reason)
// STEP 2: Verify admin identity dari bearer JWT
// STEP 3: Validate status value (must be ACTIVE, BLOCKED, LOST, or EXPIRED)
// STEP 4: Validate card exists di database
// STEP 5: Update card status + timestamp
// STEP 6: Log admin action ke AdminLog table (audit trail)
// STEP 7: Return updated card dengan user info
// ============================================================================
router.put('/status', authenticateAdmin, async (req, res) => {
  // router.put() mendaftarkan endpoint HTTP PUT; untuk memperbarui data yang sudah ada
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract parameters
    const { cardId, status, reason } = req.body;
    // Authorization berasal dari bearer admin JWT yang diverifikasi middleware.
    if (!cardId || !status) return res.status(400).json({ error: 'Card ID and status required' });
    // validasi wajib: cardId dan status harus ada
    
    // STEP 2: Verify admin identity from bearer JWT (AUTHORIZATION CHECK)
    if (!req.admin) {
      // Guard defensif menolak perubahan status jika identitas admin tidak tersedia.
      return res.status(401).json({ error: 'Invalid admin password' });
      // Tolak request sebelum status kartu diperbarui.
    }

    // STEP 3: Validate status value (enum validation)
    const validStatuses = ['ACTIVE', 'BLOCKED', 'LOST', 'EXPIRED'];
    // daftar status kartu yang valid; digunakan untuk enum validation sebelum update
    if (!validStatuses.includes(status)) {
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(400).json({ error: 'Invalid status', validStatuses });
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
    }
    // Status harus salah satu dari 4 options: ACTIVE | BLOCKED | LOST | EXPIRED

    // STEP 4: Validate card exists
    const card = await prisma.nFCCard.findUnique({ where: { cardId } });
    // const card: menyimpan data kartu NFC yang diambil dari database secara async
    if (!card) return res.status(404).json({ error: 'Card not found' });
    // 404 jika kartu tidak ditemukan; tidak bisa update status kartu yang tidak ada

    // STEP 5: Update card status di database
    const result = await prisma.$transaction(async tx => {
      const updateResult = await tx.nFCCard.updateMany({
      // prisma.nFCCard.update(): memperbarui field cardStatus kartu berdasarkan perintah admin
      where: { cardId, cardStatus: card.cardStatus },
      // identifikasi kartu berdasarkan cardId yang unik
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        cardStatus: status,
        // Update status (ACTIVE/BLOCKED/LOST/EXPIRED)
        updatedAt: new Date()
        // Update timestamp
      }
      });
      const updated = await tx.nFCCard.findUnique({
      where: { cardId },
      include: {
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        user: {
          // Include user info dalam response
          select: {
            // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
            id: true,
            // ID user terkait kartu
            name: true,
            // nama user untuk ditampilkan di response
            username: true
            // username login user
          }
        }
      }
      });

      if (updateResult.count === 0) {
        return updated.cardStatus === status
          ? { card: updated, replayed: true }
          : { card: updated, conflict: true };
      }

    // STEP 6: Log admin action ke AdminLog table (audit trail)
      await tx.adminLog.create({
      // await prisma.adminLog.create(): mencatat aksi admin ke tabel AdminLog untuk audit trail; setiap aksi admin dicatat
      data: {
        // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
        action: 'CARD_STATUS_UPDATE',
        // Action type
        details: JSON.stringify({
          // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
          cardId,
          // shorthand ES6: ID kartu yang statusnya diubah
          oldStatus: card.cardStatus,
          // Previous status (untuk comparison)
          newStatus: status,
          // New status
          reason: reason || 'No reason provided'
          // Admin reason (optional field)
        }),
        ipAddress: req.ip,
        // IP admin yang mengubah status kartu
        userAgent: req.headers['user-agent']
        // Track admin device/browser
      }
      });
      return { card: updated, replayed: false };
    });
    if (result.replayed) {
      return res.json({ success: true, replayed: true, message: `Card already ${status.toLowerCase()}`, card: result.card });
    }
    if (result.conflict) {
      return res.status(409).json({ error: 'CARD_STATUS_CHANGED_RETRY', card: result.card });
    }
    const updatedCard = result.card;
    // AdminLog penting untuk: compliance, security audits, investigation fraud

    // Log ke console untuk monitoring
    console.log(`🔒 Card status updated: ${cardId.slice(0, 8)}... ${card.cardStatus} → ${status}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 7: Return success response
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: `Card ${status.toLowerCase()} successfully`,
      // template literal: pesan sukses status update dinamis sesuai status yang dipilih
      card: updatedCard
      // Include updated card dengan user info
    });

    req.io?.to('admin-room').emit('card-status-updated', { card: updatedCard });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Status update error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika update status kartu gagal
      error: 'Failed to update card status'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: PUT /status
// ============================================================================

// ============================================================================
// ENDPOINT: GET / atau GET /list - List semua kartu NFC dengan filters & pagination
// ============================================================================
// USE CASE: Admin atau app perlu melihat daftar kartu NFC yang terdaftar
// FEATURES:
// - Filter by status (ACTIVE/BLOCKED/LOST/EXPIRED)
// - Filter by userId (kartu milik user tertentu)
// - Pagination (limit + offset)
// - Sorting (sortBy + order)
//
// QUERY PARAMETERS:
// - status (optional): Filter by card status
// - userId (optional): Filter by user ID (cards owned by specific user)
// - limit (default: 50): Maximum cards to return
// - offset (default: 0): Skip N cards (for pagination)
// - sortBy (default: 'createdAt'): Sort field (createdAt, balance, updatedAt, dll)
// - order (default: 'desc'): Sort order (desc atau asc)
//
// FLOW:
// STEP 1: Extract query parameters dengan default values
// STEP 2: Build where clause untuk filtering (status, userId)
// STEP 3: Query cards dengan Prisma (include user relation)
// STEP 4: Count total cards (untuk pagination info)
// STEP 5: Return cards dengan pagination metadata
// ============================================================================
router.get(['/', '/list'], authenticateAdmin, async (req, res) => {
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract query parameters dengan default values
    const {
      // destructuring req.query dengan multiple parameter untuk filter dan pagination kartu NFC
      status,
      // Filter by status (optional)
      userId,
      // Filter by user (optional)
      limit = 50,
      // Default: 50 cards per page
      offset = 0,
      // Default: start from beginning
      sortBy = 'createdAt',
      // Default: sort by registration date
      order = 'desc'
      // Default: newest first
    } = req.query;
    // mengambil semua query parameter untuk filter, search, dan pagination
    const pagination = parsePagination(limit, offset);
    if (!pagination) return res.status(400).json({ error: 'INVALID_PAGINATION' });
    const allowedSortFields = new Set([
      'registeredAt', 'createdAt', 'updatedAt', 'lastUsed', 'balance', 'cardStatus', 'cardId'
    ]);
    if (!allowedSortFields.has(sortBy) || !['asc', 'desc'].includes(order)) {
      return res.status(400).json({ error: 'INVALID_SORT' });
    }

    // STEP 2: Build where clause untuk filtering
    const whereClause = {};
    // whereClause: objek kosong yang akan diisi kondisi WHERE secara dinamis berdasarkan query parameter yang dikirim
    if (status) whereClause.cardStatus = status;
    // Filter by status jika provided
    if (userId !== undefined) {
      const userIdNumber = Number(userId);
      if (!Number.isSafeInteger(userIdNumber) || userIdNumber <= 0) {
        return res.status(400).json({ error: 'INVALID_USER_ID' });
      }
      whereClause.userId = userIdNumber;
    }
    // Filter by user jika provided
    // whereClause akan dikirim ke Prisma untuk SQL WHERE condition

    // STEP 3: Query cards dari database dengan filters, sorting, pagination
    const cards = await prisma.nFCCard.findMany({
      // const cards: menyimpan array kartu NFC yang diambil dari database secara async
      where: whereClause,
      // kondisi filter dinamis yang dibangun berdasarkan query parameter yang dikirim
      include: {
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        user: {
          // Include user data untuk setiap card
          select: {
            // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
            id: true,
            // ID user terkait kartu untuk referensi
            name: true,
            // nama user terkait kartu
            username: true,
            // username login
            balance: true
            // saldo user
          }
        }
      },
      orderBy: { [sortBy]: order },
      // Dynamic sorting (createdAt desc, balance asc, dll)
      take: pagination.limit,
      // LIMIT clause (SQL)
      skip: pagination.offset
      // OFFSET clause (SQL)
    });
  

    // STEP 4: Count total cards untuk pagination metadata
    const total = await prisma.nFCCard.count({ where: whereClause });
    // menghitung total kartu yang sesuai filter; digunakan untuk pagination di frontend

    console.log(`📋 Listed ${cards.length} NFC cards (Total: ${total})`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 5: Return success response dengan pagination info
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      cards,
      // Array of card objects
      total,
      // Total count (all cards, ignoring pagination)
      pagination: {
        // objek pagination berisi informasi halaman untuk frontend
        total,
        // total kartu yang sesuai filter
        limit: pagination.limit,
        // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        offset: pagination.offset,
        // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        hasMore: total > pagination.offset + pagination.limit
        // Boolean: ada page berikutnya?
      }
    });
    // Client dapat gunakan hasMore untuk show "Load More" button

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ List cards error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika query daftar semua kartu NFC gagal
      success: false,
      // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
      error: 'Failed to list cards'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: GET /list
// ============================================================================

// ============================================================================
// ENDPOINT: GET /transactions/:cardId - Riwayat transaksi kartu NFC
// ============================================================================
// USE CASE: User atau admin ingin melihat history transaksi dari specific card
// FEATURES:
// - Pagination (limit + offset)
// - Sorted by newest first (createdAt desc)
// - Parse metadata JSON untuk readable format
//
// QUERY PARAMETERS:
// - :cardId (URL param): Card UID yang ingin dilihat history-nya
// - limit (default: 50): Maximum transactions to return
// - offset (default: 0): Skip N transactions
//
// FLOW:
// STEP 1: Extract cardId dari URL params & query params (limit, offset)
// STEP 2: Query transactions dari NFCTransaction table
// STEP 3: Count total transactions
// STEP 4: Parse metadata JSON (convert string to object)
// STEP 5: Return transactions dengan pagination metadata
// ============================================================================
router.get('/transactions/:cardId', authenticateUserOrAdmin, async (req, res) => {
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract parameters
    const { cardId } = req.params;
    // destructuring req.params: mengambil cardId dari URL dinamis /cards/:cardId
    // URL param: /transactions/:cardId
    const { limit = 50, offset = 0 } = req.query;
    const pagination = parsePagination(limit, offset);
    if (!pagination) return res.status(400).json({ error: 'INVALID_PAGINATION' });
        const ownedCard = await prisma.nFCCard.findUnique({ where: { cardId }, select: { userId: true } });
        if (!ownedCard) return res.status(404).json({ error: 'Card not found' });
        if (!req.admin && ownedCard.userId !== req.user.id) {
          return res.status(403).json({ error: 'CARD_ACCESS_DENIED' });
        }

    // Query params: ?limit=10&offset=0

    // STEP 2: Query transactions dari database (sorted by newest first)
    const transactions = await prisma.nFCTransaction.findMany({
      // const transactions: menyimpan array riwayat transaksi dari backend
      where: { cardId },
      // Filter by specific card
      orderBy: { createdAt: 'desc' },
      // Sort: newest first
      take: pagination.limit,
      // Limit results
      skip: pagination.offset
      // Pagination offset
    });
    // Returns: Array of NFCTransaction records untuk card ini

    // STEP 3: Count total transactions untuk pagination info
    const total = await prisma.nFCTransaction.count({ where: { cardId } });
    // menghitung total transaksi untuk kartu ini; digunakan untuk pagination hasil riwayat

    console.log(`📜 Listed ${transactions.length} transactions for card ${cardId.slice(0, 8)}...`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 4: Parse metadata JSON (convert string -> object untuk easier consumption)
    const parsedTransactions = transactions.map(t => ({
      // .map() mengubah setiap transaksi: parse field JSON string (metadata) menjadi objek JavaScript
      ...t,
      // Spread all fields
      metadata: t.metadata ? JSON.parse(t.metadata) : null
      // Parse JSON string
    }));
    // metadata field di database: "{\"description\":\"Payment\",...}" (string)
    // After parse: { description: "Payment", ... } (object)

    // STEP 5: Return success response
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      transactions: parsedTransactions,
      // array transaksi yang sudah di-parse dan diformat; siap ditampilkan di frontend
      total,
      // Total count (all transactions)
      pagination: {
        // objek pagination untuk navigasi halaman riwayat transaksi
        total,
        // total semua transaksi kartu ini
        limit: pagination.limit,
        // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        offset: pagination.offset,
        // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        hasMore: total > pagination.offset + pagination.limit
        // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
      }
    });

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Get transactions error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika query riwayat transaksi gagal
      success: false,
      // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
      error: 'Failed to get transactions'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: GET /transactions/:cardId
// ============================================================================

// ============================================================================
// ENDPOINT: GET /info/:cardId - Info detail kartu NFC lengkap
// ============================================================================
// USE CASE: User atau admin ingin melihat detail lengkap dari specific card
// FEATURES:
// - Card info lengkap (status, balance, user, dll)
// - Recent 10 transactions
// - Transaction statistics (total count, total amount)
//
// QUERY PARAMETERS:
// - :cardId (URL param): Card UID yang ingin dilihat info-nya
//
// FLOW:
// STEP 1: Extract cardId dari URL params
// STEP 2: Query card dengan relations (user, recent transactions)
// STEP 3: Calculate transaction statistics (aggregate sum + count)
// STEP 4: Parse metadata JSON
// STEP 5: Return card info + statistics
// ============================================================================
router.get('/info/:cardId', authenticateUserOrAdmin, async (req, res) => {
  // router.get() mendaftarkan endpoint HTTP GET; dipanggil saat ada request GET ke URL tersebut
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract cardId dari URL param
    const { cardId } = req.params;
    // destructuring req.params: mengambil cardId dari URL dinamis /info/:cardId
    
    // STEP 2: Query card dari database dengan relations
    const card = await prisma.nFCCard.findUnique({
      // const card: menyimpan data kartu NFC yang diambil dari database secara async
      where: { cardId },
      // filter: mencari kartu berdasarkan cardId yang unik
      include: {
        // include: { } melakukan JOIN dengan tabel relasi; setara JOIN di SQL; mengambil data dari tabel terkait sekaligus
        user: {
          // Include user info lengkap
          select: {
            // select: { } menentukan field mana yang diambil dari database; hanya field yang didaftarkan yang dikembalikan (lebih efisien dari SELECT *)
            id: true,
            // ID user terkait kartu
            name: true,
            // nama lengkap user
            username: true,
            // username login
            balance: true,
            // saldo user
            isActive: true
            // User account status
          } 
        },
        transactions: {
          // Include recent 10 transactions
          take: 10,
          // Limit 10 transactions
          orderBy: { createdAt: 'desc' }
          // Newest first
        }
      }
    });
    // Returns: Card object dengan nested user & transactions

    if (!card) return res.status(404).json({ error: 'Card not found' });
    // 404 jika kartu tidak ditemukan; tidak bisa tampilkan info kartu yang tidak ada
    if (!req.admin && card.userId !== req.user.id) {
      return res.status(403).json({ error: 'CARD_ACCESS_DENIED' });
    }

    // STEP 3: Calculate transaction statistics (aggregate functions)
    const stats = await prisma.nFCTransaction.aggregate({
      // prisma.nFCTransaction.aggregate(): menghitung statistik transaksi (SUM, COUNT) secara efisien tanpa load semua data
      where: { cardId },
      // filter: hanya hitung transaksi dari kartu ini
      _sum: { amount: true },
      // Total amount (sum all transactions)
      _count: true
      // Total transaction count
    });
    // Aggregate: efficient SQL operations (SUM, COUNT tanpa loading all records)

    console.log(`ℹ️ Card info retrieved: ${cardId.slice(0, 8)}...`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 4 & 5: Return card info + statistics
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      card: {
        // objek card berisi detail lengkap kartu yang diminta
        ...card,
        // Spread all card fields
        metadata: card.metadata ? JSON.parse(card.metadata) : null
        // Parse JSON
      },
      statistics: {
        // objek statistik berisi ringkasan aktivitas transaksi kartu
        totalTransactions: stats._count,
        // Total transaction count
        totalAmount: stats._sum.amount || 0
        // Total amount (all transactions combined)
      }
    });
    // Response berisi: card details, user info, recent transactions, statistics

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Get card info error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika query info detail kartu gagal
      success: false,
      // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
      error: 'Failed to get card info'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: GET /info/:cardId
// ============================================================================

// ============================================================================
// ENDPOINT: DELETE /:cardId atau /delete/:cardId - Hapus kartu NFC (Admin only)
// ============================================================================
// USE CASE: Admin ingin menghapus kartu dari sistem (permanent deletion)
// AUTHORIZATION: Require bearer JWT admin
// ⚠️ WARNING: Ini adalah DESTRUCTIVE operation - tidak bisa di-undo!
//
// FLOW:
// STEP 1: Extract cardId; authorization sudah diverifikasi middleware
// STEP 2: Verify admin identity from bearer JWT
// STEP 3: Validate card exists
// STEP 4: Delete cascade - delete related transactions first (foreign key constraint)
// STEP 5: Delete card record
// STEP 6: Return deletion confirmation
// ============================================================================
router.delete(['/:cardId', '/delete/:cardId'], authenticateAdmin, async (req, res) => {
  // router.delete() mendaftarkan endpoint HTTP DELETE; untuk menghapus data
  try {
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // STEP 1: Extract parameters
    const { cardId } = req.params;
    // URL param: /delete/:cardId

    // STEP 2: Verify admin identity from bearer JWT (AUTHORIZATION CHECK)
    if (!req.admin) {
      // Guard defensif menolak penghapusan jika identitas admin tidak tersedia.
      return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
      // Return menghentikan route sebelum kartu dihapus.
    }
    // Identitas admin tersedia setelah verifikasi middleware.
    console.log(`✅ DELETE card auth passed for card: ${cardId}`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 3: Validate card exists
    const card = await prisma.nFCCard.findUnique({
      // const card: menyimpan data kartu NFC yang diambil dari database secara async
      where: { cardId },
      // filter untuk mencari kartu yang akan dihapus
      include: { user: true }
      // Include user untuk logging purposes
    });
    
    if (!card) {
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      return res.status(404).json({ error: 'Card not found' });
      // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
    }

    // STEP 4: Delete related transactions first (foreign key cascade)
    // ⚠️ IMPORTANT: Must delete child records before parent (referential integrity)
    await prisma.nFCTransaction.deleteMany({ where: { cardId } });
    // hapus semua transaksi NFC kartu terlebih dahulu (cascade delete manual karena FK constraint)
    // deleteMany: delete all transactions untuk kartu ini

    // STEP 5: Delete card record (parent table)
    await prisma.nFCCard.delete({ where: { cardId } });
    // hapus record kartu NFC setelah semua data terkait dihapus; setara DELETE WHERE cardId = ?
    // After this: card permanently deleted from database

    // Log deletion event
    console.log(`🗑️ Card deleted: ${cardId} (User: ${card.user?.username || 'unlinked'})`);
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

    // STEP 6: Return deletion confirmation
    res.json({
      // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
      success: true,
      // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
      message: 'Card deleted successfully',
      // pesan sukses penghapusan kartu
      deletedCard: {
        // objek berisi data kartu yang dihapus untuk konfirmasi ke client
        cardId: card.cardId,
        // cardId yang dihapus; untuk konfirmasi
        userId: card.userId,
        // ID user terkait kartu yang dihapus
        username: card.user?.username
        // Info user yang kehilangan kartu
      }
    });
    // Client akan display confirmation: "Card {UID} deleted successfully"

  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    console.error('❌ Delete card error:', error);
    // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    res.status(500).json({
      // mengirim response error 500 jika penghapusan kartu NFC gagal
      success: false,
      // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
      error: 'Failed to delete card'
      // field error: berisi kode atau pesan error singkat yang dibaca oleh frontend untuk menentukan jenis kesalahan
    });
  }
});
// ============================================================================
// END OF ENDPOINT: DELETE /:cardId
// ============================================================================

// Export router untuk di-mount di server.js
module.exports = router;
// module.exports mengekspor router agar bisa di-import di server.js menggunakan require()
// ============================================================================
// END OF FILE: routes/nfcCards.js
// ============================================================================
// SUMMARY DOKUMENTASI:
// - Total 10 endpoints untuk NFC card management
// - Features: registration, linking, tap/scan, payment, top-up, status update
// - Security: admin authentication, fraud detection (Z-Score algorithm)
// - Data integrity: atomic transactions, balance synchronization
// - Comprehensive logging: audit trail, transaction history, admin actions
// ============================================================================
