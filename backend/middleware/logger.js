// ============================================================
// LOGGER.JS - MIDDLEWARE REQUEST LOGGER
// ============================================================
// File ini berisi middleware untuk logging semua HTTP request
// Log format: METHOD URL - STATUS_CODE - DURATION - IP_ADDRESS
// Contoh: GET /api/users/me - 200 - 45ms - ::1
//
// Cara kerja:
// 1. Middleware ini dipanggil untuk setiap request yang masuk
// 2. Catat waktu mulai request (start time)
// 3. Tunggu sampai response selesai dikirim (event 'finish')
// 4. Hitung durasi request (sekarang - start time)
// 5. Log ke console dengan format: METHOD URL - STATUS - DURATION - IP

// ===============================================================
// FUNGSI: requestLogger - Middleware untuk log semua HTTP request
// ===============================================================
// Usage: app.use(requestLogger) <- ditaruh setelah express.json()
const requestLogger = (req, res, next) => { // requestLogger: middleware Express; menerima (req, res, next) — req=request, res=response, next=lanjut ke middleware berikutnya
  // requestLogger: middleware Express; menerima (req, res, next) — req=request, res=response, next=lanjut ke middleware berikutnya
  // STEP 1: Catat waktu mulai request (timestamp dalam milliseconds)
  const start = Date.now(); // Date.now() mengembalikan timestamp milidetik saat ini; digunakan untuk cap waktu operasi
  // Date.now() mengembalikan timestamp milidetik saat ini; digunakan untuk cap waktu operasi
  
  // STEP 2: Listen event 'finish' dari response object
  // Event 'finish' dipanggil saat response selesai dikirim ke client
  res.on('finish', () => { // res.on('finish') mendaftarkan event listener; dipanggil otomatis setelah response selesai dikirim ke client
    // res.on('finish') mendaftarkan event listener; dipanggil otomatis setelah response selesai dikirim ke client
    // STEP 2.1: Hitung durasi request (waktu sekarang - waktu mulai)
    const duration = Date.now() - start; // Durasi dalam milliseconds
    // Durasi dalam milliseconds
    
    // STEP 2.2: Extract info request yang akan di-log
    const { method, url, ip } = req; // Method (GET/POST), URL (/api/users), IP address client
    // Method (GET/POST), URL (/api/users), IP address client
    const { statusCode } = res; // Status code response (200, 404, 500, dll)
    // Status code response (200, 404, 500, dll)
    
    // STEP 2.3: Log ke console dengan format custom
    // Format: METHOD URL - STATUS - DURATION - IP
    // Contoh: GET /api/users/me - 200 - 45ms - ::1
    console.log(`${method} ${url} - ${statusCode} - ${duration}ms - ${ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
  });
  
  // STEP 3: Lanjut ke middleware/route handler berikutnya
  next(); // next() memanggil middleware berikutnya dalam chain; tanpa next() request akan berhenti di middleware ini
  // next() memanggil middleware berikutnya dalam chain; tanpa next() request akan berhenti di middleware ini
};

// Export requestLogger agar bisa diimport di server.js
module.exports = { requestLogger }; // module.exports mengekspor objek/fungsi dari file ini agar bisa digunakan file lain
// module.exports mengekspor objek/fungsi dari file ini agar bisa digunakan file lain
