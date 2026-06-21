// src/screens/NFCScreenPayment.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk NFCScreenPayment (Pembeli/Sender)
// Screen ini digunakan oleh pembeli untuk menginput nominal dan
// melakukan pembayaran NFC ke merchant
// ============================================================

import { StyleSheet } from 'react-native'; // Import API styling React Native

const styles = StyleSheet.create({

  // ── Layar utama ──
  container: {
    flex: 1,                    // Isi seluruh tinggi layar
    backgroundColor: '#f8fafc', // Latar abu-abu sangat muda (slate-50)
  },

  // ── Header navigasi (tombol kembali + judul + spacer) ──
  header: {
    flexDirection: 'row',          // Elemen berjajar horizontal
    alignItems: 'center',          // Rata tengah vertikal
    justifyContent: 'space-between', // Kiri, tengah, kanan dipisah rata
    paddingHorizontal: 20,         // Padding kiri-kanan
    paddingVertical: 16,           // Padding atas-bawah
    backgroundColor: '#fff',       // Latar putih
    borderBottomWidth: 1,          // Garis bawah tipis sebagai separator
    borderBottomColor: '#f1f5f9',  // Warna garis abu muda
  },

  // ── Tombol kembali (lingkaran abu kecil) ──
  backButton: {
    width: 40,                  // Lebar area sentuh 40dp
    height: 40,                 // Tinggi area sentuh 40dp
    borderRadius: 20,           // Bulat sempurna
    backgroundColor: '#f8fafc', // Latar abu sangat muda
    justifyContent: 'center',   // Ikon di tengah
    alignItems: 'center',
  },

  // ── Ikon panah kembali ──
  backIcon: {
    fontSize: 24,      // Ukuran ikon
    color: '#1e293b',  // Navy gelap
  },

  // ── Judul halaman di tengah header ──
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },

  // ── Spacer kanan (menyeimbangkan judul agar presisi di tengah) ──
  headerSpacer: {
    width: 40, // Sama dengan lebar backButton
  },

  // ── Area tengah (saat error / NFC tidak tersedia) ──
  centerContent: {
    flex: 1,                  // Ambil seluruh ruang
    justifyContent: 'center', // Konten di tengah vertikal
    alignItems: 'center',     // Konten di tengah horizontal
    padding: 24,
  },

  // ── Emoji ikon besar saat error ──
  errorIcon: { fontSize: 64, marginBottom: 16 },

  // ── Judul teks error ──
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },

  // ── Deskripsi error ──
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },

  // ── Card berisi instruksi cara mengatasi error ──
  instructionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 24,
  },

  // ── Judul dalam card instruksi ──
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },

  // ── Item baris instruksi (langkah-langkah cara mengatasi error) ──
  instructionItem: {
    fontSize: 14,
    color: '#475569',   // Abu-abu sedang
    marginBottom: 8,    // Jarak antar langkah
  },

  // ── Tombol "Coba Lagi" ──
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },

  // ── Teks tombol coba lagi ──
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── Area konten utama (scroll) ──
  content: {
    flex: 1,     // Ambil sisa ruang setelah header
    padding: 24, // Padding 24dp dari semua sisi
  },

  // ── Bagian / section dalam konten ──
  section: { marginBottom: 24 }, // Jarak antar section

  // ── Label judul bagian (misalnya "Bayar ke:") ──
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',  // Semi-bold untuk label
    color: '#64748b',   // Abu-abu sedang
    marginBottom: 12,   // Jarak ke konten section
  },

  // ── Card info merchant (penerima pembayaran) ──
  merchantCard: {
    flexDirection: 'row',    // Ikon + info + chevron berjajar horizontal
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,     // Bayangan sangat tipis (5%)
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Container ikon merchant (lingkaran biru muda) ──
  merchantIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,            // Sudut membulat
    backgroundColor: '#e0f2fe', // Biru muda
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,             // Jarak ke teks info merchant
  },

  // ── Emoji ikon merchant ──
  merchantIconText: { fontSize: 24 },

  // ── Container info merchant (nama + tipe) ──
  merchantInfo: { flex: 1 }, // Ambil sisa lebar

  // ── Nama merchant ──
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },

  // ── Tipe merchant (misalnya "Merchant NFC") ──
  merchantType: { fontSize: 13, color: '#64748b' },

  // ── Ikon chevron ">" di kanan card merchant ──
  chevron: { fontSize: 20, color: '#cbd5e1' },

  // ── Container input nominal (simbol Rp + TextInput angka besar) ──
  amountContainer: {
    flexDirection: 'row',  // Simbol Rp dan input berjajar horizontal
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Teks simbol mata uang ("Rp") ──
  currencySymbol: {
    fontSize: 32,        // Besar agar selaras dengan input nominal
    fontWeight: 'bold',
    color: '#1e293b',
    marginRight: 8,      // Jarak ke TextInput
  },

  // ── TextInput nominal (angka besar 48pt) ──
  amountInput: {
    flex: 1,       // Ambil sisa lebar setelah simbol Rp
    fontSize: 48,  // Sangat besar agar nominal terbaca jelas
    fontWeight: 'bold',
    color: '#1e293b',
    padding: 0,    // Hapus padding default agar posisi pas
  },

  // ── Keypad angka custom ──
  keypad: { marginBottom: 16 },

  // ── Baris dalam keypad (3 tombol per baris) ──
  keypadRow: {
    flexDirection: 'row',        // Tombol berjajar horizontal
    justifyContent: 'space-between', // Tombol tersebar merata
    marginBottom: 12,            // Jarak antar baris keypad
  },

  // ── Tombol angka individual di keypad ──
  keypadButton: {
    width: '30%',        // Sepertiga lebar (3 tombol per baris)
    aspectRatio: 2,      // Tinggi = setengah lebar (bentuk kotak lebar)
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Angka di tombol keypad ──
  keypadButtonText: {
    fontSize: 28,       // Besar agar mudah dibaca
    fontWeight: '500',
    color: '#1e293b',
  },

  // ── Teks kecil di bawah angka tertentu (misalnya "+" pada tombol +12) ──
  keypadSubText: {
    fontSize: 10,
    color: '#94a3b8',    // Abu-abu redup
    marginTop: -4,       // Dekatkan ke teks angka di atasnya
  },

  // ── Tombol "Bayar via NFC" ──
  scanButton: {
    backgroundColor: '#3B82F6',             // Biru utama brand
    paddingVertical: 18,                     // Tinggi nyaman untuk tap
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#3B82F6',                 // Glow biru
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Tombol bayar saat disabled (nominal = 0 atau loading) ──
  scanButtonDisabled: { opacity: 0.5 }, // Redup 50% tanda tidak aktif

  // ── Teks di dalam tombol bayar ──
  scanButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // ── Baris info keamanan di bawah tombol ("🔒 Transaksi aman...") ──
  securityInfo: {
    flexDirection: 'row',     // Ikon dan teks berjajar horizontal
    alignItems: 'center',
    justifyContent: 'center', // Di tengah horizontal
    gap: 8,
  },

  // ── Emoji gembok di info keamanan ──
  securityIcon: { fontSize: 16 },

  // ── Teks keterangan keamanan ──
  securityText: { fontSize: 13, color: '#64748b' },

  // ── Overlay gelap saat modal NFC scanning muncul ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Hitam 50% transparan
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // ── Container konten modal scanning ──
  modalContent: {
    width: '100%',
    maxWidth: 400, // Lebar maksimal agar tidak terlalu lebar di tablet
  },

  // ── Card putih berisi animasi scanning NFC ──
  scanningCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },

  // ── Emoji animasi scanning ──
  scanningIcon: { fontSize: 48 },

  // ── Teks gelombang NFC di sudut card scanning ──
  nfcWaves: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    position: 'absolute', // Diposisikan bebas di dalam scanningCard
    right: 20,
    top: 20,
  },

  // ── Container info transaksi di dalam modal ──
  scanningInfo: { marginBottom: 24 },

  // ── Teks "Menunggu kartu..." ──
  scanningWaiting: {
    fontSize: 14,
    color: '#3B82F6', // Biru agar terasa aktif/loading
    textAlign: 'center',
  },

  // ── Teks label nominal di modal scanning ──
  transactionAmount: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },

  // ── Nilai nominal besar di modal scanning ──
  transactionAmountValue: {
    fontSize: 32,        // Sangat besar agar nominal jelas terlihat
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 24,
  },

  // ── Kotak info biru muda di dalam modal ──
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff', // Biru sangat muda
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },

  // ── Ikon info ──
  infoIcon: { fontSize: 16, marginRight: 8 },

  // ── Teks info dalam kotak biru ──
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',  // Biru tua kontras di latar biru muda
    lineHeight: 18,
  },

  // ── Judul di dalam modal scanning ("Scan Kartu NFC") ──
  scanningTitle: {
    fontSize: 20,        // Heading modal
    fontWeight: 'bold',
    color: '#1e293b',    // Navy gelap
    marginTop: 16,       // Jarak dari ikon scanning di atas
    marginBottom: 8,
  },

  // ── Subtitle instruksi di modal ("Tempelkan kartu...") ──
  scanningSubtitle: {
    fontSize: 14,
    color: '#64748b',      // Abu-abu sedang
    textAlign: 'center',
    marginBottom: 24,
  },

  // ── Container animasi kartu NFC bergerak ──
  scanningAnimation: {
    width: '100%',
    alignItems: 'center', // Animasi di tengah horizontal
    marginBottom: 24,
  },

  // ── Representasi visual kartu NFC fisik ──
  nfcCardVisual: {
    flexDirection: 'row', // Ikon kartu dan gelombang berjajar
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // ── Emoji kartu kredit dalam animasi ──
  nfcCardIcon: {
    fontSize: 48, // Besar agar terlihat jelas dalam modal
  },

  // ── Tombol "Batal" di modal scanning ──
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },

  // ── Teks tombol batal ──
  cancelButtonText: {
    color: '#3B82F6', // Biru sebagai tanda link/aksi
    fontSize: 16,
    fontWeight: '600',
  },

});

export default styles; // Ekspor agar bisa digunakan di NFCScreenPayment.tsx
