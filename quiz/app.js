/* Aplikasi kuis bersama untuk halaman CF1 dan CF2. Konfigurasi dari window.QUIZ. */
(function(){
  'use strict';
  var CFG = window.QUIZ, B = CFG.bank, L = B.LETTERS;
  var PAKET = [['A',101],['B',202],['C',303],['D',404],['E',505]];
  var store = {
    get: function(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
    set: function(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
    del: function(k){ try { localStorage.removeItem(k); } catch(e){} }
  };
  var params = new URLSearchParams(location.search);
  var state = { seed: +(params.get('paket')) || 101, mode: 'ujian', order: 'topik', answers: {}, submitted: false, start: null };
  var paper = [], view = [];
  var $ = function(id){ return document.getElementById(id); };

  function key(){ return CFG.key + ':' + state.seed; }
  // ubah ^{..} dan _{..} di teks biasa (di luar \( \)) menjadi sup/sub
  function prettify(s){
    return s.split(/(\\\(.*?\\\))/).map(function(part){
      if (part.indexOf('\\(') === 0) return part;
      return part.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>');
    }).join('');
  }
  function math(el){ if (window.renderMathInElement) renderMathInElement(el, {delimiters:[{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}], throwOnError:false}); }

  function load(){
    paper = B.buildPaper(state.seed);
    var saved = store.get(key()) || {};
    state.answers = saved.answers || {};
    state.submitted = !!saved.submitted;
    state.start = saved.start || null;
    state.mode = saved.mode || state.mode;
    view = paper.slice();
    if (state.order === 'acak') {
      var s = state.seed; view.sort(function(a,b){ return ((a.no*9301+s*49297)%233280) - ((b.no*9301+s*49297)%233280); });
    }
    renderControls(); renderList(); renderResult(); tick();
  }
  function save(){ store.set(key(), {answers: state.answers, submitted: state.submitted, start: state.start, mode: state.mode}); }
  function link(){ return location.origin + location.pathname + '?paket=' + state.seed; }

  function renderControls(){
    var box = $('paket'); box.innerHTML = '';
    var isPreset = PAKET.some(function(p){ return p[1] === state.seed; });
    PAKET.forEach(function(p){
      var b = document.createElement('button'); b.textContent = p[0];
      b.setAttribute('aria-label', 'Paket ' + p[0]);
      b.setAttribute('aria-pressed', String(p[1] === state.seed));
      b.onclick = function(){ setSeed(p[1]); }; box.appendChild(b);
    });
    var r = document.createElement('button'); r.className = 'rnd';
    r.textContent = isPreset ? 'Acak' : 'Acak lagi';
    r.title = 'Buat paket acak baru';
    r.setAttribute('aria-pressed', String(!isPreset));
    r.onclick = function(){ setSeed(1000 + Math.floor(Math.random()*900000)); }; box.appendChild(r);
    document.querySelectorAll('[data-mode]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)); });
    document.querySelectorAll('[data-order]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.order === state.order)); });
    var name = PAKET.filter(function(p){ return p[1] === state.seed; })[0];
    $('paketInfo').innerHTML = (name ? 'Paket <b>' + name[0] + '</b> · ' : 'Paket acak · ') + 'kode <b>' + state.seed + '</b>';
    $('timer').hidden = state.mode !== 'ujian';
  }
  function setSeed(s){
    state.seed = s; history.replaceState(null, '', '?paket=' + s); load(); window.scrollTo({top:0});
  }

  function renderList(){
    var list = $('list'); list.innerHTML = '';
    view.forEach(function(q, idx){
      var a = state.answers[q.no], show = state.submitted || (state.mode === 'latihan' && a !== undefined);
      var card = document.createElement('article'); card.className = 'q'; card.id = 'q' + q.no;
      card.setAttribute('aria-labelledby', 'h' + q.no);
      var h = '<div class="qhead"><span class="qno" id="h' + q.no + '">Soal ' + (idx+1) + '</span>' +
        '<span class="conf' + (q.conf === 'Tinggi' ? ' hi' : '') + '">' + (q.conf === 'Baru' ? 'Topik silabus, belum pernah keluar' : 'Peluang keluar ' + q.conf.toLowerCase()) + '</span></div>' +
        '<div class="qtopic">Silabus ' + q.syl + ' · ' + q.topic + '</div>' +
        '<div class="qtext">' + q.q + '</div><div class="opts" role="radiogroup" aria-labelledby="h' + q.no + '">';
      q.options.forEach(function(o, i){
        var cls = 'opt' + (a === i ? ' sel' : '') + (show ? ' locked' : '');
        if (show) { if (i === q.answer) cls += ' right'; else if (a === i) cls += ' wrong'; }
        h += '<label class="' + cls + '"><input type="radio" name="q' + q.no + '" value="' + i + '"' + (a === i ? ' checked' : '') + (show ? ' disabled' : '') + '>' +
          '<span class="let" aria-hidden="true">' + L[i] + '</span><span class="otext">' + o + '</span></label>';
      });
      h += '</div>';
      if (show) {
        h += '<div class="verdict ' + (a === q.answer ? 'ok">Benar' : 'no">' + (a === undefined ? 'Tidak dijawab' : 'Salah') + '. Jawaban yang benar: ' + L[q.answer].toUpperCase()) + '</div>' +
          '<div class="sol"><h4>Pembahasan</h4>' + prettify(q.sol) + '</div>' +
          (q.fast ? '<div class="fast"><h4>Cara cepat</h4>' + prettify(q.fast) + '</div>' : '');
      }
      h += '<div class="qfoot"><span class="src">Pola serupa: ' + q.src + '</span>' +
        (a !== undefined && !show ? '<button class="linkbtn clear" type="button">Hapus jawaban</button>' : '') + '</div>';
      card.innerHTML = h;
      card.querySelectorAll('input').forEach(function(inp){
        inp.addEventListener('change', function(){
          state.answers[q.no] = +inp.value; if (!state.start && state.mode === 'ujian') state.start = Date.now();
          save(); renderList();
          var el = $('q' + q.no); if (el) { var f = el.querySelector('input:checked'); if (f) f.focus({preventScroll:true}); }
        });
      });
      var clr = card.querySelector('.clear');
      if (clr) clr.onclick = function(){ delete state.answers[q.no]; save(); renderList(); };
      list.appendChild(card);
    });
    math(list); renderNav();
  }

  function renderNav(){
    var nav = $('nav'); nav.innerHTML = '';
    var done = 0;
    view.forEach(function(q, idx){
      var a = state.answers[q.no], el = document.createElement('a');
      el.href = '#q' + q.no; el.textContent = idx + 1;
      if (a !== undefined) { done++; el.className = (state.submitted || state.mode === 'latihan') ? (a === q.answer ? 'r' : 'w') : 'done'; }
      nav.appendChild(el);
    });
    $('progress').textContent = done + '/30 dijawab';
    $('trackFill').style.width = (done / 30 * 100) + '%';
    $('submit').querySelector('.long').textContent = state.submitted ? 'Lihat nilai' : 'Selesai & nilai';
    $('submit').querySelector('.short').textContent = state.submitted ? 'Nilai' : 'Selesai';
    $('cancel').hidden = state.submitted || (done === 0 && !state.start);
  }

  function renderResult(){
    var box = $('result');
    if (!state.submitted) { box.innerHTML = ''; return; }
    var right = 0, by = {};
    paper.forEach(function(q){
      var ok = state.answers[q.no] === q.answer; if (ok) right++;
      by[q.topic] = by[q.topic] || {r:0,t:0}; by[q.topic].t++; if (ok) by[q.topic].r++;
    });
    var weak = Object.keys(by).filter(function(k){ return by[k].r < by[k].t; });
    var sec = B.sections.map(function(sc){ var qs = paper.filter(function(q){ return q.sec === sc.no; }); return {sc: sc, t: qs.length, r: qs.filter(function(q){ return state.answers[q.no] === q.answer; }).length}; });
    var pctv = Math.round(right/30*100);
    var h = '<section class="result" id="res" aria-labelledby="resTitle"><h2 id="resTitle">Nilai Anda</h2><div class="score">' + right + '/30 <small>(' + pctv + '%)</small></div>' +
      '<p>' + (pctv >= 80 ? 'Sudah di zona aman. Lanjut ke paket lain untuk memastikan hasil ini konsisten, bukan kebetulan.' :
               pctv >= 60 ? 'Masih di batas aman. Fokuskan latihan pada topik yang salah di bawah sebelum pindah ke paket lain.' :
               'Masih jauh dari aman. Pelajari ulang konsep tiap topik yang salah, jangan hanya mencocokkan pembahasan.') + '</p>';
    h += '<h3>Per bagian silabus</h3><div class="tbl"><table><thead><tr><th>Bagian</th><th>Bobot silabus</th><th>Benar</th></tr></thead><tbody>';
    sec.forEach(function(x){ h += '<tr><td>' + x.sc.no + '. ' + x.sc.name + '</td><td>' + x.sc.range + '</td><td>' + x.r + '/' + x.t + '</td></tr>'; });
    h += '</tbody></table></div>';
    if (weak.length) {
      h += '<h3>Topik yang perlu diperbaiki</h3><div class="tbl"><table><thead><tr><th>Topik</th><th>Benar</th></tr></thead><tbody>';
      weak.forEach(function(k){ h += '<tr><td>' + k + '</td><td>' + by[k].r + '/' + by[k].t + '</td></tr>'; });
      h += '</tbody></table></div>';
    }
    h += '<div style="margin-top:var(--s4)"><button class="btn ghost" id="again">Ulang paket ini</button></div></section>';
    box.innerHTML = h;
    $('again').onclick = resetPaper;
  }

  function resetPaper(){
    if (!confirm('Hapus semua jawaban di paket ini dan mulai ulang?')) return;
    clearAttempt();
  }
  function clearAttempt(){
    store.del(key()); state.answers = {}; state.submitted = false; state.start = null; renderList(); renderResult(); tick(); window.scrollTo({top:0});
  }
  function toast(msg, actionLabel, action){
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + msg + '</span>' + (actionLabel ? '<button type="button">' + actionLabel + '</button>' : '');
    if (actionLabel) t.querySelector('button').onclick = function(){ action(); t.remove(); };
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, actionLabel ? 8000 : 2500);
  }
  // Batalkan pengerjaan: hapus jawaban & hentikan timer, dengan opsi urungkan 8 detik
  function cancelAttempt(){
    var n = Object.keys(state.answers).length;
    if (!confirm('Batalkan pengerjaan? ' + n + ' jawaban dan timer akan dihapus.')) return;
    var backup = {answers: Object.assign({}, state.answers), start: state.start};
    clearAttempt();
    toast('Pengerjaan dibatalkan.', 'Urungkan', function(){
      state.answers = backup.answers; state.start = backup.start; save(); renderList(); tick();
    });
  }

  function tick(){
    if (state.mode !== 'ujian') return;
    var total = 180*60, used = state.start ? Math.floor((Date.now() - state.start)/1000) : 0, left = Math.max(0, total - used);
    var mmss = String(Math.floor(left/60)).padStart(2,'0') + ':' + String(left%60).padStart(2,'0');
    $('timer').textContent = state.submitted ? 'Ujian selesai' : 'Sisa ' + mmss;
    if (left === 0 && !state.submitted && state.start) { state.submitted = true; save(); renderList(); renderResult(); }
  }
  setInterval(tick, 1000);

  document.querySelectorAll('[data-mode]').forEach(function(b){ b.onclick = function(){ state.mode = b.dataset.mode; save(); renderControls(); renderList(); tick(); }; });
  document.querySelectorAll('[data-order]').forEach(function(b){ b.onclick = function(){ state.order = b.dataset.order; load(); }; });
  $('reset').onclick = resetPaper;
  $('cancel').onclick = cancelAttempt;
  $('copy').onclick = function(){
    var url = link();
    var done = function(){ toast('Tautan paket disalin.'); };
    try { navigator.clipboard.writeText(url).then(done, function(){ prompt('Salin tautan ini:', url); }); }
    catch(e){ prompt('Salin tautan ini:', url); }
  };
  $('nav').addEventListener('click', function(e){ if (e.target.tagName === 'A' && matchMedia('(max-width:600px)').matches) $('jump').open = false; });
  $('submit').onclick = function(){
    if (!state.submitted) {
      var left = 30 - Object.keys(state.answers).length;
      if (left > 0 && !confirm(left + ' soal belum dijawab. Tetap selesai dan nilai?')) return;
      state.submitted = true; save(); renderList(); renderResult(); tick();
    }
    $('result').scrollIntoView({behavior:'smooth'});
  };
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function(t){ t.onclick = function(){
    tabs.forEach(function(x){ x.setAttribute('aria-selected', String(x === t)); $(x.getAttribute('aria-controls')).hidden = x !== t; });
    $('bar').hidden = t.id !== 't-quiz';
    if (t.id === 't-ana') math($('p-ana'));
  }; });

  function start(){
    if (matchMedia('(min-width:601px)').matches) $('jump').open = true;
    load();
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
