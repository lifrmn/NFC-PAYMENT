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

const express = require('express'); // Express framework untuk routing
const { PrismaClient } = require('@prisma/client'); // Prisma ORM untuk database access
const crypto = require('crypto'); // Node.js crypto untuk encryption & hashing
const { analyzeZScoreAnomaly } = require('../utils/fraudDetection'); // Engine Z-Score (satu-satunya engine fraud)
const { authenticateToken } = require('../middleware/auth'); // JWT middleware untuk autentikasi endpoint sensitif

const router = express.Router(); // Buat instance Express Router
const prisma = new PrismaClient(); // Buat instance Prisma client

// ============================================================================
// HELPER FUNCTIONS - Utility functions untuk NFC Card operations
// ============================================================================

// HELPER 1: validateCardId - Validasi format UID NFC card
// UID NFC card format: 14-20 karakter hexadecimal (7-10 bytes)
// Contoh: "04539DE2763C80" (NTag215 UID)
const validateCardId = (cardId) => {
  const uidPattern = /^[0-9A-Fa-f]{14,20}$/; // Regex: 14-20 hex chars
  return uidPattern.test(cardId); // Return true jika match pattern
};

// HELPER 2: encryptCardData - Encrypt sensitive card data
// Algorithm: AES-256-CBC (Advanced Encryption Standard)
// Digunakan untuk encrypt data sensitif seperti PIN, security code, dll
const encryptCardData = (data) => {
  try {
    // STEP 1: Derive encryption key dari password menggunakan scrypt
    const key = crypto.scryptSync(
      process.env.NFC_ENCRYPTION_KEY || 'default-nfc-key', // Password/passphrase
      'salt', // Salt untuk key derivation
      32 // Key length: 32 bytes (256 bits untuk AES-256)
    );
    
    // STEP 2: Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(16); // 16 bytes IV untuk AES-256-CBC
    
    // STEP 3: Create cipher dengan algorithm AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // STEP 4: Encrypt data
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    
    // STEP 5: Return IV + encrypted data (format: "iv:encrypted")
    // IV harus disimpan bersama encrypted data untuk decrypt nanti
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    // FALLBACK: Jika encryption error, pakai SHA-256 hash (one-way, tidak bisa di-decrypt)
    return crypto.createHash('sha256').update(data).digest('hex');
  }
};

// HELPER 3: validateUser - Validasi apakah user ada di database
// Return user object jika ada, null jika tidak ada
const validateUser = async (userId) => {
  return await prisma.user.findUnique({ where: { id: parseInt(userId) } });
};

// HELPER 4: checkUserHasCard - Cek apakah user sudah punya NFC card
// Return array NFC cards yang dimiliki user
const checkUserHasCard = async (userId) => {
  return await prisma.nFCCard.findMany({ where: { userId: parseInt(userId) } });
};

// HELPER 5: formatCurrency - Format angka ke Rupiah format
// Contoh: 50000 -> "Rp 50.000"
const formatCurrency = (amount) => {
  return `Rp ${amount.toLocaleString('id-ID')}`; // Locale Indonesia untuk format Rupiah
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
router.post('/register', async (req, res) => {
  try {
    // STEP 1: Extract data dari request body
    const { cardId, userId, cardData, deviceId, metadata } = req.body; // Destructuring: ambil semua input dari JSON body HTTP request

    // STEP 2: Validasi cardId format (harus ada dan valid hex string 14-20 chars)
    if (!cardId) return res.status(400).json({ error: 'Card ID (UID) required' }); // Wajib ada: UID adalah primary key kartu NFC
    if (!validateCardId(cardId)) { // Cek format UID: harus 14-20 karakter hexadecimal
      // Format invalid - kembalikan error dengan expected format
      return res.status(400).json({ error: 'Invalid NTag215 UID format', expected: '7-10 bytes hex string' }); // Format salah: bukan hex 14-20 chars
    }

    // STEP 3: Check duplikasi - pastikan UID belum terdaftar di sistem
    const existingCard = await prisma.nFCCard.findUnique({ where: { cardId } }); // Query DB: cari kartu dengan UID ini
    if (existingCard) { // Jika ditemukan: UID sudah ada di DB (duplikat)
      // Kartu sudah terdaftar - kembalikan 409 Conflict dengan info kartu existing
      return res.status(409).json({ error: 'Kartu sudah terdaftar', card: { id: existingCard.id, cardId: existingCard.cardId, status: existingCard.cardStatus, userId: existingCard.userId } }); // 409 Conflict: prevent double registration
    }

    // STEP 4 & 5: Validasi user dan POLICY CHECK (1 USER = 1 CARD)
    if (userId) { // Hanya validasi jika userId disediakan (kartu boleh unassigned)
      // STEP 4: Validate user exists di database
      const user = await validateUser(userId); // Cari user berdasarkan ID di tabel User
      if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' }); // User tidak ada: return 404 Not Found

      // STEP 5: 🔒 BUSINESS RULE - 1 USER = 1 CARD POLICY
      // Alasan policy ini:
      // 1. Keamanan: Prevent user dari abuse system dengan multiple cards
      // 2. Simplicity: 1-to-1 mapping memudahkan tracking & fraud detection
      // 3. User experience: Clear ownership (1 user owns exactly 1 physical card)
      const userExistingCards = await checkUserHasCard(userId); // Ambil semua kartu milik user ini
      if (userExistingCards.length > 0) { // Jika ada kartu: user sudah punya 1 kartu (policy dilanggar)
        // User sudah punya kartu - reject registration
        return res.status(409).json({ // 409 Conflict: 1 user hanya boleh punya 1 kartu
          error: 'Pengguna sudah memiliki kartu terdaftar',
          message: 'Each user can only register ONE NFC card',
          existingCard: { cardId: userExistingCards[0].cardId, cardStatus: userExistingCards[0].cardStatus, balance: userExistingCards[0].balance, registeredAt: userExistingCards[0].registeredAt } // Info kartu yang sudah ada
        });
      }
    }

    // STEP 6: Enkripsi cardData jika provided (AES-256-CBC encryption)
    const encryptedData = cardData ? encryptCardData(cardData) : null; // Jika ada cardData: enkripsi dengan AES-256, jika tidak: null
    // cardData bisa berisi: PIN, biometric data, security tokens
    // Format encrypted: "iv:encryptedData" (32 bytes IV + encrypted payload)

    // STEP 7: Sync initial balance dengan user balance (jika userId provided)
    let initialBalance = 0; // Default 0 jika tidak ada user (kartu unassigned)
    if (userId) { // Hanya sync jika kartu dihubungkan ke user
      // Query user balance dari database
      const userWithBalance = await prisma.user.findUnique({ // Ambil data user dengan hanya field balance
        where: { id: parseInt(userId) }, // Konversi userId string ke integer
        select: { balance: true } // Hanya ambil field balance (efisiensi query)
      });
      // Set card balance = user balance (sinkronisasi)
      // Ini memastikan balance kartu selalu match dengan balance user
      initialBalance = userWithBalance?.balance || 0; // Optional chaining: jika null gunakan 0
      console.log(`💰 Syncing card balance with user balance: Rp ${initialBalance.toLocaleString('id-ID')}`); // Log sinkronisasi untuk monitoring
    }
    // Jika no userId: initialBalance = 0 (kartu unassigned/guest)

    // STEP 8: Insert kartu NFC baru ke database (Prisma ORM create operation)
    const nfcCard = await prisma.nFCCard.create({ // Simpan record kartu baru ke tabel NFCCard
      data: {
        cardId,                          // UID kartu (unique identifier)
        cardType: 'NTag215',             // Tipe chip NFC
        frequency: '13.56MHz',           // Frekuensi RFID ISO14443A
        userId: userId ? parseInt(userId) : null,  // Foreign key ke User (nullable)
        cardStatus: 'ACTIVE',            // Status awal: ACTIVE (dapat digunakan)
        balance: initialBalance,         // ✅ Balance card = balance user (sync)
        cardData: encryptedData,         // Data terenkripsi (nullable)
        metadata: metadata ? JSON.stringify(metadata) : null,  // Extra data as JSON string
        isPhysical: true                 // Flag: kartu fisik (bukan virtual)
      },
      include: {
        user: {  // Include user relation dalam response
          select: {
            id: true,
            name: true,
            username: true,
            balance: true
          }
        }
      }
    });
    // Prisma akan auto-generate: id (auto-increment), registeredAt (timestamp), updatedAt

    // STEP 9: Log registration event untuk monitoring & debugging
    console.log(`🎴 NFC Card registered: ${cardId.slice(0, 8)}... ${userId ? `for user ${userId} with balance Rp ${initialBalance.toLocaleString('id-ID')}` : '(unassigned)'}`);
    // Format log: "🎴 NFC Card registered: 04A1B2C3... for user 123 with balance Rp 500.000"

    // STEP 10: Return success response dengan HTTP 201 Created
    res.status(201).json({
      success: true,
      message: 'NFC card registered successfully',
      card: {
        id: nfcCard.id,                    // Database primary key (auto-increment)
        cardId: nfcCard.cardId,            // UID kartu (hex string)
        cardType: nfcCard.cardType,        // "NTag215"
        frequency: nfcCard.frequency,      // "13.56MHz"
        status: nfcCard.cardStatus,        // "ACTIVE"
        balance: nfcCard.balance,          // Current balance (synced dengan user)
        user: nfcCard.user,                // User object (jika linked) atau null
        registeredAt: nfcCard.registeredAt // Timestamp registration
      }
    });
    // Client akan menerima response ini dan bisa simpan cardId untuk transaksi selanjutnya

  } catch (error) {
    // STEP 11: Error handling - tangkap semua error dan return 500 Internal Server Error
    console.error('❌ Card registration error:', error);
    res.status(500).json({ 
      error: 'Gagal mendaftarkan kartu',
      details: error.message  // Error message untuk debugging
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
// USE CASE: Kartu NFC sudah di-register tapi belum punya owner (userId = null)
//           Endpoint ini untuk assign ownership ke specific user
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
router.post('/link', async (req, res) => {
  try {
    // STEP 1: Extract required parameters dari request body
    const { cardId, userId } = req.body; // Ambil cardId (UID kartu) dan userId dari request body
    if (!cardId || !userId) return res.status(400).json({ error: 'ID Kartu dan ID Pengguna diperlukan' }); // Kedua parameter wajib ada

    // STEP 2: Validate card exists (Prisma findUnique query)
    const card = await prisma.nFCCard.findUnique({ where: { cardId } }); // Cari kartu berdasarkan UID di database
    if (!card) return res.status(404).json({ error: 'Card not found' }); // Kartu tidak ditemukan: return 404
    
    // STEP 3: Check card status - hanya ACTIVE card yang bisa di-link
    if (card.cardStatus !== 'ACTIVE') { // Status selain ACTIVE tidak bisa di-link
      // BLOCKED/LOST/EXPIRED card tidak bisa di-link ke user baru
      return res.status(400).json({ error: `Tidak dapat menghubungkan kartu berstatus ${card.cardStatus.toLowerCase()}` }); // Return status sebenarnya ke client
    }

    // STEP 4: Validate user exists (gunakan helper function)
    const user = await validateUser(userId); // Cari user berdasarkan userId di tabel User
    if (!user) return res.status(404).json({ error: 'User not found' }); // User tidak ada: return 404

    // STEP 5: Update card - assign userId (Prisma update operation)
    const updatedCard = await prisma.nFCCard.update({ // Update record kartu di database
      where: { cardId }, // Identifikasi kartu berdasarkan UID
      data: { 
        userId: parseInt(userId),  // Foreign key ke User table (string → int)
        updatedAt: new Date()      // Update timestamp waktu saat ini
      },
      include: { 
        user: {  // Include user data dalam response agar client tidak perlu query lagi
          select: { id: true, name: true, username: true, balance: true } // Hanya field yang dibutuhkan
        } 
      }
    });
    // Setelah update: card.userId not null, berarti card sudah owned by user

    // STEP 6: Log linking event untuk audit trail
    console.log(`🔗 Card ${cardId.slice(0, 8)}... linked to user ${user.username}`); // Log: 8 char pertama UID + username
    
    // STEP 7: Return success response
    res.json({ 
      success: true, 
      message: 'Card linked to user successfully', 
      card: updatedCard  // Include updated card dengan user relation
    }); // Client akan terima card object dengan user property terisi
    
  } catch (error) {
    // Error handling - tangkap semua error (Prisma, validation, dll)
    console.error('❌ Card linking error:', error); // Log error ke console untuk debugging
    res.status(500).json({ error: 'Gagal menghubungkan kartu', details: error.message }); // Return 500 dengan detail error
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
router.post('/tap', async (req, res) => {
  try {
    // STEP 1: Extract request data
    const { cardId, deviceId, location, signalStrength, readTime } = req.body; // Destructuring: ambil semua data dari request body
    if (!cardId || !deviceId) return res.status(400).json({ error: 'ID Kartu dan ID Perangkat diperlukan' }); // Dua parameter wajib: UID kartu + ID device NFC reader

    // STEP 2: Query card dari database dengan user relation
    const card = await prisma.nFCCard.findUnique({ // Cari kartu di database berdasarkan UID
      where: { cardId }, // Kondisi: cardId = UID yang dikirim
      include: { user: { select: { id: true, name: true, username: true, balance: true } } } // Sertakan data user pemilik kartu
    });
    // Include user: untuk mendapatkan balance & user info tanpa query terpisah

    // Validasi: card tidak ditemukan
    if (!card) { // Jika kartu tidak ada di database: belum pernah didaftarkan
      return res.status(404).json({ 
        error: 'Kartu tidak dikenali',
        suggestion: 'Register this card first'  // Guide user untuk register kartu
      }); // Return 404: kartu tidak dikenali sistem
    }

    // STEP 3-6: Check card status dengan berbagai scenario
    
    // STEP 4: Handle BLOCKED card (diblokir oleh admin karena fraud/violation)
    if (card.cardStatus === 'BLOCKED') { // Kartu dalam status BLOCKED: tidak bisa digunakan
      return res.status(403).json({ 
        error: 'Kartu diblokir',
        reason: 'Contact admin for assistance'  // Suruh user hubungi admin
      }); // Return 403 Forbidden: akses ditolak
    }

    // STEP 5: Handle EXPIRED card (kartu sudah kadaluarsa)
    if (card.cardStatus === 'EXPIRED') { // Kartu kadaluarsa: melewati tanggal expired
      return res.status(403).json({ 
        error: 'Kartu telah kadaluarsa',
        expiredAt: card.expiresAt  // Inform user kapan expired
      }); // Return 403 Forbidden: kartu tidak lagi valid
    }

    // STEP 6: 🚨 Handle LOST card - CRITICAL SECURITY EVENT
    if (card.cardStatus === 'LOST') {
      // Kartu dilaporkan hilang tapi ada yang coba pakai = FRAUD ATTEMPT!
      // Create fraud alert untuk notifikasi admin
      await prisma.fraudAlert.create({
        data: {
          userId: card.userId,
          deviceId,
          deviceName: 'NFC Reader',
          // Kartu dilaporkan hilang → anomali pasti → simpan Z sentinel -1 (undefined, non-calculated)
          riskScore: -1,
          riskLevel: 'ANOMALY',       // Anomali kritis - kartu hilang
          decision: 'BLOCK',
          reasons: JSON.stringify(['Card reported as LOST', `Tap attempt at ${location || 'unknown location'}`]),
          confidence: 1.0,             // 100% confidence (kartu confirmed LOST)
          riskFactors: JSON.stringify({
            cardStatus: 'LOST',
            tapAttempt: true           // Someone trying to use lost card = suspicious
          }),
          ipAddress: req.ip            // Track IP untuk investigation
        }
      });
      // Alert ini akan muncul di admin dashboard untuk immediate action
      // Admin bisa track: location, device, IP address dari attacker

      return res.status(403).json({ 
        error: 'Card reported as lost',
        action: 'Transaction blocked for security'
      });
    }
    // Jika pass semua check di atas, berarti card.cardStatus = 'ACTIVE' (OK untuk transaksi)

    // STEP 7: Update lastUsed timestamp untuk activity tracking
    await prisma.nFCCard.update({
      where: { cardId },
      data: { 
        lastUsed: new Date(),    // Track waktu terakhir kartu di-tap
        updatedAt: new Date()    // Standard updated timestamp
      }
    });
    // lastUsed berguna untuk: inactive card detection, usage pattern analysis

    // STEP 8: Log tap transaction ke NFCTransaction table (audit trail)
    await prisma.nFCTransaction.create({
      data: {
        cardId,                          // UID kartu yang di-tap
        transactionType: 'TAP_IN',       // Tipe: TAP_IN (read operation, bukan payment)
        balanceBefore: card.balance,     // Balance sebelum = balance saat ini (no change)
        balanceAfter: card.balance,      // Balance setelah = sama (tap tidak mengubah balance)
        deviceId,                        // Device reader yang digunakan
        location,                        // Lokasi tap (GPS atau deskripsi)
        status: 'SUCCESS',               // Transaction berhasil
        metadata: JSON.stringify({
          signalStrength,                // Kekuatan sinyal RFID (dBm)
          readTime,                      // Waktu baca (milliseconds)
          timestamp: new Date().toISOString()  // Timestamp exact
        }),
        ipAddress: req.ip                // IP address device/client
      }
    });
    // Transaction log ini untuk: audit trail, analytics, usage tracking
    // Admin bisa analyze: kapan kartu digunakan, di mana, device apa

    // STEP 9: Log ke console untuk monitoring real-time
    console.log(`📱 Card tapped: ${cardId.slice(0, 8)}... on ${deviceId.slice(-8)}`);
    // Format log: "📱 Card tapped: 04A1B2C3... on device ...abc12345"

    // STEP 10: Return success response dengan card info lengkap
    res.json({
      success: true,
      message: 'Card read successfully',
      card: {
        id: card.id,                     // Database ID (auto-increment)
        cardId: card.cardId,             // UID kartu (hex string)
        cardType: card.cardType,         // "NTag215"
        status: card.cardStatus,         // "ACTIVE"
        balance: card.balance,           // Current balance (dalam Rupiah)
        user: card.user,                 // User object (id, name, username, balance)
        lastUsed: new Date()             // Timestamp tap (just now)
      }
    });
    // Client (Android app) akan display info ini ke user:
    // - Balance: untuk ditampilkan di UI
    // - User info: untuk konfirmasi "Kartu milik [nama]"
    // - Status: untuk validasi (jika BLOCKED/LOST, show warning)

  } catch (error) {
    // Error handling - tangkap semua error (Prisma, validation, network, dll)
    console.error('❌ Card tap error:', error);
    res.status(500).json({ 
      error: 'Failed to process card tap',
      details: error.message  // Error message untuk debugging
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
// 1. AI-powered Fraud Detection (Z-Score anomaly detection)
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
// STEP 6: 🛡️ AI FRAUD DETECTION - Z-Score Anomaly Detection
//         Algoritma: Statistical outlier detection based on historical patterns
//         Input: sender card history (last 20 transactions)
//         Output: Z-Score, riskLevel (NORMAL/SUSPICIOUS/ANOMALY), decision (ALLOW/REVIEW/BLOCK)
//         Reference: Tagle (2024) - NFC Fraud Detection with Z-Score
//
//         6a. Analyze transaction amount vs historical mean
//         6b. Calculate Z-Score: Z = (X - μ) / σ
//         6c. Apply 3-Sigma Rule:
//             - Z > 3σ → BLOCK (99.7% confidence interval, extreme outlier)
//             - Z > 2σ → REVIEW (95% confidence, significant deviation)
//             - Z ≤ 2σ → ALLOW (normal transaction pattern)
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
router.post('/payment', authenticateToken, async (req, res) => { // Endpoint payment: dilindungi JWT middleware
  try {
    // STEP 1: Extract request parameters
    const { // Destructuring semua parameter dari JSON body
      cardId,              // Sender card UID
      amount,              // Transfer amount (Rupiah)
      receiverCardId,      // Receiver card UID (optional, untuk card-to-card)
      receiverId,          // Receiver user ID (optional, untuk user-to-user)
      deviceId,            // Device reader ID (Android device)
      location,            // Location of transaction (GPS atau deskripsi)
      description          // Transaction description (optional)
    } = req.body;

    // Validate required parameters
    if (!cardId || !amount || !deviceId) { // Tiga parameter wajib: cardId, amount, deviceId
      return res.status(400).json({ // Return 400 jika salah satu parameter wajib tidak ada
        error: 'Card ID, amount, and device ID required' 
      }); // Informasi parameter mana yang kurang
    }

    // STEP 2: Parse & validate amount (must be positive number)
    const amountNum = parseFloat(amount); // Konversi string/number ke float (misal: "50000" → 50000.0)
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) { // Validasi: bukan NaN, bukan 0, harus positif
      return res.status(400).json({ error: 'Invalid amount' }); // Tolak jika amount tidak valid
    }

    // STEP 3: Query sender card dengan user relation (Prisma include)
    const senderCard = await prisma.nFCCard.findUnique({ // Cari kartu pengirim di database
      where: { cardId }, // Cari berdasarkan UID kartu pengirim
      include: { user: true }  // Include untuk mendapatkan user balance & info
    });

    if (!senderCard) { // Kartu pengirim tidak ditemukan di database
      return res.status(404).json({ error: 'Sender card not found' }); // Return 404: kartu belum terdaftar
    }

    // STEP 4: Validate sender card status
    if (senderCard.cardStatus !== 'ACTIVE') { // Hanya ACTIVE card yang bisa melakukan payment
      return res.status(403).json({ error: 'Sender card is not active' }); // Return 403: kartu tidak aktif
    }

    // STEP 5: Check USER balance (bukan card balance!)
    // ⚠️ IMPORTANT DESIGN DECISION: User balance adalah single source of truth
    const userBalance = senderCard.user?.balance || 0; // Ambil balance user (null-safe, default 0)
    console.log(`💰 Balance Check: User ${senderCard.userId} has Rp ${userBalance.toLocaleString('id-ID')}, trying to send Rp ${amountNum.toLocaleString('id-ID')}`); // Log balance check untuk monitoring
    
    // Validate sufficient balance
    if (userBalance < amountNum) { // Saldo tidak cukup: user tidak bisa membayar
      return res.status(400).json({ // Return 400: insufficient balance
        error: 'Insufficient balance',
        balance: userBalance,  // Saldo saat ini
        required: amountNum    // Saldo yang dibutuhkan
      }); // Client akan show: "Saldo tidak cukup. Saldo: Rp X, Dibutuhkan: Rp Y"
    }

    // STEP 6: FRAUD DETECTION — Z-Score Anomaly Detection
    // =========================================================================
    // REFERENSI AKADEMIS:
    //   Tagle, R. A. (2024). Machine Learning Integration for Real-time Fraud
    //   Detection in Near Field Communication (NFC) Card Transactions.
    //   Technologique, 3(1), 69–76.
    //   https://doi.org/10.62718/vmca.tech-gjtdsi.3.1.sc-1124-009
    //
    // FORMULA Z-SCORE [Tagle, 2024]:
    //   Z = (X − μ) / σ                                ...(4)
    //   X = nominal saat ini, μ = rata-rata historis, σ = std deviasi sampel
    //
    // THREE-SIGMA RULE [Tagle, 2024]:
    //   Z ≤ 2σ → ALLOW  (95.0% confidence: transaksi dalam batas normal)
    //   Z > 2σ → REVIEW (keluar dari interval 95% confidence)
    //   Z > 3σ → BLOCK  (99.7% confidence: extreme outlier)
    //
    // SAMPLE VARIANCE (Bessel's Correction) [Zhukabayeva et al., 2025]:
    //   σ = √[Σ(xᵢ−μ)²/(n−1)] — estimator tidak bias untuk n < 100
    // =========================================================================
    let lastFraudAnalysis = null; // untuk dikirim ke response client (null jika no fraud analysis)
    if (senderCard.userId) { // Hanya lakukan fraud detection jika kartu terhubung ke user
      try {
        // STEP 6a: Ambil 20 transaksi historis terakhir sebelum transaksi baru disimpan
        // PENTING: historis diambil SEBELUM transaksi baru disimpan agar X tidak ikut baseline
        const historicalTxs = await prisma.transaction.findMany({ // Query transaksi historis user
          where: { senderId: senderCard.userId, status: 'completed' }, // Hanya transaksi sukses milik sender
          orderBy: { createdAt: 'desc' }, // Urutkan dari terbaru ke terlama
          take: 20, // Ambil maksimal 20 transaksi terakhir (sample size)
          select: { amount: true, createdAt: true } // Hanya field yang dibutuhkan untuk Z-Score
        });

        // STEP 6b: Panggil engine utama Z-Score (satu-satunya engine, tidak ada duplikat)
        const fraudAnalysis = analyzeZScoreAnomaly(amountNum, historicalTxs); // Hitung Z-Score anomali
        lastFraudAnalysis = fraudAnalysis; // Simpan hasil untuk dikirim ke response

        // Log hasil analisis
        console.log('🔍 Fraud Detection Analysis (Z-Score Based Anomaly Detection):');
        console.log(`   └─ Z-Score: ${fraudAnalysis.zScore} | Decision: ${fraudAnalysis.decision} | Risk: ${fraudAnalysis.decision === 'ALLOW' ? 'NORMAL' : fraudAnalysis.decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY'}`);
        console.log(`   └─ Mean: ${fraudAnalysis.mean} | StdDev: ${fraudAnalysis.stdDev} | n: ${fraudAnalysis.n}`);
        console.log(`   └─ Threshold: Z≤2 ALLOW | 2<Z≤3 REVIEW | Z>3 BLOCK`);

        // STEP 6c: Buat FraudAlert HANYA untuk BLOCK (sebelum transaction, karena BLOCK = tidak ada transaction)
        // REVIEW: FraudAlert dibuat SETELAH transaction selesai agar transactionId tersedia.
        // Urutan: Transaction dibuat dulu → transactionId diperoleh → FraudAlert REVIEW dibuat.
        const riskLevelMapped = fraudAnalysis.decision === 'ALLOW' ? 'NORMAL' : fraudAnalysis.decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY'; // Map decision ke risk level string
        if (fraudAnalysis.decision === 'BLOCK') { // Hanya buat FraudAlert jika BLOCK (sebelum transaction)
          try {
            // BLOCK: Tidak ada transaction yang dibuat → transactionId null (sesuai skripsi)
            await prisma.fraudAlert.create({ // Buat record fraud alert di database
              data: {
                userId: senderCard.userId, // ID user yang melakukan transaksi mencurigakan
                // transactionId null: BLOCK mencegah transaksi dibuat
                deviceId, // ID device NFC reader yang digunakan
                deviceName: 'NFC Card Reader', // Nama perangkat
                // Sentinel -1 jika Z null (σ=0, X≠μ). Jangan simpan 0 karena bisa diartikan normal.
                riskScore: fraudAnalysis.zScore !== null ? fraudAnalysis.zScore : -1, // Z-Score aktual, -1 jika undefined
                riskLevel: 'ANOMALY', // Level tertinggi karena BLOCK
                decision: 'BLOCK', // Keputusan: blokir transaksi
                reasons: JSON.stringify(fraudAnalysis.reasons), // Alasan deteksi anomali
                confidence: 0.997, // 99.7% confidence (3-sigma rule)
                riskFactors: JSON.stringify({
                  cardId: cardId.slice(0, 8) + '...', // UID disamarkan (keamanan)
                  amount: amountNum, // Jumlah transaksi
                  zScore: fraudAnalysis.zScore, // Nilai Z
                  mean: fraudAnalysis.mean, // Rata-rata historis
                  stdDev: fraudAnalysis.stdDev, // Standar deviasi
                  n: fraudAnalysis.n, // Jumlah data historis
                  algorithm: 'Z-Score Based Anomaly Detection', // Algoritma yang digunakan
                  thresholds: { allow: 2, review: 3 } // Threshold Z-Score
                }),
                ipAddress: req.ip // IP address pengirim
              }
            });
            console.log(`🚨 BLOCK Fraud Alert Created (sebelum transaction): Z=${fraudAnalysis.zScore ?? 'null(σ=0)'} → BLOCK`);
          } catch (alertError) {
            console.error('⚠️ Failed to create BLOCK fraud alert (non-critical):', alertError.message); // Log error tapi jangan stop flow
          }
        }

        // STEP 6d: Jika BLOCK → tolak transaksi, jangan ubah saldo
        if (fraudAnalysis.decision === 'BLOCK') { // BLOCK: transaksi dihentikan, saldo tidak berubah
          return res.status(403).json({ // Return 403 Forbidden: transaksi ditolak sistem
            error: 'TRANSACTION_BLOCKED',
            message: 'Transaksi diblokir – anomali terdeteksi oleh Z-Score. Silakan hubungi Customer Service.',
            zScore: fraudAnalysis.zScore, // Nilai Z-Score untuk referensi user
            riskLevel: riskLevelMapped, // 'ANOMALY'
            reasons: fraudAnalysis.reasons, // Alasan pemblokiran
            contactInfo: 'Hubungi CS: +62-XXX-XXX-XXXX atau email: cs@nfcpayment.com'
          }); // Client akan tampilkan pesan ini ke user
        }

        // STEP 6e: Jika REVIEW → transaksi tetap diproses, admin akan review di dashboard
        if (fraudAnalysis.decision === 'REVIEW') { // REVIEW: transaksi lanjut tapi ditandai suspicious
          console.log(`⚠️ Review Required: Card ${cardId.slice(0, 8)}... | Z-Score: ${fraudAnalysis.zScore}σ`); // Log untuk monitoring
        }

      } catch (fraudError) {
        // Fail-safe: biarkan transaksi lanjut jika analisis fraud error (tidak menghentikan pembayaran)
        console.error('Fraud detection error:', fraudError);
      }
    }
    // Jika ALLOW decision atau fraud detection disabled: lanjut ke payment processing

    // STEP 7: Validate receiver - support 2 modes: card-to-card atau user-to-user
    // =========================================================================
    let receiverCard = null; // Mode 1: penerima menggunakan NFC card
    let receiverUser = null; // Mode 2: penerima adalah user langsung (tanpa card)

    if (receiverCardId) { // Jika receiverCardId ada: gunakan Mode 1 (card-to-card)
      // MODE 1: Card-to-Card Transfer
      // Use case: User tap 2 kartu NFC (sender & receiver) pada device reader
      // Example: Tap kartu pengirim, masukkan amount, tap kartu penerima
      receiverCard = await prisma.nFCCard.findUnique({ // Cari kartu penerima di database
        where: { cardId: receiverCardId }, // Filter berdasarkan UID kartu penerima
        include: { user: true }  // Include user untuk update balance
      });

      if (!receiverCard) { // Kartu penerima tidak ditemukan
        return res.status(404).json({ error: 'Receiver card not found' }); // Return 404: kartu penerima tidak ada
      }
      // Receiver card valid → akan update card balance & user balance nantinya
      
    } else if (receiverId) { // MODE 2: Penerima adalah user tanpa kartu NFC
      // MODE 2: User-to-User Transfer (no receiver card involved)
      // Use case: Transfer saldo ke user lain via user ID (pilih dari contact list)
      // Example: Select "Transfer to John Doe (user ID 123)"
      receiverUser = await prisma.user.findUnique({ // Cari user penerima berdasarkan ID
        where: { id: parseInt(receiverId) } // Konversi receiverId string ke integer
      });

      if (!receiverUser) { // User penerima tidak ditemukan di database
        return res.status(404).json({ error: 'Receiver not found' }); // Return 404: user tidak ada
      }
      // Receiver user valid → akan update user balance saja (no card involved)
      
    } else { // Tidak ada receiverCardId dan tidak ada receiverId
      // Error: harus provide salah satu (receiverCardId OR receiverId)
      return res.status(400).json({ // Return 400: parameter penerima harus ada
        error: 'Receiver card ID or user ID required' 
      }); // Client harus kirim salah satu: receiverCardId atau receiverId
    }

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
    const result = await prisma.$transaction(async (tx) => { // Mulai Prisma transaction — semua operasi dalam blok ini adalah atomic
      // Prisma transaction: 'tx' adalah isolated Prisma client
      // Semua operations menggunakan 'tx', bukan 'prisma'
      
      // STEP 8a: Deduct balance dari SENDER USER (not card!)
      // Atomic conditional update: only decrement if balance is still sufficient
      // Prevents TOCTOU race condition where concurrent requests could deplete balance below 0
      const senderUpdateResult = await tx.user.updateMany({
        where: { id: senderCard.userId, balance: { gte: amountNum } }, // Atomic balance check
        data: { balance: { decrement: amountNum } }
      });
      if (senderUpdateResult.count === 0) {
        // Another concurrent transaction depleted the balance between our pre-check and now
        const err = new Error('Insufficient balance (concurrent transaction)');
        err.code = 'INSUFFICIENT_BALANCE';
        throw err;
      }
      // Fetch updated sender user to get the new balance for card sync
      const updatedSenderUser = await tx.user.findUnique({ where: { id: senderCard.userId } });

      // STEP 8b: Update sender CARD - sync balance dengan user + update lastUsed
      const updatedSenderCard = await tx.nFCCard.update({ // Update record NFCCard di database
        where: { cardId }, // Identifikasi kartu berdasarkan UID
        data: { 
          lastUsed: new Date(),                      // Track last activity
          balance: updatedSenderUser.balance         // ✅ Sync: card balance = user balance
        }
      });
      // IMPORTANT: Card balance selalu sama dengan user balance (single source of truth)

      // STEP 8c & 8d: Add balance ke receiver (card atau user tergantung mode)
      let updatedReceiverCard = null; // Akan diisi jika mode card-to-card
      let updatedReceiverUser = null; // Akan selalu diisi (kedua mode update user balance)

      if (receiverCard) { // MODE 1: Penerima menggunakan kartu NFC (card-to-card)
        // MODE 1: Card-to-Card Transfer
        
        // Validate: receiver card harus linked ke user
        if (!receiverCard.userId) { // Kartu penerima belum diassign ke user manapun
          throw new Error('Receiver card not linked to any user'); // Throw error: trigger rollback
          // Error ini akan trigger rollback seluruh transaction
        }
        
        // Update receiver USER balance
        updatedReceiverUser = await tx.user.update({ // Tambah balance user penerima
          where: { id: receiverCard.userId }, // Identifikasi user berdasarkan ID
          data: { balance: { increment: amountNum } }  // Tambah balance user
        });

        // Update receiver CARD - sync balance dengan user + update lastUsed
        updatedReceiverCard = await tx.nFCCard.update({ // Update kartu penerima
          where: { cardId: receiverCardId }, // Identifikasi kartu berdasarkan UID penerima
          data: { 
            lastUsed: new Date(),                      // Track last activity
            balance: updatedReceiverUser.balance       // ✅ Sync: card balance = user balance
          }
        });
      } else { // MODE 2: Penerima hanya user (tidak ada kartu)
        // MODE 2: User-to-User Transfer (no card involved)
        // Hanya update user balance, no card sync needed
        updatedReceiverUser = await tx.user.update({ // Tambah balance user penerima langsung
          where: { id: parseInt(receiverId) }, // Konversi receiverId string ke integer
          data: { balance: { increment: amountNum } }  // Tambah balance user
        });
      }

      // STEP 8e: Log SENDER NFCTransaction (audit trail untuk sender)
      const senderBalanceBefore = senderCard.user?.balance || 0;
      const senderBalanceAfter = updatedSenderUser.balance;
      
      await tx.nFCTransaction.create({
        data: {
          cardId,                          // Sender card UID
          transactionType: 'PAYMENT',      // Type: PAYMENT (outgoing)
          amount: -amountNum,              // Negative amount (deduction)
          balanceBefore: senderBalanceBefore,   // Balance before payment
          balanceAfter: senderBalanceAfter,     // Balance after payment
          deviceId,                        // Device yang digunakan
          location,                        // Location of transaction
          status: 'SUCCESS',               // Transaction successful
          metadata: JSON.stringify({
            description,                   // Custom description dari user
            receiver: receiverCardId || `user:${receiverId}`,  // Receiver identifier
            timestamp: new Date().toISOString()
          }),
          ipAddress: req.ip                // IP address untuk security tracking
        }
      });
      // Log ini untuk: transaction history, receipt generation, analytics

      // STEP 8f: Log RECEIVER NFCTransaction (jika card-to-card transfer)
      if (updatedReceiverCard) {
        const receiverBalanceBefore = receiverCard.user?.balance || 0;
        const receiverBalanceAfter = updatedReceiverUser.balance;
        
        await tx.nFCTransaction.create({
          data: {
            cardId: receiverCardId,        // Receiver card UID
            transactionType: 'TAP_IN',     // Type: TAP_IN (incoming)
            amount: amountNum,             // Positive amount (addition)
            balanceBefore: receiverBalanceBefore,  // Balance before receive
            balanceAfter: receiverBalanceAfter,    // Balance after receive
            deviceId,                      // Same device sebagai sender
            location,                      // Same location
            status: 'SUCCESS',
            metadata: JSON.stringify({
              description,
              sender: cardId,              // Sender card UID
              timestamp: new Date().toISOString()
            }),
            ipAddress: req.ip
          }
        });
      }
      // Jika user-to-user transfer: no receiver card log (receiver tidak pakai card)

      // STEP 8g: Create main Transaction record — sertakan hasil fraud Z-Score
      // fraudRiskScore: nilai Z aktual, atau -1 jika Z tidak terdefinisi (σ=0, X≠μ)
      // fraudRiskLevel: NORMAL/SUSPICIOUS/ANOMALY
      // fraudReasons: JSON array alasan analisis
      // txRecord: ditangkap untuk digunakan sebagai transactionId pada FraudAlert REVIEW di luar blok ini
      let txRecord = null;
      if (senderCard.userId && (receiverCard?.userId || receiverId)) {
        const fraudRiskMapped = lastFraudAnalysis
          ? (lastFraudAnalysis.decision === 'ALLOW' ? 'NORMAL' : lastFraudAnalysis.decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY')
          : null;
        txRecord = await tx.transaction.create({
          data: {
            senderId: senderCard.userId,
            receiverId: receiverCard?.userId || parseInt(receiverId),
            amount: amountNum,
            type: 'nfc_payment',
            status: 'completed',
            description: description || 'NFC Card Payment',
            deviceId,
            ipAddress: req.ip,
            // Hasil Z-Score tersimpan di Transaction untuk audit & histori
            fraudRiskScore: lastFraudAnalysis
              ? (lastFraudAnalysis.zScore !== null ? lastFraudAnalysis.zScore : -1)
              : null,
            fraudRiskLevel: fraudRiskMapped,
            fraudReasons: lastFraudAnalysis ? JSON.stringify(lastFraudAnalysis.reasons || []) : null
          }
        });
      }
      // Transaction record ini untuk: user transaction history, accounting, reports

      // Return result dari atomic transaction, sertakan txRecord untuk FraudAlert REVIEW
      return { updatedSenderCard, updatedSenderUser, updatedReceiverCard, updatedReceiverUser, txRecord };
    });
    // Prisma $transaction auto-commit jika semua operations sukses
    // Jika ada error: auto-rollback (semua changes di-revert)

    // STEP 8h: Buat FraudAlert REVIEW SETELAH transaction dibuat (urutan sesuai skripsi)
    // Transaction dibuat dulu (Step 8g) → transactionId diperoleh → FraudAlert REVIEW dibuat
    // FraudAlert REVIEW wajib memiliki transactionId (transaksi tetap diproses untuk REVIEW)
    if (lastFraudAnalysis?.decision === 'REVIEW' && senderCard.userId) {
      try {
        await prisma.fraudAlert.create({
          data: {
            userId: senderCard.userId,
            transactionId: result.txRecord?.id || null, // transactionId dari transaction yang baru dibuat
            deviceId,
            deviceName: 'NFC Card Reader',
            riskScore: lastFraudAnalysis.zScore !== null ? lastFraudAnalysis.zScore : -1,
            riskLevel: 'SUSPICIOUS',
            decision: 'REVIEW',
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
              thresholds: { allow: 2, review: 3 }
            }),
            ipAddress: req.ip
          }
        });
        console.log(`🚨 REVIEW Fraud Alert Created dengan transactionId: ${result.txRecord?.id ?? 'null'}`);
      } catch (alertError) {
        console.error('⚠️ Failed to create REVIEW fraud alert (non-critical):', alertError.message);
      }
    }

    // STEP 9: Log transaction success dengan detail lengkap
    const senderUsername = senderCard.user?.username || 'Unknown';
    const receiverUsername = receiverCard?.user?.username || 'Unknown';
    
    console.log(`✅ Transfer Success!`);
    console.log(`   Pengirim: ${senderUsername} (${cardId.slice(0, 8)}...)`);
    console.log(`   Penerima: ${receiverUsername} (${receiverCardId?.slice(0, 8) || 'user'}...)`);
    console.log(`   💸 Amount: ${formatCurrency(amountNum)}`);
    console.log(`   💰 Saldo Pengirim: ${formatCurrency(result.updatedSenderUser.balance)}`);
    console.log(`   💵 Saldo Penerima: ${formatCurrency(result.updatedReceiverUser?.balance || 0)}`);
    // Log format: Easy to read untuk real-time monitoring

    // STEP 10: Return success response ke client (201 Created: transaksi baru berhasil dibuat)
    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      transaction: {
        amount: amountNum,                                       // Transfer amount
        senderBalance: result.updatedSenderUser.balance,        // Sender balance setelah payment
        receiverBalance: result.updatedReceiverUser?.balance,   // Receiver balance setelah payment
        timestamp: new Date(),                                   // Transaction timestamp
        // Fraud detection results (untuk ditampilkan di mobile app)
        fraudRiskLevel: lastFraudAnalysis ? (lastFraudAnalysis.decision === 'ALLOW' ? 'NORMAL' : lastFraudAnalysis.decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY') : 'NORMAL',
        fraudRiskScore: lastFraudAnalysis ? (lastFraudAnalysis.zScore !== null ? lastFraudAnalysis.zScore : null) : null, // Z-Score aktual; null jika σ=0
        fraudDecision: lastFraudAnalysis?.decision || 'ALLOW'        // ALLOW/REVIEW/BLOCK
      }
    });
    // Client akan display success message dan updated balances ke user

  } catch (error) {
    // Error handling - tangkap semua error (Prisma, validation, network, dll)
    console.error('❌ Payment error:', error);
    if (error.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance', message: 'Saldo tidak mencukupi (transaksi bersamaan)' });
    }
    res.status(500).json({ 
      error: 'Payment failed',
      details: error.message  // Error details untuk debugging
    });
    // Jika error terjadi dalam $transaction: automatic rollback (no partial updates)
  }
});
// ============================================================================
// END OF ENDPOINT: POST /payment
// ============================================================================
// SUMMARY: Endpoint ini handle complex payment flow dengan:
// - AI fraud detection (Z-Score algorithm)
// - Atomic transactions (ACID compliance)
// - Balance synchronization (user ↔ card)
// - Comprehensive logging & audit trail
// Total ~200 lines of code untuk ensure secure & reliable payments
// ============================================================================

// ============================================================================
// ENDPOINT: POST /topup - Top up saldo kartu NFC (Admin only)
// ============================================================================
// USE CASE: Admin menambahkan saldo ke kartu user (manual top-up)
// AUTHORIZATION: Require admin password (process.env.ADMIN_PASSWORD)
//
// FLOW TOP-UP:
//
// STEP 1: Extract & validate parameters (cardId, amount, adminPassword)
// STEP 2: Verify admin password untuk authorization
// STEP 3: Parse & validate amount (must be positive)
// STEP 4: Validate card exists di database
// STEP 5: Execute atomic transaction:
//         5a. Increment card balance
//         5b. Log NFCTransaction (type: TOP_UP)
//         5c. Log AdminLog (audit trail untuk admin action)
// STEP 6: Log success
// STEP 7: Return success response dengan old & new balance
// ============================================================================
router.post('/topup', async (req, res) => {
  try {
    // STEP 1: Extract required parameters
    const { cardId, amount, adminPassword } = req.body;
    if (!cardId || !amount) return res.status(400).json({ error: 'Card ID and amount required' });
    
    // STEP 2: Verify admin password (AUTHORIZATION CHECK)
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    // Only admin dapat melakukan top-up (prevent unauthorized balance manipulation)

    // STEP 3: Parse & validate amount
    const amountNum = parseFloat(amount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ error: 'Invalid amount' });

    // STEP 4: Validate card exists
    const card = await prisma.nFCCard.findUnique({ where: { cardId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // STEP 5: Execute atomic transaction (3 operations: update balance, log transaction, log admin action)
    const updatedCard = await prisma.$transaction(async (tx) => {
      // STEP 5a: Increment card balance
      const updated = await tx.nFCCard.update({
        where: { cardId },
        data: { 
          balance: { increment: amountNum },  // Atomic increment operation
          lastUsed: new Date()                // Update last activity timestamp
        }
      });
      // balance sekarang = balance lama + amountNum

      // STEP 5b: Log top-up transaction ke NFCTransaction table
      await tx.nFCTransaction.create({
        data: {
          cardId,                          // Card yang di-topup
          transactionType: 'TOP_UP',       // Type: TOP_UP (incoming balance)
          amount: amountNum,               // Positive amount (addition)
          balanceBefore: card.balance,     // Balance before top-up
          balanceAfter: updated.balance,   // Balance after top-up
          deviceId: 'admin',               // Device: 'admin' (manual top-up from dashboard)
          status: 'SUCCESS',
          ipAddress: req.ip                // Admin IP address
        }
      });

      // STEP 5c: Log admin action ke AdminLog table (audit trail)
      await tx.adminLog.create({
        data: {
          action: 'CARD_TOP_UP',           // Action type
          details: JSON.stringify({
            cardId,
            amount: amountNum,
            oldBalance: card.balance,
            newBalance: updated.balance
          }),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']  // Track admin browser/device
        }
      });
      // AdminLog untuk: compliance, security audits, admin activity tracking

      return updated;  // Return updated card
    });
    // Transaction selesai - semua 3 operations committed atomically

    // STEP 6: Log success ke console
    console.log(`💰 Card topped up: ${cardId.slice(0, 8)}... +${formatCurrency(amountNum)}`);

    // STEP 7: Return success response
    res.json({
      success: true,
      message: 'Card topped up successfully',
      card: {
        cardId: updatedCard.cardId,
        balance: updatedCard.balance,        // New balance
        previousBalance: card.balance        // Old balance (untuk comparison)
      }
    });

  } catch (error) {
    console.error('❌ Top-up error:', error);
    res.status(500).json({ 
      error: 'Top-up failed',
      details: error.message 
    });
  }
});
// ============================================================================
// END OF ENDPOINT: POST /topup
// ============================================================================

// ============================================================================
// ENDPOINT: PUT /status - Update status kartu NFC (Admin only)
// ============================================================================
// USE CASE: Admin mengubah status kartu (block, unblock, mark as lost, expire)
// AUTHORIZATION: Require admin password
//
// STATUS OPTIONS:
// - ACTIVE:  Kartu normal, dapat digunakan untuk transaksi
// - BLOCKED: Kartu diblokir (fraud, violation, user request), tidak dapat transaksi
// - LOST:    Kartu dilaporkan hilang, trigger fraud alert jika digunakan
// - EXPIRED: Kartu kadaluarsa, tidak dapat digunakan
//
// FLOW UPDATE STATUS:
//
// STEP 1: Extract & validate parameters (cardId, status, adminPassword, reason)
// STEP 2: Verify admin password untuk authorization
// STEP 3: Validate status value (must be ACTIVE, BLOCKED, LOST, or EXPIRED)
// STEP 4: Validate card exists di database
// STEP 5: Update card status + timestamp
// STEP 6: Log admin action ke AdminLog table (audit trail)
// STEP 7: Return updated card dengan user info
// ============================================================================
router.put('/status', async (req, res) => {
  try {
    // STEP 1: Extract parameters
    const { cardId, status, adminPassword, reason } = req.body;
    if (!cardId || !status) return res.status(400).json({ error: 'Card ID and status required' });
    
    // STEP 2: Verify admin password (AUTHORIZATION CHECK)
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    // STEP 3: Validate status value (enum validation)
    const validStatuses = ['ACTIVE', 'BLOCKED', 'LOST', 'EXPIRED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', validStatuses });
    }
    // Status harus salah satu dari 4 options: ACTIVE | BLOCKED | LOST | EXPIRED

    // STEP 4: Validate card exists
    const card = await prisma.nFCCard.findUnique({ where: { cardId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // STEP 5: Update card status di database
    const updatedCard = await prisma.nFCCard.update({
      where: { cardId },
      data: { 
        cardStatus: status,        // Update status (ACTIVE/BLOCKED/LOST/EXPIRED)
        updatedAt: new Date()      // Update timestamp
      },
      include: {
        user: {  // Include user info dalam response
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    // STEP 6: Log admin action ke AdminLog table (audit trail)
    await prisma.adminLog.create({
      data: {
        action: 'CARD_STATUS_UPDATE',    // Action type
        details: JSON.stringify({
          cardId,
          oldStatus: card.cardStatus,    // Previous status (untuk comparison)
          newStatus: status,             // New status
          reason: reason || 'No reason provided'  // Admin reason (optional field)
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']  // Track admin device/browser
      }
    });
    // AdminLog penting untuk: compliance, security audits, investigation fraud

    // Log ke console untuk monitoring
    console.log(`🔒 Card status updated: ${cardId.slice(0, 8)}... ${card.cardStatus} → ${status}`);

    // STEP 7: Return success response
    res.json({
      success: true,
      message: `Card ${status.toLowerCase()} successfully`,
      card: updatedCard  // Include updated card dengan user info
    });

  } catch (error) {
    console.error('❌ Status update error:', error);
    res.status(500).json({ 
      error: 'Failed to update card status',
      details: error.message 
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
router.get(['/', '/list'], async (req, res) => {
  try {
    // STEP 1: Extract query parameters dengan default values
    const { 
      status,                    // Filter by status (optional)
      userId,                    // Filter by user (optional)
      limit = 50,                // Default: 50 cards per page
      offset = 0,                // Default: start from beginning
      sortBy = 'createdAt',      // Default: sort by registration date
      order = 'desc'             // Default: newest first
    } = req.query;

    // STEP 2: Build where clause untuk filtering
    const whereClause = {};
    if (status) whereClause.cardStatus = status;          // Filter by status jika provided
    if (userId) whereClause.userId = parseInt(userId);    // Filter by user jika provided
    // whereClause akan dikirim ke Prisma untuk SQL WHERE condition

    // STEP 3: Query cards dari database dengan filters, sorting, pagination
    const cards = await prisma.nFCCard.findMany({
      where: whereClause,
      include: {
        user: {  // Include user data untuk setiap card
          select: {
            id: true,
            name: true,
            username: true,
            balance: true
          }
        }
      },
      orderBy: { [sortBy]: order },      // Dynamic sorting (createdAt desc, balance asc, dll)
      take: parseInt(limit),              // LIMIT clause (SQL)
      skip: parseInt(offset)              // OFFSET clause (SQL)
    });
    // SQL equivalent: SELECT * FROM NFCCard WHERE ... ORDER BY ... LIMIT ... OFFSET ...

    // STEP 4: Count total cards untuk pagination metadata
    const total = await prisma.nFCCard.count({ where: whereClause });

    console.log(`📋 Listed ${cards.length} NFC cards (Total: ${total})`);

    // STEP 5: Return success response dengan pagination info
    res.json({
      success: true,
      cards,                // Array of card objects
      total,                // Total count (all cards, ignoring pagination)
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)  // Boolean: ada page berikutnya?
      }
    });
    // Client dapat gunakan hasMore untuk show "Load More" button

  } catch (error) {
    console.error('❌ List cards error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list cards',
      details: error.message 
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
router.get('/transactions/:cardId', async (req, res) => {
  try {
    // STEP 1: Extract parameters
    const { cardId } = req.params;           // URL param: /transactions/:cardId
    const { limit = 50, offset = 0 } = req.query;  // Query params: ?limit=10&offset=0

    // STEP 2: Query transactions dari database (sorted by newest first)
    const transactions = await prisma.nFCTransaction.findMany({
      where: { cardId },                     // Filter by specific card
      orderBy: { createdAt: 'desc' },        // Sort: newest first
      take: parseInt(limit),                 // Limit results
      skip: parseInt(offset)                 // Pagination offset
    });
    // Returns: Array of NFCTransaction records untuk card ini

    // STEP 3: Count total transactions untuk pagination info
    const total = await prisma.nFCTransaction.count({ where: { cardId } });

    console.log(`📜 Listed ${transactions.length} transactions for card ${cardId.slice(0, 8)}...`);

    // STEP 4: Parse metadata JSON (convert string -> object untuk easier consumption)
    const parsedTransactions = transactions.map(t => ({
      ...t,  // Spread all fields
      metadata: t.metadata ? JSON.parse(t.metadata) : null  // Parse JSON string
    }));
    // metadata field di database: "{\"description\":\"Payment\",...}" (string)
    // After parse: { description: "Payment", ... } (object)

    // STEP 5: Return success response
    res.json({
      success: true,
      transactions: parsedTransactions,
      total,                                 // Total count (all transactions)
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get transactions',
      details: error.message 
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
router.get('/info/:cardId', async (req, res) => {
  try {
    // STEP 1: Extract cardId dari URL param
    const { cardId } = req.params;
    
    // STEP 2: Query card dari database dengan relations
    const card = await prisma.nFCCard.findUnique({
      where: { cardId },
      include: {
        user: {  // Include user info lengkap
          select: { 
            id: true, 
            name: true, 
            username: true, 
            balance: true, 
            isActive: true  // User account status
          } 
        },
        transactions: {  // Include recent 10 transactions
          take: 10,                        // Limit 10 transactions
          orderBy: { createdAt: 'desc' }   // Newest first
        }
      }
    });
    // Returns: Card object dengan nested user & transactions

    if (!card) return res.status(404).json({ error: 'Card not found' });

    // STEP 3: Calculate transaction statistics (aggregate functions)
    const stats = await prisma.nFCTransaction.aggregate({
      where: { cardId },
      _sum: { amount: true },    // Total amount (sum all transactions)
      _count: true               // Total transaction count
    });
    // Aggregate: efficient SQL operations (SUM, COUNT tanpa loading all records)

    console.log(`ℹ️ Card info retrieved: ${cardId.slice(0, 8)}...`);

    // STEP 4 & 5: Return card info + statistics
    res.json({
      success: true,
      card: {
        ...card,  // Spread all card fields
        metadata: card.metadata ? JSON.parse(card.metadata) : null  // Parse JSON
      },
      statistics: {
        totalTransactions: stats._count,          // Total transaction count
        totalAmount: stats._sum.amount || 0      // Total amount (all transactions combined)
      }
    });
    // Response berisi: card details, user info, recent transactions, statistics

  } catch (error) {
    console.error('❌ Get card info error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get card info',
      details: error.message 
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
// AUTHORIZATION: Require admin password
// ⚠️ WARNING: Ini adalah DESTRUCTIVE operation - tidak bisa di-undo!
//
// FLOW:
// STEP 1: Extract cardId & adminPassword
// STEP 2: Verify admin password (authorization check)
// STEP 3: Validate card exists
// STEP 4: Delete cascade - delete related transactions first (foreign key constraint)
// STEP 5: Delete card record
// STEP 6: Return deletion confirmation
// ============================================================================
router.delete(['/:cardId', '/delete/:cardId'], async (req, res) => {
  try {
    // STEP 1: Extract parameters
    const { cardId } = req.params;         // URL param: /delete/:cardId
    const { adminPassword } = req.body;    // Request body (POST data in DELETE request)

    // STEP 2: Verify admin password (AUTHORIZATION CHECK)
    if (adminPassword !== (process.env.ADMIN_PASSWORD || 'admin123')) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }
    // Password match - authorization successful
    console.log(`✅ DELETE card auth passed for card: ${cardId}`);

    // STEP 3: Validate card exists
    const card = await prisma.nFCCard.findUnique({ 
      where: { cardId },
      include: { user: true }  // Include user untuk logging purposes
    });
    
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // STEP 4: Delete related transactions first (foreign key cascade)
    // ⚠️ IMPORTANT: Must delete child records before parent (referential integrity)
    await prisma.nFCTransaction.deleteMany({ where: { cardId } });
    // deleteMany: delete all transactions untuk kartu ini

    // STEP 5: Delete card record (parent table)
    await prisma.nFCCard.delete({ where: { cardId } });
    // After this: card permanently deleted from database

    // Log deletion event
    console.log(`🗑️ Card deleted: ${cardId} (User: ${card.user?.username || 'unlinked'})`);

    // STEP 6: Return deletion confirmation
    res.json({
      success: true,
      message: 'Card deleted successfully',
      deletedCard: {
        cardId: card.cardId,
        userId: card.userId,
        username: card.user?.username  // Info user yang kehilangan kartu
      }
    });
    // Client akan display confirmation: "Card {UID} deleted successfully"

  } catch (error) {
    console.error('❌ Delete card error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete card',
      details: error.message 
    });
  }
});
// ============================================================================
// END OF ENDPOINT: DELETE /:cardId
// ============================================================================

// Export router untuk di-mount di server.js
module.exports = router;
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
