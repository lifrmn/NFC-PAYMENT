// App.tsx
// ==================================================================================
// 🎉 TITIK MASUK UTAMA APLIKASI
// ==================================================================================
//
// Tujuan:
// Komponen root untuk aplikasi mobile NFC Payment System.
// File ini menangani navigasi, autentikasi, inisialisasi awal, dan pengelolaan sesi.
// Dengan kata lain, App.tsx bertindak sebagai pengatur utama alur aplikasi.
//
// Alur saat aplikasi dijalankan:
// ┌────────────────────────────────────────────────────────────────────┐
// │ URUTAN STARTUP APLIKASI                                            │
// │                                                                    │
// │ 1. Menampilkan loading screen                                      │
// │ 2. Inisialisasi database lokal                                     │
// │ 3. Inisialisasi Backend API (restore token dan base URL)           │
// │ 4. Cek kesehatan backend secara non-blocking                       │
// │ 5. Registrasi device ke sistem admin                               │
// │ 6. Cek status autentikasi dari AsyncStorage                        │
// │ 7. Menentukan layar awal:                                          │
// │    - Jika sudah login -> Dashboard                                 │
// │    - Jika belum login -> Login                                     │
// │                                                                    │
// │ Proteksi timeout:                                                  │
// │ - Jika loading terlalu lama, aplikasi dipaksa pindah ke Login      │
// └────────────────────────────────────────────────────────────────────┘
//
// Struktur navigasi:
// ┌────────────────────────────────────────────────────────────────────┐
// │                         ALUR NAVIGASI LAYAR                        │
// ├────────────────────────────────────────────────────────────────────┤
// │                                                                    │
// │  LoginScreen <-> RegisterScreen                                    │
// │       |                                                            │
// │       v                                                            │
// │  DashboardScreen (pusat menu utama)                                │
// │       |- NFCScreen (proses pembayaran merchant)                    │
// │       |- RegisterCardScreen (daftarkan kartu NFC)                  │
// │       '- MyCardsScreen (kelola kartu pengguna)                     │
// │                                                                    │
// └────────────────────────────────────────────────────────────────────┘
//
// Fitur utama:
//
// 1. Navigasi stack:
//    - Menggunakan React Navigation Stack Navigator
//    - Header bawaan dimatikan agar tiap layar bebas memakai UI sendiri
//    - Gesture navigation aktif
//    - Animasi perpindahan layar tetap aktif agar transisi halus
//
// 2. Manajemen status autentikasi:
//    - Tiga state utama: 'loading' | 'signedIn' | 'signedOut'
//    - Sesi disimpan persisten melalui AsyncStorage
//    - Saat aplikasi dibuka ulang, sesi akan dicoba dipulihkan otomatis
//    - Logout membersihkan state dan data sesi yang tersimpan
//
// 3. Urutan inisialisasi:
//    - Database lokal disiapkan lebih dulu
//    - Service backend diinisialisasi
//    - Health check dijalankan tanpa memblokir seluruh aplikasi
//    - Device didaftarkan untuk kebutuhan monitoring admin
//    - Status login pengguna diverifikasi di tahap akhir
//
// 4. Manajemen lifecycle aplikasi:
//    - Memantau perubahan status aplikasi (active/background)
//    - Saat aplikasi aktif kembali, status device disinkronkan ulang
//    - Resource NFC dibersihkan saat aplikasi tidak lagi digunakan
//
// 5. Penanganan error:
//    - Ada proteksi timeout agar loading tidak menggantung terlalu lama
//    - Tersedia layar error sederhana dengan opsi coba lagi
//    - Beberapa langkah dibuat non-blocking agar aplikasi tetap bisa masuk
//      ke mode terbatas saat backend sedang offline
//
// 6. Pelacakan device:
//    - Membuat atau memulihkan device ID unik
//    - Menyimpan informasi platform (Android/iOS)
//    - Mengirim data device ke backend admin
//    - Menyertakan versi aplikasi untuk kebutuhan monitoring
//
// Variabel state penting:
// - authState: Status autentikasi saat ini
// - currentUser: Data user yang sedang login, atau null jika belum login
// - error: Pesan error yang ditampilkan ke pengguna jika ada kegagalan
// - navigationRef: Referensi navigasi untuk perpindahan layar secara programatik
//
// Fungsi utama:
// - initializeApp(): Menjalankan seluruh urutan inisialisasi aplikasi
// - checkAuthState(): Memeriksa dan memulihkan sesi login dari AsyncStorage
// - handleLogin(): Menyimpan sesi dan memindahkan user ke Dashboard
// - handleLogout(): Menghapus sesi dan mengembalikan user ke Login
// - navigateToScreen(): Helper untuk navigasi antar layar
// - handleAppStateChange(): Sinkronisasi status device saat app aktif kembali
//
// Tipe TypeScript:
// - RootStackParamList: Definisi parameter untuk setiap screen navigasi
// - AuthState: Union type untuk status autentikasi
// - AppScreen: Daftar nama layar internal untuk helper navigasi
// - AppUser: Struktur data user yang dipakai di level aplikasi
//
// Dependensi utama:
// - React Navigation: Sistem navigasi antar layar
// - AsyncStorage: Penyimpanan data lokal yang persisten
// - Expo: Framework aplikasi mobile
// - SafeAreaProvider: Menjaga UI aman dari notch dan status bar
//
// ==================================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'; // import React (wajib untuk JSX); useState untuk state authState, currentUser, ...
// import React (wajib untuk JSX); useState untuk state authState, currentUser, error; useEffect untuk inisialisasi app saat mount; useCallback untuk memoize fungsi navigateToScreen agar tidak dibuat ulang setiap render; useRef untuk menyimpan referensi stabil ke navigationRef dan authStateRef
import { StatusBar } from 'expo-status-bar'; // import StatusBar dari Expo \u2014 mengontrol tampilan status bar di bagian at...
// import StatusBar dari Expo \u2014 mengontrol tampilan status bar di bagian atas layar (warna, style dark/light)
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'; // import NavigationContainer (wajib sebagai wrapper navigasi) dan NavigationCon...
// import NavigationContainer (wajib sebagai wrapper navigasi) dan NavigationContainerRef (tipe TypeScript untuk ref navigasi programatik)
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack'; // import createStackNavigator untuk membuat navigator stack (tumpukan layar); S...
// import createStackNavigator untuk membuat navigator stack (tumpukan layar); StackNavigationProp adalah tipe TypeScript untuk prop navigation di tiap screen
import AsyncStorage from '@react-native-async-storage/async-storage'; // import AsyncStorage \u2014 penyimpanan key-value persisten di perangkat; digu...
// import AsyncStorage \u2014 penyimpanan key-value persisten di perangkat; digunakan untuk menyimpan userId dan deviceId agar sesi tidak hilang saat app ditutup
import { registerRootComponent } from 'expo'; // import registerRootComponent dari Expo \u2014 mendaftarkan komponen App sebag...
// import registerRootComponent dari Expo \u2014 mendaftarkan komponen App sebagai entry point utama aplikasi Expo
import { // import beberapa komponen sekaligus dari satu modul menggunakan destructuring
  ActivityIndicator, // Spinner loading yang tampil saat startup
  // Spinner loading yang tampil saat startup
  StyleSheet, // Utility untuk membuat stylesheet yang dioptimalkan
  // Utility untuk membuat stylesheet yang dioptimalkan
  Text, // Komponen teks dasar React Native
  // Komponen teks dasar React Native
  AppState, // API untuk memantau status aplikasi (active/background/inactive)
  // API untuk memantau status aplikasi (active/background/inactive)
  AppStateStatus, // Tipe union untuk nilai AppState
  // Tipe union untuk nilai AppState
  Platform, // Utilitas untuk membedakan Android vs iOS
  // Utilitas untuk membedakan Android vs iOS
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'; // Provider + View yang menghindari area notch/status bar
// Provider + View yang menghindari area notch/status bar

// ==================================================================================
// IMPORT: Kumpulan Screen
// ==================================================================================
// Seluruh komponen layar yang dipakai di navigation stack utama.
// ==================================================================================
import LoginScreen from './src/screens/LoginScreen'; // Layar form login dengan username dan password
// Layar form login dengan username dan password
import RegisterScreen from './src/screens/RegisterScreen'; // Layar form pendaftaran akun baru
// Layar form pendaftaran akun baru
import DashboardScreen from './src/screens/DashboardScreen'; // Layar pusat menu setelah login berhasil
// Layar pusat menu setelah login berhasil
import NFCScreen from './src/screens/NFCScreen'; // Layar proses pembayaran via NFC
// Layar proses pembayaran via NFC
import RegisterCardScreen from './src/screens/RegisterCardScreen'; // Layar pendaftaran kartu NFC baru
// Layar pendaftaran kartu NFC baru
import MyCardsScreen from './src/screens/MyCardsScreen'; // Layar daftar dan manajemen kartu NFC milik user
// Layar daftar dan manajemen kartu NFC milik user
import TopUpScreen from './src/screens/TopUpScreen'; // Layar top-up saldo kartu NFC
// Layar top-up saldo kartu NFC

// ==================================================================================
// IMPORT: Kumpulan Utilitas
// ==================================================================================
// Fungsi dan service pendukung untuk database, NFC, dan komunikasi API.
// ==================================================================================
import { getUserById, initDatabase } from './src/utils/database'; // Fungsi baca user dan inisialisasi database SQLite lokal
// Fungsi baca user dan inisialisasi database SQLite lokal
import { NFCService } from './src/utils/nfc'; // Service NFC untuk scan dan cleanup resource hardware NFC
// Service NFC untuk scan dan cleanup resource hardware NFC
import { apiService } from './src/utils/apiService'; // Service HTTP untuk komunikasi dengan backend Express
// Service HTTP untuk komunikasi dengan backend Express

// ==================================================================================
// DEFINISI TIPE: Navigasi
// ==================================================================================
// Tipe TypeScript untuk kebutuhan React Navigation.
//
// RootStackParamList:
// - Mendefinisikan semua screen pada stack navigasi
// - Nilai undefined berarti screen tersebut tidak membutuhkan parameter
//
// NavigationProp:
// - Tipe untuk prop navigation yang diteruskan ke screen
// - Membantu memastikan pemanggilan navigasi tetap type-safe
// ==================================================================================
export type RootStackParamList = { // Definisi semua route yang ada di navigation stack
  // Definisi semua route yang ada di navigation stack
  Login: undefined; // Screen login — tidak butuh parameter tambahan
  // Screen login — tidak butuh parameter tambahan
  Register: undefined; // Screen daftar — tidak butuh parameter tambahan
  // Screen daftar — tidak butuh parameter tambahan
  Dashboard: undefined; // Screen dashboard — tidak butuh parameter tambahan
  // Screen dashboard — tidak butuh parameter tambahan
  NFC: undefined; // Screen pembayaran NFC — tidak butuh parameter tambahan
  // Screen pembayaran NFC — tidak butuh parameter tambahan
  RegisterCard: undefined; // Screen daftarkan kartu — tidak butuh parameter tambahan
  // Screen daftarkan kartu — tidak butuh parameter tambahan
  MyCards: undefined; // Screen daftar kartu — tidak butuh parameter tambahan
  // Screen daftar kartu — tidak butuh parameter tambahan
  TopUp: undefined; // Screen top-up saldo kartu NFC
  // Screen top-up saldo kartu NFC
};

export type NavigationProp = StackNavigationProp<RootStackParamList>; // export type mengekspor tipe ini agar bisa diimport screen lain; StackNavigati...
// export type mengekspor tipe ini agar bisa diimport screen lain; StackNavigationProp<RootStackParamList> menghasilkan tipe prop navigation yang type-safe — memastikan navigator.navigate() hanya bisa dipanggil dengan nama route yang valid
const Stack = createStackNavigator<RootStackParamList>(); // const membuat variabel tetap; createStackNavigator<RootStackParamList>() memb...
// const membuat variabel tetap; createStackNavigator<RootStackParamList>() membuat instance stack navigator bertipe — semua Screen.name harus sesuai dengan key di RootStackParamList

// ==================================================================================
// DEFINISI TIPE: Aplikasi
// ==================================================================================
// AuthState: Tiga kemungkinan status autentikasi
// - 'loading': State awal saat sesi sedang dicek
// - 'signedIn': User sudah terautentikasi, tampilkan Dashboard
// - 'signedOut': Tidak ada sesi aktif, tampilkan Login
//
// AppScreen: Nama screen internal untuk helper navigasi programatik
//
// AppUser: Struktur data user di level aplikasi
// - id: Primary key user di database
// - name: Nama lengkap user
// - username: Username unik user
// - balance: Saldo aktif dalam Rupiah
// - email: Email opsional hasil turunan dari username
// ==================================================================================
type AuthState = 'loading' | 'signedIn' | 'signedOut'; // Tiga kondisi: sedang memuat, sudah login, belum login
// Tiga kondisi: sedang memuat, sudah login, belum login
type AppScreen = 'login' | 'register' | 'dashboard' | 'nfc' | 'registerCard' | 'myCards' | 'topUp'; // Enum nama screen internal (huruf kecil, beda dari nama route)
// Enum nama screen internal (huruf kecil, beda dari nama route)

interface AppUser { // Struktur data user yang beredar di level komponen App
  // Struktur data user yang beredar di level komponen App
  id: number; // Primary key user dari database backend
  // Primary key user dari database backend
  name: string; // Nama lengkap untuk ditampilkan di UI
  // Nama lengkap untuk ditampilkan di UI
  username: string; // Username unik untuk login dan referensi API
  // Username unik untuk login dan referensi API
  balance: number; // Saldo aktif dalam satuan Rupiah
  // Saldo aktif dalam satuan Rupiah
  email?: string; // Email opsional — dibentuk otomatis dari username
  // Email opsional — dibentuk otomatis dari username
}

// ==================================================================================
// KOMPONEN: App
// ==================================================================================
// Komponen utama aplikasi yang menjadi titik masuk seluruh alur mobile app.
//
// Tanggung jawab utama:
// 1. Menyiapkan database dan backend API
// 2. Memulihkan sesi autentikasi jika tersedia
// 3. Menyusun navigation stack
// 4. Menangani perubahan state aplikasi
// 5. Mengelola alur login dan logout pengguna
// ==================================================================================
export default function App() { // ================================================================================
  // ================================================================================
  // MANAJEMEN STATE
  // ================================================================================
  // authState: Status autentikasi aplikasi saat ini
  // currentUser: Data user yang sedang login, null jika belum ada sesi
  // error: Pesan error untuk layar kegagalan
  // navigationRef: Ref untuk navigasi programatik dari level root
  // ================================================================================
  const [authState, setAuthState] = useState<AuthState>('loading'); // State awal: aplikasi belum tahu user sudah login atau belum.
  // State awal: aplikasi belum tahu user sudah login atau belum.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null); // Menyimpan data user aktif setelah login berhasil.
  // Menyimpan data user aktif setelah login berhasil.
  const [error, setError] = useState<string | null>(null); // Dipakai untuk menampilkan pesan error ke layar fallback.
  // Dipakai untuk menampilkan pesan error ke layar fallback.
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null); // Ref ini memungkinkan navigasi dari luar screen.
  // Ref ini memungkinkan navigasi dari luar screen.
  const authStateRef = useRef<AuthState>('loading'); // Ref untuk melacak nilai authState terkini di dalam closure.
  // Ref untuk melacak nilai authState terkini di dalam closure.

  // Sync authStateRef setiap kali authState berubah, agar timeout tidak terjebak stale closure
  useEffect(() => { authStateRef.current = authState; }, [authState]);

  console.log('🚀 App.tsx rendered, authState:', authState); // Log ini membantu melihat perubahan state saat debugging.
  // Log ini membantu melihat perubahan state saat debugging.

  // ================================================================================
  // EFFECT: Inisialisasi Aplikasi
  // ================================================================================
  // Dijalankan satu kali saat komponen App pertama kali di-mount.
  //
  // Alur kerja:
  // 1. Menetapkan timeout pengaman agar loading tidak macet terlalu lama
  // 2. Memanggil initializeApp() sebagai urutan inisialisasi utama
  // 3. Mendaftarkan listener perubahan state aplikasi
  // 4. Saat unmount, timer dibersihkan dan resource NFC dilepas
  //
  // Dependencies: [] artinya hanya berjalan sekali saat mount awal
  // ================================================================================
  useEffect(() => { // Timeout pengaman agar user tidak tertahan di layar loading terlalu lama.
    // Timeout pengaman agar user tidak tertahan di layar loading terlalu lama.
    const forceLoginTimeout = setTimeout(() => { // const = variabel tetap; setTimeout mengatur batas waktu startup 20 detik
      if (authStateRef.current === 'loading') { // Gunakan ref agar tidak terjebak stale closure
        // Gunakan ref agar tidak terjebak stale closure
        console.warn('⚠️ Loading timeout, paksa ke login screen');
        setAuthState('signedOut');
      }
    }, 20000);

    initializeApp(); // Menjalankan seluruh proses startup aplikasi.
    // Menjalankan seluruh proses startup aplikasi.
    
    const sub = AppState.addEventListener('change', handleAppStateChange); // Listener ini aktif saat app pindah active/background.
    // Listener ini aktif saat app pindah active/background.
    return () => { // return = mengembalikan cleanup function; dijalankan saat komponen di-unmount untuk bersihkan resource
      clearTimeout(forceLoginTimeout); // Membersihkan timer agar tidak tetap jalan setelah komponen dibongkar.
      // Membersihkan timer agar tidak tetap jalan setelah komponen dibongkar.
      sub?.remove?.(); // Melepas listener untuk mencegah memory leak.
      // Melepas listener untuk mencegah memory leak.
      NFCService.cleanup(); // Membersihkan resource NFC saat aplikasi keluar dari komponen root.
      // Membersihkan resource NFC saat aplikasi keluar dari komponen root.
    };
  }, []);

  // ================================================================================
  // FUNGSI: handleAppStateChange
  // ================================================================================
  // Dipanggil saat status aplikasi berubah, misalnya dari background ke active.
  //
  // Alur kerja:
  // 1. Memeriksa apakah aplikasi kembali aktif
  // 2. Menyinkronkan status device ke backend
  // 3. Memperbarui informasi device seperti platform dan versi aplikasi
  // 4. Menyiapkan konteks user jika user sedang login
  //
  // Kegunaan:
  // - Melacak device aktif dari sisi admin
  // - Memastikan registry device tetap terbaru
  // - Membantu monitoring penggunaan aplikasi di lapangan
  // ================================================================================
  const handleAppStateChange = async (nextAppState: AppStateStatus) => { // Fungsi async: dipanggil otomatis saat status app berubah (active/background/i...
    // Fungsi async: dipanggil otomatis saat status app berubah (active/background/inactive)
    if (nextAppState === 'active') { // if = pengecekan kondisi; berjalan saat app kembali aktif dari background
      console.log('📱 App aktif kembali, sync status device...');
      try { // try = mencoba proses aman; error akan ditangkap oleh catch
        const deviceId = // const = variabel tetap; ambil deviceId dari AsyncStorage atau buat ID baru
          (await AsyncStorage.getItem('deviceId')) || `device_${Date.now()}`; // Jika belum ada deviceId tersimpan, buat ID sementara baru.
          // Jika belum ada deviceId tersimpan, buat ID sementara baru.
        const deviceInfo = { // const = variabel tetap; objek informasi device yang dikirim ke backend admin
          deviceId,
          deviceName: `${Platform.OS}_device_${deviceId.slice(-6)}`, // Nama device dibuat sederhana agar mudah dikenali di admin.
          // Nama device dibuat sederhana agar mudah dikenali di admin.
          platform: Platform.OS, // Memberi tahu backend apakah device Android atau iOS.
          // Memberi tahu backend apakah device Android atau iOS.
          appVersion: '1.0.0', // Versi aplikasi berguna untuk troubleshooting di backend.
          // Versi aplikasi berguna untuk troubleshooting di backend.
        };

        await apiService.registerDevice(deviceInfo); // Mengirim data device terbaru ke backend.
        // Mengirim data device terbaru ke backend.
        console.log('✅ Device status tersinkron ke backend');
      } catch (err) {
        console.log('⚠️ Gagal sync device status:', err);
      }
    }
  };

  // ================================================================================
  // FUNGSI: initializeApp
  // ================================================================================
  // Urutan inisialisasi utama aplikasi dengan lima tahap.
  //
  // Tahap inisialisasi:
  //
  // 1️⃣ Inisialisasi database lokal
  //    - Menyiapkan database yang dipakai aplikasi
  //    - Membuat tabel jika belum tersedia
  //    - Timeout: 10 detik
  //
  // 2️⃣ Inisialisasi Backend API
  //    - Memulihkan token autentikasi dari AsyncStorage
  //    - Menyiapkan base URL dan konfigurasi service
  //    - Timeout: 10 detik
  //
  // 3️⃣ Koneksi ke backend melalui health check
  //    - Bersifat non-blocking, jadi aplikasi tetap bisa lanjut
  //    - Timeout: 5 detik
  //    - Fallback: mode offline / koneksi backend belum siap
  //
  // 4️⃣ Registrasi device
  //    - Mengambil atau membuat device ID unik
  //    - Mengirim informasi device ke sistem admin
  //    - Tetap lanjut walau gagal
  //    - Timeout: 3 detik
  //
  // 5️⃣ Pemeriksaan status autentikasi
  //    - Memulihkan sesi dari AsyncStorage jika ada
  //    - Menentukan layar awal: Login atau Dashboard
  //
  // Penanganan error:
  // - Tahap 1-2 dianggap kritis
  // - Tahap 3-4 dibuat non-blocking agar aplikasi lebih tahan gangguan
  // - Tahap 5 selalu dijalankan dengan fallback ke signedOut
  // ================================================================================
  const initializeApp = async () => { // Fungsi async: menjalankan 5 tahap startup berurutan (database → API → health ...
    // Fungsi async: menjalankan 5 tahap startup berurutan (database → API → health → device → auth)
    try { // try = mencoba proses aman; error akan ditangkap oleh catch
      setError(null); // Error lama dibersihkan dulu agar startup baru dimulai dari kondisi bersih.
      // Error lama dibersihkan dulu agar startup baru dimulai dari kondisi bersih.
      console.log('🚀 Memulai inisialisasi aplikasi...');

      // === 1️⃣ Inisialisasi database lokal
      console.log('1️⃣ Inisialisasi database...');
      await Promise.race([ // Promise.race = menunggu proses tercepat; ada proteksi timeout agar tidak hang
        initDatabase(), // Proses utama membuka atau menyiapkan database.
        // Proses utama membuka atau menyiapkan database.
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 10000)) // Jika terlalu lama, startup dipaksa gagal agar tidak hang.
        // Jika terlalu lama, startup dipaksa gagal agar tidak hang.
      ]);
      console.log('✅ Database ready');

      // === 2️⃣ Inisialisasi service backend
      console.log('2️⃣ Inisialisasi Backend API...');
      await Promise.race([ // Promise.race = menunggu proses tercepat; ada proteksi timeout agar tidak hang
        apiService.initialize(), // Memulihkan token dan konfigurasi dasar API.
        // Memulihkan token dan konfigurasi dasar API.
        new Promise((_, reject) => setTimeout(() => reject(new Error('Backend API timeout')), 10000)) // Proteksi bila inisialisasi API macet.
        // Proteksi bila inisialisasi API macet.
      ]);
      console.log('✅ Backend API ready');

      // === 3️⃣ Cek koneksi backend melalui health check
      console.log('3️⃣ Koneksi ke backend server...');
      let connected = false; // Variabel penanda ini menunjukkan apakah backend merespons health check.
      // Variabel penanda ini menunjukkan apakah backend merespons health check.
      try { // try = mencoba proses aman; error akan ditangkap oleh catch
        await Promise.race([ // Promise.race = menunggu proses tercepat; ada proteksi timeout agar tidak hang
          apiService.healthCheck(), // Menguji apakah server backend sedang aktif.
          // Menguji apakah server backend sedang aktif.
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)) // Timeout lebih singkat karena ini hanya pengecekan koneksi.
          // Timeout lebih singkat karena ini hanya pengecekan koneksi.
        ]);
        connected = true;
        console.log('✅ Backend connected');
      } catch (err) {
        console.warn('⚠️ Backend tidak terhubung, mode offline'); // Tidak perlu menghentikan startup, aplikasi tetap lanjut ke tahap berikutnya.
        // Tidak perlu menghentikan startup, aplikasi tetap lanjut ke tahap berikutnya.
      }

      // === 4️⃣ Registrasi device ke sistem admin (opsional)
      try { // try = mencoba proses aman; error akan ditangkap oleh catch
        console.log('4️⃣ Register device...');
        const deviceId = // const = variabel tetap; ambil deviceId dari AsyncStorage atau buat ID baru
          (await AsyncStorage.getItem('deviceId')) || `device_${Date.now()}`; // Ambil deviceId lama supaya identitas device tetap konsisten.
          // Ambil deviceId lama supaya identitas device tetap konsisten.
        await AsyncStorage.setItem('deviceId', deviceId); // Simpan lagi agar startup berikutnya memakai ID yang sama.
        // Simpan lagi agar startup berikutnya memakai ID yang sama.

        const deviceInfo = { // const = variabel tetap; objek informasi device yang dikirim ke backend admin
          deviceId, // ID unik device yang sudah diambil atau dibuat di atas
          // ID unik device yang sudah diambil atau dibuat di atas
          deviceName: `${Platform.OS}_device_${deviceId.slice(-6)}`, // Nama yang mudah dikenali: platform + 6 karakter terakhir ID
          // Nama yang mudah dikenali: platform + 6 karakter terakhir ID
          platform: Platform.OS, // 'android' atau 'ios' — dipakai backend untuk klasifikasi device
          // 'android' atau 'ios' — dipakai backend untuk klasifikasi device
          appVersion: '1.0.0', // Versi aplikasi untuk kebutuhan monitoring dan debugging jarak jauh
          // Versi aplikasi untuk kebutuhan monitoring dan debugging jarak jauh
        };

        await Promise.race([ // Promise.race = menunggu proses tercepat; ada proteksi timeout agar tidak hang
          apiService.registerDevice(deviceInfo), // Registrasi ini menghubungkan device mobile ke dashboard/admin backend.
          // Registrasi ini menghubungkan device mobile ke dashboard/admin backend.
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 3000)) // Karena opsional, timeout dibuat singkat.
          // Karena opsional, timeout dibuat singkat.
        ]);
        console.log('✅ Device registered ke admin system');
      } catch (err) {
        console.warn('⚠️ Device sync failed, continue:', err); // Kegagalan sinkron device tidak boleh menggagalkan startup aplikasi.
        // Kegagalan sinkron device tidak boleh menggagalkan startup aplikasi.
      }

      // === 5️⃣ Pemeriksaan sesi login
      console.log('5️⃣ Cek authentication...');
      await checkAuthState(); // Langkah terakhir: tentukan user masuk dashboard atau login.
      // Langkah terakhir: tentukan user masuk dashboard atau login.

      console.log('✅ Aplikasi siap digunakan!');
    } catch (err: any) {
      console.error('❌ Initialization error:', err); // Jika startup gagal, aplikasi tetap diarahkan ke login agar tidak buntu di loa...
      // Jika startup gagal, aplikasi tetap diarahkan ke login agar tidak buntu di loading.
      setAuthState('signedOut'); // Fallback aman: jika startup bermasalah, tampilkan login saja.
      // Fallback aman: jika startup bermasalah, tampilkan login saja.
    }
  };

  // ================================================================================
  // FUNGSI: checkAuthState
  // ================================================================================
  // Memulihkan status autentikasi dari AsyncStorage.
  //
  // Alur kerja:
  // 1. Mengambil userId yang tersimpan secara lokal
  // 2. Jika ada, memuat data user dari database
  // 3. Jika user valid ditemukan, currentUser diisi dan authState jadi signedIn
  // 4. Jika tidak ada atau tidak valid, authState menjadi signedOut
  //
  // Hasil akhir:
  // - Berhasil: user masuk ke Dashboard
  // - Gagal: user diarahkan ke Login
  // ================================================================================
  const checkAuthState = async () => { // Fungsi async: membaca AsyncStorage lalu query database untuk memulihkan sesi ...
    // Fungsi async: membaca AsyncStorage lalu query database untuk memulihkan sesi login
    try { // try = mencoba proses aman; error akan ditangkap oleh catch
      const storedUserId = await AsyncStorage.getItem('userId'); // Mengambil ID user yang disimpan saat login sebelumnya.
      // Mengambil ID user yang disimpan saat login sebelumnya.
      if (storedUserId) { // if = pengecekan kondisi; berjalan jika ada userId tersimpan dari sesi sebelumnya
        const user = await getUserById(Number(storedUserId)); // Mengubah string ke number lalu mencari data user di database.
        // Mengubah string ke number lalu mencari data user di database.
        if (user) { // if = pengecekan kondisi; berjalan jika data user berhasil ditemukan di database
          const appUser: AppUser = { // const = variabel tetap; membentuk objek AppUser yang konsisten di level aplikasi
            id: user.id,
            name: user.name,
            username: user.username,
            email: `${user.username}@nfcpay.com`, // Email dibentuk otomatis dari username untuk konsistensi format.
            // Email dibentuk otomatis dari username untuk konsistensi format.
            balance: user.balance || 0, // Jika balance kosong, default ke 0 agar aman dipakai UI.
            // Jika balance kosong, default ke 0 agar aman dipakai UI.
          };
          setCurrentUser(appUser); // Menyimpan data user ke state global App.
          // Menyimpan data user ke state global App.
          setAuthState('signedIn'); // Menandakan user valid dan boleh masuk area utama aplikasi.
          // Menandakan user valid dan boleh masuk area utama aplikasi.
          console.log('✅ User authenticated:', appUser.name);
          return;
        }
      }
      setAuthState('signedOut'); // Jika tidak ada sesi valid, user harus kembali ke layar login.
      // Jika tidak ada sesi valid, user harus kembali ke layar login.
    } catch (err) {
      console.error('Error checking authentication:', err);
      setAuthState('signedOut');
    }
  };

  // ================================================================================
  // FUNGSI: handleLogin
  // ================================================================================
  // Menangani proses setelah login berhasil.
  //
  // Parameter:
  // @param userData - Data user yang dikirim dari LoginScreen
  //
  // Alur kerja:
  // 1. Membentuk objek AppUser yang konsisten untuk level aplikasi
  // 2. Menyimpan userId ke AsyncStorage agar sesi tetap persisten
  // 3. Mengisi currentUser
  // 4. Mengubah authState menjadi signedIn
  // 5. Memindahkan user ke Dashboard dengan reset stack navigasi
  //
  // Catatan navigasi:
  // - reset() dipakai agar layar login tidak tersisa di stack
  // - Tombol back tidak akan membawa user kembali ke form login
  // ================================================================================
  const handleLogin = async (userData: { // Fungsi async: menyimpan sesi login ke AsyncStorage lalu reset navigasi ke Das...
    // Fungsi async: menyimpan sesi login ke AsyncStorage lalu reset navigasi ke Dashboard
    id: number;
    name: string;
    username: string;
    balance?: number;
  }) => {
    try { // try = mencoba proses aman; error akan ditangkap oleh catch
      const appUser: AppUser = { // const = variabel tetap; membentuk objek AppUser yang konsisten di level aplikasi
        id: userData.id, // ID user dari response backend setelah login
        // ID user dari response backend setelah login
        name: userData.name, // Nama lengkap user untuk ditampilkan di UI
        // Nama lengkap user untuk ditampilkan di UI
        username: userData.username, // Username untuk referensi API dan tampilan
        // Username untuk referensi API dan tampilan
        email: `${userData.username}@nfcpay.com`, // Format email diseragamkan di level App.
        // Format email diseragamkan di level App.
        balance: userData.balance || 0, // Saldo awal; default 0 jika tidak dikirim dari backend
        // Saldo awal; default 0 jika tidak dikirim dari backend
      };
      await AsyncStorage.setItem('userId', appUser.id.toString()); // Menyimpan session sederhana berbasis userId.
      // Menyimpan session sederhana berbasis userId.
      setCurrentUser(appUser); // Data user dipakai ulang oleh screen-screen setelah login.
      // Data user dipakai ulang oleh screen-screen setelah login.
      setAuthState('signedIn'); // Mengubah status supaya app menampilkan area terproteksi.
      // Mengubah status supaya app menampilkan area terproteksi.

      navigationRef.current?.reset({
        index: 0, // Stack disetel ulang dari awal.
        // Stack disetel ulang dari awal.
        routes: [{ name: 'Dashboard' }], // Setelah login berhasil, halaman pertama jadi Dashboard.
        // Setelah login berhasil, halaman pertama jadi Dashboard.
      });
      console.log('✅ Login success:', appUser.name);
    } catch (err) {
      console.error('Login error:', err);
      setError('Gagal login, silakan coba lagi.');
    }
  };

  // ================================================================================
  // FUNGSI: handleLogout
  // ================================================================================
  // Menangani proses logout user.
  //
  // Alur kerja:
  // 1. Menghapus userId dari AsyncStorage agar sesi berakhir
  // 2. Mengosongkan currentUser
  // 3. Mengubah authState menjadi signedOut
  // 4. Membersihkan resource NFC yang mungkin masih aktif
  // 5. Mengarahkan user ke Login dengan reset stack navigasi
  //
  // Aspek keamanan:
  // - Data sesi persisten dibersihkan
  // - Resource hardware dirilis
  // - Navigasi di-reset agar user tidak bisa kembali ke area privat lewat back
  // ================================================================================
  const handleLogout = async () => { // Fungsi async: hapus sesi dari AsyncStorage lalu bersihkan state dan arahkan k...
    // Fungsi async: hapus sesi dari AsyncStorage lalu bersihkan state dan arahkan ke Login
    try { // try = mencoba proses aman; error akan ditangkap oleh catch
      await AsyncStorage.removeItem('userId'); // Menghapus penanda sesi dari penyimpanan lokal.
      // Menghapus penanda sesi dari penyimpanan lokal.
      setCurrentUser(null); // Membersihkan data user dari memory aplikasi.
      // Membersihkan data user dari memory aplikasi.
      setAuthState('signedOut'); // Mengubah mode aplikasi ke status belum login.
      // Mengubah mode aplikasi ke status belum login.
      NFCService.cleanup(); // Penting agar proses NFC yang sedang aktif tidak tertinggal.
      // Penting agar proses NFC yang sedang aktif tidak tertinggal.

      navigationRef.current?.reset({
        index: 0, // Stack navigasi dimulai ulang dari posisi pertama
        // Stack navigasi dimulai ulang dari posisi pertama
        routes: [{ name: 'Login' }], // Setelah logout, user dipaksa mulai lagi dari layar login.
        // Setelah logout, user dipaksa mulai lagi dari layar login.
      });
      console.log('✅ Logout success');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Logout gagal. Coba lagi.');
    }
  };

  // ================================================================================
  // FUNGSI: navigateToScreen
  // ================================================================================
  // Helper untuk navigasi programatik dari level App.
  //
  // Parameter:
  // @param screen - Nama screen tujuan dalam format internal (huruf kecil)
  //
  // Alur kerja:
  // 1. Memastikan navigationRef sudah tersedia
  // 2. Mengubah nama screen internal menjadi nama route React Navigation
  // 3. Menjalankan navigate() ke route tujuan
  // 4. Menulis log keberhasilan atau error untuk debugging
  //
  // Pemetaan screen:
  // - 'login' -> 'Login'
  // - 'register' -> 'Register'
  // - 'dashboard' -> 'Dashboard'
  // - 'nfc' -> 'NFC'
  // - 'registerCard' -> 'RegisterCard'
  // - 'myCards' -> 'MyCards'
  //
  // Dipanggil oleh:
  // - Komponen screen melalui props seperti onBack atau onNavigate*
  // ================================================================================
  const navigateToScreen = useCallback((screen: AppScreen) => { // useCallback = menstabilkan fungsi navigasi agar tidak dibuat ulang setiap render
    if (!navigationRef.current) { // if = pengecekan kondisi; memastikan ref navigasi sudah tersedia sebelum dipakai
      console.error('❌ Navigation ref not available');
      return;
    }
    try { // try = mencoba proses aman; error akan ditangkap oleh catch
      const targetScreen = screen === 'register' // const = variabel tetap; pemetaan nama screen internal ke nama route React Navigation
          ? 'Register'
          : screen === 'dashboard'
          ? 'Dashboard'
          : screen === 'nfc'
          ? 'NFC'
          : screen === 'registerCard'
          ? 'RegisterCard'
          : screen === 'myCards'
          ? 'MyCards'
          : screen === 'topUp'
          ? 'TopUp'
          : 'Login'; // Jika tidak cocok dengan semua kondisi di atas, fallback ke Login.
          // Jika tidak cocok dengan semua kondisi di atas, fallback ke Login.
      
      console.log(`🧭 Navigating from current to: ${targetScreen} (screen param: ${screen})`);
      navigationRef.current.navigate(targetScreen); // Menjalankan perpindahan route sesuai hasil pemetaan.
      // Menjalankan perpindahan route sesuai hasil pemetaan.
      console.log(`✅ Navigation completed: ${screen}`);
    } catch (err) {
      console.error('❌ Navigation error:', err);
    }
  }, []);

  // ========================================================
  // Layar Loading dan Error
  // ========================================================
  if (authState === 'loading') { // Tampilkan spinner selama proses startup berlangsung
    // Tampilkan spinner selama proses startup berlangsung
    return ( // return = mengembalikan JSX; elemen UI yang akan dirender ke layar
      <SafeAreaView style={styles.loadingContainer}>
        {/* ActivityIndicator = spinner loading biru besar saat proses startup */}
        <ActivityIndicator size="large" color="#2563eb" />
        {/* Text = teks loading utama yang ditampilkan di bawah spinner */}
        <Text style={styles.loadingText}>Memuat aplikasi NFC Payment...</Text>
        {/* Text = teks sekunder yang memberi instruksi ke user untuk menunggu */}
        <Text style={styles.loadingSubtext}>Mohon tunggu...</Text>
      </SafeAreaView>
    );
  }

  if (error && authState === 'signedOut') { // Tampilkan layar error hanya jika ada pesan error dan user belum login
    // Tampilkan layar error hanya jika ada pesan error dan user belum login
    return ( // return = mengembalikan JSX; elemen UI yang akan dirender ke layar
      <SafeAreaView style={styles.errorContainer}>
        {/* Text = judul error berwarna merah yang langsung terlihat user */}
        <Text style={styles.errorTitle}>Terjadi Kesalahan</Text>
        {/* Text = menampilkan pesan error spesifik dari state error */}
        <Text style={styles.errorText}>{error}</Text>
        <Text // Text = tombol Coba Lagi dengan onPress untuk menjalankan ulang startup aplikasi
          style={styles.retryText}
          onPress={() => {
            setError(null); // Error dibersihkan dulu agar UI kembali normal.
            // Error dibersihkan dulu agar UI kembali normal.
            initializeApp(); // Menjalankan ulang seluruh startup dari awal.
            // Menjalankan ulang seluruh startup dari awal.
          }}
        >
          Coba lagi
        </Text>
      </SafeAreaView>
    );
  }

  // ========================================================
  // Navigasi Utama Aplikasi
  // ========================================================
  return ( // return = mengembalikan JSX; elemen UI yang akan dirender ke layar
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator // Stack.Navigator = container semua screen dengan navigasi tumpukan
          screenOptions={{
            headerShown: false, // Header default dimatikan karena tiap screen memakai layout sendiri.
            // Header default dimatikan karena tiap screen memakai layout sendiri.
            gestureEnabled: true, // Gesture back/transition tetap diaktifkan.
            // Gesture back/transition tetap diaktifkan.
            animationEnabled: true, // Transisi layar dibuat halus.
            // Transisi layar dibuat halus.
          }}
          initialRouteName={authState === 'signedOut' ? 'Login' : 'Dashboard'} // Menentukan layar awal berdasarkan status login.
          // Menentukan layar awal berdasarkan status login.
        >
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {() => (
              <LoginScreen // LoginScreen = form login username & password; entry point sebelum masuk Dashboard
                onLogin={handleLogin} // Jika login sukses, App akan menyimpan sesi dan reset ke Dashboard.
                // Jika login sukses, App akan menyimpan sesi dan reset ke Dashboard.
                onNavigateToRegister={() => navigateToScreen('register')} // Tombol daftar dari Login diarahkan ke screen Register.
                // Tombol daftar dari Login diarahkan ke screen Register.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Register" options={{ headerShown: false }}>
            {() => (
              <RegisterScreen // RegisterScreen = form registrasi akun baru dengan nama, username, dan password
                onRegisterSuccess={() => navigateToScreen('login')} // Setelah daftar berhasil, user dibawa kembali ke login.
                // Setelah daftar berhasil, user dibawa kembali ke login.
                onNavigateToLogin={() => navigateToScreen('login')} // Jika user batal daftar, kembali ke login.
                // Jika user batal daftar, kembali ke login.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Dashboard" options={{ headerShown: false }}>
            {() => (
              <DashboardScreen // DashboardScreen = pusat menu; menampilkan saldo, transaksi, dan menu navigasi
                user={currentUser} // Dashboard menerima data user aktif untuk ditampilkan.
                // Dashboard menerima data user aktif untuk ditampilkan.
                onLogout={handleLogout} // Tombol logout di dashboard akan membersihkan sesi.
                // Tombol logout di dashboard akan membersihkan sesi.
                onNavigateToNFC={() => navigateToScreen('nfc')} // Masuk ke alur pembayaran NFC.
                // Masuk ke alur pembayaran NFC.
                onNavigateToRegisterCard={() => navigateToScreen('registerCard')} // Masuk ke form pendaftaran kartu baru.
                // Masuk ke form pendaftaran kartu baru.
                onNavigateToMyCards={() => navigateToScreen('myCards')} // Melihat daftar kartu yang sudah terhubung.
                // Melihat daftar kartu yang sudah terhubung.
                onNavigateToTopUp={() => navigateToScreen('topUp')} // Masuk ke screen top-up saldo kartu NFC.
                // Masuk ke screen top-up saldo kartu NFC.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="NFC" options={{ headerShown: false }}>
            {() => (
              <NFCScreen // NFCScreen = layar scan kartu NFC untuk pembayaran ke penerima
                user={currentUser} // Data user dipakai untuk konteks pembayaran atau saldo.
                // Data user dipakai untuk konteks pembayaran atau saldo.
                onBack={() => navigateToScreen('dashboard')} // Tombol kembali dari NFC mengarah ke dashboard.
                // Tombol kembali dari NFC mengarah ke dashboard.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="RegisterCard" options={{ headerShown: false }}>
            {() => (
              <RegisterCardScreen // RegisterCardScreen = form tap kartu NFC untuk didaftarkan ke akun
                user={currentUser} // Screen ini butuh data user agar kartu dikaitkan ke pemilik yang benar.
                // Screen ini butuh data user agar kartu dikaitkan ke pemilik yang benar.
                onBack={() => navigateToScreen('dashboard')} // Jika batal, kembali ke dashboard.
                // Jika batal, kembali ke dashboard.
                onSuccess={() => navigateToScreen('myCards')} // Jika berhasil, lanjut ke daftar kartu.
                // Jika berhasil, lanjut ke daftar kartu.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="MyCards" options={{ headerShown: false }}>
            {() => (
              <MyCardsScreen // MyCardsScreen = menampilkan kartu NFC terdaftar dan manajemen status kartu
                user={currentUser} // Screen kartu butuh user untuk memuat data kartu yang sesuai.
                // Screen kartu butuh user untuk memuat data kartu yang sesuai.
                onBack={() => navigateToScreen('dashboard')} // Kembali ke pusat menu utama.
                // Kembali ke pusat menu utama.
                onRegisterNew={() => navigateToScreen('registerCard')} // Shortcut tambah kartu baru dari daftar kartu.
                // Shortcut tambah kartu baru dari daftar kartu.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="TopUp" options={{ headerShown: false }}>
            {() => (
              <TopUpScreen // TopUpScreen = form top-up saldo; user pilih kartu dan nominal yang akan diisi
                user={currentUser} // TopUpScreen butuh user untuk load kartu NFC miliknya.
                // TopUpScreen butuh user untuk load kartu NFC miliknya.
                onBack={() => navigateToScreen('dashboard')} // Kembali ke dashboard setelah selesai.
                // Kembali ke dashboard setelah selesai.
                onSuccess={() => navigateToScreen('dashboard')} // Refresh dashboard setelah top-up berhasil.
                // Refresh dashboard setelah top-up berhasil.
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ========================================================
// Gaya Tampilan
// ========================================================
const styles = StyleSheet.create({ // StyleSheet.create = membuat kumpulan style tampilan yang dioptimalkan React Native
  loadingContainer: {
    flex: 1, // Mengisi seluruh tinggi layar.
    // Mengisi seluruh tinggi layar.
    justifyContent: 'center', // Konten diposisikan ke tengah secara vertikal.
    // Konten diposisikan ke tengah secara vertikal.
    alignItems: 'center', // Konten diposisikan ke tengah secara horizontal.
    // Konten diposisikan ke tengah secara horizontal.
    backgroundColor: '#f8fafc', // Warna latar loading yang terang dan netral.
    // Warna latar loading yang terang dan netral.
  },
  loadingText: {
    marginTop: 20, // Memberi jarak dari indikator loading.
    // Memberi jarak dari indikator loading.
    fontSize: 16, // Ukuran teks yang nyaman dibaca
    // Ukuran teks yang nyaman dibaca
    color: '#6b7280', // Abu-abu sedang — kontras cukup tanpa terlalu mencolok
    // Abu-abu sedang — kontras cukup tanpa terlalu mencolok
    textAlign: 'center', // Rata tengah agar sejajar dengan spinner
    // Rata tengah agar sejajar dengan spinner
  },
  loadingSubtext: {
    marginTop: 8, // Jarak kecil dari teks utama loading
    // Jarak kecil dari teks utama loading
    fontSize: 14, // Sedikit lebih kecil dari teks utama
    // Sedikit lebih kecil dari teks utama
    color: '#9ca3af', // Abu-abu lebih terang untuk memberi kesan teks sekunder
    // Abu-abu lebih terang untuk memberi kesan teks sekunder
    textAlign: 'center', // Rata tengah
    // Rata tengah
  },
  errorContainer: {
    flex: 1, // Mengisi seluruh layar
    // Mengisi seluruh layar
    justifyContent: 'center', // Konten di tengah secara vertikal
    // Konten di tengah secara vertikal
    alignItems: 'center', // Konten di tengah secara horizontal
    // Konten di tengah secara horizontal
    backgroundColor: '#fef2f2', // Warna merah muda muda memberi kesan ada error tapi tetap lembut.
    // Warna merah muda muda memberi kesan ada error tapi tetap lembut.
    padding: 20, // Padding agar teks tidak mepet ke tepi layar
    // Padding agar teks tidak mepet ke tepi layar
  },
  errorTitle: {
    fontSize: 22, // Besar agar langsung terbaca sebagai judul halaman error
    // Besar agar langsung terbaca sebagai judul halaman error
    fontWeight: 'bold', // Tebal untuk memperkuat kesan penting
    // Tebal untuk memperkuat kesan penting
    color: '#b91c1c', // Merah pekat untuk judul error agar segera terlihat.
    // Merah pekat untuk judul error agar segera terlihat.
    marginBottom: 10, // Jarak antara judul dan deskripsi error
    // Jarak antara judul dan deskripsi error
  },
  errorText: {
    fontSize: 15, // Ukuran badan teks yang nyaman
    // Ukuran badan teks yang nyaman
    color: '#374151', // Abu tua agar mudah dibaca di atas latar merah muda
    // Abu tua agar mudah dibaca di atas latar merah muda
    textAlign: 'center', // Rata tengah untuk keterbacaan lebih baik
    // Rata tengah untuk keterbacaan lebih baik
    marginBottom: 12, // Jarak dari teks ke tombol coba lagi
    // Jarak dari teks ke tombol coba lagi
  },
  retryText: {
    fontSize: 16, // Ukuran yang cukup besar agar mudah ditekan
    // Ukuran yang cukup besar agar mudah ditekan
    color: '#1d4ed8', // Biru dipakai agar teks ini terasa seperti aksi yang bisa ditekan.
    // Biru dipakai agar teks ini terasa seperti aksi yang bisa ditekan.
    fontWeight: '600', // Semi-bold untuk membedakan dari teks biasa
    // Semi-bold untuk membedakan dari teks biasa
    textDecorationLine: 'underline', // Garis bawah memperkuat kesan tautan/tombol
    // Garis bawah memperkuat kesan tautan/tombol
  },
});

// Mendaftarkan App sebagai komponen pertama yang dijalankan Expo saat aplikasi dibuka.
registerRootComponent(App);

