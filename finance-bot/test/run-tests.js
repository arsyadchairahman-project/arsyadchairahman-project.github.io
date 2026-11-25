// Tes unit untuk logika murni (Config, Parser, Advisor). Jalankan: node finance-bot/test/run-tests.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, Date, Math, JSON });
for (const f of ['Config.gs', 'Parser.gs', 'Advisor.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8'), ctx, { filename: f });
}
const g = ctx;
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log('✗ ' + name + '\n   ' + e.message); }
}
const NOW = new Date(2026, 10, 25); // 25 Nov 2026
const goals = ['Nikah', 'Laptop', 'Dana Darurat'];
const P = (s) => g.parseTransaksi(s, { now: NOW, goals });

// --- Nominal ---
const nominal = {
  '25rb': 25000, '25k': 25000, '25 ribu': 25000, '1.5jt': 1500000, '1,5jt': 1500000, '2 juta': 2000000,
  'Rp25.000': 25000, 'rp 1.250.000': 1250000, '25000': 25000, '25,000': 25000, '8jt': 8000000, '120jt': 120000000
};
for (const [s, v] of Object.entries(nominal)) t('nominal ' + s, () => assert.strictEqual(g.parseNominal('x ' + s).amount, v));
t('nominal pilih yang bersufiks', () => assert.strictEqual(g.parseNominal('mie 2 bungkus 20rb').amount, 20000));
t('tanpa nominal', () => assert.strictEqual(g.parseNominal('makan siang'), null));
t('angka kecil bukan nominal', () => assert.strictEqual(g.parseNominal('beli 2 roti'), null));

// --- Klasifikasi ---
const kasus = [
  ['makan siang 25rb', 'Pengeluaran', 'Makan & Minum'],
  ['ngopi starbucks 55k', 'Pengeluaran', 'Makan & Minum'],
  ['bensin pertalite 50rb', 'Pengeluaran', 'Transportasi'],
  ['gojek ke kantor 18rb', 'Pengeluaran', 'Transportasi'],
  ['netflix 54rb', 'Pengeluaran', 'Lifestyle'],
  ['beli sepatu 450k', 'Pengeluaran', 'Lifestyle'],
  ['token listrik 200rb', 'Pengeluaran', 'Tagihan & Utilitas'],
  ['bayar kos 1.5jt', 'Pengeluaran', 'Tagihan & Utilitas'],
  ['obat flu 35rb', 'Pengeluaran', 'Kesehatan'],
  ['kondangan teman 200rb', 'Pengeluaran', 'Sosial & Donasi'],
  ['cicilan motor 900rb', 'Pengeluaran', 'Cicilan & Utang'],
  ['indomaret sabun odol 60rb', 'Pengeluaran', 'Kebutuhan Rumah'],
  ['sesuatu aneh 10rb', 'Pengeluaran', 'Lainnya'],
  ['gaji november 8jt', 'Pemasukan', 'Gaji'],
  ['+ freelance desain 1.5jt', 'Pemasukan', 'Freelance & Usaha'],
  ['bonus 2jt', 'Pemasukan', 'Bonus & THR'],
  ['+transfer dari ayah 500rb', 'Pemasukan', 'Hadiah & Lainnya'],
  ['cashback shopee 15rb', 'Pemasukan', 'Hadiah & Lainnya'],
  ['nabung nikah 1jt', 'Tabungan', 'Dana Tabungan'],
  ['dana darurat 500rb', 'Tabungan', 'Dana Darurat'],
  ['investasi reksadana 300rb', 'Tabungan', 'Investasi'],
  ['beli emas 1jt', 'Tabungan', 'Investasi'],
  ['bensin 50rb #lifestyle', 'Pengeluaran', 'Lifestyle'],
  ['transfer 1jt @nikah', 'Tabungan', 'Dana Tabungan'],
];
for (const [s, tipe, kat] of kasus) {
  t('klasifikasi "' + s + '"', () => {
    const r = P(s);
    assert.ok(r.ok, r.error);
    assert.strictEqual(r.tipe + ' / ' + r.kategori, tipe + ' / ' + kat);
  });
}
t('goal terdeteksi dari teks', () => assert.strictEqual(P('nabung nikah 1jt').goal, 'Nikah'));
t('goal dari @tag', () => assert.strictEqual(P('transfer 1jt @nikah').goal, 'Nikah'));
t('dana darurat jadi goal', () => assert.strictEqual(P('dana darurat 500rb').goal, 'Dana Darurat'));
t('deskripsi bersih', () => assert.strictEqual(P('makan siang 25rb').deskripsi, 'Makan siang'));
t('kemarin', () => assert.strictEqual(P('bensin 50rb kemarin').tanggal.getDate(), 24));
t('tgl eksplisit', () => assert.strictEqual(P('bensin 50rb tgl 3').tanggal.getDate(), 3));
t('tgl dd/mm', () => { const d = P('kos 1.5jt 01/11').tanggal; assert.strictEqual(d.getMonth() + '-' + d.getDate(), '10-1'); });
t('gagal tanpa nominal', () => assert.strictEqual(P('makan siang').ok, false));

// --- Perintah ---
t('perintah saldo', () => assert.strictEqual(g.parsePerintah('saldo').cmd, 'ringkasan'));
t('perintah /laporan', () => assert.strictEqual(g.parsePerintah('/laporan').cmd, 'laporan'));
t('perintah goal tambah', () => assert.strictEqual(g.parsePerintah('goal tambah Nikah 120jt 2028-06').cmd, 'goal'));
t('ganti oli = transaksi', () => assert.strictEqual(g.parsePerintah('ganti oli 50rb'), null));
t('ubah perintah', () => assert.strictEqual(g.parsePerintah('ubah #transportasi').cmd, 'ubah'));
t('bukan perintah', () => assert.strictEqual(g.parsePerintah('makan 20rb'), null));
t('cek kesehatan 300rb = transaksi', () => assert.strictEqual(g.parsePerintah('cek kesehatan 300rb'), null));
t('goal args', () => {
  const r = g.parseGoalArgs(['tambah', 'Nikah', '120jt', '2028-06'].slice(1), NOW);
  assert.strictEqual(r.nama, 'Nikah'); assert.strictEqual(r.target, 120000000);
  assert.strictEqual(r.deadline.getFullYear() + '-' + r.deadline.getMonth(), '2028-5');
});
t('goal args 18 bulan', () => {
  const r = g.parseGoalArgs(['Laptop', 'baru', '15jt', '18', 'bulan'], NOW);
  assert.strictEqual(r.nama, 'Laptop baru'); assert.strictEqual(g.selisihBulan(NOW, r.deadline), 18);
});

// --- Format ---
t('formatRupiah', () => assert.strictEqual(g.formatRupiah(1250000), 'Rp1.250.000'));
t('formatSingkat', () => assert.strictEqual(g.formatSingkat(1500000), '1,5jt'));

// --- Advisor ---
function trx(y, m, d, tipe, kategori, jumlah, goal) {
  const tanggal = new Date(y, m - 1, d);
  return { tanggal, bulan: g.kunciBulan(tanggal), tipe, kategori, jumlah, goal: goal || '' };
}
const data = [];
for (const m of [8, 9, 10]) {
  data.push(trx(2026, m, 1, 'Pemasukan', 'Gaji', 8000000));
  data.push(trx(2026, m, 5, 'Pengeluaran', 'Makan & Minum', 2000000));
  data.push(trx(2026, m, 5, 'Pengeluaran', 'Tagihan & Utilitas', 1500000));
  data.push(trx(2026, m, 6, 'Pengeluaran', 'Lifestyle', 1000000));
  data.push(trx(2026, m, 2, 'Tabungan', 'Dana Tabungan', 1000000, 'Nikah'));
}
data.push(trx(2026, 11, 1, 'Pemasukan', 'Gaji', 8000000));
data.push(trx(2026, 11, 10, 'Pengeluaran', 'Lifestyle', 2500000));
data.push(trx(2026, 11, 2, 'Tabungan', 'Dana Tabungan', 1000000, 'Nikah'));
const saran = g.buatSaran({
  now: NOW, transaksi: data, budget: { 'Lifestyle': 750000 },
  goals: [
    { nama: 'Nikah', target: 120000000, deadline: new Date(2028, 5, 1), terkumpul: 4000000 },
    { nama: 'Dana Darurat', target: 0, deadline: null, terkumpul: 2000000 }
  ]
});
const judul = saran.map(s => s.judul).join(' | ');
t('advisor: budget lifestyle jebol', () => assert.ok(/Budget Lifestyle jebol/.test(judul), judul));
t('advisor: saving rate < 20%', () => assert.ok(/Saving rate 13%/.test(judul), judul));
t('advisor: dana darurat kritis', () => assert.ok(/Dana darurat baru/.test(judul), judul));
t('advisor: goal nikah tertinggal', () => assert.ok(/Nikah: butuh .* tertinggal/.test(judul), judul));
t('advisor: urut kritis dulu', () => assert.strictEqual(saran[0].level, 1));
t('advisor: data kosong', () => assert.strictEqual(g.buatSaran({ now: NOW, transaksi: [] })[0].judul, 'Belum ada data'));
t('advisor: format WA', () => assert.ok(g.formatSaranWA(saran).startsWith('*💡 Saran Keuangan*')));

console.log(`\n${pass} lulus, ${fail} gagal`);
if (process.argv.includes('--show')) console.log('\n' + g.formatSaranWA(saran, 20));
process.exit(fail ? 1 : 0);
