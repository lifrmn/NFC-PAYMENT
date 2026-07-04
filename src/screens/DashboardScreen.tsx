// src/screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
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
import { getUserById, getUserTransactions } from '../utils/database'; // import dua fungsi dari database.ts: getUserById ambil data user segar dari backend, getUserTransactions ambil riwayat transaksi
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
  const [currentUser, setCurrentUser] = useState(user || null); // state: data user aktif; diinisialisasi dari props user; diperbarui setiap refresh dari backend
  const [transactions, setTransactions] = useState<any[]>([]); // state: array riwayat transaksi user; <any[]> adalah tipe TypeScript array of any; [] inisialisasi array kosong
  const [loading, setLoading] = useState(false); // state: flag loading saat refreshData berjalan; true = tombol dinonaktifkan dan spinner ditampilkan
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null); // state: waktu terakhir data berhasil disinkronkan; null = belum pernah sync; <Date | null> = bisa Date atau null
  const [syncStatus, setSyncStatus] = useState<'success' | 'failed' | 'never'>('never'); // state: status sinkronisasi data; union type tiga nilai; 'never' = belum pernah dicoba
  // Timestamp refresh terakhir — mencegah burst API call saat navigasi cepat antar screen
  const lastRefreshRef = useRef<number>(0);

  const refreshData = async () => {
    if (!user || !user.id) return; // guard: hentikan jika tidak ada user atau user.id tidak valid

    // Cooldown 10 detik: cegah refresh berulang saat navigasi cepat antar screen
    const now = Date.now(); // ambil timestamp sekarang dalam milliseconds
    if (now - lastRefreshRef.current < 10000) { // cek apakah belum 10 detik sejak refresh terakhir
      console.log('⏱️ Refresh skipped — cooldown aktif (10s)'); // log pesan cooldown ke console
      return; // hentikan eksekusi karena masih dalam periode cooldown
    }
    lastRefreshRef.current = now; // simpan timestamp refresh ini ke ref untuk cooldown berikutnya
    
    setLoading(true); // aktifkan state loading: spinner tampil, tombol dinonaktifkan
    try {
      // getUserById selalu fetch dari backend (sudah diperbaiki) → saldo selalu fresh
      const updatedUser = await getUserById(user.id); // await: tunggu data user terbaru dari backend via API
      if (updatedUser) { // hanya perbarui state jika data valid diterima dari server
        setCurrentUser(updatedUser); // langsung pakai balance dari backend, tidak perlu sync terpisah
        setLastSyncTime(new Date()); // simpan waktu sync berhasil sebagai objek Date
        setSyncStatus('success'); // tandai status sync berhasil
        console.log(`✅ Updated user balance from backend: ${updatedUser.balance}`); // log saldo terbaru
      }

      // Ambil riwayat transaksi (1 API call terpisah)
      const userTransactions = await getUserTransactions(user.id); // await: tunggu array riwayat transaksi dari backend
      setTransactions(userTransactions || []); // simpan ke state; || [] sebagai fallback jika null

      // ✅ syncBalanceFromBackend dihapus dari sini — sudah tercakup dalam getUserById
      // Sebelumnya: getUserById + syncBalanceFromBackend = 2 panggilan ke /api/users/:id
      // Sesudahnya: hanya getUserById = 1 panggilan → menghemat 50% API call, mencegah 429

    } catch (error) {
      console.error('Error refreshing data:', error); // log error ke console untuk debugging
      if (!currentUser || !currentUser.id) { // hanya tampilkan alert jika belum ada data sama sekali
        Alert.alert('Error', 'Gagal memuat data terbaru'); // tampilkan alert error ke user
      }
    } finally {
      setLoading(false); // matikan loading state: spinner disembunyikan, tombol diaktifkan kembali
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
    }, 60000); // ✅ DIPERBAIKI: Interval dinaikkan 15s → 60s. Sebelumnya 15s × 3 API call = 180 req/15mnt — melebihi rate limit backend, menyebabkan error 429.
    
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

  const handleTopUp = () => { // arrow function tanpa parameter; dipanggil saat user menekan tombol Top Up di balance card
    if (onNavigateToTopUp) { // cek apakah callback onNavigateToTopUp disediakan oleh parent (App.tsx)
      onNavigateToTopUp(); // navigasi ke TopUpScreen jika callback tersedia
    } else {
      Alert.alert('Top Up', 'Fitur top-up belum tersedia di layar ini.', [{ text: 'OK' }]); // tampilkan pesan jika navigasi belum dikonfigurasi
    }
  };

  if (!currentUser) { // if memeriksa kondisi; !currentUser berarti currentUser adalah null atau undefined; tampilkan loading screen jika data user belum ada
    return ( // early return: mengembalikan UI loading sebelum data user tersedia
      <SafeAreaView style={styles.container}> {/* SafeAreaView memberi padding aman dari notch */}
        <View style={styles.loadingContainer}> {/* View container untuk layout loading */}
          <Text style={styles.loadingText}>Loading user data...</Text> {/* teks placeholder saat data user sedang dimuat */}
        </View>
      </SafeAreaView>
    );
  }

  return ( // return JSX — mengembalikan tampilan komponen; semua elemen di dalam return() adalah yang akan dirender ke layar
    <SafeAreaView style={styles.container}> {/* SafeAreaView: wrapper aman dari notch dan status bar */}
      <ScrollView // ScrollView: View yang bisa discroll jika konten melebihi tinggi layar
        style={styles.scrollView} // style={} menerapkan objek style yang sudah didefinisikan di StyleSheet ke elemen ini
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} />} // RefreshControl: komponen pull-to-refresh; refreshing={loading} = animasi aktif saat loading; onRefresh={refreshData} = fungsi yang dipanggil saat user tarik ke bawah
        showsVerticalScrollIndicator={false} // menyembunyikan scrollbar vertikal untuk tampilan lebih bersih
      >
        <View style={styles.header}> {/* View header: berisi sapaan dan tombol notifikasi */}
          <View> {/* View kiri: sapaan nama user */}
            <Text style={styles.greeting}>Halo, {currentUser?.name || 'User'}</Text> {/* Text sapaan dengan nama user; optional chaining ?. mencegah error jika name undefined */}
            <Text style={styles.greetingSubtext}>Selamat datang kembali!</Text> {/* Text subjudul sapaan */}
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={handleNotification}> {/* TouchableOpacity tombol notifikasi kanan atas; onPress memanggil handleNotification */}
            <View style={styles.notificationDot} /> {/* View titik merah indikator notifikasi baru */}
            <Text style={styles.notificationIcon}>🔔</Text> {/* Text ikon lonceng notifikasi */}
          </TouchableOpacity>
        </View>
        <View style={styles.balanceCard}> {/* View kartu saldo utama dengan gradient biru */}
          <View style={styles.balanceHeader}> {/* View baris atas kartu saldo: label dan ikon kartu */}
            <Text style={styles.saldoLabel}>Saldo</Text> {/* Text label 'Saldo' di atas angka saldo */}
            <View style={styles.walletIcon}> {/* View ikon dompet NFC di pojok kanan */}
              <Text style={styles.walletIconText}>💳)))</Text> {/* Text emoji kartu dengan simbol gelombang NFC */}
              <View style={styles.walletShield}> {/* View lingkaran shield centang hijau */}
                <Text style={styles.walletShieldIcon}>✓</Text> {/* Text tanda centang dalam shield */}
              </View>
            </View>
          </View>
          <Text style={styles.balanceAmount}>{formatCurrency(currentUser?.balance || 0)}</Text> {/* Text angka saldo diformat sebagai Rupiah; || 0 sebagai fallback jika balance undefined */}
          <View style={styles.balanceActions}> {/* View baris tombol aksi: Top Up dan Riwayat Saldo */}
            <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp}> {/* tombol Top Up; onPress memanggil handleTopUp() */}
              <Text style={styles.topUpIcon}>➕</Text> {/* Text ikon plus untuk Top Up */}
              <Text style={styles.topUpText}> Top Up</Text> {/* Text label tombol Top Up */}
            </TouchableOpacity>
            <TouchableOpacity style={styles.historyButton} onPress={handleBalanceHistory}> {/* tombol Riwayat Saldo; onPress memanggil handleBalanceHistory() */}
              <Text style={styles.historyText}>Riwayat Saldo  →</Text> {/* Text label tombol Riwayat dengan panah kanan */}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.menuSection}> {/* View section Menu Cepat */}
          <Text style={styles.menuTitle}>Menu Cepat</Text> {/* Text judul section Menu Cepat */}
          <View style={styles.menuGrid}> {/* View grid 3 kolom untuk ikon menu cepat */}
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToNFC}> {/* tombol menu Bayar NFC; onPress memanggil callback navigasi ke NFCScreen */}
              <View style={styles.menuIconContainer}> {/* View lingkaran background ikon menu */}
                <Text style={styles.menuIcon}>💸</Text> {/* Text emoji ikon uang terbang untuk menu bayar */}
              </View>
              <Text style={styles.menuLabel}>Bayar NFC</Text> {/* Text label menu */}
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToRegisterCard || (() => {})}> {/* tombol menu Registrasi Kartu; || (() => {}) fallback jika callback tidak tersedia */}
              <View style={styles.menuIconContainer}> {/* View lingkaran ikon */}
                <Text style={styles.menuIcon}>🎫</Text> {/* Text emoji tiket untuk menu registrasi kartu */}
              </View>
              <Text style={styles.menuLabel}>Registrasi Kartu</Text> {/* Text label menu */}
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={onNavigateToMyCards || (() => {})}> {/* tombol menu Daftar Kartu; fallback empty function jika callback tidak tersedia */}
              <View style={styles.menuIconContainer}> {/* View lingkaran ikon */}
                <Text style={styles.menuIcon}>💳</Text> {/* Text emoji kartu kredit untuk menu daftar kartu */}
              </View>
              <Text style={styles.menuLabel}>Daftar Kartu</Text> {/* Text label menu */}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.transactionSection}> {/* View section Transaksi Terbaru */}
          <View style={styles.transactionHeader}> {/* View baris header section: judul dan link 'Lihat Semua' */}
            <Text style={styles.transactionTitle}>Transaksi Terbaru</Text> {/* Text judul section Transaksi Terbaru */}
            <TouchableOpacity onPress={handleSeeAllTransactions}> {/* tombol 'Lihat Semua'; onPress memanggil handleSeeAllTransactions() */}
              <Text style={styles.seeAllText}>Lihat Semua  →</Text> {/* Text link dengan panah kanan */}
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? ( // ternary operator: tampilkan empty state jika tidak ada transaksi
            <View style={styles.emptyState}> {/* View container empty state */}
              <Text style={styles.emptyIcon}>📭</Text> {/* Text emoji kotak pos kosong */}
              <Text style={styles.emptyText}>Belum ada transaksi</Text> {/* Text pesan empty state */}
            </View>
          ) : ( // bagian else dari ternary operator; tampilan alternatif saat kondisi ternary bernilai false
            transactions.slice(0, 4).map((transaction) => { // .slice(0,4) ambil 4 transaksi terakhir; .map() render satu item per transaksi
              if (!currentUser?.id) return null; // Abaikan jika user tidak valid
              const isReceiver = transaction.receiverId === currentUser.id; // Cek apakah user adalah penerima dana
              const otherUser = isReceiver ? transaction.sender : transaction.receiver; // Ambil info pihak lain dalam transaksi
              if (!otherUser) return null; // Abaikan jika data pihak lain tidak tersedia
              
              return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
                <TouchableOpacity key={transaction.id} style={styles.transactionItem}> {/* key={id} diperlukan React untuk identifikasi unik tiap item dalam list */}
                  <View style={styles.transactionIconContainer}> {/* View lingkaran ikon transaksi */}
                    <Text style={styles.transactionIcon}>
                      {isReceiver ? '💵' : '💸'} {/* emoji uang masuk (hijau) jika penerima, uang keluar (merah) jika pengirim */}
                    </Text>
                  </View>
                  <View style={styles.transactionInfo}> {/* View kolom info transaksi: nama, jenis, tanggal */}
                    <Text style={styles.transactionName}>
                      {otherUser?.name || 'Unknown'} {/* nama pihak lain dalam transaksi; fallback 'Unknown' */}
                    </Text>
                    <Text style={styles.transactionType}>
                      {'Pembayaran NFC'} {/* jenis transaksi; selalu 'Pembayaran NFC' untuk transaksi NFC */}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.createdAt || new Date().toISOString())} {/* tanggal transaksi diformat; fallback ke sekarang */}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, isReceiver ? styles.positiveAmount : styles.negativeAmount]}> {/* Text jumlah; array style menggabungkan dua style: base + kondisional */}
                    {isReceiver ? '+' : '-'}{formatCurrency(transaction.amount || 0)} {/* tanda + jika penerima, - jika pengirim; diikuti jumlah terformat */}
                  </Text>
                  <Text style={styles.transactionArrow}>→</Text> {/* Text panah kanan dekoratif di ujung item */}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
      <View style={styles.bottomNav}> {/* View bottom navigation bar di bawah layar */}
        <TouchableOpacity style={styles.navItem}> {/* tombol nav Beranda (aktif) */}
          <Text style={styles.navIconActive}>🏠</Text> {/* ikon rumah aktif */}
          <Text style={styles.navLabelActive}>Beranda</Text> {/* label aktif Beranda */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onNavigateToMyCards || (() => {})}> {/* tombol nav Kartu; navigasi ke MyCardsScreen */}
          <Text style={styles.navIcon}>💳</Text> {/* ikon kartu */}
          <Text style={styles.navLabel}>Kartu</Text> {/* label Kartu */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={onNavigateToNFC}> {/* tombol tengah (menonjol) untuk Bayar NFC */}
          <View style={styles.centerButton}> {/* View lingkaran biru tombol tengah */}
            <Text style={styles.centerButtonIcon}>💸</Text> {/* ikon uang untuk tombol Bayar */}
          </View>
          <Text style={styles.navLabel}>Bayar</Text> {/* label Bayar */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}> {/* tombol nav Riwayat */}
          <Text style={styles.navIcon}>📊</Text> {/* ikon grafik batang untuk Riwayat */}
          <Text style={styles.navLabel}>Riwayat</Text> {/* label Riwayat */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}> {/* tombol nav Akun; onPress memanggil handleLogout() */}
          <Text style={styles.navIcon}>👤</Text> {/* ikon orang untuk Akun */}
          <Text style={styles.navLabel}>Akun</Text> {/* label Akun */}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}