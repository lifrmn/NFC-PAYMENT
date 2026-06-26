// src/screens/DashboardScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk DashboardScreen
// Halaman utama setelah login — menampilkan saldo, menu navigasi,
// riwayat transaksi, dan navigasi bawah (bottom tab bar)
// ============================================================

import { StyleSheet } from 'react-native'; // Import API styling React Native

const styles = StyleSheet.create({

  // ── Layar utama ──
  container: {
    flex: 1,                    // Isi seluruh tinggi layar
    backgroundColor: '#f8fafc', // Latar abu-abu sangat muda (slate-50)
  },

  // ── Container loading (saat data sedang diambil) ──
  loadingContainer: {
    flex: 1,                  // Isi seluruh layar
    justifyContent: 'center', // Spinner di tengah vertikal
    alignItems: 'center',     // Spinner di tengah horizontal
  },

  // ── Teks "Memuat..." di bawah spinner ──
  loadingText: {
    fontSize: 16, // Ukuran font
    color: '#64748b', // Abu-abu sedang
  },

  // ── ScrollView area konten ──
  scrollView: { flex: 1 }, // Area ScrollView mengisi sisa layar

  // ── Header atas (salam + nama + tombol notifikasi) ──
  header: {
    flexDirection: 'row',            // Salam dan tombol berjajar horizontal
    justifyContent: 'space-between', // Salam di kiri, tombol di kanan
    alignItems: 'center',            // Rata tengah vertikal
    paddingHorizontal: 24,           // Padding kiri-kanan
    paddingTop: 20,                  // Padding atas
    paddingBottom: 16,               // Padding bawah
    backgroundColor: '#fff',         // Latar putih
  },

  // ── Teks salam ("Halo, Nama!") ──
  greeting: {
    fontSize: 24,        // Besar sebagai sapaan utama
    fontWeight: 'bold', // Ketebalan font
    color: '#1e293b',    // Navy gelap
  },

  // ── Teks kecil di bawah salam (misalnya "Selamat datang kembali") ──
  greetingSubtext: {
    fontSize: 14, // Ukuran font
    color: '#64748b',  // Abu-abu sedang
    marginTop: 2,      // Jarak kecil dari salam di atas
  },

  // ── Tombol notifikasi (lingkaran abu) ──
  notificationButton: {
    position: 'relative',  // Agar titik merah bisa absolute di atasnya
    width: 44, // Lebar elemen
    height: 44, // Tinggi elemen
    borderRadius: 22,        // Bulat sempurna
    backgroundColor: '#f1f5f9', // Latar abu muda
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
  },

  // ── Titik merah (unread notification indicator) ──
  notificationDot: {
    position: 'absolute', // Mengapung di atas tombol
    top: 10,              // Jarak dari atas tombol
    right: 10,            // Jarak dari kanan tombol
    width: 8, // Lebar elemen
    height: 8, // Tinggi elemen
    borderRadius: 4,      // Bulat sempurna
    backgroundColor: '#EF4444', // Merah — ada notifikasi baru
  },

  // ── Emoji ikon lonceng ──
  notificationIcon: { fontSize: 20 }, // Ukuran emoji ikon notifikasi lonceng

  // ── Card saldo utama (biru, dengan bayangan besar) ──
  balanceCard: {
    marginHorizontal: 24,            // Margin kiri-kanan dari tepi layar
    marginTop: 20, // Jarak luar atas
    marginBottom: 24, // Jarak luar bawah
    padding: 24, // Jarak dalam semua sisi
    borderRadius: 20,                // Sudut membulat modern
    backgroundColor: '#3B82F6',     // Biru utama brand
    shadowColor: '#3B82F6',         // Glow biru di bawah card
    shadowOffset: { width: 0, height: 8 }, // Bayangan 8dp ke bawah
    shadowOpacity: 0.3,             // Bayangan 30%
    shadowRadius: 16,               // Blur lebar agar glow terlihat halus
    elevation: 8,                   // Shadow Android
  },

  // ── Baris atas card saldo (label "Saldo" + ikon dompet) ──
  balanceHeader: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    justifyContent: 'space-between', // Label di kiri, ikon di kanan
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    marginBottom: 8, // Jarak luar bawah
  },

  // ── Teks label "Saldo Anda" ──
  saldoLabel: {
    fontSize: 14, // Ukuran font
    color: '#fff',   // Putih di atas latar biru
    opacity: 0.9,    // Sedikit transparan agar label tidak dominan
  },

  // ── Container ikon dompet + badge perisai ──
  walletIcon: {
    position: 'relative',  // Agar badge bisa absolute
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
  },

  // ── Emoji dompet utama ──
  walletIconText: {
    fontSize: 32, // Ukuran font
    color: '#fff', // Warna teks
  },

  // ── Badge hijau bulat di pojok ikon dompet ──
  walletShield: {
    position: 'absolute', // Jenis posisi elemen (absolute/relative)
    right: -5,    // Keluar sedikit ke kanan
    bottom: -2, // Posisi dari tepi bawah
    width: 20, // Lebar elemen
    height: 20, // Tinggi elemen
    borderRadius: 10, // Bulat sempurna
    backgroundColor: '#10B981', // Hijau emerald
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
  },

  // ── Ikon perisai dalam badge ──
  walletShieldIcon: {
    fontSize: 12, // Ukuran font
    color: '#fff', // Warna teks
    fontWeight: 'bold', // Ketebalan font
  },

  // ── Angka saldo (format rupiah, misalnya Rp 150.000) ──
  balanceAmount: {
    fontSize: 36,        // Sangat besar agar saldo menonjol
    fontWeight: 'bold', // Ketebalan font
    color: '#fff',       // Putih di atas biru
    marginBottom: 16,    // Jarak ke tombol aksi di bawah
  },

  // ── Baris tombol aksi dalam card saldo (Top Up + Riwayat) ──
  balanceActions: {
    flexDirection: 'row', // Tombol berjajar horizontal
    gap: 12,              // Jarak antar tombol
  },

  // ── Tombol "Top Up" (putih dengan teks biru) ──
  topUpButton: {
    flexDirection: 'row',    // Ikon + teks berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#fff', // Latar putih kontras di atas biru
    paddingVertical: 10, // Jarak dalam atas dan bawah
    paddingHorizontal: 20, // Jarak dalam kiri dan kanan
    borderRadius: 12, // Kelengkungan sudut elemen
  },

  // ── Emoji ikon di tombol Top Up ──
  topUpIcon: { fontSize: 16, marginRight: 4 }, // Ukuran ikon Top Up dengan jarak kanan ke teks

  // ── Teks "Top Up" ──
  topUpText: {
    fontSize: 14, // Ukuran font
    fontWeight: '600', // Ketebalan font
    color: '#3B82F6', // Biru agar selaras dengan card
  },

  // ── Tombol "Riwayat" (transparan, teks putih) ──
  historyButton: {
    flex: 1,              // Ambil sisa lebar
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    paddingVertical: 10, // Jarak dalam atas dan bawah
  },

  // ── Teks "Riwayat" ──
  historyText: {
    fontSize: 14, // Ukuran font
    color: '#fff',      // Putih di atas biru
    fontWeight: '500', // Ketebalan font
  },

  // ── Section menu cepat (grid ikon) ──
  menuSection: {
    paddingHorizontal: 24, // Jarak dalam kiri dan kanan
    marginBottom: 24, // Jarak luar bawah
  },

  // ── Judul section menu ──
  menuTitle: {
    fontSize: 18, // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    color: '#1e293b', // Warna teks
    marginBottom: 16, // Jarak luar bawah
  },

  // ── Grid 3 kolom menu ──
  menuGrid: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    justifyContent: 'space-between', // Ikon tersebar merata
    gap: 16, // Jarak antar elemen dalam flex/grid
    paddingHorizontal: 4, // Jarak dalam kiri dan kanan
  },

  // ── Item menu individual ──
  menuItem: {
    flex: 1,              // Setiap item ambil lebar yang sama
    alignItems: 'center', // Ikon dan label di tengah
    maxWidth: 100,        // Batas lebar agar tidak terlalu lebar
  },

  // ── Kotak ikon menu (biru persegi bulat) ──
  menuIconContainer: {
    width: 72, // Lebar elemen
    height: 72, // Tinggi elemen
    borderRadius: 20,           // Sudut membulat modern
    backgroundColor: '#3B82F6', // Biru brand
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    marginBottom: 10,           // Jarak ke label di bawah ikon
    shadowColor: '#3B82F6',     // Glow biru
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    shadowOpacity: 0.3, // Transparansi bayangan
    shadowRadius: 10, // Blur radius bayangan
    elevation: 6, // Ketinggian bayangan (Android)
  },

  // ── Emoji ikon di dalam kotak menu ──
  menuIcon: { fontSize: 32, color: '#fff' }, // Emoji menu besar berwarna putih di atas biru

  // ── Label teks menu ──
  menuLabel: {
    fontSize: 13, // Ukuran font
    color: '#475569',    // Abu-abu sedang agar tidak terlalu mencolok
    textAlign: 'center', // Perataan teks
    fontWeight: '600',   // Semi-bold untuk label
    lineHeight: 16,      // Spasi baris kecil agar dua baris muat
  },

  // ── Section riwayat transaksi ──
  transactionSection: {
    paddingHorizontal: 24, // Jarak dalam kiri dan kanan
    paddingBottom: 100, // Padding bawah besar agar tidak tertimpa bottom nav
  },

  // ── Baris header section transaksi (judul + link "Lihat Semua") ──
  transactionHeader: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    justifyContent: 'space-between', // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    marginBottom: 16, // Jarak luar bawah
  },

  // ── Judul "Transaksi Terbaru" ──
  transactionTitle: {
    fontSize: 18, // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    color: '#1e293b', // Warna teks
  },

  // ── Teks link "Lihat Semua" ──
  seeAllText: {
    fontSize: 14, // Ukuran font
    color: '#3B82F6', // Biru sebagai tanda link
    fontWeight: '500', // Ketebalan font
  },

  // ── State kosong: belum ada transaksi ──
  emptyState: {
    backgroundColor: '#fff', // Warna latar belakang
    padding: 40, // Jarak dalam semua sisi
    borderRadius: 16, // Kelengkungan sudut elemen
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
  },

  // ── Emoji di state kosong transaksi ──
  emptyIcon: { fontSize: 48, marginBottom: 12 }, // Emoji besar di state kosong dengan jarak bawah

  // ── Teks "Belum ada transaksi" ──
  emptyText: { fontSize: 16, color: '#94a3b8' }, // Teks abu-abu di state daftar kosong

  // ── Item transaksi individual dalam daftar ──
  transactionItem: {
    flexDirection: 'row',     // Ikon + info + jumlah berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#fff', // Warna latar belakang
    padding: 16, // Jarak dalam semua sisi
    borderRadius: 16, // Kelengkungan sudut elemen
    marginBottom: 12,         // Jarak antar item
    shadowColor: '#000', // Warna bayangan elemen
    shadowOffset: { width: 0, height: 2 }, // Arah dan jarak bayangan
    shadowOpacity: 0.05,      // Bayangan sangat tipis
    shadowRadius: 4, // Blur radius bayangan
    elevation: 2, // Ketinggian bayangan (Android)
  },

  // ── Container ikon transaksi (lingkaran biru muda) ──
  transactionIconContainer: {
    width: 48, // Lebar elemen
    height: 48, // Tinggi elemen
    borderRadius: 12, // Kelengkungan sudut elemen
    backgroundColor: '#e0f2fe', // Biru muda
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    marginRight: 12,           // Jarak ke info transaksi
  },

  // ── Emoji tipe transaksi (misalnya 📤 atau 📥) ──
  transactionIcon: { fontSize: 24 }, // Emoji tipe transaksi (masuk/keluar)

  // ── Container info transaksi (nama + tipe + tanggal) ──
  transactionInfo: { flex: 1 }, // Ambil sisa lebar

  // ── Nama transaksi (misalnya "Merchant A") ──
  transactionName: {
    fontSize: 16, // Ukuran font
    fontWeight: '600', // Ketebalan font
    color: '#1e293b', // Warna teks
    marginBottom: 2, // Jarak luar bawah
  },

  // ── Tipe transaksi (misalnya "NFC Payment") ──
  transactionType: {
    fontSize: 13, // Ukuran font
    color: '#64748b', // Warna teks
    marginBottom: 2, // Jarak luar bawah
  },

  // ── Tanggal transaksi ──
  transactionDate: { fontSize: 12, color: '#94a3b8' }, // Tanggal kecil abu-abu di item transaksi

  // ── Jumlah transaksi (merah/hijau tergantung arah) ──
  transactionAmount: {
    fontSize: 16, // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    marginRight: 8, // Jarak luar kanan
    // Warna diisi dinamis dari kode (hijau=masuk, merah=keluar)
  },

  // ── Modifikasi warna hijau untuk transaksi masuk ──
  positiveAmount: { color: '#10B981' }, // Hijau emerald

  // ── Modifikasi warna merah untuk transaksi keluar ──
  negativeAmount: { color: '#EF4444' }, // Merah

  // ── Ikon panah ">" di kanan item transaksi ──
  transactionArrow: { fontSize: 18, color: '#cbd5e1' }, // Ikon panah > di kanan item transaksi

  // ── Bottom navigation bar ──
  bottomNav: {
    flexDirection: 'row',      // Semua tab berjajar horizontal
    backgroundColor: '#fff', // Warna latar belakang
    paddingVertical: 12, // Jarak dalam atas dan bawah
    paddingHorizontal: 8, // Jarak dalam kiri dan kanan
    borderTopWidth: 1,         // Garis atas sebagai separator
    borderTopColor: '#f1f5f9',
    shadowColor: '#000', // Warna bayangan elemen
    shadowOffset: { width: 0, height: -2 }, // Bayangan ke ATAS (bukan bawah)
    shadowOpacity: 0.1, // Transparansi bayangan
    shadowRadius: 8, // Blur radius bayangan
    elevation: 8, // Ketinggian bayangan (Android)
  },

  // ── Item tab navigasi biasa ──
  navItem: {
    flex: 1,              // Setiap tab ambil lebar yang sama
    alignItems: 'center', // Ikon dan label di tengah horizontal
    paddingVertical: 8,   // Area sentuh vertikal
  },

  // ── Item tab tengah (tombol aksi utama melayang) ──
  navItemCenter: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    paddingVertical: 0, // Jarak dalam atas dan bawah
    marginTop: -20, // Tombol melayang 20dp ke atas bottom nav
  },

  // ── Tombol melayang di tengah bottom nav (lingkaran biru) ──
  centerButton: {
    width: 60, // Lebar elemen
    height: 60, // Tinggi elemen
    borderRadius: 30,           // Bulat sempurna
    backgroundColor: '#3B82F6', // Biru brand
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    shadowColor: '#3B82F6',     // Glow biru
    shadowOffset: { width: 0, height: 4 }, // Arah dan jarak bayangan
    shadowOpacity: 0.3, // Transparansi bayangan
    shadowRadius: 8, // Blur radius bayangan
    elevation: 8, // Ketinggian bayangan (Android)
    marginBottom: 4, // Jarak luar bawah
  },

  // ── Ikon besar di tombol melayang ──
  centerButtonIcon: {
    fontSize: 32, // Ukuran font
    color: '#fff', // Warna teks
    fontWeight: 'bold', // Ketebalan font
  },

  // ── Ikon tab non-aktif (redup) ──
  navIcon: {
    fontSize: 24, // Ukuran font
    marginBottom: 4, // Jarak luar bawah
    opacity: 0.5, // Redup 50% tanda tidak aktif
  },

  // ── Ikon tab aktif (penuh) ──
  navIconActive: {
    fontSize: 24, // Ukuran font
    marginBottom: 4, // Jarak luar bawah
    // Tidak ada opacity — penuh/jelas tanda aktif
  },

  // ── Label tab non-aktif ──
  navLabel: {
    fontSize: 11, // Ukuran font
    color: '#94a3b8', // Abu-abu redup
  },

  // ── Label tab aktif ──
  navLabelActive: {
    fontSize: 11, // Ukuran font
    color: '#3B82F6',   // Biru brand tanda aktif
    fontWeight: '600',  // Sedikit tebal
  },

});

export default styles; // Ekspor agar bisa digunakan di DashboardScreen.tsx
