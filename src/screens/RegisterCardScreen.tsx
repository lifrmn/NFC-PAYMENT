// src/screens/RegisterCardScreen.tsx
// ==================================================================================
// 📋 SCREEN: RegisterCardScreen
// ==================================================================================
//
// Purpose:
// Screen untuk mendaftarkan kartu NFC fisik ke akun user.
// User menempelkan kartu NFC fisik (NTag215) ke HP → sistem baca UID → daftar ke backend.
//
// User Flow:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ 1. User tap "➕ Daftar Kartu" di DashboardScreen/MyCardsScreen     │
// │ 2. RegisterCardScreen muncul                                        │
// │ 3. System check NFC:                                                │
// │    - Tidak didukung perangkat: Tampilkan pesan error "NFC Tidak    │
// │      Didukung"                                                      │
// │    - Didukung tapi tidak aktif: Tampilkan instruksi aktifkan NFC  │
// │    - Didukung & aktif: Tampilkan tombol "Scan Kartu"              │
// │ 4. User tap tombol "Scan Kartu NFC"                                 │
// │ 5. Alert muncul: "Tempelkan kartu NFC Anda ke perangkat"           │
// │ 6. User tempelkan kartu NFC fisik ke HP                            │
// │ 7. System baca UID kartu                                            │
// │ 8. System cek apakah kartu sudah terdaftar:                        │
// │    - Sudah di akun ini: Tampilkan info kartu                       │
// │    - Sudah di akun lain: Tampilkan error "kartu milik orang lain"  │
// │    - Belum terdaftar (404): Lanjut ke step 9                       │
// │ 9. System daftarkan kartu ke backend (balance awal = 0)            │
// │ 10. Berhasil: Alert sukses → kembali ke screen sebelumnya          │
// └─────────────────────────────────────────────────────────────────────┘
//
// Features:
// 1. Deteksi Kemampuan NFC:
//    - Cek apakah perangkat mendukung NFC (hardware check)
//    - Cek apakah NFC diaktifkan user (settings check)
//    - Tampilkan screen berbeda untuk tiap kondisi
//
// 2. Scan Kartu NFC Fisik:
//    - Baca UID kartu NTag215 via NFCService.readPhysicalCard()
//    - Validasi kartu berhasil dibaca
//    - Cleanup listener NFC setelah selesai
//
// 3. Validasi Kepemilikan Kartu:
//    - Cek apakah kartu sudah terdaftar (GET /api/nfc-cards/info/:cardId)
//    - Handle 3 skenario: milik sendiri, milik orang lain, belum terdaftar
//    - Hanya lanjutkan registrasi jika kartu belum pernah didaftarkan
//
// 4. Registrasi Kartu:
//    - Kirim ke backend: POST /api/nfc-cards/register
//    - Payload: cardId, userId, balance (0), deviceId
//    - Tampilkan alert sukses dengan UID kartu
//
// 5. Status Tracking:
//    - registrationStatus: 'idle' | 'scanning' | 'success' | 'error'
//    - UI berubah sesuai status untuk feedback yang jelas ke user
//
// State Management:
// - nfcSupported: boolean       - Apakah hardware NFC ada
// - nfcEnabled: boolean         - Apakah NFC diaktifkan
// - loading: boolean            - Sedang proses registrasi API
// - scanning: boolean           - Sedang scan kartu NFC
// - scannedCardId: string       - UID kartu yang berhasil di-scan
// - registrationStatus: string  - Status registrasi (idle/scanning/success/error)
//
// Props:
// - user: any              - Data user yang login
// - onBack: () => void     - Callback kembali ke screen sebelumnya
// - onSuccess?: () => void - Callback opsional setelah registrasi berhasil
//
// ==================================================================================

// ==================================================================================
// IMPORTS
// ==================================================================================
// React & Hooks:
// - useState: State management (6 state variables)
// - useEffect: Init NFC saat mount + cleanup saat unmount
//
// React Native Core:
// - View, Text: Layout & teks
// - TouchableOpacity: Tombol interaktif
// - StyleSheet: Styling type-safe
// - Alert: Dialog notifikasi & konfirmasi
// - ActivityIndicator: Spinner loading
//
// Safe Area:
// - SafeAreaView: Hindari area notch/status bar
//
// Utils:
// - NFCService: Utilitas NFC (init, read physical card, cleanup)
// - apiService: HTTP client (getCardInfo, registerCard)
// ==================================================================================
import React, { useState, useEffect } from 'react'; // import React (wajib untuk JSX) dan dua hooks: useState untuk 6 state variable (nfcSupported, nfcEnabled, loading, scanning, scannedCardId, registrationStatus); useEffect untuk init NFC dan cleanup saat unmount
import {
  View, // View adalah container dasar React Native — setara div di HTML
  Text, // Text menampilkan teks di UI
  TouchableOpacity, // TouchableOpacity adalah tombol dengan efek transparan saat ditekan
  Alert, // Alert menampilkan dialog popup native — untuk pesan sukses, error, dan konfirmasi registrasi kartu
  ActivityIndicator // ActivityIndicator adalah spinner animasi — ditampilkan saat proses registrasi atau scanning berlangsung
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView memastikan konten tidak tertutup notch atau status bar
import { NFCService } from '../utils/nfc'; // import NFCService dari file lokal nfc.ts — menyediakan method initNFC, readPhysicalCard untuk scan kartu NFC, dan cleanup resource
import { apiService } from '../utils/apiService'; // import apiService Singleton — digunakan untuk memanggil endpoint backend: getCardInfo (cek kartu sudah terdaftar) dan registerCard (daftarkan kartu baru)
import styles from './RegisterCardScreen.styles'; // import stylesheet dari file terpisah

// Props yang diterima dari parent (App.tsx atau MyCardsScreen)
interface RegisterCardScreenProps { // interface adalah blueprint TypeScript untuk mendefinisikan struktur props
  user: any;               // props user bertipe any — berisi data user yang login (id, name, deviceId, dll)
  onBack: () => void;      // callback function () => void — dipanggil saat user tekan tombol kembali ke screen sebelumnya
  onSuccess?: () => void;  // tanda ? berarti props opsional — jika disediakan, dipanggil setelah registrasi kartu berhasil
}

export default function RegisterCardScreen({ user, onBack, onSuccess }: RegisterCardScreenProps) { // export default mengekspor komponen ini sebagai ekspor utama; destructuring props sesuai interface
  // STATE 1: nfcSupported - Apakah perangkat mendukung NFC secara hardware
  // false → tampilkan screen "NFC Tidak Didukung"
  const [nfcSupported, setNfcSupported] = useState(false); // useState(false) membuat state boolean; false berarti belum dicek; setNfcSupported digunakan untuk memperbarui hasil cek hardware

  // STATE 2: nfcEnabled - Apakah user sudah mengaktifkan NFC di Settings
  // false → tampilkan instruksi cara mengaktifkan NFC
  const [nfcEnabled, setNfcEnabled] = useState(false); // false berarti NFC belum aktif saat screen dibuka; diperbarui setelah initNFC() berhasil

  // STATE 3: loading - Flag saat proses registrasi API berlangsung
  // true → tampilkan spinner, disable tombol
  const [loading, setLoading] = useState(false); // false berarti tidak sedang loading; setLoading(true) dipanggil saat request ke backend dimulai

  // STATE 4: scanning - Flag saat sedang scan kartu NFC
  // true → sedang menunggu user tempelkan kartu ke HP
  const [scanning, setScanning] = useState(false); // false berarti tidak sedang dalam mode scan NFC; setScanning(true) dipanggil saat readPhysicalCard() dimulai

  // STATE 5: scannedCardId - Menyimpan UID kartu yang berhasil di-scan
  // Digunakan untuk ditampilkan ke user & dikirim ke backend
  const [scannedCardId, setScannedCardId] = useState('');

  // STATE 6: registrationStatus - Status proses registrasi kartu
  // 'idle'     → Belum mulai (tampilkan tombol scan)
  // 'scanning' → Sedang scan kartu NFC
  // 'success'  → Registrasi berhasil
  // 'error'    → Registrasi gagal
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');

  // useEffect: Inisialisasi NFC saat screen mount
  // Cleanup listener NFC saat screen unmount (cegah memory leak)
  useEffect(() => {
    initializeNFC();
    return () => {
      NFCService.cleanup();
    };
  }, []);

  // Fungsi: Inisialisasi NFC hardware dan cek status NFC
  // Dipanggil saat screen pertama kali dibuka
  const initializeNFC = async () => {
    const supported = await NFCService.initNFC(); // Init NFC library, return true jika didukung
    setNfcSupported(supported); // Simpan status dukungan NFC hardware
    
    if (supported) {
      // Jika hardware NFC ada, cek apakah user sudah aktifkan NFC di Settings
      const enabled = await NFCService.checkNFCEnabled();
      setNfcEnabled(enabled); // true = NFC aktif, false = NFC mati
    }
  };

  // Fungsi: Handler utama saat tombol "Scan Kartu NFC" ditekan
  // Flow: Tampilkan alert → scan kartu → validasi → daftarkan
  const handleScanCard = async () => {
    // Guard: NFC harus aktif sebelum bisa scan
    if (!nfcEnabled) {
      Alert.alert('NFC Tidak Aktif', 'Aktifkan NFC untuk melanjutkan');
      return;
    }

    setScanning(true);               // Tandai sedang scanning
    setRegistrationStatus('scanning'); // Update status UI

    try {
      // STEP 1: Tampilkan instruksi ke user untuk tempelkan kartu
      Alert.alert(
        'Scan Kartu NFC',
        'Tempelkan kartu NFC Anda ke perangkat',
        [{ text: 'OK' }]
      );

      // STEP 2: Baca kartu NFC fisik (menunggu user tempelkan kartu)
      // Return: { id: "UID_HEX", type: "NTag215", manufacturer: "NXP" }
      const cardData = await NFCService.readPhysicalCard();
      
      // Validasi: pastikan data kartu berhasil dibaca dengan UID yang valid
      if (!cardData || !cardData.id) {
        throw new Error('Gagal membaca kartu NFC');
      }

      setScannedCardId(cardData.id); // Simpan UID untuk ditampilkan ke user

      // STEP 3: Cek apakah kartu sudah pernah terdaftar di backend
      // Endpoint: GET /api/nfc-cards/info/:cardId
      try {
        const cardInfo = await apiService.getCardInfo(cardData.id);
        
        if (cardInfo && cardInfo.card?.userId === user.id) {
          // SKENARIO A: Kartu sudah terdaftar di akun INI → tampilkan info, jangan daftar ulang
          Alert.alert(
            'Kartu Sudah Terdaftar',
            `Kartu ini sudah terdaftar di akun Anda.\n\nUID: ${cardData.id}\nStatus: ${cardInfo.card?.cardStatus}\nSaldo: Rp${cardInfo.card?.balance?.toLocaleString('id-ID') || 0}`,
            [{ text: 'OK', onPress: () => setRegistrationStatus('success') }]
          );
          return; // Hentikan proses registrasi
        } else if (cardInfo && cardInfo.card?.userId !== user.id) {
          // SKENARIO B: Kartu sudah terdaftar di akun ORANG LAIN → tolak registrasi
          Alert.alert(
            'Kartu Sudah Digunakan',
            'Kartu ini sudah terdaftar di akun pengguna lain',
            [{ text: 'OK', onPress: () => setRegistrationStatus('error') }]
          );
          return; // Hentikan, tidak bisa daftar kartu orang lain
        }
      } catch (error: any) {
        // SKENARIO C: Error 404 = kartu BELUM terdaftar → lanjutkan registrasi
        // Error lain (jaringan, server) → lempar ke catch utama
        if (!error.message?.includes('404')) {
          throw error; // Re-throw error selain 404
        }
        // Jika 404: card not found = belum terdaftar, lanjutkan ke STEP 4
      }

      // STEP 4: Daftarkan kartu baru ke backend
      setLoading(true); // Tampilkan loading saat request API
      // Endpoint: POST /api/nfc-cards/register
      const registerResponse = await apiService.registerCard({
        cardId: cardData.id,              // UID kartu dari scan
        userId: user.id,                  // ID user pemilik
        balance: 0,                       // Saldo awal = 0
        deviceId: user.deviceId || 'mobile-app', // Device ID untuk audit trail
      });

      if (registerResponse && registerResponse.success) {
        setRegistrationStatus('success'); // Update status ke sukses
        Alert.alert(
          'Berhasil!',
          `Kartu NFC berhasil didaftarkan\n\nUID: ${cardData.id}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Panggil callback yang sesuai setelah sukses:
                // onSuccess (jika ada) atau onBack sebagai fallback
                if (onSuccess) onSuccess();
                else onBack();
              },
            },
          ]
        );
      } else {
        throw new Error('Gagal mendaftarkan kartu'); // Respons tidak sukses
      }
    } catch (error: any) {
      console.error('Error registering card:', error);
      setRegistrationStatus('error'); // Update status ke error
      Alert.alert('Error', error.message || 'Gagal mendaftarkan kartu NFC');
    } finally {
      // Cleanup: selalu matikan loading & scanning, apapun hasilnya
      setLoading(false);
      setScanning(false);
    }
  };

  // ── RENDER KONDISIONAL 1: NFC Tidak Didukung Perangkat ──
  // Hardware NFC tidak ada di perangkat (langka tapi perlu di-handle)
  if (!nfcSupported) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registrasi Kartu NFC</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorTitle}>NFC Tidak Didukung</Text>
          <Text style={styles.errorText}>
            Perangkat Anda tidak mendukung teknologi NFC
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── RENDER KONDISIONAL 2: NFC Tidak Aktif ──
  // Hardware ada tapi user belum aktifkan NFC di Settings
  if (!nfcEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registrasi Kartu NFC</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>NFC Tidak Aktif</Text>
          <Text style={styles.errorText}>
            Untuk menggunakan pembayaran NFC, aktifkan NFC di HP Anda:
          </Text>

          {/* Panduan langkah-langkah mengaktifkan NFC */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>Cara Mengaktifkan NFC:</Text>
            <Text style={styles.instructionItem}>1. Buka Pengaturan HP</Text>
            <Text style={styles.instructionItem}>2. Cari menu "Koneksi Perangkat" atau "NFC"</Text>
            <Text style={styles.instructionItem}>3. Aktifkan toggle NFC</Text>
            <Text style={styles.instructionItem}>4. Kembali ke aplikasi ini</Text>
          </View>

          {/* Tombol coba lagi: re-init NFC setelah user aktifkan di Settings */}
          <TouchableOpacity style={styles.retryButton} onPress={initializeNFC}>
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── RENDER UTAMA: Form Registrasi Kartu ──
  // Ditampilkan jika NFC didukung dan aktif
  return (
    <SafeAreaView style={styles.container}>
      {/* Header navigasi */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrasi Kartu NFC</Text>
        <View style={styles.headerSpacer} />{/* Spacer */}
      </View>

      <View style={styles.content}>
        {/* ── Hero Section: Logo & Judul ── */}
        {/* Visual branding & identitas halaman */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>💳</Text>
              <Text style={styles.logoWave}>)))</Text>{/* Animasi gelombang NFC */}
            </View>
            <View style={styles.logoShield}>
              <Text style={styles.shieldIcon}>✓</Text>{/* Badge keamanan */}
            </View>
          </View>
          <Text style={styles.title}>Registrasi Kartu NFC</Text>
          <Text style={styles.subtitle}>
            Daftarkan kartu NFC Anda untuk digunakan dalam pembayaran aman
          </Text>
        </View>

        {registrationStatus === 'success' ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Kartu terdeteksi</Text>
            {scannedCardId && (
              <View style={styles.cardIdContainer}>
                <Text style={styles.cardIdLabel}>UID Kartu</Text>
                <View style={styles.cardIdBox}>
                  <Text style={styles.cardIdIcon}>💳</Text>
                  <Text style={styles.cardIdText}>{scannedCardId}</Text>
                  <TouchableOpacity style={styles.copyButton}>
                    <Text style={styles.copyIcon}>📋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                Tempelkan kartu ke perangkat untuk membaca UID
              </Text>
            </View>
            <TouchableOpacity style={styles.registerButton} onPress={handleScanCard}>
              <Text style={styles.registerButtonText}>Daftarkan Kartu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scanCard}>
            <View style={styles.nfcAnimation}>
              <View style={styles.nfcCircle}>
                <Text style={styles.nfcIcon}>📲</Text>
              </View>
              <View style={[styles.nfcWave, styles.nfcWave1]} />
              <View style={[styles.nfcWave, styles.nfcWave2]} />
              <View style={[styles.nfcWave, styles.nfcWave3]} />
            </View>

            {scannedCardId ? (
              <View style={styles.cardIdContainer}>
                <Text style={styles.cardIdLabel}>UID Kartu</Text>
                <View style={styles.cardIdBox}>
                  <Text style={styles.cardIdIcon}>💳</Text>
                  <Text style={styles.cardIdText}>{scannedCardId}</Text>
                  <TouchableOpacity style={styles.copyButton}>
                    <Text style={styles.copyIcon}>📋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                Tempelkan kartu ke perangkat untuk membaca UID
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.scanButton, (scanning || loading) && styles.scanButtonDisabled]}
              onPress={handleScanCard}
              disabled={scanning || loading}
            >
              {scanning || loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.scanButtonText}>Scan Kartu NFC</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🛡️</Text>
          <Text style={styles.securityText}>
            Gunakan kartu NFC untuk pembayaran cepat dan aman. Pastikan kartu Anda selalu aman.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}