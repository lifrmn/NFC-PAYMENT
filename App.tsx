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
// │ 2. Jalankan compatibility initializer                              │
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
//    - Compatibility initializer dijalankan lebih dulu
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
//      ke UI terdegradasi; fitur backend tetap tidak tersedia saat koneksi gagal
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
// import React (wajib untuk JSX); useState untuk state authState, currentUser, error; useEffect untuk inisialisasi app saat mount; useCallback untuk memoize fungsi navigateToScreen agar tidak dibuat ulang setiap render; useRef untuk menyimpan referensi stabil ke navigationRef dan authStateRef
import { StatusBar } from 'expo-status-bar';
// import StatusBar dari Expo \u2014 mengontrol tampilan status bar di bagian atas layar (warna, style dark/light)
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
// import NavigationContainer (wajib sebagai wrapper navigasi) dan NavigationContainerRef (tipe TypeScript untuk ref navigasi programatik)
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
// import createStackNavigator untuk membuat navigator stack (tumpukan layar); StackNavigationProp adalah tipe TypeScript untuk prop navigation di tiap screen
import AsyncStorage from '@react-native-async-storage/async-storage';
// import AsyncStorage \u2014 penyimpanan key-value persisten di perangkat; digunakan untuk menyimpan userId dan deviceId agar sesi tidak hilang saat app ditutup
import { registerRootComponent } from 'expo';
// import registerRootComponent dari Expo \u2014 mendaftarkan komponen App sebagai entry point utama aplikasi Expo
import {
  ActivityIndicator,
  // Spinner loading yang tampil saat startup
  StyleSheet,
  // Utility untuk membuat stylesheet yang dioptimalkan
  Text,
  // Komponen teks dasar React Native
  AppState,
  // API untuk memantau status aplikasi (active/background/inactive)
  AppStateStatus,
  // Tipe union untuk nilai AppState
  Platform,
  // Utilitas untuk membedakan Android vs iOS
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
// Provider + View yang menghindari area notch/status bar

// ==================================================================================
// IMPORT: Kumpulan Screen
// ==================================================================================
// Seluruh komponen layar yang dipakai di navigation stack utama.
// ==================================================================================
import LoginScreen from './src/screens/LoginScreen';
// Layar form login dengan username dan password
import RegisterScreen from './src/screens/RegisterScreen';
// Layar form pendaftaran akun baru
import DashboardScreen from './src/screens/DashboardScreen';
// Layar pusat menu setelah login berhasil
import NFCScreen from './src/screens/NFCScreen';
// Layar proses pembayaran via NFC
import RegisterCardScreen from './src/screens/RegisterCardScreen';
// Layar pendaftaran kartu NFC baru
import MyCardsScreen from './src/screens/MyCardsScreen';
// Layar daftar dan manajemen kartu NFC milik user

// ==================================================================================
// IMPORT: Kumpulan Utilitas
// ==================================================================================
// Fungsi dan service pendukung untuk database, NFC, dan komunikasi API.
// ==================================================================================
import { initDatabase } from './src/utils/database';
// Compatibility initializer; health check backend dilakukan terpisah saat startup.
import { NFCService } from './src/utils/nfc';
// Service NFC untuk scan dan cleanup resource hardware NFC
import { apiService } from './src/utils/apiService';
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
export type RootStackParamList = {
  // Definisi semua route yang ada di navigation stack
  Login: undefined;
  // Screen login — tidak butuh parameter tambahan
  Register: undefined;
  // Screen daftar — tidak butuh parameter tambahan
  Dashboard: undefined;
  // Screen dashboard — tidak butuh parameter tambahan
  NFC: undefined;
  // Screen pembayaran NFC — tidak butuh parameter tambahan
  RegisterCard: undefined;
  // Screen daftarkan kartu — tidak butuh parameter tambahan
  MyCards: undefined;
  // Screen daftar kartu — tidak butuh parameter tambahan
};

export type NavigationProp = StackNavigationProp<RootStackParamList>;
// export type mengekspor tipe ini agar bisa diimport screen lain; StackNavigationProp<RootStackParamList> menghasilkan tipe prop navigation yang type-safe — memastikan navigator.navigate() hanya bisa dipanggil dengan nama route yang valid
const Stack = createStackNavigator<RootStackParamList>();
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
type AuthState = 'loading' | 'signedIn' | 'signedOut';
// Tiga kondisi: sedang memuat, sudah login, belum login
type AppScreen = 'login' | 'register' | 'dashboard' | 'nfc' | 'registerCard' | 'myCards';
// Enum nama screen internal (huruf kecil, beda dari nama route)

interface AppUser {
  // Struktur data user yang beredar di level komponen App
  id: number;
  // Primary key user dari database backend
  name: string;
  // Nama lengkap untuk ditampilkan di UI
  username: string;
  // Username unik untuk login dan referensi API
  balance: number;
  // Saldo aktif dalam satuan Rupiah
  email?: string;
  // Email opsional — dibentuk otomatis dari username
}

// ==================================================================================
// KOMPONEN: App
// ==================================================================================
// Komponen utama aplikasi yang menjadi titik masuk seluruh alur mobile app.
//
// Tanggung jawab utama:
// 1. Menyiapkan service backend dan urutan startup
// 2. Memulihkan sesi autentikasi jika tersedia
// 3. Menyusun navigation stack
// 4. Menangani perubahan state aplikasi
// 5. Mengelola alur login dan logout pengguna
// ==================================================================================
export default function App() {
  // ================================================================================
  // MANAJEMEN STATE
  // ================================================================================
  // authState: Status autentikasi aplikasi saat ini
  // currentUser: Data user yang sedang login, null jika belum ada sesi
  // error: Pesan error untuk layar kegagalan
  // navigationRef: Ref untuk navigasi programatik dari level root
  // ================================================================================
  const [authState, setAuthState] = useState<AuthState>('loading');
  // State awal: aplikasi belum tahu user sudah login atau belum.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  // Menyimpan data user aktif setelah login berhasil.
  const [error, setError] = useState<string | null>(null);
  // Dipakai untuk menampilkan pesan error ke layar fallback.
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  // Ref ini memungkinkan navigasi dari luar screen.
  const authStateRef = useRef<AuthState>('loading');
  // Ref untuk melacak nilai authState terkini di dalam closure.

  // Sync authStateRef setiap kali authState berubah, agar timeout tidak terjebak stale closure
  useEffect(() => { authStateRef.current = authState; }, [authState]);
  // useEffect dengan dependency [authState] memastikan ref selalu sinkron setiap kali authState berubah

  console.log('🚀 App.tsx rendered, authState:', authState);
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
  useEffect(() => {
    apiService.setAuthenticationFailureHandler(() => {
      setCurrentUser(null);
      setAuthState('signedOut');
      NFCService.cleanup();
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });

    // Timeout pengaman agar user tidak tertahan di layar loading terlalu lama.
    const forceLoginTimeout = setTimeout(() => {
      // setTimeout menjalankan callback setelah 20 detik jika loading belum selesai
      if (authStateRef.current === 'loading') {
        // Gunakan ref agar tidak terjebak stale closure
        console.warn('⚠️ Loading timeout, paksa ke login screen');
        // console.warn mencetak peringatan kuning bahwa startup melewati batas 20 detik
        setAuthState('signedOut');
        // setAuthState('signedOut') memaksa keluar dari loading dan tampilkan layar login
      }
    }, 20000);
    // 20000 = 20 detik dalam milliseconds — batas waktu maksimal startup sebelum dipaksa ke login

    initializeApp();
    // Menjalankan seluruh proses startup aplikasi.
    
    const sub = AppState.addEventListener('change', handleAppStateChange);
    // Listener ini aktif saat app pindah active/background.
    return () => {
      clearTimeout(forceLoginTimeout);
      // Membersihkan timer agar tidak tetap jalan setelah komponen dibongkar.
      sub?.remove?.();
      // Melepas listener untuk mencegah memory leak.
      apiService.setAuthenticationFailureHandler(null);
      NFCService.cleanup();
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
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    // Fungsi async: dipanggil otomatis saat status app berubah (active/background/inactive)
    if (nextAppState === 'active') {
      // if: eksekusi blok hanya saat app kembali ke foreground — 'active' berarti layar kembali terlihat user
      console.log('📱 App aktif kembali, sync status device...');
      // Log penanda bahwa app baru saja kembali aktif dan sinkronisasi device segera dimulai
      try {
      // try: membungkus getItem AsyncStorage dan registerDevice API yang bisa gagal karena jaringan
        const deviceId =
          (await AsyncStorage.getItem('deviceId')) || `device_${Date.now()}`;
          // Jika belum ada deviceId tersimpan, buat ID sementara baru.
        const deviceInfo = {
          deviceId,
          deviceName: `${Platform.OS}_device_${deviceId.slice(-6)}`,
          // Nama device dibuat sederhana agar mudah dikenali di admin.
          platform: Platform.OS,
          // Memberi tahu backend apakah device Android atau iOS.
          appVersion: '1.0.0',
          // Versi aplikasi berguna untuk troubleshooting di backend.
        };

        await apiService.registerDevice(deviceInfo);
        // Mengirim data device terbaru ke backend.
        console.log('✅ Device status tersinkron ke backend');
        // Log konfirmasi bahwa sinkronisasi device berhasil saat app kembali aktif
      } catch (err) {
        // catch: tangkap error sinkronisasi device — tidak kritis, app tetap berjalan normal
        console.log('⚠️ Gagal sync device status:', err);
        // Log peringatan jika sinkronisasi gagal; tidak menghentikan jalannya aplikasi
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
  // 1️⃣ Compatibility initializer
  //    - Tidak membuka database lokal atau menguji koneksi backend
  //    - Mempertahankan urutan startup sebelum health check tahap 3
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
  //    - Jika gagal, startup lanjut tanpa menganggap transaksi backend tersedia
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
  const initializeApp = async () => {
    // Fungsi async: menjalankan 5 tahap startup berurutan (database → API → health → device → auth)
    try {
      setError(null);
      // Error lama dibersihkan dulu agar startup baru dimulai dari kondisi bersih.
      console.log('🚀 Memulai inisialisasi aplikasi...');
      // Log penanda bahwa proses inisialisasi 5 tahap berurutan resmi dimulai

      // === 1️⃣ Jalankan compatibility initializer tanpa koneksi database lokal
      console.log('1️⃣ Inisialisasi database...');
      // Tahap ini mempertahankan urutan startup lama; tidak membuka SQLite atau menguji backend.
      await Promise.race([
      // Promise.race: menjalankan dua Promise bersamaan dan mengambil yang paling cepat selesai
        initDatabase(),
        // Initializer no-op selesai sebelum health check aktual pada tahap 3.
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 10000))
        // Jika terlalu lama, startup dipaksa gagal agar tidak hang.
      ]);
      console.log('✅ Database ready');
      // Log legacy ini hanya menandakan compatibility initializer selesai.

      // === 2️⃣ Inisialisasi service backend
      console.log('2️⃣ Inisialisasi Backend API...');
      // Log penanda tahap 2: API service diinisialisasi untuk memulihkan token dan base URL
      await Promise.race([
      // Promise.race: menjalankan inisialisasi API dengan batas waktu 10 detik
        apiService.initialize(),
        // Memulihkan token dan konfigurasi dasar API.
        new Promise((_, reject) => setTimeout(() => reject(new Error('Backend API timeout')), 10000))
        // Proteksi bila inisialisasi API macet.
      ]);
      console.log('✅ Backend API ready');
      // Log konfirmasi bahwa token dipulihkan dan konfigurasi API siap digunakan

      // === 3️⃣ Cek koneksi backend melalui health check
      console.log('3️⃣ Koneksi ke backend server...');
      // Log penanda tahap 3: health check ke backend dimulai secara non-blocking
      let connected = false;
      // let: variabel yang nilainya bisa berubah; false berarti backend belum terkonfirmasi aktif
      // Variabel penanda ini menunjukkan apakah backend merespons health check.
      try {
        // try bersarang: health check non-blocking — jika gagal, aplikasi lanjut ke tahap berikutnya
        await apiService.healthCheck({ timeoutMs: 5000 });
        // Timeout dikontrol langsung oleh API service agar tidak meninggalkan request yatim.
        connected = true;
        // connected = true: menandai bahwa backend merespons health check dengan sukses
        console.log('✅ Backend connected');
        // Log konfirmasi bahwa server backend aktif dan siap menerima request API
      } catch (err) {
        // catch: tangkap error timeout atau network — aplikasi tetap lanjut ke tahap berikutnya
        console.warn('⚠️ Backend tidak terhubung, mode offline');
        // Startup tetap lanjut, tetapi fitur yang membutuhkan backend akan gagal sampai koneksi pulih.
      }

      // === 4️⃣ Registrasi device ke sistem admin (opsional)
      try {
        // try bersarang: registrasi device opsional — error tidak menggagalkan startup utama
        const { authenticated } = apiService.getConnectionStatus();
        if (!connected) {
          console.log('4️⃣ Skip register device (backend offline)');
        } else if (!authenticated) {
          console.log('4️⃣ Skip register device (belum login)');
        } else {
          console.log('4️⃣ Register device...');
          // Log penanda tahap 4: registrasi device ke dashboard admin dimulai
          const deviceId =
            (await AsyncStorage.getItem('deviceId')) || `device_${Date.now()}`;
            // Ambil deviceId lama supaya identitas device tetap konsisten.
          await AsyncStorage.setItem('deviceId', deviceId);
          // Simpan lagi agar startup berikutnya memakai ID yang sama.

          const deviceInfo = {
            deviceId,
            // ID unik device yang sudah diambil atau dibuat di atas
            deviceName: `${Platform.OS}_device_${deviceId.slice(-6)}`,
            // Nama yang mudah dikenali: platform + 6 karakter terakhir ID
            platform: Platform.OS,
            // 'android' atau 'ios' — dipakai backend untuk klasifikasi device
            appVersion: '1.0.0',
            // Versi aplikasi untuk kebutuhan monitoring dan debugging jarak jauh
          };

          await apiService.registerDevice(deviceInfo, { timeoutMs: 3000 });
          // Registrasi ini menghubungkan device mobile ke dashboard/admin backend.
          console.log('✅ Device registered ke admin system');
          // Log konfirmasi bahwa device berhasil terdaftar di sistem admin backend
        }
      } catch (err) {
        // catch: tangkap error registrasi device — tidak kritis, startup tetap lanjut
        console.warn('⚠️ Device sync failed, continue:', err);
        // Kegagalan sinkron device tidak boleh menggagalkan startup aplikasi.
      }

      // === 5️⃣ Pemeriksaan sesi login
      console.log('5️⃣ Cek authentication...');
      // Log penanda tahap 5: pengecekan dan pemulihan sesi autentikasi dari AsyncStorage
      await checkAuthState();
      // Langkah terakhir: tentukan user masuk dashboard atau login.

      console.log('✅ Aplikasi siap digunakan!');
      // Log konfirmasi bahwa seluruh tahap inisialisasi berhasil diselesaikan
    } catch (err: any) {
      // catch (err: any): menangkap error kritis dari tahap 1 atau 2 yang tidak bisa di-skip
      console.error('❌ Initialization error:', err);
      // Jika startup gagal, aplikasi tetap diarahkan ke login agar tidak buntu di loading.
      setAuthState('signedOut');
      // Fallback aman: jika startup bermasalah, tampilkan login saja.
    }
  };

  // ================================================================================
  // FUNGSI: checkAuthState
  // ================================================================================
  // Memulihkan status autentikasi dari JWT yang divalidasi backend.
  //
  // Alur kerja:
  // 1. Memastikan token dan userId sudah dimuat oleh apiService
  // 2. Memvalidasi token melalui endpoint /api/users/me
  // 3. Jika valid, currentUser diisi dan authState jadi signedIn
  // 4. Jika tidak ada, kedaluwarsa, atau backend gagal, authState menjadi signedOut
  //
  // Hasil akhir:
  // - Berhasil: user masuk ke Dashboard
  // - Gagal: user diarahkan ke Login
  // ================================================================================
  const checkAuthState = async () => {
    // Fungsi async: memvalidasi sesi backend sebelum membuka area terproteksi
    try {
      const session = apiService.getConnectionStatus();
      if (!session.authenticated || !session.userId) {
        setAuthState('signedOut');
        return;
      }

      const user = await apiService.getCurrentUser();
      if (!user?.id || Number(session.userId) !== Number(user.id)) {
        await apiService.logout(false);
        setAuthState('signedOut');
        return;
      }

      const appUser: AppUser = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: `${user.username}@nfcpay.com`,
        balance: user.balance || 0,
      };
      setCurrentUser(appUser);
      setAuthState('signedIn');
      console.log('✅ User authenticated:', appUser.name);
    } catch (err) {
      console.error('Error checking authentication:', err);
      setAuthState('signedOut');
      // Fail closed: cache user tidak pernah cukup untuk membuat sesi signed-in.
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
  const handleLogin = async (userData: {
    // Fungsi async: menyimpan sesi login ke AsyncStorage lalu reset navigasi ke Dashboard
    id: number;
    // id: Primary key user dari backend — disimpan ke AsyncStorage sebagai penanda sesi
    name: string;
    // name: Nama lengkap user dari response backend untuk ditampilkan di UI
    username: string;
    // username: Username unik untuk referensi API dan tampilan di layar
    balance?: number;
    // balance?: Saldo awal user; tanda ? berarti opsional karena mungkin tidak selalu dikirim backend
  }) => {
    try {
      // try: membungkus operasi AsyncStorage dan navigasi yang berpotensi gagal
      const appUser: AppUser = {
        id: userData.id,
        // ID user dari response backend setelah login
        name: userData.name,
        // Nama lengkap user untuk ditampilkan di UI
        username: userData.username,
        // Username untuk referensi API dan tampilan
        email: `${userData.username}@nfcpay.com`,
        // Format email diseragamkan di level App.
        balance: userData.balance || 0,
        // Saldo awal; default 0 jika tidak dikirim dari backend
      };
      await AsyncStorage.setItem('userId', appUser.id.toString());
      // Menyimpan session sederhana berbasis userId.
      setCurrentUser(appUser);
      // Data user dipakai ulang oleh screen-screen setelah login.
      setAuthState('signedIn');
      // Mengubah status supaya app menampilkan area terproteksi.

      navigationRef.current?.reset({
        index: 0,
        // Stack disetel ulang dari awal.
        routes: [{ name: 'Dashboard' }],
        // Setelah login berhasil, halaman pertama jadi Dashboard.
      });
      console.log('✅ Login success:', appUser.name);
      // Log konfirmasi login berhasil beserta nama user untuk memudahkan debugging
    } catch (err) {
      // catch: menangkap error dari AsyncStorage.setItem atau navigasi reset
      console.error('Login error:', err);
      // Log detail error login ke terminal untuk keperluan debugging
      setError('Gagal login, silakan coba lagi.');
      // Tampilkan pesan error ke layar agar user tahu ada masalah dan bisa coba ulang
    }
  };

  // ================================================================================
  // FUNGSI: handleLogout
  // ================================================================================
  // Menangani proses logout user.
  //
  // Alur kerja:
  // 1. Mencabut sesi backend dan membersihkan token serta userId lokal
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
  const handleLogout = async () => {
    // Fungsi async: cabut sesi lalu bersihkan state dan arahkan ke Login
    try {
      // try: membungkus operasi logout dan navigasi reset
      await apiService.logout();
      // Token aktif dikirim untuk revokasi sebelum data sesi lokal dihapus.
      setCurrentUser(null);
      // Membersihkan data user dari memory aplikasi.
      setAuthState('signedOut');
      // Mengubah mode aplikasi ke status belum login.
      NFCService.cleanup();
      // Penting agar proses NFC yang sedang aktif tidak tertinggal.

      navigationRef.current?.reset({
        index: 0,
        // Stack navigasi dimulai ulang dari posisi pertama
        routes: [{ name: 'Login' }],
        // Setelah logout, user dipaksa mulai lagi dari layar login.
      });
      console.log('✅ Logout success');
      // Log konfirmasi bahwa proses logout selesai dan navigasi sudah di-reset
    } catch (err) {
      // catch: menangkap error dari AsyncStorage.removeItem atau navigasi
      console.error('Logout error:', err);
      // Log detail error logout ke terminal untuk keperluan debugging
      setError('Logout gagal. Coba lagi.');
      // Tampilkan pesan error ke layar agar user mengetahui kegagalan logout
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
  const navigateToScreen = useCallback((screen: AppScreen) => {
    // useCallback: fungsi navigasi dimemoize agar tidak dibuat ulang setiap render — penting untuk performa
    if (!navigationRef.current) {
      // if: cek ref tersedia dulu sebelum memanggil navigate — mencegah crash saat navigator belum siap
      console.error('❌ Navigation ref not available');
      // Log error jika ref navigasi belum tersedia
      return;
      // return: keluar dari fungsi agar tidak lanjut memanggil navigate yang pasti crash
    }
    try {
      // try: membungkus navigate() karena bisa throw error jika route tidak valid
      const targetScreen = screen === 'register'
          ? 'Register'
          : screen === 'dashboard'
          ? 'Dashboard'
          : screen === 'nfc'
          ? 'NFC'
          : screen === 'registerCard'
          ? 'RegisterCard'
          : screen === 'myCards'
          ? 'MyCards'
          : 'Login';
          // Jika tidak cocok dengan semua kondisi di atas, fallback ke Login.
      
      console.log(`🧭 Navigating from current to: ${targetScreen} (screen param: ${screen})`);
      // Log rute tujuan sebelum navigasi untuk memudahkan tracing alur screen
      navigationRef.current.navigate(targetScreen);
      // Menjalankan perpindahan route sesuai hasil pemetaan.
      console.log(`✅ Navigation completed: ${screen}`);
      // Log konfirmasi navigasi berhasil tanpa error
    } catch (err) {
      // catch: menangkap error jika navigate() gagal (misal route tidak ditemukan)
      console.error('❌ Navigation error:', err);
      // Log detail error navigasi untuk keperluan debugging
    }
  }, []);



  // ========================================================
  // Layar Loading dan Error
  // ========================================================
  if (authState === 'loading') {
    // Tampilkan spinner selama proses startup berlangsung
    return (
      // return JSX: mengembalikan tampilan loading screen saat aplikasi sedang inisialisasi
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

  if (error && authState === 'signedOut') {
    // Tampilkan layar error hanya jika ada pesan error dan user belum login
    return (
      // return JSX: mengembalikan tampilan layar error dengan tombol coba lagi
      <SafeAreaView style={styles.errorContainer}>
        {/* Text = judul error berwarna merah yang langsung terlihat user */}
        <Text style={styles.errorTitle}>Terjadi Kesalahan</Text>
        {/* Text = menampilkan pesan error spesifik dari state error */}
        <Text style={styles.errorText}>{error}</Text>
        <Text
          style={styles.retryText}
          onPress={() => {
            setError(null);
            // Error dibersihkan dulu agar UI kembali normal.
            initializeApp();
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
  return (
    // return JSX utama: mengembalikan seluruh struktur navigasi aplikasi yang dibungkus SafeAreaProvider
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            // Header default dimatikan karena tiap screen memakai layout sendiri.
            gestureEnabled: true,
            // Gesture back/transition tetap diaktifkan.
            animationEnabled: true,
            // Transisi layar dibuat halus.
          }}
          initialRouteName={authState === 'signedOut' ? 'Login' : 'Dashboard'}
          // Menentukan layar awal berdasarkan status login.
        >
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {() => (
              <LoginScreen
                onLogin={handleLogin}
                // Jika login sukses, App akan menyimpan sesi dan reset ke Dashboard.
                onNavigateToRegister={() => navigateToScreen('register')}
                // Tombol daftar dari Login diarahkan ke screen Register.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Register" options={{ headerShown: false }}>
            {() => (
              <RegisterScreen
                onRegisterSuccess={() => navigateToScreen('login')}
                // Setelah daftar berhasil, user dibawa kembali ke login.
                onNavigateToLogin={() => navigateToScreen('login')}
                // Jika user batal daftar, kembali ke login.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Dashboard" options={{ headerShown: false }}>
            {() => (
              <DashboardScreen
                user={currentUser}
                // Dashboard menerima data user aktif untuk ditampilkan.
                onLogout={handleLogout}
                // Tombol logout di dashboard akan membersihkan sesi.
                onNavigateToNFC={() => navigateToScreen('nfc')}
                // Masuk ke alur pembayaran NFC.
                onNavigateToRegisterCard={() => navigateToScreen('registerCard')}
                // Masuk ke form pendaftaran kartu baru.
                onNavigateToMyCards={() => navigateToScreen('myCards')}
                // Melihat daftar kartu yang sudah terhubung.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="NFC" options={{ headerShown: false }}>
            {() => (
              <NFCScreen
                user={currentUser}
                // Data user dipakai untuk konteks pembayaran atau saldo.
                onBack={() => navigateToScreen('dashboard')}
                // Tombol kembali dari NFC mengarah ke dashboard.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="RegisterCard" options={{ headerShown: false }}>
            {() => (
              <RegisterCardScreen
                user={currentUser}
                // Screen ini butuh data user agar kartu terhubung ke akun yang benar.
                onBack={() => navigateToScreen('dashboard')}
                // Jika batal, kembali ke dashboard.
                onSuccess={() => navigateToScreen('myCards')}
                // Jika berhasil, lanjut ke daftar kartu.
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="MyCards" options={{ headerShown: false }}>
            {() => (
              <MyCardsScreen
                user={currentUser}
                // Screen kartu butuh user untuk memuat data kartu yang sesuai.
                onBack={() => navigateToScreen('dashboard')}
                // Kembali ke pusat menu utama.
                onRegisterNew={() => navigateToScreen('registerCard')}
                // Shortcut tambah kartu baru dari daftar kartu.
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
const styles = StyleSheet.create({
  // StyleSheet.create: membuat objek stylesheet yang dioptimalkan oleh React Native untuk performa lebih baik
  loadingContainer: {
    flex: 1,
    // Mengisi seluruh tinggi layar.
    justifyContent: 'center',
    // Konten diposisikan ke tengah secara vertikal.
    alignItems: 'center',
    // Konten diposisikan ke tengah secara horizontal.
    backgroundColor: '#f8fafc',
    // Warna latar loading yang terang dan netral.
  },
  loadingText: {
    marginTop: 20,
    // Memberi jarak dari indikator loading.
    fontSize: 16,
    // Ukuran teks yang nyaman dibaca
    color: '#6b7280',
    // Abu-abu sedang — kontras cukup tanpa terlalu mencolok
    textAlign: 'center',
    // Rata tengah agar sejajar dengan spinner
  },
  loadingSubtext: {
    marginTop: 8,
    // Jarak kecil dari teks utama loading
    fontSize: 14,
    // Sedikit lebih kecil dari teks utama
    color: '#9ca3af',
    // Abu-abu lebih terang untuk memberi kesan teks sekunder
    textAlign: 'center',
    // Rata tengah
  },
  errorContainer: {
    flex: 1,
    // Mengisi seluruh layar
    justifyContent: 'center',
    // Konten di tengah secara vertikal
    alignItems: 'center',
    // Konten di tengah secara horizontal
    backgroundColor: '#fef2f2',
    // Warna merah muda muda memberi kesan ada error tapi tetap lembut.
    padding: 20,
    // Padding agar teks tidak mepet ke tepi layar
  },
  errorTitle: {
    fontSize: 22,
    // Besar agar langsung terbaca sebagai judul halaman error
    fontWeight: 'bold',
    // Tebal untuk memperkuat kesan penting
    color: '#b91c1c',
    // Merah pekat untuk judul error agar segera terlihat.
    marginBottom: 10,
    // Jarak antara judul dan deskripsi error
  },
  errorText: {
    fontSize: 15,
    // Ukuran badan teks yang nyaman
    color: '#374151',
    // Abu tua agar mudah dibaca di atas latar merah muda
    textAlign: 'center',
    // Rata tengah untuk keterbacaan lebih baik
    marginBottom: 12,
    // Jarak dari teks ke tombol coba lagi
  },
  retryText: {
    fontSize: 16,
    // Ukuran yang cukup besar agar mudah ditekan
    color: '#1d4ed8',
    // Biru dipakai agar teks ini terasa seperti aksi yang bisa ditekan.
    fontWeight: '600',
    // Semi-bold untuk membedakan dari teks biasa
    textDecorationLine: 'underline',
    // Garis bawah memperkuat kesan tautan/tombol
  },
});

// Mendaftarkan App sebagai komponen pertama yang dijalankan Expo saat aplikasi dibuka.
registerRootComponent(App);

