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
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomButton from '../components/CustomButton';
import { apiService } from '../utils/apiService';
import styles from './RegisterScreen.styles';

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
interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
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
  const [name, setName] = useState(''); // Awalnya kosong
  
  // STATE 2: username - Input username unik untuk login (contoh: "budi123")
  // Harus unique di database, divalidasi di backend
  const [username, setUsername] = useState(''); // Awalnya kosong
  
  // STATE 3: password - Input password yang akan di-hash di backend
  // Backend menggunakan bcrypt untuk hash (one-way encryption)
  const [password, setPassword] = useState(''); // Awalnya kosong
  
  // STATE 4: confirmPassword - Input konfirmasi password untuk validasi
  // Harus sama persis dengan password, mencegah typo user
  const [confirmPassword, setConfirmPassword] = useState(''); // Awalnya kosong
  
  // STATE 5: loading - Flag untuk disable tombol dan tampilkan spinner
  // true = tombol disabled, text berubah jadi "Membuat Akun..."
  // false = tombol aktif, text "Daftar"
  const [loading, setLoading] = useState(false); // Awalnya tidak loading

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

    } catch (error) {
      // GLOBAL ERROR HANDLER
      // Catch unexpected errors (bukan backend/offline errors)
      // Possible errors:
      // - AsyncStorage error
      // - Unexpected runtime error
      console.error('❌ Register error:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat membuat akun');
    } finally {
      // FINALLY BLOCK: Always executed
      // Reset loading state untuk unlock button
      // Important: Execute meski ada return di try block
      setLoading(false);
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
  const handleNavigateToLogin = () => {
    onNavigateToLogin();
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
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* ScrollView: Allow scrolling jika form panjang atau keyboard muncul */}
        {/* contentContainerStyle: flexGrow=1 untuk center content */}
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* App Title */}
            <Text style={styles.title}>Daftar Akun</Text>
            <Text style={styles.subtitle}>Buat akun baru untuk menggunakan NFC Payment</Text>

            <View style={styles.form}>
              {/* Name Input */}
              {/* autoCapitalize="words": Capitalize first letter of each word */}
              {/* Example: "john doe" → "John Doe" */}
              <TextInput
                style={styles.input}
                placeholder="Nama Lengkap"
                placeholderTextColor="#95a5a6"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              
              {/* Username Input */}
              {/* autoCapitalize="none": No auto-capitalize untuk username */}
              {/* autoComplete="username": OS suggestion untuk autofill */}
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#95a5a6"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
              />
              
              {/* Password Input */}
              {/* secureTextEntry: Mask password dengan bullets */}
              {/* Placeholder hint: "min. 6 karakter" */}
              <TextInput
                style={styles.input}
                placeholder="Password (min. 6 karakter)"
                placeholderTextColor="#95a5a6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
              
              {/* Confirm Password Input */}
              {/* Second password input untuk validation */}
              {/* Must match dengan password field */}
              <TextInput
                style={styles.input}
                placeholder="Konfirmasi Password"
                placeholderTextColor="#95a5a6"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="password"
              />

              {/* Register Button */}
              {/* variant="secondary": Green button (different dari login) */}
              {/* title: Change text saat loading */}
              {/* disabled & loading: Disable saat processing */}
              <CustomButton
                title={loading ? 'Membuat Akun...' : 'Daftar'}
                onPress={handleRegister}
                disabled={loading}
                loading={loading}
                variant="secondary"
                size="large"
                style={styles.registerButton}
              />

              {/* Login Link */}
              {/* Navigate back to LoginScreen */}
              <TouchableOpacity
                style={styles.loginLinkContainer}
                onPress={handleNavigateToLogin}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkText}>
                  Sudah punya akun? Masuk di sini
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