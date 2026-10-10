/* ==========================================================================
   Windows 95 shell: desktop icons, taskbar, Start menu, window chrome,
   menu bars and message boxes. Loaded by every page before the app script.

   Each page sets <body data-root="../"> (path back to the site root) and may
   contain one <div class="window" id="app-window" data-title=".." data-icon="..">.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.body.dataset.root || './';

  const APPS = [
    { id: 'calculator', name: 'Calculator', group: 'Accessories', cmd: ['calc', 'calculator'] },
    { id: 'notepad', name: 'Notepad', group: 'Accessories', cmd: ['notepad'] },
    { id: 'paint', name: 'Paint', group: 'Accessories', cmd: ['mspaint', 'pbrush', 'paint'] },
    { id: 'freecell', name: 'FreeCell', group: 'Games', cmd: ['freecell'] },
    { id: 'minesweeper', name: 'Minesweeper', group: 'Games', cmd: ['winmine', 'minesweeper'] },
    { id: 'solitaire', name: 'Solitaire', group: 'Games', cmd: ['sol', 'solitaire'] },
  ];

  const iconUrl = (id) => root + 'assets/icons/' + id + '.svg';
  const appUrl = (id) => root + id + '/index.html';
  const homeUrl = root + 'index.html';

  const GLYPHS = {
    min: '<svg width="8" height="7" viewBox="0 0 8 7"><rect x="1" y="5" width="6" height="2"/></svg>',
    max: '<svg width="9" height="9" viewBox="0 0 9 9"><path fill-rule="evenodd" d="M0 0h9v9H0zM1 2v6h7V2z"/></svg>',
    restore: '<svg width="8" height="9" viewBox="0 0 8 9"><path fill-rule="evenodd" d="M2 0h6v5H7V2H3V3H2zM0 3h6v6H0zM1 5v3h4V5z"/></svg>',
    close: '<svg width="8" height="7" viewBox="0 0 8 7"><path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"/></svg>',
  };

  const ICONS = {
    info: '<svg class="dialog-icon" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000"/><rect x="14" y="7" width="4" height="4" fill="#0000ff"/><rect x="14" y="13" width="4" height="12" fill="#0000ff"/></svg>',
    warning: '<svg class="dialog-icon" viewBox="0 0 32 32"><path d="M16 2L30 29H2z" fill="#ffff00" stroke="#000"/><rect x="14.5" y="10" width="3" height="11"/><rect x="14.5" y="23" width="3" height="3"/></svg>',
    error: '<svg class="dialog-icon" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#ff0000" stroke="#800000"/><path d="M10 10l12 12M22 10L10 22" stroke="#fff" stroke-width="3.5"/></svg>',
    question: '<svg class="dialog-icon" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000"/><text x="16" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="20" fill="#0000ff">?</text></svg>',
  };

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const accel = (s) => String(s).replace(/&(.)/, '<u>$1</u>');
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let desktop, taskbar, startMenu, startBtn, appWindow, taskBtn;
  const menuHandlers = [];

  /* ---------------- Navigation ---------------- */

  function openApp(id) {
    document.body.classList.add('busy');
    location.href = appUrl(id);
  }

  async function close() {
    if (Win95.beforeClose) {
      const ok = await Win95.beforeClose();
      if (!ok) return;
    }
    document.body.classList.add('busy');
    location.href = homeUrl;
  }

  /* ---------------- Desktop icons ---------------- */

  function buildDesktop() {
    desktop = document.getElementById('desktop');
    if (!desktop) {
      desktop = el('div', 'desktop');
      desktop.id = 'desktop';
      document.body.prepend(desktop);
    }
    const wrap = el('div', 'desktop-icons');
    const coarse = matchMedia('(hover: none)').matches;
    for (const app of APPS) {
      const a = el('a', 'desktop-icon', `<img src="${iconUrl(app.id)}" alt=""><span>${app.name}</span>`);
      a.href = appUrl(app.id);
      a.draggable = false;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectIcon(a);
        if (coarse) openApp(app.id);
      });
      a.addEventListener('dblclick', (e) => { e.preventDefault(); openApp(app.id); });
      a.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); openApp(app.id); } });
      wrap.appendChild(a);
    }
    desktop.prepend(wrap);
    desktop.addEventListener('pointerdown', (e) => {
      if (e.target === desktop || e.target === wrap) {
        selectIcon(null);
        if (appWindow) setActive(false);
      }
    });
  }

  function selectIcon(icon) {
    desktop.querySelectorAll('.desktop-icon.selected').forEach((i) => i.classList.remove('selected'));
    if (icon) { icon.classList.add('selected'); icon.focus(); }
  }

  /* ---------------- Taskbar & Start menu ---------------- */

  function buildTaskbar() {
    taskbar = el('div', 'taskbar');
    startBtn = el('button', 'start-button', `<img src="${iconUrl('windows')}" alt=""><span>Start</span>`);
    const tasks = el('div', 'task-buttons');
    const tray = el('div', 'tray');
    const clock = el('span', 'clock');
    tray.appendChild(clock);
    taskbar.append(startBtn, tasks, tray);
    document.body.appendChild(taskbar);

    const tick = () => {
      const d = new Date();
      clock.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      tray.title = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };
    tick();
    setInterval(tick, 10000);

    buildStartMenu();
    startBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    startBtn.addEventListener('click', () => toggleStart());
    document.addEventListener('pointerdown', (e) => {
      if (!startMenu.contains(e.target)) toggleStart(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleStart(false);
      if ((e.key === 'Meta' || e.key === 'OS')) { e.preventDefault(); toggleStart(); }
    });

    return tasks;
  }

  function toggleStart(force) {
    const open = force != null ? force : !startMenu.classList.contains('open');
    startMenu.classList.toggle('open', open);
    startBtn.classList.toggle('active', open);
    if (!open) startMenu.querySelectorAll('.open').forEach((i) => i.classList.remove('open'));
  }

  function buildStartMenu() {
    startMenu = el('div', 'start-menu');
    startMenu.innerHTML = '<div class="start-stripe"><span>Windows<b>95</b></span></div>';
    const items = el('div', 'start-items');

    const leaf = (icon, label, fn, small) => {
      const i = el('div', 'sm-item', `<img src="${iconUrl(icon)}" alt=""><span>${accel(label)}</span>`);
      i.addEventListener('click', (e) => { e.stopPropagation(); toggleStart(false); fn(); });
      return i;
    };
    const branch = (icon, label, children) => {
      const i = el('div', 'sm-item has-sub', `<img src="${iconUrl(icon)}" alt=""><span>${accel(label)}</span><span class="arrow"></span>`);
      const sub = el('div', 'submenu');
      children.forEach((c) => sub.appendChild(c));
      i.appendChild(sub);
      i.addEventListener('click', (e) => {
        if (e.target.closest('.submenu') !== sub && e.target.closest('.sm-item') === i) {
          e.stopPropagation();
          const wasOpen = i.classList.contains('open');
          i.parentElement.querySelectorAll(':scope > .sm-item.open').forEach((s) => s.classList.remove('open'));
          i.classList.toggle('open', !wasOpen);
        }
      });
      i.addEventListener('mouseenter', () => {
        i.parentElement.querySelectorAll(':scope > .sm-item.open').forEach((s) => s !== i && s.classList.remove('open'));
      });
      return i;
    };

    const group = (g) => APPS.filter((a) => a.group === g).map((a) => leaf(a.id, a.name, () => openApp(a.id)));
    const programs = branch('folder', '&Programs', [
      branch('folder', 'Accessories', group('Accessories')),
      branch('folder', 'Games', group('Games')),
    ]);

    items.append(
      programs,
      leaf('help', '&Help', () => about('Windows 95')),
      leaf('run', '&Run...', runDialog),
      el('hr'),
      leaf('shutdown', 'Sh&ut Down...', shutdownDialog),
    );
    startMenu.appendChild(items);
    document.body.appendChild(startMenu);
  }

  /* ---------------- Windows ---------------- */

  function makeTitleBar(win, { title, icon, buttons }) {
    const bar = el('div', 'title-bar');
    bar.innerHTML = (icon ? `<img src="${iconUrl(icon)}" alt="">` : '') + `<span class="title-text"></span><div class="title-buttons"></div>`;
    bar.querySelector('.title-text').textContent = title;
    const btns = bar.querySelector('.title-buttons');
    for (const b of buttons) {
      const btn = el('button', '', GLYPHS[b.glyph]);
      btn.dataset.wa = b.glyph;
      btn.setAttribute('aria-label', b.label);
      btn.tabIndex = -1;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', b.fn);
      btns.appendChild(btn);
    }
    win.prepend(bar);
    makeDraggable(win, bar);
    return bar;
  }

  function makeDraggable(win, handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || win.classList.contains('maximized')) return;
      const container = win.offsetParent || document.body;
      const sx = e.clientX, sy = e.clientY, ox = win.offsetLeft, oy = win.offsetTop;
      const maxX = container.clientWidth - 40, maxY = container.clientHeight - 20;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        win.style.left = Math.min(maxX, Math.max(-win.offsetWidth + 60, ox + ev.clientX - sx)) + 'px';
        win.style.top = Math.min(maxY, Math.max(0, oy + ev.clientY - sy)) + 'px';
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  function centerWindow(win, container) {
    const cw = container.clientWidth, ch = container.clientHeight;
    win.style.left = Math.max(0, Math.round((cw - win.offsetWidth) / 2)) + 'px';
    win.style.top = Math.max(0, Math.round((ch - win.offsetHeight) / 2.4)) + 'px';
  }

  function setActive(active) {
    if (!appWindow) return;
    appWindow.classList.toggle('inactive', !active);
    if (taskBtn) taskBtn.classList.toggle('active', active && !appWindow.classList.contains('hidden'));
  }

  function setupAppWindow(tasks) {
    appWindow = document.getElementById('app-window');
    if (!appWindow) return;
    const title = appWindow.dataset.title || document.title;
    const icon = appWindow.dataset.icon;
    const maximizable = appWindow.dataset.maximizable !== 'false';

    const toggleMax = () => {
      if (!maximizable) return;
      const max = appWindow.classList.toggle('maximized');
      const b = appWindow.querySelector('[data-wa="max"], [data-wa="restore"]');
      b.innerHTML = max ? GLYPHS.restore : GLYPHS.max;
      b.dataset.wa = max ? 'restore' : 'max';
      window.dispatchEvent(new Event('resize'));
    };
    const minimize = () => {
      appWindow.classList.add('hidden');
      setActive(false);
    };

    const bar = makeTitleBar(appWindow, {
      title, icon,
      buttons: [
        { glyph: 'min', label: 'Minimize', fn: minimize },
        { glyph: 'max', label: 'Maximize', fn: toggleMax, disabled: !maximizable },
        { glyph: 'close', label: 'Close', fn: close },
      ],
    });
    bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) toggleMax(); });
    appWindow.addEventListener('pointerdown', () => setActive(true), true);

    taskBtn = el('button', 'task-btn active', `<img src="${iconUrl(icon)}" alt=""><span></span>`);
    taskBtn.querySelector('span').textContent = title;
    taskBtn.addEventListener('click', () => {
      if (appWindow.classList.contains('hidden')) {
        appWindow.classList.remove('hidden');
        setActive(true);
      } else if (appWindow.classList.contains('inactive')) {
        setActive(true);
      } else {
        minimize();
      }
    });
    tasks.appendChild(taskBtn);

    setupMenus(appWindow);

    Win95.appWindow = appWindow;
    Win95.toggleMaximize = toggleMax;
    Win95.center = () => {
      if (appWindow.classList.contains('maximized')) return;
      if (maximizable && appWindow.offsetWidth > desktop.clientWidth - 8) {
        toggleMax();
        return;
      }
      centerWindow(appWindow, desktop);
    };
    requestAnimationFrame(() => Win95.center());
  }

  function setTitle(text) {
    if (!appWindow) return;
    appWindow.querySelector('.title-text').textContent = text;
    if (taskBtn) taskBtn.querySelector('span').textContent = text;
    document.title = text;
  }

  /* ---------------- Menu bars ---------------- */

  function setupMenus(win) {
    const bar = win.querySelector('.menubar');
    if (!bar) return;
    let openMenu = null;

    const closeAll = () => {
      if (openMenu) openMenu.classList.remove('open');
      openMenu = null;
    };
    const openIt = (m) => {
      if (openMenu === m) return;
      closeAll();
      m.classList.add('open');
      openMenu = m;
    };

    bar.querySelectorAll(':scope > .menu').forEach((menu) => {
      const title = el('div', 'menu-title', accel(menu.dataset.label));
      const dd = el('div', 'dropdown');
      [...menu.children].forEach((child) => {
        if (child.tagName === 'HR') { dd.appendChild(child); return; }
        child.classList.add('mi');
        const label = child.innerHTML;
        child.innerHTML = `<span>${accel(label)}</span><span>${child.dataset.shortcut || ''}</span>`;
        dd.appendChild(child);
      });
      menu.append(title, dd);

      title.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (menu.classList.contains('open')) closeAll(); else openIt(menu);
      });
      title.addEventListener('pointerenter', () => { if (openMenu) openIt(menu); });
      dd.addEventListener('click', (e) => {
        const item = e.target.closest('.mi');
        if (!item || item.classList.contains('disabled')) return;
        closeAll();
        dispatchMenu(item.dataset.action, item);
      });
    });
    document.addEventListener('pointerdown', (e) => {
      if (openMenu && !openMenu.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  }

  function dispatchMenu(action, item) {
    for (const fn of menuHandlers) {
      if (fn(action, item) === true) return;
    }
    if (action === 'exit') close();
    else if (action === 'about') about(appWindow ? appWindow.dataset.title : 'Windows 95');
  }

  const menuItem = (action) => appWindow && appWindow.querySelector(`.mi[data-action="${action}"]`);
  function setChecked(action, on) { const m = menuItem(action); if (m) m.classList.toggle('checked', !!on); }
  function setDisabled(action, on) { const m = menuItem(action); if (m) m.classList.toggle('disabled', !!on); }

  /* ---------------- Dialogs ---------------- */

  /**
   * Show a modal message box.
   * opts: { title, message | html, icon, buttons: ['OK'] | [{label, value}], width,
   *         dither, onOpen(dlg), result(value, dlg) }
   * Resolves with the clicked button value ('cancel'/last button on Esc or close).
   */
  function dialog(opts) {
    return new Promise((resolve) => {
      const layer = el('div', 'modal-layer' + (opts.dither ? ' dither' : ''));
      const win = el('div', 'window dialog');
      if (opts.width) win.style.width = opts.width + 'px';
      const buttons = (opts.buttons || ['OK']).map((b) => (typeof b === 'string' ? { label: b, value: b } : b));
      const cancelValue = opts.cancelValue !== undefined ? opts.cancelValue : buttons[buttons.length - 1].value;

      const body = el('div', 'dialog-body');
      const content = el('div', 'dialog-content');
      if (opts.icon) content.insertAdjacentHTML('beforeend', ICONS[opts.icon]);
      const msg = el('div', 'dialog-msg' + (opts.html ? ' html' : ''));
      if (opts.html) msg.innerHTML = opts.html; else msg.textContent = opts.message || '';
      content.appendChild(msg);
      const row = el('div', 'dialog-buttons');
      buttons.forEach((b, i) => {
        const btn = el('button', 'btn' + (i === 0 ? ' default' : ''), accel(b.label));
        btn.addEventListener('click', () => finish(b.value));
        row.appendChild(btn);
      });
      body.append(content, row);
      win.appendChild(body);

      makeTitleBar(win, { title: opts.title || 'Windows', buttons: [{ glyph: 'close', label: 'Close', fn: () => finish(cancelValue) }] });

      const prevActive = appWindow && !appWindow.classList.contains('inactive');
      if (appWindow) appWindow.classList.add('inactive');

      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); finish(cancelValue); }
        else if (e.key === 'Enter' && !(e.target.tagName === 'TEXTAREA')) {
          if (e.target.tagName === 'BUTTON') return;
          e.preventDefault();
          finish(buttons[0].value);
        }
        e.stopPropagation();
      };

      function finish(value) {
        if (opts.validate && value === buttons[0].value && opts.validate(win) === false) return;
        const result = opts.result ? opts.result(value, win) : value;
        document.removeEventListener('keydown', onKey, true);
        layer.remove();
        if (appWindow && prevActive) appWindow.classList.remove('inactive');
        resolve(result);
      }

      layer.appendChild(win);
      document.body.appendChild(layer);
      document.addEventListener('keydown', onKey, true);
      centerWindow(win, layer);
      if (opts.onOpen) opts.onOpen(win);
      const focusTarget = win.querySelector('input, select, textarea') || row.firstChild;
      focusTarget.focus();
      if (focusTarget.select) focusTarget.select();
    });
  }

  const alert = (message, opts = {}) => dialog({ title: opts.title, message, icon: opts.icon || 'info', buttons: ['OK'] });
  const confirm = (message, opts = {}) =>
    dialog({ title: opts.title, message, icon: opts.icon || 'question', buttons: opts.buttons || ['&Yes', '&No'] });

  function prompt(label, value = '', opts = {}) {
    return dialog({
      title: opts.title,
      html: `<label style="display:flex;flex-direction:column;align-items:stretch;gap:4px">${escapeHtml(label)}<input class="field" style="width:100%"></label>`,
      buttons: [{ label: 'OK', value: true }, { label: 'Cancel', value: false }],
      width: opts.width || 300,
      onOpen: (d) => { d.querySelector('input').value = value; },
      result: (ok, d) => (ok ? d.querySelector('input').value : null),
    });
  }

  function about(name) {
    return dialog({
      title: 'About ' + name,
      width: 380,
      html: `<div style="display:flex;gap:16px"><img src="${iconUrl('windows')}" width="48" height="48" alt="">
        <div style="line-height:16px"><b>${escapeHtml(name)}</b><br>Windows 95 — a tribute for the web<br><br>
        A hand-built recreation running entirely in your browser.<br>
        Not affiliated with or endorsed by Microsoft Corporation.<br><br>
        <span style="color:#808080">Physical memory available to Windows: 640 KB<br>(that ought to be enough for anybody)</span></div></div>`,
    });
  }

  async function runDialog() {
    const cmd = await dialog({
      title: 'Run',
      width: 360,
      icon: null,
      html: `<div style="display:flex;gap:12px"><img src="${iconUrl('run')}" width="32" height="32" alt="">
        <div>Type the name of a program, folder, or document, and Windows will open it for you.</div></div>
        <label style="margin-top:12px;display:flex;gap:8px"><span><u>O</u>pen:</span><input class="field" style="flex:1;width:260px" value="sol"></label>`,
      buttons: [{ label: 'OK', value: true }, { label: 'Cancel', value: false }],
      result: (ok, d) => (ok ? d.querySelector('input').value.trim() : null),
    });
    if (!cmd) return;
    const key = cmd.toLowerCase().replace(/\.exe$/, '');
    const app = APPS.find((a) => a.cmd.includes(key) || a.id === key);
    if (app) openApp(app.id);
    else if (key === 'explorer' || key === 'command' || key === 'cmd') alert('This feature is not installed.', { title: cmd, icon: 'warning' });
    else alert(`Cannot find the file '${cmd}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.`, { title: cmd, icon: 'error' });
  }

  async function shutdownDialog() {
    const choice = await dialog({
      title: 'Shut Down Windows',
      width: 340,
      dither: true,
      html: `<div style="display:flex;gap:14px"><img src="${iconUrl('shutdown')}" width="32" height="32" alt="">
        <div style="display:flex;flex-direction:column;gap:8px">Are you sure you want to:
        <label><input type="radio" name="sd" value="shutdown" checked> <span><u>S</u>hut down the computer?</span></label>
        <label><input type="radio" name="sd" value="restart"> <span><u>R</u>estart the computer?</span></label></div></div>`,
      buttons: [{ label: '&Yes', value: true }, { label: '&No', value: false }, { label: '&Help', value: 'help' }],
      cancelValue: false,
      result: (ok, d) => (ok === true ? d.querySelector('input[name=sd]:checked').value : ok),
    });
    if (choice === 'help') return about('Windows 95');
    if (!choice) return;
    try { sessionStorage.removeItem('win95.booted'); } catch (e) { /* ignore */ }
    if (choice === 'restart') { location.href = homeUrl; return; }
    const off = el('div', 'off-screen', 'Windows is shutting down...');
    off.style.color = '#fff';
    document.body.appendChild(off);
    setTimeout(() => {
      off.style.color = '';
      off.innerHTML = "It's now safe to turn off<br>your computer.";
      off.addEventListener('click', () => { location.href = homeUrl; });
    }, 1500);
  }

  /* ---------------- Boot screen ---------------- */

  function bootScreen() {
    let booted = false;
    try { booted = sessionStorage.getItem('win95.booted'); sessionStorage.setItem('win95.booted', '1'); } catch (e) { booted = true; }
    if (booted) return;
    const s = el('div', 'boot-screen', `<div class="boot-logo"><img src="${iconUrl('windows')}" alt="">
      <div>Microsoft®<strong>Windows<sup>95</sup></strong></div></div><div class="boot-bar"></div>`);
    document.body.appendChild(s);
    const done = () => s.remove();
    s.addEventListener('click', done);
    setTimeout(done, 2200);
  }

  /* ---------------- Init ---------------- */

  function init() {
    buildDesktop();
    const tasks = buildTaskbar();
    setupAppWindow(tasks);
    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('textarea, input, .allow-context')) e.preventDefault();
    });
    if (document.body.dataset.boot !== undefined) bootScreen();
  }

  const Win95 = {
    root, apps: APPS, iconUrl, appUrl,
    openApp, close, setTitle, setChecked, setDisabled,
    onMenu: (fn) => menuHandlers.push(fn),
    dialog, alert, confirm, prompt, about,
    escapeHtml,
    beforeClose: null,
    appWindow: null,
    center: () => {},
    toggleMaximize: () => {},
  };
  window.Win95 = Win95;

  init();
})();
