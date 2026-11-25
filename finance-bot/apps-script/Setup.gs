/**
 * Jalankan setupSpreadsheet() SEKALI dari editor Apps Script.
 * Aman dijalankan ulang: data Transaksi/Goals/Budget yang sudah ada tidak dihapus.
 */

var DASH_SARAN_ROW = 33;
var WARNA = { header: '#1f3a5f', headerText: '#ffffff', masuk: '#2e7d32', keluar: '#c62828', tabung: '#1565c0', soft: '#f3f6fa' };

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💰 Finance Bot')
    .addItem('Perbarui saran di Dashboard', 'perbaruiSaranDashboard')
    .addItem('Setup / perbaiki sheet', 'setupSpreadsheet')
    .addSeparator()
    .addItem('Isi data contoh (demo)', 'isiContohData')
    .addItem('Hapus data contoh', 'hapusContohData')
    .addToUi();
}

function setupSpreadsheet() {
  var book = ss();
  book.setSpreadsheetTimeZone('Asia/Jakarta');
  props().setProperty('SPREADSHEET_ID', book.getId());
  // Buat semua sheet dulu agar rumus lintas-sheet tidak #REF!
  [SHEET.DASHBOARD, SHEET.TRANSAKSI, SHEET.GOALS, SHEET.BUDGET, SHEET.KATEGORI, SHEET.LOG].forEach(function (n) {
    if (!book.getSheetByName(n)) book.insertSheet(n);
  });
  book.setActiveSheet(book.getSheetByName(SHEET.DASHBOARD));
  book.moveActiveSheet(1);
  setupTransaksi_(book);
  setupGoals_(book);
  setupBudget_(book);
  setupKategori_(book);
  setupLog_(book);
  setupDashboard_(book);
  var def = book.getSheetByName('Sheet1') || book.getSheetByName('Lembar1');
  if (def && book.getSheets().length > 1 && def.getLastRow() === 0) book.deleteSheet(def);
  pasangTrigger();
  perbaruiSaranDashboard();
  book.setActiveSheet(book.getSheetByName(SHEET.DASHBOARD));
}

function sheetBaru_(book, nama, headers) {
  var sh = book.getSheetByName(nama) || book.insertSheet(nama);
  if (headers) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground(WARNA.header).setFontColor(WARNA.headerText);
    sh.setFrozenRows(1);
  }
  return sh;
}

function setupTransaksi_(book) {
  var sh = sheetBaru_(book, SHEET.TRANSAKSI, ['ID', 'Dicatat', 'Tanggal', 'Bulan', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah', 'Goal', 'Metode', 'Pesan asli']);
  sh.getRange('B:B').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange('C:C').setNumberFormat('dd/mm/yyyy');
  sh.getRange('D:D').setNumberFormat('@');
  sh.getRange('H:H').setNumberFormat('"Rp"#,##0');
  var k = semuaKategori();
  sh.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([TIPE.MASUK, TIPE.KELUAR, TIPE.TABUNG]).build());
  sh.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(k.Pengeluaran.concat(k.Tabungan, k.Pemasukan)).build());
  sh.setColumnWidths(1, 11, 110); sh.setColumnWidth(7, 220); sh.setColumnWidth(11, 260);
  var rules = [
    [TIPE.MASUK, '#e8f5e9'], [TIPE.TABUNG, '#e3f2fd']
  ].map(function (r) {
    return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$E2="' + r[0] + '"').setBackground(r[1]).setRanges([sh.getRange('A2:K')]).build();
  });
  sh.setConditionalFormatRules(rules);
}

function setupGoals_(book) {
  var sh = sheetBaru_(book, SHEET.GOALS, ['Nama', 'Target', 'Deadline', 'Terkumpul', 'Sisa', 'Bulan tersisa', 'Butuh / bulan', 'Progress', 'Status', 'Dibuat']);
  sh.getRange('B:B').setNumberFormat('"Rp"#,##0'); sh.getRange('D:E').setNumberFormat('"Rp"#,##0'); sh.getRange('G:G').setNumberFormat('"Rp"#,##0');
  sh.getRange('C:C').setNumberFormat('mmm yyyy'); sh.getRange('H:H').setNumberFormat('0%'); sh.getRange('J:J').setNumberFormat('dd/mm/yyyy');
  sh.setColumnWidths(1, 10, 120);
  if (sh.getLastRow() <= 1) {
    tambahGoalRow(sh, 'Dana Darurat', 0, null);
    sh.getRange('A4').setValue('Isi target Dana Darurat = 3–6x pengeluaran bulanan. Tambah goal via WA: "goal tambah Nikah 120jt 2028-06". Kolom D–I otomatis.')
      .setFontStyle('italic').setFontColor('#666666');
  }
}

function setupBudget_(book) {
  var sh = sheetBaru_(book, SHEET.BUDGET, ['Kategori', 'Budget / bulan', 'Terpakai (bulan di Dashboard)', 'Sisa', '% terpakai']);
  var ada = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { ada[r[0]] = true; });
  Object.keys(KATEGORI_KELUAR).forEach(function (k) {
    if (ada[k]) return;
    var r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, 5).setValues([[k, BUDGET_DEFAULT[k] || 0,
      '=SUMIFS(Transaksi!H:H,Transaksi!F:F,A' + r + ',Transaksi!D:D,Dashboard!$B$2,Transaksi!E:E,"Pengeluaran")',
      '=B' + r + '-C' + r, '=IF(B' + r + '>0,C' + r + '/B' + r + ',"")']]);
  });
  var n = sh.getLastRow();
  sh.getRange(n + 1, 1, 1, 5).setValues([['TOTAL', '=SUM(B2:B' + n + ')', '=SUM(C2:C' + n + ')', '=B' + (n + 1) + '-C' + (n + 1), '=IF(B' + (n + 1) + '>0,C' + (n + 1) + '/B' + (n + 1) + ',"")']])
    .setFontWeight('bold');
  sh.getRange('B:D').setNumberFormat('"Rp"#,##0'); sh.getRange('E:E').setNumberFormat('0%');
  sh.setColumnWidth(1, 160); sh.setColumnWidths(2, 4, 150);
  persenRules_(sh, sh.getRange('E2:E' + (n + 1)));
}

function persenRules_(sh, range) {
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(1).setBackground('#ffcdd2').setFontColor('#b71c1c').setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0.8).setBackground('#ffe0b2').setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(0).setBackground('#c8e6c9').setRanges([range]).build()
  ]);
}

function setupKategori_(book) {
  var sh = sheetBaru_(book, SHEET.KATEGORI, ['Tipe', 'Kategori', 'Contoh kata kunci (edit di Config.gs)']);
  sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 3).clearContent();
  var rows = [];
  [[TIPE.KELUAR, KATEGORI_KELUAR], [TIPE.TABUNG, KATEGORI_TABUNG], [TIPE.MASUK, KATEGORI_MASUK]].forEach(function (p) {
    Object.keys(p[1]).forEach(function (k) { rows.push([p[0], k, p[1][k].slice(0, 15).join(', ')]); });
  });
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  sh.setColumnWidth(2, 170); sh.setColumnWidth(3, 600);
}

function setupLog_(book) { sheetBaru_(book, SHEET.LOG, ['Waktu', 'Error']); }

function setupDashboard_(book) {
  var sh = book.getSheetByName(SHEET.DASHBOARD);
  if (sh) { sh.getCharts().forEach(function (c) { sh.removeChart(c); }); sh.clear(); sh.clearConditionalFormatRules(); }
  else sh = book.insertSheet(SHEET.DASHBOARD, 0);
  sh.setHiddenGridlines(true);

  sh.getRange('A1').setValue('💰 Dashboard Keuangan').setFontSize(18).setFontWeight('bold');
  sh.getRange('A2').setValue('Bulan (yyyy-mm):').setFontWeight('bold');
  sh.getRange('B2').setFormula('=TEXT(TODAY(),"yyyy-mm")').setBackground('#fff9c4').setFontWeight('bold')
    .setNote('Ketik bulan lain, mis. 2026-10, untuk melihat bulan tsb. Hapus isinya lalu isi ulang rumus =TEXT(TODAY(),"yyyy-mm") untuk kembali ke bulan berjalan.');

  // KPI
  var T = 'Transaksi!';
  var kpi = [
    ['Pemasukan', '=SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'E:E,"Pemasukan")', WARNA.masuk],
    ['Pengeluaran', '=SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'E:E,"Pengeluaran")', WARNA.keluar],
    ['Ditabung / investasi', '=SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'E:E,"Tabungan")', WARNA.tabung],
    ['Sisa (arus kas)', '=B4-B5-B6', '#000000'],
    ['Saving rate', '=IF(B4>0,B6/B4,0)', '#000000'],
    ['Rasio keinginan', '=IF(B4>0,(SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'F:F,"Lifestyle")+SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'F:F,"Sosial & Donasi")+SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'F:F,"Lainnya"))/B4,0)', '#000000'],
    ['Dana darurat (x pengeluaran)', '=IFERROR(INDEX(Goals!D:D,MATCH("Dana Darurat",Goals!A:A,0))/AVERAGE(FILTER(C18:C29,C18:C29>0)),0)', '#000000'],
    ['Jumlah transaksi', '=COUNTIFS(' + T + 'D:D,$B$2)', '#000000']
  ];
  sh.getRange('A3:B3').setValues([['Ringkasan', '']]).setFontWeight('bold').setBackground(WARNA.header).setFontColor(WARNA.headerText);
  kpi.forEach(function (k, i) {
    sh.getRange(4 + i, 1).setValue(k[0]);
    sh.getRange(4 + i, 2).setFormula(k[1]).setFontColor(k[2]).setFontWeight('bold');
  });
  sh.getRange('B4:B7').setNumberFormat('"Rp"#,##0');
  sh.getRange('B8:B9').setNumberFormat('0%');
  sh.getRange('B10').setNumberFormat('0.0"x"');
  sh.getRange('A4:B11').setBackground(WARNA.soft);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor('#c62828').setBackground('#ffcdd2').setRanges([sh.getRange('B7')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0.2).setBackground('#ffe0b2').setRanges([sh.getRange('B8')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0.3).setBackground('#ffe0b2').setRanges([sh.getRange('B9')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(3).setBackground('#ffcdd2').setRanges([sh.getRange('B10')]).build()
  ]);

  // Per kategori
  var kat = Object.keys(KATEGORI_KELUAR);
  sh.getRange('D3:G3').setValues([['Kategori pengeluaran', 'Terpakai', 'Budget', '%']]).setFontWeight('bold').setBackground(WARNA.header).setFontColor(WARNA.headerText);
  kat.forEach(function (k, i) {
    var r = 4 + i;
    sh.getRange(r, 4).setValue(k);
    sh.getRange(r, 5, 1, 3).setFormulas([[
      '=SUMIFS(' + T + 'H:H,' + T + 'D:D,$B$2,' + T + 'F:F,D' + r + ',' + T + 'E:E,"Pengeluaran")',
      '=IFERROR(VLOOKUP(D' + r + ',Budget!A:B,2,FALSE),0)',
      '=IF(F' + r + '>0,E' + r + '/F' + r + ',"")']]);
  });
  var lastKat = 3 + kat.length;
  sh.getRange('E4:F' + lastKat).setNumberFormat('"Rp"#,##0');
  sh.getRange('G4:G' + lastKat).setNumberFormat('0%');
  var rules = sh.getConditionalFormatRules();
  var gRange = sh.getRange('G4:G' + lastKat);
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(1).setBackground('#ffcdd2').setRanges([gRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0.8).setBackground('#ffe0b2').setRanges([gRange]).build());
  sh.setConditionalFormatRules(rules);

  // Goals
  sh.getRange('I3:L3').setValues([['Goal', 'Progress', 'Terkumpul', 'Target']]).setFontWeight('bold').setBackground(WARNA.header).setFontColor(WARNA.headerText);
  sh.getRange('I4').setFormula('=IFERROR(FILTER({Goals!A2:A,Goals!H2:H,Goals!D2:D,Goals!B2:B},Goals!B2:B>0),"Belum ada goal bertarget")');
  sh.getRange('J4:J15').setNumberFormat('0%');
  sh.getRange('K4:L15').setNumberFormat('"Rp"#,##0');

  // Tren 12 bulan
  sh.getRange('A16').setValue('Tren 12 bulan').setFontWeight('bold').setFontSize(12);
  sh.getRange('A17:E17').setValues([['Bulan', 'Pemasukan', 'Pengeluaran', 'Ditabung', 'Sisa']]).setFontWeight('bold').setBackground(WARNA.header).setFontColor(WARNA.headerText);
  for (var i = 0; i < 12; i++) {
    var r = 18 + i;
    sh.getRange(r, 1, 1, 5).setFormulas([[
      '=TEXT(EDATE(DATE(VALUE(LEFT($B$2,4)),VALUE(RIGHT($B$2,2)),1),' + (i - 11) + '),"yyyy-mm")',
      '=SUMIFS(' + T + 'H:H,' + T + 'D:D,A' + r + ',' + T + 'E:E,"Pemasukan")',
      '=SUMIFS(' + T + 'H:H,' + T + 'D:D,A' + r + ',' + T + 'E:E,"Pengeluaran")',
      '=SUMIFS(' + T + 'H:H,' + T + 'D:D,A' + r + ',' + T + 'E:E,"Tabungan")',
      '=B' + r + '-C' + r + '-D' + r]]);
  }
  sh.getRange('B18:E29').setNumberFormat('"Rp"#,##0');

  // Saran
  sh.getRange(DASH_SARAN_ROW - 1, 1, 1, 3).setValues([['', '💡 Saran keuangan (otomatis tiap malam, atau menu 💰 Finance Bot)', '']])
    .setFontWeight('bold').setBackground(WARNA.header).setFontColor(WARNA.headerText);
  sh.getRange(DASH_SARAN_ROW, 3, 30, 1).setWrap(true);

  sh.setColumnWidth(1, 190); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 420);
  sh.setColumnWidth(4, 170); sh.setColumnWidths(5, 3, 110); sh.setColumnWidth(8, 20);
  sh.setColumnWidth(9, 130); sh.setColumnWidths(10, 3, 110);

  // Grafik
  sh.insertChart(sh.newChart().asPieChart().addRange(sh.getRange('D3:E' + lastKat))
    .setOption('title', 'Pengeluaran per kategori').setOption('pieHole', 0.45).setOption('legend', { position: 'right' })
    .setPosition(2, 14, 0, 0).setOption('width', 520).setOption('height', 320).build());
  sh.insertChart(sh.newChart().asColumnChart().addRange(sh.getRange('A17:D29'))
    .setOption('title', 'Pemasukan vs Pengeluaran vs Tabungan').setOption('colors', [WARNA.masuk, WARNA.keluar, WARNA.tabung])
    .setOption('legend', { position: 'bottom' }).setPosition(18, 14, 0, 0).setOption('width', 520).setOption('height', 320).build());
  sh.insertChart(sh.newChart().asBarChart().addRange(sh.getRange('I3:J12'))
    .setOption('title', 'Progress goals').setOption('hAxis', { format: 'percent', viewWindow: { min: 0, max: 1 } })
    .setOption('legend', { position: 'none' }).setPosition(34, 14, 0, 0).setOption('width', 520).setOption('height', 260).build());
}

function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['jobHarian', 'jobBulanan'].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('jobHarian').timeBased().everyDays(1).atHour(21).inTimezone('Asia/Jakarta').create();
  ScriptApp.newTrigger('jobBulanan').timeBased().onMonthDay(1).atHour(8).inTimezone('Asia/Jakarta').create();
}

// ===================== DATA CONTOH =====================

function isiContohData() {
  var sh = ss().getSheetByName(SHEET.TRANSAKSI);
  var now = new Date();
  var rows = [];
  var pola = [
    ['+gaji 8jt', 1], ['makan siang 25rb', 3], ['kopi 30rb', 4], ['bensin 50rb', 5], ['bayar kos 1.5jt', 2], ['token listrik 200rb', 6],
    ['nabung nikah 1jt', 2], ['dana darurat 500rb', 2], ['netflix 54rb', 8], ['gofood 65rb', 10], ['indomaret sabun odol 80rb', 12],
    ['beli sepatu 450k', 15], ['makan malam 40rb', 17], ['gojek 20rb', 18], ['kondangan 200rb', 20], ['reksadana 300rb', 3]
  ];
  for (var m = 3; m >= 0; m--) {
    pola.forEach(function (p) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, p[1]);
      if (d > now) return;
      var r = parseTransaksi(p[0], { goals: ['Nikah', 'Dana Darurat'], now: d });
      var jumlah = Math.round(r.amount * (0.8 + Math.random() * 0.4) / 1000) * 1000;
      if (r.tipe !== TIPE.KELUAR) jumlah = r.amount;
      rows.push(['C' + m + rows.length, new Date(), d, "'" + kunciBulan(d), r.tipe, r.kategori, r.deskripsi, jumlah, r.goal, 'contoh', p[0]]);
    });
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 11).setValues(rows);
  if (!bacaGoals().some(function (g) { return g.nama === 'Nikah'; })) {
    tambahGoalRow(ss().getSheetByName(SHEET.GOALS), 'Nikah', 120000000, new Date(now.getFullYear() + 2, 5, 1));
  }
  perbaruiSaranDashboard();
}

function hapusContohData() {
  var sh = ss().getSheetByName(SHEET.TRANSAKSI);
  var last = sh.getLastRow();
  if (last < 2) return;
  var v = sh.getRange(2, 10, last - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (v[i][0] === 'contoh') sh.deleteRow(i + 2);
  perbaruiSaranDashboard();
}
