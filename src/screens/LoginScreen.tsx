
// src/screens/LoginScreen.tsx
// ==================================================================================
// 🔑 SCREEN: LoginScreen
// ==================================================================================
//
// Purpose:
// Authentication screen untuk user login ke aplikasi.
// Implement hybrid authentication: Backend API first, fallback ke SQLite offline.
//
// User Flow:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ 1. User buka app                                                       │
// │ 2. LoginScreen muncul (default screen)                              │
// │ 3. User input username & password                                   │
// │ 4. User tap "Masuk" button                                          │
// │ 5. System validate input (not empty)                                │
// │ 6. System try login via Backend API                                 │
// │    └─ Success: Get token + user data, save to AsyncStorage       │
// │    └─ Failed: Fallback ke SQLite offline mode                     │
// │ 7. onLogin callback called dengan user data                         │
// │ 8. App.tsx navigate ke DashboardScreen                              │
// └─────────────────────────────────────────────────────────────────────┘
//
// Features:
// 1. Hybrid Authentication:
//    - Primary: Backend API with JWT token
//    - Fallback: SQLite offline authentication
//    - Seamless switch tanpa user aware
//
// 2. Form Validation:
//    - Check username & password not empty
//    - Show error alert if validation failed
//
// 3. Loading State:
//    - Disable button saat processing
//    - Show loading indicator
//    - Prevent multiple concurrent requests
//
// 4. Persistent Authentication:
//    - Save JWT token ke AsyncStorage
//    - Save userId ke AsyncStorage
//    - Auto-restore session on next app launch
//
// 5. Navigation:
//    - Link to RegisterScreen ("Belum punya akun?")
//    - Callback to parent (App.tsx) after success
//
// 6. Keyboard Handling:
//    - KeyboardAvoidingView untuk iOS/Android
//    - Auto-adjust saat keyboard muncul
//    - Prevent input tertutup keyboard
//
// State Management:
// - username: string - Input username dari user
// - password: string - Input password dari user
// - loading: boolean - Flag loading state (disable button + show spinner)
//
// Props:
// - onLogin: (user: any) => void - Callback saat login berhasil
// - onNavigateToRegister: () => void - Callback untuk navigate ke RegisterScreen
//
// ==================================================================================

// ==================================================================================
// IMPORTS
// ==================================================================================
// React:
// - useState: Hook untuk state management
//
// React Native Core:
// - View, Text: Basic UI components
// - TextInput: Input field untuk username/password
// - TouchableOpacity: Pressable area untuk register link
// - KeyboardAvoidingView: Auto-adjust layout saat keyboard muncul
// - Platform: Detect iOS/Android untuk keyboard behavior
// - Alert: Native alert dialog untuk errors
// - StyleSheet: Type-safe styling API
//
// React Native Safe Area:
// - SafeAreaView: Respect device safe area (notch, status bar)
//
// AsyncStorage:
// - Persistent storage untuk token & userId
// - Key-value storage di native layer
//
// Custom Components:
// - CustomButton: Reusable button dengan loading state
//
// Utils:
// - loginUser: Offline login via SQLite (from database.ts)
// - apiService: HTTP client untuk backend API (from apiService.ts)
// ==================================================================================
import React, { useState } from 'react'; // import React diperlukan di setiap file TSX/JSX agar fitur JSX dan hooks bisa digunakan
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View, // View: komponen container dasar React Native setara div HTML; untuk mengelompokkan elemen UI
  Text, // Text: komponen untuk menampilkan teks di layar; setiap teks harus dibungkus Text
  TextInput, // TextInput: kolom input teks; setara input[type=text] di HTML; mendukung keyboard native Android/iOS
  TouchableOpacity, // TouchableOpacity: tombol dengan efek transparansi saat ditekan; dipakai untuk semua tombol interaktif
  Alert, // Alert: API React Native untuk menampilkan dialog popup native kepada user
  KeyboardAvoidingView, // KeyboardAvoidingView: wrapper yang menggeser konten ke atas saat keyboard muncul agar form tidak tertutup
  Platform // Platform: objek utilitas untuk deteksi OS (Android/iOS); Platform.OS mengembalikan string "android" atau "ios"
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context'; // import SafeAreaView dari library react-native-safe-area-context; memberikan padding aman di area notch/status bar
import AsyncStorage from '@react-native-async-storage/async-storage'; // import AsyncStorage: penyimpanan key-value lokal persisten di perangkat Android/iOS
import CustomButton from '../components/CustomButton'; // import komponen CustomButton dari folder components; tombol yang sudah dikustomisasi dengan style aplikasi
import { loginUser } from '../utils/database'; // import fungsi loginUser dari database.ts; fungsi untuk autentikasi user ke SQLite lokal
import { apiService } from '../utils/apiService'; // import apiService: singleton HTTP client untuk komunikasi dengan backend Express
import styles from './LoginScreen.styles'; // import objek styles dari file styles terpisah; memisahkan logika dan tampilan agar kode lebih terorganisasi

// ==================================================================================
// TYPE DEFINITIONS
// ==================================================================================
// LoginScreenProps:
// - onLogin: Callback function yang dipanggil saat login berhasil
//   Parameter: user object dengan data user (id, username, email, balance, etc)
//   Use case: Parent component (App.tsx) akan set currentUser state
//
// - onNavigateToRegister: Callback function untuk navigate ke RegisterScreen
//   No parameters
//   Use case: User tap "Belum punya akun? Daftar di sini"
// ==================================================================================
interface LoginScreenProps { // interface TypeScript mendefinisikan struktur dan tipe props yang diterima komponen
  onLogin: (user: any) => void; // onLogin: prop fungsi callback yang dipanggil komponen induk saat login berhasil
  onNavigateToRegister: () => void; // onNavigateToRegister: prop fungsi untuk navigasi ke halaman daftar akun
}

// ==================================================================================
// COMPONENT: LoginScreen
// ==================================================================================
// Functional component dengan React hooks untuk state management.
//
// PARAMS:
// @param onLogin - Callback saat login berhasil
// @param onNavigateToRegister - Callback untuk navigate ke RegisterScreen
// ==================================================================================
export default function LoginScreen({ onLogin, onNavigateToRegister }: LoginScreenProps) { // export default function: mendefinisikan dan mengekspor komponen React fungsional utama file ini
  // STATE 1: username input
  // Pattern controlled component: value={username} onChangeText={setUsername}
  // Artinya: TextInput selalu menampilkan value dari state, dan perubahan langsung update state
  const [username, setUsername] = useState(''); // Nilai awal: string kosong
  
  // STATE 2: password input
  // Sama seperti username, tapi dengan secureTextEntry untuk masking karakter
  const [password, setPassword] = useState(''); // Nilai awal: string kosong
  
  // STATE 3: loading flag untuk mencegah double-tap dan menampilkan spinner
  // Saat true: tombol login dinonaktifkan dan menampilkan spinner
  // Saat false: tombol login aktif kembali
  const [loading, setLoading] = useState(false); // Nilai awal: false (tombol aktif)

  // ================================================================================
  // FUNCTION: handleLogin
  // ================================================================================
  // Main login handler dengan hybrid authentication strategy.
  //
  // FLOW:
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ STEP 1: Validate Input                                              │
  // │         └─ Check username & password not empty                     │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 2: Set loading = true                                          │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 3: Try Backend API Login                                      │
  // │         └─ API: POST /api/auth/login                             │
  // │         └─ Success: Save token + userId to AsyncStorage         │
  // │         └─ Failed: Catch error, continue to Step 4             │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 4: Fallback to SQLite Offline Login                           │
  // │         └─ Query local database untuk validate credentials       │
  // │         └─ Success: Call onLogin callback                        │
  // │         └─ Failed: Show error alert                              │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 5: Set loading = false (finally block)                        │
  // └─────────────────────────────────────────────────────────────────────┘
  //
  // Kenapa Hybrid Approach?
  // - Online: Full features, sync data, centralized authentication
  // - Offline: Basic features, cached data, local authentication
  // - Seamless: User tidak perlu tahu mode apa yang aktif
  // - Resilient: App tetap bisa digunakan meski backend down
  // ================================================================================
  const handleLogin = async () => { // handleLogin async: memproses login user; async karena perlu request API dan tulis AsyncStorage
    // STEP 1: Validasi input - pastikan tidak ada field yang kosong
    // trim() menghapus spasi di awal/akhir string
    // Jika salah satu kosong, tampilkan alert dan hentikan proses
    if (!username.trim() || !password.trim()) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      Alert.alert('Error', 'Username dan password harus diisi'); // Alert native Android/iOS
      return; // Berhenti di sini, tidak lanjut ke proses login
    }

    // STEP 2: Aktifkan loading state supaya UI merespons
    // Efek: tombol login jadi disabled, muncul spinner, user tidak bisa tap lagi
    setLoading(true); // State berubah dari false → true, trigger re-render komponen
    
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      console.log('🔐 Attempting login for:', username); // Log untuk debugging di console

      // STEP 3: Coba login melalui backend API terlebih dahulu (metode utama)
      // Jika backend offline atau error, kita akan fallback ke database lokal
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // Memanggil API login ke backend server
        // Backend akan cek username/password di database, lalu kirim token JWT jika valid
        const response = await apiService.login({ username, password }); // Await karena ini operasi async

        // VALIDASI 3.1: Pastikan respons dari server mengandung token dan data user
        // Operator ?. artinya: akses property hanya jika object tidak null/undefined
        if (response?.token && response?.user) { // memeriksa response login berhasil: token JWT dan data user keduanya harus ada
          const userData = response.user; // Ekstrak data user dari respons
          
          // STEP 3.2: Simpan token dan userId ke penyimpanan lokal agar sesi tetap ada
          // AsyncStorage = seperti localStorage di web tapi async dan native
          // Data ini akan dipakai lagi saat app dibuka kembali (auto-login)
          await AsyncStorage.setItem('token', response.token); // Simpan JWT token
          await AsyncStorage.setItem('userId', userData.id.toString()); // Simpan user ID (harus string)
          
          console.log('✅ Login success (backend):', userData.username); // Log sukses ke console
          
          // STEP 3.3: Panggil callback onLogin yang diberikan oleh parent (App.tsx)
          // Callback ini akan meng-update state di App.tsx dan pindah ke Dashboard
          onLogin(userData); // Kirim data user ke parent component
          
          // STEP 3.4: Matikan loading state dan keluar dari function
          setLoading(false); // Loading selesai, tombol aktif kembali
          return; // Keluar dari function karena login berhasil, tidak perlu lanjut ke offline mode
        }
      } catch (err) { // catch (err): menangkap error dari blok try untuk ditampilkan atau dicatat ke log
        // Jika backend tidak merespons atau ada error jaringan
        // Kita tidak throw error lagi, tapi lanjut ke mode offline di bawah
        console.log('⚠️ Backend unavailable, using offline mode'); // Log peringatan
      }

      // STEP 4: Mode offline sebagai fallback jika backend gagal
      // Coba login menggunakan database lokal (SQLite)
      // Function loginUser akan cek username/password di database lokal
      const localUser = await loginUser(username, password); // Query ke SQLite
      
      if (localUser) { // memeriksa apakah user ditemukan di database lokal; null berarti ID tidak valid
        // Jika data user ditemukan di database lokal, login berhasil
        console.log('✅ Login success (offline):', localUser.username); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        // Panggil callback onLogin dengan data dari database lokal
        // Catatan: mode offline tidak punya token, jadi fitur sync backend tidak aktif
        onLogin(localUser); // Kirim data user offline ke parent
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // Jika username/password tidak cocok di database lokal juga
        Alert.alert('Gagal', 'Username atau password salah'); // Tampilkan pesan error
      }
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // Handler error global yang menangkap error tak terduga
      // Misalnya error saat akses AsyncStorage atau database corrupt
      console.error('❌ Login error:', error); // Log detail error ke console
      Alert.alert('Error', 'Terjadi kesalahan saat login'); // Tampilkan pesan umum ke user
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      // Block finally selalu dijalankan, baik sukses maupun error
      // Penting untuk reset loading state agar UI tidak stuck
      setLoading(false); // Pastikan loading state kembali ke false
    }
  };

  // ================================================================================
  // FUNCTION: handleNavigateToRegister
  // ================================================================================
  // Simple callback wrapper untuk navigate ke RegisterScreen.
  // Call onNavigateToRegister prop yang diberikan dari parent (App.tsx).
  //
  // Use case:
  // - User tap "Belum punya akun? Daftar di sini" link
  // - Navigate to RegisterScreen untuk create new account
  // ================================================================================
  const handleNavigateToRegister = () => { // fungsi handler navigasi: membungkus prop navigasi agar bisa dipanggil dari event handler
    onNavigateToRegister(); // memanggil prop fungsi navigasi yang diberikan komponen induk untuk pindah ke halaman daftar
  };

  // ================================================================================
  // RENDER: UI Components
  // ================================================================================
  // Render login form dengan React Native components.
  //
  // Component Hierarchy:
  // <SafeAreaView>                      - Respect device safe area (notch, status bar)
  //   <ScrollView>                      - Scrollable container
  //     <KeyboardAvoidingView>            - Auto-adjust saat keyboard muncul
  //       <View style={header}>          - Header dengan logo dan judul
  //       <View style={card}>            - Card putih dengan form
  //         <TextInput username />      - Username input dengan icon
  //         <TextInput password />      - Password input dengan icon
  //         <TouchableOpacity>         - Link lupa password
  //         <CustomButton />            - Login button biru besar
  //       <TouchableOpacity>           - Link register
  //
  // Controlled Components Pattern:
  // - value={username} - Bind state to TextInput value
  // - onChangeText={setUsername} - Update state on user type
  // - Result: Single source of truth (state)
  //
  // Keyboard Handling:
  // - KeyboardAvoidingView dengan behavior based on Platform
  // - iOS: 'padding' - Add padding saat keyboard muncul
  // - Android: 'height' - Adjust height saat keyboard muncul
  // - Prevent input tertutup keyboard
  // ================================================================================
  return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} // behavior: menentukan cara KeyboardAvoidingView bereaksi; "padding" untuk iOS, "height" untuk Android
        style={styles.container} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoIcon}>💳</Text>
                <Text style={styles.logoWave}>)))</Text>
              </View>
              <View style={styles.logoShield}>
                <Text style={styles.shieldIcon}>🛡️</Text>
              </View>
            </View>
            <Text style={styles.title}>Dompet Digital NFC</Text>
            <Text style={styles.subtitle}>Pembayaran NFC aman dengan deteksi fraud</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masuk</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput // TextInput: kolom input teks; setara dengan input di HTML; mendukung keyboard native
                style={styles.input} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
                placeholder="Masukkan username" // placeholder: teks abu-abu yang ditampilkan dalam TextInput saat belum ada input dari user
                placeholderTextColor="#94a3b8" // placeholderTextColor: warna teks placeholder; biasanya abu-abu agar kontras dengan teks input normal
                value={username} // value={} mengikat nilai input ke state; membuat TextInput menjadi controlled component
                onChangeText={setUsername} // onChangeText dipanggil setiap user mengetik; parameter berisi teks terbaru; digunakan untuk update state
                autoCapitalize="none" // autoCapitalize none: menonaktifkan auto-kapitalisasi; penting untuk field username dan email
                autoComplete="username" // autoComplete: petunjuk ke sistem untuk autofill; membantu user mengisi form lebih cepat
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput // TextInput: kolom input teks; setara dengan input di HTML; mendukung keyboard native
                style={styles.input} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
                placeholder="Masukkan kata sandi" // placeholder: teks abu-abu yang ditampilkan dalam TextInput saat belum ada input dari user
                placeholderTextColor="#94a3b8" // placeholderTextColor: warna teks placeholder; biasanya abu-abu agar kontras dengan teks input normal
                value={password} // value={} mengikat nilai input ke state; membuat TextInput menjadi controlled component
                onChangeText={setPassword} // onChangeText dipanggil setiap user mengetik; parameter berisi teks terbaru; digunakan untuk update state
                secureTextEntry // secureTextEntry: prop boolean true menyembunyikan karakter menjadi titik-titik; digunakan untuk field password
                autoComplete="password" // autoComplete: petunjuk ke sistem untuk autofill; membantu user mengisi form lebih cepat
              />
            </View>
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Lupa kata sandi?</Text>
            </TouchableOpacity>
            <TouchableOpacity  // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
              style={[styles.loginButton, loading && styles.loginButtonDisabled]} // style={} prop untuk menerapkan styling ke elemen React Native
              onPress={handleLogin} // onPress dipanggil saat user menekan elemen; menghubungkan event ke fungsi handler
              disabled={loading} // disabled: jika true tombol tidak bisa ditekan; digunakan saat loading atau form belum lengkap
            >
              {loading ? ( // ternary JSX: jika state loading=true tampilkan spinner ActivityIndicator, jika false tampilkan elemen normal
                <View style={styles.processingRow}>
                  <Text style={styles.loginButtonText}>Memproses </Text>
                </View>
              ) : ( // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Belum punya akun?</Text>
            <TouchableOpacity onPress={handleNavigateToRegister}>
              <Text style={styles.registerLink}>  Daftar Akun  →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ==================================================================================
// STYLES
// ==================================================================================
// StyleSheet.create() untuk type-safe styling.
//
// Design System:
// - Color Palette:
//   * Background: #f5f5f5 (light gray)
//   * Text primary: #2c3e50 (dark blue)
//   * Text secondary: #7f8c8d (gray)
//   * Link: #3498db (blue)
//   * Input border: #ddd (light gray)
//
// - Typography:
//   * Title: 32px bold
//   * Subtitle: 16px normal
//   * Input: 16px normal
//   * Link: 16px semibold
//
// - Spacing:
//   * Container padding: 20px
//   * Input margin: 16px
//   * Button margin: 20px
//
// - Border Radius:
//   * Inputs: 12px (rounded corners)
//
// - Shadows:
//   * Inputs: subtle shadow untuk depth
// ==================================================================================