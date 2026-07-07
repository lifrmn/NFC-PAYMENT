// src/screens/RegisterCardScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk RegisterCardScreen
// Screen ini memandu user mendaftarkan kartu NFC fisik ke akun mereka
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
    borderBottomWidth: 1, // Garis bawah tipis
    // Garis bawah tipis
    borderBottomColor: '#f1f5f9', // Warna garis abu muda
    // Warna garis abu muda
  },

  // ── Tombol kembali (lingkaran abu kecil) ──
  backButton: {
    width: 40, // Lebar area sentuh 40dp
    // Lebar area sentuh 40dp
    height: 40, // Tinggi area sentuh 40dp
    // Tinggi area sentuh 40dp
    borderRadius: 20, // Bulat sempurna (radius = setengah width)
    // Bulat sempurna (radius = setengah width)
    backgroundColor: '#f8fafc', // Latar abu sangat muda
    // Latar abu sangat muda
    justifyContent: 'center', // Ikon di tengah vertikal
    // Ikon di tengah vertikal
    alignItems: 'center', // Ikon di tengah horizontal
    // Ikon di tengah horizontal
  },

  // ── Ikon panah di tombol kembali ──
  backIcon: {
    fontSize: 24, // Ukuran ikon
    // Ukuran ikon
    color: '#1e293b', // Navy gelap agar kontras
    // Navy gelap agar kontras
  },

  // ── Judul halaman di tengah header ──
  headerTitle: {
    fontSize: 18, // Ukuran heading medium
    // Ukuran heading medium
    fontWeight: 'bold', // Tebal
    // Tebal
    color: '#1e293b', // Navy gelap
    // Navy gelap
  },

  // ── Spacer kanan header (menyeimbangkan backButton agar judul di tengah) ──
  headerSpacer: {
    width: 40, // Sama dengan lebar backButton
    // Sama dengan lebar backButton
  },

  // ── Area konten utama dengan padding ──
  content: {
    flex: 1, // Ambil sisa ruang setelah header
    // Ambil sisa ruang setelah header
    padding: 24, // Padding 24dp dari semua sisi
    // Padding 24dp dari semua sisi
  },

  // ── Area tengah (saat error / state khusus) ──
  centerContent: {
    flex: 1, // Ambil seluruh ruang
    // Ambil seluruh ruang
    justifyContent: 'center', // Vertikal di tengah
    // Vertikal di tengah
    alignItems: 'center', // Horizontal di tengah
    // Horizontal di tengah
    padding: 24, // Padding dari semua sisi
    // Padding dari semua sisi
  },

  // ── Bagian hero dengan logo di atas form ──
  heroSection: {
    alignItems: 'center', // Logo dan teks di tengah horizontal
    // Logo dan teks di tengah horizontal
    marginBottom: 32, // Jarak ke card scan di bawah
    // Jarak ke card scan di bawah
  },

  // ── Container pembungkus logo + badge perisai ──
  logoContainer: {
    position: 'relative', // Diperlukan agar badge bisa absolute
    // Diperlukan agar badge bisa absolute
    width: 100, // Lebar area logo
    // Lebar area logo
    height: 100, // Tinggi area logo
    // Tinggi area logo
    marginBottom: 20, // Jarak ke teks judul
    // Jarak ke teks judul
  },

  // ── Logo utama (kotak biru dengan ikon) ──
  logo: {
    width: 100, // Ukuran logo
    // Ukuran logo
    height: 100, // Tinggi elemen
    // Tinggi elemen
    backgroundColor: '#3B82F6', // Biru utama brand
    // Biru utama brand
    borderRadius: 24, // Sudut membulat modern
    // Sudut membulat modern
    justifyContent: 'center', // Konten di tengah
    // Konten di tengah
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    shadowColor: '#3B82F6', // Glow biru di bawah logo
    // Glow biru di bawah logo
    shadowOffset: { width: 0, height: 8 }, // Bayangan ke bawah 8dp
    // Bayangan ke bawah 8dp
    shadowOpacity: 0.3, // Bayangan 30%
    // Bayangan 30%
    shadowRadius: 16, // Blur lebar
    // Blur lebar
    elevation: 8, // Shadow Android
    // Shadow Android
  },

  // ── Emoji ikon di dalam logo ──
  logoIcon: {
    fontSize: 40, // Ukuran emoji besar
    // Ukuran emoji besar
    marginBottom: -5, // Geser sedikit ke atas agar teks gelombang lebih dekat
    // Geser sedikit ke atas agar teks gelombang lebih dekat
  },

  // ── Teks gelombang NFC ")))" di logo ──
  logoWave: {
    fontSize: 24, // Ukuran sedang
    // Ukuran sedang
    color: '#fff', // Putih kontras dengan latar biru
    // Putih kontras dengan latar biru
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
  },

  // ── Badge perisai hijau di pojok kanan bawah logo ──
  logoShield: {
    position: 'absolute', // Di atas logoContainer
    // Di atas logoContainer
    right: -5, // Geser keluar 5dp ke kanan
    // Geser keluar 5dp ke kanan
    bottom: -5, // Geser keluar 5dp ke bawah
    // Geser keluar 5dp ke bawah
    width: 36, // Ukuran badge
    // Ukuran badge
    height: 36, // Tinggi elemen
    // Tinggi elemen
    backgroundColor: '#10B981', // Hijau emerald (sukses)
    // Hijau emerald (sukses)
    borderRadius: 18, // Bulat sempurna
    // Bulat sempurna
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    shadowColor: '#000', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 2 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.1, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 4, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 4, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Emoji perisai di dalam badge ──
  shieldIcon: {
    fontSize: 20, // Ukuran font
    // Ukuran font
    color: '#fff', // Putih agar kontras di atas hijau
    // Putih agar kontras di atas hijau
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
  },

  // ── Judul halaman daftarkan kartu ──
  title: {
    fontSize: 24, // Heading besar
    // Heading besar
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Navy gelap
    // Navy gelap
    marginBottom: 8, // Jarak ke subtitle
    // Jarak ke subtitle
    textAlign: 'center', // Perataan teks
    // Perataan teks
  },

  // ── Subtitle instruksi ──
  subtitle: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu sedang
    // Abu-abu sedang
    textAlign: 'center', // Perataan teks
    // Perataan teks
    paddingHorizontal: 20, // Padding agar tidak terlalu lebar
    // Padding agar tidak terlalu lebar
  },

  // ── Card utama area scan NFC ──
  scanCard: {
    backgroundColor: '#fff', // Latar putih
    // Latar putih
    borderRadius: 24, // Sudut membulat besar
    // Sudut membulat besar
    padding: 32, // Padding lebar agar konten tidak sesak
    // Padding lebar agar konten tidak sesak
    alignItems: 'center', // Semua konten di tengah
    // Semua konten di tengah
    marginBottom: 24, // Jarak ke card lain
    // Jarak ke card lain
    shadowColor: '#000', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.1, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 12, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 5, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Card saat scan berhasil / kartu terdaftar ──
  successCard: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 24, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    padding: 32, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
    shadowColor: '#000', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.1, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 12, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 5, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Emoji besar di card sukses ──
  successIcon: { fontSize: 64, marginBottom: 16 }, // Emoji centang besar di state sukses
  // Emoji centang besar di state sukses

  // ── Judul sukses di card ──
  successTitle: {
    fontSize: 20, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#10B981', // Hijau = berhasil
    // Hijau = berhasil
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Container animasi sinyal NFC (lingkaran bergelombang) ──
  nfcAnimation: {
    width: 150, // Lebar elemen
    // Lebar elemen
    height: 150, // Tinggi elemen
    // Tinggi elemen
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    marginBottom: 32, // Jarak luar bawah
    // Jarak luar bawah
    position: 'relative', // Agar wave bisa absolute di dalamnya
    // Agar wave bisa absolute di dalamnya
  },

  // ── Lingkaran biru tengah (ikon NFC utama) ──
  nfcCircle: {
    width: 80, // Lebar elemen
    // Lebar elemen
    height: 80, // Tinggi elemen
    // Tinggi elemen
    borderRadius: 40, // Bulat sempurna
    // Bulat sempurna
    backgroundColor: '#3B82F6', // Biru brand
    // Biru brand
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    zIndex: 10, // Di atas wave agar tidak tertimpa
    // Di atas wave agar tidak tertimpa
  },

  // ── Emoji NFC di dalam lingkaran biru ──
  nfcIcon: {
    fontSize: 40, // Ukuran font
    // Ukuran font
    color: '#fff', // Putih kontras
    // Putih kontras
  },

  // ── Style dasar semua gelombang NFC (lingkaran transparan) ──
  nfcWave: {
    position: 'absolute', // Semua wave bertumpuk di tengah
    // Semua wave bertumpuk di tengah
    borderRadius: 100, // Bulat sempurna
    // Bulat sempurna
    borderWidth: 2, // Garis tepi tipis
    // Garis tepi tipis
    borderColor: '#3B82F6', // Biru agar sinyal NFC terasa
    // Biru agar sinyal NFC terasa
    opacity: 0.3, // Transparan sebagai efek propagasi gelombang
    // Transparan sebagai efek propagasi gelombang
  },

  // ── Gelombang NFC lingkaran pertama (terkecil) ──
  nfcWave1: { width: 100, height: 100 },

  // ── Gelombang NFC lingkaran kedua (menengah) ──
  nfcWave2: { width: 120, height: 120, opacity: 0.2 },

  // ── Gelombang NFC lingkaran ketiga (terbesar, paling transparan) ──
  nfcWave3: { width: 140, height: 140, opacity: 0.1 },

  // ── Container UID kartu NFC yang berhasil dibaca ──
  cardIdContainer: {
    width: '100%', // Selebar card
    // Selebar card
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Label di atas UID ("ID Kartu:") ──
  cardIdLabel: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
    color: '#64748b', // Warna teks
    // Warna teks
    marginBottom: 8, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Kotak berisi UID kartu (abu-abu dengan border) ──
  cardIdBox: {
    flexDirection: 'row', // Ikon + teks + tombol copy berjajar horizontal
    // Ikon + teks + tombol copy berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#f8fafc', // Latar abu sangat muda
    // Latar abu sangat muda
    padding: 16, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    borderWidth: 1, // Ketebalan border
    // Ketebalan border
    borderColor: '#e2e8f0', // Border abu muda
    // Border abu muda
  },

  // ── Ikon kartu NFC di kiri kotak UID ──
  cardIdIcon: { fontSize: 20, marginRight: 12 }, // Emoji ikon ID kartu dengan jarak kanan
  // Emoji ikon ID kartu dengan jarak kanan

  // ── Teks UID kartu (format monospace) ──
  cardIdText: {
    flex: 1, // Ambil sisa lebar setelah ikon
    // Ambil sisa lebar setelah ikon
    fontSize: 14, // Ukuran font
    // Ukuran font
    fontFamily: 'monospace', // Monospace agar UID terbaca jelas
    // Monospace agar UID terbaca jelas
    color: '#1e293b', // Warna teks
    // Warna teks
    fontWeight: '500', // Ketebalan font
    // Ketebalan font
  },

  // ── Tombol copy UID ──
  copyButton: { padding: 8 }, // Area sentuh yang cukup
  // Area sentuh yang cukup

  // ── Ikon di tombol copy ──
  copyIcon: { fontSize: 16 }, // Emoji salin UID kartu
  // Emoji salin UID kartu

  // ── Kotak info biru muda (petunjuk cara daftar kartu) ──
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
    width: '100%', // Lebar elemen
    // Lebar elemen
  },

  // ── Ikon di dalam kotak info ──
  infoIcon: { fontSize: 16, marginRight: 8 }, // Emoji ikon info kecil dengan jarak kanan
  // Emoji ikon info kecil dengan jarak kanan

  // ── Teks penjelasan dalam kotak info ──
  infoText: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    // Proporsi flexbox relatif terhadap sibling
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#1e40af', // Biru tua agar kontras di latar biru muda
    // Biru tua agar kontras di latar biru muda
    lineHeight: 18, // Spasi baris agar mudah dibaca
    // Spasi baris agar mudah dibaca
  },

  // ── Tombol "Scan Kartu" ──
  scanButton: {
    backgroundColor: '#3B82F6', // Biru utama
    // Biru utama
    paddingVertical: 16, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 32, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    width: '100%', // Selebar card
    // Selebar card
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
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

  // ── Tombol scan saat disabled ──
  scanButtonDisabled: { opacity: 0.6 }, // Redup 40%
  // Redup 40%

  // ── Teks tombol scan ──
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }, // Teks putih bold di tombol scan
  // Teks putih bold di tombol scan

  // ── Tombol "Daftarkan Kartu" (setelah scan berhasil) ──
  registerButton: {
    backgroundColor: '#3B82F6', // Warna latar belakang
    // Warna latar belakang
    paddingVertical: 16, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 32, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    width: '100%', // Lebar elemen
    // Lebar elemen
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    shadowColor: '#3B82F6', // Warna bayangan elemen
    // Warna bayangan elemen
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.3, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 8, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 4, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Teks tombol daftarkan ──
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }, // Teks putih bold di tombol daftar kartu
  // Teks putih bold di tombol daftar kartu

  // ── Info keamanan (kotak hijau muda di bawah) ──
  securityInfo: {
    flexDirection: 'row', // Ikon dan teks berjajar horizontal
    // Ikon dan teks berjajar horizontal
    alignItems: 'flex-start', // Rata atas agar teks panjang tidak putus
    // Rata atas agar teks panjang tidak putus
    backgroundColor: '#f0fdf4', // Hijau sangat muda
    // Hijau sangat muda
    padding: 16, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 12, // Jarak antara ikon dan teks
    // Jarak antara ikon dan teks
  },

  // ── Ikon perisai dalam info keamanan ──
  securityIcon: { fontSize: 20 }, // Emoji ikon keamanan (sedang)
  // Emoji ikon keamanan (sedang)

  // ── Teks info keamanan ──
  securityText: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    // Proporsi flexbox relatif terhadap sibling
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#15803d', // Hijau gelap agar kontras di latar hijau muda
    // Hijau gelap agar kontras di latar hijau muda
    lineHeight: 18, // Tinggi baris teks
    // Tinggi baris teks
  },

  // ── Ikon besar saat error ──
  errorIcon: { fontSize: 64, marginBottom: 16 }, // Emoji error besar dengan jarak bawah
  // Emoji error besar dengan jarak bawah

  // ── Judul error ──
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

  // ── Teks deskripsi error ──
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

  // ── Card instruksi cara mengatasi error ──
  instructionCard: {
    backgroundColor: '#fff', // Latar putih
    // Latar putih
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

  // ── Item baris instruksi (misalnya "1. Pastikan NFC aktif") ──
  instructionItem: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#475569', // Abu-abu sedang
    // Abu-abu sedang
    marginBottom: 8, // Jarak antar item
    // Jarak antar item
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

});

export default styles; // Ekspor agar bisa digunakan di RegisterCardScreen.tsx
// Ekspor agar bisa digunakan di RegisterCardScreen.tsx
