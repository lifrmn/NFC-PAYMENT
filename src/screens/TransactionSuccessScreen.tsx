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
import {
  View,              // View adalah komponen container dasar React Native \u2014 setara div di HTML; digunakan untuk layout dan pembungkus elemen
  Text,              // Text menampilkan konten teks \u2014 semua teks wajib dibungkus Text di React Native
  TouchableOpacity,  // TouchableOpacity adalah tombol interaktif dengan efek transparan saat ditekan \u2014 digunakan untuk tombol "Selesai" dan "Lihat Detail"
  ScrollView         // ScrollView memungkinkan konten di-scroll jika melebihi tinggi layar \u2014 penting karena detail transaksi bisa panjang
} from 'react-native';
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
      case 'NORMAL':
        return '#10B981'; // return mengembalikan nilai dari fungsi; warna hijau emerald — Z-Score ≤ 2, transaksi aman
      case 'SUSPICIOUS':
        return '#F59E0B'; // warna kuning amber — 2 < Z-Score ≤ 3, perlu ditinjau admin
      case 'ANOMALY':
        return '#EF4444'; // warna merah — Z-Score > 3, anomali terdeteksi, diperlukan tindakan
      default:
        return '#64748b'; // warna abu-abu — level tidak dikenali atau belum terdefinisi
    }
  };

  // Fungsi: Dapatkan label teks untuk badge level risiko
  // Mengonversi kode risiko menjadi teks yang ditampilkan di UI
  const getRiskLabel = (level: string) => { // arrow function menerima string level dan mengembalikan label teks yang ramah pengguna
    switch (level.toUpperCase()) { // .toUpperCase() memastikan perbandingan tidak terpengaruh huruf besar/kecil
      case 'NORMAL':
        return 'NORMAL';      // Tampilkan teks "NORMAL"
      case 'SUSPICIOUS':
        return 'SUSPICIOUS';  // Tampilkan teks "SUSPICIOUS"
      case 'ANOMALY':
        return 'ANOMALY';     // Tampilkan teks "ANOMALY"
      default:
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
  return (
    <SafeAreaView style={styles.container}> {/* Wrapper aman untuk area perangkat */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}> {/* Kontainer scrollable tanpa scrollbar */}
        <View style={styles.content}> {/* Kontainer konten utama */}

          {/* Ikon Sukses: Lingkaran dengan tanda centang */}
          <View style={styles.successIcon}> {/* Wrapper ikon sukses */}
            <View style={styles.checkmarkCircle}> {/* Lingkaran latar belakang */}
              <Text style={styles.checkmark}>✓</Text> {/* Tanda centang */}
            </View>
          </View>

          {/* Judul Sukses */}
          <Text style={styles.title}>Transaksi Berhasil</Text> {/* Teks judul utama */}
          <Text style={styles.subtitle}>
            Pembayaran NFC telah berhasil diproses {/* Teks subtitle deskripsi */}
          </Text>

          {/* Kartu Nominal: Tampilkan jumlah transaksi */}
          <View style={styles.amountCard}> {/* Kartu putih bergaya */}
            <Text style={styles.amountLabel}>Nominal</Text> {/* Label "Nominal" */}
            <Text style={styles.amount}>{formatCurrency(transaction.amount)}</Text> {/* Jumlah dalam format Rupiah */}
          </View>

          {/* Kartu Detail Transaksi: Info pengirim dan penerima */}
          <View style={styles.detailsCard}> {/* Kartu detail */}

            {/* Seksi Pengirim */}
            <View style={styles.detailSection}> {/* Seksi info pengirim */}
              <View style={styles.detailHeader}> {/* Header seksi */}
                <Text style={styles.detailHeaderIcon}>👤</Text> {/* Ikon pengirim */}
                <Text style={styles.detailHeaderText}>Dari (Pengirim)</Text> {/* Label pengirim */}
              </View>
              <View style={styles.detailContent}> {/* Isi detail pengirim */}
                <Text style={styles.detailName}>{transaction.senderName}</Text> {/* Nama pengirim */}
                <Text style={styles.detailLabel}>Kartu Pengirim</Text> {/* Label kartu */}
                <Text style={styles.detailValue}>{maskCardId(transaction.senderCardId)}</Text> {/* UID kartu yang di-mask */}
                <Text style={styles.detailLabel}>Saldo Pengirim</Text> {/* Label saldo */}
                <Text style={[styles.detailValue, styles.balanceValue]}>
                  {formatCurrency(transaction.senderBalance)} {/* Saldo pengirim setelah transaksi */}
                </Text>
              </View>
            </View>

            <View style={styles.divider} /> {/* Garis pemisah antara pengirim dan penerima */}

            {/* Seksi Penerima */}
            <View style={styles.detailSection}> {/* Seksi info penerima */}
              <View style={styles.detailHeader}> {/* Header seksi penerima */}
                <Text style={styles.detailHeaderIcon}>👥</Text> {/* Ikon penerima */}
                <Text style={styles.detailHeaderText}>Ke (Penerima)</Text> {/* Label penerima */}
              </View>
              <View style={styles.detailContent}> {/* Isi detail penerima */}
                <Text style={styles.detailName}>{transaction.receiverName}</Text> {/* Nama penerima */}
                <Text style={styles.detailLabel}>Kartu Penerima</Text> {/* Label kartu penerima */}
                <Text style={styles.detailValue}>{maskCardId(transaction.receiverCardId)}</Text> {/* UID kartu penerima yang di-mask */}
                <Text style={styles.detailLabel}>Penerima bertambah</Text> {/* Label saldo penerima */}
                <Text style={[styles.detailValue, styles.positiveAmount]}>
                  +{formatCurrency(transaction.amount)} {/* Jumlah yang diterima (dengan tanda +) */}
                </Text>
              </View>
            </View>
          </View>

          {/* Kartu Z-Score: Hasil deteksi anomali */}
          <View style={styles.riskCard}> {/* Kartu hasil fraud detection */}
            <View style={styles.riskHeader}> {/* Header kartu risiko */}
              <Text style={styles.riskIcon}>🛡️</Text> {/* Ikon perisai keamanan */}
              <View style={styles.riskHeaderText}> {/* Teks header */}
                <Text style={styles.riskTitle}>Z-Score Anomaly Detection</Text> {/* Judul deteksi anomali */}
              </View>
            </View>
            <View style={styles.riskContent}> {/* Isi detail Z-Score */}

              {/* Baris Z-Score: nilai numerik */}
              <View style={styles.riskScoreRow}> {/* Baris nilai Z-Score */}
                <Text style={styles.riskScoreLabel}>Z-Score:</Text> {/* Label "Z-Score:" */}
                <Text style={styles.riskScoreValue}>
                  {transaction.riskScore === null || transaction.riskScore === undefined
                    ? 'null (σ=0, X≠μ)' // Kasus khusus: standar deviasi = 0
                    : typeof transaction.riskScore === 'number'
                    ? transaction.riskScore.toFixed(4) // Tampilkan Z-Score dengan 4 desimal
                    : transaction.riskScore} {/* Fallback jika tipe tidak diketahui */}
                </Text>
              </View>

              {/* Baris Decision: keputusan sistem (ALLOW/REVIEW/BLOCK) */}
              <View style={styles.riskLevelRow}> {/* Baris keputusan */}
                <Text style={styles.riskLevelLabel}>Decision:</Text> {/* Label "Decision:" */}
                <Text style={[styles.riskLevelText, { color: getRiskColor(transaction.riskLevel) }]}>
                  {transaction.decision || (transaction.riskLevel === 'NORMAL' ? 'ALLOW' : transaction.riskLevel === 'SUSPICIOUS' ? 'REVIEW' : 'BLOCK')} {/* Tampilkan keputusan dengan warna sesuai level risiko */}
                </Text>
              </View>

              {/* Baris Risk Level: badge level risiko berwarna */}
              <View style={styles.riskLevelRow}> {/* Baris level risiko */}
                <Text style={styles.riskLevelLabel}>Risk Level:</Text> {/* Label "Risk Level:" */}
                <View
                  style={[
                    styles.riskLevelBadge,
                    { backgroundColor: `${getRiskColor(transaction.riskLevel)}20` }, // Warna latar badge dengan opacity 20%
                  ]}
                >
                  <View
                    style={[
                      styles.riskLevelDot,
                      { backgroundColor: getRiskColor(transaction.riskLevel) }, // Titik indikator warna penuh
                    ]}
                  />
                  <Text
                    style={[
                      styles.riskLevelText,
                      { color: getRiskColor(transaction.riskLevel) }, // Teks berwarna sesuai level risiko
                    ]}
                  >
                    {getRiskLabel(transaction.riskLevel)} {/* Teks label level risiko */}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tombol Aksi */}
          <View style={styles.actions}> {/* Kontainer tombol aksi */}
            <TouchableOpacity style={styles.primaryButton} onPress={onDone}> {/* Tombol selesai */}
              <Text style={styles.primaryButtonText}>Selesai</Text> {/* Teks tombol selesai */}
            </TouchableOpacity>
            {onViewDetails && ( // Tampilkan tombol detail hanya jika callback diberikan
              <TouchableOpacity style={styles.secondaryButton} onPress={onViewDetails}> {/* Tombol lihat detail */}
                <Text style={styles.secondaryButtonText}>Lihat Detail</Text> {/* Teks tombol detail */}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}