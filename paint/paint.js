/* Paint — a small, pixel-crisp MS Paint. Left button paints with the
   foreground colour, right button with the background colour. */
(function () {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const toolsEl = document.getElementById('tools');
  const optionsEl = document.getElementById('options');
  const paletteEl = document.getElementById('palette');
  const fgEl = document.getElementById('fg');
  const bgEl = document.getElementById('bg');
  const coordsEl = document.getElementById('coords');
  const statusEl = document.getElementById('status');
  const fileInput = document.getElementById('file-input');
  const colorInput = document.getElementById('color-input');

  // Column-major pairs: the grid fills top (dark) then bottom (light) per column.
  const PALETTE = [
    '#000000', '#ffffff', '#808080', '#c0c0c0', '#800000', '#ff0000', '#808000', '#ffff00',
    '#008000', '#00ff00', '#008080', '#00ffff', '#000080', '#0000ff', '#800080', '#ff00ff',
    '#808040', '#ffff80', '#004040', '#00ff80', '#0080ff', '#80ffff', '#004080', '#8080ff',
    '#4000ff', '#ff0080', '#804000', '#ff8040',
  ];

  const S = (body) => `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">${body}</svg>`;
  const TOOLS = [
    { id: 'eraser', tip: 'Eraser/Color Eraser', icon: S('<path d="M2 10l6-6 6 6-4 4H6z" fill="#ffc0e0" stroke="#000"/><path d="M5 7l6 6" stroke="#000"/>'), options: 'eraser' },
    { id: 'fill', tip: 'Fill With Color', icon: S('<path d="M3 8l5-5 5 5-5 5z" fill="#fff" stroke="#000"/><path d="M8 1v5" stroke="#000"/><rect x="12" y="9" width="2" height="5" fill="#00f"/>') },
    { id: 'pick', tip: 'Pick Color', icon: S('<path d="M3 13l7-7" stroke="#000" stroke-width="2"/><path d="M9 4l3-3 3 3-3 3z" fill="#000"/>') },
    { id: 'pencil', tip: 'Pencil', icon: S('<path d="M2 14l1-3 8-8 2 2-8 8z" fill="#ff0" stroke="#000"/><path d="M2 14l1-2 1 1z" fill="#000"/>') },
    { id: 'brush', tip: 'Brush', icon: S('<path d="M9 1l5 5-3 3-5-5z" fill="#a05a00" stroke="#000"/><path d="M6 6l3 3-3 3c-1 1-3 2-5 2 0-2 1-4 2-5z" fill="#000"/>'), options: 'brush' },
    { id: 'airbrush', tip: 'Airbrush', icon: S('<rect x="7" y="6" width="6" height="9" fill="#c0c0c0" stroke="#000"/><rect x="9" y="3" width="2" height="3" fill="#000"/><g fill="#000"><rect x="2" y="2" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="2" y="6" width="1" height="1"/><rect x="5" y="1" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/></g>'), options: 'airbrush' },
    { id: 'line', tip: 'Line', icon: S('<path d="M2 14L14 2" stroke="#000" stroke-width="1.5" shape-rendering="auto"/>'), options: 'line' },
    { id: 'rect', tip: 'Rectangle', icon: S('<rect x="2.5" y="4.5" width="11" height="8" fill="none" stroke="#000"/>'), options: 'shape' },
    { id: 'ellipse', tip: 'Ellipse', icon: S('<ellipse cx="8" cy="8.5" rx="6" ry="4.5" fill="none" stroke="#000" shape-rendering="auto"/>'), options: 'shape' },
    { id: 'roundrect', tip: 'Rounded Rectangle', icon: S('<rect x="2.5" y="4.5" width="11" height="8" rx="3" fill="none" stroke="#000" shape-rendering="auto"/>'), options: 'shape' },
  ];

  const OPTIONS = {
    eraser: { values: [4, 6, 8, 10], render: (v) => `<span style="width:${v}px;height:${v}px;background:#000"></span>` },
    brush: { values: [1, 3, 5, 7], render: (v) => `<span style="width:${v}px;height:${v}px;background:#000;border-radius:50%"></span>` },
    airbrush: { values: [4, 8, 12], render: (v) => `<span style="font-size:${6 + v / 2}px;line-height:1">∴</span>` },
    line: { values: [1, 2, 3, 4, 5], render: (v) => `<span style="width:28px;height:${v}px;background:#000"></span>` },
    shape: {
      values: [0, 1, 2],
      render: (v) => `<span style="width:24px;height:9px;box-sizing:border-box;${v === 2 ? 'background:#808080' : 'border:1px solid #000;' + (v === 1 ? 'background:#808080' : '')}"></span>`,
    },
  };
  const optionChoice = { eraser: 1, brush: 1, airbrush: 0, line: 0, shape: 0 };

  let W = canvas.width, H = canvas.height;
  let tool = 'pencil', prevTool = 'pencil';
  let fg = '#000000', bg = '#ffffff';
  const undoStack = [], redoStack = [];
  let dirty = false;

  /* ---------- UI ---------- */

  TOOLS.forEach((t) => {
    const b = document.createElement('button');
    b.innerHTML = t.icon;
    b.title = t.tip;
    b.dataset.tool = t.id;
    b.addEventListener('click', () => selectTool(t.id));
    toolsEl.appendChild(b);
  });

  function selectTool(id) {
    if (id !== tool) prevTool = tool;
    tool = id;
    toolsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tool === id));
    statusEl.textContent = TOOLS.find((t) => t.id === id).tip;
    renderOptions();
  }

  function renderOptions() {
    const kind = TOOLS.find((t) => t.id === tool).options;
    optionsEl.innerHTML = '';
    if (!kind) return;
    OPTIONS[kind].values.forEach((v, i) => {
      const d = document.createElement('div');
      d.innerHTML = OPTIONS[kind].render(v);
      d.firstChild.style.display = 'block';
      d.classList.toggle('active', optionChoice[kind] === i);
      d.addEventListener('click', () => { optionChoice[kind] = i; renderOptions(); });
      optionsEl.appendChild(d);
    });
  }
  const opt = (kind) => OPTIONS[kind].values[optionChoice[kind]];

  PALETTE.forEach((c) => {
    const d = document.createElement('div');
    d.style.background = c;
    d.dataset.color = c;
    d.addEventListener('pointerdown', (e) => {
      if (e.button === 2) setBg(d.dataset.color); else setFg(d.dataset.color);
    });
    d.addEventListener('dblclick', () => {
      colorInput.value = d.dataset.color;
      colorInput.onchange = () => { d.dataset.color = colorInput.value; d.style.background = colorInput.value; setFg(colorInput.value); };
      colorInput.click();
    });
    paletteEl.appendChild(d);
  });

  function setFg(c) { fg = c; fgEl.style.background = c; }
  function setBg(c) { bg = c; bgEl.style.background = c; }

  /* ---------- Undo ---------- */

  function snapshot() { return { w: W, h: H, data: ctx.getImageData(0, 0, W, H) }; }
  function restore(s) {
    if (s.w !== W || s.h !== H) resizeCanvas(s.w, s.h, false);
    ctx.putImageData(s.data, 0, 0);
  }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 30) undoStack.shift();
    redoStack.length = 0;
    dirty = true;
  }
  function undo() { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
  function redo() { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }

  /* ---------- Raster primitives ---------- */

  function plot(x, y, size) {
    const o = Math.floor(size / 2);
    ctx.fillRect(x - o, y - o, size, size);
  }

  function line(x0, y0, x1, y1, size) {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      plot(x0, y0, size);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function roundLine(x0, y0, x1, y1, size) {
    if (size <= 2) return line(x0, y0, x1, y1, size);
    const r = size / 2;
    const dot = (cx, cy) => {
      for (let yy = -Math.floor(r); yy <= Math.floor(r); yy++) {
        const half = Math.floor(Math.sqrt(r * r - yy * yy));
        ctx.fillRect(cx - half, cy + yy, half * 2 + 1, 1);
      }
    };
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      dot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Horizontal span [xa, xb] covered by a shape on a given row, or null. */
  function spanFn(kind, w, h) {
    if (kind === 'rect') return (row) => (row < 0 || row >= h ? null : [0, w - 1]);
    if (kind === 'ellipse') {
      const rx = w / 2, ry = h / 2;
      return (row) => {
        if (row < 0 || row >= h) return null;
        const yc = (row + 0.5 - ry) / ry;
        const dx = rx * Math.sqrt(Math.max(0, 1 - yc * yc));
        let xa = Math.round(rx - dx), xb = Math.round(rx + dx) - 1;
        if (xb < xa) xa = xb = Math.min(w - 1, Math.max(0, Math.floor(rx)));
        return [xa, xb];
      };
    }
    const r = Math.min(7, Math.floor(w / 2), Math.floor(h / 2));
    return (row) => {
      if (row < 0 || row >= h) return null;
      let d = 0;
      if (row < r) d = r - row - 0.5;
      else if (row > h - 1 - r) d = row - (h - 1 - r) - 0.5;
      const inset = d > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))) : 0;
      return [inset, w - 1 - inset];
    };
  }

  function shape(kind, x0, y0, x1, y1, mode, c1, c2) {
    const left = Math.min(x0, x1), top = Math.min(y0, y1);
    const w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1;
    const span = spanFn(kind, w, h);
    if (mode > 0) {
      ctx.fillStyle = mode === 1 ? c2 : c1;
      for (let row = 0; row < h; row++) {
        const s = span(row);
        if (s) ctx.fillRect(left + s[0], top + row, s[1] - s[0] + 1, 1);
      }
    }
    if (mode < 2) {
      ctx.fillStyle = c1;
      for (let row = 0; row < h; row++) {
        const s = span(row);
        if (!s) continue;
        const a = span(row - 1), b = span(row + 1);
        if (!a || !b) { ctx.fillRect(left + s[0], top + row, s[1] - s[0] + 1, 1); continue; }
        const ia = Math.max(a[0], b[0]), ib = Math.min(a[1], b[1]);
        if (ia > ib) { ctx.fillRect(left + s[0], top + row, s[1] - s[0] + 1, 1); continue; }
        // Outline = this row's span minus the part covered by both neighbours,
        // but the span's end pixels are always part of the edge.
        const le = Math.max(s[0], ia - 1);
        ctx.fillRect(left + s[0], top + row, le - s[0] + 1, 1);
        const rs = Math.min(s[1], ib + 1);
        ctx.fillRect(left + rs, top + row, s[1] - rs + 1, 1);
      }
    }
  }

  const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

  function floodFill(x, y, hex) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const [r, g, b] = hexToRgb(hex);
    const i0 = (y * W + x) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    if (tr === r && tg === g && tb === b && ta === 255) return;
    const match = (px, py) => {
      const i = (py * W + px) * 4;
      return d[i] === tr && d[i + 1] === tg && d[i + 2] === tb && d[i + 3] === ta;
    };
    const set = (px, py) => {
      const i = (py * W + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    };
    const stack = [x, y];
    while (stack.length) {
      const sy = stack.pop(), sx = stack.pop();
      let xl = sx;
      while (xl >= 0 && match(xl, sy)) xl--;
      xl++;
      let up = false, down = false;
      for (let xi = xl; xi < W && match(xi, sy); xi++) {
        set(xi, sy);
        if (sy > 0) {
          if (match(xi, sy - 1)) { if (!up) { stack.push(xi, sy - 1); up = true; } } else up = false;
        }
        if (sy < H - 1) {
          if (match(xi, sy + 1)) { if (!down) { stack.push(xi, sy + 1); down = true; } } else down = false;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- Pointer handling ---------- */

  let stroke = null;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left) * (W / r.width)),
      y: Math.floor((e.clientY - r.top) * (H / r.height)),
    };
  }

  function constrain(start, p, kind) {
    const dx = p.x - start.x, dy = p.y - start.y;
    if (kind === 'line') {
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: start.x + Math.round(Math.cos(ang) * len), y: start.y + Math.round(Math.sin(ang) * len) };
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + Math.sign(dx || 1) * m, y: start.y + Math.sign(dy || 1) * m };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const p = pos(e);
    const c1 = e.button === 2 ? bg : fg, c2 = e.button === 2 ? fg : bg;

    if (tool === 'pick') {
      if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return;
      const d = ctx.getImageData(p.x, p.y, 1, 1).data;
      const hex = rgbToHex(d[0], d[1], d[2]);
      if (e.button === 2) setBg(hex); else setFg(hex);
      selectTool(prevTool === 'pick' ? 'pencil' : prevTool);
      return;
    }

    pushUndo();
    if (tool === 'fill') {
      if (p.x >= 0 && p.y >= 0 && p.x < W && p.y < H) floodFill(p.x, p.y, c1);
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    stroke = { start: p, last: p, c1, c2, base: null, timer: null, cur: p };

    if (tool === 'pencil') { ctx.fillStyle = c1; plot(p.x, p.y, 1); }
    else if (tool === 'brush') { ctx.fillStyle = c1; roundLine(p.x, p.y, p.x, p.y, opt('brush')); }
    else if (tool === 'eraser') { ctx.fillStyle = bg; plot(p.x, p.y, opt('eraser')); }
    else if (tool === 'airbrush') {
      const spray = () => {
        const r = opt('airbrush');
        ctx.fillStyle = c1;
        for (let i = 0; i < r * 1.5; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          ctx.fillRect(Math.round(stroke.cur.x + Math.cos(a) * d), Math.round(stroke.cur.y + Math.sin(a) * d), 1, 1);
        }
      };
      spray();
      stroke.timer = setInterval(spray, 30);
    } else {
      stroke.base = ctx.getImageData(0, 0, W, H);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    coordsEl.textContent = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H ? `${p.x},${p.y}` : '';
    if (!stroke) return;
    stroke.cur = p;
    const { last, c1 } = stroke;
    if (tool === 'pencil') { ctx.fillStyle = c1; line(last.x, last.y, p.x, p.y, 1); }
    else if (tool === 'brush') { ctx.fillStyle = c1; roundLine(last.x, last.y, p.x, p.y, opt('brush')); }
    else if (tool === 'eraser') { ctx.fillStyle = bg; line(last.x, last.y, p.x, p.y, opt('eraser')); }
    else if (stroke.base) {
      ctx.putImageData(stroke.base, 0, 0);
      const q = e.shiftKey ? constrain(stroke.start, p, tool) : p;
      if (tool === 'line') { ctx.fillStyle = c1; line(stroke.start.x, stroke.start.y, q.x, q.y, opt('line')); }
      else shape(tool, stroke.start.x, stroke.start.y, q.x, q.y, opt('shape'), c1, stroke.c2);
    }
    stroke.last = p;
  });

  const endStroke = () => {
    if (!stroke) return;
    clearInterval(stroke.timer);
    stroke = null;
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('pointerleave', () => { if (!stroke) coordsEl.textContent = ''; });

  /* ---------- Image operations ---------- */

  function clear() {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  function resizeCanvas(w, h, keep = true) {
    const old = keep ? ctx.getImageData(0, 0, W, H) : null;
    canvas.width = W = w;
    canvas.height = H = h;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    if (old) ctx.putImageData(old, 0, 0);
  }

  function transform(fn) {
    pushUndo();
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').drawImage(canvas, 0, 0);
    ctx.save();
    fn();
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }

  function invert() {
    pushUndo();
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    ctx.putImageData(img, 0, 0);
  }

  async function attributes() {
    const r = await Win95.dialog({
      title: 'Attributes',
      width: 260,
      html: `<fieldset><legend>Size (pixels)</legend><div style="display:flex;gap:12px">
        <label><span><u>W</u>idth:</span><input class="field" id="a-w" style="width:52px"></label>
        <label><span><u>H</u>eight:</span><input class="field" id="a-h" style="width:52px"></label></div></fieldset>`,
      buttons: [{ label: 'OK', value: true }, { label: 'Cancel', value: false }],
      onOpen: (d) => { d.querySelector('#a-w').value = W; d.querySelector('#a-h').value = H; },
      result: (ok, d) => ok && [parseInt(d.querySelector('#a-w').value, 10), parseInt(d.querySelector('#a-h').value, 10)],
    });
    if (!r) return;
    const [w, h] = r;
    if (!(w >= 1 && h >= 1 && w <= 2000 && h <= 2000)) {
      Win95.alert('Please enter a size between 1 and 2000 pixels.', { title: 'Paint', icon: 'warning' });
      return;
    }
    pushUndo();
    resizeCanvas(w, h);
  }

  function save() {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'untitled.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      dirty = false;
    });
  }

  async function confirmDiscard() {
    if (!dirty) return true;
    const r = await Win95.dialog({
      title: 'Paint', icon: 'warning', message: 'Save changes to untitled?',
      buttons: ['&Yes', '&No', 'Cancel'],
    });
    if (r === 'Cancel') return false;
    if (r === '&Yes') save();
    return true;
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      pushUndo();
      resizeCanvas(Math.min(2000, img.naturalWidth), Math.min(2000, img.naturalHeight), false);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      Win95.setTitle(f.name + ' - Paint');
    };
    img.onerror = () => Win95.alert('Paint cannot read this file.\nThis is not a valid bitmap file, or its format is not currently supported.', { title: 'Paint', icon: 'error' });
    img.src = URL.createObjectURL(f);
  });

  Win95.onMenu((action) => {
    switch (action) {
      case 'new':
        confirmDiscard().then((ok) => {
          if (!ok) return;
          undoStack.length = redoStack.length = 0;
          resizeCanvas(520, 340, false);
          dirty = false;
          Win95.setTitle('untitled - Paint');
        });
        return true;
      case 'open': confirmDiscard().then((ok) => ok && fileInput.click()); return true;
      case 'save': save(); return true;
      case 'undo': undo(); return true;
      case 'redo': redo(); return true;
      case 'clear': pushUndo(); clear(); return true;
      case 'fliph': transform(() => { ctx.translate(W, 0); ctx.scale(-1, 1); }); return true;
      case 'flipv': transform(() => { ctx.translate(0, H); ctx.scale(1, -1); }); return true;
      case 'rotate': transform(() => { ctx.translate(W, H); ctx.scale(-1, -1); }); return true;
      case 'invert': invert(); return true;
      case 'size': attributes(); return true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-layer')) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
    else if (k === 's') { e.preventDefault(); save(); }
    else if (k === 'i') { e.preventDefault(); invert(); }
    else if (k === 'n' && e.shiftKey) { e.preventDefault(); pushUndo(); clear(); }
  });

  let leaving = false;
  Win95.beforeClose = async () => (leaving = await confirmDiscard());
  window.addEventListener('beforeunload', (e) => {
    if (dirty && !leaving) { e.preventDefault(); e.returnValue = ''; }
  });

  setFg(fg);
  setBg(bg);
  resizeCanvas(W, H, false);
  selectTool('pencil');
  statusEl.textContent = 'For Help, click Help Topics on the Help Menu.';
})();
