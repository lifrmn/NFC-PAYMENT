// ============================================================
// AUTH.JS - ROUTES UNTUK AUTENTIKASI USER
// ============================================================
// File ini berisi semua endpoint untuk autentikasi:
// - POST /register -> Registrasi user baru
// - POST /login -> Login user (return JWT token)
// - POST /logout -> Logout user (invalidate session)
// - GET /verify -> Verify JWT token masih valid
//
// Semua endpoint di file ini PUBLIC (tidak perlu auth)
// karena user belum punya token saat register/login

const express = require('express'); // const membuat variabel tetap yang referensinya tidak bisa diganti; require di...
// const membuat variabel tetap yang referensinya tidak bisa diganti; require digunakan Node.js untuk memanggil module/library; express adalah framework web Node.js yang menyediakan routing, middleware, dan HTTP utilities.
const bcrypt = require('bcryptjs'); // const membuat variabel tetap; require memanggil module; bcryptjs adalah libra...
// const membuat variabel tetap; require memanggil module; bcryptjs adalah library untuk hashing password secara one-way menggunakan algoritma bcrypt sehingga password tidak disimpan sebagai plain text di database.
const jwt = require('jsonwebtoken'); // const membuat variabel tetap; require memanggil module; jsonwebtoken adalah l...
// const membuat variabel tetap; require memanggil module; jsonwebtoken adalah library untuk membuat (jwt.sign) dan memvalidasi (jwt.verify) JSON Web Token yang digunakan untuk autentikasi stateless.
const { body, validationResult } = require('express-validator'); // const membuat variabel tetap; { body, validationResult } adalah destructuring...
// const membuat variabel tetap; { body, validationResult } adalah destructuring untuk mengambil dua fungsi dari module express-validator; body digunakan untuk mendefinisikan aturan validasi input, validationResult mengambil hasil validasi.
const { PrismaClient } = require('@prisma/client'); // const membuat variabel tetap; { PrismaClient } mengambil class PrismaClient d...
// const membuat variabel tetap; { PrismaClient } mengambil class PrismaClient dari module @prisma/client; PrismaClient adalah ORM (Object-Relational Mapper) yang memungkinkan query database SQLite menggunakan JavaScript biasa tanpa menulis SQL mentah.

const router = express.Router(); // const membuat variabel tetap; express.Router() adalah fungsi bawaan Express y...
// const membuat variabel tetap; express.Router() adalah fungsi bawaan Express yang membuat objek router baru — kumpulan route yang bisa di-mount ke aplikasi utama; memisahkan route auth dari route lain agar kode lebih terorganisir.
const prisma = new PrismaClient(); // const membuat variabel tetap; new PrismaClient() membuat instance baru dari P...
// const membuat variabel tetap; new PrismaClient() membuat instance baru dari Prisma client yang terhubung ke database SQLite; semua operasi database (findUnique, create, update) dilakukan melalui objek prisma ini.

// =============================================================
// ENDPOINT 1: POST /register - REGISTER USER BARU
// =============================================================
// Endpoint untuk registrasi user baru ke sistem
// User akan mendapat JWT token setelah register sukses (auto-login)
//
// Request body:
// - name: string (min 2 chars)
// - username: string (min 3 chars, unique)
// - password: string (min 6 chars)
// - deviceId: string (optional, untuk tracking device)
//
// Response:
// - user: object (id, name, username, balance)
// - token: string (JWT token untuk autentikasi)
router.post( // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POS...
// router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  '/register', // Endpoint path: POST /api/auth/register — router.post mendaftarkan endpoint ya...
  // Endpoint path: POST /api/auth/register — router.post mendaftarkan endpoint yang merespons method HTTP POST pada path '/register'
  [ // Validasi input menggunakan express-validator middleware
    // Validasi input menggunakan express-validator middleware
    // Validasi dijalankan sebelum masuk ke handler function
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'), // body('name') mengambil field 'name' dari req.body; .trim() menghapus spasi di...
    // body('name') mengambil field 'name' dari req.body; .trim() menghapus spasi di awal/akhir; .isLength({ min: 2 }) memastikan panjang minimal 2 karakter; .withMessage() mengatur pesan error jika validasi gagal.
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'), // body('username') validasi field username; .trim() bersihkan spasi; .isLength(...
    // body('username') validasi field username; .trim() bersihkan spasi; .isLength({ min: 3 }) minimal 3 karakter; mencegah username terlalu pendek yang mudah ditebak.
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'), // body('password') validasi field password; .isLength({ min: 6 }) minimal 6 kar...
    // body('password') validasi field password; .isLength({ min: 6 }) minimal 6 karakter; standar keamanan minimum untuk password.
  ],
  async (req, res) => { // async membuat function ini dapat menjalankan proses asynchronous (database, h...
    // async membuat function ini dapat menjalankan proses asynchronous (database, hashing) dan secara otomatis mengembalikan Promise; req adalah objek request dari client berisi body, headers, dan IP; res adalah objek response untuk mengirim balik data ke client.
    try { // try digunakan untuk menjalankan kode yang berpotensi error seperti query data...
      // try digunakan untuk menjalankan kode yang berpotensi error seperti query database atau bcrypt hash
      console.log('🔥 REGISTER REQUEST from mobile app'); // console.log menampilkan pesan ke terminal untuk debugging — membantu melacak ...
      // console.log menampilkan pesan ke terminal untuk debugging — membantu melacak kapan endpoint dipanggil
      console.log('👤 Name:', req.body.name); // req.body.name mengambil field name dari JSON body request yang dikirim mobile...
      // req.body.name mengambil field name dari JSON body request yang dikirim mobile app
      console.log('📱 Username:', req.body.username); // req.body.username mengambil field username dari JSON body request
      // req.body.username mengambil field username dari JSON body request
      console.log('🌐 IP:', req.ip); // req.ip adalah IP address client yang mengirim request — berguna untuk logging...
      // req.ip adalah IP address client yang mengirim request — berguna untuk logging dan audit
      
      // Cek hasil validasi input dari middleware di atas
      const errors = validationResult(req); // const membuat variabel tetap; validationResult(req) mengumpulkan semua error ...
      // const membuat variabel tetap; validationResult(req) mengumpulkan semua error validasi dari express-validator yang sudah dijalankan sebelumnya
      if (!errors.isEmpty()) { // if mengecek kondisi; !errors.isEmpty() berarti "jika array errors TIDAK koson...
        // if mengecek kondisi; !errors.isEmpty() berarti "jika array errors TIDAK kosong" (tanda ! membalik nilai boolean); isEmpty() return true jika tidak ada error
        console.log('❌ Validation errors:', errors.array()); // .array() mengubah errors menjadi array biasa untuk ditampilkan
        // .array() mengubah errors menjadi array biasa untuk ditampilkan
        return res.status(400).json({ errors: errors.array() }); // return menghentikan eksekusi function; res.status(400) mengatur HTTP status 4...
        // return menghentikan eksekusi function; res.status(400) mengatur HTTP status 400 Bad Request; .json() mengirim response dalam format JSON
      }

      // Extract data dari request body (JSON payload dari mobile app)
      const { name, username, password, deviceId } = req.body; // const membuat variabel tetap; destructuring mengambil field name, username, p...
      // const membuat variabel tetap; destructuring mengambil field name, username, password, deviceId langsung dari req.body (objek JSON yang dikirim client) agar kode lebih bersih daripada req.body.name, req.body.username, dst.

      // Cek apakah username sudah terdaftar di database (unique constraint)
      const existingUser = await prisma.user.findUnique({ where: { username } }); // const membuat variabel tetap; await menunggu Promise selesai sebelum lanjut k...
      // const membuat variabel tetap; await menunggu Promise selesai sebelum lanjut ke baris berikutnya; prisma.user.findUnique mencari tepat satu record user berdasarkan field unik; { where: { username } } adalah shorthand ES6 untuk { where: { username: username } }
      if (existingUser) { // if mengecek apakah existingUser truthy (bukan null/undefined) — artinya user ...
        // if mengecek apakah existingUser truthy (bukan null/undefined) — artinya user dengan username ini sudah ada di database
        return res.status(400).json({ error: 'Username sudah digunakan' }); // return menghentikan eksekusi; res.status(400).json() mengirim error 400 Bad R...
        // return menghentikan eksekusi; res.status(400).json() mengirim error 400 Bad Request karena input tidak valid
      }

      // Hash password menggunakan bcrypt (one-way encryption untuk keamanan)
      // JANGAN PERNAH simpan password plain text! Harus di-hash
      const hashedPassword = await bcrypt.hash(password, 10); // const membuat variabel tetap; await menunggu bcrypt selesai; bcrypt.hash(pass...
      // const membuat variabel tetap; await menunggu bcrypt selesai; bcrypt.hash(password, 10) mengubah password menjadi hash bcrypt dengan salt rounds 10 — semakin tinggi angka salt rounds semakin aman tapi semakin lambat; hasil hash tidak bisa di-decode balik ke password asli

      // STEP 6: Buat user baru di database
      const user = await prisma.user.create({ // const membuat variabel tetap; await menunggu operasi database selesai; prisma...
        // const membuat variabel tetap; await menunggu operasi database selesai; prisma.user.create menyimpan record user baru ke tabel User di database SQLite
        data: { // data adalah objek berisi nilai field yang akan dimasukkan ke database
          // data adalah objek berisi nilai field yang akan dimasukkan ke database
          name, // shorthand ES6: sama dengan name: name — nilai dari destructuring di atas
          // shorthand ES6: sama dengan name: name — nilai dari destructuring di atas
          username, // shorthand ES6: sama dengan username: username
          // shorthand ES6: sama dengan username: username
          password: hashedPassword, // password yang disimpan adalah HASH, bukan plain text asli
          // password yang disimpan adalah HASH, bukan plain text asli
          deviceId: deviceId || null, // operator || (OR): jika deviceId ada gunakan nilainya, jika tidak ada gunakan ...
          // operator || (OR): jika deviceId ada gunakan nilainya, jika tidak ada gunakan null; mencegah undefined masuk ke database
          balance: 0, // saldo awal user = 0 (nol rupiah) saat pertama kali daftar
          // saldo awal user = 0 (nol rupiah) saat pertama kali daftar
          isActive: true, // user langsung aktif setelah register, belum diblokir admin
          // user langsung aktif setelah register, belum diblokir admin
        },
      });

      // STEP 7: Buat token JWT untuk user
      const jwtSecret = process.env.JWT_SECRET || 'nfc-payment-jwt-secret-2025-ultra-secure-key'; // const membuat variabel tetap; process.env.JWT_SECRET membaca nilai dari file ...
      // const membuat variabel tetap; process.env.JWT_SECRET membaca nilai dari file .env melalui dotenv; operator || berarti "jika JWT_SECRET kosong/undefined, gunakan string default ini"; di production WAJIB diisi via .env agar aman
      const token = jwt.sign( // const membuat variabel tetap; jwt.sign digunakan untuk membuat token JWT baru...
      // const membuat variabel tetap; jwt.sign digunakan untuk membuat token JWT baru setelah login/register berhasil
        { userId: user.id, username: user.username }, // PAYLOAD: data yang di-encode di dalam token — berisi userId dan username yang...
        // PAYLOAD: data yang di-encode di dalam token — berisi userId dan username yang akan dipakai untuk identifikasi user di setiap request berikutnya; jangan taruh password di sini!
        jwtSecret, // SECRET KEY: kunci rahasia untuk menandatangani (sign) token agar tidak bisa d...
        // SECRET KEY: kunci rahasia untuk menandatangani (sign) token agar tidak bisa dipalsukan; siapapun yang punya secret ini bisa verify token
        { expiresIn: '7d' } // OPTIONS: expiresIn '7d' berarti token otomatis kadaluarsa setelah 7 hari; set...
        // OPTIONS: expiresIn '7d' berarti token otomatis kadaluarsa setelah 7 hari; setelah expired, user harus login ulang
      );

      // STEP 8: Simpan session user di database (untuk tracking & logout)
      await prisma.userSession.create({ // await menunggu operasi database selesai; prisma.userSession.create menyimpan ...
        // await menunggu operasi database selesai; prisma.userSession.create menyimpan record session baru ke tabel UserSession
        data: { // data berisi nilai field yang akan disimpan
          // data berisi nilai field yang akan disimpan
          userId: user.id, // foreign key ke tabel User — menghubungkan session dengan user
          // foreign key ke tabel User — menghubungkan session dengan user
          deviceId: deviceId || 'unknown', // ID perangkat yang digunakan; fallback 'unknown' jika tidak dikirim
          // ID perangkat yang digunakan; fallback 'unknown' jika tidak dikirim
          token, // shorthand ES6: sama dengan token: token — JWT token yang baru dibuat
          // shorthand ES6: sama dengan token: token — JWT token yang baru dibuat
          isActive: true, // session aktif (belum logout)
          // session aktif (belum logout)
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // new Date() membuat objek tanggal; Date.now() mengembalikan timestamp sekarang...
          // new Date() membuat objek tanggal; Date.now() mengembalikan timestamp sekarang dalam milliseconds; 7*24*60*60*1000 = 7 hari dalam ms; ini menghitung tanggal 7 hari ke depan
          ipAddress: req.ip || '0.0.0.0', // IP address user saat login; req.ip diambil dari request; fallback '0.0.0.0' j...
          // IP address user saat login; req.ip diambil dari request; fallback '0.0.0.0' jika tidak tersedia
          userAgent: req.headers['user-agent'] || 'unknown', // req.headers['user-agent'] berisi info browser/app yang digunakan client; berg...
          // req.headers['user-agent'] berisi info browser/app yang digunakan client; berguna untuk audit keamanan
        },
      });

      // STEP 9: Emit event 'user-registered' ke admin dashboard (via Socket.IO)
      if (req.io) { // if mengecek apakah req.io tersedia (Socket.IO di-attach ke req di server.js);...
        // if mengecek apakah req.io tersedia (Socket.IO di-attach ke req di server.js); mencegah error jika Socket.IO belum tersetup
        req.io.to('admin-room').emit('user-registered', { // req.io.to('admin-room') mengirim event ke semua socket yang bergabung di room...
          // req.io.to('admin-room') mengirim event ke semua socket yang bergabung di room 'admin-room'; .emit(eventName, data) mengirim event real-time beserta datanya
          user: { // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
            // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
            id: user.id, // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk...
            // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk identifikasi user
            name: user.name, // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
            // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
            username: user.username, // username: user.username menyertakan username dalam response; digunakan untuk ...
            // username: user.username menyertakan username dalam response; digunakan untuk login berikutnya
            balance: user.balance, // balance: user.balance menyertakan saldo user dalam response; ditampilkan di d...
            // balance: user.balance menyertakan saldo user dalam response; ditampilkan di dashboard
          },
        });
      }

      // STEP 10: Return response sukses dengan user data & token
      return res.status(201).json({ // return menghentikan eksekusi dan mengirim response; res.status(201) mengatur ...
        // return menghentikan eksekusi dan mengirim response; res.status(201) mengatur HTTP status 201 Created (berbeda dari 200 OK — 201 khusus untuk resource yang baru dibuat); .json() mengubah objek JavaScript menjadi JSON string dan mengirimnya ke client
        message: 'Pengguna berhasil didaftarkan', // pesan sukses registrasi yang dikirim ke frontend setelah user berhasil dibuat
        // pesan sukses registrasi yang dikirim ke frontend setelah user berhasil dibuat
        user: { // kirim hanya field yang aman — jangan kirim password (meski sudah hash)
          // kirim hanya field yang aman — jangan kirim password (meski sudah hash)
          id: user.id, // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk...
          // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk identifikasi user
          name: user.name, // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
          // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
          username: user.username, // username: user.username menyertakan username dalam response; digunakan untuk ...
          // username: user.username menyertakan username dalam response; digunakan untuk login berikutnya
          balance: user.balance, // balance: user.balance menyertakan saldo user dalam response; ditampilkan di d...
          // balance: user.balance menyertakan saldo user dalam response; ditampilkan di dashboard
        },
        token, // JWT token (shorthand ES6: token: token) — client harus simpan ini di AsyncSto...
        // JWT token (shorthand ES6: token: token) — client harus simpan ini di AsyncStorage untuk request berikutnya
      });
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('❌ Kesalahan registrasi:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Gagal mendaftarkan pengguna' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terd...
      // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    }
  }
);

// =============================================================
// ENDPOINT 2: POST /login - LOGIN USER
// =============================================================
// Endpoint untuk login user ke sistem
// User kirim username & password, server verify dan return JWT token
//
// Request body:
// - username: string (required)
// - password: string (required) 
// - deviceId: string (optional, untuk tracking)
//
// Response:
// - user: object (id, name, username, balance)
// - token: string (JWT token untuk autentikasi)
router.post( // router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POS...
// router.post() mendaftarkan endpoint HTTP POST; dipanggil saat ada request POST ke URL tersebut
  '/login', // path '/login' adalah URL endpoint login; POST ke /api/auth/login untuk autent...
  // path '/login' adalah URL endpoint login; POST ke /api/auth/login untuk autentikasi user
  [ // STEP 1: Validasi input
    // STEP 1: Validasi input
    body('username').trim().notEmpty().withMessage('Username diperlukan'), // body('username') mengambil field username dari req.body; .trim() menghapus sp...
    // body('username') mengambil field username dari req.body; .trim() menghapus spasi; .notEmpty() memastikan tidak kosong; .withMessage() menetapkan pesan error custom jika validasi gagal
    body('password').notEmpty().withMessage('Password diperlukan'), // body('password') validasi field password; .notEmpty() memastikan tidak kosong...
    // body('password') validasi field password; .notEmpty() memastikan tidak kosong; password wajib ada agar sistem bisa memverifikasi identitas user
  ],
  async (req, res) => { // async membuat function bisa menggunakan await; req adalah request dari client...
    // async membuat function bisa menggunakan await; req adalah request dari client; res digunakan untuk mengirim response balik ke client
    try { // try menjalankan kode yang berpotensi error: database query, bcrypt compare, dll
      // try menjalankan kode yang berpotensi error: database query, bcrypt compare, dll
      console.log('🔥 LOGIN REQUEST from mobile app'); // Log untuk memudahkan debugging ketika ada masalah login
      // Log untuk memudahkan debugging ketika ada masalah login
      console.log('📱 Username:', req.body.username); // Tampilkan username yang mencoba login
      // Tampilkan username yang mencoba login
      console.log('🌐 IP:', req.ip); // Tampilkan IP address client
      // Tampilkan IP address client
      
      // STEP 2: Cek hasil validasi
      const errors = validationResult(req); // const membuat variabel tetap; validationResult(req) mengumpulkan semua error ...
      // const membuat variabel tetap; validationResult(req) mengumpulkan semua error dari validasi express-validator yang sudah dijalankan
      if (!errors.isEmpty()) { // if mengecek apakah ada error; !errors.isEmpty() = "jika TIDAK kosong" = "jika...
        // if mengecek apakah ada error; !errors.isEmpty() = "jika TIDAK kosong" = "jika ada error"
        console.log('❌ Validation errors:', errors.array()); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(400).json({ errors: errors.array() }); // return menghentikan eksekusi; status 400 = Bad Request karena input tidak valid
        // return menghentikan eksekusi; status 400 = Bad Request karena input tidak valid
      }

      // STEP 3: Extract data dari request body
      const { username, password, deviceId } = req.body; // const membuat variabel tetap; destructuring mengambil username, password, dev...
      // const membuat variabel tetap; destructuring mengambil username, password, deviceId langsung dari req.body (JSON yang dikirim mobile app)

      // STEP 4: Cari user berdasarkan username
      const user = await prisma.user.findUnique({ where: { username } }); // const membuat variabel tetap; await menunggu query database selesai; prisma.u...
      // const membuat variabel tetap; await menunggu query database selesai; prisma.user.findUnique mencari tepat satu record di tabel User berdasarkan field username yang bersifat unique; { where: { username } } adalah shorthand ES6
      if (!user) { // if mengecek apakah user null/undefined (tidak ditemukan di database); tanda !...
        // if mengecek apakah user null/undefined (tidak ditemukan di database); tanda ! membalik nilai boolean
        console.log('❌ User tidak ditemukan:', username); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(401).json({ error: 'Username atau password salah' }); // return menghentikan; 401 Unauthorized — sengaja pesan samar "username atau pa...
        // return menghentikan; 401 Unauthorized — sengaja pesan samar "username atau password salah" agar hacker tidak tahu mana yang benar
      }

      console.log('✅ User ditemukan:', { id: user.id, username: user.username, hasPassword: !!user.password }); // !!user.password mengubah nilai ke boolean: true jika password ada, false jika...
      // !!user.password mengubah nilai ke boolean: true jika password ada, false jika tidak

      // STEP 5: Cek password menggunakan bcrypt.compare()
      // bcrypt.compare() akan hash password input dan compare dengan hash di database
      const validPassword = await bcrypt.compare(password, user.password); // const membuat variabel tetap; await menunggu bcrypt selesai; bcrypt.compare(p...
      // const membuat variabel tetap; await menunggu bcrypt selesai; bcrypt.compare(plainText, hash) membandingkan password yang diketik user dengan hash yang tersimpan di database — mengembalikan true jika cocok, false jika tidak; AMAN karena bcrypt tidak perlu decode hash
      if (!validPassword) { // if mengecek apakah password tidak cocok; tanda ! membalik nilai boolean
        // if mengecek apakah password tidak cocok; tanda ! membalik nilai boolean
        console.log('❌ Password tidak valid untuk user:', username); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(401).json({ error: 'Username atau password salah' }); // 401 Unauthorized — pesan sama agar tidak memberikan petunjuk kepada hacker
        // 401 Unauthorized — pesan sama agar tidak memberikan petunjuk kepada hacker
      }

      const loginTime = new Date().toLocaleTimeString('id-ID'); // new Date() membuat objek tanggal saat ini; .toLocaleTimeString('id-ID') forma...
      // new Date() membuat objek tanggal saat ini; .toLocaleTimeString('id-ID') format waktu Indonesia (HH:MM:SS)
      console.log(`🎉 LOGIN BERHASIL - ${username} pukul ${loginTime}`); // template literal menggunakan backtick; ${} untuk menyisipkan variabel ke dala...
      // template literal menggunakan backtick; ${} untuk menyisipkan variabel ke dalam string

      // STEP 6: Buat token JWT
      const jwtSecret = process.env.JWT_SECRET || 'nfc-payment-jwt-secret-2025-ultra-secure-key'; // const membuat variabel tetap; process.env.JWT_SECRET membaca konfigurasi dari...
      // const membuat variabel tetap; process.env.JWT_SECRET membaca konfigurasi dari file .env; operator || fallback ke nilai default jika tidak ada di .env
      const sevenDays = 7 * 24 * 60 * 60 * 1000; // const membuat variabel tetap; kalkulasi durasi 7 hari dalam milliseconds: 7 h...
      // const membuat variabel tetap; kalkulasi durasi 7 hari dalam milliseconds: 7 hari × 24 jam × 60 menit × 60 detik × 1000 ms
      const expireDate = new Date(Date.now() + sevenDays); // const membuat variabel tetap; new Date() membuat objek tanggal; Date.now() me...
      // const membuat variabel tetap; new Date() membuat objek tanggal; Date.now() mengembalikan timestamp sekarang; menambahkan 7 hari untuk menghitung tanggal kadaluarsa token
      const token = jwt.sign( // const membuat variabel tetap; jwt.sign membuat token JWT baru setelah login b...
      // const membuat variabel tetap; jwt.sign membuat token JWT baru setelah login berhasil
        { userId: user.id, username: user.username }, // PAYLOAD: objek data yang di-encode dalam token; userId digunakan middleware a...
        // PAYLOAD: objek data yang di-encode dalam token; userId digunakan middleware auth untuk identifikasi user pada setiap request
        jwtSecret, // SECRET KEY: kunci rahasia untuk menandatangani token agar tidak bisa dipalsukan
        // SECRET KEY: kunci rahasia untuk menandatangani token agar tidak bisa dipalsukan
        { expiresIn: '7d' } // OPTIONS: token kadaluarsa otomatis setelah 7 hari untuk keamanan
        // OPTIONS: token kadaluarsa otomatis setelah 7 hari untuk keamanan
      );

      // STEP 7: Buat atau update session (upsert = update if exists, create if not)
      await prisma.userSession.upsert({ // await menunggu operasi database; prisma.userSession.upsert = UPDATE jika sess...
        // await menunggu operasi database; prisma.userSession.upsert = UPDATE jika session sudah ada, CREATE jika belum — mencegah duplikasi session untuk token yang sama
        where: { token }, // WHERE token = token — cari session yang sudah ada dengan token ini
        // WHERE token = token — cari session yang sudah ada dengan token ini
        update: { // jika session sudah ada, update field-field berikut:
          // jika session sudah ada, update field-field berikut:
          isActive: true, // aktifkan kembali session (jika sebelumnya di-logout)
          // aktifkan kembali session (jika sebelumnya di-logout)
          expiresAt: expireDate, // perpanjang waktu kadaluarsa
          // perpanjang waktu kadaluarsa
          ipAddress: req.ip || '0.0.0.0', // update IP terbaru
          // update IP terbaru
          userAgent: req.headers['user-agent'] || 'unknown', // update user agent terbaru
          // update user agent terbaru
        },
        create: { // jika session belum ada, buat session baru dengan data:
          // jika session belum ada, buat session baru dengan data:
          userId: user.id, // foreign key ke tabel User
          // foreign key ke tabel User
          deviceId: deviceId || 'unknown', // ID perangkat yang digunakan
          // ID perangkat yang digunakan
          token, // JWT token yang baru dibuat (shorthand ES6)
          // JWT token yang baru dibuat (shorthand ES6)
          isActive: true, // session langsung aktif
          // session langsung aktif
          expiresAt: expireDate, // waktu kadaluarsa 7 hari ke depan
          // waktu kadaluarsa 7 hari ke depan
          ipAddress: req.ip || '0.0.0.0', // IP address client
          // IP address client
          userAgent: req.headers['user-agent'] || 'unknown', // info browser/app client
          // info browser/app client
        },
      });

      // STEP 8: Emit login event ke admin dashboard (via Socket.IO)
      if (req.io) { // if mengecek apakah Socket.IO tersedia di req; diset di server.js via middlewa...
        // if mengecek apakah Socket.IO tersedia di req; diset di server.js via middleware app.use
        req.io.to('admin-room').emit('user-login', { // .to('admin-room') mengirim ke room admin saja; .emit(event, data) mengirim ev...
          // .to('admin-room') mengirim ke room admin saja; .emit(event, data) mengirim event real-time dengan data
          user: { // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
            // user: prop objek data user yang dikirim dari komponen induk ke komponen ini
            id: user.id, // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk...
            // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk identifikasi user
            name: user.name, // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
            // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
            username: user.username, // username: user.username menyertakan username dalam response; digunakan untuk ...
            // username: user.username menyertakan username dalam response; digunakan untuk login berikutnya
            balance: user.balance, // balance: user.balance menyertakan saldo user dalam response; ditampilkan di d...
            // balance: user.balance menyertakan saldo user dalam response; ditampilkan di dashboard
          },
        });
      }

      // STEP 9: Return response sukses dengan user data & token
      return res.json({ // return menghentikan eksekusi; res.json() mengirim response 200 OK dengan body...
        // return menghentikan eksekusi; res.json() mengirim response 200 OK dengan body JSON (default status 200 jika tidak ditentukan)
        message: 'Login berhasil', // pesan konfirmasi untuk ditampilkan di mobile app
        // pesan konfirmasi untuk ditampilkan di mobile app
        user: { // kirim data user yang aman (tanpa password hash)
          // kirim data user yang aman (tanpa password hash)
          id: user.id, // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk...
          // id: user.id menyertakan ID unik user dalam response; digunakan frontend untuk identifikasi user
          name: user.name, // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
          // name: user.name menyertakan nama lengkap user dalam response; ditampilkan di UI
          username: user.username, // username: user.username menyertakan username dalam response; digunakan untuk ...
          // username: user.username menyertakan username dalam response; digunakan untuk login berikutnya
          balance: user.balance, // saldo terkini dari database
          // saldo terkini dari database
        },
        token, // JWT token (shorthand ES6) — mobile app harus simpan ke AsyncStorage untuk req...
        // JWT token (shorthand ES6) — mobile app harus simpan ke AsyncStorage untuk request berikutnya
      });
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('❌ Kesalahan login:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Gagal melakukan login' }); // mengirim response error 500 Internal Server Error jika terjadi error tak terd...
      // mengirim response error 500 Internal Server Error jika terjadi error tak terduga di server
    }
  }
);

// =============================================================
// ENDPOINT 3: POST /logout - LOGOUT USER
// =============================================================
// Endpoint untuk logout user dari sistem
// Session akan di-invalidate (set isActive = false)
//
// Request headers:
// - Authorization: Bearer <token>
//
// Response:
// - message: string (logout status)
router.post('/logout', async (req, res) => { // router.post mendaftarkan endpoint POST /logout; async membuat function bisa m...
  // router.post mendaftarkan endpoint POST /logout; async membuat function bisa menggunakan await
  try { // try menjalankan kode yang berpotensi error — terutama operasi database
    // try menjalankan kode yang berpotensi error — terutama operasi database
    // STEP 1: Ambil token dari Authorization header
    // Format: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const token = req.headers['authorization']?.split(' ')[1]; // const membuat variabel tetap; req.headers['authorization'] membaca header Aut...
    // const membuat variabel tetap; req.headers['authorization'] membaca header Authorization dari request; ?. adalah optional chaining — jika undefined tidak akan error; .split(' ') memecah string berdasarkan spasi menjadi array ['Bearer', 'TOKEN']; [1] mengambil elemen indeks ke-1 yaitu tokennya
    
    // STEP 2: Validasi token ada
    if (!token) return res.status(400).json({ error: 'Token tidak disediakan' }); // if mengecek apakah token null/undefined; tanda ! membalik boolean; return men...
    // if mengecek apakah token null/undefined; tanda ! membalik boolean; return menghentikan eksekusi; 400 = Bad Request

    // STEP 3: Update semua session dengan token ini - set isActive = false
    // updateMany karena bisa ada multiple session dengan token yang sama
    await prisma.userSession.updateMany({ // await menunggu operasi database; prisma.userSession.updateMany mengupdate BAN...
      // await menunggu operasi database; prisma.userSession.updateMany mengupdate BANYAK record sekaligus yang memenuhi kondisi WHERE
      where: { token }, // WHERE token = token — cari semua session dengan token ini (shorthand ES6)
      // WHERE token = token — cari semua session dengan token ini (shorthand ES6)
      data: { isActive: false }, // SET isActive = false — menginvalidasi session, user dianggap sudah logout
      // SET isActive = false — menginvalidasi session, user dianggap sudah logout
    });

    // STEP 4: Return response sukses
    res.json({ message: 'Logout berhasil' }); // res.json() mengirim response 200 OK dengan pesan konfirmasi
    // res.json() mengirim response 200 OK dengan pesan konfirmasi
  } catch (error) { // catch menangkap error yang terjadi di dalam blok try
    // catch menangkap error yang terjadi di dalam blok try
    console.error('❌ Kesalahan logout:', error); // console.error menampilkan error ke terminal dengan styling merah
    // console.error menampilkan error ke terminal dengan styling merah
    res.status(500).json({ error: 'Gagal melakukan logout' }); // 500 = Internal Server Error
    // 500 = Internal Server Error
  }
});

// =============================================================
// ENDPOINT 4: GET /verify - VERIFY TOKEN
// =============================================================
// Endpoint untuk verify apakah JWT token masih valid
// Client bisa pakai endpoint ini saat app start untuk cek token tersimpan
//
// Request headers:
// - Authorization: Bearer <token>
//
// Response:
// - valid: boolean (true/false)
// - user: object (jika valid)
router.get('/verify', async (req, res) => { // router.get mendaftarkan endpoint GET /verify; async membuat function bisa men...
  // router.get mendaftarkan endpoint GET /verify; async membuat function bisa menggunakan await untuk operasi asynchronous
  try { // try menjalankan kode yang berpotensi error: jwt.verify, database query
    // try menjalankan kode yang berpotensi error: jwt.verify, database query
    // STEP 1: Ambil token dari Authorization header
    const token = req.headers['authorization']?.split(' ')[1]; // req.headers['authorization'] membaca header; ?. mencegah error jika undefined...
    // req.headers['authorization'] membaca header; ?. mencegah error jika undefined; .split(' ')[1] mengambil bagian token setelah kata 'Bearer'
    if (!token) return res.status(401).json({ error: 'Token tidak disediakan' }); // if mengecek token; return + 401 Unauthorized jika tidak ada token
    // if mengecek token; return + 401 Unauthorized jika tidak ada token

    // STEP 2: Verify token menggunakan jwt.verify()
    let decoded; // let membuat variabel yang nilainya bisa berubah; awalnya undefined, akan diis...
    // let membuat variabel yang nilainya bisa berubah; awalnya undefined, akan diisi setelah verify berhasil
    try { // try dalam try — untuk catch error khusus JWT secara terpisah
      // try dalam try — untuk catch error khusus JWT secara terpisah
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'nfc-payment-jwt-secret-2025-ultra-secure-key'); // jwt.verify digunakan untuk memvalidasi token JWT — memeriksa signature dan wa...
      // jwt.verify digunakan untuk memvalidasi token JWT — memeriksa signature dan waktu kadaluarsa; mengembalikan payload yang ter-decode jika valid, melempar error jika tidak valid
      // decoded = { userId: 123, username: 'john', iat: 1234567890, exp: 1234571490 } — iat = issued at, exp = expiry
    } catch (err) { // catch menangkap error JWT: TokenExpiredError, JsonWebTokenError, dll
      // catch menangkap error JWT: TokenExpiredError, JsonWebTokenError, dll
      // Token invalid (signature salah, expired, dll)
      return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' }); // return + 401 Unauthorized
      // return + 401 Unauthorized
    }

    // STEP 3: Cari user dari database berdasarkan userId di token payload
    const user = await prisma.user.findUnique({ // const membuat variabel tetap; await menunggu database; prisma.user.findUnique...
      // const membuat variabel tetap; await menunggu database; prisma.user.findUnique cari satu record
      where: { id: decoded.userId }, // WHERE id = decoded.userId — menggunakan ID dari payload token yang sudah terv...
      // WHERE id = decoded.userId — menggunakan ID dari payload token yang sudah terverifikasi
      select: { // SELECT: tentukan field mana saja yang dikembalikan (bukan SELECT *)
        // SELECT: tentukan field mana saja yang dikembalikan (bukan SELECT *)
        id: true, // sertakan field id
        // sertakan field id
        name: true, // sertakan field name
        // sertakan field name
        username: true, // sertakan field username
        // sertakan field username
        balance: true, // sertakan field balance
        // sertakan field balance
        isActive: true // sertakan field isActive — untuk cek apakah user diblokir
        // sertakan field isActive — untuk cek apakah user diblokir
      },
    });

    // STEP 4: Validasi user exists dan aktif
    if (!user || !user.isActive) { // if mengecek dua kondisi dengan || (OR); !user berarti tidak ditemukan; !user....
      // if mengecek dua kondisi dengan || (OR); !user berarti tidak ditemukan; !user.isActive berarti user diblokir admin
      return res.status(401).json({ error: 'Token tidak valid atau pengguna tidak aktif' }); // 401 Unauthorized
      // 401 Unauthorized
    }

    // STEP 5: Token valid! Return user data
    res.json({ valid: true, user }); // res.json() mengirim response 200 OK; valid: true memberi tahu client bahwa to...
    // res.json() mengirim response 200 OK; valid: true memberi tahu client bahwa token valid; user (shorthand ES6) mengirim data user
  } catch (error) { // catch menangkap error tak terduga di level terluar
    // catch menangkap error tak terduga di level terluar
    res.status(500).json({ valid: false, error: 'Kesalahan server' }); // 500 = Internal Server Error
    // 500 = Internal Server Error
  }
});

// STEP 6: Export router agar bisa diimport di server.js
module.exports = router; // module.exports adalah cara CommonJS (Node.js) untuk mengekspor nilai dari fil...
// module.exports adalah cara CommonJS (Node.js) untuk mengekspor nilai dari file ini; router yang di-export ini akan di-mount di server.js sebagai app.use('/api/auth', authRoutes)
