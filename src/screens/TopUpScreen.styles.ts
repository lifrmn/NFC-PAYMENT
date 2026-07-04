// src/screens/TopUpScreen.styles.ts
import { StyleSheet } from 'react-native'; // import API styling React Native untuk membuat objek style terpusat

const styles = StyleSheet.create({ // StyleSheet.create() mengoptimalkan style dan memberikan validasi tipe di TypeScript

  // ── Layar utama ──
  container: {
    flex: 1, // mengisi seluruh tinggi layar
    backgroundColor: '#f8fafc', // latar abu-abu sangat muda (slate-50)
  },

  // ── Header ──
  header: {
    flexDirection: 'row', // elemen berjajar horizontal
    alignItems: 'center', // rata tengah vertikal
    justifyContent: 'space-between', // kiri, tengah, kanan dipisah rata
    paddingHorizontal: 20, // padding kiri-kanan
    paddingVertical: 16, // padding atas-bawah
    backgroundColor: '#fff', // latar putih
    borderBottomWidth: 1, // garis bawah tipis
    borderBottomColor: '#f1f5f9', // warna garis bawah abu muda
  },
  backButton: {
    width: 40, // lebar area sentuh tombol kembali
    height: 40, // tinggi area sentuh tombol kembali
    borderRadius: 20, // bulat sempurna
    backgroundColor: '#f8fafc', // latar abu sangat muda
    justifyContent: 'center', // ikon di tengah vertikal
    alignItems: 'center', // ikon di tengah horizontal
  },
  backIcon: { fontSize: 24, color: '#1e293b' }, // ukuran dan warna ikon panah kembali
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' }, // judul header semi-bold warna gelap
  headerSpacer: { width: 40 }, // spacer kanan agar judul presisi di tengah

  scrollView: { flex: 1 }, // ScrollView mengisi sisa ruang di bawah header
  content: { padding: 20 }, // padding konten dalam ScrollView

  // ── Kartu saldo saat ini ──
  balanceCard: {
    borderRadius: 20, // sudut membulat modern
    backgroundColor: '#3B82F6', // biru utama brand
    padding: 20, // padding dalam kartu
    marginBottom: 20, // jarak ke section berikutnya
    shadowColor: '#3B82F6', // glow biru
    shadowOffset: { width: 0, height: 6 }, // bayangan ke bawah
    shadowOpacity: 0.3, // bayangan 30%
    shadowRadius: 12, // blur bayangan
    elevation: 6, // shadow Android
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }, // label teks saldo kecil transparan
  balanceAmount: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 }, // angka saldo besar putih tebal
  balanceCardId: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }, // UID kartu kecil monospace
  noCardText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', padding: 8 }, // teks jika belum ada kartu

  // ── Section pilih kartu ──
  sectionCard: {
    backgroundColor: '#fff', // latar putih
    borderRadius: 16, // sudut membulat
    padding: 16, // padding dalam section
    marginBottom: 16, // jarak ke section berikutnya
    shadowColor: '#000', // warna bayangan hitam
    shadowOffset: { width: 0, height: 2 }, // bayangan tipis ke bawah
    shadowOpacity: 0.06, // bayangan sangat tipis
    shadowRadius: 8, // blur bayangan
    elevation: 2, // shadow Android minimal
  },
  sectionTitle: {
    fontSize: 15, // ukuran judul section
    fontWeight: '600', // semi-bold
    color: '#1e293b', // navy gelap
    marginBottom: 12, // jarak ke konten section
  },

  // ── Kartu pilihan (scrollable horizontal) ──
  cardPickerRow: { flexDirection: 'row', gap: 10 }, // baris tombol pilih kartu berjajar horizontal dengan gap
  cardOption: {
    flex: 1, // setiap opsi mengisi ruang secara merata
    borderWidth: 2, // border tebal agar jelas
    borderColor: '#e2e8f0', // border abu muda (tidak dipilih)
    borderRadius: 12, // sudut membulat
    padding: 12, // padding dalam opsi
    alignItems: 'center', // konten di tengah horizontal
    backgroundColor: '#f8fafc', // latar abu sangat muda
  },
  cardOptionSelected: {
    borderColor: '#3B82F6', // border biru saat dipilih
    backgroundColor: '#EFF6FF', // latar biru sangat muda saat dipilih
  },
  cardOptionId: { fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 4 }, // UID kartu kecil monospace
  cardOptionBalance: { fontSize: 13, fontWeight: '600', color: '#1e293b' }, // saldo kartu semi-bold
  cardOptionStatus: { fontSize: 11, marginTop: 2 }, // teks status kartu kecil

  // ── Nominal preset ──
  presetGrid: {
    flexDirection: 'row', // tombol berjajar horizontal
    flexWrap: 'wrap', // wrap ke baris baru jika melebihi lebar
    gap: 10, // jarak antar tombol
  },
  presetBtn: {
    width: '30%', // sekitar 3 tombol per baris
    paddingVertical: 12, // padding atas-bawah
    borderRadius: 12, // sudut membulat
    backgroundColor: '#EFF6FF', // biru sangat muda (tidak dipilih)
    borderWidth: 1, // border tipis
    borderColor: '#BFDBFE', // border biru muda
    alignItems: 'center', // teks di tengah
  },
  presetBtnSelected: {
    backgroundColor: '#3B82F6', // biru penuh saat dipilih
    borderColor: '#3B82F6', // border biru penuh saat dipilih
  },
  presetText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' }, // teks nominal biru gelap
  presetTextSelected: { color: '#fff' }, // teks putih saat preset dipilih

  // ── Input nominal custom ──
  customAmountRow: {
    flexDirection: 'row', // prefix Rp dan input berjajar
    alignItems: 'center', // rata tengah vertikal
    borderWidth: 1, // border tipis
    borderColor: '#e2e8f0', // border abu muda
    borderRadius: 12, // sudut membulat
    paddingHorizontal: 14, // padding kiri-kanan
    backgroundColor: '#fff', // latar putih
    marginTop: 12, // jarak dari grid preset
  },
  currencyPrefix: { fontSize: 14, color: '#64748b', marginRight: 6 }, // teks 'Rp' sebelum input
  customAmountInput: {
    flex: 1, // input mengisi sisa ruang di samping prefix Rp
    paddingVertical: 12, // padding atas-bawah
    fontSize: 16, // ukuran teks input
    color: '#1e293b', // warna teks navy gelap
  },

  // ── Tombol submit ──
  submitBtn: {
    marginTop: 20, // jarak dari konten di atas
    borderRadius: 16, // sudut membulat besar
    paddingVertical: 16, // padding atas-bawah
    alignItems: 'center', // teks di tengah
    backgroundColor: '#10B981', // hijau emerald untuk aksi positif
    shadowColor: '#10B981', // glow hijau
    shadowOffset: { width: 0, height: 4 }, // bayangan ke bawah
    shadowOpacity: 0.25, // bayangan 25%
    shadowRadius: 8, // blur bayangan
    elevation: 4, // shadow Android
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF', // abu-abu saat tombol tidak aktif
    shadowOpacity: 0, // hapus shadow saat disabled
    elevation: 0, // hapus shadow Android saat disabled
  },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' }, // teks tombol submit putih tebal

  // ── Loading ──
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, // container loading mengisi layar dan tengah-kan spinner
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' }, // teks loading di bawah spinner

  // ── Ringkasan nominal ──
  summaryRow: {
    flexDirection: 'row', // label dan nilai berjajar horizontal
    justifyContent: 'space-between', // label di kiri, nilai di kanan
    paddingVertical: 6, // padding atas-bawah setiap baris
  },
  summaryLabel: { fontSize: 13, color: '#64748b' }, // label abu-abu sedang
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' }, // nilai navy semi-bold
  summaryValueGreen: { fontSize: 13, fontWeight: '700', color: '#10B981' }, // nilai total hijau tebal
});

export default styles; // export default mengekspor objek styles sebagai ekspor default file ini
