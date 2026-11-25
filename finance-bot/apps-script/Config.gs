/**
 * Konfigurasi kategori & kata kunci klasifikasi.
 * Edit daftar ini untuk menyesuaikan dengan kebiasaan belanjamu.
 * Kata kunci dicocokkan per kata (huruf kecil). Kata kunci multi-kata juga didukung.
 */

var TIPE = {
  MASUK: 'Pemasukan',
  KELUAR: 'Pengeluaran',
  TABUNG: 'Tabungan' // uang yang dipindah ke tabungan/goal/dana darurat/investasi, bukan konsumsi
};

var SHEET = {
  TRANSAKSI: 'Transaksi',
  GOALS: 'Goals',
  BUDGET: 'Budget',
  DASHBOARD: 'Dashboard',
  KATEGORI: 'Kategori',
  LOG: 'Log'
};

// Kategori pengeluaran (konsumsi)
var KATEGORI_KELUAR = {
  'Makan & Minum': ['makan', 'minum', 'kopi', 'ngopi', 'sarapan', 'lunch', 'dinner', 'makan siang', 'makan malam',
    'jajan', 'snack', 'gofood', 'grabfood', 'shopeefood', 'warteg', 'nasi', 'bakso', 'mie', 'ayam', 'sate',
    'boba', 'teh', 'starbucks', 'kfc', 'mcd', 'resto', 'restoran', 'cafe', 'kafe', 'martabak', 'roti', 'galon'],
  'Transportasi': ['bensin', 'pertalite', 'pertamax', 'bbm', 'ojol', 'gojek', 'grab', 'gocar', 'grabcar', 'maxim',
    'parkir', 'tol', 'etoll', 'e-toll', 'krl', 'mrt', 'lrt', 'transjakarta', 'busway', 'kereta', 'tiket kereta',
    'taksi', 'bluebird', 'servis motor', 'servis mobil', 'oli', 'ban', 'bus', 'angkot', 'pesawat'],
  'Lifestyle': ['nonton', 'bioskop', 'netflix', 'spotify', 'youtube premium', 'game', 'steam', 'topup', 'top up game',
    'baju', 'kaos', 'sepatu', 'celana', 'jaket', 'skincare', 'parfum', 'salon', 'pangkas', 'barbershop', 'cukur',
    'hobi', 'konser', 'liburan', 'jalan-jalan', 'hotel', 'staycation', 'gym', 'fitness', 'futsal', 'badminton',
    'langganan', 'subscription', 'shopee', 'tokopedia', 'lazada', 'tiktok shop', 'checkout', 'gadget', 'aksesoris'],
  'Kebutuhan Rumah': ['belanja bulanan', 'indomaret', 'alfamart', 'supermarket', 'sabun', 'sampo', 'shampoo',
    'odol', 'pasta gigi', 'deterjen', 'tisu', 'beras', 'minyak goreng', 'telur', 'sayur', 'pasar', 'laundry', 'gas elpiji', 'elpiji'],
  'Tagihan & Utilitas': ['listrik', 'pln', 'token listrik', 'air', 'pdam', 'internet', 'wifi', 'indihome', 'biznet',
    'pulsa', 'paket data', 'kuota', 'kos', 'kost', 'sewa', 'kontrakan', 'bpjs', 'iuran', 'asuransi', 'pajak'],
  'Kesehatan': ['obat', 'dokter', 'klinik', 'rumah sakit', 'apotek', 'vitamin', 'checkup', 'medical', 'gigi', 'kacamata'],
  'Pendidikan': ['kursus', 'buku', 'kuliah', 'ukt', 'spp', 'sertifikasi', 'ujian', 'udemy', 'coursera', 'bootcamp', 'seminar', 'workshop'],
  'Sosial & Donasi': ['sedekah', 'infaq', 'infak', 'zakat', 'donasi', 'kondangan', 'kado', 'hadiah untuk', 'traktir',
    'sumbangan', 'arisan', 'kasih orang tua', 'kirim ortu', 'orang tua', 'ortu'],
  'Cicilan & Utang': ['cicilan', 'kredit', 'paylater', 'spaylater', 'kartu kredit', 'bayar utang', 'utang', 'hutang', 'pinjol', 'angsuran', 'kpr'],
  'Lainnya': []
};

// Kategori alokasi tabungan (bukan konsumsi)
var KATEGORI_TABUNG = {
  'Dana Darurat': ['dana darurat', 'darurat', 'emergency'],
  'Investasi': ['investasi', 'reksadana', 'reksa dana', 'saham', 'emas', 'obligasi', 'sbn', 'deposito', 'crypto', 'kripto', 'bibit', 'ajaib'],
  'Dana Tabungan': ['nabung', 'tabung', 'tabungan', 'saving', 'simpan', 'sisihkan']
};

// Kategori pemasukan
var KATEGORI_MASUK = {
  'Gaji': ['gaji', 'gajian', 'salary', 'payroll'],
  'Bonus & THR': ['bonus', 'thr', 'insentif', 'komisi'],
  'Freelance & Usaha': ['freelance', 'project', 'proyek', 'fee', 'jualan', 'penjualan', 'usaha', 'honor', 'client', 'klien'],
  'Hasil Investasi': ['dividen', 'bunga', 'profit', 'capital gain', 'kupon'],
  'Hadiah & Lainnya': ['hadiah', 'angpao', 'cashback', 'refund', 'kembalian', 'dikasih', 'transfer masuk', 'terima', 'dapat']
};

// Kata yang menandakan pemasukan (selain kata kunci kategori pemasukan)
var KATA_MASUK = ['masuk', 'terima', 'dapat', 'dapet', 'diterima', 'income', 'pemasukan'];
// Kata yang menandakan alokasi ke tabungan
var KATA_TABUNG = ['nabung', 'tabung', 'sisihkan', 'simpan', 'alokasi', 'investasi', 'darurat', 'topup tabungan'];

// Budget default bulanan (Rp). Bisa diubah di sheet Budget atau via WA: "budget makan 2jt"
var BUDGET_DEFAULT = {
  'Makan & Minum': 2000000,
  'Transportasi': 600000,
  'Lifestyle': 750000,
  'Kebutuhan Rumah': 500000,
  'Tagihan & Utilitas': 800000,
  'Kesehatan': 200000,
  'Pendidikan': 200000,
  'Sosial & Donasi': 300000,
  'Cicilan & Utang': 0,
  'Lainnya': 300000
};

// Kelompok untuk aturan 50/30/20
var KELOMPOK_KEBUTUHAN = ['Makan & Minum', 'Transportasi', 'Kebutuhan Rumah', 'Tagihan & Utilitas', 'Kesehatan', 'Pendidikan', 'Cicilan & Utang'];
var KELOMPOK_KEINGINAN = ['Lifestyle', 'Sosial & Donasi', 'Lainnya'];

function semuaKategori() {
  return {
    Pemasukan: Object.keys(KATEGORI_MASUK),
    Pengeluaran: Object.keys(KATEGORI_KELUAR),
    Tabungan: Object.keys(KATEGORI_TABUNG)
  };
}
