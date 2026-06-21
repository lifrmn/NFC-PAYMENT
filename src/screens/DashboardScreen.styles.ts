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
    fontSize: 16,
    color: '#64748b', // Abu-abu sedang
  },

  // ── ScrollView area konten ──
  scrollView: { flex: 1 },

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
    fontWeight: 'bold',
    color: '#1e293b',    // Navy gelap
  },

  // ── Teks kecil di bawah salam (misalnya "Selamat datang kembali") ──
  greetingSubtext: {
    fontSize: 14,
    color: '#64748b',  // Abu-abu sedang
    marginTop: 2,      // Jarak kecil dari salam di atas
  },

  // ── Tombol notifikasi (lingkaran abu) ──
  notificationButton: {
    position: 'relative',  // Agar titik merah bisa absolute di atasnya
    width: 44,
    height: 44,
    borderRadius: 22,        // Bulat sempurna
    backgroundColor: '#f1f5f9', // Latar abu muda
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Titik merah (unread notification indicator) ──
  notificationDot: {
    position: 'absolute', // Mengapung di atas tombol
    top: 10,              // Jarak dari atas tombol
    right: 10,            // Jarak dari kanan tombol
    width: 8,
    height: 8,
    borderRadius: 4,      // Bulat sempurna
    backgroundColor: '#EF4444', // Merah — ada notifikasi baru
  },

  // ── Emoji ikon lonceng ──
  notificationIcon: { fontSize: 20 },

  // ── Card saldo utama (biru, dengan bayangan besar) ──
  balanceCard: {
    marginHorizontal: 24,            // Margin kiri-kanan dari tepi layar
    marginTop: 20,
    marginBottom: 24,
    padding: 24,
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
    flexDirection: 'row',
    justifyContent: 'space-between', // Label di kiri, ikon di kanan
    alignItems: 'center',
    marginBottom: 8,
  },

  // ── Teks label "Saldo Anda" ──
  saldoLabel: {
    fontSize: 14,
    color: '#fff',   // Putih di atas latar biru
    opacity: 0.9,    // Sedikit transparan agar label tidak dominan
  },

  // ── Container ikon dompet + badge perisai ──
  walletIcon: {
    position: 'relative',  // Agar badge bisa absolute
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── Emoji dompet utama ──
  walletIconText: {
    fontSize: 32,
    color: '#fff',
  },

  // ── Badge hijau bulat di pojok ikon dompet ──
  walletShield: {
    position: 'absolute',
    right: -5,    // Keluar sedikit ke kanan
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10, // Bulat sempurna
    backgroundColor: '#10B981', // Hijau emerald
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Ikon perisai dalam badge ──
  walletShieldIcon: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },

  // ── Angka saldo (format rupiah, misalnya Rp 150.000) ──
  balanceAmount: {
    fontSize: 36,        // Sangat besar agar saldo menonjol
    fontWeight: 'bold',
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
    alignItems: 'center',
    backgroundColor: '#fff', // Latar putih kontras di atas biru
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },

  // ── Emoji ikon di tombol Top Up ──
  topUpIcon: { fontSize: 16, marginRight: 4 },

  // ── Teks "Top Up" ──
  topUpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6', // Biru agar selaras dengan card
  },

  // ── Tombol "Riwayat" (transparan, teks putih) ──
  historyButton: {
    flex: 1,              // Ambil sisa lebar
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },

  // ── Teks "Riwayat" ──
  historyText: {
    fontSize: 14,
    color: '#fff',      // Putih di atas biru
    fontWeight: '500',
  },

  // ── Section menu cepat (grid ikon) ──
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },

  // ── Judul section menu ──
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },

  // ── Grid 3 kolom menu ──
  menuGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Ikon tersebar merata
    gap: 16,
    paddingHorizontal: 4,
  },

  // ── Item menu individual ──
  menuItem: {
    flex: 1,              // Setiap item ambil lebar yang sama
    alignItems: 'center', // Ikon dan label di tengah
    maxWidth: 100,        // Batas lebar agar tidak terlalu lebar
  },

  // ── Kotak ikon menu (biru persegi bulat) ──
  menuIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,           // Sudut membulat modern
    backgroundColor: '#3B82F6', // Biru brand
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,           // Jarak ke label di bawah ikon
    shadowColor: '#3B82F6',     // Glow biru
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  // ── Emoji ikon di dalam kotak menu ──
  menuIcon: { fontSize: 32, color: '#fff' },

  // ── Label teks menu ──
  menuLabel: {
    fontSize: 13,
    color: '#475569',    // Abu-abu sedang agar tidak terlalu mencolok
    textAlign: 'center',
    fontWeight: '600',   // Semi-bold untuk label
    lineHeight: 16,      // Spasi baris kecil agar dua baris muat
  },

  // ── Section riwayat transaksi ──
  transactionSection: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Padding bawah besar agar tidak tertimpa bottom nav
  },

  // ── Baris header section transaksi (judul + link "Lihat Semua") ──
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // ── Judul "Transaksi Terbaru" ──
  transactionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },

  // ── Teks link "Lihat Semua" ──
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6', // Biru sebagai tanda link
    fontWeight: '500',
  },

  // ── State kosong: belum ada transaksi ──
  emptyState: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },

  // ── Emoji di state kosong transaksi ──
  emptyIcon: { fontSize: 48, marginBottom: 12 },

  // ── Teks "Belum ada transaksi" ──
  emptyText: { fontSize: 16, color: '#94a3b8' },

  // ── Item transaksi individual dalam daftar ──
  transactionItem: {
    flexDirection: 'row',     // Ikon + info + jumlah berjajar horizontal
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,         // Jarak antar item
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,      // Bayangan sangat tipis
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Container ikon transaksi (lingkaran biru muda) ──
  transactionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e0f2fe', // Biru muda
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,           // Jarak ke info transaksi
  },

  // ── Emoji tipe transaksi (misalnya 📤 atau 📥) ──
  transactionIcon: { fontSize: 24 },

  // ── Container info transaksi (nama + tipe + tanggal) ──
  transactionInfo: { flex: 1 }, // Ambil sisa lebar

  // ── Nama transaksi (misalnya "Merchant A") ──
  transactionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },

  // ── Tipe transaksi (misalnya "NFC Payment") ──
  transactionType: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },

  // ── Tanggal transaksi ──
  transactionDate: { fontSize: 12, color: '#94a3b8' },

  // ── Jumlah transaksi (merah/hijau tergantung arah) ──
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    // Warna diisi dinamis dari kode (hijau=masuk, merah=keluar)
  },

  // ── Modifikasi warna hijau untuk transaksi masuk ──
  positiveAmount: { color: '#10B981' }, // Hijau emerald

  // ── Modifikasi warna merah untuk transaksi keluar ──
  negativeAmount: { color: '#EF4444' }, // Merah

  // ── Ikon panah ">" di kanan item transaksi ──
  transactionArrow: { fontSize: 18, color: '#cbd5e1' },

  // ── Bottom navigation bar ──
  bottomNav: {
    flexDirection: 'row',      // Semua tab berjajar horizontal
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,         // Garis atas sebagai separator
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, // Bayangan ke ATAS (bukan bawah)
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Item tab navigasi biasa ──
  navItem: {
    flex: 1,              // Setiap tab ambil lebar yang sama
    alignItems: 'center', // Ikon dan label di tengah horizontal
    paddingVertical: 8,   // Area sentuh vertikal
  },

  // ── Item tab tengah (tombol aksi utama melayang) ──
  navItemCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 0,
    marginTop: -20, // Tombol melayang 20dp ke atas bottom nav
  },

  // ── Tombol melayang di tengah bottom nav (lingkaran biru) ──
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,           // Bulat sempurna
    backgroundColor: '#3B82F6', // Biru brand
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',     // Glow biru
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 4,
  },

  // ── Ikon besar di tombol melayang ──
  centerButtonIcon: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },

  // ── Ikon tab non-aktif (redup) ──
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.5, // Redup 50% tanda tidak aktif
  },

  // ── Ikon tab aktif (penuh) ──
  navIconActive: {
    fontSize: 24,
    marginBottom: 4,
    // Tidak ada opacity — penuh/jelas tanda aktif
  },

  // ── Label tab non-aktif ──
  navLabel: {
    fontSize: 11,
    color: '#94a3b8', // Abu-abu redup
  },

  // ── Label tab aktif ──
  navLabelActive: {
    fontSize: 11,
    color: '#3B82F6',   // Biru brand tanda aktif
    fontWeight: '600',  // Sedikit tebal
  },

});

export default styles; // Ekspor agar bisa digunakan di DashboardScreen.tsx
