// src/utils/apiService.ts
// ==================================================================================
// 🚀 UNIFIED API SERVICE - HTTP CLIENT UNTUK MOBILE APP
// ==================================================================================
//
// Tujuan File:
// File ini adalah "jembatan" antara aplikasi mobile dengan backend server.
// Semua komunikasi HTTP (login, payment, NFC, admin) dilakukan melalui class ini.
//
// Pattern yang Digunakan:
// - Singleton Pattern: Hanya ada 1 instance APIService di seluruh aplikasi
// - Token-Based Authentication: JWT token disimpan dan dikirim otomatis di header
// - Auto-Retry: Jika request gagal, token auto-refresh
// - Error Handling: Menangani Ngrok errors, timeout, network errors
//
// Struktur Class:
// 1. Initialization: Load token dari AsyncStorage saat startup
// 2. HTTP Request Handler: Core function untuk semua API calls
// 3. Authentication Methods: login, register, logout
// 4. User Methods: getUserById, updateBalance, dll
// 5. Transaction Methods: createTransaction, getTransactions
// 6. NFC Payment Methods: processNFCPayment, validateNFCReceiver
// 7. Fraud Detection Methods: checkFraudRisk, reportFraudulent
// 8. Admin Methods: dashboard, blockUser, getAllUsers
// 9. Device Methods: registerDevice, syncDeviceData
//
// ==================================================================================

import AsyncStorage from '@react-native-async-storage/async-storage'; // import AsyncStorage — penyimpanan key-value persisten di perangkat mobile; digunakan untuk menyimpan dan membaca JWT token serta userId agar sesi tidak hilang saat aplikasi ditutup
import { Platform } from 'react-native'; // import Platform dari React Native — digunakan untuk membedakan platform ('android' atau 'ios') saat mengirim informasi device ke backend
import Constants from 'expo-constants'; // import Constants dari expo-constants — menyediakan metadata aplikasi seperti nama app dan versi yang dipakai saat registrasi device
import { API_URL, APP_SECRET } from './configuration'; // import dua konstanta dari file configuration.ts — API_URL adalah base URL backend Ngrok; APP_SECRET adalah kunci rahasia untuk autentikasi device

// ==================================================================================
// 🔹 APISERVICE CLASS - SINGLETON PATTERN
// ==================================================================================
//
// Apa itu Singleton Pattern?
// Pattern di mana hanya ada 1 instance class di seluruh aplikasi.
//
// Kenapa Singleton?
// - Agar token dan userId tidak hilang saat class dipanggil dari file berbeda
// - Menghindari multiple initialization (lebih efisien)
// - Consistency: Semua file menggunakan connection yang sama
//
// Cara Pakai:
// const api = APIService.getInstance(); // Selalu return instance yang sama
//
// ==================================================================================
export class APIService { // kelas utama APIService menggunakan Singleton Pattern; satu instance mengelola semua komunikasi HTTP ke backend
  // Property static untuk menyimpan satu instance tunggal (Singleton Pattern)
  // Semua file yang memanggil getInstance() akan dapat instance yang sama
  private static instance: APIService; // Hanya ada 1 instance di seluruh aplikasi
  
  // Property untuk autentikasi dan tracking user
  private token: string | null = null; // JWT token dari backend, null jika belum login
  private userId: string | null = null; // ID user yang login, null jika belum login
  
  // Base URL backend API dari file configuration.ts
  // Semua endpoint akan digabung dengan URL ini
  private baseUrl = API_URL; // Contoh: 'https://xyz.ngrok-free.dev'

  // ================================================================================
  // METHOD: getInstance()
  // ================================================================================
  // TUJUAN:
  // Mendapatkan instance tunggal dari APIService (Singleton Pattern).
  // Jika belum ada instance, buat baru. Jika sudah ada, return yang lama.
  //
  // CARA KERJA:
  // - Check: Apakah APIService.instance sudah ada?
  // - Jika BELUM: Buat instance baru dengan new APIService()
  // - Jika SUDAH: Langsung return instance yang sudah ada
  // - Result: Semua file mendapat instance yang sama (shared state)
  // ================================================================================
  static getInstance(): APIService { // static getInstance: metode Singleton; dipanggil untuk mendapatkan satu instance bersama yang sama di seluruh aplikasi
    // Cek apakah instance sudah pernah dibuat sebelumnya
    if (!APIService.instance) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // Jika belum ada, buat instance baru dengan constructor
      APIService.instance = new APIService(); // Hanya dijalankan sekali di awal
      console.log('✅ APIService instance created (Singleton)'); // Log pertama kali dibuat
    }
    return APIService.instance; // Return instance yang sudah ada (shared across all files)
  }

  // ================================================================================
  // METHOD: initialize()
  // ================================================================================
  // TUJUAN:
  // Inisialisasi APIService saat aplikasi startup.
  // Load token dan userId dari AsyncStorage (persistent storage di device).
  //
  // KENAPA PERLU INITIALIZE?
  // - Token user disimpan di AsyncStorage agar tidak hilang saat app ditutup
  // - Saat app dibuka lagi, token perlu di-load kembali dari storage
  // - Jika token ada, user otomatis login (tidak perlu login lagi)
  //
  // RETURN:
  // - true: Initialization berhasil (token loaded atau tidak ada token)
  // - false: Initialization gagal (error reading AsyncStorage)
  // ================================================================================
  async initialize(): Promise<boolean> { // async initialize: memuat token dan userId dari AsyncStorage saat aplikasi startup; Promise<boolean> karena async
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Load JWT token dari AsyncStorage (penyimpanan lokal device)
      // Token ini disimpan saat user login berhasil
      // AsyncStorage.getItem() return Promise<string | null>
      this.token = await AsyncStorage.getItem('token'); // Ambil token yang tersimpan
      
      // STEP 2: Load userId dari AsyncStorage
      // UserId dipakai untuk tracking dan fraud detection
      this.userId = await AsyncStorage.getItem('userId'); // Ambil userId yang tersimpan
      
      // STEP 3: Log hasil initialization untuk debugging
      const hasToken = this.token ? 'Yes' : 'No'; // ternary operator: jika this.token ada (bukan null) tampilkan 'Yes', jika null tampilkan 'No'; untuk log informatif
      console.log('🔧 API Service initialized'); // Konfirmasi init berhasil
      console.log('📡 Backend URL:', this.baseUrl); // Tampilkan URL backend
      console.log('🔑 Token loaded:', hasToken); // Cek apakah ada token
      console.log('👤 User ID loaded:', this.userId || 'No user'); // Tampilkan userId atau "No user"
      
      // STEP 4: Return true untuk menandakan initialization berhasil
      return true; // Always return true jika tidak ada error
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // Error handling jika AsyncStorage gagal (jarang terjadi)
      console.error('❌ API Service initialization failed:', error); // Log error detail
      return false; // Return false untuk menandakan gagal
    }
  }

  // ================================================================================
  // METHOD: makeRequest() - CORE HTTP REQUEST HANDLER
  // ================================================================================
  // TUJUAN:
  // Method ini adalah "mesin utama" untuk SEMUA API calls ke backend.
  // Semua method lain (login, payment, dll) akan memanggil makeRequest() ini.
  //
  // FITUR:
  // 1. Automatic Token Injection: Token JWT otomatis ditambahkan ke header
  // 2. Timeout Handling: Request dibatalkan jika lebih dari 15 detik (slow network)
  // 3. Ngrok Headers: Menambahkan header khusus untuk bypass Ngrok warning page
  // 4. Auto-Logout: Jika token invalid (401/403), auto logout user
  // 5. Error Handling: Menangani semua error (network, timeout, HTTP errors)
  // 6. Response Parsing: Otomatis parse JSON atau text response
  //
  // PARAMETER:
  // - endpoint: API endpoint (contoh: '/api/auth/login')
  // - options: { method, body, headers } - configuration untuk HTTP request
  //
  // RETURN:
  // - Success: Response body (JSON object atau text)
  // - Error: Throw exception dengan pesan error
  // ================================================================================
  private async makeRequest(endpoint: string, options: any = {}): Promise<any> { // makeRequest: metode inti HTTP; semua panggilan API melewati fungsi ini; menangani token, timeout, error, dan parse respons
    // STEP 1: Gabungkan base URL dengan endpoint untuk membuat URL lengkap
    // Contoh: baseUrl='https://xyz.ngrok.io' + endpoint='/api/auth/login'
    // Hasil: 'https://xyz.ngrok.io/api/auth/login'
    // Cek apakah endpoint sudah dimulai dengan '/', jika belum tambahkan
    const sep = endpoint.startsWith('/') ? '' : '/'; // sep: separator antara baseUrl dan endpoint; jika endpoint sudah dimulai '/' tidak perlu tambah '/' lagi
    const fullUrl = `${this.baseUrl}${sep}${endpoint}`; // Build URL lengkap
    
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 2: Setup timeout dengan AbortController agar request tidak hang selamanya
      // AbortController = Web API untuk membatalkan fetch request yang sedang berjalan
      const controller = new AbortController(); // Buat controller untuk kontrol request
      
      // Set timeout 15 detik: jika request belum selesai, akan di-cancel otomatis
      // 15000 ms = 15 detik, balance antara slow network dan user experience
      const timeout = setTimeout(() => controller.abort(), 15000); // Auto-cancel setelah 15 detik
      
      // STEP 3: Build konfigurasi untuk HTTP request
      const headers: any = { // headers: objek berisi semua HTTP header yang akan dikirim; termasuk Content-Type, Authorization, dan custom headers
        'Content-Type': 'application/json', // Kirim data dalam format JSON
        'Accept': 'application/json', // Expect respons dalam format JSON
        'ngrok-skip-browser-warning': 'true', // Header khusus agar Ngrok tidak redirect ke warning page
        'User-Agent': 'NFC-Payment-Mobile', // Identitas aplikasi untuk logging backend
        'x-app-key': APP_SECRET, // App secret untuk bypass JWT check (development mode)
      };

      // Jika ada token (user login), tambahkan Authorization header
      // Format: "Bearer <token>" adalah standar OAuth 2.0
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`; // Conditional header

      // Jika ada userId, tambahkan custom header untuk tracking
      if (this.userId) headers['x-user-id'] = this.userId; // Custom header userId

      // Merge dengan custom headers jika ada
      if (options.headers) Object.assign(headers, options.headers); // Object.assign: menggabungkan custom headers dari parameter dengan headers default; opsi headers dari caller diutamakan

      const requestConfig: any = { // requestConfig: konfigurasi lengkap untuk fetch(); berisi method, headers, body, dan AbortController signal
        method: options.method || 'GET', // Method HTTP: GET, POST, PUT, DELETE (default: GET)
        headers, // headers: shorthand property ES6; setara headers: headers; menyertakan objek headers ke dalam requestConfig
        // Jika ada body data (untuk POST/PUT), convert object JavaScript ke JSON string
        body: options.body ? JSON.stringify(options.body) : undefined, // Serialize body
        // Hubungkan dengan AbortController untuk fitur timeout
        signal: controller.signal, // Signal untuk cancel request
      };

      // STEP 4: Log request untuk memudahkan debugging
      console.log(`📱 API Call: ${requestConfig.method} ${fullUrl}`); // Log method dan URL
      
      // STEP 5: Jalankan HTTP request dengan fetch() API (built-in JavaScript)
      // fetch() return Promise yang resolve ke Response object
      const response = await fetch(fullUrl, requestConfig); // Execute HTTP request
      
      // STEP 6: Batalkan timeout karena respons sudah diterima
      // Jika tidak di-cancel, timeout akan tetap jalan dan trigger abort nanti
      clearTimeout(timeout); // Stop timer
      
      // STEP 7: Log status code respons untuk debugging
      // Status code: 200=OK, 201=Created, 400=Bad Request, 401=Unauthorized, dll
      console.log(`📥 Response: ${response.status}`); // Log HTTP status

      // STEP 8: Handle error responses (status bukan 2xx)
      // response.ok = true jika status 200-299, false jika 400+ (error)
      if (!response.ok) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // SUBSTEP 8a: Baca body respons sebagai text (mungkin berisi pesan error)
        const errorText = await response.text().catch(() => ''); // Fallback string kosong jika gagal
        
        // SUBSTEP 8b: Jika error authentication (401/403), logout user otomatis
        // 401 = Token invalid/expired, 403 = Token valid tapi no permission
        if (response.status === 401 || response.status === 403) { // memeriksa status 401 (Unauthorized) atau 403 (Forbidden); keduanya menandakan token bermasalah; auto-logout dipicu
          console.warn('🚪 Authentication error, logging out...'); // Log peringatan
          await this.logout(); // Hapus token dan userId, paksa user login ulang
        }
        
        // SUBSTEP 8c: Parse error text sebagai JSON jika memungkinkan
        let errorData: any; // let errorData: variabel untuk menyimpan data error dari respons; let karena nilainya akan diubah oleh try/catch
        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          errorData = JSON.parse(errorText); // Coba parse JSON
        } catch { // catch tanpa binding: menangkap error yang terjadi tanpa menyimpan objek errornya; digunakan saat detail error tidak diperlukan
          errorData = { error: errorText }; // Jika bukan JSON, wrap dalam object
        }
        
        // SUBSTEP 8d: Log error (kecuali 404 untuk card info check - itu expected)
        // 404 pada /api/nfc-cards/info adalah normal behavior untuk kartu yang belum terdaftar
        const isCardCheck = endpoint.includes('/api/nfc-cards/info'); // isCardCheck: flag untuk deteksi apakah ini request cek kartu; 404 pada endpoint ini adalah behavior normal (kartu belum terdaftar)
        const is404 = response.status === 404; // is404: flag boolean untuk memeriksa apakah error adalah 404 Not Found; dipakai untuk suppress log error yang tidak diperlukan
        
        if (!(isCardCheck && is404)) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
          // Log sebagai error untuk kasus lain
          console.error(`❌ API Request failed: API Error ${response.status}: ${JSON.stringify(errorData)}`); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
        }
        // Untuk card check 404, tidak perlu log error karena itu expected behavior
        
        // SUBSTEP 8e: Buat pesan error detail dan throw exception
        throw new Error(`API Error ${response.status}: ${JSON.stringify(errorData)}`); // Lempar exception yang akan di-catch oleh caller
      }

      // STEP 9: Parse respons berdasarkan Content-Type yang dikirim backend
      const contentType = response.headers.get('content-type') || ''; // Ambil MIME type
      
      // SUBSTEP 9a: Jika respons adalah JSON, parse sebagai object JavaScript
      if (contentType.includes('application/json')) { // memeriksa Content-Type header apakah JSON; hanya parse sebagai JSON jika backend mengirim 'application/json'
        const result = await response.json(); // Parse JSON string → JavaScript object
        
        // SUBSTEP 9b: Check apakah response mengandung token baru
        // Backend bisa kirim token baru saat login atau refresh token
        // Jika ada token, save ke memory dan AsyncStorage
        if (result?.token) { // optional chaining ?.token: cek apakah respons berisi token baru; dipakai untuk auto-save token setelah login atau refresh
          this.token = result.token; // Save ke memory (untuk request berikutnya)
          await AsyncStorage.setItem('token', result.token); // Save ke storage (persistent)
          console.log('🔑 New token saved'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        }
        
        return result; // Return parsed JSON
      }

      // SUBSTEP 9c: Jika bukan JSON, return sebagai plain text
      return await response.text(); // response.text(): parse respons sebagai plain text; digunakan saat Content-Type bukan JSON
      
    } catch (error: any) { // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
      // STEP 10: Handle semua errors (network error, timeout, dll)
      // error.name === 'AbortError': Request timeout (lebih dari 15 detik)
      // error.message: Error message lainnya (network down, DNS error, dll)
      console.error('❌ API Request failed:', error.message); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      
      // Re-throw error agar caller bisa handle (misal tampilkan error ke user)
      throw error; // throw error: melempar ulang error yang sama ke pemanggil (caller) agar error bisa ditangani di level atas
    }
  }

  // ================================================================================
  // HTTP METHOD SHORTCUTS - WRAPPER FUNCTIONS
  // ================================================================================
  // TUJUAN:
  // Method-method ini adalah shortcut untuk makeRequest() agar lebih mudah dipakai.
  // Instead of: makeRequest('/api/users', { method: 'GET' })
  // We can write: get('/api/users')
  //
  // Ini adalah coding pattern yang disebut "Convenience Methods" atau "Helper Methods".
  // Makes code cleaner and more readable.
  // ================================================================================

  // GET Request: Untuk mengambil data dari backend (read operation)
  // HTTP GET = safe & idempotent (multiple calls tidak mengubah state)
  // Contoh: await api.get('/api/users/123') → ambil user dengan ID 123
  async get(endpoint: string) { // async get: wrapper untuk HTTP GET request; endpoint adalah path API yang dituju
    return await this.makeRequest(endpoint, { method: 'GET' }); // Wrapper: panggil makeRequest
  }

  // POST Request: Untuk membuat data baru di backend (create operation)
  // HTTP POST = NOT idempotent (multiple calls buat multiple records)
  // Contoh: await api.post('/api/auth/login', { username, password }) → login
  async post(endpoint: string, body?: any) { // async post: wrapper untuk HTTP POST request; body adalah data yang dikirim ke server
    return await this.makeRequest(endpoint, { method: 'POST', body }); // Kirim body sebagai JSON
  }

  // PUT Request: Untuk update data yang sudah ada (update operation)
  // HTTP PUT = idempotent (multiple calls dengan data sama = hasil sama)
  // Contoh: await api.put('/api/users/123', { name: 'New Name' }) → update user
  async put(endpoint: string, body?: any) { // async put: wrapper untuk HTTP PUT request; digunakan untuk update data yang sudah ada
    return await this.makeRequest(endpoint, { method: 'PUT', body }); // Kirim body untuk update
  }

  // DELETE Request: Untuk hapus data (delete operation)
  // HTTP DELETE = idempotent (hapus 2x = hasil sama dengan hapus 1x)
  // Contoh: await api.delete('/api/users/123') → hapus user ID 123
  async delete(endpoint: string) { // async delete: wrapper untuk HTTP DELETE request; digunakan untuk menghapus data di server
    return await this.makeRequest(endpoint, { method: 'DELETE' }); // No body needed
  }

  // ================================================================================
  // AUTHENTICATION METHODS - LOGIN, REGISTER, LOGOUT
  // ================================================================================
  // TUJUAN:
  // Method-method untuk user authentication (login masuk ke aplikasi).
  //
  // Authentication Flow:
  // 1. User input username & password
  // 2. App call api.login(credentials)
  // 3. Backend validate credentials dan generate JWT token
  // 4. App save token ke AsyncStorage (persistent storage)
  // 5. All subsequent requests automatically include token in headers
  // 6. When user logout, token deleted from storage
  // ================================================================================

  // ================================================================================
  // METHOD: login()
  // ================================================================================
  // TUJUAN:
  // Login user dengan username dan password.
  // Jika berhasil, save token ke storage dan return user object.
  //
  // FLOW:
  // 1. Send POST request ke backend /api/auth/login dengan credentials
  // 2. Backend validate username & password di database
  // 3. Jika valid, backend generate JWT token dan return { token, user }
  // 4. App save token dan userId ke AsyncStorage
  // 5. Token auto di-include di semua request berikutnya (lihat makeRequest())
  //
  // PARAMETER:
  // - credentials: { username: string, password: string }
  //
  // RETURN:
  // - Success: { token: string, user: { id, name, username, balance } }
  // - Error: Throw exception dengan error message dari backend
  // ================================================================================
  async login(credentials: { username: string; password: string }) { // async login: mengirim credentials ke backend; mendapatkan JWT token; menyimpan token ke AsyncStorage
    // STEP 1: Send POST request ke backend auth endpoint
    // makeRequest() akan handle semua HTTP logic (headers, timeout, dll)
    const response = await this.makeRequest('/api/auth/login', { // const response: menyimpan response dari HTTP request; await menunggu response diterima
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: credentials, // { username: "john", password: "secret123" }
    });
    
    // STEP 2: Check apakah response mengandung token
    // Backend response format: { success: true, token: "eyJhbGc...", user: {...} }
    if (response?.token) { // optional chaining ?.token: memeriksa apakah respons berisi JWT token; hanya simpan jika token ada
      // SUBSTEP 2a: Save token ke memory (untuk dipakai di request berikutnya)
      this.token = response.token; // menyimpan token JWT baru ke property instance; token ini dipakai di header Authorization request berikutnya
      
      // SUBSTEP 2b: Save userId ke memory
      // userId.toString() convert number → string (AsyncStorage hanya terima string)
      this.userId = response.user.id.toString(); // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      
      // SUBSTEP 2c: Save token ke AsyncStorage (persistent storage)
      // Persistent = data tidak hilang saat app ditutup
      // Saat app dibuka lagi, token di-load dari storage (lihat initialize())
      await AsyncStorage.setItem('token', response.token); // AsyncStorage.setItem() menyimpan data ke penyimpanan lokal perangkat secara async
      
      // SUBSTEP 2d: Save userId ke AsyncStorage
      await AsyncStorage.setItem('userId', response.user.id.toString()); // AsyncStorage.setItem() menyimpan data ke penyimpanan lokal perangkat secara async
      
      console.log('✅ Login successful, token saved'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    }
    
    // STEP 3: Return full response object
    // Caller bisa akses response.user untuk informasi user (name, balance, dll)
    return response; // mengembalikan data respons ke pemanggil (caller); caller bisa mengambil properti yang diperlukan dari response
  }

  // ================================================================================
  // METHOD: register()
  // ================================================================================
  // TUJUAN:
  // Register user baru dengan name, username, dan password.
  //
  // FLOW:
  // 1. Send POST request ke backend /api/auth/register dengan user data
  // 2. Backend validate data (username unique, password strength, dll)
  // 3. Backend hash password dengan bcrypt
  // 4. Backend save user ke database Prisma
  // 5. Backend return user object (tanpa password tentu saja!)
  //
  // PARAMETER:
  // - userData: { name: string, username: string, password: string }
  //
  // RETURN:
  // - Success: { success: true, user: { id, name, username, balance } }
  // - Error: Throw exception (contoh: "Username already exists")
  // ================================================================================
  async register(userData: { name: string; username: string; password: string }) { // async register: mengirim data registrasi ke endpoint /api/auth/register untuk membuat akun baru
    // STEP 1: Send POST request ke backend register endpoint
    // Backend akan validate dan save user ke database
    return await this.makeRequest('/api/auth/register', { // memanggil makeRequest dengan endpoint /api/auth/register; POST untuk membuat akun baru di database
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: userData, // { name: "John Doe", username: "john", password: "secret123" }
    });
    
    // NOTE: Register tidak otomatis login user
    // Setelah register berhasil, user harus login manual (call login() method)
  }

  // ================================================================================
  // METHOD: logout()
  // ================================================================================
  // TUJUAN:
  // Logout user dan hapus semua authentication data dari storage.
  //
  // FLOW:
  // 1. Clear token dan userId dari memory (this.token = null)
  // 2. Clear token dan userId dari AsyncStorage (persistent storage)
  // 3. All subsequent requests akan tidak punya Authorization header
  // 4. Backend akan reject requests dengan error 401 Unauthorized
  //
  // RETURN: void (tidak return apa-apa)
  // ================================================================================
  async logout() { // async logout: membersihkan token dan userId dari memory dan AsyncStorage; memaksa user login ulang
    // STEP 1: Clear token dan userId dari memory
    // Setting ke null agar makeRequest() tidak include Authorization header
    this.token = null; // mengeset token ke null di memory; token tidak lagi disertakan di request HTTP berikutnya
    this.userId = null; // mengeset userId ke null di memory; user tidak lagi dikenali oleh service ini
    
    // STEP 2: Clear token dan userId dari AsyncStorage (persistent storage)
    // multiRemove() adalah efficient way untuk delete multiple keys sekaligus
    // Alternative: await AsyncStorage.removeItem('token'); await AsyncStorage.removeItem('userId');
    await AsyncStorage.multiRemove(['token', 'userId']); // multiRemove: menghapus beberapa item AsyncStorage sekaligus; lebih efisien daripada dua kali removeItem
    
    console.log('🚪 User logged out, session cleared'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
  }

  // ================================================================================
  // USER METHODS - OPERASI TERKAIT DATA USER
  // ================================================================================
  // TUJUAN:
  // Method-method untuk get dan update informasi user (balance, profile, dll).
  //
  // User Data Flow:
  // 1. App request user data dari backend
  // 2. Backend query database Prisma
  // 3. Backend return user object
  // 4. App display di UI atau save ke local cache
  // ================================================================================

  // ================================================================================
  // METHOD: getUserById()
  // ================================================================================
  // TUJUAN:
  // Mengambil data user berdasarkan ID user.
  // Uses public endpoint (tidak perlu authentication).
  //
  // USE CASE:
  // - Ambil data penerima saat akan transfer uang
  // - Ambil data user setelah login (untuk display di Dashboard)
  // - Sync balance dari backend setelah transaksi
  //
  // PARAMETER:
  // - id: number - User ID yang ingin diambil datanya
  //
  // RETURN:
  // - { id, name, username, balance, createdAt }
  // ================================================================================
  async getUserById(id: number) { // async getUserById: mengambil data user berdasarkan ID; dipanggil saat perlu detail profil user tertentu
    // Endpoint: GET /api/users/{id}
    // Backend response format: { id, name, username, balance, ... } (raw user object)
    const response = await this.makeRequest(`/api/users/${id}`); // const response: menyimpan response dari HTTP request; await menunggu response diterima
    
    // Backend GET /:id returns raw user object (not wrapped in { user: {...} })
    // Fallback ke response.user jika format berbeda
    return response?.user || response; // optional chaining ?.user: mengambil properti user dari respons; || response sebagai fallback jika respons langsung berupa objek user
  }

  // ================================================================================
  // METHOD: getCurrentUser()
  // ================================================================================
  // TUJUAN:
  // Mengambil data user yang sedang login (current logged-in user).
  // Uses authenticated endpoint (memerlukan token).
  //
  // USE CASE:
  // - Get balance user yang sedang login
  // - Display user profile di settings page
  // - Refresh user data setelah top-up atau payment
  //
  // RETURN:
  // - { id, name, username, balance, createdAt }
  // ================================================================================
  async getCurrentUser() { // async getCurrentUser: mengambil profil user yang sedang login menggunakan token yang tersimpan
    // STEP 1: Call authenticated endpoint
    // Endpoint: GET /api/users/me
    // Token akan auto di-include di header (lihat makeRequest())
    // Backend akan decode token → extract userId → query database
    const response = await this.makeRequest('/api/users/me'); // const response: menyimpan response dari HTTP request; await menunggu response diterima
    
    // STEP 2: Extract user object
    // Backend response format: { success: true, user: {...} }
    console.log('📥 getCurrentUser raw response:', response); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    return response?.user || response; // optional chaining ?.user: mengambil properti user dari respons; || response sebagai fallback jika respons langsung berupa objek user
  }

  // ================================================================================
  // METHOD: updateUserBalance()
  // ================================================================================
  // TUJUAN:
  // Update balance user di backend (digunakan oleh admin atau setelah transaksi).
  //
  // USE CASE:
  // - Admin top-up saldo user
  // - Sync balance setelah NFC payment
  // - Adjust balance jika terjadi error transaksi
  //
  // PARAMETER:
  // - userId: number - ID user yang balance-nya akan diupdate
  // - newBalance: number - Balance baru (bukan delta/increment!)
  //
  // RETURN:
  // - { success: true, user: {...} } jika berhasil
  // ================================================================================
  async updateUserBalance(userId: number, newBalance: number) { // async updateUserBalance: mengupdate saldo user di backend; dipanggil setelah transaksi berhasil
    // STEP 1: Send PUT request ke balance endpoint
    // Endpoint: PUT /api/users/{userId}/balance
    // Body: { balance: 100000 } ← Balance baru (bukan increment!)
    return await this.makeRequest(`/api/users/${userId}/balance`, { // memanggil makeRequest ke endpoint balance dengan userId dinamis via template literal
      method: 'PUT', // method 'PUT': HTTP method untuk mengganti data yang sudah ada; digunakan untuk update resource secara keseluruhan
      body: { balance: newBalance }, // body: mengirim saldo baru sebagai JSON {balance: X} ke backend; backend akan update field balance di database
    });
  }

  // ================================================================================
  // TRANSACTION METHODS - OPERASI TRANSAKSI KEUANGAN
  // ================================================================================
  // TUJUAN:
  // Method-method untuk create transaksi dan get transaction history.
  //
  // Transaction Flow:
  // 1. User initiate payment (input amount, select receiver)
  // 2. App call createTransaction() atau processNFCPayment()
  // 3. Backend validate (balance cukup, fraud check, dll)
  // 4. Backend create transaction record di database
  // 5. Backend update balance sender dan receiver (atomic transaction)
  // 6. Backend return transaction result
  // 7. App display success/error message ke user
  // ================================================================================

  // ================================================================================
  // METHOD: getUserTransactions()
  // ================================================================================
  // TUJUAN:
  // Mengambil semua transaksi user tertentu (sent + received transactions).
  //
  // USE CASE:
  // - Display transaction history di Dashboard
  // - Calculate statistics (total spent, frequency, dll)
  // - Fraud detection (analyze transaction patterns)
  //
  // PARAMETER:
  // - userId: number - ID user yang ingin diambil transaksinya
  //
  // RETURN:
  // - Array of transactions: [{ id, senderId, receiverId, amount, createdAt }, ...]
  // ================================================================================
  async getUserTransactions(userId: number) { // async getUserTransactions: mengambil riwayat transaksi user dari backend untuk ditampilkan di dashboard
    // STEP 1: Call transaction history endpoint
    // Endpoint: GET /api/transactions/user/{userId}
    // Backend akan query semua transaksi where senderId = userId OR receiverId = userId
    return await this.makeRequest(`/api/transactions/user/${userId}`); // GET request ke endpoint transactions/user/:userId; mengambil semua transaksi milik user dengan ID tersebut
  }

  // ================================================================================
  // METHOD: getTransactionHistory()
  // ================================================================================
  // TUJUAN:
  // Mengambil transaction history untuk current logged-in user.
  //
  // USE CASE:
  // - Display "My Transactions" page
  // - Show recent transactions di Dashboard
  //
  // RETURN:
  // - Array of transactions dengan detail sender/receiver
  // ================================================================================
  async getTransactionHistory() { // async getTransactionHistory: mengambil riwayat transaksi semua user; biasanya digunakan untuk laporan admin
    // STEP 1: Call authenticated transaction history endpoint
    // Endpoint: GET /api/transactions/history
    // Token di-decode di backend → extract userId → query transactions
    return await this.makeRequest('/api/transactions/history'); // GET request ke endpoint transactions/history; mengambil histori transaksi global dari backend
  }

  // ================================================================================
  // METHOD: createTransaction()
  // ================================================================================
  // TUJUAN:
  // Membuat transaksi baru (transfer uang dari sender ke receiver).
  //
  // FLOW:
  // 1. App send transaction data ke backend
  // 2. Backend validate:
  //    - Balance sender cukup?
  //    - Receiver exists?
  //    - Amount valid? (> 0, not too large)
  //    - Fraud risk acceptable?
  // 3. Backend create transaction dengan Prisma $transaction (atomic)
  // 4. Backend update balance sender (decrease) dan receiver (increase)
  // 5. Backend return transaction result
  //
  // PARAMETER:
  // - transactionData: {
  //     senderId: number,
  //     receiverId: number,
  //     amount: number,
  //     description?: string,
  //     location?: { latitude, longitude }
  //   }
  //
  // RETURN:
  // - { success: true, transaction: {...} } jika berhasil
  // - Throw error jika gagal (insufficient balance, fraud detected, dll)
  // ================================================================================
  async createTransaction(transactionData: { // async createTransaction: membuat transaksi baru di database; dipanggil setelah pembayaran NFC berhasil diproses
    senderId: number; // senderId: ID user pengirim uang; digunakan backend untuk debit saldo pengirim
    receiverId: number; // receiverId: ID user penerima uang; digunakan backend untuk credit saldo penerima
    amount: number; // amount: jumlah uang yang ditransaksikan dalam rupiah; harus positif
    description?: string; // description: keterangan opsional untuk transaksi; tanda ? berarti properti ini boleh tidak ada
    location?: any; // location: koordinat GPS opsional (latitude, longitude); digunakan oleh sistem fraud detection
  }) {
    // STEP 1: Send POST request ke transaction endpoint
    // Endpoint: POST /api/transactions
    // Backend akan process transaction dengan atomic database operation
    return await this.makeRequest('/api/transactions', { // POST ke /api/transactions untuk membuat record transaksi baru di database
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: transactionData, // body: mengirim seluruh objek transactionData sebagai JSON body; backend akan validasi dan simpan ke database
    });
  }

  // ================================================================================
  // NFC PAYMENT METHODS - OPERASI PEMBAYARAN VIA NFC
  // ================================================================================
  // TUJUAN:
  // Method-method khusus untuk pembayaran menggunakan NFC (contactless payment).
  //
  // NFC Payment Flow:
  // 1. User tap phone ke kartu NFC atau phone lain
  // 2. App read NFC data (userId, cardId, dll)
  // 3. App validate NFC data dengan backend
  // 4. User input amount dan confirm payment
  // 5. App send payment data ke backend
  // 6. Backend process payment (sama seperti regular transaction + fraud check)
  // 7. Backend update balance dan create transaction record
  // 8. App display success message
  // ================================================================================

  // ================================================================================
  // METHOD: processNFCPayment()
  // ================================================================================
  // TUJUAN:
  // Process pembayaran via NFC (phone-to-phone atau phone-to-card).
  //
  // FLOW:
  // 1. App read NFC data dari receiver
  // 2. User input amount
  // 3. App call processNFCPayment()
  // 4. Backend:
  //    - Validate NFC data (user exists, card linked, dll)
  //    - Run fraud detection
  //    - Create transaction
  //    - Update balances
  //    - Create audit log
  // 5. Return success/error
  //
  // PARAMETER:
  // - paymentData: {
  //     receiverNFCData: any, // Data dari NFC tag (userId, cardId, dll)
  //     amount: number,
  //     description?: string,
  //     location?: { latitude, longitude }
  //   }
  //
  // RETURN:
  // - { success: true, transaction: {...} } jika berhasil
  // - Throw error jika fraud detected atau validation failed
  // ================================================================================
  async processNFCPayment(paymentData: { // async processNFCPayment: memproses pembayaran NFC end-to-end; mengirim data NFC ke backend untuk validasi dan transfer saldo
    receiverNFCData: any; // receiverNFCData: data NFC tag yang dibaca dari kartu penerima; berisi UID dan informasi kartu
    amount: number; // amount: jumlah uang yang ditransaksikan dalam rupiah; harus positif
    description?: string; // description: keterangan opsional untuk transaksi; tanda ? berarti properti ini boleh tidak ada
    location?: { latitude: number; longitude: number }; // location: koordinat GPS opsional untuk geolocation fraud detection; null jika permission tidak diberikan
  }) {
    // STEP 1: Send POST request ke NFC payment endpoint
    // Endpoint: POST /api/nfc-cards/payment (backend aktif di route ini)
    return await this.makeRequest('/api/nfc-cards/payment', { // POST ke /api/nfc-cards/payment untuk proses transfer saldo antar kartu NFC lewat backend
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: paymentData, // body: mengirim semua data pembayaran sebagai JSON; backend akan debit pengirim dan credit penerima
    });
  }

  // ================================================================================
  // METHOD: validateNFCReceiver()
  // ================================================================================
  // TUJUAN:
  // Validate NFC data receiver sebelum payment (pre-validation).
  //
  // USE CASE:
  // - Check apakah NFC tag valid sebelum user input amount
  // - Display receiver info (name, username) sebelum confirm payment
  // - Prevent payment ke invalid atau blocked user
  //
  // PARAMETER:
  // - nfcData: any - Data yang dibaca dari NFC tag
  //
  // RETURN:
  // - { valid: boolean, user: {...} } jika NFC valid
  // - Throw error jika NFC invalid atau user blocked
  // ================================================================================
  async validateNFCReceiver(nfcData: any) { // async validateNFCReceiver: memvalidasi kartu NFC penerima sebelum pembayaran; mengecek kartu terdaftar dan aktif
    // STEP 1: Send POST request ke NFC tap endpoint untuk validasi kartu penerima
    // Endpoint: POST /api/nfc-cards/tap (backend aktif di route ini)
    return await this.makeRequest('/api/nfc-cards/tap', { // POST ke /api/nfc-cards/tap untuk validasi tap kartu NFC; backend mengembalikan info pemilik kartu
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: { nfcData }, // body: mengirim data NFC sebagai { nfcData: {...} }; shorthand property ES6 setara { nfcData: nfcData }
    });
  }

  // ================================================================================
  // NFC CARD MANAGEMENT METHODS - OPERASI MANAGEMENT KARTU NFC
  // ================================================================================
  // TUJUAN:
  // Method-method untuk manage NFC cards (get, update, delete).
  //
  // Card Management:
  // - Get user's NFC cards
  // - Update card status (ACTIVE, BLOCKED, LOST, EXPIRED)
  // - Check card balance
  // - View card transaction history
  // ================================================================================

  // ================================================================================
  // METHOD: getUserCards()
  // ================================================================================
  // TUJUAN:
  // Mengambil semua NFC cards milik user tertentu.
  //
  // USE CASE:
  // - Display "My Cards" screen
  // - Show active cards di Dashboard
  // - Check card status dan balance
  //
  // PARAMETER:
  // - userId: number - ID user yang akan diambil kartu-nya
  //
  // RETURN:
  // - {
  //     user: {...},
  //     cards: [
  //       {
  //         id: number,
  //         cardId: string,
  //         balance: number,
  //         cardStatus: 'ACTIVE' | 'BLOCKED' | 'LOST' | 'EXPIRED',
  //         createdAt: string,
  //         lastUsed: string
  //       }
  //     ]
  //   }
  // ================================================================================
  async getUserCards(userId: number) { // async getUserCards: mengambil daftar kartu NFC yang dimiliki user; digunakan di halaman MyCardsScreen
    // STEP 1: Call user cards endpoint
    // Endpoint: GET /api/users/{userId}/cards
    // Backend akan query semua NFC cards where userId = userId
    return await this.makeRequest(`/api/users/${userId}/cards`); // GET ke endpoint users/:userId/cards untuk mengambil semua kartu NFC milik user tersebut
  }

  // ================================================================================
  // METHOD: updateCardStatus()
  // ================================================================================
  // TUJUAN:
  // Update status kartu NFC (block, activate, mark as lost, dll).
  //
  // USE CASE:
  // - User block kartu yang hilang
  // - User activate kartu baru
  // - Admin suspend kartu karena fraud
  //
  // PARAMETER:
  // - cardId: string - UID kartu NFC (contoh: "04A1B2C3D4E5F6")
  // - status: string - Status baru ('ACTIVE', 'BLOCKED', 'LOST', 'EXPIRED')
  //
  // RETURN:
  // - { success: true, message: "Card status updated", card: {...} }
  // ================================================================================
  async updateCardStatus(cardId: string, status: string) { // async updateCardStatus: mengubah status kartu NFC (ACTIVE/BLOCKED/LOST); dipanggil dari halaman manajemen kartu
    // Gunakan endpoint user (/my-status) — tidak perlu admin password, cukup JWT token
    return await this.makeRequest('/api/nfc-cards/my-status', {
      method: 'PUT',
      body: { cardId, status },
    });
  }

  async deleteCard(cardId: string) { // hapus kartu NFC milik user sendiri; dipanggil dari MyCardsScreen saat user ingin ganti kartu
    return await this.makeRequest(`/api/nfc-cards/my-card/${cardId}`, {
      method: 'DELETE',
    });
  }

  // ================================================================================
  // METHOD: getCardInfo()
  // ================================================================================
  // TUJUAN:
  // Mendapatkan informasi detail kartu NFC berdasarkan cardId (UID).
  //
  // USE CASE:
  // - Check apakah kartu sudah terdaftar
  // - Validasi kartu sebelum payment
  // - Display card details di UI
  //
  // PARAMETER:
  // - cardId: string - UID kartu NFC
  //
  // RETURN:
  // - {
  //     id: number,
  //     cardId: string,
  //     userId: number,
  //     balance: number,
  //     cardStatus: string,
  //     user: { name, username }
  //   }
  // ================================================================================
  async getCardInfo(cardId: string) { // async getCardInfo: mengambil informasi kartu NFC berdasarkan UID; digunakan untuk validasi sebelum registrasi
    // STEP 1: Call card info endpoint
    // Endpoint: GET /api/nfc-cards/info/{cardId}
    // Backend akan return card details dengan user info
    return await this.makeRequest(`/api/nfc-cards/info/${cardId}`); // GET ke endpoint nfc-cards/info/:cardId untuk cek apakah kartu sudah terdaftar dan info pemiliknya
  }

  // ================================================================================
  // METHOD: registerCard()
  // ================================================================================
  // TUJUAN:
  // Register kartu NFC baru ke sistem dan link ke user.
  //
  // USE CASE:
  // - User register kartu NFC fisik pertama kali
  // - Link kartu ke akun user
  // - Initialize balance
  //
  // PARAMETER:
  // - cardData: {
  //     cardId: string - UID kartu NFC,
  //     userId: number - ID user pemilik,
  //     balance?: number - Initial balance (default: 0),
  //     deviceId?: string - Device yang melakukan registrasi
  //   }
  //
  // RETURN:
  // - {
  //     success: true,
  //     message: "Card registered successfully",
  //     card: { id, cardId, userId, balance, cardStatus }
  //   }
  // ================================================================================
  async registerCard(cardData: { // async registerCard: mendaftarkan kartu NFC baru ke akun user; mengirim UID dan info kartu ke backend
    cardId: string; // cardId: UID unik kartu NFC yang dibaca oleh NfcManager; identifier hardware kartu
    userId: number; // userId: ID user yang mendaftarkan kartu; backend akan menghubungkan kartu ke akun user ini
    balance?: number; // balance: saldo awal kartu NFC; opsional (tanda ?); default biasanya 0 di backend
    deviceId?: string; // deviceId: ID perangkat yang mendaftarkan kartu; opsional; untuk audit trail keamanan
  }) {
    // STEP 1: Send POST request ke register endpoint
    // Endpoint: POST /api/nfc-cards/register
    // Backend akan create new card record di database
    return await this.makeRequest('/api/nfc-cards/register', { // POST ke /api/nfc-cards/register untuk menyimpan kartu NFC baru ke database
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: cardData, // body: mengirim seluruh objek cardData sebagai JSON body ke endpoint registrasi kartu
    });
  }

  // ================================================================================
  // FRAUD DETECTION METHODS - OPERASI DETEKSI ANOMALI DAN FRAUD
  // ================================================================================
  // TUJUAN:
  // Method-method untuk check fraud risk dan report suspicious transactions.
  //
  // Fraud Detection System:
  // - Uses Z-Score algorithm untuk deteksi anomali statistik
  // - Hitung Z = |X - μ| / σ berdasarkan 20 transaksi historis
  // - Generate Z-Score dan riskLevel (NORMAL, SUSPICIOUS, ANOMALY)
  // - Auto-block transaksi jika Z-Score > 3
  // - Create fraud alerts untuk admin review
  // ================================================================================

  // ================================================================================
  // METHOD: checkFraudRisk()
  // ================================================================================
  // TUJUAN:
  // Check fraud risk untuk transaksi sebelum diproses (pre-transaction validation).
  //
  // USE CASE:
  // - Validate transaksi sebelum payment diproses
  // - Display warning ke user jika transaksi berisiko
  // - Block transaksi otomatis jika Z > 3 (ANOMALY)
  //
  // PARAMETER:
  // - transactionData: {
  //     senderId: number,
  //     receiverId: number,
  //     amount: number,
  //     location?: any
  //   }
  //
  // RETURN:
  // - {
  //     zScore: number | null,
  //     riskLevel: 'NORMAL' | 'SUSPICIOUS' | 'ANOMALY',
  //     decision: 'ALLOW' | 'REVIEW' | 'BLOCK',
  //     reasons: string[]
  //   }
  // ================================================================================
  async checkFraudRisk(transactionData: { // async checkFraudRisk: memeriksa risiko fraud sebelum transaksi; mengirim data ke sistem Z-score fraud detection
    senderId: number; // senderId: ID user pengirim uang; digunakan backend untuk debit saldo pengirim
    receiverId: number; // receiverId: ID user penerima uang; digunakan backend untuk credit saldo penerima
    amount: number; // amount: jumlah uang yang ditransaksikan dalam rupiah; harus positif
    location?: any; // location: koordinat GPS opsional (latitude, longitude); digunakan oleh sistem fraud detection
  }) {
    // STEP 1: Send POST request ke fraud check endpoint
    // Endpoint: POST /api/fraud/check
    // Backend akan run Z-Score algorithm dan return risk assessment
    return await this.makeRequest('/api/fraud/check', { // POST ke /api/fraud/check untuk analisis Z-score; backend mengembalikan riskScore, riskLevel, dan decision
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: transactionData, // body: mengirim seluruh objek transactionData sebagai JSON body; backend akan validasi dan simpan ke database
    });
  }

  // ================================================================================
  // METHOD: reportFraudulent()
  // ================================================================================
  // TUJUAN:
  // Report transaksi sebagai fraudulent (user-reported fraud).
  //
  // USE CASE:
  // - User tidak recognize transaksi (kemungkinan account compromised)
  // - User menerima uang dari sumber mencurigakan
  // - Admin review transaksi dan mark as fraudulent
  //
  // PARAMETER:
  // - transactionId: number - ID transaksi yang dilaporkan
  // - reason: string - Alasan report (contoh: "Unauthorized transaction")
  //
  // RETURN:
  // - { success: true, message: "Fraud report submitted" }
  // ================================================================================
  async reportFraudulent(transactionId: number, reason: string) { // async reportFraudulent: melaporkan transaksi sebagai fraud; menyimpan laporan ke database untuk investigasi
    // STEP 1: Send POST request ke fraud report endpoint
    // Endpoint: POST /api/fraud/report
    // Backend akan create fraud alert dan notify admin
    return await this.makeRequest('/api/fraud/report', { // POST ke /api/fraud/report untuk menyimpan laporan fraud; mengubah status transaksi menjadi FLAGGED
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: { transactionId, reason }, // body: mengirim ID transaksi dan alasan pelaporan fraud ke backend; backend update status transaksi
    });
  }

  // ================================================================================
  // ADMIN METHODS - OPERASI UNTUK ADMIN DASHBOARD
  // ================================================================================
  // TUJUAN:
  // Method-method khusus untuk admin operations (memerlukan admin role).
  //
  // Admin Capabilities:
  // - View dashboard statistics (total users, transactions, balance)
  // - View all users dan all transactions
  // - Block/unblock users
  // - Top-up user balance
  // - Clear fraud alerts
  // - Monitor system health
  // ================================================================================

  // ================================================================================
  // METHOD: getAdminDashboard()
  // ================================================================================
  // TUJUAN:
  // Mengambil statistik dashboard untuk admin page.
  //
  // RETURN:
  // - {
  //     totalUsers: number,
  //     totalTransactions: number,
  //     totalBalance: number,
  //     activeUsers: number,
  //     recentTransactions: Transaction[],
  //     fraudAlerts: FraudAlert[]
  //   }
  // ================================================================================
  async getAdminDashboard() { // async getAdminDashboard: mengambil data ringkasan untuk dashboard admin; statistik user, transaksi, dan fraud
    // STEP 1: Call admin dashboard endpoint
    // Endpoint: GET /api/admin/dashboard
    // Requires admin token (backend validates role)
    return await this.makeRequest('/api/admin/dashboard'); // GET ke /api/admin/dashboard; hanya bisa diakses dengan admin credentials; mengembalikan statistik sistem
  }

  // ================================================================================
  // METHOD: getAllUsers()
  // ================================================================================
  // TUJUAN:
  // Mengambil semua users untuk admin management.
  //
  // RETURN:
  // - Array of users dengan balance dan status
  // ================================================================================
  async getAllUsers() { // async getAllUsers: mengambil daftar semua user untuk tampilan admin; diperlukan admin credentials
    // STEP 1: Call admin users endpoint
    // Endpoint: GET /api/admin/users
    // Returns all users termasuk blocked users
    return await this.makeRequest('/api/admin/users'); // GET ke /api/admin/users; admin-only endpoint untuk mendapatkan seluruh daftar akun user
  }

  // ================================================================================
  // METHOD: getAllTransactions()
  // ================================================================================
  // TUJUAN:
  // Mengambil semua transactions untuk monitoring dan audit.
  //
  // RETURN:
  // - Array of all transactions with sender/receiver details
  // ================================================================================
  async getAllTransactions() { // async getAllTransactions: mengambil semua transaksi sistem untuk laporan admin
    // STEP 1: Call admin transactions endpoint
    // Endpoint: GET /api/admin/transactions
    // Returns all transactions in system
    return await this.makeRequest('/api/admin/transactions'); // GET ke /api/admin/transactions; admin-only endpoint untuk melihat semua transaksi di sistem
  }

  // ================================================================================
  // METHOD: blockUser()
  // ================================================================================
  // TUJUAN:
  // Block user (suspend account) karena fraud atau violation.
  //
  // PARAMETER:
  // - userId: number - ID user yang akan diblock
  // - reason: string - Alasan block (untuk audit log)
  //
  // RETURN:
  // - { success: true, message: "User blocked" }
  // ================================================================================
  async blockUser(userId: number, reason: string) { // async blockUser: memblokir akun user; admin bisa blokir user yang terdeteksi melakukan fraud
    // STEP 1: Send PUT request ke block endpoint
    // Endpoint: PUT /api/admin/users/{userId}/block
    // Backend akan set user.blocked = true dan record reason
    return await this.makeRequest(`/api/admin/users/${userId}/block`, { // PUT ke endpoint block user; mengubah status user menjadi BLOCKED di database
      method: 'PUT', // method 'PUT': HTTP method untuk mengganti data yang sudah ada; digunakan untuk update resource secara keseluruhan
      body: { reason }, // body: mengirim { reason } ke backend; alasan pemblokiran disimpan di database untuk audit
    });
  }

  // ================================================================================
  // METHOD: unblockUser()
  // ================================================================================
  // TUJUAN:
  // Unblock user yang sebelumnya diblock.
  //
  // PARAMETER:
  // - userId: number - ID user yang akan di-unblock
  //
  // RETURN:
  // - { success: true, message: "User unblocked" }
  // ================================================================================
  async unblockUser(userId: number) { // async unblockUser: membuka blokir akun user; admin bisa restore akses user yang sudah diverifikasi
    // STEP 1: Send PUT request ke unblock endpoint
    // Endpoint: PUT /api/admin/users/{userId}/unblock
    // Backend akan set user.blocked = false
    return await this.makeRequest(`/api/admin/users/${userId}/unblock`, { // PUT ke endpoint unblock user; mengubah status user kembali menjadi ACTIVE
      method: 'PUT', // method 'PUT': HTTP method untuk mengganti data yang sudah ada; digunakan untuk update resource secara keseluruhan
    });
  }

  // ================================================================================
  // DEVICE METHODS - OPERASI UNTUK DEVICE MANAGEMENT
  // ================================================================================
  // TUJUAN:
  // Method-method untuk register dan sync device information.
  //
  // Device Tracking:
  // - Track device yang digunakan untuk setiap transaksi
  // - Detect suspicious login dari device baru
  // - Sync data antar devices (multi-device support)
  // ================================================================================

  // ================================================================================
  // METHOD: registerDevice()
  // ================================================================================
  // TUJUAN:
  // Register device baru ke backend (first-time device setup).
  //
  // PARAMETER:
  // - deviceInfo: {
  //     deviceId: string,
  //     deviceName: string,
  //     platform: string, // 'ios' | 'android'
  //     appVersion: string
  //   }
  //
  // RETURN:
  // - { success: true, device: {...} }
  // ================================================================================
  async registerDevice(deviceInfo: { // async registerDevice: mendaftarkan perangkat Android ke backend; dipanggil saat pertama kali app diinstall
    deviceId: string; // deviceId: identifier unik perangkat Android yang dihasilkan oleh sistem; digunakan untuk tracking perangkat
    deviceName: string; // deviceName: nama model perangkat (misal: Samsung Galaxy S21); untuk identifikasi di dashboard admin
    platform: string; // platform: sistem operasi perangkat (android/ios); untuk statistik penggunaan platform
    appVersion: string; // appVersion: versi aplikasi yang terinstall; untuk memastikan kompatibilitas dengan backend
  }) {
    // STEP 1: Send POST request ke device register endpoint
    // Endpoint: POST /api/devices/register
    // Backend akan save device info untuk tracking
    return await this.makeRequest('/api/devices/register', { // POST ke /api/devices/register untuk mendaftarkan perangkat baru ke database
      method: 'POST', // method 'POST': HTTP method untuk mengirim data baru ke server; digunakan untuk create resource atau submit data
      body: deviceInfo, // body: mengirim seluruh informasi perangkat ke backend untuk disimpan di tabel Device
    });
  }

  // ================================================================================
  // METHOD: syncDeviceData()
  // ================================================================================
  // TUJUAN:
  // Sync data dari backend ke device (pull latest data).
  //
  // USE CASE:
  // - Sync balance after offline mode
  // - Update transaction history
  // - Get latest fraud alerts
  //
  // RETURN:
  // - { balance, transactions, settings }
  // ================================================================================
  async syncDeviceData() { // async syncDeviceData: menyinkronkan data lokal perangkat dengan server; dijalankan secara periodik
    // STEP 1: Get device ID dari storage atau generate baru
    const deviceId = await this.getDeviceId(); // const deviceId: mengambil ID perangkat yang tersimpan di AsyncStorage; await karena operasi async
    
    // STEP 2: Call device sync endpoint
    // Endpoint: GET /api/devices/{deviceId}/sync
    // Backend akan return latest data untuk device ini
    return await this.makeRequest(`/api/devices/${deviceId}/sync`); // GET ke endpoint sync perangkat untuk menyinkronkan status dan data antara app dan backend
  }

  // ================================================================================
  // UTILITY METHODS - HELPER FUNCTIONS
  // ================================================================================
  // TUJUAN:
  // Method-method utility untuk health check, connection status, dll.
  // ================================================================================

  // ================================================================================
  // METHOD: healthCheck()
  // ================================================================================
  // TUJUAN:
  // Check apakah backend server online dan responsive.
  //
  // USE CASE:
  // - Check connection saat app startup
  // - Periodic health check untuk monitoring
  // - Display "Server Offline" message jika backend down
  //
  // RETURN:
  // - { status: 'ok', timestamp: Date } jika server online
  // - Throw error jika server offline atau unreachable
  // ================================================================================
  async healthCheck() { // async healthCheck: memeriksa apakah backend server sedang online dan bisa merespons; digunakan saat startup
    // STEP 1: Call health check endpoint
    // Endpoint: GET /api/health
    // Backend akan return status dan timestamp
    // Endpoint ini selalu public (no authentication required)
    return await this.makeRequest('/api/health'); // GET ke /api/health; endpoint sederhana yang backend beri respons 'OK' jika server berjalan normal
  }

  // ================================================================================
  // METHOD: getConnectionStatus()
  // ================================================================================
  // TUJUAN:
  // Get current connection status (URL, auth state, userId).
  //
  // USE CASE:
  // - Display connection info di settings page
  // - Debug connection issues
  // - Check apakah user authenticated
  //
  // RETURN:
  // - {
  //     url: string,
  //     authenticated: boolean,
  //     userId: string | null
  //   }
  // ================================================================================
  getConnectionStatus() { // getConnectionStatus: mengembalikan objek status koneksi saat ini; digunakan untuk tampilkan indikator koneksi di UI
    // STEP 1: Return current connection state
    // Ini adalah synchronous method (tidak hit backend)
    return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
      url: this.baseUrl,                    // Backend URL yang sedang digunakan
      authenticated: !!this.token,          // Boolean: apakah user punya token
      userId: this.userId,                  // Current logged-in user ID
    };
  }

  // ================================================================================
  // METHOD: getDeviceId() - PRIVATE HELPER
  // ================================================================================
  // TUJUAN:
  // Get atau generate unique device ID untuk tracking.
  //
  // FLOW:
  // 1. Check apakah device ID sudah ada di AsyncStorage
  // 2. Jika sudah ada, return yang lama
  // 3. Jika belum, generate ID baru dan save ke storage
  //
  // RETURN:
  // - string: Unique device ID (contoh: "ios_ABC123...")
  // ================================================================================
  private async getDeviceId(): Promise<string> { // getDeviceId: mengambil atau menghasilkan ID unik perangkat; disimpan di AsyncStorage agar konsisten lintas session
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Check apakah device ID sudah tersimpan
      let deviceId = await AsyncStorage.getItem('deviceId'); // AsyncStorage.getItem() membaca data dari penyimpanan lokal perangkat secara async
      
      // STEP 2: Jika belum ada, generate device ID baru
      if (!deviceId) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        // Generate format: {platform}_{expoDeviceId atau random}
        // Platform.OS = 'ios' atau 'android'
        // Constants.deviceId = unique ID dari Expo
        // Math.random().toString(36) = generate random string
        deviceId = Platform.OS + '_' + Constants.deviceId || Math.random().toString(36); // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
        
        // Save ke AsyncStorage agar persistent
        await AsyncStorage.setItem('deviceId', deviceId); // AsyncStorage.setItem() menyimpan data ke penyimpanan lokal perangkat secara async
        console.log('📱 New device ID generated:', deviceId); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }
      
      return deviceId; // mengembalikan deviceId ke pemanggil; jika baru dibuat sudah tersimpan di AsyncStorage
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // STEP 3: Fallback jika error (generate temporary ID)
      // Format: {platform}_unknown_{timestamp}
      console.error('❌ Error getting device ID:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      return Platform.OS + '_unknown_' + Date.now(); // Date.now() mengembalikan timestamp milidetik saat ini; digunakan untuk cap waktu operasi
    }
  }

  // ================================================================================
  // METHOD: topUpCard()
  // ================================================================================
  // TUJUAN:
  // Top-up saldo kartu NFC milik user.
  // Endpoint: POST /api/nfc-cards/topup
  //
  // PARAMETER:
  // - cardId: string        - UID kartu NFC yang akan di-top-up
  // - amount: number        - Nominal top-up dalam Rupiah (harus > 0)
  // - adminPassword: string - Password admin untuk otorisasi
  //
  // RETURN:
  // - { success: true, card: { cardId, balance, previousBalance } }
  // ================================================================================
  async topUpCard(cardId: string, amount: number, adminPassword: string) {
    return await this.makeRequest('/api/nfc-cards/topup', {
      method: 'POST',
      body: { cardId, amount, adminPassword },
    });
  }

  // ================================================================================
  // METHOD: destroy()
  // ================================================================================
  // TUJUAN:
  // Cleanup method untuk destroy instance (logout dan clear semua data).
  //
  // USE CASE:
  // - App shutdown atau force logout
  // - Clear all cached data
  // - Reset APIService ke state awal
  //
  // RETURN: void
  // ================================================================================
  destroy(): void { // destroy: membersihkan state APIService; dipanggil saat aplikasi ditutup atau logout total
    // STEP 1: Clear token dan userId dari memory
    this.token = null; // mengeset token ke null di memory; token tidak lagi disertakan di request HTTP berikutnya
    this.userId = null; // mengeset userId ke null di memory; user tidak lagi dikenali oleh service ini
    
    console.log('🧹 API Service destroyed and cleaned up'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
  }
}

// ==================================================================================
// EXPORT SINGLETON INSTANCE
// ==================================================================================
// TUJUAN:
// Export instance tunggal APIService agar bisa digunakan di file lain.
//
// PATTERN:
// - Create singleton instance saat module di-import
// - Export instance (bukan class) agar caller tidak perlu getInstance()
// - Legacy exports untuk backward compatibility
//
// USAGE EXAMPLES:
// ```typescript
// import { apiService } from './apiService';
//
// // Login
// const result = await apiService.login({ username, password });
//
// // Get user
// const user = await apiService.getUserById(123);
//
// // Process payment
// await apiService.processNFCPayment({ receiverNFCData, amount });
// ```
// ==================================================================================

// Export singleton instance (recommended usage)
// Instance ini sudah di-initialize dan ready to use
export const apiService = APIService.getInstance(); // mengekspor instance tunggal APIService; semua file yang import apiService mendapat objek yang sama (Singleton)

// Legacy exports untuk backward compatibility
// Dulu ada 2 class terpisah: adminConnector dan backendAPI
// Sekarang unified jadi 1 class: APIService
// Tapi untuk tidak break existing code, kita export dengan nama lama juga
export const adminConnector = apiService; // adminConnector: alias untuk apiService; nama alternatif untuk penggunaan fitur admin; merujuk ke instance yang sama
export const backendAPI = apiService; // backendAPI: alias lain untuk apiService; nama deskriptif untuk akses backend API; merujuk ke instance yang sama

// ==================================================================================
// AUTO-INITIALIZATION
// ==================================================================================
// Initialize APIService saat module pertama kali di-import.
// Ini akan load token dari AsyncStorage jika ada.
// ==================================================================================
apiService.initialize(); // memanggil initialize() saat module pertama kali di-import; memastikan token dimuat dari AsyncStorage sebelum ada request