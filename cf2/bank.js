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
      function dens(coefN, coefD, pw) { var g = gcd(coefN, coefD); coefN /= g; coefD /= g; return M((coefD === 1 ? '\\dfrac{' + coefN + '}{' : '\\dfrac{' + coefN + '}{' + coefD) + 'y^{' + pw + '}}'); }
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
      var v = r() < 0.5 ? 'U' : 'ind', q, sol, ans, w;
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
      var v = r() < 0.5 ? 'C' : 'U', q, sol, ans, w;
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

  // ---------- Perakitan paket ----------
  var LETTERS = ['a', 'b', 'c', 'd', 'e'];
  function buildPaper(seed) {
    var out = [];
    for (var i = 0; i < T.length; i++) {
      var r = makeR((seed * 7919 + i * 104729) >>> 0);
      var g = T[i].gen(r);
      var opts = shuffle([{ s: g.correct, ok: true }].concat(g.wrong.map(function (w) { return { s: w, ok: false }; })), r);
      out.push({ no: i + 1, id: T[i].id, topic: T[i].topic, conf: T[i].conf, src: T[i].src, q: g.q, sol: g.sol,
        options: opts.map(function (o) { return o.s; }), answer: opts.findIndex(function (o) { return o.ok; }) });
    }
    return out;
  }
  var api = { buildPaper: buildPaper, templates: T, LETTERS: LETTERS, _n: n };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CF2Bank = api;
})(this);
