// src/utils/database.ts
// ==================================================================================
// 💾 DATABASE UTILITY - WRAPPER FUNCTIONS UNTUK API SERVICE
// ==================================================================================
//
// Tujuan File:
// File ini adalah "abstraction layer" antara UI components dengan API service.
// Menyediakan simple functions untuk operasi database (auth, users, transactions).
//
// Kenapa Perlu Abstraction Layer?
// 1. Simplicity: UI components tidak perlu tahu detail HTTP calls
// 2. Caching: Implement local cache untuk data yang sering diakses
// 3. Offline Support: Fallback ke cached data jika API gagal
// 4. Consistency: Semua files menggunakan functions yang sama
//
// Pattern yang Digunakan:
// - Wrapper Functions: Thin wrapper around apiService methods
// - Caching Strategy: Cache user data di AsyncStorage untuk speed
// - Error Handling: Silent failures dengan fallback ke cache
// - Logging: Console logs untuk debugging
//
// Struktur File:
// 1. Type Definitions: Interface untuk User dan Transaction
// 2. Auth Functions: register, login, logout, restoreSession
// 3. User Functions: getUserById, getAllUsers (with caching)
// 4. Transaction Functions: processPayment, getUserTransactions, getAllTransactions
// 5. Admin Functions: getAdminStats
// 6. Balance Sync Functions: updateUserBalance, syncBalanceFromBackend
// 7. Database Init/Close Functions
//
// ==================================================================================

import AsyncStorage from '@react-native-async-storage/async-storage'; // import AsyncStorage — penyimpanan key-value persisten di perangkat mobile; digunakan untuk cache data user agar akses lebih cepat tanpa perlu request API setiap saat
import { Platform } from 'react-native'; // import Platform dari React Native — digunakan untuk mendeteksi platform Android/iOS, berguna saat format atau logika berbeda tiap platform
import { apiService } from './apiService'; // import apiService Singleton dari apiService.ts — semua operasi HTTP (login, register, getUser, dll) dilakukan melalui service ini

// ==================================================================================
// 🔹 TYPE DEFINITIONS - INTERFACE UNTUK DATA STRUCTURES
// ==================================================================================
//
// Interface adalah "contract" atau "blueprint" untuk object structure.
// TypeScript akan validate bahwa object sesuai dengan interface ini.
//
// Keuntungan Interface:
// - Type Safety: Error jika object tidak sesuai structure
// - Autocomplete: IDE bisa suggest properties
// - Documentation: Interface describe data structure dengan jelas
// - Refactoring: Easier to change structure across all files
//
// ==================================================================================

// Interface untuk User object
// Describes structure dari user data yang diterima dari backend
export interface User {
  id: number;              // Unique user ID (primary key di database)
  name: string;            // Full name user (contoh: "John Doe")
  username: string;        // Username untuk login (unique, contoh: "john123")
  balance: number;         // Current balance dalam Rupiah (contoh: 100000)
  createdAt?: string;      // ISO timestamp kapan user dibuat (optional)
}

// Interface untuk Transaction object
// Describes structure dari transaction data yang diterima dari backend
export interface Transaction {
  id: number;              // Unique transaction ID (primary key)
  senderId: number;        // ID user yang mengirim uang
  receiverId: number;      // ID user yang menerima uang
  amount: number;          // Jumlah uang yang ditransfer (dalam Rupiah)
  type?: string;           // Type transaksi: 'transfer', 'topup', 'payment' (optional)
  createdAt: string;       // ISO timestamp kapan transaksi terjadi
}

// ==================================================================================
// 🔐 AUTH FUNCTIONS - USER AUTHENTICATION OPERATIONS
// ==================================================================================
//
// Functions untuk register, login, logout, dan restore session.
// Semua functions ini adalah wrappers around apiService methods.
//
// Auth Flow:
// 1. User register → Create account di backend
// 2. User login → Get token dari backend
// 3. Token saved to AsyncStorage (persistent)
// 4. App restart → Restore session from token
// 5. User logout → Delete token from storage
//
// ==================================================================================

// ================================================================================
// FUNCTION: registerUser()
// ================================================================================
// TUJUAN:
// Register user baru dengan name, username, dan password.
//
// FLOW:
// 1. Call apiService.register() dengan user data
// 2. Backend validate dan save user ke database
// 3. Return user object jika berhasil
// 4. Throw error jika gagal (username already exists, dll)
//
// PARAMETER:
// - name: string - Full name user
// - username: string - Username untuk login (harus unique)
// - password: string - Password (akan di-hash by backend)
//
// RETURN:
// - Promise<User> - User object jika berhasil
// ================================================================================
export const registerUser = async (
  name: string,
  username: string,
  password: string
): Promise<User> => {
  // Panggil method register dari apiService yang akan kirim data ke backend
  // Backend akan validasi data, hash password, dan simpan user baru ke database
  return await apiService.register({ name, username, password }); // Await karena operasi async
  
  // CATATAN PENTING: Fungsi ini tidak otomatis login user setelah registrasi
  // Caller harus panggil loginUser() secara manual setelah register berhasil
};

// ================================================================================
// FUNCTION: loginUser()
// ================================================================================
// TUJUAN:
// Login user dengan username dan password, save token ke storage.
//
// FLOW:
// 1. Call apiService.login() dengan credentials
// 2. Backend validate credentials (bcrypt compare password)
// 3. Jika valid, backend generate JWT token
// 4. Save token dan userId ke AsyncStorage (persistent)
// 5. Return user object untuk display di UI
//
// PARAMETER:
// - username: string - Username untuk login
// - password: string - Password (plain text, akan divalidasi by backend)
//
// RETURN:
// - Promise<User | null> - User object jika berhasil, null jika gagal
// ================================================================================
export const loginUser = async (
  username: string,
  password: string
): Promise<User | null> => {
  try {
    // STEP 1: Kirim credentials ke backend API untuk authentication
    // Backend akan validate username/password di database dan generate JWT token
    const response = await apiService.login({ username, password }); // POST /api/auth/login

    // STEP 2: Validasi respons dari backend
    // Pastikan response mengandung token (JWT) dan user data lengkap
    // Optional chaining (?.) mencegah error jika response null/undefined
    if (response?.token && response?.user?.id) {
      // SUBSTEP 2a: Simpan JWT token ke AsyncStorage untuk persistent session
      // Token ini akan otomatis diload saat app restart (auto-login)
      await AsyncStorage.setItem('token', response.token); // Key: 'token', Value: JWT string
      
      // SUBSTEP 2b: Simpan userId untuk tracking, fraud detection, dan analytics
      // AsyncStorage hanya menerima string, jadi convert number → string
      await AsyncStorage.setItem('userId', response.user.id.toString()); // Convert ID to string
      
      // SUBSTEP 2c: Log konfirmasi untuk debugging
      console.log('✅ Login success, token saved to AsyncStorage'); // Success message
      
      // SUBSTEP 2d: Return user object untuk ditampilkan di UI (dashboard)
      // Object ini berisi: { id, name, username, balance, isActive, ... }
      return response.user; // User data from backend
    }

    // STEP 3: Handle kasus respons tidak valid (seharusnya tidak terjadi jika backend benar)
    console.warn('⚠️ No token received from backend (invalid response format)'); // Warning log
    return null; // Null = login gagal (invalid credentials atau backend error)
    
  } catch (error: any) {
    // STEP 4: Error handling untuk semua jenis error
    // Error bisa dari:
    // - Network error (no internet, server down)
    // - Invalid credentials (username/password salah)
    // - Backend error (500, database down)
    console.error('❌ Login error:', error.message || error); // Log error detail untuk debugging
    
    // Return null agar caller (LoginScreen) tahu login gagal
    // Caller bisa tampilkan Alert error ke user
    return null; // Indikasi login failed
  }
};

// ================================================================================
// FUNCTION: logoutUser()
// ================================================================================
// TUJUAN:
// Logout user dan hapus semua session data dari storage.
//
// FLOW:
// 1. Notify backend bahwa user logout (optional, best effort)
// 2. Delete token dan userId dari AsyncStorage
// 3. Clear any cached user data
// 4. App akan redirect ke login screen
//
// RETURN:
// - Promise<void> - No return value
// ================================================================================
export const logoutUser = async (): Promise<void> => {
  try {
    // STEP 1: Cek apakah ada token tersimpan (user sedang login)
    const token = await AsyncStorage.getItem('token'); // Ambil token dari storage
    
    // STEP 2: Jika ada token, beritahu backend bahwa user logout
    // Backend akan menambahkan token ke blacklist agar tidak bisa dipakai lagi
    if (token) {
      await apiService.logout(); // Kirim request logout ke backend
    }
    
  } catch {
    // STEP 3: Abaikan error dari backend logout
    // Meskipun backend gagal, kita tetap harus hapus data lokal
    // Prioritas: logout selalu berhasil dari sisi user
    console.warn('⚠️ Backend logout failed, continuing with local cleanup'); // Log warning
  } finally {
    // STEP 4: Selalu jalankan cleanup lokal (bahkan jika backend gagal)
    // Hapus token dan userId dari AsyncStorage
    await AsyncStorage.multiRemove(['token', 'userId']); // Hapus 2 keys sekaligus (efisien)
    
    // STEP 5: Log konfirmasi logout berhasil
    console.log('🚪 Logout successful, session data cleared from storage'); // Konfirmasi cleanup
  }
};

// ================================================================================
// FUNCTION: restoreSession()
// ================================================================================
// TUJUAN:
// Restore user session dari token yang tersimpan (auto-login saat app startup).
//
// FLOW:
// 1. Check apakah token dan userId ada di AsyncStorage
// 2. Jika ada, fetch user data from backend (validate token masih valid)
// 3. Jika token valid, return user object (auto-login berhasil)
// 4. Jika token invalid/expired, return null (user harus login lagi)
//
// USE CASE:
// - App startup: Check apakah user sudah login sebelumnya
// - After app restart: Don't force user to login again
// - Token validation: Check apakah token masih active
//
// RETURN:
// - Promise<User | null> - User object jika session valid, null jika tidak
// ================================================================================
export const restoreSession = async (): Promise<User | null> => {
  try {
    // STEP 1: Coba load session credentials dari AsyncStorage
    // Jika user pernah login dan belum logout, data ini akan ada
    const token = await AsyncStorage.getItem('token'); // Load JWT token
    const userId = await AsyncStorage.getItem('userId'); // Load user ID
    
    // STEP 2: Validasi apakah kedua data ada (both required untuk session valid)
    // Guard clause: early return jika salah satu missing
    if (!token || !userId) {
      console.log('ℹ️ No saved session found (token or userId missing)'); // Info log (not error)
      return null; // Return null = user belum login atau sudah logout
    }

    // STEP 3: Validate token dengan fetch user data dari backend
    // Jika token expired/invalid, backend akan return 401 error
    // getUserById akan throw error, kita catch di bawah
    const user = await getUserById(Number(userId)); // Convert string → number, lalu fetch
    
    // STEP 4: Jika berhasil fetch user, berarti token masih valid
    // Auto-login berhasil, user bisa langsung ke dashboard
    if (user) {
      console.log('✅ Session restored successfully for user:', user.username); // Log with username
    }
    return user; // Return user object atau null jika fetch failed
    
  } catch (error) {
    // STEP 5: Handle error (token expired, network down, backend error)
    console.error('❌ Session restore failed:', error); // Log error untuk debugging
    
    // Cleanup invalid session data untuk prevent retry loop
    // Token expired = tidak bisa diperbaiki, harus login ulang
    await AsyncStorage.multiRemove(['token', 'userId']); // Delete invalid credentials
    return null; // Return null = force user to login manually
  }
};

// ==================================================================================
// 👤 USER FUNCTIONS - OPERASI UNTUK MENGAMBIL DATA USER
// ==================================================================================
//
// Functions untuk get user data by ID atau get all users.
// Implements caching strategy untuk improve performance dan offline support.
//
// Caching Strategy:
// 1. Try get dari cache first (AsyncStorage) → Fast response
// 2. If not in cache, fetch from backend → Save to cache
// 3. If backend fails, fallback to cache → Offline support
//
// Cache Key Format: `user_{userId}` (contoh: "user_123")
//
// ==================================================================================

// ================================================================================
// FUNCTION: getUserById()
// ================================================================================
// TUJUAN:
// Mengambil data user berdasarkan ID dengan intelligent caching.
//
// CACHING FLOW:
// 1. Check cache first (AsyncStorage) → Return jika ada
// 2. If not in cache, fetch from backend → Save to cache
// 3. If backend fails, fallback to cache → Better than nothing!
//
// USE CASE:
// - Get receiver info before payment
// - Display user profile
// - Sync balance after transaction
//
// PARAMETER:
// - id: number - User ID yang ingin diambil
//
// RETURN:
// - Promise<User | null> - User object jika found, null jika not found
// ================================================================================
export const getUserById = async (id: number): Promise<User | null> => {
  try {
    // STEP 1: Try load dari cache local dulu (untuk speed)
    // Cache key format: "user_123" untuk user dengan ID 123
    const cacheKey = `user_${id}`; // template literal: membuat key cache unik berdasarkan ID, contoh: 'user_123'
    const cachedUser = await AsyncStorage.getItem(cacheKey); // await membaca data dari penyimpanan lokal; getItem mengembalikan string atau null
    
    if (cachedUser) { // jika cachedUser tidak null berarti data tersedia di cache
      const user = JSON.parse(cachedUser); // JSON.parse mengonversi string JSON menjadi objek JavaScript
      console.log(`\ud83d\udcbe Loaded user from cache: ${user.username}`);
      return user; // mengembalikan data dari cache — lebih cepat daripada request ke backend
    }
    
    // STEP 3: Jika tidak ada di cache, fetch dari backend
    // apiService.getUserById() returns the user object directly (not wrapped in {user: ...})
    const res = await apiService.getUserById(id); // await memanggil HTTP GET ke backend; id diteruskan sebagai parameter untuk mencari user berdasarkan ID
    
    const userObj = (res && (res as any).user) ? (res as any).user : (res && (res as any).id !== undefined ? res : null); // ternary operator: jika respons membungkus user dalam properti 'user', ambil itu; jika respons adalah objek user langsung, gunakan langsung
    if (userObj) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(userObj)); // JSON.stringify mengonversi objek JavaScript menjadi string JSON untuk disimpan di AsyncStorage
      console.log(`✅ Loaded user from backend: ${userObj.username}`);
      return userObj;
    }
    
    // STEP 5: Jika backend return invalid response, return null
    return null;
    
  } catch (err) {
    // STEP 6: Handle errors (network error, backend down, dll)
    console.error('❌ getUserById error:', err);
    
    // STEP 7: Fallback to cache even if backend error
    // Better to show stale data than no data!
    try {
      const cacheKey = `user_${id}`;
      const cachedUser = await AsyncStorage.getItem(cacheKey);
      
      if (cachedUser) {
        const user = JSON.parse(cachedUser);
        console.log(`💾 Fallback: loaded user from cache after backend error`);
        return user; // Return cached data as fallback
      }
    } catch (cacheError) {
      // STEP 8: If even cache fallback fails, log error
      console.error('❌ Cache fallback error:', cacheError);
    }
    
    // STEP 9: Ultimate fallback: return null
    // No cache, no backend → cannot get user
    return null;
  }
};

// ================================================================================
// FUNCTION: getAllUsers()
// ================================================================================
// TUJUAN:
// Mengambil semua users dari backend (digunakan untuk admin atau search).
//
// FLOW:
// 1. Call apiService.getAllUsers()
// 2. Backend query semua users dari database
// 3. Return array of users
// 4. Jika error, return empty array (silent failure)
//
// USE CASE:
// - Admin panel: List all users
// - Search user: Autocomplete untuk find receiver
//
// RETURN:
// - Promise<User[]> - Array of users (empty array jika error)
// ================================================================================
export const getAllUsers = async (): Promise<User[]> => {
  try {
    // STEP 1: Call apiService.getAllUsers()
    // Endpoint: GET /api/admin/users
    // Requires admin token (untuk security)
    const res = await apiService.getAllUsers(); // await memanggil HTTP GET /api/admin/users untuk mengambil semua data user
    
    return Array.isArray(res) ? res : []; // Array.isArray() memeriksa apakah respons adalah array; ternary: jika ya kembalikan, jika bukan kembalikan array kosong
    
  } catch {
    // STEP 3: Handle errors dengan silent failure
    // Return empty array instead of throwing error
    // UI akan display "No users found" instead of error message
    console.error('❌ getAllUsers error, returning empty array');
    return [];
  }
};

// ==================================================================================
// 💳 TRANSACTION FUNCTIONS - OPERASI TRANSAKSI KEUANGAN
// ==================================================================================
//
// Functions untuk process payment dan get transaction history.
//
// Transaction Flow:
// 1. User initiate payment (select receiver, input amount)
// 2. App call processPayment() atau getUserTransactions()
// 3. Backend validate dan process transaction
// 4. Backend return result
// 5. App update UI dengan result
//
// ==================================================================================

// ================================================================================
// FUNCTION: processPayment()
// ================================================================================
// TUJUAN:
// Kirim saldo dari sender ke receiver (transfer uang antar user).
//
// FLOW:
// 1. Build payload dengan transaction data
// 2. Send ke backend untuk processing
// 3. Backend validate dan create transaction
// 4. Return success/failure
//
// PARAMETER:
// - senderId: number - ID user yang mengirim uang
// - receiverUsername: string - Username receiver (bukan ID!)
// - amount: number - Jumlah uang yang ditransfer
// - description: string - Deskripsi transaksi (optional, default empty)
//
// RETURN:
// - Promise<boolean> - true jika berhasil, false jika gagal
//
// NOTE:
// Function ini currently incomplete (TODO implement receiverId lookup).
// Backend memerlukan receiverId, tapi function ini hanya punya receiverUsername.
// Solusi: Backend harus implement endpoint untuk lookup user by username.
// ================================================================================
export const processPayment = async (
  senderId: number,
  receiverUsername: string,
  amount: number,
  description = ''
): Promise<boolean> => {
  try {
    // STEP 1: Build payload dengan transaction data
    const payload = { // const membuat objek tetap; berisi semua data yang diperlukan untuk transaksi
      senderId,              // shorthand property: ID user pengirim
      receiverUsername,      // shorthand property: username penerima (perlu dikonversi ke ID)
      amount,                // shorthand property: jumlah uang dalam Rupiah
      description,           // shorthand property: deskripsi transaksi
      deviceId: Platform.OS, // Platform.OS mengembalikan 'ios' atau 'android' — digunakan untuk fraud detection
    };

    // STEP 2: TODO - Implement user lookup by username
    // Problem: Backend API requires receiverId (number), but we have receiverUsername (string)
    // Solution: Backend harus implement GET /api/users/username/{username} endpoint
    // Then: const receiver = await apiService.getUserByUsername(receiverUsername);
    // Then: payload.receiverId = receiver.id;
    
    console.log('⚠️ Backend transaction creation skipped - need receiverId lookup');
    console.log('📋 Payload that would be sent:', payload);

    // STEP 3: Return false karena implementation incomplete
    return false;
    
    // FUTURE CODE (when backend endpoint ready):
    // const result = await apiService.createTransaction(payload);
    // return result.success;
    
  } catch (error: any) {
    // STEP 4: Handle errors
    console.error('❌ Payment error:', error.message || error);
    return false;
  }
};

// ================================================================================
// FUNCTION: getUserTransactions()
// ================================================================================
// TUJUAN:
// Mengambil semua transaksi user tertentu (send + received).
//
// FLOW:
// 1. Call apiService.getUserTransactions(userId)
// 2. Backend query transactions from database
// 3. Return array of transactions
// 4. Jika error, return empty array
//
// USE CASE:
// - Display transaction history di Dashboard
// - Calculate statistics (total spent, frequency)
// - Fraud detection (analyze patterns)
//
// PARAMETER:
// - userId: number - ID user yang ingin diambil transaksinya
//
// RETURN:
// - Promise<Transaction[]> - Array of transactions
// ================================================================================
export const getUserTransactions = async (
  userId: number
): Promise<Transaction[]> => {
  try {
    // STEP 1: Call apiService wrapper
    // Endpoint: GET /api/transactions/user/{userId}
    // Backend akan query: WHERE senderId = userId OR receiverId = userId
    const res = await apiService.getUserTransactions(userId); // await memanggil HTTP GET ke backend; userId diteruskan untuk mengambil riwayat transaksi user tersebut
    
    return Array.isArray(res) ? res : []; // Array.isArray() memeriksa apakah respons adalah array; ternary: kembalikan array jika ya, atau array kosong sebagai fallback
    
  } catch {
    // STEP 3: Handle errors dengan silent failure
    // Return empty array instead of throwing
    console.error('❌ getUserTransactions error, returning empty array');
    return [];
  }
};

// ================================================================================
// FUNCTION: getAllTransactions()
// ================================================================================
// TUJUAN:
// Mengambil SEMUA transaksi di sistem (untuk admin).
//
// FLOW:
// 1. Call apiService.getAllTransactions()
// 2. Backend query ALL transactions (requires admin token)
// 3. Return array of transactions
//
// USE CASE:
// - Admin panel: Monitor all transactions
// - Audit: Check suspicious transactions
// - Statistics: Total transaction volume
//
// RETURN:
// - Promise<Transaction[]> - Array of all transactions
// ================================================================================
export const getAllTransactions = async (): Promise<Transaction[]> => {
  try {
    // STEP 1: Call admin API endpoint
    // Endpoint: GET /api/admin/transactions
    // Requires admin role (backend validates token)
    const res = await apiService.getAllTransactions();
    
    // STEP 2: Return array atau empty array
    return Array.isArray(res) ? res : [];
    
  } catch {
    // STEP 3: Silent failure
    console.error('❌ getAllTransactions error, returning empty array');
    return [];
  }
};

// ==================================================================================
// 🧮 ADMIN FUNCTIONS - OPERASI UNTUK ADMIN DASHBOARD
// ==================================================================================
//
// Functions untuk admin operations (statistics, monitoring, dll).
// Requires admin token untuk authentication.
//
// ==================================================================================

// ================================================================================
// FUNCTION: getAdminStats()
// ================================================================================
// TUJUAN:
// Mengambil statistik untuk admin dashboard.
//
// FLOW:
// 1. Call apiService.getAdminDashboard()
// 2. Backend aggregate data dari database:
//    - Count total users
//    - Count total transactions
//    - Sum total balance
// 3. Return statistics object
//
// USE CASE:
// - Admin Dashboard: Display key metrics
// - Monitoring: Track system health
//
// RETURN:
// - Promise<{
//     totalUsers: number,
//     totalTransactions: number,
//     totalBalance: number
//   }>
// ================================================================================
export const getAdminStats = async () => {
  try {
    // STEP 1: Call admin dashboard API
    // Endpoint: GET /api/admin/dashboard
    // Requires admin token (backend checks role)
    const res = await apiService.getAdminDashboard();
    
    // STEP 2: Return stats atau default object jika error
    return res || {
      totalUsers: 0,
      totalTransactions: 0,
      totalBalance: 0,
    };
    
  } catch {
    // STEP 3: Fallback to default stats jika backend error
    console.error('❌ getAdminStats error, returning default stats');
    return {
      totalUsers: 0,
      totalTransactions: 0,
      totalBalance: 0,
    };
  }
};

// ==================================================================================
// 💰 BALANCE SYNC FUNCTIONS - OPERASI UNTUK SINKRONISASI BALANCE
// ==================================================================================
//
// Functions untuk update dan sync balance antara cache local dan backend.
//
// Balance Sync Strategy:
// 1. User balance disimpan di 2 tempat: Backend database + Local cache
// 2. Setelah transaksi, balance di-update di kedua tempat
// 3. Jika out of sync, sync from backend (source of truth)
// 4. Local cache untuk speed, backend untuk accuracy
//
// ==================================================================================

// ================================================================================
// FUNCTION: updateUserBalance()
// ================================================================================
// TUJUAN:
// Update user balance di cache lokal (tidak hit backend).
//
// FLOW:
// 1. Load user dari cache
// 2. Update balance property
// 3. Save back to cache dengan timestamp
//
// USE CASE:
// - Optimistic Update: Update UI immediately tanpa wait backend
// - Offline Mode: Update cache while offline, sync later
//
// PARAMETER:
// - userId: number - ID user yang balance-nya akan diupdate
// - newBalance: number - Balance baru (bukan increment!)
//
// RETURN:
// - Promise<boolean> - true jika berhasil, false jika gagal
// ================================================================================
export const updateUserBalance = async (userId: number, newBalance: number): Promise<boolean> => {
  try {
    // STEP 1: Build cache key untuk user ini
    const cacheKey = `user_${userId}`;
    
    // STEP 2: Load user data dari cache
    const userData = await AsyncStorage.getItem(cacheKey);
    
    // STEP 3: Jika user ada di cache, update balance
    if (userData) {
      // Parse JSON string → JavaScript object
      const user = JSON.parse(userData);
      
      // Update balance property dengan value baru
      user.balance = newBalance;
      
      // Add timestamp untuk track when balance was updated
      user.updatedAt = new Date().toISOString();
      
      // STEP 4: Save updated user back to cache
      // JSON.stringify() convert object → JSON string
      await AsyncStorage.setItem(cacheKey, JSON.stringify(user));
      
      console.log(`💰 Updated local balance for user ${userId}: ${newBalance}`);
      return true; // Success!
    }
    
    // STEP 5: Jika user tidak ada di cache, log warning
    console.warn(`⚠️ User ${userId} not found in local cache`);
    return false;
    
  } catch (error) {
    // STEP 6: Handle errors
    console.error('❌ Failed to update local balance:', error);
    return false;
  }
};

// ================================================================================
// FUNCTION: syncBalanceFromBackend()
// ================================================================================
// TUJUAN:
// Sync balance dari backend (source of truth) dan update cache lokal.
//
// FLOW:
// 1. Fetch user data dari backend
// 2. Extract balance dari response
// 3. Update local cache dengan balance baru
// 4. Return balance baru
// 5. Jika backend gagal, fallback to cached balance
//
// USE CASE:
// - After Transaction: Ensure balance is synced
// - App Startup: Load latest balance
// - Fix Out of Sync: When cache balance != backend balance
//
// PARAMETER:
// - userId: number - ID user yang balance-nya akan di-sync
//
// RETURN:
// - Promise<number | null> - Balance baru jika berhasil, null jika gagal
// ================================================================================
export const syncBalanceFromBackend = async (userId: number): Promise<number | null> => {
  try {
    console.log(`💰 Syncing balance for user ${userId}...`);
    
    // STEP 1: Fetch user data dari backend
    // Endpoint: GET /api/users/{userId}/public
    // Backend akan return latest user data from database
    const response = await apiService.getUserById(userId);
    
    // STEP 2: Validate response dan check balance
    if (response && typeof response.balance === 'number') {
      const newBalance = response.balance;
      
      // STEP 3: Update cache lokal dengan data user terbaru
      const cacheKey = `user_${userId}`;
      
      // Save full user object (not just balance) untuk consistency
      await AsyncStorage.setItem(cacheKey, JSON.stringify(response));
      
      console.log(`✅ Balance synced from backend for user ${userId}: ${newBalance}`);
      return newBalance;
    }
    
    // STEP 4: Handle invalid response (no balance field)
    console.warn('⚠️ Invalid balance response from backend');
    return null;
    
  } catch (error) {
    // STEP 5: Handle errors (network error, backend down, dll)
    console.error('❌ Failed to sync balance from backend:', error);
    
    // STEP 6: Fallback to cached balance (better than nothing!)
    try {
      const cacheKey = `user_${userId}`;
      const cachedUser = await AsyncStorage.getItem(cacheKey);
      
      if (cachedUser) {
        const user = JSON.parse(cachedUser);
        console.log(`💾 Fallback: using cached balance ${user.balance}`);
        return user.balance; // Return stale balance dari cache
      }
    } catch (cacheError) {
      console.error('❌ Cache fallback error:', cacheError);
    }
    
    // STEP 7: Ultimate fallback: return null
    return null;
  }
};

// ==================================================================================
// ⚙️ DATABASE INITIALIZATION & CLEANUP
// ==================================================================================
//
// Functions untuk initialize dan close database connection.
//
// NOTE:
// Karena mobile app menggunakan REST API (bukan direct database access),
// functions ini hanya check backend connection status.
// Tidak ada actual database connection yang perlu di-maintain.
//
// ==================================================================================

// ================================================================================
// FUNCTION: initDatabase()
// ================================================================================
// TUJUAN:
// Initialize database connection (check backend connectivity).
//
// FLOW:
// 1. Check apakah backend reachable
// 2. Log connection status
// 3. Return success/failure
//
// USE CASE:
// - App Startup: Check backend availability
// - Health Check: Periodic connection test
//
// RETURN:
// - Promise<boolean> - true jika backend connected, false jika offline
// ================================================================================
export const initDatabase = async (): Promise<boolean> => {
  try {
    console.log('🔗 Connecting to backend...');
    
    // STEP 1: In mobile app, there's no direct database connection
    // We only connect via HTTP API to backend
    // So "connected" just means backend is reachable
    const connected = true; // Placeholder (TODO: implement health check)
    
    // FUTURE CODE (when health check implemented):
    // const health = await apiService.healthCheck();
    // const connected = health.status === 'ok';
    
    // STEP 2: Log connection status
    if (connected) {
      console.log('✅ Backend connected and ready');
    } else {
      console.log('⚠️ Backend not available, running in offline mode');
    }
    
    return connected;
    
  } catch (error) {
    // STEP 3: Handle errors (network down, backend offline, dll)
    console.error('❌ initDatabase error:', error);
    return false; // Offline mode
  }
};

// ================================================================================
// FUNCTION: closeDatabase()
// ================================================================================
// TUJUAN:
// Close database connection (cleanup resources).
//
// NOTE:
// In mobile app with REST API, there's no persistent connection to close.
// This function is placeholder untuk consistency with backend API.
//
// RETURN:
// - Promise<void> - No return value
// ================================================================================
export const closeDatabase = async (): Promise<void> => {
  // STEP 1: Log closure (no actual cleanup needed)
  console.log('📦 Database connection closed (cleanup complete)');
  
  // In mobile app: No database connection to close
  // All API calls are stateless HTTP requests
  // AsyncStorage handles its own cleanup internally
};
