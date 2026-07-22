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
require('dotenv').config();
// Execute dotenv untuk inject variabel ke process.env

const express = require('express');
// Framework web server dengan routing & middleware
const cors = require('cors');
// Middleware untuk izinkan cross-origin requests (mobile app)
const helmet = require('helmet');
// Security middleware: set HTTP headers untuk proteksi
const morgan = require('morgan');
// HTTP logger: catat semua request (method, URL, status, time)
const rateLimit = require('express-rate-limit');
// Anti spam: batasi request per IP
const { PrismaClient } = require('@prisma/client');
// ORM untuk database SQLite
const http = require('http');
// Node.js HTTP server (perlu untuk Socket.IO)
const socketIo = require('socket.io');
// Real-time communication: push updates ke clients
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
// Utility untuk manipulasi path file sistem
const os = require('os');
// Info sistem operasi: hostname, IP, platform, dll

const authRoutes = require('./routes/auth');
// Auth: login, register, logout, verify
const userRoutes = require('./routes/users');
// User: get, update, delete, balance
const transactionRoutes = require('./routes/transactions');
// Transaction: send, receive, history
const fraudRoutes = require('./routes/fraud');
// Fraud: detect, alert, review, block
const adminRoutes = require('./routes/admin');
// Admin: dashboard, stats, logs, bulk ops
const deviceRoutes = require('./routes/devices');
// Device: register, sync, health check
const nfcCardRoutes = require('./routes/nfcCards');
// NFC Card: register, link, topup, status

const { authenticateToken, authenticateAdmin, authenticateUserOrAdmin, verifyAdminToken } = require('./middleware/auth');
// Auth middleware memverifikasi bearer JWT pengguna/admin dan sesi pengguna yang masih aktif.
const { errorHandler } = require('./middleware/errorHandler');
// Error handler: tangani semua error terpusat
const { requestLogger } = require('./middleware/logger');
// Logger: catat detail request (time, IP, body, headers)

const app = express();
// Buat Express app instance untuk routing
const server = http.createServer(app);
// Buat HTTP server yang wrap Express (untuk Socket.IO)
const prisma = new PrismaClient();
// Buat Prisma client untuk akses database

// ------------------------- 🔧 CONFIGURATIONS -------------------------
const PORT = Number(process.env.PORT || 4000);
// Port server dari .env, default 4000
const HOST = process.env.HOST || '0.0.0.0';
// Host binding: 0.0.0.0 = listen all interfaces
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
// Rate limit window: 15 menit (ms)
const MAX_REQS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500);
// Max request: 500 per window

const requiredSecrets = ['JWT_SECRET', 'ADMIN_JWT_SECRET', 'ADMIN_PASSWORD', 'NFC_ENCRYPTION_KEY'];
for (const variableName of requiredSecrets) {
  if (!process.env[variableName]) throw new Error(`${variableName} must be configured`);
}
if (process.env.JWT_SECRET.length < 48 || process.env.ADMIN_JWT_SECRET.length < 48) {
  throw new Error('JWT secrets must contain at least 48 characters');
}
if (process.env.JWT_SECRET === process.env.ADMIN_JWT_SECRET) {
  throw new Error('JWT_SECRET and ADMIN_JWT_SECRET must be different');
}
if (process.env.NFC_ENCRYPTION_KEY.length < 48) {
  throw new Error('NFC_ENCRYPTION_KEY must contain at least 48 characters');
}
// Daftar origin yang diizinkan (dari .env). Format: comma-separated URLs.
// Contoh .env: ALLOWED_ORIGINS=http://localhost:3000,https://ngrok-url.app
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];
const localOrigins = Object.values(os.networkInterfaces())
  .flat()
  .filter(iface => iface && iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.'))
  .map(iface => `http://${iface.address}:${PORT}`);
const ALLOWED_ORIGINS = [...new Set([
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  ...configuredOrigins,
  ...localOrigins
])];
const corsOptions = {
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  credentials: true
};

// Socket.IO berbagi HTTP server dan origin allowlist yang sama dengan API.
// Client belum menerima room admin/device sampai listener join memverifikasi tokennya.
const io = socketIo(server, {
  // Buat Socket.IO instance dari HTTP server
  cors: {
    origin: ALLOWED_ORIGINS,
    // Origin dari .env (ALLOWED_ORIGINS)
    methods: ['GET', 'POST'],
    // Allow method HTTP yang dibutuhkan
    credentials: true,
    // Allow credentials (cookies, auth headers)
  },
});

const MAX_SOCKET_AUTH_TIMEOUT_MS = 2147483647;

const disconnectAuthorizedSockets = (predicate, errorEvent) => {
  for (const socket of io.sockets.sockets.values()) {
    if (!predicate(socket.data.authorization)) continue;
    if (errorEvent) socket.emit(errorEvent);
    socket.disconnect(true);
  }
};

// Route logout atau blokir akun memakai helper ini untuk memutus socket device yang masih memakai session lama.
const realtimeSessions = {
  disconnectByToken(token) {
    disconnectAuthorizedSockets(
      authorization => authorization?.type === 'device' && authorization.token === token,
      'device-auth-error'
    );
  },
  disconnectByUserId(userId) {
    disconnectAuthorizedSockets(
      authorization => authorization?.type === 'device' && authorization.userId === userId,
      'device-auth-error'
    );
  }
};

// Putuskan socket ketika batas terawal antara expiry JWT dan session database tercapai.
// Timer panjang dipecah sesuai batas setTimeout Node lalu diperiksa kembali sampai benar-benar kedaluwarsa.
const scheduleAuthorizationExpiry = (socket, expiresAt, errorEvent) => {
  clearTimeout(socket.data.authorizationTimer);
  const checkExpiry = () => {
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      socket.emit(errorEvent);
      socket.disconnect(true);
      return;
    }
    socket.data.authorizationTimer = setTimeout(
      checkExpiry,
      Math.min(remainingMs, MAX_SOCKET_AUTH_TIMEOUT_MS)
    );
  };
  checkExpiry();
};

// Jangan percaya X-Forwarded-For pada koneksi LAN langsung karena header itu dapat dipalsukan.
// Set TRUST_PROXY=1 hanya saat aplikasi benar-benar berada di belakang satu reverse proxy tepercaya.
if (process.env.TRUST_PROXY) {
  const trustProxy = /^\d+$/.test(process.env.TRUST_PROXY)
    ? Number(process.env.TRUST_PROXY)
    : process.env.TRUST_PROXY === 'true';
  app.set('trust proxy', trustProxy);
}

// ------------------------- 🧱 MIDDLEWARES -------------------------
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
app.use(express.json({ limit: '1mb' }));

// 9.4: URL-encoded parser
// Parse request body yang berformat application/x-www-form-urlencoded (untuk form submit)
app.use(express.urlencoded({ extended: true }));

// 9.5: Custom request logger
// Log request dengan format custom (dari middleware/logger.js)
app.use(requestLogger);

// 9.6: CORS setup (Cross-Origin Resource Sharing)
// Mengizinkan mobile app dan admin dashboard untuk akses API dari domain berbeda
// Origin dikonfigurasi via ALLOWED_ORIGINS di .env (comma-separated)
app.use(cors(corsOptions));

// 9.7: CORS preflight untuk semua routes
// Handle OPTIONS request yang dikirim browser sebelum request sesungguhnya
app.options('*', cors(corsOptions));

// 9.8: Rate limiting
// Batasi jumlah request per IP untuk mencegah spam dan DDoS attack
app.use(
  '/api',
  // Apply rate limit hanya untuk path /api/*
  rateLimit({
    windowMs: WINDOW_MS,
    // Window waktu (15 menit)
    max: MAX_REQS,
    // Batas mengikuti RATE_LIMIT_MAX_REQUESTS; 500 cukup untuk auto-refresh dashboard dan tetap membatasi spam.
    standardHeaders: true,
    // Return rate limit info di headers (RateLimit-*)
    legacyHeaders: false,
    // Matikan X-RateLimit-* headers (deprecated)
    message: { error: 'Too many requests, please try again later.' },
    // Error message jika limit tercapai
  })
);

// 9.9: Attach Socket.IO & Prisma ke request object
// Agar semua route handler bisa akses io dan prisma via req.io dan req.prisma
app.use((req, res, next) => {
  req.io = io;
  // Socket.IO instance untuk emit real-time events
  req.realtimeSessions = realtimeSessions;
  req.prisma = prisma;
  // Prisma client untuk query database
  next();
  // Lanjut ke middleware/route handler berikutnya
});

// ------------------------- 🩺 HEALTH CHECK -------------------------
// STEP 10: Health check endpoint
// Endpoint untuk cek apakah server dan database berjalan dengan baik
// Diakses oleh: mobile app (untuk detect server), monitoring tools, admin dashboard
app.get(['/health', '/api/health'], async (req, res) => {
  try {
    // STEP 10.1: Test koneksi database dengan query sederhana
    await prisma.$queryRaw`SELECT 1`;
    // Query "SELECT 1" untuk test apakah DB respond

    // STEP 10.2: Health check hanya membaca status layanan.
    res.json({
      status: 'OK',
      // Status server
      timestamp: new Date().toISOString(),
      // Waktu sekarang (ISO format)
      version: '2.0.0',
      // Versi backend API
      database: 'connected',
      // Status database
    });
  } catch (error) {
    // STEP 10.4: Jika ada error (biasanya database error), kirim response error
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      // Status server error
      timestamp: new Date().toISOString(),
      // Waktu error terjadi
      database: 'disconnected'
      // Database tidak tersambung
    });
  }
});

// ------------------------- 📋 API ROOT ENDPOINT -------------------------
// STEP 11: API root endpoint - Dokumentasi API yang tersedia
// GET /api -> Return list semua endpoint yang tersedia (API directory)
app.get('/api', (req, res) => {
  res.json({
    status: 'OK',
    // Status API
    server: 'NFC Payment Backend API',
    // Nama server
    version: '2.0.0',
    // Versi API
    timestamp: new Date().toISOString(),
    // Waktu sekarang
    endpoints: {
      // Daftar endpoint yang tersedia (untuk dokumentasi)
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
        updateBalance: 'PUT /api/users/:id/balance'
      },
      debug: {
        users: 'GET /api/debug/users',
        ping: 'GET /api/ping'
      }
    }
  });
});

// ------------------------- 👤 AUTHENTICATED USER ENDPOINTS -------------------------
// STEP 12: Get current user info (untuk sync balance dari mobile app)
// Endpoint memvalidasi JWT dan mengambil identitas dari req.user, bukan input client.
// GET /api/users/me -> Return user info berdasarkan userId
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    // STEP 12.1: Identitas user selalu berasal dari JWT yang sudah diverifikasi.
    const userId = req.user.id;
    
    // STEP 12.2: Validasi userId wajib ada
    if (!userId) {
      console.log('❌ No user ID provided in request');
      return res.status(400).json({ error: 'User ID required in x-user-id header or userId query' });
    }
    
    // STEP 12.3: Convert userId ke integer dan validasi format
    const userIdInt = parseInt(userId);
    // parseInt() konversi string userId ke integer; NaN jika format bukan angka valid
    if (isNaN(userIdInt)) {
      // Jika bukan angka valid
      console.log(`❌ Invalid user ID format: ${userId}`);
      return res.status(400).json({ error: 'User ID must be a valid number' });
    }
    
    console.log(`👤 Looking for user ID: ${userIdInt}...`);
    // Log request
    
    // STEP 12.4: Query user dari database berdasarkan ID
    const user = await prisma.user.findUnique({
    // findUnique mencari tepat satu record; mengembalikan null jika tidak ditemukan
      where: { id: userIdInt },
      // WHERE id = userIdInt
      select: {
        // SELECT hanya field yang diperlukan (jangan return password!)
        id: true,
        // User ID
        name: true,
        // Nama lengkap
        username: true,
        // Username untuk login
        balance: true,
        // Saldo user (PENTING untuk sync)
        isActive: true,
        // Status aktif/blokir
        updatedAt: true,
        // Waktu terakhir diupdate
        createdAt: true
        // Waktu user dibuat
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
    console.error('❌ Get user error:', error);
    // Log error ke console
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// STEP 13: List all users untuk administrasi
// Endpoint memerlukan bearer JWT admin melalui authenticateAdmin.
// GET /api/users/all -> Return array semua user
app.get('/api/users/all', authenticateAdmin, async (req, res) => {
  try {
    // STEP 13.1: Query semua user dari database
    const users = await prisma.user.findMany({
    // findMany mengembalikan array semua record yang cocok; array kosong [] jika tidak ada data
      select: {
        // SELECT hanya field yang diperlukan
        id: true,
        // User ID
        name: true,
        // Nama lengkap
        username: true,
        // Username
        balance: true,
        // Saldo
        isActive: true,
        // Status aktif/blokir
        createdAt: true
        // Waktu dibuat
      },
      orderBy: {
        // ORDER BY id ASC (urut dari ID terkecil)
        id: 'asc'
      }
    });
    
    // STEP 13.2: Log hasil ke console untuk debug
    console.log(`📊 All users in database: ${users.length} users`);
    users.forEach(user => {
      // Loop setiap user dan log detailnya
      console.log(`  - ID: ${user.id}, Username: ${user.username}, Balance: ${user.balance}`);
    });
    
    // STEP 13.3: Return response dengan array users
    res.json({ success: true, users: users, count: users.length });
    
  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({ error: 'Failed to get all users' });
  }
});

// STEP 15: Get user by ID (PUBLIC - NO AUTH) - untuk Mobile App sync balance
// Endpoint untuk mobile app ambil data user berdasarkan ID tanpa JWT token
// GET /api/users/:id/public -> Return user data
app.get('/api/users/:id/public', authenticateUserOrAdmin, async (req, res) => {
  try {
    // STEP 15.1: Ambil userId dari URL parameter
    const userId = parseInt(req.params.id);
    // Parse string ke integer
    
    // STEP 15.2: Validasi userId
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    if (!req.admin && req.user.id !== userId) {
      return res.status(403).json({ error: 'USER_ACCESS_DENIED' });
    }

    // STEP 15.3: Query user dari database
    const user = await prisma.user.findUnique({
    // findUnique mencari tepat satu user berdasarkan ID; null jika tidak ditemukan
      where: { id: userId },
      // WHERE id = userId
      select: {
        // SELECT field yang diperlukan (tanpa password!)
        id: true,
        // User ID
        name: true,
        // Nama lengkap
        username: true,
        // Username
        balance: true,
        // Saldo (PENTING untuk sync)
        isActive: true,
        // Status aktif/blokir
        deviceId: true,
        // Device ID untuk tracking
        createdAt: true,
        // Waktu dibuat
        updatedAt: true
        // Waktu terakhir diupdate
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

// ------------------------- 🧭 ROUTES -------------------------
// STEP 16: Setup routes & static files
// Mount semua route modules ke Express app

// Arahkan halaman root ke dashboard admin
app.get('/', (req, res) => res.redirect('/admin/'));

// Dashboard lama memakai script, style, dan event handler inline. Batasi pengecualian CSP ini ke halaman admin saja.
app.use('/admin', (req, res, next) => {
  // COOP dan OAC membutuhkan origin yang konsisten; keduanya menimbulkan warning saat dashboard dibuka lewat IP LAN HTTP.
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Origin-Agent-Cluster');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  next();
});

// STEP 16.1: Serve admin dashboard static files
// Folder admin berisi HTML, CSS, JS untuk dashboard
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// STEP 16.2: Route untuk admin dashboard homepage
// GET /admin -> Serve dashboard.html
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, '../admin/dashboard.html'))
);

// STEP 16.3: Mount route modules ke Express app.
// Login dan register public diberi rate limit; route lain menerapkan auth pada mount atau handler.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'TOO_MANY_LOGIN_ATTEMPTS' }
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REGISTRATION_ATTEMPTS' }
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registrationLimiter);
app.use('/api/auth', authRoutes);
// Auth endpoints: /api/auth/login, /api/auth/register
app.use('/api/devices', deviceRoutes);
// Device endpoints: /api/devices/sync, /api/devices/list
app.use('/api/nfc-cards', nfcCardRoutes);
// NFC Card management: /api/nfc-cards/register, /api/nfc-cards/link, dll

const adminSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ADMIN_LOGIN_ATTEMPTS' }
});

app.post('/api/admin/session', adminSessionLimiter, (req, res) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!configuredPassword || !secret) {
    return res.status(503).json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' });
  }
  const suppliedPasswordHash = crypto.createHash('sha256').update(String(req.body.password || '')).digest();
  const configuredPasswordHash = crypto.createHash('sha256').update(configuredPassword).digest();
  if (!crypto.timingSafeEqual(suppliedPasswordHash, configuredPasswordHash)) {
    return res.status(401).json({ error: 'INVALID_ADMIN_CREDENTIALS' });
  }
  const token = jwt.sign({ role: 'admin' }, secret, { algorithm: 'HS256', expiresIn: '30m' });
  return res.json({ token, expiresIn: 1800 });
});

// Protected endpoints (require auth)
app.use('/api/users', authenticateUserOrAdmin, userRoutes);
// User endpoints (perlu JWT): /api/users/:id, /api/users/me
app.use('/api/transactions', authenticateUserOrAdmin, transactionRoutes);
// Transaction endpoints (perlu JWT): /api/transactions/send, /api/transactions/history
app.use('/api/fraud', authenticateUserOrAdmin, fraudRoutes);
// Fraud endpoints (perlu JWT): /api/fraud/alert, /api/fraud/check
app.use('/api/admin', authenticateAdmin, adminRoutes);
// Admin endpoints memerlukan bearer JWT admin: /api/admin/dashboard, /api/admin/bulk-topup

// STEP 17: Ping endpoint - Simple health check untuk mobile app
// Endpoint paling sederhana untuk cek apakah server online
// GET /api/ping -> Return status OK
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    // Status server (ok = online)
    timestamp: new Date().toISOString(),
    // Waktu sekarang (ISO 8601 format)
    server: 'NFC Payment Backend Server',
    // Nama server
    version: '2.0.0',
    // Versi API
    uptime: process.uptime(),
    // Uptime server dalam detik (berapa lama server sudah running)
  });
});

// STEP 18: DEBUG ENDPOINT - Direct access to users (bypass auth)
// Endpoint khusus untuk debugging - return semua user tanpa autentikasi
// Count unique users only (hindari duplikasi)
// GET /api/debug/users -> Return array semua user
app.get('/api/debug/users', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔧 DEBUG: Direct user access (count unique users only)');
    
    // STEP 18.1: Hitung total user unik (tanpa duplikasi device)
    const totalUniqueUsers = await prisma.user.count();
    // COUNT(*) dari tabel user
    
    // STEP 18.2: Query semua user dengan field yang diperlukan
    const users = await prisma.user.findMany({
    // findMany mengembalikan semua user dalam DB sebagai array untuk endpoint debug
      select: {
        // SELECT field berikut:
        id: true,
        // User ID
        name: true,
        // Nama lengkap
        username: true,
        // Username
        balance: true,
        // Saldo
        isActive: true,
        // Status aktif/blokir
        createdAt: true,
        // Waktu dibuat
        updatedAt: true,
        // Waktu terakhir diupdate
        deviceId: true
        // Device ID (untuk tracking)
      },
      orderBy: {
        // ORDER BY createdAt DESC (user terbaru di atas)
        createdAt: 'desc'
      }
    });

    // STEP 18.3: Log info ke console
    console.log(`🔧 DEBUG: Found ${totalUniqueUsers} unique users`);

    // STEP 18.4: Return response dengan data users
    res.json({
      success: true,
      // Status success
      users: users,
      // Array semua user
      totalUniqueUsers: totalUniqueUsers,
      // Total user unik
      total: users.length,
      // Total user dalam response
      debug: true
      // Flag bahwa ini debug endpoint
    });

  } catch (error) {
    console.error('❌ DEBUG users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});


// ------------------------- ⚡ SOCKET.IO -------------------------
// STEP 21: Setup Socket.IO untuk real-time updates
// Socket.IO memungkinkan push notification ke admin dashboard dan mobile app

// STEP 21.1: Event 'connection' - Terjadi saat client connect ke server
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  // Log socket ID client yang connect

  // STEP 21.2: Event 'join-admin' - Admin dashboard join room untuk terima updates
  // Verifikasi JWT admin sebelum join agar event administratif hanya terkirim ke sesi admin sah.
  socket.on('join-admin', () => {
    try {
      const token = socket.handshake.auth?.token;
      const decoded = verifyAdminToken(token);
      if (!Number.isFinite(decoded.exp)) throw new Error('Admin token expiry is required');
      socket.data.authorization = { type: 'admin', token };
      scheduleAuthorizationExpiry(socket, decoded.exp * 1000, 'admin-auth-error');
      socket.join('admin-room');
      socket.emit('admin-authenticated');
    } catch (_) {
      socket.emit('admin-auth-error');
      socket.disconnect(true);
      return;
    }
    // Masukkan socket ini ke room 'admin-room'
    console.log('👤 Admin joined room');
    // Log admin join
  });

  // STEP 21.3: Event 'join-device' - Mobile device join room untuk terima balance updates
  // Cocokkan JWT, session aktif, status akun, dan deviceId sebelum memberi akses ke room perangkat.
  socket.on('join-device', async (deviceId) => {
    try {
      const token = socket.handshake.auth?.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const session = await prisma.userSession.findFirst({
        where: {
          userId: decoded.userId,
          token,
          isActive: true,
          expiresAt: { gt: new Date() },
          user: { isActive: true, deviceId }
        }
      });
      if (!session) throw new Error('Invalid device session');
      const jwtExpiresAt = decoded.exp * 1000;
      const expiresAt = Math.min(jwtExpiresAt, session.expiresAt.getTime());
      if (!Number.isFinite(expiresAt)) throw new Error('Device token expiry is required');
      socket.data.authorization = {
        type: 'device',
        token,
        userId: decoded.userId,
        deviceId
      };
      scheduleAuthorizationExpiry(socket, expiresAt, 'device-auth-error');
      socket.join(`device-${deviceId}`);
      socket.emit('device-authenticated', { deviceId });
      console.log(`📱 Device ${deviceId} joined room`);
    } catch (_) {
      socket.emit('device-auth-error');
      socket.disconnect(true);
    }
  });

  // STEP 21.4: Event 'disconnect' - Terjadi saat client disconnect
  socket.on('disconnect', () => {
    clearTimeout(socket.data.authorizationTimer);
    console.log('🔌 Client disconnected:', socket.id);
    // Log socket ID yang disconnect
  });
});

// ------------------------- ⚙️ ERROR HANDLING -------------------------
// STEP 22: Apply error handler middleware
// Middleware ini akan catch semua error yang tidak tertangkap di endpoint
app.use(errorHandler);

// ------------------------- 🌐 NETWORK INFO -------------------------
// STEP 23: Helper function untuk get LAN IP addresses
// Fungsi ini digunakan untuk menampilkan IP laptop ke console saat server start
// Berguna untuk tahu IP mana yang harus diakses dari Android
function getLanIPs() {
  // fungsi helper untuk mendapatkan semua IP LAN; digunakan saat server start untuk tampilkan URL akses dari Android
  const ifaces = os.networkInterfaces();
  // Ambil semua network interfaces
  const list = [];
  // Array untuk menyimpan IP addresses
  
  // Loop semua interfaces (WiFi, Ethernet, dll)
  const names = Object.keys(ifaces);
  // Object.keys() mengembalikan array nama semua network interface (WiFi, Ethernet, Loopback, dll)
  for (let i = 0; i < names.length; i++) {
    const addrs = ifaces[names[i]];
    // ambil array objek alamat IP untuk interface ke-i
    for (let j = 0; j < addrs.length; j++) {
      const iface = addrs[j];
      // Filter hanya IPv4 dan bukan internal (localhost)
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        list.push(iface.address);
        // Tambahkan IP ke list
      }
    }
  }
  return list;
  // Return array IP addresses
}

// ------------------------- 🚀 SERVER START -------------------------
// STEP 24: Start server dengan async IIFE (Immediately Invoked Function Expression)
// Fungsi async diperlukan karena kita pakai await untuk Prisma connection
(async () => {
  try {
    // STEP 24.1: Connect ke database via Prisma
    await prisma.$connect();
    // Tunggu sampai koneksi database berhasil
    console.log('🗄️ Prisma connected successfully.');
    // Log sukses connect

    // STEP 24.2: Start HTTP server pada PORT dan HOST yang ditentukan
    server.listen(PORT, HOST, () => {
      // STEP 24.3: Ambil semua LAN IP addresses

      // STEP 24.4: Display server info ke console
      console.log('\n🚀 NFC Payment Backend Server started!');
      console.log(`📊 Server bind : http://${HOST}:${PORT}`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      console.log(`🖥️  Admin Dash : http://localhost:${PORT}/admin`);
      console.log(`📡 Socket.IO   : Enabled`);
      
      // STEP 24.5: Display LAN IPs (untuk access dari Android di WiFi yang sama)
      const ips = getLanIPs();
      // Call helper function untuk get IP
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
    process.exit(1);
    // Exit process dengan code 1 (error)
  }
})();

// ------------------------- 🧹 GRACEFUL SHUTDOWN -------------------------
// STEP 25: Setup graceful shutdown handlers
// Fungsi ini memastikan server shutdown dengan benar (disconnect database, dll)
// Terjadi saat process menerima signal SIGINT (Ctrl+C) atau SIGTERM (kill)
const gracefulExit = async function(signal) {
  // STEP 25.1: Log signal yang diterima
  console.log(`\n🛑 ${signal} received... Shutting down gracefully.`);
  
  try {
    // STEP 25.2: Disconnect Prisma dari database
    await prisma.$disconnect();
    // Close semua connection ke database
  } catch {}
  // Ignore error saat disconnect
  
  // STEP 25.3: Close HTTP server
  server.close(() => {
    console.log('✅ Server shut down successfully');
    // Log sukses shutdown
    process.exit(0);
    // Exit process dengan code 0 (sukses)
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
  console.error('⚠️  Unhandled Rejection:', reason);
  // Log error untuk debugging
  // Tidak exit process, hanya log saja (agar server tetap jalan)
});

// STEP 28: Export app, io, dan prisma untuk testing atau import di file lain
module.exports = { app, io, prisma };
