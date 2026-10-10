/* Solitaire (Klondike) with Windows standard scoring. */
(function () {
  'use strict';

  const { CW, CH, isRed } = Cards;
  const GAP = 11, COL = CW + GAP, TOP = 8, TAB_Y = TOP + CH + 16;
  const WIDTH = GAP * 2 + COL * 6 + CW;
  const DOWN = 4, UP = 18, FAN = 14;
  const colX = (i) => GAP + i * COL;
  const SETTINGS = 'win95.solitaire';

  const statusEl = document.getElementById('status-msg');
  const scoreEl = document.getElementById('score');

  let settings = { draw: 1, timed: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch (e) { /* ignore */ }

  let S, history = [], ticker = null;

  /* ---------- Model ---------- */

  function newGame() {
    const deck = Cards.shuffle(Cards.newDeck());
    const tab = [];
    for (let i = 0; i < 7; i++) {
      tab.push([]);
      for (let j = 0; j <= i; j++) {
        const c = deck.pop();
        c.up = j === i;
        tab[i].push(c);
      }
    }
    S = { stock: deck, waste: [], found: [[], [], [], []], tab, score: 0, shown: 0, time: 0, started: false, won: false };
    history = [];
    statusEl.innerHTML = '&nbsp;';
    render();
  }

  function pile(id) {
    if (id === 'stock') return S.stock;
    if (id === 'waste') return S.waste;
    return id[0] === 'f' ? S.found[+id[1]] : S.tab[+id[1]];
  }

  const top = (p) => p[p.length - 1];
  const canFound = (c, f) => (f.length ? top(f).suit === c.suit && c.rank === top(f).rank + 1 : c.rank === 1);
  const canTab = (c, t) => (t.length ? top(t).up && isRed(top(t)) !== isRed(c) && c.rank === top(t).rank - 1 : c.rank === 13);

  function snapshot() {
    history.push(JSON.stringify(S));
    if (history.length > 200) history.shift();
  }

  function undo() {
    if (!history.length || S.won) return;
    const time = S.time;
    S = JSON.parse(history.pop());
    S.time = time;
    render();
  }

  function addScore(n) { S.score = Math.max(0, S.score + n); }

  function start() {
    if (S.started) return;
    S.started = true;
  }

  function drawCards() {
    start();
    if (!S.stock.length) {
      if (!S.waste.length) return;
      snapshot();
      S.stock = S.waste.reverse().map((c) => ({ ...c, up: false }));
      S.waste = [];
      S.shown = 0;
      addScore(settings.draw === 1 ? -100 : -20);
    } else {
      snapshot();
      const n = Math.min(settings.draw, S.stock.length);
      for (let i = 0; i < n; i++) {
        const c = S.stock.pop();
        c.up = true;
        S.waste.push(c);
      }
      S.shown = n;
    }
    render();
  }

  function move(from, index, to) {
    start();
    snapshot();
    const src = pile(from), dst = pile(to);
    dst.push(...src.splice(index));
    if (from === 'waste') {
      S.shown = Math.max(0, S.shown - 1);
      addScore(to[0] === 't' ? 5 : 10);
    } else if (from[0] === 't' && to[0] === 'f') addScore(10);
    else if (from[0] === 'f' && to[0] === 't') addScore(-15);
    render();
    checkWin();
  }

  function toFoundation(from) {
    const src = pile(from);
    const c = top(src);
    if (!c || !c.up) return false;
    for (let f = 0; f < 4; f++) {
      if (canFound(c, S.found[f])) { move(from, src.length - 1, 'f' + f); return true; }
    }
    return false;
  }

  function flip(t) {
    const p = S.tab[t];
    const c = top(p);
    if (!c || c.up) return false;
    start();
    snapshot();
    c.up = true;
    addScore(5);
    render();
    return true;
  }

  async function checkWin() {
    if (S.won || !S.found.every((f) => f.length === 13)) return;
    S.won = true;
    let bonus = 0;
    if (settings.timed && S.time >= 30) bonus = Math.floor(700000 / S.time);
    S.score += bonus;
    render();
    statusEl.textContent = bonus ? `Bonus: ${bonus}` : 'You win!';
    const remove = await table.bounce(S.found.map((f, i) => ({ x: colX(3 + i), y: TOP, cards: f })));
    const again = await Win95.confirm('Deal again?', { title: 'Solitaire' });
    remove();
    if (again === '&Yes') newGame();
  }

  /* ---------- Clock ---------- */

  ticker = setInterval(() => {
    if (!S || !S.started || S.won || !settings.timed || document.hidden) return;
    S.time++;
    if (S.time % 10 === 0) addScore(-2);
    updateStatus();
  }, 1000);

  /* ---------- View ---------- */

  function updateStatus() {
    scoreEl.textContent = `Score: ${S.score}` + (settings.timed ? `\u00a0\u00a0\u00a0Time: ${S.time}` : '');
  }

  function render() {
    table.clear();

    // Stock
    if (!S.stock.length) table.slot('stock', colX(0), TOP, 'recycle');
    else {
      table.slot('stock', colX(0), TOP);
      S.stock.forEach((c, i) => { const o = Math.floor(i / 10) * 2; table.card(c, 'stock', i, colX(0) + o, TOP + o); });
    }

    // Waste (fan up to three cards in Draw Three)
    const fanStart = S.waste.length - Math.max(1, S.shown);
    S.waste.forEach((c, i) => {
      const x = colX(1) + (i > fanStart ? (i - fanStart) * FAN : 0);
      table.card(c, 'waste', i, x, TOP);
    });

    // Foundations
    S.found.forEach((f, k) => {
      table.slot('f' + k, colX(3 + k), TOP);
      f.forEach((c, i) => table.card(c, 'f' + k, i, colX(3 + k), TOP));
    });

    // Tableau
    const avail = table.height - TAB_Y - CH - 6;
    S.tab.forEach((t, k) => {
      table.slot('t' + k, colX(k), TAB_Y);
      const downs = t.filter((c) => !c.up).length, ups = t.length - downs;
      let upOff = UP;
      if (ups > 1 && downs * DOWN + (ups - 1) * UP > avail) upOff = Math.max(5, (avail - downs * DOWN) / (ups - 1));
      let y = TAB_Y;
      t.forEach((c, i) => {
        table.card(c, 't' + k, i, colX(k), y);
        y += c.up ? upOff : DOWN;
      });
    });

    updateStatus();
    Win95.setDisabled('undo', !history.length);
  }

  /* ---------- Input ---------- */

  const game = {
    render,
    canDrag(p, i) {
      if (S.won) return false;
      if (p === 'waste' || p[0] === 'f') return i === pile(p).length - 1;
      if (p[0] === 't') return pile(p)[i].up;
      return false;
    },
    drop(from, index, to) {
      const cards = pile(from).slice(index);
      if (to[0] === 'f') {
        if (cards.length !== 1 || !canFound(cards[0], pile(to))) return false;
      } else if (to[0] === 't') {
        if (!canTab(cards[0], pile(to))) return false;
      } else return false;
      move(from, index, to);
      return true;
    },
    click(p, i) {
      if (S.won || !p) return;
      if (p === 'stock') drawCards();
      else if (p[0] === 't' && i >= 0 && i === pile(p).length - 1) flip(+p[1]);
    },
    dblclick(p, i) {
      if (S.won || !p) return;
      if (p === 'stock') return drawCards();
      if (p[0] === 't' && flip(+p[1])) return;
      if ((p === 'waste' || p[0] === 't') && i === pile(p).length - 1) toFoundation(p);
    },
    rightclick() {
      // Like the original: right-click plays every available card to the foundations.
      if (S.won) return;
      let moved = true;
      while (moved && !S.won) {
        moved = toFoundation('waste');
        for (let t = 0; t < 7 && !moved; t++) moved = toFoundation('t' + t);
      }
    },
  };

  const table = new Cards.Table(document.getElementById('wrap'), game, WIDTH, 380);

  /* ---------- Menus ---------- */

  function saveSettings() {
    try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    Win95.setChecked('draw1', settings.draw === 1);
    Win95.setChecked('draw3', settings.draw === 3);
    Win95.setChecked('timed', settings.timed);
  }

  Win95.onMenu((action) => {
    switch (action) {
      case 'deal': newGame(); return true;
      case 'undo': undo(); return true;
      case 'deck': Cards.chooseBack().then((b) => b !== null && render()); return true;
      case 'draw1':
      case 'draw3': {
        const d = action === 'draw1' ? 1 : 3;
        if (d !== settings.draw) { settings.draw = d; saveSettings(); newGame(); }
        return true;
      }
      case 'timed': settings.timed = !settings.timed; saveSettings(); updateStatus(); return true;
      case 'howto':
        Win95.dialog({
          title: 'Solitaire Help',
          width: 380,
          icon: 'info',
          message:
            'Build four stacks of cards, one per suit, from Ace up to King.\n\n' +
            '• On the seven tableau piles, stack cards in descending order, alternating red and black.\n' +
            '• Only a King can be moved to an empty pile.\n' +
            '• Click the deck to deal cards. Click a face-down card to turn it over.\n' +
            '• Drag cards to move them. Double-click a card to send it to a suit stack.\n' +
            '• Right-click the table to play every card that can go to the suit stacks.',
        });
        return true;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-layer')) return;
    if (e.key === 'F2') { e.preventDefault(); newGame(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  saveSettings();
  newGame();
})();
