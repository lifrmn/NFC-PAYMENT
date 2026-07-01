// src/screens/TopUpScreen.styles.ts
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 24, color: '#1e293b' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  headerSpacer: { width: 40 },

  scrollView: { flex: 1 },
  content: { padding: 20 },

  // ── Kartu saldo saat ini ──
  balanceCard: {
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  balanceAmount: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  balanceCardId: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' },
  noCardText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', padding: 8 },

  // ── Section pilih kartu ──
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },

  // ── Kartu pilihan (scrollable horizontal) ──
  cardPickerRow: { flexDirection: 'row', gap: 10 },
  cardOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  cardOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  cardOptionId: { fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 4 },
  cardOptionBalance: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  cardOptionStatus: { fontSize: 11, marginTop: 2 },

  // ── Nominal preset ──
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetBtn: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  presetBtnSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  presetText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  presetTextSelected: { color: '#fff' },

  // ── Input nominal custom ──
  customAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  currencyPrefix: { fontSize: 14, color: '#64748b', marginRight: 6 },
  customAmountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },

  // ── Tombol submit ──
  submitBtn: {
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

  // ── Loading ──
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },

  // ── Ringkasan nominal ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  summaryValueGreen: { fontSize: 13, fontWeight: '700', color: '#10B981' },
});

export default styles;
