// ============================================================
// SERVER.JS - MAIN BACKEND SERVER NFC PAYMENT SYSTEM
// ============================================================
// File ini adalah jantung backend yang menangani:
// - API endpoints untuk mobile app (login, transaksi, balance, dll)
// - Koneksi database melalui Prisma ORM
// - Real-time updates via Socket.IO
// - Security & rate limiting
// - Admin dashboard endpoints

// Load environment variables dari file .env
// File .env berisi konfigurasi sensitif: DATABASE_URL, JWT_SECRET, PORT, dll
require('dotenv').config(); // Execute dotenv untuk inject variabel ke process.env

const express = require('express'); // Framework web server dengan routing & middleware
const cors = require('cors'); // Middleware untuk izinkan cross-origin requests (mobile app)
const helmet = require('helmet'); // Security middleware: set HTTP headers untuk proteksi
const morgan = require('morgan'); // HTTP logger: catat semua request (method, URL, status, time)
const rateLimit = require('express-rate-limit'); // Anti spam: batasi request per IP
const { PrismaClient } = require('@prisma/client'); // ORM untuk database SQLite
const http = require('http'); // Node.js HTTP server (perlu untuk Socket.IO)
const socketIo = require('socket.io'); // Real-time communication: push updates ke clients
const path = require('path'); // Utility untuk manipulasi path file sistem
const os = require('os'); // Info sistem operasi: hostname, IP, platform, dll

const authRoutes = require('./routes/auth'); // Auth: login, register, logout, verify
const userRoutes = require('./routes/users'); // User: get, update, delete, balance
const transactionRoutes = require('./routes/transactions'); // Transaction: send, receive, history
const fraudRoutes = require('./routes/fraud'); // Fraud: detect, alert, review, block
const adminRoutes = require('./routes/admin'); // Admin: dashboard, stats, logs, bulk ops
const deviceRoutes = require('./routes/devices'); // Device: register, sync, health check
const nfcCardRoutes = require('./routes/nfcCards'); // NFC Card: register, link, topup, status

const { authenticateToken, authenticateAdmin } = require('./middleware/auth'); // Auth middleware: cek JWT & admin password
const { errorHandler } = require('./middleware/errorHandler'); // Error handler: tangani semua error terpusat
const { requestLogger } = require('./middleware/logger'); // Logger: catat detail request (time, IP, body, headers)

const app = express(); // Buat Express app instance untuk routing
const server = http.createServer(app); // Buat HTTP server yang wrap Express (untuk Socket.IO)
const prisma = new PrismaClient(); // Buat Prisma client untuk akses database

/* ------------------------- 🔧 CONFIGURATIONS ------------------------- */
const PORT = Number(process.env.PORT || 4000); // Port server dari .env, default 4000
const HOST = process.env.HOST || '0.0.0.0'; // Host binding: 0.0.0.0 = listen all interfaces
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); // Rate limit window: 15 menit (ms)
const MAX_REQS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100); // Max request: 100 per window

// Daftar origin yang diizinkan (dari .env). Format: comma-separated URLs.
// Contoh .env: ALLOWED_ORIGINS=http://localhost:3000,https://ngrok-url.app
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*']; // Fallback ke semua origin jika .env tidak di-set

const io = socketIo(server, { // Buat Socket.IO instance dari HTTP server
  cors: {
    origin: ALLOWED_ORIGINS, // Origin dari .env (ALLOWED_ORIGINS)
    methods: ['GET', 'POST'], // Allow method HTTP yang dibutuhkan
    credentials: true, // Allow credentials (cookies, auth headers)
  },
});

// Trust proxy: agar Express bisa ambil real IP client (bukan IP proxy/load balancer)
// Penting untuk rate limiting & logging yang akurat
app.set('trust proxy', 1); // 1 = trust first proxy hop

/* ------------------------- 🧱 MIDDLEWARES ------------------------- */
// STEP 9: Apply middlewares (dieksekusi untuk setiap request yang masuk)
// Middleware dijalankan secara berurutan dari atas ke bawah

// 9.1: Helmet - Security headers
// Menambahkan HTTP headers untuk proteksi dari serangan web (XSS, clickjacking, dll)
app.use(helmet());

// 9.2: Morgan - HTTP logger
// Log semua HTTP request ke console dalam format 'combined' (Apache style)
app.use(morgan('combined'));

// 9.3: JSON parser
// Parse request body yang berformat JSON (max size: 10MB)
app.use(express.json({ limit: '10mb' }));

// 9.4: URL-encoded parser
// Parse request body yang berformat application/x-www-form-urlencoded (untuk form submit)
app.use(express.urlencoded({ extended: true }));

// 9.5: Custom request logger
// Log request dengan format custom (dari middleware/logger.js)
app.use(requestLogger);

// 9.6: CORS setup (Cross-Origin Resource Sharing)
// Mengizinkan mobile app dan admin dashboard untuk akses API dari domain berbeda
// Origin dikonfigurasi via ALLOWED_ORIGINS di .env (comma-separated)
app.use(
  cors({
    origin: ALLOWED_ORIGINS, // Dari .env: ALLOWED_ORIGINS (bukan wildcard *)
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','x-app-key'],
    credentials: true
  })
);

// 9.7: CORS preflight untuk semua routes
// Handle OPTIONS request yang dikirim browser sebelum request sesungguhnya
app.options('*', cors());

// 9.8: Rate limiting
// Batasi jumlah request per IP untuk mencegah spam dan DDoS attack
app.use(
  '/api', // Apply rate limit hanya untuk path /api/*
  rateLimit({
    windowMs: WINDOW_MS, // Window waktu (15 menit)
    max: MAX_REQS, // Max 100 request per window
    standardHeaders: true, // Return rate limit info di headers (RateLimit-*)
    legacyHeaders: false, // Matikan X-RateLimit-* headers (deprecated)
    message: { error: 'Too many requests, please try again later.' }, // Error message jika limit tercapai
  })
);

// 9.9: Attach Socket.IO & Prisma ke request object
// Agar semua route handler bisa akses io dan prisma via req.io dan req.prisma
app.use((req, res, next) => {
  req.io = io; // Socket.IO instance untuk emit real-time events
  req.prisma = prisma; // Prisma client untuk query database
  next(); // Lanjut ke middleware/route handler berikutnya
});

/* ------------------------- 🩺 HEALTH CHECK ------------------------- */
// STEP 10: Health check endpoint
// Endpoint untuk cek apakah server dan database berjalan dengan baik
// Diakses oleh: mobile app (untuk detect server), monitoring tools, admin dashboard
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    // STEP 10.1: Test koneksi database dengan query sederhana
    await prisma.$queryRaw`SELECT 1`; // Query "SELECT 1" untuk test apakah DB respond
    
    // STEP 10.2: Device detection & tracking
    // Jika request dari Android app (okhttp), catat sebagai device
    const userAgent = req.headers['user-agent'] || ''; // Ambil user agent dari header
    if (userAgent.includes('okhttp')) { // okhttp = HTTP client yang dipakai Android app
      const now = new Date(); // Waktu sekarang
      const deviceId = req.ip.replace(/[.:]/g, '_'); // Convert IP address jadi deviceId (10.0.2.2 -> 10_0_2_2)
      
      try {
        // STEP 10.2.1: Update atau create device record di database
        // upsert = update jika ada, create jika belum ada
        await prisma.device.upsert({
          where: { deviceId: deviceId }, // Cari berdasarkan deviceId
          update: { // Jika sudah ada, update field berikut:
            ipAddress: req.ip, // Update IP (bisa berubah jika pakai DHCP)
            lastSeen: now, // Update waktu terakhir terlihat
            isOnline: true, // Set status online
            platform: 'android' // Platform device
          },
          create: { // Jika belum ada, create device baru dengan data:
            deviceId: deviceId, // ID unik device (dari IP)
            deviceName: `Android Device (${req.ip})`, // Nama device (tampil di admin)
            platform: 'android', // Platform
            ipAddress: req.ip, // IP address device
            lastSeen: now, // Waktu terakhir terlihat
            isOnline: true, // Status online
            totalUsers: 0, // Total user di device ini (akan diupdate saat sync)
            totalBalance: 0 // Total saldo semua user di device (akan diupdate saat sync)
          }
        });
        
        console.log(`📱 Device health check: ${deviceId} (${req.ip})`); // Log ke console
      } catch (deviceError) {
        console.error('Device record error:', deviceError); // Log error tapi jangan fail request
      }
    }
    
    // STEP 10.3: Kirim response sukses
    res.json({
      status: 'OK', // Status server
      timestamp: new Date().toISOString(), // Waktu sekarang (ISO format)
      version: '2.0.0', // Versi backend API
      database: 'connected', // Status database
    });
  } catch (error) {
    // STEP 10.4: Jika ada error (biasanya database error), kirim response error
    res.status(500).json({
      status: 'ERROR', // Status server error
      timestamp: new Date().toISOString(), // Waktu error terjadi
      database: 'disconnected', // Database tidak tersambung
      error: error.message, // Error message detail
    });
  }
});

/* ------------------------- 📋 API ROOT ENDPOINT ------------------------- */
// STEP 11: API root endpoint - Dokumentasi API yang tersedia
// GET /api -> Return list semua endpoint yang tersedia (API directory)
app.get('/api', (req, res) => {
  res.json({
    status: 'OK', // Status API
    server: 'NFC Payment Backend API', // Nama server
    version: '2.0.0', // Versi API
    timestamp: new Date().toISOString(), // Waktu sekarang
    endpoints: { // Daftar endpoint yang tersedia (untuk dokumentasi)
      health: '/health atau /api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      },
      users: {
        me: 'GET /api/users/me',
        all: 'GET /api/users/all',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      },
      admin: {
        dashboard: '/admin',
        updateBalance: 'POST /api/update-balance'
      },
      debug: {
        users: 'GET /api/debug/users',
        ping: 'GET /api/ping'
      }
    }
  });
});

/* ------------------------- 👤 PUBLIC USER ENDPOINTS (NO AUTH) ------------------------- */
// STEP 12: Get current user info (untuk sync balance dari mobile app)
// Endpoint PUBLIC (tanpa JWT auth) agar mobile app bisa sync balance dengan mudah
// GET /api/users/me -> Return user info berdasarkan userId
app.get('/api/users/me', async (req, res) => {
  try {
    // STEP 12.1: Ambil userId dari header atau query parameter
    // Mobile app kirim userId via header x-user-id atau query ?userId=123
    const userId = req.headers['x-user-id'] || req.query.userId;
    
    // STEP 12.2: Validasi userId wajib ada
    if (!userId) {
      console.log('❌ No user ID provided in request');
      return res.status(400).json({ error: 'User ID required in x-user-id header or userId query' });
    }
    
    // STEP 12.3: Convert userId ke integer dan validasi format
    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt)) { // Jika bukan angka valid
      console.log(`❌ Invalid user ID format: ${userId}`);
      return res.status(400).json({ error: 'User ID must be a valid number' });
    }
    
    console.log(`👤 Looking for user ID: ${userIdInt}...`); // Log request
    
    // STEP 12.4: Query user dari database berdasarkan ID
    const user = await prisma.user.findUnique({
      where: { id: userIdInt }, // WHERE id = userIdInt
      select: { // SELECT hanya field yang diperlukan (jangan return password!)
        id: true, // User ID
        name: true, // Nama lengkap
        username: true, // Username untuk login
        balance: true, // Saldo user (PENTING untuk sync)
        isActive: true, // Status aktif/blokir
        updatedAt: true, // Waktu terakhir diupdate
        createdAt: true // Waktu user dibuat
      }
    });
    
    // STEP 12.5: Jika user tidak ditemukan, return 404
    if (!user) {
      console.log(`❌ User not found in database: ID ${userIdInt}`);
      return res.status(404).json({ error: `User with ID ${userIdInt} not found` });
    }
    
    // STEP 12.6: User ditemukan, return data user
    console.log(`✅ User found: ${user.username} (ID: ${user.id}), balance: ${user.balance}`);
    res.json({ success: true, user: user });
    
  } catch (error) {
    // STEP 12.7: Handle error (database error, dll)
    console.error('❌ Get user error:', error); // Log error ke console
    res.status(500).json({ error: 'Failed to get user info', details: error.message });
  }
});

// STEP 13: List all users for debugging (NO AUTH)
// Endpoint PUBLIC untuk debug - return semua user di database
// GET /api/users/all -> Return array semua user
app.get('/api/users/all', async (req, res) => {
  try {
    // STEP 13.1: Query semua user dari database
    const users = await prisma.user.findMany({
      select: { // SELECT hanya field yang diperlukan
        id: true, // User ID
        name: true, // Nama lengkap
        username: true, // Username
        balance: true, // Saldo
        isActive: true, // Status aktif/blokir
        createdAt: true // Waktu dibuat
      },
      orderBy: { // ORDER BY id ASC (urut dari ID terkecil)
        id: 'asc'
      }
    });
    
    // STEP 13.2: Log hasil ke console untuk debug
    console.log(`📊 All users in database: ${users.length} users`);
    users.forEach(user => { // Loop setiap user dan log detailnya
      console.log(`  - ID: ${user.id}, Username: ${user.username}, Balance: ${user.balance}`);
    });
    
    // STEP 13.3: Return response dengan array users
    res.json({ success: true, users: users, count: users.length });
    
  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({ error: 'Failed to get all users' });
  }
});

// STEP 14: Update user (PUT /api/users/:id) - untuk edit balance dan name (NO AUTH)
// Endpoint untuk update data user (dipanggil dari admin dashboard)
// PUT /api/users/:id -> Update balance atau name user
app.put('/api/users/:id', async (req, res) => {
  try {
    // STEP 14.1: Ambil userId dari URL parameter (/api/users/123 -> userId = 123)
    const userId = parseInt(req.params.id);
    // STEP 14.2: Ambil data yang akan diupdate dari request body
    const { balance, name } = req.body;
    
    // STEP 14.3: Validasi userId wajib ada
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    // STEP 14.4: Build update data object (hanya field yang ada di request body)
    const updateData = {}; // Object kosong
    if (balance !== undefined) updateData.balance = parseInt(balance); // Jika balance ada, tambahkan ke updateData
    if (name !== undefined) updateData.name = name; // Jika name ada, tambahkan ke updateData
    
    // STEP 14.5: Update user di database
    const updatedUser = await prisma.user.update({
      where: { id: userId }, // WHERE id = userId
      data: updateData // SET balance=xxx, name=xxx (sesuai updateData)
    });
    
    // STEP 14.6: Log update action
    console.log(`✏️ Updated user ${userId}: balance=${balance}, name=${name}`);
    
    // STEP 14.7: Return updated user data
    res.json({ success: true, user: updatedUser });
    
  } catch (error) {
    // STEP 14.8: Handle error
    if (error.code === 'P2025') { // Prisma error code P2025 = record not found
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// STEP 15: Get user by ID (PUBLIC - NO AUTH) - untuk Mobile App sync balance
// Endpoint untuk mobile app ambil data user berdasarkan ID tanpa JWT token
// GET /api/users/:id/public -> Return user data
app.get('/api/users/:id/public', async (req, res) => {
  try {
    // STEP 15.1: Ambil userId dari URL parameter
    const userId = parseInt(req.params.id); // Parse string ke integer
    
    // STEP 15.2: Validasi userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // STEP 15.3: Query user dari database
    const user = await prisma.user.findUnique({
      where: { id: userId }, // WHERE id = userId
      select: { // SELECT field yang diperlukan (tanpa password!)
        id: true, // User ID
        name: true, // Nama lengkap
        username: true, // Username
        balance: true, // Saldo (PENTING untuk sync)
        isActive: true, // Status aktif/blokir
        deviceId: true, // Device ID untuk tracking
        createdAt: true, // Waktu dibuat
        updatedAt: true // Waktu terakhir diupdate
      }
    });

    // STEP 15.4: Validasi user ditemukan
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // STEP 15.5: Log request untuk monitoring
    console.log(`📱 Public user fetch: ${user.username} (balance: ${user.balance})`);

    // STEP 15.6: Return user data
    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Get user public error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/* ------------------------- 🧭 ROUTES ------------------------- */
// STEP 16: Setup routes & static files
// Mount semua route modules ke Express app

// STEP 16.1: Serve admin dashboard static files
// Folder admin berisi HTML, CSS, JS untuk dashboard
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// STEP 16.2: Route untuk admin dashboard homepage
// GET /admin -> Serve simple-dashboard.html
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, '../admin/simple-dashboard.html'))
);

// STEP 16.3: Mount route modules ke Express app
// Public endpoints (no auth required)
app.use('/api/auth', authRoutes); // Auth endpoints: /api/auth/login, /api/auth/register
app.use('/api/devices', deviceRoutes); // Device endpoints: /api/devices/sync, /api/devices/list
app.use('/api/nfc-cards', nfcCardRoutes); // NFC Card management: /api/nfc-cards/register, /api/nfc-cards/link, dll

// Protected endpoints (require auth)
app.use('/api/users', authenticateToken, userRoutes); // User endpoints (perlu JWT): /api/users/:id, /api/users/me
app.use('/api/transactions', authenticateToken, transactionRoutes); // Transaction endpoints (perlu JWT): /api/transactions/send, /api/transactions/history
app.use('/api/fraud', authenticateToken, fraudRoutes); // Fraud endpoints (perlu JWT): /api/fraud/alert, /api/fraud/check
app.use('/api/admin', authenticateAdmin, adminRoutes); // Admin endpoints (perlu admin password): /api/admin/dashboard, /api/admin/bulk-topup

// STEP 16.4: Error handling middleware (generic)
// Middleware untuk catch uncaught errors
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught error:', err); // Log error ke console
  res.status(500).json({ error: 'Internal server error' }); // Return 500 error
});


// STEP 17: Ping endpoint - Simple health check untuk mobile app
// Endpoint paling sederhana untuk cek apakah server online
// GET /api/ping -> Return status OK
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok', // Status server (ok = online)
    timestamp: new Date().toISOString(), // Waktu sekarang (ISO 8601 format)
    server: 'NFC Payment Backend Server', // Nama server
    version: '2.0.0', // Versi API
    uptime: process.uptime(), // Uptime server dalam detik (berapa lama server sudah running)
  });
});

// STEP 18: DEBUG ENDPOINT - Direct access to users (bypass auth)
// Endpoint khusus untuk debugging - return semua user tanpa autentikasi
// Count unique users only (hindari duplikasi)
// GET /api/debug/users -> Return array semua user
app.get('/api/debug/users', async (req, res) => {
  try {
    console.log('🔧 DEBUG: Direct user access (count unique users only)');
    
    // STEP 18.1: Hitung total user unik (tanpa duplikasi device)
    const totalUniqueUsers = await prisma.user.count(); // COUNT(*) dari tabel user
    
    // STEP 18.2: Query semua user dengan field yang diperlukan
    const users = await prisma.user.findMany({
      select: { // SELECT field berikut:
        id: true, // User ID
        name: true, // Nama lengkap
        username: true, // Username
        balance: true, // Saldo
        isActive: true, // Status aktif/blokir
        createdAt: true, // Waktu dibuat
        updatedAt: true, // Waktu terakhir diupdate
        deviceId: true // Device ID (untuk tracking)
      },
      orderBy: { // ORDER BY createdAt DESC (user terbaru di atas)
        createdAt: 'desc'
      }
    });

    // STEP 18.3: Log info ke console
    console.log(`🔧 DEBUG: Found ${totalUniqueUsers} unique users`);

    // STEP 18.4: Return response dengan data users
    res.json({
      success: true, // Status success
      users: users, // Array semua user
      totalUniqueUsers: totalUniqueUsers, // Total user unik
      total: users.length, // Total user dalam response
      debug: true // Flag bahwa ini debug endpoint
    });

  } catch (error) {
    console.error('❌ DEBUG users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});


/* ------------------------- ⚖️ ADMIN ENDPOINTS ------------------------- */
// STEP 19: Update balance (top-up saldo) untuk user berdasarkan deviceId/userId
// Endpoint untuk admin top-up saldo user dari admin dashboard
// POST /api/update-balance -> Top-up saldo user
app.post('/api/update-balance', async (req, res) => {
  try {
    // STEP 19.1: Ambil data dari request body
    const { deviceId, amount, adminPassword } = req.body;
    
    // STEP 19.2: Validasi admin password
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' }); // 401 Unauthorized
    }
    
    // STEP 19.3: Validasi input (deviceId dan amount wajib ada, amount > 0)
    if (!deviceId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid input data' }); // 400 Bad Request
    }
    
    // STEP 19.4: Cari user berdasarkan deviceId atau userId
    let targetUser; // Variable untuk menyimpan user yang ditemukan
    if (deviceId.startsWith('user_')) { // Jika deviceId format: user_123
      const userId = parseInt(deviceId.replace('user_', '')); // Extract user ID (user_123 -> 123)
      targetUser = await prisma.user.findUnique({
        where: { id: userId } // WHERE id = userId
      });
    } else { // Jika deviceId biasa (bukan user_xxx)
      targetUser = await prisma.user.findFirst({
        where: { deviceId: deviceId } // WHERE deviceId = deviceId
      });
    }
    
    // STEP 19.5: Validasi user ditemukan
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' }); // 404 Not Found
    }
    
    // STEP 19.6: Update balance user (increment balance dengan amount)
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id }, // WHERE id = targetUser.id
      data: {
        balance: { // UPDATE balance
          increment: amount // balance = balance + amount (atomic operation)
        }
      }
    });
    
    // STEP 19.7: Log action ke console
    console.log(`💰 Admin top-up: ${amount} to user ${targetUser.username} (ID: ${targetUser.id})`);
    
    // STEP 19.8: Return response sukses dengan new balance
    res.json({ success: true, newBalance: updatedUser.balance });
    
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// STEP 20: Delete user endpoint (bukan device)
// Endpoint untuk admin hapus user dari database
// DELETE /api/delete-device/:deviceId -> Hapus user
app.delete('/api/delete-device/:deviceId', async (req, res) => {
  try {
    // STEP 20.1: Ambil deviceId dari URL parameter
    const { deviceId } = req.params;
    // STEP 20.2: Ambil adminPassword dari request body
    const { adminPassword } = req.body;
    
    // STEP 20.3: Validasi admin password
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    // STEP 20.4: Cari user berdasarkan deviceId atau userId
    let targetUser; // Variable untuk menyimpan user yang akan dihapus
    if (deviceId.startsWith('user_')) { // Format: user_123
      const userId = parseInt(deviceId.replace('user_', '')); // Extract ID (user_123 -> 123)
      targetUser = await prisma.user.findUnique({
        where: { id: userId } // WHERE id = userId
      });
    } else { // deviceId biasa
      targetUser = await prisma.user.findFirst({
        where: { deviceId: deviceId } // WHERE deviceId = deviceId
      });
    }
    
    // STEP 20.5: Validasi user ditemukan
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // STEP 20.6: Hapus user dari database
    await prisma.user.delete({
      where: { id: targetUser.id } // DELETE FROM users WHERE id = targetUser.id
    });
    
    // STEP 20.7: Log action ke console
    console.log(`🗑️ Admin deleted user: ${targetUser.username} (ID: ${targetUser.id})`);
    
    // STEP 20.8: Return response sukses
    res.json({ success: true, message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/* ------------------------- ⚡ SOCKET.IO ------------------------- */
// STEP 21: Setup Socket.IO untuk real-time updates
// Socket.IO memungkinkan push notification ke admin dashboard dan mobile app

// STEP 21.1: Event 'connection' - Terjadi saat client connect ke server
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id); // Log socket ID client yang connect

  // STEP 21.2: Event 'join-admin' - Admin dashboard join room untuk terima updates
  socket.on('join-admin', () => {
    socket.join('admin-room'); // Masukkan socket ini ke room 'admin-room'
    console.log('👤 Admin joined room'); // Log admin join
  });

  // STEP 21.3: Event 'join-device' - Mobile device join room untuk terima balance updates
  socket.on('join-device', (deviceId) => {
    socket.join(`device-${deviceId}`); // Masukkan socket ke room 'device-{deviceId}'
    console.log(`📱 Device ${deviceId} joined room`); // Log device join
  });

  // STEP 21.4: Event 'disconnect' - Terjadi saat client disconnect
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id); // Log socket ID yang disconnect
  });
});

/* ------------------------- ⚙️ ERROR HANDLING ------------------------- */
// STEP 22: Apply error handler middleware
// Middleware ini akan catch semua error yang tidak tertangkap di endpoint
app.use(errorHandler);

/* ------------------------- 🌐 NETWORK INFO ------------------------- */
// STEP 23: Helper function untuk get LAN IP addresses
// Fungsi ini digunakan untuk menampilkan IP laptop ke console saat server start
// Berguna untuk tahu IP mana yang harus diakses dari Android
function getLanIPs() {
  const ifaces = os.networkInterfaces(); // Ambil semua network interfaces
  const list = []; // Array untuk menyimpan IP addresses
  
  // Loop semua interfaces (WiFi, Ethernet, dll)
  const names = Object.keys(ifaces);
  for (let i = 0; i < names.length; i++) {
    const addrs = ifaces[names[i]];
    for (let j = 0; j < addrs.length; j++) {
      const iface = addrs[j];
      // Filter hanya IPv4 dan bukan internal (localhost)
      if (iface.family === 'IPv4' && !iface.internal) {
        list.push(iface.address); // Tambahkan IP ke list
      }
    }
  }
  return list; // Return array IP addresses
}

/* ------------------------- 🚀 SERVER START ------------------------- */
// STEP 24: Start server dengan async IIFE (Immediately Invoked Function Expression)
// Fungsi async diperlukan karena kita pakai await untuk Prisma connection
(async () => {
  try {
    // STEP 24.1: Connect ke database via Prisma
    await prisma.$connect(); // Tunggu sampai koneksi database berhasil
    console.log('🗄️ Prisma connected successfully.'); // Log sukses connect

    // STEP 24.2: Start HTTP server pada PORT dan HOST yang ditentukan
    server.listen(PORT, HOST, () => {
      // STEP 24.3: Ambil semua LAN IP addresses

      // STEP 24.4: Display server info ke console
      console.log('\n🚀 NFC Payment Backend Server started!');
      console.log(`📊 Server bind : http://${HOST}:${PORT}`);
      console.log(`🔍 Health Check: http://${HOST}:${PORT}/health`);
      console.log(`🖥️  Admin Dash : http://${HOST}:${PORT}/admin`);
      console.log(`📡 Socket.IO   : Enabled`);
      
      // STEP 24.5: Display LAN IPs (untuk access dari Android di WiFi yang sama)
      const ips = getLanIPs(); // Call helper function untuk get IP
      if (ips.length > 0) {
        console.log('\n🌐 Test from phone (same Wi-Fi / hotspot):');
        for (let i = 0; i < ips.length; i++) {
          console.log(`   • http://${ips[i]}:${PORT}/api/health`);
        }
      }
      
      // STEP 24.6: Display available APIs
      console.log('\n📋 Available APIs:');
      console.log('   🔐 Auth         : /api/auth/login, /api/auth/register');
      console.log('   👤 Users        : /api/users');
      console.log('   💳 Transactions : /api/transactions');
      console.log('   🚨 Fraud        : /api/fraud');
      console.log('   📱 Devices      : /api/devices');
      console.log('   🛠️  Admin       : /api/admin\n');
    });
  } catch (err) {
    // STEP 24.7: Handle error saat connect Prisma atau start server
    console.error('❌ Failed to connect Prisma:', err);
    process.exit(1); // Exit process dengan code 1 (error)
  }
})();

/* ------------------------- 🧹 GRACEFUL SHUTDOWN ------------------------- */
// STEP 25: Setup graceful shutdown handlers
// Fungsi ini memastikan server shutdown dengan benar (disconnect database, dll)
// Terjadi saat process menerima signal SIGINT (Ctrl+C) atau SIGTERM (kill)
const gracefulExit = async function(signal) {
  // STEP 25.1: Log signal yang diterima
  console.log(`\n🛑 ${signal} received... Shutting down gracefully.`);
  
  try {
    // STEP 25.2: Disconnect Prisma dari database
    await prisma.$disconnect(); // Close semua connection ke database
  } catch {} // Ignore error saat disconnect
  
  // STEP 25.3: Close HTTP server
  server.close(() => {
    console.log('✅ Server shut down successfully'); // Log sukses shutdown
    process.exit(0); // Exit process dengan code 0 (sukses)
  });
};

// STEP 26: Register signal handlers
// SIGINT = Signal dari Ctrl+C di terminal
process.on('SIGINT', () => gracefulExit('SIGINT'));
// SIGTERM = Signal dari kill command atau container orchestration
process.on('SIGTERM', () => gracefulExit('SIGTERM'));

// STEP 27: Handle unhandled promise rejections
// Catch promise yang reject tapi tidak di-catch dengan try/catch atau .catch()
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Rejection:', reason); // Log error untuk debugging
  // Tidak exit process, hanya log saja (agar server tetap jalan)
});

// STEP 28: Export app, io, dan prisma untuk testing atau import di file lain
module.exports = { app, io, prisma };
