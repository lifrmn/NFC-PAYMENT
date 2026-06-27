// src/hooks/useNFCScanner.ts
// ==================================================================================
// 🪝 HOOK KUSTOM: useNFCScanner
// ==================================================================================
//
// Tujuan Hook:
// Hook React kustom untuk menangani pemindaian kartu NFC dan logika validasi.
// Memisahkan business logic dari UI components untuk better code organization.
//
// Apa itu Hook Kustom?
// - Fungsi yang menggunakan React hooks (useState, useEffect, dll)
// - Awalan "use" adalah konvensi penamaan React
// - Dapat dipanggil dari komponen fungsional
// - Logika yang dapat digunakan kembali di berbagai layar
//
// Kenapa Pakai Hook Kustom?
// 1. Pemisahan Kepentingan: Logika UI terpisah dari logika bisnis
// 2. Dapat Digunakan Kembali: Logika bisa dipakai di berbagai layar
// 3. Dapat Diuji: Lebih mudah menguji logika bisnis tanpa UI
// 4. Dapat Dipelihara: Perubahan di logika tidak mempengaruhi struktur UI
//
// Fitur:
// 1. Pemindaian Kartu Fisik: Baca UID kartu NFC dari perangkat keras
// 2. Validasi Backend: Cek apakah kartu terdaftar dan aktif
// 3. Validasi Kepemilikan: Cek apakah kartu milik pengguna saat ini
// 4. Validasi Status: Cek apakah status kartu AKTIF
// 5. Pencatatan Ketukan: Catat setiap ketukan ke backend untuk analitik
// 6. Umpan Balik Pengguna: Pesan peringatan untuk semua skenario
//
// Manajemen State:
// - lastScannedCard: Menyimpan UID kartu terakhir yang dipindai (untuk mencegah duplikasi)
// - isScanning: Flag untuk mencegah pemindaian bersamaan (mekanisme penguncian)
//
// Contoh Penggunaan:
// ```tsx
// const { scanAndValidateCard, isScanning, lastScannedCard } = useNFCScanner(userId);
//
// const handleScan = async () => {
//   const cardId = await scanAndValidateCard();
//   if (cardId) {
//     // Card valid, proceed dengan payment
//   }
// };
// ```
//
// ==================================================================================

import { useState } from 'react'; // import mengambil module; { useState } destructuring mengambil hook useState dari library react; useState digunakan untuk membuat state lokal isScanning dan lastScannedCard di dalam hook kustom ini
import { Alert } from 'react-native'; // import Alert dari React Native — digunakan untuk menampilkan dialog popup native saat kartu tidak terdaftar, tidak aktif, atau scan gagal
import { NFCService } from '../utils/nfc'; // import NFCService dari file nfc.ts — menyediakan method untuk membaca UID kartu NFC dari hardware perangkat Android
import { apiService } from '../utils/apiService';

// ==================================================================================
// HOOK: useNFCScanner
// ==================================================================================
// PARAMETER:
// - currentUserId: nomor - ID pengguna yang sedang login (untuk validasi kepemilikan)
//
// HASIL KEMBALIAN:
// - lastScannedCard: string - UID kartu terakhir yang dipindai
// - isScanning: boolean - Flag apakah sedang memindai
// - scanAndValidateCard: Fungsi - Fungsi utama untuk scan dan validasi
// - resetScanner: Fungsi - Reset state pemindai
// ==================================================================================
export const useNFCScanner = (currentUserId: number) => {
  // STATE 1: lastScannedCard - Menyimpan UID kartu terakhir yang berhasil di-scan
  // Berguna untuk mencegah scan duplikat dan menampilkan info "terakhir scan"
  const [lastScannedCard, setLastScannedCard] = useState<string>(''); // Awalnya kosong
  
  // STATE 2: isScanning - Flag lock untuk mencegah multiple scan bersamaan
  // NFC hardware hanya bisa handle 1 operasi pada satu waktu
  // true = sedang scan, false = siap scan baru
  const [isScanning, setIsScanning] = useState(false); // Awalnya idle

  // ================================================================================
  // FUNGSI: scanAndValidateCard
  // ================================================================================
  // Fungsi utama untuk memindai kartu NFC fisik dan validasi dengan backend.
  //
  // DIAGRAM ALUR:
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ STEP 1: Check if already scanning (prevent concurrent)              │
  // │         └─ Return null jika isScanning = true                       │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 2: Set isScanning = true (lock scanner)                        │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 3: Read Physical Card UID                                      │
  // │         └─ Call NFCService.readPhysicalCard()                       │
  // │         └─ Return null jika gagal read                              │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 4: Backend Validation - Get Card Info                          │
  // │         └─ API: GET /api/nfc-cards/info/{cardId}                    │
  // │         └─ Check: card registered? ownership? status ACTIVE?        │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 5: Log Tap to Backend (Analytics)                              │
  // │         └─ API: POST /api/nfc-cards/tap                             │
  // │         └─ Track: cardId, timestamp, location                       │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 6: Show Success Alert with Card Info                           │
  // │         └─ Display: cardId, owner name, balance                     │
  // ├─────────────────────────────────────────────────────────────────────┤
  // │ STEP 7: Set isScanning = false (unlock scanner)                     │
  // │         └─ Return cardId for further processing                     │
  // └─────────────────────────────────────────────────────────────────────┘
  //
  // HASIL KEMBALIAN:
  // - string (cardId) jika berhasil
  // - null jika gagal atau tidak valid
  //
  // PENANGANAN ERROR:
  // - Kartu tidak terdaftar → Peringatan "Kartu belum terdaftar"
  // - Pemilik salah → Peringatan "Kartu ini bukan milik Anda"
  // - Kartu tidak aktif → Peringatan "Kartu tidak aktif"
  // - Error baca NFC → Peringatan "Gagal membaca kartu"
  // - Error jaringan → Pesan peringatan error
  // ================================================================================
  const scanAndValidateCard = async (): Promise<string | null> => {
    // STEP 1: Cek apakah sudah ada scan yang sedang berjalan
    // Guard clause untuk mencegah conflict hardware NFC
    // NFC hanya bisa handle 1 operasi pada satu waktu
    if (isScanning) {
      Alert.alert('Error', 'Scan sudah berjalan'); // Tampilkan peringatan
      return null; // Keluar dari function tanpa melanjutkan
    }

    // STEP 2: Aktifkan lock scanner agar tidak bisa dipanggil lagi
    // Pattern locking: variable flag untuk kontrol akses function
    setIsScanning(true); // Lock ON

    try {
      // STEP 3: Read Physical Card UID
      // Call NFCService.readPhysicalCard() untuk baca UID dari NFC chip
      // NFCService akan:
      // 1. Enable NFC hardware
      // 2. Wait for card detection (auto-detect mode)
      // 3. Read UID dari NDEF atau ISO15693 tag
      // 4. Return UID as string or null if failed
      const cardInfo = await NFCService.readPhysicalCard();

      // VALIDASI 3.1: Check apakah berhasil read UID
      // cardInfo akan null jika:
      // - User cancel scanning
      // - NFC hardware error
      // - Card tidak support (bukan NTag215)
      // - Timeout (user tidak dekatkan card dalam waktu yang ditentukan)
      if (!cardInfo) {
        Alert.alert(
          '❌ Kartu Tidak Terbaca',
          'Pastikan:\n• Kartu NFC dekat dengan HP\n• Kartu dalam kondisi baik\n• NFC aktif di Pengaturan',
          [{ text: 'OK' }]
        );
        return null; // Early return: gagal read hardware
      }

      // STEP 4: Backend Validation - Get Card Info
      // API Call: GET /api/nfc-cards/info/{cardId}
      // Backend akan:
      // 1. Query database: SELECT * FROM nfc_cards WHERE card_uid = cardId
      // 2. JOIN dengan users table untuk get user info
      // 3. Return card info + user info
      // 
      // Response format:
      // {
      //   success: boolean,
      //   card: {
      //     card_uid: string,
      //     card_number: string,
      //     cardStatus: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED',
      //     userId: number,
      //     balance: number,
      //     user: {
      //       id: number,
      //       name: string,
      //       email: string
      //     }
      //   }
      // }
      const checkResult = await apiService.get(`/api/nfc-cards/info/${cardInfo.id}`);

      // VALIDASI 4.1: Check apakah card registered di database
      // success = false berarti:
      // - Card UID tidak ditemukan di tabel nfc_cards
      // - Card belum pernah didaftarkan oleh user manapun
      // User harus daftar card dulu di RegisterCardScreen
      if (!checkResult.success) {
        Alert.alert(
          '📝 Kartu Belum Terdaftar',
          `UID: ${cardInfo.id.slice(0, 16)}...\n\nDaftar kartu di menu "Daftar Kartu" terlebih dahulu.`,
          [{ text: 'OK' }]
        );
        return null; // Early return: card not registered
      }

      // Extract card data dari response
      // cardData berisi info lengkap card + user owner
      const cardData = checkResult.card;

      // VALIDASI 4.2: Check ownership - apakah card milik current user
      // Security check: Prevent user pakai card user lain
      // currentUserId = ID user yang login (dari parameter hook)
      // cardData.userId = ID user pemilik card (dari database)
      // Jika tidak match, berarti card milik user lain
      if (cardData.userId !== currentUserId) {
        Alert.alert(
          '⚠️ Kartu Milik Akun Lain',
          `Kartu ini terdaftar atas nama: ${cardData.user?.name || 'User lain'}\n\nAnda tidak dapat menggunakan kartu ini.`,
          [{ text: 'OK' }]
        );
        return null; // Early return: wrong owner
      }

      // VALIDASI 4.3: Check card status
      // Card harus dalam status ACTIVE untuk bisa digunakan
      // Status lain:
      // - BLOCKED: Card diblokir karena fraud atau admin action
      // - SUSPENDED: Card ditangguhkan sementara (pending verification)
      // - INACTIVE: Card belum diaktivasi setelah registrasi
      if (cardData.cardStatus !== 'ACTIVE') {
        Alert.alert(
          '🚫 Kartu Tidak Aktif',
          `Status: ${cardData.cardStatus}\n\nAktifkan kartu di menu "Kartu Saya".`,
          [{ text: 'OK' }]
        );
        return null; // Early return: card not active
      }

      // STEP 5: Log Tap to Backend (Analytics)
      // API Call: POST /api/nfc-cards/tap
      // Purpose: Track setiap card tap untuk analytics dan fraud detection
      // Backend akan:
      // 1. Create tap_logs entry untuk analytics
      // 2. Update last_tapped_at timestamp di nfc_cards table
      // 3. Update tap_count counter untuk fraud detection
      // 4. Data tap digunakan oleh Z-Score Based Anomaly Detection
      // 
      // Data yang dikirim:
      // - cardId: UID card yang di-tap
      // - deviceId: Identifier device (untuk detect multi-device fraud)
      // - signalStrength: Kekuatan sinyal NFC (untuk detect card cloning)
      // - readTime: Timestamp tap (untuk analisis pola transaksi)
      await apiService.post('/api/nfc-cards/tap', {
        cardId: cardInfo.id,
        deviceId: 'unknown', // TODO: Get real device ID
        signalStrength: 'strong',
        readTime: Date.now()
      });

      // Save UID ke state untuk tracking last scan
      // Use case: Display "last scanned" info, prevent duplicate scan
      setLastScannedCard(cardInfo.id);

      // STEP 6: Show Success Alert with Card Info
      // Display info card yang berhasil di-scan
      // Info yang ditampilkan:
      // - UID: First 16 chars untuk identification (full UID terlalu panjang)
      // - Status: ACTIVE/BLOCKED/SUSPENDED
      // - Balance: Formatted dengan thousand separator
      // 
      // Alert.alert() adalah React Native API untuk show native dialog
      // Parameters: (title, message, buttons)
      Alert.alert(
        '✅ Kartu Terdeteksi',
        `UID: ${cardInfo.id.slice(0, 16)}...\nStatus: ${cardData.cardStatus}\nBalance: Rp ${cardData.balance.toLocaleString('id-ID')}`,
        [{ text: 'OK' }]
      );

      // STEP 7: Return cardId for further processing
      // Caller (screen component) bisa gunakan cardId ini untuk:
      // - Proceed dengan payment
      // - Display card details
      // - Log additional analytics
      return cardInfo.id;

    } catch (error: any) {
      // ERROR HANDLING: Catch semua unhandled errors
      // Possible errors:
      // - Network error: Backend tidak bisa diakses
      // - NFC hardware error: Hardware failure atau permission denied
      // - Timeout error: API call terlalu lama
      // - Parse error: Response format tidak sesuai
      console.error('Scan error:', error);
      
      // Display error ke user dengan Alert
      // error?.message akan extract error message jika ada
      // Fallback ke 'Terjadi kesalahan' jika error tidak punya message
      Alert.alert('❌ Gagal Scan Kartu', error?.message || 'Terjadi kesalahan');
      return null; // Return null untuk indicate failure
    } finally {
      // FINALLY BLOCK: Always executed
      // Reset isScanning flag untuk unlock scanner
      // Ini penting karena:
      // - Jika ada error, scanner harus di-unlock untuk retry
      // - finally block dijalankan meskipun ada return di try/catch
      // - Prevent scanner stuck di locked state
      setIsScanning(false);
    }
  };

  // ================================================================================
  // FUNCTION: resetScanner
  // ================================================================================
  // Reset scanner state dengan clear lastScannedCard.
  //
  // Use Cases:
  // 1. User ingin scan card baru (clear previous scan)
  // 2. Navigate ke screen baru (cleanup state)
  // 3. Error recovery (clear invalid scan)
  // 4. Logout (clear user data)
  //
  // Simple function tapi penting untuk state management:
  // - Prevent showing stale data
  // - Allow fresh scan
  // - Clean component unmount
  // ================================================================================
  const resetScanner = () => {
    // Clear lastScannedCard state
    // setLastScannedCard('') akan trigger re-render jika state berubah
    // Components yang subscribe ke lastScannedCard akan update UI
    setLastScannedCard('');
  };

  // ================================================================================
  // HOOK RETURN OBJECT
  // ================================================================================
  // Return object dengan destructuring pattern.
  //
  // Usage di component:
  // ```tsx
  // const { scanAndValidateCard, isScanning, lastScannedCard, resetScanner } = useNFCScanner(userId);
  // ```
  //
  // Benefits destructuring:
  // 1. Caller hanya ambil yang diperlukan: const { scanAndValidateCard } = useNFCScanner()
  // 2. Clear naming: Variable names sudah explicit
  // 3. Order-independent: Tidak peduli urutan destructuring
  //
  // Return values:
  // - lastScannedCard: string - UID terakhir yang di-scan (untuk display)
  // - isScanning: boolean - Flag scanning state (untuk disable button, show loading)
  // - scanAndValidateCard: Function - Main scan function (untuk onPress handler)
  // - resetScanner: Function - Reset function (untuk cleanup)
  // ================================================================================
  return {
    lastScannedCard,    // State: Last scanned card UID
    isScanning,         // State: Is scanning in progress (loading indicator)
    scanAndValidateCard, // Action: Scan and validate card
    resetScanner        // Action: Reset scanner state
  };
};
