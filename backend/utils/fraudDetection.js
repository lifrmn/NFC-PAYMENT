
// ============================================================================
// FORMULA UTAMA:
//
//   Mean:
//     mu = SUM(Xi) / n
//
//   Sample Variance (Bessel's Correction):
//     sigma2 = SUM((Xi - mu)^2) / (n - 1)
//
//   Standard Deviation:
//     sigma = SQRT(sigma2)
//
//   Z-Score:
//     Z = (X - mu) / sigma
//     di mana X = nominal transaksi baru (transaksi ke-21)
//
// ATURAN KEPUTUSAN:
//   Z <= 2        → ALLOW  (transaksi normal, dalam batas 2-sigma)
//   2 < Z <= 3    → REVIEW (mencurigakan, perlu review admin)
//   Z > 3         → BLOCK  (anomali terdeteksi, transaksi ditolak)
//
// WINDOW HISTORI:
//   n = 20 transaksi terakhir pengguna yang sama (HISTORY_SIZE)
//   Transaksi ke-21 (X) adalah transaksi yang diuji
//   X tidak dimasukkan ke dalam perhitungan mu, sigma2, dan sigma
//   Data ke-21 hanya digunakan sebagai nilai X pada rumus Z-Score
// ============================================================================

const HISTORY_SIZE = 20; // const membuat variabel tetap; HISTORY_SIZE adalah konstanta yang menyimpan jumlah transaksi historis yang digunakan sebagai window baseline untuk perhitungan Z-Score; nilai 20 dipilih berdasarkan prinsip statistik: cukup untuk menghitung mean dan standar deviasi yang representatif

// ============================================================================
// FUNGSI UTAMA: analyzeZScoreAnomaly()
// ============================================================================
// Mendeteksi anomali transaksi menggunakan Z-Score Based Anomaly Detection
// berdasarkan 20 transaksi historis terakhir pengguna (window histori).
//
// Parameter:
//   currentAmount  (Number)  - Nominal transaksi yang diuji (X = transaksi ke-21)
//   historicalTxs  (Array)   - Array objek transaksi historis [{amount, createdAt, ...}]
//                              Urutan: transaksi terbaru di indeks 0 (DESC order)
//
// Return: objek dengan zScore, decision, mean, variance, stdDev, n, reasons,
//         historicalAmounts, deviations, algorithm, historySize, thresholds
// ============================================================================
function analyzeZScoreAnomaly(currentAmount, historicalTxs) {
  // .slice(0, HISTORY_SIZE) → ambil maksimal 20 elemen pertama dari array historis
  // Jika array lebih dari 20, sisanya diabaikan — hanya 20 terbaru yang dipakai sebagai baseline
  const last20 = historicalTxs.slice(0, HISTORY_SIZE);

  // .map(tx => tx.amount) → ekstrak hanya field `amount` dari setiap objek transaksi
  // Hasilnya array angka murni, misalnya [10000, 12000, ...] — lebih mudah dihitung
  const amounts = last20.map(tx => tx.amount);

  // .length → jumlah elemen array setelah di-slice
  // n adalah n pada rumus statistik — mewakili jumlah data historis yang tersedia
  const n = amounts.length;

  // ============================================================================
  // GUARD: Cek kecukupan data historis sebelum melakukan perhitungan Z-Score
  // Z-Score tidak valid jika data historis kurang dari 20 karena:
  //   - Mean dan standar deviasi yang dihitung dari sedikit data tidak representatif
  //   - Hasil Z-Score akan terlalu tidak stabil untuk dijadikan dasar keputusan
  // Seluruh kondisi n < 20 (termasuk n = 0) dikembalikan sebagai ALLOW sementara
  // ============================================================================
  if (n < HISTORY_SIZE) {
    return {
      zScore: 0,          // Z tidak dihitung — dikembalikan 0 sebagai nilai aman
      decision: 'ALLOW',  // Transaksi diizinkan karena belum ada cukup baseline
      riskLevel: 'NORMAL',

      // Hitung mean parsial hanya jika ada data (n > 0), jika tidak kembalikan 0
      // Operator ternary: kondisi ? nilai_jika_benar : nilai_jika_salah
      mean: n > 0 ? parseFloat((amounts.reduce((s, x) => s + x, 0) / n).toFixed(2)) : 0,

      variance: 0,      // Variance tidak dihitung, tidak cukup data
      stdDev: 0,        // Standar deviasi tidak dihitung, tidak cukup data
      n,                // Shorthand ES6: sama dengan n: n — jumlah data yang ada
      historyCount: n,  // Alias dari n, dipakai untuk konsistensi field di response API

      // Array reasons berisi pesan yang akan ditampilkan di dashboard admin
      // String concatenation (+) dipakai untuk menyisipkan nilai variabel ke dalam pesan
      reasons: [
        'INSUFFICIENT_HISTORY: Baseline belum cukup (' + n + '/' + HISTORY_SIZE + ' transaksi)',
        'Transaksi diizinkan sementara sambil membangun histori',
        'Klasifikasi Z-Score aktif setelah histori mencapai ' + HISTORY_SIZE + ' transaksi'
      ],

      historicalAmounts: amounts, // Data amount mentah dikembalikan untuk keperluan audit
      deviations: [],             // Kosong karena perhitungan deviasi tidak dilakukan
      algorithm: 'Z-Score Based Anomaly Detection',
      historySize: HISTORY_SIZE,          // Konstanta 20 — jumlah minimum data yang dibutuhkan
      thresholds: { allow: 2, review: 3 } // Batas klasifikasi Z-Score yang berlaku
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 1: Hitung Mean / Rata-rata (μ)
  // μ adalah pusat pola transaksi user — acuan untuk mengukur seberapa jauh
  // transaksi baru menyimpang dari perilaku normal user
  // ─────────────────────────────────────────────────────────────────────────

  // .reduce((sum, x) => sum + x, 0) → akumulasi: mulai dari 0, tambahkan tiap elemen
  // Hasilnya adalah total penjumlahan semua amount historis → Σ(Xi)
  const sumAmounts = amounts.reduce((sum, x) => sum + x, 0);

  // Bagi total dengan jumlah data → menghasilkan rata-rata (μ = Σ(Xi) / n)
  const mean = sumAmounts / n;

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 2: Hitung Deviasi dan Kuadrat Deviasi setiap Xi
  // Tujuan: mengukur seberapa jauh setiap transaksi historis menyimpang dari mean
  // Deviasi dikuadratkan agar nilai negatif dan positif tidak saling menghilangkan
  // ─────────────────────────────────────────────────────────────────────────

  // .map((xi, i) => ...) → transformasi setiap elemen array menjadi objek baru
  // xi = nilai amount pada indeks ke-i, i = indeks (mulai dari 0)
  const deviations = amounts.map((xi, i) => ({
    index: i + 1,          // Nomor urut 1-based (i dimulai dari 0, jadi +1)
    xi,                    // Nilai transaksi historis ke-i (shorthand ES6: xi: xi)
    dev: xi - mean,        // Deviasi: selisih xi terhadap mean, bisa negatif jika xi < mean
    devSq: Math.pow(xi - mean, 2) // Math.pow(a, 2) = a² → kuadrat deviasi, selalu ≥ 0
  }));

  // Jumlahkan semua kuadrat deviasi menggunakan reduce → menghasilkan Σ(Xi - μ)²
  // d.devSq adalah kuadrat deviasi dari setiap elemen yang sudah dihitung di atas
  const sumSquaredDiff = deviations.reduce((sum, d) => sum + d.devSq, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 3: Hitung Sample Variance (σ²) dengan Bessel's Correction
  // Variance mengukur rata-rata kuadrat penyimpangan dari mean
  // Dibagi (n-1) bukan n karena data ini adalah SAMPEL dari populasi transaksi user
  // ─────────────────────────────────────────────────────────────────────────

  // Operator ternary: jika n > 1 hitung variance, jika tidak kembalikan 0
  // Guard n > 1 melindungi dari pembagian dengan nol saat n = 1 (n-1 = 0)
  // Bessel's Correction: pembagi (n-1) menghasilkan estimasi variance yang tidak bias
  const variance = n > 1 ? sumSquaredDiff / (n - 1) : 0; // σ² = Σ(Xi - μ)² / (n - 1)

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 4: Hitung Standard Deviation / Simpangan Baku (σ)
  // Akar dari variance — mengembalikan satuan ke Rupiah (bukan Rp²)
  // σ menyatakan: rata-rata besar penyimpangan tiap transaksi historis dari mean
  // ─────────────────────────────────────────────────────────────────────────

  // Math.sqrt() → fungsi akar kuadrat bawaan JavaScript → σ = √σ²
  // Jika variance = 0, maka stdDev = √0 = 0 → masuk ke edge case di langkah 5
  const stdDev = Math.sqrt(variance);

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 5: Hitung Z-Score untuk transaksi baru (X = currentAmount)
  // Z mengukur: transaksi baru menyimpang BERAPA KALI lipat dari σ?
  // Rumus: Z = |X - μ| / σ
  // ─────────────────────────────────────────────────────────────────────────

  // Deklarasi `let` (bukan `const`) karena nilai zScore ditentukan secara kondisional
  let zScore;

  // Flag boolean untuk menandai apakah Z-Score tidak terdefinisi (kasus σ = 0, X ≠ μ)
  // Dipakai di langkah 6 untuk paksa decision = BLOCK tanpa perlu membandingkan nilai null
  let zScoreIsUndefined = false;

  if (stdDev === 0) {
    // σ = 0 berarti semua 20 transaksi historis bernilai SAMA PERSIS
    // Pembagian dengan 0 menghasilkan Infinity di JavaScript — tidak bisa dipakai

    if (currentAmount === mean) {
      // X sama persis dengan μ → tidak ada penyimpangan → Z = 0 → transaksi normal
      zScore = 0;
    } else {
      // X berbeda dari μ → ada penyimpangan, tapi σ = 0 sehingga Z tidak bisa dihitung
      // Secara statistik: distribusi degenerasi tidak dapat menoleransi penyimpangan apapun
      zScore = null;            // null menandakan Z tidak terdefinisi secara matematis
      zScoreIsUndefined = true; // Aktifkan flag → langkah 6 akan paksa BLOCK
    }
  } else {
    // σ > 0 → kondisi normal, Z bisa dihitung dengan rumus standar
    // Math.abs() → nilai absolut agar Z selalu positif (tidak peduli di atas/bawah mean)
    zScore = Math.abs(currentAmount - mean) / stdDev;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 6: Klasifikasi Z-Score → Keputusan (ALLOW / REVIEW / BLOCK)
  // Berdasarkan Three-Sigma Rule: dalam distribusi normal,
  //   Z ≤ 2  → 95.45% data wajar berada di rentang ini → ALLOW
  //   Z ≤ 3  → di luar 2σ tapi masih dalam 3σ → REVIEW
  //   Z > 3  → hanya 0.27% kemungkinan wajar → BLOCK
  // ─────────────────────────────────────────────────────────────────────────

  // Deklarasi `let` karena nilai decision ditentukan oleh kondisi di bawah
  let decision;

  if (zScoreIsUndefined)   decision = 'BLOCK';  // σ=0 & X≠μ: anomali matematis, paksa BLOCK
  else if (zScore <= 2)    decision = 'ALLOW';  // Z dalam batas 2-sigma: transaksi normal
  else if (zScore <= 3)    decision = 'REVIEW'; // Z antara 2 dan 3 sigma: perlu ditinjau admin
  else                     decision = 'BLOCK';  // Z melampaui 3-sigma: transaksi diblokir

  // ─────────────────────────────────────────────────────────────────────────
  // PEMBENTUKAN PESAN REASONS
  // Teks penjelasan yang ditampilkan di dashboard admin dan dikirim ke mobile app
  // Dibuat secara dinamis berdasarkan hasil keputusan di atas
  // ─────────────────────────────────────────────────────────────────────────

  const reasons = []; // Array kosong, akan diisi dengan .push() sesuai kondisi

  // Format nilai Z-Score untuk ditampilkan: 4 desimal, atau teks khusus jika undefined
  const zFormatted = zScoreIsUndefined ? 'tidak terdefinisi (σ=0)' : zScore.toFixed(4);

  // Math.round() → bulatkan ke bilangan bulat terdekat sebelum diformat sebagai string
  // .toLocaleString('id-ID') → format angka dengan titik ribuan gaya Indonesia
  const meanFormatted = Math.round(mean).toLocaleString('id-ID');

  // .toFixed(2) → format angka dengan 2 desimal (standar tampilan nilai statistik)
  const stdFormatted = stdDev.toFixed(2);

  // Format amount transaksi baru untuk pesan yang mudah dibaca manusia
  const currentFormatted = currentAmount.toLocaleString('id-ID');

  if (zScoreIsUndefined) {
    // Kasus σ=0 & X≠μ: jelaskan edge case matematis ke admin
    reasons.push(
      'EDGE CASE: Standar deviasi σ = 0 (semua transaksi historis identik = Rp' + meanFormatted + ')',
      'Transaksi baru Rp' + currentFormatted + ' menyimpang dari pola identik — Z tidak terdefinisi secara matematis',
      'Keputusan BLOCK berdasarkan logika statistik: distribusi degenerasi tidak dapat menoleransi penyimpangan apapun',
      'Threshold yang berlaku tetap Z > 3; edge case ini bukan threshold baru'
    );
  } else if (decision === 'ALLOW') {
    // Kasus normal: Z ≤ 2, transaksi wajar
    reasons.push(
      'Transaksi dalam batas normal (Z = ' + zFormatted + ' <= 2)',
      'Nominal Rp' + currentFormatted + ' tidak menyimpang signifikan dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')'
    );
  } else if (decision === 'REVIEW') {
    // Kasus mencurigakan: 2 < Z ≤ 3, perlu perhatian admin
    reasons.push(
      'Transaksi mencurigakan - perlu review admin (2 < Z = ' + zFormatted + ' <= 3)',
      'Nominal Rp' + currentFormatted + ' menyimpang antara 2-sigma dan 3-sigma dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')',
      // Math.abs() → pastikan deviasi selalu positif meski transaksi di bawah mean
      'Deviasi dari mean: Rp' + Math.round(Math.abs(currentAmount - mean)).toLocaleString('id-ID') + ' (' + zFormatted + 'x standar deviasi)'
    );
  } else {
    // Kasus anomali: Z > 3, transaksi diblokir
    reasons.push(
      'Transaksi anomali - DIBLOKIR (Z = ' + zFormatted + ' > 3)',
      'Nominal Rp' + currentFormatted + ' menyimpang melampaui 3-sigma dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')',
      'Deviasi dari mean: Rp' + Math.round(Math.abs(currentAmount - mean)).toLocaleString('id-ID') + ' (' + zFormatted + 'x standar deviasi)',
      'Indikasi kuat anomali transaksi - saldo tidak berubah, fraud alert dibuat'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mapping decision → riskLevel
  // decision (ALLOW/REVIEW/BLOCK) adalah istilah internal sistem
  // riskLevel (NORMAL/SUSPICIOUS/ANOMALY) adalah istilah yang ditampilkan di UI
  // Operator ternary berantai: evaluasi dari kiri ke kanan
  // ─────────────────────────────────────────────────────────────────────────
  const riskLevel = decision === 'ALLOW' ? 'NORMAL' : decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY';

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN: Kembalikan seluruh hasil analisis sebagai satu objek
  // Objek ini diterima oleh fraud.js (routes) dan diteruskan ke response API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // parseFloat(zScore.toFixed(6)) → bulatkan ke 6 desimal lalu konversi ke number
    // Ternary: jika Z tidak terdefinisi kembalikan null, jika tidak kembalikan nilainya
    zScore: zScoreIsUndefined ? null : parseFloat(zScore.toFixed(6)),

    decision,    // Keputusan akhir: ALLOW / REVIEW / BLOCK
    riskLevel,   // Label UI: NORMAL / SUSPICIOUS / ANOMALY

    // parseFloat(x.toFixed(2)) → bulatkan ke 2 desimal, kembalikan sebagai tipe number (bukan string)
    mean: parseFloat(mean.toFixed(2)),
    variance: parseFloat(variance.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),

    n,             // Jumlah data historis yang dipakai dalam perhitungan
    historyCount: n, // Alias n — field tambahan untuk konsistensi format response API

    reasons,           // Array pesan penjelasan keputusan
    historicalAmounts: amounts,  // Array amount mentah 20 transaksi historis (untuk audit)
    deviations,        // Array objek deviasi per transaksi (untuk debugging statistik)

    algorithm: 'Z-Score Based Anomaly Detection', // Label nama algoritma
    historySize: HISTORY_SIZE,           // Konstanta 20 — window size yang dipakai
    thresholds: { allow: 2, review: 3 }  // Batas Z-Score: ≤2 ALLOW, ≤3 REVIEW, >3 BLOCK
  };
}

// Ekspor fungsi dan konstanta agar bisa diimpor di file lain (fraud.js)
// analyzeZScoreAnomaly → fungsi utama perhitungan
// HISTORY_SIZE → konstanta 20, diekspor agar file lain bisa referensi nilai yang sama
module.exports = { analyzeZScoreAnomaly, HISTORY_SIZE }; // module.exports adalah cara CommonJS Node.js untuk mengekspor dari file ini; objek berisi dua item yang bisa di-import file lain: fungsi analyzeZScoreAnomaly untuk menghitung Z-Score dan konstanta HISTORY_SIZE (20); digunakan di transactions.js dan fraud.js
