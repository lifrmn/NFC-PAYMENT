// src/screens/TransactionSuccessScreen.tsx
// ==================================================================================
// ✅ SCREEN: TransactionSuccessScreen
// ==================================================================================
//
// Purpose:
// Screen yang ditampilkan setelah transaksi NFC berhasil diproses.
// Menampilkan detail transaksi: nominal, pengirim, penerima, dan hasil Z-Score.
//
// Props:
// - transaction: object berisi detail transaksi (amount, sender, receiver, z-score)
// - onDone: Callback saat user tap tombol "Selesai"
// - onViewDetails: Callback opsional untuk tombol "Lihat Detail"
// ==================================================================================
import React from 'react'; // import React digunakan untuk semua file JSX/TSX; React.createElement dijalankan di balik layar setiap kali ada elemen JSX seperti <View>
// import React digunakan untuk semua file JSX/TSX; React.createElement dijalankan di balik layar setiap kali ada elemen JSX seperti <View>
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View, // View adalah komponen container dasar React Native \u2014 setara div di HTML; digunakan untuk layout dan pembungkus elemen
  // View adalah komponen container dasar React Native \u2014 setara div di HTML; digunakan untuk layout dan pembungkus elemen
  Text, // Text menampilkan konten teks \u2014 semua teks wajib dibungkus Text di React Native
  // Text menampilkan konten teks \u2014 semua teks wajib dibungkus Text di React Native
  TouchableOpacity, // TouchableOpacity adalah tombol interaktif dengan efek transparan saat ditekan \u2014 digunakan untuk tombol "Selesai" dan "Lihat Detail"
  // TouchableOpacity adalah tombol interaktif dengan efek transparan saat ditekan \u2014 digunakan untuk tombol "Selesai" dan "Lihat Detail"
  ScrollView // ScrollView memungkinkan konten di-scroll jika melebihi tinggi layar \u2014 penting karena detail transaksi bisa panjang
  // ScrollView memungkinkan konten di-scroll jika melebihi tinggi layar \u2014 penting karena detail transaksi bisa panjang
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI native
// menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home indicator Android
// SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home indicator Android
import styles from './TransactionSuccessScreen.styles'; // import stylesheet dari file terpisah agar kode komponen tetap ringkas dan mudah dibaca
// import stylesheet dari file terpisah agar kode komponen tetap ringkas dan mudah dibaca

// Interface TypeScript untuk mendefinisikan tipe props yang diterima komponen
interface TransactionSuccessScreenProps { // interface adalah blueprint TypeScript — mendefinisikan struktur objek props sehingga TypeScript bisa mendeteksi jika ada props yang salah tipe
  // interface adalah blueprint TypeScript — mendefinisikan struktur objek props sehingga TypeScript bisa mendeteksi jika ada props yang salah tipe
  transaction: { // props transaction adalah objek berisi detail transaksi yang sudah selesai diproses
    // props transaction adalah objek berisi detail transaksi yang sudah selesai diproses
    amount: number; // Nominal transaksi dalam Rupiah (contoh: 50000)
    // Nominal transaksi dalam Rupiah (contoh: 50000)
    senderName: string; // Nama pengirim (pembeli yang tap kartu)
    // Nama pengirim (pembeli yang tap kartu)
    senderCardId: string; // UID kartu pengirim — akan di-mask sebagian untuk keamanan tampilan
    // UID kartu pengirim — akan di-mask sebagian untuk keamanan tampilan
    receiverName: string; // Nama penerima (merchant yang terima pembayaran)
    // Nama penerima (merchant yang terima pembayaran)
    receiverCardId: string; // UID kartu penerima — juga di-mask untuk keamanan
    // UID kartu penerima — juga di-mask untuk keamanan
    senderBalance: number; // Saldo pengirim SETELAH transaksi berhasil dipotong
    // Saldo pengirim SETELAH transaksi berhasil dipotong
    receiverBalance: number; // Saldo penerima SETELAH transaksi berhasil ditambah
    // Saldo penerima SETELAH transaksi berhasil ditambah
    riskScore: number | null; // Nilai Z-Score aktual hasil perhitungan; null jika σ=0 dan X≠μ (kasus distribusi terdegenerasi)
    // Nilai Z-Score aktual hasil perhitungan; null jika σ=0 dan X≠μ (kasus distribusi terdegenerasi)
    riskLevel: string; // Kategori risiko: NORMAL | SUSPICIOUS | ANOMALY berdasarkan threshold Z-Score
    // Kategori risiko: NORMAL | SUSPICIOUS | ANOMALY berdasarkan threshold Z-Score
    decision?: string; // tanda ? berarti opsional; nilai: ALLOW | REVIEW | BLOCK sesuai keputusan fraud detection
    // tanda ? berarti opsional; nilai: ALLOW | REVIEW | BLOCK sesuai keputusan fraud detection
    zScore?: number | null; // Alias dari riskScore; tanda ? berarti opsional — untuk konsistensi response backend
    // Alias dari riskScore; tanda ? berarti opsional — untuk konsistensi response backend
  };
  onDone: () => void; // callback function () => void — dipanggil saat user menekan tombol "Selesai"; biasanya menutup screen ini dan kembali ke Dashboard
  // callback function () => void — dipanggil saat user menekan tombol "Selesai"; biasanya menutup screen ini dan kembali ke Dashboard
  onViewDetails?: () => void; // tanda ? berarti opsional — callback untuk menampilkan detail transaksi lebih lengkap jika diimplementasikan
  // tanda ? berarti opsional — callback untuk menampilkan detail transaksi lebih lengkap jika diimplementasikan
}

// Komponen utama TransactionSuccessScreen
export default function TransactionSuccessScreen({ // export default mengekspor komponen sebagai ekspor utama file; function TransactionSuccessScreen menerima tiga props
  // export default mengekspor komponen sebagai ekspor utama file; function TransactionSuccessScreen menerima tiga props
  transaction, // destructuring: mengambil props transaction (objek detail transaksi) dari parent component
  // destructuring: mengambil props transaction (objek detail transaksi) dari parent component
  onDone, // destructuring: mengambil callback onDone (fungsi yang dipanggil saat user selesai melihat layar ini)
  // destructuring: mengambil callback onDone (fungsi yang dipanggil saat user selesai melihat layar ini)
  onViewDetails, // destructuring: mengambil callback opsional onViewDetails
  // destructuring: mengambil callback opsional onViewDetails
}: TransactionSuccessScreenProps) { // : TransactionSuccessScreenProps adalah type annotation TypeScript — memastikan props sesuai interface yang didefinisikan di atas
  // : TransactionSuccessScreenProps adalah type annotation TypeScript — memastikan props sesuai interface yang didefinisikan di atas

  // Fungsi: Format angka ke format mata uang Rupiah Indonesia
  // Contoh: 50000 → "Rp 50.000"
  const formatCurrency = (amount: number) => { // const membuat variabel tetap; arrow function (amount: number) => {...} menerima angka dan mengembalikan string format Rupiah
    // const membuat variabel tetap; arrow function (amount: number) => {...} menerima angka dan mengembalikan string format Rupiah
    return new Intl.NumberFormat('id-ID', { // new membuat instance Intl.NumberFormat; 'id-ID' adalah locale Indonesia untuk format angka (titik sebagai pemisah ribuan)
      // new membuat instance Intl.NumberFormat; 'id-ID' adalah locale Indonesia untuk format angka (titik sebagai pemisah ribuan)
      style: 'currency', // style: 'currency' memberi tahu Intl bahwa ini format mata uang
      // style: 'currency' memberi tahu Intl bahwa ini format mata uang
      currency: 'IDR', // currency: 'IDR' adalah kode mata uang Indonesian Rupiah
      // currency: 'IDR' adalah kode mata uang Indonesian Rupiah
      minimumFractionDigits: 0, // 0 berarti tidak ada angka desimal — Rp 50.000, bukan Rp 50.000,00
      // 0 berarti tidak ada angka desimal — Rp 50.000, bukan Rp 50.000,00
    }).format(amount); // .format(amount) menjalankan format aktual pada nilai angka dan mengembalikan string
    // .format(amount) menjalankan format aktual pada nilai angka dan mengembalikan string
  };

  // Fungsi: Tentukan warna badge berdasarkan level risiko Z-Score
  // NORMAL → hijau, SUSPICIOUS → kuning, ANOMALY → merah
  const getRiskColor = (level: string) => { // arrow function yang menerima string level dan mengembalikan kode warna hex
    // arrow function yang menerima string level dan mengembalikan kode warna hex
    switch (level.toUpperCase()) { // switch membandingkan satu nilai dengan banyak case; .toUpperCase() mengonversi ke huruf besar agar perbandingan tidak case-sensitive
      // switch membandingkan satu nilai dengan banyak case; .toUpperCase() mengonversi ke huruf besar agar perbandingan tidak case-sensitive
      case 'NORMAL': // case NORMAL: transaksi normal; skor risiko Z-score ≤ 2; diklasifikasikan aman
        // case NORMAL: transaksi normal; skor risiko Z-score ≤ 2; diklasifikasikan aman
        return '#10B981'; // return mengembalikan nilai dari fungsi; warna hijau emerald — Z-Score ≤ 2, transaksi aman
        // return mengembalikan nilai dari fungsi; warna hijau emerald — Z-Score ≤ 2, transaksi aman
      case 'SUSPICIOUS': // case SUSPICIOUS: transaksi mencurigakan; skor risiko Z-score 2-3; perlu ditinjau
        // case SUSPICIOUS: transaksi mencurigakan; skor risiko Z-score 2-3; perlu ditinjau
        return '#F59E0B'; // warna kuning amber — 2 < Z-Score ≤ 3, perlu ditinjau admin
        // warna kuning amber — 2 < Z-Score ≤ 3, perlu ditinjau admin
      case 'ANOMALY': // case ANOMALY: transaksi anomali; skor risiko Z-score > 3; diblokir sistem fraud detection
        // case ANOMALY: transaksi anomali; skor risiko Z-score > 3; diblokir sistem fraud detection
        return '#EF4444'; // warna merah — Z-Score > 3, anomali terdeteksi, diperlukan tindakan
        // warna merah — Z-Score > 3, anomali terdeteksi, diperlukan tindakan
      default: // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
        // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
        return '#64748b'; // warna abu-abu — level tidak dikenali atau belum terdefinisi
        // warna abu-abu — level tidak dikenali atau belum terdefinisi
    }
  };

  // Fungsi: Dapatkan label teks untuk badge level risiko
  // Mengonversi kode risiko menjadi teks yang ditampilkan di UI
  const getRiskLabel = (level: string) => { // arrow function menerima string level dan mengembalikan label teks yang ramah pengguna
    // arrow function menerima string level dan mengembalikan label teks yang ramah pengguna
    switch (level.toUpperCase()) { // .toUpperCase() memastikan perbandingan tidak terpengaruh huruf besar/kecil
      // .toUpperCase() memastikan perbandingan tidak terpengaruh huruf besar/kecil
      case 'NORMAL': // case NORMAL: transaksi normal; skor risiko Z-score ≤ 2; diklasifikasikan aman
        // case NORMAL: transaksi normal; skor risiko Z-score ≤ 2; diklasifikasikan aman
        return 'NORMAL'; // Tampilkan teks "NORMAL"
        // Tampilkan teks "NORMAL"
      case 'SUSPICIOUS': // case SUSPICIOUS: transaksi mencurigakan; skor risiko Z-score 2-3; perlu ditinjau
        // case SUSPICIOUS: transaksi mencurigakan; skor risiko Z-score 2-3; perlu ditinjau
        return 'SUSPICIOUS'; // Tampilkan teks "SUSPICIOUS"
        // Tampilkan teks "SUSPICIOUS"
      case 'ANOMALY': // case ANOMALY: transaksi anomali; skor risiko Z-score > 3; diblokir sistem fraud detection
        // case ANOMALY: transaksi anomali; skor risiko Z-score > 3; diblokir sistem fraud detection
        return 'ANOMALY'; // Tampilkan teks "ANOMALY"
        // Tampilkan teks "ANOMALY"
      default: // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
        // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
        return level; // Gunakan nilai asli jika tidak cocok
        // Gunakan nilai asli jika tidak cocok
    }
  };

  // Fungsi: Sensor/masking UID kartu untuk keamanan dan privasi
  // Contoh: "04AB1234567890" → "04AB •••• •••• 7890"
  const maskCardId = (cardId: string) => { // const membuat variabel tetap; arrow function menerima UID kartu sebagai string dan mengembalikan versi yang di-sensor
    // const membuat variabel tetap; arrow function menerima UID kartu sebagai string dan mengembalikan versi yang di-sensor
    if (cardId.length <= 8) return cardId; // .length mengembalikan jumlah karakter; <= berarti kurang dari atau sama; jika UID pendek, tampilkan apa adanya
    // .length mengembalikan jumlah karakter; <= berarti kurang dari atau sama; jika UID pendek, tampilkan apa adanya
    return cardId.substring(0, 4) + ' •••• •••• ' + cardId.substring(cardId.length - 4); // .substring(start, end) mengambil sebagian string; 0,4 mengambil 4 karakter pertama; cardId.length-4 menghitung posisi 4 karakter terakhir
    // .substring(start, end) mengambil sebagian string; 0,4 mengambil 4 karakter pertama; cardId.length-4 menghitung posisi 4 karakter terakhir
  };

  // Render UI komponen sukses transaksi
  return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
  // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <View style={styles.checkmarkCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          </View>
          <Text style={styles.title}>Transaksi Berhasil</Text>
          <Text style={styles.subtitle}>
            Pembayaran NFC telah berhasil diproses
          </Text>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Nominal</Text>
            <Text style={styles.amount}>{formatCurrency(transaction.amount)}</Text>
          </View>
          <View style={styles.detailsCard}>
            <View style={styles.detailSection}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailHeaderIcon}>👤</Text>
                <Text style={styles.detailHeaderText}>Dari (Pengirim)</Text>
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailName}>{transaction.senderName}</Text>
                <Text style={styles.detailLabel}>Kartu Pengirim</Text>
                <Text style={styles.detailValue}>{maskCardId(transaction.senderCardId)}</Text>
                <Text style={styles.detailLabel}>Saldo Pengirim</Text>
                <Text style={[styles.detailValue, styles.balanceValue]}>
                  {formatCurrency(transaction.senderBalance)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.detailSection}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailHeaderIcon}>👥</Text>
                <Text style={styles.detailHeaderText}>Ke (Penerima)</Text>
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailName}>{transaction.receiverName}</Text>
                <Text style={styles.detailLabel}>Kartu Penerima</Text>
                <Text style={styles.detailValue}>{maskCardId(transaction.receiverCardId)}</Text>
                <Text style={styles.detailLabel}>Penerima bertambah</Text>
                <Text style={[styles.detailValue, styles.positiveAmount]}>
                  +{formatCurrency(transaction.amount)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.riskCard}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskIcon}>🛡️</Text>
              <View style={styles.riskHeaderText}>
                <Text style={styles.riskTitle}>Z-Score Anomaly Detection</Text>
              </View>
            </View>
            <View style={styles.riskContent}> bukan
              // agar tidak menjadi teks */}
              <View style={styles.riskScoreRow}>
                <Text style={styles.riskScoreLabel}>Z-Score:</Text>
                <Text style={styles.riskScoreValue}>
                  {transaction.riskScore === null || transaction.riskScore === undefined // memeriksa apakah riskScore null atau undefined sebelum menampilkan; mencegah tampilan 'null' di UI
                  // memeriksa apakah riskScore null atau undefined sebelum menampilkan; mencegah tampilan 'null' di UI
                    ? 'null (σ=0, X≠μ)' // Kasus khusus: standar deviasi = 0
                    // Kasus khusus: standar deviasi = 0
                    : typeof transaction.riskScore === 'number' // jika riskScore bertipe number, gunakan toFixed(2) untuk format 2 desimal
                    // jika riskScore bertipe number, gunakan toFixed(2) untuk format 2 desimal
                    ? transaction.riskScore.toFixed(4) // Tampilkan Z-Score dengan 4 desimal
                    // Tampilkan Z-Score dengan 4 desimal
                    : transaction.riskScore}
                </Text>
              </View>
              <View style={styles.riskLevelRow}>
                <Text style={styles.riskLevelLabel}>Decision:</Text>
                <Text style={[styles.riskLevelText, { color: getRiskColor(transaction.riskLevel) }]}>
                  {transaction.decision || (transaction.riskLevel === 'NORMAL' ? 'ALLOW' : transaction.riskLevel === 'SUSPICIOUS' ? 'REVIEW' : 'BLOCK')}
                </Text>
              </View>
              <View style={styles.riskLevelRow}>
                <Text style={styles.riskLevelLabel}>Risk Level:</Text>
                <View // View: komponen container di React Native setara dengan div di HTML; digunakan untuk mengelompokkan elemen
                // View: komponen container di React Native setara dengan div di HTML; digunakan untuk mengelompokkan elemen
                  style={[ // style={} prop untuk menerapkan styling ke elemen React Native
                  // style={} prop untuk menerapkan styling ke elemen React Native
                    styles.riskLevelBadge, // riskLevelBadge memberikan style dasar badge level risiko; warna ditambah via style prop berikutnya
                    // riskLevelBadge memberikan style dasar badge level risiko; warna ditambah via style prop berikutnya
                    { backgroundColor: `${getRiskColor(transaction.riskLevel)}20` }, // Warna latar badge dengan opacity 20%
                    // Warna latar badge dengan opacity 20%
                  ]}
                >
                  <View // View: komponen container di React Native setara dengan div di HTML; digunakan untuk mengelompokkan elemen
                  // View: komponen container di React Native setara dengan div di HTML; digunakan untuk mengelompokkan elemen
                    style={[ // style={} prop untuk menerapkan styling ke elemen React Native
                    // style={} prop untuk menerapkan styling ke elemen React Native
                      styles.riskLevelDot, // riskLevelDot memberikan style untuk titik indikator dalam badge level risiko
                      // riskLevelDot memberikan style untuk titik indikator dalam badge level risiko
                      { backgroundColor: getRiskColor(transaction.riskLevel) }, // Titik indikator warna penuh
                      // Titik indikator warna penuh
                    ]}
                  />
                  <Text // Text: komponen untuk menampilkan teks di layar; setara dengan p/span di HTML
                  // Text: komponen untuk menampilkan teks di layar; setara dengan p/span di HTML
                    style={[ // style={} prop untuk menerapkan styling ke elemen React Native
                    // style={} prop untuk menerapkan styling ke elemen React Native
                      styles.riskLevelText, // riskLevelText memberikan style dasar teks dalam badge level risiko
                      // riskLevelText memberikan style dasar teks dalam badge level risiko
                      { color: getRiskColor(transaction.riskLevel) }, // Teks berwarna sesuai level risiko
                      // Teks berwarna sesuai level risiko
                    ]}
                  >
                    {getRiskLabel(transaction.riskLevel)} {/* teks level risiko dikonversi dari kode ke bahasa Indonesia */}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
              <Text style={styles.primaryButtonText}>Selesai</Text>
            </TouchableOpacity>
            {onViewDetails && ( // Tampilkan tombol detail hanya jika callback diberikan
            // Tampilkan tombol detail hanya jika callback diberikan
              <TouchableOpacity style={styles.secondaryButton} onPress={onViewDetails}>
                <Text style={styles.secondaryButtonText}>Lihat Detail</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


