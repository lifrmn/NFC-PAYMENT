// src/screens/MyCardsScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk MyCardsScreen
// Menampilkan kartu NFC milik user, dengan aksi blokir dan aktifkan
// Kebijakan: 1 user hanya bisa memiliki 1 kartu (ditampilkan slice 0,1)
// ============================================================

import { StyleSheet } from 'react-native'; // Import API styling React Native
// Import API styling React Native

const styles = StyleSheet.create({ // StyleSheet.create = membuat kumpulan style tampilan React Native yang dioptimalkan

  // ── Layar utama ──
  container: {
    flex: 1, // Isi seluruh tinggi layar
    // Isi seluruh tinggi layar
    backgroundColor: '#f8fafc', // Latar abu-abu sangat muda
    // Latar abu-abu sangat muda
  },

  // ── Header navigasi (tombol kembali + judul + spacer) ──
  header: {
    flexDirection: 'row', // Elemen berjajar horizontal
    // Elemen berjajar horizontal
    alignItems: 'center', // Rata tengah vertikal
    // Rata tengah vertikal
    justifyContent: 'space-between', // Kiri, tengah, kanan dipisah rata
    // Kiri, tengah, kanan dipisah rata
    paddingHorizontal: 20, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    paddingVertical: 16, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderBottomWidth: 1, // Ketebalan border bawah
    // Ketebalan border bawah
    borderBottomColor: '#f1f5f9', // warna garis bawah header abu sangat muda
    // warna garis bawah header abu sangat muda
  },

  // ── Tombol kembali (lingkaran abu) ──
  backButton: {
    width: 40, // Lebar elemen
    // Lebar elemen
    height: 40, // Tinggi elemen
    // Tinggi elemen
    borderRadius: 20, // Bulat sempurna
    // Bulat sempurna
    backgroundColor: '#f8fafc', // Warna latar belakang
    // Warna latar belakang
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
  },

  // ── Ikon panah kembali ──
  backIcon: { fontSize: 24, color: '#1e293b' }, // Emoji ikon kembali (tanda <)
  // Emoji ikon kembali (tanda <)

  // ── Judul "Kartu Saya" ──
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' }, // Judul header semi-bold warna gelap
  // Judul header semi-bold warna gelap

  // ── Spacer kanan agar judul presisi di tengah ──
  headerSpacer: { width: 40 }, // Spacer kanan header agar judul rata tengah
  // Spacer kanan header agar judul rata tengah

  // ── Container loading spinner ──
  loadingContainer: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    // Proporsi flexbox relatif terhadap sibling
    justifyContent: 'center', // Spinner di tengah vertikal
    // Spinner di tengah vertikal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
  },

  // ── Teks "Memuat..." di bawah spinner ──
  loadingText: {
    marginTop: 16, // Jarak dari spinner di atas
    // Jarak dari spinner di atas
    fontSize: 16, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu sedang
    // Abu-abu sedang
  },

  // ── ScrollView area konten ──
  scrollView: { flex: 1 }, // Area ScrollView mengisi sisa layar
  // Area ScrollView mengisi sisa layar

  // ── Padding dalam ScrollView ──
  content: { padding: 24 }, // Area konten dengan padding 24dp semua sisi
  // Area konten dengan padding 24dp semua sisi

  // ── Subtitle halaman (misalnya "Kartu NFC terdaftar") ──
  pageSubtitle: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
    lineHeight: 20, // Spasi baris agar nyaman dibaca
    // Spasi baris agar nyaman dibaca
  },

  // ── State kosong: belum punya kartu ──
  emptyState: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 24, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    padding: 48, // Padding besar agar terasa lapang
    // Padding besar agar terasa lapang
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
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

  // ── Emoji besar di state kosong (misalnya kartu dengan tanda ?) ──
  emptyIcon: { fontSize: 64, marginBottom: 16 }, // Emoji besar di state daftar kartu kosong
  // Emoji besar di state daftar kartu kosong

  // ── Judul state kosong ("Belum ada kartu") ──
  emptyTitle: {
    fontSize: 20, // Ukuran font
    // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
    color: '#1e293b', // Warna teks
    // Warna teks
    marginBottom: 8, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Deskripsi state kosong ──
  emptyText: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#64748b', // Warna teks
    // Warna teks
    textAlign: 'center', // Perataan teks
    // Perataan teks
    marginBottom: 24, // Jarak luar bawah
    // Jarak luar bawah
    paddingHorizontal: 20, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
  },

  // ── Tombol "Tambah Kartu" di state kosong ──
  addButton: {
    flexDirection: 'row', // Ikon + teks berjajar horizontal
    // Ikon + teks berjajar horizontal
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#3B82F6', // Warna latar belakang
    // Warna latar belakang
    paddingVertical: 14, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 24, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 8, // Jarak antara ikon dan teks
    // Jarak antara ikon dan teks
  },

  // ── Emoji ikon di tombol tambah kartu ──
  addButtonIcon: { fontSize: 18 }, // Emoji ikon + di tombol tambah kartu
  // Emoji ikon + di tombol tambah kartu

  // ── Teks "Daftarkan Kartu" di tombol ──
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' }, // Teks putih semi-bold di tombol tambah
  // Teks putih semi-bold di tombol tambah

  // ── Card representasi satu kartu NFC ──
  cardItem: {
    backgroundColor: '#fff', // Warna latar belakang
    // Warna latar belakang
    borderRadius: 24, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
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
    overflow: 'hidden', // Agar konten tidak keluar dari border radius
    // Agar konten tidak keluar dari border radius
  },

  // ── Baris atas card (badge "Kartu Utama" + badge status) ──
  cardHeader: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    justifyContent: 'space-between', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    padding: 20, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    paddingBottom: 16, // Padding bawah lebih kecil agar dekat konten
    // Padding bawah lebih kecil agar dekat konten
  },

  // ── Badge biru "Kartu Utama" ──
  cardBadge: {
    backgroundColor: '#3B82F6', // Warna latar belakang
    // Warna latar belakang
    paddingVertical: 6, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 12, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 8, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
  },

  // ── Teks dalam badge "Kartu Utama" ──
  cardBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' }, // Teks putih kecil di badge kartu
  // Teks putih kecil di badge kartu

  // ── Badge status AKTIF / DIBLOKIR ──
  statusBadge: {
    flexDirection: 'row', // Titik warna + teks
    // Titik warna + teks
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    paddingVertical: 6, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 12, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 12, // Berbentuk pil
    // Berbentuk pil
    gap: 6, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
    // Warna latar diisi dinamis dari kode
  },

  // ── Titik warna status (hijau = aktif, merah = blokir) ──
  statusDot: {
    width: 8, // Lebar elemen
    // Lebar elemen
    height: 8, // Tinggi elemen
    // Tinggi elemen
    borderRadius: 4, // Bulat sempurna
    // Bulat sempurna
    // Warna diisi dinamis
  },

  // ── Teks status (AKTIF / DIBLOKIR) ──
  statusText: {
    fontSize: 12, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
    // Warna diisi dinamis
  },

  // ── Area konten detail kartu ──
  cardContent: {
    padding: 20, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    paddingTop: 0, // Tidak perlu padding atas karena cardHeader sudah ada
    // Tidak perlu padding atas karena cardHeader sudah ada
  },

  // ── Container visualisasi kartu fisik ──
  cardVisual: { marginBottom: 20 }, // Visual kartu dengan jarak bawah
  // Visual kartu dengan jarak bawah

  // ── "Kartu kredit" virtual — representasi kartu fisik NFC ──
  cardVisualGradient: {
    height: 180, // Tinggi kartu mirip kartu kredit asli
    // Tinggi kartu mirip kartu kredit asli
    backgroundColor: '#1e40af', // Biru tua (navy) untuk kesan premium
    // Biru tua (navy) untuk kesan premium
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    padding: 20, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    position: 'relative', // Agar elemen dalam bisa absolute
    // Agar elemen dalam bisa absolute
    overflow: 'hidden', // Clip konten ke dalam border radius
    // Clip konten ke dalam border radius
  },

  // ── Chip kartu (representasi chip emas fisik) ──
  cardChip: {
    width: 48, // Lebar elemen
    // Lebar elemen
    height: 48, // Tinggi elemen
    // Tinggi elemen
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Putih semi-transparan
    // Putih semi-transparan
    borderRadius: 8, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
  },

  // ── Ikon chip ──
  cardChipIcon: { fontSize: 32 }, // Emoji chip kartu berukuran besar
  // Emoji chip kartu berukuran besar

  // ── Ikon NFC di pojok kanan atas kartu virtual ──
  cardNfcIcon: {
    position: 'absolute', // Bebas dari flow normal
    // Bebas dari flow normal
    right: 20, // Posisi dari tepi kanan
    // Posisi dari tepi kanan
    top: 20, // Posisi dari tepi atas
    // Posisi dari tepi atas
  },

  // ── Simbol NFC "))" ──
  cardNfcText: {
    fontSize: 32, // Ukuran font
    // Ukuran font
    color: '#fff', // Warna teks
    // Warna teks
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
  },

  // ── Container baris detail kartu (UID, saldo, tipe) ──
  cardDetails: { gap: 12 }, // Jarak antar baris detail
  // Jarak antar baris detail

  // ── Satu baris detail (label di kiri, nilai di kanan) ──
  cardRow: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    justifyContent: 'space-between', // Label kiri, nilai kanan
    // Label kiri, nilai kanan
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    paddingVertical: 8, // Padding atas-bawah tiap baris
    // Padding atas-bawah tiap baris
  },

  // ── Teks label kiri (misalnya "UID:", "Tipe:", "Dibuat:") ──
  cardLabel: {
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#64748b', // Abu-abu sedang agar tidak terlalu dominan
    // Abu-abu sedang agar tidak terlalu dominan
    fontWeight: '500', // Ketebalan font
    // Ketebalan font
  },

  // ── Teks nilai kanan ──
  cardValue: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    color: '#1e293b', // Warna teks
    // Warna teks
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
  },

  // ── Kotak UID (abu dengan border, font monospace) ──
  cardUidBox: {
    flexDirection: 'row', // UID + tombol copy berjajar
    // UID + tombol copy berjajar
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    backgroundColor: '#f8fafc', // Warna latar belakang
    // Warna latar belakang
    paddingVertical: 6, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    paddingHorizontal: 12, // Jarak dalam kiri dan kanan
    // Jarak dalam kiri dan kanan
    borderRadius: 8, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 8, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
  },

  // ── Teks UID (format monospace agar karakter sejajar) ──
  cardUidText: {
    fontSize: 12, // Ukuran font
    // Ukuran font
    fontFamily: 'monospace', // Font monospace untuk karakter teknis
    // Font monospace untuk karakter teknis
    color: '#1e293b', // Warna teks
    // Warna teks
    fontWeight: '500', // Ketebalan font
    // Ketebalan font
  },

  // ── Tombol kecil copy UID ──
  copyIconButton: { padding: 4 }, // Padding kecil agar mudah disentuh
  // Padding kecil agar mudah disentuh

  // ── Ikon copy ──
  copyIconText: { fontSize: 14 }, // Emoji ikon copy UID kartu
  // Emoji ikon copy UID kartu

  // ── Teks saldo kartu (hijau) ──
  cardBalance: {
    fontSize: 18, // Ukuran font
    // Ukuran font
    color: '#10B981', // Hijau = saldo positif
    // Hijau = saldo positif
    fontWeight: 'bold', // Ketebalan font
    // Ketebalan font
  },

  // ── Container tombol aksi kartu (Blokir / Aktifkan) ──
  cardActions: {
    marginTop: 20, // Jarak dari detail kartu di atas
    // Jarak dari detail kartu di atas
    gap: 12, // Jarak antar tombol
    // Jarak antar tombol
  },

  // ── Tombol "Blokir Kartu" (merah muda) ──
  blockButton: {
    flexDirection: 'row', // Ikon + teks berjajar
    // Ikon + teks berjajar
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    backgroundColor: '#FEF2F2', // Merah sangat muda agar tidak menakutkan
    // Merah sangat muda agar tidak menakutkan
    paddingVertical: 14, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 8, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
  },

  // ── Ikon di tombol blokir ──
  blockButtonIcon: { fontSize: 16 }, // Emoji ikon di tombol blokir kartu
  // Emoji ikon di tombol blokir kartu

  // ── Teks "Blokir Kartu" ──
  blockButtonText: {
    color: '#EF4444', // Merah agar terasa peringatan
    // Merah agar terasa peringatan
    fontSize: 15, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
  },

  // ── Tombol "Aktifkan Kartu" (hijau muda) ──
  activateButton: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    alignItems: 'center', // Perataan item di sumbu silang (cross axis)
    // Perataan item di sumbu silang (cross axis)
    justifyContent: 'center', // Perataan konten di sumbu utama (main axis)
    // Perataan konten di sumbu utama (main axis)
    backgroundColor: '#F0FDF4', // Hijau sangat muda
    // Hijau sangat muda
    paddingVertical: 14, // Jarak dalam atas dan bawah
    // Jarak dalam atas dan bawah
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 8, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
  },

  // ── Ikon di tombol aktifkan ──
  activateButtonIcon: { fontSize: 16 }, // Emoji ikon di tombol aktifkan kartu
  // Emoji ikon di tombol aktifkan kartu

  // ── Teks "Aktifkan Kartu" ──
  activateButtonText: {
    color: '#10B981', // Hijau emerald
    // Hijau emerald
    fontSize: 15, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
  },

  // ── Tombol "Hapus Kartu" (abu / destructive) ──
  deleteButton: {
    flexDirection: 'row', // ikon dan teks berjajar horizontal
    // ikon dan teks berjajar horizontal
    alignItems: 'center', // rata tengah vertikal
    // rata tengah vertikal
    justifyContent: 'center', // rata tengah horizontal
    // rata tengah horizontal
    backgroundColor: '#F8FAFC', // latar abu sangat muda untuk aksi destruktif ringan
    // latar abu sangat muda untuk aksi destruktif ringan
    paddingVertical: 12, // padding atas-bawah tombol hapus
    // padding atas-bawah tombol hapus
    borderRadius: 12, // sudut membulat
    // sudut membulat
    gap: 8, // jarak antara ikon dan teks
    // jarak antara ikon dan teks
    marginTop: 8, // jarak dari tombol di atasnya
    // jarak dari tombol di atasnya
    borderWidth: 1, // border tipis agar berbeda dari tombol solid
    // border tipis agar berbeda dari tombol solid
    borderColor: '#CBD5E1', // border abu-abu muda
    // border abu-abu muda
  },

  deleteButtonIcon: { fontSize: 16 }, // emoji ikon hapus di tombol hapus kartu
  // emoji ikon hapus di tombol hapus kartu

  deleteButtonText: { // teks di tombol hapus kartu
    // teks di tombol hapus kartu
    color: '#64748B', // abu-abu sedang untuk aksi destruktif yang tidak terlalu mencolok
    // abu-abu sedang untuk aksi destruktif yang tidak terlalu mencolok
    fontSize: 14, // ukuran teks tombol hapus
    // ukuran teks tombol hapus
    fontWeight: '600', // semi-bold agar terbaca jelas
    // semi-bold agar terbaca jelas
  },

  // ── Banner kebijakan 1 kartu per user (latar kuning) ──
  policyInfo: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    backgroundColor: '#FEF9C3', // Kuning sangat muda
    // Kuning sangat muda
    padding: 16, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 16, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 12, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
    marginBottom: 20, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Ikon di banner kebijakan ──
  policyIcon: { fontSize: 20 }, // Emoji ikon di informasi kebijakan
  // Emoji ikon di informasi kebijakan

  // ── Container teks dalam banner kebijakan ──
  policyTextContainer: { flex: 1 }, // Teks kebijakan mengisi sisa lebar
  // Teks kebijakan mengisi sisa lebar

  // ── Judul kebijakan ("1 Akun = 1 Kartu") ──
  policyTitle: {
    fontSize: 14, // Ukuran font
    // Ukuran font
    fontWeight: '600', // Ketebalan font
    // Ketebalan font
    color: '#854d0e', // Cokelat tua agar kontras di latar kuning
    // Cokelat tua agar kontras di latar kuning
    marginBottom: 4, // Jarak luar bawah
    // Jarak luar bawah
  },

  // ── Penjelasan kebijakan ──
  policyText: {
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#a16207', // Cokelat lebih terang
    // Cokelat lebih terang
    lineHeight: 18, // Tinggi baris teks
    // Tinggi baris teks
  },

  // ── Banner keamanan NFC (latar hijau muda) ──
  securityInfo: {
    flexDirection: 'row', // Arah susunan elemen anak (row/column)
    // Arah susunan elemen anak (row/column)
    alignItems: 'flex-start', // Rata atas untuk teks panjang
    // Rata atas untuk teks panjang
    backgroundColor: '#F0FDF4', // Hijau sangat muda
    // Hijau sangat muda
    padding: 16, // Jarak dalam semua sisi
    // Jarak dalam semua sisi
    borderRadius: 12, // Kelengkungan sudut elemen
    // Kelengkungan sudut elemen
    gap: 12, // Jarak antar elemen dalam flex/grid
    // Jarak antar elemen dalam flex/grid
  },

  // ── Ikon gembok keamanan ──
  securityIcon: { fontSize: 20 }, // Emoji ikon keamanan (sedang)
  // Emoji ikon keamanan (sedang)

  // ── Teks info keamanan ──
  securityText: {
    flex: 1, // Proporsi flexbox relatif terhadap sibling
    // Proporsi flexbox relatif terhadap sibling
    fontSize: 13, // Ukuran font
    // Ukuran font
    color: '#15803d', // Hijau gelap kontras di latar hijau muda
    // Hijau gelap kontras di latar hijau muda
    lineHeight: 18, // Tinggi baris teks
    // Tinggi baris teks
  },

});

export default styles; // Ekspor agar bisa digunakan di MyCardsScreen.tsx
// Ekspor agar bisa digunakan di MyCardsScreen.tsx
