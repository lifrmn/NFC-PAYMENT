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
export interface NFCData { // export interface NFCData: mendefinisikan struktur data yang dibaca dari tag NFC; TypeScript menjamin konsistensi tipe di seluruh aplikasi
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
export interface NFCCardInfo { // export interface NFCCardInfo: mendefinisikan struktur informasi kartu NFC yang dikembalikan dari backend
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
export class NFCService { // kelas NFCService berisi semua metode untuk interaksi dengan hardware NFC; menggunakan static methods karena tidak perlu instance
  // Flag untuk track apakah ada NFC request yang sedang berjalan
  // Mencegah multiple request bersamaan (race condition)
  private static isRequestActive = false; // Awalnya tidak ada request aktif
  // =========================================================================
  // METHOD: initNFC()
  // =========================================================================
  // Inisialisasi NFC service saat aplikasi pertama kali jalan
  // Return: true jika NFC berhasil diinit, false jika tidak support/error
  static async initNFC(): Promise<boolean> { // static initNFC: menginisialisasi NFC manager; static karena tidak perlu membuat instance NFCService
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Cek apakah running di Expo Go atau development mode
      // Expo Go tidak support native module NFC, jadi return false
      // __DEV__ adalah flag bawaan React Native untuk mode development
      if (__DEV__ && !Platform.select({ android: true, ios: true })) { // __DEV__: variabel Expo yang true saat development; Platform.select deteksi platform; kondisi untuk skip NFC di simulator/web
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
        
      } catch (startError: any) { // catch startError: menangkap error saat NFC hardware start; any karena bisa berbagai tipe error native
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
  static async checkNFCEnabled(): Promise<boolean> { // static checkNFCEnabled: memeriksa apakah NFC diaktifkan di pengaturan perangkat; dipanggil sebelum operasi NFC
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
  static async writeNFCData(data: NFCData): Promise<boolean> { // static writeNFCData: menulis data ke tag NFC menggunakan protokol NDEF; data diserialisasi ke format NDEF record
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Request akses ke NFC technology (NDEF format)
      // NDEF = NFC Data Exchange Format (standar format data NFC)
      await NfcManager.requestTechnology(NfcTech.Ndef); // requestTechnology(NfcTech.Ndef): meminta akses teknologi NDEF pada tag NFC; NDEF adalah format data standar untuk NFC
      
      // STEP 2: Encode data jadi NDEF message
      // - Convert object jadi JSON string
      // - Wrap dalam text record NDEF
      // - Encode jadi bytes untuk ditulis ke tag
      const bytes = Ndef.encodeMessage([Ndef.textRecord(JSON.stringify(data))]); // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request

      // STEP 3: Cek apakah encoding berhasil
      if (bytes) { // memeriksa apakah bytes tidak null sebelum menulis; null berarti encoding gagal; pengecekan mencegah write data kosong
        // STEP 4: Tulis bytes ke NFC tag
        // User harus menempelkan HP ke tag NFC saat proses ini
        await NfcManager.ndefHandler.writeNdefMessage(bytes); // writeNdefMessage: menulis pesan NDEF ke tag NFC; bytes adalah array byte hasil encoding data yang ingin ditulis
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
      await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
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
  static async readNFCData(): Promise<NFCData | null> { // static readNFCData: membaca data NDEF dari tag NFC; mengembalikan objek NFCData atau null jika gagal
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Cek apakah ada request yang sedang aktif
      if (this.isRequestActive) { // memeriksa apakah sudah ada operasi NFC aktif; mencegah dua operasi NFC berjalan bersamaan yang bisa menyebabkan error
        console.log('⚠️ Request NFC sedang berlangsung'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      this.isRequestActive = true; // mengeset flag menjadi true sebelum operasi NFC; flag ini digunakan untuk mencegah concurrent requests

      // STEP 1: Cancel request sebelumnya jika ada
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
        // Abaikan jika tidak ada request untuk di-cancel
      }

      // STEP 2: Request akses ke teknologi NFC (format NDEF)
      await NfcManager.requestTechnology(NfcTech.Ndef, { // requestTechnology dengan options: meminta akses NFC dengan pesan alert yang ditampilkan ke user di iOS
        alertMessage: 'Dekatkan HP ke NFC tag...' // alertMessage: pesan yang muncul di iOS saat menunggu tap NFC; memberikan instruksi kepada user
      });
      
      // STEP 3: Ambil tag yang terdeteksi
      // getTag() akan return objek tag dengan semua data
      const tag = await NfcManager.getTag(); // getTag(): menunggu sampai tag NFC terdeteksi dan mengembalikan data tag; await karena operasi fisik yang memerlukan waktu

      // STEP 4: Validasi tag
      // Cek apakah tag ada dan punya NDEF message
      if (!tag || !tag.ndefMessage) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.warn('⚠️ No NFC tag data found'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      // STEP 5: Ambil NDEF record pertama
      // NDEF message bisa punya multiple records, kita ambil yang pertama
      const ndefRecord = tag.ndefMessage[0]; // mengambil record NDEF pertama dari pesan NDEF; [0] karena kartu NFC umumnya hanya memiliki satu record
      if (!ndefRecord || !ndefRecord.payload) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.warn('⚠️ Empty NFC payload'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      // STEP 6: Decode payload
      // Format payload NDEF text record:
      // - Byte 0: Status byte (encoding + panjang bahasa)
      // - Byte 1-2: Kode bahasa (contoh: "en")
      // - Byte 3+: Data teks sebenarnya (JSON string kita)
      const payload = ndefRecord.payload; // payload: array byte yang berisi data aktual yang tersimpan di tag NFC; perlu didekode untuk mendapatkan string
      
      // Skip 3 bytes pertama (status + prefix bahasa)
      // Convert sisanya jadi string
      const text = String.fromCharCode(...payload.slice(3)); // String.fromCharCode: mengkonversi array byte ke string; slice(3) melewati 3 byte header NDEF (status byte, language code)
      
      // STEP 7: Parse JSON string jadi object
      const data: NFCData = JSON.parse(text); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan

      console.log('✅ NFC Tag Read:', data); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return data; // mengembalikan objek NFCData yang sudah diparsing; berisi id, type, manufacturer, dan data kartu NFC
      
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
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (cancelError) { // catch cancelError: menangkap error saat membatalkan request NFC; error ini diabaikan karena cancel adalah operasi cleanup
        // Abaikan error cancel
      }
      this.isRequestActive = false; // mengeset flag kembali ke false setelah operasi selesai; mengizinkan operasi NFC berikutnya untuk berjalan
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
  static async startNFCScanning( // static startNFCScanning: memulai proses scanning NFC secara berkelanjutan; dipanggil untuk mode scan aktif
    onTagDetected: (data: NFCData | null) => void, // onTagDetected: callback fungsi yang dipanggil setiap kali tag NFC terdeteksi; NFCData | null karena mungkin gagal baca
    onError?: (error: any) => void // onError: callback opsional (tanda ?) untuk menangani error saat scanning; dipanggil jika terjadi error
  ): Promise<void> { // Promise<void>: metode async yang tidak mengembalikan nilai; digunakan untuk operasi side-effect
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Define function untuk scan tag
      const scanForTag = async () => { // scanForTag: fungsi async dalam untuk satu siklus scan; dipanggil berulang oleh interval
        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          // Coba baca NFC tag
          const data = await this.readNFCData(); // const data: menyimpan data yang diambil secara async dari API atau database
          
          // Kalau ada data, panggil callback
          if (data) onTagDetected(data); // if (data): memanggil callback onTagDetected hanya jika data berhasil dibaca; mencegah callback dengan null jika scan gagal
        } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
          console.log('Error membaca data NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        }
      };

      // STEP 2: Setup interval untuk scan berulang
      // Scan setiap 1.5 detik (1500ms)
      // Tidak terlalu cepat (hemat baterai) tapi cukup responsif
      const interval = setInterval(scanForTag, 1500); // setInterval: menjalankan scanForTag setiap 1500ms (1.5 detik); interval membuat scanning terus-menerus secara berkala
      
      // STEP 3: Simpan interval ID untuk bisa di-stop nanti
      // Simpan di class property (hack dengan type any)
      (this as any)._scanInterval = interval; // (this as any): type assertion untuk bypass TypeScript pada dynamic property; _scanInterval menyimpan ID interval untuk bisa di-clear nanti
      
      console.log('✅ Scanning NFC dimulai...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Scanning NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      // Cleanup: Clear interval jika ada error untuk mencegah memory leak
      if ((this as any)._scanInterval) { // memeriksa apakah ada interval scanning aktif sebelum mencoba menghapusnya; mencegah error clearInterval dengan nilai undefined
        clearInterval((this as any)._scanInterval); // clearInterval: menghentikan interval yang berjalan; wajib dipanggil untuk mencegah memory leak saat stop scanning
        (this as any)._scanInterval = null; // mengeset _scanInterval ke null setelah dihentikan; menandakan tidak ada scanning aktif; mencegah clearInterval duplikat
      }
      
      // Kalau ada error callback, panggil
      if (onError) onError(error); // memanggil callback onError hanya jika diberikan (opsional); memberitahu pemanggil tentang error tanpa memaksa error handling
    }
  }

  // =========================================================================
  // METHOD: stopNFCScanning()
  // =========================================================================
  // Stop continuous NFC scanning
  // Dipanggil saat user keluar dari screen atau transaksi selesai
  static async stopNFCScanning(): Promise<void> { // static stopNFCScanning: menghentikan scanning NFC yang sedang berjalan; membersihkan interval dan melepas kunci NFC
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      console.log('🛑 Stopping NFC scanning...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
      // STEP 1: Cek apakah ada interval yang jalan
      if ((this as any)._scanInterval) { // memeriksa apakah ada interval scanning aktif sebelum mencoba menghapusnya; mencegah error clearInterval dengan nilai undefined
        // STEP 2: Clear interval untuk stop scanning loop
        clearInterval((this as any)._scanInterval); // clearInterval: menghentikan interval yang berjalan; wajib dipanggil untuk mencegah memory leak saat stop scanning
        
        // STEP 3: Reset interval ID
        (this as any)._scanInterval = null; // mengeset _scanInterval ke null setelah dihentikan; menandakan tidak ada scanning aktif; mencegah clearInterval duplikat
        
        console.log('✅ NFC scan interval cleared'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }
      
      // STEP 4: Cancel technology request (release NFC resource)
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
        console.log('✅ Request teknologi NFC dibatalkan'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      } catch (cancelError) { // catch cancelError: menangkap error saat membatalkan request NFC; error ini diabaikan karena cancel adalah operasi cleanup
        // Abaikan error cancel (mungkin tidak ada yang aktif)
        console.log('ℹ️ Tidak ada request NFC aktif untuk dibatalkan'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }

      // STEP 5: Reset flag request active
      this.isRequestActive = false; // mengeset flag kembali ke false setelah operasi selesai; mengizinkan operasi NFC berikutnya untuk berjalan
      
      console.log('✅ Scanning NFC berhasil dihentikan'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('⚠️ Error Hentikan Scanning NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      // Paksa reset flag meski ada error
      this.isRequestActive = false; // mengeset flag kembali ke false setelah operasi selesai; mengizinkan operasi NFC berikutnya untuk berjalan
    }
  }

  // =========================================================================
  // METHOD: enableP2P()
  // =========================================================================
  // Aktifkan mode Peer-to-Peer untuk NFC
  // P2P = Komunikasi Phone-to-Phone (tanpa tag fisik)
  // CATATAN: Fitur ini advanced, untuk skripsi mungkin tidak perlu dipakai
  static async enableP2P(): Promise<void> { // static enableP2P: mengaktifkan mode peer-to-peer NFC untuk komunikasi device-to-device; digunakan untuk beberapa mode NFC
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Request 2 teknologi sekaligus:
      // - Ndef: Untuk pertukaran data
      // - IsoDep: Untuk protokol komunikasi
      await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.IsoDep]); // requestTechnology dengan array: meminta akses beberapa teknologi NFC sekaligus; IsoDep untuk kartu chip, NDEF untuk data
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
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
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
      ]) as any; // as any: type assertion TypeScript untuk melewati pengecekan tipe; digunakan karena tipe native NFC tidak selalu tersedia

      if (!tag || !tag.id) { // ! membalik boolean; !tag berarti null; !tag.id berarti tidak ada UID — kartu tidak terdeteksi
        console.warn('⚠️ No NFC card detected'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null memberitahu pemanggil bahwa tidak ada kartu
      }

      const uidBytes = tag.id as any; // mengambil UID kartu sebagai array byte; as any mengabaikan type check TypeScript
      const cardId = Array.isArray(uidBytes) ? this.bytesToHexString(uidBytes) : String(uidBytes); // ternary operator: jika array byte, konversi ke hex string; jika bukan, konversi langsung ke string

      const techTypes = tag.techTypes || []; // mengambil daftar teknologi NFC; || [] fallback jika techTypes tidak ada

      let cardType = 'Tidak Diketahui'; // let karena nilai akan berubah tergantung tipe kartu yang terdeteksi
      if (techTypes.includes('android.nfc.tech.NfcA') ||  // memeriksa apakah kartu mendukung NfcA (ISO14443 Type A); || untuk multiple kondisi; NfcA adalah teknologi kartu NFC paling umum
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
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
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
  static async readPhysicalCardWithData(): Promise<{ // static readPhysicalCardWithData: membaca kartu fisik NFC dan mendapatkan info hardware PLUS data NDEF sekaligus dalam satu tap
    cardInfo: NFCCardInfo; // cardInfo: field dalam return type; berisi informasi hardware kartu seperti UID, tipe chip, dan kapasitas
    nfcData: NFCData | null; // nfcData: field dalam return type; data NDEF yang tersimpan di kartu; null jika kartu kosong atau tidak mendukung NDEF
  } | null> { // | null: return type bisa null jika terjadi error; pemanggil harus cek null sebelum menggunakan data
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      if (this.isRequestActive) { // memeriksa apakah sudah ada operasi NFC aktif; mencegah dua operasi NFC berjalan bersamaan yang bisa menyebabkan error
        console.log('⚠️ Request NFC sedang berlangsung'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      this.isRequestActive = true; // mengeset flag menjadi true sebelum operasi NFC; flag ini digunakan untuk mencegah concurrent requests

      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
        // Abaikan
      }

      // Request multiple teknologi untuk baca UID dan NDEF
      await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.Ndef], { // requestTechnology dengan [NfcA, Ndef]: NfcA untuk baca UID hardware, Ndef untuk baca data; dua teknologi digunakan bersamaan
        alertMessage: 'Dekatkan kartu NFC ke HP...' // alertMessage: pesan instruksi yang muncul di iOS saat menunggu tap kartu; memberikan panduan visual kepada user
      });
      
      const tag = await NfcManager.getTag(); // getTag(): menunggu sampai tag NFC terdeteksi dan mengembalikan data tag; await karena operasi fisik yang memerlukan waktu

      if (!tag || !tag.id) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
        console.warn('⚠️ No NFC card detected'); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      }

      // Ekstrak info kartu (UID, type, dll)
      const uidBytes = tag.id as any; // tag.id: array byte yang merepresentasikan UID (Unique ID) kartu NFC dari hardware; as any untuk bypass TypeScript
      const cardId = Array.isArray(uidBytes) ? this.bytesToHexString(uidBytes) : String(uidBytes); // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
      const techTypes = tag.techTypes || []; // tag.techTypes: array string teknologi NFC yang didukung kartu; || [] fallback array kosong jika techTypes tidak ada

      let cardType = 'Tidak Diketahui'; // let cardType: variabel mutable untuk tipe kartu; dimulai 'Tidak Diketahui' dan akan diubah berdasarkan techTypes yang terdeteksi
      if (techTypes.includes('android.nfc.tech.NfcA') ||  // memeriksa apakah kartu mendukung NfcA (ISO14443 Type A); || untuk multiple kondisi; NfcA adalah teknologi kartu NFC paling umum
          techTypes.includes('android.nfc.tech.MifareUltralight')) { // MifareUltralight: teknologi chip NTag215 dari NXP; keduanya berarti kartu adalah NTag215
        cardType = 'NTag215'; // mengeset cardType ke 'NTag215'; kartu NTag215 adalah chip NFC yang digunakan dalam sistem pembayaran ini
      }

      const manufacturerId = typeof uidBytes[0] === 'number' ? uidBytes[0] : (Array.isArray(uidBytes) ? uidBytes[0] : 0); // typeof cek tipe byte pertama UID; ternary nested untuk handle berbagai format data; angka ini menentukan merek produsen kartu
      let manufacturer = 'Tidak Diketahui'; // let manufacturer: variabel mutable untuk nama produsen kartu; default 'Tidak Diketahui' jika ID tidak dikenali
      if (manufacturerId === 4) { // manufacturer ID 4 adalah kode NXP Semiconductors; NXP adalah produsen utama chip NFC termasuk NTag215
        manufacturer = 'NXP Semiconductors'; // NXP Semiconductors: perusahaan semikonduktor Belanda pembuat chip NTag215 yang digunakan dalam sistem ini
      }

      const cardInfo: NFCCardInfo = { // membuat objek cardInfo bertipe NFCCardInfo; TypeScript memastikan semua field yang didefinisikan interface tersedia
        id: cardId, // id: UID kartu sebagai identifier unik hardware; setiap kartu NFC memiliki UID yang berbeda
        type: cardType, // type: jenis kartu yang terdeteksi berdasarkan techTypes; 'NTag215' atau 'Tidak Diketahui'
        techTypes, // techTypes: shorthand property ES6; array teknologi NFC yang didukung kartu
        maxSize: tag.maxSize || 888, // maxSize: kapasitas penyimpanan NDEF dalam bytes; || 888 adalah default NTag215 jika tidak dilaporkan hardware
        isWritable: true, // isWritable: NTag215 mendukung baca dan tulis; true memungkinkan registrasi data ke kartu
        manufacturer // manufacturer: shorthand property ES6 setara manufacturer: manufacturer; nama produsen chip
      };

      // Coba baca NDEF data
      let nfcData: NFCData | null = null; // nfcData: variabel untuk data NDEF kartu; dimulai null karena kartu mungkin tidak memiliki data NDEF
      if (tag.ndefMessage && tag.ndefMessage.length > 0) { // memeriksa apakah kartu memiliki pesan NDEF; && length > 0 memastikan array tidak kosong sebelum mengakses elemen
        try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
          const ndefRecord = tag.ndefMessage[0]; // mengambil record NDEF pertama dari pesan NDEF; [0] karena kartu NFC umumnya hanya memiliki satu record
          if (ndefRecord && ndefRecord.payload) { // memeriksa apakah record NDEF dan payload-nya ada; optional check mencegah error jika record kosong
            const payload = ndefRecord.payload; // payload: array byte yang berisi data aktual yang tersimpan di tag NFC; perlu didekode untuk mendapatkan string
            const text = String.fromCharCode(...payload.slice(3)); // String.fromCharCode: mengkonversi array byte ke string; slice(3) melewati 3 byte header NDEF (status byte, language code)
            nfcData = JSON.parse(text); // JSON.parse() mengubah string JSON menjadi objek JavaScript; untuk membaca data tersimpan
            
            // Tambahkan card ID ke data
            if (nfcData) { // memeriksa apakah parsing NDEF berhasil; null berarti JSON.parse gagal atau string kosong
              nfcData.cardId = cardId; // menambahkan UID hardware ke objek nfcData; menghubungkan data NDEF dengan identitas fisik kartu
              nfcData.cardType = 'physical'; // mengeset cardType 'physical' untuk membedakan dari data simulasi; menandakan dari kartu fisik
            }
          }
        } catch (parseError) { // catch parseError: menangkap error saat parsing NDEF; error ini tidak kritis karena kartu mungkin tidak memiliki data NDEF
          console.warn('⚠️ Tidak bisa parse NDEF data:', parseError); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        }
      }

      console.log('✅ Kartu Fisik dengan Data:', { cardInfo, nfcData }); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return { cardInfo, nfcData }; // mengembalikan objek dengan dua field: cardInfo (info hardware) dan nfcData (data NDEF); shorthand property ES6
      
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Baca Kartu Fisik:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return null; // return null: komponen tidak merender apapun ke layar (kondisi tertentu tidak menampilkan UI)
      
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
        // Abaikan
      }
      this.isRequestActive = false; // mengeset flag kembali ke false setelah operasi selesai; mengizinkan operasi NFC berikutnya untuk berjalan
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
  static async writePhysicalCard(data: NFCData): Promise<{ // static writePhysicalCard: menulis data NFCData ke kartu fisik; Promise<{ success, cardId?, message? }> untuk hasil terstruktur
    success: boolean; // success: field boolean dalam return type; true jika penulisan berhasil, false jika gagal
    cardId?: string; // cardId?: field opsional (tanda ?) dalam return type; berisi UID kartu jika penulisan berhasil
    message?: string; // message?: field opsional dalam return type; berisi pesan sukses atau deskripsi error
  }> {
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      if (this.isRequestActive) { // memeriksa apakah sudah ada operasi NFC aktif; mencegah dua operasi NFC berjalan bersamaan yang bisa menyebabkan error
        return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
          success: false, // success: false menandakan request NFC sedang dipakai proses lain; tidak bisa diproses sekarang
          message: 'Request NFC sedang berlangsung' // pesan error ketika ada operasi NFC aktif; user perlu tunggu proses sebelumnya selesai
        };
      }

      this.isRequestActive = true; // mengeset flag menjadi true sebelum operasi NFC; flag ini digunakan untuk mencegah concurrent requests

      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
        // Abaikan
      }

      // Request teknologi Ndef untuk write
      await NfcManager.requestTechnology(NfcTech.Ndef, { // requestTechnology dengan options: meminta akses NFC dengan pesan alert yang ditampilkan ke user di iOS
        alertMessage: 'Dekatkan kartu NFC untuk menulis data...' // alertMessage saat penulisan: instruksi kepada user untuk mendekatkan kartu NFC ke perangkat agar data bisa ditulis
      });
      
      // Ambil tag untuk mendapat UID
      const tag = await NfcManager.getTag(); // getTag(): menunggu sampai tag NFC terdeteksi dan mengembalikan data tag; await karena operasi fisik yang memerlukan waktu
      const cardId = tag?.id ? (Array.isArray(tag.id) ? this.bytesToHexString(tag.id) : String(tag.id)) : undefined; // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string

      // Tambahkan info kartu ke data
      const dataToWrite = { // dataToWrite: objek data yang akan ditulis ke kartu; spread operator menyalin semua properti dari input data
        ...data, // ...data spread operator menyalin semua properti NFCData yang ada ke objek baru; ES6 object spread
        cardId, // cardId: shorthand property menambahkan UID kartu fisik ke data; memastikan data teridentifikasi dengan kartu ini
        cardType: 'physical' as const // 'physical' as const: literal type TypeScript; menandakan data dari kartu fisik bukan simulasi
      };

      // Encode dan tulis
      const bytes = Ndef.encodeMessage([ // Ndef.encodeMessage: mengkonversi array NDEF record menjadi array byte; bytes inilah yang ditulis ke memori kartu NFC
        Ndef.textRecord(JSON.stringify(dataToWrite)) // JSON.stringify() mengubah objek JavaScript menjadi string JSON; untuk logging atau API request
      ]);

      if (bytes) { // memeriksa apakah bytes tidak null sebelum menulis; null berarti encoding gagal; pengecekan mencegah write data kosong
        await NfcManager.ndefHandler.writeNdefMessage(bytes); // writeNdefMessage: menulis pesan NDEF ke tag NFC; bytes adalah array byte hasil encoding data yang ingin ditulis
        console.log('✅ Kartu Fisik Berhasil Ditulis:', dataToWrite); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        
        return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
          success: true, // success: true menandakan penulisan data ke kartu NFC berhasil dilakukan
          cardId, // cardId: shorthand property menyertakan UID kartu yang berhasil ditulis
          message: 'Data berhasil ditulis ke kartu' // pesan sukses yang ditampilkan ke user setelah kartu berhasil ditulis
        };
      }

      return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
        success: false, // success: false karena encoding data NDEF gagal; bytes bernilai falsy
        message: 'Gagal encode data' // pesan error ketika Ndef.encodeMessage mengembalikan null atau array kosong
      };
      
    } catch (error: any) { // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
      console.log('Error Tulis Kartu Fisik:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return { // return { }: mengembalikan objek berisi properti-properti yang relevan dari fungsi ini
        success: false, // success: false karena terjadi exception saat penulisan ke kartu NFC
        message: error?.message || 'Gagal menulis ke kartu' // error?.message: optional chaining mengambil pesan error; || memberikan fallback jika message tidak ada
      };
      
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        await NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci NFC setelah operasi selesai; wajib dipanggil untuk mencegah NFC tetap terkunci
      } catch (e) { // catch (e): menangkap error saat membatalkan request NFC sebelumnya; diabaikan karena tidak kritis
        // Abaikan
      }
      this.isRequestActive = false; // mengeset flag kembali ke false setelah operasi selesai; mengizinkan operasi NFC berikutnya untuk berjalan
    }
  }

  // =========================================================================
  // HELPER METHOD: bytesToHexString()
  // =========================================================================
  // Convert array of bytes ke hex string
  // Contoh: [0x04, 0xE1, 0x2A] => "04E12A"
  private static bytesToHexString(bytes: number[]): string { // String() mengkonversi nilai ke tipe string; digunakan saat perlu teks dari nilai non-string
    return bytes // bytes: array number yang akan dikonversi; return value chain dimulai di sini
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase()) // toString(16) konversi angka ke hex; padStart(2,'0') tambah leading zero; toUpperCase agar format konsisten "04E12A"
      .join(''); // join('') menggabungkan semua string hex menjadi satu string tanpa pemisah; menghasilkan UID format hex seperti "04E12A5F"
  }

  // =========================================================================
  // METHOD: cleanup()
  // =========================================================================
  // Cleanup semua NFC resources
  // Dipanggil saat aplikasi unmount atau user logout
  // Penting untuk prevent memory leak!
  static cleanup(): void { // static cleanup: membersihkan semua resource NFC; dipanggil saat app unmount atau logout untuk mencegah memory leak
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // STEP 1: Stop scanning interval jika masih jalan
      if ((this as any)._scanInterval) { // memeriksa apakah ada interval scanning aktif sebelum mencoba menghapusnya; mencegah error clearInterval dengan nilai undefined
        clearInterval((this as any)._scanInterval); // clearInterval: menghentikan interval yang berjalan; wajib dipanggil untuk mencegah memory leak saat stop scanning
        (this as any)._scanInterval = null; // mengeset _scanInterval ke null setelah dihentikan; menandakan tidak ada scanning aktif; mencegah clearInterval duplikat
      }
      
      // STEP 2: Cancel technology request (release NFC resource)
      try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
        NfcManager.cancelTechnologyRequest(); // cancelTechnologyRequest: melepaskan kunci teknologi NFC; wajib dipanggil agar NFC tidak terkunci setelah selesai digunakan
      } catch (cancelError) { // catch cancelError: menangkap error saat membatalkan request NFC; error ini diabaikan karena cancel adalah operasi cleanup
        // Abaikan error cancel
      }

      // Reset flag request active
      this.isRequestActive = false; // mengeset flag kembali ke false setelah operasi selesai; mengizinkan operasi NFC berikutnya untuk berjalan
      
      console.log('🧹 Resource NFC berhasil dibersihkan.'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    } catch (error) { // catch (error): menangkap semua error dari blok try untuk penanganan yang aman
      console.log('Error Cleanup NFC:', error); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    }
  }
}
