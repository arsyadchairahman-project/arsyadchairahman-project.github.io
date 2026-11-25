/**
 * Entry point webhook WhatsApp (Fonnte) + perintah bot + akses Google Sheets.
 *
 * Script Properties yang wajib diisi (Project Settings → Script Properties):
 *   FONNTE_TOKEN      token device dari dashboard Fonnte
 *   OWNER_NUMBER      nomor WA kamu, format 628xxxxxxxxxx (hanya nomor ini yang dilayani)
 *   WEBHOOK_SECRET    string acak; ditempel di URL webhook: <url web app>?key=<WEBHOOK_SECRET>
 * Opsional:
 *   ANTHROPIC_API_KEY klasifikasi AI untuk teks ambigu + perintah "saran ai"
 *   CLAUDE_MODEL      default claude-opus-5-5
 */

function props() { return PropertiesService.getScriptProperties(); }
function prop(k, def) { var v = props().getProperty(k); return v == null || v === '' ? def : v; }
function ss() { return SpreadsheetApp.getActive() || SpreadsheetApp.openById(prop('SPREADSHEET_ID')); }
function tz() { return Session.getScriptTimeZone() || 'Asia/Jakarta'; }

// ===================== WEBHOOK =====================

function doGet(e) {
  return ContentService.createTextOutput('Finance bot aktif.');
}

function doPost(e) {
  try {
    if (prop('WEBHOOK_SECRET') && (!e.parameter || e.parameter.key !== prop('WEBHOOK_SECRET'))) {
      return ok_('forbidden');
    }
    var body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) { body = e.parameter || {}; }
    } else body = e.parameter || {};

    var sender = String(body.sender || body.pengirim || body.from || '').replace(/\D/g, '');
    var message = String(body.message || body.pesan || body.text || '').trim();
    if (!sender || !message) return ok_('ignored');
    if (body.member || /@g\.us$/.test(String(body.sender || ''))) return ok_('group ignored');
    if (normNomor(sender) !== normNomor(prop('OWNER_NUMBER', ''))) return ok_('not owner');

    // Cegah proses ganda jika Fonnte mengirim ulang
    var dedupKey = 'msg_' + (body.inboxid || body.id || Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sender + message + Math.floor(Date.now() / 20000))));
    var cache = CacheService.getScriptCache();
    if (cache.get(dedupKey)) return ok_('duplicate');
    cache.put(dedupKey, '1', 300);

    var reply = handleMessage(message);
    if (reply) kirimWA(sender, reply);
    return ok_('ok');
  } catch (err) {
    logError_(err);
    try { kirimWA(prop('OWNER_NUMBER'), '⚠️ Error bot: ' + err.message); } catch (e2) {}
    return ok_('error');
  }
}

function ok_(s) { return ContentService.createTextOutput(JSON.stringify({ status: s })).setMimeType(ContentService.MimeType.JSON); }
function normNomor(n) { n = String(n).replace(/\D/g, ''); if (n.indexOf('0') === 0) n = '62' + n.slice(1); return n; }

function kirimWA(target, message) {
  var token = prop('FONNTE_TOKEN');
  if (!token) { Logger.log('[WA → ' + target + ']\n' + message); return; }
  UrlFetchApp.fetch('https://api.fonnte.com/send', {
    method: 'post', headers: { Authorization: token },
    payload: { target: target, message: message, countryCode: '62' }, muteHttpExceptions: true
  });
}

function logError_(err) {
  var sh = ss().getSheetByName(SHEET.LOG);
  if (sh) sh.appendRow([new Date(), String(err && err.stack || err)]);
  Logger.log(err);
}

/** Uji dari editor tanpa WA: ubah teks lalu Run. */
function tesPesan() {
  Logger.log(handleMessage('makan siang 25rb\nbensin 50rb kemarin\n+gaji 8jt'));
}

// ===================== ROUTER =====================

function handleMessage(text) {
  var cmd = parsePerintah(text);
  if (cmd) {
    switch (cmd.cmd) {
      case 'bantuan': return teksBantuan();
      case 'ringkasan': return teksRingkasan(new Date());
      case 'laporan': return teksLaporan(cmd.args);
      case 'goal': return perintahGoal(cmd.args);
      case 'budget': return perintahBudget(cmd.args);
      case 'saran': return /\bai\b/i.test(cmd.args.join(' ')) ? saranAI() : formatSaranWA(buatSaran(kumpulkanData()));
      case 'hapus': return hapusTerakhir();
      case 'ubah': return ubahTerakhir(cmd.args.join(' '));
      case 'kategori': return teksKategori();
      case 'riwayat': return teksRiwayat(cmd.args.join(' '));
    }
  }
  return catatTransaksi(text);
}

// ===================== TRANSAKSI =====================

function catatTransaksi(text) {
  var lines = String(text).split(/\n+/).map(function (l) { return l.trim(); }).filter(String);
  var goals = bacaGoals().map(function (g) { return g.nama; });
  var hasil = [], gagal = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    lines.forEach(function (line) {
      var r = parseTransaksi(line, { goals: goals, now: new Date() });
      if (!r.ok) { gagal.push('• "' + line + '": ' + r.error); return; }
      if (!r.yakin) {
        var ai = klasifikasiAI(r.deskripsi, goals);
        if (ai) { r.tipe = ai.tipe; r.kategori = ai.kategori; r.goal = ai.goal || r.goal; r.metode = 'AI'; r.yakin = true; }
      }
      simpanTransaksi(r, line);
      hasil.push(r);
    });
  } finally { lock.releaseLock(); }

  if (!hasil.length) {
    return '❓ Tidak ada yang tercatat.\n' + gagal.join('\n') + '\n\nKetik *bantuan* untuk contoh format.';
  }
  var out = [];
  hasil.forEach(function (r) {
    var ikon = r.tipe === TIPE.MASUK ? '🟢' : r.tipe === TIPE.TABUNG ? '🏦' : '🔻';
    var tgl = Utilities.formatDate(r.tanggal, tz(), 'dd MMM');
    out.push(ikon + ' ' + r.deskripsi + ' *' + formatRupiah(r.amount) + '*\n   ' + r.kategori + (r.goal ? ' → goal ' + r.goal : '') + ' · ' + tgl +
      (r.yakin ? '' : '\n   ⚠️ kategori tebakan. Koreksi: *ubah #namakategori*'));
  });
  out.push('');
  out.push(statusSingkat(hasil));
  if (gagal.length) out.push('\nTidak tercatat:\n' + gagal.join('\n'));
  return '✅ Tercatat ' + hasil.length + ' transaksi\n\n' + out.join('\n');
}

function simpanTransaksi(r, pesanAsli) {
  var sh = ss().getSheetByName(SHEET.TRANSAKSI);
  var id = 'T' + Utilities.formatDate(new Date(), tz(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  sh.appendRow([id, new Date(), r.tanggal, "'" + kunciBulan(r.tanggal), r.tipe, r.kategori, r.deskripsi, r.amount, r.goal || '', r.metode, pesanAsli]);
}

/** Info budget/goal yang relevan setelah mencatat. */
function statusSingkat(hasil) {
  var data = kumpulkanData();
  var s = statistikBulan(data.transaksi, kunciBulan(new Date()));
  var baris = [];
  var katDisentuh = {};
  hasil.forEach(function (r) { if (r.tipe === TIPE.KELUAR) katDisentuh[r.kategori] = true; });
  Object.keys(katDisentuh).forEach(function (k) {
    var b = data.budget[k];
    if (!b) return;
    var p = s.perKategori[k] || 0;
    baris.push((p > b ? '🔴' : p > 0.8 * b ? '🟠' : '🟢') + ' Budget ' + k + ': ' + formatSingkat(p) + '/' + formatSingkat(b) + ' (' + Math.round(p / b * 100) + '%)');
  });
  hasil.forEach(function (r) {
    if (!r.goal) return;
    var g = data.goals.filter(function (x) { return x.nama === r.goal; })[0];
    if (g && g.target) baris.push('🎯 ' + g.nama + ': ' + formatSingkat(g.terkumpul) + '/' + formatSingkat(g.target) + ' (' + Math.round(g.terkumpul / g.target * 100) + '%)');
  });
  baris.push('💰 Sisa bulan ini: ' + formatRupiah(s.sisa));
  return baris.join('\n');
}

function barisTerakhir_() {
  var sh = ss().getSheetByName(SHEET.TRANSAKSI);
  var last = sh.getLastRow();
  if (last < 2) return null;
  return { sh: sh, row: last, values: sh.getRange(last, 1, 1, 11).getValues()[0] };
}

function hapusTerakhir() {
  var t = barisTerakhir_();
  if (!t) return 'Belum ada transaksi.';
  t.sh.deleteRow(t.row);
  return '🗑️ Dihapus: ' + t.values[6] + ' ' + formatRupiah(t.values[7]) + ' (' + t.values[5] + ')';
}

function ubahTerakhir(arg) {
  var t = barisTerakhir_();
  if (!t) return 'Belum ada transaksi.';
  var tag = (arg.match(/#?([a-z0-9&_\-]+)/i) || [])[1];
  var o = tag && cariKategoriOverride(tag);
  if (!o) return 'Format: *ubah #kategori*\n\n' + teksKategori();
  var goal = (arg.match(/@([a-z0-9_\-]+)/i) || [])[1] || '';
  t.sh.getRange(t.row, 5, 1, 2).setValues([[o.tipe, o.kategori]]);
  if (goal || o.tipe !== TIPE.TABUNG) t.sh.getRange(t.row, 9).setValue(goal ? kapital(goal) : '');
  t.sh.getRange(t.row, 10).setValue('manual');
  return '✏️ "' + t.values[6] + '" dipindah ke ' + o.kategori + ' (' + o.tipe + ')';
}

// ===================== BACA DATA =====================

function bacaTransaksi() {
  var sh = ss().getSheetByName(SHEET.TRANSAKSI);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 11).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    var tgl = r[2] instanceof Date ? r[2] : new Date(r[2]);
    return { id: r[0], tanggal: tgl, bulan: String(r[3]) || kunciBulan(tgl), tipe: r[4], kategori: r[5], deskripsi: r[6], jumlah: Number(r[7]) || 0, goal: r[8] };
  });
}

function bacaGoals() {
  var sh = ss().getSheetByName(SHEET.GOALS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return { nama: String(r[0]), target: Number(r[1]) || 0, deadline: r[2] instanceof Date ? r[2] : null, terkumpul: Number(r[3]) || 0 };
  });
}

function bacaBudget() {
  var sh = ss().getSheetByName(SHEET.BUDGET);
  var out = {};
  var last = sh.getLastRow();
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) { if (r[0]) out[r[0]] = Number(r[1]) || 0; });
  return out;
}

function kumpulkanData() {
  SpreadsheetApp.flush();
  return { now: new Date(), transaksi: bacaTransaksi(), goals: bacaGoals(), budget: bacaBudget() };
}

// ===================== PERINTAH =====================

function teksBantuan() {
  return [
    '*🤖 Bot Keuangan — cara pakai*', '',
    '*Catat transaksi* (bisa beberapa baris sekaligus):',
    '• makan siang 25rb', '• bensin 50rb kemarin', '• +gaji 8jt  _(tanda + = pemasukan)_',
    '• nabung nikah 1jt  _(masuk ke goal Nikah)_', '• dana darurat 500rb', '• beli sepatu 450k #lifestyle  _(paksa kategori)_',
    '• transfer 1jt @nikah  _(paksa goal)_', '',
    '*Perintah:*',
    '• *saldo* — ringkasan bulan ini', '• *laporan* / *laporan 2026-10* — laporan bulanan',
    '• *goal* — daftar goal', '• *goal tambah Nikah 120jt 2028-06*', '• *goal hapus Laptop*',
    '• *budget* / *budget makan 2jt*', '• *saran* — saran keuangan  · *saran ai* — analisis AI',
    '• *riwayat* / *riwayat makan*', '• *ubah #transportasi* — koreksi kategori transaksi terakhir',
    '• *hapus* — hapus transaksi terakhir', '• *kategori* — daftar kategori'
  ].join('\n');
}

function teksKategori() {
  var k = semuaKategori();
  return '*Kategori*\n\n🔻 Pengeluaran:\n' + k.Pengeluaran.join(', ') + '\n\n🏦 Tabungan:\n' + k.Tabungan.join(', ') + '\n\n🟢 Pemasukan:\n' + k.Pemasukan.join(', ') +
    '\n\nPakai #kata-awal, mis. #makan, #transport, #tagihan, #darurat';
}

function teksRingkasan(now) {
  var data = kumpulkanData();
  var key = kunciBulan(now);
  var s = statistikBulan(data.transaksi, key);
  var out = ['*📊 ' + namaBulan(key) + '*', '',
    '🟢 Pemasukan   ' + formatRupiah(s.masuk), '🔻 Pengeluaran ' + formatRupiah(s.keluar), '🏦 Ditabung    ' + formatRupiah(s.tabung),
    '💰 *Sisa        ' + formatRupiah(s.sisa) + '*',
    s.savingRate != null ? '📈 Saving rate ' + Math.round(s.savingRate * 100) + '%' : '', ''];
  var kat = Object.keys(s.perKategori).filter(function (k) { return !KATEGORI_TABUNG[k]; })
    .sort(function (a, b) { return s.perKategori[b] - s.perKategori[a]; });
  if (kat.length) {
    out.push('*Per kategori:*');
    kat.forEach(function (k) {
      var b = data.budget[k];
      out.push('• ' + k + ': ' + formatSingkat(s.perKategori[k]) + (b ? ' / ' + formatSingkat(b) + ' (' + Math.round(s.perKategori[k] / b * 100) + '%)' : ''));
    });
  }
  return out.filter(function (x, i, a) { return x !== '' || a[i - 1] !== ''; }).join('\n');
}

function teksLaporan(args) {
  var key = (args.join(' ').match(/\d{4}-\d{2}/) || [])[0];
  var now = new Date();
  var d = key ? new Date(+key.slice(0, 4), +key.slice(5) - 1, 15) : now;
  var data = kumpulkanData();
  var k = kunciBulan(d);
  var s = statistikBulan(data.transaksi, k);
  var prev = statistikBulan(data.transaksi, kunciBulan(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
  function delta(a, b) { return b ? ' (' + (a >= b ? '+' : '') + Math.round((a - b) / b * 100) + '% vs bln lalu)' : ''; }
  var out = [teksRingkasan(d), '',
    'Pengeluaran' + delta(s.keluar, prev.keluar), 'Tabungan' + delta(s.tabung, prev.tabung), '', '*🎯 Goals*'];
  data.goals.forEach(function (g) {
    if (!g.target) { out.push('• ' + g.nama + ': ' + formatRupiah(g.terkumpul)); return; }
    out.push('• ' + g.nama + ': ' + progressBar(g.terkumpul / g.target) + ' ' + Math.round(g.terkumpul / g.target * 100) + '% (' + formatSingkat(g.terkumpul) + '/' + formatSingkat(g.target) + ')');
  });
  return out.join('\n');
}

function progressBar(p) {
  p = Math.max(0, Math.min(1, p));
  var n = Math.round(p * 10);
  return '▓'.repeat(n) + '░'.repeat(10 - n);
}

function teksRiwayat(filter) {
  var key = kunciBulan(new Date());
  var f = filter ? samakan(filter) : '';
  var list = bacaTransaksi().filter(function (t) {
    return t.bulan === key && (!f || samakan(t.kategori).indexOf(f) === 0 || samakan(t.deskripsi).indexOf(f) !== -1);
  }).sort(function (a, b) { return b.jumlah - a.jumlah; }).slice(0, 15);
  if (!list.length) return 'Tidak ada transaksi' + (filter ? ' "' + filter + '"' : '') + ' bulan ini.';
  return '*Riwayat ' + (filter || 'bulan ini') + ' (terbesar dulu)*\n' + list.map(function (t) {
    return '• ' + Utilities.formatDate(t.tanggal, tz(), 'dd/MM') + ' ' + t.deskripsi + ' ' + formatSingkat(t.jumlah) + ' _' + t.kategori + '_';
  }).join('\n');
}

function perintahGoal(args) {
  var sub = (args[0] || '').toLowerCase();
  var sh = ss().getSheetByName(SHEET.GOALS);
  if (sub === 'tambah' || sub === 'add' || sub === 'baru') {
    var g = parseGoalArgs(args.slice(1), new Date());
    if (!g.ok) return g.error;
    var ada = bacaGoals().map(function (x) { return x.nama.toLowerCase(); }).indexOf(g.nama.toLowerCase());
    if (ada !== -1) {
      sh.getRange(ada + 2, 2, 1, 2).setValues([[g.target, g.deadline || '']]);
      return '✏️ Goal ' + g.nama + ' diperbarui: ' + formatRupiah(g.target) + (g.deadline ? ' sebelum ' + Utilities.formatDate(g.deadline, tz(), 'MMM yyyy') : '');
    }
    tambahGoalRow(sh, g.nama, g.target, g.deadline);
    var bln = g.deadline ? Math.max(1, selisihBulan(new Date(), g.deadline)) : 0;
    return '🎯 Goal *' + g.nama + '* dibuat: ' + formatRupiah(g.target) +
      (bln ? '\nButuh ' + formatRupiah(g.target / bln) + '/bulan selama ' + bln + ' bulan.' : '\n⚠️ Tanpa deadline — tambahkan agar bisa dihitung kebutuhan per bulan.') +
      '\nSetor dengan: *nabung ' + g.nama.toLowerCase() + ' 500rb*';
  }
  if (sub === 'hapus' || sub === 'delete') {
    var nama = args.slice(1).join(' ').toLowerCase();
    var goals = bacaGoals();
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].nama.toLowerCase() === nama) { sh.deleteRow(i + 2); return '🗑️ Goal ' + goals[i].nama + ' dihapus (transaksi tabungannya tetap ada).'; }
    }
    return 'Goal "' + nama + '" tidak ditemukan.';
  }
  var list = bacaGoals();
  if (!list.length) return 'Belum ada goal. Contoh: *goal tambah Nikah 120jt 2028-06*';
  var now = new Date();
  return '*🎯 Goals*\n\n' + list.map(function (g) {
    if (!g.target) return '• *' + g.nama + '*: ' + formatRupiah(g.terkumpul) + ' terkumpul';
    var sisa = Math.max(0, g.target - g.terkumpul);
    var bln = g.deadline ? Math.max(1, selisihBulan(now, g.deadline)) : null;
    return '• *' + g.nama + '*\n  ' + progressBar(g.terkumpul / g.target) + ' ' + Math.round(g.terkumpul / g.target * 100) + '%\n  ' +
      formatRupiah(g.terkumpul) + ' / ' + formatRupiah(g.target) +
      (bln ? '\n  Butuh ' + formatRupiah(sisa / bln) + '/bln · ' + bln + ' bln lagi' : '');
  }).join('\n\n');
}

function tambahGoalRow(sh, nama, target, deadline) {
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, 10).setValues([[nama, target, deadline || '',
    '=SUMIFS(Transaksi!H:H,Transaksi!I:I,A' + r + ',Transaksi!E:E,"Tabungan")',
    '=IF(B' + r + '>0,MAX(0,B' + r + '-D' + r + '),"")',
    '=IF(C' + r + '="","",MAX(1,DATEDIF(TODAY(),C' + r + ',"M")))',
    '=IF(OR(C' + r + '="",B' + r + '=0),"",E' + r + '/F' + r + ')',
    '=IF(B' + r + '>0,MIN(1,D' + r + '/B' + r + '),"")',
    '=IF(B' + r + '=0,"",IF(D' + r + '>=B' + r + ',"✅ Tercapai",IF(C' + r + '="","Tanpa deadline","Berjalan")))',
    new Date()]]);
}

function perintahBudget(args) {
  var sh = ss().getSheetByName(SHEET.BUDGET);
  var text = args.join(' ');
  var nom = parseNominal(text);
  if (nom) {
    var tag = text.slice(0, nom.index).trim();
    var o = cariKategoriOverride(tag);
    if (!o || o.tipe !== TIPE.KELUAR) return 'Kategori "' + tag + '" tidak dikenal. Contoh: *budget makan 2jt*';
    var rows = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === o.kategori) { sh.getRange(i + 2, 2).setValue(nom.amount); return '✅ Budget ' + o.kategori + ' = ' + formatRupiah(nom.amount) + '/bulan'; }
    }
    return 'Kategori tidak ada di sheet Budget.';
  }
  var data = kumpulkanData();
  var s = statistikBulan(data.transaksi, kunciBulan(new Date()));
  var total = 0;
  var out = Object.keys(data.budget).filter(function (k) { return data.budget[k] > 0; }).map(function (k) {
    var b = data.budget[k], p = s.perKategori[k] || 0; total += b;
    return (p > b ? '🔴' : p > 0.8 * b ? '🟠' : '🟢') + ' ' + k + ': ' + formatSingkat(p) + '/' + formatSingkat(b) + ' (' + Math.round(p / b * 100) + '%)';
  });
  return '*Budget bulan ini*\n' + out.join('\n') + '\n\nTotal budget: ' + formatRupiah(total) + '\nUbah: *budget makan 2jt*';
}

// ===================== AI (opsional, Claude API) =====================
// Apps Script tidak punya SDK Anthropic, jadi dipanggil via HTTP (UrlFetchApp).

function panggilClaude_(payload) {
  var key = prop('ANTHROPIC_API_KEY');
  if (!key) return null;
  payload.model = prop('CLAUDE_MODEL', 'claude-opus-5-5');
  payload.fallbacks = 'default';
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(payload)
  });
  if (res.getResponseCode() !== 200) { logError_('Claude API ' + res.getResponseCode() + ': ' + res.getContentText()); return null; }
  var msg = JSON.parse(res.getContentText());
  if (msg.stop_reason === 'refusal') return null;
  var teks = (msg.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  return teks || null;
}

/** Dipanggil hanya jika kata kunci tidak cocok. Mengembalikan {tipe, kategori, goal} atau null. */
function klasifikasiAI(deskripsi, goals) {
  if (!prop('ANTHROPIC_API_KEY')) return null;
  var k = semuaKategori();
  var semua = k.Pengeluaran.concat(k.Tabungan, k.Pemasukan);
  var teks = panggilClaude_({
    max_tokens: 2000,
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object', additionalProperties: false, required: ['tipe', 'kategori', 'goal'],
          properties: {
            tipe: { type: 'string', enum: [TIPE.KELUAR, TIPE.TABUNG, TIPE.MASUK] },
            kategori: { type: 'string', enum: semua },
            goal: { type: 'string', description: 'Nama goal dari daftar jika transaksi adalah setoran ke goal tsb, selain itu string kosong' }
          }
        }
      }
    },
    system: 'Kamu mengklasifikasikan catatan keuangan pribadi berbahasa Indonesia (sering singkatan/slang). ' +
      'Kategori Pengeluaran: ' + k.Pengeluaran.join(', ') + '. Kategori Tabungan (uang disisihkan, bukan dikonsumsi): ' + k.Tabungan.join(', ') +
      '. Kategori Pemasukan: ' + k.Pemasukan.join(', ') + '. Kategori harus sesuai tipenya. Goal yang ada: ' + (goals.join(', ') || '(tidak ada)') + '.',
    messages: [{ role: 'user', content: 'Catatan: "' + deskripsi + '"' }]
  });
  if (!teks) return null;
  try {
    var r = JSON.parse(teks);
    var valid = (k[r.tipe] || []).indexOf(r.kategori) !== -1;
    return valid ? r : null;
  } catch (e) { return null; }
}

/** Analisis naratif dari AI berdasarkan angka & saran berbasis aturan. */
function saranAI() {
  if (!prop('ANTHROPIC_API_KEY')) return 'Saran AI belum aktif (isi ANTHROPIC_API_KEY di Script Properties). Ini saran berbasis aturan:\n\n' + formatSaranWA(buatSaran(kumpulkanData()));
  var data = kumpulkanData();
  var now = data.now;
  var bulan = [0, 1, 2, 3].map(function (i) { return statistikBulan(data.transaksi, kunciBulan(new Date(now.getFullYear(), now.getMonth() - i, 1))); });
  var ringkas = {
    hari_ini: Utilities.formatDate(now, tz(), 'yyyy-MM-dd'),
    bulan: bulan.map(function (s) { return { bulan: s.bulan, pemasukan: s.masuk, pengeluaran: s.keluar, ditabung: s.tabung, per_kategori: s.perKategori, per_goal: s.perGoal }; }),
    budget: data.budget,
    goals: data.goals.map(function (g) { return { nama: g.nama, target: g.target, terkumpul: g.terkumpul, deadline: g.deadline ? Utilities.formatDate(g.deadline, tz(), 'yyyy-MM') : null }; }),
    temuan_aturan: buatSaran(data).map(function (s) { return s.judul; })
  };
  var teks = panggilClaude_({
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: 'Kamu penasihat keuangan pribadi yang lugas dan jujur untuk orang Indonesia usia produktif. Jangan memuji berlebihan. ' +
      'Berdasarkan data JSON, tulis maksimal 6 poin saran berurutan prioritas, masing-masing dengan angka Rupiah konkret dan tindakan spesifik minggu ini. ' +
      'Jika target tidak realistis, katakan terus terang dan beri alternatif (perpanjang deadline, kecilkan target, tambah pemasukan). ' +
      'Format WhatsApp: *tebal* untuk judul poin, tanpa tabel, tanpa markdown heading, maksimal 1500 karakter.',
    messages: [{ role: 'user', content: JSON.stringify(ringkas) }]
  });
  return teks ? '*🧠 Saran AI*\n\n' + teks : 'Gagal memanggil AI. Saran berbasis aturan:\n\n' + formatSaranWA(buatSaran(data));
}

// ===================== TERJADWAL =====================

/** Harian 21:00 — ingatkan jika belum ada catatan hari ini, dan segarkan saran di Dashboard. */
function jobHarian() {
  perbaruiSaranDashboard();
  var today = Utilities.formatDate(new Date(), tz(), 'yyyyMMdd');
  var ada = bacaTransaksi().some(function (t) { return Utilities.formatDate(t.tanggal, tz(), 'yyyyMMdd') === today; });
  if (!ada) kirimWA(prop('OWNER_NUMBER'), '📝 Belum ada catatan hari ini. Ada pengeluaran yang terlewat? Balas langsung, mis. "makan 25rb".');
}

/** Tanggal 1 jam 08:00 — laporan bulan lalu + saran. */
function jobBulanan() {
  var now = new Date();
  var lalu = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  kirimWA(prop('OWNER_NUMBER'), teksLaporan([kunciBulan(lalu)]) + '\n\n' + formatSaranWA(buatSaran(kumpulkanData()), 5));
}

function perbaruiSaranDashboard() {
  var sh = ss().getSheetByName(SHEET.DASHBOARD);
  var saran = buatSaran(kumpulkanData());
  var start = DASH_SARAN_ROW;
  sh.getRange(start, 1, 30, 3).clearContent();
  var rows = saran.slice(0, 30).map(function (s) { return [IKON[s.level], s.judul, s.isi]; });
  if (rows.length) sh.getRange(start, 1, rows.length, 3).setValues(rows);
  sh.getRange(start - 1, 3).setValue('Diperbarui ' + Utilities.formatDate(new Date(), tz(), 'dd MMM yyyy HH:mm'));
}
