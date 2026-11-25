/**
 * Parser & klasifikasi pesan. Semua fungsi di file ini murni (tanpa akses Sheets/HTTP)
 * supaya bisa dites di Node (lihat finance-bot/test).
 */

var SUFFIX_MULT = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6, m: 1e6, mio: 1e6, miliar: 1e9, milyar: 1e9, b: 1e9 };

/** Normalisasi teks: huruf kecil, simbol jadi spasi. */
function normalisasi(text) {
  return (' ' + String(text || '').toLowerCase().replace(/[^a-z0-9@#\-\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ');
}

/** Ubah "25.000" / "1,5" / "1.250.000" jadi angka, dengan tahu apakah ada sufiks (rb/jt). */
function angkaDariString(numStr, punyaSufiks) {
  var s = numStr;
  var seps = s.match(/[.,]/g) || [];
  if (seps.length === 0) return parseFloat(s);
  var parts = s.split(/[.,]/);
  var last = parts[parts.length - 1];
  var semuaGrupTiga = parts.slice(1).every(function (p) { return p.length === 3; });
  if (seps.length === 1 && (punyaSufiks || !semuaGrupTiga)) {
    // desimal: "1.5jt", "1,5jt", "2,25"
    return parseFloat(parts[0] + '.' + last);
  }
  if (semuaGrupTiga) return parseFloat(parts.join(''));
  // campuran seperti "1.250,50" -> anggap koma desimal gaya Indonesia
  var lastSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
  var idx = s.lastIndexOf(lastSep);
  return parseFloat(s.slice(0, idx).replace(/[.,]/g, '') + '.' + s.slice(idx + 1));
}

/**
 * Cari nominal di teks. Mengembalikan {amount, raw} atau null.
 * Prioritas: angka dengan sufiks (rb/jt) atau prefix Rp; kalau tidak ada, angka terbesar.
 */
function parseNominal(text) {
  var re = /(rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta|mio|miliar|milyar|m|b)?(?![a-z0-9])/gi;
  var m, kandidat = [];
  while ((m = re.exec(text)) !== null) {
    var suf = (m[3] || '').toLowerCase();
    var val = angkaDariString(m[2], !!suf);
    if (isNaN(val)) continue;
    if (suf) val = val * SUFFIX_MULT[suf];
    kandidat.push({ amount: Math.round(val), raw: m[0], kuat: !!(suf || m[1]), index: m.index });
  }
  if (!kandidat.length) return null;
  var kuat = kandidat.filter(function (k) { return k.kuat; });
  var pool = kuat.length ? kuat : kandidat;
  pool.sort(function (a, b) { return b.amount - a.amount; });
  // Angka < 100 tanpa sufiks hampir pasti bukan nominal (mis. "2 bungkus")
  if (!pool[0].kuat && pool[0].amount < 100) return null;
  return pool[0];
}

/** Tanggal relatif/eksplisit: "kemarin", "lusa kemarin", "tgl 12", "12/11", "12/11/2026". */
function parseTanggal(text, now) {
  var t = String(text).toLowerCase();
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var raw = null;
  var m;
  if (/\bkemarin lusa\b|\b2 hari lalu\b/.test(t)) { d.setDate(d.getDate() - 2); raw = t.match(/kemarin lusa|2 hari lalu/)[0]; }
  else if (/\bkemarin\b|\bkmrn\b|\bkmrin\b/.test(t)) { d.setDate(d.getDate() - 1); raw = t.match(/kemarin|kmrn|kmrin/)[0]; }
  else if ((m = t.match(/\b(?:tgl|tanggal)\s*(\d{1,2})\b/))) {
    d.setDate(parseInt(m[1], 10));
    if (d > now) d.setMonth(d.getMonth() - 1);
    raw = m[0];
  } else if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    var y = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (y < 100) y += 2000;
    d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    raw = m[0];
  }
  return { date: d, raw: raw };
}

/** Skor kecocokan kata kunci: frasa multi-kata diberi bobot lebih tinggi. */
function skorKataKunci(normText, keywords) {
  var best = 0, hit = null;
  for (var i = 0; i < keywords.length; i++) {
    var kw = keywords[i];
    if (normText.indexOf(' ' + kw + ' ') !== -1) {
      var s = kw.split(' ').length * 10 + kw.length;
      if (s > best) { best = s; hit = kw; }
    }
  }
  return { skor: best, kata: hit };
}

function kategoriTerbaik(normText, peta) {
  var best = { kategori: null, skor: 0, kata: null };
  Object.keys(peta).forEach(function (kat) {
    var r = skorKataKunci(normText, peta[kat]);
    if (r.skor > best.skor) best = { kategori: kat, skor: r.skor, kata: r.kata };
  });
  return best;
}

function samakan(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

/** Cocokkan "#transport" ke nama kategori resmi. */
function cariKategoriOverride(tag) {
  var t = samakan(tag);
  if (!t) return null;
  var peta = [[TIPE.KELUAR, KATEGORI_KELUAR], [TIPE.TABUNG, KATEGORI_TABUNG], [TIPE.MASUK, KATEGORI_MASUK]];
  for (var i = 0; i < peta.length; i++) {
    var names = Object.keys(peta[i][1]);
    for (var j = 0; j < names.length; j++) {
      var n = samakan(names[j]);
      if (n === t || n.indexOf(t) === 0 || (t.length >= 4 && n.indexOf(t) !== -1)) {
        return { tipe: peta[i][0], kategori: names[j] };
      }
    }
  }
  return null;
}

function cariGoal(normText, goalNames, tagGoal) {
  var list = goalNames || [];
  if (tagGoal) {
    var t = samakan(tagGoal);
    for (var i = 0; i < list.length; i++) if (samakan(list[i]).indexOf(t) === 0) return list[i];
  }
  for (var j = 0; j < list.length; j++) {
    var g = String(list[j]).toLowerCase();
    if (g && normText.indexOf(' ' + g + ' ') !== -1) return list[j];
    var firstWord = g.split(' ')[0];
    if (firstWord.length >= 4 && normText.indexOf(' ' + firstWord + ' ') !== -1) return list[j];
  }
  return null;
}

/**
 * Klasifikasi satu deskripsi transaksi.
 * @param {string} desc  teks (tanpa nominal)
 * @param {{goals?: string[], forceSign?: string, tagKategori?: string, tagGoal?: string}} opts
 * @return {{tipe, kategori, goal, yakin:boolean, metode:string, kata:string}}
 */
function klasifikasi(desc, opts) {
  opts = opts || {};
  var norm = normalisasi(desc);

  if (opts.tagKategori) {
    var o = cariKategoriOverride(opts.tagKategori);
    if (o) {
      var g0 = o.tipe === TIPE.TABUNG ? (cariGoal(norm, opts.goals, opts.tagGoal) || (o.kategori === 'Dana Darurat' ? 'Dana Darurat' : '')) : '';
      return { tipe: o.tipe, kategori: o.kategori, goal: g0, yakin: true, metode: 'manual', kata: '#' + opts.tagKategori };
    }
  }

  var goal = cariGoal(norm, opts.goals, opts.tagGoal);
  var tab = kategoriTerbaik(norm, KATEGORI_TABUNG);
  var adaKataTabung = skorKataKunci(norm, KATA_TABUNG).skor > 0;

  if (opts.forceSign !== '+' && (adaKataTabung || tab.skor > 0 || opts.tagGoal)) {
    var katTab = tab.kategori || 'Dana Tabungan';
    if (katTab === 'Dana Darurat' && !goal) goal = 'Dana Darurat';
    return { tipe: TIPE.TABUNG, kategori: katTab, goal: goal || '', yakin: true, metode: 'kata kunci', kata: tab.kata || 'tabung' };
  }

  var masuk = kategoriTerbaik(norm, KATEGORI_MASUK);
  var keluar = kategoriTerbaik(norm, KATEGORI_KELUAR);
  var sinyalMasuk = skorKataKunci(norm, KATA_MASUK).skor > 0;

  var isMasuk;
  if (opts.forceSign === '+') isMasuk = true;
  else if (opts.forceSign === '-') isMasuk = false;
  else if (sinyalMasuk && masuk.skor >= keluar.skor) isMasuk = true;
  else isMasuk = masuk.skor > keluar.skor;

  if (isMasuk) {
    return {
      tipe: TIPE.MASUK, kategori: masuk.kategori || 'Hadiah & Lainnya', goal: '',
      yakin: masuk.skor > 0, metode: 'kata kunci', kata: masuk.kata || ''
    };
  }
  return {
    tipe: TIPE.KELUAR, kategori: keluar.kategori || 'Lainnya', goal: '',
    yakin: keluar.skor > 0, metode: keluar.skor > 0 ? 'kata kunci' : 'default', kata: keluar.kata || ''
  };
}

/**
 * Parse satu baris transaksi, mis. "makan siang 25rb", "+gaji 8jt", "nabung nikah 500rb #tabungan",
 * "bensin 50rb kemarin", "beli sepatu 450k @nikah".
 * @return {{ok:boolean, error?:string, amount, tanggal, deskripsi, tipe, kategori, goal, yakin, metode}}
 */
function parseTransaksi(line, opts) {
  opts = opts || {};
  var now = opts.now || new Date();
  var text = String(line).trim();
  var forceSign = null;
  if (/^\+/.test(text)) { forceSign = '+'; text = text.slice(1).trim(); }
  else if (/^-\s*\D/.test(text)) { forceSign = '-'; text = text.slice(1).trim(); }

  var tagKat = (text.match(/#([a-z0-9&_\-]+)/i) || [])[1] || null;
  var tagGoal = (text.match(/@([a-z0-9_\-]+)/i) || [])[1] || null;
  var bersih = text.replace(/#[a-z0-9&_\-]+/ig, ' ').replace(/@[a-z0-9_\-]+/ig, ' ');

  var tgl = parseTanggal(bersih, now);
  if (tgl.raw) bersih = bersih.replace(new RegExp(tgl.raw.replace(/[\/]/g, '\\/'), 'i'), ' ');

  var nom = parseNominal(bersih);
  if (!nom) return { ok: false, error: 'Nominal tidak ditemukan. Contoh: "makan siang 25rb"' };
  if (nom.amount <= 0) return { ok: false, error: 'Nominal harus lebih dari 0.' };

  var deskripsi = bersih.slice(0, nom.index) + ' ' + bersih.slice(nom.index + nom.raw.length);
  deskripsi = deskripsi.replace(/\s+/g, ' ').trim();
  if (!deskripsi) deskripsi = tagKat || tagGoal || 'Tanpa keterangan';

  var k = klasifikasi(deskripsi + (tagGoal ? ' ' + tagGoal : ''), {
    goals: opts.goals, forceSign: forceSign, tagKategori: tagKat, tagGoal: tagGoal
  });

  return {
    ok: true, amount: nom.amount, tanggal: tgl.date, deskripsi: kapital(deskripsi),
    tipe: k.tipe, kategori: k.kategori, goal: k.goal, yakin: k.yakin, metode: k.metode
  };
}

/** Kenali perintah bot. Mengembalikan {cmd, args} atau null (berarti transaksi). */
function parsePerintah(text) {
  var t = String(text).trim().replace(/^[\/!.]/, '');
  var low = t.toLowerCase();
  var w = low.split(/\s+/);
  var first = w[0];
  var rest = t.split(/\s+/).slice(1);
  var map = {
    bantuan: 'bantuan', help: 'bantuan', menu: 'bantuan', start: 'bantuan',
    saldo: 'ringkasan', ringkasan: 'ringkasan', cek: 'ringkasan', status: 'ringkasan',
    laporan: 'laporan', report: 'laporan', rekap: 'laporan',
    goal: 'goal', goals: 'goal', target: 'goal', impian: 'goal',
    budget: 'budget', anggaran: 'budget',
    saran: 'saran', advice: 'saran', tips: 'saran',
    hapus: 'hapus', undo: 'hapus', batal: 'hapus',
    kategori: 'kategori', riwayat: 'riwayat', history: 'riwayat', ubah: 'ubah', koreksi: 'ubah'
  };
  if (!map[first]) return null;
  // "budget makan 2jt" adalah perintah; tapi "cek kesehatan 300rb"? Jika ada nominal & bukan budget/goal -> transaksi
  if (['ringkasan', 'bantuan', 'kategori', 'saran', 'hapus', 'ubah', 'riwayat'].indexOf(map[first]) !== -1 && parseNominal(t)) {
    if (!(map[first] === 'saran')) return null;
  }
  return { cmd: map[first], args: rest, raw: t };
}

/** "goal tambah Nikah 120jt 2028-06" / "goal tambah Laptop 15jt 12/2027" */
function parseGoalArgs(args, now) {
  var text = args.join(' ');
  var deadline = null, m;
  if ((m = text.match(/(\d{4})[-\/](\d{1,2})(?![\d])/))) { deadline = new Date(+m[1], +m[2] - 1, 1); text = text.replace(m[0], ' '); }
  else if ((m = text.match(/\b(\d{1,2})[-\/](\d{4})\b/))) { deadline = new Date(+m[2], +m[1] - 1, 1); text = text.replace(m[0], ' '); }
  else if ((m = text.match(/\b(\d{1,3})\s*(bulan|bln)\b/i))) {
    deadline = new Date(now.getFullYear(), now.getMonth() + parseInt(m[1], 10), 1); text = text.replace(m[0], ' ');
  } else if ((m = text.match(/\b(\d{1,2})\s*(tahun|thn)\b/i))) {
    deadline = new Date(now.getFullYear() + parseInt(m[1], 10), now.getMonth(), 1); text = text.replace(m[0], ' ');
  }
  var nom = parseNominal(text);
  if (!nom) return { ok: false, error: 'Format: goal tambah <nama> <target> <deadline>\nContoh: goal tambah Nikah 120jt 2028-06' };
  var nama = (text.slice(0, nom.index) + ' ' + text.slice(nom.index + nom.raw.length)).replace(/\s+/g, ' ').trim();
  if (!nama) return { ok: false, error: 'Nama goal kosong.' };
  return { ok: true, nama: kapital(nama), target: nom.amount, deadline: deadline };
}

function kapital(s) {
  s = String(s).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRupiah(n) {
  var neg = n < 0;
  var s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-Rp' : 'Rp') + s;
}

/** Format ringkas: 1,5jt / 250rb */
function formatSingkat(n) {
  var a = Math.abs(n), sign = n < 0 ? '-' : '';
  if (a >= 1e9) return sign + trimDes(a / 1e9) + 'M';
  if (a >= 1e6) return sign + trimDes(a / 1e6) + 'jt';
  if (a >= 1e3) return sign + trimDes(a / 1e3) + 'rb';
  return sign + a;
}
function trimDes(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }

function kunciBulan(d) {
  var m = d.getMonth() + 1;
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m;
}

var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function namaBulan(key) {
  var p = key.split('-');
  return NAMA_BULAN[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

/** Jumlah bulan dari `dari` ke `ke` (minimal 0), dihitung kalender. */
function selisihBulan(dari, ke) {
  return Math.max(0, (ke.getFullYear() - dari.getFullYear()) * 12 + (ke.getMonth() - dari.getMonth()));
}
