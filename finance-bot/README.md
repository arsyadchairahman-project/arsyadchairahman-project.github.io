# Finance Bot — catat keuangan lewat WhatsApp → Google Sheets → Dashboard + Saran

```
 WhatsApp (kamu)                Fonnte                Google Apps Script (gratis)            Google Sheets
 "makan siang 25rb"  ──►  webhook POST  ──►  doPost → parse → klasifikasi → simpan  ──►  Transaksi / Goals / Budget
        ▲                                         │                                        │
        └──── balasan: kategori, budget, ◄── kirimWA (Fonnte API)                          ▼
              progress goal                                                     Dashboard (grafik, KPI, saran)
                                                                                 └► Looker Studio / Tableau / Excel
```

- **Bot WA**: Fonnte (layanan WhatsApp gateway Indonesia, ada paket gratis).
- **Backend**: Google Apps Script yang menempel di spreadsheet. Tanpa server, tanpa biaya hosting.
- **Klasifikasi**: kata kunci (gratis, instan). Bisa ditambah AI (Claude) khusus untuk teks yang tidak dikenali.
- **Saran**: mesin aturan (saving rate, 50/30/20, budget, dana darurat, kelayakan goal) + opsional `saran ai`.

## Isi folder

| File | Isi |
|---|---|
| `apps-script/Config.gs` | Kategori, kata kunci, budget default. **Edit di sini** untuk menyesuaikan. |
| `apps-script/Parser.gs` | Baca nominal (`25rb`, `1,5jt`, `Rp25.000`), tanggal (`kemarin`, `tgl 3`), perintah, klasifikasi. |
| `apps-script/Advisor.gs` | Mesin saran keuangan. |
| `apps-script/Main.gs` | Webhook WA, perintah bot, baca/tulis Sheets, AI opsional, job terjadwal. |
| `apps-script/Setup.gs` | Membuat semua sheet, rumus, grafik dashboard, trigger. |
| `test/` | `node finance-bot/test/run-tests.js` dan `integration-test.js`. |

## Setup (±30 menit)

### 1. Spreadsheet + script
1. Buat Google Sheet baru, mis. "Keuangan Pribadi".
2. **Extensions → Apps Script**. Hapus `Code.gs`, buat 5 file script dengan nama sama seperti di `apps-script/` lalu salin isinya.
3. **Project Settings** → centang *Show "appsscript.json"* → salin isi `appsscript.json`.
4. Pilih fungsi `setupSpreadsheet` → **Run** → izinkan akses. Sheet Dashboard, Transaksi, Goals, Budget, Kategori, Log akan dibuat beserta grafik dan trigger (pengingat harian 21:00 & laporan bulanan tgl 1).
5. (Opsional) Menu **💰 Finance Bot → Isi data contoh** untuk melihat dashboard terisi; hapus lagi lewat menu yang sama.

### 2. Nomor WhatsApp bot (Fonnte)
1. Daftar di fonnte.com, tambah device, scan QR dengan **nomor WA kedua** (bukan nomor pribadimu — kamu mengirim pesan *ke* nomor ini).
2. Salin **token** device.

> Risiko yang perlu kamu tahu: Fonnte memakai koneksi WhatsApp Web (tidak resmi). Untuk bot pribadi bervolume kecil risikonya rendah, tapi nomor bisa saja diblokir WhatsApp. Karena itu pakai nomor cadangan. Alternatif resmi: WhatsApp Cloud API (Meta), tapi butuh akun Meta Business & template pesan, jauh lebih repot untuk pemakaian pribadi.

### 3. Script Properties
Apps Script → **Project Settings → Script Properties**:

| Key | Isi |
|---|---|
| `FONNTE_TOKEN` | token dari Fonnte |
| `OWNER_NUMBER` | nomor WA pribadimu, `628xxxxxxxxxx`. Hanya nomor ini yang dilayani. |
| `WEBHOOK_SECRET` | string acak panjang, mis. hasil password generator |
| `ANTHROPIC_API_KEY` | *(opsional)* untuk klasifikasi AI & `saran ai` |
| `CLAUDE_MODEL` | *(opsional)* default `claude-opus-5-5` |

### 4. Deploy webhook
1. **Deploy → New deployment → Web app**. Execute as: *Me*. Who has access: *Anyone*.
2. Salin URL web app, tambahkan `?key=<WEBHOOK_SECRET>`:
   `https://script.google.com/macros/s/AKfy.../exec?key=abc123...`
3. Di Fonnte → device → **Webhook** → tempel URL itu, aktifkan *autoread*.
4. Kirim `bantuan` dari nomor pribadimu ke nomor bot.

> Setiap mengubah kode: **Deploy → Manage deployments → Edit → Version: New version**. Kalau tidak, webhook tetap memakai versi lama.

## Cara pakai

```
makan siang 25rb
bensin 50rb kemarin
+gaji 8jt                    ← tanda + = pemasukan
nabung nikah 1jt             ← tabungan, otomatis masuk goal "Nikah"
dana darurat 500rb
beli sepatu 450k #lifestyle  ← paksa kategori
transfer 1jt @nikah          ← paksa goal
```
Beberapa baris dalam satu pesan = beberapa transaksi.

| Perintah | Fungsi |
|---|---|
| `saldo` | ringkasan bulan ini per kategori vs budget |
| `laporan` / `laporan 2026-10` | laporan bulanan + perbandingan bulan lalu + progress goal |
| `goal` · `goal tambah Nikah 120jt 2028-06` · `goal tambah Laptop 15jt 18 bulan` · `goal hapus Laptop` | kelola goal |
| `budget` · `budget makan 2jt` | lihat / ubah budget |
| `saran` · `saran ai` | saran keuangan |
| `riwayat` · `riwayat makan` | transaksi terbesar bulan ini |
| `ubah #transportasi` | koreksi kategori transaksi terakhir |
| `hapus` | hapus transaksi terakhir |

### Tiga tipe transaksi
- **Pemasukan**: gaji, bonus, freelance, dll.
- **Pengeluaran**: konsumsi (Makan & Minum, Transportasi, Lifestyle, Kebutuhan Rumah, Tagihan, Kesehatan, Pendidikan, Sosial, Cicilan, Lainnya).
- **Tabungan**: uang yang *dipindahkan*, bukan dihabiskan (Dana Tabungan → goal, Dana Darurat, Investasi). Dipisah agar saving rate & dashboard tidak menghitung tabungan sebagai "boros".

## Dashboard

Sheet **Dashboard** (ganti bulan di sel `B2`, mis. `2026-10`):
- KPI: pemasukan, pengeluaran, ditabung, sisa, saving rate, rasio keinginan, dana darurat (x pengeluaran bulanan).
- Tabel kategori vs budget (merah >100%, oranye >80%), donut chart per kategori.
- Tren 12 bulan (grafik kolom), progress goals (bar chart).
- Daftar saran, diperbarui otomatis tiap malam.

### Looker Studio / Tableau / Excel
Sumber data tunggal tetap sheet **Transaksi**. Jangan memelihara tiga dashboard sekaligus; pilih satu.
- **Looker Studio** (paling gampang, gratis, live): lookerstudio.google.com → Create → Data source → Google Sheets → pilih sheet `Transaksi`. Ubah `Jumlah` jadi Currency IDR, `Tanggal` jadi Date. Buat chart: scorecard (filter Tipe), donut per Kategori, time series per bulan.
- **Tableau Public**: Connect → Google Drive → pilih spreadsheet. Tableau Public menyegarkan data dari Google Sheets maksimal sekali sehari.
- **Excel**: File → Download → .xlsx untuk snapshot. Untuk yang tersambung: File → Share → Publish to web → sheet Transaksi → CSV, lalu di Excel **Data → From Web** (Power Query) tempel URL CSV → Refresh kapan saja.

## AI (opsional)
- Hanya dipanggil kalau kata kunci tidak cocok (kategori "tebakan") dan saat `saran ai`. Mayoritas transaksi tidak memakai AI.
- Biaya per panggilan kecil, tapi tetap berbayar per token. Bisa diganti model yang lebih murah lewat `CLAUDE_MODEL`.
- Data yang dikirim: deskripsi transaksi atau ringkasan angka bulanan. Tidak ada nomor WA.

## Keterbatasan yang perlu kamu tahu
- Kata kunci tidak sempurna: "grab" bisa transport atau makanan. Kalau salah, `ubah #makan`. Tambahkan kata kunci pribadimu di `Config.gs`; ini perbaikan paling murah dan paling efektif.
- Apps Script punya kuota harian (UrlFetch ±20.000/hari untuk akun gratis), jauh di atas pemakaian pribadi.
- Data rekening tidak tersinkron otomatis. Sistem ini hanya seakurat disiplinmu mencatat. Pengingat 21:00 ada untuk itu.

## Tes
```bash
node finance-bot/test/run-tests.js       # parser, klasifikasi, advisor
node finance-bot/test/integration-test.js # alur pesan WA → sheet (mock)
```
