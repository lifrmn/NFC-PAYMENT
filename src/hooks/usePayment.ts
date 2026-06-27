// src/hooks/usePayment.ts
// ==================================================================================
// 💳 HOOK KUSTOM: usePayment
// ==================================================================================
//
// Tujuan Hook:
// Hook React kustom untuk menangani logika proses pembayaran kompleks dengan kartu NFC fisik.
// Implementasi alur pembayaran pedagang: Penjual scan kartu Pembeli untuk terima bayaran.
//
// Alur Bisnis:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ SKENARIO PEMBAYARAN PEDAGANG:                                          │
// │                                                                   │
// │ 1. Penjual (Pedagang) input jumlah Rp 50.000                      │
// │ 2. Penjual ketuk tombol "Terima Pembayaran"                       │
// │ 3. Peringatan muncul: "Scan Kartu Pembeli"                        │
// │ 4. Pembeli dekatkan kartu NFC ke HP Penjual                       │
// │ 5. Sistem baca UID kartu Pembeli                                  │
// │ 6. Sistem validasi: terdaftar? aktif? saldo cukup?              │
// │ 7. Sistem ambil kartu Penjual dari database (deteksi otomatis)    │
// │ 8. Sistem proses pembayaran: Pembeli → Penjual                   │
// │ 9. Backend perbarui saldo + cek penipuan                          │
// │ 10. Peringatan sukses dengan info transaksi                       │
// └─────────────────────────────────────────────────────────────────────┘
//
// Fitur Utama:
// 1. Pemindaian Kartu Fisik: Baca kartu NFC dari Pembeli
// 2. Validasi Multi-tingkat:
//    - Kartu pembeli terdaftar & aktif
//    - Saldo pembeli mencukupi
//    - Mencegah pembayaran diri sendiri
//    - Kartu penerima ada & aktif
// 3. Deteksi Otomatis Kartu Penerima: Ambil dari database (tanpa scan manual)
// 4. Integrasi Deteksi Penipuan: Cek skor penipuan setelah pembayaran
// 5. Penyegaran Saldo: Perbarui saldo otomatis setelah sukses
// 6. Penanganan Error Menyeluruh:
//    - Pembatalan oleh pengguna
//    - Kesalahan jaringan
//    - Pembatasan laju permintaan (429)
//    - Akun diblokir
//    - Saldo tidak cukup
//    - Kartu tidak ditemukan/tidak aktif
//
// Diagram Alur Pembayaran:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ MASUKAN PENGGUNA                                                     │
// │   ↓                                                             │
// │ KONFIRMASI PERINGATAN ("Scan Kartu Pembeli") ──> Batal? ──> BERHENTI │
// │   ↓ Pengguna klik "Siap"                                       │
// │ SCAN KARTU PEMBELI (Perangkat NFC) ──> Gagal? ──> BERHENTI     │
// │   ↓                                                             │
// │ VALIDASI KARTU PEMBELI (API) ──> Tidak terdaftar? ──> BERHENTI │
// │   ↓                          ─> Tidak aktif? ──> BERHENTI      │
// │   ↓                          ─> Bayar sendiri? ──> BERHENTI    │
// │   ↓                          ─> Saldo kurang? ──> BERHENTI     │
// │ AMBIL KARTU PENERIMA (API) ──> Tidak ada kartu? ──> BERHENTI  │
// │   ↓                        ─> Tidak ada kartu aktif? ──> BERHENTI│
// │ PROSES PEMBAYARAN (API Backend)                                  │
// │   ↓                                                             │
// │ CEK Z-SCORE FRAUD DETECTION:                                     │
// │   - Z > 3 (ANOMALY/BLOCK): Diblokir backend, tidak sampai di sini │
// │   - Z > 2 (SUSPICIOUS/REVIEW): Diterima, ditandai untuk review    │
// │   - Z ≤ 2 (NORMAL/ALLOW): Sukses normal                           │
// │   ↓                                                             │
// │ SEGARKAN SALDO (callback onSuccess)                             │
// │   ↓                                                             │
// │ TAMPILKAN PERINGATAN SUKSES                                     │
// └─────────────────────────────────────────────────────────────────────┘
//
// Manajemen State:
// - isProcessing: flag boolean untuk mencegah pembayaran bersamaan (penguncian)
//
// Contoh Penggunaan:
// ```tsx
// const { processTapToPayTransfer, isProcessing } = usePayment();
//
// const handleReceivePayment = async () => {
//   const success = await processTapToPayTransfer(
//     currentUserId,
//     50000, // jumlah dalam Rupiah
//     refreshBalance // callback untuk segarkan saldo UI
//   );
//   if (success) {
//     // Navigasi ke layar sukses
//   }
// };
// ```
//
// ==================================================================================

import { useState } from 'react'; // import digunakan untuk mengambil module; useState adalah hook React untuk membuat state lokal dalam komponen atau hook kustom
import { Alert } from 'react-native'; // import Alert dari React Native — digunakan untuk menampilkan dialog konfirmasi dan pesan error ke user dalam format native Android/iOS
import { NFCService } from '../utils/nfc'; // import NFCService dari file lokal nfc.ts — service yang menangani inisialisasi, pembacaan kartu NFC, dan cleanup resource hardware
import { apiService } from '../utils/apiService'; // import apiService — HTTP client Singleton yang menangani semua komunikasi dengan backend Express (validasi kartu, proses payment, refresh saldo)

// ==================================================================================
// HOOK: usePayment
// ==================================================================================
// HASIL KEMBALIAN:
// - isProcessing: boolean - Flag apakah pembayaran sedang diproses
// - processTapToPayTransfer: Fungsi - Fungsi pemrosesan pembayaran utama
// ==================================================================================
export const usePayment = () => {
  // STATE: isProcessing - Flag kunci untuk mencegah pembayaran ganda
  // true = pembayaran sedang diproses, tombol dinonaktifkan
  // false = siap proses pembayaran baru
  // Penting untuk mencegah pengguna mengetuk tombol bayar berkali-kali
  const [isProcessing, setIsProcessing] = useState(false); // const membuat variabel tetap; useState(false) membuat state boolean; isProcessing=true mengunci hook agar tidak memproses dua pembayaran sekaligus

  // ================================================================================
  // FUNGSI: processTapToPayTransfer
  // ================================================================================
  // Fungsi utama untuk proses pembayaran dengan kartu NFC fisik.
  // Implementasi alur pembayaran pedagang: Penjual scan kartu Pembeli untuk terima bayaran.
  //
  // PARAMETER:
  // @param currentUserId - nomor - ID pengguna yang login (penjual/pedagang)
  // @param amount - nomor - Jumlah pembayaran dalam Rupiah
  // @param onSuccess - Fungsi (opsional) - Callback untuk segarkan saldo setelah sukses
  //
  // HASIL KEMBALIAN:
  // @returns Promise<boolean> - true jika pembayaran berhasil, false jika gagal
  //
  // DETAIL ALUR (8 LANGKAH UTAMA):
  //
  // LANGKAH 1: Peringatan Konfirmasi Pengguna
  //   - Tampilkan peringatan "Scan Kartu Pembeli"
  //   - Tombol: "Batal" (tolak) dan "Siap" (setuju)
  //   - Pengguna bisa membatalkan sebelum scan
  //
  // LANGKAH 2: Scan Kartu Pembeli (NFC Fisik)
  //   - Panggil NFCService.readPhysicalCard()
  //   - Baca UID dari kartu pembeli
  //   - Validasi kartu terbaca
  //
  // LANGKAH 3: Validasi Kartu Pembeli (API Backend)
  //   - API: GET /api/nfc-cards/info/{cardId}
  //   - Cek: terdaftar? aktif? pemilik?
  //   - Validasi: bukan bayar sendiri
  //   - Cek: saldo mencukupi
  //
  // LANGKAH 4: Ambil Kartu Penerima (Deteksi Otomatis)
  //   - API: GET /api/users/{userId}/cards
  //   - Temukan kartu AKTIF dari penjual
  //   - Tidak perlu scan manual (berbeda dari pembeli)
  //
  // LANGKAH 5: Proses Pembayaran (Backend)
  //   - API: POST /api/nfc-cards/payment
  //   - Transfer: buyer balance -> receiver balance
  //   - Create transaction record
  //   - Run fraud detection
  //
  // STEP 6: Handle Z-Score Anomaly Detection Result
  //   - Z ≤ 2: ALLOW / NORMAL
  //   - 2 < Z ≤ 3: REVIEW / SUSPICIOUS
  //   - Z > 3: BLOCK / ANOMALY
  //   - σ = 0 dan X = μ: ALLOW
  //   - σ = 0 dan X ≠ μ: BLOCK
  //
  // STEP 7: Refresh Balance
  //   - Call onSuccess() callback
  //   - Update balance di UI
  //
  // STEP 8: Show Result Alert
  //   - Display transaction info
  //   - Show new balances
  //
  // ERROR SCENARIOS:
  // - USER_CANCELLED: User tap "Batal" di alert
  // - Card not readable: NFC hardware error
  // - Card not registered: Card belum didaftarkan
  // - Card not active: Card status bukan ACTIVE
  // - Self-payment: Buyer = Receiver
  // - Insufficient balance: Saldo pembeli tidak cukup
  // - No receiver card: Penjual belum punya card
  // - Network error: Backend tidak bisa diakses
  // - Rate limiting (429): Terlalu banyak request
  // - Account banned: User di-ban karena fraud
  // ================================================================================
  const processTapToPayTransfer = async (
    currentUserId: number, // tipe number: ID user penjual yang menerima pembayaran
    amount: number, // tipe number: nominal transaksi dalam Rupiah
    onSuccess?: () => void // ? berarti opsional; callback dipanggil setelah transaksi berhasil untuk refresh saldo
  ): Promise<boolean> => { // : Promise<boolean> adalah return type — fungsi ini mengembalikan true jika berhasil, false jika gagal
    setIsProcessing(true); // setIsProcessing(true) mengaktifkan kunci — mencegah double-tap tombol bayar

    try {
      // STEP 1: User Confirmation Alert
      // Show alert untuk konfirmasi sebelum scan
      // User bisa cancel jika berubah pikiran
      // 
      // Alert.alert() dengan Promise pattern:
      // - new Promise<void>((resolve, reject))
      // - Resolve jika user tap "Siap"
      // - Reject dengan error 'USER_CANCELLED' jika user tap "Batal"
      // - await Promise akan block execution sampai user pilih
      await new Promise<void>((resolve, reject) => { // new Promise(executor) membuat Promise baru; <void> berarti Promise tidak mengembalikan nilai; (resolve, reject) adalah dua callback: resolve=sukses, reject=error
        Alert.alert(
          '\ud83d\udcb3 Scan Kartu Pembeli',
          'Tempelkan kartu NFC PEMBELI ke HP Anda untuk menerima pembayaran',
          [
            { 
              text: 'Batal', 
              style: 'cancel',
              onPress: () => reject(new Error('USER_CANCELLED')) // reject(new Error('USER_CANCELLED')) menandai Promise sebagai gagal; error akan ditangkap oleh catch
            },
            { text: 'Siap', onPress: () => resolve() } // resolve() menandai Promise sebagai berhasil; eksekusi lanjut ke baris berikutnya
          ]
        );
      });

      // STEP 2: Scan Buyer Card (Physical NFC)
      // Call NFCService.readPhysicalCard() untuk baca UID kartu pembeli
      // NFCService akan:
      // 1. Enable NFC hardware
      // 2. Wait for card detection (blocking)
      // 3. Read UID dari NFC chip
      // 4. Return object { id: "UID_STRING" } atau null jika gagal
      const buyerCard = await NFCService.readPhysicalCard(); // await menunggu user menempelkan kartu NFC; NFCService.readPhysicalCard() mengaktifkan hardware NFC dan menunggu deteksi kartu
      
      if (!buyerCard) { // !buyerCard berarti null/undefined — pembacaan gagal (tidak ada kartu atau hardware error)
        Alert.alert('\u274c Kartu Pembeli Tidak Terbaca', 'Coba lagi.');
        setIsProcessing(false); // setIsProcessing(false) melepas kunci sebelum return
        return false; // return false memberitahu pemanggil bahwa pembayaran gagal
      }

      console.log('💳 Buyer card scanned:', buyerCard.id);

      // STEP 3: Validate Buyer Card (Backend API)
      // API Call: GET /api/nfc-cards/info/{cardId}
      // Backend akan:
      // 1. Query database: SELECT * FROM nfc_cards WHERE card_uid = cardId
      // 2. JOIN dengan users table untuk get user info
      // 3. Return card info + user info + balance
      // 
      // Response format:
      // {
      //   success: boolean,
      //   card: {
      //     card_uid: string,
      //     cardStatus: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED',
      //     userId: number,
      //     userName: string,
      //     user: {
      //       id: number,
      //       name: string,
      //       balance: number  // IMPORTANT: Saldo USER, bukan saldo card
      //     }
      //   }
      // }
      const buyerCheck = await apiService.get(`/api/nfc-cards/info/${buyerCard.id}`); // await HTTP GET; template literal ${buyerCard.id} menyisipkan UID kartu ke URL endpoint
      
      if (!buyerCheck.success) { // ! membalik boolean; success=false berarti kartu pembeli belum terdaftar di database
        Alert.alert(
          '📝 Kartu Pembeli Belum Terdaftar',
          'Kartu pembeli harus terdaftar di sistem terlebih dahulu.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: card not registered
      }

      if (buyerCheck.card.cardStatus !== 'ACTIVE') { // !== berarti tidak sama; hanya kartu berstatus ACTIVE yang bisa digunakan untuk transaksi
        Alert.alert(
          '🚫 Kartu Pembeli Tidak Aktif',
          `Status: ${buyerCheck.card.cardStatus}\n\nPembeli harus mengaktifkan kartu.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: card not active
      }

      if (buyerCheck.card.userId === currentUserId) { // === berarti sama persis; jika ID pemilik kartu sama dengan ID user saat ini berarti bayar ke diri sendiri — tidak diizinkan
        Alert.alert(
          '⚠️ Tidak Dapat Menerima dari Kartu Sendiri',
          'Kartu pembeli tidak boleh sama dengan kartu Anda.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: self-payment
      }

      // VALIDASI 3.4: Check buyer balance
      // IMPORTANT: Gunakan saldo USER (users.balance), bukan saldo kartu fisik
      // Kenapa?
      // - System ini balance-based: saldo disimpan di tabel users, bukan nfc_cards
      // - Setiap user hanya memiliki satu kartu NFC aktif (policy 1 user = 1 kartu)
      // - Card.balance hanya sinkronisasi tampilan; sumber kebenaran ada di users.balance
      //
      // buyerCheck.card.user.balance = Saldo user pembeli dari users table
      // Fallback ke 0 jika user object tidak ada (safety)
      const buyerBalance = buyerCheck.card.user?.balance || 0; // optional chaining (?.) aman jika user null; || 0 fallback jika balance tidak ada
      if (buyerBalance < amount) { // < berarti kurang dari; saldo pembeli lebih kecil dari nominal pembayaran
        Alert.alert(
          '💰 Saldo Pembeli Tidak Cukup',
          `Saldo Pembeli: Rp ${buyerBalance.toLocaleString('id-ID')}\nJumlah bayar: Rp ${amount.toLocaleString('id-ID')}\n\nPembeli tidak memiliki saldo yang cukup.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: insufficient balance
      }
      
      console.log(`💰 Buyer balance: Rp ${buyerBalance.toLocaleString('id-ID')}`);

      // STEP 4: Get Receiver Card (Auto-detect from Database)
      // Berbeda dari buyer card yang di-scan manual,
      // receiver card diambil otomatis dari database.
      // Kenapa?
      // - Receiver = user yang login (current user)
      // - Tidak perlu scan lagi, sudah tahu user ID nya
      // - Cari kartu ACTIVE pertama dari user ini
      // 
      // API Call: GET /api/users/{userId}/cards
      // Backend akan:
      // 1. Query: SELECT * FROM nfc_cards WHERE userId = currentUserId
      // 2. Return array of cards milik user ini
      // 3. Frontend filter untuk ambil yang ACTIVE
      console.log('🔍 Getting receiver card info...');
      
      let receiverCardsResponse;
      try {
        // Ambil kartu aktif dari user yang login (penerima/penjual)
        receiverCardsResponse = await apiService.get(`/api/users/${currentUserId}/cards`);
        console.log('📥 Receiver cards response:', JSON.stringify(receiverCardsResponse));
      } catch (error: any) {
        // ERROR: Gagal fetch receiver cards
        // Possible causes:
        // - Network error: Backend down atau no internet
        // - Authentication error: Token expired
        // - Server error (500): Database query failed
        console.error('❌ Failed to get receiver cards:', error);
        Alert.alert(
          '❌ Error Koneksi',
          `Gagal mengambil data kartu Anda.\n\nDetail: ${error?.message || 'Unknown error'}\n\nPastikan Anda sudah login dan koneksi internet stabil.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: network error
      }
      
      // VALIDASI 4.1: Check response structure
      // Defensive programming: Validate response sebelum akses properties
      // Kenapa penting?
      // - Backend bisa return response yang unexpected
      // - Network error bisa return HTML error page instead of JSON
      // - Prevent "Cannot read property of undefined" errors
      if (!receiverCardsResponse || typeof receiverCardsResponse !== 'object') {
        console.error('❌ Invalid response structure:', receiverCardsResponse);
        Alert.alert(
          '❌ Error Response',
          'Format response dari server tidak valid. Hubungi admin.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: invalid response
      }
      
      // VALIDASI 4.2: Check if user has any cards
      // Response structure:
      // {
      //   success: boolean,
      //   cards: Array<Card>
      // }
      // 
      // Validation checks:
      // 1. success = true
      // 2. cards property exists
      // 3. cards is array
      // 4. cards array not empty
      if (!receiverCardsResponse.success || !receiverCardsResponse.cards || !Array.isArray(receiverCardsResponse.cards) || receiverCardsResponse.cards.length === 0) {
        console.log('⚠️ No cards found for user:', currentUserId);
        Alert.alert(
          '📝 Anda Belum Punya Kartu Terdaftar',
          'Daftarkan kartu Anda terlebih dahulu di menu "Daftar Kartu" sebelum menerima pembayaran.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: no cards
      }

      // VALIDASI 4.3: Find ACTIVE card
      // Array.find() akan return first match atau undefined jika not found
      // Filter: cardStatus === 'ACTIVE'
      //
      // Policy sistem: setiap user hanya memiliki SATU kartu NFC aktif (1 user = 1 kartu)
      // find() mengambil kartu pertama yang ACTIVE — seharusnya hanya ada satu.
      const receiverCard = receiverCardsResponse.cards.find((c: any) => c.cardStatus === 'ACTIVE'); // .find() mencari elemen pertama yang memenuhi kondisi; (c: any) adalah parameter arrow function; c.cardStatus === 'ACTIVE' adalah kondisi pencarian
      
      // Check apakah ada kartu ACTIVE
      // Jika tidak, berarti user punya cards tapi semua tidak active
      if (!receiverCard) {
        const totalCards = receiverCardsResponse.cards.length;
        const cardStatuses = receiverCardsResponse.cards.map((c: any) => c.cardStatus).join(', ');
        console.log(`⚠️ User has ${totalCards} cards but none are ACTIVE. Statuses: ${cardStatuses}`);
        Alert.alert(
          '🚫 Tidak Ada Kartu Aktif',
          `Anda memiliki ${totalCards} kartu terdaftar, tapi tidak ada yang aktif.\n\nStatus kartu: ${cardStatuses}\n\nAktifkan kartu Anda terlebih dahulu untuk menerima pembayaran.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: no active card
      }

      console.log('📥 Receiver card (auto-detected):', receiverCard.cardId);

      // STEP 5: Process Payment to Backend
      // API Call: POST /api/nfc-cards/payment
      // Backend akan:
      // 1. Validate buyer card & receiver card exists
      // 2. Check buyer balance sufficient
      // 3. Deduct from buyer: buyer.balance -= amount
      // 4. Add to receiver: receiver.balance += amount
      // 5. Create transaction record in transactions table
      // 6. Run fraud detection algorithm (Z-Score)
      // 7. Create fraud alert jika Z-Score > 2 (SUSPICIOUS) atau > 3 (ANOMALY)
      // 8. Return transaction result + Z-Score fraud detection result
      // 
      // Request payload:
      // {
      //   cardId: string,          // Buyer card UID
      //   receiverCardId: string,  // Receiver card ID
      //   amount: number,          // Payment amount in Rupiah
      //   deviceId: string,        // Device identifier (for fraud detection)
      //   description: string      // Transaction description
      // }
      console.log('💸 Processing payment...');
      console.log('📤 Payment data:', {
        buyerCardId: buyerCard.id,
        receiverCardId: receiverCard.cardId,
        amount: amount,
        buyerUserId: buyerCheck.card.userId,
        receiverUserId: currentUserId
      });
      
      let paymentResult;
      try {
        paymentResult = await apiService.post('/api/nfc-cards/payment', { // await HTTP POST ke backend; mengirim data kartu pembeli, penerima, dan nominal transaksi
          cardId: buyerCard.id, // UID kartu pembeli yang di-scan
          receiverCardId: receiverCard.cardId, // ID kartu penerima yang diambil dari database
          amount: amount, // nominal pembayaran dalam Rupiah
          deviceId: 'unknown', // TODO: Get real device ID
          description: 'Merchant payment (receive)' // deskripsi transaksi
        });
        console.log('📥 Payment result:', JSON.stringify(paymentResult));
      } catch (paymentError: any) {
        // ERROR: Payment API failed
        // Possible causes:
        // - Database transaction failed (atomicity issue)
        // - Concurrent payment conflict (race condition)
        // - Server error (500)
        // - Network timeout
        console.error('❌ Payment API error:', paymentError);
        Alert.alert(
          '❌ Pembayaran Gagal',
          `Terjadi kesalahan saat memproses pembayaran.\n\nDetail: ${paymentError?.message || 'Unknown error'}`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return false; // Early return: payment failed
      }

      // STEP 6: Handle Payment Success & Z-Score Fraud Detection
      // Check paymentResult.success untuk determine result
      if (paymentResult && paymentResult.success) {
        // STEP 6.1: Refresh balance setelah transaksi berhasil
        // Call onSuccess() callback untuk update UI
        // onSuccess biasanya fetch latest balance dari backend
        if (onSuccess) { // if memeriksa apakah callback onSuccess diberikan (tidak undefined)
          try {
            await onSuccess(); // await memanggil callback untuk memperbarui saldo di UI setelah transaksi berhasil
          } catch (refreshError) {
            console.error('⚠️ Balance refresh failed:', refreshError);
            // Don't block success flow if refresh fails
            // User will see updated balance on next screen refresh
          }
        }
        
        // STEP 6.2: Tampilkan notifikasi berdasarkan riskLevel Z-Score
        // Backend menggunakan Z-Score Based Anomaly Detection:
        // - Z > 3 (ANOMALY/BLOCK): Transaksi diblokir, tidak sampai di sini
        // - Z > 2 (SUSPICIOUS/REVIEW): Transaksi diproses, ditandai untuk review admin
        // - Z ≤ 2 (NORMAL/ALLOW): Transaksi normal, tidak ada alert
        const riskLevel = paymentResult.transaction?.fraudRiskLevel || 'NORMAL'; // optional chaining (?.) aman jika transaction null; || 'NORMAL' fallback jika tidak ada riskLevel
        const zScore = paymentResult.transaction?.fraudRiskScore; // mengambil nilai Z-Score dari hasil deteksi anomali; akan undefined jika tidak ada
        
        if (riskLevel === 'SUSPICIOUS') {
          // REVIEW: Transaksi diproses tapi perlu ditinjau admin
          Alert.alert(
            '✅ Pembayaran Diterima (Perlu Review)',
            `✅ Anda menerima Rp ${amount.toLocaleString('id-ID')} dari:\n💳 ${buyerCheck.card.user?.name || buyerCheck.card.user?.username || 'Pembeli'}\n\n⚠️ Z-Score: ${zScore != null ? parseFloat(String(zScore)).toFixed(4) : 'tidak dihitung'} — transaksi akan ditinjau admin (SUSPICIOUS).\n\n💰 Saldo Anda Sekarang: Rp ${paymentResult.transaction?.receiverBalance?.toLocaleString('id-ID')}`,
            [{ text: 'OK' }]
          );
        } else {
          // NORMAL / ALLOW: Transaksi berhasil, tidak ada anomali
          Alert.alert(
            '✅ Pembayaran Berhasil Diterima! 🎉',
            `✅ Anda menerima Rp ${amount.toLocaleString('id-ID')} dari:\n💳 ${buyerCheck.card.user?.name || buyerCheck.card.user?.username || 'Pembeli'}\n\n💰 Saldo Anda Sekarang: Rp ${paymentResult.transaction?.receiverBalance?.toLocaleString('id-ID')}\n💳 Saldo Pembeli: Rp ${paymentResult.transaction?.senderBalance?.toLocaleString('id-ID')}`,
            [{ text: 'OK' }]
          );
        }
        
        setIsProcessing(false); // Unlock payment processing
        return true; // Success!
      } else {
        // STEP 6.3: Handle Payment Failure
        // success = false, check error code untuk specific handling
        
        // Error: TRANSACTION_BLOCKED
        // Transaksi diblokir fraud detection (Z-Score > 3 / σ=0 edge case)
        if (paymentResult.error === 'TRANSACTION_BLOCKED' || paymentResult.error === 'ACCOUNT_BANNED' || paymentResult.message?.includes('diblokir')) {
          Alert.alert(
            '🚫 Akun Diblokir',
            paymentResult.message || 'Maaf, kamu tidak bisa akses pembayaran ini karena akun kamu di-ban. Harap hubungi Customer Service untuk informasi lebih lanjut.\n\n📞 CS: +62-XXX-XXX-XXXX\n📧 cs@nfcpayment.com',
            [{ text: 'Mengerti' }]
          );
        } else {
          // Generic error: Display error message dari backend
          Alert.alert('❌ Pembayaran Gagal', paymentResult.error || 'Terjadi kesalahan');
        }
        setIsProcessing(false);
        return false; // Payment failed
      }

    } catch (error: any) {
      // GLOBAL ERROR HANDLER
      // Catch semua unhandled errors dari try block
      console.error('Payment error:', error);
      
      // ERROR 1: User Cancellation
      // User tap "Batal" di confirmation alert (Step 1)
      if (error?.message === 'USER_CANCELLED') { // optional chaining (?.) aman jika error null; === memastikan perbandingan ketat
        Alert.alert('🚫 Transfer Dibatalkan', 'Transfer telah dibatalkan.', [{ text: 'OK' }]);
        setIsProcessing(false);
        return false;
      }
      
      // ERROR 2: Rate Limiting (429 Too Many Requests)
      // Backend rate limiter blocked request
      // User send terlalu banyak payment dalam waktu singkat
      if (error?.message?.includes('429')) { // .includes() memeriksa apakah string mengandung substring tertentu; '429' adalah kode HTTP Too Many Requests
        Alert.alert(
          '⏱️ Terlalu Banyak Request',
          'Tunggu sebentar dan coba lagi.',
          [{ text: 'OK' }]
        );
      } 
      // ERROR 3: Account Banned
      // User account flagged and blocked by admin
      else if (error?.message?.includes('ACCOUNT_BANNED') || error?.message?.includes('diblokir')) { // || berarti OR — cek dua kondisi berbeda untuk error akun diblokir
        Alert.alert(
          '🚫 Akun Diblokir',
          'Maaf, kamu tidak bisa akses pembayaran ini karena akun kamu di-ban. Harap hubungi Customer Service untuk informasi lebih lanjut.\n\n📞 CS: +62-XXX-XXX-XXXX\n📧 cs@nfcpayment.com',
          [{ text: 'Mengerti' }]
        );
      } 
      // ERROR 4: Generic Error
      // All other errors: network, server, unknown
      else {
        Alert.alert('❌ Error', error?.message || 'Gagal memproses pembayaran');
      }
      
      setIsProcessing(false); // setIsProcessing(false) melepas kunci — selalu dijalankan sebelum return false
      return false;
    }
  };

  return { // return objek yang berisi state dan fungsi untuk digunakan komponen
    isProcessing,           // boolean: apakah sedang proses pembayaran (untuk disable tombol)
    processTapToPayTransfer // fungsi utama: scan kartu pembeli lalu proses pembayaran
  };
};
