// src/screens/DashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserById, getUserTransactions, syncBalanceFromBackend } from '../utils/database';
import { apiService } from '../utils/apiService';
import styles from './DashboardScreen.styles';

interface DashboardScreenProps {
  user: any;
  onLogout: () => void;
  onNavigateToNFC: () => void;
  onNavigateToRegisterCard?: () => void;
  onNavigateToMyCards?: () => void;
}

export default function DashboardScreen({ 
  user, 
  onLogout, 
  onNavigateToNFC, 
  onNavigateToRegisterCard, 
  onNavigateToMyCards 
}: DashboardScreenProps) {
  const [currentUser, setCurrentUser] = useState(user || null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | 'never'>('never');

  const refreshData = async () => {
    if (!user || !user.id) {
      console.log('⚠️ No valid user for refresh data');
      return;
    }
    
    setLoading(true);
    try {
      const updatedUser = await getUserById(user.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
        console.log('💾 Loaded user from local DB');
      }

      const userTransactions = await getUserTransactions(user.id);
      setTransactions(userTransactions || []);

      try {
        console.log('💰 Syncing balance from backend...');
        const syncedBalance = await syncBalanceFromBackend(user.id);
        
        if (syncedBalance !== null && typeof syncedBalance === 'number' && updatedUser) {
          updatedUser.balance = syncedBalance;
          setCurrentUser(updatedUser);
          setLastSyncTime(new Date());
          setSyncStatus('success');
          console.log(`✅ Updated user balance from backend: ${syncedBalance}`);
        }
      } catch (syncError: any) {
        setSyncStatus('failed');
        if (syncError.message?.includes('429')) {
          console.log('⏱️ Rate limited, using cached balance');
        } else {
          console.warn('⚠️ Balance sync failed, using local data:', syncError.message);
        }
      }
      
    } catch (error) {
      console.error('Error refreshing data:', error);
      if (!currentUser || !currentUser.id) {
        Alert.alert('Error', 'Gagal memuat data terbaru');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    const dataRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing balance and transactions...');
      refreshData();
    }, 15000);
    
    return () => {
      clearInterval(dataRefreshInterval);
      console.log('⏰ Stopped all auto-refresh timers');
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 Dashboard focused - refreshing balance...');
      refreshData();
    }, [user])
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      return date.toLocaleString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }) + (diffDays === 1 ? ', Kemarin' : ', Hari ini');
    } else {
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Apakah Anda yakin ingin keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', onPress: onLogout, style: 'destructive' },
      ]
    );
  };

  const handleNotification = () => {
    Alert.alert(
      '🔔 Notifikasi',
      'Tidak ada notifikasi baru',
      [{ text: 'OK' }]
    );
  };

  const handleBalanceHistory = () => {
    Alert.alert(
      '📊 Riwayat Saldo',
      'Fitur riwayat saldo akan segera hadir!\n\nAnda dapat melihat:\n• Riwayat top-up\n• Perubahan saldo\n• Grafik penggunaan',
      [{ text: 'OK' }]
    );
  };

  const handleSeeAllTransactions = () => {
    Alert.alert(
      '📋 Semua Transaksi',
      `Total ${transactions.length} transaksi\n\nFitur detail transaksi akan segera hadir!`,
      [{ text: 'OK' }]
    );
  };

  const handleTopUp = () => {
    Alert.alert(
      '💰 Top Up Saldo',
      'Fitur top-up akan segera hadir!\n\nMetode top-up yang tersedia:\n• Transfer Bank\n• Virtual Account\n• E-Wallet',
      [{ text: 'OK' }]
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Halo, {currentUser?.name || 'User'}</Text>
            <Text style={styles.greetingSubtext}>Selamat datang kembali!</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={handleNotification}>
            <View style={styles.notificationDot} />
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.saldoLabel}>Saldo</Text>
            <View style={styles.walletIcon}>
              <Text style={styles.walletIconText}>💳)))</Text>
              <View style={styles.walletShield}>
                <Text style={styles.walletShieldIcon}>✓</Text>
              </View>
            </View>
          </View>
          <Text style={styles.balanceAmount}>{formatCurrency(currentUser?.balance || 0)}</Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp}>
              <Text style={styles.topUpIcon}>➕</Text>
              <Text style={styles.topUpText}> Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.historyButton} onPress={handleBalanceHistory}>
              <Text style={styles.historyText}>Riwayat Saldo  →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Cepat */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Menu Cepat</Text>
          <View style={styles.menuGrid}>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToNFC}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>💸</Text>
              </View>
              <Text style={styles.menuLabel}>Bayar NFC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToRegisterCard || (() => {})}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>🎫</Text>
              </View>
              <Text style={styles.menuLabel}>Registrasi Kartu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToMyCards || (() => {})}>
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>💳</Text>
              </View>
              <Text style={styles.menuLabel}>Daftar Kartu</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaksi Terbaru */}
        <View style={styles.transactionSection}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>Transaksi Terbaru</Text>
            <TouchableOpacity onPress={handleSeeAllTransactions}>
              <Text style={styles.seeAllText}>Lihat Semua  →</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Belum ada transaksi</Text>
            </View>
          ) : (
            transactions.slice(0, 4).map((transaction, index) => {
              if (!currentUser?.id) return null;
              const isReceiver = transaction.receiverId === currentUser.id;
              const otherUser = isReceiver ? transaction.sender : transaction.receiver;
              if (!otherUser) return null;
              
              return (
                <TouchableOpacity key={index} style={styles.transactionItem}>
                  <View style={styles.transactionIconContainer}>
                    <Text style={styles.transactionIcon}>
                      {isReceiver ? '💵' : '💸'}
                    </Text>
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionName}>
                      {isReceiver ? otherUser?.name || 'Unknown' : otherUser?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.transactionType}>
                      {isReceiver ? 'Pembayaran NFC' : 'Pembayaran NFC'}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.createdAt || new Date().toISOString())}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, isReceiver ? styles.positiveAmount : styles.negativeAmount]}>
                    {isReceiver ? '+' : '-'}{formatCurrency(transaction.amount || 0).replace('Rp', 'Rp')}
                  </Text>
                  <Text style={styles.transactionArrow}>→</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navLabelActive}>Beranda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onNavigateToMyCards || (() => {})}>
          <Text style={styles.navIcon}>💳</Text>
          <Text style={styles.navLabel}>Kartu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={onNavigateToNFC}>
          <View style={styles.centerButton}>
            <Text style={styles.centerButtonIcon}>💸</Text>
          </View>
          <Text style={styles.navLabel}>Bayar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navLabel}>Riwayat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Akun</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}