// src/screens/MyCardsScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk MyCardsScreen
// Menampilkan kartu NFC milik user, dengan aksi blokir dan aktifkan
// Kebijakan: 1 user hanya bisa memiliki 1 kartu (ditampilkan slice 0,1)
// ============================================================

import { StyleSheet } from 'react-native'; // Import API styling React Native

const styles = StyleSheet.create({

  // ── Layar utama ──
  container: {
    flex: 1,                    // Isi seluruh tinggi layar
    backgroundColor: '#f8fafc', // Latar abu-abu sangat muda
  },

  // ── Header navigasi (tombol kembali + judul + spacer) ──
  header: {
    flexDirection: 'row',           // Elemen berjajar horizontal
    alignItems: 'center',           // Rata tengah vertikal
    justifyContent: 'space-between', // Kiri, tengah, kanan dipisah rata
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  // ── Tombol kembali (lingkaran abu) ──
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,           // Bulat sempurna
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Ikon panah kembali ──
  backIcon: { fontSize: 24, color: '#1e293b' },

  // ── Judul "Kartu Saya" ──
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },

  // ── Spacer kanan agar judul presisi di tengah ──
  headerSpacer: { width: 40 },

  // ── Container loading spinner ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center', // Spinner di tengah vertikal
    alignItems: 'center',
  },

  // ── Teks "Memuat..." di bawah spinner ──
  loadingText: {
    marginTop: 16,     // Jarak dari spinner di atas
    fontSize: 16,
    color: '#64748b',  // Abu-abu sedang
  },

  // ── ScrollView area konten ──
  scrollView: { flex: 1 },

  // ── Padding dalam ScrollView ──
  content: { padding: 24 },

  // ── Subtitle halaman (misalnya "Kartu NFC terdaftar") ──
  pageSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
    lineHeight: 20, // Spasi baris agar nyaman dibaca
  },

  // ── State kosong: belum punya kartu ──
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 48,         // Padding besar agar terasa lapang
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },

  // ── Emoji besar di state kosong (misalnya kartu dengan tanda ?) ──
  emptyIcon: { fontSize: 64, marginBottom: 16 },

  // ── Judul state kosong ("Belum ada kartu") ──
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },

  // ── Deskripsi state kosong ──
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },

  // ── Tombol "Tambah Kartu" di state kosong ──
  addButton: {
    flexDirection: 'row',   // Ikon + teks berjajar horizontal
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,                 // Jarak antara ikon dan teks
  },

  // ── Emoji ikon di tombol tambah kartu ──
  addButtonIcon: { fontSize: 18 },

  // ── Teks "Daftarkan Kartu" di tombol ──
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── Card representasi satu kartu NFC ──
  cardItem: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden', // Agar konten tidak keluar dari border radius
  },

  // ── Baris atas card (badge "Kartu Utama" + badge status) ──
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16, // Padding bawah lebih kecil agar dekat konten
  },

  // ── Badge biru "Kartu Utama" ──
  cardBadge: {
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  // ── Teks dalam badge "Kartu Utama" ──
  cardBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // ── Badge status AKTIF / DIBLOKIR ──
  statusBadge: {
    flexDirection: 'row',   // Titik warna + teks
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,       // Berbentuk pil
    gap: 6,
    // Warna latar diisi dinamis dari kode
  },

  // ── Titik warna status (hijau = aktif, merah = blokir) ──
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4, // Bulat sempurna
    // Warna diisi dinamis
  },

  // ── Teks status (AKTIF / DIBLOKIR) ──
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    // Warna diisi dinamis
  },

  // ── Area konten detail kartu ──
  cardContent: {
    padding: 20,
    paddingTop: 0, // Tidak perlu padding atas karena cardHeader sudah ada
  },

  // ── Container visualisasi kartu fisik ──
  cardVisual: { marginBottom: 20 },

  // ── "Kartu kredit" virtual — representasi kartu fisik NFC ──
  cardVisualGradient: {
    height: 180,                 // Tinggi kartu mirip kartu kredit asli
    backgroundColor: '#1e40af', // Biru tua (navy) untuk kesan premium
    borderRadius: 16,
    padding: 20,
    position: 'relative',        // Agar elemen dalam bisa absolute
    overflow: 'hidden',          // Clip konten ke dalam border radius
  },

  // ── Chip kartu (representasi chip emas fisik) ──
  cardChip: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Putih semi-transparan
    borderRadius: 8,
  },

  // ── Ikon chip ──
  cardChipIcon: { fontSize: 32 },

  // ── Ikon NFC di pojok kanan atas kartu virtual ──
  cardNfcIcon: {
    position: 'absolute', // Bebas dari flow normal
    right: 20,
    top: 20,
  },

  // ── Simbol NFC "))" ──
  cardNfcText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },

  // ── Container baris detail kartu (UID, saldo, tipe) ──
  cardDetails: { gap: 12 }, // Jarak antar baris detail

  // ── Satu baris detail (label di kiri, nilai di kanan) ──
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Label kiri, nilai kanan
    alignItems: 'center',
    paddingVertical: 8,              // Padding atas-bawah tiap baris
  },

  // ── Teks label kiri (misalnya "UID:", "Tipe:", "Dibuat:") ──
  cardLabel: {
    fontSize: 13,
    color: '#64748b',   // Abu-abu sedang agar tidak terlalu dominan
    fontWeight: '500',
  },

  // ── Teks nilai kanan ──
  cardValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },

  // ── Kotak UID (abu dengan border, font monospace) ──
  cardUidBox: {
    flexDirection: 'row', // UID + tombol copy berjajar
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },

  // ── Teks UID (format monospace agar karakter sejajar) ──
  cardUidText: {
    fontSize: 12,
    fontFamily: 'monospace', // Font monospace untuk karakter teknis
    color: '#1e293b',
    fontWeight: '500',
  },

  // ── Tombol kecil copy UID ──
  copyIconButton: { padding: 4 }, // Padding kecil agar mudah disentuh

  // ── Ikon copy ──
  copyIconText: { fontSize: 14 },

  // ── Teks saldo kartu (hijau) ──
  cardBalance: {
    fontSize: 18,
    color: '#10B981', // Hijau = saldo positif
    fontWeight: 'bold',
  },

  // ── Container tombol aksi kartu (Blokir / Aktifkan) ──
  cardActions: {
    marginTop: 20, // Jarak dari detail kartu di atas
    gap: 12,       // Jarak antar tombol
  },

  // ── Tombol "Blokir Kartu" (merah muda) ──
  blockButton: {
    flexDirection: 'row',     // Ikon + teks berjajar
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2', // Merah sangat muda agar tidak menakutkan
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },

  // ── Ikon di tombol blokir ──
  blockButtonIcon: { fontSize: 16 },

  // ── Teks "Blokir Kartu" ──
  blockButtonText: {
    color: '#EF4444',   // Merah agar terasa peringatan
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Tombol "Aktifkan Kartu" (hijau muda) ──
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4', // Hijau sangat muda
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },

  // ── Ikon di tombol aktifkan ──
  activateButtonIcon: { fontSize: 16 },

  // ── Teks "Aktifkan Kartu" ──
  activateButtonText: {
    color: '#10B981',   // Hijau emerald
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Banner kebijakan 1 kartu per user (latar kuning) ──
  policyInfo: {
    flexDirection: 'row',
    backgroundColor: '#FEF9C3', // Kuning sangat muda
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 20,
  },

  // ── Ikon di banner kebijakan ──
  policyIcon: { fontSize: 20 },

  // ── Container teks dalam banner kebijakan ──
  policyTextContainer: { flex: 1 },

  // ── Judul kebijakan ("1 Akun = 1 Kartu") ──
  policyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#854d0e',   // Cokelat tua agar kontras di latar kuning
    marginBottom: 4,
  },

  // ── Penjelasan kebijakan ──
  policyText: {
    fontSize: 13,
    color: '#a16207',   // Cokelat lebih terang
    lineHeight: 18,
  },

  // ── Banner keamanan NFC (latar hijau muda) ──
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',   // Rata atas untuk teks panjang
    backgroundColor: '#F0FDF4', // Hijau sangat muda
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },

  // ── Ikon gembok keamanan ──
  securityIcon: { fontSize: 20 },

  // ── Teks info keamanan ──
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#15803d',   // Hijau gelap kontras di latar hijau muda
    lineHeight: 18,
  },

});

export default styles; // Ekspor agar bisa digunakan di MyCardsScreen.tsx
