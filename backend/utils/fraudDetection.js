
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

const HISTORY_SIZE = 20; // const membuat variabel tetap; HISTORY_SIZE adalah konstanta yang menyimpan jumlah transaksi historis
// const membuat variabel tetap; HISTORY_SIZE adalah konstanta yang menyimpan jumlah transaksi historis
// yang digunakan sebagai window baseline untuk perhitungan Z-Score; nilai 20 dipilih berdasarkan
// prinsip statistik: cukup untuk menghitung mean dan standar deviasi yang representatif

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
function analyzeZScoreAnomaly(currentAmount, historicalTxs) { // fungsi utama deteksi anomali; currentAmount = nominal transaksi baru (X),
  // fungsi utama deteksi anomali; currentAmount = nominal transaksi baru (X),
  // historicalTxs = array riwayat transaksi user (terbaru di indeks 0 / DESC order)

  // .slice(0, HISTORY_SIZE) → ambil maksimal 20 elemen pertama dari array historis
  // Jika array lebih dari 20, sisanya diabaikan — hanya 20 terbaru yang dipakai sebagai baseline
  const last20 = historicalTxs.slice(0, HISTORY_SIZE); // .slice(0,20) mengambil 20 elemen pertama; jika array < 20 elemen, ambil semua — ini adalah window histori baseline
  // .slice(0,20) mengambil 20 elemen pertama; jika array < 20 elemen, ambil semua — ini adalah window histori baseline

  // .map(tx => tx.amount) → ekstrak hanya field `amount` dari setiap objek transaksi
  // Hasilnya array angka murni, misalnya [10000, 12000, ...] — lebih mudah dihitung
  const amounts = last20.map(tx => tx.amount); // .map() mengekstrak hanya field amount dari setiap objek transaksi; menghasilkan array angka murni untuk perhitungan statistik
  // .map() mengekstrak hanya field amount dari setiap objek transaksi; menghasilkan array angka murni untuk perhitungan statistik

  // .length → jumlah elemen array setelah di-slice
  // n adalah n pada rumus statistik — mewakili jumlah data historis yang tersedia
  const n = amounts.length; // n = jumlah data historis yang tersedia; ini adalah 'n' dalam rumus statistik μ = ΣXi/n dan σ² = Σ(Xi-μ)²/(n-1)
  // n = jumlah data historis yang tersedia; ini adalah 'n' dalam rumus statistik μ = ΣXi/n dan σ² = Σ(Xi-μ)²/(n-1)

  // ============================================================================
  // GUARD: Cek kecukupan data historis sebelum melakukan perhitungan Z-Score
  // Z-Score tidak valid jika data historis kurang dari 20 karena:
  //   - Mean dan standar deviasi yang dihitung dari sedikit data tidak representatif
  //   - Hasil Z-Score akan terlalu tidak stabil untuk dijadikan dasar keputusan
  // Seluruh kondisi n < 20 (termasuk n = 0) dikembalikan sebagai ALLOW sementara
  // ============================================================================
  if (n < HISTORY_SIZE) { // guard check: jika data historis belum mencapai 20 transaksi, Z-Score tidak dapat dihitung secara valid; kembalikan ALLOW sementara
    // guard check: jika data historis belum mencapai 20 transaksi, Z-Score tidak dapat dihitung secara valid; kembalikan ALLOW sementara
    return {
      zScore: 0, // Z tidak dihitung — dikembalikan 0 sebagai nilai aman
      // Z tidak dihitung — dikembalikan 0 sebagai nilai aman
      decision: 'ALLOW', // Transaksi diizinkan karena belum ada cukup baseline
      // Transaksi diizinkan karena belum ada cukup baseline
      riskLevel: 'NORMAL', // riskLevel NORMAL diberikan saat histori belum cukup; bukan karena Z aman, tapi karena baseline belum ada
      // riskLevel NORMAL diberikan saat histori belum cukup; bukan karena Z aman, tapi karena baseline belum ada

      // Hitung mean parsial hanya jika ada data (n > 0), jika tidak kembalikan 0
      // Operator ternary: kondisi ? nilai_jika_benar : nilai_jika_salah
      mean: n > 0 ? parseFloat((amounts.reduce((s, x) => s + x, 0) / n).toFixed(2)) : 0, // parseFloat() mengubah hasil toFixed(2) dari string ke number; menghasilkan mean parsial jika ada data, 0 jika tidak ada
      // parseFloat() mengubah hasil toFixed(2) dari string ke number; menghasilkan mean parsial jika ada data, 0 jika tidak ada

      variance: 0, // Variance tidak dihitung, tidak cukup data
      // Variance tidak dihitung, tidak cukup data
      stdDev: 0, // Standar deviasi tidak dihitung, tidak cukup data
      // Standar deviasi tidak dihitung, tidak cukup data
      n, // Shorthand ES6: sama dengan n: n — jumlah data yang ada
      // Shorthand ES6: sama dengan n: n — jumlah data yang ada
      historyCount: n, // Alias dari n, dipakai untuk konsistensi field di response API
      // Alias dari n, dipakai untuk konsistensi field di response API

      // Array reasons berisi pesan yang akan ditampilkan di dashboard admin
      // String concatenation (+) dipakai untuk menyisipkan nilai variabel ke dalam pesan
      reasons: [ // array reasons berisi 3 pesan yang ditampilkan di dashboard admin saat histori belum cukup
        // array reasons berisi 3 pesan yang ditampilkan di dashboard admin saat histori belum cukup
        'INSUFFICIENT_HISTORY: Baseline belum cukup (' + n + '/' + HISTORY_SIZE + ' transaksi)', // pesan 1: string concatenation menggabungkan nilai n dan HISTORY_SIZE untuk menampilkan progres histori
        // pesan 1: string concatenation menggabungkan nilai n dan HISTORY_SIZE untuk menampilkan progres histori
        'Transaksi diizinkan sementara sambil membangun histori', // pesan 2: menjelaskan alasan ALLOW meski baseline belum cukup — bukan karena aman, tapi karena belum ada referensi
        // pesan 2: menjelaskan alasan ALLOW meski baseline belum cukup — bukan karena aman, tapi karena belum ada referensi
        'Klasifikasi Z-Score aktif setelah histori mencapai ' + HISTORY_SIZE + ' transaksi', // pesan 3: informasi kapan deteksi Z-Score mulai aktif sepenuhnya (setelah 20 transaksi)
        // pesan 3: informasi kapan deteksi Z-Score mulai aktif sepenuhnya (setelah 20 transaksi)
      ],

      historicalAmounts: amounts, // Data amount mentah dikembalikan untuk keperluan audit
      // Data amount mentah dikembalikan untuk keperluan audit
      deviations: [], // Kosong karena perhitungan deviasi tidak dilakukan
      // Kosong karena perhitungan deviasi tidak dilakukan
      algorithm: 'Z-Score Based Anomaly Detection', // label nama algoritma yang digunakan; disertakan di response untuk transparansi sistem ke admin
      // label nama algoritma yang digunakan; disertakan di response untuk transparansi sistem ke admin
      historySize: HISTORY_SIZE, // Konstanta 20 — jumlah minimum data yang dibutuhkan
      // Konstanta 20 — jumlah minimum data yang dibutuhkan
      thresholds: { allow: 2, review: 3 }, // Batas klasifikasi Z-Score yang berlaku
      // Batas klasifikasi Z-Score yang berlaku
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 1: Hitung Mean / Rata-rata (μ)
  // μ adalah pusat pola transaksi user — acuan untuk mengukur seberapa jauh
  // transaksi baru menyimpang dari perilaku normal user
  // ─────────────────────────────────────────────────────────────────────────

  // .reduce((sum, x) => sum + x, 0) → akumulasi: mulai dari 0, tambahkan tiap elemen
  // Hasilnya adalah total penjumlahan semua amount historis → Σ(Xi)
  const sumAmounts = amounts.reduce((sum, x) => sum + x, 0); // .reduce() menjumlahkan semua elemen; (sum,x)=>sum+x adalah accumulator; mulai dari 0; hasilnya Σ(Xi)
  // .reduce() menjumlahkan semua elemen; (sum,x)=>sum+x adalah accumulator; mulai dari 0; hasilnya Σ(Xi)

  // Bagi total dengan jumlah data → menghasilkan rata-rata (μ = Σ(Xi) / n)
  const mean = sumAmounts / n; // rumus mean: μ = Σ(Xi) / n; membagi total dengan jumlah data; mean adalah pusat distribusi transaksi historis user
  // rumus mean: μ = Σ(Xi) / n; membagi total dengan jumlah data; mean adalah pusat distribusi transaksi historis user

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 2: Hitung Deviasi dan Kuadrat Deviasi setiap Xi
  // Tujuan: mengukur seberapa jauh setiap transaksi historis menyimpang dari mean
  // Deviasi dikuadratkan agar nilai negatif dan positif tidak saling menghilangkan
  // ─────────────────────────────────────────────────────────────────────────

  // .map((xi, i) => ...) → transformasi setiap elemen array menjadi objek baru
  // xi = nilai amount pada indeks ke-i, i = indeks (mulai dari 0)
  const deviations = amounts.map((xi, i) => ({ // .map() dengan dua parameter: xi=nilai, i=indeks; menghasilkan objek deviasi untuk setiap transaksi historis
    // .map() dengan dua parameter: xi=nilai, i=indeks; menghasilkan objek deviasi untuk setiap transaksi historis
    index: i + 1, // Nomor urut 1-based (i dimulai dari 0, jadi +1)
    // Nomor urut 1-based (i dimulai dari 0, jadi +1)
    xi, // Nilai transaksi historis ke-i (shorthand ES6: xi: xi)
    // Nilai transaksi historis ke-i (shorthand ES6: xi: xi)
    dev: xi - mean, // Deviasi: selisih xi terhadap mean, bisa negatif jika xi < mean
    // Deviasi: selisih xi terhadap mean, bisa negatif jika xi < mean
    devSq: Math.pow(xi - mean, 2), // Math.pow(a, 2) = a² → kuadrat deviasi, selalu ≥ 0
    // Math.pow(a, 2) = a² → kuadrat deviasi, selalu ≥ 0
  }));

  // Jumlahkan semua kuadrat deviasi menggunakan reduce → menghasilkan Σ(Xi - μ)²
  // d.devSq adalah kuadrat deviasi dari setiap elemen yang sudah dihitung di atas
  const sumSquaredDiff = deviations.reduce((sum, d) => sum + d.devSq, 0); // .reduce() menjumlahkan semua kuadrat deviasi (d.devSq); menghasilkan Σ(Xi-μ)² untuk perhitungan variance
  // .reduce() menjumlahkan semua kuadrat deviasi (d.devSq); menghasilkan Σ(Xi-μ)² untuk perhitungan variance

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 3: Hitung Sample Variance (σ²) dengan Bessel's Correction
  // Variance mengukur rata-rata kuadrat penyimpangan dari mean
  // Dibagi (n-1) bukan n karena data ini adalah SAMPEL dari populasi transaksi user
  // ─────────────────────────────────────────────────────────────────────────

  // Operator ternary: jika n > 1 hitung variance, jika tidak kembalikan 0
  // Guard n > 1 melindungi dari pembagian dengan nol saat n = 1 (n-1 = 0)
  // Bessel's Correction: pembagi (n-1) menghasilkan estimasi variance yang tidak bias
  const variance = n > 1 ? sumSquaredDiff / (n - 1) : 0; // σ² = Σ(Xi - μ)² / (n - 1); guard n>1 mencegah pembagian dengan 0 saat n=1
  // σ² = Σ(Xi - μ)² / (n - 1); guard n>1 mencegah pembagian dengan 0 saat n=1

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 4: Hitung Standard Deviation / Simpangan Baku (σ)
  // Akar dari variance — mengembalikan satuan ke Rupiah (bukan Rp²)
  // σ menyatakan: rata-rata besar penyimpangan tiap transaksi historis dari mean
  // ─────────────────────────────────────────────────────────────────────────

  // Math.sqrt() → fungsi akar kuadrat bawaan JavaScript → σ = √σ²
  // Jika variance = 0, maka stdDev = √0 = 0 → masuk ke edge case di langkah 5
  const stdDev = Math.sqrt(variance); // Math.sqrt() menghitung akar kuadrat; σ = √σ²; mengubah satuan kembali ke Rupiah dari Rp² (kuadrat)
  // Math.sqrt() menghitung akar kuadrat; σ = √σ²; mengubah satuan kembali ke Rupiah dari Rp² (kuadrat)

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 5: Hitung Z-Score untuk transaksi baru (X = currentAmount)
  // Z mengukur: transaksi baru menyimpang BERAPA KALI lipat dari σ?
  // Rumus: Z = |X - μ| / σ
  // ─────────────────────────────────────────────────────────────────────────

  // Deklarasi `let` (bukan `const`) karena nilai zScore ditentukan secara kondisional
  let zScore; // deklarasi let (bukan const) karena nilai ditentukan secara kondisional di bawah; let memungkinkan reassignment setelah deklarasi
  // deklarasi let (bukan const) karena nilai ditentukan secara kondisional di bawah; let memungkinkan reassignment setelah deklarasi

  // Flag boolean untuk menandai apakah Z-Score tidak terdefinisi (kasus σ = 0, X ≠ μ)
  // Dipakai di langkah 6 untuk paksa decision = BLOCK tanpa perlu membandingkan nilai null
  let zScoreIsUndefined = false; // flag boolean untuk kasus edge case σ=0; false=Z bisa dihitung, true=Z tidak terdefinisi secara matematis karena σ=0 dan X≠μ
  // flag boolean untuk kasus edge case σ=0; false=Z bisa dihitung, true=Z tidak terdefinisi secara matematis karena σ=0 dan X≠μ

  if (stdDev === 0) { // edge case: σ=0 berarti semua 20 transaksi historis bernilai SAMA PERSIS;
    // edge case: σ=0 berarti semua 20 transaksi historis bernilai SAMA PERSIS;
    // pembagian dengan 0 menghasilkan Infinity di JavaScript — harus ditangani khusus

    if (currentAmount === mean) { // jika transaksi baru sama persis dengan mean (dan σ=0): tidak ada penyimpangan, Z=0, transaksi dianggap normal
      // jika transaksi baru sama persis dengan mean (dan σ=0): tidak ada penyimpangan, Z=0, transaksi dianggap normal
      zScore = 0; // Z=0 ditetapkan manual: transaksi identik dengan mean, penyimpangan nol, tidak ada anomali
      // Z=0 ditetapkan manual: transaksi identik dengan mean, penyimpangan nol, tidak ada anomali
    } else { // X berbeda dari μ → ada penyimpangan, tapi σ = 0 sehingga Z tidak bisa dihitung
      // X berbeda dari μ → ada penyimpangan, tapi σ = 0 sehingga Z tidak bisa dihitung
      // Secara statistik: distribusi degenerasi tidak dapat menoleransi penyimpangan apapun
      zScore = null; // null menandakan Z tidak terdefinisi secara matematis
      // null menandakan Z tidak terdefinisi secara matematis
      zScoreIsUndefined = true; // Aktifkan flag → langkah 6 akan paksa BLOCK
      // Aktifkan flag → langkah 6 akan paksa BLOCK
    }
  } else { // σ > 0 → kondisi normal, Z bisa dihitung dengan rumus standar
    // σ > 0 → kondisi normal, Z bisa dihitung dengan rumus standar
    // Math.abs() → nilai absolut agar Z selalu positif (tidak peduli di atas/bawah mean)
    zScore = Math.abs(currentAmount - mean) / stdDev; // rumus Z-Score: Z = |X - μ| / σ; Math.abs() memastikan Z selalu positif; mengukur berapa kali lipat penyimpangan dari σ
    // rumus Z-Score: Z = |X - μ| / σ; Math.abs() memastikan Z selalu positif; mengukur berapa kali lipat penyimpangan dari σ
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LANGKAH 6: Klasifikasi Z-Score → Keputusan (ALLOW / REVIEW / BLOCK)
  // Berdasarkan Three-Sigma Rule: dalam distribusi normal,
  //   Z ≤ 2  → 95.45% data wajar berada di rentang ini → ALLOW
  //   Z ≤ 3  → di luar 2σ tapi masih dalam 3σ → REVIEW
  //   Z > 3  → hanya 0.27% kemungkinan wajar → BLOCK
  // ─────────────────────────────────────────────────────────────────────────

  // Deklarasi `let` karena nilai decision ditentukan oleh kondisi di bawah
  let decision; // deklarasi let karena nilai ditentukan oleh kondisi if-else di bawah; menyimpan keputusan akhir: ALLOW, REVIEW, atau BLOCK
  // deklarasi let karena nilai ditentukan oleh kondisi if-else di bawah; menyimpan keputusan akhir: ALLOW, REVIEW, atau BLOCK

  if (zScoreIsUndefined)   decision = 'BLOCK'; // σ=0 & X≠μ: anomali matematis, paksa BLOCK
  // σ=0 & X≠μ: anomali matematis, paksa BLOCK
  else if (zScore <= 2)    decision = 'ALLOW'; // Z dalam batas 2-sigma: transaksi normal
  // Z dalam batas 2-sigma: transaksi normal
  else if (zScore <= 3)    decision = 'REVIEW'; // Z antara 2 dan 3 sigma: perlu ditinjau admin
  // Z antara 2 dan 3 sigma: perlu ditinjau admin
  else                     decision = 'BLOCK'; // Z melampaui 3-sigma: transaksi diblokir
  // Z melampaui 3-sigma: transaksi diblokir

  // ─────────────────────────────────────────────────────────────────────────
  // PEMBENTUKAN PESAN REASONS
  // Teks penjelasan yang ditampilkan di dashboard admin dan dikirim ke mobile app
  // Dibuat secara dinamis berdasarkan hasil keputusan di atas
  // ─────────────────────────────────────────────────────────────────────────

  const reasons = []; // Array kosong, akan diisi dengan .push() sesuai kondisi
  // Array kosong, akan diisi dengan .push() sesuai kondisi

  // Format nilai Z-Score untuk ditampilkan: 4 desimal, atau teks khusus jika undefined
  const zFormatted = zScoreIsUndefined ? 'tidak terdefinisi (σ=0)' : zScore.toFixed(4); // format Z untuk tampilan: ternary cek flag; .toFixed(4) membatasi 4 desimal agar mudah dibaca di dashboard
  // format Z untuk tampilan: ternary cek flag; .toFixed(4) membatasi 4 desimal agar mudah dibaca di dashboard

  // Math.round() → bulatkan ke bilangan bulat terdekat sebelum diformat sebagai string
  // .toLocaleString('id-ID') → format angka dengan titik ribuan gaya Indonesia
  const meanFormatted = Math.round(mean).toLocaleString('id-ID'); // format mean dengan titik ribuan gaya Indonesia untuk pesan reasons
  // format mean dengan titik ribuan gaya Indonesia untuk pesan reasons

  // .toFixed(2) → format angka dengan 2 desimal (standar tampilan nilai statistik)
  const stdFormatted = stdDev.toFixed(2); // .toFixed(2) memformat standar deviasi dengan 2 desimal; digunakan dalam string pesan reasons untuk menampilkan nilai σ
  // .toFixed(2) memformat standar deviasi dengan 2 desimal; digunakan dalam string pesan reasons untuk menampilkan nilai σ

  // Format amount transaksi baru untuk pesan yang mudah dibaca manusia
  const currentFormatted = currentAmount.toLocaleString('id-ID'); // format nominal transaksi baru dengan titik ribuan gaya Indonesia untuk pesan reasons
  // format nominal transaksi baru dengan titik ribuan gaya Indonesia untuk pesan reasons

  if (zScoreIsUndefined) { // memeriksa flag edge case σ=0; jika true masuk blok ini untuk membuat pesan penjelasan khusus kasus matematis tidak terdefinisi
    // memeriksa flag edge case σ=0; jika true masuk blok ini untuk membuat pesan penjelasan khusus kasus matematis tidak terdefinisi
    reasons.push( // mengisi array reasons dengan 4 pesan penjelasan keputusan BLOCK akibat edge case σ=0
      // mengisi array reasons dengan 4 pesan penjelasan keputusan BLOCK akibat edge case σ=0
      'EDGE CASE: Standar deviasi σ = 0 (semua transaksi historis identik = Rp' + meanFormatted + ')', // pesan 1: menjelaskan bahwa σ=0 karena semua 20 transaksi historis bernilai sama persis
      // pesan 1: menjelaskan bahwa σ=0 karena semua 20 transaksi historis bernilai sama persis
      'Transaksi baru Rp' + currentFormatted + ' menyimpang dari pola identik — Z tidak terdefinisi secara matematis', // pesan 2: menjelaskan anomali — ada penyimpangan dari pola identik tapi Z tidak bisa dihitung karena σ=0
      // pesan 2: menjelaskan anomali — ada penyimpangan dari pola identik tapi Z tidak bisa dihitung karena σ=0
      'Keputusan BLOCK berdasarkan logika statistik: distribusi degenerasi tidak dapat menoleransi penyimpangan apapun', // pesan 3: alasan BLOCK — distribusi degenerasi (semua identik) tidak bisa toleransi penyimpangan apapun
      // pesan 3: alasan BLOCK — distribusi degenerasi (semua identik) tidak bisa toleransi penyimpangan apapun
      'Threshold yang berlaku tetap Z > 3; edge case ini bukan threshold baru', // pesan 4: klarifikasi — BLOCK bukan karena Z > 3, tapi karena kondisi matematis σ=0; threshold tidak berubah
      // pesan 4: klarifikasi — BLOCK bukan karena Z > 3, tapi karena kondisi matematis σ=0; threshold tidak berubah
    );
  } else if (decision === 'ALLOW') { // Z ≤ 2: transaksi dalam batas normal — masuk blok pesan ALLOW
    // Z ≤ 2: transaksi dalam batas normal — masuk blok pesan ALLOW
    reasons.push( // mengisi array reasons dengan 2 pesan penjelasan keputusan ALLOW
      // mengisi array reasons dengan 2 pesan penjelasan keputusan ALLOW
      'Transaksi dalam batas normal (Z = ' + zFormatted + ' <= 2)', // pesan 1: menampilkan nilai Z ≤ 2 sebagai bukti transaksi dalam batas wajar
      // pesan 1: menampilkan nilai Z ≤ 2 sebagai bukti transaksi dalam batas wajar
      'Nominal Rp' + currentFormatted + ' tidak menyimpang signifikan dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')', // pesan 2: menampilkan μ dan σ baseline untuk transparansi ke admin
      // pesan 2: menampilkan μ dan σ baseline untuk transparansi ke admin
    );
  } else if (decision === 'REVIEW') { // 2 < Z ≤ 3: transaksi mencurigakan — masuk blok pesan REVIEW
    // 2 < Z ≤ 3: transaksi mencurigakan — masuk blok pesan REVIEW
    reasons.push( // mengisi array reasons dengan 3 pesan penjelasan keputusan REVIEW
      // mengisi array reasons dengan 3 pesan penjelasan keputusan REVIEW
      'Transaksi mencurigakan - perlu review admin (2 < Z = ' + zFormatted + ' <= 3)', // pesan 1: menampilkan Z antara 2 dan 3 sigma — perlu ditinjau admin
      // pesan 1: menampilkan Z antara 2 dan 3 sigma — perlu ditinjau admin
      'Nominal Rp' + currentFormatted + ' menyimpang antara 2-sigma dan 3-sigma dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')', // pesan 2: detail nominal vs baseline; posisi penyimpangan antara 2σ dan 3σ
      // pesan 2: detail nominal vs baseline; posisi penyimpangan antara 2σ dan 3σ
      'Deviasi dari mean: Rp' + Math.round(Math.abs(currentAmount - mean)).toLocaleString('id-ID') + ' (' + zFormatted + 'x standar deviasi)', // pesan 3: Math.abs() agar deviasi selalu positif; toLocaleString format titik ribuan Indonesia
      // pesan 3: Math.abs() agar deviasi selalu positif; toLocaleString format titik ribuan Indonesia
    );
  } else { // Z > 3: transaksi anomali — masuk blok pesan BLOCK
    // Z > 3: transaksi anomali — masuk blok pesan BLOCK
    reasons.push( // mengisi array reasons dengan 4 pesan penjelasan keputusan BLOCK
      // mengisi array reasons dengan 4 pesan penjelasan keputusan BLOCK
      'Transaksi anomali - DIBLOKIR (Z = ' + zFormatted + ' > 3)', // pesan 1: menampilkan nilai Z > 3 sebagai konfirmasi anomali
      // pesan 1: menampilkan nilai Z > 3 sebagai konfirmasi anomali
      'Nominal Rp' + currentFormatted + ' menyimpang melampaui 3-sigma dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')', // pesan 2: detail nominal vs baseline; jelas melampaui 3σ
      // pesan 2: detail nominal vs baseline; jelas melampaui 3σ
      'Deviasi dari mean: Rp' + Math.round(Math.abs(currentAmount - mean)).toLocaleString('id-ID') + ' (' + zFormatted + 'x standar deviasi)', // pesan 3: Math.abs() agar deviasi selalu positif; toLocaleString format titik ribuan Indonesia
      // pesan 3: Math.abs() agar deviasi selalu positif; toLocaleString format titik ribuan Indonesia
      'Indikasi kuat anomali transaksi - saldo tidak berubah, fraud alert dibuat', // pesan 4: akibat BLOCK — transaksi ditolak, saldo tidak berubah, fraud alert dibuat di database
      // pesan 4: akibat BLOCK — transaksi ditolak, saldo tidak berubah, fraud alert dibuat di database
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mapping decision → riskLevel
  // decision (ALLOW/REVIEW/BLOCK) adalah istilah internal sistem
  // riskLevel (NORMAL/SUSPICIOUS/ANOMALY) adalah istilah yang ditampilkan di UI
  // Operator ternary berantai: evaluasi dari kiri ke kanan
  // ─────────────────────────────────────────────────────────────────────────
  const riskLevel = decision === 'ALLOW' ? 'NORMAL' : decision === 'REVIEW' ? 'SUSPICIOUS' : 'ANOMALY'; // ternary berantai: memetakan decision ke label UI; ALLOW→NORMAL, REVIEW→SUSPICIOUS, BLOCK→ANOMALY
  // ternary berantai: memetakan decision ke label UI; ALLOW→NORMAL, REVIEW→SUSPICIOUS, BLOCK→ANOMALY

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN: Kembalikan seluruh hasil analisis sebagai satu objek
  // Objek ini diterima oleh fraud.js (routes) dan diteruskan ke response API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    zScore: zScoreIsUndefined ? null : parseFloat(zScore.toFixed(6)), // parseFloat() mengubah hasil toFixed(6) dari string ke number; null jika Z tidak terdefinisi
    // parseFloat() mengubah hasil toFixed(6) dari string ke number; null jika Z tidak terdefinisi

    decision, // Keputusan akhir: ALLOW / REVIEW / BLOCK
    // Keputusan akhir: ALLOW / REVIEW / BLOCK
    riskLevel, // Label UI: NORMAL / SUSPICIOUS / ANOMALY
    // Label UI: NORMAL / SUSPICIOUS / ANOMALY

    // parseFloat(x.toFixed(2)) → bulatkan ke 2 desimal, kembalikan sebagai tipe number (bukan string)
    mean: parseFloat(mean.toFixed(2)), // dibulatkan ke 2 desimal, dikembalikan sebagai tipe number (bukan string)
    // dibulatkan ke 2 desimal, dikembalikan sebagai tipe number (bukan string)
    variance: parseFloat(variance.toFixed(2)), // dibulatkan ke 2 desimal, dikembalikan sebagai tipe number (bukan string)
    // dibulatkan ke 2 desimal, dikembalikan sebagai tipe number (bukan string)
    stdDev: parseFloat(stdDev.toFixed(2)), // dibulatkan ke 2 desimal, dikembalikan sebagai tipe number (bukan string)
    // dibulatkan ke 2 desimal, dikembalikan sebagai tipe number (bukan string)

    n, // Jumlah data historis yang dipakai dalam perhitungan
    // Jumlah data historis yang dipakai dalam perhitungan
    historyCount: n, // Alias n — field tambahan untuk konsistensi format response API
    // Alias n — field tambahan untuk konsistensi format response API

    reasons, // Array pesan penjelasan keputusan
    // Array pesan penjelasan keputusan
    historicalAmounts: amounts, // Array amount mentah 20 transaksi historis (untuk audit)
    // Array amount mentah 20 transaksi historis (untuk audit)
    deviations, // Array objek deviasi per transaksi (untuk debugging statistik)
    // Array objek deviasi per transaksi (untuk debugging statistik)

    algorithm: 'Z-Score Based Anomaly Detection', // Label nama algoritma
    // Label nama algoritma
    historySize: HISTORY_SIZE, // Konstanta 20 — window size yang dipakai
    // Konstanta 20 — window size yang dipakai
    thresholds: { allow: 2, review: 3 }, // Batas Z-Score: ≤2 ALLOW, ≤3 REVIEW, >3 BLOCK
    // Batas Z-Score: ≤2 ALLOW, ≤3 REVIEW, >3 BLOCK
  };
}

// Ekspor fungsi dan konstanta agar bisa diimpor di file lain (fraud.js)
// analyzeZScoreAnomaly → fungsi utama perhitungan
// HISTORY_SIZE → konstanta 20, diekspor agar file lain bisa referensi nilai yang sama
module.exports = { analyzeZScoreAnomaly, HISTORY_SIZE }; // module.exports adalah cara CommonJS Node.js untuk mengekspor dari file ini;
// module.exports adalah cara CommonJS Node.js untuk mengekspor dari file ini;
// objek berisi fungsi analyzeZScoreAnomaly dan konstanta HISTORY_SIZE (20);
// digunakan di transactions.js dan fraud.js
