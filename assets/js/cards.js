/* Shared playing-card engine for Solitaire and FreeCell:
   card rendering, a green table with drag & drop / click / double-click,
   card back selection and the famous bouncing-cards win animation. */
(function () {
  'use strict';

  const CW = 71, CH = 96;
  const SUITS = ['♣', '♦', '♥', '♠']; // clubs, diamonds, hearts, spades
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const TEXT = '︎'; // force text (not emoji) presentation of suit glyphs
  const BACK_KEY = 'win95.cards.back';
  const BACKS = 6;

  // Pip positions [x%, y%] within the pip area, per rank.
  const PIPS = {
    1: [[50, 50]],
    2: [[50, 0], [50, 100]],
    3: [[50, 0], [50, 50], [50, 100]],
    4: [[20, 0], [80, 0], [20, 100], [80, 100]],
    5: [[20, 0], [80, 0], [50, 50], [20, 100], [80, 100]],
    6: [[20, 0], [80, 0], [20, 50], [80, 50], [20, 100], [80, 100]],
    7: [[20, 0], [80, 0], [50, 25], [20, 50], [80, 50], [20, 100], [80, 100]],
    8: [[20, 0], [80, 0], [50, 25], [20, 50], [80, 50], [50, 75], [20, 100], [80, 100]],
    9: [[20, 0], [80, 0], [20, 33], [80, 33], [50, 50], [20, 67], [80, 67], [20, 100], [80, 100]],
    10: [[20, 0], [80, 0], [50, 17], [20, 33], [80, 33], [20, 67], [80, 67], [50, 83], [20, 100], [80, 100]],
  };

  const isRed = (c) => c.suit === 1 || c.suit === 2;

  function newDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ suit: s, rank: r, up: false });
    return d;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getBack() {
    try { const b = parseInt(localStorage.getItem(BACK_KEY), 10); if (b >= 0 && b < BACKS) return b; } catch (e) { /* ignore */ }
    return 0;
  }
  function setBack(b) { try { localStorage.setItem(BACK_KEY, b); } catch (e) { /* ignore */ } }

  const CROWN = '<svg class="crown" viewBox="0 0 22 10"><path d="M1 9L2 2l5 4 4-5 4 5 5-4 1 7z" fill="#ffd800" stroke="#000" stroke-width=".8"/></svg>';

  function cardEl(card) {
    const d = document.createElement('div');
    if (!card.up) {
      d.className = 'card back back-' + getBack();
      return d;
    }
    d.className = 'card ' + (isRed(card) ? 'red' : 'black');
    const s = SUITS[card.suit] + TEXT, r = RANKS[card.rank];
    let center;
    if (card.rank > 10) {
      center = `<div class="face">${card.rank === 13 ? CROWN : ''}<span>${r}</span><span class="fs">${s}</span></div>`;
    } else {
      center = '<div class="pips">' + PIPS[card.rank].map(([x, y]) =>
        `<span class="pip${y > 50 ? ' flip' : ''}${card.rank === 1 ? ' ace' : ''}" style="left:${x}%;top:${y}%">${s}</span>`).join('') + '</div>';
    }
    const corner = `<span>${r}</span><span class="s">${s}</span>`;
    d.innerHTML = `<div class="corner">${corner}</div>${center}<div class="corner br">${corner}</div>`;
    return d;
  }

  /** Draw a face-up card onto a fresh 71×96 canvas (used by the win animation). */
  function cardCanvas(card) {
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    const x = c.getContext('2d');
    x.beginPath();
    if (x.roundRect) x.roundRect(0.5, 0.5, CW - 1, CH - 1, 4); else x.rect(0.5, 0.5, CW - 1, CH - 1);
    x.fillStyle = '#fff';
    x.fill();
    x.strokeStyle = '#000';
    x.stroke();
    const color = isRed(card) ? '#e00000' : '#000';
    const s = SUITS[card.suit] + TEXT, r = RANKS[card.rank];
    x.fillStyle = color;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const corners = () => {
      x.font = 'bold 13px Arial, sans-serif';
      x.fillText(r, 8, 9);
      x.font = '11px Arial, sans-serif';
      x.fillText(s, 8, 21);
    };
    corners();
    x.save(); x.translate(CW, CH); x.rotate(Math.PI); corners(); x.restore();
    if (card.rank > 10) {
      x.fillStyle = '#fff8e0';
      x.fillRect(14.5, 11.5, 42, 73);
      x.fillStyle = '#ffd800';
      x.fillRect(14.5, 11.5, 42, 4);
      x.fillRect(14.5, 80.5, 42, 4);
      x.strokeStyle = color;
      x.strokeRect(14.5, 11.5, 42, 73);
      x.fillStyle = color;
      x.font = 'bold 28px Georgia, serif';
      x.fillText(r, CW / 2, 42);
      x.font = '18px Arial, sans-serif';
      x.fillText(s, CW / 2, 64);
    } else {
      const big = card.rank === 1;
      x.font = (big ? 40 : 16) + 'px Arial, sans-serif';
      for (const [px, py] of PIPS[card.rank]) {
        const cx = 14 + (px / 100) * 43, cy = 9 + (py / 100) * 78;
        x.save();
        x.translate(cx, cy);
        if (py > 50) x.rotate(Math.PI);
        x.fillText(s, 0, 1);
        x.restore();
      }
    }
    return c;
  }

  /** Deck picker dialog; resolves to the chosen back index or null. */
  function chooseBack() {
    let chosen = getBack();
    let html = '<div class="deck-picker">';
    for (let i = 0; i < BACKS; i++) html += `<div class="card back back-${i}${i === chosen ? ' chosen' : ''}" data-b="${i}"></div>`;
    html += '</div>';
    return Win95.dialog({
      title: 'Select Card Back',
      html,
      buttons: [{ label: 'OK', value: true }, { label: 'Cancel', value: false }],
      onOpen: (d) => {
        const picker = d.querySelector('.deck-picker');
        picker.addEventListener('click', (e) => {
          const c = e.target.closest('[data-b]');
          if (!c) return;
          picker.querySelectorAll('.chosen').forEach((x) => x.classList.remove('chosen'));
          c.classList.add('chosen');
          chosen = +c.dataset.b;
        });
        picker.addEventListener('dblclick', (e) => { if (e.target.closest('[data-b]')) d.querySelector('.btn.default').click(); });
      },
      result: (ok) => {
        if (!ok) return null;
        setBack(chosen);
        return chosen;
      },
    });
  }

  /**
   * A green card table that scales to fit its container.
   * game: { render(), canDrag(pile, index), drop(from, index, to),
   *         click(pile, index), dblclick(pile, index), rightclick?(pile, index) }
   * Elements created with slot()/card() carry data-pile / data-index.
   */
  class Table {
    constructor(wrap, game, width, minHeight) {
      this.wrap = wrap;
      this.game = game;
      this.width = width;
      this.minHeight = minHeight;
      this.el = document.createElement('div');
      this.el.className = 'table';
      this.layer = document.createElement('div');
      this.el.appendChild(this.layer);
      wrap.appendChild(this.el);
      this.scale = 1;
      this.height = minHeight;
      this.lastClick = null;
      this.drag = null;

      this.fit();
      new ResizeObserver(() => { if (this.fit()) game.render(); }).observe(wrap);

      this.el.addEventListener('pointerdown', (e) => this.down(e));
      this.el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.game.rightclick) {
          const t = this.target(e.target);
          this.game.rightclick(t && t.pile, t ? t.index : -1);
        }
      });
    }

    fit() {
      const cw = this.wrap.clientWidth, ch = this.wrap.clientHeight;
      if (!cw || !ch) return false;
      const s = Math.min(1, cw / this.width);
      const h = Math.max(this.minHeight, ch / s);
      const changed = s !== this.scale || h !== this.height;
      this.scale = s;
      this.height = h;
      this.el.style.width = this.width + 'px';
      this.el.style.height = h + 'px';
      this.el.style.transform = s < 1 ? `scale(${s})` : '';
      return changed;
    }

    clear() { this.layer.textContent = ''; }

    slot(pile, x, y, cls) {
      const d = document.createElement('div');
      d.className = 'slot' + (cls ? ' ' + cls : '');
      d.dataset.pile = pile;
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      this.layer.appendChild(d);
      return d;
    }

    card(card, pile, index, x, y) {
      const d = cardEl(card);
      d.dataset.pile = pile;
      d.dataset.index = index;
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      this.layer.appendChild(d);
      return d;
    }

    target(node) {
      const t = node.closest && node.closest('.card, .slot');
      if (!t || !this.layer.contains(t)) return null;
      return { el: t, pile: t.dataset.pile, index: t.classList.contains('slot') ? -1 : +t.dataset.index };
    }

    down(e) {
      if (e.button !== 0 || this.drag) return;
      const t = this.target(e.target);
      e.preventDefault();
      const drag = { x: e.clientX, y: e.clientY, t, moved: false, els: null, id: e.pointerId };
      if (t && t.index >= 0 && this.game.canDrag(t.pile, t.index)) {
        drag.els = [...this.layer.querySelectorAll('.card')].filter(
          (c) => c.dataset.pile === t.pile && +c.dataset.index >= t.index);
      }
      this.drag = drag;
      const move = (ev) => this.move(ev);
      const up = (ev) => {
        if (ev.pointerId !== drag.id) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        this.up(ev);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }

    move(e) {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      if (!d.els) return;
      if (!d.moved) {
        d.moved = true;
        d.els.forEach((c, i) => {
          c._ox = parseFloat(c.style.left);
          c._oy = parseFloat(c.style.top);
          c.style.zIndex = 2000 + i;
          c.classList.add('dragging');
        });
      }
      d.els.forEach((c) => {
        c.style.left = c._ox + dx / this.scale + 'px';
        c.style.top = c._oy + dy / this.scale + 'px';
      });
    }

    up(e) {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (e.type === 'pointercancel') { this.game.render(); return; }
      if (!d.moved) {
        const t = d.t;
        const key = t ? t.pile + ':' + t.index : '';
        const now = Date.now();
        if (this.lastClick && this.lastClick.key === key && now - this.lastClick.time < 450) {
          this.lastClick = null;
          if (t) this.game.dblclick(t.pile, t.index);
        } else {
          this.lastClick = { key, time: now };
          this.game.click(t ? t.pile : null, t ? t.index : -1);
        }
        return;
      }
      // Find the pile the dragged card overlaps most.
      const r = d.els[0].getBoundingClientRect();
      const rects = {};
      this.layer.querySelectorAll('.slot, .card:not(.dragging)').forEach((n) => {
        const p = n.dataset.pile;
        const b = n.getBoundingClientRect();
        const u = rects[p];
        rects[p] = u ? { left: Math.min(u.left, b.left), top: Math.min(u.top, b.top), right: Math.max(u.right, b.right), bottom: Math.max(u.bottom, b.bottom) } : b;
      });
      let best = null, bestArea = 0;
      for (const p in rects) {
        if (p === d.t.pile) continue;
        const b = rects[p];
        const w = Math.min(r.right, b.right) - Math.max(r.left, b.left);
        const h = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        if (w > 0 && h > 0 && w * h > bestArea) { bestArea = w * h; best = p; }
      }
      if (!best || !this.game.drop(d.t.pile, d.t.index, best)) this.game.render();
    }

    /**
     * The bouncing-cards finale. piles: [{x, y, cards:[...]}] (cards bottom→top).
     * Resolves when the animation finishes or the user clicks / presses a key.
     * Returns a promise; call the resolved function to remove the canvas.
     */
    bounce(piles) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.className = 'bounce';
        canvas.width = this.width;
        canvas.height = this.height;
        canvas.style.width = this.width + 'px';
        canvas.style.height = this.height + 'px';
        this.el.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const stacks = piles.map((p) => ({ x: p.x, y: p.y, cards: p.cards.slice() }));
        const queue = [];
        for (let more = true; more;) {
          more = false;
          for (const s of stacks) {
            const c = s.cards.pop();
            if (c) { queue.push({ card: c, x: s.x, y: s.y }); more = true; }
          }
        }

        let cur = null, raf = 0, stopped = false;
        const W = this.width, H = this.height;
        const launch = () => {
          const q = queue.shift();
          if (!q) return null;
          return {
            img: cardCanvas(q.card), x: q.x, y: q.y,
            vx: (Math.random() * 5 + 2) * (Math.random() < 0.5 ? -1 : 1),
            vy: -Math.random() * 8,
          };
        };
        const remove = () => canvas.remove();
        const stop = () => {
          if (stopped) return;
          stopped = true;
          cancelAnimationFrame(raf);
          canvas.removeEventListener('pointerdown', stop);
          document.removeEventListener('keydown', stop);
          resolve(remove);
        };
        const frame = () => {
          for (let step = 0; step < 2; step++) {
            if (!cur) cur = launch();
            if (!cur) { stop(); return; }
            cur.vy += 0.6;
            cur.x += cur.vx;
            cur.y += cur.vy;
            if (cur.y > H - CH) { cur.y = H - CH; cur.vy = -cur.vy * 0.78; }
            ctx.drawImage(cur.img, Math.round(cur.x), Math.round(cur.y));
            if (cur.x < -CW || cur.x > W) cur = null;
          }
          raf = requestAnimationFrame(frame);
        };
        canvas.addEventListener('pointerdown', stop);
        document.addEventListener('keydown', stop);
        raf = requestAnimationFrame(frame);
      });
    }
  }

  window.Cards = { CW, CH, SUITS, RANKS, isRed, newDeck, shuffle, cardEl, chooseBack, getBack, Table };
})();
