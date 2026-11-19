/* Bank soal prediksi CF1 – Matematika Keuangan.
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

  // ---------- Fungsi keuangan ----------
  function vv(i, k) { return Math.pow(1 + i, -k); }
  function an(i, k) { return i === 0 ? k : (1 - vv(i, k)) / i; }
  function sn(i, k) { return i === 0 ? k : (Math.pow(1 + i, k) - 1) / i; }
  function ad(i, k) { return an(i, k) * (1 + i); }
  function Ia(i, k) { return (ad(i, k) - k * vv(i, k)) / i; }
  function Da(i, k) { return (k - an(i, k)) / i; }
  function geoPV(P, g, i, k) { return Math.abs(i - g) < 1e-12 ? P * k / (1 + i) : P * (1 - Math.pow((1 + g) / (1 + i), k)) / (i - g); }
  function solve(f, lo, hi) { var flo = f(lo); for (var it = 0; it < 200; it++) { var mid = (lo + hi) / 2, fm = f(mid); if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; } return (lo + hi) / 2; }
  function pc(x, d) { return n(x * 100, d === undefined ? 2 : d) + '%'; }
  function pcOpts(r, ans, wr, d) { return numOpts(r, ans * 100, wr.map(function (x) { return x * 100; }), d === undefined ? 2 : d, function (s) { return s + '%'; }); }
  function money(r, ans, wr, d) { return numOpts(r, ans, wr, d === undefined ? 2 : d); }

  var T = [];

  // ===== 1. Nilai waktu dari uang =====
  T.push({ id: 'eqrate', sec: 1, syl: '1.a, 1.b', topic: 'Konversi suku bunga, diskonto & force of interest', conf: 'Tinggi',
    src: 'Mei 2025 #2 & #7, Agu 2025 #2, Nov 2025 #7, Jul 2024 #1',
    fast: 'Ubah semuanya ke faktor akumulasi 1 tahun: (1 + i⁽ᵐ⁾/m)ᵐ, (1 − d⁽ᵐ⁾/m)⁻ᵐ, atau e^δ. Kalikan faktornya antar-periode, ambil akar sesuai jumlah tahun, lalu konversi ke bentuk yang ditanya. Di fx-991 simpan 1 + i ke memori A supaya tidak mengetik ulang.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var dm = r.pick([0.064, 0.06, 0.08, 0.05]), m = r.pick([4, 2, 12]), k = r.pick([6, 4, 2, 12]);
        if (k === m) k = m === 12 ? 4 : 12;
        var i = Math.pow(1 - dm / m, -m) - 1, del = Math.log(1 + i), ik = k * (Math.pow(1 + i, 1 / k) - 1);
        ans = del + ik;
        q = 'Diketahui \\(d^{(' + m + ')} = ' + t(dm, 3) + '\\). Tentukan nilai \\(\\delta + i^{(' + k + ')}\\).';
        sol = '1 + i = (1 − ' + n(dm, 3) + '/' + m + ')^{−' + m + '} = ' + n(1 + i, 6) + '. δ = ln(1 + i) = ' + n(del, 6) + '; i⁽' + k + '⁾ = ' + k + '[(1 + i)^{1/' + k + '} − 1] = ' + n(ik, 6) + '. Jumlah = <b>' + n(ans, 4) + '</b>.';
        w = [dm + ik, 2 * del, i + ik, del + dm];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 4));
      }
      var a = r.pick([4, 5]), b = r.pick([6, 10]), d0 = r.pick([0.04, 0.05]), y2 = r.pick([0.06, 0.08]), m2 = r.pick([2, 4]);
      var acc = Math.exp(d0 * a) * Math.pow(1 - y2 / m2, -m2 * b), ie = Math.pow(acc, 1 / (a + b)) - 1, i12 = 12 * (Math.pow(1 + ie, 1 / 12) - 1);
      ans = i12;
      q = 'Sebuah dana berakumulasi dengan force of interest ' + n(d0, 2) + ' selama ' + a + ' tahun pertama, lalu dengan tingkat diskonto nominal ' + pc(y2, 0) + ' dikonversi ' + (m2 === 2 ? 'semesteran' : 'kuartalan') + ' selama ' + b + ' tahun berikutnya. Untuk periode ' + (a + b) + ' tahun, tentukan tingkat bunga nominal tahunan ekuivalen yang dikonversi bulanan.';
      sol = 'Faktor akumulasi total = e^{' + n(d0 * a, 2) + '}·(1 − ' + n(y2 / m2, 3) + ')^{−' + (m2 * b) + '} = ' + n(acc, 5) + '. 1 + i = ' + n(acc, 5) + '^{1/' + (a + b) + '} = ' + n(1 + ie, 6) + '. i⁽¹²⁾ = 12[(1 + i)^{1/12} − 1] = <b>' + pc(ans, 3) + '</b>.';
      w = [ie, (d0 * a + y2 * b) / (a + b), Math.log(1 + ie), 12 * (Math.pow(1 + (d0 * a + y2 * b) / (a + b), 1 / 12) - 1)];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 3));
    } });

  T.push({ id: 'yield', sec: 1, syl: '1.f', topic: 'Dollar-weighted & time-weighted yield', conf: 'Tinggi',
    src: 'Mei 2025 #5 & #6, Agu 2025 #5 & #6, Nov 2025 #5, Mei 2026 #5',
    fast: 'DWR (aproksimasi bunga sederhana): i = I / (A + Σ Cₜ(1 − t)), dengan I = B − A − ΣCₜ dan t dalam pecahan tahun. TWR: kalikan (saldo sebelum transaksi ÷ saldo sesudah transaksi sebelumnya) untuk setiap subperiode, lalu kurangi 1. Penarikan = Cₜ negatif.',
    gen: function (r) {
      var A = r.pick([8000, 10000, 95000, 50000]), D1 = r.pick([2000, 3000]) * (A / 10000), m1 = r.pick([2, 3, 4]), W = r.pick([500, 1000]) * (A / 10000), m2 = r.pick([6, 7]), D2 = r.pick([1000, 1500]) * (A / 10000), m3 = r.pick([9, 10]);
      D1 = Math.round(D1); W = Math.round(W); D2 = Math.round(D2);
      var mo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      var expo = A + D1 * (1 - m1 / 12) - W * (1 - m2 / 12) + D2 * (1 - m3 / 12), q, sol, ans, w;
      var base = 'Saldo awal tahun suatu akun adalah ' + n(A, 0) + '. Setoran ' + n(D1, 0) + ' pada 1 ' + mo[m1] + ', penarikan ' + n(W, 0) + ' pada 1 ' + mo[m2] + ', dan setoran ' + n(D2, 0) + ' pada 1 ' + mo[m3] + '. ';
      if (r() < 0.5) {
        var dwr = r.pick([0.0687, 0.0887, 0.075, 0.062]), I = dwr * expo;
        ans = I;
        q = base + 'Dollar-weighted yield akun untuk tahun tersebut ' + pc(dwr, 2) + '. Tentukan besar bunga yang diperoleh.';
        sol = 'Bobot waktu (sisa tahun): ' + n(A, 0) + ' + ' + n(D1, 0) + '·' + n(1 - m1 / 12, 4) + ' − ' + n(W, 0) + '·' + n(1 - m2 / 12, 4) + ' + ' + n(D2, 0) + '·' + n(1 - m3 / 12, 4) + ' = ' + n(expo, 2) + '. I = ' + pc(dwr, 2) + ' × ' + n(expo, 2) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [dwr * (A + D1 - W + D2), dwr * A, dwr * (A + D1 * m1 / 12 - W * m2 / 12 + D2 * m3 / 12), dwr * expo * 1.08];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
      }
      var B = Math.round((A + D1 - W + D2) * r.pick([1.06, 1.08, 1.1]));
      var I2 = B - A - D1 + W - D2;
      ans = I2 / expo;
      q = base + 'Saldo akhir tahun ' + n(B, 0) + '. Tentukan dollar-weighted yield (aproksimasi bunga sederhana).';
      sol = 'I = ' + n(B, 0) + ' − ' + n(A, 0) + ' − (' + n(D1, 0) + ' − ' + n(W, 0) + ' + ' + n(D2, 0) + ') = ' + n(I2, 0) + '. Penyebut = ' + n(expo, 2) + '. i = <b>' + pc(ans, 2) + '</b>.';
      w = [I2 / A, I2 / (A + D1 - W + D2), I2 / (A + (D1 - W + D2) / 2), (B - A) / A];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  T.push({ id: 'eqval', sec: 1, syl: '1.c, 1.e', topic: 'Persamaan nilai (mencari i atau n)', conf: 'Tinggi',
    src: 'Agu 2025 #1, Mei 2025 #3, Jul 2024 #5 & #11',
    fast: 'Jadikan persamaan kuadrat dalam v (atau x = vⁿ) dengan membagi pangkat terkecil, lalu pakai MODE EQN di fx-991. Buang akar yang membuat i ≥ 100% atau vⁿ di luar (0, 1). Untuk n: n = −ln x / ln(1 + i).',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var Y = r.pick([200, 300, 150]), Z = r.pick([500, 600, 400]), it = r.pick([0.06, 0.08, 0.1, 0.12]), v0 = 1 / (1 + it);
        var X = Math.round((Y * v0 + Z * v0 * v0 * v0) / (v0 * v0));
        var disc = X * X - 4 * Z * Y, roots = [(X + Math.sqrt(disc)) / (2 * Z), (X - Math.sqrt(disc)) / (2 * Z)].filter(function (x) { return x > 0.5 && x < 1; });
        var vs = roots.sort(function (a, b) { return b - a; })[0];
        ans = 1 / vs - 1;
        q = 'Untuk tingkat bunga efektif tahunan i yang tidak diketahui (i < 100%), dua aliran pembayaran berikut memiliki nilai sekarang yang sama: (i) ' + n(X, 0) + ' di akhir tahun ke-2; (ii) ' + Y + ' di akhir tahun ke-1 dan ' + Z + ' di akhir tahun ke-3. Tentukan i.';
        sol = n(X, 0) + 'v² = ' + Y + 'v + ' + Z + 'v³ ⇒ ' + Z + 'v² − ' + n(X, 0) + 'v + ' + Y + ' = 0. Akar yang memberi i < 100%: v = ' + n(vs, 5) + ' ⇒ i = <b>' + pc(ans, 2) + '</b>.';
        w = [ans * 1.1, it + 0.01, 1 / Math.min.apply(null, [(X - Math.sqrt(disc)) / (2 * Z), 0.95]) - 1, (X - Y - Z) / (Y + Z) + 0.1];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      var K = r.pick([1, 0.8, 1.2, 1.5]), ii = r.pick([0.06, 0.08, 0.05]), Am = r.pick([10, 20, 50]);
      var x = (-1 + Math.sqrt(1 + 4 * K)) / 2, nn = -Math.log(x) / Math.log(1 + ii);
      ans = nn;
      q = 'Jumlah nilai sekarang dua pembayaran masing-masing ' + Am + ' juta, dibayar di akhir tahun ke-n dan ke-2n, adalah ' + n(Am * K, 0) + ' juta. Dengan tingkat bunga efektif ' + pc(ii, 0) + ', tentukan n.';
      sol = 'Misal x = vⁿ: x + x² = ' + n(K, 2) + ' ⇒ x = (−1 + √(1 + 4·' + n(K, 2) + '))/2 = ' + n(x, 5) + '. n = −ln x / ln(' + n(1 + ii, 2) + ') = <b>' + n(ans, 2) + '</b>.';
      w = [nn / 2, -Math.log(K / 2) / Math.log(1 + ii), nn * 2, -Math.log(x) / ii];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'npv', sec: 1, syl: '1.f', topic: 'NPV & IRR', conf: 'Sedang',
    src: 'Mei 2026 #4, Nov 2025 #3',
    fast: 'Ketik arus kas sebagai polinom dalam v lalu pakai CALC (NPV) atau SOLVE (IRR, tebakan awal 0,1) di fx-991. Untuk IRR, cek opsi: NPV pada IRR harus ≈ 0, jadi substitusi opsi ke rumus sering lebih cepat daripada SOLVE.',
    gen: function (r) {
      var C0 = r.pick([4500, 3000, 5000]), cf = [0, r.pick([1500, 1000]), r.pick([1200, 1500]), r.pick([1300, 1600]), r.pick([1400, 1800])];
      var npv = function (i) { var s = -C0; for (var k = 1; k < cf.length; k++) s += cf[k] * vv(i, k); return s; };
      var q, sol, ans, w;
      var tbl = 'Arus kas proyek (juta rupiah): tahun 0: −' + n(C0, 0) + '; ' + cf.slice(1).map(function (c, k) { return 'tahun ' + (k + 1) + ': ' + n(c, 0); }).join('; ') + '. ';
      if (r() < 0.5) {
        var rr = r.pick([0.08, 0.1, 0.12]);
        ans = npv(rr);
        q = tbl + 'Hitung NPV proyek pada tingkat diskonto ' + pc(rr, 0) + ' per tahun.';
        sol = 'NPV = −' + n(C0, 0) + ' + Σ CFₖ v^k pada i = ' + pc(rr, 0) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [npv(rr) + C0 * 0.1, cf.reduce(function (a, b) { return a + b; }, 0) - C0, npv(rr + 0.02), npv(rr - 0.02)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
      }
      ans = solve(npv, -0.5, 1.5);
      q = tbl + 'Tentukan IRR proyek.';
      sol = 'IRR adalah i yang membuat NPV = 0. Dengan SOLVE: i = <b>' + pc(ans, 2) + '</b> (cek: NPV(' + pc(ans, 2) + ') ≈ 0).';
      w = [ans + 0.02, ans - 0.015, (cf.reduce(function (a, b) { return a + b; }, 0) / C0 - 1) / 4, ans * 1.5];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  // ===== 2. Anuitas =====
  T.push({ id: 'geo', sec: 2, syl: '2.c', topic: 'Anuitas geometrik', conf: 'Tinggi',
    src: 'Mei 2025 #8 & #13, Agu 2025 #9 & #14, Nov 2025 #8 & #13',
    fast: 'PV anuitas-immediate geometrik = P[1 − ((1+g)/(1+i))ⁿ]/(i − g). Untuk “level dulu lalu naik g”: P·aₙ + vⁿ·P(1+g)·[1 − ((1+g)/(1+i))ᵐ]/(i − g). Anuitas-due tinggal dikali (1 + i). Simpan (1+g)/(1+i) di memori agar cepat.',
    gen: function (r) {
      var q, sol, ans, w, v = r.pick(['basic', 'level', 'eq']);
      if (v === 'basic') {
        var P = r.pick([100, 500, 1000]), g = r.pick([0.03, 0.04, 0.05]), i = r.pick([0.06, 0.07, 0.08]), N = r.pick([10, 16, 20]), due = r() < 0.4;
        ans = geoPV(P, g, i, N) * (due ? 1 + i : 1);
        q = 'Anuitas' + (due ? '-due' : '-immediate') + ' ' + N + ' tahun membayar ' + P + ' pada pembayaran pertama, dan setiap pembayaran berikutnya naik ' + pc(g, 0) + '. Dengan tingkat bunga efektif ' + pc(i, 0) + ', hitung nilai sekarangnya.';
        sol = 'PV = ' + P + '·[1 − (' + n(1 + g, 2) + '/' + n(1 + i, 2) + ')^{' + N + '}]/(' + n(i, 2) + ' − ' + n(g, 2) + ')' + (due ? ' × ' + n(1 + i, 2) : '') + ' = <b>' + n(ans, 2) + '</b>.';
        w = [geoPV(P, g, i, N) * (due ? 1 : 1 + i), P * an(i, N), P * an(i - g, N), geoPV(P, g, i, N - 1) * (due ? 1 + i : 1)];
      } else if (v === 'level') {
        var P2 = r.pick([100, 200]), g2 = r.pick([0.05, 0.06]), i2 = r.pick([0.07, 0.08]), due2 = r() < 0.5;
        ans = (P2 * an(i2, 10) + vv(i2, 10) * geoPV(P2 * (1 + g2), g2, i2, 10)) * (due2 ? 1 + i2 : 1);
        q = 'Anuitas' + (due2 ? '-due' : '-immediate') + ' 20 tahun membayar ' + P2 + ' per tahun selama 10 tahun pertama. Mulai pembayaran ke-11, setiap pembayaran naik ' + pc(g2, 0) + ' dari pembayaran sebelumnya. Tingkat bunga efektif ' + pc(i2, 0) + '. Hitung nilai sekarangnya.';
        sol = 'PV = [' + P2 + '·a₁₀ + v¹⁰·' + n(P2 * (1 + g2), 2) + '·(1 − (' + n(1 + g2, 2) + '/' + n(1 + i2, 2) + ')¹⁰)/(' + n(i2 - g2, 2) + ')]' + (due2 ? ' × ' + n(1 + i2, 2) : '') + ' = <b>' + n(ans, 2) + '</b>.';
        w = [ans / (due2 ? 1 + i2 : 1) * (due2 ? 1 : 1 + i2), P2 * an(i2, 20) * (due2 ? 1 + i2 : 1), (P2 * an(i2, 10) + vv(i2, 10) * geoPV(P2, g2, i2, 10)) * (due2 ? 1 + i2 : 1), (P2 * an(i2, 10) + geoPV(P2 * (1 + g2), g2, i2, 10)) * (due2 ? 1 + i2 : 1)];
      } else {
        var g3 = r.pick([0.04, 0.03]), d3 = r.pick([0.02, 0.03]), i3 = r.pick([0.05, 0.06]), N3 = r.pick([12, 16, 20]);
        var pv = geoPV(100, g3, i3, N3), base3 = geoPV(1, -d3, i3, N3);
        ans = pv / base3;
        q = 'Davin membeli anuitas-immediate ' + N3 + ' tahun yang membayar 100 pada tahun pertama dan naik ' + pc(g3, 0) + ' tiap tahun. Kelvin membeli anuitas-immediate ' + N3 + ' tahun yang membayar X pada tahun pertama dan turun ' + pc(d3, 0) + ' tiap tahun. Pada tingkat bunga efektif ' + pc(i3, 0) + ', nilai sekarang keduanya sama. Tentukan X.';
        sol = 'PV Davin = 100·[1 − (' + n(1 + g3, 2) + '/' + n(1 + i3, 2) + ')^{' + N3 + '}]/(' + n(i3 - g3, 2) + ') = ' + n(pv, 3) + '. PV Kelvin per X = [1 − (' + n(1 - d3, 2) + '/' + n(1 + i3, 2) + ')^{' + N3 + '}]/(' + n(i3 + d3, 2) + ') = ' + n(base3, 4) + '. X = <b>' + n(ans, 2) + '</b>.';
        w = [pv / an(i3, N3), 100 * Math.pow(1 + g3, N3 / 2), pv / geoPV(1, d3, i3, N3), pv / base3 * 0.9];
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'arith', sec: 2, syl: '2.c', topic: 'Anuitas aritmetika (naik/turun)', conf: 'Tinggi',
    src: 'Mei 2025 #12, Agu 2025 #11 & #12, Nov 2025 #12 & #14, Mei 2026 #8, Jul 2024 #12',
    fast: '(Ia)ₙ = (äₙ − n vⁿ)/i dan (Da)ₙ = (n − aₙ)/i. Pembayaran A, A+B, … = A·aₙ + B·(aₙ − n vⁿ)/i. Pola “naik sampai batas lalu datar”: (Ia)ₖ + vᵏ·level·aₘ. Hitung aₙ sekali, simpan, lalu pakai ulang.',
    gen: function (r) {
      var q, sol, ans, w, v = r.pick(['lin', 'cap', 'down', 'eq']), i = r.pick([0.05, 0.06, 0.065, 0.075]);
      if (v === 'lin') {
        var A = r.pick([2, 4, 30]), Bd = r.pick([2, 5]), N = r.pick([8, 9, 10]);
        ans = A * an(i, N) + Bd * (an(i, N) - N * vv(i, N)) / i;
        q = 'Anuitas-immediate membayar ' + A + ' di akhir tahun pertama, lalu setiap pembayaran naik ' + Bd + ' dari sebelumnya, sebanyak ' + N + ' pembayaran. Dengan tingkat bunga efektif ' + pc(i, 1) + ', hitung nilai sekarangnya.';
        sol = 'PV = ' + A + '·a_{' + N + '} + ' + Bd + '·(a_{' + N + '} − ' + N + 'v^{' + N + '})/i = ' + A + '·' + n(an(i, N), 4) + ' + ' + Bd + '·' + n((an(i, N) - N * vv(i, N)) / i, 4) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [A * an(i, N) + Bd * Ia(i, N), (A + Bd * (N - 1) / 2) * an(i, N), A * an(i, N) + Bd * Da(i, N), A * ad(i, N) + Bd * (an(i, N) - N * vv(i, N)) / i];
      } else if (v === 'cap') {
        var s = r.pick([100, 50]);
        ans = s * Ia(i, 10) + 10 * s * vv(i, 10) * an(i, 10);
        q = 'Anuitas-immediate 20 tahun: pembayaran pertama ' + s + ', lalu naik ' + s + ' tiap tahun hingga mencapai ' + n(10 * s, 0) + ', kemudian tetap ' + n(10 * s, 0) + ' sampai akhir. Tingkat bunga efektif ' + pc(i, 1) + '. Hitung nilai sekarangnya.';
        sol = 'PV = ' + s + '·(Ia)₁₀ + ' + n(10 * s, 0) + '·v¹⁰·a₁₀ = ' + s + '·' + n(Ia(i, 10), 4) + ' + ' + n(10 * s, 0) + '·' + n(vv(i, 10) * an(i, 10), 4) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [s * Ia(i, 20), s * Ia(i, 10) + 10 * s * an(i, 10), s * Ia(i, 10) + 10 * s * vv(i, 10) * ad(i, 10), s * Da(i, 10) + 10 * s * vv(i, 10) * an(i, 10)];
      } else if (v === 'down') {
        var s2 = r.pick([100, 50]);
        ans = s2 * Da(i, 10) + s2 * vv(i, 10) * an(i, 10);
        q = 'Anuitas-immediate 20 tahun: pembayaran pertama ' + n(10 * s2, 0) + ', lalu turun ' + s2 + ' tiap tahun hingga mencapai ' + s2 + ', kemudian tetap ' + s2 + ' sampai akhir. Tingkat bunga efektif ' + pc(i, 1) + '. Hitung nilai sekarangnya.';
        sol = 'PV = ' + s2 + '·(Da)₁₀ + ' + s2 + '·v¹⁰·a₁₀ = ' + s2 + '·' + n(Da(i, 10), 4) + ' + ' + s2 + '·' + n(vv(i, 10) * an(i, 10), 4) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [s2 * Da(i, 10) + s2 * an(i, 10), s2 * Ia(i, 10) + s2 * vv(i, 10) * an(i, 10), s2 * Da(i, 20), s2 * Da(i, 10)];
      } else {
        var N4 = 10;
        ans = 10 * 100 * Ia(i, N4) / Da(i, N4);
        q = 'Stephanie memiliki anuitas-immediate 10 tahun yang membayar 100 di tahun pertama dan naik 100 setiap tahun. Karina memiliki anuitas-immediate 10 tahun yang membayar X di tahun pertama dan turun X/10 setiap tahun. Dengan tingkat bunga ' + pc(i, 1) + ', nilai sekarang keduanya sama. Tentukan X.';
        sol = '100·(Ia)₁₀ = (X/10)·(Da)₁₀ ⇒ X = 1.000·(Ia)₁₀/(Da)₁₀ = 1.000·' + n(Ia(i, N4), 4) + '/' + n(Da(i, N4), 4) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [100 * Ia(i, N4) / Da(i, N4), 1000, 1000 * Da(i, N4) / Ia(i, N4), 10 * 100 * Ia(i, N4) / an(i, N4)];
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'perp', sec: 2, syl: '2.b, 2.c', topic: 'Perpetuitas', conf: 'Tinggi',
    src: 'Jul 2024 #15, Mei 2025 #19, Agu 2025 #19, Nov 2025 #19, Mei 2026 #6 & #10',
    fast: 'Perpetuitas-immediate = 1/i, due = 1/d. Perpetuitas tiap k tahun: 1/[(1 + i)ᵏ − 1] (immediate) atau 1/(1 − vᵏ) (due). Naik aritmetika P, P+Q, …: P/i + Q/i². Naik geometrik setelah n tahun: vⁿ·P(1+g)/(i − g).',
    gen: function (r) {
      var q, sol, ans, w, v = r.pick(['every', 'inc', 'growth']);
      if (v === 'every') {
        var p = r.pick([1, 2]), PV = r.pick([20, 25, 40]), k = r.pick([4, 6]);
        var dh = p / PV, vh = 1 - dh;
        ans = PV * (1 - Math.pow(vh, k));
        q = 'Perpetuitas A membayar ' + p + ' juta setiap 6 bulan di awal periode, dengan nilai sekarang ' + PV + ' juta. Perpetuitas B membayar X setiap ' + (k / 2) + ' tahun di awal periode. Dengan tingkat bunga efektif yang sama, nilai sekarang keduanya sama. Tentukan X.';
        sol = 'A: ' + p + '/d_{½} = ' + PV + ' ⇒ d_{½} = ' + n(dh, 4) + ', v_{½} = ' + n(vh, 4) + '. B: X/(1 − v_{½}^{' + k + '}) = ' + PV + ' ⇒ X = ' + PV + '(1 − ' + n(vh, 4) + '^{' + k + '}) = <b>' + n(ans, 2) + '</b>.';
        w = [p * k, PV * (Math.pow(1 / vh, k) - 1), PV * (1 - Math.pow(vh, k / 2)), PV * k * dh];
      } else if (v === 'inc') {
        var j = r.pick([0.05, 0.06, 0.075, 0.08]), P = r.pick([300, 200, 500]), Q = r.pick([18, 12, 20]);
        var price = Math.round(P / j + Q / (j * j));
        ans = solve(function (x) { return P / x + Q / (x * x) - price; }, 0.001, 1);
        q = 'Zaza membeli perpetuitas-immediate tahunan seharga ' + n(price, 0) + ' dengan pembayaran pertama ' + P + ' dan setiap pembayaran berikutnya lebih tinggi ' + Q + '. Tentukan tingkat bunga efektif tahunan j.';
        sol = 'PV = P/j + Q/j²: ' + n(price, 0) + 'j² − ' + P + 'j − ' + Q + ' = 0 ⇒ j = <b>' + pc(ans, 2) + '</b>.';
        w = [P / price, (P + Q) / price, Math.sqrt(Q / price), ans * 1.2];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      } else {
        var i3 = r.pick([0.045, 0.05, 0.06]), g3 = r.pick([0.02, 0.03]), P3 = r.pick([100, 1000]), N3 = 10;
        ans = P3 * an(i3, N3) + vv(i3, N3) * P3 * (1 + g3) / (i3 - g3);
        q = 'Perpetuitas-immediate membayar ' + P3 + ' per tahun selama ' + N3 + ' tahun pertama. Mulai tahun ke-11, setiap pembayaran naik ' + pc(g3, 0) + ' dari pembayaran sebelumnya. Dengan imbal hasil ' + pc(i3, 1) + ' per tahun, hitung nilai sekarangnya.';
        sol = 'PV = ' + P3 + '·a₁₀ + v¹⁰·' + n(P3 * (1 + g3), 0) + '/(' + n(i3, 3) + ' − ' + n(g3, 2) + ') = ' + n(P3 * an(i3, N3), 2) + ' + ' + n(vv(i3, N3) * P3 * (1 + g3) / (i3 - g3), 2) + ' = <b>' + n(ans, 0) + '</b>.';
        w = [P3 / i3, P3 * an(i3, N3) + vv(i3, N3) * P3 / (i3 - g3), P3 * (1 + g3) / (i3 - g3), P3 * an(i3, N3) + P3 * (1 + g3) / (i3 - g3)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'annrel', sec: 2, syl: '2.a, 2.b', topic: 'Hubungan simbol anuitas', conf: 'Tinggi',
    src: 'Mei 2025 #9, Jul 2024 #9 & #13, Mei 2026 #9 & #13',
    fast: 'a₂ₙ = aₙ(1 + vⁿ), jadi rasio PV 2n-tahun : n-tahun = 1 + vⁿ. Untuk anuitas kontinu: 1/āₙ − 1/s̄ₙ = δ (dan versi diskret 1/aₙ − 1/sₙ = i). Rumus satu baris ini menghindari SOLVE.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.6) {
        var k = r.pick([1.5, 1.6, 1.4, 1.7]), N = r.pick([10, 8, 12]);
        ans = Math.pow(k - 1, -1 / N) - 1;
        q = 'Nilai sekarang anuitas-immediate ' + N + ' tahun dengan pembayaran tahunan tetap pada tingkat bunga i adalah X. Nilai sekarang anuitas-immediate ' + (2 * N) + ' tahun dengan pembayaran dan bunga yang sama adalah ' + n(k, 1) + 'X. Tentukan i.';
        sol = 'a_{' + 2 * N + '} = a_{' + N + '}(1 + v^{' + N + '}) ⇒ 1 + v^{' + N + '} = ' + n(k, 1) + ' ⇒ v^{' + N + '} = ' + n(k - 1, 1) + ' ⇒ i = ' + n(k - 1, 1) + '^{−1/' + N + '} − 1 = <b>' + pc(ans, 2) + '</b>.';
        w = [Math.pow(k, 1 / N) - 1, (k - 1) / N, Math.pow(1 / (k - 1), 1 / (2 * N)) - 1, Math.pow(2 - k, -1 / N) - 1];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      var A = r.pick([4, 5, 6]), S = r.pick([12, 15, 20]);
      ans = 1 / A - 1 / S;
      q = 'Diketahui \\(\\bar a_{\\overline{n}|} = ' + A + '\\) dan \\(\\bar s_{\\overline{n}|} = ' + S + '\\). Tentukan δ.';
      sol = 'ā = (1 − vⁿ)/δ dan s̄ = (eⁿᵟ − 1)/δ ⇒ 1/ā − 1/s̄ = δ. δ = 1/' + A + ' − 1/' + S + ' = <b>' + n(ans, 4) + '</b>.';
      w = [1 / A + 1 / S, 1 / A, (S - A) / (S * A * 2), Math.log(S / A) / A];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 4));
    } });

  T.push({ id: 'monthly', sec: 2, syl: '2.a, 2.b', topic: 'Anuitas bulanan & konversi periode', conf: 'Tinggi',
    src: 'Nov 2025 #11 & #15, Mei 2026 #11 & #12, Mei 2025 #10 & #11, Jul 2024 #7',
    fast: 'Ubah dulu bunga ke periode pembayaran: bunga efektif tahunan → j = (1 + i)^{1/12} − 1; nominal i⁽¹²⁾ → j = i⁽¹²⁾/12. Setelah itu soalnya hanya aₙ atau sₙ biasa dengan n = jumlah bulan. Pembayaran pertama “hari ini” berarti anuitas-due.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var FV = r.pick([100000, 250000, 50000]), ie = r.pick([0.06, 0.05, 0.07]), Y = r.pick([17, 15, 10]), j = Math.pow(1 + ie, 1 / 12) - 1, N = 12 * Y;
        ans = FV / (sn(j, N) * (1 + j));
        q = 'Brenda ingin mengumpulkan ' + n(FV, 0) + ' pada akhir ' + Y + ' tahun. Tingkat bunga efektif tahunan ' + pc(ie, 0) + '. Ia menyetor setiap bulan dengan setoran pertama hari ini, total ' + N + ' setoran. Berapa setoran bulanannya?';
        sol = 'j = ' + n(1 + ie, 2) + '^{1/12} − 1 = ' + n(j, 6) + '. Anuitas-due: X·s̈_{' + N + '} = ' + n(FV, 0) + ' dengan s̈ = ' + n(sn(j, N) * (1 + j), 3) + ' ⇒ X = <b>' + n(ans, 2) + '</b>.';
        w = [FV / sn(j, N), FV / (sn(ie / 12, N) * (1 + ie / 12)), FV / N, FV / (sn(j, N) * (1 + j)) * Math.pow(1 + ie, -0.5)];
      } else {
        var L = r.pick([500, 100, 200]) * 1e6, nom = r.pick([0.084, 0.06, 0.09, 0.075]), Y2 = r.pick([30, 20, 15]), N2 = 12 * Y2, j2 = nom / 12;
        var K = L / an(j2, N2);
        ans = K * N2 - L;
        q = 'Hutang ' + n(L / 1e6, 0) + ' juta dilunasi dengan cicilan tetap setiap akhir bulan selama ' + Y2 + ' tahun pada bunga nominal ' + pc(nom, 1) + ' dikonversi bulanan. Hitung total bunga yang dibayar selama masa pinjaman (dalam rupiah).';
        sol = 'Cicilan K = L/a_{' + N2 + '|' + n(j2, 4) + '} = ' + n(K, 0) + '. Total bunga = ' + N2 + 'K − L = <b>' + n(ans, 0) + '</b>.';
        w = [L * nom * Y2, K * N2, ans * 0.9, L / an(Math.pow(1 + nom, 1 / 12) - 1, N2) * N2 - L];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'deferred', sec: 2, syl: '2.e', topic: 'Anuitas tertunda', conf: 'Sedang',
    src: 'Nov 2025 #6 & #13, Mei 2026 #12 & #13',
    fast: 'Hitung anuitasnya di titik “satu periode sebelum pembayaran pertama” (PV) atau di “pembayaran terakhir” (FV), lalu geser ke waktu yang diminta dengan vᵗ atau (1 + i)ᵗ. Gambar garis waktu kecil dulu untuk menghitung jarak pergeserannya.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var m = r.pick([30, 20, 24]), P = r.pick([5, 10]), t0 = r.pick([6, 5, 4]), T2 = r.pick([30, 25]), ie = r.pick([0.06, 0.05]);
        var j = Math.pow(1 + ie, 0.5) - 1, tLast = t0 + (m - 1) / 2;
        ans = P * sn(j, m) * Math.pow(1 + ie, T2 - tLast);
        q = 'Sebanyak ' + m + ' pembayaran semesteran sebesar ' + P + ' dilakukan, dimulai tepat ' + t0 + ' tahun dari sekarang. Tingkat bunga efektif tahunan ' + pc(ie, 0) + '. Tentukan nilai akumulasinya pada waktu ' + T2 + ' tahun dari sekarang (dana dibiarkan berbunga setelah pembayaran selesai).';
        sol = 'j = ' + n(1 + ie, 2) + '^{1/2} − 1 = ' + n(j, 6) + '. Pembayaran terakhir di t = ' + n(tLast, 1) + '. FV = ' + P + '·s_{' + m + '|j}·' + n(1 + ie, 2) + '^{' + n(T2 - tLast, 1) + '} = ' + P + '·' + n(sn(j, m), 4) + '·' + n(Math.pow(1 + ie, T2 - tLast), 4) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [P * sn(j, m), P * sn(ie / 2, m) * Math.pow(1 + ie, T2 - tLast), P * sn(j, m) * Math.pow(1 + ie, T2 - t0), P * sn(j, m) * (1 + j) * Math.pow(1 + ie, T2 - tLast)];
      } else {
        var N = 30, P2 = r.pick([500, 200]), g = r.pick([0.06, 0.04]), i2 = 0.08, d = r.pick([3, 4, 5]);
        ans = vv(i2, d - 1) * geoPV(P2, g, i2, N);
        q = 'Dengan tingkat bunga efektif 8%, berapa harga hari ini untuk anuitas dengan ' + N + ' pembayaran tahunan, pembayaran pertama ' + P2 + ' terjadi ' + d + ' tahun dari sekarang, dan setiap pembayaran berikutnya naik ' + pc(g, 0) + '?';
        sol = 'Di t = ' + (d - 1) + ' ini anuitas-immediate geometrik: ' + P2 + '·[1 − (' + n(1 + g, 2) + '/1,08)^{30}]/(0,08 − ' + n(g, 2) + ') = ' + n(geoPV(P2, g, i2, N), 3) + '. Diskonto v^{' + (d - 1) + '}: <b>' + n(ans, 2) + '</b>.';
        w = [vv(i2, d) * geoPV(P2, g, i2, N), geoPV(P2, g, i2, N), vv(i2, d - 1) * P2 * an(i2, N), vv(i2, d - 2) * geoPV(P2, g, i2, N)];
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'ddm', sec: 2, syl: '2.c', topic: 'Model diskonto dividen (DDM)', conf: 'Sedang',
    src: 'Mei 2025 #20, Agu 2025 #20',
    fast: 'Harga = D₁/(i − g), jadi i = D₁/P + g, dua langkah tanpa SOLVE. Untuk dividen naik aritmetika lalu geometrik: (Ia)ₙ + vⁿ·Dₙ(1 + g)/(i − g). Pastikan D₁ adalah dividen tahun depan, bukan dividen terakhir.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var P = r.pick([39.35, 25.5, 50.2]), D = r.pick([1, 1.5, 2]), g = r.pick([0.06, 0.04, 0.05]);
        ans = D / P + g;
        q = 'Harga saham saat ini ' + n(P, 2) + '. Dividen berikutnya, dibayar satu tahun dari sekarang, diperkirakan ' + n(D, 2) + ' dan harga mencerminkan pertumbuhan dividen ' + pc(g, 0) + ' per tahun. Tentukan tingkat bunga efektif tahunan i.';
        sol = 'P = D₁/(i − g) ⇒ i = ' + n(D, 2) + '/' + n(P, 2) + ' + ' + n(g, 2) + ' = <b>' + pc(ans, 2) + '</b>.';
        w = [D / P, D * (1 + g) / P + g, D / P - g + 0.1, (D / P + g) * 1.1];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      var i2 = r.pick([0.05, 0.06]), g2 = r.pick([0.03, 0.02]);
      ans = Ia(i2, 10) + vv(i2, 10) * 10 * (1 + g2) / (i2 - g2);
      q = 'Perusahaan memperkirakan dividen 1 pada tahun pertama, naik 1 tiap tahun hingga mencapai 10, lalu tumbuh ' + pc(g2, 0) + ' per tahun. Dengan tingkat bunga ' + pc(i2, 0) + ', tentukan harga saham menurut model diskonto dividen.';
      sol = 'Harga = (Ia)₁₀ + v¹⁰·10·' + n(1 + g2, 2) + '/(' + n(i2, 2) + ' − ' + n(g2, 2) + ') = ' + n(Ia(i2, 10), 3) + ' + ' + n(vv(i2, 10) * 10 * (1 + g2) / (i2 - g2), 3) + ' = <b>' + n(ans, 2) + '</b>.';
      w = [Ia(i2, 10) + vv(i2, 10) * 10 / (i2 - g2), 10 * (1 + g2) / (i2 - g2), Ia(i2, 10) + 10 * (1 + g2) / (i2 - g2), Ia(i2, 10) + vv(i2, 10) * 10 / i2];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  // ===== 3. Struktur jangka waktu suku bunga =====
  T.push({ id: 'spotfwd', sec: 3, syl: '3.b, 3.c', topic: 'Spot rate & forward rate', conf: 'Tinggi',
    src: 'Agu 2025 #4 & #24, Nov 2025 #1 & #2, Mei 2026 #15, Jul 2024 #25 & #26',
    fast: 'Selalu kerjakan lewat faktor akumulasi: (1 + s_{t+k})^{t+k} = (1 + s_t)^t (1 + f)^k. Dari harga zero: (1 + s_t)^t = 100/P_t. Harga obligasi dari forward: diskontokan tiap arus kas dengan perkalian faktor forward berurutan.',
    gen: function (r) {
      var q, sol, ans, w, v = r.pick(['curve', 'zero', 'bond']);
      if (v === 'curve') {
        var a = 0.08, b = r.pick([0.003, -0.001]), c = r.pick([-0.0015, 0.002, 0.001]), t0 = r.pick([0, 2, 4]), k = 3;
        var s = function (x) { return a + b * x + c * x * x; };
        if (t0 === 0) t0 = 1;
        var acc1 = Math.pow(1 + s(t0 + k), t0 + k), acc0 = Math.pow(1 + s(t0), t0);
        ans = Math.pow(acc1 / acc0, 1 / k) - 1;
        q = 'Kurva spot rate diberikan oleh \\(s_t = 0{,}08 ' + (b < 0 ? '-' : '+') + ' ' + t(Math.abs(b), 3) + 't ' + (c < 0 ? '-' : '+') + ' ' + t(Math.abs(c), 4) + 't^2\\). Tentukan tingkat forward efektif tahunan untuk pinjaman yang dimulai di t = ' + t0 + ' dengan jangka waktu ' + k + ' tahun.';
        sol = 's_{' + t0 + '} = ' + n(s(t0), 4) + ', s_{' + (t0 + k) + '} = ' + n(s(t0 + k), 4) + '. f = [(1 + s_{' + (t0 + k) + '})^{' + (t0 + k) + '}/(1 + s_{' + t0 + '})^{' + t0 + '}]^{1/' + k + '} − 1 = <b>' + pc(ans, 2) + '</b>.';
        w = [s(t0 + k), (s(t0 + k) * (t0 + k) - s(t0) * t0) / k * 1.03, s(t0 + k) - s(t0), (s(t0) + s(t0 + k)) / 2];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      if (v === 'zero') {
        var P1 = r.pick([96.23, 95.24, 97.09]), s2 = r.pick([0.035, 0.045, 0.05]), P2 = +(100 / Math.pow(1 + s2, 2)).toFixed(2);
        ans = P1 / P2 - 1;
        q = 'Harga obligasi zero-coupon bernilai tebus 100: jatuh tempo 1 tahun ' + n(P1, 2) + ', jatuh tempo 2 tahun ' + n(P2, 2) + '. Tentukan forward rate tahun ke-2 (dari t = 1 ke t = 2).';
        sol = '1 + f₁,₂ = (100/P₂)/(100/P₁) = P₁/P₂ = ' + n(P1, 2) + '/' + n(P2, 2) + ' ⇒ f = <b>' + pc(ans, 3) + '</b>.';
        w = [Math.sqrt(100 / P2) - 1, 100 / P1 - 1, 100 / P2 - 1, (P1 - P2) / 100];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 3));
      }
      var f = r.pick([[0.051, 0.047, 0.043], [0.04, 0.045, 0.05], [0.06, 0.055, 0.05]]), cpn = r.pick([0.045, 0.05, 0.06]);
      var d1 = 1 / (1 + f[0]), d2 = d1 / (1 + f[1]), d3 = d2 / (1 + f[2]);
      ans = 1000 * cpn * (d1 + d2 + d3) + 1000 * d3;
      q = 'Obligasi nominal 1000, jangka 3 tahun, kupon tahunan ' + pc(cpn, 1) + ', dihargai dengan spot rate yang diturunkan dari forward rate \\(i_{0,1} = ' + t(f[0], 3) + '\\), \\(i_{1,2} = ' + t(f[1], 3) + '\\), \\(i_{2,3} = ' + t(f[2], 3) + '\\). Tentukan harganya.';
      sol = 'Faktor diskonto: v₁ = 1/' + n(1 + f[0], 3) + ' = ' + n(d1, 5) + ', v₂ = ' + n(d2, 5) + ', v₃ = ' + n(d3, 5) + '. Harga = ' + n(1000 * cpn, 0) + '(v₁ + v₂ + v₃) + 1000v₃ = <b>' + n(ans, 2) + '</b>.';
      var avg = (f[0] + f[1] + f[2]) / 3;
      w = [1000 * cpn * an(avg, 3) + 1000 * vv(avg, 3) + 5, 1000 * cpn * (vv(f[0], 1) + vv(f[1], 2) + vv(f[2], 3)) + 1000 * vv(f[2], 3), 1000 * cpn * an(f[2], 3) + 1000 * vv(f[2], 3), 1000 * cpn * an(f[0], 3) + 1000 * vv(f[0], 3)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'macd', sec: 3, syl: '3.d', topic: 'Durasi Macaulay', conf: 'Tinggi',
    src: 'Mei 2025 #22, Agu 2025 #21, Nov 2025 #22, Mei 2026 #16',
    fast: 'D = Σ t·CFₜvᵗ / Σ CFₜvᵗ. Di fx-991 pakai MODE STAT (x = t, freq = CFₜvᵗ) lalu ambil x̄: x̄ adalah durasi Macaulay. Untuk anuitas level: D = (Ia)ₙ/aₙ.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var c1 = r.pick([2000, 1000]), c2 = r.pick([4000, 2500, 3000]), t2 = r.pick([3, 4]), y = r.pick([0.072, 0.08, 0.06]);
        var pv1 = c1 * vv(y, 1), pv2 = c2 * vv(y, t2);
        ans = (pv1 + t2 * pv2) / (pv1 + pv2);
        q = 'Sebuah investasi membayar ' + n(c1, 0) + ' di akhir tahun ke-1 dan ' + n(c2, 0) + ' di akhir tahun ke-' + t2 + ', dibeli dengan imbal hasil efektif ' + pc(y, 1) + '. Tentukan durasi Macaulay-nya.';
        sol = 'PV₁ = ' + n(pv1, 2) + ', PV₂ = ' + n(pv2, 2) + '. D = (1·' + n(pv1, 2) + ' + ' + t2 + '·' + n(pv2, 2) + ')/' + n(pv1 + pv2, 2) + ' = <b>' + n(ans, 3) + '</b>.';
        w = [(c1 + t2 * c2) / (c1 + c2), ans / (1 + y), (1 + t2) / 2, (pv1 + t2 * t2 * pv2) / (pv1 + pv2) / 2];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var N = r.pick([5, 10]), cp = r.pick([0.08, 0.05, 0.06]), y2 = r.pick([0.065, 0.06, 0.07]);
      var num = 0, den = 0; for (var k = 1; k <= N; k++) { var cf = cp * 1000 + (k === N ? 1000 : 0); num += k * cf * vv(y2, k); den += cf * vv(y2, k); }
      ans = num / den;
      q = 'Tentukan durasi Macaulay obligasi tenor ' + N + ' tahun, nilai par 1000, kupon tahunan ' + pc(cp, 0) + ', pada tingkat bunga efektif ' + pc(y2, 1) + '.';
      sol = 'D = Σ t·CFₜvᵗ / harga = ' + n(num, 2) + '/' + n(den, 2) + ' = <b>' + n(ans, 3) + '</b>.';
      w = [ans / (1 + y2), N, Ia(y2, N) / an(y2, N), (N + 1) / 2 + 1];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });

  T.push({ id: 'moddur', sec: 3, syl: '3.d', topic: 'Durasi termodifikasi (obligasi & portofolio)', conf: 'Tinggi',
    src: 'Mei 2025 #21, Agu 2025 #22, Nov 2025 #21, Jul 2024 #22',
    fast: 'Durasi modifikasi portofolio = rata-rata tertimbang nilai pasar: Σ (Nilaiₖ/Total)·Dₖ. Ini sudah 2 kali keluar dengan pola yang sama. Untuk satu obligasi: D_mod = D_Mac/(1 + i).',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var vals = r.pick([[3000, 7000, 10000], [20000, 35000, 45000], [5000, 15000, 30000]]), ds = r.pick([[4.615, 9.323, 19.085], [1.92, 2.84, 4.79], [2.5, 6.1, 8.7]]);
        var tot = vals[0] + vals[1] + vals[2];
        ans = (vals[0] * ds[0] + vals[1] * ds[1] + vals[2] * ds[2]) / tot;
        q = 'Portofolio investor: obligasi senilai ' + n(vals[0], 0) + ' dengan durasi termodifikasi ' + n(ds[0], 3) + ', obligasi senilai ' + n(vals[1], 0) + ' dengan durasi termodifikasi ' + n(ds[1], 3) + ', dan obligasi senilai ' + n(vals[2], 0) + ' dengan durasi termodifikasi ' + n(ds[2], 3) + '. Tentukan durasi termodifikasi portofolio.';
        sol = 'Rata-rata tertimbang nilai: (' + n(vals[0], 0) + '·' + n(ds[0], 3) + ' + ' + n(vals[1], 0) + '·' + n(ds[1], 3) + ' + ' + n(vals[2], 0) + '·' + n(ds[2], 3) + ')/' + n(tot, 0) + ' = <b>' + n(ans, 3) + '</b>.';
        w = [(ds[0] + ds[1] + ds[2]) / 3, ds[2], ans * 1.05, (vals[0] * ds[0] + vals[1] * ds[1] + vals[2] * ds[2]) / (vals[2] * 2)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var N = r.pick([5, 7, 10]), y = r.pick([0.0575, 0.07, 0.06]), loan = r() < 0.5;
      var mac;
      if (loan) mac = Ia(y, N) / an(y, N);
      else { var num = 0, den = 0, cp = r.pick([0.08, 0.06]); for (var k = 1; k <= N; k++) { var cf = cp + (k === N ? 1 : 0); num += k * cf * vv(y, k); den += cf * vv(y, k); } mac = num / den; }
      ans = mac / (1 + y);
      q = loan ? 'Perusahaan menerima pembayaran pinjaman yang sama besar di setiap akhir tahun selama ' + N + ' tahun, pada bunga efektif ' + pc(y, 2) + '. Tentukan durasi termodifikasinya.'
        : 'Tentukan durasi termodifikasi obligasi nominal 2000, tenor ' + N + ' tahun, kupon tahunan ' + pc(cp, 0) + ', pada bunga efektif ' + pc(y, 2) + '.';
      sol = 'D_Mac = ' + (loan ? '(Ia)ₙ/aₙ' : 'Σ t·CFₜvᵗ/harga') + ' = ' + n(mac, 4) + '. D_mod = D_Mac/(1 + i) = <b>' + n(ans, 3) + '</b>.';
      w = [mac, mac * (1 + y), (N + 1) / 2 / (1 + y), mac / (1 + y) * 0.92];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });

  T.push({ id: 'convex', sec: 3, syl: '3.d', topic: 'Konveksitas & aproksimasi harga', conf: 'Tinggi',
    src: 'Mei 2026 #17; silabus 3.d (konveksitas)',
    fast: 'Hafalkan 4 bentuk: (1) P_baru ≈ P[1 − D_mod·Δi + ½·C·(Δi)²], Δi dalam desimal; (2) zero coupon: C = n(n + 1)/(1 + i)²; (3) perpetuitas: C = 2/i²; (4) C_mod = (C_Mac + D_Mac)/(1 + i)². Untuk arus kas umum: C = Σ t(t + 1)CFₜv^{t+2}/P. Di fx-991, hitung Σ t(t + 1)CFₜvᵗ di MODE STAT lalu bagi dengan P(1 + i)².',
    gen: function (r) {
      var v = r.pick(['approx', 'approx', 'zero', 'cf2', 'conv', 'perp']), q, sol, ans, w;
      if (v === 'zero') {
        var N = r.pick([5, 8, 10, 12]), i = r.pick([0.05, 0.06, 0.08]);
        ans = N * (N + 1) / Math.pow(1 + i, 2);
        q = 'Hitung konveksitas (modifikasi) obligasi zero-coupon dengan jatuh tempo ' + N + ' tahun pada bunga efektif ' + pc(i, 0) + '.';
        sol = 'P = vⁿ, P″ = n(n + 1)v^{n+2}, jadi C = P″/P = n(n + 1)/(1 + i)² = ' + N + '·' + (N + 1) + '/' + n(Math.pow(1 + i, 2), 4) + ' = <b>' + n(ans, 3) + '</b>.';
        w = [N * N, N * (N + 1), N * (N + 1) / (1 + i), N * N / Math.pow(1 + i, 2)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      if (v === 'perp') {
        var ip = r.pick([0.04, 0.05, 0.08, 0.1]);
        ans = 2 / (ip * ip);
        q = 'Hitung konveksitas (modifikasi) perpetuitas-immediate level pada bunga efektif ' + pc(ip, 0) + '.';
        sol = 'P = 1/i, P′ = −1/i², P″ = 2/i³. C = P″/P = 2/i² = <b>' + n(ans, 2) + '</b>.';
        w = [1 / (ip * ip), 2 / ip, (1 + ip) / (ip * ip), 2 * (1 + ip) / (ip * ip)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
      }
      if (v === 'conv') {
        var Dm = r.pick([4.5, 6.2, 7.8, 8.4]), Cm = Math.round(Dm * Dm * r.pick([1.1, 1.2, 1.3]) * 10) / 10, ic = r.pick([0.05, 0.06, 0.07]);
        ans = (Cm + Dm) / Math.pow(1 + ic, 2);
        q = 'Sebuah obligasi memiliki durasi Macaulay ' + n(Dm, 1) + ' dan konveksitas Macaulay ' + n(Cm, 1) + ' pada bunga efektif ' + pc(ic, 0) + '. Tentukan konveksitas modifikasinya.';
        sol = 'C_mod = (C_Mac + D_Mac)/(1 + i)² = (' + n(Cm, 1) + ' + ' + n(Dm, 1) + ')/' + n(Math.pow(1 + ic, 2), 4) + ' = <b>' + n(ans, 3) + '</b>.';
        w = [Cm / Math.pow(1 + ic, 2), (Cm - Dm) / Math.pow(1 + ic, 2), (Cm + Dm) / (1 + ic), Cm / (1 + ic)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      if (v === 'cf2') {
        var c1 = r.pick([1000, 2000]), c2 = r.pick([3000, 4000, 5000]), t2 = r.pick([3, 4, 5]), y = r.pick([0.05, 0.06, 0.08]);
        var p1 = c1 * vv(y, 1), p2 = c2 * vv(y, t2), Pp = p1 + p2;
        ans = (2 * p1 + t2 * (t2 + 1) * p2) / Pp / Math.pow(1 + y, 2);
        var cmac = (p1 + t2 * t2 * p2) / Pp, dmac = (p1 + t2 * p2) / Pp;
        q = 'Investasi membayar ' + n(c1, 0) + ' di akhir tahun ke-1 dan ' + n(c2, 0) + ' di akhir tahun ke-' + t2 + '. Pada bunga efektif ' + pc(y, 0) + ', hitung konveksitas (modifikasi) investasi ini.';
        sol = 'PV₁ = ' + n(p1, 2) + ', PV₂ = ' + n(p2, 2) + ', P = ' + n(Pp, 2) + '. C = Σ t(t + 1)PVₜ / [P(1 + i)²] = (2·' + n(p1, 2) + ' + ' + (t2 * (t2 + 1)) + '·' + n(p2, 2) + ')/(' + n(Pp, 2) + '·' + n(Math.pow(1 + y, 2), 4) + ') = <b>' + n(ans, 3) + '</b>. (Cek: C_Mac = ' + n(cmac, 3) + ', D_Mac = ' + n(dmac, 3) + ', (C_Mac + D_Mac)/(1 + i)² memberi hasil yang sama.)';
        w = [cmac, (2 * p1 + t2 * (t2 + 1) * p2) / Pp, cmac / Math.pow(1 + y, 2), dmac * dmac];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var P = r.pick([1000, 1050, 980]), D = r.pick([5.3, 6.2, 4.8]), Cx = r.pick([210, 45, 60]), dy = r.pick([0.005, 0.01, -0.005]);
      var withC = r() < 0.7;
      ans = P * (1 - D * dy + (withC ? 0.5 * Cx * dy * dy : 0));
      q = 'Obligasi seharga ' + n(P, 0) + ' memiliki durasi termodifikasi ' + n(D, 1) + ' dan konveksitas ' + Cx + '. Imbal hasil ' + (dy > 0 ? 'naik' : 'turun') + ' ' + n(Math.abs(dy) * 100, 1) + ' poin persen. Estimasi harga baru ' + (withC ? 'dengan aturan durasi dan konveksitas' : 'dengan aproksimasi durasi orde pertama') + '.';
      sol = 'Δi = ' + n(dy, 3) + '. P ≈ ' + n(P, 0) + '[1 − ' + n(D, 1) + '·' + n(dy, 3) + (withC ? ' + ½·' + Cx + '·' + n(dy * dy, 6) : '') + '] = <b>' + n(ans, 2) + '</b>.';
      w = [P * (1 - D * dy + (withC ? 0 : 0.5 * Cx * dy * dy)), P * (1 + D * dy + 0.5 * Cx * dy * dy), P * (1 - D * dy - 0.5 * Cx * dy * dy), P * (1 - D * dy * 100)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'match', sec: 3, syl: '3.e', topic: 'Pencocokan arus kas & imunisasi', conf: 'Tinggi',
    src: 'Agu 2025 #3 & #23, Nov 2025 #25',
    fast: 'Exact matching dikerjakan dari jatuh tempo terjauh ke belakang: beli obligasi jatuh tempo terakhir sebanyak L_n/(nominal + kupon), lalu kurangi kupon yang diterima dari kewajiban sebelumnya. Untuk biaya total: Σ L_t/(1 + r_t)ᵗ.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var L1 = r.pick([100000, 2000, 3000]), L2 = r.pick([200000, 5000, 4000]), c = r.pick([0.05, 0.06, 0.08]);
        var uA = L2 / (100 * (1 + c)), uB = (L1 - uA * 100 * c) / 100, askA = r() < 0.5;
        ans = askA ? uA : uB;
        q = 'Perusahaan memiliki kewajiban ' + n(L1, 0) + ' dalam 1 tahun dan ' + n(L2, 0) + ' dalam 2 tahun, didanai dengan exact matching memakai: obligasi A (2 tahun, kupon tahunan ' + pc(c, 0) + ', nominal 100) dan obligasi B (zero-coupon 1 tahun, nominal 100). Pecahan obligasi diperbolehkan. Tentukan banyaknya obligasi ' + (askA ? 'A' : 'B') + ' yang dibeli.';
        sol = 'Tahun 2: A·100(1 + ' + n(c, 2) + ') = ' + n(L2, 0) + ' ⇒ A = ' + n(uA, 3) + '. Tahun 1: 100B + A·' + n(100 * c, 0) + ' = ' + n(L1, 0) + ' ⇒ B = ' + n(uB, 3) + '. Jawaban: <b>' + n(ans, 3) + '</b>.';
        w = askA ? [L2 / 100, (L2 - L1 * c) / 100, uA * (1 + c), uB] : [L1 / 100, uA, (L1 + uA * 100 * c) / 100, uB * 1.1];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var Ls = r.pick([[3000, 5000, 2000], [2000, 0, 5000], [1000, 4000, 3000]]), rs = r.pick([[0.05, 0.055, 0.06], [0.04, 0.045, 0.05], [0.06, 0.06, 0.065]]);
      ans = Ls[0] * vv(rs[0], 1) + Ls[1] * vv(rs[1], 2) + Ls[2] * vv(rs[2], 3);
      q = 'Kewajiban perusahaan: ' + Ls.map(function (x, k) { return n(x, 0) + ' di akhir tahun ke-' + (k + 1); }).join(', ') + '. Kewajiban dicocokkan dengan obligasi zero-coupon dengan imbal hasil efektif ' + rs.map(function (x, k) { return pc(x, 1) + ' (' + (k + 1) + ' tahun)'; }).join(', ') + '. Hitung biaya total untuk exact matching.';
      sol = 'Biaya = Σ Lₜ/(1 + rₜ)ᵗ = ' + Ls.map(function (x, k) { return n(x * vv(rs[k], k + 1), 2); }).join(' + ') + ' = <b>' + n(ans, 2) + '</b>.';
      w = [Ls[0] + Ls[1] + Ls[2], (Ls[0] + Ls[1] + Ls[2]) * vv(rs[2], 3), Ls[0] * vv(rs[0], 1) + Ls[1] * vv(rs[1], 1) + Ls[2] * vv(rs[2], 1), ans * 1.03];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'swap', sec: 3, syl: '3.b', topic: 'Swap suku bunga', conf: 'Sedang',
    src: 'Agu 2025 #27 & #28, Nov 2025 #27',
    fast: 'Swap rate R = (1 − P_n)/Σ P_k, dengan P_k = (1 + s_k)^{−k} harga zero. Untuk spot yang hilang, tuliskan persamaan R·ΣP_k + P_n = 1 lalu SOLVE untuk satu P yang tidak diketahui. Nilai R selalu berada di antara spot rate terkecil dan terbesar.',
    gen: function (r) {
      var sp = r.pick([[0.03, 0.04, 0.045, 0.05], [0.04, 0.045, 0.05, 0.052], [0.025, 0.035, 0.04, 0.05]]);
      var P = sp.map(function (s, k) { return vv(s, k + 1); }), sumP = P.reduce(function (a, b) { return a + b; }, 0);
      var R = (1 - P[3]) / sumP, q, sol, ans, w;
      if (r() < 0.5) {
        ans = R;
        q = 'Imbal hasil obligasi zero-coupon: 1 tahun ' + pc(sp[0], 1) + ', 2 tahun ' + pc(sp[1], 1) + ', 3 tahun ' + pc(sp[2], 1) + ', 4 tahun ' + pc(sp[3], 1) + '. Tentukan swap rate tetap tahunan untuk interest rate swap 4 tahun.';
        sol = 'Pₖ = (1 + sₖ)^{−k}: ' + P.map(function (x) { return n(x, 5); }).join(', ') + '. R = (1 − P₄)/ΣPₖ = ' + n(1 - P[3], 5) + '/' + n(sumP, 5) + ' = <b>' + pc(ans, 3) + '</b>.';
        w = [(sp[0] + sp[1] + sp[2] + sp[3]) / 4, sp[3], (1 - P[3]) / 4, (1 - P[3]) / (sumP - P[3])];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 3));
      }
      var Rr = +(R * 100).toFixed(2) / 100;
      ans = solve(function (s3) { var P3 = vv(s3, 3); return Rr * (P[0] + P[1] + P3 + P[3]) + P[3] - 1; }, 0.0, 0.2);
      q = 'Kurva hasil 4 tahun dengan satu nilai hilang: obligasi zero-coupon 1 tahun ' + pc(sp[0], 1) + ', 2 tahun ' + pc(sp[1], 1) + ', 3 tahun ?, 4 tahun ' + pc(sp[3], 1) + '. Swap rate tetap 4 tahun yang benar secara teori adalah ' + pc(Rr, 2) + '. Tentukan imbal hasil zero-coupon 3 tahun.';
      sol = 'R(P₁ + P₂ + P₃ + P₄) + P₄ = 1 ⇒ P₃ = (1 − P₄)/R − P₁ − P₂ − P₄ = ' + n((1 - P[3]) / Rr - P[0] - P[1] - P[3], 5) + ' ⇒ s₃ = P₃^{−1/3} − 1 = <b>' + pc(ans, 2) + '</b>.';
      w = [(sp[1] + sp[3]) / 2, Rr, sp[1] + 0.01, ans + 0.004];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  // ===== 4. Pengembalian pinjaman =====
  T.push({ id: 'amort', sec: 4, syl: '4.a, 4.b', topic: 'Jadwal amortisasi (pokok & bunga per cicilan)', conf: 'Tinggi',
    src: 'Mei 2025 #15–#17, Agu 2025 #15 & #16, Nov 2025 #10 & #16, Mei 2026 #19, Jul 2024 #18 & #21',
    fast: 'Untuk cicilan level, porsi pokok tumbuh geometrik: Pₖ = P₁(1 + i)^{k−1}. Jadi rasio dua porsi pokok langsung memberi (1 + i)^{selisih}. Bunga cicilan ke-k = R(1 − v^{n−k+1}). Ini selalu lebih cepat daripada membuat jadwal amortisasi.',
    gen: function (r) {
      var q, sol, ans, w, v = r.pick(['ratio', 'int', 'eq']);
      if (v === 'ratio') {
        var i = r.pick([0.025, 0.08, 0.06, 0.05]), a = r.pick([5, 20]), b = a + r.pick([5, 10]), P1 = r.pick([166.59, 120, 80]);
        var Pa = +(P1).toFixed(2), Pb = +(Pa * Math.pow(1 + i, b - a)).toFixed(2);
        ans = Math.pow(Pb / Pa, 1 / (b - a)) - 1;
        q = 'Pinjaman dibayar dengan cicilan tahunan tetap di setiap akhir tahun. Pokok yang dibayar pada cicilan ke-' + a + ' adalah ' + n(Pa, 2) + ' dan pada cicilan ke-' + b + ' adalah ' + n(Pb, 2) + '. Tentukan suku bunga pinjaman.';
        sol = 'Pokok tumbuh geometrik: (1 + i)^{' + (b - a) + '} = ' + n(Pb, 2) + '/' + n(Pa, 2) + ' ⇒ i = <b>' + pc(ans, 2) + '</b>.';
        w = [(Pb / Pa - 1) / (b - a), Math.pow(Pb / Pa, 1 / (b - a + 1)) - 1, Math.pow(Pb / Pa, 1 / b) - 1, ans * 1.5];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      if (v === 'int') {
        var N = 30, i2 = r.pick([0.07, 0.06, 0.08]), k1 = 10, k2 = 20, R = r.pick([700, 800, 1000]);
        var I1 = R * (1 - vv(i2, N - k1 + 1)), I2 = R * (1 - vv(i2, N - k2 + 1));
        ans = I2;
        q = 'Pinjaman dilunasi dengan cicilan tahunan tetap di akhir setiap tahun selama ' + N + ' tahun pada bunga ' + pc(i2, 0) + '. Bunga pada cicilan ke-' + k1 + ' adalah ' + n(I1, 2) + '. Tentukan bunga pada cicilan ke-' + k2 + '.';
        sol = 'Iₖ = R(1 − v^{n−k+1}) ⇒ R = ' + n(I1, 2) + '/(1 − v^{' + (N - k1 + 1) + '}) = ' + n(R, 2) + '. I₂₀ = R(1 − v^{' + (N - k2 + 1) + '}) = <b>' + n(ans, 2) + '</b>.';
        w = [I1 * vv(i2, k2 - k1), R - I1, R * (1 - vv(i2, N - k2)), I1 * (N - k2 + 1) / (N - k1 + 1)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
      }
      var N3 = 30, L = 100000, m = r.pick([21, 20, 16]), k3 = r.pick([10, 5]);
      var i3 = Math.pow(2, 1 / (N3 - m + 1)) - 1, R3 = L / an(i3, N3), Pk = R3 * vv(i3, N3 - k3 + 1);
      ans = Pk;
      q = 'Pinjaman ' + n(L, 0) + ' dilunasi dengan ' + N3 + ' cicilan tahunan tetap di akhir tahun. Pada cicilan ke-' + m + ', porsi pokok dan bunga sama besar. Hitung porsi pokok pada cicilan ke-' + k3 + '.';
      sol = 'Pokok = bunga ⇒ v^{' + (N3 - m + 1) + '} = 0,5 ⇒ i = ' + pc(i3, 4) + '. R = L/a_{' + N3 + '} = ' + n(R3, 2) + '. P_{' + k3 + '} = R·v^{' + (N3 - k3 + 1) + '} = <b>' + n(ans, 2) + '</b>.';
      w = [R3 / 2, R3 * vv(i3, N3 - k3), L / N3, R3 * vv(i3, N3 - m + 1) * vv(i3, m - k3) * 1.1];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'olb', sec: 4, syl: '4.b', topic: 'Sisa pinjaman & refinancing', conf: 'Tinggi',
    src: 'Jul 2024 #16 & #17, Agu 2025 #17, Nov 2025 #17 & #18, Mei 2026 #18',
    fast: 'Sisa pinjaman prospektif = cicilan × a_{sisa periode}, satu baris di kalkulator. Refinancing: hitung sisa pinjaman dengan bunga lama, lalu bagi dengan a_{tenor baru} pada bunga baru.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var L = r.pick([1000, 500, 800]) * 1e6, nom = r.pick([0.06, 0.08, 0.1]), Y = r.pick([5, 4]), tY = r.pick([2, 3]);
        var j = nom / 4, N = 4 * Y, R = L / an(j, N), OLB = R * an(j, N - 4 * tY);
        ans = OLB;
        q = 'Pinjaman KPR ' + n(L / 1e6, 0) + ' juta dicicil setiap akhir kuartal selama ' + Y + ' tahun pada bunga nominal ' + pc(nom, 0) + ' dikonversi kuartalan. Tentukan sisa pokok pinjaman di akhir tahun ke-' + tY + ' (dalam rupiah).';
        sol = 'j = ' + pc(j, 1) + '. R = L/a_{' + N + '} = ' + n(R, 0) + '. Sisa = R·a_{' + (N - 4 * tY) + '} = <b>' + n(ans, 0) + '</b>.';
        w = [L * (1 - tY / Y), L * Math.pow(1 + j, 4 * tY) - R * sn(j, 4 * tY) + R, R * an(j, N - 4 * tY + 1), L * (1 - tY / Y) * 1.05];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
      }
      var Price = r.pick([100000, 200000]), n1 = r.pick([0.075, 0.08]), n2 = r.pick([0.06, 0.065]), Y1 = 30, t1 = 10, Y2 = 15;
      var j1 = n1 / 12, j2 = n2 / 12, R1 = Price / an(j1, 12 * Y1), O = R1 * an(j1, 12 * (Y1 - t1)), R2 = O / an(j2, 12 * Y2);
      ans = R2;
      q = 'Rumah seharga ' + n(Price, 0) + ' dibiayai 30 tahun dengan cicilan bulanan tetap di akhir bulan pada bunga ' + pc(n1, 1) + ' dikonversi bulanan. Setelah 10 tahun, sisa pinjaman di-refinance untuk 15 tahun pada bunga ' + pc(n2, 1) + ' dikonversi bulanan. Tentukan cicilan bulanan yang baru.';
      sol = 'Cicilan lama = ' + n(R1, 2) + '. Sisa setelah 120 cicilan = R·a_{240|' + n(j1, 5) + '} = ' + n(O, 2) + '. Cicilan baru = ' + n(O, 2) + '/a_{180|' + n(j2, 5) + '} = <b>' + n(ans, 2) + '</b>.';
      w = [R1, O / an(j1, 180), Price / an(j2, 180), O / 180];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'sinking', sec: 4, syl: '4.c', topic: 'Metode sinking fund', conf: 'Tinggi',
    src: 'Jul 2024 #19 & #20, Agu 2025 #13, Mei 2026 #21',
    fast: 'Pembayaran total per periode = bunga ke pemberi pinjaman (L·i) + setoran sinking fund (L/s_{n|j}). Kalau yang ditanya i: i = (R − L/s_{n|j})/L. Setoran X selama 10 tahun lalu 2X selama 10 tahun = X(s₂₀ + s₁₀).',
    gen: function (r) {
      var q, sol, ans, w, v = r.pick(['pay', 'rate', 'step']);
      if (v === 'pay') {
        var L = r.pick([400, 300, 500]) * 1e6, i = r.pick([0.08, 0.07, 0.06]), j = r.pick([0.05, 0.04, 0.03]), N = r.pick([10, 15, 20]);
        ans = L * i + L / sn(j, N);
        q = 'Pinjaman ' + n(L / 1e6, 0) + ' juta selama ' + N + ' tahun pada bunga efektif ' + pc(i, 0) + ' dilunasi dengan metode sinking fund. Sinking fund menghasilkan bunga ' + pc(j, 0) + '. Hitung total pembayaran tahunan peminjam (bunga + setoran sinking fund).';
        sol = 'Total = L·i + L/s_{' + N + '|' + pc(j, 0) + '} = ' + n(L * i, 0) + ' + ' + n(L / sn(j, N), 0) + ' = <b>' + n(ans, 0) + '</b>.';
        w = [L / an(i, N), L * i + L / sn(i, N), L * j + L / sn(j, N), L / an(j, N)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
      }
      if (v === 'rate') {
        var L2 = 400, R2 = r.pick([36, 40, 38]), j2 = 0.03, N2 = 31;
        ans = (R2 - L2 / sn(j2, N2)) / L2;
        q = 'Pembayaran ' + R2 + ' juta dilakukan setiap tahun selama ' + N2 + ' tahun untuk melunasi pinjaman ' + L2 + ' juta dengan metode sinking fund pada bunga sinking fund efektif 3%. Tentukan tingkat bunga efektif yang diterima pemberi pinjaman.';
        sol = 'Setoran SF = ' + L2 + '/s_{' + N2 + '|3%} = ' + n(L2 / sn(j2, N2), 4) + '. Bunga ke pemberi pinjaman = ' + R2 + ' − ' + n(L2 / sn(j2, N2), 4) + ' ⇒ i = ' + n(R2 - L2 / sn(j2, N2), 4) + '/' + L2 + ' = <b>' + pc(ans, 2) + '</b>.';
        w = [R2 / L2, solve(function (x) { return L2 / an(x, N2) - R2; }, 0.0001, 0.5), (R2 - L2 / N2) / L2, ans + 0.003];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      var L3 = r.pick([65000, 50000, 80000]), j3 = r.pick([0.065, 0.05, 0.06]);
      ans = L3 / (sn(j3, 20) + sn(j3, 10));
      q = 'Seorang pria meminjam ' + n(L3, 0) + ' selama 20 tahun, membayar bunga tahunan ke pemberi pinjaman, dan menyetor ke sinking fund ' + pc(j3, 1) + ' untuk melunasi pokok. Setoran sinking fund X untuk 10 tahun pertama dan 2X untuk 10 tahun terakhir. Tentukan X.';
      sol = 'X·s₂₀ + X·s₁₀ = ' + n(L3, 0) + ' (setoran 2X = X selama 20 tahun + tambahan X selama 10 tahun terakhir). s₂₀ = ' + n(sn(j3, 20), 4) + ', s₁₀ = ' + n(sn(j3, 10), 4) + ' ⇒ X = <b>' + n(ans, 2) + '</b>.';
      w = [L3 / (sn(j3, 10) + 2 * sn(j3, 10)), L3 / (2 * sn(j3, 20)), L3 / 30, L3 / (sn(j3, 20) + sn(j3, 10) * Math.pow(1 + j3, 10))];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  // ===== 5. Obligasi =====
  T.push({ id: 'bprice', sec: 5, syl: '5.a, 5.d', topic: 'Harga obligasi', conf: 'Tinggi',
    src: 'Jul 2024 #24, Nov 2025 #23, Mei 2026 #22 & #23',
    fast: 'Harga = Fr·aₙ + C·vⁿ pada bunga per periode kupon. Kalau frekuensi yield berbeda dari kupon, konversi yield ke periode kupon dulu. Yield berubah di tengah jalan: hitung dua tahap dan diskontokan tahap kedua dengan v dari tahap pertama.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var F = 100, C = r.pick([100, 105, 110]), cp = r.pick([0.08, 0.07]), Y = 10, yq = r.pick([0.06, 0.07, 0.05]);
        var j = Math.pow(1 + yq / 4, 2) - 1;
        ans = F * cp / 2 * an(j, 2 * Y) + C * vv(j, 2 * Y);
        q = 'Obligasi tenor ' + Y + ' tahun, nilai par 100 juta, kupon tahunan ' + pc(cp, 0) + ' dibayar semesteran, nilai tebus ' + C + ' juta. Hitung harga beli pada bunga nominal ' + pc(yq, 0) + ' dikonversi kuartalan (dalam juta).';
        sol = 'Bunga per semester j = (1 + ' + n(yq / 4, 4) + ')² − 1 = ' + n(j, 6) + '. Harga = ' + n(F * cp / 2, 0) + '·a_{20|j} + ' + C + '·v^{20} = <b>' + n(ans, 3) + '</b>.';
        w = [F * cp / 2 * an(yq / 2, 2 * Y) + C * vv(yq / 2, 2 * Y), F * cp / 2 * an(j, 2 * Y) + F * vv(j, 2 * Y), F * cp * an(yq, Y) + C * vv(yq, Y), F * cp / 2 * an(j, 2 * Y) + C * vv(j, Y)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var F2 = 10000, cp2 = r.pick([0.03, 0.04]), y1 = r.pick([0.05, 0.045]), y2 = r.pick([0.07, 0.06]), m = 15;
      ans = F2 * cp2 * an(y1, m) + vv(y1, m) * (F2 * cp2 * an(y2, m) + F2 * vv(y2, m));
      q = 'Obligasi 30 tahun bernilai nominal 10.000 membayar kupon tahunan ' + pc(cp2, 0) + ' dan jatuh tempo pada nilai par. Obligasi dibeli untuk menghasilkan ' + pc(y1, 1) + ' selama 15 tahun pertama dan ' + pc(y2, 0) + ' setelahnya. Tentukan harganya.';
      sol = 'Harga = ' + n(F2 * cp2, 0) + '·a_{15|' + pc(y1, 1) + '} + v^{15}_{' + pc(y1, 1) + '}[' + n(F2 * cp2, 0) + '·a_{15|' + pc(y2, 0) + '} + 10.000·v^{15}_{' + pc(y2, 0) + '}] = <b>' + n(ans, 2) + '</b>.';
      w = [F2 * cp2 * an((y1 + y2) / 2, 30) + F2 * vv((y1 + y2) / 2, 30), F2 * cp2 * an(y1, 30) + F2 * vv(y1, 30), F2 * cp2 * an(y2, 30) + F2 * vv(y2, 30), F2 * cp2 * an(y1, m) + F2 * cp2 * an(y2, m) + F2 * vv(y2, 30)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'bamort', sec: 5, syl: '5.a, 5.e', topic: 'Amortisasi premi & nilai buku', conf: 'Tinggi',
    src: 'Agu 2025 #25, Mei 2025 #25, Nov 2025 #24',
    fast: 'Premi yang diamortisasi pada kupon ke-t = (Fr − Ci)·v^{n−t+1}. Diskonto yang terakumulasi memakai rumus yang sama dengan tanda dibalik. Nilai buku di t = Fr·a_{n−t} + C·v^{n−t}, yaitu harga obligasi sisa tenor.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.6) {
        var F = 1000, cp = r.pick([0.06, 0.07]), y = r.pick([0.056, 0.05, 0.065]), Y = 10, tq = r.pick([7, 5, 10]), N = 2 * Y;
        var fr = F * cp / 2, fi = F * y / 2, amt = (fr - fi) * vv(y / 2, N - tq + 1);
        var prem = fr > fi;
        ans = Math.abs(amt);
        q = 'Obligasi tenor ' + Y + ' tahun, nominal 1000, kupon semesteran ' + pc(cp, 0) + ' per tahun, dibeli dengan imbal hasil ' + pc(y, 1) + ' dikonversi semesteran. Tentukan besar ' + (prem ? 'premi yang diamortisasi' : 'diskonto yang terakumulasi') + ' pada periode ke-' + tq + '.';
        sol = '|Fr − Fj| = |' + n(fr, 2) + ' − ' + n(fi, 2) + '| = ' + n(Math.abs(fr - fi), 2) + '. Nilai pada periode ke-' + tq + ' = ' + n(Math.abs(fr - fi), 2) + '·v^{' + (N - tq + 1) + '} = <b>' + n(ans, 3) + '</b>.';
        w = [Math.abs(fr - fi), Math.abs(fr - fi) * vv(y / 2, N - tq), Math.abs(fr - fi) * vv(y / 2, tq), Math.abs(fr - fi) * vv(y / 2, N - tq + 1) * (1 + y / 2) * (1 + y / 2)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var cp2 = 0.08, i2 = r.pick([0.06, 0.065, 0.07]), N2 = r.pick([10, 12, 15]);
      var B = function (x, k) { return 1000 * cp2 * an(x, N2 - k) + 1000 * vv(x, N2 - k); };
      var B3 = +B(i2, 3).toFixed(2), B5 = +B(i2, 5).toFixed(2);
      ans = solve(function (x) { return B(x, 3) - B3; }, 0.001, 0.2);
      q = 'Obligasi nominal 1000 dengan kupon tahunan 8% memiliki tingkat hasil efektif tahunan i. Nilai buku di akhir tahun ke-3 adalah ' + n(B3, 2) + ' dan di akhir tahun ke-5 adalah ' + n(B5, 2) + '. Tentukan i.';
      sol = 'Rekursi nilai buku: B₅ = B₃(1 + i)² − 80(1 + i) − 80, atau cari i dengan SOLVE pada B₃ = 80·a_{n−3} + 1000·v^{n−3}. Hasil: i = <b>' + pc(ans, 2) + '</b>.';
      w = [ans + 0.005, ans - 0.004, 0.08 - (B3 - 1000) / 1000 / (N2 - 3), (B3 - B5) / 2 / B5 + 0.05];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  T.push({ id: 'callable', sec: 5, syl: '5.b, 5.e', topic: 'Obligasi callable (yield minimum)', conf: 'Tinggi',
    src: 'Mei 2025 #26, Agu 2025 #26, Nov 2025 #26',
    fast: 'Aturan cepat: kalau kupon > yield (obligasi premi), skenario terburuk investor adalah call tercepat; kalau kupon < yield (diskonto), skenario terburuk adalah jatuh tempo. Hitung harga hanya di tanggal tersebut. Ketika X yang dicari: P = X(r·a_t + v_t), lalu X = P/(r·a_t + v_t).',
    gen: function (r) {
      var Y = r.pick([8, 10, 15]), first = r.pick([5, 6, 10]); if (first >= Y) first = Y - 2;
      var cp = r.pick([0.06, 0.05, 0.075]), y = r.pick([0.05, 0.04, 0.068]), P = r.pick([1050, 2345, 1100]);
      if (cp <= y) y = cp - 0.01;
      var j = y / 2, cr = cp / 2, t1 = 2 * first;
      var ans = P / (cr * an(j, t1) + vv(j, t1));
      var q = 'Obligasi tenor ' + Y + ' tahun dengan kupon semesteran ' + pc(cp, 1) + ' per tahun dihargai ' + n(P, 0) + '. Obligasi dapat dipanggil (callable) pada nilai par X di setiap tanggal kupon mulai akhir tahun ke-' + first + '. Harga tersebut menjamin imbal hasil minimal ' + pc(y, 1) + ' dikonversi semesteran. Tentukan X.';
      var sol = 'Kupon ' + pc(cr, 2) + ' > yield ' + pc(j, 2) + ' per semester ⇒ obligasi premi ⇒ skenario terburuk adalah call tercepat (periode ke-' + t1 + '). ' + n(P, 0) + ' = X(' + n(cr, 4) + '·a_{' + t1 + '} + v^{' + t1 + '}) = X·' + n(cr * an(j, t1) + vv(j, t1), 5) + ' ⇒ X = <b>' + n(ans, 2) + '</b>.';
      var w = [P / (cr * an(j, 2 * Y) + vv(j, 2 * Y)), P / (cr * an(j, t1 + 1) + vv(j, t1 + 1)), P / (cp * an(y, first) + vv(y, first)), P / (1 + (cr - j) * an(j, t1))];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  T.push({ id: 'reinvest', sec: 5, syl: '5.a, 1.f', topic: 'Imbal hasil dengan reinvestasi kupon', conf: 'Tinggi',
    src: 'Mei 2025 #23 & #24, Agu 2025 #7 & #10, Mei 2026 #24',
    fast: 'Langkah tetap: (1) harga beli P pada yield pembelian; (2) nilai akhir = kupon·s_{n|j reinvestasi} + nilai tebus; (3) yield = (nilai akhir/P)^{1/n} − 1 per periode, lalu konversi ke bentuk yang diminta. Simpan P di memori A dan nilai akhir di B.',
    gen: function (r) {
      var Y = r.pick([5, 10]), cp = r.pick([0.08, 0.07, 0.075]), yb = r.pick([0.075, 0.07, 0.065]), jr = r.pick([0.07, 0.06, 0.068]);
      var N = 2 * Y, P = 1000 * cp / 2 * an(yb / 2, N) + 1000 * vv(yb / 2, N), AV = 1000 * cp / 2 * sn(jr / 2, N) + 1000;
      var per = Math.pow(AV / P, 1 / N) - 1, effAnnual = r() < 0.5, ans = effAnnual ? Math.pow(1 + per, 2) - 1 : 2 * per;
      var q = 'Violet membeli obligasi tenor ' + Y + ' tahun, nominal 1000, kupon semesteran ' + pc(cp, 1) + ' per tahun, dengan imbal hasil ' + pc(yb, 1) + ' dikonversi semesteran. Kupon diinvestasikan kembali pada bunga nominal ' + pc(jr, 1) + ' dikonversi semesteran. Tentukan imbal hasil yang direalisasikan sebagai ' + (effAnnual ? 'bunga efektif tahunan' : 'bunga nominal tahunan dikonversi semesteran') + '.';
      var sol = 'P = ' + n(P, 3) + '. Nilai akhir = ' + n(1000 * cp / 2, 2) + '·s_{' + N + '|' + n(jr / 2, 4) + '} + 1000 = ' + n(AV, 3) + '. Per semester: (' + n(AV, 3) + '/' + n(P, 3) + ')^{1/' + N + '} − 1 = ' + n(per, 6) + ' ⇒ <b>' + pc(ans, 3) + '</b>.';
      var w = [effAnnual ? 2 * per : Math.pow(1 + per, 2) - 1, yb, jr, effAnnual ? Math.pow(AV / 1000, 1 / Y) - 1 : 2 * (Math.pow(AV / 1000, 1 / N) - 1)];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 3));
    } });

  // ===== 6. Derivatif =====
  T.push({ id: 'pcp', sec: 6, syl: '6.a, 6.b', topic: 'Put-call parity', conf: 'Tinggi',
    src: 'Mei 2025 #28 & #29, Nov 2025 #28, Mei 2026 #25',
    fast: 'C − P = S·e^{−δT} − K·e^{−rT}. Tulis rumus ini dulu, lalu isolasi variabel yang ditanya. Tanpa dividen δ = 0. Jika C − P diberikan langsung (misalnya “call lebih mahal 15”), tidak perlu tahu C dan P masing-masing.',
    gen: function (r) {
      var v = r.pick(['put', 'strike', 'rate']), q, sol, ans, w;
      if (v === 'put') {
        var S = r.pick([100, 50, 80]), K = r.pick([95, 45, 85]), rr = r.pick([0.05, 0.04]), T2 = r.pick([0.5, 1]), C = r.pick([8, 6, 7.5]);
        if (S === 50) K = 45; if (S === 80) K = 85; if (S === 100) K = 95;
        ans = C - S + K * Math.exp(-rr * T2);
        q = 'Saham tanpa dividen diperdagangkan pada ' + S + '. Bunga bebas risiko kontinu ' + pc(rr, 0) + ' per tahun. Opsi call dan put Eropa dengan strike ' + K + ' dan jatuh tempo ' + (T2 === 0.5 ? '6 bulan' : '1 tahun') + ' diperdagangkan, premi call ' + n(C, 2) + '. Tanpa peluang arbitrase, tentukan harga put.';
        sol = 'P = C − S + K·e^{−rT} = ' + n(C, 2) + ' − ' + S + ' + ' + K + '·e^{−' + n(rr * T2, 3) + '} = <b>' + n(ans, 3) + '</b>.';
        w = [C - S + K, C + S - K * Math.exp(-rr * T2), C - S + K * Math.exp(rr * T2), S - K * Math.exp(-rr * T2) - C];
      } else if (v === 'strike') {
        var S2 = 85, d2 = 0.02, r2 = 0.04, T3 = 0.5, C2 = 4.91, P2 = 4.56;
        S2 = r.pick([85, 100]); C2 = r.pick([4.91, 6.2]); P2 = r.pick([4.56, 5.1]);
        ans = (S2 * Math.exp(-d2 * T3) - (C2 - P2)) * Math.exp(r2 * T3);
        q = 'Harga saham ' + S2 + ', dividen kontinu δ = 0,02, bunga bebas risiko r = 0,04. Opsi call dan put dengan strike sama dan T = 0,5 memiliki premi ' + n(C2, 2) + ' dan ' + n(P2, 2) + '. Tentukan strike-nya.';
        sol = 'K·e^{−rT} = S·e^{−δT} − (C − P) = ' + n(S2 * Math.exp(-d2 * T3), 4) + ' − ' + n(C2 - P2, 2) + ' ⇒ K = ' + n(S2 * Math.exp(-d2 * T3) - (C2 - P2), 4) + '·e^{0,02} = <b>' + n(ans, 3) + '</b>.';
        w = [(S2 - (C2 - P2)) * Math.exp(r2 * T3), S2 * Math.exp(-d2 * T3) - (C2 - P2), (S2 * Math.exp(-d2 * T3) + (C2 - P2)) * Math.exp(r2 * T3), (S2 - (C2 - P2)) * Math.exp((r2 - d2) * T3)];
      } else {
        var S3 = r.pick([6000, 5000]), K3 = r.pick([7000, 6000]), diff = r.pick([15, 25]), T4 = r.pick([4, 2]);
        if (K3 <= S3) K3 = S3 + 1000;
        ans = -Math.log((S3 - diff) / K3) / T4;
        q = 'Opsi call Eropa lebih mahal ' + diff + ' daripada opsi put Eropa dengan strike ' + n(K3, 0) + ' dan jatuh tempo ' + T4 + ' tahun pada saham tanpa dividen seharga ' + n(S3, 0) + '. Tentukan tingkat bunga bebas risiko kontinu r.';
        sol = 'C − P = S − K·e^{−rT} ⇒ e^{−' + T4 + 'r} = (' + n(S3, 0) + ' − ' + diff + ')/' + n(K3, 0) + ' ⇒ r = <b>' + pc(ans, 3) + '</b>.';
        w = [Math.log(K3 / S3) / T4, -Math.log((S3 + diff) / K3) / T4, (K3 / (S3 - diff) - 1) / T4, Math.pow(K3 / (S3 - diff), 1 / T4) - 1];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 3));
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });

  T.push({ id: 'forward', sec: 6, syl: '6.c, 6.d', topic: 'Forward & prepaid forward', conf: 'Tinggi',
    src: 'Agu 2025 #29, Nov 2025 #29, Jul 2024 #27, Mei 2026 #26',
    fast: 'F^P = S·e^{−δT} (dividen kontinu) atau S − PV(dividen) (diskret); F = F^P·e^{rT}. Payoff long forward = S_T − F, short = F − S_T. Jumlah long + short dengan harga forward berbeda tidak bergantung pada S_T.',
    gen: function (r) {
      var v = r.pick(['diff', 'disc', 'payoff']), q, sol, ans, w;
      if (v === 'diff') {
        var S = r.pick([40, 50, 100]), rr = r.pick([0.025, 0.04, 0.05]), d = r.pick([0.01, 0.02]), T2 = r.pick([0.5, 1]);
        var FP = S * Math.exp(-d * T2), F = S * Math.exp((rr - d) * T2);
        ans = F - FP;
        q = 'Harga saham saat ini ' + S + ', bunga kontinu tahunan r = ' + n(rr, 3) + ', dan imbal hasil dividen δ = ' + n(d, 2) + '. Untuk kontrak dengan jatuh tempo T = ' + n(T2, 1) + ', tentukan selisih harga forward dan harga prepaid forward.';
        sol = 'F^P = ' + S + '·e^{−' + n(d * T2, 3) + '} = ' + n(FP, 4) + '; F = F^P·e^{' + n(rr * T2, 4) + '} = ' + n(F, 4) + '. Selisih = <b>' + n(ans, 4) + '</b>.';
        w = [S * (Math.exp(rr * T2) - 1), S * Math.exp((rr - d) * T2) - S, F - S * Math.exp(-rr * T2), S * (rr - d) * T2 * 0.5];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 4));
      }
      if (v === 'disc') {
        var S2 = r.pick([50, 100]), rr2 = r.pick([0.06, 0.08]), D = r.pick([1, 2]), T3 = 1;
        var pvD = D * Math.exp(-rr2 * 0.25) + D * Math.exp(-rr2 * 0.75);
        ans = (S2 - pvD) * Math.exp(rr2 * T3);
        q = 'Saham seharga ' + S2 + ' membayar dividen ' + D + ' pada 3 bulan dan 9 bulan dari sekarang. Bunga bebas risiko kontinu ' + pc(rr2, 0) + '. Tentukan harga forward 1 tahun.';
        sol = 'PV dividen = ' + D + 'e^{−' + n(rr2 * 0.25, 3) + '} + ' + D + 'e^{−' + n(rr2 * 0.75, 3) + '} = ' + n(pvD, 4) + '. F = (' + S2 + ' − ' + n(pvD, 4) + ')e^{' + n(rr2, 2) + '} = <b>' + n(ans, 3) + '</b>.';
        w = [S2 * Math.exp(rr2), S2 * Math.exp(rr2) - 2 * D, S2 - pvD, (S2 - 2 * D) * Math.exp(rr2)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      var F1 = r.pick([100, 90]), F2 = r.pick([120, 110, 115]), ST = r.pick([130, 105, 80]);
      ans = (ST - F1) + (F2 - ST);
      q = 'Julian mengambil long forward 6 bulan dengan forward price ' + F1 + ' juta. Septian mengambil short forward 6 bulan dengan forward price ' + F2 + ' juta. Spot price saat jatuh tempo ' + ST + ' juta. Jika X adalah jumlah payoff Julian dan Septian, tentukan X (juta).';
      sol = 'Long: ' + ST + ' − ' + F1 + ' = ' + (ST - F1) + '. Short: ' + F2 + ' − ' + ST + ' = ' + (F2 - ST) + '. X = ' + F2 + ' − ' + F1 + ' = <b>' + ans + '</b> (tidak bergantung pada harga spot).';
      w = [(ST - F1) - (F2 - ST), ST - F1, F2 - ST, F1 + F2 - 2 * ST + 10];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
    } });

  T.push({ id: 'spread', sec: 6, syl: '6.e', topic: 'Strategi opsi (spread, straddle)', conf: 'Sedang',
    src: 'Mei 2026 #27, Nov 2025 #20, Jul 2024 #29',
    fast: 'Profit = payoff saat jatuh tempo − (biaya premi bersih, diakumulasi dengan bunga jika diminta). Bull call spread: payoff = min(max(S − K₁, 0), K₂ − K₁). Straddle: |S − K|. Gambar payoff di 3 titik (di bawah K₁, di antara, di atas K₂) untuk mengecek.',
    gen: function (r) {
      var v = r.pick(['bull', 'bear', 'straddle']), q, sol, ans, w;
      if (v === 'bull') {
        var K1 = r.pick([250, 40, 100]), gap = r.pick([150, 10, 20]), K2 = K1 + (K1 === 250 ? 150 : gap), c1 = r.pick([40, 6, 12]), c2 = r.pick([25, 2.5, 5]);
        if (K1 === 250) { c1 = 40; c2 = 25; }
        var ST = K1 === 250 ? r.pick([500, 300, 200]) : K1 + r.pick([-5, 5, gap + 10]);
        var pay = Math.min(Math.max(ST - K1, 0), K2 - K1);
        ans = pay - (c1 - c2);
        q = 'Bull call spread: membeli call strike ' + K1 + ' seharga ' + c1 + ' dan menjual call strike ' + K2 + ' seharga ' + c2 + ' (jatuh tempo sama). Harga saham saat jatuh tempo ' + ST + '. Abaikan bunga dan biaya transaksi. Hitung laba bersih per lembar.';
        sol = 'Payoff = min(max(' + ST + ' − ' + K1 + ', 0), ' + (K2 - K1) + ') = ' + pay + '. Biaya bersih = ' + c1 + ' − ' + c2 + ' = ' + (c1 - c2) + '. Laba = <b>' + n(ans, 2) + '</b>.';
        w = [Math.max(ST - K1, 0) - (c1 - c2), pay, pay - (c1 + c2), Math.max(ST - K1, 0) - c1];
      } else if (v === 'bear') {
        var K1b = r.pick([40, 50]), K2b = K1b + 5, p1 = r.pick([1.5, 2]), p2 = r.pick([4, 5]), STb = K1b + r.pick([-3, 2, 8]);
        var payb = Math.max(K2b - STb, 0) - Math.max(K1b - STb, 0);
        ans = payb - (p2 - p1);
        q = 'Bear put spread: membeli put strike ' + K2b + ' seharga ' + p2 + ' dan menjual put strike ' + K1b + ' seharga ' + p1 + '. Harga saham saat jatuh tempo ' + STb + '. Abaikan bunga. Hitung laba bersih.';
        sol = 'Payoff = max(' + K2b + ' − S, 0) − max(' + K1b + ' − S, 0) = ' + payb + '. Biaya bersih = ' + n(p2 - p1, 2) + '. Laba = <b>' + n(ans, 2) + '</b>.';
        w = [payb, payb - (p2 + p1), Math.max(K2b - STb, 0) - p2, -(p2 - p1)];
      } else {
        var K = r.pick([50, 100]), c = r.pick([5, 6]), p = r.pick([4, 3]), STs = K + r.pick([-15, 3, 12]), rr = 0.05;
        ans = Math.abs(STs - K) - (c + p) * Math.exp(rr);
        q = 'Investor membeli straddle 1 tahun strike ' + K + ' dengan premi call ' + c + ' dan premi put ' + p + '. Bunga bebas risiko kontinu 5%. Harga saham saat jatuh tempo ' + STs + '. Hitung profitnya.';
        sol = 'Payoff = |S − K| = ' + Math.abs(STs - K) + '. FV premi = (' + c + ' + ' + p + ')e^{0,05} = ' + n((c + p) * Math.exp(rr), 4) + '. Profit = <b>' + n(ans, 3) + '</b>.';
        w = [Math.abs(STs - K) - (c + p), Math.abs(STs - K), Math.max(STs - K, 0) - c * Math.exp(rr), Math.abs(STs - K) - (c - p) * Math.exp(rr)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  // ===== 7. Portofolio =====
  T.push({ id: 'beta', sec: 7, syl: '7.a, 7.b', topic: 'Beta portofolio', conf: 'Tinggi',
    src: 'Agu 2025 #30, Nov 2025 #30 (soal sama, angka beda)',
    fast: 'Beta portofolio = Σ wₖβₖ, dan aset bebas risiko punya beta 0. “Risiko sama dengan pasar” berarti β = 1. Selesaikan untuk bobot C, lalu sisanya masuk ke aset bebas risiko. Soal ini sudah 2 kali keluar.',
    gen: function (r) {
      var tot = 1e6, A = r.pick([195000, 200000, 150000]), B = r.pick([340000, 300000, 350000]), bA = r.pick([0.9, 0.8, 0.85]), bB = r.pick([1.15, 1.2, 1.1]), bC = r.pick([1.29, 1.4, 1.35]);
      var xC = (1 - (A * bA + B * bB) / tot) * tot / bC, rf = tot - A - B - xC, askC = r() < 0.5;
      var ans = askC ? xC : rf;
      var q = 'Amel ingin membentuk portofolio dengan risiko sama dengan pasar menggunakan dana ' + n(tot, 0) + '. Ia berinvestasi ' + n(A, 0) + ' di saham A (beta ' + n(bA, 2) + ') dan ' + n(B, 0) + ' di saham B (beta ' + n(bB, 2) + '). Sisanya dibagi antara saham C (beta ' + n(bC, 2) + ') dan aset bebas risiko. Berapa yang diinvestasikan di ' + (askC ? 'saham C' : 'aset bebas risiko') + '?';
      var sol = 'Syarat β = 1: (' + n(A, 0) + '·' + n(bA, 2) + ' + ' + n(B, 0) + '·' + n(bB, 2) + ' + ' + n(bC, 2) + 'x)/1.000.000 = 1 ⇒ x_C = ' + n(xC, 0) + '. Bebas risiko = 1.000.000 − ' + n(A, 0) + ' − ' + n(B, 0) + ' − ' + n(xC, 0) + ' = ' + n(rf, 0) + '. Jawaban: <b>' + n(ans, 0) + '</b>.';
      var w = askC ? [tot - A - B, rf, (tot - A * bA - B * bB) , xC * bC] : [xC, tot - A - B, 0, rf + 20000];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
    } });

  T.push({ id: 'capm', sec: 7, syl: '7.a, 7.b', topic: 'CAPM', conf: 'Sedang',
    src: 'Mei 2026 #28 & #29',
    fast: 'E[R] = r_f + β(E[R_M] − r_f) dengan β = Cov(R, R_M)/Var(R_M). Jika pasar = 0,5A + 0,5B: Cov(A, M) = 0,5σ_A² + 0,5ρσ_Aσ_B dan Var(M) = 0,25σ_A² + 0,25σ_B² + 0,5ρσ_Aσ_B.',
    gen: function (r) {
      var q, sol, ans, w;
      if (r() < 0.5) {
        var rf = r.pick([0.02, 0.03, 0.05]), rm = r.pick([0.1, 0.11, 0.12]), b = r.pick([0.8, 1.2, 1.5]);
        ans = rf + b * (rm - rf);
        q = 'Menurut CAPM, dengan suku bunga bebas risiko ' + pc(rf, 0) + ', ekspektasi imbal hasil pasar ' + pc(rm, 0) + ', dan beta saham ' + n(b, 1) + ', tentukan ekspektasi imbal hasil saham.';
        sol = 'E[R] = ' + pc(rf, 0) + ' + ' + n(b, 1) + '(' + pc(rm, 0) + ' − ' + pc(rf, 0) + ') = <b>' + pc(ans, 2) + '</b>.';
        w = [b * rm, rf + b * rm, rm + b * (rm - rf), (rf + rm) / 2 * b];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      var rm2 = r.pick([0.11, 0.1]), sA = 0.2, sB = r.pick([0.4, 0.3]), rho = r.pick([0.75, 0.5]), rf2 = 0.02;
      var cov = 0.5 * sA * sA + 0.5 * rho * sA * sB, vM = 0.25 * sA * sA + 0.25 * sB * sB + 0.5 * rho * sA * sB, bA2 = cov / vM;
      ans = rf2 + bA2 * (rm2 - rf2);
      q = 'Pasar hanya berisi aset berisiko A dan B dengan kapitalisasi sama (M = 0,5A + 0,5B) dan aset bebas risiko. E[r_M] = ' + pc(rm2, 0) + ', σ_A = 20%, σ_B = ' + pc(sB, 0) + ', ρ_AB = ' + n(rho, 2) + ', r_f = 2%. Dengan CAPM, tentukan E[r_A].';
      sol = 'Cov(A, M) = 0,5·0,04 + 0,5·' + n(rho, 2) + '·0,2·' + n(sB, 1) + ' = ' + n(cov, 4) + '; Var(M) = ' + n(vM, 4) + ' ⇒ β_A = ' + n(bA2, 4) + '. E[r_A] = 2% + ' + n(bA2, 4) + '(' + pc(rm2, 0) + ' − 2%) = <b>' + pc(ans, 2) + '</b>.';
      w = [rf2 + (sA / Math.sqrt(vM)) * (rm2 - rf2), rf2 + 0.5 * (rm2 - rf2), rf2 + (sA * sA / vM) * (rm2 - rf2), rm2];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  T.push({ id: 'pvar', sec: 7, syl: '7.c', topic: 'Risiko & imbal hasil portofolio', conf: 'Sedang',
    src: 'Mei 2026 #30, Jul 2024 #30, Mei 2025 #30',
    fast: 'Var portofolio = wᵀΣw = Σwₖ²σₖ² + 2Σwₖwⱼσₖⱼ. Jangan lupa faktor 2 untuk kovarians. Dari tabel keadaan ekonomi: E = Σpₖrₖ, Var = Σpₖrₖ² − E². ROI = (harga jual + dividen − harga beli)/harga beli.',
    gen: function (r) {
      var v = r.pick(['two', 'state', 'roi']), q, sol, ans, w;
      if (v === 'two') {
        var wA = r.pick([0.4, 0.5, 0.6]), sA = r.pick([0.6, 0.2, 0.3]), sB = r.pick([0.35, 0.15, 0.25]), rho = r.pick([0.4, 0.2, -0.3]);
        var vP = wA * wA * sA * sA + (1 - wA) * (1 - wA) * sB * sB + 2 * wA * (1 - wA) * rho * sA * sB;
        ans = Math.sqrt(vP);
        q = 'Portofolio berisi ' + pc(wA, 0) + ' reksa dana A (σ = ' + pc(sA, 0) + ') dan ' + pc(1 - wA, 0) + ' reksa dana B (σ = ' + pc(sB, 0) + '), dengan korelasi ' + n(rho, 1) + '. Hitung deviasi standar imbal hasil portofolio.';
        sol = 'Var = ' + n(wA, 1) + '²·' + n(sA, 2) + '² + ' + n(1 - wA, 1) + '²·' + n(sB, 2) + '² + 2·' + n(wA, 1) + '·' + n(1 - wA, 1) + '·' + n(rho, 1) + '·' + n(sA, 2) + '·' + n(sB, 2) + ' = ' + n(vP, 5) + ' ⇒ σ = <b>' + pc(ans, 2) + '</b>.';
        w = [wA * sA + (1 - wA) * sB, Math.sqrt(wA * wA * sA * sA + (1 - wA) * (1 - wA) * sB * sB), Math.sqrt(vP + wA * (1 - wA) * rho * sA * sB), vP];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      if (v === 'state') {
        var p = r.pick([[0.3, 0.5, 0.2], [0.25, 0.5, 0.25], [0.2, 0.6, 0.2]]), rs = r.pick([[-0.05, 0.1, 0.25], [-0.1, 0.08, 0.2], [0, 0.06, 0.15]]);
        var E = p[0] * rs[0] + p[1] * rs[1] + p[2] * rs[2], E2 = p[0] * rs[0] * rs[0] + p[1] * rs[1] * rs[1] + p[2] * rs[2] * rs[2];
        ans = Math.sqrt(E2 - E * E);
        q = 'Imbal hasil saham A di tiga keadaan ekonomi: resesi (peluang ' + n(p[0], 2) + ') ' + pc(rs[0], 0) + ', normal (peluang ' + n(p[1], 2) + ') ' + pc(rs[1], 0) + ', ekspansi (peluang ' + n(p[2], 2) + ') ' + pc(rs[2], 0) + '. Hitung deviasi standar imbal hasilnya.';
        sol = 'E = ' + pc(E, 2) + ', E[R²] = ' + n(E2, 5) + '. σ = √(' + n(E2, 5) + ' − ' + n(E, 4) + '²) = <b>' + pc(ans, 2) + '</b>.';
        w = [Math.sqrt(E2), E, Math.sqrt((rs[0] * rs[0] + rs[1] * rs[1] + rs[2] * rs[2]) / 3 - E * E), E2 - E * E];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      var lot = r.pick([200, 100, 500]), buy = r.pick([2450, 1800, 3200]), dv = r.pick([120, 90, 150]), sell = r.pick([2680, 2000, 3500]);
      ans = (sell + dv - buy) / buy;
      q = 'Di awal tahun Elfita membeli ' + lot + ' lembar saham seharga Rp' + n(buy, 0) + ' per lembar. Di akhir tahun saham membagikan dividen tunai Rp' + dv + ' per lembar dan harganya Rp' + n(sell, 0) + '. Jika seluruh saham dijual di akhir tahun, tentukan ROI-nya.';
      sol = 'ROI = (' + n(sell, 0) + ' + ' + dv + ' − ' + n(buy, 0) + ')/' + n(buy, 0) + ' = <b>' + pc(ans, 2) + '</b> (jumlah lembar tidak berpengaruh).';
      w = [(sell - buy) / buy, (sell + dv - buy) / sell, dv / buy, (sell - dv - buy) / buy];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  // ---------- Komposisi paket sesuai Silabus PAI 2024 (CF1) ----------
  var SECTIONS = [
    { no: 1, name: 'Nilai waktu dari uang', range: '10–20%' },
    { no: 2, name: 'Anuitas & nilai arus kas', range: '20–30%' },
    { no: 3, name: 'Struktur jangka waktu suku bunga', range: '20–30%' },
    { no: 4, name: 'Pengembalian pinjaman', range: '5–15%' },
    { no: 5, name: 'Model penentuan harga obligasi', range: '10–20%' },
    { no: 6, name: 'Produk derivatif', range: '5–15%' },
    { no: 7, name: 'Matematika keuangan untuk portofolio', range: '5–15%' }
  ];
  var P = T; // urutan template = urutan bagian silabus (4/7/6/3/4/3/3 soal)

  // ---------- Pola SOA Exam FM yang belum dipakai PAI ----------
  var S = [];
  function soa(o) { o.conf = 'SOA'; S.push(o); }
  soa({ id: 'f_infl', sec: 1, syl: '1.d', topic: 'Bunga riil & inflasi', src: 'Pola SOA Exam FM (inflasi)',
    fast: 'Bunga riil: 1 + i_riil = (1 + i)/(1 + r). Jangan pakai i − r (hanya aproksimasi). Arus kas yang naik mengikuti inflasi dan didiskontokan dengan bunga nominal = arus kas tetap yang didiskontokan dengan bunga riil.',
    gen: function (r) {
      var i = r.pick([0.08, 0.1, 0.07]), inf = r.pick([0.03, 0.04, 0.05]), N = r.pick([10, 15, 20]), P = r.pick([1000, 500]);
      var j = (1 + i) / (1 + inf) - 1, ans = P * an(j, N);
      var q = 'Pembayaran tahunan dimulai ' + P + ' di akhir tahun pertama dan naik mengikuti inflasi ' + pc(inf, 0) + ' per tahun, selama ' + N + ' tahun. Bunga nominal efektif ' + pc(i, 0) + '. Hitung nilai sekarangnya.';
      var sol = 'Pembayaran ke-k = ' + P + '(1 + r)^{k−1}. PV = [' + P + '/(1 + r)]·a_{' + N + '|j} dengan 1 + j = ' + n(1 + i, 2) + '/' + n(1 + inf, 2) + ' ⇒ ini sama dengan rumus anuitas geometrik: <b>' + n(geoPV(P, inf, i, N), 2) + '</b>.';
      ans = geoPV(P, inf, i, N);
      return Object.assign({ q: q, sol: sol }, money(r, ans, [P * an(i - inf, N), P * an(i, N), P * an(j, N), P * an(j, N) * (1 + inf)], 2));
    } });
  soa({ id: 'f_force', sec: 1, syl: '1.b, 1.e', topic: 'Force of interest yang berubah', src: 'Pola SOA Exam FM (δₜ = k/(a + t))',
    fast: 'Untuk δₜ = k/(a + t): faktor akumulasi dari t₁ ke t₂ = ((a + t₂)/(a + t₁))ᵏ, karena ∫ k/(a + t) dt = k ln(a + t). Ini menghindari integral eksponensial.',
    gen: function (r) {
      var k = r.pick([2, 3]), a = r.pick([10, 20]), t1 = r.pick([0, 2, 5]), t2 = t1 + r.pick([5, 10]), X = r.pick([100, 1000]);
      var ans = X * Math.pow((a + t2) / (a + t1), k);
      var q = 'Dana berakumulasi dengan force of interest \\(\\delta_t = \\dfrac{' + k + '}{' + a + ' + t}\\). Sebesar ' + X + ' disetor pada t = ' + t1 + '. Hitung nilai dana pada t = ' + t2 + '.';
      var sol = 'Faktor = exp∫_{' + t1 + '}^{' + t2 + '} ' + k + '/(' + a + ' + t) dt = ((' + a + ' + ' + t2 + ')/(' + a + ' + ' + t1 + '))^' + k + '. Nilai = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [X * Math.exp(k * (t2 - t1) / (a + t1)), X * (a + t2) / (a + t1), X * Math.pow((a + t2) / (a + t1), k + 1), X * Math.exp(k * (t2 - t1) / (a + t2))], 2));
    } });
  soa({ id: 'f_simp', sec: 1, syl: '1.e', topic: 'Bunga sederhana vs majemuk', src: 'Pola SOA Exam FM (perbandingan akumulasi)',
    fast: 'Samakan 1 + s·t dengan (1 + i)ᵗ lalu SOLVE dengan tebakan awal besar (akar t = 0 selalu ada). Untuk “bunga tahun ke-k”: majemuk = i(1 + i)^{k−1}, sederhana selalu = s.',
    gen: function (r) {
      var s = r.pick([0.08, 0.1, 0.06]), i = r.pick([0.05, 0.06, 0.04]); if (i >= s) i = s - 0.02;
      var ans = solve(function (x) { return 1 + s * x - Math.pow(1 + i, x); }, 1, 200);
      var q = 'Dana A berakumulasi dengan bunga sederhana ' + pc(s, 0) + ' dan dana B dengan bunga majemuk efektif ' + pc(i, 0) + '. Jumlah yang sama disetor ke keduanya pada t = 0. Setelah berapa tahun nilai keduanya kembali sama?';
      var sol = '1 + ' + n(s, 2) + 't = ' + n(1 + i, 2) + 'ᵗ, cari akar t > 0 dengan SOLVE: t = <b>' + n(ans, 2) + '</b> tahun.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [Math.log(1 + s) / Math.log(1 + i) * 10, s / (s - i) * 5, ans * 0.8, Math.log(2) / Math.log(1 + i)], 2));
    } });
  soa({ id: 'f_perpsplit', sec: 2, syl: '2.b', topic: 'Pembagian perpetuitas antar penerima', src: 'Pola SOA Exam FM (Brian, Colleen, badan amal)',
    fast: 'Bagian n pembayaran pertama = 1 − vⁿ dari PV total. Jadi vⁿ = 1 − bagian pertama, dan penerima setelah 2n pembayaran mendapat v²ⁿ = (1 − bagian pertama)². Tidak perlu tahu i.',
    gen: function (r) {
      var b = r.pick([0.4, 0.3, 0.5, 0.36]), v = 1 - b, ans = v * v;
      var q = 'Perpetuitas-immediate membayar X per tahun. Brian menerima n pembayaran pertama, Colleen n pembayaran berikutnya, dan badan amal sisanya. Bagian Brian dari nilai sekarang perpetuitas adalah ' + pct(b) + '. Hitung bagian badan amal.';
      var sol = 'Brian: aₙ/a∞ = 1 − vⁿ = ' + n(b, 2) + ' ⇒ vⁿ = ' + n(v, 2) + '. Badan amal: v²ⁿ = ' + n(v, 2) + '² = <b>' + pct(ans) + '</b>.';
      return Object.assign({ q: q, sol: sol }, numOpts(r, ans * 100, [v * b * 100, (1 - 2 * b) * 100, v * 100, b * b * 100], 1, function (s) { return s + '%'; }));
    } });
  soa({ id: 'f_annk', sec: 2, syl: '2.b', topic: 'Anuitas dengan pembayaran tiap k tahun', src: 'Pola SOA Exam FM (pembayaran berkala jarang)',
    fast: 'Anuitas-immediate yang membayar setiap k tahun selama n tahun: PV = aₙ/sₖ (tiap pembayaran = 1). Versi due: aₙ/aₖ. Atau konversi ke bunga per k tahun: j = (1 + i)ᵏ − 1.',
    gen: function (r) {
      var k = r.pick([2, 3, 4]), N = k * r.pick([5, 6, 8]), i = r.pick([0.05, 0.06]), R = r.pick([100, 1000]), due = r() < 0.4;
      var ans = R * an(i, N) / (due ? an(i, k) : sn(i, k));
      var q = 'Anuitas ' + (due ? '-due' : '-immediate') + ' membayar ' + R + ' setiap ' + k + ' tahun selama ' + N + ' tahun' + (due ? ', pembayaran pertama sekarang' : ', pembayaran pertama di akhir tahun ke-' + k) + '. Dengan bunga efektif ' + pc(i, 0) + ', hitung nilai sekarangnya.';
      var sol = 'PV = ' + R + '·a_{' + N + '}/' + (due ? 'a' : 's') + '_{' + k + '} = ' + R + '·' + n(an(i, N), 4) + '/' + n(due ? an(i, k) : sn(i, k), 4) + ' = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [R * an(i, N) / k, R * an(i, N) / (due ? sn(i, k) : an(i, k)), R * an(Math.pow(1 + i, k) - 1, N / k) * (due ? 1 : Math.pow(1 + i, k)), R * an(i * k, N / k)], 2));
    } });
  soa({ id: 'f_drop', sec: 4, syl: '4.a, 4.b', topic: 'Drop payment (pembayaran terakhir lebih kecil)', src: 'Pola SOA Exam FM (pembayaran akhir yang dikurangi)',
    fast: 'Cari n terbesar dengan R·aₙ ≤ L. Pembayaran terakhir (drop) di t = n + 1 = (L − R·aₙ)(1 + i)^{n+1}. Gunakan TABLE di fx-991 untuk aₙ.',
    gen: function (r) {
      var L = r.pick([10000, 5000, 20000]), i = r.pick([0.06, 0.08, 0.05]), R = r.pick([1000, 1200, 1500]) * L / 10000;
      var nn = 0; while (R * an(i, nn + 1) <= L && nn < 200) nn++;
      var ans = (L - R * an(i, nn)) * Math.pow(1 + i, nn + 1);
      var q = 'Pinjaman ' + n(L, 0) + ' pada bunga efektif ' + pc(i, 0) + ' dilunasi dengan pembayaran ' + n(R, 0) + ' di akhir setiap tahun selama mungkin, ditambah satu pembayaran akhir yang lebih kecil setahun setelah pembayaran penuh terakhir. Hitung pembayaran akhir tersebut.';
      var sol = 'n terbesar dengan ' + n(R, 0) + '·aₙ ≤ ' + n(L, 0) + ' adalah n = ' + nn + ' (' + n(R * an(i, nn), 2) + '). Drop payment = (' + n(L, 0) + ' − ' + n(R * an(i, nn), 2) + ')·' + n(1 + i, 2) + '^{' + (nn + 1) + '} = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [(L - R * an(i, nn)) * Math.pow(1 + i, nn), L - R * an(i, nn), (L - R * an(i, nn)) * Math.pow(1 + i, nn + 1) + R, L - R * nn], 2));
    } });
  soa({ id: 'f_loansum', sec: 4, syl: '4.b', topic: 'Total pokok & bunga beberapa cicilan', src: 'Pola SOA Exam FM (jumlah pokok/bunga)',
    fast: 'Total pokok cicilan a sampai b = sisa pinjaman setelah cicilan a − 1 dikurangi sisa setelah cicilan b. Total bunga seluruh pinjaman = nR − L. Tidak perlu membuat jadwal amortisasi.',
    gen: function (r) {
      var L = r.pick([10000, 50000, 25000]), i = r.pick([0.06, 0.07, 0.08]), N = r.pick([10, 15, 20]), a = r.pick([3, 5]), b = a + r.pick([3, 4]);
      var R = L / an(i, N), ans = R * an(i, N - a + 1) - R * an(i, N - b);
      var q = 'Pinjaman ' + n(L, 0) + ' dilunasi dengan ' + N + ' cicilan tahunan tetap di akhir tahun pada bunga ' + pc(i, 0) + '. Hitung total pokok yang dilunasi pada cicilan ke-' + a + ' sampai ke-' + b + '.';
      var sol = 'R = ' + n(R, 2) + '. Total = B_{' + (a - 1) + '} − B_{' + b + '} = R(a_{' + (N - a + 1) + '} − a_{' + (N - b) + '}) = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [R * (b - a + 1), R * an(i, N - a) - R * an(i, N - b), R * (b - a + 1) - ans, L * (b - a + 1) / N], 2));
    } });
  soa({ id: 'f_ytm', sec: 5, syl: '5.a, 5.d', topic: 'Yield to maturity dari harga', src: 'Pola SOA Exam FM (mencari yield obligasi)',
    fast: 'Harga > par berarti yield < kupon, dan sebaliknya; buang opsi yang melanggar ini lebih dulu. Lalu substitusikan opsi yang tersisa ke rumus harga, atau pakai SOLVE.',
    gen: function (r) {
      var cp = r.pick([0.06, 0.08, 0.05]), Y = r.pick([10, 8, 12]), yt = r.pick([0.05, 0.07, 0.065]), j0 = yt / 2;
      var P = +(1000 * cp / 2 * an(j0, 2 * Y) + 1000 * vv(j0, 2 * Y)).toFixed(2);
      var ans = 2 * solve(function (x) { return 1000 * cp / 2 * an(x, 2 * Y) + 1000 * vv(x, 2 * Y) - P; }, 0.0001, 0.2);
      var q = 'Obligasi tenor ' + Y + ' tahun, nominal 1000, kupon semesteran ' + pc(cp, 0) + ' per tahun, dijual seharga ' + n(P, 2) + '. Tentukan yield to maturity sebagai bunga nominal dikonversi semesteran.';
      var sol = 'Selesaikan ' + n(1000 * cp / 2, 0) + '·a_{' + 2 * Y + '|j} + 1000v^{' + 2 * Y + '} = ' + n(P, 2) + ' ⇒ j = ' + pc(ans / 2, 3) + ' per semester ⇒ <b>' + pc(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, [cp, Math.pow(1 + ans / 2, 2) - 1, (1000 * cp + (1000 - P) / Y) / ((1000 + P) / 2), ans + 0.005], 2));
    } });
  soa({ id: 'f_bookval', sec: 5, syl: '5.a, 5.e', topic: 'Nilai buku & total bunga obligasi', src: 'Pola SOA Exam FM (nilai buku)',
    fast: 'Nilai buku di t = harga obligasi dengan sisa n − t kupon. Total bunga yang diakui selama masa obligasi = total kupon + nilai tebus − harga beli.',
    gen: function (r) {
      var cp = r.pick([0.08, 0.06]), y = r.pick([0.06, 0.07, 0.05]), N = r.pick([10, 15]), tq = r.pick([4, 5, 6]), q, sol, ans, w;
      var P = 1000 * cp * an(y, N) + 1000 * vv(y, N);
      if (r() < 0.5) {
        ans = 1000 * cp * an(y, N - tq) + 1000 * vv(y, N - tq);
        q = 'Obligasi ' + N + ' tahun, nominal 1000, kupon tahunan ' + pc(cp, 0) + ', dibeli dengan yield efektif ' + pc(y, 0) + '. Hitung nilai bukunya segera setelah kupon ke-' + tq + '.';
        sol = 'B_{' + tq + '} = ' + n(1000 * cp, 0) + '·a_{' + (N - tq) + '} + 1000·v^{' + (N - tq) + '} = <b>' + n(ans, 2) + '</b>.';
        w = [P, P - (P - 1000) * tq / N, 1000 * cp * an(y, tq) + 1000 * vv(y, tq), ans * (1 + y)];
      } else {
        ans = N * 1000 * cp + 1000 - P;
        q = 'Obligasi ' + N + ' tahun, nominal 1000, kupon tahunan ' + pc(cp, 0) + ', dibeli dengan yield efektif ' + pc(y, 0) + ' dan dipegang hingga jatuh tempo. Hitung total bunga (pendapatan investasi) yang diakui selama masa obligasi.';
        sol = 'Harga = ' + n(P, 2) + '. Total bunga = ' + N + '·' + n(1000 * cp, 0) + ' + 1000 − ' + n(P, 2) + ' = <b>' + n(ans, 2) + '</b>.';
        w = [N * 1000 * cp, N * 1000 * y, N * 1000 * cp + P - 1000, P * y * N];
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });
  soa({ id: 'f_redington', sec: 3, syl: '3.e', topic: 'Imunisasi dengan dua obligasi zero-coupon', src: 'Pola SOA Exam FM (imunisasi Redington)',
    fast: 'Dua syarat linear pada nilai sekarang x₁, x₂: x₁ + x₂ = PV_L dan t₁x₁ + t₂x₂ = t_L·PV_L. Jadi x₂ = PV_L(t_L − t₁)/(t₂ − t₁). Nilai nominal = x·(1 + i)ᵗ.',
    gen: function (r) {
      var L = r.pick([10000, 50000, 100000]), tL = r.pick([5, 6, 7]), t1 = r.pick([2, 3]), t2 = r.pick([10, 9, 8]), i = r.pick([0.05, 0.06, 0.04]);
      var PVL = L * vv(i, tL), x2 = PVL * (tL - t1) / (t2 - t1), x1 = PVL - x2, ask2 = r() < 0.5, ans = ask2 ? x2 * Math.pow(1 + i, t2) : x1 * Math.pow(1 + i, t1);
      var q = 'Kewajiban ' + n(L, 0) + ' jatuh tempo dalam ' + tL + ' tahun diimunisasi dengan obligasi zero-coupon ' + t1 + ' tahun dan ' + t2 + ' tahun, sehingga nilai sekarang dan durasi aset sama dengan kewajiban pada bunga efektif ' + pc(i, 0) + '. Hitung nilai nominal obligasi ' + (ask2 ? t2 : t1) + ' tahun.';
      var sol = 'PV_L = ' + n(PVL, 2) + '. x₂ = PV_L(' + tL + ' − ' + t1 + ')/(' + t2 + ' − ' + t1 + ') = ' + n(x2, 2) + ', x₁ = ' + n(x1, 2) + '. Nominal = x·(1 + i)ᵗ = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [ask2 ? x2 : x1, ask2 ? x1 * Math.pow(1 + i, t2) : x2 * Math.pow(1 + i, t1), L / 2, ans * 0.95], 2));
    } });
  soa({ id: 'f_durperp', sec: 3, syl: '3.d', topic: 'Durasi perpetuitas & anuitas', src: 'Pola SOA Exam FM (durasi bentuk tertutup)',
    fast: 'Perpetuitas-immediate: D_Mac = (1 + i)/i dan D_mod = 1/i. Anuitas level n tahun: D_Mac = (Ia)ₙ/aₙ. Hafalkan bentuk tertutup ini supaya tidak menjumlah panjang.',
    gen: function (r) {
      var i = r.pick([0.05, 0.04, 0.08, 0.1]), v = r.pick(['mac', 'mod', 'solve']), q, sol, ans, w;
      if (v === 'solve') {
        var D = r.pick([21, 26, 13.5, 11]);
        ans = 1 / (D - 1);
        q = 'Durasi Macaulay sebuah perpetuitas-immediate level adalah ' + n(D, 1) + '. Tentukan tingkat bunga efektif yang dipakai.';
        sol = 'D = (1 + i)/i = 1 + 1/i ⇒ i = 1/(D − 1) = <b>' + pc(ans, 2) + '</b>.';
        w = [1 / D, 1 / (D + 1), 2 / D, 1 / (D - 2)];
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
      }
      ans = v === 'mac' ? (1 + i) / i : 1 / i;
      q = 'Hitung durasi ' + (v === 'mac' ? 'Macaulay' : 'termodifikasi') + ' perpetuitas-immediate level pada bunga efektif ' + pc(i, 0) + '.';
      sol = (v === 'mac' ? 'D_Mac = (1 + i)/i' : 'D_mod = D_Mac/(1 + i) = 1/i') + ' = <b>' + n(ans, 2) + '</b>.';
      w = v === 'mac' ? [1 / i, (1 + i) / (i * i), 1 / (i * (1 + i)), 2 / i] : [(1 + i) / i, 1 / (i * (1 + i)), (1 + i) / (i * i), 1 / i / 2];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });
  soa({ id: 'f_convimm', sec: 3, syl: '3.d, 3.e', topic: 'Syarat konveksitas imunisasi Redington', src: 'Pola SOA Exam FM (C_A > C_L)',
    fast: 'Jika PV dan durasi sudah sama, C_Mac aset − C_Mac liabilitas = Σ wₖ(tₖ − t_L)² (variansi waktu arus kas aset) dan selalu ≥ 0. Untuk konveksitas modifikasi, bagi selisih itu dengan (1 + i)². Bobot: w₂ = (t_L − t₁)/(t₂ − t₁), w₁ = 1 − w₂.',
    gen: function (r) {
      var L = r.pick([10000, 50000]), tL = r.pick([5, 6, 7]), t1 = r.pick([2, 3, 4]), t2 = r.pick([8, 9, 10]), i = r.pick([0.04, 0.05, 0.06]);
      var w2 = (tL - t1) / (t2 - t1), w1 = 1 - w2, varT = w1 * Math.pow(t1 - tL, 2) + w2 * Math.pow(t2 - tL, 2), modOnly = r() < 0.5;
      var ans = modOnly ? varT / Math.pow(1 + i, 2) : varT;
      var q = 'Kewajiban ' + n(L, 0) + ' jatuh tempo dalam ' + tL + ' tahun didanai dengan obligasi zero-coupon ' + t1 + ' tahun dan ' + t2 + ' tahun, sehingga nilai sekarang dan durasi aset sama dengan kewajiban pada bunga efektif ' + pc(i, 0) + '. Hitung selisih konveksitas ' + (modOnly ? 'modifikasi' : 'Macaulay') + ' aset dan kewajiban (C_A − C_L).';
      var sol = 'Bobot PV: w₂ = (' + tL + ' − ' + t1 + ')/(' + t2 + ' − ' + t1 + ') = ' + n(w2, 4) + ', w₁ = ' + n(w1, 4) + '. C_Mac,A − C_Mac,L = w₁t₁² + w₂t₂² − t_L² = w₁(t₁ − t_L)² + w₂(t₂ − t_L)² = ' + n(varT, 4) + (modOnly ? '. Karena D sama, selisih konveksitas modifikasi = ' + n(varT, 4) + '/(1 + i)² = <b>' + n(ans, 3) + '</b>.' : ' = <b>' + n(ans, 3) + '</b>.') + ' Positif, jadi syarat Redington C_A > C_L terpenuhi.';
      var w = [modOnly ? varT : varT / Math.pow(1 + i, 2), (t1 * t1 + t2 * t2) / 2 - tL * tL, w1 * t1 * t1 + w2 * t2 * t2, varT / (1 + i), 0];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });
  soa({ id: 'f_macapprox', sec: 3, syl: '3.d', topic: 'Aproksimasi harga orde pertama (Macaulay vs modifikasi)', src: 'Pola SOA Exam FM (first-order Macaulay approximation)',
    fast: 'Macaulay: P(i₁) ≈ P(i₀)·[(1 + i₀)/(1 + i₁)]^{D_Mac}. Modifikasi: P(i₁) ≈ P(i₀)[1 − D_mod(i₁ − i₀)], D_mod = D_Mac/(1 + i₀). Baca soal: “Macaulay approximation” berarti rumus pangkat, bukan rumus linear.',
    gen: function (r) {
      var P0 = r.pick([1000, 950, 1080]), D = r.pick([6.5, 8, 9.2, 12]), i0 = r.pick([0.05, 0.06, 0.07]), di = r.pick([0.01, 0.005, -0.01]), i1 = i0 + di, mac = r() < 0.6;
      var pMac = P0 * Math.pow((1 + i0) / (1 + i1), D), pMod = P0 * (1 - D / (1 + i0) * di);
      var ans = mac ? pMac : pMod;
      var q = 'Harga obligasi pada yield efektif ' + pc(i0, 0) + ' adalah ' + n(P0, 0) + ' dengan durasi Macaulay ' + n(D, 1) + '. Estimasi harga pada yield ' + pc(i1, 1) + ' memakai aproksimasi orde pertama ' + (mac ? 'Macaulay' : 'durasi modifikasi') + '.';
      var sol = mac ? 'P ≈ ' + n(P0, 0) + '·(' + n(1 + i0, 3) + '/' + n(1 + i1, 3) + ')^{' + n(D, 1) + '} = <b>' + n(ans, 2) + '</b>.'
        : 'D_mod = ' + n(D, 1) + '/' + n(1 + i0, 3) + ' = ' + n(D / (1 + i0), 4) + '. P ≈ ' + n(P0, 0) + '[1 − ' + n(D / (1 + i0), 4) + '·' + n(di, 3) + '] = <b>' + n(ans, 2) + '</b>.';
      var w = [mac ? pMod : pMac, P0 * (1 - D * di), P0 * Math.pow((1 + i1) / (1 + i0), D), P0 * Math.pow(1 + i0, -D * di * 10)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });
  soa({ id: 'f_convbond', sec: 3, syl: '3.d', topic: 'Konveksitas obligasi berkupon', src: 'Pola SOA Exam FM (konveksitas dari arus kas)',
    fast: 'Tabelkan t, CFₜvᵗ, lalu t(t + 1)CFₜvᵗ. C_mod = Σ t(t + 1)CFₜvᵗ / [P(1 + i)²]. Di fx-991: MODE STAT dengan x = t, freq = CFₜvᵗ, lalu C_Mac = Σx²/n dan D_Mac = x̄; C_mod = (C_Mac + D_Mac)/(1 + i)².',
    gen: function (r) {
      var N = r.pick([3, 4, 5]), cp = r.pick([0.05, 0.08, 0.1]), y = r.pick([0.06, 0.07, 0.05]);
      var P = 0, s1 = 0, s2 = 0, s3 = 0;
      for (var k = 1; k <= N; k++) { var pv = (cp * 100 + (k === N ? 100 : 0)) * vv(y, k); P += pv; s1 += k * pv; s2 += k * k * pv; s3 += k * (k + 1) * pv; }
      var mac = r() < 0.4, cMac = s2 / P, dMac = s1 / P, cMod = s3 / P / Math.pow(1 + y, 2), ans = mac ? cMac : cMod;
      var q = 'Obligasi ' + N + ' tahun, nominal 100, kupon tahunan ' + pc(cp, 0) + ', dihargai pada yield efektif ' + pc(y, 0) + '. Hitung konveksitas ' + (mac ? 'Macaulay' : 'modifikasi') + ' obligasi ini.';
      var sol = 'P = ' + n(P, 4) + ', D_Mac = ' + n(dMac, 4) + ', C_Mac = Σ t²·PVₜ/P = ' + n(cMac, 4) + '.' + (mac ? ' Jawaban: <b>' + n(ans, 3) + '</b>.' : ' C_mod = (C_Mac + D_Mac)/(1 + i)² = Σ t(t + 1)PVₜ/[P(1 + i)²] = <b>' + n(ans, 3) + '</b>.');
      var w = mac ? [cMod, dMac * dMac, s3 / P, N * N] : [cMac, s3 / P, cMac / Math.pow(1 + y, 2), N * (N + 1) / Math.pow(1 + y, 2)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });
  soa({ id: 'f_contann', sec: 2, syl: '2.c', topic: 'Anuitas kontinu', src: 'Pola SOA Exam FM (pembayaran kontinu)',
    fast: 'āₙ = (1 − e^{−δn})/δ dengan δ = ln(1 + i). Untuk laju pembayaran t pada waktu t: (Īā)ₙ = (āₙ − n vⁿ)/δ. Hitung δ sekali dan simpan.',
    gen: function (r) {
      var i = r.pick([0.05, 0.06, 0.08]), N = r.pick([10, 5, 20]), d = Math.log(1 + i), inc = r() < 0.5;
      var ab = (1 - vv(i, N)) / d, ans = inc ? (ab - N * vv(i, N)) / d : 100 * ab;
      var q = inc ? 'Anuitas dibayar secara kontinu dengan laju t per tahun pada waktu t, selama ' + N + ' tahun. Dengan bunga efektif ' + pc(i, 0) + ', hitung nilai sekarangnya.'
        : 'Anuitas dibayar secara kontinu dengan laju 100 per tahun selama ' + N + ' tahun. Dengan bunga efektif ' + pc(i, 0) + ', hitung nilai sekarangnya.';
      var sol = 'δ = ln(' + n(1 + i, 2) + ') = ' + n(d, 6) + '. ā_{' + N + '} = ' + n(ab, 4) + (inc ? '. (Īā) = (ā − n vⁿ)/δ = <b>' + n(ans, 3) + '</b>.' : '. PV = 100·ā = <b>' + n(ans, 2) + '</b>.');
      var w = inc ? [Ia(i, N), (ab - N * vv(i, N)) / i, ab * N / 2, (ad(i, N) - N * vv(i, N)) / d] : [100 * an(i, N), 100 * ad(i, N), 100 * (1 - vv(i, N)) / i * (1 + i / 2), 100 * ab * (1 + i)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, inc ? 3 : 2));
    } });
  soa({ id: 'f_covcall', sec: 6, syl: '6.a, 6.e', topic: 'Covered call & protective put', src: 'Pola SOA Exam FM (strategi opsi dengan saham)',
    fast: 'Covered call = long saham + short call: profit = S_T − min(S_T, K) + … ringkasnya min(S_T, K) − S₀e^{rT} + C·e^{rT}. Protective put = long saham + long put: max(S_T, K) − (S₀ + P)e^{rT}.',
    gen: function (r) {
      var S0 = r.pick([100, 50]), K = S0 + r.pick([5, 10]), c = r.pick([4, 6]), p = r.pick([3, 5]), rr = 0.05, T2 = 1, ST = S0 + r.pick([-15, 2, 20]), v = r() < 0.5 ? 'cc' : 'pp';
      var g = Math.exp(rr * T2), ans, q, sol, w;
      if (v === 'cc') {
        ans = Math.min(ST, K) - (S0 - c) * g;
        q = 'Investor membeli saham seharga ' + S0 + ' dan menjual call 1 tahun strike ' + K + ' seharga ' + c + ' (covered call). Bunga bebas risiko kontinu 5%. Harga saham setelah 1 tahun ' + ST + '. Hitung profitnya.';
        sol = 'Payoff = min(S_T, K) = ' + Math.min(ST, K) + '. Biaya bersih diakumulasi = (' + S0 + ' − ' + c + ')e^{0,05} = ' + n((S0 - c) * g, 4) + '. Profit = <b>' + n(ans, 3) + '</b>.';
        w = [Math.min(ST, K) - (S0 - c), ST - (S0 - c) * g, Math.min(ST, K) - (S0 + c) * g, Math.max(ST, K) - (S0 - c) * g];
      } else {
        ans = Math.max(ST, K - 10) - (S0 + p) * g;
        q = 'Investor membeli saham seharga ' + S0 + ' dan membeli put 1 tahun strike ' + (K - 10) + ' seharga ' + p + ' (protective put). Bunga bebas risiko kontinu 5%. Harga saham setelah 1 tahun ' + ST + '. Hitung profitnya.';
        sol = 'Payoff = max(S_T, K) = ' + Math.max(ST, K - 10) + '. Biaya diakumulasi = (' + S0 + ' + ' + p + ')e^{0,05} = ' + n((S0 + p) * g, 4) + '. Profit = <b>' + n(ans, 3) + '</b>.';
        w = [Math.max(ST, K - 10) - (S0 + p), ST - (S0 + p) * g, Math.max(ST, K - 10) - (S0 - p) * g, Math.min(ST, K - 10) - (S0 + p) * g];
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });
  soa({ id: 'f_swapnet', sec: 3, syl: '3.b', topic: 'Pembayaran bersih swap', src: 'Pola SOA Exam FM (settlement swap)',
    fast: 'Pembayar tetap (pay-fixed) menerima bersih = Notional × (bunga mengambang − swap rate) per periode. Tanda negatif berarti ia membayar. Untuk swap komoditas: (harga spot − harga swap) × jumlah.',
    gen: function (r) {
      var Nn = r.pick([1e6, 5e5, 2e6]), R = r.pick([0.05, 0.045, 0.055]), fl = r.pick([0.04, 0.06, 0.052, 0.035]), payFixed = r() < 0.5;
      var ans = Nn * (payFixed ? fl - R : R - fl);
      var q = 'Dalam interest rate swap tahunan dengan notional ' + n(Nn, 0) + ' dan swap rate tetap ' + pc(R, 1) + ', bunga mengambang tahun ini ' + pc(fl, 1) + '. Hitung pembayaran bersih yang <b>diterima</b> pihak yang ' + (payFixed ? 'membayar bunga tetap' : 'menerima bunga tetap') + ' (negatif berarti membayar).';
      var sol = 'Bersih = ' + n(Nn, 0) + ' × (' + (payFixed ? pc(fl, 1) + ' − ' + pc(R, 1) : pc(R, 1) + ' − ' + pc(fl, 1)) + ') = <b>' + n(ans, 0) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [-ans, Nn * R, Nn * fl, Math.abs(ans) * 2], 0));
    } });
  soa({ id: 'f_sinkcmp', sec: 4, syl: '4.c', topic: 'Sinking fund vs amortisasi', src: 'Pola SOA Exam FM (perbandingan metode pelunasan)',
    fast: 'Sinking fund dengan j = i persis sama dengan amortisasi. Bila j < i, total pembayaran sinking fund L·i + L/s_{n|j} lebih besar daripada L/a_{n|i}. Selisih per tahun dihitung langsung dari dua rumus ini.',
    gen: function (r) {
      var L = r.pick([100000, 50000]), i = r.pick([0.08, 0.07]), j = r.pick([0.05, 0.06, 0.04]), N = r.pick([10, 15, 20]);
      var sf = L * i + L / sn(j, N), am = L / an(i, N), ans = sf - am;
      var q = 'Pinjaman ' + n(L, 0) + ' selama ' + N + ' tahun pada bunga ' + pc(i, 0) + '. Pilihan A: amortisasi dengan cicilan tahunan tetap. Pilihan B: bayar bunga tahunan ditambah setoran sinking fund berbunga ' + pc(j, 0) + '. Berapa selisih pembayaran tahunan (B − A)?';
      var sol = 'A = L/a_{' + N + '|' + pc(i, 0) + '} = ' + n(am, 2) + '. B = L·i + L/s_{' + N + '|' + pc(j, 0) + '} = ' + n(sf, 2) + '. Selisih = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [L * i + L / sn(i, N) - am, L / sn(j, N) - L / sn(i, N) + 10, L / an(j, N) - am, (i - j) * L], 2));
    } });

  // ---------- Model variasi: setiap slot paket punya beberapa bentuk soal ----------
  var V = {};
  function vt(o) { o.conf = 'Variasi'; o.src = o.src || 'Model variasi latihan (silabus ' + o.syl + ')'; V[o.id] = o; }

  vt({ id: 'v_irr', sec: 1, syl: '1.f', topic: 'IRR dua periode (persamaan kuadrat)',
    fast: 'C₀ = R₁v + R₂v². Misalkan x = 1 + i: C₀x² − R₁x − R₂ = 0 ⇒ x = [R₁ + √(R₁² + 4C₀R₂)]/(2C₀). Ambil akar positif.',
    gen: function (r) {
      var C0 = r.pick([10000, 20000, 15000]), R1 = C0 * r.pick([0.4, 0.5, 0.6]), R2 = C0 * r.pick([0.7, 0.8, 0.65]);
      var x = (R1 + Math.sqrt(R1 * R1 + 4 * C0 * R2)) / (2 * C0), ans = x - 1;
      var q = 'Proyek membutuhkan investasi ' + n(C0, 0) + ' sekarang dan menghasilkan ' + n(R1, 0) + ' di akhir tahun ke-1 serta ' + n(R2, 0) + ' di akhir tahun ke-2. Tentukan IRR proyek.';
      var sol = n(C0, 0) + 'x² − ' + n(R1, 0) + 'x − ' + n(R2, 0) + ' = 0, x = 1 + i ⇒ x = [' + n(R1, 0) + ' + √(' + n(R1 * R1 + 4 * C0 * R2, 0) + ')]/' + n(2 * C0, 0) + ' = ' + n(x, 6) + ' ⇒ IRR = <b>' + pc(ans, 2) + '</b>.';
      var w = [(R1 + R2 - C0) / C0, (R1 + R2 - C0) / C0 / 2, (R1 + R2 - C0) / (R1 + R2), Math.sqrt((R1 + R2) / C0) - 1];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  vt({ id: 'v_eqtime', sec: 1, syl: '1.c', topic: 'Equated time vs waktu ekuivalen eksak',
    fast: 'Eksak: (a + b)vᵗ = a v^{t₁} + b v^{t₂} ⇒ t = ln[(a v^{t₁} + b v^{t₂})/(a + b)]/ln v. Equated time: t̄ = (a t₁ + b t₂)/(a + b), selalu sedikit lebih besar dari t eksak.',
    gen: function (r) {
      var a = r.pick([1000, 2000, 3000]), b = r.pick([2000, 4000, 5000]), t1 = r.pick([1, 2, 3]), t2 = t1 + r.pick([4, 6, 8]), i = r.pick([0.05, 0.06, 0.08]), exact = r() < 0.6;
      var v = 1 / (1 + i), te = Math.log((a * Math.pow(v, t1) + b * Math.pow(v, t2)) / (a + b)) / Math.log(v), tb = (a * t1 + b * t2) / (a + b), ans = exact ? te : tb;
      var q = 'Pembayaran ' + n(a, 0) + ' pada akhir tahun ke-' + t1 + ' dan ' + n(b, 0) + ' pada akhir tahun ke-' + t2 + ' akan diganti dengan satu pembayaran ' + n(a + b, 0) + '. Pada bunga efektif ' + pc(i, 0) + ', tentukan waktu pembayaran tunggal tersebut ' + (exact ? 'secara <b>eksak</b>' : 'dengan metode <b>equated time</b>') + '.';
      var sol = exact ? (a + b) + 'vᵗ = ' + n(a * Math.pow(v, t1) + b * Math.pow(v, t2), 2) + ' ⇒ t = ln(' + n((a * Math.pow(v, t1) + b * Math.pow(v, t2)) / (a + b), 6) + ')/ln(' + n(v, 6) + ') = <b>' + n(ans, 3) + '</b> tahun (equated time ' + n(tb, 3) + ' sedikit lebih besar).'
        : 't̄ = (' + n(a, 0) + '·' + t1 + ' + ' + n(b, 0) + '·' + t2 + ')/' + n(a + b, 0) + ' = <b>' + n(ans, 3) + '</b> tahun.';
      var w = [exact ? tb : te, (t1 + t2) / 2, (b * t1 + a * t2) / (a + b), ans + 0.25];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 3));
    } });

  vt({ id: 'v_reinvann', sec: 2, syl: '2.c, 1.f', topic: 'Akumulasi deposito dengan bunga direinvestasi',
    fast: 'Setoran P di akhir tiap tahun, bunga i dibayarkan tiap tahun lalu diinvestasikan pada j: AV = P[n + i·(Is)_{n−1|j}], dengan (Is)_{m|j} = (s̈_{m|j} − m)/j. Bunga yang diterima naik 1·Pi, 2·Pi, …, (n − 1)·Pi.',
    gen: function (r) {
      var P = r.pick([1000, 500, 2000]), N = r.pick([10, 15, 20]), i = r.pick([0.08, 0.1]), j = r.pick([0.05, 0.06]);
      var fund = 0; for (var k = 1; k <= N; k++) { fund = fund * (1 + j) + P * i * (k - 1); }
      var ans = P * N + fund, m = N - 1, Is = (sn(j, m) * (1 + j) - m) / j;
      var q = 'Setiap akhir tahun selama ' + N + ' tahun, Nadia menyetor ' + n(P, 0) + ' ke rekening yang membayar bunga efektif ' + pc(i, 0) + ' per tahun. Bunga dibayarkan tiap akhir tahun dan langsung diinvestasikan ke rekening lain yang memberi ' + pc(j, 0) + '. Hitung total nilai akumulasi kedua rekening di akhir tahun ke-' + N + '.';
      var sol = 'Pokok tetap ' + n(P * N, 0) + '. Bunga yang diterima: ' + n(P * i, 0) + '·(1, 2, …, ' + m + '), diakumulasi pada j: ' + n(P * i, 0) + '·(Is)_{' + m + '|' + pc(j, 0) + '} = ' + n(P * i, 0) + '·' + n(Is, 4) + ' = ' + n(P * i * Is, 2) + '. Total = <b>' + n(ans, 2) + '</b>.';
      var w = [P * sn(i, N), P * sn(j, N), P * N + P * i * (sn(j, N) * (1 + j) - N) / j, P * N * (1 + i)];
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  vt({ id: 'v_swaprate', sec: 3, syl: '3.b', topic: 'Swap rate dari spot rate',
    fast: 'Swap rate R (pembayaran tahunan, nosional tetap) = (1 − P_n)/Σ Pₜ, dengan Pₜ = (1 + sₜ)^{−t} harga zero-coupon. Ini sama dengan kupon obligasi par.',
    gen: function (r) {
      var s = r.pick([[0.04, 0.045, 0.05], [0.03, 0.035, 0.04, 0.045], [0.05, 0.052, 0.055], [0.02, 0.03, 0.035, 0.04]]);
      var Ps = s.map(function (x, k) { return Math.pow(1 + x, -(k + 1)); }), sum = Ps.reduce(function (a, b) { return a + b; }, 0), nn = s.length, ans = (1 - Ps[nn - 1]) / sum;
      var q = 'Spot rate efektif tahunan: ' + s.map(function (x, k) { return pc(x, 1) + ' (' + (k + 1) + ' tahun)'; }).join(', ') + '. Tentukan swap rate untuk swap suku bunga ' + nn + ' tahun dengan pembayaran tahunan dan nosional tetap.';
      var sol = 'Pₜ = ' + Ps.map(function (x) { return n(x, 5); }).join('; ') + '. R = (1 − ' + n(Ps[nn - 1], 5) + ')/' + n(sum, 5) + ' = <b>' + pc(ans, 3) + '</b>.';
      var avg = s.reduce(function (a, b) { return a + b; }, 0) / nn;
      var w = [avg, s[nn - 1], (1 - Ps[nn - 1]) / nn, s.reduce(function (a, x, k) { return a + x * Ps[k]; }, 0) / sum + 0.0015];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 3));
    } });

  vt({ id: 'v_ytc', sec: 5, syl: '5.b', topic: 'Yield to call',
    fast: 'Yield to call: samakan harga dengan PV kupon sampai tanggal call + harga call. Coba nilai j di kalkulator (atau interpolasi). Untuk obligasi premi, yield to call < yield to maturity.',
    gen: function (r) {
      var cp = r.pick([0.08, 0.09, 0.1]), Y = r.pick([10, 15]), k = r.pick([3, 4, 5]), P = r.pick([1080, 1100, 1120]), Cp = r.pick([1000, 1020, 1050]);
      var f = function (j) { return 1000 * cp * an(j, k) + Cp * vv(j, k) - P; }, ans = solve(f, 0.0001, 0.3);
      var ytm = solve(function (j) { return 1000 * cp * an(j, Y) + 1000 * vv(j, Y) - P; }, 0.0001, 0.3);
      var q = 'Obligasi ' + Y + ' tahun, nominal 1000, kupon tahunan ' + pc(cp, 0) + ', dibeli seharga ' + n(P, 0) + '. Obligasi dapat dipanggil pada akhir tahun ke-' + k + ' dengan harga call ' + n(Cp, 0) + '. Tentukan <b>yield to call</b> (efektif tahunan).';
      var sol = n(P, 0) + ' = ' + n(1000 * cp, 0) + '·a_{' + k + '|j} + ' + n(Cp, 0) + 'v^' + k + ' ⇒ j = <b>' + pc(ans, 2) + '</b>. (Bandingkan yield to maturity ' + pc(ytm, 2) + '.)';
      var w = [ytm, cp, 1000 * cp / P, (1000 * cp + (Cp - P) / k) / P + 0.004];
      return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, w, 2));
    } });

  vt({ id: 'v_betacov', sec: 7, syl: '7.a, 7.b', topic: 'Beta dari kovarians & korelasi',
    fast: 'β = Cov(Rᵢ, R_M)/Var(R_M) = ρ·σᵢ/σ_M. Setelah β diketahui, CAPM: E[Rᵢ] = r_f + β(E[R_M] − r_f).',
    gen: function (r) {
      var rho = r.pick([0.4, 0.6, 0.8]), si = r.pick([0.2, 0.25, 0.3]), sm = r.pick([0.15, 0.2]), rf = r.pick([0.03, 0.04]), rm = r.pick([0.09, 0.1, 0.11]), useCov = r() < 0.5, askR = r() < 0.5;
      var beta = rho * si / sm, cov = rho * si * sm, ans = askR ? rf + beta * (rm - rf) : beta;
      var info = useCov ? 'kovarians imbal hasil saham dengan pasar ' + n(cov, 4) + ' dan simpangan baku pasar ' + pc(sm, 0) : 'simpangan baku imbal hasil saham ' + pc(si, 0) + ', simpangan baku pasar ' + pc(sm, 0) + ', dan korelasi keduanya ' + n(rho, 1);
      var q = 'Diketahui ' + info + '. Bunga bebas risiko ' + pc(rf, 0) + ' dan imbal hasil harapan pasar ' + pc(rm, 0) + '. Tentukan ' + (askR ? 'imbal hasil harapan saham menurut CAPM' : 'beta saham') + '.';
      var sol = 'β = ' + (useCov ? n(cov, 4) + '/' + n(sm * sm, 4) : n(rho, 1) + '·' + n(si, 2) + '/' + n(sm, 2)) + ' = ' + n(beta, 4) + (askR ? '. E[R] = ' + pc(rf, 0) + ' + ' + n(beta, 4) + '·(' + pc(rm, 0) + ' − ' + pc(rf, 0) + ') = <b>' + pc(ans, 2) + '</b>.' : ' = <b>' + n(ans, 4) + '</b>.');
      if (askR) return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, [rf + rho * (rm - rf), beta * rm, rf + si / sm * (rm - rf), rf + beta * rm], 2));
      return Object.assign({ q: q, sol: sol }, money(r, ans, [useCov ? cov / sm : si / sm, rho * sm / si, cov / (si * sm), rho * si / (sm * sm) / 10], 4));
    } });

  // ---------- Model dari pola naskah PAI 2023–2024 (Drive) & opsi ----------
  vt({ id: 'v_ratechg', sec: 1, syl: '1.a', topic: 'Tingkat bunga efektif per tahun dari A(t)',
    src: 'Pola Apr 2024 #1–2, Okt 2024 #1',
    fast: 'iₙ = [A(n) − A(n − 1)]/A(n − 1). Untuk iₜ yang berubah tiap tahun: A(m) = A(k)·Π(1 + iₜ) untuk t = k + 1, …, m.',
    gen: function (r) {
      if (r() < 0.5) {
        var a = r.pick([100, 200, 50]), b = r.pick([5, 4, 8]), n1 = r.pick([3, 5]), n2 = n1 + r.pick([5, 7]);
        var i1 = b / (a + b * (n1 - 1)), i2 = b / (a + b * (n2 - 1)), ans = i1 - i2;
        var q = 'Nilai akumulasi suatu investasi pada tahun t adalah A(t) = ' + a + ' + ' + b + 't. Misalkan iₙ tingkat bunga efektif tahun ke-n. Tentukan i' + n1 + ' − i' + n2 + '.';
        var sol = 'iₙ = [A(n) − A(n − 1)]/A(n − 1) = ' + b + '/(' + a + ' + ' + b + '(n − 1)). i' + n1 + ' = ' + pc(i1, 3) + ', i' + n2 + ' = ' + pc(i2, 3) + '. Selisih = <b>' + pc(ans, 3) + '</b>.';
        return Object.assign({ q: q, sol: sol }, pcOpts(r, ans, [b / (a + b * n1) - b / (a + b * n2), b / a - i2, i1, (i1 - i2) / 2], 3));
      }
      var A4 = r.pick([10, 20, 50]), c = r.pick([0.01, 0.011, 0.012]), m = r.pick([7, 8]), k = 4, f = 1, parts = [];
      for (var t = k + 1; t <= m; t++) { f *= 1 + c * t; parts.push('(1 + ' + n(c * t, 3) + ')'); }
      var ans2 = A4 * f;
      var q2 = 'A(n) nilai akumulasi investasi pada tahun n, dan tingkat bunga efektif tahun ke-n adalah iₙ = ' + n(c, 3) + 'n. Jika A(' + k + ') = ' + A4 + ' juta, tentukan A(' + m + ').';
      var sol2 = 'A(' + m + ') = A(' + k + ')·' + parts.join('') + ' = <b>' + n(ans2, 2) + '</b> juta.';
      return Object.assign({ q: q2, sol: sol2 }, money(r, ans2, [A4 * Math.pow(1 + c * m, m - k), A4 * (1 + c * (m - k)), A4 * Math.pow(1 + c * k, m - k), A4 * f * (1 + c * (m + 1))], 2));
    } });

  vt({ id: 'v_an2n', sec: 2, syl: '2.a', topic: 'Hubungan aₙ, a₂ₙ, a₃ₙ',
    src: 'Pola Agu 2023 #18, Apr 2024 #14, Okt 2024 #10',
    fast: 'a₂ₙ = aₙ(1 + vⁿ) dan a₃ₙ = aₙ(1 + vⁿ + v²ⁿ). Rasio dua anuitas langsung memberi vⁿ, lalu i dari aₙ = (1 − vⁿ)/i.',
    gen: function (r) {
      var vn = r.pick([0.5, 0.6, 0.4, 0.55]), i = r.pick([0.02, 0.025, 0.0125, 0.03]), an1 = (1 - vn) / i;
      if (r() < 0.5) {
        var a3 = an1 * (1 + vn + vn * vn), ans = an1 * (1 + vn);
        var q = 'Pada tingkat bunga efektif i, nilai sekarang anuitas-immediate n tahun dengan pembayaran 1 adalah ' + n(an1, 2) + ', dan anuitas 3n tahun adalah ' + n(a3, 4) + '. Tentukan nilai sekarang anuitas 2n tahun.';
        var sol = 'a₃ₙ/aₙ = 1 + vⁿ + v²ⁿ = ' + n(a3 / an1, 4) + ' ⇒ vⁿ = ' + n(vn, 2) + '. a₂ₙ = aₙ(1 + vⁿ) = <b>' + n(ans, 2) + '</b>.';
        return Object.assign({ q: q, sol: sol }, money(r, ans, [(an1 + a3) / 2, 2 * an1, an1 * (1 + vn * vn), a3 - an1], 2));
      }
      var a2 = an1 * (1 + vn);
      var q2 = 'Diketahui nilai sekarang anuitas-immediate n tahun = ' + n(an1, 4) + ' dan anuitas-immediate 2n tahun = ' + n(a2, 4) + ' (pembayaran 1). Tentukan tingkat bunga efektif i.';
      var sol2 = 'a₂ₙ/aₙ = 1 + vⁿ ⇒ vⁿ = ' + n(vn, 2) + '. i = (1 − vⁿ)/aₙ = ' + n(1 - vn, 2) + '/' + n(an1, 4) + ' = <b>' + pc(i, 2) + '</b>.';
      return Object.assign({ q: q2, sol: sol2 }, pcOpts(r, i, [vn / an1, (1 - vn) / a2, (1 - vn * vn) / an1, i * 1.25], 2));
    } });

  vt({ id: 'v_intport', sec: 4, syl: '4.a, 4.b', topic: 'Porsi bunga/pokok cicilan langsung dari R',
    src: 'Pola Nov 2023 #12, Okt 2024 #22, Agu 2023 #24',
    fast: 'Cicilan R selama n: Iₜ = R(1 − v^{n−t+1}), Pₜ = R·v^{n−t+1}. Total pokok k cicilan pertama = L·s_k/s_n. Total bunga = nR − L.',
    gen: function (r) {
      var L = r.pick([100, 200, 300]), N = r.pick([10, 15, 20]), i = r.pick([0.05, 0.06, 0.08]), R = L / an(i, N), v = r.pick(['it', 'sumP', 'tot']), q, sol, ans, w;
      if (v === 'it') {
        var t = r.pick([3, 5, 8]);
        ans = R * (1 - vv(i, N - t + 1));
        q = 'Pinjaman ' + L + ' juta dilunasi dengan ' + N + ' cicilan tahunan tetap di akhir tahun pada bunga efektif ' + pc(i, 0) + '. Hitung porsi bunga pada cicilan ke-' + t + '.';
        sol = 'R = ' + L + '/a_{' + N + '|} = ' + n(R, 4) + '. I_' + t + ' = R(1 − v^{' + (N - t + 1) + '}) = <b>' + n(ans, 2) + '</b> juta.';
        w = [R * vv(i, N - t + 1), R * (1 - vv(i, N - t)), i * L, R - L / N];
      } else if (v === 'sumP') {
        var k = r.pick([3, 4, 5]);
        ans = L * sn(i, k) / sn(i, N);
        q = 'Pinjaman ' + L + ' juta dilunasi dengan ' + N + ' cicilan tahunan tetap di akhir tahun pada bunga efektif ' + pc(i, 0) + '. Hitung total pokok yang dilunasi pada ' + k + ' cicilan pertama.';
        sol = 'P₁ = L/s_{' + N + '|} = ' + n(L / sn(i, N), 4) + '. Σ = P₁·s_{' + k + '|} = <b>' + n(ans, 2) + '</b> juta.';
        w = [k * L / N, k * (R - i * L), L * an(i, k) / an(i, N), k * R];
      } else {
        ans = N * R - L;
        q = 'Pinjaman ' + L + ' juta dilunasi dengan ' + N + ' cicilan tahunan tetap di akhir tahun pada bunga efektif ' + pc(i, 0) + '. Pinjaman lain dengan jumlah, tenor, dan bunga yang sama hanya membayar bunga tiap tahun dan pokok di akhir. Hitung selisih total bunga kedua pinjaman.';
        sol = 'Amortisasi: total bunga = nR − L = ' + n(N * R - L, 2) + '. Bunga saja: nLi = ' + n(N * L * i, 2) + '. Selisih = <b>' + n(N * L * i - (N * R - L), 2) + '</b> juta.';
        ans = N * L * i - (N * R - L);
        w = [N * R - L, N * L * i, N * R - N * L * i, L * i * N / 2];
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  vt({ id: 'v_premdisc', sec: 5, syl: '5.a', topic: 'Rumus premium/diskonto obligasi',
    src: 'Pola Apr 2024 #22, Nov 2023 #16–17, Agu 2023 #12',
    fast: 'P − C = (Fr − Ci)·aₙ. Premi bila kupon > yield. Untuk dua obligasi dengan yield sama, selisih harganya = F·(r₂ − r₁)·aₙ.',
    gen: function (r) {
      var F = 1000, n2 = r.pick([20, 30, 40]), j = r.pick([0.04, 0.05, 0.03]), r1 = j + r.pick([-0.01, 0.01, 0.015]), r2 = r1 + r.pick([0.01, 0.005]);
      var a = an(j, n2), P1 = F + (F * r1 - F * j) * a, ans = F + (F * r2 - F * j) * a;
      var q = 'Dua obligasi nominal 1000 ditebus pada par, sama-sama ' + n2 + ' kupon semesteran dan dihargai pada yield ' + pc(2 * j, 0) + ' dikonversi semesteran. Obligasi A berkupon ' + pc(2 * r1, 1) + ' per tahun dan seharga ' + n(P1, 2) + '. Obligasi B berkupon ' + pc(2 * r2, 1) + ' per tahun. Tentukan harga obligasi B.';
      var sol = 'P − C = (Fr − Cj)aₙ. Dari A: a_{' + n2 + '|} = (' + n(P1, 2) + ' − 1000)/(' + n(F * r1, 1) + ' − ' + n(F * j, 1) + ') = ' + n(a, 4) + '. P_B = 1000 + (' + n(F * r2, 1) + ' − ' + n(F * j, 1) + ')·' + n(a, 4) + ' = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [P1 + F * (r2 - r1), P1 * r2 / r1, F + (F * r2 - F * j) * an(j, n2 / 2), P1 + F * (r2 - r1) * n2], 2));
    } });

  vt({ id: 'v_fwdzero', sec: 3, syl: '3.c', topic: 'Forward rate dari harga zero-coupon',
    src: 'Pola Apr 2024 #25, Okt 2024 #18',
    fast: '1 + f_{t,t+1} = Pₜ/Pₜ₊₁ (harga zero-coupon nominal sama). Sebaliknya Pₜ₊₁ = Pₜ/(1 + f).',
    gen: function (r) {
      var P1 = r.pick([95, 94.34, 96]), f = r.pick([0.06, 0.08, 0.07]), P2 = P1 / (1 + f);
      if (r() < 0.5) {
        var q = 'Harga obligasi zero-coupon nominal 100: jatuh tempo 1 tahun ' + n(P1, 2) + ', jatuh tempo 2 tahun ' + n(P2, 2) + '. Tentukan forward rate satu tahun untuk tahun ke-2.';
        var sol = '1 + f = P₁/P₂ = ' + n(P1, 2) + '/' + n(P2, 2) + ' ⇒ f = <b>' + pc(f, 2) + '</b>.';
        return Object.assign({ q: q, sol: sol }, pcOpts(r, f, [Math.sqrt(100 / P2) - 1, 100 / P1 - 1, 100 / P2 - 1, (100 / P2 - 1) / 2], 2));
      }
      var q2 = 'Harga obligasi zero-coupon nominal 100 jatuh tempo 1 tahun adalah ' + n(P1, 2) + '. Forward rate satu tahun untuk tahun ke-2 adalah ' + pc(f, 0) + '. Tentukan harga obligasi zero-coupon 2 tahun.';
      var sol2 = 'P₂ = P₁/(1 + f) = ' + n(P1, 2) + '/' + n(1 + f, 2) + ' = <b>' + n(P2, 2) + '</b>.';
      return Object.assign({ q: q2, sol: sol2 }, money(r, P2, [100 / Math.pow(1 + f, 2), P1 * (1 - f), 100 / (1 + f), P1 / Math.pow(1 + f, 2)], 2));
    } });

  vt({ id: 'v_moneyness', sec: 6, syl: '6.b', topic: 'Moneyness opsi (ITM/ATM/OTM)',
    src: 'Pola Okt 2024 #25',
    fast: 'Call ITM jika S > K, put ITM jika S < K. ATM jika S = K. Abaikan premi: moneyness hanya membandingkan harga spot dengan strike.',
    gen: function (r) {
      var items = [];
      for (var k = 0; k < 3; k++) {
        var call = r() < 0.5, K = r.pick([50, 60, 75, 90, 100]), d = r.pick([-8, -5, 0, 3, 6]), S = K + d;
        items.push({ call: call, K: K, S: S, itm: call ? S > K : S < K });
      }
      var lab = ['(i)', '(ii)', '(iii)'], itm = items.map(function (x, k) { return x.itm ? lab[k] : null; }).filter(Boolean);
      var fmt = function (arr) { return arr.length ? arr.join(' dan ') : 'Tidak ada'; };
      var correct = fmt(itm);
      var cand = ['(i)', '(ii)', '(iii)', '(i) dan (ii)', '(i) dan (iii)', '(ii) dan (iii)', '(i) dan (ii) dan (iii)', 'Tidak ada'].filter(function (s) { return s !== correct; });
      var q = 'Manakah opsi berikut yang tergolong <b>in-the-money</b>? ' + items.map(function (x, k) { return lab[k] + ' ' + (x.call ? 'call' : 'put') + ' strike ' + x.K + ', harga spot ' + x.S + ', premi ' + n(r.pick([2.5, 3.25, 7.76, 9.31]), 2); }).join('; ') + '.';
      var sol = items.map(function (x, k) { return lab[k] + ' ' + (x.call ? 'call' : 'put') + ': S ' + (x.S > x.K ? '&gt;' : x.S < x.K ? '&lt;' : '=') + ' K' + ' ⇒ ' + (x.itm ? 'ITM' : (x.S === x.K ? 'ATM' : 'OTM')); }).join('; ') + '. Jawaban: <b>' + correct + '</b>.';
      return Object.assign({ q: q, sol: sol }, strOpts(correct, shuffle(cand, r)));
    } });

  vt({ id: 'v_pcpfwd', sec: 6, syl: '6.a, 6.b', topic: 'Put-call parity dengan harga forward',
    src: 'Pola Okt 2024 #26',
    fast: 'C − P = (F − K)·vᵀ. Dengan premi call, premi put, F, dan K diketahui: vᵀ = (C − P)/(F − K), lalu i = v^{−1/T} − 1.',
    gen: function (r) {
      var K = r.pick([100, 150, 200]), i = r.pick([0.05, 0.06, 0.08, 0.09]), T = r.pick([1, 1, 2]), F = K * r.pick([1.08, 1.1, 1.05]), P = r.pick([8, 11.79, 6.5]);
      var C = P + (F - K) * Math.pow(1 + i, -T);
      var q = 'Harga forward ' + T + ' tahun suatu aset ' + n(F, 2) + '. Premi call Eropa ' + T + ' tahun dengan strike ' + K + ' adalah ' + n(C, 2) + ' dan premi put dengan strike dan jatuh tempo sama ' + n(P, 2) + '. Tentukan tingkat bunga bebas risiko efektif tahunan.';
      var sol = 'C − P = (F − K)vᵀ ⇒ vᵀ = ' + n(C - P, 2) + '/' + n(F - K, 2) + ' = ' + n((C - P) / (F - K), 6) + ' ⇒ i = <b>' + pc(i, 2) + '</b>.';
      var vT = (C - P) / (F - K);
      return Object.assign({ q: q, sol: sol }, pcOpts(r, i, [1 / vT - 1, (F - K) / (C - P) / T - 1 / T, (F - K - (C - P)) / K, Math.pow(F / K, 1 / T) - 1], 2));
    } });

  vt({ id: 'v_optbep', sec: 6, syl: '6.b, 6.e', topic: 'Profit, titik impas & untung/rugi maksimum opsi',
    src: 'Silabus 6.b/6.e (pola profit opsi Okt 2024 #27)',
    fast: 'Profit = payoff − premi·e^{rT}. BEP long call: K + FV(premi); BEP long put: K − FV(premi). Short put rugi maksimum = K − FV(premi).',
    gen: function (r) {
      var K = r.pick([40, 50, 100]), prem = r.pick([3, 5, 8]), rr = r.pick([0.04, 0.05, 0.06]), T = r.pick([0.5, 1]), fv = prem * Math.exp(rr * T), v = r.pick(['bepc', 'bepp', 'shortput', 'profit']), q, sol, ans, w;
      var setup = 'Opsi Eropa ' + (T === 1 ? '1 tahun' : '6 bulan') + ' strike ' + K + ' dengan premi ' + prem + '; bunga bebas risiko kontinu ' + pc(rr, 0) + ' per tahun. ';
      if (v === 'bepc') { ans = K + fv; q = setup + 'Opsinya call. Tentukan harga saham saat jatuh tempo agar profit pembeli call = 0.'; sol = 'BEP = K + premi·e^{rT} = ' + K + ' + ' + n(fv, 4) + ' = <b>' + n(ans, 2) + '</b>.'; w = [K + prem, K - fv, K, K + 2 * fv]; }
      else if (v === 'bepp') { ans = K - fv; q = setup + 'Opsinya put. Tentukan harga saham saat jatuh tempo agar profit pembeli put = 0.'; sol = 'BEP = K − premi·e^{rT} = ' + K + ' − ' + n(fv, 4) + ' = <b>' + n(ans, 2) + '</b>.'; w = [K - prem, K + fv, K, K - 2 * fv]; }
      else if (v === 'shortput') { ans = K - fv; q = setup + 'Opsinya put dan investor <b>menjual</b> put tersebut. Tentukan kerugian maksimum investor.'; sol = 'Rugi terbesar saat S_T = 0: payoff −K, ditambah FV premi ⇒ rugi maks = K − ' + n(fv, 4) + ' = <b>' + n(ans, 2) + '</b>.'; w = [K, K - prem, K + fv, fv]; }
      else { var ST = K + r.pick([-6, 4, 10, 15]), call = r() < 0.5, pay = call ? Math.max(ST - K, 0) : Math.max(K - ST, 0); ans = pay - fv; q = setup + 'Investor membeli ' + (call ? 'call' : 'put') + ' tersebut dan harga saham saat jatuh tempo ' + ST + '. Hitung profit investor.'; sol = 'Payoff = ' + (call ? 'max(S − K, 0)' : 'max(K − S, 0)') + ' = ' + pay + '. Profit = ' + pay + ' − ' + prem + 'e^{' + n(rr * T, 3) + '} = <b>' + n(ans, 2) + '</b>.'; w = [pay - prem, pay, -fv, (call ? Math.max(K - ST, 0) : Math.max(ST - K, 0)) - fv]; }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  vt({ id: 'v_boxcollar', sec: 6, syl: '6.e', topic: 'Box spread, collar & strangle',
    src: 'Silabus 6.e (strategi opsi)',
    fast: 'Box spread: payoff pasti K₂ − K₁, harga = (K₂ − K₁)e^{−rT}. Collared stock: payoff min(max(S, K₁), K₂). Strangle: max(K₁ − S, 0) + max(S − K₂, 0).',
    gen: function (r) {
      var K1 = r.pick([40, 50, 90]), K2 = K1 + r.pick([10, 20]), rr = r.pick([0.04, 0.05, 0.08]), T = r.pick([1, 2]), v = r.pick(['box', 'collar', 'strangle']), q, sol, ans, w;
      if (v === 'box') {
        ans = (K2 - K1) * Math.exp(-rr * T);
        q = 'Investor membentuk box spread: bull call spread dan bear put spread dengan strike ' + K1 + ' dan ' + K2 + ', jatuh tempo ' + T + ' tahun. Bunga bebas risiko kontinu ' + pc(rr, 0) + '. Tanpa arbitrase, berapa biaya bersih box spread ini?';
        sol = 'Payoff box selalu K₂ − K₁ = ' + (K2 - K1) + ' di T. Biaya = ' + (K2 - K1) + 'e^{−' + n(rr * T, 2) + '} = <b>' + n(ans, 2) + '</b>.';
        w = [K2 - K1, (K2 - K1) * Math.exp(rr * T), (K2 - K1) / 2, 0];
      } else if (v === 'collar') {
        var S = r.pick([K1 - 7, K1 + 4, K2 + 9]);
        ans = Math.min(Math.max(S, K1), K2);
        q = 'Investor memiliki satu saham, membeli put strike ' + K1 + ', dan menjual call strike ' + K2 + ' (collared stock), jatuh tempo sama. Jika harga saham saat jatuh tempo ' + S + ', berapa payoff total posisi ini?';
        sol = 'Payoff = min(max(S, K₁), K₂) = min(max(' + S + ', ' + K1 + '), ' + K2 + ') = <b>' + n(ans, 0) + '</b>.';
        w = [S, K1, K2, Math.max(S, K2)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
      } else {
        var S2 = r.pick([K1 - 12, K2 + 8, (K1 + K2) / 2]);
        ans = Math.max(K1 - S2, 0) + Math.max(S2 - K2, 0);
        q = 'Investor membeli put strike ' + K1 + ' dan call strike ' + K2 + ' (strangle). Harga saham saat jatuh tempo ' + S2 + '. Berapa payoff strangle (belum dikurangi premi)?';
        sol = 'Payoff = max(K₁ − S, 0) + max(S − K₂, 0) = ' + Math.max(K1 - S2, 0) + ' + ' + Math.max(S2 - K2, 0) + ' = <b>' + n(ans, 0) + '</b>.';
        w = [Math.abs(S2 - K1), Math.abs(S2 - K2), K2 - K1, Math.abs(S2 - (K1 + K2) / 2)];
        return Object.assign({ q: q, sol: sol }, money(r, ans, w, 0));
      }
      return Object.assign({ q: q, sol: sol }, money(r, ans, w, 2));
    } });

  vt({ id: 'v_binom1', sec: 6, syl: '6.b (pengayaan)', topic: 'Binomial satu periode (pengayaan)',
    src: 'Pengayaan opsi (pola SOA FM/IFM)',
    fast: 'p* = (e^{(r−δ)h} − d)/(u − d); C = e^{−rh}[p*C_u + (1 − p*)C_d]. Cek: d < e^{(r−δ)h} < u, kalau tidak ada arbitrase.',
    gen: function (r) {
      var S = r.pick([50, 100, 40]), u = r.pick([1.2, 1.25, 1.3]), d = r.pick([0.8, 0.85, 0.9]), K = S * r.pick([1, 0.95, 1.05]), rr = r.pick([0.04, 0.05, 0.06]), call = r() < 0.6;
      var Su = S * u, Sd = S * d, Cu = call ? Math.max(Su - K, 0) : Math.max(K - Su, 0), Cd = call ? Math.max(Sd - K, 0) : Math.max(K - Sd, 0);
      var p = (Math.exp(rr) - d) / (u - d), ans = Math.exp(-rr) * (p * Cu + (1 - p) * Cd);
      var q = 'Harga saham tanpa dividen ' + S + '. Dalam satu tahun harga naik menjadi ' + n(Su, 2) + ' atau turun menjadi ' + n(Sd, 2) + '. Bunga bebas risiko kontinu ' + pc(rr, 0) + '. Dengan model binomial satu periode, tentukan harga ' + (call ? 'call' : 'put') + ' Eropa 1 tahun dengan strike ' + n(K, 2) + '.';
      var sol = 'u = ' + n(u, 2) + ', d = ' + n(d, 2) + '. p* = (e^{' + n(rr, 2) + '} − d)/(u − d) = ' + n(p, 4) + '. ' + (call ? 'C' : 'P') + '_u = ' + n(Cu, 2) + ', ' + (call ? 'C' : 'P') + '_d = ' + n(Cd, 2) + '. Harga = e^{−' + n(rr, 2) + '}[p*·' + n(Cu, 2) + ' + (1 − p*)·' + n(Cd, 2) + '] = <b>' + n(ans, 2) + '</b>.';
      return Object.assign({ q: q, sol: sol }, money(r, ans, [0.5 * Cu + 0.5 * Cd, p * Cu + (1 - p) * Cd, Math.exp(-rr) * (0.5 * Cu + 0.5 * Cd), Math.exp(-rr) * ((1 - p) * Cu + p * Cd)], 2));
    } });

  vt({ id: 'v_derivtheory', sec: 6, syl: '6.a', topic: 'Teori derivatif & posisi',
    src: 'Pola Apr 2024 #28 & #30',
    fast: 'Untung saat harga naik: long forward, long call, short put, long aset. Alasan memakai derivatif: manajemen risiko, spekulasi (leverage), biaya transaksi lebih rendah, arbitrase regulasi/pajak.',
    gen: function (r) {
      if (r() < 0.5) {
        var up = r() < 0.5;
        var pos = [['long forward', true], ['short forward', false], ['long call', true], ['short call', false], ['long put', false], ['short put', true]];
        var pick = shuffle(pos, r).slice(0, 3), lab = ['(i)', '(ii)', '(iii)'];
        var good = pick.map(function (p, k) { return (p[1] === up) ? lab[k] : null; }).filter(Boolean);
        var correct = good.length ? good.join(' dan ') : 'Tidak ada';
        var cand = ['(i)', '(ii)', '(iii)', '(i) dan (ii)', '(i) dan (iii)', '(ii) dan (iii)', '(i) dan (ii) dan (iii)', 'Tidak ada'].filter(function (s) { return s !== correct; });
        var q = 'Posisi mana yang mendapat keuntungan dari <b>' + (up ? 'kenaikan' : 'penurunan') + '</b> harga aset dasar? ' + pick.map(function (p, k) { return lab[k] + ' ' + p[0]; }).join('; ') + '.';
        var sol = pick.map(function (p, k) { return lab[k] + ' ' + p[0] + ': untung saat harga ' + (p[1] ? 'naik' : 'turun'); }).join('; ') + '. Jawaban: <b>' + correct + '</b>.';
        return Object.assign({ q: q, sol: sol }, strOpts(correct, shuffle(cand, r)));
      }
      var wrong = r.pick(['Untuk membeli komoditas secara langsung', 'Untuk menghilangkan seluruh risiko investasi tanpa biaya', 'Untuk menjamin imbal hasil di atas bunga bebas risiko']);
      var q2 = 'Manakah yang <b>bukan</b> alasan penggunaan derivatif?';
      var sol2 = 'Derivatif dipakai untuk manajemen risiko, spekulasi dengan leverage, mengurangi biaya transaksi, dan arbitrase regulasi/pajak. “' + wrong + '” bukan alasannya. Jawaban: <b>' + wrong + '</b>.';
      return Object.assign({ q: q2, sol: sol2 }, strOpts(wrong, shuffle(['Untuk mengelola risiko', 'Untuk mengurangi biaya transaksi pembelian dan penjualan investasi', 'Untuk membuat taruhan dengan leverage tinggi atas kejadian di masa depan', 'Untuk menunda pembayaran pajak atas keuntungan aset yang dimiliki'], r)));
    } });

  // ---------- Pool model per slot ----------
  var SID = {}; S.forEach(function (s) { SID[s.id] = s; });
  var EXTRA = {
    eqrate: ['f_infl', 'f_force', 'v_ratechg'], eqval: ['f_simp', 'v_eqtime'], npv: ['v_irr'],
    perp: ['f_perpsplit'], annrel: ['f_annk', 'v_an2n'], monthly: ['f_contann'], reinvest: ['v_reinvann'],
    spotfwd: ['v_fwdzero'], macd: ['f_durperp'], moddur: ['f_macapprox'], convex: ['f_convbond'], match: ['f_redington', 'f_convimm'], swap: ['f_swapnet', 'v_swaprate'],
    amort: ['f_loansum', 'v_intport'], olb: ['f_drop'], sinking: ['f_sinkcmp'],
    bprice: ['f_ytm', 'v_premdisc'], bamort: ['f_bookval'], callable: ['v_ytc'],
    pcp: ['v_pcpfwd', 'v_moneyness'], forward: ['v_derivtheory'], spread: ['f_covcall', 'v_optbep', 'v_boxcollar', 'v_binom1'], beta: ['v_betacov'], capm: ['v_betacov']
  };
  P = T.map(function (slot) {
    var base = [{ t: { id: slot.id, gen: slot.gen, fast: slot.fast }, w: 2, own: true }];
    (EXTRA[slot.id] || []).forEach(function (id) { base.push({ t: V[id] || SID[id], w: 1 }); });
    var tot = base.reduce(function (s, x) { return s + x.w; }, 0);
    return { id: slot.id, sec: slot.sec, syl: slot.syl, topic: slot.topic, conf: slot.conf, src: slot.src, fast: slot.fast, models: base.map(function (x) { return x.t.id; }),
      gen: function (r) {
        var u = r() * tot, k = 0; while (u >= base[k].w) { u -= base[k].w; k++; }
        var b = base[k], g = b.t.gen(r);
        g.fast = b.t.fast; g.model = b.t.id;
        if (!b.own) { g.topic = b.t.topic; g.conf = b.t.conf; g.src = b.t.src; }
        return g;
      } };
  });

  function buildSoaPaper(seed) {
    var out = [];
    for (var i = 0; i < S.length; i++) {
      var r = makeR((seed * 6007 + i * 15485863) >>> 0);
      var g = S[i].gen(r);
      var opts = shuffle([{ s: g.correct, ok: true }].concat(g.wrong.map(function (w) { return { s: w, ok: false }; })), r);
      out.push({ no: i + 1, id: S[i].id, model: S[i].id, topic: S[i].topic, conf: 'SOA', src: S[i].src, syl: S[i].syl, sec: S[i].sec, q: g.q, sol: g.sol, fast: S[i].fast,
        options: opts.map(function (o) { return o.s; }), answer: opts.findIndex(function (o) { return o.ok; }) });
    }
    return out.sort(function (a, b) { return a.sec - b.sec; }).map(function (q, k) { q.no = k + 1; return q; });
  }

  var LETTERS = ['a', 'b', 'c', 'd', 'e'];
  function buildPaper(seed) {
    var out = [];
    for (var i = 0; i < P.length; i++) {
      var r = makeR((seed * 7919 + i * 104729) >>> 0);
      var g = P[i].gen(r);
      var opts = shuffle([{ s: g.correct, ok: true }].concat(g.wrong.map(function (w) { return { s: w, ok: false }; })), r);
      out.push({ no: i + 1, id: P[i].id, model: g.model || P[i].id, topic: g.topic || P[i].topic, conf: g.conf || P[i].conf, src: g.src || P[i].src, syl: P[i].syl, sec: P[i].sec, q: g.q, sol: g.sol, fast: g.fast || P[i].fast,
        options: opts.map(function (o) { return o.s; }), answer: opts.findIndex(function (o) { return o.ok; }) });
    }
    return out;
  }
  var api = { buildPaper: buildPaper, buildSoaPaper: buildSoaPaper, soaTemplates: S, templates: T, _V: V, paper: P, sections: SECTIONS, LETTERS: LETTERS, _n: n };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CF1Bank = api;
})(this);
