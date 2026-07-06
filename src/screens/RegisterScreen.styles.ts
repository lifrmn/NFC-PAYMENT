// src/screens/RegisterScreen.styles.ts
// ============================================================
// FILE INI: Semua gaya tampilan untuk RegisterScreen
// Dipisah dari RegisterScreen.tsx agar kode lebih rapi dan mudah diubah
// ============================================================

import { StyleSheet } from 'react-native';
// Import API styling dari React Native

const styles = StyleSheet.create({

  // ── Layar Utama ──
  container: {
    flex: 1,
    // Mengisi seluruh tinggi layar
    backgroundColor: '#f5f5f5',
    // Latar abu-abu terang agar mata tidak lelah
  },

  // ── Wrapper keyboard ──
  // KeyboardAvoidingView membutuhkan flex:1 agar layout tidak putus saat keyboard muncul
  keyboardView: { flex: 1 },

  // ── ScrollView bagian dalam ──
  // flexGrow: 1 = ScrollView bisa tumbuh, justifyContent: center = konten di tengah jika pendek
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },

  // ── Area konten dengan padding ──
  content: { padding: 20 },
  // Jarak 20dp dari semua sisi layar

  // ── Judul halaman "Daftar" ──
  title: {
    fontSize: 32,
    // Font besar sebagai judul utama
    fontWeight: 'bold',
    // Tebal agar menonjol
    textAlign: 'center',
    // Rata tengah
    marginBottom: 8,
    // Jarak ke subtitle di bawahnya
    color: '#2c3e50',
    // Warna navy gelap
  },

  // ── Subtitle / keterangan di bawah judul ──
  subtitle: {
    fontSize: 16,
    // Font sedang
    textAlign: 'center',
    // Rata tengah
    marginBottom: 40,
    // Jarak besar ke form di bawah
    color: '#7f8c8d',
    // Warna abu-abu untuk kesan informatif
  },

  // ── Wrapper form ──
  form: { width: '100%' },
  // Lebar penuh agar field input tidak sempit

  // ── Field input teks (name, username, password, konfirmasi) ──
  input: {
    backgroundColor: 'white',
    // Latar putih agar field terlihat jelas
    paddingHorizontal: 20,
    // Padding kiri-kanan dalam field
    paddingVertical: 16,
    // Padding atas-bawah dalam field
    borderRadius: 12,
    // Sudut membulat agar terkesan modern
    marginBottom: 16,
    // Jarak antar field input
    fontSize: 16,
    // Ukuran teks yang diketik user
    color: '#2c3e50',
    // Warna teks navy gelap
    borderWidth: 1,
    // Border tipis 1dp
    borderColor: '#ddd',
    // Warna border abu-abu muda
    minHeight: 50,
    // Tinggi minimum agar mudah disentuh
    shadowColor: '#000',
    // Warna bayangan
    shadowOffset: { width: 0, height: 1 },
    // Bayangan ke bawah 1dp
    shadowOpacity: 0.2,
    // Bayangan semi-transparan (20%)
    shadowRadius: 2,
    // Blur bayangan
    elevation: 2,
    // Shadow untuk Android
  },

  // ── Tombol "Daftar" ──
  registerButton: { marginBottom: 20 },
  // Jarak bawah dari tombol ke link login

  // ── Container link "Sudah punya akun?" ──
  loginLinkContainer: {
    paddingVertical: 20,
    // Padding vertikal agar mudah disentuh
    marginTop: 10,
    // Jarak dari elemen di atasnya
    alignItems: 'center',
    // Teks di tengah horizontal
  },

  // ── Teks link "Masuk" ──
  loginLinkText: {
    color: '#3498db',
    // Biru cerah agar terlihat sebagai link yang bisa diklik
    fontSize: 16,
    // Ukuran sedang agar mudah dibaca
    fontWeight: '600',
    // Sedikit tebal untuk menonjolkan link
  },

});

export default styles;
// Ekspor styles agar bisa digunakan di RegisterScreen.tsx

