// src/screens/RegisterCardScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk RegisterCardScreen
// Screen ini memandu user mendaftarkan kartu NFC fisik ke akun mereka
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
    borderBottomWidth: 1,          // Garis bawah tipis
    borderBottomColor: '#f1f5f9',  // Warna garis abu muda
  },

  // ── Tombol kembali (lingkaran abu kecil) ──
  backButton: {
    width: 40,                  // Lebar area sentuh 40dp
    height: 40,                 // Tinggi area sentuh 40dp
    borderRadius: 20,           // Bulat sempurna (radius = setengah width)
    backgroundColor: '#f8fafc', // Latar abu sangat muda
    justifyContent: 'center',   // Ikon di tengah vertikal
    alignItems: 'center',       // Ikon di tengah horizontal
  },

  // ── Ikon panah di tombol kembali ──
  backIcon: {
    fontSize: 24,      // Ukuran ikon
    color: '#1e293b',  // Navy gelap agar kontras
  },

  // ── Judul halaman di tengah header ──
  headerTitle: {
    fontSize: 18,        // Ukuran heading medium
    fontWeight: 'bold',  // Tebal
    color: '#1e293b',    // Navy gelap
  },

  // ── Spacer kanan header (menyeimbangkan backButton agar judul di tengah) ──
  headerSpacer: {
    width: 40, // Sama dengan lebar backButton
  },

  // ── Area konten utama dengan padding ──
  content: {
    flex: 1,     // Ambil sisa ruang setelah header
    padding: 24, // Padding 24dp dari semua sisi
  },

  // ── Area tengah (saat error / state khusus) ──
  centerContent: {
    flex: 1,                  // Ambil seluruh ruang
    justifyContent: 'center', // Vertikal di tengah
    alignItems: 'center',     // Horizontal di tengah
    padding: 24,              // Padding dari semua sisi
  },

  // ── Bagian hero dengan logo di atas form ──
  heroSection: {
    alignItems: 'center', // Logo dan teks di tengah horizontal
    marginBottom: 32,     // Jarak ke card scan di bawah
  },

  // ── Container pembungkus logo + badge perisai ──
  logoContainer: {
    position: 'relative',  // Diperlukan agar badge bisa absolute
    width: 100,            // Lebar area logo
    height: 100,           // Tinggi area logo
    marginBottom: 20,      // Jarak ke teks judul
  },

  // ── Logo utama (kotak biru dengan ikon) ──
  logo: {
    width: 100,                              // Ukuran logo
    height: 100,
    backgroundColor: '#3B82F6',             // Biru utama brand
    borderRadius: 24,                        // Sudut membulat modern
    justifyContent: 'center',               // Konten di tengah
    alignItems: 'center',
    shadowColor: '#3B82F6',                 // Glow biru di bawah logo
    shadowOffset: { width: 0, height: 8 },  // Bayangan ke bawah 8dp
    shadowOpacity: 0.3,                     // Bayangan 30%
    shadowRadius: 16,                       // Blur lebar
    elevation: 8,                           // Shadow Android
  },

  // ── Emoji ikon di dalam logo ──
  logoIcon: {
    fontSize: 40,     // Ukuran emoji besar
    marginBottom: -5, // Geser sedikit ke atas agar teks gelombang lebih dekat
  },

  // ── Teks gelombang NFC ")))" di logo ──
  logoWave: {
    fontSize: 24,       // Ukuran sedang
    color: '#fff',      // Putih kontras dengan latar biru
    fontWeight: 'bold',
  },

  // ── Badge perisai hijau di pojok kanan bawah logo ──
  logoShield: {
    position: 'absolute',                    // Di atas logoContainer
    right: -5,                               // Geser keluar 5dp ke kanan
    bottom: -5,                              // Geser keluar 5dp ke bawah
    width: 36,                               // Ukuran badge
    height: 36,
    backgroundColor: '#10B981',             // Hijau emerald (sukses)
    borderRadius: 18,                        // Bulat sempurna
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── Emoji perisai di dalam badge ──
  shieldIcon: {
    fontSize: 20,
    color: '#fff',      // Putih agar kontras di atas hijau
    fontWeight: 'bold',
  },

  // ── Judul halaman daftarkan kartu ──
  title: {
    fontSize: 24,        // Heading besar
    fontWeight: 'bold',
    color: '#1e293b',    // Navy gelap
    marginBottom: 8,     // Jarak ke subtitle
    textAlign: 'center',
  },

  // ── Subtitle instruksi ──
  subtitle: {
    fontSize: 14,
    color: '#64748b',         // Abu-abu sedang
    textAlign: 'center',
    paddingHorizontal: 20,    // Padding agar tidak terlalu lebar
  },

  // ── Card utama area scan NFC ──
  scanCard: {
    backgroundColor: '#fff',                 // Latar putih
    borderRadius: 24,                        // Sudut membulat besar
    padding: 32,                             // Padding lebar agar konten tidak sesak
    alignItems: 'center',                   // Semua konten di tengah
    marginBottom: 24,                        // Jarak ke card lain
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },

  // ── Card saat scan berhasil / kartu terdaftar ──
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },

  // ── Emoji besar di card sukses ──
  successIcon: { fontSize: 64, marginBottom: 16 },

  // ── Judul sukses di card ──
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',  // Hijau = berhasil
    marginBottom: 24,
  },

  // ── Container animasi sinyal NFC (lingkaran bergelombang) ──
  nfcAnimation: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',  // Agar wave bisa absolute di dalamnya
  },

  // ── Lingkaran biru tengah (ikon NFC utama) ──
  nfcCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,          // Bulat sempurna
    backgroundColor: '#3B82F6', // Biru brand
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,                // Di atas wave agar tidak tertimpa
  },

  // ── Emoji NFC di dalam lingkaran biru ──
  nfcIcon: {
    fontSize: 40,
    color: '#fff',  // Putih kontras
  },

  // ── Style dasar semua gelombang NFC (lingkaran transparan) ──
  nfcWave: {
    position: 'absolute',  // Semua wave bertumpuk di tengah
    borderRadius: 100,     // Bulat sempurna
    borderWidth: 2,        // Garis tepi tipis
    borderColor: '#3B82F6', // Biru agar sinyal NFC terasa
    opacity: 0.3,          // Transparan sebagai efek propagasi gelombang
  },

  // ── Gelombang NFC lingkaran pertama (terkecil) ──
  nfcWave1: { width: 100, height: 100 },

  // ── Gelombang NFC lingkaran kedua (menengah) ──
  nfcWave2: { width: 120, height: 120, opacity: 0.2 },

  // ── Gelombang NFC lingkaran ketiga (terbesar, paling transparan) ──
  nfcWave3: { width: 140, height: 140, opacity: 0.1 },

  // ── Container UID kartu NFC yang berhasil dibaca ──
  cardIdContainer: {
    width: '100%',   // Selebar card
    marginBottom: 24,
  },

  // ── Label di atas UID ("ID Kartu:") ──
  cardIdLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },

  // ── Kotak berisi UID kartu (abu-abu dengan border) ──
  cardIdBox: {
    flexDirection: 'row',    // Ikon + teks + tombol copy berjajar horizontal
    alignItems: 'center',
    backgroundColor: '#f8fafc', // Latar abu sangat muda
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',   // Border abu muda
  },

  // ── Ikon kartu NFC di kiri kotak UID ──
  cardIdIcon: { fontSize: 20, marginRight: 12 },

  // ── Teks UID kartu (format monospace) ──
  cardIdText: {
    flex: 1,                // Ambil sisa lebar setelah ikon
    fontSize: 14,
    fontFamily: 'monospace', // Monospace agar UID terbaca jelas
    color: '#1e293b',
    fontWeight: '500',
  },

  // ── Tombol copy UID ──
  copyButton: { padding: 8 }, // Area sentuh yang cukup

  // ── Ikon di tombol copy ──
  copyIcon: { fontSize: 16 },

  // ── Kotak info biru muda (petunjuk cara daftar kartu) ──
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',  // Biru sangat muda
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },

  // ── Ikon di dalam kotak info ──
  infoIcon: { fontSize: 16, marginRight: 8 },

  // ── Teks penjelasan dalam kotak info ──
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',  // Biru tua agar kontras di latar biru muda
    lineHeight: 18,    // Spasi baris agar mudah dibaca
  },

  // ── Tombol "Scan Kartu" ──
  scanButton: {
    backgroundColor: '#3B82F6',             // Biru utama
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',                           // Selebar card
    alignItems: 'center',
    shadowColor: '#3B82F6',                 // Glow biru
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Tombol scan saat disabled ──
  scanButtonDisabled: { opacity: 0.6 }, // Redup 40%

  // ── Teks tombol scan ──
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // ── Tombol "Daftarkan Kartu" (setelah scan berhasil) ──
  registerButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Teks tombol daftarkan ──
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // ── Info keamanan (kotak hijau muda di bawah) ──
  securityInfo: {
    flexDirection: 'row',        // Ikon dan teks berjajar horizontal
    alignItems: 'flex-start',    // Rata atas agar teks panjang tidak putus
    backgroundColor: '#f0fdf4',  // Hijau sangat muda
    padding: 16,
    borderRadius: 12,
    gap: 12,                     // Jarak antara ikon dan teks
  },

  // ── Ikon perisai dalam info keamanan ──
  securityIcon: { fontSize: 20 },

  // ── Teks info keamanan ──
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#15803d',  // Hijau gelap agar kontras di latar hijau muda
    lineHeight: 18,
  },

  // ── Ikon besar saat error ──
  errorIcon: { fontSize: 64, marginBottom: 16 },

  // ── Judul error ──
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },

  // ── Teks deskripsi error ──
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },

  // ── Card instruksi cara mengatasi error ──
  instructionCard: {
    backgroundColor: '#fff',  // Latar putih
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

  // ── Item baris instruksi (misalnya "1. Pastikan NFC aktif") ──
  instructionItem: {
    fontSize: 14,
    color: '#475569',   // Abu-abu sedang
    marginBottom: 8,    // Jarak antar item
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

});

export default styles; // Ekspor agar bisa digunakan di RegisterCardScreen.tsx
