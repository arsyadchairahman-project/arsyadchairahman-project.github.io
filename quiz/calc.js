/* Kalkulator scientific untuk halaman kuis CF1/CF2.
   Ekspresi diurai dengan parser recursive-descent (tanpa eval). */
(function (root) {
  'use strict';

  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  function fact(n) {
    if (n < 0 || Math.floor(n) !== n) throw new Error('n! hanya untuk bilangan bulat ≥ 0');
    if (n > 170) throw new Error('n! terlalu besar');
    var f = 1; for (var i = 2; i <= n; i++) f *= i; return f;
  }
  function nCr(n, r) {
    if (r < 0 || r > n || Math.floor(n) !== n || Math.floor(r) !== r) throw new Error('nCr butuh bilangan bulat 0 ≤ r ≤ n');
    var v = 1; for (var i = 1; i <= r; i++) v = v * (n - r + i) / i; return Math.round(v);
  }
  function nPr(n, r) {
    if (r < 0 || r > n || Math.floor(n) !== n || Math.floor(r) !== r) throw new Error('nPr butuh bilangan bulat 0 ≤ r ≤ n');
    var v = 1; for (var i = 0; i < r; i++) v *= (n - i); return v;
  }
  var FUNCS = {
    ln: function (x) { if (x <= 0) throw new Error('ln butuh x > 0'); return Math.log(x); },
    log: function (x) { if (x <= 0) throw new Error('log butuh x > 0'); return Math.log10(x); },
    '√': function (x) { if (x < 0) throw new Error('√ butuh x ≥ 0'); return Math.sqrt(x); },
    exp: Math.exp,
    Φ: function (z) { return 0.5 * (1 + erf(z / Math.SQRT2)); },
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    abs: Math.abs
  };

  function tokenize(s) {
    var out = [], i = 0;
    s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.');
    while (i < s.length) {
      var c = s[i];
      if (c === ' ') { i++; continue; }
      if (/[0-9.]/.test(c)) {
        var j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if (s[j] === 'E' && /[-+0-9]/.test(s[j + 1] || '')) { j++; if (/[-+]/.test(s[j])) j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
        var num = s.slice(i, j);
        if ((num.match(/\./g) || []).length > 1) throw new Error('Angka tidak valid: ' + num);
        out.push({ t: 'num', v: parseFloat(num) }); i = j; continue;
      }
      var m = s.slice(i).match(/^(ln|log|exp|sin|cos|tan|abs|Ans|M|√|Φ|π|e)/);
      if (m) {
        var w = m[1];
        if (w === 'π') out.push({ t: 'num', v: Math.PI });
        else if (w === 'e') out.push({ t: 'num', v: Math.E });
        else if (w === 'Ans' || w === 'M') out.push({ t: 'var', v: w });
        else out.push({ t: 'fn', v: w });
        i += w.length; continue;
      }
      if ('+-*/^()!CP'.indexOf(c) >= 0) { out.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('Karakter tidak dikenal: ' + c);
    }
    return out;
  }

  function evaluate(src, vars) {
    var tk = tokenize(src), p = 0;
    if (!tk.length) throw new Error('Ekspresi kosong');
    function peek() { return tk[p]; }
    function take(v) { var x = tk[p]; if (!x || (v && x.v !== v)) throw new Error(v ? 'Kurang tanda “' + v + '”' : 'Ekspresi belum selesai'); p++; return x; }
    function startsOperand(x) { return x && (x.t === 'num' || x.t === 'var' || x.t === 'fn' || (x.t === 'op' && x.v === '(')); }
    function expr() {
      var v = term();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { var o = take().v, r = term(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      var v = unary();
      for (;;) {
        var x = peek();
        if (x && x.t === 'op' && '*/CP'.indexOf(x.v) >= 0) {
          take(); var r = unary();
          if (x.v === '*') v *= r;
          else if (x.v === '/') { if (r === 0) throw new Error('Pembagian dengan nol'); v /= r; }
          else if (x.v === 'C') v = nCr(v, r);
          else v = nPr(v, r);
        } else if (startsOperand(x)) { v *= unary(); } // perkalian implisit: 2π, 3(4)
        else break;
      }
      return v;
    }
    function unary() {
      var x = peek();
      if (x && x.t === 'op' && (x.v === '-' || x.v === '+')) { take(); var v = unary(); return x.v === '-' ? -v : v; }
      return power();
    }
    function power() {
      var b = postfix();
      if (peek() && peek().t === 'op' && peek().v === '^') { take(); var e = unary(); return Math.pow(b, e); }
      return b;
    }
    function postfix() {
      var v = primary();
      while (peek() && peek().t === 'op' && peek().v === '!') { take(); v = fact(v); }
      return v;
    }
    function primary() {
      var x = take();
      if (x.t === 'num') return x.v;
      if (x.t === 'var') return vars[x.v] || 0;
      if (x.t === 'fn') {
        var hasParen = peek() && peek().t === 'op' && peek().v === '(';
        var arg;
        if (hasParen) { take('('); arg = expr(); if (peek() && peek().v === ')') take(')'); }
        else arg = power();
        return FUNCS[x.v](arg);
      }
      if (x.t === 'op' && x.v === '(') { var v = expr(); if (peek() && peek().v === ')') take(')'); return v; }
      throw new Error('Tidak terduga: ' + x.v);
    }
    var res = expr();
    if (p < tk.length) throw new Error('Tidak terduga: ' + tk[p].v);
    if (!isFinite(res)) throw new Error('Hasil tidak terdefinisi');
    return res;
  }

  function fmt(x) {
    if (x === 0) return '0';
    var a = Math.abs(x);
    if (a >= 1e12 || a < 1e-9) return x.toExponential(9).replace(/\.?0+e/, 'E').replace('e', 'E');
    var s = parseFloat(x.toPrecision(12)).toString();
    return s;
  }

  var api = { evaluate: evaluate, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.QuizCalc = api;

  // ---------- UI ----------
  var KEYS = [
    ['shift', 'SHIFT', 'k-fn'], ['(', '(', 'k-fn'], [')', ')', 'k-fn'], ['del', 'DEL', 'k-warn'], ['ac', 'AC', 'k-warn'],
    ['x2', 'x²', 'k-fn', '√(', '√'], ['^', 'xʸ', 'k-fn', '^(1/', 'ˣ√'], ['ln(', 'ln', 'k-fn', 'exp(', 'eˣ'], ['log(', 'log', 'k-fn', '10^(', '10ˣ'], ['inv', 'x⁻¹', 'k-fn', '!', 'n!'],
    ['C', 'nCr', 'k-fn', 'P', 'nPr'], ['Φ(', 'Φ(z)', 'k-fn'], ['π', 'π', 'k-fn', 'e', 'e'], ['neg', '(−)', 'k-fn'], ['Ans', 'Ans', 'k-fn'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷', 'k-op'], ['sto', 'STO', 'k-fn', 'M', 'RCL M'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×', 'k-op'], ['M', 'M', 'k-fn'],
    ['1', '1'], ['2', '2'], ['3', '3'], ['−', '−', 'k-op'], ['E', '×10ˣ', 'k-fn'],
    ['0', '0'], ['.', '.'], ['=', '=', 'k-eq'], ['+', '+', 'k-op'], ['hist', 'Riwayat', 'k-fn']
  ];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function mount() {
    var saved = store.get('quizcalc') || {};
    var state = { expr: '', vars: { Ans: saved.Ans || 0, M: saved.M || 0 }, hist: saved.hist || [], shift: false, justEval: false, showHist: false };
    var panel = el('section', 'calc'); panel.id = 'calc'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Kalkulator scientific');
    panel.innerHTML =
      '<div class="calc-head"><strong>Kalkulator</strong><span class="calc-note">gaya fx-991 · keyboard aktif</span><button type="button" class="calc-x" aria-label="Tutup kalkulator">×</button></div>' +
      '<div class="calc-screen"><div class="calc-expr" aria-live="polite"></div><div class="calc-res" aria-live="polite">0</div><div class="calc-flags"></div></div>' +
      '<div class="calc-hist" hidden></div><div class="calc-keys"></div>';
    var keys = panel.querySelector('.calc-keys'), exprEl = panel.querySelector('.calc-expr'), resEl = panel.querySelector('.calc-res'), flags = panel.querySelector('.calc-flags'), histEl = panel.querySelector('.calc-hist');
    KEYS.forEach(function (k) {
      var b = el('button', 'calc-k ' + (k[2] || ''));
      b.type = 'button'; b.dataset.k = k[0];
      b.innerHTML = (k[4] ? '<small>' + k[4] + '</small>' : '') + '<span>' + k[1] + '</span>';
      if (k[3]) b.dataset.s = k[3];
      keys.appendChild(b);
    });
    document.body.appendChild(panel);

    function persist() { store.set('quizcalc', { Ans: state.vars.Ans, M: state.vars.M, hist: state.hist.slice(-20) }); }
    function render(res, isErr) {
      exprEl.textContent = state.expr || ' ';
      if (res !== undefined) { resEl.textContent = res; resEl.classList.toggle('err', !!isErr); }
      flags.textContent = (state.shift ? 'SHIFT  ' : '') + (state.vars.M ? 'M=' + fmt(state.vars.M) : '');
      panel.classList.toggle('is-shift', state.shift);
      histEl.innerHTML = state.hist.slice().reverse().map(function (h) { return '<button type="button" class="calc-h" data-e="' + h.e.replace(/"/g, '&quot;') + '"><span>' + h.e + '</span><b>' + h.r + '</b></button>'; }).join('') || '<p class="calc-empty">Belum ada riwayat.</p>';
    }
    function insert(s) {
      if (state.justEval) {
        if (/^[+−×÷^!CP]/.test(s) || s === '²') state.expr = 'Ans';
        else state.expr = '';
        state.justEval = false;
      }
      state.expr += s;
    }
    function equals() {
      if (!state.expr.trim()) return;
      try {
        var v = evaluate(state.expr, state.vars), r = fmt(v);
        state.vars.Ans = v; state.hist.push({ e: state.expr, r: r }); if (state.hist.length > 20) state.hist.shift();
        state.justEval = true; persist(); render(r, false);
      } catch (e) { render(e.message, true); }
    }
    function press(k, sk) {
      var useShift = state.shift && sk; state.shift = (k === 'shift') ? !state.shift : false;
      if (k === 'shift') { render(); return; }
      if (useShift) {
        if (sk === 'M') { insert('M'); render(); return; }
        insert(sk); render(); return;
      }
      switch (k) {
        case 'ac': state.expr = ''; state.justEval = false; render('0'); return;
        case 'del': if (state.justEval) { state.justEval = false; } state.expr = state.expr.replace(/(Ans|ln\(|log\(|exp\(|Φ\(|√\(|10\^\(|.)$/, ''); render(); return;
        case '=': equals(); return;
        case 'x2': insert('^2'); render(); return;
        case 'inv': insert('^(−1)'); render(); return;
        case 'neg': if (state.justEval) { state.expr = ''; state.justEval = false; } state.expr += '−'; render(); return;
        case 'E': insert('E'); render(); return;
        case 'sto':
          try { var v = state.justEval ? state.vars.Ans : evaluate(state.expr || 'Ans', state.vars); state.vars.M = v; persist(); state.justEval = true; render('M ← ' + fmt(v)); }
          catch (e) { render(e.message, true); }
          return;
        case 'hist': state.showHist = !state.showHist; histEl.hidden = !state.showHist; keys.hidden = state.showHist; render(); return;
        default: insert(k); render();
      }
    }
    keys.addEventListener('click', function (e) { var b = e.target.closest('.calc-k'); if (b) press(b.dataset.k, b.dataset.s); });
    histEl.addEventListener('click', function (e) { var b = e.target.closest('.calc-h'); if (!b) return; state.expr = b.dataset.e; state.justEval = false; state.showHist = false; histEl.hidden = true; keys.hidden = false; render(); });
    panel.querySelector('.calc-x').onclick = function () { toggle(false); };
    document.addEventListener('keydown', function (e) {
      if (panel.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target; if (t && (t.tagName === 'INPUT' && t.type !== 'radio' || t.tagName === 'TEXTAREA')) return;
      var map = { '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', '(': '(', ')': ')', '.': '.', ',': '.', '!': '!' };
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (map[e.key]) press(map[e.key]);
      else if (e.key === 'Enter' || e.key === '=') press('=');
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') { if (state.expr) press('ac'); else toggle(false); }
      else if (e.key === 'C' || e.key === 'c') press('C');
      else if (e.key === 'P') press('P');
      else if (e.key === 'p') press('π');
      else if (e.key === 'l') press('ln(');
      else return;
      e.preventDefault();
    });
    function toggle(open) {
      panel.hidden = open === undefined ? !panel.hidden : !open;
      document.body.classList.toggle('calc-open', !panel.hidden);
      var btn = document.getElementById('calcBtn'); if (btn) btn.setAttribute('aria-expanded', String(!panel.hidden));
      render();
    }
    render('0');
    root.QuizCalc.toggle = toggle;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(this);
