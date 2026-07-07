// src/screens/MyCardsScreen.tsx
// ==================================================================================
// 🎫 SCREEN: MyCardsScreen
// ==================================================================================
//
// Purpose:
// Screen untuk manajemen kartu NFC milik user.
// User bisa melihat, mengaktifkan, memblokir, dan memantau status kartu NFC-nya.
//
// Kebijakan: 1 USER = 1 CARD (hanya kartu pertama yang ditampilkan)
//
// User Flow:
// ┌─────────────────────────────────────────────────────────────────────┐
// │ 1. User tap "Kartu Saya" di DashboardScreen                        │
// │ 2. MyCardsScreen muncul                                            │
// │ 3. Loading: fetch data kartu dari backend API                      │
// │ 4. Jika belum ada kartu: tampilkan empty state + tombol daftar     │
// │ 5. Jika ada kartu: tampilkan detail kartu (UID, saldo, status)     │
// │ 6. User bisa:                                                       │
// │    - Pull-to-refresh untuk update data terbaru                     │
// │    - Blokir kartu (ACTIVE → BLOCKED)                               │
// │    - Aktifkan kembali (BLOCKED → ACTIVE)                           │
// │ 7. Tombol "Tambah Kartu" → navigasi ke RegisterCardScreen          │
// └─────────────────────────────────────────────────────────────────────┘
//
// Features:
// 1. List Kartu NFC:
//    - Tampilkan detail: UID, saldo, status, tipe, tanggal daftar, terakhir digunakan
//    - Visual kartu dengan chip dan gelombang NFC
//    - Badge status berwarna (hijau=Aktif, merah=Diblokir, dll)
//
// 2. Pull-to-Refresh:
//    - User tarik ke bawah untuk refresh data terbaru dari server
//    - Loading spinner saat fetch berlangsung
//
// 3. Manajemen Status Kartu:
//    - Tombol "Blokir" untuk ACTIVE cards → konfirmasi dulu
//    - Tombol "Aktifkan" untuk BLOCKED cards
//    - Call API untuk update status, refresh tampilan setelah berhasil
//
// 4. Empty State:
//    - Tampilkan pesan informatif jika belum ada kartu
//    - Tombol "Tambah Kartu" mengarah ke RegisterCardScreen
//
// 5. Loading State:
//    - Full-screen spinner saat initial load (belum ada data sama sekali)
//    - Pull-to-refresh indicator saat refresh
//
// State Management:
// - cards: NFCCard[]    - Array kartu user (max 1 item per kebijakan)
// - loading: boolean    - Flag loading initial
// - refreshing: boolean - Flag pull-to-refresh
//
// Interface NFCCard (tipe data kartu):
// - id: number          - ID kartu di database
// - cardId: string      - UID fisik kartu NFC (e.g., "04:AB:CD:12:34:56:78")
// - userId: number      - ID user pemilik kartu
// - balance: number     - Saldo kartu dalam rupiah
// - cardStatus: enum    - ACTIVE | BLOCKED | LOST | EXPIRED
// - cardType?: string   - Tipe kartu (e.g., "NTag215")
// - cardFrequency?: str - Frekuensi RF (e.g., "13.56 MHz")
// - createdAt: string   - Tanggal registrasi kartu (ISO string)
// - lastUsed?: string   - Tanggal terakhir digunakan (ISO string)
//
// Props:
// - user: any               - Data user yang login
// - onBack: () => void      - Callback kembali ke DashboardScreen
// - onRegisterNew?: () => void - Callback ke RegisterCardScreen (opsional)
//
// ==================================================================================

// ==================================================================================
// IMPORTS
// ==================================================================================
// React & Hooks:
// - useState: State management (cards, loading, refreshing)
// - useEffect: Auto-load kartu saat screen mount
//
// React Native Core:
// - View, Text: Layout & teks
// - TouchableOpacity: Tombol interaktif (blokir, aktifkan, tambah)
// - StyleSheet: Styling type-safe
// - ScrollView: Container scrollable untuk daftar kartu
// - Alert: Dialog konfirmasi dan pesan error
// - RefreshControl: Pull-to-refresh controller
// - ActivityIndicator: Spinner animasi loading
//
// Safe Area:
// - SafeAreaView: Hindari area notch/status bar
//
// Utils:
// - apiService: HTTP client (getUserCards, updateCardStatus)
// ==================================================================================
import React, { useState, useEffect } from 'react'; // import React (wajib untuk JSX) dan dua hooks: useState untuk state cards/load...
// import React (wajib untuk JSX) dan dua hooks: useState untuk state cards/loading/refreshing; useEffect untuk auto-load data kartu saat screen pertama kali dibuka
import { // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan de...
  // import beberapa komponen atau fungsi sekaligus dari satu modul menggunakan destructuring
  View, // View adalah container dasar React Native — setara div di HTML
  // View adalah container dasar React Native — setara div di HTML
  Text, // Text menampilkan teks statis maupun dinamis
  // Text menampilkan teks statis maupun dinamis
  TouchableOpacity, // TouchableOpacity adalah tombol dengan efek transparan saat ditekan — digunaka...
  // TouchableOpacity adalah tombol dengan efek transparan saat ditekan — digunakan untuk tombol blokir, aktifkan, tambah kartu
  ScrollView, // ScrollView memungkinkan konten di-scroll — digunakan karena daftar kartu bisa...
  // ScrollView memungkinkan konten di-scroll — digunakan karena daftar kartu bisa panjang
  Alert, // Alert menampilkan dialog popup native — digunakan untuk konfirmasi blokir kar...
  // Alert menampilkan dialog popup native — digunakan untuk konfirmasi blokir kartu dan pesan error
  RefreshControl, // RefreshControl adalah komponen khusus pull-to-refresh yang dipasang di dalam ...
  // RefreshControl adalah komponen khusus pull-to-refresh yang dipasang di dalam ScrollView
  ActivityIndicator // ActivityIndicator adalah spinner animasi — ditampilkan saat loading data kart...
  // ActivityIndicator adalah spinner animasi — ditampilkan saat loading data kartu pertama kali
} from 'react-native'; // menutup blok import dari library react-native yang menyediakan komponen UI na...
// menutup blok import dari library react-native yang menyediakan komponen UI native
import { SafeAreaView } from 'react-native-safe-area-context'; // SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home in...
// SafeAreaView memastikan konten tidak tertutup notch, status bar, atau home indicator
import { apiService } from '../utils/apiService'; // import apiService Singleton — digunakan untuk memanggil API getUserCards (amb...
// import apiService Singleton — digunakan untuk memanggil API getUserCards (ambil kartu) dan updateCardStatus (blokir/aktifkan kartu)
import styles from './MyCardsScreen.styles'; // import stylesheet dari file terpisah agar komponen tetap bersih
// import stylesheet dari file terpisah agar komponen tetap bersih

// Props yang diterima dari parent component (App.tsx atau DashboardScreen)
interface MyCardsScreenProps { // interface adalah blueprint TypeScript — mendefinisikan struktur props agar ty...
  // interface adalah blueprint TypeScript — mendefinisikan struktur props agar type-safe
  user: any; // props user bertipe any — berisi data user yang sedang login (id, name, balanc...
  // props user bertipe any — berisi data user yang sedang login (id, name, balance, dll)
  onBack: () => void; // callback function () => void — dipanggil saat user menekan tombol kembali ke ...
  // callback function () => void — dipanggil saat user menekan tombol kembali ke DashboardScreen
  onRegisterNew?: () => void; // tanda ? berarti props ini opsional — jika disediakan, dipanggil untuk navigas...
  // tanda ? berarti props ini opsional — jika disediakan, dipanggil untuk navigasi ke RegisterCardScreen
}

// Interface tipe data kartu NFC (sesuai schema Prisma di backend)
interface NFCCard { // interface mendefinisikan struktur objek kartu NFC yang diterima dari backend API
  // interface mendefinisikan struktur objek kartu NFC yang diterima dari backend API
  id: number; // Primary key di database
  // Primary key di database
  cardId: string; // UID fisik kartu NFC (format hexadecimal, contoh: 04AB12CD78)
  // UID fisik kartu NFC (format hexadecimal, contoh: 04AB12CD78)
  userId: number; // Foreign key ke tabel User — menghubungkan kartu dengan pemiliknya
  // Foreign key ke tabel User — menghubungkan kartu dengan pemiliknya
  balance: number; // Saldo kartu dalam satuan Rupiah
  // Saldo kartu dalam satuan Rupiah
  cardStatus: 'ACTIVE' | 'BLOCKED' | 'LOST' | 'EXPIRED'; // Status kartu (4 pilihan)
  // Status kartu (4 pilihan)
  cardType?: string; // Tipe kartu NFC (opsional)
  // Tipe kartu NFC (opsional)
  cardFrequency?: string; // Frekuensi RF kartu (opsional)
  // Frekuensi RF kartu (opsional)
  createdAt: string; // Tanggal registrasi (ISO 8601)
  // Tanggal registrasi (ISO 8601)
  lastUsed?: string; // Tanggal terakhir digunakan (opsional)
  // Tanggal terakhir digunakan (opsional)
}

export default function MyCardsScreen({ user, onBack, onRegisterNew }: MyCardsScreenProps) { // export default function: mendefinisikan dan mengekspor komponen React fungsio...
  // export default function: mendefinisikan dan mengekspor komponen React fungsional utama file ini
  // STATE 1: cards - Array kartu NFC milik user
  // Awalnya kosong, diisi setelah fetch dari backend
  const [cards, setCards] = useState<NFCCard[]>([]); // const membuat variabel tetap; useState<NFCCard[]>([]) membuat state array ber...
  // const membuat variabel tetap; useState<NFCCard[]>([]) membuat state array bertipe NFCCard; [] nilai awal array kosong; setCards memperbarui daftar kartu

  // STATE 2: loading - Flag loading awal (tampilkan full-screen spinner)
  const [loading, setLoading] = useState(false); // useState(false) membuat state boolean untuk loading awal; setLoading(true) di...
  // useState(false) membuat state boolean untuk loading awal; setLoading(true) dipanggil sebelum fetch data, setLoading(false) setelah selesai

  // STATE 3: refreshing - Flag pull-to-refresh (tampilkan spinner di atas scroll)
  const [refreshing, setRefreshing] = useState(false); // useState(false) membuat state boolean untuk pull-to-refresh; berbeda dengan l...
  // useState(false) membuat state boolean untuk pull-to-refresh; berbeda dengan loading — refreshing tidak menampilkan full-screen spinner

  // useEffect: Auto-load kartu saat komponen pertama kali mount
  useEffect(() => { // useEffect(callback, []) dijalankan SEKALI saat komponen pertama kali mount
    // useEffect(callback, []) dijalankan SEKALI saat komponen pertama kali mount
    loadCards(); // memanggil loadCards() untuk mengambil data kartu dari backend saat screen dibuka
    // memanggil loadCards() untuk mengambil data kartu dari backend saat screen dibuka
  }, []); // array kosong [] berarti efek ini hanya berjalan sekali saat mount
  // array kosong [] berarti efek ini hanya berjalan sekali saat mount

  // Fungsi: Ambil daftar kartu user dari backend API
  // Kebijakan: max 1 kartu per user (.slice(0, 1))
  const loadCards = async () => { // loadCards: fungsi async untuk memuat data kartu NFC user dari backend; async ...
    // loadCards: fungsi async untuk memuat data kartu NFC user dari backend; async karena melakukan HTTP request
    // Guard: pastikan user valid sebelum request API
    if (!user || !user.id) { // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      // if (!...) validasi bahwa nilai tidak kosong/null sebelum melanjutkan operasi
      console.log('⚠️ No valid user'); // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai...
      // console.log mencetak pesan debug ke terminal; membantu melacak alur dan nilai variabel
      return; // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan...
      // return tanpa nilai: menghentikan eksekusi fungsi saat ini tanpa mengembalikan apapun
    }

    setLoading(true); // Tampilkan loading spinner
    // Tampilkan loading spinner
    try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
      // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
      // Panggil API: GET /api/nfc-cards/user/:userId
      const response = await apiService.getUserCards(user.id); // const response: menyimpan response dari HTTP request; await menunggu response...
      // const response: menyimpan response dari HTTP request; await menunggu response diterima
      
      // Handle berbagai format response dari backend
      if (response && Array.isArray(response.cards)) { // memeriksa response valid dan berisi array cards; Array.isArray memastikan dat...
        // memeriksa response valid dan berisi array cards; Array.isArray memastikan data bertipe array
        // Format: { cards: [...] } - ambil hanya 1 kartu (kebijakan 1 user = 1 card)
        setCards(response.cards.slice(0, 1)); // slice(0,1) mengambil hanya elemen pertama array; sistem menerapkan kebijakan ...
        // slice(0,1) mengambil hanya elemen pertama array; sistem menerapkan kebijakan 1 user = 1 kartu
      } else if (Array.isArray(response)) { // else if: kondisi alternatif yang diperiksa jika kondisi if sebelumnya tidak t...
        // else if: kondisi alternatif yang diperiksa jika kondisi if sebelumnya tidak terpenuhi
        // Format: [...] - array langsung, ambil hanya 1 kartu
        setCards(response.slice(0, 1)); // slice(0,1) pada response langsung; fallback jika format response berupa array...
        // slice(0,1) pada response langsung; fallback jika format response berupa array langsung bukan objek
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        setCards([]); // Format tidak dikenal, set kosong
        // Format tidak dikenal, set kosong
      }
    } catch (error: any) { // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi t...
      // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
      console.error('Error loading cards:', error); // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debu...
      // console.error mencetak pesan error ke terminal dengan tanda merah; untuk debugging masalah
      if (error.message?.includes('404')) { // memeriksa apakah error adalah 404 Not Found; menangani kasus khusus kartu bel...
        // memeriksa apakah error adalah 404 Not Found; menangani kasus khusus kartu belum terdaftar
        setCards([]); // 404 = user belum punya kartu, bukan error sebenarnya
        // 404 = user belum punya kartu, bukan error sebenarnya
      } else { // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        // else: blok yang dijalankan ketika kondisi if di atasnya tidak terpenuhi (false)
        Alert.alert('Error', 'Gagal memuat data kartu'); // Error lain: tampilkan pesan
        // Error lain: tampilkan pesan
      }
    } finally { // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap...
      // finally: blok yang selalu dijalankan baik try berhasil maupun catch menangkap error
      setLoading(false); // Sembunyikan loading spinner bagaimanapun hasilnya
      // Sembunyikan loading spinner bagaimanapun hasilnya
    }
  };

  // Fungsi: Handler pull-to-refresh
  // Dipanggil saat user tarik layar ke bawah
  const onRefresh = async () => { // async karena memanggil loadCards yang berisi await
    // async karena memanggil loadCards yang berisi await
    setRefreshing(true); // setRefreshing(true) mengaktifkan spinner pull-to-refresh di RefreshControl
    // setRefreshing(true) mengaktifkan spinner pull-to-refresh di RefreshControl
    await loadCards(); // await menunggu loadCards selesai sebelum mematikan spinner
    // await menunggu loadCards selesai sebelum mematikan spinner
    setRefreshing(false); // setRefreshing(false) mematikan spinner setelah data selesai dimuat
    // setRefreshing(false) mematikan spinner setelah data selesai dimuat
  };

  // Fungsi: Handler hapus kartu (permanent delete, lalu bisa daftar kartu baru)
  const handleDeleteCard = (card: NFCCard) => { // arrow function menerima objek kartu NFCCard; menampilkan konfirmasi sebelum h...
    // arrow function menerima objek kartu NFCCard; menampilkan konfirmasi sebelum hapus permanen
    Alert.alert( // Alert.alert() menampilkan dialog konfirmasi sebelum menghapus kartu secara pe...
    // Alert.alert() menampilkan dialog konfirmasi sebelum menghapus kartu secara permanen
      '⚠️ Hapus Kartu', // judul dialog hapus kartu
      // judul dialog hapus kartu
      `Kartu ${card.cardId} akan dihapus permanen dari akun Anda.\n\nSetelah dihapus, Anda dapat mendaftarkan kartu NFC baru.\n\nLanjutkan?`, // pesan konfirmasi dengan template literal menyisipkan cardId
      // pesan konfirmasi dengan template literal menyisipkan cardId
      [
        { text: 'Batal', style: 'cancel' }, // tombol batal; style: 'cancel' memberi tampilan khusus tombol batal
        // tombol batal; style: 'cancel' memberi tampilan khusus tombol batal
        {
          text: 'Hapus', // teks tombol konfirmasi hapus
          // teks tombol konfirmasi hapus
          style: 'destructive', // style: 'destructive' menampilkan teks merah di iOS sebagai peringatan aksi be...
          // style: 'destructive' menampilkan teks merah di iOS sebagai peringatan aksi berbahaya
          onPress: async () => { // async callback dipanggil saat user menekan Hapus
            // async callback dipanggil saat user menekan Hapus
            try { // try: membungkus operasi yang berisiko error
              // try: membungkus operasi yang berisiko error
              await apiService.deleteCard(card.cardId); // await HTTP DELETE ke backend untuk hapus kartu berdasarkan cardId
              // await HTTP DELETE ke backend untuk hapus kartu berdasarkan cardId
              Alert.alert( // Alert.alert() menampilkan dialog sukses setelah kartu berhasil dihapus
              // Alert.alert() menampilkan dialog sukses setelah kartu berhasil dihapus
                'Berhasil', // judul dialog sukses
                // judul dialog sukses
                'Kartu berhasil dihapus. Anda sekarang dapat mendaftarkan kartu NFC baru.', // pesan informasi setelah hapus berhasil
                // pesan informasi setelah hapus berhasil
                [{ text: 'OK', onPress: () => onRegisterNew && onRegisterNew() }] // callback setelah OK: navigasi ke screen daftar kartu baru jika callback tersedia
                // callback setelah OK: navigasi ke screen daftar kartu baru jika callback tersedia
              );
              loadCards(); // muat ulang daftar kartu setelah hapus
              // muat ulang daftar kartu setelah hapus
            } catch (error: any) { // catch menangkap error dari deleteCard
              // catch menangkap error dari deleteCard
              Alert.alert('Error', error.message || 'Gagal menghapus kartu'); // tampilkan pesan error; || fallback jika message tidak ada
              // tampilkan pesan error; || fallback jika message tidak ada
            }
          },
        },
      ]
    );
  };

  // Fungsi: Handler aksi kartu (BLOCK atau ACTIVATE)
  // Tampilkan konfirmasi dulu sebelum eksekusi perubahan status
  const handleCardAction = async (card: NFCCard, action: 'BLOCK' | 'ACTIVATE') => { // async karena memanggil API; parameter card bertipe NFCCard; action bertipe un...
    // async karena memanggil API; parameter card bertipe NFCCard; action bertipe union string literal 'BLOCK' | 'ACTIVATE'
    const actionText = action === 'BLOCK' ? 'memblokir' : 'mengaktifkan'; // ternary operator: jika action adalah 'BLOCK' gunakan 'memblokir', jika tidak ...
    // ternary operator: jika action adalah 'BLOCK' gunakan 'memblokir', jika tidak gunakan 'mengaktifkan'
    const newStatus = action === 'BLOCK' ? 'BLOCKED' : 'ACTIVE'; // ternary menentukan nilai status baru yang akan dikirim ke backend
    // ternary menentukan nilai status baru yang akan dikirim ke backend

    Alert.alert( // Alert.alert menampilkan dialog konfirmasi sebelum eksekusi perubahan status
    // Alert.alert menampilkan dialog konfirmasi sebelum eksekusi perubahan status
      'Konfirmasi', // judul dialog konfirmasi sebelum melakukan aksi penting; mencegah aksi tidak d...
      // judul dialog konfirmasi sebelum melakukan aksi penting; mencegah aksi tidak disengaja
      `Apakah Anda yakin ingin ${actionText} kartu ini?`, // template literal ${} menyisipkan variabel ke string
      // template literal ${} menyisipkan variabel ke string
      [
        { text: 'Batal', style: 'cancel' }, // tombol batal — tidak melakukan apa-apa
        // tombol batal — tidak melakukan apa-apa
        {
          text: 'Ya', // teks tombol konfirmasi; user harus menekan 'Ya' untuk melanjutkan perubahan s...
          // teks tombol konfirmasi; user harus menekan 'Ya' untuk melanjutkan perubahan status kartu
          onPress: async () => { // async arrow function sebagai callback tombol 'Ya'
            // async arrow function sebagai callback tombol 'Ya'
            try { // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangka...
              // try: membungkus operasi yang berisiko error; jika terjadi error akan ditangkap oleh catch
              await apiService.updateCardStatus(card.cardId, newStatus); // await menunggu HTTP PUT /api/nfc-cards/:cardId/status mengubah status kartu d...
              // await menunggu HTTP PUT /api/nfc-cards/:cardId/status mengubah status kartu di backend
              Alert.alert('Berhasil', `Kartu berhasil di${actionText}`); // template literal menyisipkan actionText ke pesan
              // template literal menyisipkan actionText ke pesan
              loadCards(); // memanggil loadCards() untuk me-refresh tampilan daftar kartu setelah status b...
              // memanggil loadCards() untuk me-refresh tampilan daftar kartu setelah status berubah
            } catch (error: any) { // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi t...
              // catch (error: any): menangkap semua jenis error; any berarti tidak dibatasi tipe TypeScript
              Alert.alert('Error', error.message || `Gagal ${actionText} kartu`); // || menampilkan pesan fallback jika error.message tidak ada
              // || menampilkan pesan fallback jika error.message tidak ada
            }
          },
        },
      ]
    );
  };

  // Fungsi: Dapatkan warna badge berdasarkan status kartu
  // Digunakan untuk memberi warna visual yang berbeda tiap status
  const getStatusColor = (status: string) => { // arrow function menerima status string dan mengembalikan kode warna hex
    // arrow function menerima status string dan mengembalikan kode warna hex
    switch (status) { // switch memeriksa nilai status dan menjalankan case yang cocok
      // switch memeriksa nilai status dan menjalankan case yang cocok
      case 'ACTIVE':   return '#10B981'; // return langsung mengembalikan nilai; hijau untuk kartu aktif
      // return langsung mengembalikan nilai; hijau untuk kartu aktif
      case 'BLOCKED':  return '#EF4444'; // merah untuk kartu diblokir
      // merah untuk kartu diblokir
      case 'LOST':     return '#94a3b8'; // abu-abu untuk kartu dilaporkan hilang
      // abu-abu untuk kartu dilaporkan hilang
      case 'EXPIRED':  return '#F59E0B'; // kuning untuk kartu kadaluarsa
      // kuning untuk kartu kadaluarsa
      default:         return '#64748b'; // default dipanggil jika tidak ada case yang cocok
      // default dipanggil jika tidak ada case yang cocok
    }
  };

  const getStatusText = (status: string) => { // arrow function mengubah status kode ke teks Bahasa Indonesia
    // arrow function mengubah status kode ke teks Bahasa Indonesia
    switch (status) { // switch statement memeriksa nilai variabel status dan menjalankan blok case ya...
      // switch statement memeriksa nilai variabel status dan menjalankan blok case yang cocok
      case 'ACTIVE':   return 'Aktif'; // case ACTIVE: kartu dalam status aktif; bisa digunakan untuk transaksi
      // case ACTIVE: kartu dalam status aktif; bisa digunakan untuk transaksi
      case 'ACTIVE':   return 'Aktif'; // case cocok dengan 'ACTIVE', return langsung keluar dari switch
      // case cocok dengan 'ACTIVE', return langsung keluar dari switch
      case 'BLOCKED':  return 'Diblokir'; // case BLOCKED: kartu dalam status diblokir; tidak bisa digunakan untuk transak...
      // case BLOCKED: kartu dalam status diblokir; tidak bisa digunakan untuk transaksi sampai diaktifkan kembali
      case 'LOST':     return 'Hilang'; // case LOST: kartu dilaporkan hilang; status ini menonaktifkan kartu demi keamanan
      // case LOST: kartu dilaporkan hilang; status ini menonaktifkan kartu demi keamanan
      case 'EXPIRED':  return 'Kadaluarsa'; // case EXPIRED: kartu sudah kadaluarsa; tidak bisa digunakan lagi
      // case EXPIRED: kartu sudah kadaluarsa; tidak bisa digunakan lagi
      default:         return status; // default: jika tidak ada case yang cocok, kembalikan nilai asli string
      // default: jika tidak ada case yang cocok, kembalikan nilai asli string
    }
  };

  const formatDate = (dateString: string | undefined | null) => { // arrow function: format string tanggal ISO menjadi teks tanggal Indonesia; men...
    // arrow function: format string tanggal ISO menjadi teks tanggal Indonesia; menerima string, undefined, atau null
    if (!dateString) return '-'; // guard: kembalikan '-' jika dateString kosong/null/undefined
    // guard: kembalikan '-' jika dateString kosong/null/undefined
    const date = new Date(dateString); // konversi string tanggal ISO ke objek Date JavaScript
    // konversi string tanggal ISO ke objek Date JavaScript
    if (isNaN(date.getTime())) return '-'; // getTime() mengembalikan NaN jika string bukan tanggal valid; kembalikan '-' u...
    // getTime() mengembalikan NaN jika string bukan tanggal valid; kembalikan '-' untuk data rusak
    return date.toLocaleDateString('id-ID', { // toLocaleDateString() memformat objek Date ke string tanggal sesuai locale Ind...
      // toLocaleDateString() memformat objek Date ke string tanggal sesuai locale Indonesia
      day: '2-digit', // hari 2 digit: 01, 15, 31
      // hari 2 digit: 01, 15, 31
      month: 'short', // bulan singkat: Jan, Feb, Mar
      // bulan singkat: Jan, Feb, Mar
      year: 'numeric', // tahun penuh: 2025
      // tahun penuh: 2025
    });
  };

  // ── RENDER KONDISIONAL: Loading State (awal, belum ada data) ──
  // Tampilkan full-screen spinner HANYA saat loading pertama kali
  // (bukan saat pull-to-refresh, karena pull-to-refresh punya spinner sendiri)
  if (loading && cards.length === 0) { // if memeriksa dua kondisi sekaligus dengan &&; loading=true DAN belum ada data...
    // if memeriksa dua kondisi sekaligus dengan &&; loading=true DAN belum ada data kartu — tampilkan full-screen spinner
    return ( // early return menampilkan UI loading alternatif
    // early return menampilkan UI loading alternatif
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daftar Kartu</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Memuat kartu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── RENDER UTAMA: Daftar Kartu ──
  return ( // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
  // return JSX: mengembalikan elemen UI yang akan dirender oleh React ke layar
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daftar Kartu</Text>
        <View style={styles.headerSpacer} />
      </View> menerapkan objek style yang sudah didefinisikan di StyleSheet */}
      {/* refreshControl prop untuk menambahkan fitur pull-to-refresh */}
      {/* showsVerticalScrollIndicator={false} menyembunyikan scrollbar vertikal */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.pageSubtitle}>
            Kelola kartu NFC yang terdaftar di akun Anda.
          </Text>
          {cards.length === 0 ? ( // Tampilkan pesan kosong jika user belum punya kartu
            // Tampilkan pesan kosong jika user belum punya kartu
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyTitle}>Belum Ada Kartu</Text>
              <Text style={styles.emptyText}>
                Daftarkan kartu NFC Anda untuk mulai melakukan transaksi
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={onRegisterNew || (() => {})}
              >
                <Text style={styles.addButtonIcon}>➕</Text>
                <Text style={styles.addButtonText}>Tambah Kartu</Text>
              </TouchableOpacity>
            </View>
          ) : ( // bagian else dari ternary: tampilan saat ada kartu
            // bagian else dari ternary: tampilan saat ada kartu
            <>
              {cards.map((card, index) => (
                <View key={card.id || index} style={styles.cardItem}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>
                        {index === 0 ? 'Kartu Utama' : `Kartu ${index + 1}`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${getStatusColor(card.cardStatus)}20` },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(card.cardStatus) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(card.cardStatus) },
                        ]}
                      >
                        {getStatusText(card.cardStatus)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.cardVisual}>
                      <View style={styles.cardVisualGradient}>
                        <View style={styles.cardChip}>
                          <Text style={styles.cardChipIcon}>💳</Text>
                        </View>
                        <View style={styles.cardNfcIcon}>
                          <Text style={styles.cardNfcText}>)))</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.cardDetails}>
                      <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>UID Kartu</Text>
                        <View style={styles.cardUidBox}>
                          <Text style={styles.cardUidText}>{card.cardId}</Text>
                          <TouchableOpacity style={styles.copyIconButton}>
                            <Text style={styles.copyIconText}>📋</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Tipe Kartu & Frekuensi</Text>
                        <Text style={styles.cardValue}>
                          {card.cardType || 'NTag215'} • {card.cardFrequency || '13.56 MHz'}
                        </Text>
                      </View>

                      <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Saldo</Text>
                        <Text style={styles.cardBalance}>
                          Rp{(card.balance ?? 0).toLocaleString('id-ID')}
                        </Text>
                      </View>
                      {card.lastUsed && (
                        <View style={styles.cardRow}>
                          <Text style={styles.cardLabel}>Terakhir Digunakan</Text>
                          <Text style={styles.cardValue}>{formatDate(card.lastUsed)}</Text>
                        </View>
                      )}

                      <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Terdaftar Sejak</Text>
                        <Text style={styles.cardValue}>{formatDate(card.createdAt)}</Text>
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      {card.cardStatus === 'ACTIVE' ? ( // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
                        // TouchableOpacity: tombol interaktif dengan efek transparansi saat ditekan
                        // onPress menghubungkan event tap ke fungsi handleCardAction
                        <TouchableOpacity
                          style={styles.blockButton}
                          onPress={() => handleCardAction(card, 'BLOCK')}
                        >
                          <Text style={styles.blockButtonIcon}>🚫</Text>
                          <Text style={styles.blockButtonText}>Blokir Kartu</Text>
                        </TouchableOpacity>
                      ) : card.cardStatus === 'BLOCKED' ? ( // nested ternary: jika BLOCKED tampilkan tombol aktivasi
                        // nested ternary: jika BLOCKED tampilkan tombol aktivasi
                        <TouchableOpacity
                          style={styles.activateButton}
                          onPress={() => handleCardAction(card, 'ACTIVATE')}
                        >
                          <Text style={styles.activateButtonIcon}>✅</Text>
                          <Text style={styles.activateButtonText}>Aktifkan Kartu</Text>
                        </TouchableOpacity>
                      ) : null}
                      {/* Tombol Hapus Kartu — selalu tampil agar user bisa ganti kartu */}
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteCard(card)}
                      >
                        <Text style={styles.deleteButtonIcon}>🗑️</Text>
                        <Text style={styles.deleteButtonText}>Hapus Kartu</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              <View style={styles.policyInfo}>
                <Text style={styles.policyIcon}>📌</Text>
                <View style={styles.policyTextContainer}>
                  <Text style={styles.policyTitle}>Kebijakan Kartu</Text>
                  <Text style={styles.policyText}>
                    Saat ini sistem menerapkan kebijakan 1 USER = 1 CARD untuk keamanan.
                    Pastikan kartu Anda selalu aman.
                  </Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.securityInfo}>
            <Text style={styles.securityIcon}>🛡️</Text>
            <Text style={styles.securityText}>
              Gunakan kartu NFC untuk pembayaran cepat dan aman. Pastikan kartu Anda
              selalu aman.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


