// src/screens/TopUpScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../utils/apiService';
import { ADMIN_PASSWORD } from '../utils/configuration';
import styles from './TopUpScreen.styles';

// ── Nominal preset top-up ──
const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000];

const formatCurrency = (amount: number) =>
  'Rp ' + amount.toLocaleString('id-ID');

interface TopUpScreenProps {
  user: any;
  onBack: () => void;
  onSuccess?: () => void;
}

interface NFCCard {
  cardId: string;
  balance: number;
  cardStatus: string;
}

export default function TopUpScreen({ user, onBack, onSuccess }: TopUpScreenProps) {
  const [cards, setCards] = useState<NFCCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<NFCCard | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Nominal yang akan dipakai ──
  const amount = selectedPreset ?? (customAmount ? parseInt(customAmount.replace(/\D/g, ''), 10) : 0);

  const loadCards = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiService.getUserCards(user.id);
      const list: NFCCard[] = Array.isArray(res) ? res : (res?.cards ?? []);
      // Hanya tampilkan kartu ACTIVE
      const active = list.filter((c) => c.cardStatus === 'ACTIVE');
      setCards(active);
      if (active.length > 0 && !selectedCard) {
        setSelectedCard(active[0]);
      }
    } catch (err) {
      console.warn('Gagal memuat kartu:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCards();
  };

  const handlePresetSelect = (value: number) => {
    setSelectedPreset(value);
    setCustomAmount('');
  };

  const handleCustomAmount = (text: string) => {
    // Hanya angka
    const numeric = text.replace(/\D/g, '');
    setCustomAmount(numeric);
    setSelectedPreset(null);
  };

  const handleTopUp = async () => {
    if (!selectedCard) {
      Alert.alert('Pilih Kartu', 'Pilih kartu NFC yang ingin di-top-up terlebih dahulu.');
      return;
    }
    if (!amount || amount < 1000) {
      Alert.alert('Nominal Tidak Valid', 'Masukkan nominal top-up minimal Rp 1.000.');
      return;
    }
    if (amount > 10000000) {
      Alert.alert('Nominal Terlalu Besar', 'Maksimal top-up adalah Rp 10.000.000 per transaksi.');
      return;
    }

    Alert.alert(
      '✅ Konfirmasi Top Up',
      `Kartu: ${selectedCard.cardId}\nNominal: ${formatCurrency(amount)}\nSaldo sekarang: ${formatCurrency(selectedCard.balance)}\nSaldo setelah: ${formatCurrency(selectedCard.balance + amount)}`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Top Up',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await apiService.topUpCard(selectedCard.cardId, amount, ADMIN_PASSWORD);
              if (res?.success) {
                const newBalance = res.card?.balance ?? (selectedCard.balance + amount);
                Alert.alert(
                  '🎉 Top Up Berhasil!',
                  `Saldo kartu berhasil ditambahkan ${formatCurrency(amount)}.\n\nSaldo baru: ${formatCurrency(newBalance)}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        if (onSuccess) onSuccess();
                        onBack();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Gagal', res?.error ?? 'Top-up gagal, coba lagi.');
              }
            } catch (err: any) {
              const msg = err?.message ?? 'Terjadi kesalahan';
              Alert.alert('Error', msg.includes('401') ? 'Akses ditolak.' : msg);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Loading screen ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Top Up Saldo</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Memuat data kartu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💰 Top Up Saldo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ── Kartu saldo saat ini ── */}
        <View style={styles.balanceCard}>
          {selectedCard ? (
            <>
              <Text style={styles.balanceLabel}>Saldo Kartu NFC</Text>
              <Text style={styles.balanceAmount}>{formatCurrency(selectedCard.balance)}</Text>
              <Text style={styles.balanceCardId}>ID: {selectedCard.cardId}</Text>
            </>
          ) : (
            <Text style={styles.noCardText}>
              Belum ada kartu NFC aktif.{'\n'}Daftarkan kartu terlebih dahulu.
            </Text>
          )}
        </View>

        {/* ── Pilih Kartu (jika lebih dari 1) ── */}
        {cards.length > 1 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pilih Kartu</Text>
            <View style={styles.cardPickerRow}>
              {cards.map((c) => (
                <TouchableOpacity
                  key={c.cardId}
                  style={[styles.cardOption, selectedCard?.cardId === c.cardId && styles.cardOptionSelected]}
                  onPress={() => setSelectedCard(c)}
                >
                  <Text style={styles.cardOptionId}>{c.cardId.slice(0, 10)}…</Text>
                  <Text style={styles.cardOptionBalance}>{formatCurrency(c.balance)}</Text>
                  <Text style={styles.cardOptionStatus}>✅ Aktif</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Pilih Nominal ── */}
        {cards.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pilih Nominal</Text>
            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.presetBtn, selectedPreset === val && styles.presetBtnSelected]}
                  onPress={() => handlePresetSelect(val)}
                >
                  <Text style={[styles.presetText, selectedPreset === val && styles.presetTextSelected]}>
                    {formatCurrency(val)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input nominal custom */}
            <View style={styles.customAmountRow}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.customAmountInput}
                placeholder="Atau ketik nominal lain…"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={customAmount}
                onChangeText={handleCustomAmount}
              />
            </View>
          </View>
        )}

        {/* ── Ringkasan ── */}
        {cards.length > 0 && amount > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Ringkasan</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Saldo saat ini</Text>
              <Text style={styles.summaryValue}>{formatCurrency(selectedCard?.balance ?? 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Nominal top-up</Text>
              <Text style={styles.summaryValue}>+ {formatCurrency(amount)}</Text>
            </View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 6, paddingTop: 8 }]}>
              <Text style={styles.summaryLabel}>Saldo setelah top-up</Text>
              <Text style={styles.summaryValueGreen}>{formatCurrency((selectedCard?.balance ?? 0) + amount)}</Text>
            </View>
          </View>
        )}

        {/* ── Tombol Top Up ── */}
        {cards.length > 0 && (
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !amount) && styles.submitBtnDisabled]}
            onPress={handleTopUp}
            disabled={submitting || !amount}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {amount > 0 ? `Top Up ${formatCurrency(amount)}` : 'Top Up Saldo'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Jika tidak ada kartu ── */}
        {cards.length === 0 && (
          <View style={styles.sectionCard}>
            <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 14, lineHeight: 22 }}>
              Tidak ada kartu NFC aktif.{'\n'}Daftarkan kartu NFC terlebih dahulu melalui menu{' '}
              <Text style={{ fontWeight: '600', color: '#3B82F6' }}>Daftar Kartu</Text>.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
