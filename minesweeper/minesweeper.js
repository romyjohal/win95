/* Minesweeper. Left-click reveals, right-click flags (long-press on touch),
   click a number whose flags are all placed to clear around it. */
(function () {
  'use strict';

  const gridEl = document.getElementById('grid');
  const faceEl = document.getElementById('face');
  const minesLed = document.getElementById('mines-led');
  const timeLed = document.getElementById('time-led');
  const SETTINGS = 'win95.minesweeper';
  const BEST = 'win95.minesweeper.best';

  const LEVELS = {
    beginner: { w: 9, h: 9, m: 10, name: 'Beginner' },
    intermediate: { w: 16, h: 16, m: 40, name: 'Intermediate' },
    expert: { w: 30, h: 16, m: 99, name: 'Expert' },
  };

  /* ---------- Graphics ---------- */

  const SEG = {
    a: [2, 1, 9, 2], b: [10, 2, 2, 9], c: [10, 12, 2, 9], d: [2, 20, 9, 2],
    e: [1, 12, 2, 9], f: [1, 2, 2, 9], g: [2, 10.5, 9, 2],
  };
  const DIGITS = {
    0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
    6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
  };
  const digitSvg = (ch) => '<svg viewBox="0 0 13 23">' + Object.entries(SEG).map(([k, [x, y, w, h]]) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${DIGITS[ch].includes(k) ? '#ff0000' : '#400000'}"/>`).join('') + '</svg>';

  function led(el, n) {
    n = Math.max(-99, Math.min(999, n));
    const s = n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0');
    if (el.dataset.v !== s) { el.dataset.v = s; el.innerHTML = [...s].map(digitSvg).join(''); }
  }

  const FACE_BASE = '<circle cx="8.5" cy="8.5" r="8" fill="#ff0" stroke="#000"/>';
  const EYES = '<rect x="5" y="5" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/>';
  const FACES = {
    smile: FACE_BASE + EYES + '<path d="M4.5 10.5q4 4 8 0" fill="none" stroke="#000" stroke-width="1.2"/>',
    o: FACE_BASE + EYES + '<circle cx="8.5" cy="12" r="2" fill="none" stroke="#000" stroke-width="1.2"/>',
    dead: FACE_BASE + '<path d="M4.5 4.5l3 3m0-3l-3 3M9.5 4.5l3 3m0-3l-3 3" stroke="#000"/><path d="M4.5 13.5q4-4 8 0" fill="none" stroke="#000" stroke-width="1.2"/>',
    cool: FACE_BASE + '<path d="M2.5 5.5h12v1l-1 2h-3l-1-2h-2l-1 2h-3l-1-2z"/><path d="M4.5 10.5q4 4 8 0" fill="none" stroke="#000" stroke-width="1.2"/>',
  };
  const setFace = (f) => { if (faceEl.dataset.f !== f) { faceEl.dataset.f = f; faceEl.innerHTML = `<svg viewBox="0 0 17 17">${FACES[f]}</svg>`; } };

  const MINE = '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><path d="M5.5 0h1v12h-1zM0 5.5h12v1H0z"/><path d="M2 2h1v1H2zM9 2h1v1H9zM2 9h1v1H2zM9 9h1v1H9z"/><path d="M4 2h4v1h1v1h1v4H9v1H8v1H4V9H3V8H2V4h1V3h1z"/><path d="M4 4h2v2H4z" fill="#fff"/></svg>';
  const FLAG = '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><path d="M2 1h5v5H2z" fill="#f00"/><path d="M4 3h3v1H4z" fill="#f00"/><path d="M6 1h1v8H6zM4 9h4v1H4zM2 10h8v2H2z"/></svg>';
  const WRONG = MINE.replace('</svg>', '<path d="M1 1l10 10M11 1L1 11" stroke="#f00" stroke-width="1.5" shape-rendering="auto"/></svg>');

  /* ---------- State ---------- */

  let settings = { level: 'beginner', custom: { w: 20, h: 15, m: 50 }, marks: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch (e) { /* ignore */ }

  let W, H, M, cells, status, time, timer, flags, opened, pressed = null, boom = -1;

  function saveSettings() {
    try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    for (const l of ['beginner', 'intermediate', 'expert', 'custom']) Win95.setChecked(l, settings.level === l);
    Win95.setChecked('marks', settings.marks);
  }

  function newGame() {
    const L = settings.level === 'custom' ? settings.custom : LEVELS[settings.level];
    const resized = W !== L.w || H !== L.h;
    W = L.w; H = L.h; M = L.m;
    cells = Array.from({ length: W * H }, () => ({ mine: false, n: 0, state: 0 }));
    status = 'ready'; time = 0; flags = 0; opened = 0; boom = -1; pressed = null;
    clearInterval(timer);
    if (resized) {
      gridEl.style.gridTemplateColumns = `repeat(${W}, 16px)`;
      gridEl.innerHTML = '';
      for (let i = 0; i < W * H; i++) {
        const c = document.createElement('div');
        c.className = 'cell';
        c.dataset.i = i;
        gridEl.appendChild(c);
      }
      requestAnimationFrame(() => Win95.center());
    }
    render();
  }

  function neighbors(i) {
    const x = i % W, y = Math.floor(i / W), out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
    }
    return out;
  }

  function placeMines(safe) {
    let placed = 0;
    while (placed < M) {
      const i = Math.floor(Math.random() * W * H);
      if (i === safe || cells[i].mine) continue;
      cells[i].mine = true;
      placed++;
    }
    cells.forEach((c, i) => { c.n = neighbors(i).filter((j) => cells[j].mine).length; });
  }

  function startClock() {
    status = 'playing';
    time = 1;
    timer = setInterval(() => { if (time < 999) { time++; led(timeLed, time); } }, 1000);
  }

  function reveal(i) {
    if (status === 'won' || status === 'lost') return;
    const c = cells[i];
    if (c.state === 1 || c.state === 2) return;
    if (status === 'ready') { placeMines(i); startClock(); }
    if (c.mine) return lose(i);
    const stack = [i];
    while (stack.length) {
      const j = stack.pop();
      const d = cells[j];
      if (d.state === 1 || d.state === 2 || d.mine) continue;
      d.state = 1;
      opened++;
      if (d.n === 0) stack.push(...neighbors(j));
    }
    if (opened === W * H - M) win();
  }

  function chord(i) {
    const c = cells[i];
    if (status !== 'playing' || c.state !== 1 || !c.n) return;
    const ns = neighbors(i);
    if (ns.filter((j) => cells[j].state === 2).length !== c.n) return;
    for (const j of ns) if (cells[j].state !== 2 && cells[j].state !== 1) reveal(j);
  }

  function toggleFlag(i) {
    if (status === 'won' || status === 'lost') return;
    const c = cells[i];
    if (c.state === 1) return;
    if (c.state === 0) { c.state = 2; flags++; }
    else if (c.state === 2) { flags--; c.state = settings.marks ? 3 : 0; }
    else c.state = 0;
    render();
  }

  function lose(i) {
    status = 'lost';
    boom = i;
    clearInterval(timer);
  }

  function win() {
    status = 'won';
    clearInterval(timer);
    cells.forEach((c) => { if (c.mine && c.state !== 2) { c.state = 2; flags++; } });
    render();
    if (settings.level !== 'custom') checkBest();
  }

  /* ---------- Best times ---------- */

  function loadBest() {
    const def = { beginner: [999, 'Anonymous'], intermediate: [999, 'Anonymous'], expert: [999, 'Anonymous'] };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(BEST))); } catch (e) { return def; }
  }

  async function checkBest() {
    const best = loadBest();
    if (time >= best[settings.level][0]) return;
    const name = await Win95.prompt(`You have the fastest time for ${LEVELS[settings.level].name.toLowerCase()} level.\nPlease enter your name.`, best[settings.level][1], { title: 'Congratulations' });
    best[settings.level] = [time, (name || 'Anonymous').slice(0, 32)];
    try { localStorage.setItem(BEST, JSON.stringify(best)); } catch (e) { /* ignore */ }
    showBest();
  }

  function showBest() {
    const b = loadBest();
    const row = (k) => `<tr><td>${LEVELS[k].name}:</td><td style="text-align:right;padding:0 16px">${b[k][0]} seconds</td><td>${Win95.escapeHtml(b[k][1])}</td></tr>`;
    Win95.dialog({
      title: 'Fastest Mine Sweepers',
      html: `<table style="border-spacing:0 4px;font:inherit">${row('beginner')}${row('intermediate')}${row('expert')}</table>`,
      buttons: ['OK', { label: '&Reset Scores', value: 'reset' }],
      cancelValue: 'OK',
    }).then((r) => {
      if (r === 'reset') {
        try { localStorage.removeItem(BEST); } catch (e) { /* ignore */ }
        showBest();
      }
    });
  }

  /* ---------- View ---------- */

  function render() {
    const over = status === 'lost';
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      let cls = 'cell', html = '';
      if (c.state === 1) {
        cls += ' open';
        if (c.n) { cls += ' n' + c.n; html = String(c.n); }
      } else if (over && c.mine && c.state !== 2) {
        cls += ' open' + (i === boom ? ' boom' : '');
        html = MINE;
      } else if (over && c.state === 2 && !c.mine) {
        cls += ' open';
        html = WRONG;
      } else if (c.state === 2) {
        html = FLAG;
      } else if (c.state === 3) {
        html = '?';
        if (pressed === i) cls += ' down';
      } else if (pressed === i) {
        cls += ' down';
      }
      const el = gridEl.children[i];
      if (el.className !== cls) el.className = cls;
      if (el._html !== html) { el._html = html; el.innerHTML = html; }
    }
    led(minesLed, M - flags);
    led(timeLed, time);
    setFace(status === 'lost' ? 'dead' : status === 'won' ? 'cool' : pressed !== null ? 'o' : 'smile');
  }

  /* ---------- Input ---------- */

  const cellAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const c = el && el.closest('.cell');
    return c && gridEl.contains(c) ? +c.dataset.i : null;
  };

  let down = null; // { id, longPress, done }

  gridEl.addEventListener('pointerdown', (e) => {
    const i = cellAt(e.clientX, e.clientY);
    if (i === null || status === 'won' || status === 'lost') return;
    e.preventDefault();
    if (e.button === 2) { toggleFlag(i); return; }
    if (e.button !== 0 && e.button !== 1) return;
    gridEl.setPointerCapture(e.pointerId);
    down = { id: e.pointerId, chord: e.button === 1 || e.buttons === 3, done: false, timer: null };
    if (e.pointerType === 'touch') {
      down.timer = setTimeout(() => {
        if (!down) return;
        down.done = true;
        pressed = null;
        if (cells[i].state === 1) chord(i); else toggleFlag(i);
        if (navigator.vibrate) navigator.vibrate(20);
        render();
      }, 450);
    }
    pressed = i;
    render();
  });

  gridEl.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id || down.done) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i !== pressed) {
      if (down.timer) { clearTimeout(down.timer); down.timer = null; }
      pressed = i;
      render();
    }
  });

  const release = (e) => {
    if (!down || e.pointerId !== down.id) return;
    clearTimeout(down.timer);
    const i = pressed;
    const d = down;
    down = null;
    pressed = null;
    if (!d.done && i !== null && e.type === 'pointerup') {
      if (cells[i].state === 1) chord(i);
      else if (!d.chord) reveal(i);
    }
    render();
  };
  gridEl.addEventListener('pointerup', release);
  gridEl.addEventListener('pointercancel', release);
  gridEl.addEventListener('contextmenu', (e) => e.preventDefault());

  faceEl.addEventListener('click', newGame);

  /* ---------- Menus ---------- */

  async function custom() {
    const c = settings.custom;
    const r = await Win95.dialog({
      title: 'Custom Field',
      width: 220,
      html: `<div style="display:grid;grid-template-columns:auto 60px;gap:8px;align-items:center">
        <span><u>H</u>eight:</span><input class="field" id="c-h" value="${c.h}">
        <span><u>W</u>idth:</span><input class="field" id="c-w" value="${c.w}">
        <span><u>M</u>ines:</span><input class="field" id="c-m" value="${c.m}"></div>`,
      buttons: [{ label: 'OK', value: true }, { label: 'Cancel', value: false }],
      result: (ok, d) => ok && ['h', 'w', 'm'].map((k) => parseInt(d.querySelector('#c-' + k).value, 10) || 0),
    });
    if (!r) return;
    const h = Math.min(24, Math.max(9, r[0])), w = Math.min(30, Math.max(9, r[1]));
    const m = Math.min((w - 1) * (h - 1), Math.max(10, r[2]));
    settings.custom = { w, h, m };
    settings.level = 'custom';
    saveSettings();
    newGame();
  }

  Win95.onMenu((action) => {
    switch (action) {
      case 'new': newGame(); return true;
      case 'beginner':
      case 'intermediate':
      case 'expert':
        settings.level = action; saveSettings(); newGame(); return true;
      case 'custom': custom(); return true;
      case 'marks': settings.marks = !settings.marks; saveSettings(); return true;
      case 'best': showBest(); return true;
      case 'howto':
        Win95.dialog({
          title: 'Minesweeper Help',
          width: 380,
          icon: 'info',
          message:
            'Find all the mines without detonating any of them.\n\n' +
            '• Click a square to uncover it. A number tells you how many mines touch that square.\n' +
            '• Right-click (or long-press) to flag a square you think hides a mine.\n' +
            '• Click an uncovered number whose mines are all flagged to clear the squares around it.\n' +
            '• Click the smiley face to start a new game.',
        });
        return true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-layer')) return;
    if (e.key === 'F2') { e.preventDefault(); newGame(); }
  });

  saveSettings();
  newGame();
})();
