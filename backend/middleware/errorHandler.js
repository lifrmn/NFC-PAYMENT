// ============================================================
// ERRORHANDLER.JS - MIDDLEWARE ERROR HANDLING TERPUSAT
// ============================================================
// File ini berisi middleware untuk handle error secara terpusat
// Semua error yang tidak tertangkap di endpoint akan ditangkap di sini
// 
// Cara kerja:
// 1. Endpoint throw error atau panggil next(error)
// 2. Error akan "jatuh" ke middleware ini (karena ada 4 parameter: err, req, res, next)
// 3. Middleware ini cek tipe error dan return response yang sesuai
// 4. Client dapat error message yang informatif
//
// Error types yang ditangani:
// - Prisma errors (P2002, P2025, dll)
// - Validation errors
// - JWT errors (JsonWebTokenError, TokenExpiredError)
// - Generic errors

// ===============================================================
// FUNGSI: errorHandler - Middleware untuk handle semua error
// ===============================================================
// Fungsi ini dipanggil otomatis oleh Express saat ada error
// Usage: app.use(errorHandler) <- ditaruh di paling akhir setelah semua routes
const errorHandler = (err, req, res, next) => { // errorHandler: error handling middleware Express dengan 4 parameter (err, req, res, next); 4 param = Express kenali sebagai error handler
  // errorHandler: error handling middleware Express dengan 4 parameter (err, req, res, next); 4 param = Express kenali sebagai error handler
  // STEP 1: Log error ke console untuk debugging
  console.error('Error:', err); // Log full error object
  // Log full error object

  // STEP 2: Handle Prisma errors
  // Prisma error code P2002 = Unique constraint violation (duplicate entry)
  if (err.code === 'P2002') { // P2002 adalah kode error Prisma untuk unique constraint violation; data yang dimasukkan sudah ada (duplikat)
    // P2002 adalah kode error Prisma untuk unique constraint violation; data yang dimasukkan sudah ada (duplikat)
    return res.status(400).json({ // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      error: 'Duplicate entry', // Error message user-friendly
      // Error message user-friendly
      details: 'A record with this information already exists' // Detail lebih spesifik
      // Detail lebih spesifik
    });
  }

  // Prisma error code P2025 = Record not found
  if (err.code === 'P2025') { // P2025 adalah kode error Prisma untuk record not found; data yang diminta tidak ada di database
    // P2025 adalah kode error Prisma untuk record not found; data yang diminta tidak ada di database
    return res.status(404).json({ // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
      // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
      error: 'Record not found', // Error message user-friendly
      // Error message user-friendly
      details: 'The requested record does not exist' // Detail lebih spesifik
      // Detail lebih spesifik
    });
  }

  // STEP 3: Handle validation errors
  // Validation error terjadi saat data tidak sesuai format (dari express-validator)
  if (err.name === 'ValidationError') { // ValidationError: error validasi input; data yang dikirim tidak sesuai format yang diharapkan
    // ValidationError: error validasi input; data yang dikirim tidak sesuai format yang diharapkan
    return res.status(400).json({ // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      error: 'Validation error', // Error type
      // Error type
      details: err.message // Detail error (field mana yang salah)
      // Detail error (field mana yang salah)
    });
  }

  // STEP 4: Handle JWT errors
  // JsonWebTokenError = Token format salah atau signature tidak valid
  if (err.name === 'JsonWebTokenError') { // JsonWebTokenError: error dari library jsonwebtoken; token JWT tidak valid atau formatnya salah
    // JsonWebTokenError: error dari library jsonwebtoken; token JWT tidak valid atau formatnya salah
    return res.status(401).json({ // return menghentikan eksekusi; status 401 Unauthorized karena token tidak valid
      // return menghentikan eksekusi; status 401 Unauthorized karena token tidak valid
      error: 'Invalid token', // Error message
      // Error message
      details: 'The provided token is invalid' // Detail lebih spesifik
      // Detail lebih spesifik
    });
  }

  // TokenExpiredError = Token sudah expired (melewati waktu exp)
  if (err.name === 'TokenExpiredError') { // TokenExpiredError: token JWT sudah melewati waktu kadaluarsa; user harus login ulang
    // TokenExpiredError: token JWT sudah melewati waktu kadaluarsa; user harus login ulang
    return res.status(401).json({ // return menghentikan eksekusi; status 401 Unauthorized karena token kadaluarsa
      // return menghentikan eksekusi; status 401 Unauthorized karena token kadaluarsa
      error: 'Token expired', // Error message
      // Error message
      details: 'The provided token has expired' // Detail lebih spesifik
      // Detail lebih spesifik
    });
  }

  // STEP 5: Default error handler (untuk error yang tidak dikenali)
  // Return 500 Internal Server Error dengan error message generic
  res.status(err.status || 500).json({ // mengirim response dengan status error (atau 500 jika tidak ada); ini adalah error handler global
    // mengirim response dengan status error (atau 500 jika tidak ada); ini adalah error handler global
    error: err.message || 'Internal server error', // Error message (dari err.message atau default)
    // Error message (dari err.message atau default)
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined // Stack trace hanya di development mode
    // Stack trace hanya di development mode
  });
};

// Export errorHandler agar bisa diimport di server.js
module.exports = { errorHandler }; // module.exports mengekspor objek/fungsi dari file ini agar bisa digunakan file lain
// module.exports mengekspor objek/fungsi dari file ini agar bisa digunakan file lain
