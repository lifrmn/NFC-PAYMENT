// src/screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react'; // import digunakan untuk mengambil module dari library; React adalah library utama; useState membuat state lokal komponen; useEffect menjalankan efek samping saat komponen mount/update; useRef membuat referensi mutable yang tidak memicu re-render
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View, // View adalah komponen container dasar React Native — setara dengan <div> di HTML web
  Text, // Text adalah komponen untuk menampilkan teks di React Native — setara dengan <p> atau <span>
  TouchableOpacity, // TouchableOpacity adalah tombol yang bisa diklik, tampilan sedikit transparan saat ditekan
  ScrollView, // ScrollView adalah container yang bisa di-scroll vertikal maupun horizontal
  Alert, // Alert adalah dialog popup native Android/iOS untuk menampilkan pesan atau konfirmasi
  RefreshControl // RefreshControl adalah komponen untuk fitur pull-to-refresh (tarik ke bawah untuk refresh)
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context'; // import SafeAreaView dari library eksternal; SafeAreaView adalah wrapper yang otomatis memberi padding agar konten tidak tertutup notch, status bar, atau home indicator
import { useFocusEffect } from '@react-navigation/native'; // import useFocusEffect dari React Navigation; hook ini menjalankan callback setiap kali screen ini mendapat fokus (misalnya setelah kembali dari screen lain)
import { getUserById, getUserTransactions, syncBalanceFromBackend } from '../utils/database'; // import tiga fungsi dari file database.ts: getUserById ambil data user dari lokal, getUserTransactions ambil riwayat transaksi, syncBalanceFromBackend sinkronisasi saldo dari backend
import styles from './DashboardScreen.styles'; // import stylesheet dari file terpisah — memisahkan logika dan tampilan agar kode lebih rapi

interface DashboardScreenProps { // interface adalah blueprint TypeScript untuk mendefinisikan tipe data objek; DashboardScreenProps mendefinisikan props (parameter) yang WAJIB dan opsional diterima komponen DashboardScreen
  user: any; // props user bertipe any (fleksibel) — berisi data user aktif yang dikirim dari App.tsx: id, name, username, balance
  onLogout: () => void; // props onLogout adalah callback function (fungsi) yang dipanggil ketika user tap tombol logout; () => void berarti tidak menerima argumen dan tidak mengembalikan nilai
  onNavigateToNFC: () => void; // props onNavigateToNFC adalah callback untuk navigasi ke screen pembayaran NFC
  onNavigateToRegisterCard?: () => void; // props opsional (tanda ?) — callback untuk navigasi ke screen pendaftaran kartu NFC; tanda ? berarti boleh tidak dikirim
  onNavigateToMyCards?: () => void; // props opsional — callback untuk navigasi ke screen daftar kartu milik user
  onNavigateToTopUp?: () => void; // props opsional — callback untuk navigasi ke screen top-up saldo kartu NFC
}

export default function DashboardScreen({ // export default mengekspor komponen ini sebagai ekspor utama file sehingga bisa diimport tanpa kurung kurawal; function DashboardScreen adalah komponen React fungsional yang menerima props dalam bentuk destructuring
  user, // props user: data user dari App.tsx (id, name, username, balance)
  onLogout, // props onLogout: fungsi yang dipanggil saat user logout
  onNavigateToNFC, // props onNavigateToNFC: fungsi untuk pindah ke screen NFC payment
  onNavigateToRegisterCard, // props opsional untuk pindah ke screen daftar kartu baru
  onNavigateToMyCards, // props opsional untuk pindah ke screen daftar kartu saya
  onNavigateToTopUp, // props opsional untuk pindah ke screen top-up saldo
}: DashboardScreenProps) { // : DashboardScreenProps adalah type annotation TypeScript — memastikan props sesuai interface
  const [currentUser, setCurrentUser] = useState(user || null); // const membuat variabel tetap; useState(initialValue) membuat state lokal — currentUser menyimpan data user terkini; setCurrentUser fungsi untuk memperbarui state; user || null menggunakan nilai user jika ada, null jika tidak
  const [transactions, setTransactions] = useState<any[]>([]); // useState dengan tipe generik <any[]> berarti state berisi array; transactions menyimpan daftar transaksi; setTransactions untuk memperbarui; [] adalah nilai awal array kosong
  const [loading, setLoading] = useState(false); // useState(false) membuat state boolean loading; false berarti tidak sedang loading; setLoading(true) dipanggil saat refresh mulai, setLoading(false) saat selesai
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null); // useState tipe Date atau null; menyimpan waktu terakhir sinkronisasi saldo berhasil; null berarti belum pernah sync
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | 'never'>('never'); // useState dengan union type — hanya bisa berisi salah satu dari tiga string tersebut; 'never' berarti belum pernah mencoba sync

  const refreshData = async () => { // const membuat variabel tetap; async menandai fungsi ini asynchronous sehingga bisa menggunakan await; arrow function () => {...} mendefinisikan body fungsi
    if (!user || !user.id) { // ! adalah operator NOT; !user berarti user null/undefined; || berarti ATAU — cek minimal satu kondisi
      console.log('\u26a0\ufe0f No valid user for refresh data'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return; // return menghentikan eksekusi fungsi lebih awal jika tidak ada user valid
    }
    
    setLoading(true); // setLoading(true) mengubah state loading menjadi true — memicu tampilan spinner RefreshControl di UI
    try { // try memulai blok percobaan — jika ada error di dalam, eksekusi loncat ke blok catch
      const updatedUser = await getUserById(user.id); // const membuat variabel tetap; await menunggu Promise selesai; getUserById(user.id) mengambil data user terbaru dari database lokal SQLite
      if (updatedUser) { // if memeriksa apakah data user berhasil ditemukan (tidak null/undefined)
        setCurrentUser(updatedUser); // setCurrentUser memperbarui state dengan data user terbaru
        console.log('\ud83d\udcbe Loaded user from local DB'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      }

      const userTransactions = await getUserTransactions(user.id); // await getUserTransactions mengambil riwayat transaksi user dari database lokal
      setTransactions(userTransactions || []); // setTransactions memperbarui state; || [] adalah fallback — jika getUserTransactions mengembalikan null/undefined, gunakan array kosong

      try { // try bersarang — sync saldo dari backend dipisah agar kegagalan sync tidak membatalkan refresh data lokal
        console.log('\ud83d\udcb0 Syncing balance from backend...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        const syncedBalance = await syncBalanceFromBackend(user.id); // await syncBalanceFromBackend menghubungi API backend via HTTP untuk mendapatkan saldo terkini
        
        if (syncedBalance !== null && typeof syncedBalance === 'number' && updatedUser) { // !== null memastikan bukan null; typeof === 'number' memastikan tipe data angka; && berarti AND — semua kondisi harus benar
          setCurrentUser({ ...updatedUser, balance: syncedBalance }); // spread operator {...updatedUser} menyalin semua property ke objek baru; kemudian override property balance dengan nilai terbaru dari backend
          setLastSyncTime(new Date()); // new Date() membuat objek Date berisi waktu sekarang — dicatat sebagai waktu sync terakhir
          setSyncStatus('success'); // setSyncStatus mengubah status menjadi 'success' agar UI menampilkan indikator berhasil
          console.log(`\u2705 Updated user balance from backend: ${syncedBalance}`); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        }
      } catch (syncError: any) { // catch menangkap error dari try bersarang; : any adalah type annotation — syncError bisa berupa tipe apa saja
        setSyncStatus('failed'); // status sync diubah ke 'failed' — UI menampilkan indikator kegagalan
        if (syncError.message?.includes('429')) { // optional chaining (?.) aman jika message tidak ada; includes('429') cek error HTTP 429 (Too Many Requests / rate limit dari backend)
          console.log('⏱️ Rate limited, using cached balance'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
        } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
          console.warn('⚠️ Balance sync failed, using local data:', syncError.message); // console.warn mencetak peringatan ke terminal; bukan error kritis tapi perlu diperhatikan
        }
      }
      
    } catch (error) { // catch luar menangkap error dari getUserById atau getUserTransactions
      console.error('Error refreshing data:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      if (!currentUser || !currentUser.id) { // hanya tampilkan alert jika belum ada data sama sekali di state (belum pernah berhasil load)
        Alert.alert('Error', 'Gagal memuat data terbaru'); // Alert.alert menampilkan dialog native dengan judul 'Error' dan pesan
      }
    } finally { // finally selalu dijalankan baik ada error maupun tidak — cocok untuk cleanup/reset state
      setLoading(false); // setLoading(false) menghentikan spinner loading apapun hasilnya
    }
  };

  // Ref yang selalu menunjuk ke versi terbaru refreshData — mencegah stale closure di setInterval
  const refreshDataRef = useRef(refreshData); // const membuat variabel tetap; useRef(refreshData) membuat ref yang menyimpan referensi ke fungsi refreshData; ref tidak memicu re-render saat nilainya berubah
  useEffect(() => { // useEffect tanpa dependency array khusus — dijalankan setiap kali render untuk memperbarui ref
    refreshDataRef.current = refreshData; // .current adalah property ref yang menyimpan nilai aktual; diperbarui setiap render agar setInterval selalu memanggil versi terbaru fungsi
  });

  useEffect(() => { // useEffect dengan array dependency [] — dijalankan SEKALI saat komponen pertama kali mount; [] berarti tidak ada dependency yang memicu ulang efek ini
    // refreshData() awal ditangani oleh useFocusEffect di bawah (mencegah double-call saat mount)

    const dataRefreshInterval = setInterval(() => { // setInterval menjalankan fungsi secara berulang setiap interval tertentu; const membuat variabel tetap
      console.log('\ud83d\udd04 Auto-refreshing balance and transactions...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      refreshDataRef.current(); // memanggil fungsi refreshData terbaru melalui ref — menghindari stale closure yang terjadi jika langsung pakai refreshData di dalam setInterval
    }, 60000); // 60000 milidetik = 60 detik; angka kedua setInterval adalah jarak waktu antar eksekusi
    
    return () => { // return function di dalam useEffect adalah cleanup function — dijalankan saat komponen di-unmount
      clearInterval(dataRefreshInterval); // clearInterval(id) menghentikan interval berdasarkan ID yang dikembalikan setInterval — mencegah memory leak
      console.log('\u23f0 Stopped all auto-refresh timers'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
    };
  }, []); // array kosong [] memastikan efek ini HANYA berjalan sekali saat mount dan cleanup saat unmount

  useFocusEffect( // useFocusEffect adalah hook React Navigation yang menjalankan callback setiap kali screen ini mendapat fokus — berbeda dengan useEffect yang hanya jalan saat mount
    React.useCallback(() => { // React.useCallback(fn, deps) membuat fungsi yang hanya dibuat ulang jika dependency berubah; di sini array kosong [] berarti fungsi tidak pernah dibuat ulang
      console.log('\ud83d\udcf1 Dashboard focused - refreshing balance...'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      refreshDataRef.current(); // memanggil refreshData terkini melalui ref — aman dari stale closure
    }, []) // array dependency kosong [] berarti fungsi callback ini tidak bergantung pada state/props manapun
  );

  const formatCurrency = (amount: number) => { // const membuat variabel tetap; arrow function (amount: number) => {...} menerima parameter angka dan mengembalikan string format Rupiah
    return new Intl.NumberFormat('id-ID', { // new membuat instance Intl.NumberFormat; 'id-ID' adalah locale Indonesia — menentukan format titik sebagai pemisah ribuan
      style: 'currency', // style: 'currency' memberitahu Intl bahwa ini format mata uang
      currency: 'IDR', // currency: 'IDR' adalah kode ISO 4217 untuk Indonesian Rupiah
      minimumFractionDigits: 0, // minimumFractionDigits: 0 menghilangkan angka desimal — Rp 50.000 bukan Rp 50.000,00
    }).format(amount); // .format(amount) menjalankan pemformatan pada nilai angka dan mengembalikan string
  };

  const formatDate = (dateString: string) => { // const membuat variabel tetap; arrow function menerima string tanggal ISO dan mengembalikan teks tanggal yang ramah pengguna
    const date = new Date(dateString); // new Date(string) mem-parse string ISO 8601 menjadi objek Date JavaScript
    const now = new Date(); // new Date() tanpa argumen membuat objek Date dengan waktu sekarang

    // Bandingkan tanggal kalender (bukan selisih jam) agar "Hari ini" dan "Kemarin" akurat
    const yesterday = new Date(now); // menyalin objek Date now ke variabel baru
    yesterday.setDate(now.getDate() - 1); // setDate mengubah hari dalam bulan; getDate() mengembalikan angka hari; -1 mundur satu hari

    const isToday = date.toDateString() === now.toDateString(); // toDateString() mengubah Date ke string tanggal saja tanpa jam; === membandingkan string keduanya
    const isYesterday = date.toDateString() === yesterday.toDateString(); // cek apakah tanggal transaksi sama dengan kemarin

    if (isToday || isYesterday) { // if memeriksa kondisi; || berarti ATAU — jika salah satu benar, blok ini dijalankan
      return date.toLocaleString('id-ID', { // toLocaleString memformat Date ke string sesuai locale; 'id-ID' untuk format Indonesia
        hour: '2-digit', // '2-digit' menampilkan jam dengan dua angka, contoh: 09, 14
        minute: '2-digit', // '2-digit' menampilkan menit dengan dua angka
      }) + (isYesterday ? ', Kemarin' : ', Hari ini'); // operator ternary: kondisi ? nilai_jika_benar : nilai_jika_salah
    } else { // jika transaksi lebih dari kemarin, tampilkan format tanggal lengkap
      return date.toLocaleDateString('id-ID', { // toLocaleDateString memformat tanggal saja tanpa jam
        day: '2-digit', // hari dengan dua angka
        month: 'short', // nama bulan disingkat (Jan, Feb, Mar, dll)
        year: 'numeric', // tahun penuh (2025)
      });
    }
  };

  const handleLogout = () => { // const membuat variabel tetap; arrow function () => {...} tanpa parameter; fungsi ini memicu dialog konfirmasi sebelum logout
    Alert.alert( // Alert.alert() menampilkan dialog native dengan judul, pesan, dan tombol pilihan
      'Logout', // argumen pertama: judul dialog
      'Apakah Anda yakin ingin keluar?', // argumen kedua: pesan konfirmasi
      [
        { text: 'Batal', style: 'cancel' }, // objek tombol pertama; style: 'cancel' membuat tombol tampil lebih redup sebagai opsi sekunder
        { text: 'Keluar', onPress: onLogout, style: 'destructive' }, // objek tombol kedua; onPress: onLogout memanggil callback logout dari App.tsx; style: 'destructive' menampilkan teks merah (Android)
      ]
    );
  };

  const handleNotification = () => { // const membuat variabel tetap; arrow function tanpa parameter; dipanggil saat user menekan ikon lonceng notifikasi
    Alert.alert( // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      '🔔 Notifikasi', // argumen pertama Alert.alert: judul dialog yang ditampilkan di atas
      'Tidak ada notifikasi baru', // argumen kedua: pesan isi dialog
      [{ text: 'OK' }] // argumen ketiga: array tombol; satu objek dengan text: 'OK' untuk menutup dialog
    );
  };

  const handleBalanceHistory = () => { // const membuat variabel tetap; arrow function tanpa parameter; dipanggil saat user menekan tombol riwayat saldo
    Alert.alert( // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      '📊 Riwayat Saldo', // judul dialog
      'Fitur riwayat saldo akan segera hadir!\n\nAnda dapat melihat:\n• Riwayat top-up\n• Perubahan saldo\n• Grafik penggunaan', // \n adalah karakter newline untuk baris baru dalam string
      [{ text: 'OK' }] // array dengan satu objek tombol; text: 'OK' adalah label tombol tutup dialog
    );
  };

  const handleSeeAllTransactions = () => { // arrow function tanpa parameter; dipanggil saat user menekan link "Lihat Semua" di section transaksi
    Alert.alert( // Alert.alert() menampilkan dialog popup native kepada user; title dan message ditentukan oleh argumen
      '📋 Semua Transaksi', // judul Alert untuk menampilkan daftar semua transaksi; menggunakan emoji 📋 sebagai indikator visual
      `Total ${transactions.length} transaksi\n\nFitur detail transaksi akan segera hadir!`, // template literal ${} menyisipkan nilai dinamis; transactions.length adalah jumlah elemen dalam array transactions
      [{ text: 'OK' }] // tombol tunggal 'OK' di Alert; menutup dialog saat user menekan OK
    );
  };

  const handleTopUp = () => { // arrow function tanpa parameter; dipanggil saat user menekan tombol Top Up
    if (onNavigateToTopUp) {
      onNavigateToTopUp(); // navigasi ke TopUpScreen jika callback tersedia
    } else {
      Alert.alert('Top Up', 'Fitur top-up belum tersedia di layar ini.', [{ text: 'OK' }]);
    }
  };

  if (!currentUser) { // if memeriksa kondisi; !currentUser berarti currentUser adalah null atau undefined; tampilkan loading screen jika data user belum ada
    return ( // return di luar JSX utama — mengembalikan UI alternatif (early return pattern)
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return ( // return JSX — mengembalikan tampilan komponen; semua elemen di dalam return() adalah yang akan dirender ke layar
    <SafeAreaView style={styles.container}>
      <ScrollView // ScrollView: View yang bisa discroll jika konten melebihi tinggi layar
        style={styles.scrollView} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} />}
        showsVerticalScrollIndicator={false}
      >
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
        <View style={styles.transactionSection}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>Transaksi Terbaru</Text>
            <TouchableOpacity onPress={handleSeeAllTransactions}>
              <Text style={styles.seeAllText}>Lihat Semua  →</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? ( // Tampilkan empty state jika tidak ada transaksi
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Belum ada transaksi</Text>
            </View>
          ) : ( // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
            transactions.slice(0, 4).map((transaction) => { // Tampilkan maksimal 4 transaksi terakhir
              if (!currentUser?.id) return null; // Abaikan jika user tidak valid
              const isReceiver = transaction.receiverId === currentUser.id; // Cek apakah user adalah penerima dana
              const otherUser = isReceiver ? transaction.sender : transaction.receiver; // Ambil info pihak lain dalam transaksi
              if (!otherUser) return null; // Abaikan jika data pihak lain tidak tersedia
              
              return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
                <TouchableOpacity key={transaction.id} style={styles.transactionItem}>
                  <View style={styles.transactionIconContainer}>
                    <Text style={styles.transactionIcon}>
                      {isReceiver ? '💵' : '💸'}
                    </Text>
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionName}>
                      {otherUser?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.transactionType}>
                      {'Pembayaran NFC'}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.createdAt || new Date().toISOString())}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, isReceiver ? styles.positiveAmount : styles.negativeAmount]}>
                    {isReceiver ? '+' : '-'}{formatCurrency(transaction.amount || 0)}
                  </Text>
                  <Text style={styles.transactionArrow}>→</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
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