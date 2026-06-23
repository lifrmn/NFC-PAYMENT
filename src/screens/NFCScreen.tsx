// src/screens/NFCScreen.tsx
/* ==================================================================================
 * 💳 SCREEN: NFCScreen
 * ==================================================================================
 * 
 * Purpose:
 * Main NFC payment screen untuk merchant/receiver terima pembayaran dari customer.
 * Implement merchant payment flow: Input amount → Buyer tap card → Balance transfer.
 * 
 * User Flow:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ MERCHANT (RECEIVER) FLOW:                                           │
 * │                                                                     │
 * │ 1. Merchant tap "💳 NFC Payment" di DashboardScreen                │
 * │ 2. NFCScreen muncul                                                 │
 * │ 3. System check NFC enabled:                                        │
 * │    - Jika disabled: Show instruction screen (aktifkan NFC)         │
 * │    - Jika enabled: Show payment form                               │
 * │ 4. Merchant input jumlah pembayaran (e.g., Rp 50.000)              │
 * │ 5. Merchant tap "Terima Pembayaran" button                          │
 * │ 6. Alert muncul: "Scan Kartu Pembeli"                               │
 * │ 7. Customer (buyer) dekatkan kartu NFC ke HP merchant              │
 * │ 8. System baca UID kartu buyer                                      │
 * │ 9. System validate buyer card (registered, active, balance cukup)  │
 * │ 10. System ambil receiver card dari database (auto-detect)         │
 * │ 11. System proses payment: buyer → merchant                         │
 * │ 12. Backend jalankan Z-Score fraud detection                            │
 * │ 13. Success alert dengan info transaksi                            │
 * │ 14. Balance auto-refresh di screen                                 │
 * │ 15. Form reset, ready untuk transaksi berikutnya                   │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * Key Features:
 * 
 * 1. NFC Hardware Check:
 *    - Init NFC on screen mount
 *    - Check NFC enabled/disabled
 *    - Show instruction screen jika disabled
 *    - Cleanup NFC on unmount (prevent memory leak)
 * 
 * 2. Merchant Payment (Receive Money):
 *    - Input amount dengan validation
 *    - Use usePayment hook (processTapToPayTransfer)
 *    - Merchant scan buyer card untuk receive payment
 *    - Auto-transfer dari buyer balance → merchant balance
 * 
 * 3. Amount Validation:
 *    - Must be number > 0
 *    - Tidak ada batasan minimum (fraud AI handle abnormal amounts)
 *    - Parse float untuk handle decimal input
 * 
 * 4. Real-time Balance Display:
 *    - Show current merchant balance
 *    - Auto-refresh after successful payment
 *    - Fetch from backend API (getUserById)
 * 
 * 5. Loading State:
 *    - Disable button saat processing
 *    - Show ActivityIndicator (spinner)
 *    - Prevent double-tap during payment
 * 
 * 6. User Guidance:
 *    - Clear instructions: "Cara Terima Pembayaran"
 *    - Step-by-step guide
 *    - Visual feedback: emoji, colors
 * 
 * State Management:
 * - nfcEnabled: boolean - Status NFC hardware enabled/disabled
 * - amount: string - Input jumlah pembayaran (controlled input)
 * - currentBalance: number - Merchant balance terkini
 * - isProcessing: boolean - Flag payment processing (dari usePayment hook)
 * 
 * Hooks Used:
 * - usePayment: Custom hook untuk payment logic
 *   Returns: { isProcessing, processTapToPayTransfer }
 * - useEffect: NFC initialization & cleanup
 * 
 * Props:
 * - user: Current user object (merchant)
 * - onBack: Callback untuk navigate back ke DashboardScreen
 * 
 * ==================================================================================
 */

/* ==================================================================================
 * IMPORTS
 * ==================================================================================
 * React:
 * - useState: State management (nfcEnabled, amount, currentBalance)
 * - useEffect: Side effects (NFC init, cleanup)
 * 
 * React Native Core:
 * - View, Text: Basic UI components
 * - TextInput: Amount input (numeric keyboard)
 * - TouchableOpacity: Buttons (back, terima pembayaran)
 * - ScrollView: Scrollable container
 * - Alert: Confirmation dialogs
 * - ActivityIndicator: Loading spinner
 * - StyleSheet: Type-safe styling
 * 
 * React Native Safe Area:
 * - SafeAreaView: Respect device safe area
 * 
 * Utils:
 * - NFCService: NFC hardware management (init, check, cleanup)
 * 
 * Hooks:
 * - useNFCScanner: Custom hook untuk NFC scanning logic (not used di screen ini)
 * - usePayment: Custom hook untuk payment processing
 * 
 * API:
 * - apiService: HTTP client untuk getUserById (balance refresh)
 * ==================================================================================
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NFCService } from '../utils/nfc';
import { usePayment } from '../hooks/usePayment';
import { apiService } from '../utils/apiService';
import styles from './NFCScreen.styles';

/* ==================================================================================
 * TYPE DEFINITIONS
 * ==================================================================================
 * NFCScreenProps:
 * - user: Current user object (merchant yang menerima pembayaran)
 *   Properties: id, name, username, balance
 * - onBack: Callback function untuk navigate back ke DashboardScreen
 * ==================================================================================
 */
interface NFCScreenProps {
  user: any;
  onBack: () => void;
}

/* ==================================================================================
 * COMPONENT: NFCScreen
 * ==================================================================================
 * Main NFC payment screen dengan merchant payment flow.
 * 
 * PARAMS:
 * @param user - Current user object (merchant)
 * @param onBack - Callback untuk navigate back
 * ==================================================================================
 */
export default function NFCScreen({ user, onBack }: NFCScreenProps) {
  // STATE 1: nfcEnabled - Flag untuk cek apakah hardware NFC aktif atau tidak
  // false = tampilkan layar instruksi "Aktifkan NFC"
  // true = tampilkan form pembayaran
  const [nfcEnabled, setNfcEnabled] = useState(false); // Asumsi awal: disabled
  
  // STATE 2: amount - Input jumlah uang yang akan diterima oleh merchant
  // Controlled component: value={amount} onChangeText={setAmount}
  // Nilai berupa string karena TextInput bekerja dengan string
  const [amount, setAmount] = useState(''); // Awalnya kosong
  
  // STATE 3: currentBalance - Saldo merchant yang ditampilkan di layar
  // Nilai awal dari props user, tapi akan di-update setelah transaksi berhasil
  // Digunakan untuk menampilkan "Saldo Anda: Rp xxx"
  const [currentBalance, setCurrentBalance] = useState(user?.balance || 0); // Fallback ke 0 jika undefined
  
  // HOOK: usePayment - Custom hook yang menyediakan logika pembayaran NFC
  // Returns dua hal penting:
  // - isProcessing: boolean untuk disable tombol saat proses payment berlangsung
  // - processTapToPayTransfer: function utama untuk memproses pembayaran
  const { isProcessing, processTapToPayTransfer } = usePayment(); // Destructuring object

  /* ================================================================================
   * EFFECT: NFC Initialization & Cleanup
   * ================================================================================
   * Run on component mount:
   * 1. Check NFC hardware support & enabled status
   * 2. Set nfcEnabled state
   * 
   * Cleanup on component unmount:
   * 1. Call NFCService.cleanup() untuk release NFC resources
   * 2. Prevent memory leak
   * 3. Important: NFC hardware must be released properly
   * 
   * Dependencies: [] = run once on mount
   * ================================================================================
   */
  useEffect(() => {
    // Panggil checkNFC saat komponen pertama kali di-render
    checkNFC(); // Cek apakah NFC supported dan enabled
    
    // Cleanup function yang dijalankan saat komponen di-unmount (dihapus dari layar)
    // Penting untuk melepas resource NFC agar tidak memory leak
    return () => {
      NFCService.cleanup(); // Bersihkan resource NFC hardware
    };
  }, []); // Array kosong = hanya jalan sekali saat mount

  /* ================================================================================
   * FUNCTION: checkNFC
   * ================================================================================
   * Check NFC hardware support dan enabled status.
   * 
   * FLOW:
   * 1. Call NFCService.initNFC() untuk init hardware
   *    - Returns true jika device support NFC
   *    - Returns false jika device tidak support NFC
   * 2. Jika supported, check apakah NFC enabled di settings
   * 3. Update nfcEnabled state
   * 
   * Result:
   * - nfcEnabled = true: Show payment form
   * - nfcEnabled = false: Show instruction screen (aktifkan NFC)
   * ================================================================================
   */
  const checkNFC = async () => {
    // STEP 1: Inisialisasi hardware NFC dan cek apakah device support NFC
    // Returns true jika support, false jika tidak
    const supported = await NFCService.initNFC(); // Async karena akses hardware
    
    if (supported) {
      // STEP 2: Jika device support, cek apakah user sudah mengaktifkan NFC di pengaturan
      // Bisa saja device support tapi NFC dimatikan oleh user
      const enabled = await NFCService.checkNFCEnabled(); // Cek status enabled/disabled
      setNfcEnabled(enabled); // Update state UI
    }
    // Jika tidak support, nfcEnabled tetap false (nilai default)
  };

  /* ================================================================================
   * FUNCTION: fetchBalance
   * ================================================================================
   * Refresh merchant balance dari backend after successful payment.
   * 
   * Flow:
   * 1. API Call: GET /api/users/{userId}
   * 2. Extract balance dari response (handle 2 response formats)
   * 3. Update currentBalance state
   * 4. Display updated balance di UI
   * 
   * Response Formats:
   * Format 1: { user: { balance: number } }
   * Format 2: { balance: number } (direct user object)
   * 
   * Error Handling:
   * - Silent fail (no alert to user)
   * - Log error untuk debugging
   * - Balance akan refresh on next screen focus (DashboardScreen auto-refresh)
   * 
   * Use Case:
   * - Called as onSuccess callback dari processTapToPayTransfer
   * - Update balance immediately after payment success
   * ================================================================================
   */
  const fetchBalance = async () => {
    try {
      // Panggil API untuk mendapatkan data user terbaru (termasuk balance)
      const response = await apiService.getUserById(user.id); // Request ke backend
      
      // Backend bisa return 2 format berbeda, kita handle keduanya
      // FORMAT 1: { user: { balance: 100000 } } - nested object
      if (response && response.user && typeof response.user.balance === 'number') {
        setCurrentBalance(response.user.balance); // Update state dengan balance baru
        console.log('✅ Balance refreshed:', response.user.balance); // Log untuk debugging
      } 
      // FORMAT 2: { balance: 100000 } - direct object
      else if (typeof response === 'object' && typeof response.balance === 'number') {
        setCurrentBalance(response.balance); // Update state
        console.log('✅ Balance refreshed (fallback):', response.balance);
      } 
      // FORMAT TIDAK DIKENALI: log warning tapi tidak throw error
      else {
        console.warn('⚠️ Balance refresh: unexpected response structure', response);
      }
    } catch (error: any) {
      // Jika gagal refresh balance, tidak tampilkan alert ke user (silent fail)
      // Alasan: balance akan ter-update otomatis saat kembali ke Dashboard
      // Tidak perlu ganggu user dengan error yang tidak kritis
      console.error('❌ Failed to refresh balance:', error?.message || error);
    }
  };

  /* ================================================================================
   * FUNCTION: handleSendMoney (Actually RECEIVE money - naming misleading)
   * ================================================================================
   * Main handler untuk merchant receive payment dari customer.
   * Despite nama "SendMoney", ini adalah RECEIVE money flow.
   * 
   * VALIDATION FLOW:
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ VALIDATION 1: User ID exists                                        │
   * │               └─ Must have valid logged-in user                     │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ VALIDATION 2: Amount is valid number                                │
   * │               └─ parseFloat(amount) must be > 0                     │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ VALIDATION 3: No minimum amount restriction                         │
   * │               └─ Fraud AI will detect abnormal amounts             │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ PAYMENT PROCESSING                                                  │
   * │   └─ Call processTapToPayTransfer (from usePayment hook)           │
   * │   └─ Pass: merchantId, amount, fetchBalance callback               │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ SUCCESS: Reset form for next transaction                            │
   * │          └─ Clear amount input                                      │
   * └─────────────────────────────────────────────────────────────────────┘
   * 
   * IMPORTANT NOTE:
   * Function name "handleSendMoney" is misleading!
   * Actual flow: MERCHANT RECEIVES money from CUSTOMER
   * - Merchant input amount
   * - Customer tap card to merchant's phone
   * - Money transferred FROM customer TO merchant
   * - This is a RECEIVE operation, not SEND
   * ================================================================================
   */
  const handleSendMoney = async () => {
    // VALIDASI 1: Pastikan user sudah login dan punya ID yang valid
    // Operator ?. = optional chaining, cek property hanya jika object tidak null
    if (!user?.id) {
      Alert.alert('Error', 'User tidak valid. Silakan login ulang.'); // Alert native
      return; // Stop proses jika user invalid
    }

    // VALIDASI 2: Convert input string menjadi angka dan cek validitasnya
    // parseFloat mengubah "50000" (string) menjadi 50000 (number)
    // Bisa handle desimal: "50000.50" → 50000.50
    const amountNum = parseFloat(amount); // Parse string ke float
    
    // Cek apakah hasil parsing valid dan lebih dari 0
    // !amountNum akan true jika: NaN, 0, null, atau undefined
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Error', 'Masukkan jumlah yang valid'); // Pesan error
      return; // Stop proses
    }

    // CATATAN PENTING: Tidak ada batasan minimum jumlah transfer
    // Sistem Z-Score Based Anomaly Detection akan mendeteksi jumlah yang tidak normal
    // Algoritma menganalisis 20 transaksi historis untuk mendeteksi pola anomali

    // PAYMENT PROCESSING
    // Call processTapToPayTransfer dari usePayment hook
    // Parameters:
    // - user.id: Merchant ID (receiver/penjual)
    // - amountNum: Payment amount in Rupiah
    // - fetchBalance: Callback untuk refresh balance after success
    // 
    // processTapToPayTransfer akan:
    // 1. Show alert "Scan Kartu Pembeli"
    // 2. Read buyer card UID
    // 3. Validate buyer card
    // 4. Get merchant card (auto-detect dari database)
    // 5. Process payment: buyer → merchant
    // 6. Z-Score fraud detection (Z≤2 ALLOW | 2<Z≤3 REVIEW | Z>3 BLOCK)
    // 7. Show success/error alert
    // 8. Call fetchBalance() if success
    const success = await processTapToPayTransfer(user.id, amountNum, fetchBalance);
    
    // SUCCESS: Reset form untuk next transaction
    if (success) {
      setAmount(''); // Clear amount input
      // currentBalance sudah updated oleh fetchBalance callback
    }
    // Jika failed, amount tetap di input (user bisa retry)
  };

  /* ================================================================================
   * EARLY RETURN: NFC Disabled Screen
   * ================================================================================
   * Jika NFC tidak enabled, show instruction screen instead of payment form.
   * 
   * Screen Purpose:
   * - Inform user NFC is required
   * - Provide step-by-step instructions to enable NFC
   * - Allow user to go back to DashboardScreen
   * 
   * Design:
   * - Center-aligned content
   * - Clear error message: "📡 NFC Tidak Aktif"
   * - Numbered instructions (1-4 steps)
   * - Back button untuk return to dashboard
   * 
   * Why Early Return?
   * - Guard clause pattern: handle edge cases first
   * - Prevent rendering payment form when unusable
   * - Better UX: Clear error state with actionable instructions
   * ================================================================================
   */
  if (!nfcEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          {/* Error Icon - Mobile dengan NFC */}
          <Text style={styles.errorIcon}>📲</Text>
          
          {/* Error Message */}
          <Text style={styles.errorTitle}>NFC Tidak Aktif</Text>
          
          {/* Info Text */}
          <Text style={styles.infoText}>
            Untuk menggunakan pembayaran NFC, aktifkan NFC di HP Anda:
          </Text>
          
          {/* Step-by-step Instructions */}
          {/* instructionBox: White box dengan left border accent */}
          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              1. Buka Pengaturan HP{'\n'}
              2. Cari menu "Koneksi Perangkat" atau "NFC"{'\n'}
              3. Aktifkan toggle NFC{'\n'}
              4. Kembali ke aplikasi ini
            </Text>
          </View>
          
          {/* Back Button */}
          {/* Navigate back to DashboardScreen */}
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ================================================================================
   * RENDER: Main Payment Screen
   * ================================================================================
   * Render payment form dengan merchant flow.
   * 
   * Screen Structure:
   * <SafeAreaView>                       - Safe area container
   *   <Header>                           - Back button + Title
   *     <TouchableOpacity onBack>        - Back to DashboardScreen
   *     <Text>💳 NFC Payment</Text>      - Screen title
   *   <ScrollView>                       - Scrollable content
   *     <UserCard>                       - Merchant info + balance
   *     <InstructionCard>                - Step-by-step guide
   *     <InputCard>                      - Amount input field
   *     <ActionButton>                   - "Terima Pembayaran" button
   * 
   * Component Breakdown:
   * 
   * 1. HEADER:
   *    - Back button (← Kembali)
   *    - Title (💳 NFC Payment)
   *    - Empty spacer untuk symmetry
   * 
   * 2. USER CARD:
   *    - Display merchant name
   *    - Display current balance (formatted Rupiah)
   *    - White card dengan shadow
   * 
   * 3. INSTRUCTION CARD:
   *    - Blue background card
   *    - Title: "📖 Cara Terima Pembayaran:"
   *    - 5-step numbered instructions
   *    - Help user understand the flow
   * 
   * 4. INPUT CARD:
   *    - Label: "💰 Jumlah Pembayaran:"
   *    - TextInput dengan numeric keyboard
   *    - Hint: "Masukkan jumlah (contoh: 19456)"
   *    - Controlled input: value={amount} onChangeText={setAmount}
   *    - Disabled saat isProcessing
   * 
   * 5. ACTION BUTTON:
   *    - "Terima Pembayaran" button (green)
   *    - Loading state: Show ActivityIndicator + "Processing..."
   *    - Disabled jika: !amount || isProcessing
   *    - onPress: handleSendMoney
   * ================================================================================
   */
  return (
    <SafeAreaView style={styles.container}>
      {/* ===== HEADER SECTION ===== */}
      {/* Flexbox row: back button | title | spacer */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        
        {/* Screen Title */}
        <Text style={styles.title}>💳 NFC Payment</Text>
        
        {/* Empty Spacer (untuk symmetry dengan back button) */}
        <View style={styles.headerSpacerLarge} />
      </View>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* ===== USER INFO CARD ===== */}
        {/* Display merchant name dan current balance */}
        <View style={styles.userCard}>
          <Text style={styles.userName}>👤 {user?.name}</Text>
          <Text style={styles.userBalance}>
            Balance: Rp {currentBalance?.toLocaleString('id-ID') || '0'}
          </Text>
        </View>

        {/* ===== INSTRUCTION CARD ===== */}
        {/* Blue card dengan step-by-step guide untuk merchant */}
        {/* Help user understand payment flow */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>📖 Cara Terima Pembayaran:</Text>
          <Text style={styles.instructionText}>
            1. Masukkan jumlah pembayaran{'\n'}
            2. Tekan tombol "Terima Pembayaran"{'\n'}
            3. Pembeli tempelkan kartu NFC ke HP Anda{'\n'}
            4. Saldo Anda otomatis bertambah! ✅{'\n'}
            5. Saldo pembeli otomatis berkurang! ✅
          </Text>
        </View>

        {/* ===== AMOUNT INPUT CARD ===== */}
        {/* White card dengan amount input field */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>💰 Jumlah Pembayaran:</Text>
          
          {/* Controlled TextInput untuk amount */}
          {/* keyboardType="numeric": Show number keyboard */}
          {/* editable={!isProcessing}: Disable saat processing */}
          <TextInput
            style={styles.input}
            placeholder="Contoh: 50000"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            editable={!isProcessing}
          />
          
          {/* Hint text: flexible amount */}
          <Text style={styles.inputHint}>Masukkan jumlah (contoh: 19456)</Text>
        </View>

        {/* ===== ACTION BUTTON: TERIMA PEMBAYARAN ===== */}
        {/* Green button untuk start payment flow */}
        {/* Conditional styling: disabled state jika !amount || isProcessing */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.sendButton, // Green color
            (!amount || isProcessing) && styles.disabledButton // Gray when disabled
          ]}
          onPress={handleSendMoney}
          disabled={!amount || isProcessing}
        >
          {/* LOADING STATE: Show spinner + "Processing..." */}
          {isProcessing ? (
            <>
              <ActivityIndicator color="white" />
              <Text style={styles.actionButtonText}>  Processing...</Text>
            </>
          ) : (
            /* NORMAL STATE: Show button text */
            <>
              <Text style={styles.actionButtonText}>💵 Terima Pembayaran</Text>
              <Text style={styles.actionButtonSubtext}>
                Pembeli akan tap kartu ke HP Anda
              </Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ==================================================================================
 * STYLES
 * ==================================================================================
 * StyleSheet.create() untuk type-safe styling.
 * 
 * Design System:
 * - Color Palette:
 *   * Background: #f5f5f5 (light gray)
 *   * Cards: white (#fff) dengan shadow
 *   * Primary: #3498db (blue)
 *   * Success: #27ae60 (green)
 *   * Error: #e74c3c (red)
 *   * Info: #2196f3 (blue)
 *   * Warning: #f39c12 (orange)
 * 
 * - Card Styles:
 *   * Border radius: 12px (rounded)
 *   * Padding: 20px
 *   * Shadow: subtle depth (elevation: 3)
 *   * Left border accent untuk instruction cards
 * 
 * - Button Styles:
 *   * Large padding: 18px
 *   * Border radius: 12px
 *   * Shadow depth
 *   * Color coding: blue (scan), green (receive), purple (send)
 *   * Disabled state: gray with opacity
 * 
 * - Typography:
 *   * Title: 20px bold
 *   * Card title: 16-18px bold
 *   * Body: 14-16px normal
 *   * Hint: 12px gray
 * ==================================================================================
 */