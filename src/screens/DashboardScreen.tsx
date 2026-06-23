// src/screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react'; // React inti + hooks untuk state dan efek samping
import {
  View, // Komponen container dasar (setara div)
  Text, // Komponen teks
  TouchableOpacity, // Tombol yang merespons sentuhan
  ScrollView, // Container yang bisa di-scroll
  Alert, // Dialog popup native
  RefreshControl // Komponen pull-to-refresh
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // View aman dari notch dan status bar
import { useFocusEffect } from '@react-navigation/native'; // Hook untuk jalankan kode saat screen sedang aktif/fokus
import { getUserById, getUserTransactions, syncBalanceFromBackend } from '../utils/database'; // Fungsi akses data user dari SQLite lokal
import styles from './DashboardScreen.styles'; // Stylesheet khusus DashboardScreen

interface DashboardScreenProps { // Tipe props yang diterima komponen DashboardScreen
  user: any; // Data user aktif yang dikirim dari App.tsx
  onLogout: () => void; // Callback untuk menjalankan proses logout
  onNavigateToNFC: () => void; // Callback untuk navigasi ke screen pembayaran NFC
  onNavigateToRegisterCard?: () => void; // Callback opsional ke screen pendaftaran kartu
  onNavigateToMyCards?: () => void; // Callback opsional ke screen daftar kartu
}

export default function DashboardScreen({ // Komponen utama dashboard — menerima semua props navigasi
  user, // Data user dari App.tsx
  onLogout, // Handler logout
  onNavigateToNFC, // Navigasi ke pembayaran
  onNavigateToRegisterCard, // Navigasi ke daftar kartu baru
  onNavigateToMyCards // Navigasi ke daftar kartu saya
}: DashboardScreenProps) {
  const [currentUser, setCurrentUser] = useState(user || null); // State user lokal — diupdate setelah refresh dari DB
  const [transactions, setTransactions] = useState<any[]>([]); // Daftar transaksi terakhir milik user
  const [loading, setLoading] = useState(false); // Flag loading untuk pull-to-refresh
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null); // Waktu terakhir saldo berhasil disinkronkan
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | 'never'>('never'); // Status sinkronisasi saldo: sukses/gagal/belum pernah

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
          setCurrentUser({ ...updatedUser, balance: syncedBalance }); // Buat objek baru — jangan mutasi state secara langsung
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

  // Ref yang selalu menunjuk ke versi terbaru refreshData — mencegah stale closure di setInterval
  const refreshDataRef = useRef(refreshData);
  useEffect(() => {
    refreshDataRef.current = refreshData; // Perbarui ref setiap render agar setInterval pakai versi terbaru
  });

  useEffect(() => { // Effect ini jalan sekali saat komponen pertama kali di-mount
    // refreshData() awal ditangani oleh useFocusEffect di bawah (mencegah double-call saat mount)

    const dataRefreshInterval = setInterval(() => { // Auto-refresh setiap 15 detik
      console.log('\ud83d\udd04 Auto-refreshing balance and transactions...');
      refreshDataRef.current(); // Gunakan ref agar tidak stale closure
    }, 15000); // Interval 15.000ms = 15 detik
    
    return () => { // Cleanup saat komponen di-unmount
      clearInterval(dataRefreshInterval); // Hentikan timer agar tidak berjalan setelah screen ditutup
      console.log('\u23f0 Stopped all auto-refresh timers');
    };
  }, []); // Array kosong = hanya jalan sekali saat mount

  useFocusEffect( // Hook khusus React Navigation — jalan setiap kali screen kembali fokus
    React.useCallback(() => { // useCallback agar fungsi tidak dibuat ulang setiap render
      console.log('\ud83d\udcf1 Dashboard focused - refreshing balance...');
      refreshDataRef.current(); // Gunakan ref agar tidak memanggil versi refreshData yang stale
    }, []) // Tidak perlu dep — refreshDataRef.current selalu up-to-date
  );

  const formatCurrency = (amount: number) => { // Helper: format angka ke format mata uang Rupiah
    return new Intl.NumberFormat('id-ID', { // Gunakan locale Indonesia
      style: 'currency', // Format sebagai mata uang
      currency: 'IDR', // Mata uang Rupiah
      minimumFractionDigits: 0, // Tidak tampilkan desimal (Rp 50.000, bukan Rp 50.000,00)
    }).format(amount); // Format angka yang diberikan
  };

  const formatDate = (dateString: string) => { // Helper: ubah ISO date string ke teks tanggal yang ramah
    const date = new Date(dateString); // Parse string ISO ke objek Date
    const now = new Date(); // Waktu sekarang untuk perbandingan

    // Bandingkan tanggal kalender (bukan selisih jam) agar "Hari ini" dan "Kemarin" akurat
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isToday = date.toDateString() === now.toDateString(); // Sama tanggal hari ini
    const isYesterday = date.toDateString() === yesterday.toDateString(); // Sama tanggal kemarin

    if (isToday || isYesterday) { // Jika transaksi hari ini atau kemarin
      return date.toLocaleString('id-ID', {
        hour: '2-digit', // Tampilkan jam 2 digit
        minute: '2-digit', // Tampilkan menit 2 digit
      }) + (isYesterday ? ', Kemarin' : ', Hari ini'); // Label kalender yang benar
    } else { // Jika lebih dari kemarin, tampilkan tanggal lengkap
      return date.toLocaleDateString('id-ID', {
        day: '2-digit', // Tanggal 2 digit
        month: 'short', // Bulan disingkat (Jan, Feb, dst)
        year: 'numeric', // Tahun penuh (2024)
      });
    }
  };

  const handleLogout = () => { // Handler konfirmasi sebelum logout
    Alert.alert(
      'Logout', // Judul dialog
      'Apakah Anda yakin ingin keluar?', // Pesan konfirmasi
      [
        { text: 'Batal', style: 'cancel' }, // Tombol batal — tidak melakukan apa-apa
        { text: 'Keluar', onPress: onLogout, style: 'destructive' }, // Tombol keluar — memanggil callback logout dari App.tsx
      ]
    );
  };

  const handleNotification = () => { // Handler tombol notifikasi (placeholder)
    Alert.alert(
      '🔔 Notifikasi', // Judul dialog notifikasi
      'Tidak ada notifikasi baru', // Pesan saat tidak ada notifikasi
      [{ text: 'OK' }] // Tombol tutup dialog
    );
  };

  const handleBalanceHistory = () => { // Handler tombol riwayat saldo (placeholder)
    Alert.alert(
      '📊 Riwayat Saldo', // Judul dialog
      'Fitur riwayat saldo akan segera hadir!\n\nAnda dapat melihat:\n• Riwayat top-up\n• Perubahan saldo\n• Grafik penggunaan', // Deskripsi fitur mendatang
      [{ text: 'OK' }] // Tombol tutup
    );
  };

  const handleSeeAllTransactions = () => { // Handler tombol lihat semua transaksi (placeholder)
    Alert.alert(
      '📋 Semua Transaksi', // Judul dialog
      `Total ${transactions.length} transaksi\n\nFitur detail transaksi akan segera hadir!`, // Tampilkan jumlah transaksi
      [{ text: 'OK' }] // Tombol tutup
    );
  };

  const handleTopUp = () => { // Handler tombol top up saldo (placeholder)
    Alert.alert(
      '💰 Top Up Saldo', // Judul dialog
      'Fitur top-up akan segera hadir!\n\nMetode top-up yang tersedia:\n• Transfer Bank\n• Virtual Account\n• E-Wallet', // Deskripsi metode pembayaran
      [{ text: 'OK' }] // Tombol tutup
    );
  };

  if (!currentUser) { // Jika data user belum tersedia, tampilkan layar loading
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading user data...</Text> {/* Teks placeholder sambil data dimuat */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}> {/* Container utama yang aman dari notch/status bar */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} />}
        showsVerticalScrollIndicator={false}
      >
        {/* showsVerticalScrollIndicator=false: sembunyikan scrollbar agar tampilan lebih bersih */}
        {/* Header */}
        <View style={styles.header}> {/* Baris atas berisi sapaan dan tombol notifikasi */}
          <View>
            <Text style={styles.greeting}>Halo, {currentUser?.name || 'User'}</Text> {/* Sapaan personal dengan nama user */}
            <Text style={styles.greetingSubtext}>Selamat datang kembali!</Text> {/* Sub-teks sapaan */}
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={handleNotification}> {/* Tombol buka notifikasi */}
            <View style={styles.notificationDot} /> {/* Titik merah indikator ada notifikasi */}
            <Text style={styles.notificationIcon}>🔔</Text> {/* Ikon lonceng notifikasi */}
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}> {/* Kartu utama yang menampilkan saldo */}
          <View style={styles.balanceHeader}> {/* Baris atas kartu saldo */}
            <Text style={styles.saldoLabel}>Saldo</Text> {/* Label teks Saldo */}
            <View style={styles.walletIcon}> {/* Container ikon dompet NFC */}
              <Text style={styles.walletIconText}>💳)))</Text> {/* Ikon kartu dengan sinyal NFC */}
              <View style={styles.walletShield}> {/* Badge shield keamanan */}
                <Text style={styles.walletShieldIcon}>✓</Text> {/* Centang tanda aman */}
              </View>
            </View>
          </View>
          <Text style={styles.balanceAmount}>{formatCurrency(currentUser?.balance || 0)}</Text> {/* Nominal saldo diformat ke Rupiah */}
          <View style={styles.balanceActions}> {/* Baris tombol aksi di bawah saldo */}
            <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp}> {/* Tombol top up saldo */}
              <Text style={styles.topUpIcon}>➕</Text> {/* Ikon plus */}
              <Text style={styles.topUpText}> Top Up</Text> {/* Label tombol */}
            </TouchableOpacity>
            <TouchableOpacity style={styles.historyButton} onPress={handleBalanceHistory}> {/* Tombol riwayat saldo */}
              <Text style={styles.historyText}>Riwayat Saldo  →</Text> {/* Label dengan panah */}
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Cepat */}
        <View style={styles.menuSection}> {/* Section menu navigasi cepat */}
          <Text style={styles.menuTitle}>Menu Cepat</Text> {/* Judul section */}
          <View style={styles.menuGrid}> {/* Grid 3 kolom untuk tombol menu */}
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToNFC}> {/* Tombol bayar NFC */}
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>💸</Text> {/* Ikon uang terbang */}
              </View>
              <Text style={styles.menuLabel}>Bayar NFC</Text> {/* Label menu pembayaran */}
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToRegisterCard || (() => {})}> {/* Tombol daftar kartu baru */}
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>🎫</Text> {/* Ikon tiket/kartu */}
              </View>
              <Text style={styles.menuLabel}>Registrasi Kartu</Text> {/* Label menu daftar kartu */}
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToMyCards || (() => {})}> {/* Tombol lihat daftar kartu */}
              <View style={styles.menuIconContainer}>
                <Text style={styles.menuIcon}>💳</Text> {/* Ikon kartu kredit */}
              </View>
              <Text style={styles.menuLabel}>Daftar Kartu</Text> {/* Label menu kartu saya */}
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaksi Terbaru */}
        <View style={styles.transactionSection}> {/* Section daftar transaksi terakhir */}
          <View style={styles.transactionHeader}> {/* Baris judul dan tombol lihat semua */}
            <Text style={styles.transactionTitle}>Transaksi Terbaru</Text> {/* Judul section transaksi */}
            <TouchableOpacity onPress={handleSeeAllTransactions}> {/* Tombol lihat semua transaksi */}
              <Text style={styles.seeAllText}>Lihat Semua  →</Text> {/* Teks link dengan panah */}
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? ( // Tampilkan empty state jika tidak ada transaksi
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text> {/* Ikon kotak kosong */}
              <Text style={styles.emptyText}>Belum ada transaksi</Text> {/* Teks placeholder kosong */}
            </View>
          ) : (
            transactions.slice(0, 4).map((transaction) => { // Tampilkan maksimal 4 transaksi terakhir
              if (!currentUser?.id) return null; // Abaikan jika user tidak valid
              const isReceiver = transaction.receiverId === currentUser.id; // Cek apakah user adalah penerima dana
              const otherUser = isReceiver ? transaction.sender : transaction.receiver; // Ambil info pihak lain dalam transaksi
              if (!otherUser) return null; // Abaikan jika data pihak lain tidak tersedia
              
              return (
                <TouchableOpacity key={transaction.id} style={styles.transactionItem}> {/* key pakai ID unik, bukan index */}
                  <View style={styles.transactionIconContainer}>
                    <Text style={styles.transactionIcon}>
                      {isReceiver ? '💵' : '💸'} {/* Ikon berbeda untuk terima vs kirim */}
                    </Text>
                  </View>
                  <View style={styles.transactionInfo}> {/* Kolom tengah: nama, tipe, tanggal */}
                    <Text style={styles.transactionName}>
                      {otherUser?.name || 'Unknown'} {/* Nama pihak lain atau Unknown jika tidak ada */}
                    </Text>
                    <Text style={styles.transactionType}>
                      {'Pembayaran NFC'} {/* Label tipe transaksi */}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.createdAt || new Date().toISOString())} {/* Tanggal diformat ke teks ramah */}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, isReceiver ? styles.positiveAmount : styles.negativeAmount]}>
                    {isReceiver ? '+' : '-'}{formatCurrency(transaction.amount || 0)} {/* Tanda +/- di depan nominal */}
                  </Text>
                  <Text style={styles.transactionArrow}>→</Text> {/* Panah sebagai indikator navigasi detail */}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}> {/* Bar navigasi bawah tetap (sticky) */}
        <TouchableOpacity style={styles.navItem}> {/* Tab Beranda — aktif */}
          <Text style={styles.navIconActive}>🏠</Text> {/* Ikon rumah aktif (lebih terang) */}
          <Text style={styles.navLabelActive}>Beranda</Text> {/* Label aktif */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onNavigateToMyCards || (() => {})}> {/* Tab Kartu */}
          <Text style={styles.navIcon}>💳</Text> {/* Ikon kartu */}
          <Text style={styles.navLabel}>Kartu</Text> {/* Label kartu */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={onNavigateToNFC}> {/* Tab Bayar — tombol tengah yang lebih besar */}
          <View style={styles.centerButton}> {/* Lingkaran biru menonjol di tengah navbar */}
            <Text style={styles.centerButtonIcon}>💸</Text> {/* Ikon bayar */}
          </View>
          <Text style={styles.navLabel}>Bayar</Text> {/* Label bayar */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}> {/* Tab Riwayat (belum aktif) */}
          <Text style={styles.navIcon}>📊</Text> {/* Ikon grafik riwayat */}
          <Text style={styles.navLabel}>Riwayat</Text> {/* Label riwayat */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}> {/* Tab Akun — membuka konfirmasi logout */}
          <Text style={styles.navIcon}>👤</Text> {/* Ikon profil */}
          <Text style={styles.navLabel}>Akun</Text> {/* Label akun */}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}