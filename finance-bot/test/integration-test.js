// Simulasi alur pesan WA → Sheets dengan mock Apps Script (tanpa Setup/grafik).
// Jalankan: node finance-bot/test/integration-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function makeSheet(name) {
  const rows = [];
  const sh = {
    rows,
    getName: () => name,
    getLastRow: () => rows.length,
    appendRow: (r) => rows.push(r.map(v => (typeof v === 'string' && v[0] === "'") ? v.slice(1) : v)),
    deleteRow: (i) => rows.splice(i - 1, 1),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((rows[r - 1 + i] || [])[c - 1 + j]) ?? '')),
      setValues: (vals) => { vals.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((v, j) => rows[r - 1 + i][c - 1 + j] = v); }); return sh.getRange(r, c, nr, nc); },
      setValue: (v) => { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = v; },
      clearContent: () => {}
    })
  };
  return sh;
}
const sheets = {};
['Transaksi', 'Goals', 'Budget', 'Dashboard', 'Log'].forEach(n => sheets[n] = makeSheet(n));
sheets.Transaksi.rows.push(['ID']); sheets.Goals.rows.push(['Nama']); sheets.Budget.rows.push(['Kategori']);
const sent = [];
const props = { OWNER_NUMBER: '6281234567890', WEBHOOK_SECRET: 's3cret', FONNTE_TOKEN: 'tok' };
const ctx = vm.createContext({
  console, Date, Math, JSON,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] }), flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => { const c = {}; return { get: k => c[k], put: (k, v) => c[k] = v }; } },
  ContentService: { createTextOutput: s => ({ setMimeType() { return s; }, toString: () => s }), MimeType: { JSON: 'json' } },
  Utilities: {
    formatDate: (d, tz, f) => f.replace('yyyy', d.getFullYear()).replace('MM', String(d.getMonth() + 1).padStart(2, '0')).replace('dd', String(d.getDate()).padStart(2, '0')).replace('MMM', 'Nov').replace('yy', String(d.getFullYear()).slice(2)).replace('HH', '00').replace('mm', '00').replace('ss', '00'),
    base64Encode: s => Buffer.from(String(s)).toString('base64'), computeDigest: (a, s) => s, DigestAlgorithm: { MD5: 1 }
  },
  UrlFetchApp: { fetch: (url, opt) => { sent.push({ url, opt }); return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
  Logger: { log: () => {} }
});
for (const f of ['Config.gs', 'Parser.gs', 'Advisor.gs', 'Main.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8'), ctx, { filename: f });
}
// Goals sheet uses formulas in real Sheets; simulate "Terkumpul" by overriding bacaGoals
vm.runInContext(`bacaGoals = function () {
  var trx = bacaTransaksi();
  return SpreadsheetApp.getActive().getSheetByName('Goals').rows.slice(1).filter(function(r){return r[0];}).map(function (r) {
    var t = trx.filter(function (x) { return x.goal === r[0] && x.tipe === 'Tabungan'; }).reduce(function (a, x) { return a + x.jumlah; }, 0);
    return { nama: r[0], target: r[1] || 0, deadline: r[2] instanceof Date ? r[2] : null, terkumpul: t };
  });
};
DASH_SARAN_ROW = 33;`, ctx);
Object.entries({ 'Makan & Minum': 2000000, 'Lifestyle': 750000 }).forEach(([k, v]) => sheets.Budget.rows.push([k, v]));

let pass = 0;
function post(msg, sender = '081234567890', key = 's3cret') {
  sent.length = 0;
  ctx.doPost({ parameter: { key }, postData: { contents: JSON.stringify({ sender, message: msg }) } });
  return sent.map(s => s.opt.payload.message).join('\n');
}
function t(name, fn) { fn(); pass++; }
const H = (m) => vm.runInContext('handleMessage(' + JSON.stringify(m) + ')', ctx);

t('webhook tanpa secret ditolak', () => { assert.strictEqual(post('makan 20rb', '081234567890', 'salah'), ''); assert.strictEqual(sheets.Transaksi.rows.length, 1); });
t('nomor asing diabaikan', () => { assert.strictEqual(post('makan 20rb', '6289999'), ''); });
t('goal tambah', () => assert.match(post('goal tambah Nikah 120jt 2028-06'), /Goal \*Nikah\* dibuat/));
t('catat multi-baris', () => {
  const r = post('makan siang 25rb\nbensin 50rb kemarin\n+gaji 8jt\nnabung nikah 1jt\nbarang aneh 10rb');
  assert.match(r, /Tercatat 5 transaksi/); assert.match(r, /goal Nikah/); assert.match(r, /kategori tebakan/);
  assert.strictEqual(sheets.Transaksi.rows.length, 6);
});
t('ubah kategori terakhir', () => { assert.match(H('ubah #lifestyle'), /dipindah ke Lifestyle/); assert.strictEqual(sheets.Transaksi.rows[5][5], 'Lifestyle'); });
t('saldo', () => { const r = H('saldo'); assert.match(r, /Pemasukan\s+Rp8\.000\.000/); assert.match(r, /Sisa\s+Rp6\.915\.000/); });
t('goal list', () => assert.match(H('goal'), /Nikah[\s\S]*Rp1\.000\.000 \/ Rp120\.000\.000/));
t('budget set', () => { assert.match(H('budget makan 2.5jt'), /Makan & Minum = Rp2\.500\.000/); });
t('budget list', () => assert.match(H('budget'), /Makan & Minum: 25rb\/2,5jt/));
t('riwayat', () => assert.match(H('riwayat'), /Gaji/));
t('laporan', () => assert.match(H('laporan'), /Goals/));
t('saran', () => assert.match(H('saran'), /Saran Keuangan/));
t('saran ai tanpa key', () => assert.match(H('saran ai'), /belum aktif/));
t('hapus', () => { assert.match(H('hapus'), /Dihapus/); assert.strictEqual(sheets.Transaksi.rows.length, 5); });
t('tanpa nominal', () => assert.match(H('makan siang'), /Tidak ada yang tercatat/));
t('bantuan', () => assert.match(H('bantuan'), /cara pakai/));
t('jobHarian', () => { sent.length = 0; vm.runInContext('jobHarian()', ctx); });
t('jobBulanan', () => { sent.length = 0; vm.runInContext('jobBulanan()', ctx); assert.match(sent[0].opt.payload.message, /Saran/); });
console.log(pass + ' skenario integrasi lulus');
console.log('\n--- contoh balasan ---\n' + H('kopi 30rb\nnabung nikah 500rb'));
