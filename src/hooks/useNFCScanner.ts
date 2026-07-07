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

import { useState } from 'react'; // import mengambil module; { useState } destructuring mengambil hook useState d...
// import mengambil module; { useState } destructuring mengambil hook useState dari library react; useState digunakan untuk membuat state lokal isScanning dan lastScannedCard di dalam hook kustom ini
import { Alert } from 'react-native'; // import Alert dari React Native — digunakan untuk menampilkan dialog popup nat...
// import Alert dari React Native — digunakan untuk menampilkan dialog popup native saat kartu tidak terdaftar, tidak aktif, atau scan gagal
import { NFCService } from '../utils/nfc'; // import NFCService dari file nfc.ts — menyediakan method untuk membaca UID kar...
// import NFCService dari file nfc.ts — menyediakan method untuk membaca UID kartu NFC dari hardware perangkat Android
import { apiService } from '../utils/apiService'; // import apiService dari file apiService.ts — digunakan untuk HTTP GET validasi...
// import apiService dari file apiService.ts — digunakan untuk HTTP GET validasi kartu ke backend dan POST log tap analytics

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
export const useNFCScanner = (currentUserId: number) => { // STATE 1: lastScannedCard - Menyimpan UID kartu terakhir yang berhasil di-scan
  // STATE 1: lastScannedCard - Menyimpan UID kartu terakhir yang berhasil di-scan
  // Berguna untuk mencegah scan duplikat dan menampilkan info "terakhir scan"
  const [lastScannedCard, setLastScannedCard] = useState<string>(''); // const membuat variabel tetap; useState<string>('') membuat state string koson...
  // const membuat variabel tetap; useState<string>('') membuat state string kosong; <string> adalah type annotation TypeScript; lastScannedCard menyimpan UID kartu terakhir yang berhasil di-scan
  
  // STATE 2: isScanning - Flag lock untuk mencegah multiple scan bersamaan
  // NFC hardware hanya bisa handle 1 operasi pada satu waktu
  // true = sedang scan, false = siap scan baru
  const [isScanning, setIsScanning] = useState(false); // useState(false) membuat state boolean dengan nilai awal false; isScanning=tru...
  // useState(false) membuat state boolean dengan nilai awal false; isScanning=true mengunci scanner agar tidak bisa dipanggil dua kali bersamaan

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
  const scanAndValidateCard = async (): Promise<string | null> => { // const membuat variabel tetap; async menandai fungsi asynchronous; : Promise<s...
    // const membuat variabel tetap; async menandai fungsi asynchronous; : Promise<string | null> adalah return type TypeScript — mengembalikan string (UID kartu) atau null jika gagal
    if (isScanning) { // if memeriksa kondisi; isScanning=true berarti sudah ada scan yang berjalan
      // if memeriksa kondisi; isScanning=true berarti sudah ada scan yang berjalan
      Alert.alert('Error', 'Scan sudah berjalan'); // Alert.alert menampilkan dialog native
      // Alert.alert menampilkan dialog native
      return null; // return null menghentikan fungsi dan mengembalikan null ke pemanggil
      // return null menghentikan fungsi dan mengembalikan null ke pemanggil
    }

    setIsScanning(true); // setIsScanning(true) mengaktifkan lock — mencegah panggilan bersamaan
    // setIsScanning(true) mengaktifkan lock — mencegah panggilan bersamaan

    try { // STEP 3: Read Physical Card UID
      // STEP 3: Read Physical Card UID
      // Call NFCService.readPhysicalCard() untuk baca UID dari NFC chip
      // NFCService akan:
      // 1. Enable NFC hardware
      // 2. Wait for card detection (auto-detect mode)
      // 3. Read UID dari NDEF atau ISO15693 tag
      // 4. Return UID as string or null if failed
      const cardInfo = await NFCService.readPhysicalCard(); // await menunggu hasil pembacaan kartu NFC dari hardware; NFCService.readPhysic...
      // await menunggu hasil pembacaan kartu NFC dari hardware; NFCService.readPhysicalCard() mengaktifkan sensor NFC dan menunggu kartu ditempelkan

      if (!cardInfo) { // ! membalik boolean; !cardInfo berarti null/undefined — pembacaan gagal
        // ! membalik boolean; !cardInfo berarti null/undefined — pembacaan gagal
        Alert.alert(
          '❌ Kartu Tidak Terbaca',
          'Pastikan:\n• Kartu NFC dekat dengan HP\n• Kartu dalam kondisi baik\n• NFC aktif di Pengaturan',
          [{ text: 'OK' }]
        );
        return null; // Early return: gagal read hardware
        // Early return: gagal read hardware
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
      const checkResult = await apiService.get(`/api/nfc-cards/info/${cardInfo.id}`); // await menunggu HTTP GET ke backend; template literal ${cardInfo.id} menyisipk...
      // await menunggu HTTP GET ke backend; template literal ${cardInfo.id} menyisipkan UID kartu ke URL

      if (!checkResult.success) { // ! membalik boolean; success=false berarti kartu belum terdaftar di database
        // ! membalik boolean; success=false berarti kartu belum terdaftar di database
        Alert.alert(
          '📝 Kartu Belum Terdaftar',
          `UID: ${cardInfo.id.slice(0, 16)}...\n\nDaftar kartu di menu "Daftar Kartu" terlebih dahulu.`,
          [{ text: 'OK' }]
        );
        return null; // Early return: card not registered
        // Early return: card not registered
      }

      // Extract card data dari response
      // cardData berisi info lengkap card + user owner
      const cardData = checkResult.card; // mengambil property card dari objek respons backend
      // mengambil property card dari objek respons backend

      if (cardData.userId !== currentUserId) { // !== berarti tidak sama; membandingkan ID pemilik kartu dengan ID user yang se...
        // !== berarti tidak sama; membandingkan ID pemilik kartu dengan ID user yang sedang login
        Alert.alert(
          '⚠️ Kartu Milik Akun Lain',
          `Kartu ini terdaftar atas nama: ${cardData.user?.name || 'User lain'}\n\nAnda tidak dapat menggunakan kartu ini.`,
          [{ text: 'OK' }]
        );
        return null; // Early return: wrong owner
        // Early return: wrong owner
      }

      if (cardData.cardStatus !== 'ACTIVE') { // !== berarti tidak sama persis; hanya kartu dengan status 'ACTIVE' yang bisa d...
        // !== berarti tidak sama persis; hanya kartu dengan status 'ACTIVE' yang bisa digunakan bertransaksi
        Alert.alert(
          '🚫 Kartu Tidak Aktif',
          `Status: ${cardData.cardStatus}\n\nAktifkan kartu di menu "Kartu Saya".`,
          [{ text: 'OK' }]
        );
        return null; // Early return: card not active
        // Early return: card not active
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
      await apiService.post('/api/nfc-cards/tap', { // await menunggu HTTP POST ke backend untuk mencatat data tap kartu ke log anal...
        // await menunggu HTTP POST ke backend untuk mencatat data tap kartu ke log analytics
        cardId: cardInfo.id, // UID kartu yang ditap
        // UID kartu yang ditap
        deviceId: 'unknown', // TODO: Get real device ID
        // TODO: Get real device ID
        signalStrength: 'strong', // kekuatan sinyal NFC — digunakan untuk mendeteksi card cloning
        // kekuatan sinyal NFC — digunakan untuk mendeteksi card cloning
        readTime: Date.now() // Date.now() mengembalikan timestamp milidetik sejak Unix epoch
        // Date.now() mengembalikan timestamp milidetik sejak Unix epoch
      });

      setLastScannedCard(cardInfo.id); // setLastScannedCard menyimpan UID terakhir ke state
      // setLastScannedCard menyimpan UID terakhir ke state

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
      return cardInfo.id; // return = mengembalikan ID kartu NFC yang berhasil dibaca dari tag fisik

    } catch (error: any) { // ERROR HANDLING: Catch semua unhandled errors
      // ERROR HANDLING: Catch semua unhandled errors
      // Possible errors:
      // - Network error: Backend tidak bisa diakses
      // - NFC hardware error: Hardware failure atau permission denied
      // - Timeout error: API call terlalu lama
      // - Parse error: Response format tidak sesuai
      console.error('Scan error:', error);
      Alert.alert('\u274c Gagal Scan Kartu', error?.message || 'Terjadi kesalahan'); // optional chaining (?.) aman; || fallback jika error.message tidak ada
      // optional chaining (?.) aman; || fallback jika error.message tidak ada
      return null; // return null memberitahu pemanggil bahwa scan gagal
      // return null memberitahu pemanggil bahwa scan gagal
    } finally { // finally selalu dijalankan baik ada error maupun tidak — cocok untuk melepas k...
      // finally selalu dijalankan baik ada error maupun tidak — cocok untuk melepas kunci
      setIsScanning(false); // setIsScanning(false) melepas kunci scanner agar bisa menerima scan berikutnya
      // setIsScanning(false) melepas kunci scanner agar bisa menerima scan berikutnya
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
  const resetScanner = () => { // arrow function sederhana tanpa async; hanya mereset state lokal
    // arrow function sederhana tanpa async; hanya mereset state lokal
    setLastScannedCard(''); // setLastScannedCard('') mengosongkan UID terakhir; memicu re-render komponen y...
    // setLastScannedCard('') mengosongkan UID terakhir; memicu re-render komponen yang menggunakan state ini
  };

  return { // return objek — komponen yang menggunakan hook ini bisa destructuring nilai ya...
    // return objek — komponen yang menggunakan hook ini bisa destructuring nilai yang dibutuhkan
    lastScannedCard, // UID kartu terakhir yang berhasil di-scan
    // UID kartu terakhir yang berhasil di-scan
    isScanning, // boolean: apakah sedang proses scan (untuk disable tombol)
    // boolean: apakah sedang proses scan (untuk disable tombol)
    scanAndValidateCard, // fungsi utama: scan kartu NFC lalu validasi ke backend
    // fungsi utama: scan kartu NFC lalu validasi ke backend
    resetScanner // fungsi untuk mengosongkan state scanner
    // fungsi untuk mengosongkan state scanner
  };
};
