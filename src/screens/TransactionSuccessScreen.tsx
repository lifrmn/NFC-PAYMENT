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
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View,              // View adalah komponen container dasar React Native \u2014 setara div di HTML; digunakan untuk layout dan pembungkus elemen
  Text,              // Text menampilkan konten teks \u2014 semua teks wajib dibungkus Text di React Native
  TouchableOpacity,  // TouchableOpacity adalah tombol interaktif dengan efek transparan saat ditekan \u2014 digunakan untuk tombol "Selesai" dan "Lihat Detail"
  ScrollView         // ScrollView memungkinkan konten di-scroll jika melebihi tinggi layar \u2014 penting karena detail transaksi bisa panjang
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home indicator Android
import styles from './TransactionSuccessScreen.styles'; // import stylesheet dari file terpisah agar kode komponen tetap ringkas dan mudah dibaca

// Interface TypeScript untuk mendefinisikan tipe props yang diterima komponen
interface TransactionSuccessScreenProps { // interface adalah blueprint TypeScript — mendefinisikan struktur objek props sehingga TypeScript bisa mendeteksi jika ada props yang salah tipe
  transaction: { // props transaction adalah objek berisi detail transaksi yang sudah selesai diproses
    amount: number;            // Nominal transaksi dalam Rupiah (contoh: 50000)
    senderName: string;        // Nama pengirim (pembeli yang tap kartu)
    senderCardId: string;      // UID kartu pengirim — akan di-mask sebagian untuk keamanan tampilan
    receiverName: string;      // Nama penerima (merchant yang terima pembayaran)
    receiverCardId: string;    // UID kartu penerima — juga di-mask untuk keamanan
    senderBalance: number;     // Saldo pengirim SETELAH transaksi berhasil dipotong
    receiverBalance: number;   // Saldo penerima SETELAH transaksi berhasil ditambah
    riskScore: number | null;  // Nilai Z-Score aktual hasil perhitungan; null jika σ=0 dan X≠μ (kasus distribusi terdegenerasi)
    riskLevel: string;         // Kategori risiko: NORMAL | SUSPICIOUS | ANOMALY berdasarkan threshold Z-Score
    decision?: string;         // tanda ? berarti opsional; nilai: ALLOW | REVIEW | BLOCK sesuai keputusan fraud detection
    zScore?: number | null;    // Alias dari riskScore; tanda ? berarti opsional — untuk konsistensi response backend
  };
  onDone: () => void;          // callback function () => void — dipanggil saat user menekan tombol "Selesai"; biasanya menutup screen ini dan kembali ke Dashboard
  onViewDetails?: () => void;  // tanda ? berarti opsional — callback untuk menampilkan detail transaksi lebih lengkap jika diimplementasikan
}

// Komponen utama TransactionSuccessScreen
export default function TransactionSuccessScreen({ // export default mengekspor komponen sebagai ekspor utama file; function TransactionSuccessScreen menerima tiga props
  transaction, // destructuring: mengambil props transaction (objek detail transaksi) dari parent component
  onDone,      // destructuring: mengambil callback onDone (fungsi yang dipanggil saat user selesai melihat layar ini)
  onViewDetails, // destructuring: mengambil callback opsional onViewDetails
}: TransactionSuccessScreenProps) { // : TransactionSuccessScreenProps adalah type annotation TypeScript — memastikan props sesuai interface yang didefinisikan di atas

  // Fungsi: Format angka ke format mata uang Rupiah Indonesia
  // Contoh: 50000 → "Rp 50.000"
  const formatCurrency = (amount: number) => { // const membuat variabel tetap; arrow function (amount: number) => {...} menerima angka dan mengembalikan string format Rupiah
    return new Intl.NumberFormat('id-ID', { // new membuat instance Intl.NumberFormat; 'id-ID' adalah locale Indonesia untuk format angka (titik sebagai pemisah ribuan)
      style: 'currency',          // style: 'currency' memberi tahu Intl bahwa ini format mata uang
      currency: 'IDR',            // currency: 'IDR' adalah kode mata uang Indonesian Rupiah
      minimumFractionDigits: 0,   // 0 berarti tidak ada angka desimal — Rp 50.000, bukan Rp 50.000,00
    }).format(amount); // .format(amount) menjalankan format aktual pada nilai angka dan mengembalikan string
  };

  // Fungsi: Tentukan warna badge berdasarkan level risiko Z-Score
  // NORMAL → hijau, SUSPICIOUS → kuning, ANOMALY → merah
  const getRiskColor = (level: string) => { // arrow function yang menerima string level dan mengembalikan kode warna hex
    switch (level.toUpperCase()) { // switch membandingkan satu nilai dengan banyak case; .toUpperCase() mengonversi ke huruf besar agar perbandingan tidak case-sensitive
      case 'NORMAL': // case NORMAL: transaksi normal; skor risiko Z-score ≤ 2; diklasifikasikan aman
        return '#10B981'; // return mengembalikan nilai dari fungsi; warna hijau emerald — Z-Score ≤ 2, transaksi aman
      case 'SUSPICIOUS': // case SUSPICIOUS: transaksi mencurigakan; skor risiko Z-score 2-3; perlu ditinjau
        return '#F59E0B'; // warna kuning amber — 2 < Z-Score ≤ 3, perlu ditinjau admin
      case 'ANOMALY': // case ANOMALY: transaksi anomali; skor risiko Z-score > 3; diblokir sistem fraud detection
        return '#EF4444'; // warna merah — Z-Score > 3, anomali terdeteksi, diperlukan tindakan
      default: // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
        return '#64748b'; // warna abu-abu — level tidak dikenali atau belum terdefinisi
    }
  };

  // Fungsi: Dapatkan label teks untuk badge level risiko
  // Mengonversi kode risiko menjadi teks yang ditampilkan di UI
  const getRiskLabel = (level: string) => { // arrow function menerima string level dan mengembalikan label teks yang ramah pengguna
    switch (level.toUpperCase()) { // .toUpperCase() memastikan perbandingan tidak terpengaruh huruf besar/kecil
      case 'NORMAL': // case NORMAL: transaksi normal; skor risiko Z-score ≤ 2; diklasifikasikan aman
        return 'NORMAL';      // Tampilkan teks "NORMAL"
      case 'SUSPICIOUS': // case SUSPICIOUS: transaksi mencurigakan; skor risiko Z-score 2-3; perlu ditinjau
        return 'SUSPICIOUS';  // Tampilkan teks "SUSPICIOUS"
      case 'ANOMALY': // case ANOMALY: transaksi anomali; skor risiko Z-score > 3; diblokir sistem fraud detection
        return 'ANOMALY';     // Tampilkan teks "ANOMALY"
      default: // default: nilai kembalian jika tidak ada case yang cocok; nilai fallback untuk case yang tidak terdefinisi
        return level; // Gunakan nilai asli jika tidak cocok
    }
  };

  // Fungsi: Sensor/masking UID kartu untuk keamanan dan privasi
  // Contoh: "04AB1234567890" → "04AB •••• •••• 7890"
  const maskCardId = (cardId: string) => { // const membuat variabel tetap; arrow function menerima UID kartu sebagai string dan mengembalikan versi yang di-sensor
    if (cardId.length <= 8) return cardId; // .length mengembalikan jumlah karakter; <= berarti kurang dari atau sama; jika UID pendek, tampilkan apa adanya
    return cardId.substring(0, 4) + ' •••• •••• ' + cardId.substring(cardId.length - 4); // .substring(start, end) mengambil sebagian string; 0,4 mengambil 4 karakter pertama; cardId.length-4 menghitung posisi 4 karakter terakhir
  };

  // Render UI komponen sukses transaksi
  return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
    <SafeAreaView style={styles.container}> {/* SafeAreaView: padding aman dari notch dan status bar */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}> {/* ScrollView: konten bisa di-scroll; menampilkan scrollbar vertikal disembunyikan */}
        <View style={styles.content}> {/* View konten utama dengan padding */}
          {/* ✅ DIPERBAIKI: Literal \n dihapus — \n di antara elemen JSX dianggap teks oleh React Native */}
          <View style={styles.successIcon}> {/* View container ikon centang sukses di tengah atas */}
            <View style={styles.checkmarkCircle}> {/* View lingkaran hijau berisi centang */}
              <Text style={styles.checkmark}>✓</Text> {/* teks centang putih di tengah lingkaran */}
            </View>
          </View>
          <Text style={styles.title}>Transaksi Berhasil</Text> {/* judul utama layar sukses */}
          <Text style={styles.subtitle}> {/* teks deskripsi singkat di bawah judul */}
            Pembayaran NFC telah berhasil diproses
          </Text>
          <View style={styles.amountCard}> {/* View kartu putih menampilkan nominal transaksi */}
            <Text style={styles.amountLabel}>Nominal</Text> {/* label teks "Nominal" */}
            <Text style={styles.amount}>{formatCurrency(transaction.amount)}</Text> {/* angka nominal diformat Rupiah */}
          </View>
          <View style={styles.detailsCard}> {/* View kartu putih berisi detail pengirim dan penerima */}
            {/* ✅ DIPERBAIKI: Literal \n dihapus — penghapusan mencegah error 'Text strings must be rendered within a <Text>' */}
            <View style={styles.detailSection}> {/* View section detail pengirim */}
              <View style={styles.detailHeader}> {/* View header section berisi ikon dan label */}
                <Text style={styles.detailHeaderIcon}>👤</Text> {/* ikon user pengirim */}
                <Text style={styles.detailHeaderText}>Dari (Pengirim)</Text> {/* label header pengirim */}
              </View>
              <View style={styles.detailContent}> {/* View kolom detail pengirim */}
                <Text style={styles.detailName}>{transaction.senderName}</Text> {/* nama pengirim */}
                <Text style={styles.detailLabel}>Kartu Pengirim</Text> {/* label kartu pengirim */}
                <Text style={styles.detailValue}>{maskCardId(transaction.senderCardId)}</Text> {/* UID kartu pengirim yang di-mask */}
                <Text style={styles.detailLabel}>Saldo Pengirim</Text> {/* label saldo pengirim */}
                <Text style={[styles.detailValue, styles.balanceValue]}> {/* saldo pengirim setelah transaksi */}
                  {formatCurrency(transaction.senderBalance)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} /> {/* View garis pemisah antara section pengirim dan penerima */}
            {/* ✅ DIPERBAIKI: Literal \n setelah self-closing tag dihapus — React Native tidak bisa render string mentah di luar <Text> */}
            <View style={styles.detailSection}> {/* View section detail penerima */}
              <View style={styles.detailHeader}> {/* View header section penerima */}
                <Text style={styles.detailHeaderIcon}>👥</Text> {/* ikon user penerima */}
                <Text style={styles.detailHeaderText}>Ke (Penerima)</Text> {/* label header penerima */}
              </View>
              <View style={styles.detailContent}> {/* View kolom detail penerima */}
                <Text style={styles.detailName}>{transaction.receiverName}</Text> {/* nama penerima */}
                <Text style={styles.detailLabel}>Kartu Penerima</Text> {/* label kartu penerima */}
                <Text style={styles.detailValue}>{maskCardId(transaction.receiverCardId)}</Text> {/* UID kartu penerima yang di-mask */}
                <Text style={styles.detailLabel}>Penerima bertambah</Text> {/* label saldo tambah penerima */}
                <Text style={[styles.detailValue, styles.positiveAmount]}> {/* jumlah yang diterima; warna hijau */}
                  +{formatCurrency(transaction.amount)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.riskCard}> {/* View kartu hasil Z-Score Anomaly Detection */}
            <View style={styles.riskHeader}> {/* View header kartu risiko: ikon perisai + judul */}
              <Text style={styles.riskIcon}>🛡️</Text> {/* ikon perisai keamanan */}
              <View style={styles.riskHeaderText}> {/* View teks header risiko */}
                <Text style={styles.riskTitle}>Z-Score Anomaly Detection</Text> {/* judul section deteksi fraud */}
              </View>
            </View>
            <View style={styles.riskContent}> {/* View konten detail Z-Score */}
              {/* ✅ DIPERBAIKI: Literal \n dihapus — komentar JSX pakai {/* */} bukan // agar tidak menjadi teks */}
              <View style={styles.riskScoreRow}>
                <Text style={styles.riskScoreLabel}>Z-Score:</Text>
                <Text style={styles.riskScoreValue}>
                  {transaction.riskScore === null || transaction.riskScore === undefined // memeriksa apakah riskScore null atau undefined sebelum menampilkan; mencegah tampilan 'null' di UI
                    ? 'null (σ=0, X≠μ)' // Kasus khusus: standar deviasi = 0
                    : typeof transaction.riskScore === 'number' // jika riskScore bertipe number, gunakan toFixed(2) untuk format 2 desimal
                    ? transaction.riskScore.toFixed(4) // Tampilkan Z-Score dengan 4 desimal
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
                  style={[ // style={} prop untuk menerapkan styling ke elemen React Native
                    styles.riskLevelBadge, // riskLevelBadge memberikan style dasar badge level risiko; warna ditambah via style prop berikutnya
                    { backgroundColor: `${getRiskColor(transaction.riskLevel)}20` }, // Warna latar badge dengan opacity 20%
                  ]}
                >
                  <View // View: komponen container di React Native setara dengan div di HTML; digunakan untuk mengelompokkan elemen
                    style={[ // style={} prop untuk menerapkan styling ke elemen React Native
                      styles.riskLevelDot, // riskLevelDot memberikan style untuk titik indikator dalam badge level risiko
                      { backgroundColor: getRiskColor(transaction.riskLevel) }, // Titik indikator warna penuh
                    ]}
                  />
                  <Text // Text: komponen untuk menampilkan teks di layar; setara dengan p/span di HTML
                    style={[ // style={} prop untuk menerapkan styling ke elemen React Native
                      styles.riskLevelText, // riskLevelText memberikan style dasar teks dalam badge level risiko
                      { color: getRiskColor(transaction.riskLevel) }, // Teks berwarna sesuai level risiko
                    ]}
                  >
                    {getRiskLabel(transaction.riskLevel)} {/* teks level risiko dikonversi dari kode ke bahasa Indonesia */}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.actions}> {/* View container tombol aksi di bagian bawah screen */}
            <TouchableOpacity style={styles.primaryButton} onPress={onDone}> {/* tombol Selesai; onPress memanggil callback onDone untuk kembali ke Dashboard */}
              <Text style={styles.primaryButtonText}>Selesai</Text> {/* teks label tombol utama */}
            </TouchableOpacity>
            {onViewDetails && ( // Tampilkan tombol detail hanya jika callback diberikan
              <TouchableOpacity style={styles.secondaryButton} onPress={onViewDetails}> {/* tombol sekunder Lihat Detail; hanya tampil jika callback onViewDetails tersedia */}
                <Text style={styles.secondaryButtonText}>Lihat Detail</Text> {/* teks label tombol sekunder */}
              </TouchableOpacity>
            )}
          </View>
        </View> {/* penutup View styles.content */}
      </ScrollView> {/* penutup ScrollView */}
    </SafeAreaView> {/* penutup SafeAreaView */}
  );
}