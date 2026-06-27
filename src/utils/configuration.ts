// src/utils/configuration.ts
// ==================================================================================
// 🌐 CONFIGURATION FILE - API ENDPOINT CONFIGURATION
// ==================================================================================
//
// Tujuan File:
// File ini berisi konfigurasi URL backend API yang digunakan oleh aplikasi mobile.
// Untuk development mode, kita menggunakan Ngrok untuk tunneling local server.
//
// Apa itu Ngrok?
// Ngrok adalah tool untuk membuat tunnel dari internet ke localhost.
// Kenapa butuh Ngrok? Karena aplikasi mobile tidak bisa akses localhost langsung.
//
// Contoh:
// - Backend berjalan di http://localhost:4000 (hanya bisa diakses dari komputer sendiri)
// - Ngrok membuat tunnel: https://xyz.ngrok-free.dev → http://localhost:4000
// - Mobile app bisa akses backend melalui URL Ngrok ini
//
// ==================================================================================

// ==================================================================================
// LANGKAH-LANGKAH SETUP NGROK (Mode Pengembangan)
// ==================================================================================
// 
// LANGKAH 1: Jalankan Server Backend
//   Perintah: cd backend && node server.js
//   Backend akan berjalan di http://localhost:4000
// 
// LANGKAH 2: Jalankan Tunnel Ngrok
//   Perintah: ngrok http 4000
//   Ngrok akan menghasilkan URL acak seperti: https://abc-xyz.ngrok-free.dev
// 
// LANGKAH 3: Salin URL Ngrok ke Konstanta di Bawah
//   Ganti nilai API_URL dengan URL dari Ngrok
// 
// LANGKAH 4: Bangun Ulang Aplikasi Mobile
//   - Jika menggunakan Expo: expo start --clear
//   - Jika sudah bangun APK: bangun ulang APK dengan URL baru
// 
// CATATAN PENTING:
// - URL Ngrok berubah setiap kali Ngrok di-restart (tingkat gratis)
// - Untuk produksi, ganti dengan URL server yang tetap (tidak pakai Ngrok)
// - Jangan commit URL pengembangan ke Git (bisa bocor ke orang lain)
// 
// ==================================================================================

// URL Backend API yang digunakan oleh aplikasi mobile untuk semua request
// Format: base URL tanpa trailing slash, endpoint akan ditambahkan di apiService
// Contoh full URL: API_URL + '/api/auth/login'
// PENTING: Ganti URL ini dengan URL Ngrok terbaru setiap kali Ngrok di-restart
export const API_URL = 'https://unbellicose-troublesomely-miley.ngrok-free.dev';

// App Secret untuk bypass JWT check (development only)
// Ini matching dengan APP_SECRET di backend .env
export const APP_SECRET = 'NFC2025SecureApp'; // export const mengekspor konstanta ini; APP_SECRET adalah kunci rahasia yang cocok dengan konfigurasi di backend .env; digunakan sebagai x-app-key header untuk autentikasi device

// INSTRUKSI UPDATE URL (UNTUK DEVELOPMENT):
// 1. Buka terminal, jalankan: ngrok http 4000
// 2. Copy URL yang muncul (contoh: https://abc-123-xyz.ngrok-free.dev)
// 3. Paste URL baru di variable API_URL di atas (ganti yang lama)
// 4. Restart aplikasi: expo start --clear (untuk clear cache)
// 5. Jika sudah build APK: rebuild dengan eas build --platform android --profile preview

// CATATAN PENTING:
// - Ngrok free tier: URL berubah tiap restart (tidak persistent)
// - Untuk production: ganti dengan domain tetap (misal: https://api.myapp.com)
// - Jangan hardcode URL production di sini (pakai environment variable)