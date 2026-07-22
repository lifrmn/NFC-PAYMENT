
// Z-Score Anomaly Detection
// Rumus: Z = |X - μ| / σ  →  Z≤2 ALLOW, 2<Z≤3 REVIEW, Z>3 BLOCK
// Window: 20 transaksi historis terakhir sebagai baseline
// Kontrak keputusan yang dijalankan oleh route transaksi dan pembayaran NFC:
// - ALLOW / NORMAL: transaksi diproses, saldo kedua pihak diperbarui, tanpa FraudAlert.
// - REVIEW / SUSPICIOUS: transaksi diproses, saldo diperbarui, FraudAlert dibuat untuk admin.
// - BLOCK / ANOMALY: transaksi ditolak dengan HTTP 403, saldo tidak berubah, FraudAlert dibuat.
// Transaksi yang berhasil diproses oleh kedua route dikembalikan dengan HTTP 201 Created.

const HISTORY_SIZE = 20;
// const membuat variabel tetap; HISTORY_SIZE adalah konstanta yang menyimpan jumlah transaksi historis
// yang digunakan sebagai window baseline untuk perhitungan Z-Score; nilai 20 adalah kebijakan bisnis
// yang membatasi baseline ke perilaku terbaru dan menjadi syarat aktivasi klasifikasi penuh

// Menganalisis nominal baru terhadap maksimal 20 transaksi terbaru milik pengirim.
//
// Kontrak input:
// - currentAmount harus number finite dan lebih besar dari 0.
// - historicalTxs harus array terbaru-ke-terlama; setiap item memiliki amount finite non-negatif.
//
// Kebijakan hasil:
// - Histori < 20: ALLOW sementara; zScore=0 adalah sentinel, bukan hasil perhitungan Z.
// - Histori lengkap: gunakan sample variance (pembagi n-1), lalu Z = |X - mean| / stdDev.
// - stdDev mendekati 0 dan X sama dengan mean: zScore=0 dan keputusan ALLOW.
// - stdDev mendekati 0 dan X berbeda dari mean: Z tidak terdefinisi (null) dan keputusan BLOCK.
//
// Parameter currentAmount: nominal transaksi baru (X), berupa number.
// Parameter historicalTxs: array histori transaksi dalam urutan DESC.
// Hasil: zScore, decision, riskLevel, reasons, dan detail statistik untuk audit.
function analyzeZScoreAnomaly(currentAmount, historicalTxs) {
  // fungsi utama deteksi anomali; currentAmount = nominal transaksi baru (X),
  // historicalTxs = array riwayat transaksi user (terbaru di indeks 0 / DESC order)

  if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
    throw new TypeError('currentAmount harus berupa angka finite positif');
  }
  // Engine hanya menerima nominal number positif; validasi ini mencegah hasil NaN/Infinity

  if (!Array.isArray(historicalTxs)) {
    throw new TypeError('historicalTxs harus berupa array');
  }
  // .slice() hanya aman dipanggil setelah historicalTxs dipastikan berupa array

  // .slice(0, HISTORY_SIZE) → ambil maksimal 20 elemen pertama dari array historis
  // Jika array lebih dari 20, sisanya diabaikan — hanya 20 terbaru yang dipakai sebagai baseline
  const last20 = historicalTxs.slice(0, HISTORY_SIZE);
  // .slice(0,20) mengambil 20 elemen pertama; jika array < 20 elemen, ambil semua — ini adalah
  // window histori baseline

  // for loop mengekstrak field `amount` dari setiap objek transaksi satu per satu
  // Hasilnya array angka murni, misalnya [10000, 12000, ...] — lebih mudah dihitung
  const amounts = [];
  for (let i = 0; i < last20.length; i++) {
    const historicalAmount = last20[i]?.amount;
    if (!Number.isFinite(historicalAmount) || historicalAmount < 0) {
      throw new TypeError('Setiap transaksi historis harus memiliki amount angka finite non-negatif');
    }
    amounts.push(historicalAmount);
    // last20[i].amount mengakses field amount objek ke-i; push() menambahkan nilai ke array amounts
  }
  // for loop iterasi setiap objek transaksi dan ambil hanya field amount; menghasilkan array angka murni
  //  untuk perhitungan statistik

  // .length → jumlah elemen array setelah di-slice
  // n adalah n pada rumus statistik — mewakili jumlah data historis yang tersedia
  const n = amounts.length;
  // n = jumlah data historis yang tersedia; ini adalah 'n' dalam rumus statistik
  // μ = ΣXi/n dan σ² = Σ(Xi-μ)²/(n-1)

  // Guard: histori < 20 → Z-Score tidak valid, kembalikan ALLOW sementara
  if (n < HISTORY_SIZE) {
    // guard check: jika data historis belum mencapai 20 transaksi, Z-Score tidak dapat
    //  dihitung secara valid; kembalikan ALLOW sementara

    // Hitung mean parsial menggunakan for loop sebelum dikembalikan ke response
    let totalParsial = 0;
    for (let i = 0; i < amounts.length; i++) {
      totalParsial += amounts[i];
      // tambahkan amount ke-i ke total; iterasi semua data yang tersedia (0 sampai n-1)
    }
    let meanParsial;
    // deklarasi let karena nilainya ditentukan kondisi if-else di bawah
    if (n === 0) {
      meanParsial = 0;
      // tidak ada data sama sekali — kembalikan 0
    } else {
      meanParsial = totalParsial / n;
      // Mean parsial tetap presisi penuh untuk audit; formatting hanya dilakukan di lapisan tampilan.
    }

    return {
      zScore: 0,
      // Z tidak dihitung — dikembalikan 0 sebagai nilai aman
      decision: 'ALLOW',
      // Transaksi diizinkan karena belum ada cukup baseline
      riskLevel: 'NORMAL',
      // riskLevel NORMAL diberikan saat histori belum cukup; bukan karena Z aman, tapi karena
      // baseline belum ada
      mean: meanParsial,
      // mean parsial hasil for loop di atas; hanya informasi untuk admin, bukan dipakai untuk Z-Score

      variance: 0,
      // Variance tidak dihitung, tidak cukup data
      stdDev: 0,
      // Standar deviasi tidak dihitung, tidak cukup data
      n,
      // Shorthand ES6: sama dengan n: n — jumlah data yang ada
      historyCount: n,
      // Alias dari n, dipakai untuk konsistensi field di response API

      // Array reasons berisi pesan yang akan ditampilkan di dashboard admin
      // String concatenation (+) dipakai untuk menyisipkan nilai variabel ke dalam pesan
      reasons: [
        // array reasons berisi 3 pesan yang ditampilkan di dashboard admin saat histori belum cukup
        'INSUFFICIENT_HISTORY: Baseline belum cukup (' + n + '/' + HISTORY_SIZE + ' transaksi)',
        // pesan 1: string concatenation menggabungkan nilai n dan HISTORY_SIZE untuk
        //
        // menampilkan progres histori
        'Transaksi diizinkan sementara sambil membangun histori',
        // pesan 2: menjelaskan alasan ALLOW meski baseline belum cukup — bukan karena
        //  aman, tapi karena belum ada referensi
        'Klasifikasi Z-Score aktif setelah histori mencapai ' + HISTORY_SIZE + ' transaksi',
        // pesan 3: informasi kapan deteksi Z-Score mulai aktif sepenuhnya (setelah 20 transaksi)
      ],

      historicalAmounts: amounts,
      // Data amount mentah dikembalikan untuk keperluan audit
      deviations: [],
      // Kosong karena perhitungan deviasi tidak dilakukan
      algorithm: 'Z-Score Based Anomaly Detection',
      // label nama algoritma yang digunakan; disertakan di response untuk transparansi sistem ke admin
      historySize: HISTORY_SIZE,
      // Konstanta 20 — jumlah minimum data yang dibutuhkan
      thresholds: { allow: 2, review: 3 },
      // Batas klasifikasi Z-Score yang berlaku
    };
  }

  // Langkah 1: Hitung mean μ = Σ(Xi) / n

  // for loop menjumlahkan semua amount historis satu per satu → Σ(Xi)
  // mulai dari 0, tambahkan setiap amounts[i] ke sumAmounts di setiap iterasi
  let sumAmounts = 0;
  for (let i = 0; i < amounts.length; i++) {
    sumAmounts += amounts[i];
    // += menambahkan amounts[i] ke sumAmounts; setelah loop selesai, sumAmounts = Σ(Xi)
  }
  // for loop menjumlahkan seluruh 20 amount historis; hasil akhir sumAmounts = Σ(Xi) untuk rumus mean

  // Bagi total dengan jumlah data → menghasilkan rata-rata (μ = Σ(Xi) / n)
  const mean = sumAmounts / n;
  // rumus mean: μ = Σ(Xi) / n; membagi total dengan jumlah data; mean adalah pusat distribusi transaksi
  // historis user

  // Langkah 2: Hitung deviasi dan kuadrat deviasi setiap Xi terhadap mean

  // for loop membuat objek deviasi untuk setiap transaksi historis satu per satu
  // setiap objek berisi: nomor urut, nilai xi, deviasi (dev), dan kuadrat deviasi (devSq)
  const deviations = [];
  for (let i = 0; i < amounts.length; i++) {
    const xi = amounts[i];
    // xi = nilai amount transaksi historis ke-i
    const dev = xi - mean;
    // dev = selisih xi terhadap mean; bisa negatif jika xi lebih kecil dari mean
    const devSq = dev * dev;
    // devSq = kuadrat deviasi (dev²); selalu ≥ 0 karena dikuadratkan; setara dengan Math.pow(dev, 2)
    deviations.push({
      index: i + 1,
      // nomor urut 1-based (i dimulai dari 0, jadi +1)
      xi: xi,
      // nilai transaksi historis ke-i
      dev: dev,
      // deviasi terhadap mean
      devSq: devSq,
      // kuadrat deviasi, dipakai sebagai bahan baku perhitungan variance
    });
    // push() menambahkan objek deviasi ke array; setelah loop, deviations berisi 20 objek
  }

  // for loop menjumlahkan semua kuadrat deviasi → menghasilkan Σ(Xi - μ)²
  // deviations[i].devSq adalah kuadrat deviasi transaksi ke-i yang sudah dihitung di atas
  let sumSquaredDiff = 0;
  for (let i = 0; i < deviations.length; i++) {
    sumSquaredDiff += deviations[i].devSq;
    // += menambahkan devSq ke total; setelah loop, sumSquaredDiff = Σ(Xi-μ)²
  }
  // for loop menjumlahkan seluruh kuadrat deviasi dari 20 transaksi; hasilnya Σ(Xi-μ)² untuk
  // perhitungan variance

  // Langkah 3: Sample variance σ² = Σ(Xi-μ)² / (n-1) — Bessel's correction

  // Operator ternary: jika n > 1 hitung variance, jika tidak kembalikan 0
  // Guard n > 1 melindungi dari pembagian dengan nol saat n = 1 (n-1 = 0)
  // Bessel's Correction: pembagi (n-1) menghasilkan estimasi variance yang tidak bias
  const variance = n > 1 ? sumSquaredDiff / (n - 1) : 0;
  // σ² = Σ(Xi - μ)² / (n - 1); guard n>1 mencegah pembagian dengan 0 saat n=1

  // Langkah 4: Standar deviasi σ = √σ²

  // Math.sqrt() → fungsi akar kuadrat bawaan JavaScript → σ = √σ²
  // Jika variance = 0, maka stdDev = √0 = 0 → masuk ke edge case di langkah 5
  const stdDev = Math.sqrt(variance);
  // Math.sqrt() menghitung akar kuadrat; σ = √σ²; mengubah satuan kembali ke Rupiah dari Rp² (kuadrat)

  // Langkah 5: Z = |X - μ| / σ — edge case σ=0 ditangani khusus

  // Deklarasi `let` (bukan `const`) karena nilai zScore ditentukan secara kondisional
  let zScore;
  // deklarasi let (bukan const) karena nilai ditentukan secara kondisional di bawah;
  // let memungkinkan reassignment setelah deklarasi

  // Flag boolean untuk menandai apakah Z-Score tidak terdefinisi (kasus σ = 0, X ≠ μ)
  // Dipakai di langkah 6 untuk paksa decision = BLOCK tanpa perlu membandingkan nilai null
  let zScoreIsUndefined = false;
  // flag boolean untuk kasus edge case σ=0; false=Z bisa dihitung,
  //  true=Z tidak terdefinisi secara matematis karena σ=0 dan X≠μ

  // EPSILON: threshold minimum stdDev; jika stdDev < 1e-9 dianggap nol
  // Diperlukan karena floating-point desimal (misal 45.239 × 20) bisa menghasilkan
  // stdDev = 0.0000000001 bukan persis 0, sehingga stdDev === 0 tidak aktif
  const EPSILON = 1e-9;

  if (stdDev < EPSILON) {
    // edge case: σ≈0 berarti semua 20 transaksi historis bernilai SAMA PERSIS (atau hampir sama);
    // pembagian dengan nilai sangat kecil menghasilkan Z yang ekstrem — harus ditangani khusus

    if (Math.abs(currentAmount - mean) < EPSILON) {
      // transaksi baru sama (atau hampir sama) dengan mean: tidak ada penyimpangan, Z=0
      zScore = 0;
      // Z=0 ditetapkan manual: transaksi identik dengan mean, penyimpangan nol, tidak ada anomali
    } else {
      // X berbeda dari μ → ada penyimpangan, tapi σ = 0 sehingga Z tidak bisa dihitung
      // Secara statistik: distribusi degenerasi tidak dapat menoleransi penyimpangan apapun
      zScore = null;
      // null menandakan Z tidak terdefinisi secara matematis
      zScoreIsUndefined = true;
      // Aktifkan flag → langkah 6 akan paksa BLOCK
    }
  } else {
    // σ > 0 → kondisi normal, Z bisa dihitung dengan rumus standar
    // Math.abs() → nilai absolut agar Z selalu positif (tidak peduli di atas/bawah mean)
    const selisih = currentAmount - mean;
    // selisih = X - μ; bisa negatif jika transaksi baru lebih kecil dari mean
    const nilaiMutlak = selisih < 0 ? selisih * -1 : selisih;
    // nilai mutlak |X - μ|: jika selisih negatif, kalikan -1 agar positif; setara Math.abs()
    // tapi eksplisit
    zScore = nilaiMutlak / stdDev;
    // rumus Z-Score: Z = |X - μ| / σ; mengukur berapa kali lipat penyimpangan dari σ
  }

  // Langkah 6: Klasifikasi Z → ALLOW / REVIEW / BLOCK

  // Deklarasi `let` karena nilai decision ditentukan oleh kondisi di bawah
  let decision;
  // deklarasi let karena nilai ditentukan oleh kondisi if-else di bawah; menyimpan keputusan
  //  akhir: ALLOW, REVIEW, atau BLOCK

  if (zScoreIsUndefined) {
    decision = 'BLOCK';
    // σ=0 & X≠μ: anomali matematis, paksa BLOCK — Z tidak bisa dihitung
  } else if (zScore <= 2) {
    decision = 'ALLOW';
  } else if (zScore <= 3) {
    decision = 'REVIEW';
  } else {
    decision = 'BLOCK';
    // Z melampaui 3-sigma: anomali terdeteksi, transaksi diblokir
  }

  // Bentuk pesan reasons sesuai hasil keputusan

  const reasons = [];
  // Array kosong, akan diisi dengan .push() sesuai kondisi

  // Format nilai Z-Score untuk ditampilkan: 4 desimal, atau teks khusus jika undefined
  // zFormatted adalah versi STRING dari zScore yang siap ditampilkan ke admin di dashboard
  // Tujuan: nilai mentah zScore (misal 2.857142...) diubah jadi string yang rapi ("2.8571")
  // sehingga mudah dibaca manusia; dipakai di dalam string pesan reasons (concatenation +)
  let zFormatted;
  // deklarasi let (bukan const) karena nilai ditentukan oleh kondisi if-else di bawah;
  // let memungkinkan zFormatted diisi salah satu dari dua kemungkinan nilai (string teks atau angka)
  if (zScoreIsUndefined) {
    zFormatted = 'tidak terdefinisi (σ=0)';
    // jika Z tidak terdefinisi (σ=0 & X≠μ), tampilkan teks khusus sebagai pengganti angka;
    // karena zScore = null, kita tidak bisa panggil .toFixed() — maka diganti string literal ini
  } else {
    zFormatted = zScore.toFixed(4);
    // toFixed(4) adalah method Number bawaan JS yang memformat angka ke string dengan 4 desimal;
    // contoh: zScore = 2.857142857 → zFormatted = "2.8571" (4 angka di belakang koma);
    // hasil toFixed() adalah tipe STRING, bukan number — cocok untuk digabung dengan + di pesan reasons
  }

  // Math.round() membulatkan mean ke bilangan bulat terdekat sebelum diformat
  const meanBulat = Math.round(mean);
  // mean dibulatkan agar mudah dibaca; masih dalam tipe number sebelum diformat string;
  // contoh: mean = 45239.5 → meanBulat = 45240 (bulat ke integer terdekat)
  const meanFormatted = meanBulat.toLocaleString('id-ID');
  // meanFormatted adalah versi STRING dari mean yang siap ditampilkan ke admin;
  // toLocaleString('id-ID') memformat angka dengan pemisah titik ribuan gaya Indonesia;
  // contoh: meanBulat = 45000 → meanFormatted = "45.000" (titik sebagai pemisah ribuan);
  // dipakai di dalam string pesan reasons dengan concatenation (+): 'mu = Rp' + meanFormatted

  // .toFixed(2) → format angka dengan 2 desimal (standar tampilan nilai statistik)
  const stdFormatted = stdDev.toFixed(2);
  // stdFormatted adalah versi STRING dari stdDev yang siap ditampilkan ke admin;
  // toFixed(2) memformat standar deviasi dengan tepat 2 angka desimal;
  // contoh: stdDev = 12500.3478 → stdFormatted = "12500.35" (2 angka di belakang koma);
  // digunakan dalam string pesan reasons dengan concatenation (+): 'sigma = Rp' + stdFormatted

  // Format amount transaksi baru untuk pesan yang mudah dibaca manusia
  const currentFormatted = currentAmount.toLocaleString('id-ID');
  // currentFormatted adalah versi STRING dari currentAmount yang siap ditampilkan ke admin;
  // currentAmount adalah parameter angka murni (misal: 500000), toLocaleString('id-ID')
  // mengubahnya menjadi string dengan format titik ribuan gaya Indonesia;
  // contoh: currentAmount = 500000 → currentFormatted = "500.000";
  // dipakai di dalam string pesan reasons dengan concatenation (+): 'Rp' + currentFormatted

  // Hitung selisih transaksi baru terhadap mean untuk ditampilkan di pesan reasons
  const rawSelisih = currentAmount - mean;
  // rawSelisih bisa negatif jika transaksi baru lebih kecil dari mean
  const selisihDariMean = rawSelisih < 0 ? rawSelisih * -1 : rawSelisih;
  // selisihDariMean = nilai mutlak |X - μ|; dipakai di pesan REVIEW dan BLOCK agar selalu tampil positif

  if (zScoreIsUndefined) {
    // memeriksa flag edge case σ=0; jika true masuk blok ini untuk membuat pesan penjelasan khusus
    //  kasus matematis tidak terdefinisi
    reasons.push(
      // mengisi array reasons dengan 4 pesan penjelasan keputusan BLOCK akibat edge case σ=0
      'EDGE CASE: Standar deviasi σ = 0 (semua transaksi historis identik = Rp' + meanFormatted + ')',
      // pesan 1: menjelaskan bahwa σ=0 karena semua 20 transaksi historis bernilai sama persis
      'Transaksi baru Rp' + currentFormatted + ' menyimpang dari pola identik — Z tidak terdefinisi secara matematis',
      // pesan 2: menjelaskan anomali — ada penyimpangan dari pola identik tapi Z tidak
      // bisa dihitung karena σ=0
      'Keputusan BLOCK berdasarkan logika statistik: distribusi degenerasi tidak dapat menoleransi penyimpangan apapun',
      // pesan 3: alasan BLOCK — distribusi degenerasi (semua identik) tidak bisa
      // toleransi penyimpangan apapun
      'Threshold yang berlaku tetap Z > 3; edge case ini bukan threshold baru',
      // pesan 4: klarifikasi — BLOCK bukan karena Z > 3, tapi karena kondisi
      // matematis σ=0; threshold tidak berubah
    );
  } else if (decision === 'ALLOW') {
    // Z ≤ 2: transaksi dalam batas normal — masuk blok pesan ALLOW
    reasons.push(
      // mengisi array reasons dengan 2 pesan penjelasan keputusan ALLOW
      'Transaksi dalam batas normal (Z = ' + zFormatted + ' <= 2)',
      // pesan 1: menampilkan nilai Z ≤ 2 sebagai bukti transaksi dalam batas wajar
      'Nominal Rp' + currentFormatted + ' tidak menyimpang signifikan dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')',
      // pesan 2: menampilkan μ dan σ baseline untuk transparansi ke admin
    );
  } else if (decision === 'REVIEW') {
    // 2 < Z ≤ 3: transaksi mencurigakan — masuk blok pesan REVIEW
    reasons.push(
      // mengisi array reasons dengan 3 pesan penjelasan keputusan REVIEW
      'Transaksi mencurigakan - perlu review admin (2 < Z = ' + zFormatted + ' <= 3)',
      // pesan 1: menampilkan Z antara 2 dan 3 sigma — perlu ditinjau admin
      'Nominal Rp' + currentFormatted + ' menyimpang antara 2-sigma dan 3-sigma dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')',
      // pesan 2: detail nominal vs baseline; posisi penyimpangan antara 2σ dan 3σ
      'Deviasi dari mean: Rp' + Math.round(selisihDariMean).toLocaleString('id-ID') + ' (' + zFormatted + 'x standar deviasi)',
      // pesan 3: selisihDariMean sudah nilai mutlak (selalu positif); toLocaleString format titik ribuan Indonesia
    );
  } else {
    // Z > 3: transaksi anomali — masuk blok pesan BLOCK
    reasons.push(
      // mengisi array reasons dengan 4 pesan penjelasan keputusan BLOCK
      'Transaksi anomali - DIBLOKIR (Z = ' + zFormatted + ' > 3)',
      // pesan 1: menampilkan nilai Z > 3 sebagai konfirmasi anomali
      'Nominal Rp' + currentFormatted + ' menyimpang melampaui 3-sigma dari baseline (mu = Rp' + meanFormatted + ', sigma = Rp' + stdFormatted + ')',
      // pesan 2: detail nominal vs baseline; jelas melampaui 3σ
      'Deviasi dari mean: Rp' + Math.round(selisihDariMean).toLocaleString('id-ID') + ' (' + zFormatted + 'x standar deviasi)',
      // pesan 3: selisihDariMean sudah nilai mutlak (selalu positif); toLocaleString format titik ribuan Indonesia
      'Indikasi kuat anomali transaksi - saldo tidak berubah, fraud alert dibuat',
      // pesan 4: akibat BLOCK — transaksi ditolak, saldo tidak berubah, fraud alert dibuat di database
    );
  }

  // Map decision → riskLevel untuk tampilan UI
  let riskLevel;
  // deklarasi let karena nilai riskLevel ditentukan oleh kondisi if-else di bawah
  if (decision === 'ALLOW') {
    riskLevel = 'NORMAL';
    // ALLOW → NORMAL: transaksi berada dalam threshold kebijakan, bukan bukti bahwa fraud mustahil terjadi.
  } else if (decision === 'REVIEW') {
    riskLevel = 'SUSPICIOUS';
    // REVIEW → SUSPICIOUS: transaksi mencurigakan, perlu diperiksa lebih lanjut
  } else {
    riskLevel = 'ANOMALY';
    // BLOCK → ANOMALY: anomali terdeteksi, transaksi ditolak
  }

  return {
    zScore,
    // Nilai Z mentah untuk keputusan, penyimpanan, dan audit; null jika tidak terdefinisi.

    decision,
    // Keputusan akhir: ALLOW / REVIEW / BLOCK
    riskLevel,
    // Label UI: NORMAL / SUSPICIOUS / ANOMALY

    mean,
    variance,
    stdDev,
    // Statistik mesin tetap presisi penuh; teks reasons memakai formatting terpisah.

    n,
    // Jumlah data historis yang dipakai dalam perhitungan
    historyCount: n,
    // Alias n — field tambahan untuk konsistensi format response API

    reasons,
    // Array pesan penjelasan keputusan
    historicalAmounts: amounts,
    // Array amount mentah 20 transaksi historis (untuk audit)
    deviations,
    // Array objek deviasi per transaksi (untuk debugging statistik)

    algorithm: 'Z-Score Based Anomaly Detection',
    // Label nama algoritma
    historySize: HISTORY_SIZE,
    // Konstanta 20 — window size yang dipakai
    thresholds: { allow: 2, review: 3 },
    // Batas Z-Score: ≤2 ALLOW, ≤3 REVIEW, >3 BLOCK
  };
}

// Ekspor fungsi dan konstanta agar bisa diimpor di file lain (fraud.js)
// analyzeZScoreAnomaly → fungsi utama perhitungan
// HISTORY_SIZE → konstanta 20, diekspor agar file lain bisa referensi nilai yang sama
module.exports = { analyzeZScoreAnomaly, HISTORY_SIZE };
// module.exports adalah cara CommonJS Node.js untuk mengekspor dari file ini;
// objek berisi fungsi analyzeZScoreAnomaly dan konstanta HISTORY_SIZE (20);
// digunakan di transactions.js dan fraud.js
