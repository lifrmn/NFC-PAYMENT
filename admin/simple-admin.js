// =====================================================================
// ?? SIMPLE ADMIN SERVER - NFC PAYMENT SYSTEM
// =====================================================================
//
// FILE: admin/simple-admin.js
// TIPE: Server-side (Node.js + Express)
// TUJUAN: Web Admin Dashboard untuk monitoring dan kontrol NFC Payment System
//
// FITUR UTAMA:
// -----------------------------------------------------------------------
// 1. ???  WEB DASHBOARD
//    - Real-time monitoring users dan devices
//    - Visual stats: balance, transactions, fraud alerts
//    - Admin controls: top-up, block/unblock users
//
// 2. ?? USER & NFC CARD MANAGEMENT
//    - CRUD operations untuk users
//    - Link/unlink NFC cards ke users
//    - Block/unblock cards dengan 1-card-per-user policy
//    - Bulk top-up untuk multiple users
//
// 3. ?? DEVICE SYNCHRONIZATION
//    - Terima sync data dari Mobile App
//    - Track device online/offline status (5 min timeout)
//    - Queue balance updates untuk push ke devices
//    - Cleanup offline devices otomatis
//
// 4. ?? FRAUD DETECTION MONITORING
//    - Receive fraud alerts dari Backend AI
//    - Visual fraud dashboard dengan statistics
//    - Alert categorization: NORMAL/SUSPICIOUS/ANOMALY
//    - Transaction review workflow
//
// 5. ?? BALANCE MANAGEMENT
//    - Admin top-up dengan password validation
//    - Maximum limit: Rp 500,000 per transaction
//    - Bulk top-up support (multiple users sekaligus)
//    - Balance reset functionality
//
// 6. ?? BACKEND PROXY
//    - Forward requests ke Backend Server (port 4000)
//    - Supports both localhost (local dev) dan ngrok (mobile)
//    - HTTP/HTTPS auto-detection
//    - Connection health monitoring
//
// ARSITEKTUR & DEPLOYMENT:
// -----------------------------------------------------------------------
//
//  +--------------+         +--------------+         +--------------+
//  � Mobile App   �?--------� Ngrok Tunnel �?--------� Backend      �
//  � (Port N/A)   �  HTTPS  � (Public URL) �   HTTP  � (Port 4000)  �
//  +--------------+         +--------------+         +--------------+
//         �                                                  ?
//         �                                                  �
//         �                                                  � HTTP
//         � Device Sync                                      � (localhost)
//         � (POST /api/sync-device)                          �
//         ?                                                  �
//  +------------------------------------------------------------------+
//  �                     ADMIN SERVER (Port 3000)                      �
//  +------------------------------------------------------------------�
//  � - Express.js REST API                                             �
//  � - Web Dashboard (dashboard.html)                                   �
//  � - Device Cache (Map<deviceId, deviceData>)                        �
//  � - Pending Updates Queue (Map<updateKey, balanceUpdate>)           �
//  � - Fraud Alerts Store (Map<alertId, fraudAlert>)                   �
//  +------------------------------------------------------------------+
//         ?
//         � HTTP (localhost)
//         � Browse Dashboard
//         �
//  +--------------+
//  � Web Browser  �
//  � (localhost:  �
//  �  3000)       �
//  +--------------+
//
// SECURITY:
// -----------------------------------------------------------------------
// - Helmet.js security headers
// - CORS enabled (allow mobile app access)
// - API key validation (x-app-key header)
// - User-Agent validation (okhttp = Android app only)
// - Admin password for sensitive operations (top-up, delete)
// - Local network bypass (192.168.x.x, 10.x.x.x)
//
// API ENDPOINTS:
// -----------------------------------------------------------------------
// DEVICE ENDPOINTS:
// - GET  /api/devices           ? List all devices/users
// - POST /api/sync-device       ? Receive sync from mobile
// - POST /api/update-balance    ? Admin top-up balance
//
// FRAUD DETECTION:
// - POST /api/fraud-alert       ? Receive alert from AI
// - GET  /api/fraud-alerts      ? Get all fraud alerts
// - GET  /api/transactions      ? Get all transactions
// - POST /api/clear-fraud-alerts ? Clear all alerts
//
// USER MANAGEMENT:
// - GET    /api/users           ? List all users
// - POST   /api/users           ? Create new user
// - PUT    /api/users/:id       ? Update user data
// - DELETE /api/users/:id       ? Delete user
// - POST   /api/block-user      ? Block user
// - POST   /api/unblock-user    ? Unblock user
// - POST   /api/bulk-topup      ? Bulk top-up multiple users
// - POST   /api/reset-balance   ? Reset user balance to 0
//
// NFC CARD MANAGEMENT:
// - GET    /api/nfc-cards           ? List all cards
// - POST   /api/nfc-cards/register  ? Register new card
// - POST   /api/nfc-cards/link      ? Link card to user
// - POST   /api/nfc-cards/block     ? Block card
// - POST   /api/nfc-cards/topup     ? Top-up card balance
// - DELETE /api/nfc-cards/:cardId   ? Delete card
//
// SYSTEM:
// - GET /api/ping               ? Server status check
// - GET /api/health             ? Health check with stats
// - GET /                       ? Serve dashboard HTML
//
// STARTUP COMMAND:
// -----------------------------------------------------------------------
// $ node admin/simple-admin.js
//
// OUTPUT:
// ?? Simple NFC Payment Admin started!
// ?? Dashboard: http://localhost:3000
//
// ?? Backend Connection:
//    ?? Ngrok URL: https://your-ngrok-url.ngrok-free.dev
//
// DEPENDENCIES:
// -----------------------------------------------------------------------
// - express@4.18.2         ? Web server framework
// - cors                   ? Cross-Origin Resource Sharing
// - helmet                 ? Security headers
// - http/https (built-in)  ? Backend communication
//
// DATA STRUCTURES:
// -----------------------------------------------------------------------
// 1. devices: Map<deviceId, DeviceData>
//    {
//      deviceId: string,
//      deviceName: string,
//      platform: 'android',
//      users: User[],
//      recentTransactions: Transaction[],
//      totalUsers: number,
//      totalBalance: number,
//      lastSync: ISO string,
//      isOnline: boolean,
//      ipAddress: string
//    }
//
// 2. pendingUpdates: Map<updateKey, BalanceUpdate>
//    {
//      deviceId: string,
//      userId: number,
//      newBalance: number,
//      reason: string,
//      timestamp: ISO string
//    }
//
// 3. fraudAlerts: Map<alertId, FraudAlert>
//    {
//      alertId: string,
//      userId: number,
//      transactionId: number,
//      riskScore: number,
//      reasons: string[],
//      timestamp: ISO string,
//      status: 'ANOMALY' | 'SUSPICIOUS' | 'BLOCKED'
//    }
//
// PERFORMANCE:
// -----------------------------------------------------------------------
// - In-memory cache (fast access)
// - 5-minute cleanup interval untuk offline devices
// - Request timeout: 10 detik
// - Max JSON body size: 1MB
// - Auto-cleanup old fraud alerts (optional)
//
// TESTING:
// -----------------------------------------------------------------------
// 1. Test ping endpoint:
//    $ curl http://localhost:3000/api/ping
//
// 2. Test device sync (dengan app key):
//    $ curl -X POST http://localhost:3000/api/sync-device \
//      -H "Content-Type: application/json" \
//      -H "x-app-key: NFC2025SecureApp" \
//      -d '{"device": {"deviceId": "test123"}, "users": []}'
//
// TROUBLESHOOTING:
// -----------------------------------------------------------------------
// - "Backend returned HTML instead of JSON"
//   ? Check ngrok tunnel is running: ngrok http 4000
//   ? Check ngrok URL di BACKEND_URL/NGROK_URL
//
// - "Unauthorized access blocked"
//   ? Add header: x-app-key: NFC2025SecureApp
//   ? Check User-Agent contains "okhttp"
//
// - Device tidak muncul di dashboard
//   ? Check mobile app mengirim sync data
//   ? Check device sync dalam 5 menit terakhir
//
// RELATED FILES:
// -----------------------------------------------------------------------
// - admin/dashboard.html         ? Web UI dashboard (unified: overview + fraud alerts)
// - backend/server.js            ? Main backend server
// - src/utils/apiService.ts      ? Mobile app API client
//
// @version 1.0.0
// @author NFC Payment Team
// @created 2025

// ==================== DEPENDENCIES ====================
const express = require('express'); // Framework web server
// Framework web server
const cors = require('cors'); // Izinkan akses dari domain berbeda (HP ke laptop)
// Izinkan akses dari domain berbeda (HP ke laptop)
const path = require('path'); // Manipulasi path file
// Manipulasi path file
const os = require('os'); // Info sistem operasi (untuk ambil IP)
// Info sistem operasi (untuk ambil IP)
const helmet = require('helmet'); // Security headers untuk proteksi
// Security headers untuk proteksi
const http = require('http'); // HTTP client untuk fetch backend
// HTTP client untuk fetch backend
const https = require('https'); // HTTPS client untuk fetch backend
// HTTPS client untuk fetch backend

// ==================== CONFIGURATION ====================
//
// PORT: 3000
// - Server admin jalan di localhost:3000
// - Dashboard bisa diakses via browser: http://localhost:3000
// - Mobile app tidak langsung connect ke admin server ini
//
// APP_SECRET: 'NFC2025SecureApp'
// - Shared secret key untuk validasi request
// - Harus sama dengan key di mobile app
// - Dikirim via header: x-app-key
//
// ADMIN_PASSWORD: 'admin123'
// - Password untuk operasi sensitive (top-up, delete)
// - Harus dimasukkan di dashboard saat top-up balance
// - Simple authentication (production harus pakai hash)
//
// BACKEND_URL: 'http://localhost:4000'
// - URL backend server untuk local development
// - Admin server dan backend di laptop yang sama ? localhost
// - Port 4000 = backend main server
//
// NGROK_URL: 'https://xxx.ngrok-free.dev'
// - Public URL untuk mobile app access backend
// - Ngrok tunnel: ngrok http 4000
// - Update URL ini sesuai ngrok output
const PORT = 3000; // Port server (3000)
// Port server (3000)
const APP_SECRET = 'NFC2025SecureApp'; // Secret key aplikasi (untuk validasi)
// Secret key aplikasi (untuk validasi)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Password admin untuk top-up saldo
// Password admin untuk top-up saldo

// ==================== BACKEND CONFIGURATION ====================
//
// BACKEND_URL: Backend server untuk local development
// - Admin server dan backend di laptop yang sama ? localhost
// - Port 4000 = backend main server
// - Format: http://hostname:port
//
// NGROK_URL: Public URL untuk mobile app
// - Mobile app connect ke backend via ngrok tunnel
// - Admin server TIDAK pakai ngrok (localhost cukup)
// - Update URL ini setiap kali restart ngrok
// - Cara dapatkan: ngrok http 4000 ? copy URL dari terminal
const BACKEND_URL = 'http://localhost:4000'; // Backend URL (localhost karena sama-sama di laptop)
// Backend URL (localhost karena sama-sama di laptop)
const NGROK_URL = 'https://contrite-unhappily-custodian.ngrok-free.dev'; // URL ngrok untuk mobile app
// URL ngrok untuk mobile app

// ==================== HELPER FUNCTIONS ====================
//
// parseBackendUrl()
// FUNGSI: Parse BACKEND_URL menjadi object hostname, port, protocol
//
// RETURN:
// {
//   hostname: string,  // e.g., 'localhost'
//   port: number,      // e.g., 4000
//   protocol: string   // 'http' or 'https'
// }
//
// CONTOH:
// Input:  'http://localhost:4000'
// Output: { hostname: 'localhost', port: 4000, protocol: 'http' }
//
// FALLBACK:
// Jika URL tidak valid ? return localhost:4000
function parseBackendUrl() { // fungsi helper: mem-parse BACKEND_URL menjadi komponen hostname/port/protocol; dipanggil sebelum setiap HTTP request ke backend
  // fungsi helper: mem-parse BACKEND_URL menjadi komponen hostname/port/protocol; dipanggil sebelum setiap HTTP request ke backend
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const url = new URL(BACKEND_URL); // Parse string URL menjadi objek URL
    // Parse string URL menjadi objek URL
    return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
      // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
      hostname: url.hostname, // Ambil hostname (misal: 'localhost')
      // Ambil hostname (misal: 'localhost')
      port: url.port || (url.protocol === 'https:' ? 443 : 80), // Gunakan port dari URL, fallback ke 443/80
      // Gunakan port dari URL, fallback ke 443/80
      protocol: url.protocol.replace(':', '') // Hapus titik dua di akhir ('http:' ? 'http')
      // Hapus titik dua di akhir ('http:' ? 'http')
    };
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // Fallback ke localhost jika URL tidak valid
    return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
      // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
      hostname: 'localhost', // Default hostname
      // Default hostname
      port: 4000, // Default port backend
      // Default port backend
      protocol: 'http' // Default protocol
      // Default protocol
    };
  }
}

//
// makeHttpRequest(options)
// FUNGSI: Wrapper untuk http/https request ke backend dengan error handling
//
// PARAMETER:
// - options: {
//     hostname: string,      // Backend hostname
//     port: number,          // Backend port
//     path: string,          // API path (e.g., '/api/users')
//     method: string,        // HTTP method (GET, POST, PUT, DELETE)
//     protocol: string,      // 'http' or 'https'
//     headers: object,       // HTTP headers
//     body: object           // Request body (akan di-JSON.stringify)
//   }
//
// RETURN: Promise<any>
// - Resolves dengan parsed JSON response dari backend
// - Rejects dengan Error jika terjadi kesalahan
//
// ERROR HANDLING:
// 1. HTML Response Detection:
//    - Jika backend return HTML (ngrok error page)
//    - Error: "Backend returned HTML instead of JSON"
//
// 2. Empty Response:
//    - Jika response kosong
//    - Error: "Backend returned empty response"
//
// 3. JSON Parse Error:
//    - Jika JSON tidak valid
//    - Error: "Invalid JSON response"
//
// 4. Request Timeout:
//    - Timeout: 10 detik
//    - Error: "Request timeout after 10 seconds"
//
// USAGE EXAMPLE:
// const options = {
//   hostname: 'localhost',
//   port: 4000,
//   path: '/api/users',
//   method: 'GET',
//   protocol: 'http',
//   headers: { 'Content-Type': 'application/json' }
// };
// const data = await makeHttpRequest(options);
function makeHttpRequest(options) { // fungsi wrapper: membungkus http.request() dalam Promise dengan error handling; dipanggil di semua HTTP call ke backend
  // fungsi wrapper: membungkus http.request() dalam Promise dengan error handling; dipanggil di semua HTTP call ke backend
  return new Promise((resolve, reject) => { // membungkus request dalam Promise agar bisa digunakan dengan async/await; mengembalikan data atau melempar error
    // membungkus request dalam Promise agar bisa digunakan dengan async/await; mengembalikan data atau melempar error
    // Determine which client to use based on protocol
    const isHttps = options.protocol === 'https' || options.protocol === 'https:'; // memeriksa apakah koneksi harus menggunakan HTTPS; mendukung URL dengan atau tanpa titik dua
    // memeriksa apakah koneksi harus menggunakan HTTPS; mendukung URL dengan atau tanpa titik dua
    const client = isHttps ? https : http; // memilih modul http atau https berdasarkan protocol; memastikan koneksi sesuai dengan URL backend
    // memilih modul http atau https berdasarkan protocol; memastikan koneksi sesuai dengan URL backend
    
    // Remove protocol and body from options untuk client.request()
    const requestOptions = { ...options }; // menyalin opsi request menggunakan spread operator; menghindari mutasi objek asli
    // menyalin opsi request menggunakan spread operator; menghindari mutasi objek asli
    delete requestOptions.protocol; // menghapus field protocol dari requestOptions; http.request() tidak mengenal field ini
    // menghapus field protocol dari requestOptions; http.request() tidak mengenal field ini
    delete requestOptions.body; // menghapus field body dari requestOptions; body dikirim terpisah via req.write()
    // menghapus field body dari requestOptions; body dikirim terpisah via req.write()
    
    const req = client.request(requestOptions, (response) => { // membuat HTTP request ke backend dengan callback response; memanggil modul http/https native Node.js
      // membuat HTTP request ke backend dengan callback response; memanggil modul http/https native Node.js
      let data = ''; // Buffer untuk menampung potongan data response
      // Buffer untuk menampung potongan data response
      
      response.on('data', (chunk) => { // Event saat potongan data masuk
        // Event saat potongan data masuk
        data += chunk; // Gabungkan potongan ke buffer
        // Gabungkan potongan ke buffer
      });
      
      response.on('end', () => { // Event saat seluruh response sudah diterima
        // Event saat seluruh response sudah diterima
        // Check if response is HTML (ngrok error page)
        if (data.trim().startsWith('<') || data.includes('<!DOCTYPE')) { // Deteksi halaman HTML (bukan JSON)
          // Deteksi halaman HTML (bukan JSON)
          console.error('? Received HTML instead of JSON (ngrok might be down or URL changed)'); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          reject(new Error('Backend returned HTML instead of JSON. Check if ngrok is running and URL is correct.')); // reject Promise: server mengembalikan HTML bukan JSON; biasanya terjadi saat ngrok halaman error
          // reject Promise: server mengembalikan HTML bukan JSON; biasanya terjadi saat ngrok halaman error
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
          // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }

        // Check if response is empty
        if (!data || data.trim().length === 0) { // Response kosong tidak bisa di-parse
          // Response kosong tidak bisa di-parse
          console.error('? Received empty response from backend'); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          reject(new Error('Backend returned empty response')); // reject Promise: response kosong tidak bisa di-parse; backend mungkin mengalami error
          // reject Promise: response kosong tidak bisa di-parse; backend mungkin mengalami error
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
          // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }

        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          const jsonData = JSON.parse(data); // Parse string JSON menjadi objek JavaScript
          // Parse string JSON menjadi objek JavaScript
          resolve(jsonData); // Selesaikan Promise dengan data hasil parse
          // Selesaikan Promise dengan data hasil parse
        } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
          // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
          console.error('? JSON parse error:', parseError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          console.error('? Response data preview:', data.substring(0, 200)); // Tampilkan 200 karakter awal untuk debug
          // Tampilkan 200 karakter awal untuk debug
          reject(new Error(`Invalid JSON response: ${parseError.message}`)); // reject Promise dengan detail error parse; JSON response tidak valid dari backend
          // reject Promise dengan detail error parse; JSON response tidak valid dari backend
        }
      });
    });

    req.on('error', (error) => { // Event saat terjadi error koneksi HTTP
      // Event saat terjadi error koneksi HTTP
      console.error('? HTTP request error:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      reject(error); // Selesaikan Promise dengan error
      // Selesaikan Promise dengan error
    });

    req.setTimeout(10000, () => { // Timeout 10 detik untuk menghindari request yang hang
      // Timeout 10 detik untuk menghindari request yang hang
      req.destroy(); // Hancurkan request yang melewati batas waktu
      // Hancurkan request yang melewati batas waktu
      reject(new Error('Request timeout after 10 seconds')); // reject Promise: request melebihi batas 10 detik; backend tidak merespons
      // reject Promise: request melebihi batas 10 detik; backend tidak merespons
    });

    if (options.body) { // Jika ada body data (POST/PUT/DELETE request)
      // Jika ada body data (POST/PUT/DELETE request)
      const bodyData = JSON.stringify(options.body); // Serialize body ke JSON string
      // Serialize body ke JSON string
      console.log(`?? Writing body to request:`, bodyData); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      req.setHeader('Content-Length', Buffer.byteLength(bodyData)); // Set header Content-Length
      // Set header Content-Length
      req.write(bodyData); // Tulis body ke stream request
      // Tulis body ke stream request
    }
    req.end(); // Akhiri request dan kirim ke server
    // Akhiri request dan kirim ke server
  });
}

//
// getLocalIPAddress()
// FUNGSI: Ambil semua IP address laptop untuk koneksi dari mobile device
//
// RETURN: string[]
// Array IP addresses (IPv4 only, non-internal)
//
// CONTOH OUTPUT:
// ['192.168.137.103', '192.168.1.10']
//
// USAGE:
// - Display di console saat server start
// - Mobile app bisa connect via IP ini (jika same local network)
// - Berguna untuk development tanpa ngrok
//
// FILTERING:
// - Hanya IPv4 (skip IPv6)
// - Skip localhost (127.0.0.1)
// - Hanya external interfaces (Wi-Fi, Ethernet)
function getLocalIPAddress() { // fungsi helper: mendapatkan semua IP address lokal perangkat; dipanggil saat server start untuk menampilkan alamat akses
  // fungsi helper: mendapatkan semua IP address lokal perangkat; dipanggil saat server start untuk menampilkan alamat akses
  const interfaces = os.networkInterfaces(); // Ambil semua network interface
  // Ambil semua network interface
  const ips = []; // Array untuk menyimpan IP
  // Array untuk menyimpan IP
  
  // Loop semua network interface
  for (const name of Object.keys(interfaces)) { // iterasi semua nama network interface (WiFi, Ethernet, dll); untuk mencari IP yang aktif
    // iterasi semua nama network interface (WiFi, Ethernet, dll); untuk mencari IP yang aktif
    for (const iface of interfaces[name]) { // iterasi setiap konfigurasi dalam satu interface; interface bisa punya beberapa IP
      // iterasi setiap konfigurasi dalam satu interface; interface bisa punya beberapa IP
      // Skip localhost dan ambil hanya IPv4
      if (iface.family === 'IPv4' && !iface.internal) { // filter: hanya ambil IPv4 yang bukan loopback; skip IPv6 dan 127.0.0.1
        // filter: hanya ambil IPv4 yang bukan loopback; skip IPv6 dan 127.0.0.1
        ips.push(iface.address); // Tambah IP ke array
        // Tambah IP ke array
      }
    }
  }
  
  return ips; // Return array IP address
  // Return array IP address
}

//
// isValidAppRequest(req)
// FUNGSI: Validasi apakah request dari aplikasi mobile resmi
//
// SECURITY CHECKS:
// 1. App Key Validation:
//    - Check header: x-app-key
//    - Harus sama dengan APP_SECRET ('NFC2025SecureApp')
//    - Mencegah akses dari aplikasi tidak resmi
//
// 2. User Agent Validation:
//    - Check header: user-agent
//    - Harus mengandung 'okhttp' (Android HTTP client)
//    - Mencegah akses dari browser atau tools lain
//
// PARAMETER:
// - req: Express Request object
//
// RETURN: boolean
// - true: Request valid dari aplikasi resmi
// - false: Request tidak valid (akan ditolak dengan 401)
//
// USAGE:
// Di middleware protectAPI() untuk filter request
function isValidAppRequest(req) { // fungsi keamanan: memvalidasi apakah request berasal dari aplikasi mobile resmi; memeriksa x-app-key header
  // fungsi keamanan: memvalidasi apakah request berasal dari aplikasi mobile resmi; memeriksa x-app-key header
  const appKey = req.headers['x-app-key']; // Ambil app key dari header
  // Ambil app key dari header
  const userAgent = req.headers['user-agent']; // Ambil user agent
  // Ambil user agent
  
  // Cek key aplikasi (harus sama dengan APP_SECRET)
  if (appKey !== APP_SECRET) { // memeriksa apakah x-app-key header cocok dengan APP_SECRET; berbeda berarti request bukan dari aplikasi resmi
    // memeriksa apakah x-app-key header cocok dengan APP_SECRET; berbeda berarti request bukan dari aplikasi resmi
    return false; // Tolak jika key salah
    // Tolak jika key salah
  }
  
  // Cek user agent (harus dari okhttp = Android app)
  if (!userAgent || !userAgent.includes('okhttp')) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    return false; // Tolak jika bukan dari Android
    // Tolak jika bukan dari Android
  }
  
  return true; // Lolos validasi
  // Lolos validasi
}

//
// protectAPI(req, res, next)
// MIDDLEWARE: Proteksi API endpoints dari akses tidak resmi
//
// BYPASS RULES (tidak perlu validasi):
// 1. Dashboard HTML (GET /)
//    ? Halaman utama bisa diakses bebas
//
// 2. Static files (CSS, JS, images)
//    ? GET requests non-API
//
// 3. Local Network Access (dari dashboard)
//    ? IP: 127.0.0.1, ::1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
//    ? Admin dashboard di browser bisa call API tanpa app key
//
// VALIDATION RULES (perlu validasi):
// 1. API endpoints dari external sources
//    ? Path: /api/*
//    ? IP: Bukan local network
//    ? Check: isValidAppRequest()
//
// FLOW:
// 1. Check path dan IP
// 2. Jika local network ? BYPASS (allow)
// 3. Jika external + API path ? VALIDATE
// 4. Jika tidak valid ? Response 401 Unauthorized
// 5. Jika valid ? next() (lanjut ke endpoint)
//
// SECURITY:
// - Prevent unauthorized API access
// - Allow dashboard dari browser local
// - Allow mobile app dengan valid app key
function protectAPI(req, res, next) { // middleware keamanan: melindungi semua endpoint API dari akses tidak sah; dipanggil sebelum setiap route handler
  // middleware keamanan: melindungi semua endpoint API dari akses tidak sah; dipanggil sebelum setiap route handler
  // Skip proteksi untuk dashboard HTML (halaman utama)
  if (req.method === 'GET' && req.path === '/') { // skip proteksi untuk halaman dashboard utama; tidak perlu app key untuk melihat dashboard
    // skip proteksi untuk halaman dashboard utama; tidak perlu app key untuk melihat dashboard
    return next(); // Lanjut tanpa validasi
    // Lanjut tanpa validasi
  }
  
  // Skip proteksi untuk file static (CSS, JS, images)
  if (req.method === 'GET' && !req.path.startsWith('/api/')) { // skip proteksi untuk file statis (CSS, JS, HTML); hanya endpoint /api/* yang diproteksi
    // skip proteksi untuk file statis (CSS, JS, HTML); hanya endpoint /api/* yang diproteksi
    return next(); // Lanjut tanpa validasi
    // Lanjut tanpa validasi
  }
  
  // BYPASS PROTEKSI untuk admin endpoints dari localhost/dashboard
  // Allow all local network IPs (10.x.x.x, 192.168.x.x, 172.16.x.x, 169.254.x.x, localhost)
  const ipStr = req.ip || ''; // mengambil IP address dari request; atau string kosong jika tidak ada
  // mengambil IP address dari request; atau string kosong jika tidak ada
  const isLocalNetwork = // variabel boolean: menentukan apakah request berasal dari jaringan lokal (LAN/localhost)
  // variabel boolean: menentukan apakah request berasal dari jaringan lokal (LAN/localhost)
    ipStr.includes('127.0.0.1') || // IPv4 localhost; akses dari komputer yang menjalankan server
    // IPv4 localhost; akses dari komputer yang menjalankan server
    ipStr.includes('::1') || // IPv6 localhost; setara 127.0.0.1 dalam notasi IPv6
    // IPv6 localhost; setara 127.0.0.1 dalam notasi IPv6
    ipStr.includes('192.168.') || // subnet private 192.168.x.x; jaringan Wi-Fi rumah/kantor
    // subnet private 192.168.x.x; jaringan Wi-Fi rumah/kantor
    ipStr.includes('10.') || // subnet private 10.x.x.x; jaringan enterprise/VPN
    // subnet private 10.x.x.x; jaringan enterprise/VPN
    ipStr.includes('172.16.') || // subnet private 172.16.x.x - awal blok IANA private
    // subnet private 172.16.x.x - awal blok IANA private
    ipStr.includes('172.17.') || // subnet private 172.17.x.x - Docker default subnet
    // subnet private 172.17.x.x - Docker default subnet
    ipStr.includes('172.18.') || // subnet private 172.18.x.x
    // subnet private 172.18.x.x
    ipStr.includes('172.19.') || // subnet private 172.19.x.x
    // subnet private 172.19.x.x
    ipStr.includes('172.20.') || // subnet private 172.20.x.x
    // subnet private 172.20.x.x
    ipStr.includes('172.21.') || // subnet private 172.21.x.x
    // subnet private 172.21.x.x
    ipStr.includes('172.22.') || // subnet private 172.22.x.x
    // subnet private 172.22.x.x
    ipStr.includes('172.23.') || // subnet private 172.23.x.x
    // subnet private 172.23.x.x
    ipStr.includes('172.24.') || // subnet private 172.24.x.x
    // subnet private 172.24.x.x
    ipStr.includes('172.25.') || // subnet private 172.25.x.x
    // subnet private 172.25.x.x
    ipStr.includes('172.26.') || // subnet private 172.26.x.x
    // subnet private 172.26.x.x
    ipStr.includes('172.27.') || // subnet private 172.27.x.x
    // subnet private 172.27.x.x
    ipStr.includes('172.28.') || // subnet private 172.28.x.x
    // subnet private 172.28.x.x
    ipStr.includes('172.29.') || // subnet private 172.29.x.x
    // subnet private 172.29.x.x
    ipStr.includes('172.30.') || // subnet private 172.30.x.x
    // subnet private 172.30.x.x
    ipStr.includes('172.31.') || // subnet private 172.31.x.x - akhir blok IANA private
    // subnet private 172.31.x.x - akhir blok IANA private
    ipStr.includes('169.254.'); // Link-local address
    // Link-local address
    
  if (req.path.startsWith('/api/') && isLocalNetwork) { // akses dari jaringan lokal ke endpoint API diizinkan; admin dashboard tidak perlu app key
    // akses dari jaringan lokal ke endpoint API diizinkan; admin dashboard tidak perlu app key
    console.log(`? Admin dashboard access allowed from ${req.ip} to ${req.path}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    return next(); // Lanjut tanpa validasi untuk admin dashboard
    // Lanjut tanpa validasi untuk admin dashboard
  }
  
  // Validasi untuk semua API endpoints dari external sources (/api/*)
  if (req.path.startsWith('/api/')) { // untuk akses dari luar LAN ke endpoint API; wajib validasi app key
    // untuk akses dari luar LAN ke endpoint API; wajib validasi app key
    if (!isValidAppRequest(req)) { // Cek apakah request valid
      // Cek apakah request valid
      console.log(`?? Unauthorized access blocked from ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return res.status(401).json({ error: 'Akses ditolak - Bukan aplikasi resmi' }); // tolak request dengan 401 Unauthorized jika app key tidak valid; bukan dari aplikasi mobile resmi
      // tolak request dengan 401 Unauthorized jika app key tidak valid; bukan dari aplikasi mobile resmi
    }
  }
  
  console.log(`? Valid app request from ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
  // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
  next(); // Lanjut ke endpoint
  // Lanjut ke endpoint
}

// =====================================================================
// ??? CLASS: SimpleNFCAdmin
// =====================================================================
//
// Main class untuk Admin Server
//
// RESPONSIBILITIES:
// - Setup Express server (routes, middleware, security)
// - Manage device cache dan sync data
// - Queue balance updates untuk push ke devices
// - Handle fraud alerts dari backend AI
// - Proxy requests ke backend server
// - Serve web dashboard HTML
//
// PROPERTIES:
// - app: Express application instance
// - devices: Map<deviceId, DeviceData> ? Cache device data
// - pendingUpdates: Map<updateKey, BalanceUpdate> ? Queue updates
// - deviceLastSeen: Map<deviceId, Date> ? Track last sync time
// - fraudAlerts: Map<alertId, FraudAlert> ? Store fraud alerts
// - fraudStats: Object ? Statistics fraud detection
//
// METHODS:
// Setup:
// - constructor()           ? Initialize server
// - setupExpress()          ? Setup routes & middleware
// - start()                 ? Start listening on port
//
// Device Management:
// - syncDevice()            ? Receive sync from mobile (POST /api/sync-device)
// - getDevices()            ? List all devices/users (GET /api/devices)
// - getPendingUpdates()     ? Get queued updates for device
// - clearPendingUpdates()   ? Clear updates after sent
// - startCleanupTimer()     ? Auto-remove offline devices
//
// Balance Management:
// - updateBalanceSecure()   ? Admin top-up with password (POST /api/update-balance)
// - updateBalance()         ? Legacy method (will be removed)
//
// Fraud Detection:
// - handleFraudAlert()      ? Receive alert from AI (POST /api/fraud-alert)
// - getFraudAlerts()        ? List all alerts (GET /api/fraud-alerts)
// - clearFraudAlertsEndpoint() ? Clear all alerts (POST /api/clear-fraud-alerts)
// - getAllTransactions()    ? Get transactions (GET /api/transactions)
//
// User Management:
// - getUsersEndpoint()      ? List users (GET /api/users)
// - createUserEndpoint()    ? Create user (POST /api/users)
// - updateUserEndpoint()    ? Update user (PUT /api/users/:id)
// - deleteUserEndpoint()    ? Delete user (DELETE /api/users/:id)
// - blockUserEndpoint()     ? Block user (POST /api/block-user)
// - unblockUserEndpoint()   ? Unblock user (POST /api/unblock-user)
// - bulkTopupEndpoint()     ? Bulk top-up (POST /api/bulk-topup)
// - resetBalanceEndpoint()  ? Reset balance (POST /api/reset-balance)
//
// NFC Card Management:
// - getNFCCards()           ? List cards (GET /api/nfc-cards)
// - registerNFCCard()       ? Register card (POST /api/nfc-cards/register)
// - linkNFCCard()           ? Link to user (POST /api/nfc-cards/link)
// - blockNFCCard()          ? Block card (POST /api/nfc-cards/block)
// - topupNFCCard()          ? Top-up card (POST /api/nfc-cards/topup)
// - deleteNFCCard()         ? Delete card (DELETE /api/nfc-cards/:cardId)
class SimpleNFCAdmin { // class utama admin server: mengelola seluruh fungsionalitas server NFC Payment Admin
  // class utama admin server: mengelola seluruh fungsionalitas server NFC Payment Admin
  //
  // CONSTRUCTOR
  // Initialize admin server dengan semua dependencies
  //
  // SETUP SEQUENCE:
  // 1. Create Express app instance
  // 2. Initialize data stores (Maps)
  // 3. Setup Express (routes, middleware, security)
  // 4. Start cleanup timer (hapus offline devices)
  //
  // DATA STORES:
  // - devices: Map<deviceId, DeviceData>
  //   Contoh deviceId: "android_1234567890"
  //
  // - pendingUpdates: Map<updateKey, BalanceUpdate>
  //   Contoh updateKey: "android_123_userId456"
  //
  // - deviceLastSeen: Map<deviceId, Date>
  //   Track last sync time untuk detect offline
  //
  // - fraudAlerts: Map<alertId, FraudAlert>
  //   Contoh alertId: "alert_1672531200000_userId123"
  //
  // - fraudStats: {
  //     totalAlerts: number,
  //     blockedTransactions: number,
  //     reviewTransactions: number,
  //     lastAlert: Date | null
  //   }
  constructor() { // constructor: inisialisasi semua data store dan setup server saat instance dibuat
    // constructor: inisialisasi semua data store dan setup server saat instance dibuat
    this.app = express(); // Inisialisasi Express server
    // Inisialisasi Express server
    this.devices = new Map(); // Menyimpan data semua device (key: deviceId)
    // Menyimpan data semua device (key: deviceId)
    this.pendingUpdates = new Map(); // Queue update balance yang belum terkirim
    // Queue update balance yang belum terkirim
    this.deviceLastSeen = new Map(); // Track waktu terakhir device sync
    // Track waktu terakhir device sync
    this.fraudAlerts = new Map(); // Menyimpan semua fraud alerts dari AI
    // Menyimpan semua fraud alerts dari AI
    this.fraudStats = { // Statistik fraud detection
      // Statistik fraud detection
      totalAlerts: 0, // Total alert yang masuk
      // Total alert yang masuk
      blockedTransactions: 0, // Transaksi yang diblokir
      // Transaksi yang diblokir
      reviewTransactions: 0, // Transaksi yang perlu review
      // Transaksi yang perlu review
      lastAlert: null // Waktu alert terakhir
      // Waktu alert terakhir
    };
    this.setupExpress(); // Setup routes dan middleware
    // Setup routes dan middleware
    this.startCleanupTimer(); // Start timer untuk hapus device offline
    // Start timer untuk hapus device offline
  }

  //
  // setupExpress()
  // Setup Express server dengan routes, middleware, dan security
  //
  // MIDDLEWARE CHAIN (urutan penting):
  // 1. Helmet ? Security headers
  // 2. CORS ? Allow mobile app access
  // 3. express.json() ? Parse JSON body (max 1MB)
  // 4. protectAPI ? Validate app key untuk API endpoints
  // 5. Logging middleware ? Log semua requests
  // 6. express.static() ? Serve HTML/CSS/JS files
  // 7. Routes ? API endpoints
  //
  // SECURITY SETUP:
  // - Helmet.js: HTTP security headers
  //   * XSS protection
  //   * MIME type sniffing prevention
  //   * CSP disabled untuk dashboard
  //
  // - CORS:
  //   * Allow all origins (mobile app)
  //   * Methods: GET, POST
  //   * Headers: Content-Type, x-app-key, user-agent
  //
  // ROUTES SETUP:
  // 19 API endpoints + 2 system endpoints + 1 dashboard route
  // Total: 22 routes
  //
  // ENDPOINT CATEGORIES:
  // - Device Management: 3 endpoints
  // - Fraud Detection: 4 endpoints
  // - User Management: 9 endpoints
  // - NFC Card Management: 6 endpoints
  // - System: 2 endpoints (ping, health)
  // - Dashboard: 1 endpoint (/) ? HTML
  setupExpress() { // method setup: mengkonfigurasi semua middleware dan route handler untuk Express server
    // method setup: mengkonfigurasi semua middleware dan route handler untuk Express server
    // Security headers dengan Helmet (proteksi dari serangan web)
    this.app.use(helmet({ // helmet: middleware keamanan yang menambahkan HTTP security headers; mencegah serangan web umum
      // helmet: middleware keamanan yang menambahkan HTTP security headers; mencegah serangan web umum
      contentSecurityPolicy: false, // Dimatikan agar dashboard jalan
      // Dimatikan agar dashboard jalan
      crossOriginEmbedderPolicy: false // dinonaktifkan agar dashboard HTML bisa memuat resource eksternal
      // dinonaktifkan agar dashboard HTML bisa memuat resource eksternal
    }));
    
    // CORS: Izinkan akses dari semua origin (HP bisa akses)
    this.app.use(cors({ // cors middleware: mengizinkan akses lintas domain/origin; diperlukan agar mobile app bisa akses API
      // cors middleware: mengizinkan akses lintas domain/origin; diperlukan agar mobile app bisa akses API
      origin: '*', // Semua origin boleh (diperlukan untuk mobile app)
      // Semua origin boleh (diperlukan untuk mobile app)
      methods: ['GET', 'POST', 'PUT', 'DELETE'], // Method yang diizinkan
      // Method yang diizinkan
      allowedHeaders: ['Content-Type', 'x-app-key', 'user-agent'] // Header yang diizinkan
      // Header yang diizinkan
    }));
    
    this.app.use(express.json({ limit: '1mb' })); // Parse JSON body (max 1MB)
    // Parse JSON body (max 1MB)
    
    // Middleware keamanan: Validasi app key untuk API
    this.app.use(protectAPI); // daftarkan middleware protectAPI sebelum semua route handler; memfilter request masuk
    // daftarkan middleware protectAPI sebelum semua route handler; memfilter request masuk
    
    // Middleware logging: Catat semua request yang masuk
    this.app.use((req, res, next) => { // custom middleware logging: mencatat setiap request yang masuk ke console untuk monitoring
      // custom middleware logging: mencatat setiap request yang masuk ke console untuk monitoring
      console.log(`?? ${req.method} ${req.path} from ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      next(); // Lanjut ke route handler
      // Lanjut ke route handler
    });
    
    // Serve file static (HTML, CSS, JS dashboard)
    this.app.use(express.static(__dirname)); // serve file statis dari direktori yang sama; untuk CSS, JS, HTML dashboard
    // serve file statis dari direktori yang sama; untuk CSS, JS, HTML dashboard
    
    // ==================== ROUTES ====================
    // Route utama: Tampilkan dashboard HTML (unified dashboard dengan tab navigation)
    this.app.get('/', (req, res) => { // route GET /: menampilkan halaman utama dashboard HTML ke browser admin
      // route GET /: menampilkan halaman utama dashboard HTML ke browser admin
      res.sendFile(path.join(__dirname, 'dashboard.html')); // mengirim file dashboard.html ke browser; path.join memastikan path benar di semua OS
      // mengirim file dashboard.html ke browser; path.join memastikan path benar di semua OS
    });
    
    // ==================== API ENDPOINTS ====================
    // (Sudah diproteksi oleh middleware protectAPI)
    
    // Device endpoints
    this.app.get('/api/devices', this.getDevices.bind(this)); // Get semua device
    // Get semua device
    this.app.post('/api/sync-device', this.syncDevice.bind(this)); // Sync data dari HP
    // Sync data dari HP
    this.app.post('/api/update-balance', this.updateBalanceSecure.bind(this)); // Top-up saldo
    // Top-up saldo
    
    // Fraud detection endpoints
    this.app.post('/api/fraud-alert', this.handleFraudAlert.bind(this)); // Terima fraud alert dari AI
    // Terima fraud alert dari AI
    this.app.get('/api/fraud-alerts', this.getFraudAlerts.bind(this)); // Get fraud alerts
    // Get fraud alerts
    this.app.get('/api/transactions', this.getAllTransactions.bind(this)); // Get semua transaksi
    // Get semua transaksi
    
    // User management endpoints
    this.app.get('/api/users', this.getUsersEndpoint.bind(this)); // Get semua user
    // Get semua user
    this.app.post('/api/users', this.createUserEndpoint.bind(this)); // Create user baru
    // Create user baru
    this.app.put('/api/users/:id', this.updateUserEndpoint.bind(this)); // Update user
    // Update user
    this.app.delete('/api/users/:id', this.deleteUserEndpoint.bind(this)); // Delete user
    // Delete user
    
    // Admin action endpoints
    this.app.post('/api/block-user', this.blockUserEndpoint.bind(this)); // Block user
    // Block user
    this.app.post('/api/unblock-user', this.unblockUserEndpoint.bind(this)); // Unblock user
    // Unblock user
    this.app.post('/api/bulk-topup', this.bulkTopupEndpoint.bind(this)); // Bulk top-up
    // Bulk top-up
    this.app.post('/api/reset-balance', this.resetBalanceEndpoint.bind(this)); // Reset user balance
    // Reset user balance
    this.app.post('/api/clear-fraud-alerts', this.clearFraudAlertsEndpoint.bind(this)); // Clear alerts
    // Clear alerts
    
    // NFC Card management endpoints
    this.app.get('/api/nfc-cards', this.getNFCCards.bind(this)); // Get all NFC cards
    // Get all NFC cards
    this.app.post('/api/nfc-cards/register', this.registerNFCCard.bind(this)); // Register new card
    // Register new card
    this.app.post('/api/nfc-cards/link', this.linkNFCCard.bind(this)); // Link card to user
    // Link card to user
    this.app.post('/api/nfc-cards/block', this.blockNFCCard.bind(this)); // Block card
    // Block card
    this.app.post('/api/nfc-cards/topup', this.topupNFCCard.bind(this)); // Topup card balance
    // Topup card balance
    this.app.delete('/api/nfc-cards/:cardId', this.deleteNFCCard.bind(this)); // Delete card
    // Delete card
    
    // Ping endpoint (penting untuk APK agar bisa deteksi server)
    this.app.get('/api/ping', (req, res) => { // route GET /api/ping: endpoint health check yang digunakan APK untuk mendeteksi server aktif
      // route GET /api/ping: endpoint health check yang digunakan APK untuk mendeteksi server aktif
      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        status: 'ok', // Status server
        // Status server
        timestamp: new Date().toISOString(), // Waktu sekarang
        // Waktu sekarang
        server: 'NFC Payment Admin Server', // Nama server
        // Nama server
        version: '1.0.0', // Versi server
        // Versi server
        uptime: process.uptime() // Lama server sudah jalan (dalam detik)
        // Lama server sudah jalan (dalam detik)
      });
    });
    
    // Health check endpoint (untuk cek kesehatan server)
    this.app.get('/api/health', (req, res) => { // route GET /api/health: endpoint lengkap cek kesehatan server dengan statistik perangkat
      // route GET /api/health: endpoint lengkap cek kesehatan server dengan statistik perangkat
      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        status: 'OK', // Status server
        // Status server
        timestamp: new Date().toISOString(), // Waktu sekarang
        // Waktu sekarang
        devices: this.devices.size, // Jumlah device terkoneksi
        // Jumlah device terkoneksi
        pendingUpdates: this.pendingUpdates.size, // Jumlah update balance pending
        // Jumlah update balance pending
        fraudAlerts: this.fraudAlerts.size, // Jumlah fraud alerts
        // Jumlah fraud alerts
        fraudStats: this.fraudStats // Statistik fraud detection
        // Statistik fraud detection
      });
    });
  }

  //
  // syncDevice(req, res)
  // ENDPOINT: POST /api/sync-device
  // FUNGSI: Terima data sync dari Mobile App
  //
  // REQUEST BODY:
  // {
  //   device: {
  //     deviceId: string,      // Unique device ID
  //     deviceName: string,    // Device name (optional)
  //     platform: string       // 'android' or 'ios'
  //   },
  //   users: User[],           // Array semua users di device
  //   recentTransactions: Transaction[],  // Transaksi terbaru
  //   stats: {
  //     totalUsers: number,
  //     totalBalance: number
  //   }
  // }
  //
  // FLOW:
  // 1. Validasi deviceId ada
  // 2. Simpan data device ke Map (update or create)
  // 3. Update deviceLastSeen untuk tracking online status
  // 4. Check pending updates (balance top-up dari admin)
  // 5. Response dengan success + kirim pending updates
  // 6. Clear pending updates setelah sent
  //
  // RESPONSE:
  // {
  //   success: true,
  //   message: 'Device synced successfully',
  //   balanceUpdates: BalanceUpdate[],  // Updates to apply
  //   deviceId: string,
  //   timestamp: ISO string
  // }
  //
  // DEVICE DATA STORED:
  // - deviceId, deviceName, platform
  // - users array (full user data)
  // - recentTransactions array
  // - stats (totalUsers, totalBalance)
  // - lastSync (ISO string), lastSyncAt (Date object)
  // - isOnline (boolean)
  // - ipAddress (untuk tracking)
  //
  // USE CASE:
  // Mobile app call endpoint ini setiap:
  // - App startup
  // - Manual refresh (pull-to-refresh)
  // - After transaction completed
  // - Periodic background sync (every 5 min)
  async syncDevice(req, res) { // method async: endpoint POST /api/sync-device untuk menerima data sync dari aplikasi mobile Android
    // method async: endpoint POST /api/sync-device untuk menerima data sync dari aplikasi mobile Android
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { device, users, recentTransactions, stats } = req.body; // Ambil data dari request
      // Ambil data dari request
      
      // Validasi: deviceId wajib ada
      if (!device || !device.deviceId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Device ID is required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      const now = new Date(); // Waktu sekarang
      // Waktu sekarang
      
      // Simpan data device ke Map (deviceId sebagai key)
      this.devices.set(device.deviceId, { // menyimpan data device ke Map cache; Map.set() mengganti data lama jika deviceId sudah ada
        // menyimpan data device ke Map cache; Map.set() mengganti data lama jika deviceId sudah ada
        deviceId: device.deviceId, // ID unik device (dari HP)
        // ID unik device (dari HP)
        deviceName: device.deviceName || `Android Device ${device.deviceId.slice(-6)}`, // Nama device
        // Nama device
        platform: device.platform || 'android', // Platform (android/ios)
        // Platform (android/ios)
        users: users || [], // Array semua user di device ini
        // Array semua user di device ini
        recentTransactions: recentTransactions || [], // Transaksi terbaru
        // Transaksi terbaru
        stats: stats || {}, // Statistik (total user, balance, dll)
        // Statistik (total user, balance, dll)
        totalUsers: stats?.totalUsers || 0, // Total user
        // Total user
        totalBalance: stats?.totalBalance || 0, // Total saldo semua user
        // Total saldo semua user
        totalTransactions: recentTransactions?.length || 0, // Total transaksi
        // Total transaksi
        lastSync: now.toISOString(), // Waktu sync terakhir (string)
        // Waktu sync terakhir (string)
        lastSyncAt: now, // Waktu sync terakhir (Date object)
        // Waktu sync terakhir (Date object)
        isOnline: true, // Status online
        // Status online
        ipAddress: req.ip || req.connection.remoteAddress // IP address HP
        // IP address HP
      });

      // Update waktu terakhir device terlihat
      this.deviceLastSeen.set(device.deviceId, now); // mencatat waktu terakhir device melakukan sync; digunakan untuk mendeteksi device offline
      // mencatat waktu terakhir device melakukan sync; digunakan untuk mendeteksi device offline

      console.log(`?? Device sync: ${device.deviceId.slice(-8)} | Users: ${stats?.totalUsers || 0} | Balance: Rp ${(stats?.totalBalance || 0).toLocaleString('id-ID')} | IP: ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      // Cek apakah ada update balance yang menunggu (pending)
      const pendingUpdates = this.getPendingUpdates(device.deviceId); // mengambil antrian update balance yang belum dikirim ke device ini
      // mengambil antrian update balance yang belum dikirim ke device ini
      
      // Kirim response ke HP dengan info sync berhasil
      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        success: true, // Status berhasil
        // Status berhasil
        message: 'Device synced successfully', // Pesan sukses
        // Pesan sukses
        balanceUpdates: pendingUpdates, // Kirim update balance (jika ada)
        // Kirim update balance (jika ada)
        deviceId: device.deviceId, // Echo deviceId
        // Echo deviceId
        timestamp: now.toISOString() // Timestamp sync
        // Timestamp sync
      });

      // Hapus pending updates setelah dikirim ke HP
      this.clearPendingUpdates(device.deviceId); // menghapus pending updates setelah berhasil dikirim ke device; mencegah duplikasi update
      // menghapus pending updates setelah berhasil dikirim ke device; mencegah duplikasi update
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Sync error:', error); // Log error
      // Log error
      res.status(500).json({ error: error.message }); // Kirim error response
      // Kirim error response
    }
  }

  //
  // getDevices(req, res)
  // ENDPOINT: GET /api/devices
  // FUNGSI: List all devices/users untuk dashboard monitoring
  //
  // STRATEGY (2 SOURCES):
  // 1. PRIMARY SOURCE: Backend server
  //    - Call GET /api/debug/users
  //    - Transform user data ? device format
  //    - Setiap user = 1 "device" (for dashboard display)
  //
  // 2. FALLBACK SOURCE: Local cache
  //    - Jika backend error ? use this.devices Map
  //    - Data dari mobile app sync (syncDevice)
  //    - Check online status (last sync < 5 min)
  //
  // RESPONSE FORMAT:
  // [
  //   {
  //     deviceId: string,
  //     deviceName: string,        // username
  //     platform: 'android',
  //     totalUsers: 1,             // Always 1 (per user)
  //     totalBalance: number,
  //     totalTransactions: number,
  //     lastSync: ISO string,
  //     isOnline: boolean,
  //     ipAddress: string,
  //     users: User[]              // Full user data
  //   },
 // ]
  // ]
  //
  // ONLINE STATUS:
  // - Device online jika sync dalam 5 menit terakhir
  // - Formula: (now - lastSyncAt) < 300000 ms
  //
  // USE CASE:
  // Dashboard call endpoint ini untuk:
  // - Display list users
  // - Monitor online/offline status
  // - Show total balance per user
  // - Admin select user for top-up
  async getDevices(req, res) { // method async: endpoint GET /api/devices untuk menampilkan daftar perangkat/user di dashboard
    // method async: endpoint GET /api/devices untuk menampilkan daftar perangkat/user di dashboard
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // AMBIL DATA USER DARI BACKEND (hitung user unik saja)
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // mem-parse URL backend menjadi komponen untuk HTTP request
        // mem-parse URL backend menjadi komponen untuk HTTP request
        const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          hostname: backendConfig.hostname, // hostname tujuan request; bisa localhost atau domain ngrok
          // hostname tujuan request; bisa localhost atau domain ngrok
          port: backendConfig.port, // port backend; default 4000 untuk development lokal
          // port backend; default 4000 untuk development lokal
          path: '/api/debug/users', // Endpoint user backend
          // Endpoint user backend
          method: 'GET', // method 'GET': HTTP method untuk mengambil data; tidak mengubah state server; bisa di-cache oleh browser
          // method 'GET': HTTP method untuk mengambil data; tidak mengubah state server; bisa di-cache oleh browser
          headers: { // HTTP headers yang dikirim bersama request ke backend
            // HTTP headers yang dikirim bersama request ke backend
            'Content-Type': 'application/json', // menetapkan format body sebagai JSON; backend akan parse sebagai JSON
            // menetapkan format body sebagai JSON; backend akan parse sebagai JSON
            'x-app-key': 'NFC2025SecureApp', // header autentikasi app key; diverifikasi oleh middleware backend
            // header autentikasi app key; diverifikasi oleh middleware backend
            'ngrok-skip-browser-warning': 'true' // melewati halaman peringatan ngrok saat mengakses backend via ngrok URL
            // melewati halaman peringatan ngrok saat mengakses backend via ngrok URL
          }
        };

        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih client http/https
          // Pilih client http/https
          const req = client.request(options, (response) => { // membuat HTTP request ke backend dengan callback untuk menangani response
            // membuat HTTP request ke backend dengan callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk data
            // Buffer untuk menampung chunk data
            
            response.on('data', (chunk) => { // Event tiap ada potongan data masuk
              // Event tiap ada potongan data masuk
              data += chunk; // Tambahkan chunk ke buffer
              // Tambahkan chunk ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai diterima
              // Event saat response selesai diterima
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON string menjadi objek
                // Parse JSON string menjadi objek
                resolve(jsonData); // Selesaikan Promise dengan data hasil parse
                // Selesaikan Promise dengan data hasil parse
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event saat terjadi error koneksi
            // Event saat terjadi error koneksi
            reject(error); // Reject Promise dengan error koneksi
            // Reject Promise dengan error koneksi
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            // Timeout 10 detik
            req.destroy(); // Batalkan request yang melebihi batas waktu
            // Batalkan request yang melebihi batas waktu
            reject(new Error('Timeout')); // Reject dengan error timeout
            // Reject dengan error timeout
          });
          
          req.end(); // Kirim request ke backend
          // Kirim request ke backend
        });
        
        if (backendData && backendData.users) { // memeriksa apakah backend mengembalikan data users yang valid sebelum diproses
          // memeriksa apakah backend mengembalikan data users yang valid sebelum diproses
          // Transform user data to dashboard format (user = device)
          const uniqueUsers = new Map(); // Map untuk menyimpan user unik berdasarkan username; mencegah duplikasi
          // Map untuk menyimpan user unik berdasarkan username; mencegah duplikasi
          
          backendData.users.forEach(user => { // iterasi semua user dari backend; forEach() memanggil callback untuk setiap elemen
            // iterasi semua user dari backend; forEach() memanggil callback untuk setiap elemen
            const userKey = user.username || user.name || `user_${user.id}`; // kunci unik user: prioritas username, lalu nama, lalu ID sebagai fallback
            // kunci unik user: prioritas username, lalu nama, lalu ID sebagai fallback
            if (!uniqueUsers.has(userKey)) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
              // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
              uniqueUsers.set(userKey, { // menyimpan user ke Map dengan userKey; otomatis deduplikasi berdasarkan key
                // menyimpan user ke Map dengan userKey; otomatis deduplikasi berdasarkan key
                deviceId: user.deviceId || `user_${user.id}`, // ID device: dari data user atau generate dari user ID
                // ID device: dari data user atau generate dari user ID
                deviceName: userKey, // nama yang ditampilkan di dashboard; sama dengan userKey
                // nama yang ditampilkan di dashboard; sama dengan userKey
                isOnline: true, // tandai semua user dari backend sebagai online; karena data fresh dari database
                // tandai semua user dari backend sebagai online; karena data fresh dari database
                lastSeen: user.updatedAt || user.createdAt, // waktu terakhir aktif: preferensi updatedAt, fallback ke createdAt
                // waktu terakhir aktif: preferensi updatedAt, fallback ke createdAt
                totalUsers: 1, // Setiap user = 1 user
                // Setiap user = 1 user
                totalBalance: user.balance || 0, // saldo user; || 0 sebagai fallback jika field tidak ada
                // saldo user; || 0 sebagai fallback jika field tidak ada
                totalTransactions: 0, // Reset karena tidak ada data transaksi
                // Reset karena tidak ada data transaksi
                ipAddress: '192.168.137.51', // IP address default; nilai hardcoded untuk tampilan dashboard
                // IP address default; nilai hardcoded untuk tampilan dashboard
                platform: 'android' // platform perangkat; semua user diasumsikan menggunakan Android
                // platform perangkat; semua user diasumsikan menggunakan Android
              });
            }
          });
          
          const devices = Array.from(uniqueUsers.values()); // konversi Map ke Array; Array.from().values() mengambil semua value dari Map
          // konversi Map ke Array; Array.from().values() mengambil semua value dari Map
          console.log(`?? API call: /api/devices - Returning ${devices.length} unique users from backend`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          res.json(devices); // mengirim array devices ke dashboard; res.json() otomatis set Content-Type application/json
          // mengirim array devices ke dashboard; res.json() otomatis set Content-Type application/json
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
          // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend users error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      }
      
      // FALLBACK: Use local device cache
      const now = new Date(); // Waktu sekarang
      // Waktu sekarang
      // Convert Map ke Array dan tambah status online
      const devices = Array.from(this.devices.values()).map(device => { // fallback: konversi device cache ke Array dan tambahkan status online/offline
        // fallback: konversi device cache ke Array dan tambahkan status online/offline
        // Device online jika sync dalam 5 menit terakhir
        const isOnline = (now - new Date(device.lastSyncAt)) < 300000; // 5 menit = 300000 ms
        // 5 menit = 300000 ms
        
        // Return object device dengan semua info
        return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
          // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
          deviceId: device.deviceId, // ID device
          // ID device
          deviceName: device.deviceName, // Nama device
          // Nama device
          platform: device.platform, // Platform (android)
          // Platform (android)
          totalUsers: device.totalUsers || 0, // Total user
          // Total user
          totalBalance: device.totalBalance || 0, // Total saldo
          // Total saldo
          totalTransactions: device.totalTransactions || 0, // Total transaksi
          // Total transaksi
          lastSync: device.lastSync, // Waktu sync (string)
          // Waktu sync (string)
          lastSyncAt: device.lastSyncAt, // Waktu sync (Date)
          // Waktu sync (Date)
          isOnline: isOnline, // Status online/offline
          // Status online/offline
          ipAddress: device.ipAddress, // IP address HP
          // IP address HP
          users: device.users || [] // Array user di device
          // Array user di device
        };
      });

      console.log(`?? API call: /api/devices (fallback) - Returning ${devices.length} devices from cache`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      res.json(devices); // Kirim array devices ke dashboard
      // Kirim array devices ke dashboard
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get devices error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: error.message }); // mengirim response error 500 dengan pesan asli dari Error object untuk debugging
      // mengirim response error 500 dengan pesan asli dari Error object untuk debugging
    }
  }

  //
  // updateBalanceSecure(req, res)
  // ENDPOINT: POST /api/update-balance
  // FUNGSI: Admin top-up balance user dengan password protection
  //
  // REQUEST BODY:
  // {
  //   deviceId: string,        // Target device ID
  //   amount: number,          // Jumlah top-up (Rupiah)
  //   adminPassword: string    // Password admin ('admin123')
  // }
  //
  // VALIDATION CHECKS:
  // 1. Admin Password:
  //    - Must match ADMIN_PASSWORD constant
  //    - Log unauthorized attempts dengan IP address
  //    - Response: 401 jika password salah
  //
  // 2. Required Fields:
  //    - deviceId must exist
  //    - amount must be > 0
  //    - Response: 400 jika tidak valid
  //
  // 3. Maximum Limit:
  //    - Max Rp 500,000 per transaction
  //    - Anti money laundering & fraud prevention
  //    - Response: 400 jika melebihi limit
  //
  // 4. Device Existence:
  //    - Device must exist in cache (dari sync)
  //    - Must have users array
  //    - Response: 404 jika device tidak ditemukan
  //
  // FLOW:
  // 1. Validate password, fields, dan limits
  // 2. Find device in cache
  // 3. For each user in device:
  //    a. Create update key: "{deviceId}_{userId}"
  //    b. Add to pendingUpdates Map:
  //       - userId, deviceId
  //       - newBalance = currentBalance + amount
  //       - reason = "Admin top-up: +{amount}"
  //       - timestamp
  // 4. Wait for next sync dari mobile app
  // 5. Mobile app receive updates dan apply
  //
  // RESPONSE:
  // {
  //   success: true,
  //   message: 'Berhasil menambah saldo Rp 100,000 untuk 5 users',
  //   usersUpdated: 5
  // }
  //
  // SECURITY:
  // - Password validation (plain text - production harus bcrypt)
  // - Log all attempts dengan IP
  // - Maximum limit enforcement
  // - Client IP tracking
  //
  // USE CASE:
  // Admin dashboard:
  // 1. Select device/user
  // 2. Input amount (e.g., 100000)
  // 3. Input admin password
  // 4. Submit top-up
  // 5. Mobile app sync ? receive update ? apply balance
  async updateBalanceSecure(req, res) { // method async: endpoint POST /api/update-balance untuk admin top-up saldo dengan proteksi password
    // method async: endpoint POST /api/update-balance untuk admin top-up saldo dengan proteksi password
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { deviceId, amount, adminPassword } = req.body; // Ambil data dari request
      // Ambil data dari request
      const clientIP = req.ip || req.connection.remoteAddress; // IP address admin
      // IP address admin
      
      // Validasi password admin (keamanan sederhana)
      if (adminPassword !== ADMIN_PASSWORD) { // memeriksa apakah password admin cocok; mencegah top-up tidak sah
        // memeriksa apakah password admin cocok; mencegah top-up tidak sah
        console.log(`?? Wrong admin password from ${clientIP}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(401).json({ error: 'Password admin salah!' }); // tolak request 401 jika password admin tidak valid; mencegah unauthorized balance manipulation
        // tolak request 401 jika password admin tidak valid; mencegah unauthorized balance manipulation
      }
      
      // Validasi deviceId dan amount harus ada dan valid
      if (!deviceId || !amount || amount <= 0) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Device ID dan jumlah saldo harus diisi!' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Batasi maksimal top-up per transaksi (Rp 500.000)
      if (amount > 500000) { // batasi maksimal top-up Rp 500.000 per transaksi; mencegah money laundering dan fraud
        // batasi maksimal top-up Rp 500.000 per transaksi; mencegah money laundering dan fraud
        return res.status(400).json({ error: 'Maksimal top-up Rp 500,000' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Cari device berdasarkan deviceId
      const device = this.devices.get(deviceId); // mengambil data device dari Map cache berdasarkan deviceId
      // mengambil data device dari Map cache berdasarkan deviceId
      if (!device || !device.users) { // Jika device tidak ditemukan
        // Jika device tidak ditemukan
        return res.status(404).json({ error: 'Device tidak ditemukan' }); // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
        // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
      }

      // Queue balance update untuk setiap user di device ini
      device.users.forEach(user => { // iterasi semua user di device; setiap user mendapat update saldo
        // iterasi semua user di device; setiap user mendapat update saldo
        const updateKey = `${deviceId}_${user.id}`; // Key unik: deviceId_userId
        // Key unik: deviceId_userId
        this.pendingUpdates.set(updateKey, { // Simpan ke pending updates
          // Simpan ke pending updates
          deviceId, // ID device target
          // ID device target
          userId: user.id, // ID user target
          // ID user target
          newBalance: user.balance + amount, // Balance baru (balance lama + amount)
          // Balance baru (balance lama + amount)
          reason: `Admin top-up: +${amount}`, // Alasan update
          // Alasan update
          timestamp: new Date().toISOString() // Waktu update
          // Waktu update
        });
      });

      console.log(`?? Admin added Rp ${amount.toLocaleString('id-ID')} to device ${deviceId.substring(0, 8)}... for ${device.users.length} users`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        message: `Berhasil menambah saldo Rp ${amount.toLocaleString('id-ID')} untuk ${device.users.length} users`, // .toLocaleString() memformat angka sesuai locale Indonesia (titik sebagai pemisah ribuan)
        // .toLocaleString() memformat angka sesuai locale Indonesia (titik sebagai pemisah ribuan)
        usersUpdated: device.users.length // jumlah user yang saldo-nya diperbarui; untuk konfirmasi ke admin
        // jumlah user yang saldo-nya diperbarui; untuk konfirmasi ke admin
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Update balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Terjadi kesalahan server' }); // response error 500 dengan pesan bahasa Indonesia; untuk endpoint update balance
      // response error 500 dengan pesan bahasa Indonesia; untuk endpoint update balance
    }
  }

  // Update balance user dari admin - LEGACY (akan dihapus)
  async updateBalance(req, res) { // method async: versi legacy endpoint update balance tanpa proteksi password; akan dihapus
    // method async: versi legacy endpoint update balance tanpa proteksi password; akan dihapus
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { deviceId, amount } = req.body; // Ambil deviceId dan amount dari request body
      // Ambil deviceId dan amount dari request body
      
      if (!deviceId || !amount) { // Validasi field wajib
        // Validasi field wajib
        return res.status(400).json({ error: 'Missing deviceId or amount' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Simpan update untuk semua user di device ini
      const device = this.devices.get(deviceId); // Cari device di cache
      // Cari device di cache
      if (!device || !device.users) { // Device tidak ditemukan
        // Device tidak ditemukan
        return res.status(404).json({ error: 'Device not found or no users' }); // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
        // return + res.status(404): menghentikan eksekusi dan mengirim 404 Not Found ke client
      }

      // Queue balance update untuk setiap user di device
      device.users.forEach(user => { // Loop setiap user di device
        // Loop setiap user di device
        const updateKey = `${deviceId}_${user.id}`; // Buat key unik per user per device
        // Buat key unik per user per device
        this.pendingUpdates.set(updateKey, { // Simpan update ke Map pending updates
          // Simpan update ke Map pending updates
          deviceId, // ID device target
          // ID device target
          userId: user.id, // ID user yang di-update
          // ID user yang di-update
          newBalance: user.balance + amount, // Tambahkan ke balance saat ini
          // Tambahkan ke balance saat ini
          reason: `Admin top-up: +${amount}`, // Alasan update
          // Alasan update
          timestamp: new Date().toISOString() // Waktu update
          // Waktu update
        });
      });

      console.log(`?? Balance update queued for device ${deviceId.substring(0, 8)}... | Amount: +${amount} for ${device.users.length} users`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({ // Kirim response sukses ke client
        // Kirim response sukses ke client
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        message: `Balance update queued for ${device.users.length} users`, // pesan sukses dengan jumlah user yang diperbarui; template literal menampilkan nilai dinamis
        // pesan sukses dengan jumlah user yang diperbarui; template literal menampilkan nilai dinamis
        usersUpdated: device.users.length // Jumlah user yang di-update
        // Jumlah user yang di-update
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Update balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: error.message }); // mengirim response error 500 dengan pesan asli dari Error object untuk debugging
      // mengirim response error 500 dengan pesan asli dari Error object untuk debugging
    }
  }

  //
  // HELPER FUNCTIONS
  // ---------------------------------------------------------------------
  
  //
  // getPendingUpdates(deviceId)
  // FUNGSI: Ambil semua pending balance updates untuk device tertentu
  //
  // PARAMETER:
  // - deviceId: string ? Target device ID
  //
  // RETURN: BalanceUpdate[]
  // Array of pending updates untuk device ini
  //
  // FORMAT UPDATE:
  // {
  //   deviceId: string,
  //   userId: number,
  //   newBalance: number,       // Balance baru (old + amount)
  //   reason: string,           // e.g., "Admin top-up: +50000"
  //   timestamp: ISO string
  // }
  //
  // USE CASE:
  // Called di syncDevice() untuk kirim updates ke mobile app
  getPendingUpdates(deviceId) { // method sync: mengambil semua update balance yang menunggu untuk dikirim ke device tertentu
    // method sync: mengambil semua update balance yang menunggu untuk dikirim ke device tertentu
    const updates = []; // Array untuk menyimpan updates
    // Array untuk menyimpan updates
    // Loop semua pending updates
    for (const [key, update] of this.pendingUpdates.entries()) { // iterasi semua pending updates menggunakan destructuring; .entries() mengembalikan [key, value] pairs
      // iterasi semua pending updates menggunakan destructuring; .entries() mengembalikan [key, value] pairs
      if (update.deviceId === deviceId) { // Jika deviceId cocok
        // Jika deviceId cocok
        updates.push(update); // Tambahkan ke array
        // Tambahkan ke array
      }
    }
    return updates; // Return array updates
    // Return array updates
  }

  //
  // clearPendingUpdates(deviceId)
  // FUNGSI: Hapus semua pending updates setelah sent ke device
  //
  // PARAMETER:
  // - deviceId: string ? Target device ID
  //
  // FLOW:
  // 1. Loop semua pendingUpdates Map entries
  // 2. Match deviceId
  // 3. Delete matched entries
  //
  // CALLED BY:
  // syncDevice() setelah kirim updates ke mobile app
  //
  // WHY DELETE:
  // - Prevent duplicate updates
  // - Keep memory clean
  // - Updates sudah diterima mobile app
  clearPendingUpdates(deviceId) { // method sync: menghapus semua pending updates setelah berhasil dikirim ke device
    // method sync: menghapus semua pending updates setelah berhasil dikirim ke device
    // Loop semua pending updates
    for (const [key, update] of this.pendingUpdates.entries()) { // iterasi semua pending updates menggunakan destructuring; .entries() mengembalikan [key, value] pairs
      // iterasi semua pending updates menggunakan destructuring; .entries() mengembalikan [key, value] pairs
      if (update.deviceId === deviceId) { // Jika deviceId cocok
        // Jika deviceId cocok
        this.pendingUpdates.delete(key); // Hapus dari Map
        // Hapus dari Map
      }
    }
  }

  //
  // startCleanupTimer()
  // FUNGSI: Auto-cleanup devices yang sudah lama offline
  //
  // INTERVAL: 5 minutes (300000 ms)
  //
  // CLEANUP RULE:
  // - Device dianggap inactive jika tidak sync lebih dari 10 menit
  // - Formula: (now - device.lastSyncAt) > 600000 ms
  //
  // FLOW:
  // 1. Check semua devices in Map
  // 2. Calculate last sync time difference
  // 3. Delete device jika > 10 min offline
  // 4. Log removal untuk monitoring
  //
  // WHY CLEANUP:
  // - Free memory dari old devices
  // - Remove stale data
  // - Dashboard show only active devices
  // - Prevent Map from growing too large
  //
  // CALLED BY:
  // constructor() saat server start (1x setup)
  startCleanupTimer() { // method sync: memulai timer interval untuk auto-cleanup device yang sudah offline
    // method sync: memulai timer interval untuk auto-cleanup device yang sudah offline
    setInterval(() => { // Jalankan tiap 5 menit
      // Jalankan tiap 5 menit
      const now = new Date(); // Waktu sekarang
      // Waktu sekarang
      for (const [deviceId, device] of this.devices.entries()) { // iterasi semua device dalam cache menggunakan destructuring; untuk memeriksa status aktif
        // iterasi semua device dalam cache menggunakan destructuring; untuk memeriksa status aktif
        // Hapus device yang offline lebih dari 10 menit
        if ((now - device.lastSyncAt) > 600000) { // 10 menit = 600000 ms
          // 10 menit = 600000 ms
          this.devices.delete(deviceId); // Hapus dari Map
          // Hapus dari Map
          console.log(`??? Removed inactive device: ${deviceId.substring(0, 8)}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        }
      }
    }, 300000); // Check tiap 5 menit = 300000 ms
    // Check tiap 5 menit = 300000 ms
  }

  //
  // ---------------------------------------------------------------------
  // FRAUD DETECTION ENDPOINTS
  // ---------------------------------------------------------------------
  
  //
  // handleFraudAlert(req, res)
  // ENDPOINT: POST /api/fraud-alert
  // FUNGSI: Receive fraud alerts dari AI detection di mobile app
  //
  // REQUEST BODY:
  // {
  //   device: {
  //     deviceId: string,
  //     deviceName: string
  //   },
  //   fraudDetection: {
  //     isBlocked: boolean,       // Transaksi diblokir atau tidak
  //     riskScore: number,        // Nilai Z-Score aktual. Sentinel -1 = s=0, X?�.
  //     riskLevel: string,        // 'NORMAL', 'SUSPICIOUS', 'ANOMALY'
  //     reasons: string[],        // Array alasan fraud
  //     transaction: {
  //       userId: number,
  //       amount: number,
  //       timestamp: ISO string
  //     }
  //   }
  // }
  //
  // FLOW:
  // 1. Validate fraud data ada
  // 2. Extract fraud info (riskScore, reasons, etc.)
  // 3. Create unique alertId: "alert_{timestamp}_{userId}"
  // 4. Store alert in fraudAlerts Map
  // 5. Update fraudStats:
  //    - Increment totalAlerts
  //    - Increment blockedTransactions or reviewTransactions
  //    - Update lastAlert timestamp
  // 6. Log alert untuk monitoring
  // 7. Response success
  //
  // ALERT STORAGE:
  // Key: alertId (e.g., "alert_1672531200000_123")
  // Value: {
  //   alertId, deviceId, isBlocked, riskScore,
  //   riskLevel, reasons, userId, amount, timestamp
  // }
  //
  // USE CASE:
  // Mobile app AI detect fraud ? send alert ke admin server
  // ? Dashboard show alert ? Admin review ? Take action
  async handleFraudAlert(req, res) { // method async: endpoint POST /api/fraud-alert untuk menerima fraud alert dari AI mobile app
    // method async: endpoint POST /api/fraud-alert untuk menerima fraud alert dari AI mobile app
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { device, fraudDetection } = req.body; // Ambil data fraud dari HP
      // Ambil data fraud dari HP
      
      // Validasi: fraud data wajib ada
      if (!fraudDetection) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Fraud detection data required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      if (!device || !device.deviceId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Device data required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      const alertId = `fraud_${Date.now()}_${device.deviceId}`; // Generate ID unik
      // Generate ID unik
      const fraudAlert = { // Buat object fraud alert
        // Buat object fraud alert
        id: alertId, // ID alert
        // ID alert
        deviceId: device.deviceId, // ID device yang kirim alert
        // ID device yang kirim alert
        deviceName: device.deviceName, // Nama device
        // Nama device
        riskScore: fraudDetection.riskScore, // Z-Score aktual (nilai float, misal: 2.6333)
        // Z-Score aktual (nilai float, misal: 2.6333)
        riskLevel: fraudDetection.riskLevel, // Level risiko (NORMAL/SUSPICIOUS/ANOMALY)
        // Level risiko (NORMAL/SUSPICIOUS/ANOMALY)
        decision: fraudDetection.decision, // Keputusan AI (ALLOW/REVIEW/BLOCK)
        // Keputusan AI (ALLOW/REVIEW/BLOCK)
        reasons: fraudDetection.reasons, // Alasan-alasan fraud (array)
        // Alasan-alasan fraud (array)
        confidence: fraudDetection.confidence, // Confidence AI (0-1)
        // Confidence AI (0-1)
        riskFactors: fraudDetection.riskFactors, // Faktor risiko detail
        // Faktor risiko detail
        transactionId: fraudDetection.transactionId, // ID transaksi
        // ID transaksi
        timestamp: fraudDetection.timestamp, // Waktu fraud terdeteksi
        // Waktu fraud terdeteksi
        ipAddress: req.ip, // IP address HP
        // IP address HP
        status: 'NEW' // Status alert (NEW/REVIEWED/RESOLVED)
        // Status alert (NEW/REVIEWED/RESOLVED)
      };

      // Simpan fraud alert ke Map
      this.fraudAlerts.set(alertId, fraudAlert); // menyimpan fraud alert ke Map cache; alertId sebagai kunci unik
      // menyimpan fraud alert ke Map cache; alertId sebagai kunci unik

      // Update statistik fraud
      this.fraudStats.totalAlerts++; // Tambah total alerts
      // Tambah total alerts
      this.fraudStats.lastAlert = new Date().toISOString(); // Update waktu alert terakhir
      // Update waktu alert terakhir
      
      // Update counter berdasarkan decision AI
      if (fraudDetection.decision === 'BLOCK') { // memeriksa keputusan AI: BLOCK berarti transaksi berbahaya harus dihentikan
        // memeriksa keputusan AI: BLOCK berarti transaksi berbahaya harus dihentikan
        this.fraudStats.blockedTransactions++; // Tambah blocked transactions
        // Tambah blocked transactions
      } else if (fraudDetection.decision === 'REVIEW') { // else if: kondisi alternatif yang diperiksa jika kondisi if sebelumnya tidak terpenuhi
        // else if: kondisi alternatif yang diperiksa jika kondisi if sebelumnya tidak terpenuhi
        this.fraudStats.reviewTransactions++; // Tambah review transactions
        // Tambah review transactions
      }

      console.log(`?? FRAUD ALERT: ${fraudDetection.riskLevel} risk (Z=${fraudDetection.riskScore}) from device ${device.deviceId.slice(-8)}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   Decision: ${fraudDetection.decision}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   Reasons: ${Array.isArray(fraudDetection.reasons) ? fraudDetection.reasons.join(', ') : fraudDetection.reasons}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   Confidence: ${Math.round(fraudDetection.confidence * 100)}%`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        message: 'Fraud alert received and stored', // pesan konfirmasi penerimaan fraud alert; dikirim ke mobile app sebagai acknowledgment
        // pesan konfirmasi penerimaan fraud alert; dikirim ke mobile app sebagai acknowledgment
        alertId: alertId // ID alert yang dibuat; dikembalikan agar mobile app bisa track alert ini
        // ID alert yang dibuat; dikembalikan agar mobile app bisa track alert ini
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Fraud alert error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to process fraud alert' }); // response error 500 jika proses penerimaan fraud alert gagal
      // response error 500 jika proses penerimaan fraud alert gagal
    }
  }

  //
  // getFraudAlerts(req, res)
  // ENDPOINT: GET /api/fraud-alerts
  // FUNGSI: Ambil fraud alerts untuk dashboard monitoring
  //
  // QUERY PARAMS: None
  //
  // RESPONSE:
  // {
  //   success: true,
  //   alerts: FraudAlert[],     // Max 50 alerts, sorted newest first
  //   stats: {
  //     totalAlerts: number,
  //     blockedTransactions: number,
  //     reviewTransactions: number,
  //     lastAlert: Date | null
  //   },
  //   timestamp: ISO string
  // }
  //
  // SORTING: Terbaru di atas (descending by timestamp)
  // LIMIT: 50 alerts (avoid overload)
  async getFraudAlerts(req, res) { // method async: endpoint GET /api/fraud-alerts untuk dashboard melihat semua fraud alerts
    // method async: endpoint GET /api/fraud-alerts untuk dashboard melihat semua fraud alerts
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Ambil semua alerts, sort terbaru di atas, ambil 50 teratas
      const alerts = Array.from(this.fraudAlerts.values()) // konversi Map ke Array kemudian di-sort dan di-limit; Array.from() untuk operasi array
      // konversi Map ke Array kemudian di-sort dan di-limit; Array.from() untuk operasi array
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort descending
        // Sort descending
        .slice(0, 50); // Max 50 alerts
        // Max 50 alerts

      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        alerts: alerts, // array fraud alerts yang sudah di-sort dan di-limit; siap ditampilkan di dashboard
        // array fraud alerts yang sudah di-sort dan di-limit; siap ditampilkan di dashboard
        stats: this.fraudStats, // statistik fraud: total, blocked, review, lastAlert; untuk overview di dashboard
        // statistik fraud: total, blocked, review, lastAlert; untuk overview di dashboard
        timestamp: new Date().toISOString() // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
        // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get fraud alerts error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to get fraud alerts' }); // response error 500 jika query fraud alerts gagal
      // response error 500 jika query fraud alerts gagal
    }
  }

  // Get semua transaksi dari semua device (GET /api/transactions)
  async getAllTransactions(req, res) { // method async: endpoint GET /api/transactions untuk menampilkan semua transaksi dari semua device
    // method async: endpoint GET /api/transactions untuk menampilkan semua transaksi dari semua device
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const limit = parseInt(req.query.limit) || 50; // Limit hasil (default 50)
      // Limit hasil (default 50)
      const riskLevel = req.query.riskLevel; // Filter by risk level (optional)
      // Filter by risk level (optional)
      
      // Kumpulkan transaksi dari semua device
      let allTransactions = []; // array akumulator: menampung transaksi dari semua device; dimulai kosong
      // array akumulator: menampung transaksi dari semua device; dimulai kosong
      
      // Loop semua device dan ambil transactionnya
      for (const [deviceId, deviceData] of this.devices.entries()) { // iterasi semua device untuk mengumpulkan transaksi; destructuring key-value pair dari Map
        // iterasi semua device untuk mengumpulkan transaksi; destructuring key-value pair dari Map
        // Jika device punya transaksi
        if (deviceData.recentTransactions && deviceData.recentTransactions.length > 0) { // memeriksa apakah device punya transaksi sebelum diproses; mencegah error undefined
          // memeriksa apakah device punya transaksi sebelum diproses; mencegah error undefined
          // Tambah info device ke setiap transaksi
          const txsWithDevice = deviceData.recentTransactions.map(tx => ({ // transformasi setiap transaksi: tambahkan info device (deviceId dan deviceName)
            // transformasi setiap transaksi: tambahkan info device (deviceId dan deviceName)
            ...tx, // Copy semua property transaksi
            // Copy semua property transaksi
            deviceId: deviceId, // Tambah deviceId
            // Tambah deviceId
            deviceName: deviceData.deviceName // Tambah deviceName
            // Tambah deviceName
          }));
          allTransactions = allTransactions.concat(txsWithDevice); // Gabungkan
          // Gabungkan
        }
      }

      // Sort transaksi berdasarkan waktu (terbaru di atas)
      allTransactions.sort((a, b) => { // sort transaksi dari semua device; comparator function mengembalikan negatif/0/positif
        // sort transaksi dari semua device; comparator function mengembalikan negatif/0/positif
        const dateA = new Date(a.createdAt || 0); // Parse tanggal A
        // Parse tanggal A
        const dateB = new Date(b.createdAt || 0); // Parse tanggal B
        // Parse tanggal B
        return dateB - dateA; // Sort descending (terbaru dulu)
        // Sort descending (terbaru dulu)
      });

      // Filter berdasarkan risk level jika ada parameter
      if (riskLevel && riskLevel !== 'ALL') { // filter opsional berdasarkan risk level; skip filter jika parameter 'ALL' atau tidak ada
        // filter opsional berdasarkan risk level; skip filter jika parameter 'ALL' atau tidak ada
        allTransactions = allTransactions.filter(tx => tx.fraudRiskLevel === riskLevel); // filter transaksi berdasarkan risk level yang diminta; .filter() membuat array baru
        // filter transaksi berdasarkan risk level yang diminta; .filter() membuat array baru
      }

      // Batasi jumlah hasil sesuai limit
      const limitedTransactions = allTransactions.slice(0, limit); // batasi jumlah transaksi sesuai limit; .slice() mengambil N elemen pertama
      // batasi jumlah transaksi sesuai limit; .slice() mengambil N elemen pertama

      // Calculate statistics
      const stats = { // objek statistik transaksi: menghitung distribusi risk level dan rata-rata risk score
        // objek statistik transaksi: menghitung distribusi risk level dan rata-rata risk score
        total: allTransactions.length, // total semua transaksi (sebelum limit); untuk info pagination
        // total semua transaksi (sebelum limit); untuk info pagination
        anomaly: allTransactions.filter(tx => tx.fraudRiskLevel === 'ANOMALY').length, // jumlah transaksi dengan risk ANOMALY (Z-Score > 3)
        // jumlah transaksi dengan risk ANOMALY (Z-Score > 3)
        suspicious: allTransactions.filter(tx => tx.fraudRiskLevel === 'SUSPICIOUS').length, // jumlah transaksi dengan risk SUSPICIOUS (2 < Z-Score ≤ 3)
        // jumlah transaksi dengan risk SUSPICIOUS (2 < Z-Score ≤ 3)
        normal: allTransactions.filter(tx => tx.fraudRiskLevel === 'NORMAL').length, // jumlah transaksi normal (Z-Score ≤ 2)
        // jumlah transaksi normal (Z-Score ≤ 2)
        averageRiskScore: allTransactions.length > 0 // menghitung rata-rata risk score jika ada transaksi; kondisi agar tidak bagi nol
        // menghitung rata-rata risk score jika ada transaksi; kondisi agar tidak bagi nol
          ? allTransactions.reduce((sum, tx) => sum + (tx.fraudRiskScore || 0), 0) / allTransactions.length // .reduce() menjumlahkan semua risk score lalu dibagi total untuk mendapat rata-rata
          // .reduce() menjumlahkan semua risk score lalu dibagi total untuk mendapat rata-rata
          : 0
      };

      console.log(`?? Transactions requested: ${limitedTransactions.length} of ${allTransactions.length} total`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        transactions: limitedTransactions, // array transaksi yang sudah di-filter dan di-limit; untuk ditampilkan di dashboard
        // array transaksi yang sudah di-filter dan di-limit; untuk ditampilkan di dashboard
        stats: stats, // objek statistik untuk overview risk distribution di dashboard
        // objek statistik untuk overview risk distribution di dashboard
        total: allTransactions.length, // total semua transaksi (sebelum limit); untuk info pagination
        // total semua transaksi (sebelum limit); untuk info pagination
        showing: limitedTransactions.length // jumlah transaksi yang benar-benar dikembalikan (setelah limit)
        // jumlah transaksi yang benar-benar dikembalikan (setelah limit)
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get transactions error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to get transactions' }); // response error 500 jika query transaksi gagal
      // response error 500 jika query transaksi gagal
    }
  }

  //
  // ---------------------------------------------------------------------
  // USER MANAGEMENT ENDPOINTS
  // ---------------------------------------------------------------------
  // Endpoints untuk CRUD operations user via backend proxy
  // All endpoints forward request ke backend server (port 4000)
  //
  // USER ENDPOINTS LIST:
  // - GET    /api/users         ? List all users
  // - POST   /api/users         ? Create new user
  // - PUT    /api/users/:id     ? Update user data
  // - DELETE /api/users/:id     ? Delete user
  // - POST   /api/block-user    ? Block user account
  // - POST   /api/unblock-user  ? Unblock user account
  // - POST   /api/bulk-topup    ? Bulk top-up multiple users
  // - POST   /api/reset-balance ? Reset user balance to 0
  //
  // DATA SOURCE STRATEGY:
  // 1. PRIMARY: Backend database (via HTTP request)
  // 2. FALLBACK: Device cache (jika backend offline)

  //
  // getUsersEndpoint(req, res)
  // ENDPOINT: GET /api/users
  // FUNGSI: List all users untuk dashboard table
  //
  // DATA SOURCE:
  // 1. PRIMARY: Backend GET /api/debug/users
  //    - Real data from database
  //    - Include balance, isActive, timestamps
  //
  // 2. FALLBACK: Device cache (this.devices Map)
  //    - Data dari mobile app sync
  //    - Deduplicate by user.id
  //
  // RESPONSE:
  // {
  //   success: true,
  //   users: User[],
  //   total: number
  // }
  //
  // USER OBJECT:
  // {
  //   id, username, name, email, phone,
  //   balance, isActive, status,
  //   deviceId, lastSeen, createdAt, updatedAt
  // }
  async getUsersEndpoint(req, res) { // method async: endpoint GET /api/users untuk mendapatkan daftar user dari backend atau cache
    // method async: endpoint GET /api/users untuk mendapatkan daftar user dari backend atau cache
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // GUNAKAN HTTP MODULE BAWAAN NODE.JS (bukan fetch)
      const backendUrl = `${BACKEND_URL}/api/debug/users`; // URL lengkap endpoint users di backend; template literal menggabungkan base URL dan path
      // URL lengkap endpoint users di backend; template literal menggabungkan base URL dan path
      
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // HTTP request menggunakan module bawaan Node.js
        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // Select correct client based on protocol
          const backendConfig = parseBackendUrl(); // mem-parse URL backend menjadi komponen untuk HTTP request
          // mem-parse URL backend menjadi komponen untuk HTTP request
          const client = backendConfig.protocol === 'https' ? https : http; // memilih modul http atau https berdasarkan protocol URL backend
          // memilih modul http atau https berdasarkan protocol URL backend
          
          const request = client.get(backendUrl, (response) => { // membuat HTTP GET request ke backend; .get() adalah shorthand untuk request dengan method GET
            // membuat HTTP GET request ke backend; .get() adalah shorthand untuk request dengan method GET
            let data = ''; // buffer string untuk menampung chunk-chunk data response HTTP
            // buffer string untuk menampung chunk-chunk data response HTTP
            
            response.on('data', (chunk) => { // event listener 'data': dipanggil setiap kali ada potongan data baru dari response
              // event listener 'data': dipanggil setiap kali ada potongan data baru dari response
              data += chunk; // menggabungkan chunk ke buffer; HTTP response datang dalam potongan-potongan
              // menggabungkan chunk ke buffer; HTTP response datang dalam potongan-potongan
            });
            
            response.on('end', () => { // event listener 'end': dipanggil saat semua response sudah diterima
              // event listener 'end': dipanggil saat semua response sudah diterima
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
                // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
                resolve(jsonData); // selesaikan Promise dengan data hasil parse; value ini dikembalikan ke await
                // selesaikan Promise dengan data hasil parse; value ini dikembalikan ke await
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // reject Promise jika JSON parse gagal; error akan ditangkap di catch blok luar
                // reject Promise jika JSON parse gagal; error akan ditangkap di catch blok luar
              }
            });
          });
          
          request.on('error', (error) => { // event listener 'error': dipanggil saat terjadi error koneksi (network error)
            // event listener 'error': dipanggil saat terjadi error koneksi (network error)
            reject(error); // reject Promise dengan error koneksi; error akan ditangkap di catch blok luar
            // reject Promise dengan error koneksi; error akan ditangkap di catch blok luar
          });
          
          request.setTimeout(5000, () => { // set timeout 5 detik untuk request GET; mencegah request menggantung selamanya
            // set timeout 5 detik untuk request GET; mencegah request menggantung selamanya
            request.destroy(); // menghancurkan request yang timeout; membebaskan resource dan koneksi
            // menghancurkan request yang timeout; membebaskan resource dan koneksi
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
        });
        
        console.log(`? Loaded ${backendData.users?.length || 0} users from backend database`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        // Format untuk dashboard display
        const formattedData = { // objek data yang sudah diformat ulang sesuai kebutuhan dashboard
          // objek data yang sudah diformat ulang sesuai kebutuhan dashboard
          success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
          // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
          users: backendData.users.map(user => ({ // transformasi array users dari backend; .map() membuat array baru dengan format yang berbeda
            // transformasi array users dari backend; .map() membuat array baru dengan format yang berbeda
            ...user, // spread semua property user asli; menyalin semua field dari data backend
            // spread semua property user asli; menyalin semua field dari data backend
            balance: parseInt(user.balance), // Convert BigInt ke number
            // Convert BigInt ke number
            lastSeen: user.updatedAt, // Gunakan updatedAt sebagai lastSeen
            // Gunakan updatedAt sebagai lastSeen
            status: user.isActive ? 'Active' : 'Inactive' // konversi boolean isActive ke label string; ternary operator untuk mapping nilai
            // konversi boolean isActive ke label string; ternary operator untuk mapping nilai
          })),
          total: backendData.total // total user dari backend; untuk info pagination di dashboard
          // total user dari backend; untuk info pagination di dashboard
        };
        
        return res.json(formattedData); // mengirim data yang sudah diformat ke client; return menghentikan eksekusi
        // mengirim data yang sudah diformat ke client; return menghentikan eksekusi
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.log('?? Backend tidak tersedia, gunakan cache device:', backendError.message); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }
      
      // FALLBACK: Ambil dari device cache jika backend error
      const allUsers = []; // Array untuk menyimpan semua user
      // Array untuk menyimpan semua user
      
      // Extract users dari semua device
      this.devices.forEach((deviceData, deviceId) => { // fallback: iterasi device cache untuk mengambil user jika backend tidak tersedia
        // fallback: iterasi device cache untuk mengambil user jika backend tidak tersedia
        if (deviceData.users) { // Jika device punya users
          // Jika device punya users
          deviceData.users.forEach(user => { // iterasi semua user dalam satu device; setiap device bisa punya banyak user
            // iterasi semua user dalam satu device; setiap device bisa punya banyak user
            // Cek duplikat berdasarkan ID (hindari user duplikat)
            if (!allUsers.find(u => u.id === user.id)) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
              // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
              allUsers.push({ // Tambahkan user ke array
                // Tambahkan user ke array
                ...user, // Copy semua property user
                // Copy semua property user
                deviceId: deviceId, // Tambah info deviceId
                // Tambah info deviceId
                deviceName: deviceData.deviceName, // Tambah info deviceName
                // Tambah info deviceName
                status: user.isActive ? 'Active' : 'Inactive' // konversi boolean isActive ke label string; ternary operator untuk mapping nilai
                // konversi boolean isActive ke label string; ternary operator untuk mapping nilai
              });
            }
          });
        }
      });

      // Kirim response dengan array users
      res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        users: allUsers, // Array semua user
        // Array semua user
        total: allUsers.length // Total user
        // Total user
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get users error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to get users' }); // response error 500 jika query daftar user gagal
      // response error 500 jika query daftar user gagal
    }
  }

  // Create user baru (POST /api/users) - Belum diimplementasi
  async createUserEndpoint(req, res) { // method async: endpoint POST /api/users untuk membuat user baru; saat ini terintegrasi sebagian
    // method async: endpoint POST /api/users untuk membuat user baru; saat ini terintegrasi sebagian
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { username, name, password, balance = 1000000 } = req.body; // Ambil data user dari request body
      // Ambil data user dari request body
      
      // Validasi input wajib
      if (!username || !name || !password) { // Semua field wajib diisi
        // Semua field wajib diisi
        return res.status(400).json({ error: 'Username, name, and password required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // TODO: Implementasi logic create user
      // Ini harus terintegrasi dengan backend database (Prisma)
      console.log('?? Create user requested:', { username, name, balance }); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      res.json({ // Kirim response sementara (belum terintegrasi)
        // Kirim response sementara (belum terintegrasi)
        success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
        message: 'User creation endpoint ready - needs backend integration', // pesan placeholder; endpoint belum terintegrasi penuh dengan backend database
        // pesan placeholder; endpoint belum terintegrasi penuh dengan backend database
        data: { username, name, balance } // Echo data yang diterima
        // Echo data yang diterima
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Create user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to create user' }); // response error 500 jika pembuatan user gagal
      // response error 500 jika pembuatan user gagal
    }
  }

  // Update user (PUT /api/users/:id) - Integrasi dengan backend
  async updateUserEndpoint(req, res) { // method async: endpoint PUT /api/users/:id untuk memperbarui data user via backend proxy
    // method async: endpoint PUT /api/users/:id untuk memperbarui data user via backend proxy
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const userId = parseInt(req.params.id); // Ambil user ID dari URL
      // Ambil user ID dari URL
      const { balance, name } = req.body; // Ambil data update
      // Ambil data update
      
      // Validasi userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'User ID required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Kirim update ke backend
      const backendUrl = `${BACKEND_URL}/api/users/${userId}`; // URL endpoint backend untuk update user
      // URL endpoint backend untuk update user
      
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          const postData = JSON.stringify({ balance, name }); // Serialize body request ke JSON
          // Serialize body request ke JSON
          
          const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
          // Parse URL backend menjadi komponen
          const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
            // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
            hostname: backendConfig.hostname, // Hostname backend
            // Hostname backend
            port: backendConfig.port, // Port backend
            // Port backend
            path: `/api/users/${userId}`, // Path endpoint dengan user ID
            // Path endpoint dengan user ID
            method: 'PUT', // Method HTTP PUT untuk update
            // Method HTTP PUT untuk update
            headers: { // HTTP headers yang dikirim bersama request ke backend
              // HTTP headers yang dikirim bersama request ke backend
              'Content-Type': 'application/json', // Format body JSON
              // Format body JSON
              'Content-Length': Buffer.byteLength(postData), // Panjang body dalam bytes
              // Panjang body dalam bytes
              'ngrok-skip-browser-warning': 'true' // Header untuk melewati warning ngrok
              // Header untuk melewati warning ngrok
            }
          };
          
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const request = client.request(options, (response) => { // membuat HTTP request ke backend dengan method PUT/DELETE; callback untuk menangani response
            // membuat HTTP request ke backend dengan method PUT/DELETE; callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
                // Selesaikan Promise
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          request.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            reject(error); // Reject Promise dengan error
            // Reject Promise dengan error
          });
          
          request.setTimeout(5000, () => { // Timeout 5 detik
            // Timeout 5 detik
            request.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          request.write(postData); // Tulis body JSON ke request
          // Tulis body JSON ke request
          request.end(); // Kirim request ke backend
          // Kirim request ke backend
        });
        
        console.log(`? Updated user ${userId} in backend`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Kirim response backend langsung ke client
        // Kirim response backend langsung ke client
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('Backend update error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        res.status(500).json({ error: 'Failed to update user in backend' }); // response error 500 khusus untuk error dari backend saat update user
        // response error 500 khusus untuk error dari backend saat update user
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Update user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to update user' }); // response error 500 umum jika update user gagal di level method
      // response error 500 umum jika update user gagal di level method
    }
  }

  // Delete user (DELETE /api/users/:id) - Integrasi dengan backend
  async deleteUserEndpoint(req, res) { // method async: endpoint DELETE /api/users/:id untuk menghapus user via backend proxy
    // method async: endpoint DELETE /api/users/:id untuk menghapus user via backend proxy
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const userId = parseInt(req.params.id); // Ambil user ID dari URL
      // Ambil user ID dari URL
      
      console.log(`??? DELETE request for user ID: ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      // Validasi userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.log('? No user ID provided'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(400).json({ error: 'User ID required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Parse backend URL
      const backendConfig = parseBackendUrl(); // mem-parse URL backend menjadi komponen untuk HTTP request
      // mem-parse URL backend menjadi komponen untuk HTTP request
      console.log(`?? Connecting to backend: ${backendConfig.protocol}://${backendConfig.hostname}:${backendConfig.port}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      // Kirim delete ke backend
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
            // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
            hostname: backendConfig.hostname, // Hostname backend
            // Hostname backend
            port: backendConfig.port, // Port backend
            // Port backend
            path: `/api/users/${userId}`, // Path dengan user ID
            // Path dengan user ID
            method: 'DELETE', // Method HTTP DELETE
            // Method HTTP DELETE
            headers: { // HTTP headers yang dikirim bersama request ke backend
              // HTTP headers yang dikirim bersama request ke backend
              'Content-Type': 'application/json', // Format JSON
              // Format JSON
              'x-app-key': APP_SECRET, // Header autentikasi app key
              // Header autentikasi app key
              'user-agent': 'admin-dashboard/1.0' // Identifikasi sebagai admin dashboard
              // Identifikasi sebagai admin dashboard
            }
          };
          
          console.log(`?? Sending DELETE to: ${options.path}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const request = client.request(options, (response) => { // membuat HTTP request ke backend dengan method PUT/DELETE; callback untuk menangani response
            // membuat HTTP request ke backend dengan method PUT/DELETE; callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            console.log(`?? Response status: ${response.statusCode}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
            // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              console.log(`?? Response data:`, data.substring(0, 200)); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
              // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
                // Selesaikan Promise
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                console.error('? JSON parse error:', parseError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
                // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
                reject(new Error(`Parse error: ${data.substring(0, 100)}`)); // Reject dengan info awal data
                // Reject dengan info awal data
              }
            });
          });
          
          request.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            console.error('? Request error:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
            // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
            reject(error); // Reject Promise
            // Reject Promise
          });
          
          request.setTimeout(5000, () => { // Timeout 5 detik
            // Timeout 5 detik
            console.error('? Request timeout'); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
            // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
            request.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          request.end(); // Kirim request DELETE (tanpa body)
          // Kirim request DELETE (tanpa body)
        });
        
        console.log(`? Deleted user ${userId} from backend:`, backendData); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Kirim response backend ke client
        // Kirim response backend ke client
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend delete error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        res.status(500).json({ error: 'Failed to delete user from backend', details: backendError.message }); // response error 500 khusus untuk error dari backend saat delete user
        // response error 500 khusus untuk error dari backend saat delete user
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Delete user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to delete user', details: error.message }); // response error 500 umum jika delete user gagal di level method
      // response error 500 umum jika delete user gagal di level method
    }
  }

  // Block user (POST /api/block-user) - Integrasi dengan backend
  async blockUserEndpoint(req, res) { // method async: endpoint POST /api/block-user untuk memblokir akun user via backend
    // method async: endpoint POST /api/block-user untuk memblokir akun user via backend
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { userId, password } = req.body; // Ambil data dari request
      // Ambil data dari request
      
      // Validasi: userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'User ID required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Validasi password admin
      if (password !== ADMIN_PASSWORD) { // memeriksa password admin sebelum eksekusi aksi sensitif; validasi otorisasi
        // memeriksa password admin sebelum eksekusi aksi sensitif; validasi otorisasi
        return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
        // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
      }

      // IMPLEMENTASI BLOCK USER LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        // Parse URL backend menjadi komponen
        const postData = JSON.stringify({ userId: parseInt(userId), password }); // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        
        const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          hostname: backendConfig.hostname, // hostname tujuan request; bisa localhost atau domain ngrok
          // hostname tujuan request; bisa localhost atau domain ngrok
          port: backendConfig.port, // port backend; default 4000 untuk development lokal
          // port backend; default 4000 untuk development lokal
          path: '/api/admin/block-user', // endpoint di backend untuk memblokir user
          // endpoint di backend untuk memblokir user
          method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
          // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
          headers: { // HTTP headers yang dikirim bersama request ke backend
            // HTTP headers yang dikirim bersama request ke backend
            'Content-Type': 'application/json', // menetapkan format body sebagai JSON; backend akan parse sebagai JSON
            // menetapkan format body sebagai JSON; backend akan parse sebagai JSON
            'x-app-key': 'NFC2025SecureApp', // header autentikasi app key; diverifikasi oleh middleware backend
            // header autentikasi app key; diverifikasi oleh middleware backend
            'ngrok-skip-browser-warning': 'true', // melewati warning ngrok saat menggunakan tunnel ngrok
            // melewati warning ngrok saat menggunakan tunnel ngrok
            'x-admin-password': ADMIN_PASSWORD, // header password admin; diverifikasi ulang di backend
            // header password admin; diverifikasi ulang di backend
            'Content-Length': Buffer.byteLength(postData) // panjang body dalam bytes; header wajib untuk POST request dengan body
            // panjang body dalam bytes; header wajib untuk POST request dengan body
          }
        };

        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const req = client.request(options, (response) => { // membuat HTTP request ke backend dengan callback untuk menangani response
            // membuat HTTP request ke backend dengan callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise dengan data
                // Selesaikan Promise dengan data
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            reject(error); // Reject Promise
            // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          req.write(postData); // Tulis body ke request
          // Tulis body ke request
          req.end(); // Kirim request ke backend
          // Kirim request ke backend
        });
        
        if (backendData.success) { // memeriksa apakah backend melaporkan operasi berhasil
          // memeriksa apakah backend melaporkan operasi berhasil
          console.log(`?? User blocked: ${userId} (${backendData.user.username})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            message: `User ${backendData.user.username} has been blocked`, // pesan sukses dengan username user yang diblokir; template literal untuk pesan dinamis
            // pesan sukses dengan username user yang diblokir; template literal untuk pesan dinamis
            user: backendData.user // Data user yang diblokir
            // Data user yang diblokir
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend block user failed'); // Lempar error jika backend gagal
          // Lempar error jika backend gagal
        }
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend block user error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          success: false, // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
          // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
          error: `Failed to block user: ${backendError.message}` // Pesan error ke client
          // Pesan error ke client
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Block user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to block user' }); // response error 500 jika operasi block user gagal
      // response error 500 jika operasi block user gagal
    }
  }

  // Unblock user (POST /api/unblock-user) - Integrasi dengan backend
  async unblockUserEndpoint(req, res) { // method async: endpoint POST /api/unblock-user untuk membuka blokir akun user via backend
    // method async: endpoint POST /api/unblock-user untuk membuka blokir akun user via backend
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { userId, password } = req.body; // Ambil data dari request
      // Ambil data dari request
      
      // Validasi: userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'User ID required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Validasi password admin
      if (password !== ADMIN_PASSWORD) { // memeriksa password admin sebelum eksekusi aksi sensitif; validasi otorisasi
        // memeriksa password admin sebelum eksekusi aksi sensitif; validasi otorisasi
        return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
        // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
      }

      // IMPLEMENTASI UNBLOCK USER LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        // Parse URL backend menjadi komponen
        const postData = JSON.stringify({ userId: parseInt(userId), password }); // Serialize body request ke JSON
        // Serialize body request ke JSON
        
        const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          hostname: backendConfig.hostname, // Hostname backend
          // Hostname backend
          port: backendConfig.port, // Port backend
          // Port backend
          path: '/api/admin/unblock-user', // Endpoint unblock user di backend
          // Endpoint unblock user di backend
          method: 'POST', // Method HTTP POST
          // Method HTTP POST
          headers: { // HTTP headers yang dikirim bersama request ke backend
            // HTTP headers yang dikirim bersama request ke backend
            'Content-Type': 'application/json', // Format body JSON
            // Format body JSON
            'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            // Lewati warning ngrok
            'x-admin-password': ADMIN_PASSWORD, // Header password admin
            // Header password admin
            'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
            // Panjang body dalam bytes
          }
        };

        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const req = client.request(options, (response) => { // membuat HTTP request ke backend dengan callback untuk menangani response
            // membuat HTTP request ke backend dengan callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
                // Selesaikan Promise
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            reject(error); // Reject Promise
            // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          req.write(postData); // Tulis body ke request
          // Tulis body ke request
          req.end(); // Kirim request ke backend
          // Kirim request ke backend
        });
        
        if (backendData.success) { // Jika backend berhasil membuka blokir
          // Jika backend berhasil membuka blokir
          console.log(`? User unblocked: ${userId} (${backendData.user.username})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            message: `User ${backendData.user.username} has been unblocked`, // pesan sukses dengan username user yang dibuka blokirnya
            // pesan sukses dengan username user yang dibuka blokirnya
            user: backendData.user // Data user yang sudah dibuka blokirnya
            // Data user yang sudah dibuka blokirnya
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend unblock user failed'); // Lempar error jika gagal
          // Lempar error jika gagal
        }
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend unblock user error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          success: false, // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
          // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
          error: `Failed to unblock user: ${backendError.message}` // Pesan error ke client
          // Pesan error ke client
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Unblock user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to unblock user' }); // response error 500 jika operasi unblock user gagal
      // response error 500 jika operasi unblock user gagal
    }
  }

  // Bulk top-up ke semua user (POST /api/bulk-topup) - Belum diimplementasi
  async bulkTopupEndpoint(req, res) { // method async: endpoint POST /api/bulk-topup untuk top-up saldo semua user sekaligus
    // method async: endpoint POST /api/bulk-topup untuk top-up saldo semua user sekaligus
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { amount, password } = req.body; // Ambil amount dan password
      // Ambil amount dan password
      
      // Validasi amount wajib ada
      if (!amount || amount <= 0) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Valid amount required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // Validasi password admin
      if (password !== ADMIN_PASSWORD) { // memeriksa password admin sebelum eksekusi aksi sensitif; validasi otorisasi
        // memeriksa password admin sebelum eksekusi aksi sensitif; validasi otorisasi
        return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
        // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
      }

      // IMPLEMENTASI BULK TOPUP LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendUrl = `${BACKEND_URL}/api/admin/bulk-topup`; // URL endpoint bulk topup backend
        // URL endpoint bulk topup backend
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        // Parse URL backend menjadi komponen
        
        // HTTP request ke backend untuk bulk topup
        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          const postData = JSON.stringify({ amount: parseInt(amount) }); // Serialize body request
          // Serialize body request
          
          const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
            // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
            hostname: backendConfig.hostname, // Hostname backend
            // Hostname backend
            port: backendConfig.port, // Port backend
            // Port backend
            path: '/api/admin/bulk-topup', // Endpoint bulk topup
            // Endpoint bulk topup
            method: 'POST', // Method HTTP POST
            // Method HTTP POST
            headers: { // HTTP headers yang dikirim bersama request ke backend
              // HTTP headers yang dikirim bersama request ke backend
              'Content-Type': 'application/json', // Format body JSON
              // Format body JSON
              'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
              // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            // Lewati warning ngrok
              'x-admin-password': ADMIN_PASSWORD, // Header password admin
              // Header password admin
              'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
              // Panjang body dalam bytes
            }
          };

          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const req = client.request(options, (response) => { // membuat HTTP request ke backend dengan callback untuk menangani response
            // membuat HTTP request ke backend dengan callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
                // Selesaikan Promise
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            reject(error); // Reject Promise
            // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          req.write(postData); // Tulis body ke request
          // Tulis body ke request
          req.end(); // Kirim request ke backend
          // Kirim request ke backend
        });
        
        if (backendData.success) { // Jika backend berhasil bulk topup
          // Jika backend berhasil bulk topup
          console.log(`? Bulk topup berhasil: ${backendData.updatedUsers} users, amount: ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            message: `Bulk topup berhasil untuk ${backendData.updatedUsers} users`, // pesan sukses bulk topup dengan jumlah user yang berhasil diperbarui
            // pesan sukses bulk topup dengan jumlah user yang berhasil diperbarui
            data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
              // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
              amount: amount, // Jumlah top-up per user
              // Jumlah top-up per user
              updatedUsers: backendData.updatedUsers, // Jumlah user yang di-update
              // Jumlah user yang di-update
              totalAmount: backendData.totalAmount // Total saldo yang ditambahkan
              // Total saldo yang ditambahkan
            }
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend bulk topup failed'); // Lempar error jika gagal
          // Lempar error jika gagal
        }
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend bulk topup error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        // FALLBACK: Update di device cache (temporary)
        let updatedCount = 0; // Counter user yang di-update
        // Counter user yang di-update
        this.devices.forEach((deviceData, deviceId) => { // Loop semua device
          // Loop semua device
          if (deviceData.users) { // Jika device punya user
            // Jika device punya user
            deviceData.users.forEach(user => { // Loop setiap user di device
              // Loop setiap user di device
              user.balance = (parseInt(user.balance) || 0) + parseInt(amount); // Tambahkan amount ke balance
              // Tambahkan amount ke balance
              updatedCount++; // Increment counter
              // Increment counter
            });
            deviceData.totalBalance = deviceData.users.reduce((sum, user) => sum + (parseInt(user.balance) || 0), 0); // Hitung ulang total balance device
            // Hitung ulang total balance device
          }
        });
        
        console.log(`?? Fallback bulk topup: ${updatedCount} users in cache, amount: ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
          // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
          message: `Bulk topup applied to ${updatedCount} users (cache only - backend unavailable)`, // pesan fallback: bulk topup hanya di cache lokal karena backend tidak tersedia
          // pesan fallback: bulk topup hanya di cache lokal karena backend tidak tersedia
          data: { // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
            // data: { } berisi field yang akan diisi saat create atau diperbarui saat update; setara VALUES di INSERT atau SET di UPDATE
            amount: amount, // Jumlah top-up
            // Jumlah top-up
            updatedUsers: updatedCount, // Jumlah user yang di-update di cache
            // Jumlah user yang di-update di cache
            warning: 'Applied to local cache only, may not persist' // Peringatan data hanya di cache
            // Peringatan data hanya di cache
          }
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Bulk topup error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to perform bulk topup' }); // response error 500 jika operasi bulk topup gagal
      // response error 500 jika operasi bulk topup gagal
    }
  }

  // Reset balance user tertentu (POST /api/reset-balance)
  async resetBalanceEndpoint(req, res) { // method async: endpoint POST /api/reset-balance untuk reset saldo user ke nilai tertentu
    // method async: endpoint POST /api/reset-balance untuk reset saldo user ke nilai tertentu
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { userId, newBalance, password } = req.body; // Ambil userId, newBalance, dan password dari request
      // Ambil userId, newBalance, dan password dari request
      
      // Validasi password admin
      if (password !== ADMIN_PASSWORD) { // Password admin wajib cocok
        // Password admin wajib cocok
        return res.status(401).json({ error: 'Invalid admin password' }); // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
        // tolak dengan 401 jika password admin tidak valid; hanya admin yang bisa reset saldo
      }

      // Validasi userId dan newBalance
      if (!userId) { // userId wajib ada
        // userId wajib ada
        return res.status(400).json({ error: 'User ID required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }
      
      if (newBalance === undefined || newBalance === null) { // newBalance wajib ada
        // newBalance wajib ada
        return res.status(400).json({ error: 'New balance required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      // IMPLEMENTASI RESET BALANCE LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        // Parse URL backend menjadi komponen
        const postData = JSON.stringify({ userId: parseInt(userId), newBalance: parseInt(newBalance), password }); // Serialize body request
        // Serialize body request
        
        const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          hostname: backendConfig.hostname, // Hostname backend
          // Hostname backend
          port: backendConfig.port, // Port backend
          // Port backend
          path: '/api/admin/reset-balance', // Endpoint reset balance di backend
          // Endpoint reset balance di backend
          method: 'POST', // Method HTTP POST
          // Method HTTP POST
          headers: { // HTTP headers yang dikirim bersama request ke backend
            // HTTP headers yang dikirim bersama request ke backend
            'Content-Type': 'application/json', // Format body JSON
            // Format body JSON
            'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            // Lewati warning ngrok
            'x-admin-password': ADMIN_PASSWORD, // Header password admin
            // Header password admin
            'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
            // Panjang body dalam bytes
          }
        };

        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const req = client.request(options, (response) => { // membuat HTTP request ke backend dengan callback untuk menangani response
            // membuat HTTP request ke backend dengan callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
                // Selesaikan Promise
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            reject(error); // Reject Promise
            // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          req.write(postData); // Tulis body ke request
          // Tulis body ke request
          req.end(); // Kirim request ke backend
          // Kirim request ke backend
        });

        if (backendData.success || backendData.user) { // Jika backend berhasil reset balance
          // Jika backend berhasil reset balance
          console.log(`? Reset balance success for user ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            message: `Balance reset untuk user ${userId}`, // pesan sukses reset saldo dengan ID user; template literal untuk pesan dinamis
            // pesan sukses reset saldo dengan ID user; template literal untuk pesan dinamis
            user: backendData.user // Data user setelah reset balance
            // Data user setelah reset balance
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend reset balance failed'); // Lempar error jika gagal
          // Lempar error jika gagal
        }

      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend reset balance error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        // FALLBACK: Update di device cache (temporary)
        let userFound = false; // Flag untuk menandai apakah user ditemukan
        // Flag untuk menandai apakah user ditemukan
        this.devices.forEach((deviceData, deviceId) => { // Loop semua device
          // Loop semua device
          if (deviceData.users) { // Jika device punya user
            // Jika device punya user
            const user = deviceData.users.find(u => u.id === parseInt(userId)); // Cari user berdasarkan ID
            // Cari user berdasarkan ID
            if (user) { // Jika user ditemukan
              // Jika user ditemukan
              user.balance = 0; // Reset balance ke 0
              // Reset balance ke 0
              userFound = true; // Tandai user ditemukan
              // Tandai user ditemukan
              deviceData.totalBalance = deviceData.users.reduce((sum, u) => sum + (parseInt(u.balance) || 0), 0); // Hitung ulang total balance
              // Hitung ulang total balance
            }
          }
        });
        
        if (userFound) { // Jika user ditemukan di cache
          // Jika user ditemukan di cache
          console.log(`?? Fallback reset balance for user ${userId} (cache only)`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            message: `Reset balance untuk user ${userId} (cache only - backend unavailable)`, // pesan fallback: reset saldo hanya di cache lokal karena backend tidak tersedia
            // pesan fallback: reset saldo hanya di cache lokal karena backend tidak tersedia
            warning: 'Applied to local cache only, may not persist' // Peringatan data hanya di cache
            // Peringatan data hanya di cache
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          res.status(500).json({ error: 'User tidak ditemukan dan backend tidak tersedia' }); // User tidak ada
          // User tidak ada
        }
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Reset balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to reset balance' }); // response error 500 jika operasi reset saldo gagal
      // response error 500 jika operasi reset saldo gagal
    }
  }

  // Clear semua fraud alerts (POST /api/clear-fraud-alerts)
  async clearFraudAlertsEndpoint(req, res) { // method async: endpoint POST /api/clear-fraud-alerts untuk menghapus semua fraud alerts
    // method async: endpoint POST /api/clear-fraud-alerts untuk menghapus semua fraud alerts
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // IMPLEMENTASI CLEAR FRAUD ALERTS LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        // Parse URL backend menjadi komponen
        const postData = JSON.stringify({}); // Body kosong untuk request clear
        // Body kosong untuk request clear
        
        const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          hostname: backendConfig.hostname, // Hostname backend
          // Hostname backend
          port: backendConfig.port, // Port backend
          // Port backend
          path: '/api/admin/clear-fraud-alerts', // Endpoint clear fraud alerts
          // Endpoint clear fraud alerts
          method: 'POST', // Method HTTP POST
          // Method HTTP POST
          headers: { // HTTP headers yang dikirim bersama request ke backend
            // HTTP headers yang dikirim bersama request ke backend
            'Content-Type': 'application/json', // Format body JSON
            // Format body JSON
            'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            // Lewati warning ngrok
            'x-admin-password': ADMIN_PASSWORD, // Header password admin
            // Header password admin
            'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
            // Panjang body dalam bytes
          }
        };

        const backendData = await new Promise((resolve, reject) => { // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // membungkus HTTP request dalam Promise untuk digunakan dengan await
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          // Pilih http atau https
          const req = client.request(options, (response) => { // membuat HTTP request ke backend dengan callback untuk menangani response
            // membuat HTTP request ke backend dengan callback untuk menangani response
            let data = ''; // Buffer untuk menampung chunk response
            // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
              // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
                // Selesaikan Promise
              } catch (parseError) { // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                // menangkap error JSON.parse(); terjadi jika response bukan JSON valid
                reject(parseError); // Gagal parse, reject Promise
                // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            // Event error koneksi
            reject(error); // Reject Promise
            // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            // Batalkan request timeout
            reject(new Error('Timeout')); // reject Promise dengan error timeout; ditangkap di catch blok luar
            // reject Promise dengan error timeout; ditangkap di catch blok luar
          });
          
          req.write(postData); // Tulis body kosong ke request
          // Tulis body kosong ke request
          req.end(); // Kirim request ke backend
          // Kirim request ke backend
        });
        
        if (backendData.success) { // Jika backend berhasil menghapus fraud alerts
          // Jika backend berhasil menghapus fraud alerts
          console.log(`? Backend cleared ${backendData.clearedCount} fraud alerts`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          // Also clear local cache
          const localClearedCount = this.fraudAlerts.size; // Hitung fraud alerts di cache lokal
          // Hitung fraud alerts di cache lokal
          this.fraudAlerts.clear(); // Hapus semua fraud alerts dari Map lokal
          // Hapus semua fraud alerts dari Map lokal
          this.fraudStats = { // Reset statistik fraud ke nilai awal
            // Reset statistik fraud ke nilai awal
            totalAlerts: 0, // Reset total alerts
            // Reset total alerts
            blockedTransactions: 0, // Reset counter transaksi diblokir
            // Reset counter transaksi diblokir
            reviewTransactions: 0, // Reset counter transaksi direview
            // Reset counter transaksi direview
            lastAlert: null // Reset timestamp alert terakhir
            // Reset timestamp alert terakhir
          };
          
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            message: `Cleared ${backendData.clearedCount} fraud alerts from backend, ${localClearedCount} from local cache`, // pesan sukses dengan jumlah alert yang dihapus dari backend dan cache lokal
            // pesan sukses dengan jumlah alert yang dihapus dari backend dan cache lokal
            clearedCount: backendData.clearedCount // Jumlah alert yang dihapus di backend
            // Jumlah alert yang dihapus di backend
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend clear fraud alerts failed'); // Lempar error jika gagal
          // Lempar error jika gagal
        }
        
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend clear fraud alerts error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        // FALLBACK: Clear local cache only
        const clearedCount = this.fraudAlerts.size; // Hitung alert yang akan dihapus
        // Hitung alert yang akan dihapus
        this.fraudAlerts.clear(); // Hapus semua fraud alerts dari Map lokal
        // Hapus semua fraud alerts dari Map lokal
        this.fraudStats = { // Reset statistik fraud ke nilai awal
          // Reset statistik fraud ke nilai awal
          totalAlerts: 0, // Reset total alerts
          // Reset total alerts
          blockedTransactions: 0, // Reset counter transaksi diblokir
          // Reset counter transaksi diblokir
          reviewTransactions: 0, // Reset counter transaksi direview
          // Reset counter transaksi direview
          lastAlert: null // Reset timestamp alert terakhir
          // Reset timestamp alert terakhir
        };

        console.log(`?? Fallback clear fraud alerts: ${clearedCount} alerts from local cache`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
          // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
          message: `Cleared ${clearedCount} fraud alerts (local cache only - backend unavailable)`, // pesan fallback: alert hanya dihapus dari cache lokal karena backend tidak tersedia
          // pesan fallback: alert hanya dihapus dari cache lokal karena backend tidak tersedia
          clearedCount: clearedCount, // Jumlah alert yang dihapus dari cache
          // Jumlah alert yang dihapus dari cache
          warning: 'Cleared from local cache only, may not persist' // Peringatan data hanya di cache
          // Peringatan data hanya di cache
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Clear fraud alerts error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to clear fraud alerts' }); // response error 500 jika operasi clear fraud alerts gagal
      // response error 500 jika operasi clear fraud alerts gagal
    }
  }

  //
  // ---------------------------------------------------------------------
  // NFC CARD MANAGEMENT ENDPOINTS
  // ---------------------------------------------------------------------
  // Endpoints untuk manage NFC cards via backend proxy
  //
  // CARD POLICY: 1-card-per-user
  // - Setiap user hanya bisa punya 1 active card
  // - Card bisa: ACTIVE, BLOCKED, LOST, EXPIRED
  //
  // NFC CARD ENDPOINTS:
  // - GET    /api/nfc-cards           ? List all cards
  // - POST   /api/nfc-cards/register  ? Register new card
  // - POST   /api/nfc-cards/link      ? Link card to user
  // - POST   /api/nfc-cards/block     ? Block card
  // - POST   /api/nfc-cards/topup     ? Top-up card balance
  // - DELETE /api/nfc-cards/:cardId   ? Delete card (admin only)
  //
  // CARD DATA FLOW:
  // 1. Physical NFC card scanned di mobile app
  // 2. Get card UID (7 bytes)
  // 3. Register card via admin dashboard or mobile app
  // 4. Link card to user account
  // 5. Card ready untuk payment transactions
  //
  // SECURITY:
  // - Admin password required untuk delete
  // - Card status validation (tidak bisa top-up BLOCKED card)
  // - 1-card-per-user enforcement

  //
  // getNFCCards(req, res)
  // ENDPOINT: GET /api/nfc-cards
  // FUNGSI: List all NFC cards
  // Proxy ke backend GET /api/nfc-cards/list
  async getNFCCards(req, res) { // method async: endpoint GET /api/nfc-cards untuk mendapatkan semua kartu NFC dari backend
    // method async: endpoint GET /api/nfc-cards untuk mendapatkan semua kartu NFC dari backend
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
      // Parse URL backend menjadi komponen
      const backendUrl = `${BACKEND_URL}/api/nfc-cards/list`; // URL lengkap endpoint list kartu
      // URL lengkap endpoint list kartu
      
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
          hostname: backendConfig.hostname, // Hostname backend
          // Hostname backend
          port: backendConfig.port, // Port backend
          // Port backend
          path: '/api/nfc-cards/list?limit=1000', // Get ALL cards - ambil semua kartu dengan limit besar
          // Get ALL cards - ambil semua kartu dengan limit besar
          method: 'GET', // Method HTTP GET
          // Method HTTP GET
          protocol: backendConfig.protocol, // Protocol http/https
          // Protocol http/https
          headers: { // HTTP headers yang dikirim bersama request ke backend
            // HTTP headers yang dikirim bersama request ke backend
            'Content-Type': 'application/json', // Format JSON
            // Format JSON
            'ngrok-skip-browser-warning': 'true' // Lewati warning ngrok
            // Lewati warning ngrok
          }
        };

        console.log(`?? Fetching ALL NFC cards from: ${BACKEND_URL}/api/nfc-cards/list`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        const backendData = await makeHttpRequest(options); // Kirim request ke backend
        // Kirim request ke backend
        
        if (backendData.success) { // Jika backend berhasil
          // Jika backend berhasil
          console.log(`? Loaded ${backendData.cards?.length || 0} NFC cards from backend (Total in DB: ${backendData.total})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
            success: true, // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            // success: true menandakan operasi berhasil; frontend memeriksa field ini untuk menentukan apakah perlu tampilkan sukses atau error
            cards: backendData.cards || [], // Array kartu NFC
            // Array kartu NFC
            total: backendData.total || (backendData.cards?.length || 0) // Total kartu
            // Total kartu
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Failed to load cards'); // Error jika gagal
          // Error jika gagal
        }
      } catch (backendError) { // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        // menangkap error dari HTTP request ke backend; bisa karena network atau timeout
        console.error('? Backend get NFC cards error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        res.json({ // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          // res.json(): mengirim respons HTTP dengan Content-Type application/json; mengonversi objek JavaScript ke JSON string otomatis
          success: false, // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
          // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
          cards: [], // Kembalikan array kosong jika error
          // Kembalikan array kosong jika error
          error: `Backend error: ${backendError.message}`, // Pesan error
          // Pesan error
          total: 0 // Total 0 jika error
          // Total 0 jika error
        });
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get NFC cards error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ // mengirim response error 500 dengan detail error untuk debugging NFC cards endpoint
        // mengirim response error 500 dengan detail error untuk debugging NFC cards endpoint
        success: false, // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
        // success: false menandakan operasi gagal; frontend memeriksa field ini untuk menampilkan pesan error yang sesuai
        error: `Server error: ${error.message}`, // Pesan error server
        // Pesan error server
        cards: [], // Array kosong
        // Array kosong
        total: 0 // Total 0
        // Total 0
      });
    }
  }

  // Register new NFC card (POST /api/nfc-cards/register)
  async registerNFCCard(req, res) { // method async: endpoint POST /api/nfc-cards/register untuk mendaftarkan kartu NFC baru
    // method async: endpoint POST /api/nfc-cards/register untuk mendaftarkan kartu NFC baru
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, userId, cardType } = req.body; // Ambil data kartu dari request body
      // Ambil data kartu dari request body
      
      if (!cardId || !userId) { // Validasi field wajib
        // Validasi field wajib
        return res.status(400).json({ error: 'cardId and userId are required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      // Parse URL backend
      const postData = JSON.stringify({ cardId, userId, cardType: cardType || 'NTag215' }); // Serialize body request
      // Serialize body request
      
      const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        hostname: backendConfig.hostname, // Hostname backend
        // Hostname backend
        port: backendConfig.port, // Port backend
        // Port backend
        path: '/api/nfc-cards/register', // Endpoint register kartu
        // Endpoint register kartu
        method: 'POST', // Method HTTP POST
        // Method HTTP POST
        headers: { // HTTP headers yang dikirim bersama request ke backend
          // HTTP headers yang dikirim bersama request ke backend
          'Content-Type': 'application/json', // Format JSON
          // Format JSON
          'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
          // Lewati warning ngrok
          'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
          // Panjang body dalam bytes
        }
      };

      const backendData = await makeHttpRequest({ ...options, body: { cardId, userId, cardType: cardType || 'NTag215' } }); // Kirim request ke backend
      // Kirim request ke backend
      
      if (backendData.success) { // Jika pendaftaran berhasil
        // Jika pendaftaran berhasil
        console.log(`? Registered NFC card: ${cardId} for user ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend ke client
        // Teruskan response backend ke client
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
        // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Register NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to register NFC card' }); // response error 500 jika pendaftaran kartu NFC gagal
      // response error 500 jika pendaftaran kartu NFC gagal
    }
  }

  // Link NFC card to user (POST /api/nfc-cards/link)
  async linkNFCCard(req, res) { // method async: endpoint POST /api/nfc-cards/link untuk menghubungkan kartu ke user
    // method async: endpoint POST /api/nfc-cards/link untuk menghubungkan kartu ke user
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, userId } = req.body; // Ambil cardId dan userId dari request body
      // Ambil cardId dan userId dari request body
      
      if (!cardId || !userId) { // Validasi field wajib
        // Validasi field wajib
        return res.status(400).json({ error: 'cardId and userId are required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      // Parse URL backend
      const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        hostname: backendConfig.hostname, // Hostname backend
        // Hostname backend
        port: backendConfig.port, // Port backend
        // Port backend
        path: '/api/nfc-cards/link', // Endpoint link kartu ke user
        // Endpoint link kartu ke user
        method: 'POST', // Method HTTP POST
        // Method HTTP POST
        protocol: backendConfig.protocol, // Protocol http/https
        // Protocol http/https
        body: { cardId, userId } // Body request dengan cardId dan userId
        // Body request dengan cardId dan userId
      };

      const backendData = await makeHttpRequest(options); // Kirim request ke backend
      // Kirim request ke backend
      
      if (backendData.success) { // Jika linking berhasil
        // Jika linking berhasil
        console.log(`? Linked NFC card: ${cardId} to user ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend
        // Teruskan response backend
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
        // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Link NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to link NFC card' }); // response error 500 jika linking kartu ke user gagal
      // response error 500 jika linking kartu ke user gagal
    }
  }

  // Block NFC card (POST /api/nfc-cards/block)
  async blockNFCCard(req, res) { // method async: endpoint POST /api/nfc-cards/block untuk memblokir kartu NFC
    // method async: endpoint POST /api/nfc-cards/block untuk memblokir kartu NFC
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, reason } = req.body; // Ambil cardId dan alasan blokir dari request body
      // Ambil cardId dan alasan blokir dari request body
      
      if (!cardId) { // Validasi cardId wajib ada
        // Validasi cardId wajib ada
        return res.status(400).json({ error: 'cardId is required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      // Parse URL backend
      const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        hostname: backendConfig.hostname, // Hostname backend
        // Hostname backend
        port: backendConfig.port, // Port backend
        // Port backend
        path: '/api/nfc-cards/status', // Endpoint update status kartu
        // Endpoint update status kartu
        method: 'PUT', // Method HTTP PUT untuk update
        // Method HTTP PUT untuk update
        protocol: backendConfig.protocol, // Protocol http/https
        // Protocol http/https
        body: { cardId, status: 'BLOCKED', reason: reason || 'Blocked by admin' } // Body dengan status BLOCKED
        // Body dengan status BLOCKED
      };

      const backendData = await makeHttpRequest(options); // Kirim request ke backend
      // Kirim request ke backend
      
      if (backendData.success) { // Jika kartu berhasil diblokir
        // Jika kartu berhasil diblokir
        console.log(`? Blocked NFC card: ${cardId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend
        // Teruskan response backend
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
        // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Block NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to block NFC card' }); // response error 500 jika pemblokiran kartu NFC gagal
      // response error 500 jika pemblokiran kartu NFC gagal
    }
  }

  // Top-up NFC card balance (POST /api/nfc-cards/topup)
  async topupNFCCard(req, res) { // method async: endpoint POST /api/nfc-cards/topup untuk menambah saldo kartu NFC
    // method async: endpoint POST /api/nfc-cards/topup untuk menambah saldo kartu NFC
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, amount, adminPassword } = req.body; // Ambil cardId, amount, dan password dari request body
      // Ambil cardId, amount, dan password dari request body
      
      if (!cardId || !amount) { // Validasi field wajib
        // Validasi field wajib
        return res.status(400).json({ error: 'cardId and amount are required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      if (adminPassword !== ADMIN_PASSWORD) { // Validasi password admin
        // Validasi password admin
        return res.status(403).json({ error: 'Invalid admin password' }); // tolak dengan 403 Forbidden jika password admin tidak valid
        // tolak dengan 403 Forbidden jika password admin tidak valid
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      // Parse URL backend
      const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        hostname: backendConfig.hostname, // Hostname backend
        // Hostname backend
        port: backendConfig.port, // Port backend
        // Port backend
        path: '/api/nfc-cards/topup', // Endpoint top-up kartu
        // Endpoint top-up kartu
        method: 'POST', // Method HTTP POST
        // Method HTTP POST
        body: { cardId, amount, adminPassword } // Body request dengan data top-up
        // Body request dengan data top-up
      };

      const backendData = await makeHttpRequest(options); // Kirim request ke backend
      // Kirim request ke backend
      
      if (backendData.success) { // Jika top-up berhasil
        // Jika top-up berhasil
        console.log(`? Topped up NFC card: ${cardId} with ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend ke client
        // Teruskan response backend ke client
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
        // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Top-up NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to top-up NFC card' }); // response error 500 jika operasi top-up kartu NFC gagal
      // response error 500 jika operasi top-up kartu NFC gagal
    }
  }

  // Delete NFC card (DELETE /api/nfc-cards/:cardId)
  async deleteNFCCard(req, res) { // method async: endpoint DELETE /api/nfc-cards/:cardId untuk menghapus kartu NFC
    // method async: endpoint DELETE /api/nfc-cards/:cardId untuk menghapus kartu NFC
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId } = req.params; // Ambil cardId dari URL parameter
      // Ambil cardId dari URL parameter
      const { adminPassword } = req.body; // Ambil password admin dari request body
      // Ambil password admin dari request body
      
      if (!cardId) { // Validasi cardId wajib ada
        // Validasi cardId wajib ada
        return res.status(400).json({ error: 'cardId is required' }); // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
        // return + res.status: menghentikan eksekusi dan langsung mengirim response error 400 ke client
      }

      if (adminPassword !== ADMIN_PASSWORD) { // Validasi password admin
        // Validasi password admin
        return res.status(403).json({ error: 'Invalid admin password' }); // tolak dengan 403 Forbidden jika password admin tidak valid
        // tolak dengan 403 Forbidden jika password admin tidak valid
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      // Parse URL backend
      const bodyData = JSON.stringify({ adminPassword }); // Serialize body request
      // Serialize body request
      const options = { // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        // objek konfigurasi HTTP request yang dikirim ke backend; berisi semua parameter koneksi
        hostname: backendConfig.hostname, // Hostname backend
        // Hostname backend
        port: backendConfig.port, // Port backend
        // Port backend
        path: `/api/nfc-cards/delete/${cardId}`, // Path dengan card ID yang akan dihapus
        // Path dengan card ID yang akan dihapus
        method: 'DELETE', // Method HTTP DELETE
        // Method HTTP DELETE
        protocol: backendConfig.protocol, // Protocol http/https
        // Protocol http/https
        headers: { // HTTP headers yang dikirim bersama request ke backend
          // HTTP headers yang dikirim bersama request ke backend
          'Content-Type': 'application/json', // Format JSON
          // Format JSON
          'Content-Length': Buffer.byteLength(bodyData), // Panjang body dalam bytes
          // Panjang body dalam bytes
          'ngrok-skip-browser-warning': 'true' // Lewati warning ngrok
          // Lewati warning ngrok
        },
        body: { adminPassword } // Include body for DELETE request - sertakan password di body
        // Include body for DELETE request - sertakan password di body
      };

      console.log(`??? Attempting to delete card ${cardId} from backend...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Admin password check: ${adminPassword === ADMIN_PASSWORD ? 'VALID' : 'INVALID'}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Sending to: ${backendConfig.hostname}${options.path}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Body:`, options.body); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      const backendData = await makeHttpRequest(options); // Kirim request DELETE ke backend
      // Kirim request DELETE ke backend
      
      if (backendData.success) { // Jika penghapusan berhasil
        // Jika penghapusan berhasil
        console.log(`??? Deleted NFC card: ${cardId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend ke client
        // Teruskan response backend ke client
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
        // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Delete NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to delete NFC card' }); // response error 500 jika operasi hapus kartu NFC gagal
      // response error 500 jika operasi hapus kartu NFC gagal
    }
  }

  //
  // start()
  // FUNGSI: Start Express server dan listen on PORT
  //
  // STARTUP INFO:
  // - Server listen di port 3000
  // - Display dashboard URL
  // - Display backend connection info
  // - Display ngrok URL untuk mobile app
  // - Display usage instructions
  //
  // STARTUP SEQUENCE:
  // 1. app.listen(PORT) ? Start HTTP server
  // 2. Start cleanup timer (already called in constructor)
  // 3. Display startup info ke console
  //
  // CONSOLE OUTPUT:
  // ?? Simple NFC Payment Admin started!
  // ?? Dashboard: http://localhost:3000
  //
  // ?? Backend Connection:
  //    ?? Ngrok URL: https://xxx.ngrok-free.dev
  //
  // ?? Cara menggunakan:
  //    1. Pastikan ngrok tunnel aktif
  //    2. Aplikasi Android connect ke ngrok URL
  //    3. Monitor dari dashboard
  //
  // ?? Setup:
  //    - Backend: node server.js (port 4000)
  //    - Ngrok: ngrok http 4000
  //    - Admin: node simple-admin.js (port 3000)
  start() { // method sync: memulai Express server listening pada PORT dan menampilkan info startup ke console
    // method sync: memulai Express server listening pada PORT dan menampilkan info startup ke console
    this.app.listen(PORT, () => { // Listen di port 3000 dan mulai menerima koneksi
      // Listen di port 3000 dan mulai menerima koneksi
      console.log('?? Simple NFC Payment Admin started!'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Dashboard: http://localhost:${PORT}`); // URL dashboard admin
      // URL dashboard admin
      console.log(''); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('?? Backend Connection:'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   ?? Ngrok URL: ${NGROK_URL}`); // URL ngrok yang digunakan
      // URL ngrok yang digunakan
      console.log(''); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('?? Cara menggunakan:'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('   1. Pastikan ngrok tunnel aktif di terminal lain'); // Langkah 1
      // Langkah 1
      console.log('   2. Aplikasi Android connect ke ngrok URL'); // Langkah 2
      // Langkah 2
      console.log('   3. Monitor pengguna dan transaksi dari dashboard ini'); // Langkah 3
      // Langkah 3
      console.log(''); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('?? Setup:'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('   - Backend: node server.js (port 4000)'); // Perintah menjalankan backend
      // Perintah menjalankan backend
      console.log('   - Ngrok: ngrok http 4000'); // Perintah menjalankan ngrok
      // Perintah menjalankan ngrok
      console.log('   - Admin: node simple-admin.js (port 3000)'); // Perintah menjalankan admin
      // Perintah menjalankan admin
    });

    // Cleanup timer sudah distart di constructor � tidak perlu dipanggil lagi di sini
  }
}

// ==================== START SERVER ====================
// Buat instance admin server dan jalankan
const admin = new SimpleNFCAdmin(); // buat instance tunggal admin server; constructor otomatis inisialisasi semua komponen
// buat instance tunggal admin server; constructor otomatis inisialisasi semua komponen
admin.start(); // jalankan server: mulai listen port 3000 dan tampilkan info startup di console
// jalankan server: mulai listen port 3000 dan tampilkan info startup di console
