// src/screens/TransactionSuccessScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk TransactionSuccessScreen
// Ditampilkan setelah transaksi NFC berhasil — berisi info nominal,
// detail pihak, dan skor risiko fraud detection Z-Score
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

  // ── ScrollView agar konten bisa digulir ──
  scrollView: {
    flex: 1, // Ambil sisa ruang setelah header
    // Ambil sisa ruang setelah header
  },

  // ── Konten dalam ScrollView ──
  content: {
    padding: 24, // Padding 24dp dari semua sisi
    // Padding 24dp dari semua sisi
    paddingTop: 40, // Tambahan jarak dari atas agar tidak menempel tepi
    // Tambahan jarak dari atas agar tidak menempel tepi
  },

  // ── Area ikon centang sukses ──
  successIcon: {
    alignItems: 'center', // Centang di tengah horizontal
    // Centang di tengah horizontal
    marginBottom: 24, // Jarak ke judul di bawah
    // Jarak ke judul di bawah
  },

  // ── Lingkaran hijau berisi centang ──
  checkmarkCircle: {
    width: 100, // Diameter 100dp
    // Diameter 100dp
    height: 100, // Tinggi elemen
    // Tinggi elemen
    borderRadius: 50, // Bulat sempurna (50 = setengah 100)
    // Bulat sempurna (50 = setengah 100)
    backgroundColor: '#10B981', // Hijau emerald untuk sukses
    // Hijau emerald untuk sukses
    justifyContent: 'center', // Centang di tengah vertikal
    // Centang di tengah vertikal
    alignItems: 'center', // Centang di tengah horizontal
    // Centang di tengah horizontal
    shadowColor: '#10B981', // Glow hijau di bawah lingkaran
    // Glow hijau di bawah lingkaran
    shadowOffset: { width: 0, height: 8 }, // Bayangan ke bawah 8dp
    // Bayangan ke bawah 8dp
    shadowOpacity: 0.3, // Bayangan 30%
    // Bayangan 30%
    shadowRadius: 16, // Blur bayangan lebar
    // Blur bayangan lebar
    elevation: 8, // Shadow Android
    // Shadow Android
  },

  // ── Simbol centang (✓) ──
  checkmark: {
    fontSize: 48, // Besar agar terlihat jelas di lingkaran 100dp
    // Besar agar terlihat jelas di lingkaran 100dp
    color: '#fff', // Putih kontras dengan hijau
    // Putih kontras dengan hijau
    fontWeight: 'bold', // Tebal
    // Tebal
  },

  // ── Judul sukses ("Pembayaran Berhasil!") ──
  title: {
    fontSize: 28, // Font besar untuk momen penting
    // Font besar untuk momen penting
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Navy gelap
    // Navy gelap
    textAlign: 'center', // Rata tengah
    // Rata tengah
    marginBottom: 8, // Jarak ke subtitle
    // Jarak ke subtitle
  },

  // ── Subtitle di bawah judul ──
  subtitle: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu sedang
    // Abu-abu sedang
    textAlign: 'center', // Perataan teks
    // Perataan teks
    marginBottom: 32, // Jarak besar ke card nominal
    // Jarak besar ke card nominal
  },

  // ── Card nominal transaksi ──
  amountCard: {
    backgroundColor: '#fff', // Latar putih
    // Latar putih
    borderRadius: 20, // Sudut membulat besar
    // Sudut membulat besar
    padding: 24, // Padding dalam card
    // Padding dalam card
    alignItems: 'center', // Konten di tengah horizontal
    // Konten di tengah horizontal
    marginBottom: 20, // Jarak ke card detail
    // Jarak ke card detail
    shadowColor: '#000', // Bayangan hitam
    // Bayangan hitam
    shadowOffset: { width: 0, height: 4 }, // Bayangan ke bawah
    // Bayangan ke bawah
    shadowOpacity: 0.1, // Bayangan 10%
    // Bayangan 10%
    shadowRadius: 12, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 5, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Label "Nominal Dibayar" ──
  amountLabel: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu agar tidak terlalu dominan
    // Abu-abu agar tidak terlalu dominan
    marginBottom: 8, // Jarak ke angka nominal
    // Jarak ke angka nominal
  },

  // ── Angka nominal transaksi (misalnya Rp 50.000) ──
  amount: {
    fontSize: 36, // Sangat besar agar menonjol
    // Sangat besar agar menonjol
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Navy gelap
    // Navy gelap
  },

  // ── Card detail transaksi (pengirim, penerima, waktu, dll) ──
  detailsCard: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 20, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    padding: 24, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    marginBottom: 20, // Jarak luar bawah
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

  // ── Bagian dalam detail (misalnya bagian "Pengirim" & "Penerima") ──
  detailSection: {
    marginBottom: 20, // Jarak antar bagian
    // Jarak antar bagian
  },

  // ── Baris header bagian detail (ikon + teks label) ──
  detailHeader: {
    flexDirection: 'row', // Ikon dan label berjajar horizontal
    // Ikon dan label berjajar horizontal
    alignItems: 'center', // Rata tengah vertikal
    // Rata tengah vertikal
    marginBottom: 16, // Jarak ke isi detail
    // Jarak ke isi detail
    gap: 8, // Jarak antara ikon dan teks
    // Jarak antara ikon dan teks
  },

  // ── Ikon di header bagian detail ──
  detailHeaderIcon: { fontSize: 20 }, // Emoji ikon di header detail transaksi
  // Emoji ikon di header detail transaksi

  // ── Teks label header bagian detail ──
  detailHeaderText: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Semi-bold
    // Semi-bold
    color: '#1e293b', // Warna teks
    // Warna teks
  },

  // ── Container isi detail ──
  detailContent: { gap: 8 }, // Jarak 8dp antar baris detail
  // Jarak 8dp antar baris detail

  // ── Nama orang (pengirim/penerima) ──
  detailName: {
    fontSize: 18, // Agak besar untuk nama
    // Agak besar untuk nama
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginBottom: 8, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Label kecil (misalnya "Username:", "Waktu:") ──
  detailLabel: {
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu redup untuk label sekunder
    // Abu-abu redup untuk label sekunder
  },

  // ── Nilai detail (isi dari label) ──
  detailValue: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#1e293b', // Warna teks
    // Warna teks
    fontWeight: '500', // Ketebalan font
    // Ketebalan font
    marginBottom: 8, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Nilai saldo (ditampilkan warna biru) ──
  balanceValue: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#3B82F6', // Biru sebagai aksen untuk saldo
    // Biru sebagai aksen untuk saldo
  },

  // ── Jumlah positif (penerima mendapat uang) ──
  positiveAmount: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#10B981', // Hijau = uang masuk
    // Hijau = uang masuk
  },

  // ── Garis pemisah antar bagian detail ──
  divider: {
    height: 1, // Garis tipis 1dp
    // Garis tipis 1dp
    backgroundColor: '#f1f5f9', // Warna abu muda agar halus
    // Warna abu muda agar halus
    marginVertical: 16, // Margin atas & bawah
    // Margin atas & bawah
  },

  // ── Card skor risiko fraud detection Z-Score ──
  riskCard: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 20, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    padding: 24, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
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

  // ── Baris header card risiko (ikon + teks) ──
  riskHeader: {
    flexDirection: 'row', // Ikon dan teks berjajar horizontal
    // Ikon dan teks berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    marginBottom: 16, // Jarak luar bawah
    // Jarak luar bawah
    gap: 12, // Jarak antar elemen
    // Jarak antar elemen
  },

  // ── Emoji ikon di header risiko ──
  riskIcon: { fontSize: 32 }, // Emoji ikon besar di section risiko Z-Score
  // Emoji ikon besar di section risiko Z-Score

  // ── Container teks di header risiko ──
  riskHeaderText: { flex: 1 }, // Ambil sisa lebar
  // Ambil sisa lebar

  // ── Judul card risiko ──
  riskTitle: {
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
  },

  // ── Subtitle card risiko (misalnya "Z-Score Analysis") ──
  riskSubtitle: {
    fontSize: 12, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
  },

  // ── Container isi skor risiko ──
  riskContent: { gap: 12 }, // Jarak 12dp antar baris
  // Jarak 12dp antar baris

  // ── Baris "Z-Score: X.XX" ──
  riskScoreRow: {
    flexDirection: 'row', // Label dan nilai berjajar horizontal
    // Label dan nilai berjajar horizontal
    justifyContent: 'space-between', // Label di kiri, nilai di kanan
    // Label di kiri, nilai di kanan
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
  },

  // ── Label "Z-Score" ──
  riskScoreLabel: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
  },

  // ── Nilai Z-Score (angka) ──
  riskScoreValue: {
    fontSize: 24, // Besar agar menonjol
    // Besar agar menonjol
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
  },

  // ── Baris "Tingkat Risiko" ──
  riskLevelRow: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    justifyContent: 'space-between', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
  },

  // ── Label "Tingkat Risiko" ──
  riskLevelLabel: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
  },

  // ── Badge level risiko (NORMAL / SUSPICIOUS / ANOMALY) ──
  riskLevelBadge: {
    flexDirection: 'row', // Titik warna + teks berjajar horizontal
    // Titik warna + teks berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    paddingVertical: 6, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 12, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 12, // Berbentuk pil
    // Berbentuk pil
    gap: 6, // Jarak antara titik dan teks
    // Jarak antara titik dan teks
    // Warna latar diisi secara dinamis dari kode
  },

  // ── Titik warna status risiko ──
  riskLevelDot: {
    width: 8, // Lebar elemen
    // Lebar elemen
    height: 8, // Tinggi elemen
    // Tinggi elemen
    borderRadius: 4, // Bulat sempurna
    // Bulat sempurna
    // Warna diisi dinamis (hijau/kuning/merah)
  },

  // ── Teks level risiko (NORMAL / SUSPICIOUS / ANOMALY) ──
  riskLevelText: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
    // Warna diisi dinamis dari kode
  },

  // ── Container tombol aksi di bawah (Kembali ke Home / Lihat Riwayat) ──
  actions: {
    gap: 12, // Jarak 12dp antar tombol
    // Jarak 12dp antar tombol
  },

  // ── Tombol primer (Kembali ke Beranda) ──
  primaryButton: {
    backgroundColor: '#3B82F6', // Biru utama brand
    // Biru utama brand
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    paddingVertical: 16, // Tinggi tombol nyaman disentuh
    // Tinggi tombol nyaman disentuh
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    shadowColor: '#3B82F6', // Glow biru di bawah
    // Glow biru di bawah
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    // Arah dan jarak bayangan
    shadowOpacity: 0.3, // Transparansi bayangan
    // Transparansi bayangan
    shadowRadius: 8, // Blur radius bayangan
    // Blur radius bayangan
    elevation: 4, // Ketinggian bayangan (Android)
    // Ketinggian bayangan (Android)
  },

  // ── Teks tombol primer ──
  primaryButtonText: {
    color: '#fff', // Warna teks
    // Warna teks
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
  },

  // ── Tombol sekunder (Lihat Riwayat) — putih dengan border biru ──
  secondaryButton: {
    backgroundColor: '#fff', // Latar putih
    // Latar putih
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    paddingVertical: 16, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    borderWidth: 2, // Border tebal 2dp
    // Border tebal 2dp
    borderColor: '#3B82F6', // Border biru agar selaras dengan tombol primer
    // Border biru agar selaras dengan tombol primer
  },

  // ── Teks tombol sekunder ──
  secondaryButtonText: {
    color: '#3B82F6', // Teks biru (bukan putih seperti tombol primer)
    // Teks biru (bukan putih seperti tombol primer)
    fontSize: 16, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
  },

});

export default styles; // Ekspor agar bisa digunakan di TransactionSuccessScreen.tsx
// Ekspor agar bisa digunakan di TransactionSuccessScreen.tsx
