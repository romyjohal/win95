/* FreeCell — deals are numbered 1–32000 and match the original Microsoft deals. */
(function () {
  'use strict';

  const { CW, CH, isRed } = Cards;
  const WIDTH = 640, TOP = 0, TAB_Y = CH + 20, COL = 79, MARGIN = 8, UP = 18;
  const colX = (i) => MARGIN + i * COL;
  const cellX = (i) => i * CW;
  const foundX = (i) => WIDTH - (4 - i) * CW;
  const STATS = 'win95.freecell.stats';

  const cardsLeftEl = document.getElementById('cards-left');

  let S, history = [], sel = null, kingFlip = false;

  /* ---------- Microsoft-compatible deal ---------- */

  function deal(n) {
    let seed = n;
    const rand = () => {
      seed = (seed * 214013 + 2531011) % 2147483648;
      return Math.floor(seed / 65536);
    };
    const cards = [];
    for (let i = 51; i >= 0; i--) cards.push(i);
    for (let i = 0; i < 52; i++) {
      const j = 51 - (rand() % (52 - i));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const tab = [[], [], [], [], [], [], [], []];
    cards.forEach((c, i) => tab[i % 8].push({ rank: (c >> 2) + 1, suit: c & 3, up: true }));
    return tab;
  }

  /* ---------- Stats ---------- */

  function loadStats() {
    try { return Object.assign({ played: 0, won: 0, streak: 0, best: 0 }, JSON.parse(localStorage.getItem(STATS))); } catch (e) { return { played: 0, won: 0, streak: 0, best: 0 }; }
  }
  function saveStats(st) { try { localStorage.setItem(STATS, JSON.stringify(st)); } catch (e) { /* ignore */ } }
  function recordResult(won) {
    const st = loadStats();
    st.played++;
    if (won) { st.won++; st.streak = Math.max(1, st.streak + 1); }
    else st.streak = Math.min(-1, st.streak - 1);
    st.best = Math.max(st.best, st.streak);
    saveStats(st);
  }

  /* ---------- Model ---------- */

  function startGame(n) {
    if (S && S.moved && !S.won) recordResult(false);
    S = { game: n, cells: [[], [], [], []], found: [[], [], [], []], tab: deal(n), won: false, moved: false };
    history = [];
    sel = null;
    Win95.setTitle(`FreeCell Game #${n}`);
    render();
  }
  const randomGame = () => 1 + Math.floor(Math.random() * 32000);

  function pile(id) {
    const k = +id.slice(1);
    return id[0] === 'c' ? S.cells[k] : id[0] === 'f' ? S.found[k] : S.tab[k];
  }
  const top = (p) => p[p.length - 1];
  const canFound = (c, f) => (f.length ? top(f).suit === c.suit && c.rank === top(f).rank + 1 : c.rank === 1);
  const canTab = (c, t) => !t.length || (isRed(top(t)) !== isRed(c) && c.rank === top(t).rank - 1);
  const linked = (a, b) => isRed(a) !== isRed(b) && b.rank === a.rank - 1;

  function seqStart(col) {
    let i = col.length - 1;
    while (i > 0 && linked(col[i - 1], col[i])) i--;
    return i;
  }

  function maxMove(toEmpty) {
    const free = S.cells.filter((c) => !c.length).length;
    const empties = S.tab.filter((t) => !t.length).length - (toEmpty ? 1 : 0);
    return (free + 1) * Math.pow(2, Math.max(0, empties));
  }

  function snapshot() {
    history.push(JSON.stringify(S));
    if (history.length > 500) history.shift();
  }

  function undo() {
    if (!history.length || S.won) return;
    S = JSON.parse(history.pop());
    sel = null;
    render();
  }

  function doMove(from, index, to) {
    snapshot();
    S.moved = true;
    sel = null;
    pile(to).push(...pile(from).splice(index));
    autoPlay();
    render();
    afterMove();
  }

  function foundFor(c) {
    for (let f = 0; f < 4; f++) if (canFound(c, S.found[f])) return f;
    return -1;
  }
  function foundRank(suit) {
    const f = S.found.find((p) => p.length && p[0].suit === suit);
    return f ? f.length : 0;
  }
  // A card is safe to auto-play when no card that could still need it is left.
  function safe(c) {
    if (c.rank <= 2) return true;
    const opp = isRed(c) ? [0, 3] : [1, 2];
    return opp.every((s) => foundRank(s) >= c.rank - 1);
  }

  function autoPlay() {
    let moved = true;
    while (moved) {
      moved = false;
      for (const src of [...S.cells, ...S.tab]) {
        const c = top(src);
        if (!c || !safe(c)) continue;
        const f = foundFor(c);
        if (f >= 0) { S.found[f].push(src.pop()); moved = true; }
      }
    }
  }

  function stuck() {
    if (S.cells.some((c) => !c.length) || S.tab.some((t) => !t.length)) return false;
    const tops = [...S.cells, ...S.tab].map(top);
    return !tops.some((c) => foundFor(c) >= 0 || S.tab.some((t) => top(t) !== c && canTab(c, t)));
  }

  async function afterMove() {
    if (S.found.every((f) => f.length === 13)) {
      S.won = true;
      recordResult(true);
      render();
      const remove = await table.bounce(S.found.map((f, i) => ({ x: foundX(i), y: TOP, cards: f })));
      const again = await Win95.confirm('Congratulations, you win!\n\nDo you want to play again?', { title: 'Game Over', icon: 'info' });
      remove();
      if (again === '&Yes') startGame(randomGame());
      return;
    }
    if (stuck()) {
      const r = await Win95.confirm('There are no more legal moves.\n\nDo you want to restart this game?', { title: 'Game Over', icon: 'warning' });
      if (r === '&Yes') { recordResult(false); S.moved = false; startGame(S.game); }
    }
  }

  function notAllowed(msg) {
    sel = null;
    render();
    Win95.alert(msg || 'That move is not allowed.', { title: 'FreeCell', icon: 'warning' });
  }

  function tryMove(from, to) {
    const src = pile(from), dst = pile(to);
    if (!src.length || from === to) return;
    const c = top(src);
    if (to[0] === 'f') return canFound(c, dst) ? doMove(from, src.length - 1, to) : notAllowed();
    if (to[0] === 'c') return dst.length ? notAllowed() : doMove(from, src.length - 1, to);
    // To a column: find the longest movable run that fits.
    const first = from[0] === 't' ? seqStart(src) : 0;
    const limit = maxMove(!dst.length);
    for (let i = first; i < src.length; i++) {
      if (canTab(src[i], dst) && src.length - i <= limit) return doMove(from, i, to);
    }
    for (let i = first; i < src.length; i++) {
      if (canTab(src[i], dst)) {
        return notAllowed(`That move requires moving ${src.length - i} cards. You only have enough free space to move ${limit} card${limit === 1 ? '' : 's'}.`);
      }
    }
    notAllowed();
  }

  /* ---------- View ---------- */

  function render() {
    table.clear();
    for (let i = 0; i < 4; i++) {
      table.slot('c' + i, cellX(i), TOP, 'free');
      S.cells[i].forEach((c) => table.card(c, 'c' + i, 0, cellX(i), TOP));
      table.slot('f' + i, foundX(i), TOP, 'free');
      S.found[i].forEach((c, j) => table.card(c, 'f' + i, j, foundX(i), TOP));
    }

    const king = document.createElement('img');
    king.className = 'king';
    king.src = Win95.iconUrl('freecell');
    king.alt = '';
    king.style.left = WIDTH / 2 - 18 + 'px';
    king.style.top = TOP + 30 + 'px';
    king.style.transform = kingFlip ? 'scaleX(-1)' : '';
    table.layer.appendChild(king);

    const avail = table.height - TAB_Y - CH - 6;
    S.tab.forEach((t, k) => {
      table.slot('t' + k, colX(k), TAB_Y);
      const off = t.length > 1 ? Math.max(6, Math.min(UP, avail / (t.length - 1))) : UP;
      t.forEach((c, i) => table.card(c, 't' + k, i, colX(k), TAB_Y + i * off));
    });

    if (sel) {
      const p = pile(sel);
      const node = [...table.layer.querySelectorAll('.card')].find((n) => n.dataset.pile === sel && +n.dataset.index === p.length - 1);
      if (node) node.classList.add('selected');
    }

    const left = 52 - S.found.reduce((n, f) => n + f.length, 0);
    cardsLeftEl.textContent = 'Cards Left: ' + left;
    Win95.setDisabled('undo', !history.length);
  }

  /* ---------- Input ---------- */

  const game = {
    render,
    canDrag(p, i) {
      if (S.won || p[0] === 'f') return false;
      return p[0] === 'c' || i >= seqStart(pile(p));
    },
    drop(from, index, to) {
      const src = pile(from), dst = pile(to);
      const n = src.length - index;
      sel = null;
      if (to[0] === 'c') {
        if (n !== 1 || dst.length) return false;
      } else if (to[0] === 'f') {
        if (n !== 1 || !canFound(src[index], dst)) return false;
      } else {
        if (!canTab(src[index], dst)) return false;
        const limit = maxMove(!dst.length);
        if (n > limit) {
          render();
          Win95.alert(`That move requires moving ${n} cards. You only have enough free space to move ${limit} card${limit === 1 ? '' : 's'}.`, { title: 'FreeCell', icon: 'warning' });
          return true;
        }
      }
      doMove(from, index, to);
      return true;
    },
    click(p) {
      if (S.won) return;
      if (!sel) {
        if (p && p[0] !== 'f' && pile(p).length) { sel = p; render(); }
        return;
      }
      if (!p || p === sel) { sel = null; render(); return; }
      const from = sel;
      sel = null;
      tryMove(from, p);
    },
    dblclick(p) {
      // Double-click sends a column's bottom card to a free cell.
      if (S.won || !p) return;
      sel = null;
      if (p[0] !== 't' || !pile(p).length) { render(); return; }
      const free = S.cells.findIndex((c) => !c.length);
      if (free < 0) { render(); return; }
      doMove(p, pile(p).length - 1, 'c' + free);
    },
  };

  const table = new Cards.Table(document.getElementById('wrap'), game, WIDTH, 400);

  table.el.addEventListener('pointermove', (e) => {
    const r = table.el.getBoundingClientRect();
    const flip = e.clientX < r.left + r.width / 2;
    if (flip !== kingFlip) {
      kingFlip = flip;
      const k = table.layer.querySelector('.king');
      if (k) k.style.transform = flip ? 'scaleX(-1)' : '';
    }
  });

  /* ---------- Menus ---------- */

  async function selectGame() {
    const v = await Win95.prompt('Select a game number from 1 to 32000:', String(randomGame()), { title: 'Game Number' });
    if (v === null) return;
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 32000) startGame(n);
    else Win95.alert('Please enter a number from 1 to 32000.', { title: 'FreeCell', icon: 'warning' });
  }

  Win95.onMenu((action) => {
    switch (action) {
      case 'new': startGame(randomGame()); return true;
      case 'select': selectGame(); return true;
      case 'restart': {
        const n = S.game;
        if (S.moved && !S.won) recordResult(false);
        S.moved = false;
        startGame(n);
        return true;
      }
      case 'undo': undo(); return true;
      case 'stats': {
        const st = loadStats();
        const pct = st.played ? Math.round((st.won / st.played) * 100) : 0;
        Win95.dialog({
          title: 'FreeCell Statistics',
          icon: 'info',
          message: `Total games played: ${st.played}\nGames won: ${st.won} (${pct}%)\n\n` +
            `Current streak: ${Math.abs(st.streak)} ${st.streak >= 0 ? 'win' : 'loss'}${Math.abs(st.streak) === 1 ? '' : (st.streak >= 0 ? 's' : 'es')}\n` +
            `Best winning streak: ${st.best}`,
          buttons: ['OK', { label: '&Clear', value: 'clear' }],
          cancelValue: 'OK',
        }).then((r) => { if (r === 'clear') saveStats({ played: 0, won: 0, streak: 0, best: 0 }); });
        return true;
      }
      case 'howto':
        Win95.dialog({
          title: 'FreeCell Help',
          width: 400,
          icon: 'info',
          message:
            'Move all the cards to the four home cells at the upper right, building each suit up from Ace to King.\n\n' +
            '• Columns are built down in alternating colors.\n' +
            '• The four free cells at the upper left each hold one card.\n' +
            '• Click a card to select it, then click where it should go — or just drag it.\n' +
            '• Double-click a card to move it to a free cell.\n' +
            '• Moving several cards at once needs enough free cells and empty columns.',
        });
        return true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-layer')) return;
    if (e.key === 'F2') { e.preventDefault(); startGame(randomGame()); }
    else if (e.key === 'F3') { e.preventDefault(); selectGame(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  window.addEventListener('pagehide', () => { if (S && S.moved && !S.won) recordResult(false); });

  startGame(randomGame());
})();
