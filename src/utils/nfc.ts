// src/utils/nfc.ts
// ==================================================================================
// 📡 UTILITY: NFCService
// ==================================================================================
//
// Tujuan:
// Layanan NFC (Near Field Communication) komprehensif untuk handle semua operasi
// pembacaan dan penulisan NFC physical cards (NTag215).
// Core utility untuk contactless payment system dengan physical NFC cards.
//
// Stack Teknologi:
// - Library: react-native-nfc-manager
// - Tipe Kartu: NTag215 (NXP Semiconductors)
// - Frekuensi: 13.56 MHz (HF - High Frequency)
// - Protokol: ISO/IEC 14443 Type A
// - Memori: 540 bytes user memory (144 bytes NDEF)
// - Format: NDEF (NFC Data Exchange Format)
//
// Spesifikasi NTag215:
// ┌────────────────────────────────────────────────────────────────────┐
// │ Struktur Memori:                                                    │
// │ - Total: 540 bytes                                                  │
// │ - User Memory: 504 bytes (pages 4-129)                             │
// │ - NDEF Message: Hingga 144 bytes                                   │
// │ - UID: 7 bytes (unique identifier)                                  │
// │ - Read/Write: Multiple kali (tidak one-time programmable)          │
// │ - Keamanan: Password protection tersedia (32-bit)                  │
// └────────────────────────────────────────────────────────────────────┘
//
// Use Cases (Kasus Penggunaan):
//
// 1. Transaksi Pembayaran:
//    - Pembeli tap kartu ke HP merchant
//    - Sistem baca UID kartu untuk identifikasi user
//    - Backend proses payment: balance pembeli → balance merchant
//    - Tidak perlu internet di kartu (backend yang handle transaksi)
//
// 2. Registrasi Kartu:
//    - User baru scan physical NTag215 card
//    - Sistem baca UID kartu (unique identifier)
//    - Backend daftarkan kartu ke akun user
//    - Kartu menjadi instrumen pembayaran yang ter-link
//
// 3. Validasi Kartu:
//    - Baca info kartu (UID, type, manufacturer)
//    - Validasi kartu adalah NTag215 (bukan Mifare, dll)
//    - Cek status kartu (aktif, diblokir, hilang)
//    - Verifikasi kepemilikan kartu
//
// Ringkasan Arsitektur:
// ┌─────────────────────────────────────────────────────────────────────┐
// │                      ALUR OPERASI NFC                               │
// ├─────────────────────────────────────────────────────────────────────┤
// │                                                                      │
// │  Aplikasi Mobile (React Native)                                     │
// │       ↓                                                              │
// │  NFCService.readPhysicalCard()                                      │
// │       ↓                                                              │
// │  react-native-nfc-manager                                           │
// │       ↓                                                              │
// │  Native NFC Hardware (Android/iOS)                                  │
// │       ↓                                                              │
// │  Physical NTag215 Card (13.56 MHz RF)                               │
// │       ↓                                                              │
// │  Baca UID + Data NDEF                                               │
// │       ↓                                                              │
// │  Return ke App: { id, type, manufacturer }                          │
// │       ↓                                                              │
// │  Backend API: Validasi & Proses                                     │
// │                                                                      │
// └─────────────────────────────────────────────────────────────────────┘
//
// Method Utama:
//
// 1. initNFC():
//    - Inisialisasi hardware NFC
//    - Cek dukungan device & status enabled
//    - Dipanggil saat app startup
//
// 2. readPhysicalCard():
//    - Baca UID dari physical NTag215 card
//    - Method terpenting untuk payment flow
//    - Return: { id, type, manufacturer }
//
// 3. writePhysicalCard():
//    - Tulis NDEF data ke card (opsional)
//    - Biasanya tidak diperlukan (kita hanya pakai UID)
//    - Untuk fitur masa depan
//
// 4. checkNFCEnabled():
//    - Cek NFC enabled di device settings
//    - Dipanggil sebelum operasi NFC
//
// 5. cleanup():
//    - Lepaskan resource NFC
//    - Dipanggil saat component unmount
//
// Penanganan Error:
// - Device tidak support NFC: Return false, fallback ke manual mode
// - NFC disabled: Tampilkan alert dengan instruksi
// - Error baca kartu: Return null, prompt retry
// - Timeout: Cancel setelah 30 detik
//
// Pertimbangan Keamanan:
// - UID bersifat publik (bisa di-clone)
// - Backend harus validasi kepemilikan kartu
// - Backend cek status kartu (aktif, diblokir)
// - Backend verifikasi legitimasi transaksi
// - Balance kartu disimpan di backend (tidak di kartu)
//
// ==================================================================================

// ============================================================================
// IMPORTS - Library yang dibutuhkan
// ============================================================================
// react-native-nfc-manager: Library untuk handle NFC di React Native
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager'; // import NfcManager sebagai default export (instance singleton NFC manager); { NfcTech } adalah enum yang berisi teknologi NFC (NfcA, IsoDep, dll); { Ndef } adalah helper untuk encode/decode data format NDEF ke NFC tag
// Platform: Untuk deteksi OS (Android/iOS)
import { Platform } from 'react-native'; // import Platform dari React Native — digunakan untuk membedakan perilaku NFC di Android vs iOS karena ada perbedaan implementasi hardware

// ============================================================================
// INTERFACE: NFCData
// ============================================================================
// Struktur data yang akan ditulis/dibaca dari NFC tag
// Data ini di-encode jadi JSON dan disimpan di tag NFC
export interface NFCData {
  userId: number;                      // ID user yang punya tag NFC ini
  username: string;                    // Username untuk identifikasi
  action: 'payment' | 'receive';       // Aksi: bayar atau terima uang
  amount?: number;                     // Jumlah uang (opsional, bisa di-set later)
  cardId?: string;                     // UID dari physical NFC card (NTag215)
  cardType?: 'virtual' | 'physical';   // Tipe kartu: virtual (HP) atau physical (NTag215)
}

// ============================================================================
// INTERFACE: NFCCardInfo
// ============================================================================
// Informasi dari physical NFC card (NTag215)
export interface NFCCardInfo {
  id: string;                          // UID kartu (hex string)
  type: string;                        // Tipe tag (NTag215, Mifare, dll)
  techTypes: string[];                 // Teknologi yang didukung
  maxSize: number;                     // Ukuran memory (bytes)
  isWritable: boolean;                 // Apakah bisa ditulis
  manufacturer: string;                // Produsen (NXP untuk NTag215)
}

// ============================================================================
// CLASS: NFCService
// ============================================================================
// Service untuk handle semua operasi NFC (Near Field Communication)
// NFC digunakan untuk pembayaran phone-to-phone tanpa internet
// Cara kerja: Tempelkan 2 HP, data transfer via NFC tag
export class NFCService {
  // Flag untuk track apakah ada NFC request yang sedang berjalan
  // Mencegah multiple request bersamaan (race condition)
  private static isRequestActive = false; // Awalnya tidak ada request aktif
  // =========================================================================
  // METHOD: initNFC()
  // =========================================================================
  // Inisialisasi NFC service saat aplikasi pertama kali jalan
  // Return: true jika NFC berhasil diinit, false jika tidak support/error
  static async initNFC(): Promise<boolean> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Cek apakah running di Expo Go atau development mode
      // Expo Go tidak support native module NFC, jadi return false
      // __DEV__ adalah flag bawaan React Native untuk mode development
      if (__DEV__ && !Platform.select({ android: true, ios: true })) {
        console.log('📱 NFC not available in Expo Go - using manual payment mode'); // Log info
        return false; // Return false = NFC tidak tersedia
      }

      // STEP 2: Periksa apakah device memiliki hardware NFC
      // Tidak semua smartphone punya chip NFC (terutama HP budget)
      const supported = await NfcManager.isSupported().catch(() => false); // Fallback false jika error
      if (!supported) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.log('📱 NFC not supported on this device - using manual payment mode'); // Log info
        return false; // Device tidak punya NFC chip
      }

      // STEP 3: Coba start NFC manager service
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        // Inisialisasi NFC service dari react-native-nfc-manager
        await NfcManager.start(); // Aktivasi hardware NFC
        
        // STEP 4: Cek apakah user sudah mengaktifkan NFC di pengaturan
        // User bisa punya hardware tapi NFC-nya dimatikan manual
        const enabled = await NfcManager.isEnabled().catch(() => false); // Fallback false
        
        if (!enabled) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
          console.log('⚠️ NFC is disabled in device settings'); // Log peringatan
          return false; // NFC ada tapi tidak aktif
        }
        
        console.log('✅ NFC Initialized successfully'); // Log sukses
        return true; // Sukses: NFC siap dipakai
        
      } catch (startError: any) {
        // Error saat start biasanya terjadi di emulator atau Expo Go
        console.log('⚠️ NFC start gagal (Expo Go/Emulator):', startError?.message || 'Tidak tersedia'); // Log warning
        return false; // Gagal start NFC service
      }
      
    } catch (error: any) { // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
      // Catch error umum yang tidak terduga
      console.log('❌ Error Inisialisasi NFC:', error?.message || 'Tidak tersedia dalam development mode'); // Log error
      return false; // Return false = init gagal
    }
  }

  // =========================================================================
  // METHOD: checkNFCEnabled()
  // =========================================================================
  // Cek apakah NFC sedang aktif di device
  // Digunakan sebelum melakukan operasi NFC (read/write)
  // Return: true jika enabled, false jika disabled
  static async checkNFCEnabled(): Promise<boolean> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Query status NFC dari device operating system
      // isEnabled() check apakah NFC toggle ON di pengaturan
      const enabled = await NfcManager.isEnabled(); // Await karena operasi async
      return !!enabled;  // Convert ke boolean dengan double negation (!!, untuk safety)
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // Jika ada error (misal device tidak support NFC), return false
      console.log('Error Cek NFC:', error); // Log error untuk debugging
      return false; // Default: anggap disabled
    }
  }

  // =========================================================================
  // METHOD: writeNFCData()
  // =========================================================================
  // Menulis data ke NFC tag (untuk mode "Terima Uang")
  // User yang mau terima uang akan write data dirinya ke NFC tag
  // Lalu yang bayar akan scan tag ini
  // 
  // Input: NFCData (userId, username, action, amount)
  // Output: true jika berhasil write, false jika gagal
  static async writeNFCData(data: NFCData): Promise<boolean> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Request akses ke NFC technology (NDEF format)
      // NDEF = NFC Data Exchange Format (standar format data NFC)
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // STEP 2: Encode data jadi NDEF message
      // - Convert object jadi JSON string
      // - Wrap dalam text record NDEF
      // - Encode jadi bytes untuk ditulis ke tag
      const bytes = Ndef.encodeMessage([Ndef.textRecord(JSON.stringify(data))]); // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request

      // STEP 3: Cek apakah encoding berhasil
      if (bytes) {
        // STEP 4: Tulis bytes ke NFC tag
        // User harus menempelkan HP ke tag NFC saat proses ini
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        console.log('✅ NFC Data written:', data); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return true; // return true mengembalikan nilai berhasil ke pemanggil fungsi
      }
      
      // Kalau bytes kosong, berarti encoding gagal
      console.warn('⚠️ NFC encodeMessage returned empty bytes'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
      return false; // return false mengembalikan nilai gagal ke pemanggil fungsi
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // Error bisa terjadi karena:
      // - Tag tidak compatible (read-only tag)
      // - Tag tidak ditempel cukup lama
      // - Tag rusak
      console.log('Error Tulis NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return false; // return false mengembalikan nilai gagal ke pemanggil fungsi
      
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      // STEP 5: Selalu cancel technology request setelah selesai
      // Ini penting untuk release NFC resource
      await NfcManager.cancelTechnologyRequest();
    }
  }

  // =========================================================================
  // METHOD: readNFCData()
  // =========================================================================
  // Membaca data dari NFC tag (untuk mode "Bayar")
  // User yang mau bayar akan scan tag NFC dari penerima
  // Data penerima (userId, username) akan diambil dari tag
  // 
  // Output: NFCData jika berhasil read, null jika gagal/kosong
  static async readNFCData(): Promise<NFCData | null> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Cek apakah ada request yang sedang aktif
      if (this.isRequestActive) {
        console.log('⚠️ Request NFC sedang berlangsung'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      this.isRequestActive = true;

      // STEP 1: Cancel request sebelumnya jika ada
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        // Abaikan jika tidak ada request untuk di-cancel
      }

      // STEP 2: Request akses ke teknologi NFC (format NDEF)
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Dekatkan HP ke NFC tag...'
      });
      
      // STEP 3: Ambil tag yang terdeteksi
      // getTag() akan return objek tag dengan semua data
      const tag = await NfcManager.getTag();

      // STEP 4: Validasi tag
      // Cek apakah tag ada dan punya NDEF message
      if (!tag || !tag.ndefMessage) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.warn('⚠️ No NFC tag data found'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      // STEP 5: Ambil NDEF record pertama
      // NDEF message bisa punya multiple records, kita ambil yang pertama
      const ndefRecord = tag.ndefMessage[0];
      if (!ndefRecord || !ndefRecord.payload) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.warn('⚠️ Empty NFC payload'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      // STEP 6: Decode payload
      // Format payload NDEF text record:
      // - Byte 0: Status byte (encoding + panjang bahasa)
      // - Byte 1-2: Kode bahasa (contoh: "en")
      // - Byte 3+: Data teks sebenarnya (JSON string kita)
      const payload = ndefRecord.payload;
      
      // Skip 3 bytes pertama (status + prefix bahasa)
      // Convert sisanya jadi string
      const text = String.fromCharCode(...payload.slice(3));
      
      // STEP 7: Parse JSON string jadi object
      const data: NFCData = JSON.parse(text); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan

      console.log('✅ NFC Tag Read:', data); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return data;
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      // Error bisa terjadi karena:
      // - Tag tidak punya data NDEF
      // - Data rusak/tidak valid JSON
      // - Tag tidak ditempel cukup lama
      console.log('Error Baca NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      // STEP 7: Selalu cancel technology request
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (cancelError) {
        // Abaikan error cancel
      }
      this.isRequestActive = false;
    }
  }

  // =========================================================================
  // METHOD: startNFCScanning()
  // =========================================================================
  // Mulai continuous NFC scanning (loop terus sampai tag terdeteksi)
  // Digunakan di screen "Bayar" untuk terus scan tag penerima
  // 
  // Input:
  //   - onTagDetected: Callback function yang dipanggil saat tag terdeteksi
  //   - onError: Callback untuk handle error (opsional)
  static async startNFCScanning(
    onTagDetected: (data: NFCData | null) => void,
    onError?: (error: any) => void
  ): Promise<void> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Define function untuk scan tag
      const scanForTag = async () => {
        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          // Coba baca NFC tag
          const data = await this.readNFCData(); // const data: menyimpan data yang diambil secara async dari API atau database
          
          // Kalau ada data, panggil callback
          if (data) onTagDetected(data);
        } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
          console.log('Error membaca data NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        }
      };

      // STEP 2: Setup interval untuk scan berulang
      // Scan setiap 1.5 detik (1500ms)
      // Tidak terlalu cepat (hemat baterai) tapi cukup responsif
      const interval = setInterval(scanForTag, 1500);
      
      // STEP 3: Simpan interval ID untuk bisa di-stop nanti
      // Simpan di class property (hack dengan type any)
      (this as any)._scanInterval = interval;
      
      console.log('✅ Scanning NFC dimulai...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Scanning NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      // Cleanup: Clear interval jika ada error untuk mencegah memory leak
      if ((this as any)._scanInterval) {
        clearInterval((this as any)._scanInterval);
        (this as any)._scanInterval = null;
      }
      
      // Kalau ada error callback, panggil
      if (onError) onError(error);
    }
  }

  // =========================================================================
  // METHOD: stopNFCScanning()
  // =========================================================================
  // Stop continuous NFC scanning
  // Dipanggil saat user keluar dari screen atau transaksi selesai
  static async stopNFCScanning(): Promise<void> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      console.log('🛑 Stopping NFC scanning...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      // STEP 1: Cek apakah ada interval yang jalan
      if ((this as any)._scanInterval) {
        // STEP 2: Clear interval untuk stop scanning loop
        clearInterval((this as any)._scanInterval);
        
        // STEP 3: Reset interval ID
        (this as any)._scanInterval = null;
        
        console.log('✅ NFC scan interval cleared'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }
      
      // STEP 4: Cancel technology request (release NFC resource)
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
        console.log('✅ Request teknologi NFC dibatalkan'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      } catch (cancelError) {
        // Abaikan error cancel (mungkin tidak ada yang aktif)
        console.log('ℹ️ Tidak ada request NFC aktif untuk dibatalkan'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }

      // STEP 5: Reset flag request active
      this.isRequestActive = false;
      
      console.log('✅ Scanning NFC berhasil dihentikan'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('⚠️ Error Hentikan Scanning NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // Paksa reset flag meski ada error
      this.isRequestActive = false;
    }
  }

  // =========================================================================
  // METHOD: enableP2P()
  // =========================================================================
  // Aktifkan mode Peer-to-Peer untuk NFC
  // P2P = Komunikasi Phone-to-Phone (tanpa tag fisik)
  // CATATAN: Fitur ini advanced, untuk skripsi mungkin tidak perlu dipakai
  static async enableP2P(): Promise<void> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Request 2 teknologi sekaligus:
      // - Ndef: Untuk pertukaran data
      // - IsoDep: Untuk protokol komunikasi
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.IsoDep]);
      console.log('✅ Mode P2P diaktifkan.'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Aktifkan P2P:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    }
  }

  // =========================================================================
  // METHOD: readPhysicalCard()
  // =========================================================================
  // Membaca informasi dari physical NFC card (NTag215 13.56MHz)
  // Method ini membaca UID dan tag info untuk identifikasi kartu fisik
  // 
  // Output: NFCCardInfo dengan UID dan detail kartu
  static async readPhysicalCard(): Promise<NFCCardInfo | null> { // static berarti dipanggil langsung NFCService.readPhysicalCard() tanpa new; async menandai fungsi asynchronous; Promise<NFCCardInfo | null> return type — info kartu atau null jika gagal
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      if (this.isRequestActive) { // if memeriksa flag; isRequestActive=true berarti sudah ada pembacaan NFC yang sedang berjalan
        console.log('\u26a0\ufe0f Request NFC sedang berlangsung'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return null; // return null menghentikan fungsi dan mencegah scan bersamaan
      }

      this.isRequestActive = true; // set flag menjadi true — mengunci agar tidak ada scan lain yang bisa masuk

      // Cancel request sebelumnya jika ada
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        // Abaikan
      }

      await NfcManager.requestTechnology(NfcTech.NfcA, { // await menunggu izin akses hardware NFC; NfcTech.NfcA adalah protokol ISO14443A yang digunakan NTag215
        alertMessage: 'Dekatkan kartu NFC ke HP...' // pesan yang ditampilkan di dialog NFC pada iOS
      });
      
      const tag = await Promise.race([ // Promise.race() menjalankan dua promise bersamaan dan mengambil mana yang selesai lebih dulu
        NfcManager.getTag(), // mencoba membaca tag NFC dari hardware
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('NFC_TIMEOUT')), 30000) // setTimeout membuat timeout 30 detik; jika tag tidak terbaca, reject dengan error NFC_TIMEOUT
        )
      ]) as any;

      if (!tag || !tag.id) { // ! membalik boolean; !tag berarti null; !tag.id berarti tidak ada UID — kartu tidak terdeteksi
        console.warn('⚠️ No NFC card detected'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null memberitahu pemanggil bahwa tidak ada kartu
      }

      const uidBytes = tag.id as any; // mengambil UID kartu sebagai array byte; as any mengabaikan type check TypeScript
      const cardId = Array.isArray(uidBytes) ? this.bytesToHexString(uidBytes) : String(uidBytes); // ternary operator: jika array byte, konversi ke hex string; jika bukan, konversi langsung ke string

      const techTypes = tag.techTypes || []; // mengambil daftar teknologi NFC; || [] fallback jika techTypes tidak ada

      let cardType = 'Tidak Diketahui'; // let karena nilai akan berubah tergantung tipe kartu yang terdeteksi
      if (techTypes.includes('android.nfc.tech.NfcA') || 
          techTypes.includes('android.nfc.tech.MifareUltralight')) { // .includes() memeriksa apakah array mengandung nilai; || berarti OR
        cardType = 'NTag215'; // NTag215 adalah tipe kartu fisik yang digunakan dalam sistem ini
      }

      const manufacturerId = typeof uidBytes[0] === 'number' ? uidBytes[0] : parseInt(uidBytes[0] as any); // typeof memeriksa tipe; ternary: jika sudah number pakai langsung, jika string konversi dengan parseInt
      let manufacturer = 'Tidak Diketahui'; // let karena nilainya bisa berubah
      if (manufacturerId === 4) { // kode 4 pada byte pertama UID menandakan NXP Semiconductors
        manufacturer = 'NXP Semiconductors'; // produsen chip NTag215
      }

      const cardInfo: NFCCardInfo = { // const membuat objek tetap; : NFCCardInfo adalah type annotation TypeScript
        id: cardId, // UID kartu dalam format hex string
        type: cardType, // tipe kartu yang terdeteksi
        techTypes, // shorthand property: sama dengan techTypes: techTypes
        maxSize: tag.maxSize || 888, // || 888 fallback; NTag215 memiliki 888 bytes memori
        isWritable: true, // kartu NTag215 dapat ditulis dan dibaca berkali-kali
        manufacturer // shorthand property: nama produsen kartu
      };

      console.log('✅ Kartu Fisik Terbaca:', cardInfo); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return cardInfo; // mengembalikan info kartu ke pemanggil
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Baca Kartu Fisik:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return null; // return null memberitahu pemanggil bahwa pembacaan gagal
      
    } finally { // finally selalu dijalankan setelah try/catch — cocok untuk melepas resource hardware
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // melepaskan izin akses hardware NFC agar bisa digunakan kembali
      } catch (e) {
        // abaikan error cancel
      }
      this.isRequestActive = false; // reset flag — scanner siap menerima pembacaan berikutnya
    }
  }

  // =========================================================================
  // METHOD: readPhysicalCardWithData()
  // =========================================================================
  // Membaca UID dan NDEF data dari physical card sekaligus
  // Untuk kartu yang sudah ada datanya (sudah di-write sebelumnya)
  // 
  // Output: Objek dengan cardInfo dan nfcData
  static async readPhysicalCardWithData(): Promise<{
    cardInfo: NFCCardInfo;
    nfcData: NFCData | null;
  } | null> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      if (this.isRequestActive) {
        console.log('⚠️ Request NFC sedang berlangsung'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      this.isRequestActive = true;

      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        // Abaikan
      }

      // Request multiple teknologi untuk baca UID dan NDEF
      await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.Ndef], {
        alertMessage: 'Dekatkan kartu NFC ke HP...'
      });
      
      const tag = await NfcManager.getTag();

      if (!tag || !tag.id) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.warn('⚠️ No NFC card detected'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      // Ekstrak info kartu (UID, type, dll)
      const uidBytes = tag.id as any;
      const cardId = Array.isArray(uidBytes) ? this.bytesToHexString(uidBytes) : String(uidBytes); // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      const techTypes = tag.techTypes || [];

      let cardType = 'Tidak Diketahui';
      if (techTypes.includes('android.nfc.tech.NfcA') || 
          techTypes.includes('android.nfc.tech.MifareUltralight')) {
        cardType = 'NTag215';
      }

      const manufacturerId = typeof uidBytes[0] === 'number' ? uidBytes[0] : (Array.isArray(uidBytes) ? uidBytes[0] : 0);
      let manufacturer = 'Tidak Diketahui';
      if (manufacturerId === 4) {
        manufacturer = 'NXP Semiconductors';
      }

      const cardInfo: NFCCardInfo = {
        id: cardId,
        type: cardType,
        techTypes,
        maxSize: tag.maxSize || 888,
        isWritable: true,
        manufacturer
      };

      // Coba baca NDEF data
      let nfcData: NFCData | null = null;
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          const ndefRecord = tag.ndefMessage[0];
          if (ndefRecord && ndefRecord.payload) {
            const payload = ndefRecord.payload;
            const text = String.fromCharCode(...payload.slice(3));
            nfcData = JSON.parse(text); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
            
            // Tambahkan card ID ke data
            if (nfcData) {
              nfcData.cardId = cardId;
              nfcData.cardType = 'physical';
            }
          }
        } catch (parseError) {
          console.warn('⚠️ Tidak bisa parse NDEF data:', parseError); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        }
      }

      console.log('✅ Kartu Fisik dengan Data:', { cardInfo, nfcData }); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return { cardInfo, nfcData };
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Baca Kartu Fisik:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        // Abaikan
      }
      this.isRequestActive = false;
    }
  }

  // =========================================================================
  // METHOD: writePhysicalCard()
  // =========================================================================
  // Tulis data ke physical NFC card (NTag215)
  // Sama seperti writeNFCData() tapi dengan validasi tambahan untuk physical card
  // 
  // Input: NFCData yang akan ditulis ke kartu
  // Output: Objek dengan status success dan card ID
  static async writePhysicalCard(data: NFCData): Promise<{
    success: boolean;
    cardId?: string;
    message?: string;
  }> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      if (this.isRequestActive) {
        return {
          success: false,
          message: 'Request NFC sedang berlangsung'
        };
      }

      this.isRequestActive = true;

      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        // Abaikan
      }

      // Request teknologi Ndef untuk write
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Dekatkan kartu NFC untuk menulis data...'
      });
      
      // Ambil tag untuk mendapat UID
      const tag = await NfcManager.getTag();
      const cardId = tag?.id ? (Array.isArray(tag.id) ? this.bytesToHexString(tag.id) : String(tag.id)) : undefined; // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string

      // Tambahkan info kartu ke data
      const dataToWrite = {
        ...data,
        cardId,
        cardType: 'physical' as const
      };

      // Encode dan tulis
      const bytes = Ndef.encodeMessage([
        Ndef.textRecord(JSON.stringify(dataToWrite)) // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
      ]);

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        console.log('✅ Kartu Fisik Berhasil Ditulis:', dataToWrite); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        return {
          success: true,
          cardId,
          message: 'Data berhasil ditulis ke kartu'
        };
      }

      return {
        success: false,
        message: 'Gagal encode data'
      };
      
    } catch (error: any) { // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
      console.log('Error Tulis Kartu Fisik:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return {
        success: false,
        message: error?.message || 'Gagal menulis ke kartu'
      };
      
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest();
      } catch (e) {
        // Abaikan
      }
      this.isRequestActive = false;
    }
  }

  // =========================================================================
  // HELPER METHOD: bytesToHexString()
  // =========================================================================
  // Convert array of bytes ke hex string
  // Contoh: [0x04, 0xE1, 0x2A] => "04E12A"
  private static bytesToHexString(bytes: number[]): string { // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
    return bytes
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase()) // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      .join('');
  }

  // =========================================================================
  // METHOD: cleanup()
  // =========================================================================
  // Cleanup semua NFC resources
  // Dipanggil saat aplikasi unmount atau user logout
  // Penting untuk prevent memory leak!
  static cleanup(): void {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Stop scanning interval jika masih jalan
      if ((this as any)._scanInterval) {
        clearInterval((this as any)._scanInterval);
        (this as any)._scanInterval = null;
      }
      
      // STEP 2: Cancel technology request (release NFC resource)
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        NfcManager.cancelTechnologyRequest();
      } catch (cancelError) {
        // Abaikan error cancel
      }

      // Reset flag request active
      this.isRequestActive = false;
      
      console.log('🧹 Resource NFC berhasil dibersihkan.'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Cleanup NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    }
  }
}
