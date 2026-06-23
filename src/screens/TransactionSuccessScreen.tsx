// src/screens/TransactionSuccessScreen.tsx
/* ==================================================================================
 * ✅ SCREEN: TransactionSuccessScreen
 * ==================================================================================
 *
 * Purpose:
 * Screen yang ditampilkan setelah transaksi NFC berhasil diproses.
 * Menampilkan detail transaksi: nominal, pengirim, penerima, dan hasil Z-Score.
 *
 * Props:
 * - transaction: object berisi detail transaksi (amount, sender, receiver, z-score)
 * - onDone: Callback saat user tap tombol "Selesai"
 * - onViewDetails: Callback opsional untuk tombol "Lihat Detail"
 * ==================================================================================
 */
import React from 'react'; // Import React library untuk membuat komponen
import {
  View,              // Komponen kontainer layout
  Text,              // Komponen teks
  TouchableOpacity,  // Tombol dengan efek opacity saat ditekan
  ScrollView         // Kontainer scrollable untuk konten panjang
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Komponen area aman perangkat (notch/status bar)
import styles from './TransactionSuccessScreen.styles'; // Import styling dari file terpisah

// Interface TypeScript untuk mendefinisikan tipe props yang diterima komponen
interface TransactionSuccessScreenProps {
  transaction: {
    amount: number;            // Nominal transaksi dalam Rupiah
    senderName: string;        // Nama pengirim (pembeli)
    senderCardId: string;      // UID kartu pengirim (akan di-mask)
    receiverName: string;      // Nama penerima (merchant)
    receiverCardId: string;    // UID kartu penerima (akan di-mask)
    senderBalance: number;     // Saldo pengirim setelah transaksi
    receiverBalance: number;   // Saldo penerima setelah transaksi
    riskScore: number | null;  // Z-Score aktual. null jika σ=0 dan X≠μ
    riskLevel: string;         // NORMAL | SUSPICIOUS | ANOMALY
    decision?: string;         // ALLOW | REVIEW | BLOCK
    zScore?: number | null;    // Alias riskScore untuk konsistensi
  };
  onDone: () => void;          // Callback saat user tap tombol "Selesai"
  onViewDetails?: () => void;  // Callback opsional untuk tombol "Lihat Detail"
}

// Komponen utama TransactionSuccessScreen
export default function TransactionSuccessScreen({
  transaction, // Destructuring: ambil data transaksi dari props
  onDone,      // Destructuring: ambil callback selesai dari props
  onViewDetails, // Destructuring: ambil callback detail dari props (opsional)
}: TransactionSuccessScreenProps) {

  // Fungsi: Format angka ke format mata uang Rupiah Indonesia
  // Contoh: 50000 → "Rp 50.000"
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { // Gunakan locale Indonesia
      style: 'currency',          // Format sebagai mata uang
      currency: 'IDR',            // Kode mata uang: Indonesian Rupiah
      minimumFractionDigits: 0,   // Tidak perlu desimal (Rp 50.000, bukan Rp 50.000,00)
    }).format(amount); // Format angka ke string mata uang
  };

  // Fungsi: Tentukan warna badge berdasarkan level risiko Z-Score
  // NORMAL → hijau, SUSPICIOUS → kuning, ANOMALY → merah
  const getRiskColor = (level: string) => {
    switch (level.toUpperCase()) { // Ubah ke uppercase agar case-insensitive
      case 'NORMAL':
        return '#10B981'; // Hijau emerald: transaksi aman, Z-Score ≤ 2
      case 'SUSPICIOUS':
        return '#F59E0B'; // Kuning amber: perlu review, 2 < Z-Score ≤ 3
      case 'ANOMALY':
        return '#EF4444'; // Merah: anomali terdeteksi, Z-Score > 3
      default:
        return '#64748b'; // Abu-abu: level tidak dikenali
    }
  };

  // Fungsi: Dapatkan label teks untuk badge level risiko
  // Mengonversi kode risiko menjadi teks yang ditampilkan di UI
  const getRiskLabel = (level: string) => {
    switch (level.toUpperCase()) { // Konversi uppercase untuk perbandingan konsisten
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
  const maskCardId = (cardId: string) => {
    if (cardId.length <= 8) return cardId; // Kartu pendek: tampilkan apa adanya
    return cardId.substring(0, 4) + ' •••• •••• ' + cardId.substring(cardId.length - 4); // Mask bagian tengah
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