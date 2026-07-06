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

const jwt = require('jsonwebtoken');
// const membuat variabel tetap; require digunakan Node.js untuk memanggil module; jsonwebtoken adalah library untuk membuat dan memvalidasi JWT (JSON Web Token) — token yang digunakan untuk autentikasi stateless tanpa perlu cek database di setiap request.
const { PrismaClient } = require('@prisma/client');
// const membuat variabel tetap; { PrismaClient } menggunakan destructuring untuk mengambil class PrismaClient; require memanggil module @prisma/client yang merupakan ORM untuk database SQLite.

const prisma = new PrismaClient();
// const membuat variabel tetap; new PrismaClient() membuat instance Prisma baru yang terhubung ke database SQLite; instance ini digunakan untuk semua operasi database di file ini.

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
  // const membuat variabel tetap; async membuat function bisa menggunakan await; (req, res, next) adalah tiga parameter standar middleware Express: req=request dari client, res=response ke client, next=fungsi untuk lanjut ke middleware/handler berikutnya
  try {
    // try menjalankan kode yang berpotensi error: jwt.verify, database query
    // STEP 1: Ambil Authorization header dari request
    // Format: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers['authorization'];
    // const membuat variabel tetap; req.headers['authorization'] membaca header Authorization dari HTTP request yang dikirim mobile app
    const token = authHeader && authHeader.split(' ')[1];
    // const membuat variabel tetap; authHeader && ... adalah short-circuit evaluation: hanya evaluasi kanan jika kiri truthy; .split(' ') memecah "Bearer TOKEN" menjadi array, [1] mengambil TOKEN-nya
    
    // STEP 2: Cek apakah ada app secret key (untuk backward compatibility dengan mobile app lama)
    // Mobile app kirim x-app-key header sebagai pengganti JWT token
    const appKey = req.headers['x-app-key'];
    // const membuat variabel tetap; req.headers['x-app-key'] membaca custom header x-app-key yang dikirim mobile app
    const appSecret = process.env.APP_SECRET || 'NFC2025SecureApp';
    // const membuat variabel tetap; process.env.APP_SECRET membaca dari .env; || fallback ke nilai default jika tidak ada
    if (appKey === appSecret) {
      // if mengecek apakah app key cocok dengan secret yang ditentukan; === adalah perbandingan ketat (strict equality) — harus sama tipe dan nilai
      // Mobile app access - skip JWT for now (legacy compatibility)
      return next();
      // return menghentikan eksekusi middleware ini; next() memanggil middleware atau route handler berikutnya — request dilanjutkan tanpa cek JWT
    }

    console.log('🔐 Auth middleware: Checking token...');
    // Log untuk debug
    console.log('Token:', token ? 'Present' : 'Missing');
    // Cek ada token atau tidak

    // STEP 3: Validasi token wajib ada (jika tidak pakai app key)
    if (!token) {
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      console.log('❌ No token provided');
      // Log untuk debug
      return res.status(401).json({ error: 'Access token required' });
      // return menghentikan; res.status(401) mengatur HTTP status 401 Unauthorized; .json() mengirim pesan error dalam format JSON
    }

    // STEP 4: Verify JWT token
    // jwt.verify() akan throw error jika token invalid atau expired
    const jwtSecret = process.env.JWT_SECRET || 'nfc-payment-jwt-secret-2025-ultra-secure-key';
    // const membuat variabel tetap; process.env.JWT_SECRET membaca secret dari .env yang HARUS sama dengan secret yang dipakai saat jwt.sign di auth.js
    
    let decoded;
    // let membuat variabel yang nilainya bisa berubah; awalnya undefined, akan diisi hasil verify
    try {
      // try dalam try — untuk menangkap error JWT secara spesifik
      decoded = jwt.verify(token, jwtSecret);
      // jwt.verify memvalidasi token: cek signature menggunakan jwtSecret dan cek apakah token sudah expired; jika valid mengembalikan payload token (userId, username, iat, exp)
      console.log('✅ Token verified for user:', decoded.userId);
      // decoded.userId adalah field yang dimasukkan saat jwt.sign di auth.js
    } catch (jwtError) {
      // catch menangkap error spesifik dari jwt.verify
      // Handle JWT-specific errors dengan pesan yang lebih jelas
      console.error('❌ JWT verification failed:', jwtError.message);
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      
      if (jwtError.name === 'TokenExpiredError') {
        // if mengecek tipe error; .name adalah property dari Error object; TokenExpiredError terjadi ketika token melewati waktu exp
        return res.status(401).json({
          // return menghentikan eksekusi dan mengirim 401 Unauthorized karena token sudah kadaluarsa
          error: 'Token expired',
          // field error: kode error singkat yang bisa dibaca oleh frontend untuk menampilkan pesan sesuai
          message: 'Your session has expired. Please login again.'
          // field message: pesan human-readable yang ditampilkan ke user
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        // else if kondisi lanjutan; JsonWebTokenError terjadi ketika format token salah atau signature tidak cocok
        return res.status(403).json({
          // 403 Forbidden — beda dari 401, ini berarti terautentikasi tapi tidak diizinkan
          error: 'Invalid token',
          // field error: memberitahu frontend bahwa token tidak valid (bukan kadaluarsa)
          message: 'Authentication token is invalid. Please login again.'
          // pesan untuk user agar login ulang karena token tidak valid
        });
      } else {
        // else dijalankan jika semua kondisi sebelumnya tidak terpenuhi
        return res.status(403).json({
          // return + 403: error JWT lain yang tidak dikenali; tetap ditolak demi keamanan
          error: 'Token verification failed',
          // field error: verifikasi token gagal karena alasan lain yang tidak spesifik
          message: 'Unable to verify authentication token.'
          // pesan untuk user bahwa token tidak bisa diverifikasi
        });
      }
    }
    
    // decoded = { userId: 123, username: 'john', iat: 1234567890, exp: 1234571490 }
    
    // STEP 5: Cek apakah user masih ada di database dan session masih valid
    const user = await prisma.user.findUnique({
      // const membuat variabel tetap; await menunggu database; prisma.user.findUnique mencari satu user berdasarkan field unik
      where: { id: decoded.userId },
      // WHERE id = decoded.userId — menggunakan ID dari payload token yang sudah terverifikasi
      include: {
        // include melakukan JOIN dengan tabel lain; setara LEFT JOIN di SQL
        userSessions: {
          // include relasi userSessions dari tabel UserSession
          where: {
            // kondisi untuk filter session yang valid
            token: token,
            // session harus punya token yang sama dengan yang dikirim client
            isActive: true,
            // session harus masih aktif (belum logout)
            expiresAt: {
              // kondisi pada field expiresAt
              gt: new Date()
              // gt = greater than; new Date() adalah waktu sekarang; artinya expiresAt > sekarang (belum kadaluarsa)
            }
          }
        }
      }
    });

    // STEP 6: Validasi user dan session
    if (!user) {
      // if mengecek apakah user null — user tidak ditemukan di database (mungkin sudah dihapus)
      console.log('❌ User not found for ID:', decoded.userId);
      // Log untuk debug
      return res.status(401).json({
        // return menghentikan eksekusi dan mengirim 401 Unauthorized karena user tidak ditemukan
        error: 'User not found',
        // field error: memberitahu frontend user tidak ada di database
        message: 'User account no longer exists.'
        // pesan deskriptif; user mungkin sudah dihapus admin
      });
    }
    
    if (user.userSessions.length === 0) {
      // if mengecek apakah array userSessions kosong; .length mengambil panjang array; === 0 berarti tidak ada session valid yang ditemukan
      console.log('❌ No valid session found for user:', decoded.userId);
      // Log untuk debug
      return res.status(401).json({
        // 401 Unauthorized — session tidak valid
        error: 'Session expired',
        // field error: memberitahu frontend session sudah tidak aktif
        message: 'Your session has expired or been logged out. Please login again.'
        // pesan untuk user agar login ulang
      });
    }

    // STEP 7: Token valid! Attach user data ke request object
    console.log('✅ Authentication successful for user:', user.username);
    // Log sukses
    req.user = user;
    // req.user = user menyimpan data user ke objek request agar bisa diakses oleh route handler via req.user.id, req.user.username, dll
    req.token = token;
    // req.token menyimpan token ke objek request agar route handler bisa akses token jika diperlukan
    next();
    // next() memanggil middleware atau route handler berikutnya — request dilanjutkan karena sudah terautentikasi
    
  } catch (error) {
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // STEP 8: Handle error (unexpected errors)
    console.error('❌ Auth middleware error:', error);
    // Log error untuk debug
    return res.status(500).json({
      // return + 500 Internal Server Error: error tidak terduga saat proses autentikasi
      error: 'Authentication error',
      // field error: kode error generik untuk error autentikasi yang tidak dikenali
      message: 'An error occurred during authentication.'
      // pesan untuk user; tidak mengekspos detail error internal demi keamanan
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
  // middleware authenticateAdmin: memverifikasi request berasal dari admin yang sah via app-key dan password
  // STEP 1: Ambil admin password dari header atau request body
  // Admin bisa kirim password via:
  // - Header: x-admin-password: admin123
  // - Body: { "adminPassword": "admin123" }
  const adminPassword = req.headers['x-admin-password'] || req.body.adminPassword;
  // req.headers membaca header HTTP; || membaca dari body jika header tidak ada; mendukung dua cara pengiriman password
  
  // STEP 2: Ambil app key dari header
  const appKey = req.headers['x-app-key'];
  // x-app-key: NFC2025SecureApp
  
  // STEP 3: Ambil app secret dan admin password dari environment variables
  const appSecret = process.env.APP_SECRET || 'NFC2025SecureApp';
  // Default jika tidak ada di .env
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  // Default admin password
  
  // STEP 4: Validasi app key (first layer authentication)
  if (appKey !== appSecret) {
    // memeriksa apakah x-app-key yang dikirim cocok dengan APP_SECRET; tidak cocok berarti bukan dari app resmi
    return res.status(401).json({ error: 'Invalid app key' });
    // 401 Unauthorized
  }
  
  // STEP 5: Validasi admin password (second layer authentication)
  if (adminPassword !== adminPass) {
    // memeriksa apakah password admin cocok; tidak cocok berarti bukan admin yang sah
    return res.status(401).json({ error: 'Invalid admin password' });
    // 401 Unauthorized
  }
  
  // STEP 6: Autentikasi berhasil! Lanjut ke endpoint
  next();
  // next() memanggil middleware berikutnya dalam chain; tanpa next() request akan berhenti di middleware ini
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
  // middleware authenticateDevice: memverifikasi request sinkronisasi perangkat berasal dari aplikasi Android resmi
  // STEP 1: Ambil app key dari header
  const appKey = req.headers['x-app-key'];
  // x-app-key: NFC2025SecureApp
  
  // STEP 2: Ambil user agent dari header (untuk detect Android app)
  const userAgent = req.headers['user-agent'];
  // user-agent: okhttp/4.9.0
  
  // STEP 3: Ambil app secret dari environment variables
  const appSecret = process.env.APP_SECRET || 'NFC2025SecureApp';
  // ambil APP_SECRET dari environment variable; || menggunakan default jika tidak ada
  
  // STEP 4: Validasi app key
  if (appKey !== appSecret) {
    // memeriksa apakah x-app-key cocok dengan secret; memastikan request dari app Android resmi
    return res.status(401).json({ error: 'Invalid app key' });
    // 401 Unauthorized
  }
  
  // STEP 5: Validasi user agent (harus dari Android app)
  // Android app pakai okhttp library untuk HTTP request
  if (!userAgent || !userAgent.includes('okhttp')) {
    // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    return res.status(401).json({ error: 'Invalid user agent' });
    // 401 Unauthorized (bukan dari Android app)
  }
  
  // STEP 6: Autentikasi berhasil! Lanjut ke endpoint
  next();
  // next() memanggil middleware berikutnya dalam chain; tanpa next() request akan berhenti di middleware ini
};

// STEP 7: Export semua fungsi middleware agar bisa diimport di file lain
module.exports = {
  // module.exports adalah cara CommonJS (Node.js) untuk mengekspor nilai dari file ini; objek berisi tiga fungsi yang akan tersedia saat file lain melakukan require('./middleware/auth')
  authenticateToken,
  // shorthand ES6: sama dengan authenticateToken: authenticateToken — digunakan untuk proteksi endpoint yang perlu JWT token
  authenticateAdmin,
  // shorthand ES6: sama dengan authenticateAdmin: authenticateAdmin — digunakan untuk proteksi endpoint admin
  authenticateDevice
  // shorthand ES6: sama dengan authenticateDevice: authenticateDevice — digunakan untuk proteksi endpoint device sync
};
