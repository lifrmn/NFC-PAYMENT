// src/screens/RegisterScreen.tsx
// ==================================================================================
// 📝 SCREEN: RegisterScreen
// ==================================================================================
//
// Purpose:
// User registration screen untuk create new account.
// Implement hybrid registration: Backend API first, fallback ke SQLite offline.
//
// User Flow:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ 1. User tap "Belum punya akun?" di LoginScreen                    │
// │ 2. RegisterScreen muncul                                           │
// │ 3. User input: name, username, password, confirm password         │
// │ 4. User tap "Daftar" button                                        │
// │ 5. System validate input:                                          │
// │    - All fields not empty                                          │
// │    - Username min 3 chars                                          │
// │    - Password min 6 chars                                          │
// │    - Password match dengan confirm                                 │
// │ 6. System try register via Backend API                             │
// │    └─ Success: Create user, save token, show success alert       │
// │    └─ Failed: Fallback ke SQLite offline mode                     │
// │ 7. Success alert muncul dengan "OK" button                         │
// │ 8. User tap "OK", navigate back ke LoginScreen                     │
// │ 9. User login dengan credentials baru                              │
// └─────────────────────────────────────────────────────────────────────┘
//
// Features:
// 1. Hybrid Registration:
//    - Primary: Backend API dengan password bcrypt hashing
//    - Fallback: SQLite offline registration
//    - Seamless switch tanpa user aware
//
// 2. Form Validation (5 checks):
//    - All fields not empty
//    - Username min 3 characters (prevent too short)
//    - Password min 6 characters (security requirement)
//    - Password match dengan confirm (prevent typo)
//    - Show specific error alert untuk setiap validation
//
// 3. Loading State:
//    - Disable button saat processing
//    - Show loading indicator "Membuat Akun..."
//    - Prevent multiple concurrent requests
//
// 4. Persistent Authentication:
//    - Save JWT token ke AsyncStorage (jika dari backend)
//    - Save userId ke AsyncStorage
//    - Auto-login after registration
//
// 5. Navigation:
//    - Link to LoginScreen ("Sudah punya akun?")
//    - Callback to parent after success
//    - Navigate back to login for user to login
//
// 6. Scrollable Form:
//    - ScrollView untuk handle keyboard overlap
//    - KeyboardAvoidingView untuk iOS/Android
//    - Support small screens
//
// State Management:
// - name: string - Input nama lengkap dari user
// - username: string - Input username (unique identifier)
// - password: string - Input password dari user
// - confirmPassword: string - Input konfirmasi password
// - loading: boolean - Flag loading state
//
// Props:
// - onRegisterSuccess: () => void - Callback saat register berhasil
// - onNavigateToLogin: () => void - Callback untuk navigate ke LoginScreen
//
// ==================================================================================

// ==================================================================================
// IMPORTS
// ==================================================================================
// React:
// - useState: Hook untuk state management (4 fields + loading)
//
// React Native Core:
// - View, Text: Basic UI components
// - TextInput: Input field untuk name, username, password, confirmPassword
// - TouchableOpacity: Pressable area untuk login link
// - KeyboardAvoidingView: Auto-adjust layout saat keyboard muncul
// - Platform: Detect iOS/Android untuk keyboard behavior
// - Alert: Native alert dialog untuk validation errors dan success
// - StyleSheet: Type-safe styling API
// - ScrollView: Scrollable container untuk form (prevent keyboard overlap)
//
// React Native Safe Area:
// - SafeAreaView: Respect device safe area (notch, status bar)
//
// AsyncStorage:
// - Persistent storage untuk token & userId after registration
//
// Custom Components:
// - CustomButton: Reusable button dengan loading state, variant "secondary" (green)
//
// Utils:
// - registerUser: Offline registration via SQLite (from database.ts)
// - apiService: HTTP client untuk backend API registration (from apiService.ts)
// ==================================================================================
import React, { useState } from 'react'; // import React (wajib untuk JSX) dan useState hook untuk membuat state lokal (name, username, password, confirmPassword, loading)
import {
  View, // View adalah komponen container dasar React Native — setara div di HTML
  Text, // Text menampilkan teks
  TextInput, // TextInput adalah input teks — digunakan untuk semua field form (nama, username, password, konfirmasi)
  TouchableOpacity, // TouchableOpacity adalah area yang bisa ditekan dengan efek transparan — digunakan untuk link "Sudah punya akun?"
  Alert, // Alert menampilkan dialog popup native untuk validasi input dan pesan sukses registrasi
  KeyboardAvoidingView, // KeyboardAvoidingView menggeser layout secara otomatis saat keyboard muncul agar form tidak tertutup keyboard
  Platform, // Platform.OS mengembalikan 'android' atau 'ios' — digunakan karena perilaku keyboard berbeda di tiap platform
  ScrollView // ScrollView memungkinkan form bisa di-scroll saat konten melebihi tinggi layar atau keyboard muncul
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView memastikan UI tidak tertutup notch, status bar, atau home indicator
import AsyncStorage from '@react-native-async-storage/async-storage'; // AsyncStorage adalah penyimpanan key-value persisten — digunakan untuk menyimpan token dan userId setelah registrasi berhasil
import CustomButton from '../components/CustomButton'; // import komponen CustomButton dari file lokal — tombol reusable dengan loading state dan variant warna
import { apiService } from '../utils/apiService'; // import apiService Singleton dari apiService.ts — digunakan untuk mengirim request registrasi ke backend
import styles from './RegisterScreen.styles'; // import stylesheet dari file terpisah agar kode komponen tetap bersih

// ==================================================================================
// TYPE DEFINITIONS
// ==================================================================================
// RegisterScreenProps:
// - onRegisterSuccess: Callback function yang dipanggil saat registration berhasil
//   No parameters
//   Use case: Parent component (App.tsx) akan navigate back ke LoginScreen
//
// - onNavigateToLogin: Callback function untuk navigate ke LoginScreen
//   No parameters
//   Use case: User tap "Sudah punya akun? Masuk di sini" link
// ==================================================================================
interface RegisterScreenProps { // interface adalah blueprint TypeScript untuk mendefinisikan struktur props yang diterima komponen RegisterScreen
  onRegisterSuccess: () => void; // callback function tanpa argumen (() => void) — dipanggil App.tsx saat registrasi berhasil, biasanya untuk navigasi kembali ke login
  onNavigateToLogin: () => void; // callback function tanpa argumen — dipanggil saat user menekan link "Sudah punya akun?"
}

// ==================================================================================
// COMPONENT: RegisterScreen
// ==================================================================================
// Functional component dengan React hooks untuk state management.
// 4 controlled inputs + 1 loading state = 5 useState hooks.
//
// PARAMS:
// @param onRegisterSuccess - Callback saat registration berhasil
// @param onNavigateToLogin - Callback untuk navigate ke LoginScreen
// ==================================================================================
export default function RegisterScreen({ onRegisterSuccess, onNavigateToLogin }: RegisterScreenProps) {
  // STATE 1: name - Input nama lengkap user (contoh: "Budi Santoso")
  // Controlled component, nilai selalu sinkron dengan state
  const [name, setName] = useState(''); // const membuat variabel tetap; useState('') membuat state string kosong; name menyimpan teks nama yang diketik user; setName adalah fungsi untuk memperbarui state name
  
  // STATE 2: username - Input username unik untuk login (contoh: "budi123")
  // Harus unique di database, divalidasi di backend
  const [username, setUsername] = useState(''); // useState('') nilai awal string kosong; username digunakan sebagai identifier login; setUsername dipanggil onChangeText TextInput
  
  // STATE 3: password - Input password yang akan di-hash di backend
  // Backend menggunakan bcrypt untuk hash (one-way encryption)
  const [password, setPassword] = useState(''); // useState('') nilai awal string kosong; password akan dikirim ke backend untuk di-hash bcrypt; setPassword dipanggil setiap user mengetik di field password
  
  // STATE 4: confirmPassword - Input konfirmasi password untuk validasi
  // Harus sama persis dengan password, mencegah typo user
  const [confirmPassword, setConfirmPassword] = useState(''); // useState('') nilai awal string kosong; dibandingkan dengan password menggunakan operator === untuk validasi kecocokan
  
  // STATE 5: loading - Flag untuk disable tombol dan tampilkan spinner
  // true = tombol disabled, text berubah jadi "Membuat Akun..."
  // false = tombol aktif, text "Daftar"
  const [loading, setLoading] = useState(false); // useState(false) nilai awal boolean false; loading=true menonaktifkan tombol Daftar dan menampilkan teks "Membuat Akun..."; false berarti form siap diisi

  // ================================================================================
  // FUNCTION: handleRegister
  // ================================================================================
  // Main registration handler dengan hybrid registration strategy.
  // Implement 5-layer validation sebelum submit ke backend/database.
  //
  // VALIDATION FLOW:
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ VALIDATION 1: All fields not empty                                   │
  // │               └─ Check: name, username, password, confirmPassword   │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ VALIDATION 2: Username min 3 characters                              │
  // │               └─ Prevent: "ab" (too short)                       │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ VALIDATION 3: Password min 6 characters                              │
  // │               └─ Security requirement                             │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ VALIDATION 4: Password match dengan confirmPassword                  │
  // │               └─ Prevent typo errors                              │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ BACKEND REGISTRATION                                                 │
  // │   └─ Try Backend API: POST /api/auth/register                    │
  // │   └─ Success: Save token + userId, show success alert          │
  // │   └─ Failed: Fallback ke SQLite offline registration           │
  // └─────────────────────────────────────────────────────────────────────┘
  //
  // Kenapa 5 Validations?
  // - Better UX: Specific error messages
  // - Security: Prevent weak passwords
  // - Data integrity: Ensure complete data
  // - Reduce backend load: Client-side validation first
  // ================================================================================
  const handleRegister = async () => {
    // VALIDATION 1: All fields not empty
    // Check semua fields dengan trim() untuk remove whitespace
    // Guard clause pattern: return early if invalid
    if (!name.trim() || !username.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Semua field harus diisi');
      return; // Early return: empty fields
    }
    
    // VALIDATION 2: Username min 3 characters
    // Prevent username terlalu pendek
    // Example invalid: "ab", "x"
    if (username.length < 3) {
      Alert.alert('Error', 'Username minimal 3 karakter');
      return; // Early return: username too short
    }
    
    // VALIDATION 3: Password min 6 characters
    // Security requirement: prevent weak passwords
    // Example invalid: "12345", "abc"
    if (password.length < 6) {
      Alert.alert('Error', 'Password minimal 6 karakter');
      return; // Early return: password too short
    }
    
    // VALIDATION 4: Password match dengan confirmPassword
    // Prevent typo errors saat input password
    // User harus ketik password yang sama 2x
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Password dan konfirmasi password tidak sama');
      return; // Early return: password mismatch
    }

    // Semua validasi passed, proceed dengan registration
    // Set loading state untuk disable button & show spinner
    setLoading(true);

    try {
      console.log('📝 Attempting registration for:', username);
      
      // Kirim data registrasi ke backend
      const response = await apiService.register({ name, username, password });

      if (response?.user) {
        if (response.token) await AsyncStorage.setItem('token', response.token);
        if (response.user?.id) await AsyncStorage.setItem('userId', response.user.id.toString());
        Alert.alert('Berhasil', 'Akun berhasil dibuat! Silakan login.', [
          { text: 'OK', onPress: onRegisterSuccess },
        ]);
        return;
      } else if (response?.message) {
        Alert.alert('Gagal', response.message);
        return;
      }
      Alert.alert('Gagal', 'Registrasi gagal. Coba lagi.');

    } catch (error) { // catch menangkap semua error yang tidak tertangani di blok try
      // GLOBAL ERROR HANDLER
      console.error('\u274c Register error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat membuat akun');
    } finally { // finally selalu dijalankan baik ada error maupun tidak — cocok untuk reset state
      // FINALLY BLOCK: Always executed
      setLoading(false); // setLoading(false) mengaktifkan kembali tombol Daftar setelah proses selesai apapun hasilnya
    }
  };

  // ================================================================================
  // FUNCTION: handleNavigateToLogin
  // ================================================================================
  // Simple callback wrapper untuk navigate ke LoginScreen.
  // Call onNavigateToLogin prop yang diberikan dari parent (App.tsx).
  //
  // Use case:
  // - User tap "Sudah punya akun? Masuk di sini" link
  // - Navigate back to LoginScreen (user berubah pikiran, mau login instead)
  // ================================================================================
  const handleNavigateToLogin = () => { // const membuat variabel tetap; arrow function () => {} tanpa async; wrapper sederhana yang meneruskan panggilan ke props
    onNavigateToLogin(); // memanggil callback onNavigateToLogin dari App.tsx — menampilkan LoginScreen
  };

  // ================================================================================
  // RENDER: UI Components
  // ================================================================================
  // Render registration form dengan React Native components.
  //
  // Component Hierarchy:
  // <SafeAreaView>                          - Respect device safe area
  //   <KeyboardAvoidingView>                - Auto-adjust saat keyboard muncul
  //     <ScrollView>                        - Scrollable form (support small screens)
  //       <View style={content}>            - Main content container
  //         <Text>Daftar Akun</Text>        - Title
  //         <Text>Buat akun baru...</Text>  - Subtitle
  //         <View style={form}>             - Form container
  //           <TextInput name />            - Name input (autoCapitalize="words")
  //           <TextInput username />        - Username input
  //           <TextInput password />        - Password input (secure)
  //           <TextInput confirmPassword /> - Confirm password input (secure)
  //           <CustomButton />              - Register button (variant="secondary"=green)
  //           <TouchableOpacity>            - Login link (pressable)
  //             <Text>Sudah punya akun?     - Link text
  //
  // Differences dari LoginScreen:
  // - 4 TextInputs instead of 2
  // - ScrollView untuk handle long form
  // - CustomButton variant="secondary" (green) instead of "primary" (blue)
  // - More complex validation (5 checks)
  // - autoCapitalize="words" untuk name input (capitalize each word)
  // ================================================================================
  return ( // return mengembalikan JSX yang akan dirender ke layar
    <SafeAreaView style={styles.container}> {/* SafeAreaView memastikan konten tidak tertutup notch/status bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} // Platform.OS mengembalikan 'ios' atau 'android'; ternary operator memilih behavior yang tepat agar keyboard tidak menutupi input
        style={styles.keyboardView}
      >
        {/* ScrollView: memungkinkan form di-scroll saat keyboard muncul atau layar kecil */}
        <ScrollView contentContainerStyle={styles.scrollContainer}> {/* contentContainerStyle={flexGrow:1} memastikan konten bisa mengisi ruang penuh */}
          <View style={styles.content}>
            {/* Judul dan subtitle halaman registrasi */}
            <Text style={styles.title}>Daftar Akun</Text> {/* Text menampilkan judul; style={styles.title} mengatur ukuran dan warna teks */}
            <Text style={styles.subtitle}>Buat akun baru untuk menggunakan NFC Payment</Text>

            <View style={styles.form}> {/* View adalah container yang mengelompokkan semua field form */}
              {/* Input Nama: autoCapitalize="words" mengkapitalisasi setiap kata otomatis */}
              <TextInput
                style={styles.input}
                placeholder="Nama Lengkap" // placeholder teks abu-abu yang tampil saat field kosong
                placeholderTextColor="#95a5a6"
                value={name} // value={name} membuat TextInput menjadi controlled component — nilainya selalu sinkron dengan state
                onChangeText={setName} // onChangeText dipanggil setiap karakter berubah; setName memperbarui state name
                autoCapitalize="words" // autoCapitalize="words" otomatis mengkapitalisasi huruf pertama tiap kata
              />
              
              {/* Input Username: autoCapitalize="none" agar username tidak dikapitalisasi otomatis */}
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#95a5a6"
                value={username} // value={username} sinkron dengan state username
                onChangeText={setUsername} // setUsername dipanggil setiap perubahan karakter
                autoCapitalize="none" // autoCapitalize="none" menonaktifkan kapitalisasi otomatis untuk username
                autoComplete="username" // autoComplete="username" memberitahu OS agar menawarkan autofill username
              />
              
              {/* Input Password: secureTextEntry menyembunyikan teks menjadi titik-titik */}
              <TextInput
                style={styles.input}
                placeholder="Password (min. 6 karakter)"
                placeholderTextColor="#95a5a6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry // secureTextEntry (tanpa ={true}) secara default bernilai true — menyembunyikan karakter password
                autoComplete="password"
              />
              
              {/* Input Konfirmasi Password: harus sama dengan password */}
              <TextInput
                style={styles.input}
                placeholder="Konfirmasi Password"
                placeholderTextColor="#95a5a6"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry // sama dengan field password — menyembunyikan karakter
                autoComplete="password"
              />

              {/* Tombol Daftar: CustomButton dengan variant hijau; berubah menjadi disabled saat loading */}
              <CustomButton
                title={loading ? 'Membuat Akun...' : 'Daftar'} // ternary operator: jika loading=true tampilkan 'Membuat Akun...', jika false tampilkan 'Daftar'
                onPress={handleRegister} // onPress memanggil handleRegister saat tombol ditekan
                disabled={loading} // disabled={loading} menonaktifkan tombol saat sedang memproses untuk mencegah double submit
                loading={loading} // loading={true} menampilkan ActivityIndicator spinner di dalam tombol
                variant="secondary" // variant="secondary" membuat tombol berwarna hijau (berbeda dari login yang biru)
                size="large"
                style={styles.registerButton}
              />

              {/* Link ke LoginScreen: untuk user yang sudah punya akun */}
              <TouchableOpacity
                style={styles.loginLinkContainer}
                onPress={handleNavigateToLogin} // onPress memanggil handleNavigateToLogin yang memanggil callback onNavigateToLogin dari App.tsx
                activeOpacity={0.7} // activeOpacity=0.7 membuat tombol menjadi 70% transparan saat ditekan — umpan balik visual
              >
                <Text style={styles.loginLinkText}>
                  Sudah punya akun? Masuk di sini {/* teks link ke halaman login */}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ==================================================================================
// STYLES
// ==================================================================================
// StyleSheet.create() untuk type-safe styling.
// Design system sama dengan LoginScreen untuk consistency.
//
// Key Differences:
// - scrollContainer: flexGrow=1 untuk ScrollView (allow scrolling)
// - registerButton margin (same spacing pattern)
//
// Same as LoginScreen:
// - Color Palette: #f5f5f5, #2c3e50, #7f8c8d, #3498db
// - Typography: 32px title, 16px body
// - Spacing: 20px padding, 16px margin
// - Border Radius: 12px rounded corners
// - Shadows: subtle depth
// ==================================================================================