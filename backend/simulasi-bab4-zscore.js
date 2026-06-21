/**
 * ============================================================================
 * SIMULASI BAB IV — Z-Score Based Anomaly Detection
 * Tiga Skenario: ALLOW (Andri), REVIEW (Ibnu), BLOCK (Adit)
 * ============================================================================
 * Formula:
 *   μ  = (1/n) Σ Xi                     ...(mean)
 *   σ² = Σ(Xi − μ)² / (n − 1)          ...(sample variance, Bessel's correction)
 *   σ  = √σ²                            ...(standar deviasi)
 *   Z  = (X − μ) / σ                   ...(Z-Score)
 *
 * Keputusan:
 *   Z ≤ 2          → ALLOW  (transaksi normal)
 *   2 < Z ≤ 3      → REVIEW (mencurigakan, perlu tinjauan)
 *   Z > 3          → BLOCK  (anomali kritis, diblokir)
 * ============================================================================
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Fungsi inti (sama persis dengan backend/utils/fraudDetection.js)          */
/* -------------------------------------------------------------------------- */
const HISTORY_SIZE = 20;

function analyzeZScoreAnomaly(currentAmount, historicalTxs) {
  const samples = historicalTxs.slice(0, HISTORY_SIZE).map(t => Number(t.amount));
  const n = samples.length;

  if (n === 0) {
    return {
      zScore: 0, decision: 'ALLOW', mean: 0, variance: 0, stdDev: 0, n: 0,
      reasons: ['Tidak ada riwayat transaksi — transaksi pertama diizinkan'],
    };
  }

  const mean = samples.reduce((s, v) => s + v, 0) / n;

  // Sample variance: Bessel's correction (n - 1)
  const squaredDeviations = samples.map(v => Math.pow(v - mean, 2));
  const sumSq = squaredDeviations.reduce((s, v) => s + v, 0);
  const variance = n > 1 ? sumSq / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  let zScore;
  let zScoreIsUndefined = false;
  if (stdDev === 0) {
    if (currentAmount === mean) {
      // Transaksi identik dengan pola historis → Z = 0 → ALLOW
      zScore = 0;
    } else {
      // sigma = 0 dan nilai berbeda → anomali matematis (Z tidak terdefinisi)
      // Keputusan BLOCK karena distribusi degenerasi tidak toleransi penyimpangan.
      // Threshold tetap Z > 3; ini adalah edge case, bukan threshold baru.
      zScore = null;
      zScoreIsUndefined = true;
    }
  } else {
    zScore = Math.abs(currentAmount - mean) / stdDev;
  }

  const decision = zScoreIsUndefined ? 'BLOCK'
    : zScore <= 2 ? 'ALLOW'
    : zScore <= 3 ? 'REVIEW'
    : 'BLOCK';

  const reasons = [];
  const zLabel = zScoreIsUndefined ? 'tidak terdefinisi (σ=0, edge case)' : zScore.toFixed(4);
  if (decision === 'ALLOW')  reasons.push(`Z-Score ${zLabel} ≤ 2 — transaksi normal, tidak ada anomali`);
  if (decision === 'REVIEW') reasons.push(`Z-Score ${zLabel} berada di zona 2 < Z ≤ 3 — transaksi mencurigakan, perlu tinjauan`);
  if (decision === 'BLOCK' && zScoreIsUndefined)
    reasons.push(`Edge case σ=0: Z tidak terdefinisi — penyimpangan dari pola identik → BLOCK (threshold tetap Z > 3)`);
  else if (decision === 'BLOCK')
    reasons.push(`Z-Score ${zLabel} > 3 — anomali kritis terdeteksi, transaksi diblokir`);

  return {
    zScore:   zScoreIsUndefined ? null : Math.round(zScore   * 10000) / 10000,
    decision,
    mean:     Math.round(mean     * 100)   / 100,
    variance: Math.round(variance * 100)   / 100,
    stdDev:   Math.round(stdDev   * 10000) / 10000,
    n,
    samples,
    squaredDeviations: squaredDeviations.map(d => Math.round(d * 100) / 100),
    sumSquaredDeviations: Math.round(sumSq * 100) / 100,
    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/*  Fungsi bantu tampilan                                                      */
/* -------------------------------------------------------------------------- */
function printSeparator(char = '─', len = 72) {
  console.log(char.repeat(len));
}

function printTable(headers, rows, colWidths) {
  const line = colWidths.map(w => '─'.repeat(w));
  const rowStr = (cells) => cells.map((c, i) => String(c).padStart(colWidths[i])).join(' │ ');

  console.log('┌' + line.join('─┬─') + '┐');
  console.log('│ ' + rowStr(headers) + ' │');
  console.log('├' + line.join('─┼─') + '┤');
  rows.forEach(r => console.log('│ ' + rowStr(r) + ' │'));
  console.log('└' + line.join('─┴─') + '┘');
}

function runSimulation(label, userName, historicalAmounts, transactionAmount) {
  const historicalTxs = historicalAmounts.map(a => ({ amount: a }));
  const result = analyzeZScoreAnomaly(transactionAmount, historicalTxs);

  const formatRp = (n) => `Rp${Number(n).toLocaleString('id-ID')}`;

  console.log('');
  printSeparator('═');
  console.log(`  SIMULASI ${label}: ${userName.toUpperCase()} — KEPUTUSAN: ${result.decision}`);
  printSeparator('═');

  // Tabel 1: Histori 20 Transaksi
  console.log('\n  [Tabel 1] Data Historis 20 Transaksi Terakhir (Baseline)\n');
  const txRows = result.samples.map((v, i) => [
    (i + 1).toString(),
    `X${i + 1}`,
    formatRp(v),
    formatRp(result.mean),
    formatRp(v - result.mean),
    formatRp(result.squaredDeviations[i]),
  ]);
  printTable(
    ['No', 'Variabel', 'Xi (Rp)', 'μ (Rp)', 'Xi − μ', '(Xi − μ)²'],
    txRows,
    [4, 9, 15, 15, 14, 16],
  );

  // Tabel 2: Perhitungan Z-Score
  console.log('\n  [Tabel 2] Ringkasan Perhitungan Z-Score\n');
  const calcRows = [
    ['n (jumlah data)',        result.n.toString()],
    ['μ (mean)',               formatRp(result.mean)],
    ['Σ(Xi − μ)²',            formatRp(result.sumSquaredDeviations)],
    ['σ² = Σ(Xi−μ)²/(n−1)',   formatRp(result.variance)],
    ['σ (std deviasi)',        formatRp(result.stdDev)],
    ['X (transaksi baru)',     formatRp(transactionAmount)],
    ['X − μ',                 formatRp(transactionAmount - result.mean)],
    ['Z = |X − μ| / σ',       result.zScore !== null ? result.zScore.toFixed(4) : 'tidak terdefinisi (σ=0)'],
    ['Keputusan',              result.decision],
    ['Keterangan',             result.reasons[0]],
  ];
  printTable(['Parameter', 'Nilai'], calcRows, [28, 60]);

  // Simpulan
  console.log('');
  console.log(`  ➤ Nama           : ${userName}`);
  console.log(`  ➤ Transaksi Baru : ${formatRp(transactionAmount)}`);
  console.log(`  ➤ Z-Score        : ${result.zScore !== null ? result.zScore.toFixed(4) : 'tidak terdefinisi (σ=0, edge case)'}`);
  console.log(`  ➤ Keputusan      : ${result.decision}`);
  console.log(`  ➤ Keterangan     : ${result.reasons[0]}`);
  console.log('');

  return result;
}

/* -------------------------------------------------------------------------- */
/*  Data Simulasi                                                              */
/* -------------------------------------------------------------------------- */

// ─────────────────────────────────────────────────────────────────────────────
// SIMULASI A: Andri — ALLOW (Z ≤ 2)
// Histori: transaksi bervariasi Rp48.000–Rp52.000 (μ=50.000, σ≈1.414,21)
// Transaksi baru X = Rp52.000  →  Z = 2.000/1.414,21 ≈ 1,4142
// ─────────────────────────────────────────────────────────────────────────────
const andriHistory = [
  50000, 48000, 52000, 49000, 51000,
  50000, 48000, 52000, 50000, 49000,
  51000, 50000, 48000, 52000, 50000,
  49000, 51000, 50000, 48000, 52000,
];
const andriNewTx = 52000;

// ─────────────────────────────────────────────────────────────────────────────
// SIMULASI B: Ibnu — REVIEW (2 < Z ≤ 3)
// Histori: bervariasi Rp45.000–Rp55.000 (μ=50.000, σ≈3.797,51)
// Transaksi baru X = Rp60.000  →  Z = 10.000/3.797,51 ≈ 2,6333
// ─────────────────────────────────────────────────────────────────────────────
const ibnuHistory = [
  45000, 55000, 48000, 52000, 46000,
  54000, 47000, 53000, 45000, 55000,
  48000, 52000, 46000, 54000, 47000,
  53000, 45000, 55000, 48000, 52000,
];
const ibnuNewTx = 60000;

// ─────────────────────────────────────────────────────────────────────────────
// SIMULASI C: Adit — BLOCK (Z > 3)
// Histori: sangat konsisten Rp49.000–Rp51.000 (μ=50.000, σ≈794,72)
// Transaksi baru X = Rp54.000  →  Z = |54.000 − 50.000| / 794,72 = 4000 / 794,72 ≈ 5,0332
// ─────────────────────────────────────────────────────────────────────────────
const aditHistory = [
  49000, 51000, 50000, 49000, 51000,
  50000, 49000, 51000, 50000, 50000,
  49000, 51000, 50000, 49000, 51000,
  50000, 49000, 51000, 50000, 50000,
];
const aditNewTx = 54000;

/* -------------------------------------------------------------------------- */
/*  Jalankan simulasi                                                          */
/* -------------------------------------------------------------------------- */
console.log('');
console.log('  ╔══════════════════════════════════════════════════════════════════════╗');
console.log('  ║      SIMULASI BAB IV — Z-Score Based Anomaly Detection             ║');
console.log('  ║      Sistem Pembayaran Digital NFC dengan Deteksi Fraud AI          ║');
console.log('  ╚══════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('  Algoritma   : Z-Score Based Anomaly Detection');
console.log('  Baseline    : 20 transaksi historis terakhir (n = 20)');
console.log('  Variansi    : Sample variance — Bessel\'s correction (n − 1)');
console.log('  Threshold   : Z ≤ 2 → ALLOW │ 2 < Z ≤ 3 → REVIEW │ Z > 3 → BLOCK');

const rA = runSimulation('A', 'Andri', andriHistory, andriNewTx);
const rB = runSimulation('B', 'Ibnu',  ibnuHistory,  ibnuNewTx);
const rC = runSimulation('C', 'Adit',  aditHistory,  aditNewTx);

/* -------------------------------------------------------------------------- */
/*  Tabel ringkasan akhir                                                      */
/* -------------------------------------------------------------------------- */
console.log('');
printSeparator('═');
console.log('  TABEL RINGKASAN SIMULASI');
printSeparator('═');
printTable(
  ['Pengguna', 'μ (Rp)', 'σ (Rp)', 'X Baru (Rp)', 'Z-Score', 'Keputusan'],
  [
    ['Andri',  '50.000', '1.414,21', '52.000', rA.zScore !== null ? rA.zScore.toFixed(4) : 'undef(σ=0)', rA.decision],
    ['Ibnu',   '50.000', '3.797,51', '60.000', rB.zScore !== null ? rB.zScore.toFixed(4) : 'undef(σ=0)', rB.decision],
    ['Adit',   '50.000',   '794,72', '54.000', rC.zScore !== null ? rC.zScore.toFixed(4) : 'undef(σ=0)', rC.decision],
  ],
  [9, 12, 10, 13, 12, 10],
);

console.log('');
console.log('  Keterangan Keputusan:');
console.log('   ALLOW  — Transaksi diizinkan, Z-Score ≤ 2 (normal)');
console.log('   REVIEW — Transaksi diteruskan tetapi dicatat sebagai mencurigakan (2 < Z ≤ 3)');
console.log('   BLOCK  — Transaksi ditolak, fraud alert dibuat (Z > 3)');
console.log('');
