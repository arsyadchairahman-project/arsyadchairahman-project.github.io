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
  var state = { src: params.get('sumber') === 'soa' && B.buildSoaPaper ? 'soa' : 'pai', seed: +(params.get('paket')) || 101, mode: 'ujian', order: 'topik', answers: {}, submitted: false, start: null };
  var paper = [], view = [];
  var $ = function(id){ return document.getElementById(id); };

  function key(){ return CFG.key + (state.src === 'soa' ? ':soa:' : ':') + state.seed; }
  function N(){ return paper.length; }
  // ubah ^{..} dan _{..} di teks biasa (di luar \( \)) menjadi sup/sub
  function prettify(s){
    return s.split(/(\\\(.*?\\\))/).map(function(part){
      if (part.indexOf('\\(') === 0) return part;
      return part.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>');
    }).join('');
  }
  function math(el){ if (window.renderMathInElement) renderMathInElement(el, {delimiters:[{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}], throwOnError:false}); }

  function load(){
    paper = state.src === 'soa' ? B.buildSoaPaper(state.seed) : B.buildPaper(state.seed);
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
  function urlFor(){ return '?paket=' + state.seed + (state.src === 'soa' ? '&sumber=soa' : ''); }
  function link(){ return location.origin + location.pathname + urlFor(); }

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
    document.querySelectorAll('[data-src]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.src === state.src)); });
    var name = PAKET.filter(function(p){ return p[1] === state.seed; })[0];
    $('paketInfo').innerHTML = (state.src === 'soa' ? 'Pola SOA · ' : '') + (name ? 'Paket <b>' + name[0] + '</b> · ' : 'Paket acak · ') + 'kode <b>' + state.seed + '</b>';
    $('timer').hidden = state.mode !== 'ujian';
  }
  function setSeed(s){
    state.seed = s; history.replaceState(null, '', urlFor()); load(); window.scrollTo({top:0});
  }

  function renderList(){
    var list = $('list'); list.innerHTML = '';
    var bySec = state.order === 'topik' && view.every(function(q, i){ return !i || view[i-1].sec <= q.sec; });
    view.forEach(function(q, idx){
      if (bySec && (!idx || view[idx-1].sec !== q.sec)) {
        var sc = B.sections.filter(function(s){ return s.no === q.sec; })[0];
        if (sc) {
          var cnt = view.filter(function(x){ return x.sec === q.sec; }).length;
          var hd = document.createElement('div'); hd.className = 'secdiv';
          hd.innerHTML = '<h2><span class="secno">' + sc.no + '</span>' + sc.name + '</h2><span>' + cnt + ' soal · bobot silabus ' + sc.range + '</span>';
          list.appendChild(hd);
        }
      }
      var a = state.answers[q.no], show = state.submitted || (state.mode === 'latihan' && a !== undefined);
      var card = document.createElement('article'); card.className = 'q'; card.id = 'q' + q.no;
      card.setAttribute('aria-labelledby', 'h' + q.no);
      var h = '<div class="qhead"><span class="qno" id="h' + q.no + '">Soal ' + (idx+1) + '</span>' +
        '<span class="conf' + (q.conf === 'Tinggi' ? ' hi' : '') + '">' + (q.conf === 'Baru' ? 'Topik silabus, belum pernah keluar' : q.conf === 'SOA' ? 'Pola SOA, belum dipakai PAI' : q.conf === 'Variasi' ? 'Model variasi latihan' : 'Peluang keluar ' + q.conf.toLowerCase()) + '</span></div>' +
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
    $('progress').textContent = done + '/' + N() + ' dijawab';
    $('trackFill').style.width = (done / N() * 100) + '%';
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
    var pctv = Math.round(right/N()*100);
    var h = '<section class="result" id="res" aria-labelledby="resTitle"><h2 id="resTitle">Nilai Anda</h2><div class="score">' + right + '/' + N() + ' <small>(' + pctv + '%)</small></div>' +
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
  document.querySelectorAll('[data-src]').forEach(function(b){ b.onclick = function(){ if (b.dataset.src === 'soa' && !B.buildSoaPaper) { alert('Versi halaman ini belum termuat penuh. Muat ulang halaman (tarik ke bawah di HP, atau Ctrl+Shift+R di laptop), lalu coba lagi.'); return; } state.src = b.dataset.src; history.replaceState(null, '', urlFor()); load(); window.scrollTo({top:0}); }; });
  $('reset').onclick = resetPaper;
  $('cancel').onclick = cancelAttempt;
  $('calcBtn').onclick = function(){ if (window.QuizCalc && QuizCalc.toggle) QuizCalc.toggle(); };
  $('copy').onclick = function(){
    var url = link();
    var done = function(){ toast('Tautan paket disalin.'); };
    try { navigator.clipboard.writeText(url).then(done, function(){ prompt('Salin tautan ini:', url); }); }
    catch(e){ prompt('Salin tautan ini:', url); }
  };
  $('nav').addEventListener('click', function(e){ if (e.target.tagName === 'A' && matchMedia('(max-width:600px)').matches) $('jump').open = false; });
  $('submit').onclick = function(){
    if (!state.submitted) {
      var left = N() - Object.keys(state.answers).length;
      if (left > 0 && !confirm(left + ' soal belum dijawab. Tetap selesai dan nilai?')) return;
      state.submitted = true; save(); renderList(); renderResult(); tick();
    }
    $('result').scrollIntoView({behavior:'smooth'});
  };
  document.querySelectorAll('[data-cs]').forEach(function(b){ b.onclick = function(){
    document.querySelectorAll('[data-cs]').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); var el = $(x.dataset.cs); if (el) el.hidden = x !== b; });
  }; });
  // Tab: bilah tab menempel di atas, dan posisi scroll tiap tab diingat,
  // jadi Soal 12 → Cheat sheet → Kerjakan soal kembali tepat ke Soal 12.
  var tabs = document.querySelectorAll('.tab'), tabbar = $('tabbar'), memo = {}, curTab = 't-quiz', curQ = null;
  function barH(){ return tabbar ? tabbar.offsetHeight : 0; }
  // posisi alami bilah tab (saat menempel, rect.top selalu 0, jadi ukur dari elemen sebelumnya)
  function pinY(){
    if (!tabbar) return 0;
    var prev = tabbar.previousElementSibling, mt = parseFloat(getComputedStyle(tabbar).marginTop) || 0;
    return prev ? prev.getBoundingClientRect().bottom + window.scrollY + mt : 0;
  }
  tabs.forEach(function(t){ t.onclick = function(){
    if (t.id === curTab) { if (window.scrollY > pinY()) window.scrollTo({top: pinY()}); return; }
    var wasPinned = window.scrollY >= pinY() - 1;
    memo[curTab] = window.scrollY;
    tabs.forEach(function(x){ x.setAttribute('aria-selected', String(x === t)); $(x.getAttribute('aria-controls')).hidden = x !== t; });
    $('bar').hidden = t.id !== 't-quiz';
    curTab = t.id;
    if (t.id !== 't-quiz') { var pn = $(t.getAttribute('aria-controls')); if (!pn.dataset.math) { math(pn); pn.dataset.math = '1'; } }
    var ctx = $('tabCtx');
    if (ctx) { ctx.hidden = t.id === 't-quiz' || !curQ; if (curQ) ctx.innerHTML = '<span class="long">Soal </span>' + curQ; ctx.setAttribute('aria-label', 'kembali ke soal ' + curQ); }
    if (memo[t.id] !== undefined) window.scrollTo({top: memo[t.id]});
    else if (wasPinned) window.scrollTo({top: pinY()});
  }; });
  function onScroll(){
    if (tabbar) tabbar.classList.toggle('stuck', tabbar.getBoundingClientRect().top <= 0 && window.scrollY > 0);
    if (curTab !== 't-quiz') return;
    var line = barH() + 24, best = null;
    document.querySelectorAll('#list article').forEach(function(a){ if (a.getBoundingClientRect().top <= line) best = a; });
    curQ = best ? best.querySelector('.qno').textContent.replace('Soal ', '') : null;
  }
  var raf = 0;
  window.addEventListener('scroll', function(){ if (!raf) raf = requestAnimationFrame(function(){ raf = 0; onScroll(); }); }, {passive: true});

  // Cari rumus di cheat sheet: saring baris tabel dan bagian per kata kunci.
  var csq = $('csq');
  function csRoot(){ var parts = document.querySelectorAll('#p-cs .cs-part'); for (var i = 0; i < parts.length; i++) if (!parts[i].hidden) return parts[i]; return $('p-cs'); }
  function csFilter(){
    var q = (csq.value || '').trim().toLowerCase(), root = csRoot(), groups = [], g = null, hits = 0;
    document.querySelectorAll('#p-cs .cs-hide').forEach(function(el){ el.classList.remove('cs-hide'); });
    var pre = [];
    Array.prototype.forEach.call(root.children, function(el){
      if (el.tagName === 'H3') { g = {h: el, items: []}; groups.push(g); }
      else if (g) g.items.push(el);
      else if (el.tagName === 'P' || el.classList.contains('cs-toc')) pre.push(el);
    });
    if (!q) { $('csCount').textContent = ''; return; }
    pre.forEach(function(el){ el.classList.add('cs-hide'); });
    var terms = q.split(/\s+/);
    var match = function(el){ var s = el.textContent.toLowerCase(); return terms.every(function(w){ return s.indexOf(w) >= 0; }); };
    groups.forEach(function(gr){
      if (match(gr.h)) { hits++; return; }
      var any = false;
      gr.items.forEach(function(el){
        var rows = el.querySelectorAll('tbody tr, li');
        if (rows.length && !el.classList.contains('cs-sym')) {
          var n = 0; rows.forEach(function(r){ if (match(r)) n++; else r.classList.add('cs-hide'); });
          if (n) { any = true; hits += n; } else el.classList.add('cs-hide');
        } else if (match(el) && !el.classList.contains('cs-sym')) { any = true; hits++; }
        else el.classList.add('cs-hide');
      });
      if (!any) { gr.h.classList.add('cs-hide'); gr.items.forEach(function(el){ el.classList.add('cs-hide'); }); }
    });
    $('csCount').textContent = hits ? hits + ' cocok' : 'Tidak ada yang cocok';
  }
  if (csq) {
    csq.addEventListener('input', csFilter);
    csq.addEventListener('keydown', function(e){ if (e.key === 'Escape') { csq.value = ''; csFilter(); } });
    document.querySelectorAll('[data-cs]').forEach(function(b){ b.addEventListener('click', csFilter); });
  }

  function start(){
    if (matchMedia('(min-width:601px)').matches) $('jump').open = true;
    load();
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
