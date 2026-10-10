/* Calculator — Windows 95 standard calculator (immediate execution, like the original). */
(function () {
  'use strict';

  const displayEl = document.getElementById('display');
  const memEl = document.getElementById('mem');

  let entry = '0';        // text currently being typed / shown
  let acc = null;         // accumulated left operand
  let op = null;          // pending operator
  let fresh = true;       // next digit starts a new entry
  let lastOp = null, lastOperand = null; // for repeated "="
  let memory = 0;
  let error = false;
  let grouping = false;

  const MAX_DIGITS = 32;

  function format(n) {
    if (!isFinite(n)) return null;
    let s;
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e32 || abs < 1e-15)) {
      s = n.toExponential(15).replace(/\.?0+e/, 'e');
    } else {
      s = String(parseFloat(n.toPrecision(16)));
      if (/e/.test(s)) s = n.toFixed(Math.min(20, Math.max(0, -Math.floor(Math.log10(abs)) + 15))).replace(/\.?0+$/, '');
    }
    return s;
  }

  function show() {
    let s = entry;
    if (!error) {
      if (grouping && !/e/.test(s)) {
        const [i, f] = s.split('.');
        s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? '.' + f : '');
      }
      if (!s.includes('.') && !/e/.test(s)) s += '.';
    }
    displayEl.textContent = s;
    memEl.textContent = memory !== 0 ? 'M' : '';
  }

  const current = () => parseFloat(entry) || 0;

  function setResult(n) {
    const s = format(n);
    if (s === null) { fail(n !== n ? 'Invalid input for function.' : 'Cannot divide by zero.'); return false; }
    entry = s;
    return true;
  }

  function fail(msg) {
    error = true;
    entry = msg;
    acc = null; op = null; fresh = true;
  }

  function compute(a, operator, b) {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? Infinity : a / b;
    }
    return b;
  }

  function press(k) {
    if (error && k !== 'c' && k !== 'ce' && !/^[0-9.]$/.test(k)) return;
    if (error) { error = false; entry = '0'; fresh = true; }

    if (/^[0-9]$/.test(k)) {
      if (fresh) { entry = k; fresh = false; }
      else if (entry.replace(/[-.]/g, '').length < MAX_DIGITS) entry = entry === '0' ? k : entry === '-0' ? '-' + k : entry + k;
    } else if (k === '.') {
      if (fresh) { entry = '0.'; fresh = false; }
      else if (!entry.includes('.')) entry += '.';
    } else if (k === 'back') {
      if (!fresh) {
        entry = entry.slice(0, -1);
        if (entry === '' || entry === '-') entry = '0';
      }
    } else if (k === 'ce') {
      entry = '0'; fresh = true;
    } else if (k === 'c') {
      entry = '0'; acc = null; op = null; fresh = true; lastOp = null;
    } else if (k === 'neg') {
      if (entry !== '0') entry = entry.startsWith('-') ? entry.slice(1) : '-' + entry;
    } else if ('+-*/'.includes(k)) {
      if (op && !fresh) {
        if (!setResult(compute(acc, op, current()))) return show();
      }
      acc = current();
      op = k;
      fresh = true;
      lastOp = null;
    } else if (k === '=') {
      if (op) {
        const b = current();
        lastOp = op; lastOperand = b;
        if (setResult(compute(acc, op, b))) { acc = null; op = null; }
      } else if (lastOp) {
        setResult(compute(current(), lastOp, lastOperand));
      }
      fresh = true;
    } else if (k === 'sqrt') {
      const v = current();
      if (v < 0) fail('Invalid input for function.'); else setResult(Math.sqrt(v));
      fresh = true;
    } else if (k === 'inv') {
      const v = current();
      if (v === 0) fail('Cannot divide by zero.'); else setResult(1 / v);
      fresh = true;
    } else if (k === '%') {
      setResult(acc !== null ? (acc * current()) / 100 : 0);
      fresh = true;
    } else if (k === 'mc') {
      memory = 0;
    } else if (k === 'mr') {
      setResult(memory); fresh = true;
    } else if (k === 'ms') {
      memory = current(); fresh = true;
    } else if (k === 'm+') {
      memory += current(); fresh = true;
    }
    show();
  }

  document.querySelector('.calc').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (b) press(b.dataset.k);
  });

  const KEYMAP = {
    Enter: '=', '=': '=', Escape: 'c', Delete: 'ce', Backspace: 'back',
    '@': 'sqrt', r: 'inv', R: 'inv', F9: 'neg', ',': '.',
  };
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-layer')) return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c') { copy(); e.preventDefault(); }
      if (e.key === 'v') { paste(); e.preventDefault(); }
      if (e.key === 'l' || e.key === 'L') { press('mc'); e.preventDefault(); }
      if (e.key === 'r' || e.key === 'R') { press('mr'); e.preventDefault(); }
      if (e.key === 'm' || e.key === 'M') { press('ms'); e.preventDefault(); }
      if (e.key === 'p' || e.key === 'P') { press('m+'); e.preventDefault(); }
      return;
    }
    const k = KEYMAP[e.key] || (/^[0-9.+\-*/%]$/.test(e.key) ? e.key : null);
    if (!k) return;
    e.preventDefault();
    const btn = document.querySelector(`.calc button[data-k="${CSS.escape(k)}"]`);
    if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 100); }
    press(k);
  });

  function copy() {
    const text = error ? entry : entry.replace(/\.$/, '');
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }

  async function paste() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { return; }
    const n = parseFloat(text.replace(/,/g, ''));
    if (!isNaN(n)) { error = false; setResult(n); fresh = true; show(); }
  }

  Win95.onMenu((action) => {
    if (action === 'copy') { copy(); return true; }
    if (action === 'paste') { paste(); return true; }
    if (action === 'grouping') { grouping = !grouping; Win95.setChecked('grouping', grouping); show(); return true; }
    if (action === 'standard') return true;
  });

  show();
})();
