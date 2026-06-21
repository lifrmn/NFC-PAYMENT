// src/screens/TransactionSuccessScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from './TransactionSuccessScreen.styles';

interface TransactionSuccessScreenProps {
  transaction: {
    amount: number;
    senderName: string;
    senderCardId: string;
    receiverName: string;
    receiverCardId: string;
    senderBalance: number;
    receiverBalance: number;
    riskScore: number | null;  // Z-Score aktual. null jika σ=0 dan X≠μ
    riskLevel: string;         // NORMAL | SUSPICIOUS | ANOMALY
    decision?: string;         // ALLOW | REVIEW | BLOCK
    zScore?: number | null;    // Alias riskScore untuk konsistensi
  };
  onDone: () => void;
  onViewDetails?: () => void;
}

export default function TransactionSuccessScreen({
  transaction,
  onDone,
  onViewDetails,
}: TransactionSuccessScreenProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getRiskColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'NORMAL':
        return '#10B981';
      case 'SUSPICIOUS':
        return '#F59E0B';
      case 'ANOMALY':
        return '#EF4444';
      default:
        return '#64748b';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level.toUpperCase()) {
      case 'NORMAL':
        return 'NORMAL';
      case 'SUSPICIOUS':
        return 'SUSPICIOUS';
      case 'ANOMALY':
        return 'ANOMALY';
      default:
        return level;
    }
  };

  const maskCardId = (cardId: string) => {
    if (cardId.length <= 8) return cardId;
    return cardId.substring(0, 4) + ' •••• •••• ' + cardId.substring(cardId.length - 4);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Success Icon */}
          <View style={styles.successIcon}>
            <View style={styles.checkmarkCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          </View>

          {/* Success Title */}
          <Text style={styles.title}>Transaksi Berhasil</Text>
          <Text style={styles.subtitle}>
            Pembayaran NFC telah berhasil diproses
          </Text>

          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Nominal</Text>
            <Text style={styles.amount}>{formatCurrency(transaction.amount)}</Text>
          </View>

          {/* Transaction Details */}
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

          {/* Z-Score Card */}
          <View style={styles.riskCard}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskIcon}>🛡️</Text>
              <View style={styles.riskHeaderText}>
                <Text style={styles.riskTitle}>Z-Score Anomaly Detection</Text>
              </View>
            </View>
              <View style={styles.riskContent}>
              <View style={styles.riskScoreRow}>
                <Text style={styles.riskScoreLabel}>Z-Score:</Text>
                <Text style={styles.riskScoreValue}>
                  {transaction.riskScore === null || transaction.riskScore === undefined
                    ? 'null (σ=0, X≠μ)'
                    : typeof transaction.riskScore === 'number'
                    ? transaction.riskScore.toFixed(4)
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
                <View
                  style={[
                    styles.riskLevelBadge,
                    { backgroundColor: `${getRiskColor(transaction.riskLevel)}20` },
                  ]}
                >
                  <View
                    style={[
                      styles.riskLevelDot,
                      { backgroundColor: getRiskColor(transaction.riskLevel) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.riskLevelText,
                      { color: getRiskColor(transaction.riskLevel) },
                    ]}
                  >
                    {getRiskLabel(transaction.riskLevel)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
              <Text style={styles.primaryButtonText}>Selesai</Text>
            </TouchableOpacity>
            {onViewDetails && (
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