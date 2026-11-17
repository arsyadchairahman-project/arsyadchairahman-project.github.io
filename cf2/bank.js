/* Bank soal prediksi CF2 – Probabilitas dan Statistika.
   Setiap template membangkitkan parameter dari RNG ber-seed, lalu menghitung
   kunci jawaban dan pengecoh secara numerik. Dipakai oleh index.html dan oleh
   skrip uji (node). */
(function (root) {
  'use strict';

  // ---------- RNG & util ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeR(seed) {
    var r = mulberry32(seed);
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.int = function (a, b) { return a + Math.floor(r() * (b - a + 1)); };
    return r;
  }
  function shuffle(arr, r) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // angka gaya Indonesia: koma desimal, titik ribuan
  function n(x, d) {
    if (d === undefined) d = 4;
    var neg = x < 0; x = Math.abs(x);
    var s = x.toFixed(d), parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + parts.join(',');
  }
  // versi untuk di dalam TeX
  function t(x, d) { return n(x, d).replace(/\./g, '{.}').replace(/,/g, '{,}').replace('−', '-'); }
  function pct(x) { return n(x * 100, (Math.round(x * 1000) % 10 === 0) ? 0 : 1) + '%'; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t2 = a % b; a = b; b = t2; } return a; }
  function frac(p, q) { // TeX pecahan sederhana
    if (q < 0) { p = -p; q = -q; }
    var g = gcd(p, q) || 1; p /= g; q /= g;
    if (q === 1) return String(p);
    return (p < 0 ? '-' : '') + '\\frac{' + Math.abs(p) + '}{' + q + '}';
  }
  function fact(k) { var f = 1; for (var i = 2; i <= k; i++) f *= i; return f; }
  function C(a, b) { if (b < 0 || b > a) return 0; var r = 1; for (var i = 1; i <= b; i++) r = r * (a - b + i) / i; return r; }
  function pois(k, l) { return Math.exp(-l) * Math.pow(l, k) / fact(k); }
  function binom(k, m, p) { return C(m, k) * Math.pow(p, k) * Math.pow(1 - p, m - k); }
  function erf(x) { // Abramowitz–Stegun 7.1.26
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    var tt = 1 / (1 + p * x);
    return s * (1 - (((((a5 * tt + a4) * tt) + a3) * tt + a2) * tt + a1) * tt * Math.exp(-x * x));
  }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function invPhi(p) { // Acklam
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pl = 0.02425, q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function simpson(f, a, b, m) {
    m = m || 2000; var h = (b - a) / m, s = f(a) + f(b);
    for (var i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
    return s * h / 3;
  }

  /* Bangun 5 opsi numerik. correct: angka; wrongs: kandidat pengecoh;
     d: desimal; wrap: fungsi string → string tampilan. Pengecoh yang
     tampil sama dengan kunci/pengecoh lain dibuang, lalu diisi ulang. */
  function numOpts(r, correct, wrongs, d, wrap) {
    wrap = wrap || function (s) { return s; };
    var key = n(correct, d), seen = {}, out = [];
    seen[key] = 1;
    function add(v) {
      if (!isFinite(v) || out.length >= 4) return;
      var s = n(v, d); if (seen[s]) return; seen[s] = 1; out.push(s);
    }
    wrongs.forEach(add);
    var mult = [1.15, 0.85, 1.3, 0.7, 1.5, 0.6, 1.08, 0.92, 2, 0.5], i = 0;
    while (out.length < 4 && i < 40) {
      var m = mult[i % mult.length] + Math.floor(i / mult.length) * 0.03;
      add(correct === 0 ? (i + 1) * Math.pow(10, -d) * 3 : correct * m); i++;
    }
    return { correct: wrap(key), wrong: out.map(wrap) };
  }
  // opsi berupa string TeX/teks
  function strOpts(correct, wrongs) {
    var seen = {}, out = []; seen[correct] = 1;
    wrongs.forEach(function (w) { if (!seen[w] && out.length < 4) { seen[w] = 1; out.push(w); } });
    return { correct: correct, wrong: out };
  }
  var M = function (s) { return '\\(' + s + '\\)'; };

  // ---------- TEMPLATE ----------
  // conf: Tinggi / Sedang ; src: sesi ujian yang memuat soal sejenis
  var T = [];

  // 1. Bayes 3 kategori
  T.push({ id: 'bayes3', topic: 'Peluang bersyarat & Bayes', conf: 'Tinggi',
    src: 'Mei 2026 #2, Agu 2023 #14, Mei 2023 #27, Apr 2024 #27',
    gen: function (r) {
      var p1 = r.pick([0.1, 0.15, 0.2]), p2 = r.pick([0.25, 0.3, 0.35]), p3 = +(1 - p1 - p2).toFixed(2);
      var d1 = r.pick([0.3, 0.4, 0.5]), d2 = r.pick([0.1, 0.15, 0.2]), d3 = r.pick([0.01, 0.02, 0.05]);
      var surv = p1 * (1 - d1) + p2 * (1 - d2) + p3 * (1 - d3), die = 1 - surv;
      var askSurv = r() < 0.6, ans, w, sol;
      if (askSurv) {
        ans = p2 * (1 - d2) / surv;
        w = [p2 * (1 - d2), p2 * d2 / die, p2, p2 * (1 - d2) / (1 - p2)];
        sol = 'P(selamat) = ' + n(p1, 2) + '·' + n(1 - d1, 2) + ' + ' + n(p2, 2) + '·' + n(1 - d2, 2) + ' + ' + n(p3, 2) + '·' + n(1 - d3, 2) + ' = ' + n(surv, 4) +
          '. Maka P(serius | selamat) = ' + n(p2 * (1 - d2), 4) + ' / ' + n(surv, 4) + ' = <b>' + n(ans, 4) + '</b>.';
      } else {
        ans = p1 * d1 / die;
        w = [p1 * d1, p1 * (1 - d1) / surv, p1, d1];
        sol = 'P(meninggal) = ' + n(p1, 2) + '·' + n(d1, 2) + ' + ' + n(p2, 2) + '·' + n(d2, 2) + ' + ' + n(p3, 2) + '·' + n(d3, 2) + ' = ' + n(die, 4) +
          '. Maka P(kritis | meninggal) = ' + n(p1 * d1, 4) + ' / ' + n(die, 4) + ' = <b>' + n(ans, 4) + '</b>.';
      }
      var q = 'Pasien UGD diklasifikasikan saat tiba: ' + pct(p1) + ' kritis, ' + pct(p2) + ' serius, sisanya stabil. Peluang meninggal di UGD: ' +
        pct(d1) + ' untuk pasien kritis, ' + pct(d2) + ' untuk serius, dan ' + pct(d3) + ' untuk stabil. ' +
        (askSurv ? 'Jika seorang pasien diketahui <b>selamat</b>, berapa peluang ia tiba dalam kondisi <b>serius</b>?'
                 : 'Jika seorang pasien diketahui <b>meninggal</b>, berapa peluang ia tiba dalam kondisi <b>kritis</b>?') +
        ' (Pilih jawaban paling mendekati.)';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
    } });

  // 2. Proporsi nasabah (himpunan)
  T.push({ id: 'cars', topic: 'Aljabar himpunan & peluang dasar', conf: 'Tinggi',
    src: 'Mei 2026 #1, Agu 2023 #24, Mei 2023 #2, Apr 2024 #17',
    gen: function (r) {
      var a, b, c, x, tries = 0;
      do { a = r.pick([0.6, 0.65, 0.7, 0.75]); b = r.pick([0.15, 0.2, 0.25]); c = r.pick([0.1, 0.15, 0.2]); x = b - c * a; tries++; } while ((x <= 0.02 || 1 - a - x <= 0.03) && tries < 50);
      var ans = (1 - a) - x;
      var q = 'Studi pengalaman portofolio asuransi mobil: (i) setiap nasabah mengasuransikan minimal satu mobil; (ii) ' + pct(a) +
        ' nasabah mengasuransikan lebih dari satu mobil; (iii) ' + pct(b) + ' nasabah mengasuransikan (tepat) satu mobil sport; (iv) di antara nasabah dengan lebih dari satu mobil, ' +
        pct(c) + ' memiliki satu mobil sport. Hitung peluang seorang nasabah acak mengasuransikan <b>tepat satu mobil</b> dan mobil itu <b>bukan mobil sport</b>.';
      var sol = 'P(1 mobil) = 1 − ' + n(a, 2) + ' = ' + n(1 - a, 2) + '. P(sport ∩ >1 mobil) = ' + n(c, 2) + '·' + n(a, 2) + ' = ' + n(c * a, 4) +
        ', sehingga P(sport ∩ 1 mobil) = ' + n(b, 2) + ' − ' + n(c * a, 4) + ' = ' + n(x, 4) + '. Jawaban = ' + n(1 - a, 2) + ' − ' + n(x, 4) + ' = <b>' + n(ans, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [1 - a - b, (1 - a) * (1 - b), (1 - a) - c * a, (1 - a) * (1 - c)], 3));
    } });

  // 3. Wilayah X/Y tanpa klaim
  T.push({ id: 'region', topic: 'Peluang total', conf: 'Tinggi',
    src: 'Jul 2024 #14, Okt 2024 #14',
    gen: function (r) {
      var x = r.pick([0.1, 0.15, 0.2]), y = r.pick([0.4, 0.45, 0.5]);
      var tot = r.pick([0.25, 0.3, 0.35]);
      var pX = (y - tot) / (y - x), cond = r() < 0.5;
      var ans = cond ? pX * x / tot : pX;
      var q = 'Perusahaan asuransi kesehatan menjual polis kepada penduduk wilayah X dan Y. Pengalaman klaim: (i) ' + pct(tot) +
        ' dari seluruh pemegang polis tidak mengajukan klaim; (ii) ' + pct(x) + ' pemegang polis wilayah X tidak mengajukan klaim; (iii) ' + pct(y) +
        ' pemegang polis wilayah Y tidak mengajukan klaim. ' + (cond ? 'Seorang pemegang polis yang <b>tidak mengajukan klaim</b> dipilih acak. Berapa peluang ia penduduk wilayah X?'
          : 'Berapa peluang seorang pemegang polis yang dipilih acak adalah penduduk wilayah X?');
      var sol = 'Misal w = P(X). ' + n(x, 2) + 'w + ' + n(y, 2) + '(1 − w) = ' + n(tot, 2) + ' ⇒ w = (' + n(y, 2) + ' − ' + n(tot, 2) + ')/(' + n(y, 2) + ' − ' + n(x, 2) + ') = ' + n(pX, 4) +
        (cond ? '. Lalu P(X | tanpa klaim) = ' + n(x, 2) + '·' + n(pX, 4) + ' / ' + n(tot, 2) + ' = <b>' + n(ans, 4) + '</b>.' : ' = <b>' + n(ans, 4) + '</b>.');
      var w = cond ? [pX, 1 - pX, x / (x + y), (1 - pX) * y / tot] : [1 - pX, x / (x + y), (tot - x) / (y - x) + 0.05, tot / y];
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
    } });

  // 4. Geometrik: pengujian pasien
  T.push({ id: 'geomtest', topic: 'Distribusi geometrik (tanpa memori)', conf: 'Tinggi',
    src: 'Apr 2024 #3, Jul 2024 #3, Nov 2025 #15',
    gen: function (r) {
      var m = r.pick([3, 4, 5]), k = r.pick([10, 11, 12, 13]);
      function ex(p, q) { var g = gcd(p, q); p /= g; q /= g; return q === 1 ? 'r^{' + p + '}' : 'r^{' + p + '/' + q + '}'; }
      var correct = M(ex(k - m, m - 1));
      var wr = [M(ex(k - 1, m - 1)), M(ex(k - m, 1)), M(ex(k - m, m)), M(ex(k - 1, m)), M('1-' + ex(k - m, m - 1))];
      var q = 'Pasien dites diabetes satu per satu sampai ditemukan satu pasien yang mengidap diabetes. Tiap pasien, saling bebas, punya peluang sama untuk mengidap. Misal \\(r\\) adalah peluang <b>paling sedikit ' + m +
        '</b> pasien dites. Tentukan peluang paling sedikit ' + k + ' pasien dites, jika diketahui paling sedikit ' + m + ' pasien dites.';
      var sol = 'Misal q = peluang pasien tidak mengidap. P(paling sedikit j dites) = q^{j−1}. Jadi r = q^{' + (m - 1) + '} ⇒ q = r^{1/' + (m - 1) + '}. ' +
        'P(≥' + k + ' | ≥' + m + ') = q^{' + (k - 1) + '}/q^{' + (m - 1) + '} = q^{' + (k - m) + '} = <b>' + correct + '</b>.';
      return Object.assign({ q: q, sol: sol }, strOpts(correct, wr));
    } });

  // 5. Dana bonus binomial
  T.push({ id: 'fundC', topic: 'Binomial (kuantil diskrit)', conf: 'Tinggi',
    src: 'Mei 2026 #8, Okt 2024 #15, Jul 2024 #15',
    gen: function (r) {
      var nn = 20, p = r.pick([0.02, 0.025, 0.03, 0.04, 0.05]), F = r.pick([120, 150, 180, 240]);
      var cum = 0, k = 0;
      for (k = 0; k <= nn; k++) { cum += binom(k, nn, p); if (1 - cum < 0.01) break; }
      var ans = F / k;
      var q = 'Sebuah perusahaan menyiapkan dana ' + F + ' (juta) untuk membayar sebesar C kepada setiap karyawan (dari ' + nn + ' karyawan) yang meraih level performa tertinggi tahun ini. Setiap karyawan, saling bebas, punya peluang ' +
        pct(p) + ' meraih level tersebut. Hitung nilai <b>maksimum</b> C agar peluang dana <b>tidak cukup</b> membayar seluruh karyawan berprestasi kurang dari 1%.';
      var rows = []; var c2 = 0;
      for (var j = 0; j <= k; j++) { c2 += binom(j, nn, p); rows.push('P(N ≤ ' + j + ') = ' + n(c2, 4)); }
      var sol = 'N ~ Binomial(' + nn + '; ' + n(p, 3) + '). Dana tidak cukup ⇔ N·C > ' + F + '. Cari k terkecil dengan P(N > k) < 0,01: ' + rows.join('; ') +
        '. Jadi k = ' + k + ' dan C maks = ' + F + '/' + k + ' = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [F / (k + 1), k > 1 ? F / (k - 1) : F * 1.25, F / (nn * p), F / (k + 2), F / nn], 2));
    } });

  // 6. Poisson dengan skala waktu
  T.push({ id: 'poisrate', topic: 'Poisson (perubahan interval)', conf: 'Tinggi',
    src: 'Mei 2026 #27, Nov 2025 #30, Agu 2025 #28',
    gen: function (r) {
      var h = r.pick([6, 8, 12]), mult = r.pick([2, 3]), w = h * mult, j = r.pick([0, 1, 2]);
      var lam = mult, ans = 0; for (var i = 0; i <= j; i++) ans += pois(i, lam);
      var wrong = [0, 0, 0, 0];
      for (i = 0; i <= j; i++) wrong[0] += pois(i, 1);
      for (i = 0; i < j; i++) wrong[1] += pois(i, lam);
      wrong[2] = 1 - ans; wrong[3] = ans + pois(j + 1, lam);
      var q = 'Banyaknya lonjakan daya pada jaringan listrik mengikuti distribusi Poisson dengan rataan 1 lonjakan setiap ' + h + ' jam. Berapa peluang terjadi <b>tidak lebih dari ' + j + '</b> lonjakan daya dalam periode ' + w + ' jam?';
      var terms = []; for (i = 0; i <= j; i++) terms.push(i === 0 ? '1' : (i === 1 ? String(lam) : lam + '^' + i + '/' + i + '!'));
      var sol = 'Dalam ' + w + ' jam, λ = ' + lam + '. P(N ≤ ' + j + ') = e^{−' + lam + '}(' + terms.join(' + ') + ') = <b>' + n(ans, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, wrong, 4));
    } });

  // 7. Pembayaran Poisson terbatas (hujan / donasi)
  T.push({ id: 'poiscap', topic: 'Poisson: pembayaran dengan batas', conf: 'Tinggi',
    src: 'Agu 2025 #5, Okt 2024 #18, Jul 2024 #19, Agu 2023 #18 & #22, Mei 2023 #22',
    gen: function (r) {
      var v = r() < 0.5 ? 'rain' : 'hr', q, sol, ans, w;
      if (v === 'rain') {
        var lam = r.pick([0.5, 0.6, 0.8]), B = r.pick([1, 2, 3]), m = r.pick([2, 3]);
        var E = 0, E2 = 0, P = [];
        for (var k = 0; k < m; k++) { P.push(pois(k, lam)); E += B * k * pois(k, lam); E2 += B * B * k * k * pois(k, lam); }
        var tail = 1 - P.reduce(function (s, x) { return s + x; }, 0);
        E += B * m * tail; E2 += B * B * m * m * tail;
        ans = Math.sqrt(E2 - E * E);
        q = 'Sebuah tim menjadwalkan pertandingan pembuka pada 1 April. Jika hujan, pertandingan ditunda ke hari berikutnya yang tidak hujan. Tim membeli asuransi yang membayar ' + B +
          ' juta untuk setiap hari penundaan, maksimal ' + m + ' hari. Banyaknya hari hujan berturut-turut mulai 1 April berdistribusi Poisson dengan rataan ' + n(lam, 1) + '. Hitung <b>deviasi standar</b> pembayaran asuransi.';
        sol = 'Y = ' + B + '·min(N, ' + m + '). E[Y] = ' + n(E, 4) + ', E[Y²] = ' + n(E2, 4) + ' (peluang N ≥ ' + m + ' = ' + n(tail, 4) + '). Var = ' + n(E2 - E * E, 4) + ' ⇒ SD = <b>' + n(ans, 4) + '</b>.';
        w = [B * Math.sqrt(lam), E2 - E * E, E, B * Math.sqrt(lam) * 0.9];
      } else {
        var lam2 = r.pick([3, 4, 5]), kk = r.pick([2, 3]), amt = r.pick([50, 100]);
        var Emin = 0; for (var i = 0; i <= kk; i++) Emin += Math.min(i, kk) * pois(i, lam2);
        Emin += kk * (1 - [0, 1, 2, 3].slice(0, kk + 1).reduce(function (s, i2) { return s + pois(i2, lam2); }, 0));
        ans = amt * (lam2 - Emin);
        q = 'Sebuah tim menyumbangkan ' + amt + ' juta untuk setiap home run <b>setelah</b> home run ke-' + kk + ' dalam satu pertandingan. Banyaknya home run per pertandingan berdistribusi Poisson dengan rataan ' + lam2 + '. Hitung ekspektasi besar sumbangan.';
        sol = 'Sumbangan = ' + amt + '·(N − ' + kk + ')⁺ = ' + amt + '·(N − min(N, ' + kk + ')). E[min(N,' + kk + ')] = ' + n(Emin, 4) + '. Jadi E = ' + amt + '·(' + lam2 + ' − ' + n(Emin, 4) + ') = <b>' + n(ans, 2) + '</b>.';
        w = [amt * (lam2 - kk), amt * Emin, amt * (lam2 - kk) + amt * pois(0, lam2) * kk, amt * lam2 * (1 - pois(0, lam2))];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
    } });

  // 8. Campuran eksponensial – Bayes
  T.push({ id: 'renters', topic: 'Bayes dengan distribusi eksponensial', conf: 'Tinggi',
    src: 'Okt 2024 #27, Jul 2024 #27',
    gen: function (r) {
      var a = r.pick([0.3, 0.4, 0.25]), mH = r.pick([4, 5]), mA = r.pick([2, 3]), tt = r.pick([1, 2]);
      var nu = a * Math.exp(-tt / mH), de = nu + (1 - a) * Math.exp(-tt / mA), ans = nu / de;
      var wrongRate = a * Math.exp(-tt * mH) / (a * Math.exp(-tt * mH) + (1 - a) * Math.exp(-tt * mA));
      var q = 'Perusahaan asuransi menjual ' + pct(a) + ' polis kepada penyewa rumah dan sisanya kepada penyewa apartemen. Waktu dari pembelian sampai pembatalan polis berdistribusi eksponensial dengan rataan ' + mH +
        ' tahun (penyewa rumah) dan ' + mA + ' tahun (penyewa apartemen). Jika seorang pemegang polis <b>masih memiliki polisnya ' + tt + ' tahun</b> setelah pembelian, berapa peluang ia penyewa rumah?';
      var sol = 'P(rumah | T > ' + tt + ') = ' + n(a, 2) + 'e^{−' + tt + '/' + mH + '} / [' + n(a, 2) + 'e^{−' + tt + '/' + mH + '} + ' + n(1 - a, 2) + 'e^{−' + tt + '/' + mA + '}] = ' + n(nu, 4) + '/' + n(de, 4) + ' = <b>' + n(ans, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [a, wrongRate, 1 - ans, a * Math.exp(-tt / mH)], 3));
    } });

  // 9. Aproksimasi normal selisih Poisson & binomial
  T.push({ id: 'twolines', topic: 'Aproksimasi normal + koreksi kontinuitas', conf: 'Tinggi',
    src: 'Okt 2024 #29, Jul 2024 #29, Nov 2025 #23',
    gen: function (r) {
      var lam = r.pick([30, 40, 50, 60]), p = lam / 100, d = r.pick([2, 3, 4]);
      var v = lam + 100 * p * (1 - p), s = Math.sqrt(v);
      var ans = 2 * (1 - Phi((d + 0.5) / s));
      var q = 'Perusahaan asuransi memiliki dua lini bisnis yang saling bebas. Banyaknya klaim per bulan lini 1, \\(N_1\\), berdistribusi Poisson dengan rataan ' + lam +
        '; lini 2, \\(N_2\\), berdistribusi binomial dengan n = 100 dan p = ' + n(p, 1) + '. Dengan aproksimasi normal dan koreksi kontinuitas, hitung \\(P(|N_1-N_2|>' + d + ')\\).';
      var sol = 'D = N₁ − N₂: E[D] = 0, Var(D) = ' + lam + ' + 100·' + n(p, 1) + '·' + n(1 - p, 1) + ' = ' + n(v, 0) + ', σ = ' + n(s, 4) + '. |D| > ' + d + ' ⇔ |D| ≥ ' + (d + 1) +
        ', koreksi: 2·P(D ≥ ' + (d + 0.5).toString().replace('.', ',') + ') = 2[1 − Φ(' + n((d + 0.5) / s, 4) + ')] = <b>' + n(ans, 4) + '</b>.';
      var w = [2 * (1 - Phi(d / s)), 2 * (1 - Phi((d + 1.5) / s)), 1 - Phi((d + 0.5) / s), 2 * (1 - Phi((d + 0.5) / Math.sqrt(2 * lam)))];
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
    } });

  // 10. Binomial bencana tahunan
  T.push({ id: 'quake', topic: 'Distribusi binomial', conf: 'Tinggi',
    src: 'Nov 2025 #21, Okt 2024 #28, Mei 2026 #20',
    gen: function (r) {
      var p = r.pick([0.05, 0.08, 0.1]), N = r.pick([20, 25, 27, 30]), less = r() < 0.5, k = r.pick([3, 4, 5]);
      var cdf = function (j) { var s = 0; for (var i = 0; i <= j; i++) s += binom(i, N, p); return s; };
      var ans = less ? cdf(k - 1) : 1 - cdf(k - 1);
      var pc = function (j) { var s = 0; for (var i = 0; i <= j; i++) s += pois(i, N * p); return s; };
      var w = less ? [cdf(k), pc(k - 1), 1 - cdf(k - 1), cdf(k - 2)] : [1 - cdf(k), 1 - pc(k - 1), cdf(k - 1), binom(k, N, p)];
      var ev = r.pick(['gempa bumi', 'badai']);
      var q = 'Perusahaan menetapkan harga asuransi ' + ev + ' dengan asumsi: (i) dalam satu tahun kalender paling banyak terjadi satu ' + ev + '; (ii) peluang terjadinya ' + ev + ' dalam satu tahun ' + n(p, 2) +
        '; (iii) kejadian antar tahun saling bebas. Hitung peluang terjadi <b>' + (less ? 'kurang dari ' + k : 'paling sedikit ' + k) + '</b> ' + ev + ' dalam ' + N + ' tahun.';
      var sol = 'N ~ Binomial(' + N + '; ' + n(p, 2) + '). ' + (less ? 'P(N < ' + k + ') = P(N ≤ ' + (k - 1) + ')' : 'P(N ≥ ' + k + ') = 1 − P(N ≤ ' + (k - 1) + ')') + ' = <b>' + n(ans, 4) + '</b>. (Hati-hati: “kurang dari” ≠ “paling banyak”.)';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
    } });

  // 11. Polis suami-istri
  T.push({ id: 'couple', topic: 'Ekspektasi bersyarat (diskrit)', conf: 'Tinggi',
    src: 'Okt 2024 #24, Jul 2024 #24',
    gen: function (r) {
      var wv = r.pick([0.02, 0.025, 0.03]), h = r.pick([0.01, 0.015, 0.02]), b = r.pick([0.94, 0.95, 0.96]);
      var B = 10000, P = 500, ans = (b * 2 * P + h * (2 * P - B)) / (b + h);
      var q = 'Dua polis asuransi jiwa, masing-masing dengan manfaat kematian ' + n(B, 0) + ' dan premi tunggal ' + P + ', dijual kepada pasangan suami-istri (satu polis per orang) dan berakhir di akhir tahun ke-10. Peluang hanya istri yang bertahan hidup minimal 10 tahun ' +
        n(wv, 3) + ', hanya suami ' + n(h, 3) + ', dan keduanya ' + n(b, 2) + '. Hitung ekspektasi kelebihan premi atas klaim, <b>diketahui suami bertahan hidup minimal 10 tahun</b>.';
      var sol = 'Diketahui suami hidup: keduanya hidup (peluang ' + n(b, 2) + ') → kelebihan 1.000; hanya suami hidup (' + n(h, 3) + ') → 1.000 − 10.000 = −9.000. E = [' + n(b, 2) + '·1.000 + ' + n(h, 3) + '·(−9.000)] / ' + n(b + h, 3) + ' = <b>' + n(ans, 1) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [2 * P - B * h, 2 * P - B * (1 - b), b * 2 * P + h * (2 * P - B), 2 * P - B * h / (1 - wv)], 1));
    } });

  // 12. PGF/MGF momen binomial
  T.push({ id: 'pgf3', topic: 'Fungsi pembangkit (PGF/MGF)', conf: 'Sedang',
    src: 'Apr 2024 #4, Jul 2024 #4, Agu 2023 #4',
    gen: function (r) {
      var N = r.pick([4, 5, 6]), p = r.pick([0.3, 0.4, 0.6, 0.65, 0.7]);
      var E3 = 0, E2 = 0; for (var k = 0; k <= N; k++) { E3 += k * k * k * binom(k, N, p); E2 += k * k * binom(k, N, p); }
      var fall = N * (N - 1) * (N - 2) * p * p * p;
      var q = 'Fungsi pembangkit peluang dari variabel acak binomial X adalah \\(P_X(t) = (' + t(1 - p, 2) + ' + ' + t(p, 2) + 't)^{' + N + '}\\). Tentukan \\(E[X^3]\\).';
      var sol = 'P‴(1) = E[X(X−1)(X−2)] = n(n−1)(n−2)p³ = ' + n(fall, 4) + '. Karena X³ = X(X−1)(X−2) + 3X(X−1) + X: E[X³] = ' + n(fall, 4) + ' + 3·' + n(N * (N - 1) * p * p, 4) + ' + ' + n(N * p, 4) + ' = <b>' + n(E3, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, E3, [fall, Math.pow(N * p, 3), E2 * N * p, fall + N * p], 3));
    } });

  // 13. Distribusi campuran
  T.push({ id: 'mixed', topic: 'Distribusi campuran diskrit-kontinu', conf: 'Tinggi',
    src: 'Okt 2024 #11, Apr 2024 #24, Agu 2023 #10',
    gen: function (r) {
      var a = r.pick([0.1, 0.2, 0.3]), b = r.pick([0.1, 0.2, 0.3, 0.5]);
      if (a + b >= 0.9) b = 0.2;
      var c = 2 * (1 - a - b), askVar = r() < 0.4;
      var E = b + c / 3, E2 = b + c / 4, ans = askVar ? E2 - E * E : E;
      var q = 'Variabel acak X memiliki massa peluang ' + n(a, 1) + ' di X = 0 dan ' + n(b, 1) + ' di X = 1. Untuk nilai lain, X memiliki fungsi kepadatan \\(f(x) = ' + t(c, 1) + 'x\\) untuk 0 < x < 1 dan 0 di luar itu. Hitung <b>' + (askVar ? 'Var(X)' : 'E[X]') + '</b>.';
      var sol = 'Cek total massa: ' + n(a, 1) + ' + ' + n(b, 1) + ' + ∫₀¹ ' + n(c, 1) + 'x dx = 1 ✓. E[X] = 0·' + n(a, 1) + ' + 1·' + n(b, 1) + ' + ∫₀¹ ' + n(c, 1) + 'x² dx = ' + n(E, 4) +
        (askVar ? '. E[X²] = ' + n(b, 1) + ' + ∫₀¹ ' + n(c, 1) + 'x³ dx = ' + n(E2, 4) + '. Var = ' + n(E2, 4) + ' − ' + n(E, 4) + '² = <b>' + n(ans, 4) + '</b>.' : ' = <b>' + n(ans, 4) + '</b>.');
      var w = askVar ? [E2, c / 4 - Math.pow(c / 3, 2), b * (1 - b), E2 - E] : [c / 3, b + c / 2, b + c / 3 + a, c / 2];
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 4));
    } });

  // 14. Dua penawaran seragam
  T.push({ id: 'bids', topic: 'Seragam bivariat (peluang geometris)', conf: 'Sedang',
    src: 'Mei 2026 #13, Apr 2024 #21',
    gen: function (r) {
      var L = r.pick([2000, 1500, 1000]), R = r.pick([200, 100, 250]), d = r.pick([10, 20, 25, 50]);
      if (d >= R / 2) d = R / 10;
      var ans = 1 - Math.pow(1 - d / R, 2);
      var q = 'Dua perusahaan asuransi mengajukan penawaran harga (juta rupiah) yang saling bebas dan masing-masing berdistribusi seragam pada interval [' + n(L, 0) + ', ' + n(L + R, 0) +
        ']. Klien langsung menerima penawaran terendah jika selisih kedua penawaran minimal ' + d + '; jika tidak, klien mempertimbangkan lebih lanjut kedua penawaran. Hitung peluang klien <b>mempertimbangkan lebih lanjut</b>.';
      var sol = 'Geser ke U, V ~ Seragam(0, ' + R + '). P(|U − V| ≥ ' + d + ') = (1 − ' + d + '/' + R + ')² = ' + n(Math.pow(1 - d / R, 2), 4) + '. Jadi P(|U − V| < ' + d + ') = <b>' + n(ans, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [Math.pow(1 - d / R, 2), d / R, 2 * d / R + 0.01, Math.pow(d / R, 2) * 2], 4));
    } });

  // 15. Bonus manajer risiko
  T.push({ id: 'bonus', topic: 'Ekspektasi fungsi variabel acak', conf: 'Tinggi',
    src: 'Apr 2024 #13, Jul 2024 #13',
    gen: function (r) {
      var L = r.pick([2000, 2500, 3000]), P = r.pick([800, 1000, 1200, 1500]), f = r.pick([0.2, 0.25, 0.3]);
      var ans = f * P * P / (2 * L);
      var q = 'Kerugian tahunan berdistribusi seragam pada [0, ' + n(L, 0) + ']. Premi asuransi ' + n(P, 0) + ' dibebankan untuk menutup kerugian. Jika kerugian di bawah premi, manajer risiko menerima bonus sebesar ' + pct(f) + ' dari selisih premi dan kerugian. Hitung ekspektasi bonus.';
      var sol = 'Bonus = ' + n(f, 2) + '·(' + P + ' − X)⁺. E = ' + n(f, 2) + '·∫₀^{' + P + '} (' + P + ' − x)/' + L + ' dx = ' + n(f, 2) + '·' + P + '²/(2·' + L + ') = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [f * (P - L / 2) > 0 ? f * (P - L / 2) : f * P / 4, f * P / 2, f * P * P / L, f * P * P / (2 * L) * (P / L)], 2));
    } });

  // 16. Median campuran eksponensial
  T.push({ id: 'mixmed', topic: 'Kuantil/median distribusi campuran', conf: 'Tinggi',
    src: 'Apr 2024 #6, Jul 2024 #6',
    gen: function (r) {
      var a = r.pick([0.6, 0.7, 0.75, 0.8]);
      var u = (-(1 - a) + Math.sqrt((1 - a) * (1 - a) + 2 * a)) / (2 * a), m = -2 * Math.log(u);
      var q = 'Kecelakaan mobil menghasilkan kerusakan ringan atau berat. Kerusakan ringan berdistribusi eksponensial dengan rataan 1; kerusakan berat berdistribusi eksponensial dengan rataan 2. Sebanyak ' + pct(a) + ' kecelakaan mengakibatkan kerusakan ringan. Tentukan <b>median</b> besar kerusakan dari kecelakaan acak.';
      var sol = 'Cari m dengan ' + n(a, 2) + 'e^{−m} + ' + n(1 - a, 2) + 'e^{−m/2} = 0,5. Misal u = e^{−m/2}: ' + n(a, 2) + 'u² + ' + n(1 - a, 2) + 'u − 0,5 = 0 ⇒ u = ' + n(u, 4) + ', m = −2 ln u = <b>' + n(m, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, m, [Math.log(2) * (a + 2 * (1 - a)), a + 2 * (1 - a), Math.log(2), 2 * Math.log(2) * a], 3));
    } });

  // 17. Densitas bersama: peluang bersyarat
  T.push({ id: 'jointcond', topic: 'Densitas bersama: peluang bersyarat', conf: 'Tinggi',
    src: 'Okt 2024 #16 & #19, Jul 2024 #16',
    gen: function (r) {
      var al = r.pick([1, 2]), be = al === 2 ? 1 : r.pick([1, 2]), s = r.pick([1.5, 2, 2.5]);
      var N = 4 * (al + be);
      var inner = function (x) { var y0 = Math.max(0, s - x); if (y0 >= 2) return 0; return (al * x * (2 - y0) + be * (4 - y0 * y0) / 2) / N; };
      var num = simpson(inner, 0, 1, 4000), den = (al + 2 * be) / N, ans = num / den;
      var numer = (al === 1 ? '' : al) + 'x + ' + (be === 1 ? '' : be) + 'y';
      var q = 'X dan Y memiliki fungsi kepadatan bersama \\(f(x,y) = \\dfrac{' + numer + '}{' + N + '}\\) untuk \\(0 \\le x \\le 2\\) dan \\(0 \\le y \\le 2\\). Hitung \\(P(X+Y \\ge ' + t(s, s % 1 ? 1 : 0) + ' \\mid X \\le 1)\\).';
      var sol = 'P(X ≤ 1) = ∫₀¹∫₀² f dy dx = ' + n(den, 4) + '. P(X ≤ 1, X + Y ≥ ' + n(s, s % 1 ? 1 : 0) + ') = ∫₀¹ ∫ f dy dx dengan y dari max(0; ' + n(s, s % 1 ? 1 : 0) + ' − x) sampai 2 = ' + n(num, 4) + '. Hasil = ' + n(num, 4) + '/' + n(den, 4) + ' = <b>' + n(ans, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [num, 1 - ans, num / 0.5, ans * den / 0.5], 3));
    } });

  // 18. c(y−x) pada segitiga
  T.push({ id: 'triangle', topic: 'Densitas bersama: marginal & ekspektasi', conf: 'Tinggi',
    src: 'Okt 2024 #10, Agu 2023 #21, Mei 2026 #18',
    gen: function (r) {
      var L = r.pick([1, 2, 3]), what = r.pick(['EX', 'EY', 'c']);
      var c = 6 / Math.pow(L, 3), ans, w, lbl;
      var cT = L === 1 ? '6' : frac(6, Math.pow(L, 3));
      if (what === 'c') { lbl = 'nilai konstanta c'; ans = M(cT); w = [M(frac(2, Math.pow(L, 2))), M(frac(3, Math.pow(L, 3))), M(frac(12, Math.pow(L, 3))), M(frac(1, Math.pow(L, 3))), M(frac(4, Math.pow(L, 3))), M(frac(1, Math.pow(L, 2)))]; }
      else if (what === 'EX') { lbl = 'mean distribusi marginal X'; ans = M(frac(L, 4)); w = [M(frac(L, 3)), M(frac(L, 2)), M(frac(3 * L, 4)), M(frac(2 * L, 3))]; }
      else { lbl = 'mean distribusi marginal Y'; ans = M(frac(3 * L, 4)); w = [M(frac(2 * L, 3)), M(frac(L, 2)), M(frac(L, 4)), M(frac(L, 3))]; }
      var q = 'X dan Y variabel acak kontinu dengan fungsi kepadatan bersama \\(f(x,y) = c(y-x)\\) untuk \\(0 < x < y < ' + L + '\\), dan 0 di luar itu. Tentukan <b>' + lbl + '</b>.';
      var sol = '∫₀^{' + L + '}∫₀^{y} (y − x) dx dy = ∫₀^{' + L + '} y²/2 dy = ' + L + '³/6 ⇒ c = ' + cT.replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2') + '. f_X(x) = c(' + L + ' − x)²/2 ⇒ E[X] = ' + L + '/4; f_Y(y) = c·y²/2 ⇒ E[Y] = 3·' + L + '/4. Jawaban: <b>' + ans + '</b>.';
      return Object.assign({ q: q, sol: sol }, strOpts(ans, w));
    } });

  // 19. Varians total
  T.push({ id: 'totvar', topic: 'Hukum varians total', conf: 'Tinggi',
    src: 'Mei 2026 #29, Nov 2025 #27, Mei 2023 #19',
    gen: function (r) {
      var v = r.pick(['A', 'B', 'C']), q, sol, ans, w;
      if (v === 'A') {
        var mu = r.pick([2, 3, 4]), s2 = r.pick([1, 2, 3]);
        ans = 2 * s2 + mu * mu;
        q = 'X variabel acak dengan rataan ' + mu + ' dan varians ' + s2 + '. Untuk setiap x, distribusi bersyarat Y diketahui X = x memiliki rataan x dan varians x². Tentukan varians distribusi marginal Y.';
        sol = 'Var(Y) = E[Var(Y|X)] + Var(E[Y|X]) = E[X²] + Var(X) = (' + s2 + ' + ' + mu + '²) + ' + s2 + ' = <b>' + ans + '</b>.';
        w = [s2 + mu * mu, s2, mu * mu, s2 + mu];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 0));
      } else if (v === 'B') {
        var N = r.pick([5, 8, 10]), p = r.pick([0.2, 0.3, 0.4]);
        ans = N * p + N * p * (1 - p);
        q = 'X berdistribusi binomial dengan n = ' + N + ' dan p = ' + n(p, 1) + ', dan distribusi bersyarat Y diketahui X = x adalah Poisson dengan rataan x. Tentukan Var(Y).';
        sol = 'Var(Y) = E[Var(Y|X)] + Var(E[Y|X]) = E[X] + Var(X) = ' + n(N * p, 2) + ' + ' + n(N * p * (1 - p), 2) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [N * p, N * p * (1 - p), N * p * p + N * p, 2 * N * p];
      } else {
        ans = 3.5 + 35 / 12;
        q = 'X adalah hasil pelemparan sebuah dadu setimbang. Distribusi bersyarat Y diketahui X adalah Poisson dengan rataan X. Tentukan Var(Y).';
        sol = 'E[X] = 3,5; Var(X) = 35/12. Var(Y) = E[X] + Var(X) = 3,5 + 2,9167 = <b>' + n(ans, 4) + '</b>.';
        w = [3.5, 35 / 12, 91 / 6, 3.5 + 91 / 6];
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
    } });

  // 20. Normal: modus & persentil
  T.push({ id: 'normpct', topic: 'Distribusi normal (persentil)', conf: 'Sedang',
    src: 'Nov 2025 #6 & #12, Apr 2024 #12',
    gen: function (r) {
      var mu = r.pick([56, 60, 64, 70]), sig = r.pick([8, 10, 12, 15]), pp = r.pick([0.3, 0.4]);
      var qv = +(mu + invPhi(pp) * sig).toFixed(2), sigH = (mu - qv) / -invPhi(pp);
      var x = +(mu + r.pick([0.5, 0.6, 0.75, 1.0]) * sig).toFixed(2), z = (x - mu) / sigH, ans = Phi(z);
      var q = 'Nilai akhir suatu mata kuliah dimodelkan dengan distribusi normal. Modus nilai adalah ' + n(mu, 2) + ' dan persentil ke-' + Math.round(pp * 100) + ' adalah ' + n(qv, 2) +
        '. Nilai ' + n(x, 2) + ' berada pada persentil berapa? (Nyatakan sebagai peluang, pilih yang paling mendekati.)';
      var sol = 'Untuk normal, modus = rataan = ' + n(mu, 2) + '. z_{' + n(pp, 2) + '} = ' + n(invPhi(pp), 4) + ' ⇒ σ = (' + n(mu, 2) + ' − ' + n(qv, 2) + ')/' + n(-invPhi(pp), 4) + ' = ' + n(sigH, 3) +
        '. z = (' + n(x, 2) + ' − ' + n(mu, 2) + ')/' + n(sigH, 3) + ' = ' + n(z, 4) + ' ⇒ Φ(z) = <b>' + n(ans, 4) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [1 - ans, Phi(z / 2), Phi(z * 1.5), Phi((x - mu) / Math.sqrt(sigH))], 3));
    } });

  // 21. TLP: persentil total
  T.push({ id: 'cltpct', topic: 'Teorema limit pusat', conf: 'Tinggi',
    src: 'Mei 2026 #9, Agu 2025 #14 & #20, Okt 2024 #12, Mei 2023 #29',
    gen: function (r) {
      var N = r.pick([1600, 2025, 2500, 900]), mu = r.pick([3125, 2500, 4000]), sd = r.pick([200, 250, 300]), pp = r.pick([0.9, 0.95]);
      var z = pp === 0.9 ? 1.2816 : 1.6449, ans = N * mu + z * sd * Math.sqrt(N);
      var q = 'Suatu acara amal menerima bantuan dari ' + n(N, 0) + ' sumber (dalam juta rupiah) yang saling bebas dan berdistribusi identik dengan rataan ' + n(mu, 0) + ' dan deviasi standar ' + sd + '. Hitung aproksimasi <b>persentil ke-' + Math.round(pp * 100) + '</b> dari total bantuan.';
      var sol = 'S ≈ Normal(nμ, σ√n): nμ = ' + n(N * mu, 0) + ', σ√n = ' + sd + '·' + Math.sqrt(N) + ' = ' + n(sd * Math.sqrt(N), 0) + '. Persentil = ' + n(N * mu, 0) + ' + ' + n(z, 4) + '·' + n(sd * Math.sqrt(N), 0) + ' = <b>' + n(ans, 0) + '</b>.';
      var z2 = pp === 0.9 ? 1.6449 : 1.2816;
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [N * mu + z * sd, N * mu + z2 * sd * Math.sqrt(N), N * mu + z * sd * N / 10, N * mu - z * sd * Math.sqrt(N)], 0));
    } });

  // 22. Transformasi Y = T^2
  T.push({ id: 'transform', topic: 'Transformasi variabel acak', conf: 'Tinggi',
    src: 'Mei 2026 #7, #14 & #24, Agu 2025 #17, Jul 2024 #25',
    gen: function (r) {
      var a = r.pick([2, 3]), b = r.pick([2, 3, 4]);
      var ab = Math.pow(a, b);
      function dens(coefN, coefD, pw) { var g = gcd(coefN, coefD); coefN /= g; coefD /= g; if (pw === '1') return M(coefD === 1 ? '\\dfrac{' + coefN + '}{y}' : '\\dfrac{' + coefN + '}{' + coefD + 'y}'); return M((coefD === 1 ? '\\dfrac{' + coefN + '}{' : '\\dfrac{' + coefN + '}{' + coefD) + 'y^{' + pw + '}}'); }
      var pw = b / 2 + 1, pwS = (b % 2 === 0) ? String(pw) : (b + 2) + '/2';
      var correct = dens(b * ab, 2, pwS);
      var w = [dens(b * ab, 1, String(b + 1)), dens(b * ab, 2, (b % 2 === 0) ? String(b / 2) : b + '/2'), dens(b * ab, 1, pwS), dens(ab, 2, pwS)];
      var q = 'Waktu sampai mesin berhenti beroperasi, T, memiliki fungsi distribusi \\(F(t) = 1 - \\left(\\dfrac{' + a + '}{t}\\right)^{' + b + '}\\) untuk \\(t > ' + a + '\\), dan 0 untuk lainnya. Biaya tambahan dinyatakan \\(Y = T^2\\). Tentukan fungsi densitas Y untuk \\(y > ' + (a * a) + '\\).';
      var sol = 'F_Y(y) = P(T ≤ √y) = 1 − ' + a + '^' + b + '·y^{−' + b + '/2} = 1 − ' + ab + 'y^{−' + b + '/2}. Turunkan: f_Y(y) = (' + b + '/2)·' + ab + '·y^{−(' + b + '/2+1)} = <b>' + correct + '</b>.';
      return Object.assign({ q: q, sol: sol }, strOpts(correct, w));
    } });

  // 23. MGF bersama diskrit
  T.push({ id: 'jointmgf', topic: 'MGF bersama', conf: 'Tinggi',
    src: 'Mei 2026 #28, Agu 2025 #9, Apr 2024 #26, Jul 2024 #26',
    gen: function (r) {
      var parts = r.pick([[3, 1, 2, 4], [2, 3, 1, 4], [1, 2, 3, 4], [4, 1, 3, 2], [2, 2, 3, 3], [1, 4, 2, 3]]);
      var p00 = parts[0] / 10, p10 = parts[1] / 10, p01 = parts[2] / 10, p11 = parts[3] / 10;
      var A = r.pick([2, 3]), B = r.pick([1, 2]);
      var E1 = p10 + p11, E2 = p01 + p11, ans = A * E1 - B * E2;
      var q = 'X₁ dan X₂ memiliki fungsi pembangkit momen bersama \\(M(t_1,t_2) = ' + t(p00, 1) + ' + ' + t(p10, 1) + 'e^{t_1} + ' + t(p01, 1) + 'e^{t_2} + ' + t(p11, 1) + 'e^{t_1+t_2}\\). Hitung \\(E(' + A + 'X_1 - ' + (B === 1 ? '' : B) + 'X_2)\\).';
      var sol = 'E[X₁] = ∂M/∂t₁ di (0,0) = ' + n(p10, 1) + ' + ' + n(p11, 1) + ' = ' + n(E1, 1) + '; E[X₂] = ' + n(p01, 1) + ' + ' + n(p11, 1) + ' = ' + n(E2, 1) + '. Jadi ' + A + '·' + n(E1, 1) + ' − ' + B + '·' + n(E2, 1) + ' = <b>' + n(ans, 1) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, [A * p10 - B * p01, A * E1 + B * E2, A * E1 - B * E2 + p11, (A - B) * p11], 1));
    } });

  // 24. Statistik terurut
  T.push({ id: 'order', topic: 'Statistik terurut (min/maks)', conf: 'Sedang',
    src: 'Agu 2023 #9 & #20, Apr 2024 #11 & #20, Agu 2025 #7',
    gen: function (r) {
      var v = r.pick(['min', 'maxexp', 'var2']), q, sol, ans, w;
      if (v === 'min') {
        var a = r.pick([2, 3, 4]), b = a + r.pick([3, 4, 6]);
        ans = a + (b - a) / 3;
        q = 'Waktu teknisi memperbaiki sebuah perangkat berdistribusi seragam antara ' + a + ' dan ' + b + ' jam. Dua perangkat rusak bersamaan dan diperbaiki dua teknisi yang bekerja saling bebas. Hitung ekspektasi waktu hingga <b>satu</b> perangkat selesai diperbaiki.';
        sol = 'min dari 2 Seragam(' + a + ', ' + b + '): E = a + (b − a)/3 = ' + a + ' + ' + (b - a) + '/3 = <b>' + n(ans, 4) + '</b>.';
        w = [(a + b) / 2, a + 2 * (b - a) / 3, a + (b - a) / 4, a + (b - a) / 2.5];
      } else if (v === 'maxexp') {
        var m = r.pick([[1, 2], [2, 3], [2, 4], [1, 3]]);
        var s = function (arr) { return 1 / arr.reduce(function (x, y) { return x + 1 / y; }, 0); };
        ans = m[0] + m[1] - s(m);
        q = 'X₁ dan X₂ saling bebas, berdistribusi eksponensial dengan rataan ' + m[0] + ' dan ' + m[1] + '. Hitung \\(E[\\max(X_1,X_2)]\\).';
        sol = 'E[max] = E[X₁] + E[X₂] − E[min]; min eksponensial dengan laju 1/' + m[0] + ' + 1/' + m[1] + ' ⇒ E[min] = ' + n(s(m), 4) + '. Hasil = <b>' + n(ans, 4) + '</b>.';
        w = [Math.max(m[0], m[1]), m[0] + m[1], s(m), m[0] + m[1] - 1 / (m[0] + m[1])];
      } else {
        var Lr = r.pick([1, 2, 3]);
        ans = Lr * Lr / 20;
        q = 'X₁, X₂, X₃ saling bebas dan masing-masing berdistribusi seragam pada [0, ' + Lr + ']. Jika diurutkan Y₁ ≤ Y₂ ≤ Y₃, hitung Var(Y₂).';
        sol = 'Y₂/' + Lr + ' ~ Beta(2, 2) dengan varians 1/20. Var(Y₂) = ' + Lr + '²/20 = <b>' + n(ans, 4) + '</b>.';
        w = [Lr * Lr / 12, Lr * Lr / 16, Lr * Lr / 36, Lr * Lr * 3 / 80];
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 4));
    } });

  // 25. Deductible / limit
  T.push({ id: 'deduct', topic: 'Deductible & batas manfaat', conf: 'Tinggi',
    src: 'Okt 2024 #13 & #30, Nov 2025 #14 & #22, Mei 2023 #10',
    gen: function (r) {
      var v = r() < 0.5 ? 'D' : 'cap', q, sol, ans, w;
      if (v === 'D') {
        var Mx = r.pick([3300, 3000, 2400, 6000]), k = r.pick([[1, 9], [4, 9], [1, 4], [9, 16]]);
        var sq = Math.sqrt(k[0] / k[1]);
        ans = Mx * (1 - sq);
        q = 'Polis asuransi menanggung kerugian X yang berdistribusi seragam pada [0, ' + n(Mx, 0) + ']. Pembayaran Y = 0 jika X < D dan Y = X − D jika X ≥ D. Tentukan D agar \\(E[Y] = ' + frac(k[0], k[1]) + 'E[X]\\).';
        sol = 'E[Y] = (M − D)²/(2M), E[X] = M/2 ⇒ ((M − D)/M)² = ' + k[0] + '/' + k[1] + ' ⇒ D = M(1 − ' + n(sq, 4) + ') = <b>' + n(ans, 0) + '</b>.';
        w = [Mx * (1 - k[0] / k[1]), Mx * sq, Mx * k[0] / k[1], Mx * (1 - sq) / 2];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 0));
      }
      var th = r.pick([500, 1000, 2000]), u = r.pick([1000, 1500, 3000]);
      ans = th * (1 - Math.exp(-u / th));
      q = 'Besar kerugian X berdistribusi eksponensial dengan rataan ' + n(th, 0) + '. Polis membayar sebesar kerugian, maksimal ' + n(u, 0) + '. Hitung ekspektasi pembayaran.';
      sol = 'E[min(X, u)] = θ(1 − e^{−u/θ}) = ' + th + '(1 − e^{−' + n(u / th, 2) + '}) = <b>' + n(ans, 1) + '</b>.';
      w = [th, th * Math.exp(-u / th), u * (1 - Math.exp(-u / th)), th - u * Math.exp(-u / th)];
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 1));
    } });

  // 26. PMF diskrit khusus
  T.push({ id: 'pmf', topic: 'Distribusi diskrit & peluang bersyarat', conf: 'Tinggi',
    src: 'Mei 2026 #6 & #12, Nov 2025 #17, Okt 2024 #3',
    gen: function (r) {
      var v = r() < 0.5 ? 'tele' : 'geo', q, sol, ans, w;
      if (v === 'tele') {
        var K = r.pick([3, 4, 5, 6]);
        ans = M(frac(K, 2 * (K + 1)));
        q = 'Banyaknya klaim per bulan N memiliki \\(P(N=n) = \\dfrac{1}{(n+1)(n+2)}\\), n = 0, 1, 2, … Tentukan peluang terjadi paling sedikit satu klaim dalam sebulan, jika diketahui paling banyak ' + K + ' klaim.';
        sol = 'Jumlah teleskopik: P(N ≤ ' + K + ') = 1 − 1/' + (K + 2) + ' = ' + (K + 1) + '/' + (K + 2) + '. P(N = 0) = 1/2. P(1 ≤ N ≤ ' + K + ') = ' + (K + 1) + '/' + (K + 2) + ' − 1/2 = ' + K + '/' + (2 * (K + 2)) + '. Bagi: <b>' + ans + '</b>.';
        w = [M(frac(K, 2 * (K + 2))), M(frac(K + 1, K + 2)), M(frac(1, 2)), M(frac(K, K + 1))];
      } else {
        var k = r.pick([5, 6, 7, 8]);
        ans = M(frac(k + 1, Math.pow(2, k + 2)));
        q = 'Banyaknya klaim per minggu N memiliki \\(P(N=n) = \\dfrac{1}{2^{n+1}}\\), n ≥ 0, dan saling bebas antar minggu. Hitung peluang tepat ' + k + ' klaim diterima dalam periode 2 minggu.';
        sol = 'P(N₁ + N₂ = ' + k + ') = Σ_{j=0}^{' + k + '} (1/2^{j+1})(1/2^{' + k + '−j+1}) = (' + k + ' + 1)/2^{' + (k + 2) + '} = <b>' + ans + '</b>.';
        w = [M(frac(1, Math.pow(2, k + 1))), M(frac(1, Math.pow(2, k + 2))), M(frac(k, Math.pow(2, k + 2))), M(frac(k + 1, Math.pow(2, k + 1)))];
      }
      return Object.assign({ q: q, sol: sol }, strOpts(ans, w));
    } });

  // 27. Poisson rasio → varians
  T.push({ id: 'poisratio', topic: 'Poisson: menentukan parameter', conf: 'Sedang',
    src: 'Okt 2024 #22, Nov 2025 #5, Mei 2023 #18',
    gen: function (r) {
      var combos = [[0, 1, 2], [2, 2, 3], [3, 2, 5], [1, 1, 6], [2, 1, 12], [1, 2, 1.5], [4, 3, 30 / 9]];
      var cmb = r.pick(combos.filter(function (c) { return Number.isInteger(c[2]) || c[2] === 1.5; }));
      var a = cmb[0], lam = cmb[1], k = cmb[2];
      var q = 'Banyaknya klaim yang diajukan berdistribusi Poisson. Pemegang polis yang mengajukan ' + a + ' klaim ' + n(k, k % 1 ? 1 : 0) + ' kali lebih mungkin dibandingkan yang mengajukan ' + (a + 2) + ' klaim. Tentukan varians banyaknya klaim.';
      var sol = 'P(' + a + ')/P(' + (a + 2) + ') = ' + (a + 1) + '·' + (a + 2) + '/λ² = ' + n(k, k % 1 ? 1 : 0) + ' ⇒ λ² = ' + n((a + 1) * (a + 2) / k, 2) + ', λ = ' + lam + '. Varians Poisson = λ = <b>' + lam + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, lam, [lam * lam, Math.sqrt(lam), (a + 1) * (a + 2) / k / 2, lam + 1], 2));
    } });

  // 28. Aljabar kejadian
  T.push({ id: 'events', topic: 'Aksioma & aljabar kejadian', conf: 'Tinggi',
    src: 'Nov 2025 #24, Agu 2025 #30, Mei 2026 #17, Apr 2024 #2',
    gen: function (r) {
      var x0 = r(), v = x0 < 0.34 ? 'U' : (x0 < 0.67 ? 'ind' : 'comb'), q, sol, ans, w;
      if (v === 'comb') {
        var Bc = r.pick([6, 7, 8, 9]), Gc = r.pick([5, 6, 7]), tot = C(Bc + Gc, 3);
        var two = C(Bc, 2) * C(Gc, 1), three = C(Bc, 3);
        ans = (two + three) / tot;
        q = 'Suatu kelas terdiri dari ' + Bc + ' laki-laki dan ' + Gc + ' perempuan. Guru memilih 3 siswa secara acak tanpa pengembalian. Hitung peluang banyaknya laki-laki yang terpilih <b>melebihi</b> banyaknya perempuan yang terpilih.';
        sol = 'Laki-laki > perempuan ⇔ 2 atau 3 laki-laki. [C(' + Bc + ',2)·C(' + Gc + ',1) + C(' + Bc + ',3)] / C(' + (Bc + Gc) + ',3) = (' + two + ' + ' + three + ')/' + tot + ' = <b>' + n(ans, 4) + '</b>.';
        var pb2 = Bc / (Bc + Gc);
        w = [two / tot, three / tot, 3 * pb2 * pb2 * (1 - pb2) + pb2 * pb2 * pb2, Bc / (Bc + Gc)];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
      }
      if (v === 'U') {
        var u = r.pick([0.6, 0.7, 0.75, 0.8]), vv = r.pick([0.85, 0.9, 0.95]);
        ans = u + vv - 1;
        q = 'Diketahui \\(P(A \\cup B) = ' + t(u, 2) + '\\) dan \\(P(A \\cup B^c) = ' + t(vv, 2) + '\\). Tentukan \\(P(A)\\).';
        sol = '(A ∪ B) ∩ (A ∪ Bᶜ) = A dan (A ∪ B) ∪ (A ∪ Bᶜ) = Ω. Jadi P(A) = ' + n(u, 2) + ' + ' + n(vv, 2) + ' − 1 = <b>' + n(ans, 2) + '</b>.';
        w = [u * vv, vv - u, (u + vv) / 2, 1 - vv + u - 0.1];
      } else {
        var pa = r.pick([0.4, 0.5, 0.6]), pb = r.pick([0.3, 0.5, 0.6]), pc = r.pick([0.1, 0.2, 0.3]);
        if (pb + pc > 1) pc = 0.2;
        ans = 1 - pa * pb;
        q = 'A, B, C kejadian dengan A dan B saling bebas, B dan C saling lepas, P(A) = ' + n(pa, 1) + ', P(B) = ' + n(pb, 1) + ', P(C) = ' + n(pc, 1) + '. Hitung \\(P((A \\cap B)^c \\cup C)\\).';
        sol = 'Karena B ∩ C = ∅, C ⊂ Bᶜ ⊂ (A ∩ B)ᶜ, sehingga gabungannya = (A ∩ B)ᶜ. P = 1 − P(A)P(B) = <b>' + n(ans, 2) + '</b>. (Jebakan: jangan menambahkan P(C).)';
        w = [Math.min(0.99, 1 - pa * pb + pc), pa * pb + pc, 1 - pa * pb - pc, 1 - pa - pb + pc];
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
    } });

  // 29. Estimasi parameter (MLE / momen) — topik baru Mei 2026
  T.push({ id: 'estim', topic: 'Estimasi parameter (MLE & metode momen)', conf: 'Sedang',
    src: 'Mei 2026 #21 & #22 (topik baru)',
    gen: function (r) {
      var v = r() < 0.5 ? 'mle' : 'mom', q, sol, ans, w;
      if (v === 'mle') {
        var sets = [[0.74, 0.81, 0.95], [0.6, 0.7, 0.9], [0.5, 0.8, 0.85, 0.9], [0.65, 0.72, 0.88, 0.93], [0.4, 0.75, 0.9]];
        var xs = r.pick(sets), S = xs.reduce(function (s, x) { return s + Math.log(x); }, 0), nn = xs.length;
        ans = -nn / S - 1;
        q = 'Diberikan ' + nn + ' observasi: ' + xs.map(function (x) { return n(x, 2); }).join('; ') + '. Data dipasangkan dengan fungsi kepadatan \\(f(x) = (p+1)x^p\\), 0 < x < 1, p > −1. Hitung estimasi maximum likelihood dari p.';
        sol = 'ln L = n ln(p+1) + p Σ ln xᵢ. Turunan = n/(p+1) + Σ ln xᵢ = 0 ⇒ p̂ = −n/Σ ln xᵢ − 1. Σ ln xᵢ = ' + n(S, 4) + ' ⇒ p̂ = <b>' + n(ans, 3) + '</b>.';
        w = [-nn / S, nn / S - 1, -S / nn - 1, -nn / S + 1];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
      }
      var data = r.pick([[5, 5, 5, 6, 8, 9, 11, 12, 16, 23], [3, 4, 4, 5, 7, 8, 10, 13, 16, 20], [6, 6, 7, 8, 9, 11, 12, 15, 18, 28]]);
      var nn2 = data.length, s1 = data.reduce(function (s, x) { return s + x; }, 0), s2 = data.reduce(function (s, x) { return s + x * x; }, 0);
      var mean = s1 / nn2, th = Math.sqrt(s2 / nn2 - mean * mean);
      ans = mean - th;
      q = 'Besar klaim berdistribusi eksponensial tergeser dengan \\(f(x) = \\frac{1}{\\theta}e^{-(x-\\delta)/\\theta}\\), x > δ. Sampel 10 klaim: ' + data.join(', ') + ' (ΣXᵢ = ' + s1 + ', ΣXᵢ² = ' + n(s2, 0) + '). Tentukan \\(\\hat\\delta\\) dengan metode momen.';
      var sU = Math.sqrt((s2 - nn2 * mean * mean) / (nn2 - 1));
      sol = 'E[X] = δ + θ, Var(X) = θ². Samakan dengan momen sampel: x̄ = ' + n(mean, 2) + ', (1/n)ΣX² − x̄² = ' + n(s2 / nn2 - mean * mean, 3) + ' ⇒ θ̂ = ' + n(th, 4) + '. δ̂ = ' + n(mean, 2) + ' − ' + n(th, 4) + ' = <b>' + n(ans, 3) + '</b>.';
      w = [mean - sU, Math.min.apply(null, data), mean - th * th / mean, mean - (s2 / nn2 - mean * mean) / 10];
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 3));
    } });

  // 30. Kovarians
  T.push({ id: 'cov', topic: 'Kovarians & kombinasi linear', conf: 'Tinggi',
    src: 'Mei 2026 #11, Agu 2025 #21, Agu 2023 #13 & #16',
    gen: function (r) {
      var x0 = r(), v = x0 < 0.34 ? 'C' : (x0 < 0.67 ? 'U' : 'mat'), q, sol, ans, w;
      if (v === 'mat') {
        var S = r.pick([[[4, 1, -1], [1, 2, 0.5], [-1, 0.5, 3]], [[1.5, 1, 0.5], [1, 2, 0.5], [0.5, 0.5, 1]], [[9, 2, 1], [2, 4, -1], [1, -1, 2]]]);
        var a = r.pick([1, 2]), b = r.pick([1, 2, 3]), c = r.pick([1, 2]);
        ans = a * a * S[0][0] + b * b * S[1][1] + c * c * S[2][2] + 2 * a * b * S[0][1] - 2 * a * c * S[0][2] - 2 * b * c * S[1][2];
        var mtx = '\\begin{pmatrix}' + S.map(function (row) { return row.map(function (x) { return t(x, x % 1 ? 1 : 0); }).join(' & '); }).join(' \\\\ ') + '\\end{pmatrix}';
        var cf = function (k) { return k === 1 ? '' : k; };
        q = 'Vektor acak \\((X_1, X_2, X_3)\\) memiliki matriks varians-kovarians \\(\\Sigma = ' + mtx + '\\). Hitung \\(\\mathrm{Var}(' + cf(a) + 'X_1 + ' + cf(b) + 'X_2 - ' + cf(c) + 'X_3)\\).';
        sol = 'Var(aX₁ + bX₂ − cX₃) = a²σ₁₁ + b²σ₂₂ + c²σ₃₃ + 2abσ₁₂ − 2acσ₁₃ − 2bcσ₂₃ dengan a = ' + a + ', b = ' + b + ', c = ' + c + '. Hasil = <b>' + n(ans, 2) + '</b>.';
        w = [a * a * S[0][0] + b * b * S[1][1] + c * c * S[2][2], ans + 4 * a * c * S[0][2], a * S[0][0] + b * S[1][1] + c * S[2][2], ans - 2 * a * b * S[0][1]];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
      }
      if (v === 'U') {
        var L = r.pick([6, 12, 18, 24]);
        ans = L * L / 24;
        q = 'X dan Y nilai dua saham di akhir tahun. X berdistribusi seragam pada [0, ' + L + ']. Diberikan X = x, Y berdistribusi seragam pada [0, x]. Hitung Cov(X, Y).';
        sol = 'E[Y|X] = X/2 ⇒ Cov(X, Y) = Cov(X, X/2) = Var(X)/2 = (' + L + '²/12)/2 = <b>' + n(ans, 2) + '</b>.';
        w = [L * L / 12, L * L / 48, L * L / 16, L * L / 8];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
      }
      var EX = 5, EY = 7, vX = r.pick([2.4, 3, 4]), vY = r.pick([2.4, 2, 3.6]), cxy = r.pick([1.6, 1, 0.5, 1.2]), g = r.pick([0.1, 0.2, 0.25]);
      var vS = vX + vY + 2 * cxy;
      ans = vX + (2 + g) * cxy + (1 + g) * vY;
      q = 'X biaya tindakan bedah, Y biaya lain-lain. Diketahui E(X) = ' + EX + ', E(X²) = ' + n(vX + 25, 1) + ', E(Y) = ' + EY + ', E(Y²) = ' + n(vY + 49, 1) + ', dan Var(X + Y) = ' + n(vS, 1) + '. Misal C₁ = X + Y total klaim sebelum biaya tambahan ' + pct(g) +
        ' atas biaya lain-lain (Y), dan C₂ total klaim sesudahnya. Hitung Cov(C₁, C₂).';
      sol = 'Var X = ' + n(vX, 1) + ', Var Y = ' + n(vY, 1) + ', Cov(X,Y) = (' + n(vS, 1) + ' − ' + n(vX, 1) + ' − ' + n(vY, 1) + ')/2 = ' + n(cxy, 2) + '. C₂ = X + ' + n(1 + g, 2) + 'Y. Cov(C₁,C₂) = Var X + ' + n(2 + g, 2) + '·Cov + ' + n(1 + g, 2) + '·Var Y = <b>' + n(ans, 3) + '</b>.';
      w = [(1 + g) * vS, vX + 2 * cxy + vY, vX + (1 + g) * vY, vX + (2 + g) * cxy + vY];
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
    } });

  // ---------- Inferensi statistik (Silabus PAI 2024 bagian 4) ----------
  var NEVER = 'Belum pernah keluar di 8 naskah 2023–2026; wajib menurut silabus';

  // Distribusi sampel rata-rata / selisih rata-rata
  T.push({ id: 'sampmean', topic: 'Distribusi sampel rata-rata', conf: 'Sedang',
    src: 'Okt 2024 #12, Agu 2025 #20',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.55) {
        var mu = r.pick([71700, 50000, 60000]), sd = r.pick([18000, 12000, 15000]), nn = r.pick([25, 36, 64, 100]);
        var se = sd / Math.sqrt(nn), c = Math.round((mu + r.pick([0.1, 0.5, 1, 1.5]) * se) / 100) * 100, z = (c - mu) / se;
        ans = 1 - Phi(z);
        q = 'Besar klaim polis asuransi mobil berdistribusi normal dengan rata-rata ' + n(mu, 0) + ' dan deviasi standar ' + n(sd, 0) + '. Hitung peluang rata-rata dari ' + nn + ' klaim yang dipilih acak <b>melebihi ' + n(c, 0) + '</b>.';
        sol = 'X̄ ~ Normal(' + n(mu, 0) + '; σ/√n = ' + n(sd, 0) + '/' + Math.sqrt(nn) + ' = ' + n(se, 0) + '). z = (' + n(c, 0) + ' − ' + n(mu, 0) + ')/' + n(se, 0) + ' = ' + n(z, 4) + '. P = 1 − Φ(z) = <b>' + n(ans, 4) + '</b>.';
        w = [1 - Phi((c - mu) / sd), Phi(z), 1 - Phi(z * Math.sqrt(nn) / 2), 1 - Phi((c - mu) / (sd / nn))];
      } else {
        var m1 = r.pick([52, 60, 75]), dm = r.pick([2, 3, 4]), s1 = r.pick([8, 10, 12]), s2 = r.pick([6, 9, 10]), n1 = r.pick([25, 36, 50]), n2 = r.pick([30, 40, 50]), d = r.pick([0, 1, 5]);
        var se2 = Math.sqrt(s1 * s1 / n1 + s2 * s2 / n2), z2 = (d - dm) / se2;
        ans = 1 - Phi(z2);
        q = 'Dua populasi saling bebas berdistribusi normal: populasi 1 dengan rata-rata ' + (m1 + dm) + ' dan deviasi standar ' + s1 + ', populasi 2 dengan rata-rata ' + m1 + ' dan deviasi standar ' + s2 + '. Diambil sampel acak berukuran ' + n1 + ' dari populasi 1 dan ' + n2 + ' dari populasi 2. Hitung \\(P(\\bar X_1 - \\bar X_2 > ' + d + ')\\).';
        sol = 'X̄₁ − X̄₂ ~ Normal(' + dm + '; σ² = ' + s1 + '²/' + n1 + ' + ' + s2 + '²/' + n2 + ' = ' + n(se2 * se2, 4) + '). z = (' + d + ' − ' + dm + ')/' + n(se2, 4) + ' = ' + n(z2, 4) + '. P = 1 − Φ(z) = <b>' + n(ans, 4) + '</b>.';
        w = [1 - Phi((d - dm) / (s1 / Math.sqrt(n1) + s2 / Math.sqrt(n2))), Phi(z2), 1 - Phi((d - dm) / Math.sqrt(s1 * s1 + s2 * s2)), 1 - Phi((d - dm) / Math.sqrt(s1 * s1 / n1 - s2 * s2 / n2 + 0.5))];
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 4));
    } });

  // Selang kepercayaan
  T.push({ id: 'ci', topic: 'Selang kepercayaan', conf: 'Baru', src: NEVER,
    gen: function (r) {
      var L = r.pick([0.9, 0.95, 0.99]), z = invPhi(1 - (1 - L) / 2), zOne = invPhi(L), q, sol, lo, hi, wr;
      var fmtI = function (a, b, d) { return '(' + n(a, d) + ' ; ' + n(b, d) + ')'; };
      var v = r.pick(['mean', 'prop', 'dprop']);
      if (v === 'mean') {
        var xb = r.pick([24.8, 102.5, 58.3, 12.6]), sd = r.pick([3, 5, 8, 12]), nn = r.pick([16, 25, 36, 64]), se = sd / Math.sqrt(nn);
        lo = xb - z * se; hi = xb + z * se;
        q = 'Sampel acak ' + nn + ' klaim dari populasi normal dengan deviasi standar diketahui σ = ' + sd + ' menghasilkan rata-rata ' + n(xb, 1) + '. Tentukan selang kepercayaan ' + Math.round(L * 100) + '% untuk rata-rata populasi μ.';
        sol = 'x̄ ± z<sub>' + n((1 - L) / 2, 3) + '</sub>·σ/√n = ' + n(xb, 1) + ' ± ' + n(z, 3) + '·' + sd + '/' + Math.sqrt(nn) + ' = ' + n(xb, 1) + ' ± ' + n(z * se, 3) + ' ⇒ <b>' + fmtI(lo, hi, 2) + '</b>.';
        wr = [fmtI(xb - z * sd, xb + z * sd, 2), fmtI(xb - zOne * se, xb + zOne * se, 2), fmtI(xb - z * sd / nn, xb + z * sd / nn, 2), fmtI(xb - 2 * z * se, xb + 2 * z * se, 2)];
        return Object.assign({ q: q, sol: sol }, strOpts(fmtI(lo, hi, 2), wr));
      }
      if (v === 'prop') {
        var N = r.pick([200, 400, 500]), x = Math.round(N * r.pick([0.12, 0.18, 0.25, 0.3])), p = x / N, s = Math.sqrt(p * (1 - p) / N);
        lo = p - z * s; hi = p + z * s;
        q = 'Dari ' + N + ' pemegang polis yang dipilih acak, ' + x + ' orang mengajukan klaim dalam setahun. Tentukan selang kepercayaan ' + Math.round(L * 100) + '% (aproksimasi normal) untuk proporsi pemegang polis yang mengajukan klaim.';
        sol = 'p̂ = ' + x + '/' + N + ' = ' + n(p, 3) + '. p̂ ± z·√(p̂(1 − p̂)/n) = ' + n(p, 3) + ' ± ' + n(z, 3) + '·' + n(s, 4) + ' ⇒ <b>' + fmtI(lo, hi, 3) + '</b>.';
        wr = [fmtI(p - zOne * s, p + zOne * s, 3), fmtI(p - z * Math.sqrt(0.25 / N), p + z * Math.sqrt(0.25 / N), 3), fmtI(p - z * Math.sqrt(p / N), p + z * Math.sqrt(p / N), 3), fmtI(p - z * p * (1 - p) / Math.sqrt(N), p + z * p * (1 - p) / Math.sqrt(N), 3), fmtI(p - 2 * z * s, p + 2 * z * s, 3), fmtI(p - z * s / 2, p + z * s / 2, 3)];
        return Object.assign({ q: q, sol: sol }, strOpts(fmtI(lo, hi, 3), wr));
      }
      var Na = r.pick([200, 300]), Nb = r.pick([250, 400]), xa = Math.round(Na * r.pick([0.2, 0.25])), xb2 = Math.round(Nb * r.pick([0.12, 0.15]));
      var pa = xa / Na, pb = xb2 / Nb, sd2 = Math.sqrt(pa * (1 - pa) / Na + pb * (1 - pb) / Nb), d = pa - pb;
      lo = d - z * sd2; hi = d + z * sd2;
      q = 'Di wilayah A, ' + xa + ' dari ' + Na + ' pemegang polis mengajukan klaim; di wilayah B, ' + xb2 + ' dari ' + Nb + '. Tentukan selang kepercayaan ' + Math.round(L * 100) + '% untuk selisih proporsi \\(p_A - p_B\\).';
      sol = 'p̂_A = ' + n(pa, 4) + ', p̂_B = ' + n(pb, 4) + '. SE = √(p̂_A(1−p̂_A)/n_A + p̂_B(1−p̂_B)/n_B) = ' + n(sd2, 4) + '. ' + n(d, 4) + ' ± ' + n(z, 3) + '·' + n(sd2, 4) + ' ⇒ <b>' + fmtI(lo, hi, 3) + '</b>.';
      wr = [fmtI(d - zOne * sd2, d + zOne * sd2, 3), fmtI(d - z * (Math.sqrt(pa * (1 - pa) / Na) + Math.sqrt(pb * (1 - pb) / Nb)), d + z * (Math.sqrt(pa * (1 - pa) / Na) + Math.sqrt(pb * (1 - pb) / Nb)), 3), fmtI(d - z * Math.sqrt(pa * (1 - pa) / Na), d + z * Math.sqrt(pa * (1 - pa) / Na), 3), fmtI(d - z * Math.abs(Math.sqrt(pa * (1 - pa) / Na - pb * (1 - pb) / Nb)), d + z * Math.abs(Math.sqrt(pa * (1 - pa) / Na - pb * (1 - pb) / Nb)), 3), fmtI(d - 2 * z * sd2, d + 2 * z * sd2, 3), fmtI(d - z * sd2 / 2, d + z * sd2 / 2, 3)];
      return Object.assign({ q: q, sol: sol }, strOpts(fmtI(lo, hi, 3), wr));
    } });

  // Uji hipotesis
  T.push({ id: 'htest', topic: 'Uji hipotesis (galat tipe I/II, kuasa uji)', conf: 'Baru', src: NEVER,
    gen: function (r) {
      var mu0 = r.pick([100, 50, 200]), sd = r.pick([10, 15, 20]), nn = r.pick([16, 25, 36]), se = sd / Math.sqrt(nn);
      var v = r.pick(['alpha', 'power', 'crit', 'pval']), q, sol, ans, w;
      var head = 'Besar klaim berdistribusi normal dengan deviasi standar σ = ' + sd + '. Untuk menguji \\(H_0: \\mu = ' + mu0 + '\\) melawan \\(H_1: \\mu > ' + mu0 + '\\) digunakan sampel acak berukuran ' + nn + '. ';
      if (v === 'crit') {
        var al = r.pick([0.05, 0.01, 0.1]), za = invPhi(1 - al);
        ans = mu0 + za * se;
        q = head + 'Tentukan nilai kritis c sehingga \\(H_0\\) ditolak jika \\(\\bar X \\ge c\\) pada taraf signifikansi ' + pct(al) + '.';
        sol = 'c = μ₀ + z<sub>' + n(al, 2) + '</sub>·σ/√n = ' + mu0 + ' + ' + n(za, 4) + '·' + n(se, 3) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [mu0 + invPhi(1 - al / 2) * se, mu0 + za * sd, mu0 + za * se / 2, mu0 - za * se];
        return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 2));
      }
      var c = +(mu0 + r.pick([1.5, 1.645, 2]) * se).toFixed(1);
      if (v === 'alpha') {
        ans = 1 - Phi((c - mu0) / se);
        q = head + 'Aturan uji: tolak \\(H_0\\) jika \\(\\bar X \\ge ' + t(c, 1) + '\\). Hitung peluang galat tipe I.';
        sol = 'α = P(X̄ ≥ ' + n(c, 1) + ' | μ = ' + mu0 + ') = 1 − Φ((' + n(c, 1) + ' − ' + mu0 + ')/' + n(se, 3) + ') = 1 − Φ(' + n((c - mu0) / se, 4) + ') = <b>' + n(ans, 4) + '</b>.';
        w = [1 - Phi((c - mu0) / sd), Phi((c - mu0) / se), 2 * (1 - Phi((c - mu0) / se)), 1 - Phi((c - mu0) / (se * 2))];
      } else if (v === 'power') {
        var mu1 = mu0 + r.pick([0.5, 1, 1.5]) * sd / 2;
        ans = 1 - Phi((c - mu1) / se);
        q = head + 'Aturan uji: tolak \\(H_0\\) jika \\(\\bar X \\ge ' + t(c, 1) + '\\). Hitung <b>kuasa uji</b> jika nilai sebenarnya \\(\\mu = ' + t(mu1, 1) + '\\).';
        sol = 'Kuasa = P(X̄ ≥ ' + n(c, 1) + ' | μ = ' + n(mu1, 1) + ') = 1 − Φ((' + n(c, 1) + ' − ' + n(mu1, 1) + ')/' + n(se, 3) + ') = 1 − Φ(' + n((c - mu1) / se, 4) + ') = <b>' + n(ans, 4) + '</b>. (β = 1 − kuasa = ' + n(1 - ans, 4) + '.)';
        w = [1 - ans, 1 - Phi((c - mu0) / se), 1 - Phi((c - mu1) / sd), Phi((c - mu1) / se) * 0.5 + 0.3];
      } else {
        var xb = +(mu0 + r.pick([1.2, 1.8, 2.3]) * se).toFixed(1);
        ans = 1 - Phi((xb - mu0) / se);
        q = head + 'Rata-rata sampel yang teramati adalah ' + n(xb, 1) + '. Hitung p-value uji ini.';
        sol = 'p-value = P(X̄ ≥ ' + n(xb, 1) + ' | H₀) = 1 − Φ((' + n(xb, 1) + ' − ' + mu0 + ')/' + n(se, 3) + ') = 1 − Φ(' + n((xb - mu0) / se, 4) + ') = <b>' + n(ans, 4) + '</b>.';
        w = [2 * ans, 1 - Phi((xb - mu0) / sd), Phi((xb - mu0) / se), ans / 2];
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 4));
    } });

  // Estimasi Bayes
  T.push({ id: 'bayesest', topic: 'Estimasi Bayes (posterior)', conf: 'Baru', src: NEVER,
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var al = r.pick([2, 3, 5]), be = r.pick([1, 2, 4]), yrs = r.pick([3, 4, 5]), S = r.pick([4, 6, 9, 12]);
        ans = (al + S) / (be + yrs);
        q = 'Banyaknya klaim per tahun seorang pemegang polis berdistribusi Poisson dengan rataan λ. Distribusi prior λ adalah Gamma dengan α = ' + al + ' dan laju (rate) β = ' + be + ' (rataan prior α/β). Selama ' + yrs + ' tahun teramati total ' + S + ' klaim. Hitung estimasi Bayes λ di bawah fungsi kerugian kuadrat (rataan posterior).';
        sol = 'Posterior: Gamma(α + Σx = ' + (al + S) + ', β + n = ' + (be + yrs) + '). Rataan posterior = ' + (al + S) + '/' + (be + yrs) + ' = <b>' + n(ans, 4) + '</b>.';
        w = [S / yrs, al / be, (al + S) / (be + yrs + 1), (al + S - 1) / (be + yrs)];
      } else {
        var a = r.pick([2, 3, 4]), b = r.pick([6, 8, 10]), N = r.pick([10, 20, 25]), x = r.pick([2, 3, 5, 6]);
        ans = (a + x) / (a + b + N);
        q = 'Peluang klaim p sebuah polis memiliki prior Beta(' + a + ', ' + b + '). Dari ' + N + ' polis yang saling bebas, ' + x + ' mengajukan klaim. Hitung estimasi Bayes p di bawah fungsi kerugian kuadrat.';
        sol = 'Posterior: Beta(' + a + ' + ' + x + ', ' + b + ' + ' + N + ' − ' + x + ') = Beta(' + (a + x) + ', ' + (b + N - x) + '). Rataan = ' + (a + x) + '/' + (a + b + N) + ' = <b>' + n(ans, 4) + '</b>.';
        w = [x / N, a / (a + b), (a + x) / (a + b + N + 1), (a + x - 1) / (a + b + N - 2)];
      }
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans, w, 4));
    } });

  // Sifat estimator & hukum bilangan besar
  T.push({ id: 'estprop', topic: 'Sifat estimator & hukum bilangan besar', conf: 'Baru', src: NEVER,
    gen: function (r) {
      var v = r.pick(['unb', 'bias', 'cheb']), q, sol;
      if (v === 'unb') {
        var N = r.pick([4, 5, 6, 9]);
        var ans = M(frac(N + 1, N));
        q = '\\(X_1, \\dots, X_{' + N + '}\\) sampel acak dari distribusi seragam pada \\((0, \\theta)\\). Tentukan konstanta c sehingga \\(c \\cdot \\max(X_1, \\dots, X_{' + N + '})\\) merupakan estimator <b>tak bias</b> bagi θ.';
        sol = 'Y = max memiliki f(y) = n y<sup>n−1</sup>/θ<sup>n</sup>, sehingga E[Y] = nθ/(n + 1) = ' + N + 'θ/' + (N + 1) + '. Agar E[cY] = θ: c = <b>' + ans + '</b>.';
        return Object.assign({ q: q, sol: sol }, strOpts(ans, [M(frac(N, N + 1)), M('2'), M(frac(N + 2, N + 1)), M(frac(N + 1, N - 1))]));
      }
      if (v === 'bias') {
        var s2 = r.pick([4, 9, 16, 25]), N2 = r.pick([5, 8, 10, 20]);
        var b = -s2 / N2;
        q = '\\(X_1, \\dots, X_{' + N2 + '}\\) sampel acak dari populasi dengan varians σ² = ' + s2 + '. Variansi diestimasi dengan \\(\\hat\\sigma^2 = \\frac{1}{n}\\sum (X_i - \\bar X)^2\\). Hitung bias estimator ini, \\(E[\\hat\\sigma^2] - \\sigma^2\\).';
        sol = 'E[(1/n)Σ(Xᵢ − X̄)²] = (n − 1)σ²/n. Bias = −σ²/n = −' + s2 + '/' + N2 + ' = <b>' + n(b, 2) + '</b>.';
        return Object.assign({ q: q, sol: sol }, numOpts(r, b, [0, s2 / N2, -s2 / (N2 - 1), -s2 / (N2 * N2)], 2));
      }
      var sd = r.pick([2, 3, 4]), N3 = r.pick([50, 100, 200]), k = r.pick([0.5, 0.75, 1]);
      var bound = 1 - sd * sd / (N3 * k * k);
      q = 'Klaim saling bebas dengan rataan μ dan deviasi standar ' + sd + '. Menurut ketaksamaan Chebyshev, berapa batas bawah \\(P(|\\bar X - \\mu| < ' + t(k, k % 1 ? 2 : 0) + ')\\) untuk rata-rata ' + N3 + ' klaim?';
      sol = 'Var(X̄) = σ²/n = ' + sd * sd + '/' + N3 + '. Chebyshev: P(|X̄ − μ| ≥ k) ≤ Var(X̄)/k², sehingga P(|X̄ − μ| < ' + n(k, 2) + ') ≥ 1 − ' + sd * sd + '/(' + N3 + '·' + n(k * k, 4) + ') = <b>' + n(bound, 4) + '</b>. (Dasar hukum bilangan besar: batas ini → 1 saat n → ∞.)';
      return Object.assign({ q: q, sol: sol }, numOpts(r, bound, [1 - sd / (N3 * k * k), 1 - sd * sd / (N3 * k), 1 - sd * sd / (k * k * Math.sqrt(N3)), 2 * Phi(k * Math.sqrt(N3) / sd) - 1], 4));
    } });

  // ---------- Cara cepat per template ----------
  var FAST = {
    bayes3: 'Buat tabel 2 kolom (selamat/meninggal) × 3 baris kategori, isi hasil kali proporsi × peluang. Jawaban = sel yang ditanya ÷ total kolomnya. Untuk “selamat”, pakai 1 − peluang meninggal per baris supaya tidak salah kolom.',
    cars: 'Gambar diagram 2×2: baris “1 mobil / >1 mobil”, kolom “sport / bukan sport”. Isi sel yang diketahui (sport ∩ >1 = % bersyarat × P(>1)), sisanya tinggal dikurangkan. Jangan perlakukan “15% di antara nasabah >1 mobil” sebagai 15% dari total.',
    region: 'Peluang total linear: total = x·w + y·(1 − w), jadi w = (y − total)/(y − x). Ini rumus “lever”: w adalah jarak total ke y dibagi jarak x ke y. Kalau ditanya P(X | tanpa klaim), kalikan w·x lalu bagi total.',
    events: 'Aljabar: (A ∪ B) dan (A ∪ Bᶜ) beririsan tepat di A dan gabungannya Ω, jadi P(A) = jumlah keduanya − 1. Saling lepas dengan B berarti C ⊂ Bᶜ. Untuk enumerasi “lebih banyak laki-laki”, cukup hitung kasus 2L1P dan 3L lalu bagi C(N,3).',
    renters: 'Ini Bayes dengan “likelihood” survival: S(t) = e^{−t/θ}. Hitung a·e^{−t/θ₁} dan (1 − a)·e^{−t/θ₂} di kalkulator, lalu bagian pertama ÷ jumlah. Jebakan umum: memakai e^{−θt} (rataan dikira laju).',
    couple: 'Syaratnya “suami hidup”, jadi semesta = {keduanya hidup, hanya suami hidup}. Untung = 1.000 jika keduanya hidup, −9.000 jika istri meninggal. E = 1.000 − 10.000 × P(istri meninggal | suami hidup).',
    pmf: 'P(N=n) = 1/((n+1)(n+2)) = 1/(n+1) − 1/(n+2): jumlahnya teleskopik, P(N ≤ K) = 1 − 1/(K+2). Untuk 1/2^{n+1} dua minggu: jumlah dua geometrik identik → P(S=k) = (k+1)/2^{k+2}, tak perlu konvolusi panjang.',
    geomtest: 'Tanpa memori: P(≥ j dites) = q^{j−1}. Rasio P(≥k)/P(≥m) = q^{k−m}, lalu ganti q = r^{1/(m−1)}. Pangkat jawaban = (k − m)/(m − 1); cocokkan langsung ke opsi.',
    fundC: 'Tabulasikan P(N ≤ k) binomial di fx-991 (MENU Distribution → Binomial CD) sampai > 0,99. k pertama yang lolos → C = dana/k. Biasanya k = 2 atau 3, jadi cukup hitung 3–4 suku.',
    quake: '“Kurang dari k” = P(N ≤ k − 1); “paling sedikit k” = 1 − P(N ≤ k − 1). Pakai Binomial CD di kalkulator. Opsi pengecoh biasanya memakai P(N ≤ k) atau aproksimasi Poisson, jadi bedakan tanda ketaksamaan dulu.',
    poisrate: 'Skalakan λ ke panjang interval yang ditanya (1 per 12 jam → λ = 2 untuk 24 jam). P(N ≤ 1) = e^{−λ}(1 + λ), P(N ≤ 2) = e^{−λ}(1 + λ + λ²/2). Hafalkan 3e^{−2} ≈ 0,406 karena soal ini sudah keluar 3 kali.',
    poisratio: 'Rasio Poisson P(a)/P(a+2) = (a+1)(a+2)/λ², sedangkan P(a)/P(a+1) = (a+1)/λ. Selesaikan λ, dan untuk Poisson varians = λ.',
    poiscap: 'Untuk min(N, m) hitung saja tabel kecil: nilai 0..m−1 dengan peluang Poisson dan nilai m dengan sisa peluang. E[(N − k)⁺] = λ − E[min(N, k)]. Untuk SD, E[Y²] dari tabel yang sama lalu kurangi E[Y]².',
    pgf3: 'Jangan turunkan PGF tiga kali secara simbolik. E[X³] = n(n−1)(n−2)p³ + 3n(n−1)p² + np (momen faktorial). Atau di fx-991 buat tabel x, x³·P(X=x) dan jumlahkan untuk n ≤ 6.',
    mixed: 'Cek total massa dulu, karena konstanta densitas biasanya sudah konsisten. E[X] = Σ massa titik × nilai + ∫ x f(x) dx. Untuk f = cx pada (0,1): ∫x·cx = c/3 dan ∫x²·cx = c/4.',
    mixmed: 'Median campuran: selesaikan a·e^{−m/θ₁} + (1 − a)·e^{−m/θ₂} = 0,5. Dengan θ₂ = 2θ₁ jadikan kuadrat dalam u = e^{−m/2}. Lebih cepat lagi: pakai SOLVE di fx-991 dengan tebakan awal 1.',
    normpct: 'Modus normal = rataan. Dari persentil p: σ = (μ − x_p)/|z_p| dengan z₀,₄₀ = −0,2533 dan z₀,₃₀ = −0,5244. Lalu Φ((x − μ)/σ) memakai Normal CD di kalkulator.',
    transform: 'Metode CDF: F_Y(y) = P(T ≤ √y) = F_T(√y), lalu turunkan. Untuk F(t) = 1 − (a/t)^b: F_Y = 1 − a^b y^{−b/2}, jadi f_Y = (b/2)a^b y^{−b/2−1}. Cek cepat: pangkat y di jawaban harus −(b/2 + 1).',
    deduct: 'Seragam [0, M]: E[(X − D)⁺] = (M − D)²/(2M). Rasio terhadap E[X] = ((M − D)/M)², jadi D = M(1 − √k). Untuk eksponensial dengan batas u: E[min(X, u)] = θ(1 − e^{−u/θ}).',
    bonus: 'Untuk seragam [0, L]: E[(P − X)⁺] = P²/(2L) (luas segitiga ÷ L). Bonus = persentase × P²/(2L), dua langkah saja.',
    jointcond: 'Kerjakan pembilang dan penyebut terpisah. Penyebut P(X ≤ 1) = integral marginal X. Pembilang: gambar daerah x ≤ 1, x + y ≥ s, lalu integrasikan y dulu. Polinom linear bisa dicek dengan TABLE/∫dx di fx-991.',
    triangle: 'Pada 0 < x < y < L dengan f = c(y − x): ∫∫(y − x) = L³/6, jadi c = 6/L³. Polanya simetri: E[X] = L/4 dan E[Y] = 3L/4. Hafalkan untuk L = 1: c = 6, E[X] = 1/4.',
    bids: 'Seragam bivariat → peluang = luas. P(|X − Y| ≥ d) = (1 − d/R)² (dua segitiga). Jawaban “mempertimbangkan lebih lanjut” = 1 − (1 − d/R)². Geser intervalnya ke [0, R] dulu.',
    totvar: 'Var(Y) = E[Var(Y|X)] + Var(E[Y|X]). Untuk Y|X ~ Poisson(X): Var(Y) = E[X] + Var(X). Untuk rataan x dan varians x²: Var(Y) = E[X²] + Var(X). Tulis dua suku ini dulu sebelum menghitung.',
    jointmgf: 'Untuk MGF bersama diskrit, koefisien e^{t₁} membawa X₁ = 1. E[X₁] = jumlah koefisien suku yang mengandung t₁, E[X₂] = jumlah koefisien yang mengandung t₂. Tidak perlu turunan.',
    cov: 'Linearitas: Cov(X + Y, X + kY) = Var X + (1 + k)Cov + k Var Y. Untuk X ~ U[0, L], Y|X ~ U[0, X]: Cov = Var(X)/2 = L²/24. Untuk matriks: Var(aᵀX) = Σ a_i² σ_ii + 2Σ a_i a_j σ_ij, dan perhatikan tanda koefisien negatif.',
    order: 'Rumus siap pakai: min dua U(a, b) → a + (b − a)/3, maks dua → a + 2(b − a)/3. E[max] eksponensial = E[X₁] + E[X₂] − E[min], dengan E[min] = 1/(laju₁ + laju₂). Y₂ dari 3 U(0, L) ~ L·Beta(2, 2), varians L²/20.',
    sampmean: 'X̄ ~ N(μ, σ²/n). Langsung z = (c − μ)/(σ/√n) dengan Normal CD. Untuk selisih rata-rata, varians dijumlahkan: σ₁²/n₁ + σ₂²/n₂, bukan σ yang dijumlahkan.',
    cltpct: 'Persentil total = nμ + z_p·σ√n. z₀,₉₀ = 1,2816, z₀,₉₅ = 1,6449. Jebakan: menulis σ·n atau σ saja.',
    twolines: 'Selisih N₁ − N₂: rataan 0, varians λ + np(1 − p). “> 3” untuk bilangan bulat berarti ≥ 4, dengan koreksi kontinuitas 3,5. Jawaban = 2[1 − Φ(3,5/σ)].',
    ci: 'Selang z: x̄ ± z_{α/2}·σ/√n, dan proporsi p̂ ± z√(p̂q̂/n). Cari titik tengah opsi (harus = x̄ atau p̂) lalu cocokkan setengah lebarnya. Opsi dengan z satu sisi (1,645 untuk 95%) adalah pengecoh.',
    htest: 'α = P(tolak | H₀), kuasa = P(tolak | H₁); keduanya 1 − Φ((c − μ)/(σ/√n)) dengan μ berbeda. Nilai kritis uji kanan = μ₀ + z_α σ/√n. p-value uji satu sisi tidak dikali 2.',
    estim: 'MLE: tulis ln L, turunkan, = 0. Untuk (p + 1)x^p: p̂ = −n/Σln x − 1. Metode momen: samakan E[X] dan Var(X) dengan momen sampel yang dibagi n (bukan n − 1), lalu selesaikan.',
    bayesest: 'Konjugat: Gamma(α, β)–Poisson → (α + Σx)/(β + n); Beta(a, b)–Binomial → (a + x)/(a + b + n). Cara ingat: tambah “jumlah kejadian” ke atas dan “jumlah percobaan/periode” ke bawah.',
    estprop: 'Maks dari n U(0, θ): E = nθ/(n + 1), jadi c = (n + 1)/n. Varians sampel dengan pembagi n berbias −σ²/n. Chebyshev untuk X̄: P(|X̄ − μ| < k) ≥ 1 − σ²/(nk²).'
  };
  T.forEach(function (x) { x.fast = FAST[x.id]; });

  // ---------- Komposisi paket sesuai Silabus PAI 2024 ----------
  // Bobot silabus CF2: 1) Dasar probabilitas 15–25%, 2) Univariat 25–35%,
  // 3) Multivariat 20–30%, 4) Inferensi statistik 20–30%.
  // Paket: 6 / 9 / 7 / 8 soal = 20% / 30% / 23% / 27%.
  var byId = {}; T.forEach(function (x) { byId[x.id] = x; });
  function merge(id, topic, conf, src, ids) {
    return { id: id, topic: topic, conf: conf, src: src, variants: ids,
      gen: function (r) { var b = byId[ids[Math.floor(r() * ids.length)]], g = b.gen(r); g.fast = b.fast; return g; } };
  }
  function use(id, syl, topic) { var b = byId[id]; return { id: id, topic: topic || b.topic, conf: b.conf, src: b.src, syl: syl, gen: b.gen, fast: b.fast }; }
  function useM(m, syl) { m.syl = syl; return m; }
  var SECTIONS = [
    { no: 1, name: 'Dasar-dasar probabilitas', range: '15–25%' },
    { no: 2, name: 'Variabel acak univariat', range: '25–35%' },
    { no: 3, name: 'Variabel acak multivariat', range: '20–30%' },
    { no: 4, name: 'Inferensi statistik', range: '20–30%' }
  ];
  var P = [
    use('bayes3', '1.e'), use('renters', '1.e'), use('region', '1.e'), use('cars', '1.a'),
    use('events', '1.a, 1.b, 1.d', 'Aksioma, enumerasi & kejadian saling bebas'), use('couple', '1.c'),

    useM(merge('discrete', 'Distribusi diskrit (geometrik, PMF khusus)', 'Tinggi', byId.pmf.src + '; ' + byId.geomtest.src, ['pmf', 'geomtest']), '2.a, 2.c, 2.g'),
    useM(merge('binomial', 'Distribusi binomial', 'Tinggi', byId.fundC.src + '; ' + byId.quake.src, ['fundC', 'quake']), '2.g'),
    useM(merge('poisson', 'Distribusi Poisson', 'Tinggi', byId.poisrate.src + '; ' + byId.poisratio.src, ['poisrate', 'poisratio']), '2.g'),
    use('poiscap', '2.c'), use('pgf3', '2.e'), use('mixed', '2.b, 2.d'),
    useM(merge('quantile', 'Persentil, median & distribusi normal', 'Tinggi', byId.mixmed.src + '; ' + byId.normpct.src, ['mixmed', 'normpct']), '2.d, 2.g'),
    use('transform', '2.f'),
    useM(merge('payment', 'Ekspektasi pembayaran (deductible, batas, bonus)', 'Tinggi', byId.deduct.src + '; ' + byId.bonus.src, ['deduct', 'bonus']), '2.d'),

    use('jointcond', '3.a, 3.b'), use('triangle', '3.b'), use('bids', '3.a'),
    use('totvar', '3.d, 3.g', 'Ekspektasi & varians bersyarat, distribusi majemuk'), use('jointmgf', '3.e'),
    use('cov', '3.e, 3.f', 'Kovarians & matriks varians-kovarians'), use('order', '3.h'),

    use('sampmean', '4.b'), use('cltpct', '4.c'), use('twolines', '4.c'), use('ci', '4.g'), use('htest', '4.h'),
    use('estim', '4.e'), use('bayesest', '4.e'), use('estprop', '4.d, 4.f')
  ];

  // ---------- Perakitan paket ----------
  var LETTERS = ['a', 'b', 'c', 'd', 'e'];
  function buildPaper(seed) {
    var out = [];
    for (var i = 0; i < P.length; i++) {
      var r = makeR((seed * 7919 + i * 104729) >>> 0);
      var g = P[i].gen(r);
      var opts = shuffle([{ s: g.correct, ok: true }].concat(g.wrong.map(function (w) { return { s: w, ok: false }; })), r);
      out.push({ no: i + 1, id: P[i].id, topic: P[i].topic, conf: P[i].conf, src: P[i].src, syl: P[i].syl, sec: +P[i].syl.charAt(0), q: g.q, sol: g.sol, fast: g.fast || P[i].fast,
        options: opts.map(function (o) { return o.s; }), answer: opts.findIndex(function (o) { return o.ok; }) });
    }
    return out;
  }
  var api = { buildPaper: buildPaper, templates: T, paper: P, sections: SECTIONS, LETTERS: LETTERS, _n: n };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CF2Bank = api;
})(this);
