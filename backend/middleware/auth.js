// ============================================================
// AUTH.JS - MIDDLEWARE AUTENTIKASI & OTORISASI
// ============================================================
// File ini berisi middleware untuk:
// - Autentikasi JWT token (authenticateToken)
// - Otorisasi admin (authenticateAdmin)
// - Autentikasi device (authenticateDevice)
//
// Middleware ini digunakan untuk proteksi endpoint API agar hanya
// user yang terautentikasi atau admin yang bisa akses

const jwt = require('jsonwebtoken'); // Library untuk verify JWT token
const { PrismaClient } = require('@prisma/client'); // Prisma ORM untuk query database

const prisma = new PrismaClient(); // Instance Prisma client untuk akses database

// ==============================================================
// FUNGSI 1: authenticateToken - Middleware untuk cek JWT token
// ==============================================================
// Fungsi ini dipanggil sebelum endpoint yang perlu autentikasi
// Cara kerja:
// 1. Ambil JWT token dari header Authorization
// 2. Verify token menggunakan JWT_SECRET
// 3. Cek apakah user dan session masih valid di database
// 4. Jika valid, lanjut ke endpoint (next())
// 5. Jika tidak valid, return error 401/403
//
// Usage: app.get('/api/protected', authenticateToken, handler)
const authenticateToken = async (req, res, next) => {
  try {
    // STEP 1: Ambil Authorization header dari request
    // Format: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Split "Bearer TOKEN" -> ambil TOKEN
    
    // STEP 2: Cek apakah ada app secret key (untuk backward compatibility dengan mobile app lama)
    // Mobile app kirim x-app-key header sebagai pengganti JWT token
    const appKey = req.headers['x-app-key']; // Ambil x-app-key dari header
    const appSecret = process.env.APP_SECRET || 'NFC2025SecureApp'; // App secret dari .env atau default
    if (appKey === appSecret) { // Jika app key cocok
      // Mobile app access - skip JWT for now (legacy compatibility)
      return next(); // Langsung lanjut ke endpoint (bypass JWT check)
    }

    console.log('🔐 Auth middleware: Checking token...'); // Log untuk debug
    console.log('Token:', token ? 'Present' : 'Missing'); // Cek ada token atau tidak

    // STEP 3: Validasi token wajib ada (jika tidak pakai app key)
    if (!token) {
      console.log('❌ No token provided'); // Log untuk debug
      return res.status(401).json({ error: 'Access token required' }); // 401 Unauthorized
    }

    // STEP 4: Verify JWT token
    // jwt.verify() akan throw error jika token invalid atau expired
    const jwtSecret = process.env.JWT_SECRET || 'nfc-payment-jwt-secret-2025-ultra-secure-key'; // JWT secret dari .env
    
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret); // Decode dan verify token
      console.log('✅ Token verified for user:', decoded.userId); // Log sukses
    } catch (jwtError) {
      // Handle JWT-specific errors dengan pesan yang lebih jelas
      console.error('❌ JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          message: 'Your session has expired. Please login again.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(403).json({ 
          error: 'Invalid token',
          message: 'Authentication token is invalid. Please login again.' 
        });
      } else {
        return res.status(403).json({ 
          error: 'Token verification failed',
          message: 'Unable to verify authentication token.' 
        });
      }
    }
    
    // decoded = { userId: 123, username: 'john', iat: 1234567890, exp: 1234571490 }
    
    // STEP 5: Cek apakah user masih ada di database dan session masih valid
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }, // WHERE id = decoded.userId (dari JWT payload)
      include: { // JOIN dengan tabel userSessions
        userSessions: {
          where: { // Filter session yang:
            token: token, // - Tokennya sama dengan token yang dikirim
            isActive: true, // - Masih aktif (belum logout)
            expiresAt: { // - Belum expired
              gt: new Date() // Greater than now (expiresAt > Date.now())
            }
          }
        }
      }
    });

    // STEP 6: Validasi user dan session
    if (!user) {
      console.log('❌ User not found for ID:', decoded.userId); // Log untuk debug
      return res.status(401).json({ 
        error: 'User not found',
        message: 'User account no longer exists.' 
      });
    }
    
    if (user.userSessions.length === 0) {
      console.log('❌ No valid session found for user:', decoded.userId); // Log untuk debug
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Your session has expired or been logged out. Please login again.' 
      });
    }

    // STEP 7: Token valid! Attach user data ke request object
    console.log('✅ Authentication successful for user:', user.username); // Log sukses
    req.user = user; // Agar endpoint bisa akses user via req.user
    req.token = token; // Agar endpoint bisa akses token via req.token
    next(); // Lanjut ke endpoint handler
    
  } catch (error) {
    // STEP 8: Handle error (unexpected errors)
    console.error('❌ Auth middleware error:', error); // Log error untuk debug
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication.' 
    });
  }
};

// ===============================================================
// FUNGSI 2: authenticateAdmin - Middleware untuk cek admin password
// ===============================================================
// Fungsi ini dipanggil sebelum endpoint admin (bulk top-up, block user, dll)
// Cara kerja:
// 1. Cek x-app-key header (harus match dengan APP_SECRET)
// 2. Cek x-admin-password header atau req.body.adminPassword
// 3. Jika kedua valid, lanjut ke endpoint (next())
// 4. Jika tidak valid, return error 401
//
// Usage: app.post('/api/admin/action', authenticateAdmin, handler)
const authenticateAdmin = (req, res, next) => {
  // STEP 1: Ambil admin password dari header atau request body
  // Admin bisa kirim password via:
  // - Header: x-admin-password: admin123
  // - Body: { "adminPassword": "admin123" }
  const adminPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  
  // STEP 2: Ambil app key dari header
  const appKey = req.headers['x-app-key']; // x-app-key: NFC2025SecureApp
  
  // STEP 3: Ambil app secret dan admin password dari environment variables
  const appSecret = process.env.APP_SECRET || 'NFC2025SecureApp'; // Default jika tidak ada di .env
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123'; // Default admin password
  
  // STEP 4: Validasi app key (first layer authentication)
  if (appKey !== appSecret) {
    return res.status(401).json({ error: 'Invalid app key' }); // 401 Unauthorized
  }
  
  // STEP 5: Validasi admin password (second layer authentication)
  if (adminPassword !== adminPass) {
    return res.status(401).json({ error: 'Invalid admin password' }); // 401 Unauthorized
  }
  
  // STEP 6: Autentikasi berhasil! Lanjut ke endpoint
  next();
};

// ===============================================================
// FUNGSI 3: authenticateDevice - Middleware untuk cek device sync
// ===============================================================
// Fungsi ini dipanggil sebelum endpoint device sync (/api/devices/sync)
// Cara kerja:
// 1. Cek x-app-key header (harus match dengan APP_SECRET)
// 2. Cek user-agent header (harus mengandung "okhttp" = Android app)
// 3. Jika kedua valid, lanjut ke endpoint (next())
// 4. Jika tidak valid, return error 401
//
// Usage: app.post('/api/devices/sync', authenticateDevice, handler)
const authenticateDevice = (req, res, next) => {
  // STEP 1: Ambil app key dari header
  const appKey = req.headers['x-app-key']; // x-app-key: NFC2025SecureApp
  
  // STEP 2: Ambil user agent dari header (untuk detect Android app)
  const userAgent = req.headers['user-agent']; // user-agent: okhttp/4.9.0
  
  // STEP 3: Ambil app secret dari environment variables
  const appSecret = process.env.APP_SECRET || 'NFC2025SecureApp';
  
  // STEP 4: Validasi app key
  if (appKey !== appSecret) {
    return res.status(401).json({ error: 'Invalid app key' }); // 401 Unauthorized
  }
  
  // STEP 5: Validasi user agent (harus dari Android app)
  // Android app pakai okhttp library untuk HTTP request
  if (!userAgent || !userAgent.includes('okhttp')) {
    return res.status(401).json({ error: 'Invalid user agent' }); // 401 Unauthorized (bukan dari Android app)
  }
  
  // STEP 6: Autentikasi berhasil! Lanjut ke endpoint
  next();
};

// STEP 7: Export semua fungsi middleware agar bisa diimport di file lain
module.exports = {
  authenticateToken, // Untuk proteksi endpoint yang perlu JWT token
  authenticateAdmin, // Untuk proteksi endpoint admin
  authenticateDevice // Untuk proteksi endpoint device sync
};