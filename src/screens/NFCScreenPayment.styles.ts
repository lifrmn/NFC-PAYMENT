// src/screens/NFCScreenPayment.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk NFCScreenPayment (Pembeli/Sender)
// Screen ini digunakan oleh pembeli untuk menginput nominal dan
// melakukan pembayaran NFC ke merchant
// ============================================================

import { StyleSheet } from 'react-native'; // Import API styling React Native
// Import API styling React Native

const styles = StyleSheet.create({ // StyleSheet.create = membuat kumpulan style tampilan React Native yang dioptimalkan

  // ── Layar utama ──
  container: {
    flex: 1, // Isi seluruh tinggi layar
    // Isi seluruh tinggi layar
    backgroundColor: '#f8fafc', // Latar abu-abu sangat muda (slate-50)
    // Latar abu-abu sangat muda (slate-50)
  },

  // ── Header navigasi (tombol kembali + judul + spacer) ──
  header: {
    flexDirection: 'row', // Elemen berjajar horizontal
    // Elemen berjajar horizontal
    alignItems: 'center', // Rata tengah vertikal
    // Rata tengah vertikal
    justifyContent: 'space-between', // Kiri, tengah, kanan dipisah rata
    // Kiri, tengah, kanan dipisah rata
    paddingHorizontal: 20, // Padding kiri-kanan
    // Padding kiri-kanan
    paddingVertical: 16, // Padding atas-bawah
    // Padding atas-bawah
    backgroundColor: '#fff', // Latar putih
    // Latar putih
    borderBottomWidth: 1, // Garis bawah tipis sebagai separator
    // Garis bawah tipis sebagai separator
    borderBottomColor: '#f1f5f9', // Warna garis abu muda
    // Warna garis abu muda
  },

  // ── Tombol kembali (lingkaran abu kecil) ──
  backButton: {
    width: 40, // Lebar area sentuh 40dp
    // Lebar area sentuh 40dp
    height: 40, // Tinggi area sentuh 40dp
    // Tinggi area sentuh 40dp
    borderRadius: 20, // Bulat sempurna
    // Bulat sempurna
    backgroundColor: '#f8fafc', // Latar abu sangat muda
    // Latar abu sangat muda
    justifyContent: 'center', // Ikon di tengah
    // Ikon di tengah
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
  },

  // ── Ikon panah kembali ──
  backIcon: {
    fontSize: 24, // Ukuran ikon
    // Ukuran ikon
    color: '#1e293b', // Navy gelap
    // Navy gelap
  },

  // ── Judul halaman di tengah header ──
  headerTitle: {
    fontSize: 18, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
  },

  // ── Spacer kanan (menyeimbangkan judul agar presisi di tengah) ──
  headerSpacer: {
    width: 40, // Sama dengan lebar backButton
    // Sama dengan lebar backButton
  },

  // ── Area tengah (saat error / NFC tidak tersedia) ──
  centerContent: {
    flex: 1, // Ambil seluruh ruang
    // Ambil seluruh ruang
    justifyContent: 'center', // Konten di tengah vertikal
    // Konten di tengah vertikal
    alignItems: 'center', // Konten di tengah horizontal
    // Konten di tengah horizontal
    padding: 24, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
  },

  // ── Emoji ikon besar saat error ──
  errorIcon: { fontSize: 64, marginBottom: 16 }, // Emoji error besar dengan jarak bawah
  // Emoji error besar dengan jarak bawah

  // ── Judul teks error ──
  errorTitle: {
    fontSize: 24, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginBottom: 8, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Deskripsi error ──
  errorText: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
    textAlign: 'center', // Perataan teks
    // Perataan teks
    marginBottom: 32, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Card berisi instruksi cara mengatasi error ──
  instructionCard: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    padding: 20, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    width: '100%', // Lebar elemen
    // Lebar elemen
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Judul dalam card instruksi ──
  instructionTitle: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginBottom: 12, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Item baris instruksi (langkah-langkah cara mengatasi error) ──
  instructionItem: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#475569', // Abu-abu sedang
    // Abu-abu sedang
    marginBottom: 8, // Jarak antar langkah
    // Jarak antar langkah
  },

  // ── Tombol "Coba Lagi" ──
  retryButton: {
    backgroundColor: '#3B82F6', // Warna latar belakang
    // Warna latar belakang
    paddingVertical: 14, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 32, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
  },

  // ── Teks tombol coba lagi ──
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' }, // Teks putih semi-bold di tombol coba lagi
  // Teks putih semi-bold di tombol coba lagi

  // ── Area konten utama (scroll) ──
  content: {
    flex: 1, // Ambil sisa ruang setelah header
    // Ambil sisa ruang setelah header
    padding: 24, // Padding 24dp dari semua sisi
    // Padding 24dp dari semua sisi
  },

  // ── Bagian / section dalam konten ──
  section: { marginBottom: 24 }, // Jarak antar section
  // Jarak antar section

  // ── Label judul bagian (misalnya "Bayar ke:") ──
  sectionLabel: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Semi-bold untuk label
    // Semi-bold untuk label
    color: '#64748b', // Abu-abu sedang
    // Abu-abu sedang
    marginBottom: 12, // Jarak ke konten section
    // Jarak ke konten section
  },

  // ── Card info merchant (penerima pembayaran) ──
  merchantCard: {
    flexDirection: 'row', // Ikon + info + chevron berjajar horizontal
    // Ikon + info + chevron berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    padding: 16, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    shadowColor: '#000', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 2 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.05, // Bayangan sangat tipis (5%)
    // Bayangan sangat tipis (5%)
    shadowRadius: 4, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 2, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Container ikon merchant (lingkaran biru muda) ──
  merchantIcon: {
    width: 48, // Lebar elemen
    // Lebar elemen
    height: 48, // Tinggi elemen
    // Tinggi elemen
    borderRadius: 12, // Sudut membulat
    // Sudut membulat
    backgroundColor: '#e0f2fe', // Biru muda
    // Biru muda
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    marginRight: 12, // Jarak ke teks info merchant
    // Jarak ke teks info merchant
  },

  // ── Emoji ikon merchant ──
  merchantIconText: { fontSize: 24 }, // Emoji ikon merchant
  // Emoji ikon merchant

  // ── Container info merchant (nama + tipe) ──
  merchantInfo: { flex: 1 }, // Ambil sisa lebar
  // Ambil sisa lebar

  // ── Nama merchant ──
  merchantName: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginBottom: 2, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Tipe merchant (misalnya "Merchant NFC") ──
  merchantType: { fontSize: 13, color: '#64748b' }, // Teks abu-abu kecil tipe merchant
  // Teks abu-abu kecil tipe merchant

  // ── Ikon chevron ">" di kanan card merchant ──
  chevron: { fontSize: 20, color: '#cbd5e1' }, // Ikon panah kanan di kartu merchant
  // Ikon panah kanan di kartu merchant

  // ── Container input nominal (simbol Rp + TextInput angka besar) ──
  amountContainer: {
    flexDirection: 'row', // Simbol Rp dan input berjajar horizontal
    // Simbol Rp dan input berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    padding: 24, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    shadowColor: '#000', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 2 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.05, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 4, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 2, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Teks simbol mata uang ("Rp") ──
  currencySymbol: {
    fontSize: 32, // Besar agar selaras dengan input nominal
    // Besar agar selaras dengan input nominal
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginRight: 8, // Jarak ke TextInput
    // Jarak ke TextInput
  },

  // ── TextInput nominal (angka besar 48pt) ──
  amountInput: {
    flex: 1, // Ambil sisa lebar setelah simbol Rp
    // Ambil sisa lebar setelah simbol Rp
    fontSize: 48, // Sangat besar agar nominal terbaca jelas
    // Sangat besar agar nominal terbaca jelas
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    padding: 0, // Hapus padding default agar posisi pas
    // Hapus padding default agar posisi pas
  },

  // ── Keypad angka custom ──
  keypad: { marginBottom: 16 }, // Keypad dengan jarak bawah
  // Keypad dengan jarak bawah

  // ── Baris dalam keypad (3 tombol per baris) ──
  keypadRow: {
    flexDirection: 'row', // Tombol berjajar horizontal
    // Tombol berjajar horizontal
    justifyContent: 'space-between', // Tombol tersebar merata
    // Tombol tersebar merata
    marginBottom: 12, // Jarak antar baris keypad
    // Jarak antar baris keypad
  },

  // ── Tombol angka individual di keypad ──
  keypadButton: {
    width: '30%', // Sepertiga lebar (3 tombol per baris)
    // Sepertiga lebar (3 tombol per baris)
    aspectRatio: 2, // Tinggi = setengah lebar (bentuk kotak lebar)
    // Tinggi = setengah lebar (bentuk kotak lebar)
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    shadowColor: '#000', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 2 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.05, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 4, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 2, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Angka di tombol keypad ──
  keypadButtonText: {
    fontSize: 28, // Besar agar mudah dibaca
    // Besar agar mudah dibaca
    fontWeight: '500', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
  },

  // ── Teks kecil di bawah angka tertentu (misalnya "+" pada tombol +12) ──
  keypadSubText: {
    fontSize: 10, // Ukuran font
    // Ukuran font
    color: '#94a3b8', // Abu-abu redup
    // Abu-abu redup
    marginTop: -4, // Dekatkan ke teks angka di atasnya
    // Dekatkan ke teks angka di atasnya
  },

  // ── Tombol "Bayar via NFC" ──
  scanButton: {
    backgroundColor: '#3B82F6', // Biru utama brand
    // Biru utama brand
    paddingVertical: 18, // Tinggi nyaman untuk tap
    // Tinggi nyaman untuk tap
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    marginBottom: 16, // Jarak luar bawah
    // Jarak luar bawah
    shadowColor: '#3B82F6', // Glow biru
    // Glow biru
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.3, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 8, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 4, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Tombol bayar saat disabled (nominal = 0 atau loading) ──
  scanButtonDisabled: { opacity: 0.5 }, // Redup 50% tanda tidak aktif
  // Redup 50% tanda tidak aktif

  // ── Teks di dalam tombol bayar ──
  scanButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }, // Teks putih bold di tombol scan NFC
  // Teks putih bold di tombol scan NFC

  // ── Baris info keamanan di bawah tombol ("🔒 Transaksi aman...") ──
  securityInfo: {
    flexDirection: 'row', // Ikon dan teks berjajar horizontal
    // Ikon dan teks berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    justifyContent: 'center', // Di tengah horizontal
    // Di tengah horizontal
    gap: 8, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
  },

  // ── Emoji gembok di info keamanan ──
  securityIcon: { fontSize: 16 }, // Emoji ikon keamanan (kecil)
  // Emoji ikon keamanan (kecil)

  // ── Teks keterangan keamanan ──
  securityText: { fontSize: 13, color: '#64748b' }, // Teks kecil abu-abu info keamanan
  // Teks kecil abu-abu info keamanan

  // ── Overlay gelap saat modal NFC scanning muncul ──
  modalOverlay: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    // Proporsi flexbox relatif terhadap sibling
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Hitam 50% transparan
    // Hitam 50% transparan
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    padding: 24, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
  },

  // ── Container konten modal scanning ──
  modalContent: {
    width: '100%', // Lebar elemen
    // Lebar elemen
    maxWidth: 400, // Lebar maksimal agar tidak terlalu lebar di tablet
    // Lebar maksimal agar tidak terlalu lebar di tablet
  },

  // ── Card putih berisi animasi scanning NFC ──
  scanningCard: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 24, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    padding: 32, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
  },

  // ── Emoji animasi scanning ──
  scanningIcon: { fontSize: 48 }, // Emoji besar di animasi scanning NFC
  // Emoji besar di animasi scanning NFC

  // ── Teks gelombang NFC di sudut card scanning ──
  nfcWaves: {
    fontSize: 32, // Ukuran font
    // Ukuran font
    color: '#fff', // Warna teks
    // Warna teks
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    position: 'absolute', // Diposisikan bebas di dalam scanningCard
    // Diposisikan bebas di dalam scanningCard
    right: 20, // Posisi dari tepi kanan
    // Posisi dari tepi kanan
    top: 20, // Posisi dari tepi atas
    // Posisi dari tepi atas
  },

  // ── Container info transaksi di dalam modal ──
  scanningInfo: { marginBottom: 24 }, // Kotak info dengan jarak bawah
  // Kotak info dengan jarak bawah

  // ── Teks "Menunggu kartu..." ──
  scanningWaiting: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#3B82F6', // Biru agar terasa aktif/loading
    // Biru agar terasa aktif/loading
    textAlign: 'center', // Perataan teks
    // Perataan teks
  },

  // ── Teks label nominal di modal scanning ──
  transactionAmount: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
    marginBottom: 4, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Nilai nominal besar di modal scanning ──
  transactionAmountValue: {
    fontSize: 32, // Sangat besar agar nominal jelas terlihat
    // Sangat besar agar nominal jelas terlihat
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Kotak info biru muda di dalam modal ──
  infoBox: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    backgroundColor: '#eff6ff', // Biru sangat muda
    // Biru sangat muda
    padding: 16, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Ikon info ──
  infoIcon: { fontSize: 16, marginRight: 8 }, // Emoji ikon info kecil dengan jarak kanan
  // Emoji ikon info kecil dengan jarak kanan

  // ── Teks info dalam kotak biru ──
  infoText: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    // Proporsi flexbox relatif terhadap sibling
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#1e40af', // Biru tua kontras di latar biru muda
    // Biru tua kontras di latar biru muda
    lineHeight: 18, // Tinggi baris teks
    // Tinggi baris teks
  },

  // ── Judul di dalam modal scanning ("Scan Kartu NFC") ──
  scanningTitle: {
    fontSize: 20, // Heading modal
    // Heading modal
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Navy gelap
    // Navy gelap
    marginTop: 16, // Jarak dari ikon scanning di atas
    // Jarak dari ikon scanning di atas
    marginBottom: 8, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Subtitle instruksi di modal ("Tempelkan kartu...") ──
  scanningSubtitle: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu sedang
    // Abu-abu sedang
    textAlign: 'center', // Perataan teks
    // Perataan teks
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Container animasi kartu NFC bergerak ──
  scanningAnimation: {
    width: '100%', // Lebar elemen
    // Lebar elemen
    alignItems: 'center', // Animasi di tengah horizontal
    // Animasi di tengah horizontal
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Representasi visual kartu NFC fisik ──
  nfcCardVisual: {
    flexDirection: 'row', // Ikon kartu dan gelombang berjajar
    // Ikon kartu dan gelombang berjajar
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    gap: 8, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
  },

  // ── Emoji kartu kredit dalam animasi ──
  nfcCardIcon: {
    fontSize: 48, // Besar agar terlihat jelas dalam modal
    // Besar agar terlihat jelas dalam modal
  },

  // ── Tombol "Batal" di modal scanning ──
  cancelButton: {
    paddingVertical: 14, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 32, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
  },

  // ── Teks tombol batal ──
  cancelButtonText: {
    color: '#3B82F6', // Biru sebagai tanda link/aksi
    // Biru sebagai tanda link/aksi
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
  },

});

export default styles; // Ekspor agar bisa digunakan di NFCScreenPayment.tsx
// Ekspor agar bisa digunakan di NFCScreenPayment.tsx
