/**
 * Mesin saran keuangan berbasis aturan (deterministik, gratis, bisa dites).
 * Input: data mentah dari sheet; Output: daftar saran berprioritas.
 *
 * data = {
 *   now: Date,
 *   transaksi: [{tanggal: Date, bulan: 'YYYY-MM', tipe, kategori, jumlah, goal}],
 *   goals: [{nama, target, deadline: Date|null, terkumpul}],
 *   budget: {kategori: nominal}
 * }
 */

var LEVEL = { KRITIS: 1, PERINGATAN: 2, INFO: 3 };
var IKON = { 1: '🔴', 2: '🟠', 3: '🟢' };

function statistikBulan(transaksi, key) {
  var s = { bulan: key, masuk: 0, keluar: 0, tabung: 0, perKategori: {}, perGoal: {}, jumlahTrx: 0 };
  transaksi.forEach(function (t) {
    if (t.bulan !== key) return;
    s.jumlahTrx++;
    if (t.tipe === TIPE.MASUK) s.masuk += t.jumlah;
    else if (t.tipe === TIPE.KELUAR) { s.keluar += t.jumlah; s.perKategori[t.kategori] = (s.perKategori[t.kategori] || 0) + t.jumlah; }
    else if (t.tipe === TIPE.TABUNG) {
      s.tabung += t.jumlah;
      s.perKategori[t.kategori] = (s.perKategori[t.kategori] || 0) + t.jumlah;
      if (t.goal) s.perGoal[t.goal] = (s.perGoal[t.goal] || 0) + t.jumlah;
    }
  });
  s.sisa = s.masuk - s.keluar - s.tabung;
  s.savingRate = s.masuk > 0 ? s.tabung / s.masuk : null;
  return s;
}

function bulanSebelumnya(now, n) {
  var out = [];
  for (var i = 1; i <= n; i++) out.push(kunciBulan(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}

/** Rata-rata dari bulan-bulan lalu yang punya data. */
function rataRata(transaksi, keys) {
  var list = keys.map(function (k) { return statistikBulan(transaksi, k); }).filter(function (s) { return s.jumlahTrx > 0; });
  var n = list.length;
  var r = { n: n, masuk: 0, keluar: 0, tabung: 0, perKategori: {}, perGoal: {} };
  if (!n) return r;
  list.forEach(function (s) {
    r.masuk += s.masuk / n; r.keluar += s.keluar / n; r.tabung += s.tabung / n;
    Object.keys(s.perKategori).forEach(function (k) { r.perKategori[k] = (r.perKategori[k] || 0) + s.perKategori[k] / n; });
    Object.keys(s.perGoal).forEach(function (g) { r.perGoal[g] = (r.perGoal[g] || 0) + s.perGoal[g] / n; });
  });
  return r;
}

function hariDalamBulan(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

function pct(x) { return Math.round(x * 100) + '%'; }

function buatSaran(data) {
  var now = data.now || new Date();
  var trx = data.transaksi || [];
  var goals = data.goals || [];
  var budget = data.budget || {};
  var keyIni = kunciBulan(now);
  var ini = statistikBulan(trx, keyIni);
  var avg = rataRata(trx, bulanSebelumnya(now, 3));
  var hariKe = now.getDate(), totalHari = hariDalamBulan(now);
  var progresBulan = hariKe / totalHari;
  var saran = [];
  function tambah(level, judul, isi) { saran.push({ level: level, judul: judul, isi: isi }); }

  // Basis pendapatan: bulan ini kalau sudah ada, kalau belum pakai rata-rata
  var incomeBasis = ini.masuk > 0 ? ini.masuk : avg.masuk;
  var keluarBasis = avg.n ? avg.keluar : (progresBulan > 0.3 ? ini.keluar / progresBulan : ini.keluar);

  if (!trx.length) {
    tambah(LEVEL.INFO, 'Belum ada data', 'Mulai catat transaksi lewat WA, mis. "makan siang 25rb" atau "+gaji 8jt". Saran butuh minimal 2–4 minggu data.');
    return urutkan(saran);
  }

  // 1. Pemasukan belum dicatat
  if (ini.masuk === 0 && hariKe > 7) {
    tambah(LEVEL.PERINGATAN, 'Pemasukan bulan ini belum tercatat',
      'Tanpa angka pemasukan, saving rate & kelayakan goal tidak bisa dihitung akurat. Catat: "+gaji 8jt".');
  }

  // 2. Arus kas negatif
  if (ini.masuk > 0 && ini.sisa < 0) {
    tambah(LEVEL.KRITIS, 'Arus kas bulan ini minus ' + formatRupiah(-ini.sisa),
      'Pengeluaran + tabungan melebihi pemasukan. Berarti kamu memakai saldo lama atau utang. Hentikan pengeluaran kategori keinginan sampai akhir bulan.');
  }

  // 3. Saving rate
  if (incomeBasis > 0) {
    var tabungBasis = ini.masuk > 0 ? ini.tabung : avg.tabung;
    var sr = tabungBasis / incomeBasis;
    var target20 = 0.2 * incomeBasis;
    if (sr < 0.1) {
      tambah(LEVEL.KRITIS, 'Saving rate ' + pct(sr) + ' (target minimal 20%)',
        'Sisihkan ' + formatRupiah(target20) + '/bulan DI AWAL bulan begitu gaji masuk (pay yourself first), bukan dari sisa. Sisa di akhir bulan hampir selalu nol.');
    } else if (sr < 0.2) {
      tambah(LEVEL.PERINGATAN, 'Saving rate ' + pct(sr) + ', belum 20%',
        'Kurang ' + formatRupiah(target20 - tabungBasis) + ' untuk mencapai 20%. Untuk target besar (menikah, rumah), idealnya 30%+.');
    } else {
      tambah(LEVEL.INFO, 'Saving rate ' + pct(sr) + ' — sehat', 'Pertahankan. Naikkan 1–2% tiap kenaikan gaji agar gaya hidup tidak ikut membengkak.');
    }

    // 4. 50/30/20
    var keb = 0, kei = 0;
    var sumberKat = ini.masuk > 0 ? ini.perKategori : avg.perKategori;
    KELOMPOK_KEBUTUHAN.forEach(function (k) { keb += sumberKat[k] || 0; });
    KELOMPOK_KEINGINAN.forEach(function (k) { kei += sumberKat[k] || 0; });
    if (kei / incomeBasis > 0.3) {
      tambah(LEVEL.PERINGATAN, 'Pengeluaran "keinginan" ' + pct(kei / incomeBasis) + ' dari pemasukan (batas 30%)',
        'Lifestyle/sosial/lainnya = ' + formatRupiah(kei) + '. Kelebihan ' + formatRupiah(kei - 0.3 * incomeBasis) + ' bisa langsung dialihkan ke goal.');
    }
    if (keb / incomeBasis > 0.5) {
      tambah(LEVEL.PERINGATAN, 'Kebutuhan pokok ' + pct(keb / incomeBasis) + ' dari pemasukan (ideal ≤50%)',
        'Ini masalah struktural (biaya tetap/pendapatan), bukan disiplin harian. Opsi: tekan biaya tetap terbesar (kos, cicilan, transport) atau naikkan pendapatan.');
    }
  }

  // 5. Budget per kategori (proyeksi sampai akhir bulan)
  Object.keys(budget).forEach(function (kat) {
    var b = budget[kat];
    if (!b) return;
    var pakai = ini.perKategori[kat] || 0;
    var proyeksi = progresBulan >= 0.25 ? pakai / progresBulan : pakai;
    var sisaHari = totalHari - hariKe + 1;
    if (pakai > b) {
      tambah(LEVEL.KRITIS, 'Budget ' + kat + ' jebol: ' + formatRupiah(pakai) + ' / ' + formatRupiah(b),
        'Lewat ' + formatRupiah(pakai - b) + '. Jangan "pinjam" dari kategori tabungan untuk menutupnya.');
    } else if (proyeksi > b * 1.1 && progresBulan >= 0.25) {
      tambah(LEVEL.PERINGATAN, 'Budget ' + kat + ' diproyeksikan jebol',
        'Terpakai ' + formatRupiah(pakai) + ' dari ' + formatRupiah(b) + ' (' + pct(pakai / b) + ') padahal bulan baru jalan ' + pct(progresBulan) +
        '. Jatah aman: ' + formatRupiah((b - pakai) / sisaHari) + '/hari untuk ' + sisaHari + ' hari tersisa.');
    }
  });

  // 6. Lonjakan kategori vs rata-rata 3 bulan
  if (avg.n >= 1 && progresBulan >= 0.4) {
    Object.keys(ini.perKategori).forEach(function (kat) {
      if (KATEGORI_TABUNG[kat]) return;
      var proy = ini.perKategori[kat] / progresBulan;
      var rata = avg.perKategori[kat] || 0;
      if (rata > 0 && proy > rata * 1.3 && proy - rata > 200000) {
        tambah(LEVEL.PERINGATAN, kat + ' naik ' + pct(proy / rata - 1) + ' dari rata-rata',
          'Proyeksi ' + formatRupiah(proy) + ' vs rata-rata ' + formatRupiah(rata) + '. Cek transaksi terbesarnya: "riwayat ' + kat.split(' ')[0].toLowerCase() + '".');
      }
    });
  }

  // 7. Dana darurat
  var dd = goals.filter(function (g) { return /darurat/i.test(g.nama); })[0];
  var ddTerkumpul = dd ? dd.terkumpul : 0;
  if (keluarBasis > 0) {
    var bulanAman = ddTerkumpul / keluarBasis;
    if (bulanAman < 3) {
      tambah(LEVEL.KRITIS, 'Dana darurat baru ' + bulanAman.toFixed(1).replace('.', ',') + 'x pengeluaran bulanan',
        'Minimal 3x (' + formatRupiah(3 * keluarBasis) + '), ideal 6x (' + formatRupiah(6 * keluarBasis) + '). ' +
        'Selesaikan ini SEBELUM mempercepat goal keinginan — tanpa dana darurat, satu kejadian tak terduga akan menguras tabungan nikah.');
    } else if (bulanAman < 6) {
      tambah(LEVEL.INFO, 'Dana darurat ' + bulanAman.toFixed(1).replace('.', ',') + 'x pengeluaran', 'Sudah aman minimal. Lanjutkan sampai 6x sambil mulai fokus ke goal.');
    }
  }

  // 8. Goals: kebutuhan per bulan vs kecepatan menabung aktual
  var totalButuh = 0;
  goals.forEach(function (g) {
    if (!g.target || /darurat/i.test(g.nama)) return;
    var sisa = Math.max(0, g.target - g.terkumpul);
    if (sisa === 0) { tambah(LEVEL.INFO, 'Goal ' + g.nama + ' TERCAPAI 🎉', 'Terkumpul ' + formatRupiah(g.terkumpul) + '. Tandai selesai atau naikkan targetnya.'); return; }
    var laju = avg.perGoal[g.nama] || 0;
    var lajuIni = (ini.perGoal[g.nama] || 0);
    if (!laju && lajuIni) laju = lajuIni;
    if (!g.deadline) {
      tambah(LEVEL.PERINGATAN, 'Goal ' + g.nama + ' tidak punya deadline',
        'Goal tanpa tanggal = keinginan, bukan rencana. Set: "goal tambah ' + g.nama + ' ' + formatSingkat(g.target) + ' 2028-06".' +
        (laju ? ' Dengan laju sekarang (' + formatRupiah(laju) + '/bln) tercapai dalam ' + Math.ceil(sisa / laju) + ' bulan.' : ''));
      return;
    }
    var bln = Math.max(1, selisihBulan(now, g.deadline));
    var butuh = sisa / bln;
    totalButuh += butuh;
    var label = g.nama + ': butuh ' + formatRupiah(butuh) + '/bln selama ' + bln + ' bln';
    if (laju >= butuh) {
      tambah(LEVEL.INFO, label, 'On track (laju ' + formatRupiah(laju) + '/bln). Progress ' + pct(g.terkumpul / g.target) + '.');
    } else {
      var eta = laju > 0 ? Math.ceil(sisa / laju) : null;
      tambah(bln <= 12 ? LEVEL.KRITIS : LEVEL.PERINGATAN, label + ' — tertinggal',
        'Laju aktual ' + formatRupiah(laju) + '/bln (kurang ' + formatRupiah(butuh - laju) + '/bln). ' +
        (eta ? 'Dengan laju ini baru tercapai ' + eta + ' bulan lagi, telat ' + (eta - bln) + ' bulan. ' : 'Belum ada setoran rutin ke goal ini. ') +
        'Pilihan jujurnya cuma 3: naikkan setoran, mundurkan deadline, atau kecilkan target.');
    }
  });

  // 9. Kelayakan total goals vs surplus
  if (totalButuh > 0 && incomeBasis > 0) {
    var surplus = incomeBasis - keluarBasis;
    if (totalButuh > surplus) {
      tambah(LEVEL.KRITIS, 'Semua goal butuh ' + formatRupiah(totalButuh) + '/bln, surplusmu cuma ' + formatRupiah(surplus),
        'Secara matematis target-targetmu tidak bisa dicapai bersamaan. Urutkan prioritas: dana darurat → goal dengan deadline terdekat & tidak bisa digeser (mis. menikah) → sisanya. Tunda goal keinginan (gadget, dll).');
    } else {
      tambah(LEVEL.INFO, 'Goal realistis', 'Total kebutuhan ' + formatRupiah(totalButuh) + '/bln masih di bawah surplus ' + formatRupiah(surplus) + '. Otomatiskan setorannya di tanggal gajian.');
    }
  }

  // 10. Kategori terbesar bulan ini
  var top = Object.keys(ini.perKategori).filter(function (k) { return !KATEGORI_TABUNG[k]; })
    .sort(function (a, b) { return ini.perKategori[b] - ini.perKategori[a]; }).slice(0, 3);
  if (top.length) {
    tambah(LEVEL.INFO, 'Pengeluaran terbesar bulan ini',
      top.map(function (k, i) { return (i + 1) + '. ' + k + ' ' + formatRupiah(ini.perKategori[k]); }).join('\n'));
  }

  return urutkan(saran);
}

function urutkan(saran) {
  return saran.sort(function (a, b) { return a.level - b.level; });
}

function formatSaranWA(saran, maks) {
  maks = maks || 8;
  var out = ['*💡 Saran Keuangan*', ''];
  saran.slice(0, maks).forEach(function (s) {
    out.push(IKON[s.level] + ' *' + s.judul + '*');
    out.push(s.isi);
    out.push('');
  });
  if (saran.length > maks) out.push('_(' + (saran.length - maks) + ' saran lain di sheet Dashboard)_');
  return out.join('\n').trim();
}
