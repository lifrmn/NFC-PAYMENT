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
const cors = require('cors'); // Izinkan akses dari domain berbeda (HP ke laptop)
const path = require('path'); // Manipulasi path file
const os = require('os'); // Info sistem operasi (untuk ambil IP)
const helmet = require('helmet'); // Security headers untuk proteksi
const http = require('http'); // HTTP client untuk fetch backend
const https = require('https'); // HTTPS client untuk fetch backend

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
const APP_SECRET = 'NFC2025SecureApp'; // Secret key aplikasi (untuk validasi)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Password admin untuk top-up saldo

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
const NGROK_URL = 'https://unbellicose-troublesomely-miley.ngrok-free.dev'; // URL ngrok untuk mobile app

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
function parseBackendUrl() {
  try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
    const url = new URL(BACKEND_URL); // Parse string URL menjadi objek URL
    return {
      hostname: url.hostname, // Ambil hostname (misal: 'localhost')
      port: url.port || (url.protocol === 'https:' ? 443 : 80), // Gunakan port dari URL, fallback ke 443/80
      protocol: url.protocol.replace(':', '') // Hapus titik dua di akhir ('http:' ? 'http')
    };
  } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
    // Fallback ke localhost jika URL tidak valid
    return {
      hostname: 'localhost', // Default hostname
      port: 4000, // Default port backend
      protocol: 'http' // Default protocol
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
function makeHttpRequest(options) {
  return new Promise((resolve, reject) => {
    // Determine which client to use based on protocol
    const isHttps = options.protocol === 'https' || options.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // Remove protocol and body from options untuk client.request()
    const requestOptions = { ...options };
    delete requestOptions.protocol;
    delete requestOptions.body;
    
    const req = client.request(requestOptions, (response) => {
      let data = ''; // Buffer untuk menampung potongan data response
      
      response.on('data', (chunk) => { // Event saat potongan data masuk
        data += chunk; // Gabungkan potongan ke buffer
      });
      
      response.on('end', () => { // Event saat seluruh response sudah diterima
        // Check if response is HTML (ngrok error page)
        if (data.trim().startsWith('<') || data.includes('<!DOCTYPE')) { // Deteksi halaman HTML (bukan JSON)
          console.error('? Received HTML instead of JSON (ngrok might be down or URL changed)'); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          reject(new Error('Backend returned HTML instead of JSON. Check if ngrok is running and URL is correct.'));
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }

        // Check if response is empty
        if (!data || data.trim().length === 0) { // Response kosong tidak bisa di-parse
          console.error('? Received empty response from backend'); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          reject(new Error('Backend returned empty response'));
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }

        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          const jsonData = JSON.parse(data); // Parse string JSON menjadi objek JavaScript
          resolve(jsonData); // Selesaikan Promise dengan data hasil parse
        } catch (parseError) {
          console.error('? JSON parse error:', parseError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
          console.error('? Response data preview:', data.substring(0, 200)); // Tampilkan 200 karakter awal untuk debug
          reject(new Error(`Invalid JSON response: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => { // Event saat terjadi error koneksi HTTP
      console.error('? HTTP request error:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      reject(error); // Selesaikan Promise dengan error
    });

    req.setTimeout(10000, () => { // Timeout 10 detik untuk menghindari request yang hang
      req.destroy(); // Hancurkan request yang melewati batas waktu
      reject(new Error('Request timeout after 10 seconds'));
    });

    if (options.body) { // Jika ada body data (POST/PUT/DELETE request)
      const bodyData = JSON.stringify(options.body); // Serialize body ke JSON string
      console.log(`?? Writing body to request:`, bodyData); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      req.setHeader('Content-Length', Buffer.byteLength(bodyData)); // Set header Content-Length
      req.write(bodyData); // Tulis body ke stream request
    }
    req.end(); // Akhiri request dan kirim ke server
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
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces(); // Ambil semua network interface
  const ips = []; // Array untuk menyimpan IP
  
  // Loop semua network interface
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip localhost dan ambil hanya IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address); // Tambah IP ke array
      }
    }
  }
  
  return ips; // Return array IP address
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
function isValidAppRequest(req) {
  const appKey = req.headers['x-app-key']; // Ambil app key dari header
  const userAgent = req.headers['user-agent']; // Ambil user agent
  
  // Cek key aplikasi (harus sama dengan APP_SECRET)
  if (appKey !== APP_SECRET) {
    return false; // Tolak jika key salah
  }
  
  // Cek user agent (harus dari okhttp = Android app)
  if (!userAgent || !userAgent.includes('okhttp')) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    return false; // Tolak jika bukan dari Android
  }
  
  return true; // Lolos validasi
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
function protectAPI(req, res, next) {
  // Skip proteksi untuk dashboard HTML (halaman utama)
  if (req.method === 'GET' && req.path === '/') {
    return next(); // Lanjut tanpa validasi
  }
  
  // Skip proteksi untuk file static (CSS, JS, images)
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return next(); // Lanjut tanpa validasi
  }
  
  // BYPASS PROTEKSI untuk admin endpoints dari localhost/dashboard
  // Allow all local network IPs (10.x.x.x, 192.168.x.x, 172.16.x.x, 169.254.x.x, localhost)
  const ipStr = req.ip || '';
  const isLocalNetwork = 
    ipStr.includes('127.0.0.1') || 
    ipStr.includes('::1') || 
    ipStr.includes('192.168.') || 
    ipStr.includes('10.') || 
    ipStr.includes('172.16.') ||
    ipStr.includes('172.17.') ||
    ipStr.includes('172.18.') ||
    ipStr.includes('172.19.') ||
    ipStr.includes('172.20.') ||
    ipStr.includes('172.21.') ||
    ipStr.includes('172.22.') ||
    ipStr.includes('172.23.') ||
    ipStr.includes('172.24.') ||
    ipStr.includes('172.25.') ||
    ipStr.includes('172.26.') ||
    ipStr.includes('172.27.') ||
    ipStr.includes('172.28.') ||
    ipStr.includes('172.29.') ||
    ipStr.includes('172.30.') ||
    ipStr.includes('172.31.') ||
    ipStr.includes('169.254.'); // Link-local address
    
  if (req.path.startsWith('/api/') && isLocalNetwork) {
    console.log(`? Admin dashboard access allowed from ${req.ip} to ${req.path}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    return next(); // Lanjut tanpa validasi untuk admin dashboard
  }
  
  // Validasi untuk semua API endpoints dari external sources (/api/*)
  if (req.path.startsWith('/api/')) {
    if (!isValidAppRequest(req)) { // Cek apakah request valid
      console.log(`?? Unauthorized access blocked from ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return res.status(401).json({ error: 'Akses ditolak - Bukan aplikasi resmi' });
    }
  }
  
  console.log(`? Valid app request from ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
  next(); // Lanjut ke endpoint
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
class SimpleNFCAdmin {
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
  constructor() {
    this.app = express(); // Inisialisasi Express server
    this.devices = new Map(); // Menyimpan data semua device (key: deviceId)
    this.pendingUpdates = new Map(); // Queue update balance yang belum terkirim
    this.deviceLastSeen = new Map(); // Track waktu terakhir device sync
    this.fraudAlerts = new Map(); // Menyimpan semua fraud alerts dari AI
    this.fraudStats = { // Statistik fraud detection
      totalAlerts: 0, // Total alert yang masuk
      blockedTransactions: 0, // Transaksi yang diblokir
      reviewTransactions: 0, // Transaksi yang perlu review
      lastAlert: null // Waktu alert terakhir
    };
    this.setupExpress(); // Setup routes dan middleware
    this.startCleanupTimer(); // Start timer untuk hapus device offline
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
  setupExpress() {
    // Security headers dengan Helmet (proteksi dari serangan web)
    this.app.use(helmet({
      contentSecurityPolicy: false, // Dimatikan agar dashboard jalan
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS: Izinkan akses dari semua origin (HP bisa akses)
    this.app.use(cors({
      origin: '*', // Semua origin boleh (diperlukan untuk mobile app)
      methods: ['GET', 'POST', 'PUT', 'DELETE'], // Method yang diizinkan
      allowedHeaders: ['Content-Type', 'x-app-key', 'user-agent'] // Header yang diizinkan
    }));
    
    this.app.use(express.json({ limit: '1mb' })); // Parse JSON body (max 1MB)
    
    // Middleware keamanan: Validasi app key untuk API
    this.app.use(protectAPI);
    
    // Middleware logging: Catat semua request yang masuk
    this.app.use((req, res, next) => {
      console.log(`?? ${req.method} ${req.path} from ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      next(); // Lanjut ke route handler
    });
    
    // Serve file static (HTML, CSS, JS dashboard)
    this.app.use(express.static(__dirname));
    
    // ==================== ROUTES ====================
    // Route utama: Tampilkan dashboard HTML (unified dashboard dengan tab navigation)
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'dashboard.html'));
    });
    
    // ==================== API ENDPOINTS ====================
    // (Sudah diproteksi oleh middleware protectAPI)
    
    // Device endpoints
    this.app.get('/api/devices', this.getDevices.bind(this)); // Get semua device
    this.app.post('/api/sync-device', this.syncDevice.bind(this)); // Sync data dari HP
    this.app.post('/api/update-balance', this.updateBalanceSecure.bind(this)); // Top-up saldo
    
    // Fraud detection endpoints
    this.app.post('/api/fraud-alert', this.handleFraudAlert.bind(this)); // Terima fraud alert dari AI
    this.app.get('/api/fraud-alerts', this.getFraudAlerts.bind(this)); // Get fraud alerts
    this.app.get('/api/transactions', this.getAllTransactions.bind(this)); // Get semua transaksi
    
    // User management endpoints
    this.app.get('/api/users', this.getUsersEndpoint.bind(this)); // Get semua user
    this.app.post('/api/users', this.createUserEndpoint.bind(this)); // Create user baru
    this.app.put('/api/users/:id', this.updateUserEndpoint.bind(this)); // Update user
    this.app.delete('/api/users/:id', this.deleteUserEndpoint.bind(this)); // Delete user
    
    // Admin action endpoints
    this.app.post('/api/block-user', this.blockUserEndpoint.bind(this)); // Block user
    this.app.post('/api/unblock-user', this.unblockUserEndpoint.bind(this)); // Unblock user
    this.app.post('/api/bulk-topup', this.bulkTopupEndpoint.bind(this)); // Bulk top-up
    this.app.post('/api/reset-balance', this.resetBalanceEndpoint.bind(this)); // Reset user balance
    this.app.post('/api/clear-fraud-alerts', this.clearFraudAlertsEndpoint.bind(this)); // Clear alerts
    
    // NFC Card management endpoints
    this.app.get('/api/nfc-cards', this.getNFCCards.bind(this)); // Get all NFC cards
    this.app.post('/api/nfc-cards/register', this.registerNFCCard.bind(this)); // Register new card
    this.app.post('/api/nfc-cards/link', this.linkNFCCard.bind(this)); // Link card to user
    this.app.post('/api/nfc-cards/block', this.blockNFCCard.bind(this)); // Block card
    this.app.post('/api/nfc-cards/topup', this.topupNFCCard.bind(this)); // Topup card balance
    this.app.delete('/api/nfc-cards/:cardId', this.deleteNFCCard.bind(this)); // Delete card
    
    // Ping endpoint (penting untuk APK agar bisa deteksi server)
    this.app.get('/api/ping', (req, res) => {
      res.json({ 
        status: 'ok', // Status server
        timestamp: new Date().toISOString(), // Waktu sekarang
        server: 'NFC Payment Admin Server', // Nama server
        version: '1.0.0', // Versi server
        uptime: process.uptime() // Lama server sudah jalan (dalam detik)
      });
    });
    
    // Health check endpoint (untuk cek kesehatan server)
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'OK', // Status server
        timestamp: new Date().toISOString(), // Waktu sekarang
        devices: this.devices.size, // Jumlah device terkoneksi
        pendingUpdates: this.pendingUpdates.size, // Jumlah update balance pending
        fraudAlerts: this.fraudAlerts.size, // Jumlah fraud alerts
        fraudStats: this.fraudStats // Statistik fraud detection
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
  async syncDevice(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { device, users, recentTransactions, stats } = req.body; // Ambil data dari request
      
      // Validasi: deviceId wajib ada
      if (!device || !device.deviceId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Device ID is required' });
      }

      const now = new Date(); // Waktu sekarang
      
      // Simpan data device ke Map (deviceId sebagai key)
      this.devices.set(device.deviceId, {
        deviceId: device.deviceId, // ID unik device (dari HP)
        deviceName: device.deviceName || `Android Device ${device.deviceId.slice(-6)}`, // Nama device
        platform: device.platform || 'android', // Platform (android/ios)
        users: users || [], // Array semua user di device ini
        recentTransactions: recentTransactions || [], // Transaksi terbaru
        stats: stats || {}, // Statistik (total user, balance, dll)
        totalUsers: stats?.totalUsers || 0, // Total user
        totalBalance: stats?.totalBalance || 0, // Total saldo semua user
        totalTransactions: recentTransactions?.length || 0, // Total transaksi
        lastSync: now.toISOString(), // Waktu sync terakhir (string)
        lastSyncAt: now, // Waktu sync terakhir (Date object)
        isOnline: true, // Status online
        ipAddress: req.ip || req.connection.remoteAddress // IP address HP
      });

      // Update waktu terakhir device terlihat
      this.deviceLastSeen.set(device.deviceId, now);

      console.log(`?? Device sync: ${device.deviceId.slice(-8)} | Users: ${stats?.totalUsers || 0} | Balance: Rp ${(stats?.totalBalance || 0).toLocaleString('id-ID')} | IP: ${req.ip}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      // Cek apakah ada update balance yang menunggu (pending)
      const pendingUpdates = this.getPendingUpdates(device.deviceId);
      
      // Kirim response ke HP dengan info sync berhasil
      res.json({
        success: true, // Status berhasil
        message: 'Device synced successfully', // Pesan sukses
        balanceUpdates: pendingUpdates, // Kirim update balance (jika ada)
        deviceId: device.deviceId, // Echo deviceId
        timestamp: now.toISOString() // Timestamp sync
      });

      // Hapus pending updates setelah dikirim ke HP
      this.clearPendingUpdates(device.deviceId);
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Sync error:', error); // Log error
      res.status(500).json({ error: error.message }); // Kirim error response
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
  //   ...
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
  async getDevices(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // AMBIL DATA USER DARI BACKEND (hitung user unik saja)
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl();
        const options = {
          hostname: backendConfig.hostname,
          port: backendConfig.port,
          path: '/api/debug/users', // Endpoint user backend
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-app-key': 'NFC2025SecureApp',
            'ngrok-skip-browser-warning': 'true'
          }
        };

        const backendData = await new Promise((resolve, reject) => {
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih client http/https
          const req = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk data
            
            response.on('data', (chunk) => { // Event tiap ada potongan data masuk
              data += chunk; // Tambahkan chunk ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai diterima
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON string menjadi objek
                resolve(jsonData); // Selesaikan Promise dengan data hasil parse
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event saat terjadi error koneksi
            reject(error); // Reject Promise dengan error koneksi
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            req.destroy(); // Batalkan request yang melebihi batas waktu
            reject(new Error('Timeout')); // Reject dengan error timeout
          });
          
          req.end(); // Kirim request ke backend
        });
        
        if (backendData && backendData.users) {
          // Transform user data to dashboard format (user = device)
          const uniqueUsers = new Map();
          
          backendData.users.forEach(user => {
            const userKey = user.username || user.name || `user_${user.id}`;
            if (!uniqueUsers.has(userKey)) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
              uniqueUsers.set(userKey, {
                deviceId: user.deviceId || `user_${user.id}`,
                deviceName: userKey,
                isOnline: true,
                lastSeen: user.updatedAt || user.createdAt,
                totalUsers: 1, // Setiap user = 1 user
                totalBalance: user.balance || 0,
                totalTransactions: 0, // Reset karena tidak ada data transaksi
                ipAddress: '192.168.137.51',
                platform: 'android'
              });
            }
          });
          
          const devices = Array.from(uniqueUsers.values());
          console.log(`?? API call: /api/devices - Returning ${devices.length} unique users from backend`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          res.json(devices);
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }
        
      } catch (backendError) {
        console.error('? Backend users error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      }
      
      // FALLBACK: Use local device cache
      const now = new Date(); // Waktu sekarang
      // Convert Map ke Array dan tambah status online
      const devices = Array.from(this.devices.values()).map(device => {
        // Device online jika sync dalam 5 menit terakhir
        const isOnline = (now - new Date(device.lastSyncAt)) < 300000; // 5 menit = 300000 ms
        
        // Return object device dengan semua info
        return {
          deviceId: device.deviceId, // ID device
          deviceName: device.deviceName, // Nama device
          platform: device.platform, // Platform (android)
          totalUsers: device.totalUsers || 0, // Total user
          totalBalance: device.totalBalance || 0, // Total saldo
          totalTransactions: device.totalTransactions || 0, // Total transaksi
          lastSync: device.lastSync, // Waktu sync (string)
          lastSyncAt: device.lastSyncAt, // Waktu sync (Date)
          isOnline: isOnline, // Status online/offline
          ipAddress: device.ipAddress, // IP address HP
          users: device.users || [] // Array user di device
        };
      });

      console.log(`?? API call: /api/devices (fallback) - Returning ${devices.length} devices from cache`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      res.json(devices); // Kirim array devices ke dashboard
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get devices error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: error.message });
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
  async updateBalanceSecure(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { deviceId, amount, adminPassword } = req.body; // Ambil data dari request
      const clientIP = req.ip || req.connection.remoteAddress; // IP address admin
      
      // Validasi password admin (keamanan sederhana)
      if (adminPassword !== ADMIN_PASSWORD) {
        console.log(`?? Wrong admin password from ${clientIP}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(401).json({ error: 'Password admin salah!' });
      }
      
      // Validasi deviceId dan amount harus ada dan valid
      if (!deviceId || !amount || amount <= 0) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Device ID dan jumlah saldo harus diisi!' });
      }

      // Batasi maksimal top-up per transaksi (Rp 500.000)
      if (amount > 500000) {
        return res.status(400).json({ error: 'Maksimal top-up Rp 500,000' });
      }

      // Cari device berdasarkan deviceId
      const device = this.devices.get(deviceId);
      if (!device || !device.users) { // Jika device tidak ditemukan
        return res.status(404).json({ error: 'Device tidak ditemukan' });
      }

      // Queue balance update untuk setiap user di device ini
      device.users.forEach(user => {
        const updateKey = `${deviceId}_${user.id}`; // Key unik: deviceId_userId
        this.pendingUpdates.set(updateKey, { // Simpan ke pending updates
          deviceId, // ID device target
          userId: user.id, // ID user target
          newBalance: user.balance + amount, // Balance baru (balance lama + amount)
          reason: `Admin top-up: +${amount}`, // Alasan update
          timestamp: new Date().toISOString() // Waktu update
        });
      });

      console.log(`?? Admin added Rp ${amount.toLocaleString('id-ID')} to device ${deviceId.substring(0, 8)}... for ${device.users.length} users`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({
        success: true,
        message: `Berhasil menambah saldo Rp ${amount.toLocaleString('id-ID')} untuk ${device.users.length} users`, // .toLocaleString() memformat angka sesuai locale Indonesia (titik sebagai pemisah ribuan)
        usersUpdated: device.users.length
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Update balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
  }

  // Update balance user dari admin - LEGACY (akan dihapus)
  async updateBalance(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { deviceId, amount } = req.body; // Ambil deviceId dan amount dari request body
      
      if (!deviceId || !amount) { // Validasi field wajib
        return res.status(400).json({ error: 'Missing deviceId or amount' });
      }

      // Simpan update untuk semua user di device ini
      const device = this.devices.get(deviceId); // Cari device di cache
      if (!device || !device.users) { // Device tidak ditemukan
        return res.status(404).json({ error: 'Device not found or no users' });
      }

      // Queue balance update untuk setiap user di device
      device.users.forEach(user => { // Loop setiap user di device
        const updateKey = `${deviceId}_${user.id}`; // Buat key unik per user per device
        this.pendingUpdates.set(updateKey, { // Simpan update ke Map pending updates
          deviceId, // ID device target
          userId: user.id, // ID user yang di-update
          newBalance: user.balance + amount, // Tambahkan ke balance saat ini
          reason: `Admin top-up: +${amount}`, // Alasan update
          timestamp: new Date().toISOString() // Waktu update
        });
      });

      console.log(`?? Balance update queued for device ${deviceId.substring(0, 8)}... | Amount: +${amount} for ${device.users.length} users`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({ // Kirim response sukses ke client
        success: true,
        message: `Balance update queued for ${device.users.length} users`,
        usersUpdated: device.users.length // Jumlah user yang di-update
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Update balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: error.message });
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
  getPendingUpdates(deviceId) {
    const updates = []; // Array untuk menyimpan updates
    // Loop semua pending updates
    for (const [key, update] of this.pendingUpdates.entries()) {
      if (update.deviceId === deviceId) { // Jika deviceId cocok
        updates.push(update); // Tambahkan ke array
      }
    }
    return updates; // Return array updates
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
  clearPendingUpdates(deviceId) {
    // Loop semua pending updates
    for (const [key, update] of this.pendingUpdates.entries()) {
      if (update.deviceId === deviceId) { // Jika deviceId cocok
        this.pendingUpdates.delete(key); // Hapus dari Map
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
  startCleanupTimer() {
    setInterval(() => { // Jalankan tiap 5 menit
      const now = new Date(); // Waktu sekarang
      for (const [deviceId, device] of this.devices.entries()) {
        // Hapus device yang offline lebih dari 10 menit
        if ((now - device.lastSyncAt) > 600000) { // 10 menit = 600000 ms
          this.devices.delete(deviceId); // Hapus dari Map
          console.log(`??? Removed inactive device: ${deviceId.substring(0, 8)}...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        }
      }
    }, 300000); // Check tiap 5 menit = 300000 ms
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
  async handleFraudAlert(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { device, fraudDetection } = req.body; // Ambil data fraud dari HP
      
      // Validasi: fraud data wajib ada
      if (!fraudDetection) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Fraud detection data required' });
      }

      if (!device || !device.deviceId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Device data required' });
      }

      const alertId = `fraud_${Date.now()}_${device.deviceId}`; // Generate ID unik
      const fraudAlert = { // Buat object fraud alert
        id: alertId, // ID alert
        deviceId: device.deviceId, // ID device yang kirim alert
        deviceName: device.deviceName, // Nama device
        riskScore: fraudDetection.riskScore, // Z-Score aktual (nilai float, misal: 2.6333)
        riskLevel: fraudDetection.riskLevel, // Level risiko (NORMAL/SUSPICIOUS/ANOMALY)
        decision: fraudDetection.decision, // Keputusan AI (ALLOW/REVIEW/BLOCK)
        reasons: fraudDetection.reasons, // Alasan-alasan fraud (array)
        confidence: fraudDetection.confidence, // Confidence AI (0-1)
        riskFactors: fraudDetection.riskFactors, // Faktor risiko detail
        transactionId: fraudDetection.transactionId, // ID transaksi
        timestamp: fraudDetection.timestamp, // Waktu fraud terdeteksi
        ipAddress: req.ip, // IP address HP
        status: 'NEW' // Status alert (NEW/REVIEWED/RESOLVED)
      };

      // Simpan fraud alert ke Map
      this.fraudAlerts.set(alertId, fraudAlert);

      // Update statistik fraud
      this.fraudStats.totalAlerts++; // Tambah total alerts
      this.fraudStats.lastAlert = new Date().toISOString(); // Update waktu alert terakhir
      
      // Update counter berdasarkan decision AI
      if (fraudDetection.decision === 'BLOCK') {
        this.fraudStats.blockedTransactions++; // Tambah blocked transactions
      } else if (fraudDetection.decision === 'REVIEW') { // else if: kondisi alternatif yang diperiksa jika kondisi if sebelumnya tidak terpenuhi
        this.fraudStats.reviewTransactions++; // Tambah review transactions
      }

      console.log(`?? FRAUD ALERT: ${fraudDetection.riskLevel} risk (Z=${fraudDetection.riskScore}) from device ${device.deviceId.slice(-8)}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   Decision: ${fraudDetection.decision}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   Reasons: ${Array.isArray(fraudDetection.reasons) ? fraudDetection.reasons.join(', ') : fraudDetection.reasons}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   Confidence: ${Math.round(fraudDetection.confidence * 100)}%`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({
        success: true,
        message: 'Fraud alert received and stored',
        alertId: alertId
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Fraud alert error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to process fraud alert' });
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
  async getFraudAlerts(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Ambil semua alerts, sort terbaru di atas, ambil 50 teratas
      const alerts = Array.from(this.fraudAlerts.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort descending
        .slice(0, 50); // Max 50 alerts

      res.json({
        success: true,
        alerts: alerts,
        stats: this.fraudStats,
        timestamp: new Date().toISOString() // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get fraud alerts error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to get fraud alerts' });
    }
  }

  // Get semua transaksi dari semua device (GET /api/transactions)
  async getAllTransactions(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const limit = parseInt(req.query.limit) || 50; // Limit hasil (default 50)
      const riskLevel = req.query.riskLevel; // Filter by risk level (optional)
      
      // Kumpulkan transaksi dari semua device
      let allTransactions = [];
      
      // Loop semua device dan ambil transactionnya
      for (const [deviceId, deviceData] of this.devices.entries()) {
        // Jika device punya transaksi
        if (deviceData.recentTransactions && deviceData.recentTransactions.length > 0) {
          // Tambah info device ke setiap transaksi
          const txsWithDevice = deviceData.recentTransactions.map(tx => ({
            ...tx, // Copy semua property transaksi
            deviceId: deviceId, // Tambah deviceId
            deviceName: deviceData.deviceName // Tambah deviceName
          }));
          allTransactions = allTransactions.concat(txsWithDevice); // Gabungkan
        }
      }

      // Sort transaksi berdasarkan waktu (terbaru di atas)
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0); // Parse tanggal A
        const dateB = new Date(b.createdAt || 0); // Parse tanggal B
        return dateB - dateA; // Sort descending (terbaru dulu)
      });

      // Filter berdasarkan risk level jika ada parameter
      if (riskLevel && riskLevel !== 'ALL') {
        allTransactions = allTransactions.filter(tx => tx.fraudRiskLevel === riskLevel);
      }

      // Batasi jumlah hasil sesuai limit
      const limitedTransactions = allTransactions.slice(0, limit);

      // Calculate statistics
      const stats = {
        total: allTransactions.length,
        anomaly: allTransactions.filter(tx => tx.fraudRiskLevel === 'ANOMALY').length,
        suspicious: allTransactions.filter(tx => tx.fraudRiskLevel === 'SUSPICIOUS').length,
        normal: allTransactions.filter(tx => tx.fraudRiskLevel === 'NORMAL').length,
        averageRiskScore: allTransactions.length > 0 
          ? allTransactions.reduce((sum, tx) => sum + (tx.fraudRiskScore || 0), 0) / allTransactions.length 
          : 0
      };

      console.log(`?? Transactions requested: ${limitedTransactions.length} of ${allTransactions.length} total`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      res.json({
        success: true,
        transactions: limitedTransactions,
        stats: stats,
        total: allTransactions.length,
        showing: limitedTransactions.length
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get transactions error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to get transactions' });
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
  async getUsersEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // GUNAKAN HTTP MODULE BAWAAN NODE.JS (bukan fetch)
      const backendUrl = `${BACKEND_URL}/api/debug/users`;
      
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // HTTP request menggunakan module bawaan Node.js
        const backendData = await new Promise((resolve, reject) => {
          // Select correct client based on protocol
          const backendConfig = parseBackendUrl();
          const client = backendConfig.protocol === 'https' ? https : http;
          
          const request = client.get(backendUrl, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
              data += chunk;
            });
            
            response.on('end', () => {
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
                resolve(jsonData);
              } catch (parseError) {
                reject(parseError);
              }
            });
          });
          
          request.on('error', (error) => {
            reject(error);
          });
          
          request.setTimeout(5000, () => {
            request.destroy();
            reject(new Error('Timeout'));
          });
        });
        
        console.log(`? Loaded ${backendData.users?.length || 0} users from backend database`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        // Format untuk dashboard display
        const formattedData = {
          success: true,
          users: backendData.users.map(user => ({
            ...user,
            balance: parseInt(user.balance), // Convert BigInt ke number
            lastSeen: user.updatedAt, // Gunakan updatedAt sebagai lastSeen
            status: user.isActive ? 'Active' : 'Inactive'
          })),
          total: backendData.total
        };
        
        return res.json(formattedData);
        
      } catch (backendError) {
        console.log('?? Backend tidak tersedia, gunakan cache device:', backendError.message); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }
      
      // FALLBACK: Ambil dari device cache jika backend error
      const allUsers = []; // Array untuk menyimpan semua user
      
      // Extract users dari semua device
      this.devices.forEach((deviceData, deviceId) => {
        if (deviceData.users) { // Jika device punya users
          deviceData.users.forEach(user => {
            // Cek duplikat berdasarkan ID (hindari user duplikat)
            if (!allUsers.find(u => u.id === user.id)) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
              allUsers.push({ // Tambahkan user ke array
                ...user, // Copy semua property user
                deviceId: deviceId, // Tambah info deviceId
                deviceName: deviceData.deviceName, // Tambah info deviceName
                status: user.isActive ? 'Active' : 'Inactive'
              });
            }
          });
        }
      });

      // Kirim response dengan array users
      res.json({
        success: true,
        users: allUsers, // Array semua user
        total: allUsers.length // Total user
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get users error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  // Create user baru (POST /api/users) - Belum diimplementasi
  async createUserEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { username, name, password, balance = 1000000 } = req.body; // Ambil data user dari request body
      
      // Validasi input wajib
      if (!username || !name || !password) { // Semua field wajib diisi
        return res.status(400).json({ error: 'Username, name, and password required' });
      }

      // TODO: Implementasi logic create user
      // Ini harus terintegrasi dengan backend database (Prisma)
      console.log('?? Create user requested:', { username, name, balance }); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      res.json({ // Kirim response sementara (belum terintegrasi)
        success: true,
        message: 'User creation endpoint ready - needs backend integration',
        data: { username, name, balance } // Echo data yang diterima
      });

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Create user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  // Update user (PUT /api/users/:id) - Integrasi dengan backend
  async updateUserEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const userId = parseInt(req.params.id); // Ambil user ID dari URL
      const { balance, name } = req.body; // Ambil data update
      
      // Validasi userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'User ID required' });
      }

      // Kirim update ke backend
      const backendUrl = `${BACKEND_URL}/api/users/${userId}`; // URL endpoint backend untuk update user
      
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendData = await new Promise((resolve, reject) => {
          const postData = JSON.stringify({ balance, name }); // Serialize body request ke JSON
          
          const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
          const options = {
            hostname: backendConfig.hostname, // Hostname backend
            port: backendConfig.port, // Port backend
            path: `/api/users/${userId}`, // Path endpoint dengan user ID
            method: 'PUT', // Method HTTP PUT untuk update
            headers: {
              'Content-Type': 'application/json', // Format body JSON
              'Content-Length': Buffer.byteLength(postData), // Panjang body dalam bytes
              'ngrok-skip-browser-warning': 'true' // Header untuk melewati warning ngrok
            }
          };
          
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const request = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          request.on('error', (error) => { // Event error koneksi
            reject(error); // Reject Promise dengan error
          });
          
          request.setTimeout(5000, () => { // Timeout 5 detik
            request.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          request.write(postData); // Tulis body JSON ke request
          request.end(); // Kirim request ke backend
        });
        
        console.log(`? Updated user ${userId} in backend`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Kirim response backend langsung ke client
        
      } catch (backendError) {
        console.error('Backend update error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        res.status(500).json({ error: 'Failed to update user in backend' });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Update user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  // Delete user (DELETE /api/users/:id) - Integrasi dengan backend
  async deleteUserEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const userId = parseInt(req.params.id); // Ambil user ID dari URL
      
      console.log(`??? DELETE request for user ID: ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      // Validasi userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.log('? No user ID provided'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return res.status(400).json({ error: 'User ID required' });
      }

      // Parse backend URL
      const backendConfig = parseBackendUrl();
      console.log(`?? Connecting to backend: ${backendConfig.protocol}://${backendConfig.hostname}:${backendConfig.port}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel

      // Kirim delete ke backend
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendData = await new Promise((resolve, reject) => {
          const options = {
            hostname: backendConfig.hostname, // Hostname backend
            port: backendConfig.port, // Port backend
            path: `/api/users/${userId}`, // Path dengan user ID
            method: 'DELETE', // Method HTTP DELETE
            headers: {
              'Content-Type': 'application/json', // Format JSON
              'x-app-key': APP_SECRET, // Header autentikasi app key
              'user-agent': 'admin-dashboard/1.0' // Identifikasi sebagai admin dashboard
            }
          };
          
          console.log(`?? Sending DELETE to: ${options.path}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const request = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            console.log(`?? Response status: ${response.statusCode}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              console.log(`?? Response data:`, data.substring(0, 200)); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
              } catch (parseError) {
                console.error('? JSON parse error:', parseError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
                reject(new Error(`Parse error: ${data.substring(0, 100)}`)); // Reject dengan info awal data
              }
            });
          });
          
          request.on('error', (error) => { // Event error koneksi
            console.error('? Request error:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
            reject(error); // Reject Promise
          });
          
          request.setTimeout(5000, () => { // Timeout 5 detik
            console.error('? Request timeout'); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
            request.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          request.end(); // Kirim request DELETE (tanpa body)
        });
        
        console.log(`? Deleted user ${userId} from backend:`, backendData); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Kirim response backend ke client
        
      } catch (backendError) {
        console.error('? Backend delete error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        res.status(500).json({ error: 'Failed to delete user from backend', details: backendError.message });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Delete user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
  }

  // Block user (POST /api/block-user) - Integrasi dengan backend
  async blockUserEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { userId, password } = req.body; // Ambil data dari request
      
      // Validasi: userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'User ID required' });
      }

      // Validasi password admin
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
      }

      // IMPLEMENTASI BLOCK USER LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        const postData = JSON.stringify({ userId: parseInt(userId), password }); // parseInt() mengubah string menjadi bilangan bulat; digunakan untuk ID atau jumlah item
        
        const options = {
          hostname: backendConfig.hostname,
          port: backendConfig.port,
          path: '/api/admin/block-user',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-key': 'NFC2025SecureApp',
            'ngrok-skip-browser-warning': 'true',
            'x-admin-password': ADMIN_PASSWORD,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const backendData = await new Promise((resolve, reject) => {
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const req = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise dengan data
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            reject(error); // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          req.write(postData); // Tulis body ke request
          req.end(); // Kirim request ke backend
        });
        
        if (backendData.success) {
          console.log(`?? User blocked: ${userId} (${backendData.user.username})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({
            success: true,
            message: `User ${backendData.user.username} has been blocked`,
            user: backendData.user // Data user yang diblokir
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend block user failed'); // Lempar error jika backend gagal
        }
        
      } catch (backendError) {
        console.error('? Backend block user error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        res.json({
          success: false,
          error: `Failed to block user: ${backendError.message}` // Pesan error ke client
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Block user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to block user' });
    }
  }

  // Unblock user (POST /api/unblock-user) - Integrasi dengan backend
  async unblockUserEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { userId, password } = req.body; // Ambil data dari request
      
      // Validasi: userId wajib ada
      if (!userId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'User ID required' });
      }

      // Validasi password admin
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
      }

      // IMPLEMENTASI UNBLOCK USER LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        const postData = JSON.stringify({ userId: parseInt(userId), password }); // Serialize body request ke JSON
        
        const options = {
          hostname: backendConfig.hostname, // Hostname backend
          port: backendConfig.port, // Port backend
          path: '/api/admin/unblock-user', // Endpoint unblock user di backend
          method: 'POST', // Method HTTP POST
          headers: {
            'Content-Type': 'application/json', // Format body JSON
            'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            'x-admin-password': ADMIN_PASSWORD, // Header password admin
            'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
          }
        };

        const backendData = await new Promise((resolve, reject) => {
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const req = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            reject(error); // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          req.write(postData); // Tulis body ke request
          req.end(); // Kirim request ke backend
        });
        
        if (backendData.success) { // Jika backend berhasil membuka blokir
          console.log(`? User unblocked: ${userId} (${backendData.user.username})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({
            success: true,
            message: `User ${backendData.user.username} has been unblocked`,
            user: backendData.user // Data user yang sudah dibuka blokirnya
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend unblock user failed'); // Lempar error jika gagal
        }
        
      } catch (backendError) {
        console.error('? Backend unblock user error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        res.json({
          success: false,
          error: `Failed to unblock user: ${backendError.message}` // Pesan error ke client
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Unblock user error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  }

  // Bulk top-up ke semua user (POST /api/bulk-topup) - Belum diimplementasi
  async bulkTopupEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { amount, password } = req.body; // Ambil amount dan password
      
      // Validasi amount wajib ada
      if (!amount || amount <= 0) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        return res.status(400).json({ error: 'Valid amount required' });
      }

      // Validasi password admin
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
      }

      // IMPLEMENTASI BULK TOPUP LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendUrl = `${BACKEND_URL}/api/admin/bulk-topup`; // URL endpoint bulk topup backend
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        
        // HTTP request ke backend untuk bulk topup
        const backendData = await new Promise((resolve, reject) => {
          const postData = JSON.stringify({ amount: parseInt(amount) }); // Serialize body request
          
          const options = {
            hostname: backendConfig.hostname, // Hostname backend
            port: backendConfig.port, // Port backend
            path: '/api/admin/bulk-topup', // Endpoint bulk topup
            method: 'POST', // Method HTTP POST
            headers: {
              'Content-Type': 'application/json', // Format body JSON
              'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
              'x-admin-password': ADMIN_PASSWORD, // Header password admin
              'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
            }
          };

          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const req = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            reject(error); // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          req.write(postData); // Tulis body ke request
          req.end(); // Kirim request ke backend
        });
        
        if (backendData.success) { // Jika backend berhasil bulk topup
          console.log(`? Bulk topup berhasil: ${backendData.updatedUsers} users, amount: ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({
            success: true,
            message: `Bulk topup berhasil untuk ${backendData.updatedUsers} users`,
            data: {
              amount: amount, // Jumlah top-up per user
              updatedUsers: backendData.updatedUsers, // Jumlah user yang di-update
              totalAmount: backendData.totalAmount // Total saldo yang ditambahkan
            }
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend bulk topup failed'); // Lempar error jika gagal
        }
        
      } catch (backendError) {
        console.error('? Backend bulk topup error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        // FALLBACK: Update di device cache (temporary)
        let updatedCount = 0; // Counter user yang di-update
        this.devices.forEach((deviceData, deviceId) => { // Loop semua device
          if (deviceData.users) { // Jika device punya user
            deviceData.users.forEach(user => { // Loop setiap user di device
              user.balance = (parseInt(user.balance) || 0) + parseInt(amount); // Tambahkan amount ke balance
              updatedCount++; // Increment counter
            });
            deviceData.totalBalance = deviceData.users.reduce((sum, user) => sum + (parseInt(user.balance) || 0), 0); // Hitung ulang total balance device
          }
        });
        
        console.log(`?? Fallback bulk topup: ${updatedCount} users in cache, amount: ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        res.json({
          success: true,
          message: `Bulk topup applied to ${updatedCount} users (cache only - backend unavailable)`,
          data: {
            amount: amount, // Jumlah top-up
            updatedUsers: updatedCount, // Jumlah user yang di-update di cache
            warning: 'Applied to local cache only, may not persist' // Peringatan data hanya di cache
          }
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Bulk topup error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to perform bulk topup' });
    }
  }

  // Reset balance user tertentu (POST /api/reset-balance)
  async resetBalanceEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { userId, newBalance, password } = req.body; // Ambil userId, newBalance, dan password dari request
      
      // Validasi password admin
      if (password !== ADMIN_PASSWORD) { // Password admin wajib cocok
        return res.status(401).json({ error: 'Invalid admin password' });
      }

      // Validasi userId dan newBalance
      if (!userId) { // userId wajib ada
        return res.status(400).json({ error: 'User ID required' });
      }
      
      if (newBalance === undefined || newBalance === null) { // newBalance wajib ada
        return res.status(400).json({ error: 'New balance required' });
      }

      // IMPLEMENTASI RESET BALANCE LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        const postData = JSON.stringify({ userId: parseInt(userId), newBalance: parseInt(newBalance), password }); // Serialize body request
        
        const options = {
          hostname: backendConfig.hostname, // Hostname backend
          port: backendConfig.port, // Port backend
          path: '/api/admin/reset-balance', // Endpoint reset balance di backend
          method: 'POST', // Method HTTP POST
          headers: {
            'Content-Type': 'application/json', // Format body JSON
            'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            'x-admin-password': ADMIN_PASSWORD, // Header password admin
            'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
          }
        };

        const backendData = await new Promise((resolve, reject) => {
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const req = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            reject(error); // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          req.write(postData); // Tulis body ke request
          req.end(); // Kirim request ke backend
        });

        if (backendData.success || backendData.user) { // Jika backend berhasil reset balance
          console.log(`? Reset balance success for user ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          res.json({
            success: true,
            message: `Balance reset untuk user ${userId}`,
            user: backendData.user // Data user setelah reset balance
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend reset balance failed'); // Lempar error jika gagal
        }

      } catch (backendError) {
        console.error('? Backend reset balance error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        // FALLBACK: Update di device cache (temporary)
        let userFound = false; // Flag untuk menandai apakah user ditemukan
        this.devices.forEach((deviceData, deviceId) => { // Loop semua device
          if (deviceData.users) { // Jika device punya user
            const user = deviceData.users.find(u => u.id === parseInt(userId)); // Cari user berdasarkan ID
            if (user) { // Jika user ditemukan
              user.balance = 0; // Reset balance ke 0
              userFound = true; // Tandai user ditemukan
              deviceData.totalBalance = deviceData.users.reduce((sum, u) => sum + (parseInt(u.balance) || 0), 0); // Hitung ulang total balance
            }
          }
        });
        
        if (userFound) { // Jika user ditemukan di cache
          console.log(`?? Fallback reset balance for user ${userId} (cache only)`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          res.json({
            success: true,
            message: `Reset balance untuk user ${userId} (cache only - backend unavailable)`,
            warning: 'Applied to local cache only, may not persist' // Peringatan data hanya di cache
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          res.status(500).json({ error: 'User tidak ditemukan dan backend tidak tersedia' }); // User tidak ada
        }
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Reset balance error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to reset balance' });
    }
  }

  // Clear semua fraud alerts (POST /api/clear-fraud-alerts)
  async clearFraudAlertsEndpoint(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // IMPLEMENTASI CLEAR FRAUD ALERTS LANGSUNG KE BACKEND
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
        const postData = JSON.stringify({}); // Body kosong untuk request clear
        
        const options = {
          hostname: backendConfig.hostname, // Hostname backend
          port: backendConfig.port, // Port backend
          path: '/api/admin/clear-fraud-alerts', // Endpoint clear fraud alerts
          method: 'POST', // Method HTTP POST
          headers: {
            'Content-Type': 'application/json', // Format body JSON
            'x-app-key': 'NFC2025SecureApp', // Header autentikasi app key
            'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
            'x-admin-password': ADMIN_PASSWORD, // Header password admin
            'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
          }
        };

        const backendData = await new Promise((resolve, reject) => {
          // Select correct client based on protocol
          const client = backendConfig.protocol === 'https' ? https : http; // Pilih http atau https
          const req = client.request(options, (response) => {
            let data = ''; // Buffer untuk menampung chunk response
            
            response.on('data', (chunk) => { // Event tiap ada potongan data
              data += chunk; // Gabungkan ke buffer
            });
            
            response.on('end', () => { // Event saat response selesai
              try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
                const jsonData = JSON.parse(data); // Parse JSON response
                resolve(jsonData); // Selesaikan Promise
              } catch (parseError) {
                reject(parseError); // Gagal parse, reject Promise
              }
            });
          });
          
          req.on('error', (error) => { // Event error koneksi
            reject(error); // Reject Promise
          });
          
          req.setTimeout(10000, () => { // Timeout 10 detik
            req.destroy(); // Batalkan request timeout
            reject(new Error('Timeout'));
          });
          
          req.write(postData); // Tulis body kosong ke request
          req.end(); // Kirim request ke backend
        });
        
        if (backendData.success) { // Jika backend berhasil menghapus fraud alerts
          console.log(`? Backend cleared ${backendData.clearedCount} fraud alerts`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          
          // Also clear local cache
          const localClearedCount = this.fraudAlerts.size; // Hitung fraud alerts di cache lokal
          this.fraudAlerts.clear(); // Hapus semua fraud alerts dari Map lokal
          this.fraudStats = { // Reset statistik fraud ke nilai awal
            totalAlerts: 0, // Reset total alerts
            blockedTransactions: 0, // Reset counter transaksi diblokir
            reviewTransactions: 0, // Reset counter transaksi direview
            lastAlert: null // Reset timestamp alert terakhir
          };
          
          res.json({
            success: true,
            message: `Cleared ${backendData.clearedCount} fraud alerts from backend, ${localClearedCount} from local cache`,
            clearedCount: backendData.clearedCount // Jumlah alert yang dihapus di backend
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Backend clear fraud alerts failed'); // Lempar error jika gagal
        }
        
      } catch (backendError) {
        console.error('? Backend clear fraud alerts error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        
        // FALLBACK: Clear local cache only
        const clearedCount = this.fraudAlerts.size; // Hitung alert yang akan dihapus
        this.fraudAlerts.clear(); // Hapus semua fraud alerts dari Map lokal
        this.fraudStats = { // Reset statistik fraud ke nilai awal
          totalAlerts: 0, // Reset total alerts
          blockedTransactions: 0, // Reset counter transaksi diblokir
          reviewTransactions: 0, // Reset counter transaksi direview
          lastAlert: null // Reset timestamp alert terakhir
        };

        console.log(`?? Fallback clear fraud alerts: ${clearedCount} alerts from local cache`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        res.json({
          success: true,
          message: `Cleared ${clearedCount} fraud alerts (local cache only - backend unavailable)`,
          clearedCount: clearedCount, // Jumlah alert yang dihapus dari cache
          warning: 'Cleared from local cache only, may not persist' // Peringatan data hanya di cache
        });
      }

    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Clear fraud alerts error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to clear fraud alerts' });
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
  async getNFCCards(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const backendConfig = parseBackendUrl(); // Parse URL backend menjadi komponen
      const backendUrl = `${BACKEND_URL}/api/nfc-cards/list`; // URL lengkap endpoint list kartu
      
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        const options = {
          hostname: backendConfig.hostname, // Hostname backend
          port: backendConfig.port, // Port backend
          path: '/api/nfc-cards/list?limit=1000', // Get ALL cards - ambil semua kartu dengan limit besar
          method: 'GET', // Method HTTP GET
          protocol: backendConfig.protocol, // Protocol http/https
          headers: {
            'Content-Type': 'application/json', // Format JSON
            'ngrok-skip-browser-warning': 'true' // Lewati warning ngrok
          }
        };

        console.log(`?? Fetching ALL NFC cards from: ${BACKEND_URL}/api/nfc-cards/list`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        const backendData = await makeHttpRequest(options); // Kirim request ke backend
        
        if (backendData.success) { // Jika backend berhasil
          console.log(`? Loaded ${backendData.cards?.length || 0} NFC cards from backend (Total in DB: ${backendData.total})`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
          res.json({
            success: true,
            cards: backendData.cards || [], // Array kartu NFC
            total: backendData.total || (backendData.cards?.length || 0) // Total kartu
          });
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          throw new Error(backendData.error || 'Failed to load cards'); // Error jika gagal
        }
      } catch (backendError) {
        console.error('? Backend get NFC cards error:', backendError.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        res.json({
          success: false,
          cards: [], // Kembalikan array kosong jika error
          error: `Backend error: ${backendError.message}`, // Pesan error
          total: 0 // Total 0 jika error
        });
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Get NFC cards error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ 
        success: false,
        error: `Server error: ${error.message}`, // Pesan error server
        cards: [], // Array kosong
        total: 0 // Total 0
      });
    }
  }

  // Register new NFC card (POST /api/nfc-cards/register)
  async registerNFCCard(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, userId, cardType } = req.body; // Ambil data kartu dari request body
      
      if (!cardId || !userId) { // Validasi field wajib
        return res.status(400).json({ error: 'cardId and userId are required' });
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      const postData = JSON.stringify({ cardId, userId, cardType: cardType || 'NTag215' }); // Serialize body request
      
      const options = {
        hostname: backendConfig.hostname, // Hostname backend
        port: backendConfig.port, // Port backend
        path: '/api/nfc-cards/register', // Endpoint register kartu
        method: 'POST', // Method HTTP POST
        headers: {
          'Content-Type': 'application/json', // Format JSON
          'ngrok-skip-browser-warning': 'true', // Lewati warning ngrok
          'Content-Length': Buffer.byteLength(postData) // Panjang body dalam bytes
        }
      };

      const backendData = await makeHttpRequest({ ...options, body: { cardId, userId, cardType: cardType || 'NTag215' } }); // Kirim request ke backend
      
      if (backendData.success) { // Jika pendaftaran berhasil
        console.log(`? Registered NFC card: ${cardId} for user ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend ke client
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Register NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to register NFC card' });
    }
  }

  // Link NFC card to user (POST /api/nfc-cards/link)
  async linkNFCCard(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, userId } = req.body; // Ambil cardId dan userId dari request body
      
      if (!cardId || !userId) { // Validasi field wajib
        return res.status(400).json({ error: 'cardId and userId are required' });
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      const options = {
        hostname: backendConfig.hostname, // Hostname backend
        port: backendConfig.port, // Port backend
        path: '/api/nfc-cards/link', // Endpoint link kartu ke user
        method: 'POST', // Method HTTP POST
        protocol: backendConfig.protocol, // Protocol http/https
        body: { cardId, userId } // Body request dengan cardId dan userId
      };

      const backendData = await makeHttpRequest(options); // Kirim request ke backend
      
      if (backendData.success) { // Jika linking berhasil
        console.log(`? Linked NFC card: ${cardId} to user ${userId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Link NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to link NFC card' });
    }
  }

  // Block NFC card (POST /api/nfc-cards/block)
  async blockNFCCard(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, reason } = req.body; // Ambil cardId dan alasan blokir dari request body
      
      if (!cardId) { // Validasi cardId wajib ada
        return res.status(400).json({ error: 'cardId is required' });
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      const options = {
        hostname: backendConfig.hostname, // Hostname backend
        port: backendConfig.port, // Port backend
        path: '/api/nfc-cards/status', // Endpoint update status kartu
        method: 'PUT', // Method HTTP PUT untuk update
        protocol: backendConfig.protocol, // Protocol http/https
        body: { cardId, status: 'BLOCKED', reason: reason || 'Blocked by admin' } // Body dengan status BLOCKED
      };

      const backendData = await makeHttpRequest(options); // Kirim request ke backend
      
      if (backendData.success) { // Jika kartu berhasil diblokir
        console.log(`? Blocked NFC card: ${cardId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Block NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to block NFC card' });
    }
  }

  // Top-up NFC card balance (POST /api/nfc-cards/topup)
  async topupNFCCard(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId, amount, adminPassword } = req.body; // Ambil cardId, amount, dan password dari request body
      
      if (!cardId || !amount) { // Validasi field wajib
        return res.status(400).json({ error: 'cardId and amount are required' });
      }

      if (adminPassword !== ADMIN_PASSWORD) { // Validasi password admin
        return res.status(403).json({ error: 'Invalid admin password' });
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      const options = {
        hostname: backendConfig.hostname, // Hostname backend
        port: backendConfig.port, // Port backend
        path: '/api/nfc-cards/topup', // Endpoint top-up kartu
        method: 'POST', // Method HTTP POST
        body: { cardId, amount, adminPassword } // Body request dengan data top-up
      };

      const backendData = await makeHttpRequest(options); // Kirim request ke backend
      
      if (backendData.success) { // Jika top-up berhasil
        console.log(`? Topped up NFC card: ${cardId} with ${amount}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend ke client
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Top-up NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to top-up NFC card' });
    }
  }

  // Delete NFC card (DELETE /api/nfc-cards/:cardId)
  async deleteNFCCard(req, res) {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const { cardId } = req.params; // Ambil cardId dari URL parameter
      const { adminPassword } = req.body; // Ambil password admin dari request body
      
      if (!cardId) { // Validasi cardId wajib ada
        return res.status(400).json({ error: 'cardId is required' });
      }

      if (adminPassword !== ADMIN_PASSWORD) { // Validasi password admin
        return res.status(403).json({ error: 'Invalid admin password' });
      }

      const backendConfig = parseBackendUrl(); // Parse URL backend
      const bodyData = JSON.stringify({ adminPassword }); // Serialize body request
      const options = {
        hostname: backendConfig.hostname, // Hostname backend
        port: backendConfig.port, // Port backend
        path: `/api/nfc-cards/delete/${cardId}`, // Path dengan card ID yang akan dihapus
        method: 'DELETE', // Method HTTP DELETE
        protocol: backendConfig.protocol, // Protocol http/https
        headers: {
          'Content-Type': 'application/json', // Format JSON
          'Content-Length': Buffer.byteLength(bodyData), // Panjang body dalam bytes
          'ngrok-skip-browser-warning': 'true' // Lewati warning ngrok
        },
        body: { adminPassword } // Include body for DELETE request - sertakan password di body
      };

      console.log(`??? Attempting to delete card ${cardId} from backend...`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Admin password check: ${adminPassword === ADMIN_PASSWORD ? 'VALID' : 'INVALID'}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Sending to: ${backendConfig.hostname}${options.path}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Body:`, options.body); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      const backendData = await makeHttpRequest(options); // Kirim request DELETE ke backend
      
      if (backendData.success) { // Jika penghapusan berhasil
        console.log(`??? Deleted NFC card: ${cardId}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        res.json(backendData); // Teruskan response backend ke client
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        res.status(400).json(backendData); // Teruskan error dari backend
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.error('? Delete NFC card error:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      res.status(500).json({ error: 'Failed to delete NFC card' });
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
  start() {
    this.app.listen(PORT, () => { // Listen di port 3000 dan mulai menerima koneksi
      console.log('?? Simple NFC Payment Admin started!'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`?? Dashboard: http://localhost:${PORT}`); // URL dashboard admin
      console.log(''); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('?? Backend Connection:'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log(`   ?? Ngrok URL: ${NGROK_URL}`); // URL ngrok yang digunakan
      console.log(''); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('?? Cara menggunakan:'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('   1. Pastikan ngrok tunnel aktif di terminal lain'); // Langkah 1
      console.log('   2. Aplikasi Android connect ke ngrok URL'); // Langkah 2
      console.log('   3. Monitor pengguna dan transaksi dari dashboard ini'); // Langkah 3
      console.log(''); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('?? Setup:'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      console.log('   - Backend: node server.js (port 4000)'); // Perintah menjalankan backend
      console.log('   - Ngrok: ngrok http 4000'); // Perintah menjalankan ngrok
      console.log('   - Admin: node simple-admin.js (port 3000)'); // Perintah menjalankan admin
    });

    // Cleanup timer sudah distart di constructor � tidak perlu dipanggil lagi di sini
  }
}

// ==================== START SERVER ====================
// Buat instance admin server dan jalankan
const admin = new SimpleNFCAdmin();
admin.start();
