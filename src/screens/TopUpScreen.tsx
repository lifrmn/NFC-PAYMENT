// src/screens/TopUpScreen.tsx
import React, { useState, useEffect, useCallback } from 'react'; // import React (wajib untuk JSX); useState untuk state kartu, seleksi, dan load...
// import React (wajib untuk JSX); useState untuk state kartu, seleksi, dan loading; useEffect untuk load data saat mount; useCallback untuk memoize loadCards agar tidak dibuat ulang setiap render
import { // import beberapa komponen sekaligus dari satu modul menggunakan destructuring
  // import beberapa komponen sekaligus dari satu modul menggunakan destructuring
  View, // View: container dasar React Native setara div HTML
  // View: container dasar React Native setara div HTML
  Text, // Text: menampilkan teks
  // Text: menampilkan teks
  TouchableOpacity, // TouchableOpacity: tombol interaktif dengan efek transparansi
  // TouchableOpacity: tombol interaktif dengan efek transparansi
  ScrollView, // ScrollView: container yang bisa di-scroll
  // ScrollView: container yang bisa di-scroll
  TextInput, // TextInput: input teks untuk nominal kustom
  // TextInput: input teks untuk nominal kustom
  Alert, // Alert: dialog popup native untuk konfirmasi
  // Alert: dialog popup native untuk konfirmasi
  ActivityIndicator, // ActivityIndicator: spinner animasi loading
  // ActivityIndicator: spinner animasi loading
  RefreshControl, // RefreshControl: pull-to-refresh controller
  // RefreshControl: pull-to-refresh controller
} from 'react-native'; // penutup blok import dari library react-native
// penutup blok import dari library react-native
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView: padding aman dari notch dan status bar
// SafeAreaView: padding aman dari notch dan status bar
import { apiService } from '../utils/apiService'; // import apiService Singleton untuk HTTP request ke backend
// import apiService Singleton untuk HTTP request ke backend
import { ADMIN_PASSWORD } from '../utils/configuration'; // import konstanta ADMIN_PASSWORD dari konfigurasi untuk validasi top-up
// import konstanta ADMIN_PASSWORD dari konfigurasi untuk validasi top-up
import styles from './TopUpScreen.styles'; // import stylesheet dari file terpisah
// import stylesheet dari file terpisah

// ── Nominal preset top-up ──
const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000]; // array konstanta nominal top-up yang sudah ditentukan; ditampilkan sebagai tom...
// array konstanta nominal top-up yang sudah ditentukan; ditampilkan sebagai tombol preset agar user tidak perlu mengetik sendiri

const formatCurrency = (amount: number) => // fungsi helper untuk format angka menjadi string Rupiah Indonesia; (amount: nu...
// fungsi helper untuk format angka menjadi string Rupiah Indonesia; (amount: number) adalah parameter bertipe number
  'Rp ' + amount.toLocaleString('id-ID'); // toLocaleString('id-ID') memformat angka dengan titik sebagai pemisah ribuan s...
  // toLocaleString('id-ID') memformat angka dengan titik sebagai pemisah ribuan sesuai format Indonesia

interface TopUpScreenProps { // interface TypeScript mendefinisikan struktur props yang diterima komponen Top...
  // interface TypeScript mendefinisikan struktur props yang diterima komponen TopUpScreen
  user: any; // props user bertipe any — berisi data user yang sedang login (id, name, balance)
  // props user bertipe any — berisi data user yang sedang login (id, name, balance)
  onBack: () => void; // callback function untuk kembali ke DashboardScreen
  // callback function untuk kembali ke DashboardScreen
  onSuccess?: () => void; // callback opsional (tanda ?) yang dipanggil setelah top-up berhasil
  // callback opsional (tanda ?) yang dipanggil setelah top-up berhasil
}

interface NFCCard { // interface TypeScript mendefinisikan struktur data kartu NFC
  // interface TypeScript mendefinisikan struktur data kartu NFC
  cardId: string; // UID unik kartu NFC dalam format hexadecimal
  // UID unik kartu NFC dalam format hexadecimal
  balance: number; // saldo kartu dalam satuan Rupiah
  // saldo kartu dalam satuan Rupiah
  cardStatus: string; // status kartu: 'ACTIVE', 'BLOCKED', dll
  // status kartu: 'ACTIVE', 'BLOCKED', dll
}

export default function TopUpScreen({ user, onBack, onSuccess }: TopUpScreenProps) { // export default function: komponen utama TopUpScreen; destructuring props sesu...
  // export default function: komponen utama TopUpScreen; destructuring props sesuai TopUpScreenProps
  const [cards, setCards] = useState<NFCCard[]>([]); // state: array kartu NFC aktif milik user; <NFCCard[]> tipe TypeScript array of...
  // state: array kartu NFC aktif milik user; <NFCCard[]> tipe TypeScript array of NFCCard
  const [selectedCard, setSelectedCard] = useState<NFCCard | null>(null); // state: kartu yang dipilih untuk di-top-up; null jika belum ada pilihan
  // state: kartu yang dipilih untuk di-top-up; null jika belum ada pilihan
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null); // state: nominal preset yang dipilih; null jika user memilih nominal kustom
  // state: nominal preset yang dipilih; null jika user memilih nominal kustom
  const [customAmount, setCustomAmount] = useState(''); // state: input nominal kustom sebagai string; dikosongkan saat preset dipilih
  // state: input nominal kustom sebagai string; dikosongkan saat preset dipilih
  const [loading, setLoading] = useState(true); // state: flag loading awal saat memuat data kartu
  // state: flag loading awal saat memuat data kartu
  const [submitting, setSubmitting] = useState(false); // state: flag loading saat proses top-up berlangsung
  // state: flag loading saat proses top-up berlangsung
  const [refreshing, setRefreshing] = useState(false); // state: flag pull-to-refresh untuk RefreshControl
  // state: flag pull-to-refresh untuk RefreshControl

  // ── Nominal yang akan dipakai ──
  const amount = selectedPreset ?? (customAmount ? parseInt(customAmount.replace(/\D/g, ''), 10) : 0); // ?? adalah nullish coalescing: gunakan selectedPreset jika tidak null, jika nu...
  // ?? adalah nullish coalescing: gunakan selectedPreset jika tidak null, jika null hitung dari customAmount; replace(/\D/g,'') menghapus karakter bukan angka

  const loadCards = useCallback(async () => { // useCallback: memoize fungsi agar referensinya stabil; async karena HTTP reque...
    // useCallback: memoize fungsi agar referensinya stabil; async karena HTTP request; diperlukan agar useEffect tidak loop tak terbatas
    if (!user?.id) return; // guard: hentikan jika tidak ada user ID yang valid
    // guard: hentikan jika tidak ada user ID yang valid
    try { // try: membungkus operasi yang berisiko error
      // try: membungkus operasi yang berisiko error
      const res = await apiService.getUserCards(user.id); // await HTTP GET untuk mendapatkan daftar kartu user dari backend
      // await HTTP GET untuk mendapatkan daftar kartu user dari backend
      const list: NFCCard[] = Array.isArray(res) ? res : (res?.cards ?? []); // normalisasi response: bisa berupa array langsung atau objek {cards: []}; ?? [...
      // normalisasi response: bisa berupa array langsung atau objek {cards: []}; ?? [] sebagai fallback
      // Hanya tampilkan kartu ACTIVE
      const active = list.filter((c) => c.cardStatus === 'ACTIVE'); // filter hanya kartu dengan status ACTIVE; kartu BLOCKED/EXPIRED tidak ditampilkan
      // filter hanya kartu dengan status ACTIVE; kartu BLOCKED/EXPIRED tidak ditampilkan
      setCards(active); // simpan daftar kartu aktif ke state
      // simpan daftar kartu aktif ke state
      if (active.length > 0 && !selectedCard) { // auto-pilih kartu pertama jika belum ada pilihan
        // auto-pilih kartu pertama jika belum ada pilihan
        setSelectedCard(active[0]); // set kartu pertama sebagai pilihan default
        // set kartu pertama sebagai pilihan default
      }
    } catch (err) {
      console.warn('Gagal memuat kartu:', err); // log peringatan jika gagal memuat kartu
      // log peringatan jika gagal memuat kartu
    } finally {
      setLoading(false); // matikan loading awal
      // matikan loading awal
      setRefreshing(false); // matikan animasi pull-to-refresh
      // matikan animasi pull-to-refresh
    }
  }, [user?.id]); // dependency array: fungsi dibuat ulang hanya jika user.id berubah
  // dependency array: fungsi dibuat ulang hanya jika user.id berubah

  useEffect(() => { // useEffect: panggil loadCards saat komponen pertama kali mount
    // useEffect: panggil loadCards saat komponen pertama kali mount
    loadCards(); // muat data kartu saat screen dibuka
    // muat data kartu saat screen dibuka
  }, [loadCards]); // dependency: jalankan ulang jika referensi loadCards berubah
  // dependency: jalankan ulang jika referensi loadCards berubah

  const handleRefresh = () => { // fungsi handler pull-to-refresh
    // fungsi handler pull-to-refresh
    setRefreshing(true); // aktifkan animasi pull-to-refresh
    // aktifkan animasi pull-to-refresh
    loadCards(); // muat ulang data kartu dari backend
    // muat ulang data kartu dari backend
  };

  const handlePresetSelect = (value: number) => { // fungsi handler saat user memilih tombol preset nominal
    // fungsi handler saat user memilih tombol preset nominal
    setSelectedPreset(value); // simpan nominal preset yang dipilih
    // simpan nominal preset yang dipilih
    setCustomAmount(''); // kosongkan input kustom agar tidak konflik dengan preset
    // kosongkan input kustom agar tidak konflik dengan preset
  };

  const handleCustomAmount = (text: string) => { // fungsi handler saat user mengetik nominal kustom; (text: string) adalah teks ...
    // fungsi handler saat user mengetik nominal kustom; (text: string) adalah teks dari TextInput
    // Hanya angka
    const numeric = text.replace(/\D/g, ''); // replace(/\D/g,'') menggunakan regex untuk menghapus semua karakter bukan digi...
    // replace(/\D/g,'') menggunakan regex untuk menghapus semua karakter bukan digit; memastikan hanya angka yang tersimpan
    setCustomAmount(numeric); // simpan angka ke state
    // simpan angka ke state
    setSelectedPreset(null); // reset pilihan preset karena user memilih nominal kustom
    // reset pilihan preset karena user memilih nominal kustom
  };

  const handleTopUp = async () => { // fungsi async handler tombol Top Up; async karena melakukan HTTP request ke ba...
    // fungsi async handler tombol Top Up; async karena melakukan HTTP request ke backend
    if (!selectedCard) { // guard: hentikan jika belum ada kartu dipilih
      // guard: hentikan jika belum ada kartu dipilih
      Alert.alert('Pilih Kartu', 'Pilih kartu NFC yang ingin di-top-up terlebih dahulu.'); // tampilkan alert jika kartu belum dipilih
      // tampilkan alert jika kartu belum dipilih
      return; // hentikan eksekusi
      // hentikan eksekusi
    }
    if (!amount || amount < 1000) { // validasi nominal minimum Rp 1.000
      // validasi nominal minimum Rp 1.000
      Alert.alert('Nominal Tidak Valid', 'Masukkan nominal top-up minimal Rp 1.000.'); // tampilkan alert jika nominal tidak valid
      // tampilkan alert jika nominal tidak valid
      return; // hentikan eksekusi
      // hentikan eksekusi
    }
    if (amount > 10000000) { // validasi nominal maksimum Rp 10.000.000
      // validasi nominal maksimum Rp 10.000.000
      Alert.alert('Nominal Terlalu Besar', 'Maksimal top-up adalah Rp 10.000.000 per transaksi.'); // tampilkan alert jika nominal terlalu besar
      // tampilkan alert jika nominal terlalu besar
      return; // hentikan eksekusi
      // hentikan eksekusi
    }

    Alert.alert(
      '✅ Konfirmasi Top Up',
      `Kartu: ${selectedCard.cardId}\nNominal: ${formatCurrency(amount)}\nSaldo sekarang: ${formatCurrency(selectedCard.balance)}\nSaldo setelah: ${formatCurrency(selectedCard.balance + amount)}`,
      [
        { text: 'Batal', style: 'cancel' }, // tombol Batal menutup dialog tanpa proses
        // tombol Batal menutup dialog tanpa proses
        {
          text: 'Top Up',
          onPress: async () => { // callback async saat user menekan Top Up
            // callback async saat user menekan Top Up
            setSubmitting(true); // aktifkan loading state
            // aktifkan loading state
            try { // try = mencoba proses aman; error akan ditangkap oleh catch
              const res = await apiService.topUpCard(selectedCard.cardId, amount, ADMIN_PASSWORD); // await HTTP POST top-up ke backend; cardId, amount, dan password admin dikirim
              // await HTTP POST top-up ke backend; cardId, amount, dan password admin dikirim
              if (res?.success) { // cek apakah top-up berhasil
                // cek apakah top-up berhasil
                const newBalance = res.card?.balance ?? (selectedCard.balance + amount); // ambil saldo baru dari response; fallback hitung manual jika tidak ada
                // ambil saldo baru dari response; fallback hitung manual jika tidak ada
                Alert.alert(
                  '🎉 Top Up Berhasil!',
                  `Saldo kartu berhasil ditambahkan ${formatCurrency(amount)}.\n\nSaldo baru: ${formatCurrency(newBalance)}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => { // callback saat user menekan OK di alert sukses
                        // callback saat user menekan OK di alert sukses
                        if (onSuccess) onSuccess(); // panggil callback onSuccess jika tersedia
                        // panggil callback onSuccess jika tersedia
                        onBack(); // kembali ke DashboardScreen
                        // kembali ke DashboardScreen
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Gagal', res?.error ?? 'Top-up gagal, coba lagi.'); // tampilkan pesan error dari backend; ?? fallback jika error undefined
                // tampilkan pesan error dari backend; ?? fallback jika error undefined
              }
            } catch (err: any) {
              const msg = err?.message ?? 'Terjadi kesalahan'; // ambil pesan error; ?? fallback jika message undefined
              // ambil pesan error; ?? fallback jika message undefined
              Alert.alert('Error', msg.includes('401') ? 'Akses ditolak.' : msg); // cek apakah error 401 (unauthorized) dan tampilkan pesan yang sesuai
              // cek apakah error 401 (unauthorized) dan tampilkan pesan yang sesuai
            } finally {
              setSubmitting(false); // matikan loading state; always dijalankan baik sukses maupun gagal
              // matikan loading state; always dijalankan baik sukses maupun gagal
            }
          },
        },
      ]
    );
  };

  // ── Loading screen ──
  if (loading) { // tampilkan loading screen penuh saat data kartu sedang dimuat
    // tampilkan loading screen penuh saat data kartu sedang dimuat
    return ( // return = mengembalikan JSX; elemen UI yang akan dirender ke layar
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

  return ( // return JSX utama — konten screen top-up yang ditampilkan saat data kartu suda...
  // return JSX utama — konten screen top-up yang ditampilkan saat data kartu sudah dimuat
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💰 Top Up Saldo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView} // style scroll view utama
        // style scroll view utama
        contentContainerStyle={styles.content} // padding dalam konten scroll
        // padding dalam konten scroll
        showsVerticalScrollIndicator={false} // sembunyikan scrollbar vertikal
        // sembunyikan scrollbar vertikal
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />} // pull-to-refresh
        // pull-to-refresh
      >
        <View style={styles.balanceCard}>
          {selectedCard ? ( // ternary: tampilkan saldo jika ada kartu terpilih
          // ternary: tampilkan saldo jika ada kartu terpilih
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
        {cards.length > 1 && ( // section ini hanya muncul jika user punya lebih dari 1 kartu aktif
        // section ini hanya muncul jika user punya lebih dari 1 kartu aktif
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pilih Kartu</Text>
            <View style={styles.cardPickerRow}>
              {cards.map((c) => ( // render satu tombol per kartu
              // render satu tombol per kartu
                <TouchableOpacity
                  key={c.cardId} // key unik diperlukan React untuk daftar; menggunakan cardId
                  // key unik diperlukan React untuk daftar; menggunakan cardId
                  style={[styles.cardOption, selectedCard?.cardId === c.cardId && styles.cardOptionSelected]} // array style: cardOptionSelected ditambah jika kartu ini sedang dipilih
                  // array style: cardOptionSelected ditambah jika kartu ini sedang dipilih
                  onPress={() => setSelectedCard(c)} // pilih kartu ini saat ditekan
                  // pilih kartu ini saat ditekan
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
        {cards.length > 0 && ( // section nominal hanya ditampilkan jika ada kartu aktif
        // section nominal hanya ditampilkan jika ada kartu aktif
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pilih Nominal</Text>
            <View style={styles.presetGrid}>
              {PRESET_AMOUNTS.map((val) => ( // render satu tombol per nilai preset
              // render satu tombol per nilai preset
                <TouchableOpacity
                  key={val} // key unik untuk nilai nominal
                  // key unik untuk nilai nominal
                  style={[styles.presetBtn, selectedPreset === val && styles.presetBtnSelected]} // style dipilih jika nilai ini yang aktif
                  // style dipilih jika nilai ini yang aktif
                  onPress={() => handlePresetSelect(val)} // pilih preset ini
                  // pilih preset ini
                >
                  <Text style={[styles.presetText, selectedPreset === val && styles.presetTextSelected]}>
                    {formatCurrency(val)} {/* teks nilai nominal diformat Rupiah */}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customAmountRow}>
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.customAmountInput} // style input nominal kustom
                // style input nominal kustom
                placeholder="Atau ketik nominal lain…" // placeholder panduan
                // placeholder panduan
                placeholderTextColor="#94a3b8" // warna abu-abu untuk placeholder
                // warna abu-abu untuk placeholder
                keyboardType="numeric" // keyboard angka
                // keyboard angka
                value={customAmount} // nilai dari state customAmount
                // nilai dari state customAmount
                onChangeText={handleCustomAmount} // handler saat user mengetik
                // handler saat user mengetik
              />
            </View>
          </View>
        )}

        {/* ── Ringkasan ── */}
        {cards.length > 0 && amount > 0 && ( // ringkasan ditampilkan hanya jika ada kartu dan nominal > 0
        // ringkasan ditampilkan hanya jika ada kartu dan nominal > 0
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
        {cards.length > 0 && ( // tombol top-up hanya ditampilkan jika ada kartu
        // tombol top-up hanya ditampilkan jika ada kartu
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !amount) && styles.submitBtnDisabled]} // disabled style jika sedang submit atau belum ada nominal
            // disabled style jika sedang submit atau belum ada nominal
            onPress={handleTopUp} // panggil handleTopUp saat ditekan
            // panggil handleTopUp saat ditekan
            disabled={submitting || !amount} // nonaktifkan saat loading atau nominal belum diisi
            // nonaktifkan saat loading atau nominal belum diisi
          >
            {submitting ? ( // tampilkan spinner jika sedang submit
            // tampilkan spinner jika sedang submit
              <ActivityIndicator color="#fff" /> // spinner putih
              // spinner putih
            ) : (
              <Text style={styles.submitBtnText}>
                {amount > 0 ? `Top Up ${formatCurrency(amount)}` : 'Top Up Saldo'} {/* tampilkan nominal jika > 0, default teks jika belum */}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Jika tidak ada kartu ── */}
        {cards.length === 0 && ( // section info hanya ditampilkan jika tidak ada kartu aktif
        // section info hanya ditampilkan jika tidak ada kartu aktif
          <View style={styles.sectionCard}>
            <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 14, lineHeight: 22 }}>
              Tidak ada kartu NFC aktif.{'\n'}Daftarkan kartu NFC terlebih dahulu melalui menu{' '}
              <Text style={{ fontWeight: '600', color: '#3B82F6' }}>Daftar Kartu</Text>. {/* Text link berwarna biru */}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


