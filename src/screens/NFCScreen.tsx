// src/screens/NFCScreen.tsx
// ==================================================================================
// 💳 SCREEN: NFCScreen
// ==================================================================================
//
// Purpose:
// Main NFC payment screen untuk merchant/receiver terima pembayaran dari customer.
// Implement merchant payment flow: Input amount → Buyer tap card → Balance transfer.
//
// User Flow:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ MERCHANT (RECEIVER) FLOW:                                           │
// │                                                                     │
// │ 1. Merchant tap "💳 NFC Payment" di DashboardScreen                │
// │ 2. NFCScreen muncul                                                 │
// │ 3. System check NFC enabled:                                        │
// │    - Jika disabled: Show instruction screen (aktifkan NFC)         │
// │    - Jika enabled: Show payment form                               │
// │ 4. Merchant input jumlah pembayaran (e.g., Rp 50.000)              │
// │ 5. Merchant tap "Terima Pembayaran" button                          │
// │ 6. Alert muncul: "Scan Kartu Pembeli"                               │
// │ 7. Customer (buyer) dekatkan kartu NFC ke HP merchant              │
// │ 8. System baca UID kartu buyer                                      │
// │ 9. System validate buyer card (registered, active, balance cukup)  │
// │ 10. System ambil receiver card dari database (auto-detect)         │
// │ 11. System proses payment: buyer → merchant                         │
// │ 12. Backend jalankan Z-Score fraud detection                            │
// │ 13. Success alert dengan info transaksi                            │
// │ 14. Balance auto-refresh di screen                                 │
// │ 15. Form reset, ready untuk transaksi berikutnya                   │
// └─────────────────────────────────────────────────────────────────────┘
//
// Key Features:
//
// 1. NFC Hardware Check:
//    - Init NFC on screen mount
//    - Check NFC enabled/disabled
//    - Show instruction screen jika disabled
//    - Cleanup NFC on unmount (prevent memory leak)
//
// 2. Merchant Payment (Receive Money):
//    - Input amount dengan validation
//    - Use usePayment hook (processTapToPayTransfer)
//    - Merchant scan buyer card untuk receive payment
//    - Auto-transfer dari buyer balance → merchant balance
//
// 3. Amount Validation:
//    - Must be number > 0
//    - Tidak ada batasan minimum (fraud AI handle abnormal amounts)
//    - Parse float untuk handle decimal input
//
// 4. Real-time Balance Display:
//    - Show current merchant balance
//    - Auto-refresh after successful payment
//    - Fetch from backend API (getUserById)
//
// 5. Loading State:
//    - Disable button saat processing
//    - Show ActivityIndicator (spinner)
//    - Prevent double-tap during payment
//
// 6. User Guidance:
//    - Clear instructions: "Cara Terima Pembayaran"
//    - Step-by-step guide
//    - Visual feedback: emoji, colors
//
// State Management:
// - nfcEnabled: boolean - Status NFC hardware enabled/disabled
// - amount: string - Input jumlah pembayaran (controlled input)
// - currentBalance: number - Merchant balance terkini
// - isProcessing: boolean - Flag payment processing (dari usePayment hook)
//
// Hooks Used:
// - usePayment: Custom hook untuk payment logic
//   Returns: { isProcessing, processTapToPayTransfer }
// - useEffect: NFC initialization & cleanup
//
// Props:
// - user: Current user object (merchant)
// - onBack: Callback untuk navigate back ke DashboardScreen
//
// ==================================================================================

// ==================================================================================
// IMPORTS
// ==================================================================================
// React:
// - useState: State management (nfcEnabled, amount, currentBalance)
// - useEffect: Side effects (NFC init, cleanup)
//
// React Native Core:
// - View, Text: Basic UI components
// - TextInput: Amount input (numeric keyboard)
// - TouchableOpacity: Buttons (back, terima pembayaran)
// - ScrollView: Scrollable container
// - Alert: Confirmation dialogs
// - ActivityIndicator: Loading spinner
// - StyleSheet: Type-safe styling
//
// React Native Safe Area:
// - SafeAreaView: Respect device safe area
//
// Utils:
// - NFCService: NFC hardware management (init, check, cleanup)
//
// Hooks:
// - useNFCScanner: Custom hook untuk NFC scanning logic (not used di screen ini)
// - usePayment: Custom hook untuk payment processing
//
// API:
// - apiService: HTTP client untuk getUserById (balance refresh)
// ==================================================================================
import React, { useState, useEffect } from 'react';
// import digunakan untuk mengambil module; React adalah library utama React Native; useState membuat state lokal; useEffect menjalankan kode saat komponen mount atau update
import {
  // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View,
  // View adalah komponen container dasar React Native — setara div di HTML
  Text,
  // Text menampilkan teks
  TextInput,
  // TextInput adalah input teks — di sini digunakan untuk input nominal pembayaran dengan keyboard numerik
  TouchableOpacity,
  // TouchableOpacity adalah tombol interaktif yang tampak transparan saat ditekan
  Alert,
  // Alert menampilkan dialog popup native untuk konfirmasi dan error
  ScrollView,
  // ScrollView memungkinkan konten di-scroll jika melebihi tinggi layar
  ActivityIndicator
  // ActivityIndicator adalah spinner loading yang ditampilkan saat proses payment berlangsung
} from 'react-native';
// menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context';
// SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home indicator
import { NFCService } from '../utils/nfc';
// import NFCService dari utils/nfc.ts — service yang menangani inisialisasi hardware NFC, pembacaan kartu, dan cleanup resource
import { usePayment } from '../hooks/usePayment';
// import custom hook usePayment dari hooks/usePayment.ts — hook yang menyediakan logika inti pembayaran NFC (processTapToPayTransfer)
import { apiService } from '../utils/apiService';
// import apiService dari utils/apiService.ts — HTTP client Singleton untuk komunikasi dengan backend API
import styles from './NFCScreen.styles';
// import stylesheet dari file terpisah untuk menjaga kode komponen tetap bersih

// ==================================================================================
// TYPE DEFINITIONS
// ==================================================================================
// NFCScreenProps:
// - user: Current user object (merchant yang menerima pembayaran)
//   Properties: id, name, username, balance
// - onBack: Callback function untuk navigate back ke DashboardScreen
// ==================================================================================
interface NFCScreenProps {
  // interface adalah blueprint TypeScript untuk mendefinisikan struktur objek props yang diterima komponen NFCScreen
  user: any;
  // props user bertipe any (fleksibel) — berisi data user yang sedang login sebagai merchant (id, name, username, balance)
  onBack: () => void;
  // props onBack adalah callback function () => void (tidak menerima argumen, tidak mengembalikan nilai) — dipanggil untuk kembali ke DashboardScreen
}

// ==================================================================================
// COMPONENT: NFCScreen
// ==================================================================================
// Main NFC payment screen dengan merchant payment flow.
//
// PARAMS:
// @param user - Current user object (merchant)
// @param onBack - Callback untuk navigate back
// ==================================================================================
export default function NFCScreen({ user, onBack }: NFCScreenProps) {
  // export default mengekspor komponen sebagai ekspor utama file; function NFCScreen menerima props user dan onBack yang didefinisikan di NFCScreenProps
  // STATE 1: nfcEnabled - Flag untuk cek apakah hardware NFC aktif atau tidak
  // false = tampilkan layar instruksi "Aktifkan NFC"
  // true = tampilkan form pembayaran
  const [nfcEnabled, setNfcEnabled] = useState(false);
  // const membuat variabel tetap; useState(false) membuat state boolean; false berarti NFC dianggap tidak aktif sampai dicek; setNfcEnabled fungsi untuk memperbarui state ini
  
  // STATE 2: amount - Input jumlah uang yang akan diterima oleh merchant
  // Controlled component: value={amount} onChangeText={setAmount}
  // Nilai berupa string karena TextInput bekerja dengan string
  const [amount, setAmount] = useState('');
  // useState('') membuat state string kosong; setAmount dipanggil setiap kali user mengetik di TextInput
  
  // STATE 3: currentBalance - Saldo merchant yang ditampilkan di layar
  // Nilai awal dari props user, tapi akan di-update setelah transaksi berhasil
  // Digunakan untuk menampilkan "Saldo Anda: Rp xxx"
  const [currentBalance, setCurrentBalance] = useState(user?.balance || 0);
  // user?.balance menggunakan optional chaining — aman jika user undefined; || 0 adalah fallback jika balance null/undefined
  
  // HOOK: usePayment - Custom hook yang menyediakan logika pembayaran NFC
  // Returns dua hal penting:
  // - isProcessing: boolean untuk disable tombol saat proses payment berlangsung
  // - processTapToPayTransfer: function utama untuk memproses pembayaran
  const { isProcessing, processTapToPayTransfer } = usePayment();
  // const membuat variabel tetap; destructuring objek yang dikembalikan hook usePayment — mengambil dua property: isProcessing dan processTapToPayTransfer

  // ================================================================================
  // EFFECT: NFC Initialization & Cleanup
  // ================================================================================
  // Run on component mount:
  // 1. Check NFC hardware support & enabled status
  // 2. Set nfcEnabled state
  //
  // Cleanup on component unmount:
  // 1. Call NFCService.cleanup() untuk release NFC resources
  // 2. Prevent memory leak
  // 3. Important: NFC hardware must be released properly
  //
  // Dependencies: [] = run once on mount
  // ================================================================================
  useEffect(() => {
    // useEffect menjalankan kode saat komponen pertama kali mount; array kosong [] sebagai parameter kedua berarti efek hanya jalan SEKALI saat mount — tidak berulang saat re-render
    // Panggil checkNFC saat komponen pertama kali di-render
    checkNFC();
    // memanggil fungsi checkNFC() untuk mendeteksi status hardware NFC saat screen dibuka
    
    // Cleanup function yang dijalankan saat komponen di-unmount (dihapus dari layar)
    // Penting untuk melepas resource NFC agar tidak memory leak
    return () => {
      // return function di dalam useEffect adalah cleanup function — dijalankan saat komponen dihapus dari layar (unmount)
      NFCService.cleanup();
      // memanggil method cleanup() dari NFCService untuk melepas resource NFC hardware — mencegah memory leak dan error jika user berpindah screen
    };
  }, []);
  // array kosong [] berarti efek ini hanya berjalan SEKALI saat mount, tidak diulang

  // ================================================================================
  // FUNCTION: checkNFC
  // ================================================================================
  // Check NFC hardware support dan enabled status.
  //
  // FLOW:
  // 1. Call NFCService.initNFC() untuk init hardware
  //    - Returns true jika device support NFC
  //    - Returns false jika device tidak support NFC
  // 2. Jika supported, check apakah NFC enabled di settings
  // 3. Update nfcEnabled state
  //
  // Result:
  // - nfcEnabled = true: Show payment form
  // - nfcEnabled = false: Show instruction screen (aktifkan NFC)
  // ================================================================================
  const checkNFC = async () => {
    // const membuat variabel tetap; async menandai fungsi asynchronous karena mengakses hardware NFC
    // STEP 1: Inisialisasi hardware NFC dan cek apakah device support NFC
    const supported = await NFCService.initNFC();
    // await menunggu Promise dari NFCService.initNFC(); mengembalikan true jika device support NFC, false jika tidak
    
    if (supported) {
      // if memeriksa apakah device support NFC
      // STEP 2: Jika device support, cek apakah user sudah mengaktifkan NFC di pengaturan
      const enabled = await NFCService.checkNFCEnabled();
      // await NFCService.checkNFCEnabled() mengirim query ke OS untuk status NFC aktif/nonaktif
      setNfcEnabled(enabled);
      // setNfcEnabled memperbarui state; jika true = tampilkan form pembayaran, jika false = tampilkan layar instruksi
    }
    // Jika tidak support, nfcEnabled tetap false (nilai default)
  };

  // ================================================================================
  // FUNCTION: fetchBalance
  // ================================================================================
  // Refresh merchant balance dari backend after successful payment.
  //
  // Flow:
  // 1. API Call: GET /api/users/{userId}
  // 2. Extract balance dari response (handle 2 response formats)
  // 3. Update currentBalance state
  // 4. Display updated balance di UI
  //
  // Response Formats:
  // Format 1: { user: { balance: number } }
  // Format 2: { balance: number } (direct user object)
  //
  // Error Handling:
  // - Silent fail (no alert to user)
  // - Log error untuk debugging
  // - Balance akan refresh on next screen focus (DashboardScreen auto-refresh)
  //
  // Use Case:
  // - Called as onSuccess callback dari processTapToPayTransfer
  // - Update balance immediately after payment success
  // ================================================================================
  const fetchBalance = async () => {
    // fetchBalance async: mengambil saldo terkini dari backend; async karena HTTP request
    try {
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Panggil API untuk mendapatkan data user terbaru (termasuk balance)
      const response = await apiService.getUserById(user.id);
      // Request ke backend
      
      // Backend bisa return 2 format berbeda, kita handle keduanya
      // FORMAT 1: { user: { balance: 100000 } } - nested object
      if (response && response.user && typeof response.user.balance === 'number') {
        // memeriksa response, objek user, dan saldo bertipe number sebelum menggunakannya
        setCurrentBalance(response.user.balance);
        // Update state dengan balance baru
        console.log('✅ Balance refreshed:', response.user.balance);
        // Log untuk debugging
      } 
      // FORMAT 2: { balance: 100000 } - direct object
      else if (typeof response === 'object' && typeof response.balance === 'number') {
        // fallback: jika response langsung berupa objek dengan balance (format response alternatif dari API)
        setCurrentBalance(response.balance);
        // Update state
        console.log('✅ Balance refreshed (fallback):', response.balance);
        // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      } 
      // FORMAT TIDAK DIKENALI: log warning tapi tidak throw error
      else {
        // else: blok fallback ketika format response tidak sesuai kedua kondisi sebelumnya; sistem tetap berjalan meskipun format tidak dikenali
        console.warn('⚠️ Balance refresh: unexpected response structure', response);
        // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
      }
    } catch (error: any) {
      // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
      // Jika gagal refresh balance, tidak tampilkan alert ke user (silent fail)
      // Alasan: balance akan ter-update otomatis saat kembali ke Dashboard
      // Tidak perlu ganggu user dengan error yang tidak kritis
      console.error('❌ Failed to refresh balance:', error?.message || error);
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    }
  };

  // ================================================================================
  // FUNCTION: handleSendMoney (Actually RECEIVE money - naming misleading)
  // ================================================================================
  // Main handler untuk merchant receive payment dari customer.
  // Despite nama "SendMoney", ini adalah RECEIVE money flow.
  //
  // VALIDATION FLOW:
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ VALIDATION 1: User ID exists                                        │
  // │               └─ Must have valid logged-in user                     │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ VALIDATION 2: Amount is valid number                                │
  // │               └─ parseFloat(amount) must be > 0                     │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ VALIDATION 3: No minimum amount restriction                         │
  // │               └─ Fraud AI will detect abnormal amounts             │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ PAYMENT PROCESSING                                                  │
  // │   └─ Call processTapToPayTransfer (from usePayment hook)           │
  // │   └─ Pass: merchantId, amount, fetchBalance callback               │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ SUCCESS: Reset form for next transaction                            │
  // │          └─ Clear amount input                                      │
  // └─────────────────────────────────────────────────────────────────────┘
  //
  // IMPORTANT NOTE:
  // Function name "handleSendMoney" is misleading!
  // Actual flow: MERCHANT RECEIVES money from CUSTOMER
  // - Merchant input amount
  // - Customer tap card to merchant's phone
  // - Money transferred FROM customer TO merchant
  // - This is a RECEIVE operation, not SEND
  // ================================================================================
  const handleSendMoney = async () => {
    // const membuat variabel tetap; async karena proses pembayaran NFC melibatkan hardware dan HTTP request
    if (!user?.id) {
      // optional chaining (?.) aman jika user null; ! berarti tidak ada user ID yang valid
      Alert.alert('Error', 'User tidak valid. Silakan login ulang.');
      // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      return;
      // return menghentikan fungsi lebih awal
    }

    const amountNum = parseFloat(amount);
    // parseFloat() mengubah string ke bilangan desimal; contoh: '50000' -> 50000
    
    if (!amountNum || amountNum <= 0) {
      // !amountNum berarti NaN/0/null/undefined; <= 0 berarti angka negatif atau nol tidak valid
      Alert.alert('Error', 'Masukkan jumlah yang valid');
      // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      return;
      // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
    }

    // CATATAN: Tidak ada batasan minimum — sistem Z-Score Anomaly Detection akan mendeteksi jumlah abnormal

    const success = await processTapToPayTransfer(user.id, amountNum, fetchBalance);
    // await menunggu proses pembayaran selesai; processTapToPayTransfer dari usePayment hook melakukan: scan NFC → validasi kartu → proses transfer → deteksi fraud Z-Score
    
    if (success) {
      // if memeriksa apakah transaksi berhasil
      setAmount('');
      // setAmount('') mengosongkan kembali input amount untuk transaksi berikutnya
    }
  };

  // ================================================================================
  // EARLY RETURN: NFC Disabled Screen
  // ================================================================================
  // Jika NFC tidak enabled, show instruction screen instead of payment form.
  //
  // Screen Purpose:
  // - Inform user NFC is required
  // - Provide step-by-step instructions to enable NFC
  // - Allow user to go back to DashboardScreen
  //
  // Design:
  // - Center-aligned content
  // - Clear error message: "📡 NFC Tidak Aktif"
  // - Numbered instructions (1-4 steps)
  // - Back button untuk return to dashboard
  //
  // Why Early Return?
  // - Guard clause pattern: handle edge cases first
  // - Prevent rendering payment form when unusable
  // - Better UX: Clear error state with actionable instructions
  // ================================================================================
  if (!nfcEnabled) {
    // if memeriksa kondisi; !nfcEnabled berarti NFC tidak aktif atau tidak didukung; early return menampilkan layar instruksi sebagai pengganti form pembayaran
    return (
    // return mengembalikan UI alternatif — early return pattern
      <SafeAreaView style={styles.container}> {/* SafeAreaView: padding aman dari notch dan status bar */}
        <View style={styles.centerContent}> {/* View: container konten yang ditengahkan secara vertikal dan horizontal */}
          <Text style={styles.errorIcon}>📲</Text> {/* Text: ikon emoji smartphone dengan gelombang sinyal */}
          
          <Text style={styles.errorTitle}>NFC Tidak Aktif</Text> {/* Text: judul pesan error NFC tidak aktif */}
          
          <Text style={styles.infoText}> {/* Text: kalimat penjelasan langkah mengaktifkan NFC */}
            Untuk menggunakan pembayaran NFC, aktifkan NFC di HP Anda:
          </Text>
          <View style={styles.instructionBox}> {/* View: kotak instruksi berwarna dengan langkah-langkah aktivasi NFC */}
            <Text style={styles.instructionText}> {/* Text: daftar langkah mengaktifkan NFC yang dipisahkan \n */}
              1. Buka Pengaturan HP{'{\n}'}
              2. Cari menu "Koneksi Perangkat" atau "NFC"{'{\n}'}
              3. Aktifkan toggle NFC{'{\n}'}
              4. Kembali ke aplikasi ini
            </Text>
          </View>
          
          <TouchableOpacity style={styles.backButton} onPress={onBack}> {/* TouchableOpacity tombol Kembali; onPress memanggil onBack dari props untuk kembali ke DashboardScreen */}
            <Text style={styles.backButtonText}>Kembali</Text> {/* Text label tombol Kembali */}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ================================================================================
  // RENDER: Main Payment Screen
  // ================================================================================
  // Render payment form dengan merchant flow.
  //
  // Screen Structure:
  // <SafeAreaView>                       - Safe area container
  //   <Header>                           - Back button + Title
  //     <TouchableOpacity onBack>        - Back to DashboardScreen
  //     <Text>💳 NFC Payment</Text>      - Screen title
  //   <ScrollView>                       - Scrollable content
  //     <UserCard>                       - Merchant info + balance
  //     <InstructionCard>                - Step-by-step guide
  //     <InputCard>                      - Amount input field
  //     <ActionButton>                   - "Terima Pembayaran" button
  //
  // Component Breakdown:
  //
  // 1. HEADER:
  //    - Back button (← Kembali)
  //    - Title (💳 NFC Payment)
  //    - Empty spacer untuk symmetry
  //
  // 2. USER CARD:
  //    - Display merchant name
  //    - Display current balance (formatted Rupiah)
  //    - White card dengan shadow
  //
  // 3. INSTRUCTION CARD:
  //    - Blue background card
  //    - Title: "📖 Cara Terima Pembayaran:"
  //    - 5-step numbered instructions
  //    - Help user understand the flow
  //
  // 4. INPUT CARD:
  //    - Label: "💰 Jumlah Pembayaran:"
  //    - TextInput dengan numeric keyboard
  //    - Hint: "Masukkan jumlah (contoh: 19456)"
  //    - Controlled input: value={amount} onChangeText={setAmount}
  //    - Disabled saat isProcessing
  //
  // 5. ACTION BUTTON:
  //    - "Terima Pembayaran" button (green)
  //    - Loading state: Show ActivityIndicator + "Processing..."
  //    - Disabled jika: !amount || isProcessing
  //    - onPress: handleSendMoney
  // ================================================================================
  return (
  // return JSX utama — form pembayaran yang tampil saat NFC aktif
    <SafeAreaView style={styles.container}> {/* SafeAreaView: container aman dari area notch */}
      <View style={styles.header}> {/* View header: baris atas berisi tombol kembali, judul, dan spacer */}
        <TouchableOpacity onPress={onBack}> {/* TouchableOpacity tombol kembali; onPress memanggil onBack untuk kembali ke Dashboard */}
          <Text style={styles.backText}>← Kembali</Text> {/* Text panah kiri dengan teks Kembali */}
        </TouchableOpacity>
        
        <Text style={styles.title}>💳 NFC Payment</Text> {/* Text judul screen ditengah header */}
        <View style={styles.headerSpacerLarge} /> {/* View spacer transparan untuk menyeimbangkan layout header */}
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}> {/* ScrollView konten utama; contentContainerStyle untuk padding dalam container */}
        <View style={styles.userCard}> {/* View kartu info merchant: nama dan saldo */}
          <Text style={styles.userName}>👤 {user?.name}</Text> {/* Text nama user/merchant dengan ikon; optional chaining (?.) aman jika user null */}
          <Text style={styles.userBalance}> {/* Text saldo merchant saat ini */}
            Balance: Rp {currentBalance?.toLocaleString('id-ID') || '0'} {/* toLocaleString format angka dengan titik ribuan; || '0' fallback */}
          </Text>
        </View>
        <View style={styles.instructionCard}> {/* View kartu instruksi biru berisi panduan langkah-langkah pembayaran */}
          <Text style={styles.instructionTitle}>📖 Cara Terima Pembayaran:</Text> {/* Text judul kartu instruksi */}
          <Text style={styles.instructionText}> {/* Text daftar langkah cara menerima pembayaran NFC */}
            1. Masukkan jumlah pembayaran{'{\n}'}
            2. Tekan tombol "Terima Pembayaran"{'{\n}'}
            3. Pembeli tempelkan kartu NFC ke HP Anda{'{\n}'}
            4. Saldo Anda otomatis bertambah! ✅{'{\n}'}
            5. Saldo pembeli otomatis berkurang! ✅
          </Text>
        </View>
        <View style={styles.inputCard}> {/* View kartu input nominal pembayaran */}
          <Text style={styles.inputLabel}>💰 Jumlah Pembayaran:</Text> {/* Text label kolom input nominal */}
          
          <TextInput
          // TextInput: kolom input teks; setara dengan input di HTML; mendukung keyboard native
            style={styles.input}
            // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
            placeholder="Contoh: 50000"
            // placeholder: teks abu-abu yang ditampilkan dalam TextInput saat belum ada input dari user
            keyboardType="numeric"
            // keyboardType: menentukan jenis keyboard yang muncul; email-address, numeric, dll
            value={amount}
            // value={} mengikat nilai input ke state; membuat TextInput menjadi controlled component
            onChangeText={setAmount}
            // onChangeText dipanggil setiap user mengetik; parameter berisi teks terbaru; digunakan untuk update state
            editable={!isProcessing}
            // editable: jika false TextInput tidak bisa diedit oleh user; untuk tampilan read-only
          />
          
          <Text style={styles.inputHint}>Masukkan jumlah (contoh: 19456)</Text> {/* Text hint di bawah input sebagai panduan format input */}
        </View>
        <TouchableOpacity
        // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
          style={[
          // style={} prop untuk menerapkan styling ke elemen React Native
            styles.actionButton,
            styles.sendButton,
            // sendButton memberikan warna hijau pada tombol
            (!amount || isProcessing) && styles.disabledButton
            // conditional style: && menambahkan style disabled jika kondisi benar
          ]}
          onPress={handleSendMoney}
          // onPress dipanggil saat user menekan elemen; menghubungkan event ke fungsi handler
          disabled={!amount || isProcessing}
          // disabled: jika true tombol tidak bisa ditekan; digunakan saat loading atau form belum lengkap
        >
          {isProcessing ? (
          // ternary operator: jika isProcessing=true tampilkan spinner, jika false tampilkan teks normal
            <> {/* Fragment: wrapper tanpa elemen DOM tambahan; diperlukan saat render multiple children */}
              <ActivityIndicator color="white" /> {/* ActivityIndicator: spinner animasi loading putih */}
              <Text style={styles.actionButtonText}>  Processing...</Text> {/* Text teks sedang memproses */}
            </>
          ) : (
          // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
            <> {/* Fragment untuk membungkus dua Text tanpa View tambahan */}
              <Text style={styles.actionButtonText}>💵 Terima Pembayaran</Text> {/* Text teks utama tombol */}
              <Text style={styles.actionButtonSubtext}> {/* Text teks kecil di bawah judul tombol */}
                Pembeli akan tap kartu ke HP Anda
              </Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
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
//   * Cards: white (#fff) dengan shadow
//   * Primary: #3498db (blue)
//   * Success: #27ae60 (green)
//   * Error: #e74c3c (red)
//   * Info: #2196f3 (blue)
//   * Warning: #f39c12 (orange)
//
// - Card Styles:
//   * Border radius: 12px (rounded)
//   * Padding: 20px
//   * Shadow: subtle depth (elevation: 3)
//   * Left border accent untuk instruction cards
//
// - Button Styles:
//   * Large padding: 18px
//   * Border radius: 12px
//   * Shadow depth
//   * Color coding: blue (scan), green (receive), purple (send)
//   * Disabled state: gray with opacity
//
// - Typography:
//   * Title: 20px bold
//   * Card title: 16-18px bold
//   * Body: 14-16px normal
//   * Hint: 12px gray
// ==================================================================================
