// src/screens/LoginScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk LoginScreen
// Berisi style untuk logo, form login, tombol, dan link daftar
// ============================================================

import { StyleSheet } from 'react-native';
// Import API styling dari React Native

const styles = StyleSheet.create({

  // ── Safe Area (root screen) ──
  safeArea: {
    flex: 1,
    // Isi seluruh area aman layar
    backgroundColor: '#f0f4f8',
    // Latar abu-abu biru muda (lembut di mata)
  },

  // ── Container dalam SafeAreaView ──
  container: {
    flex: 1,
    // Mengisi sisa ruang yang tersedia
  },

  // ── Area konten utama (form & logo) ──
  content: {
    flex: 1,
    // Mengisi tinggi penuh
    justifyContent: 'center',
    // Vertikal: konten di tengah layar
    paddingHorizontal: 24,
    // Jarak kiri-kanan 24dp
    paddingVertical: 40,
    // Jarak atas-bawah 40dp
  },

  // ── Bagian header (logo + judul) ──
  header: {
    alignItems: 'center',
    // Rata tengah horizontal
    marginBottom: 40,
    // Jarak 40dp ke card form di bawah
  },

  // ── Container pembungkus logo + badge ──
  logoContainer: {
    position: 'relative',
    // Posisi relatif agar badge bisa absolute di atasnya
    width: 120,
    // Lebar area logo
    height: 120,
    // Tinggi area logo
    marginBottom: 20,
    // Jarak ke teks judul
  },

  // ── Logo utama (kotak biru dengan ikon kartu) ──
  logo: {
    width: 120,
    // Lebar logo 120dp
    height: 120,
    // Tinggi logo 120dp
    backgroundColor: '#3B82F6',
    // Biru utama brand
    borderRadius: 30,
    // Sudut membulat
    justifyContent: 'center',
    // Konten di tengah vertikal
    alignItems: 'center',
    // Konten di tengah horizontal
    shadowColor: '#3B82F6',
    // Bayangan warna biru (glow effect)
    shadowOffset: { width: 0, height: 8 },
    // Bayangan ke bawah 8dp
    shadowOpacity: 0.3,
    // Bayangan 30% opacity
    shadowRadius: 16,
    // Blur bayangan 16dp
    elevation: 8,
    // Shadow Android
  },

  // ── Ikon kartu di dalam logo ──
  logoIcon: {
    fontSize: 48,
    // Ukuran emoji besar
    marginBottom: -5,
    // Geser sedikit ke atas agar teks gelombang lebih dekat
  },

  // ── Teks gelombang NFC ")))" di logo ──
  logoWave: {
    fontSize: 28,
    // Ukuran sedang
    color: '#fff',
    // Putih agar kontras dengan latar biru
    fontWeight: 'bold',
    // Tebal
  },

  // ── Badge perisai di pojok kanan bawah logo ──
  logoShield: {
    position: 'absolute',
    // Posisi absolute di atas logoContainer
    right: -5,
    // Geser 5dp ke kanan agar menonjol keluar
    bottom: -5,
    // Geser 5dp ke bawah
    width: 44,
    // Lebar lingkaran badge
    height: 44,
    // Tinggi lingkaran badge
    backgroundColor: '#fff',
    // Latar putih agar emoji terlihat
    borderRadius: 22,
    // Bulat sempurna (radius = setengah width)
    justifyContent: 'center',
    // Konten di tengah
    alignItems: 'center',
    // Perataan item di sumbu silang (cross axis)
    shadowColor: '#000',
    // Bayangan hitam tipis
    shadowOffset: { width: 0, height: 2 },
    // Arah dan jarak bayangan
    shadowOpacity: 0.1,
    // Transparansi bayangan
    shadowRadius: 4,
    // Blur radius bayangan
    elevation: 4,
    // Ketinggian bayangan (Android)
  },

  // ── Emoji perisai / gembok di dalam badge ──
  shieldIcon: {
    fontSize: 24,
    // Ukuran pas untuk badge 44dp
  },

  // ── Judul "NFC Payment" ──
  title: {
    fontSize: 28,
    // Font besar sebagai judul utama halaman
    fontWeight: 'bold',
    // Tebal
    color: '#1e293b',
    // Navy gelap agar mudah dibaca
    marginBottom: 8,
    // Jarak ke subtitle
  },

  // ── Subtitle di bawah judul ──
  subtitle: {
    fontSize: 14,
    // Font kecil untuk keterangan
    color: '#64748b',
    // Abu-abu medium
    textAlign: 'center',
    // Rata tengah
    paddingHorizontal: 20,
    // Padding agar teks tidak terlalu lebar
  },

  // ── Card putih tempat form login ──
  card: {
    backgroundColor: '#fff',
    // Latar putih kontras dengan background abu
    borderRadius: 24,
    // Sudut membulat besar (modern)
    padding: 24,
    // Padding dalam card
    shadowColor: '#000',
    // Bayangan hitam
    shadowOffset: { width: 0, height: 4 },
    // Bayangan ke bawah 4dp
    shadowOpacity: 0.1,
    // Bayangan tipis (10%)
    shadowRadius: 12,
    // Blur bayangan
    elevation: 5,
    // Shadow Android
  },

  // ── Judul di dalam card ("Masuk") ──
  cardTitle: {
    fontSize: 24,
    // Ukuran heading dalam card
    fontWeight: 'bold',
    // Ketebalan font
    color: '#1e293b',
    // Warna teks
    marginBottom: 24,
    // Jarak ke input pertama
  },

  // ── Container baris input (ikon + TextInput) ──
  inputContainer: {
    flexDirection: 'row',
    // Ikon dan input berjajar horizontal
    alignItems: 'center',
    // Rata tengah vertikal
    backgroundColor: '#f8fafc',
    // Latar abu-abu sangat muda
    borderRadius: 12,
    // Sudut membulat
    paddingHorizontal: 16,
    // Padding dalam baris
    marginBottom: 16,
    // Jarak antar baris input
    borderWidth: 1,
    // Border tipis
    borderColor: '#e2e8f0',
    // Warna border abu muda
  },

  // ── Ikon di kiri input (🧑 atau 🔒) ──
  inputIcon: {
    fontSize: 20,
    // Ukuran ikon
    marginRight: 12,
    // Jarak ke TextInput
  },

  // ── TextInput untuk username dan password ──
  input: {
    flex: 1,
    // Ambil sisa lebar setelah ikon
    height: 56,
    // Tinggi area sentuh yang nyaman
    fontSize: 16,
    // Ukuran teks yang diketik
    color: '#1e293b',
    // Warna teks navy
  },

  // ── Teks "Lupa password?" ──
  forgotPassword: {
    alignSelf: 'flex-end',
    // Rata kanan
    marginBottom: 24,
    // Jarak ke tombol login
  },

  // ── Teks link lupa password ──
  forgotPasswordText: {
    color: '#3B82F6',
    // Biru agar terlihat sebagai link
    fontSize: 14,
    // Ukuran font
    fontWeight: '500',
    // Ketebalan font
  },

  // ── Tombol "Masuk" ──
  loginButton: {
    backgroundColor: '#3B82F6',
    // Biru utama brand
    borderRadius: 16,
    // Sudut membulat
    height: 56,
    // Tinggi nyaman untuk tap
    justifyContent: 'center',
    // Teks di tengah vertikal
    alignItems: 'center',
    // Teks di tengah horizontal
    shadowColor: '#3B82F6',
    // Glow biru di bawah tombol
    shadowOffset: { width: 0, height: 4 },
    // Arah dan jarak bayangan
    shadowOpacity: 0.3,
    // Transparansi bayangan
    shadowRadius: 8,
    // Blur radius bayangan
    elevation: 4,
    // Ketinggian bayangan (Android)
  },

  // ── Tombol "Masuk" saat disabled (loading) ──
  loginButtonDisabled: {
    opacity: 0.6,
    // Redup 40% sebagai sinyal tidak aktif
  },

  // ── Teks di dalam tombol "Masuk" ──
  loginButtonText: {
    color: '#fff',
    // Putih kontras dengan biru
    fontSize: 18,
    // Font besar agar mudah dibaca
    fontWeight: 'bold',
    // Ketebalan font
  },

  // ── Baris loading (spinner + teks) ──
  processingRow: {
    flexDirection: 'row',
    // Spinner dan teks berjajar horizontal
    alignItems: 'center',
    // Rata tengah vertikal
  },

  // ── Container link "Belum punya akun?" ──
  registerContainer: {
    flexDirection: 'row',
    // Teks dan link berjajar horizontal
    justifyContent: 'center',
    // Di tengah horizontal
    alignItems: 'center',
    // Rata tengah vertikal
    marginTop: 24,
    // Jarak dari tombol di atas
  },

  // ── Teks "Belum punya akun?" ──
  registerText: {
    color: '#64748b',
    // Abu-abu agar tidak terlalu mencolok
    fontSize: 14,
    // Ukuran font
  },

  // ── Teks link "Daftar" ──
  registerLink: {
    color: '#3B82F6',
    // Biru agar terlihat sebagai link
    fontSize: 14,
    // Ukuran font
    fontWeight: '600',
    // Sedikit tebal
  },

});

export default styles;
// Ekspor agar bisa digunakan di LoginScreen.tsx

