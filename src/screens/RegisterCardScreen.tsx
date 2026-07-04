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
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View, // View adalah container dasar React Native — setara div di HTML
  Text, // Text menampilkan teks di UI
  TouchableOpacity, // TouchableOpacity adalah tombol dengan efek transparan saat ditekan
  Alert, // Alert menampilkan dialog popup native — untuk pesan sukses, error, dan konfirmasi registrasi kartu
  ActivityIndicator // ActivityIndicator adalah spinner animasi — ditampilkan saat proses registrasi atau scanning berlangsung
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI native
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
  const [scannedCardId, setScannedCardId] = useState(''); // const membuat variabel tetap; useState('') nilai awal string kosong; scannedCardId menyimpan UID kartu yang berhasil dibaca NFC; setScannedCardId memperbarui state

  // STATE 6: registrationStatus - Status proses registrasi kartu
  // 'idle'     → Belum mulai (tampilkan tombol scan)
  // 'scanning' → Sedang scan kartu NFC
  // 'success'  → Registrasi berhasil
  // 'error'    → Registrasi gagal
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle'); // useState dengan union type TypeScript; hanya bisa berisi salah satu dari empat string tersebut; 'idle' adalah nilai awal

  // useEffect: Inisialisasi NFC saat screen mount
  // Cleanup listener NFC saat screen unmount (cegah memory leak)
  useEffect(() => { // useEffect(callback, []) dijalankan SEKALI saat komponen mount
    initializeNFC(); // memanggil initializeNFC() untuk mendeteksi hardware NFC saat screen dibuka
    return () => { // cleanup function dijalankan saat komponen di-unmount
      NFCService.cleanup(); // melepas resource NFC untuk mencegah memory leak
    };
  }, []); // array kosong [] berarti efek ini hanya berjalan sekali

  // Fungsi: Inisialisasi NFC hardware dan cek status NFC
  // Dipanggil saat screen pertama kali dibuka
  const initializeNFC = async () => { // const membuat variabel tetap; async karena mengakses hardware NFC
    const supported = await NFCService.initNFC(); // await menunggu inisialisasi; mengembalikan true jika device mendukung NFC hardware
    setNfcSupported(supported); // setNfcSupported memperbarui state; false = tampilkan layar "tidak didukung"
    
    if (supported) { // if memeriksa apakah hardware NFC tersedia
      const enabled = await NFCService.checkNFCEnabled(); // await mengecek status NFC di pengaturan sistem
      setNfcEnabled(enabled); // setNfcEnabled memperbarui state; true = NFC aktif, false = NFC mati
    }
  };

  // Fungsi: Handler utama saat tombol "Scan Kartu NFC" ditekan
  // Flow: Tampilkan alert → scan kartu → validasi → daftarkan
  const handleScanCard = async () => { // const membuat variabel tetap; async karena proses NFC dan HTTP request memerlukan await
    if (!nfcEnabled) { // ! membalik boolean; jika NFC tidak aktif, tampilkan pesan dan hentikan
      Alert.alert('NFC Tidak Aktif', 'Aktifkan NFC untuk melanjutkan'); // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      return; // return menghentikan fungsi lebih awal
    }

    setScanning(true);               // setScanning(true) memperbarui state menandai proses scan dimulai
    setRegistrationStatus('scanning'); // setRegistrationStatus('scanning') mengubah tampilan UI ke status scan

    try { // try memulai blok percobaan utama
      Alert.alert( // Alert.alert menampilkan dialog instruksi ke user
        'Scan Kartu NFC', // judul Alert yang memberitahu user tindakan yang perlu dilakukan
        'Tempelkan kartu NFC Anda ke perangkat', // pesan instruksi detail kepada user cara melakukan scan kartu
        [{ text: 'OK' }] // tombol tunggal 'OK' di Alert; menutup dialog saat user menekan OK
      );

      const cardData = await NFCService.readPhysicalCard(); // await menunggu user menempelkan kartu NFC; mengembalikan objek { id, type, manufacturer }
      
      if (!cardData || !cardData.id) { // !cardData berarti null/undefined; !cardData.id berarti UID kosong
        throw new Error('Gagal membaca kartu NFC'); // throw Error membuat exception yang akan ditangkap oleh catch
      }

      setScannedCardId(cardData.id); // setScannedCardId menyimpan UID kartu untuk ditampilkan ke user

      try { // try bersarang untuk cek apakah kartu sudah terdaftar
        const cardInfo = await apiService.getCardInfo(cardData.id); // await HTTP GET /api/nfc-cards/info/:cardId untuk cek status kartu
        
        if (cardInfo && cardInfo.card?.userId === user.id) { // optional chaining (?.) aman; === operator kesamaan strict
          Alert.alert( // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
            'Kartu Sudah Terdaftar', // judul Alert ketika kartu yang discan sudah terdaftar di akun user ini
            `Kartu ini sudah terdaftar di akun Anda.\n\nUID: ${cardData.id}\nStatus: ${cardInfo.card?.cardStatus}\nSaldo: Rp${cardInfo.card?.balance?.toLocaleString('id-ID') || 0}`, // template literal ${} menyisipkan nilai dinamis; toLocaleString('id-ID') memformat angka ke format Indonesia
            [{ text: 'OK', onPress: () => setRegistrationStatus('success') }] // onPress callback mengubah status ke 'success'
          );
          return; // return menghentikan proses registrasi lebih awal
        } else if (cardInfo && cardInfo.card?.userId !== user.id) { // !== berarti tidak sama persis
          Alert.alert( // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
            'Kartu Sudah Digunakan', // judul Alert ketika kartu sudah terdaftar di akun user lain; kartu tidak bisa dibagi
            'Kartu ini sudah terdaftar di akun pengguna lain', // pesan penjelasan bahwa kartu ini sudah dimiliki akun lain; kartu NFC tidak bisa dipakai bersama
            [{ text: 'OK', onPress: () => setRegistrationStatus('error') }] // array tombol Alert; onPress mengeset status ke 'error' agar UI menampilkan state gagal
          );
          return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
        }
      } catch (error: any) { // catch bersarang menangkap error dari getCardInfo
        if (!error.message?.includes('404')) { // optional chaining (?.) aman; includes('404') cek apakah HTTP 404 (kartu belum terdaftar)
          throw error; // throw melempar ulang error agar ditangkap catch luar jika bukan 404
        }
        // Jika 404: kartu belum terdaftar — lanjutkan ke STEP 4 registrasi
      }

      setLoading(true); // setLoading(true) menampilkan spinner saat mengirim request ke backend
      const registerResponse = await apiService.registerCard({ // await menunggu HTTP POST /api/nfc-cards/register
        cardId: cardData.id,              // UID kartu yang dibaca dari NFC
        userId: user.id,                  // ID user pemilik kartu
        balance: 0,                       // saldo awal kartu = 0
        deviceId: user.deviceId || 'mobile-app', // || 'mobile-app' fallback jika deviceId tidak ada
      });

      if (registerResponse && registerResponse.success) { // && berarti AND; kedua kondisi harus benar
        setRegistrationStatus('success'); // mengubah status ke 'success' untuk memperbarui tampilan UI
        Alert.alert( // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
          'Berhasil!', // judul Alert sukses; tanda seru menekankan keberhasilan registrasi kartu
          `Kartu NFC berhasil didaftarkan\n\nUID: ${cardData.id}`, // pesan sukses dengan UID kartu; UID adalah identitas unik kartu NFC yang tidak bisa diubah
          [
            {
              text: 'OK', // teks tombol konfirmasi; menekan OK akan memanggil onPress callback di bawah
              onPress: () => { // arrow function sebagai callback saat user tekan OK
                if (onSuccess) onSuccess(); // if memeriksa apakah prop onSuccess ada sebelum dipanggil
                else onBack(); // else dipanggil jika onSuccess tidak ada — fallback ke onBack
              },
            },
          ]
        );
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        throw new Error('Gagal mendaftarkan kartu'); // throw Error jika respons backend tidak sukses
      }
    } catch (error: any) { // catch luar menangkap semua error yang tidak tertangani
      console.error('Error registering card:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      setRegistrationStatus('error'); // setRegistrationStatus('error') menampilkan UI error
      Alert.alert('Error', error.message || 'Gagal mendaftarkan kartu NFC'); // || fallback jika error.message tidak ada
    } finally { // finally selalu dijalankan baik berhasil maupun error
      setLoading(false); // setLoading(false) menyembunyikan spinner
      setScanning(false); // setScanning(false) mengakhiri status scanning
    }
  };

  // ── RENDER KONDISIONAL 1: NFC Tidak Didukung Perangkat ──
  // Hardware NFC tidak ada di perangkat (langka tapi perlu di-handle)
  if (!nfcSupported) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
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
  if (!nfcEnabled) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
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
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>Cara Mengaktifkan NFC:</Text>
            <Text style={styles.instructionItem}>1. Buka Pengaturan HP</Text>
            <Text style={styles.instructionItem}>2. Cari menu "Koneksi Perangkat" atau "NFC"</Text>
            <Text style={styles.instructionItem}>3. Aktifkan toggle NFC</Text>
            <Text style={styles.instructionItem}>4. Kembali ke aplikasi ini</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={initializeNFC}>
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── RENDER UTAMA: Form Registrasi Kartu ──
  // Ditampilkan jika NFC didukung dan aktif
  return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
    <SafeAreaView style={styles.container}> {/* SafeAreaView: padding aman dari notch */}
      <View style={styles.header}> {/* View header: tombol kembali dan judul */}
        <TouchableOpacity onPress={onBack} style={styles.backButton}> {/* tombol kembali */}
          <Text style={styles.backIcon}>←</Text> {/* ikon panah kiri */}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrasi Kartu NFC</Text> {/* judul screen */}
        <View style={styles.headerSpacer} /> {/* spacer keseimbangan */}
      </View>

      <View style={styles.content}> {/* View konten utama screen */}
        {/* ✅ DIPERBAIKI: Literal \n antara <View> dihapus — sebelumnya ada \n<View...> yang menjadi teks liar di JSX */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>💳</Text>
              <Text style={styles.logoWave}>)))</Text>
            </View>
            <View style={styles.logoShield}>
              <Text style={styles.shieldIcon}>✓</Text>
            </View>
          </View>
          <Text style={styles.title}>Registrasi Kartu NFC</Text>
          <Text style={styles.subtitle}>
            Daftarkan kartu NFC Anda untuk digunakan dalam pembayaran aman
          </Text>
        </View>

        {registrationStatus === 'success' ? ( // ternary rendering: tampilan berbeda berdasarkan status registrasi (success atau proses)
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Kartu terdeteksi</Text>
            {scannedCardId && ( // conditional rendering: menampilkan detail kartu hanya jika sudah ada UID yang terscan
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
        ) : ( // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
          <View style={styles.scanCard}>
            <View style={styles.nfcAnimation}>
              <View style={styles.nfcCircle}>
                <Text style={styles.nfcIcon}>📲</Text>
              </View>
              <View style={[styles.nfcWave, styles.nfcWave1]} />
              <View style={[styles.nfcWave, styles.nfcWave2]} />
              <View style={[styles.nfcWave, styles.nfcWave3]} />
            </View>

            {/* Tampilkan UID kartu jika sudah terscan, sembunyikan jika belum */}
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

            <TouchableOpacity // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
              style={[styles.scanButton, (scanning || loading) && styles.scanButtonDisabled]} // style={} prop untuk menerapkan styling ke elemen React Native
              onPress={handleScanCard} // onPress dipanggil saat user menekan elemen; menghubungkan event ke fungsi handler
              disabled={scanning || loading} // disabled: jika true tombol tidak bisa ditekan; digunakan saat loading atau form belum lengkap
            >
              {scanning || loading ? ( // ternary JSX: jika sedang scanning atau loading tampilkan spinner aktivitas
                <ActivityIndicator color="#fff" />
              ) : ( // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
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