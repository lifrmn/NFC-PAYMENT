// src/screens/NFCScreenPayment.tsx
// ==================================================================================
// 💸 SCREEN: NFCScreenPayment
// ==================================================================================
//
// Purpose:
// Screen pembayaran NFC dari sisi PEMBELI (customer).
// User (pembeli) input nominal → tap kartu NFC ke HP merchant → pembayaran terjadi.
//
// Perbedaan dengan NFCScreen.tsx:
// - NFCScreen.tsx    → untuk MERCHANT (penerima), scan kartu PEMBELI
// - NFCScreenPayment → untuk PEMBELI (pengirim), input nominal + tap kartu
//
// User Flow:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ PEMBELI (PENGIRIM) FLOW:                                            │
// │                                                                     │
// │ 1. Pembeli tap "💸 Bayar" di DashboardScreen                       │
// │ 2. NFCScreenPayment muncul                                          │
// │ 3. System check NFC enabled:                                        │
// │    - Jika disabled: Tampilkan instruksi aktifkan NFC               │
// │    - Jika enabled: Tampilkan keypad & merchant info                │
// │ 4. Pembeli input nominal (e.g., Rp 50.000) via keypad              │
// │ 5. Pembeli tap "Lanjutkan Scan"                                     │
// │ 6. Modal Scan muncul: "Tempelkan kartu ke perangkat"               │
// │ 7. Pembeli dekatkan kartu NFC ke HP merchant                       │
// │ 8. System baca UID kartu pembeli                                    │
// │ 9. Backend proses: balance pembeli → balance merchant               │
// │ 10. Backend cek Z-Score fraud detection                             │
// │ 11. Success: nominal dikosongkan, siap transaksi berikutnya        │
// └─────────────────────────────────────────────────────────────────────┘
//
// Features:
// 1. NFC Hardware Check:
//    - Check status NFC enabled/disabled saat screen mount
//    - Tampilkan instruksi jika NFC non-aktif
//    - Cleanup NFC listener saat unmount (cegah memory leak)
//
// 2. Input Nominal via Keypad Custom:
//    - Keypad numerik 0-9 kustom (bukan native keyboard)
//    - Format otomatis: 50000 → "50.000" (locale id-ID)
//    - Tombol ⌫ untuk hapus digit terakhir
//    - Prefix "Rp" untuk kejelasan mata uang
//
// 3. Info Merchant:
//    - Tampilkan nama merchant yang akan menerima pembayaran
//    - Tampilkan tipe toko (Toko Retail)
//
// 4. Modal Scanning:
//    - Modal fullscreen saat proses scan NFC
//    - Animasi visual kartu NFC
//    - Tampilkan nominal transaksi yang sedang diproses
//    - Tombol "Batalkan" untuk abort transaksi
//
// 5. Loading State:
//    - Disable tombol "Lanjutkan Scan" saat processing
//    - Show ActivityIndicator spinner dalam tombol
//    - Prevent double-tap
//
// State Management:
// - nfcEnabled: boolean     - Status NFC hardware (enabled/disabled)
// - amount: string          - Nominal pembayaran (format: "50.000")
// - currentBalance: number  - Saldo pembeli terkini
// - merchant: object        - Info merchant penerima (name, type)
// - scanning: boolean       - Flag modal scan sedang tampil
//
// Hooks:
// - usePayment: Custom hook untuk logika pembayaran NFC
//   Returns: { isProcessing, processTapToPayTransfer }
// - useEffect: Init NFC hardware + cleanup saat unmount
//
// Props:
// - user: any      - Data user yang login (pembeli)
// - onBack: () => void - Callback kembali ke DashboardScreen
//
// ==================================================================================

// ==================================================================================
// IMPORTS
// ==================================================================================
// React & Hooks:
// - useState: Untuk state nfcEnabled, amount, balance, merchant, scanning
// - useEffect: Untuk init NFC saat mount & cleanup saat unmount
//
// React Native Core:
// - View, Text: Layout & teks dasar
// - TextInput: Input nominal (dipakai bersama keypad kustom)
// - TouchableOpacity: Tombol yang bisa diklik
// - StyleSheet: Styling type-safe
// - Alert: Pop-up notifikasi (error, konfirmasi)
// - ActivityIndicator: Spinner animasi loading
// - Modal: Overlay modal saat scan NFC
//
// Safe Area:
// - SafeAreaView: Hindari area notch/status bar perangkat
//
// Utils & Hooks:
// - NFCService: Utility NFC (init, read, cleanup)
// - usePayment: Custom hook untuk proses pembayaran
// - apiService: HTTP client untuk update/get saldo user
// ==================================================================================
import React, { useState, useEffect } from 'react'; // import React (wajib untuk JSX) dan dua hooks: useState untuk 5 state variable (nfcEnabled, amount, balance, merchant, scanning); useEffect untuk init NFC saat mount dan cleanup saat unmount
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View, // View adalah container dasar React Native \u2014 setara div di HTML
  Text, // Text menampilkan teks
  TextInput, // TextInput adalah input teks dengan keyboard numerik \u2014 digunakan bersama keypad kustom untuk input nominal pembayaran
  TouchableOpacity, // TouchableOpacity adalah tombol dengan efek transparan \u2014 digunakan untuk tombol keypad, tombol bayar, dan tombol kembali
  Alert, // Alert menampilkan dialog popup native \u2014 untuk pesan error dan konfirmasi pembayaran
  ActivityIndicator, // ActivityIndicator adalah spinner animasi \u2014 ditampilkan saat NFC processing berlangsung
  Modal // Modal adalah overlay layar penuh \u2014 digunakan untuk menampilkan tampilan scan NFC di atas screen utama
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home indicator
import { NFCService } from '../utils/nfc'; // import NFCService dari file nfc.ts \u2014 menyediakan initNFC, readPhysicalCard, dan cleanup untuk hardware NFC
import { usePayment } from '../hooks/usePayment'; // import custom hook usePayment dari file usePayment.ts \u2014 menyediakan processTapToPayTransfer dan isProcessing untuk alur pembayaran NFC
import { apiService } from '../utils/apiService'; // import apiService Singleton \u2014 digunakan untuk mengambil data user dan saldo terbaru setelah transaksi
import styles from './NFCScreenPayment.styles'; // import stylesheet dari file terpisah

// Props yang diterima komponen ini dari parent (App.tsx atau DashboardScreen)
interface NFCScreenProps { // interface adalah blueprint TypeScript untuk mendefinisikan struktur props yang diterima komponen ini
  user: any;     // props user bertipe any (fleksibel) \u2014 berisi data user yang sedang login (id, name, balance, dll)
  onBack: () => void; // callback function () => void \u2014 tidak menerima argumen dan tidak mengembalikan nilai; dipanggil saat user menekan tombol kembali
}

export default function NFCScreen({ user, onBack }: NFCScreenProps) { // export default mengekspor komponen ini sebagai ekspor utama file; destructuring props sesuai NFCScreenProps
  // STATE 1: nfcEnabled - Apakah NFC hardware aktif?
  // false = tampilkan instruksi aktifkan NFC
  // true  = tampilkan form pembayaran
  const [nfcEnabled, setNfcEnabled] = useState(false); // useState(false) membuat state boolean; false berarti NFC dianggap tidak aktif sampai dicek; setNfcEnabled digunakan untuk memperbarui hasil cek

  // STATE 2: amount - Nominal pembayaran yang diinput user
  // Format string dengan separator: "50.000" (bukan 50000)
  const [amount, setAmount] = useState(''); // const membuat variabel tetap; useState('') membuat state string kosong; amount menyimpan teks nominal yang diinput user; setAmount memperbarui state

  // STATE 3: currentBalance - Saldo pembeli saat ini (dari backend)
  // Diinisialisasi dari prop user.balance, lalu diperbarui via fetchBalance()
  const [currentBalance, setCurrentBalance] = useState(user?.balance || 0); // optional chaining (?.) aman jika user null; || 0 fallback jika balance tidak ada; setCurrentBalance memperbarui saldo yang ditampilkan di layar

  // STATE 4: merchant - Info merchant penerima pembayaran
  // Defaultnya adalah user sendiri (nama + tipe toko)
  const [merchant, setMerchant] = useState({ name: user?.name || 'Merchant', type: 'Toko Retail' }); // useState menerima objek sebagai nilai awal; objek shorthand dengan dua property: name (nama merchant) dan type (jenis toko)

  // STATE 5: scanning - Kontrol visibilitas Modal scan NFC
  // true = Modal scan tampil (sedang proses tap kartu)
  // false = Modal tersembunyi
  const [scanning, setScanning] = useState(false); // useState(false) nilai awal boolean false; scanning=true menampilkan Modal overlay saat proses scan NFC berlangsung

  // Ambil fungsi & state dari custom hook usePayment
  // isProcessing: boolean - apakah sedang memproses pembayaran
  // processTapToPayTransfer: fungsi utama pembayaran NFC
  const { isProcessing, processTapToPayTransfer } = usePayment(); // const membuat variabel tetap; destructuring {} mengambil dua property dari objek yang dikembalikan hook usePayment; isProcessing adalah boolean status proses; processTapToPayTransfer adalah fungsi utama pembayaran

  // useEffect: Dijalankan 1x saat komponen pertama kali mount
  // Tujuan: Inisialisasi NFC hardware dan bersihkan listener saat unmount
  useEffect(() => { // useEffect(callback, deps) menjalankan efek samping; tanpa deps array bawaan di sini deps [] ada di bawah
    checkNFC(); // memanggil checkNFC() untuk mendeteksi status hardware NFC saat screen pertama kali dibuka
    return () => { // return function adalah cleanup — dijalankan saat komponen di-unmount
      NFCService.cleanup(); // melepas resource NFC agar tidak memory leak saat layar ditutup
    };
  }, []); // [] array kosong berarti efek ini hanya berjalan SEKALI saat mount

  // Fungsi: Inisialisasi NFC hardware dan cek apakah NFC aktif
  const checkNFC = async () => { // async karena mengakses hardware NFC yang membutuhkan waktu
    const supported = await NFCService.initNFC(); // await menunggu inisialisasi NFC; mengembalikan true jika device mendukung NFC
    if (!supported) return; // return menghentikan fungsi lebih awal jika NFC tidak didukung
    const enabled = await NFCService.checkNFCEnabled(); // await mengecek apakah user sudah mengaktifkan NFC di pengaturan
    setNfcEnabled(enabled); // setNfcEnabled memperbarui state; true = tampilkan form, false = tampilkan instruksi
  };

  // Fungsi: Ambil saldo terbaru user dari backend API
  // Dipanggil setelah transaksi berhasil untuk refresh tampilan saldo
  const fetchBalance = async () => { // async karena melakukan HTTP request ke backend API
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      const resp = await apiService.getUserById(user.id); // await menunggu respons GET /api/users/:id dari backend
      const bal = resp?.user?.balance ?? resp?.balance; // optional chaining (?.) untuk akses property aman; ?? (nullish coalescing) menggunakan nilai kanan hanya jika kiri null/undefined
      if (typeof bal === 'number') { // typeof === 'number' memastikan tipe data angka sebelum di-set ke state
        setCurrentBalance(bal); // setCurrentBalance memperbarui state saldo dengan nilai terbaru dari backend
      }
    } catch (error: any) { // catch menangkap error; : any agar TypeScript tidak strict tentang tipe error
      console.error('❌ Failed to refresh balance:', error?.message || error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
    }
  };

  // Fungsi: Handler utama saat tombol "Lanjutkan Scan" ditekan
  // Validasi input → buka modal scan → proses pembayaran via usePayment hook
  const handleStartScan = async () => { // const membuat variabel tetap; async karena proses NFC dan HTTP request memerlukan await
    if (!user?.id) { // optional chaining (?.) aman jika user null; ! membalik boolean — stop jika tidak ada user valid
      Alert.alert('Error', 'User tidak valid'); // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
    }

    const raw = amount.replace(/[^0-9]/g, ''); // .replace() mengganti teks; regex /[^0-9]/g mencocokkan semua karakter non-angka; 'g' = global (semua kemunculan); hasilnya hanya digit
    const amountNum = parseFloat(raw); // parseFloat() mengubah string ke bilangan desimal
    if (!amountNum || amountNum <= 0) { // !amountNum berarti NaN/0/null; amountNum <= 0 berarti angka tidak valid
      Alert.alert('Error', 'Masukkan jumlah yang valid'); // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
    }

    setScanning(true); // setScanning(true) menampilkan Modal overlay scan NFC
    const success = await processTapToPayTransfer(user.id, amountNum, fetchBalance); // await menunggu seluruh proses: scan kartu NFC → validasi kartu di backend → transfer saldo → deteksi fraud Z-Score; mengembalikan true jika berhasil
    setScanning(false); // setScanning(false) menyembunyikan Modal overlay setelah proses selesai

    if (success) setAmount(''); // jika transaksi berhasil, kosongkan input untuk transaksi berikutnya
  };

  const formatNumber = (text: string) => { // arrow function menerima string dan mengembalikan string terformat
    const digits = text.replace(/[^0-9]/g, ''); // .replace dengan regex menghapus semua karakter non-angka dari input
    const num = parseInt(digits || '0'); // parseInt() mengubah string ke bilangan bulat; || '0' fallback jika digits kosong
    return new Intl.NumberFormat('id-ID').format(num); // Intl.NumberFormat('id-ID') memformat angka dengan titik sebagai separator ribuan Indonesia
  };

  const handleAmountChange = (text: string) => { // arrow function dipanggil setiap user mengetik nominal
    setAmount(formatNumber(text)); // setAmount memperbarui state dengan nilai yang sudah diformat
  };

  // ============================================================
  // RENDER KONDISIONAL: NFC Tidak Aktif
  // ============================================================
  // Jika NFC belum diaktifkan user, tampilkan screen instruksi
  // User harus ke Settings → aktifkan NFC → kembali ke app
  if (!nfcEnabled) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
    return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
      <SafeAreaView style={styles.container}> {/* SafeAreaView: padding aman dari notch */}
        <View style={styles.header}> {/* View header: tombol kembali dan judul */}
          <TouchableOpacity onPress={onBack} style={styles.backButton}> {/* tombol kembali */}
            <Text style={styles.backIcon}>←</Text> {/* ikon panah kiri */}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pembayaran NFC</Text> {/* judul screen */}
          <View style={styles.headerSpacer} /> {/* spacer keseimbangan */}
        </View>
        <View style={styles.centerContent}> {/* View konten tengah layar NFC disabled */}
          <Text style={styles.errorIcon}>📡</Text> {/* ikon sinyal NFC error */}
          <Text style={styles.errorTitle}>NFC Tidak Aktif</Text> {/* judul error */}
          <Text style={styles.errorText}>Aktifkan NFC untuk melakukan pembayaran</Text> {/* pesan error */}
          <View style={styles.instructionCard}> {/* View kartu instruksi */}
            <Text style={styles.instructionTitle}>Cara Mengaktifkan NFC:</Text> {/* judul instruksi */}
            <Text style={styles.instructionItem}>1. Buka Pengaturan</Text> {/* langkah 1 */}
            <Text style={styles.instructionItem}>2. Pilih Koneksi / Wireless &amp; Networks</Text> {/* langkah 2 */}
            <Text style={styles.instructionItem}>3. Aktifkan NFC</Text> {/* langkah 3 */}
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={checkNFC}> {/* tombol coba lagi: memanggil checkNFC() ulang */}
            <Text style={styles.retryButtonText}>Coba Lagi</Text> {/* label tombol */}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // RENDER UTAMA: Form Pembayaran NFC (NFC aktif)
  // ============================================================
  return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
    <SafeAreaView style={styles.container}> {/* SafeAreaView: padding aman dari notch dan status bar */}
      <View style={styles.header}> {/* View header: tombol kembali dan judul */}
        <TouchableOpacity onPress={onBack} style={styles.backButton}> {/* tombol kembali ke DashboardScreen */}
          <Text style={styles.backIcon}>←</Text> {/* ikon panah kiri */}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pembayaran NFC</Text> {/* judul screen */}
        <View style={styles.headerSpacer} /> {/* spacer keseimbangan layout */}
      </View>

      <View style={styles.content}> {/* View konten utama: info merchant, input nominal, keypad */}
        <View style={styles.section}> {/* View section info penerima */}
          <Text style={styles.sectionLabel}>Penerima</Text> {/* label section */}
          <View style={styles.merchantCard}> {/* View kartu info merchant */}
            <View style={styles.merchantIcon}> {/* View container ikon merchant */}
              <Text style={styles.merchantIconText}>🏪</Text> {/* ikon toko merchant */}
            </View>
            <View style={styles.merchantInfo}> {/* View kolom nama dan tipe merchant */}
              <Text style={styles.merchantName}>{merchant.name}</Text> {/* nama merchant/penerima */}
              <Text style={styles.merchantType}>{merchant.type}</Text> {/* tipe merchant (Toko Retail) */}
            </View>
            <TouchableOpacity> {/* tombol placeholder untuk navigasi detail merchant */}
              <Text style={styles.chevron}>→</Text> {/* ikon panah kanan */}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.section}> {/* View section input nominal */}
          <Text style={styles.sectionLabel}>Nominal Pembayaran</Text> {/* label section */}
          <View style={styles.amountContainer}> {/* View baris: prefix Rp + input nominal */}
            <Text style={styles.currencySymbol}>Rp</Text> {/* prefix mata uang Rupiah */}
            <TextInput // TextInput: kolom input teks; setara dengan input di HTML; mendukung keyboard native
              style={styles.amountInput} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
              value={amount}           // Nilai dari state (format: "50.000")
              onChangeText={handleAmountChange} // Handler format otomatis
              placeholder="0" // placeholder: teks abu-abu yang ditampilkan dalam TextInput saat belum ada input dari user
              placeholderTextColor="#cbd5e1" // placeholderTextColor: warna teks placeholder; biasanya abu-abu agar kontras dengan teks input normal
              keyboardType="numeric"  // Tampilkan keyboard numerik native
            />
          </View>
        </View>

        <View style={styles.keypad}>
          {[
            ['1', '2', '3'], // baris keypad atas: angka 1, 2, 3; membuat keypad numerik 4x3 seperti kalkulator atau PIN pad
            ['4', '5', '6'], // baris keypad tengah atas: angka 4, 5, 6 pada keypad numerik custom
            ['7', '8', '9'], // baris keypad tengah bawah: angka 7, 8, 9 pada keypad numerik custom
            ['.', '0', '⌫'] // baris keypad bawah: titik desimal, angka 0, dan tombol hapus (⌫) untuk input nominal
          ].map((row, rowIndex) => ( // .map() iterasi setiap baris keypad; rowIndex digunakan sebagai key prop untuk React
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key) => ( // .map() iterasi setiap tombol dalam satu baris keypad; key adalah karakter tombol (1-9, '.', '⌫')
                <TouchableOpacity // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
                  key={key} // key={key} prop unik untuk setiap elemen dalam list; React membutuhkan key untuk optimasi rendering
                  style={styles.keypadButton} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
                  onPress={() => { // onPress dipanggil saat user menekan elemen; menghubungkan event ke fungsi handler
                    if (key === '⌫') { // memeriksa apakah tombol yang ditekan adalah tombol hapus (⌫/backspace)
                      // Hapus 1 karakter terakhir dari input
                      setAmount(amount.slice(0, -1)); // slice(0,-1) menghapus karakter terakhir dari string amount; efek tombol backspace/hapus
                    } else if (key === '.') { // else if: kondisi alternatif yang diperiksa jika kondisi if sebelumnya tidak terpenuhi
                      // Ignore decimal for now (tidak support pecahan)
                    } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
                      // Tambahkan digit ke input dan format ulang
                      handleAmountChange(amount + key); // menambahkan karakter yang ditekan ke string amount; membangun nominal satu karakter per tekan
                    }
                  }}
                >
                  <Text style={styles.keypadButtonText}>{key}</Text>
                  {key === '2' && <Text style={styles.keypadSubText}>ABC</Text>}
                  {key === '3' && <Text style={styles.keypadSubText}>DEF</Text>}
                  {key === '4' && <Text style={styles.keypadSubText}>GHI</Text>}
                  {key === '5' && <Text style={styles.keypadSubText}>JKL</Text>}
                  {key === '6' && <Text style={styles.keypadSubText}>MNO</Text>}
                  {key === '7' && <Text style={styles.keypadSubText}>PQRS</Text>}
                  {key === '8' && <Text style={styles.keypadSubText}>TUV</Text>}
                  {key === '9' && <Text style={styles.keypadSubText}>WXYZ</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity  // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
          style={[styles.scanButton, (!amount || isProcessing) && styles.scanButtonDisabled]} // style={} prop untuk menerapkan styling ke elemen React Native
          onPress={handleStartScan} // onPress dipanggil saat user menekan elemen; menghubungkan event ke fungsi handler
          disabled={!amount || isProcessing} // disabled: jika true tombol tidak bisa ditekan; digunakan saat loading atau form belum lengkap
        >
          {isProcessing ? ( // ternary JSX: jika isProcessing=true tampilkan spinner, jika false tampilkan teks tombol normal
            <ActivityIndicator color="#fff" />
          ) : ( // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
            <Text style={styles.scanButtonText}>Lanjutkan Scan</Text>
          )}
        </TouchableOpacity>
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🛡️</Text>
          <Text style={styles.securityText}>Transaksi aman dengan deteksi fraud</Text>
        </View>
      </View>

      <Modal visible={scanning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.scanningCard}>
              <Text style={styles.scanningIcon}>📲</Text>
              <Text style={styles.scanningTitle}>Scan Kartu NFC</Text>
              <Text style={styles.scanningSubtitle}>Tempelkan kartu NFC pembeli ke perangkat</Text>
              
              <View style={styles.scanningAnimation}>
                <View style={styles.nfcCardVisual}>
                  <Text style={styles.nfcCardIcon}>💳</Text>
                  <Text style={styles.nfcWaves}>)))</Text>
                </View>
              </View>

              <View style={styles.scanningInfo}>
                <Text style={styles.scanningWaiting}>⚡ Menunggu kartu...</Text>
              </View>

              <Text style={styles.transactionAmount}>Nominal Transaksi</Text>
              <Text style={styles.transactionAmountValue}>Rp{amount}</Text>

              <View style={styles.infoBox}> {/* View kotak info panduan NFC */}
                <Text style={styles.infoIcon}>ℹ️</Text> {/* ikon informasi */}
                <Text style={styles.infoText}> {/* teks panduan jarak kartu */}
                  Pastikan kartu mendukung NFC dan dalam jarak dekat dengan perangkat.
                </Text>
              </View>

              <TouchableOpacity  // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
                style={styles.cancelButton} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
                onPress={() => setScanning(false)} // onPress dipanggil saat user menekan elemen; menutup modal scan
              >
                <Text style={styles.cancelButtonText}>Batalkan</Text> {/* label tombol batalkan */}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal> {/* penutup Modal scan NFC */}
    </SafeAreaView>
  );
}