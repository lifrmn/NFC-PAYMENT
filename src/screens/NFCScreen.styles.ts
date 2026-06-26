// src/screens/NFCScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk NFCScreen (Merchant/Penerima)
// Screen ini digunakan oleh merchant untuk menerima pembayaran dari customer
// ============================================================

import { StyleSheet } from 'react-native'; // Import API styling React Native

const styles = StyleSheet.create({

  // ── Layar utama ──
  container: {
    flex: 1,                      // Mengisi seluruh tinggi layar
    backgroundColor: '#f5f5f5',   // Latar abu-abu terang
  },

  // ── Area tengah (digunakan saat error / state kosong) ──
  centerContent: {
    flex: 1,                     // Ambil seluruh ruang tersedia
    justifyContent: 'center',    // Konten di tengah vertikal
    alignItems: 'center',        // Konten di tengah horizontal
    padding: 20,                 // Padding 20dp dari semua sisi
  },

  // ── Header navigasi (tombol kembali + judul + placeholder) ──
  header: {
    flexDirection: 'row',          // Elemen berjajar horizontal
    justifyContent: 'space-between', // Kiri-tengah-kanan dipisah rata
    alignItems: 'center',          // Rata tengah vertikal
    padding: 20,                   // Padding dalam header
    backgroundColor: 'white',      // Latar putih
    borderBottomWidth: 1,          // Garis bawah tipis
    borderBottomColor: '#e0e0e0',  // Warna garis abu-abu
  },

  // ── Teks tombol kembali (misalnya "← Kembali") ──
  backText: {
    color: '#3498db',  // Warna biru sebagai tanda link/tombol
    fontSize: 16,      // Ukuran mudah dibaca
    width: 70,         // Lebar tetap agar judul di tengah presisi
  },

  // ── Spacer kanan header untuk menyeimbangkan judul di tengah ──
  headerSpacerLarge: {
    width: 70, // Sama dengan lebar backText agar judul benar-benar di tengah
  },

  // ── Teks judul header ──
  title: {
    fontSize: 20,        // Ukuran heading medium
    fontWeight: 'bold',  // Tebal
    color: '#2c3e50',    // Navy gelap
  },

  // ── ScrollView area konten ──
  content: {
    flex: 1, // Mengisi sisa ruang di bawah header
  },

  // ── Container dalam ScrollView ──
  contentContainer: {
    padding: 20, // Padding 20dp dari semua sisi
  },

  // ── Ikon saat error (misalnya ❌ besar) ──
  errorIcon: {
    fontSize: 80,       // Sangat besar agar dominan di layar
    marginBottom: 20,   // Jarak ke teks error
  },

  // ── Judul teks error ──
  errorTitle: {
    fontSize: 24,            // Heading besar
    fontWeight: 'bold', // Ketebalan font
    color: '#1e293b',        // Navy gelap
    marginBottom: 12,        // Jarak ke teks detail
    textAlign: 'center',     // Rata tengah
  },

  // ── Teks deskripsi error ──
  errorText: {
    fontSize: 16,          // Ukuran normal
    color: '#64748b',      // Abu-abu medium
    textAlign: 'center', // Perataan teks
    marginBottom: 24,      // Jarak ke tombol aksi
    lineHeight: 24,        // Spasi baris agar nyaman dibaca
  },

  // ── Teks info tambahan ──
  infoText: {
    fontSize: 14,          // Kecil sebagai teks penjelasan
    color: '#7f8c8d',      // Abu-abu redup
    textAlign: 'center', // Perataan teks
    marginBottom: 20, // Jarak luar bawah
  },

  // ── Kotak instruksi dengan garis biru di kiri ──
  instructionBox: {
    backgroundColor: 'white',    // Latar putih
    padding: 20,                  // Padding dalam kotak
    borderRadius: 12,             // Sudut membulat
    marginVertical: 20,           // Margin atas & bawah
    borderLeftWidth: 4,           // Garis tebal di kiri (aksen warna)
    borderLeftColor: '#3498db',   // Warna aksen biru
  },

  // ── Teks dalam kotak instruksi ──
  instructionText: {
    fontSize: 14,      // Ukuran kecil untuk instruksi
    color: '#2c3e50',  // Navy gelap
    lineHeight: 22,    // Spasi baris agak lebar agar mudah dibaca
  },

  // ── Tombol kembali ke dashboard ──
  backButton: {
    backgroundColor: '#3498db',   // Latar biru
    paddingHorizontal: 30,        // Padding kiri-kanan agar tombol tidak terlalu sempit
    paddingVertical: 12,          // Padding atas-bawah
    borderRadius: 8,              // Sudut sedikit bulat
  },

  // ── Teks di dalam tombol kembali ──
  backButtonText: {
    color: 'white',       // Putih kontras dengan latar biru
    fontSize: 16, // Ukuran font
    fontWeight: 'bold', // Ketebalan font
  },

  // ── Card informasi user merchant ──
  userCard: {
    backgroundColor: 'white',              // Latar putih
    padding: 20,                           // Padding dalam card
    borderRadius: 12,                      // Sudut membulat
    marginBottom: 15,                      // Jarak ke card berikutnya
    shadowColor: '#000',                   // Warna bayangan
    shadowOffset: { width: 0, height: 2 }, // Bayangan ke bawah
    shadowOpacity: 0.1,                    // Bayangan 10%
    shadowRadius: 4,                       // Blur bayangan
    elevation: 3,                          // Shadow Android
  },

  // ── Nama user merchant ──
  userName: {
    fontSize: 18,        // Agak besar untuk nama
    fontWeight: 'bold', // Ketebalan font
    color: '#2c3e50',    // Navy gelap
    marginBottom: 8,     // Jarak ke teks saldo
  },

  // ── Saldo user merchant ──
  userBalance: {
    fontSize: 16, // Ukuran font
    color: '#27ae60',    // Hijau agar terlihat sebagai angka positif/saldo
    fontWeight: '600',   // Semi-bold
  },

  // ── Card peringatan (latar kuning) ──
  warningCard: {
    backgroundColor: '#fff3cd',    // Kuning pucat untuk peringatan ringan
    padding: 15, // Jarak dalam semua sisi
    borderRadius: 8, // Kelengkungan sudut elemen
    marginBottom: 15, // Jarak luar bawah
    borderLeftWidth: 4,             // Aksen garis kiri
    borderLeftColor: '#f39c12',     // Kuning keemasan untuk warning
  },

  // ── Teks di dalam card peringatan ──
  warningText: {
    fontSize: 14, // Ukuran font
    color: '#856404',        // Cokelat tua untuk kontras di latar kuning
    textAlign: 'center', // Perataan teks
  },

  // ── Card instruksi cara penggunaan (biru muda) ──
  instructionCard: {
    backgroundColor: '#e3f2fd',    // Biru sangat muda
    padding: 20, // Jarak dalam semua sisi
    borderRadius: 12, // Kelengkungan sudut elemen
    marginBottom: 20, // Jarak luar bawah
    borderLeftWidth: 4,            // Aksen biru di kiri
    borderLeftColor: '#2196f3',
  },

  // ── Judul instruksi di dalam card biru ──
  instructionTitle: {
    fontSize: 16, // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    color: '#1565c0',      // Biru tua agar kontras di latar biru muda
    marginBottom: 12, // Jarak luar bawah
    textAlign: 'center', // Perataan teks
  },

  // ── Card status kartu NFC yang berhasil dibaca ──
  cardStatusCard: {
    backgroundColor: '#d4edda',   // Hijau muda untuk status sukses
    padding: 15, // Jarak dalam semua sisi
    borderRadius: 8, // Kelengkungan sudut elemen
    marginBottom: 15, // Jarak luar bawah
    borderLeftWidth: 4,           // Aksen hijau di kiri
    borderLeftColor: '#27ae60',
  },

  // ── Judul di dalam card status kartu ──
  cardStatusTitle: {
    fontSize: 16, // Ukuran font
    fontWeight: 'bold', // Ketebalan font
    color: '#155724',      // Hijau gelap agar kontras di latar hijau muda
    marginBottom: 5, // Jarak luar bawah
  },

  // ── UID kartu NFC (format monospace) ──
  cardStatusUid: {
    fontSize: 13, // Ukuran font
    color: '#155724', // Warna teks
    fontFamily: 'monospace',  // Monospace agar UID terlihat seperti kode teknis
    marginBottom: 3, // Jarak luar bawah
  },

  // ── Teks keterangan di bawah UID ──
  cardStatusSubtext: {
    fontSize: 12,          // Kecil untuk keterangan tambahan
    color: '#155724',      // Sama dengan warna teks lain di area hijau
  },

  // ── Tombol aksi utama (Scan, Kirim, dll) ──
  actionButton: {
    backgroundColor: '#3498db',             // Biru default
    padding: 18,                             // Padding besar agar mudah disentuh
    borderRadius: 12,                        // Sudut membulat
    alignItems: 'center',                   // Teks di tengah
    marginBottom: 15,                        // Jarak antar tombol
    shadowColor: '#000', // Warna bayangan elemen
    shadowOffset: { width: 0, height: 2 }, // Arah dan jarak bayangan
    shadowOpacity: 0.1, // Transparansi bayangan
    shadowRadius: 4, // Blur radius bayangan
    elevation: 3, // Ketinggian bayangan (Android)
  },

  // ── Varian tombol warna ungu (untuk "Scan Kartu") ──
  scanCardButton: { backgroundColor: '#9b59b6' }, // Tombol scan kartu berwarna ungu

  // ── Varian tombol warna hijau (untuk "Kirim/Bayar") ──
  sendButton: { backgroundColor: '#27ae60' }, // Tombol kirim berwarna hijau

  // ── Varian tombol warna biru langit (untuk "Terima") ──
  receiveButton: { backgroundColor: '#2196f3' }, // Tombol terima berwarna biru

  // ── Varian tombol abu-abu (disabled) ──
  disabledButton: {
    backgroundColor: '#95a5a6', // Abu-abu netral
    opacity: 0.6,               // Redup sebagai tanda tidak aktif
  },

  // ── Teks utama di dalam tombol aksi ──
  actionButtonText: {
    color: 'white',        // Putih kontras
    fontSize: 18,          // Besar agar mudah dibaca
    fontWeight: 'bold', // Ketebalan font
    marginBottom: 4,       // Jarak ke subteks di bawahnya
  },

  // ── Subteks kecil di bawah teks tombol ──
  actionButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)', // Putih sedikit transparan
    fontSize: 14, // Ukuran font
  },

  // ── Card input nominal (kotak putih dengan TextInput) ──
  inputCard: {
    backgroundColor: 'white',  // Latar putih
    padding: 20, // Jarak dalam semua sisi
    borderRadius: 12, // Kelengkungan sudut elemen
    marginBottom: 15, // Jarak luar bawah
  },

  // ── Label di atas TextInput ──
  inputLabel: {
    fontSize: 16, // Ukuran font
    fontWeight: '600',   // Semi-bold untuk label
    color: '#2c3e50',    // Navy gelap
    marginBottom: 10,    // Jarak ke TextInput di bawah
  },

  // ── TextInput nominal transaksi ──
  input: {
    backgroundColor: '#f8f9fa',  // Latar abu-abu sangat terang
    padding: 15,                  // Padding dalam input
    borderRadius: 8,              // Sudut membulat ringan
    fontSize: 16,                 // Ukuran teks ketikan
    borderWidth: 1,               // Border tipis
    borderColor: '#e9ecef',       // Border abu muda
  },

  // ── Teks hint di bawah input ──
  inputHint: {
    fontSize: 12,       // Sangat kecil sebagai catatan kaki
    color: '#7f8c8d',   // Abu-abu redup
    marginTop: 5,       // Jarak dari input di atas
  },

});

export default styles; // Ekspor agar bisa digunakan di NFCScreen.tsx

