// src/hooks/usePayment.ts
// ==================================================================================
// 💳 HOOK KUSTOM: usePayment
// ==================================================================================
//
// Tujuan Hook:
// Hook React kustom untuk menangani logika proses pembayaran kompleks dengan kartu NFC fisik.
// Implementasi alur pembayaran pedagang: scan kartu sumber untuk terima bayaran.
//
// Alur Bisnis:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ SKENARIO PEMBAYARAN PEDAGANG:                                          │
// │                                                                   │
// │ 1. Penjual (Pedagang) input jumlah Rp 50.000                      │
// │ 2. Penjual ketuk tombol "Terima Pembayaran"                       │
// │ 3. Peringatan muncul: "Scan Kartu NFC"                            │
// │ 4. Pengguna dekatkan kartu NFC ke HP penjual                      │
// │ 5. Sistem baca UID kartu                                          │
// │ 6. Sistem validasi: terdaftar? aktif? saldo cukup?              │
// │ 7. Sistem ambil kartu Penjual dari database (deteksi otomatis)    │
// │ 8. Sistem proses pembayaran: Kartu sumber → Penjual              │
// │ 9. Backend perbarui saldo + cek penipuan                          │
// │ 10. Peringatan sukses dengan info transaksi                       │
// └─────────────────────────────────────────────────────────────────────┘
//
// Fitur Utama:
// 1. Pemindaian Kartu Fisik: Baca kartu NFC sumber pembayaran
// 2. Validasi Multi-tingkat:
//    - Kartu sumber terdaftar & aktif
//    - Saldo sumber mencukupi
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
// │ KONFIRMASI PERINGATAN ("Scan Kartu NFC") ──> Batal? ──> BERHENTI     │
// │   ↓ Pengguna klik "Siap"                                       │
// │ SCAN KARTU NFC (Perangkat NFC) ──> Gagal? ──> BERHENTI          │
// │   ↓                                                             │
// │ VALIDASI KARTU SUMBER (API) ──> Tidak terdaftar? ──> BERHENTI   │
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

import { useState } from 'react';
// import digunakan untuk mengambil module; useState adalah hook React untuk membuat state lokal dalam komponen atau hook kustom
import { Alert } from 'react-native';
// import Alert dari React Native — digunakan untuk menampilkan dialog konfirmasi dan pesan error ke user dalam format native Android/iOS
import { APIError, apiService } from '../utils/apiService';
// import apiService — HTTP client Singleton yang menangani semua komunikasi dengan backend Express (validasi kartu, proses payment, refresh saldo)
import { useNFCScanner } from './useNFCScanner';

interface SuccessfulPaymentTransaction {
  senderName: string;
  senderBalance: number;
  receiverBalance: number;
  fraudRiskLevel: 'NORMAL' | 'SUSPICIOUS';
  fraudRiskScore?: number | null;
  fraudDecision: 'ALLOW' | 'REVIEW';
}

const formatRupiah = (value: number): string => `Rp ${value.toLocaleString('id-ID')}`;

const formatBalance = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? formatRupiah(value)
    : 'Tidak tersedia';

// Memvalidasi kontrak respons sukses sebelum saldo atau status risiko ditampilkan ke pengguna.
// Respons hanya diterima jika transaksi benar-benar sukses, kedua saldo finite dan nonnegatif,
// level risiko termasuk hasil yang dapat diselesaikan, serta skor risiko null atau finite.
// Pelanggaran kontrak dilempar sebagai status yang perlu diverifikasi agar pembayaran tidak diulang.
export const parseSuccessfulPaymentResult = (result: unknown): SuccessfulPaymentTransaction => {
  const payload = result as { success?: unknown; transaction?: Record<string, unknown> } | null;
  const transaction = payload?.transaction;
  const validRiskLevels = new Set(['NORMAL', 'SUSPICIOUS']);

  if (
    payload?.success !== true ||
    !transaction ||
    typeof transaction.senderName !== 'string' ||
    transaction.senderName.trim().length === 0 ||
    typeof transaction.senderBalance !== 'number' ||
    !Number.isFinite(transaction.senderBalance) ||
    transaction.senderBalance < 0 ||
    typeof transaction.receiverBalance !== 'number' ||
    !Number.isFinite(transaction.receiverBalance) ||
    transaction.receiverBalance < 0 ||
    typeof transaction.fraudRiskLevel !== 'string' ||
    !validRiskLevels.has(transaction.fraudRiskLevel) ||
    (transaction.fraudDecision !== 'ALLOW' && transaction.fraudDecision !== 'REVIEW') ||
    (transaction.fraudRiskScore !== undefined &&
      transaction.fraudRiskScore !== null &&
      (typeof transaction.fraudRiskScore !== 'number' || !Number.isFinite(transaction.fraudRiskScore)))
  ) {
    throw new Error('Respons sukses pembayaran backend tidak valid');
  }

  return transaction as unknown as SuccessfulPaymentTransaction;
};

// ==================================================================================
// HOOK: usePayment
// ==================================================================================
// HASIL KEMBALIAN:
// - isProcessing: boolean - Flag apakah pembayaran sedang diproses
// - processTapToPayTransfer: Fungsi - Fungsi pemrosesan pembayaran utama
// ==================================================================================
export const usePayment = () => {
  // export const: ekspor hook ke komponen lain; () => arrow function tanpa parameter
  // STATE: isProcessing - Flag kunci untuk mencegah pembayaran ganda
  // true = pembayaran sedang diproses, tombol dinonaktifkan
  // false = siap proses pembayaran baru
  // Penting untuk mencegah pengguna mengetuk tombol bayar berkali-kali
  const [isProcessing, setIsProcessing] = useState(false);
  // const membuat variabel tetap; useState(false) membuat state boolean; isProcessing=true mengunci hook agar tidak memproses dua pembayaran sekaligus
  const { scanAndValidateCard } = useNFCScanner({
    showAlerts: false,
    logTap: true,
  });

  // ================================================================================
  // FUNGSI: processTapToPayTransfer
  // ================================================================================
  // Fungsi utama untuk proses pembayaran dengan kartu NFC fisik.
  // Implementasi alur pembayaran pedagang: scan kartu sumber untuk terima bayaran.
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
  //   - Tampilkan peringatan "Scan Kartu NFC"
  //   - Tombol: "Batal" (tolak) dan "Siap" (setuju)
  //   - Pengguna bisa membatalkan sebelum scan
  //
  // LANGKAH 2: Scan Kartu Sumber (NFC Fisik)
  //   - Panggil scanAndValidateCard() dari useNFCScanner
  //   - Baca UID dari kartu sumber
  //   - Validasi kartu terdaftar + ACTIVE
  //
  // LANGKAH 3: Validasi Kartu Sumber
  //   - Dilakukan atomik oleh endpoint payment bersama pemindahan saldo
  //   - Cek: terdaftar, aktif, bukan bayar sendiri, dan saldo mencukupi
  //
  // LANGKAH 4: Ambil Kartu Penerima (Deteksi Otomatis)
  //   - API: GET /api/users/{userId}/cards
  //   - Temukan kartu AKTIF dari penjual
  //   - Tidak perlu scan manual (berbeda dari kartu sumber)
  //
  // LANGKAH 5: Proses Pembayaran (Backend)
  //   - API: POST /api/nfc-cards/payment
  //   - Transfer: source balance -> receiver balance
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
  // - Self-payment: Source user = Receiver
  // - Insufficient balance: Saldo kartu sumber tidak cukup
  // - No receiver card: Penjual belum punya card
  // - Network error: Backend tidak bisa diakses
  // - Rate limiting (429): Terlalu banyak request
  // - Account banned: User di-ban karena fraud
  // ================================================================================
  const processTapToPayTransfer = async (
  // const processTapToPayTransfer: deklarasi fungsi async utama pemroses pembayaran NFC
    currentUserId: number,
    // tipe number: ID user penjual yang menerima pembayaran
    amount: number,
    // tipe number: nominal transaksi dalam Rupiah
    onSuccess?: () => void
    // ? berarti opsional; callback dipanggil setelah transaksi berhasil untuk refresh saldo
  ): Promise<boolean> => {
    // : Promise<boolean> adalah return type — fungsi ini mengembalikan true jika berhasil, false jika gagal
    setIsProcessing(true);
    // setIsProcessing(true) mengaktifkan kunci — mencegah double-tap tombol bayar

    try {
      // try membungkus kode yang berisiko error; jika error terjadi, ditangkap oleh blok catch
      // STEP 1: User Confirmation Alert
      // Show alert untuk konfirmasi sebelum scan
      // User bisa cancel jika berubah pikiran
      // 
      // Alert.alert() dengan Promise pattern:
      // - new Promise<void>((resolve, reject))
      // - Resolve jika user tap "Siap"
      // - Reject dengan error 'USER_CANCELLED' jika user tap "Batal"
      // - await Promise akan block execution sampai user pilih
      await new Promise<void>((resolve, reject) => {
        // new Promise(executor) membuat Promise baru; <void> berarti Promise tidak mengembalikan nilai; (resolve, reject) adalah dua callback: resolve=sukses, reject=error
        Alert.alert(
          '\ud83d\udcb3 Scan Kartu NFC',
          'Tempelkan kartu NFC ke HP Anda untuk menerima pembayaran',
          [
            { 
              text: 'Batal',
              // mendefinisikan tombol Batal pada dialog Alert
              style: 'cancel',
              // style cancel memberi tampilan khusus tombol batal (merah di iOS)
              onPress: () => reject(new Error('USER_CANCELLED'))
              // reject(new Error('USER_CANCELLED')) menandai Promise sebagai gagal; error akan ditangkap oleh catch
            },
            { text: 'Siap', onPress: () => resolve() }
            // resolve() menandai Promise sebagai berhasil; eksekusi lanjut ke baris berikutnya
          ]
        );
      });

      // STEP 2: Scan kartu sumber pembayaran.
      const sourceCard = await scanAndValidateCard();
      
      if (!sourceCard) {
        // !sourceCard berarti null/undefined — pembacaan gagal (tidak ada kartu atau hardware error)
        Alert.alert('\u274c Kartu Tidak Valid', 'Pastikan kartu aktif dan terdaftar, lalu coba lagi.');
        // Alert.alert() menampilkan dialog popup native kepada user
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci sebelum return
        return false;
        // return false memberitahu pemanggil bahwa pembayaran gagal
      }

      console.log('💳 Source card scanned:', sourceCard.cardId);
      // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi

      // Backend memvalidasi keterhubungan akun, status, saldo, dan self-payment saat payment diproses.

      // STEP 4: Get Receiver Card (Auto-detect from Database)
      // Berbeda dari kartu sumber yang di-scan manual,
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
      // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
      
      let receiverCardsResponse;
      // let dipakai karena nilai diisi di dalam blok try; tidak bisa const karena deklarasi terpisah dari assignment
      try {
        // try membungkus kode yang berisiko error; jika error terjadi, ditangkap oleh blok catch
        // Ambil kartu aktif dari user yang login (penerima/penjual)
        receiverCardsResponse = await apiService.get(`/api/users/${currentUserId}/cards`);
        // mengambil daftar kartu penerima dari backend berdasarkan userId penjual
        console.log('📥 Receiver cards response:', JSON.stringify(receiverCardsResponse));
        // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
      } catch (error: any) {
        // catch (error: any) menangkap semua error; any berarti tidak dibatasi tipe TypeScript
        // ERROR: Gagal fetch receiver cards
        // Possible causes:
        // - Network error: Backend down atau no internet
        // - Authentication error: Token expired
        // - Server error (500): Database query failed
        console.error('❌ Failed to get receiver cards:', error);
        // console.error mencetak pesan error ke terminal dengan tanda merah untuk debugging
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          '❌ Error Koneksi',
          `Gagal mengambil data kartu Anda.\n\nDetail: ${error?.message || 'Unknown error'}\n\nPastikan Anda sudah login dan koneksi internet stabil.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // Early return: network error
      }
      
      // VALIDASI 4.1: Check response structure
      // Defensive programming: Validate response sebelum akses properties
      // Kenapa penting?
      // - Backend bisa return response yang unexpected
      // - Network error bisa return HTML error page instead of JSON
      // - Prevent "Cannot read property of undefined" errors
      if (!receiverCardsResponse || typeof receiverCardsResponse !== 'object') {
        // validasi struktur response; defensive programming mencegah akses properti dari nilai null
        console.error('❌ Invalid response structure:', receiverCardsResponse);
        // console.error mencetak pesan error ke terminal dengan tanda merah untuk debugging
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          '❌ Error Response',
          'Format response dari server tidak valid. Hubungi admin.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // Early return: invalid response
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
        // validasi bahwa response sukses dan array cards tersedia dan tidak kosong
        console.log('⚠️ No cards found for user:', currentUserId);
        // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          '📝 Anda Belum Punya Kartu Terdaftar',
          'Daftarkan kartu Anda terlebih dahulu di menu "Daftar Kartu" sebelum menerima pembayaran.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // Early return: no cards
      }

      // VALIDASI 4.3: Find ACTIVE card
      // Array.find() akan return first match atau undefined jika not found
      // Filter: cardStatus === 'ACTIVE'
      //
      // Policy sistem: setiap user hanya memiliki SATU kartu NFC aktif (1 user = 1 kartu)
      // find() mengambil kartu pertama yang ACTIVE — seharusnya hanya ada satu.
      const receiverCard = receiverCardsResponse.cards.find((c: any) => c.cardStatus === 'ACTIVE');
      // .find() mencari elemen pertama yang memenuhi kondisi; (c: any) adalah parameter arrow function; c.cardStatus === 'ACTIVE' adalah kondisi pencarian
      
      // Check apakah ada kartu ACTIVE
      // Jika tidak, berarti user punya cards tapi semua tidak active
      if (!receiverCard) {
        // jika tidak ada kartu yang berstatus ACTIVE; user punya kartu tapi semua nonaktif
        const totalCards = receiverCardsResponse.cards.length;
        // totalCards menyimpan jumlah kartu yang ditemukan; digunakan dalam pesan error untuk user
        const cardStatuses = receiverCardsResponse.cards.map((c: any) => c.cardStatus).join(', ');
        // cardStatuses menggabungkan semua status kartu menjadi satu string dengan .map().join()
        console.log(`⚠️ User has ${totalCards} cards but none are ACTIVE. Statuses: ${cardStatuses}`);
        // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          '🚫 Tidak Ada Kartu Aktif',
          `Anda memiliki ${totalCards} kartu terdaftar, tapi tidak ada yang aktif.\n\nStatus kartu: ${cardStatuses}\n\nAktifkan kartu Anda terlebih dahulu untuk menerima pembayaran.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // Early return: no active card
      }

      console.log('📥 Receiver card (auto-detected):', receiverCard.cardId);
      // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi

      // STEP 5: Process Payment to Backend
      // API Call: POST /api/nfc-cards/payment
      // Backend akan:
      // 1. Validate source card & receiver card exists
      // 2. Check source balance sufficient
      // 3. Deduct from source: source.balance -= amount
      // 4. Add to receiver: receiver.balance += amount
      // 5. Create transaction record in transactions table
      // 6. Run fraud detection algorithm (Z-Score)
      // 7. Create fraud alert jika Z-Score > 2 (SUSPICIOUS) atau > 3 (ANOMALY)
      // 8. Return transaction result + Z-Score fraud detection result
      // 
      // Request payload:
      // {
      //   cardId: string,          // Source card UID
      //   receiverCardId: string,  // Receiver card ID
      //   amount: number,          // Payment amount in Rupiah
      //   deviceId: string,        // Device identifier (for fraud detection)
      //   description: string      // Transaction description
      // }
      console.log('💸 Processing payment...');
      // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
      console.log('📤 Payment data:', {
        // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
        sourceCardId: sourceCard.cardId,
        receiverCardId: receiverCard.cardId,
        amount: amount,
        receiverUserId: currentUserId
      });
      
      const idempotencyKey = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const deviceId = await apiService.getDeviceId();
      let paymentResult;
      // let dipakai karena nilai diisi di dalam blok try terpisah dari deklarasi
      try {
        // try membungkus kode yang berisiko error; jika error terjadi, ditangkap oleh blok catch
        paymentResult = await apiService.post('/api/nfc-cards/payment', {
          // await HTTP POST ke backend; mengirim data kartu sumber, penerima, dan nominal transaksi
          cardId: sourceCard.cardId,
          // UID kartu sumber yang di-scan
          receiverCardId: receiverCard.cardId,
          // ID kartu penerima yang diambil dari database
          amount: amount,
          // nominal pembayaran dalam Rupiah
          deviceId,
          description: 'Merchant payment (receive)'
          // deskripsi transaksi
        }, { 'Idempotency-Key': idempotencyKey });
        console.log('📥 Payment result:', JSON.stringify(paymentResult));
        // console.log mencetak pesan debug ke terminal untuk melacak alur eksekusi
      } catch (paymentError: any) {
        // catch menangkap error dari payment API call secara spesifik
        // ERROR: Payment API failed
        // Possible causes:
        // - Database transaction failed (atomicity issue)
        // - Concurrent payment conflict (race condition)
        // - Server error (500)
        // - Network timeout
        console.error('❌ Payment API error:', paymentError);
        // console.error mencetak pesan error ke terminal dengan tanda merah untuk debugging
        if (paymentError instanceof APIError && paymentError.code === 'TRANSACTION_BLOCKED') {
          const blockedDetails = paymentError.data || {};
          const buyerName = typeof blockedDetails.senderName === 'string' && blockedDetails.senderName.trim()
            ? blockedDetails.senderName.trim()
            : 'Pemilik kartu';
          Alert.alert(
            '⛔ Pembayaran Diblokir!',
            `❌ Pembayaran ${formatRupiah(amount)} dari:\n💳 ${buyerName}\ntidak dapat diproses.\n\n🛡️ Keputusan AI Fraud Detection:\n🔴 BLOCK (Anomali)\n\nTransaksi ditolak karena terdeteksi anomali tinggi.\n\n💰 Saldo Anda Tetap: ${formatBalance(blockedDetails.receiverBalance ?? receiverCard.balance)}\n💳 Saldo Pembeli Tetap: ${formatBalance(blockedDetails.senderBalance ?? sourceCard.balance)}\n\nℹ️ Fraud alert telah dibuat untuk admin.`,
            [{ text: 'OK' }]
          );
          setIsProcessing(false);
          return false;
        }
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          '❌ Pembayaran Gagal',
          paymentError instanceof APIError
            ? paymentError.message
            : `Terjadi kesalahan saat memproses pembayaran.\n\nDetail: ${paymentError?.message || 'Unknown error'}`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // Early return: payment failed
      }

      // STEP 6: Handle Payment Success & Z-Score Fraud Detection
      // Check paymentResult.success untuk determine result
      if (paymentResult && paymentResult.success) {
        // if memeriksa dua kondisi: paymentResult tidak null DAN properti success bernilai true
        let transaction: SuccessfulPaymentTransaction;
        try {
          transaction = parseSuccessfulPaymentResult(paymentResult);
        } catch (responseError) {
          console.error('❌ Invalid payment success response:', responseError);
          Alert.alert(
            '⚠️ Status Pembayaran Perlu Diverifikasi',
            'Server mengirim respons yang tidak lengkap. Jangan ulangi pembayaran. Periksa riwayat transaksi atau hubungi admin.',
            [{ text: 'OK' }]
          );
          setIsProcessing(false);
          return false;
        }

        // STEP 6.1: Refresh balance setelah transaksi berhasil
        // Call onSuccess() callback untuk update UI
        // onSuccess biasanya fetch latest balance dari backend
        if (onSuccess) {
          // if memeriksa apakah callback onSuccess diberikan (tidak undefined)
          try {
            // try membungkus kode yang berisiko error; jika error terjadi, ditangkap oleh blok catch
            await onSuccess();
            // await memanggil callback untuk memperbarui saldo di UI setelah transaksi berhasil
          } catch (refreshError) {
            // catch menangkap error dari proses refresh saldo; tidak menghentikan alur sukses
            console.error('⚠️ Balance refresh failed:', refreshError);
            // console.error mencetak pesan error ke terminal dengan tanda merah untuk debugging
            // Don't block success flow if refresh fails
            // User will see updated balance on next screen refresh
          }
        }
        
        // STEP 6.2: Tampilkan notifikasi berdasarkan riskLevel Z-Score
        // Backend menggunakan Z-Score Based Anomaly Detection:
        // - Z > 3 (ANOMALY/BLOCK): Transaksi diblokir, tidak sampai di sini
        // - Z > 2 (SUSPICIOUS/REVIEW): Transaksi diproses, ditandai untuk review admin
        // - Z ≤ 2 (NORMAL/ALLOW): Transaksi normal, tidak ada alert
        const riskLevel = transaction.fraudRiskLevel;
        // optional chaining (?.) aman jika transaction null; || 'NORMAL' fallback jika tidak ada riskLevel
        
        if (riskLevel === 'SUSPICIOUS') {
          // if memeriksa apakah Z-Score masuk kategori SUSPICIOUS (2 < Z <= 3); perlu review admin
          // REVIEW: Transaksi diproses tapi perlu ditinjau admin
          Alert.alert(
          // Alert.alert() menampilkan dialog popup native kepada user
            '⚠️ Pembayaran Berhasil, Perlu Ditinjau',
            `✅ Anda menerima ${formatRupiah(amount)} dari:\n💳 ${transaction.senderName}\n\n🛡️ Keputusan AI Fraud Detection:\n🟡 REVIEW (Mencurigakan)\n\nTransaksi berhasil diproses, tetapi ditandai untuk ditinjau admin.\n\n💰 Saldo Anda Sekarang: ${formatRupiah(transaction.receiverBalance)}\n💳 Saldo Pembeli: ${formatRupiah(transaction.senderBalance)}\n\nℹ️ Fraud alert telah dibuat untuk admin.`,
            [{ text: 'OK' }]
          );
        } else {
          // else: blok yang dijalankan jika kondisi if sebelumnya tidak terpenuhi
          // NORMAL / ALLOW: Transaksi berhasil, tidak ada anomali
          Alert.alert(
          // Alert.alert() menampilkan dialog popup native kepada user
            '✅ Pembayaran Berhasil Diterima! 🎉',
            `✅ Anda menerima ${formatRupiah(amount)} dari:\n💳 ${transaction.senderName}\n\n🛡️ Keputusan AI Fraud Detection:\n🟢 ALLOW (Normal)\n\nTransaksi berhasil diproses tanpa fraud alert.\n\n💰 Saldo Anda Sekarang: ${formatRupiah(transaction.receiverBalance)}\n💳 Saldo Pembeli: ${formatRupiah(transaction.senderBalance)}`,
            [{ text: 'OK' }]
          );
        }
        
        setIsProcessing(false);
        // Unlock payment processing
        return true;
        // Success!
      } else {
        // else: blok yang dijalankan jika kondisi if sebelumnya tidak terpenuhi
        // STEP 6.3: Handle Payment Failure
        // success = false, check error code untuk specific handling
        
        // Error: TRANSACTION_BLOCKED
        // Transaksi diblokir fraud detection (Z-Score > 3 / σ=0 edge case)
        if (paymentResult.error === 'TRANSACTION_BLOCKED' || paymentResult.error === 'ACCOUNT_BANNED' || paymentResult.message?.includes('diblokir')) {
          // if memeriksa kode error TRANSACTION_BLOCKED atau ACCOUNT_BANNED dari backend
          Alert.alert(
          // Alert.alert() menampilkan dialog popup native kepada user
            paymentResult.error === 'ACCOUNT_BANNED' ? 'Akun Dinonaktifkan' : 'Transaksi Diblokir',
            paymentResult.error === 'ACCOUNT_BANNED'
              ? 'Akun Anda dinonaktifkan. Silakan hubungi administrator untuk informasi lebih lanjut.'
              : 'Transaksi tidak dapat diproses karena pemeriksaan keamanan. Saldo tidak berubah. Silakan hubungi admin jika Anda merasa ini keliru.',
            [{ text: 'Mengerti' }]
          );
        } else {
          // else: blok yang dijalankan jika kondisi if sebelumnya tidak terpenuhi
          // Generic error: Display error message dari backend
          Alert.alert('❌ Pembayaran Gagal', paymentResult.error || 'Terjadi kesalahan');
          // Alert.alert() menampilkan dialog popup native kepada user
        }
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // Payment failed
      }

    } catch (error: any) {
      // catch (error: any) menangkap semua error; any berarti tidak dibatasi tipe TypeScript
      // GLOBAL ERROR HANDLER
      // Catch semua unhandled errors dari try block
      console.error('Payment error:', error);
      // console.error mencetak pesan error ke terminal dengan tanda merah untuk debugging
      
      // ERROR 1: User Cancellation
      // User tap "Batal" di confirmation alert (Step 1)
      if (error?.message === 'USER_CANCELLED') {
        // optional chaining (?.) aman jika error null; === memastikan perbandingan ketat
        Alert.alert('🚫 Transfer Dibatalkan', 'Transfer telah dibatalkan.', [{ text: 'OK' }]);
        // Alert.alert() menampilkan dialog popup native kepada user
        setIsProcessing(false);
        // setIsProcessing(false) melepas kunci pemrosesan sehingga pembayaran berikutnya bisa diproses
        return false;
        // return false mengembalikan nilai gagal ke komponen pemanggil
      }
      
      // ERROR 2: Rate Limiting (429 Too Many Requests)
      // Backend rate limiter blocked request
      // User send terlalu banyak payment dalam waktu singkat
      if (error?.message?.includes('429')) {
        // .includes() memeriksa apakah string mengandung substring tertentu; '429' adalah kode HTTP Too Many Requests
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          '⏱️ Terlalu Banyak Request',
          'Tunggu sebentar dan coba lagi.',
          [{ text: 'OK' }]
        );
      }
      // ERROR 3: Account Banned
      // User account flagged and blocked by admin
      else if (error?.message?.includes('ACCOUNT_BANNED') || error?.message?.includes('diblokir')) {
        // || berarti OR — cek dua kondisi berbeda untuk error akun diblokir
        Alert.alert(
        // Alert.alert() menampilkan dialog popup native kepada user
          'Akun Dinonaktifkan',
          'Akun Anda dinonaktifkan. Silakan hubungi administrator untuk informasi lebih lanjut.',
          [{ text: 'Mengerti' }]
        );
      }
      // ERROR 4: Generic Error
      // All other errors: network, server, unknown
      else {
        Alert.alert('❌ Error', error?.message || 'Gagal memproses pembayaran');
        // Alert.alert() menampilkan dialog popup native kepada user
      }
      
      setIsProcessing(false);
      // setIsProcessing(false) melepas kunci — selalu dijalankan sebelum return false
      return false;
      // return false mengembalikan nilai gagal ke komponen pemanggil
    }
  };

  return {
    // return objek yang berisi state dan fungsi untuk digunakan komponen
    isProcessing,
    // boolean: apakah sedang proses pembayaran (untuk disable tombol)
    processTapToPayTransfer
    // fungsi utama: scan kartu sumber lalu proses pembayaran
  };
};
