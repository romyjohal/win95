/* Notepad — files are kept in localStorage as a tiny "C:\My Documents" folder. */
(function () {
  'use strict';

  const text = document.getElementById('text');
  const fileInput = document.getElementById('file-input');
  const STORE = 'win95.notepad.files';
  const WRAP = 'win95.notepad.wrap';

  let fileName = null;   // null = Untitled
  let saved = '';        // content at last save
  let lastFind = { term: '', matchCase: false };

  const esc = Win95.escapeHtml;

  function loadFiles() {
    try {
      const files = JSON.parse(localStorage.getItem(STORE));
      if (files && typeof files === 'object') return files;
    } catch (e) { /* storage unavailable */ }
    return {
      'README.TXT':
        'Welcome to Windows 95!\r\n\r\n' +
        'This little machine lives entirely in your web browser.\r\n' +
        'Double-click an icon on the desktop or use the Start menu to launch:\r\n\r\n' +
        '  Calculator    Notepad    Paint\r\n' +
        '  Solitaire     FreeCell   Minesweeper\r\n\r\n' +
        'Files you save in Notepad are kept in this browser only.\r\n' +
        'Use File > Export to Disk to keep a real copy.\r\n',
    };
  }
  function storeFiles(files) {
    try { localStorage.setItem(STORE, JSON.stringify(files)); return true; } catch (e) { return false; }
  }

  const dirty = () => text.value !== saved;
  const displayName = () => fileName || 'Untitled';
  const updateTitle = () => Win95.setTitle(displayName() + ' - Notepad');

  function setDoc(name, content) {
    fileName = name;
    text.value = content;
    saved = content;
    text.setSelectionRange(0, 0);
    text.scrollTop = 0;
    updateTitle();
    text.focus();
  }

  /** Ask to save pending changes. Resolves false if the user cancels. */
  async function confirmDiscard() {
    if (!dirty()) return true;
    const r = await Win95.dialog({
      title: 'Notepad',
      icon: 'warning',
      message: `The text in the ${displayName()} file has changed.\n\nDo you want to save the changes?`,
      buttons: ['&Yes', '&No', 'Cancel'],
    });
    if (r === 'Cancel') return false;
    if (r === '&Yes') return save();
    return true;
  }

  async function save() {
    if (!fileName) return saveAs();
    const files = loadFiles();
    files[fileName] = text.value;
    if (!storeFiles(files)) {
      await Win95.alert('Unable to save: browser storage is unavailable. Use File > Export to Disk instead.', { title: 'Notepad', icon: 'error' });
      return false;
    }
    saved = text.value;
    updateTitle();
    return true;
  }

  function fileDialog(title, okLabel, initialName) {
    const files = loadFiles();
    const names = Object.keys(files).sort();
    return Win95.dialog({
      title,
      width: 330,
      html: `<div style="display:flex;flex-direction:column;gap:6px">
        <div>Look in: <b>C:\\My Documents</b></div>
        <div class="listbox" id="fd-list">${names.map((n) => `<div data-name="${esc(n)}">${esc(n)}</div>`).join('') || '<div style="color:#808080">(no documents)</div>'}</div>
        <label><span>File <u>n</u>ame:</span><input class="field" id="fd-name" style="flex:1;width:220px"></label>
      </div>`,
      buttons: [{ label: okLabel, value: true }, { label: 'Cancel', value: false }],
      onOpen: (d) => {
        const input = d.querySelector('#fd-name');
        input.value = initialName || '';
        const list = d.querySelector('#fd-list');
        list.addEventListener('click', (e) => {
          const item = e.target.closest('[data-name]');
          if (!item) return;
          list.querySelectorAll('.selected').forEach((s) => s.classList.remove('selected'));
          item.classList.add('selected');
          input.value = item.dataset.name;
        });
        list.addEventListener('dblclick', (e) => {
          if (e.target.closest('[data-name]')) d.querySelector('.btn.default').click();
        });
      },
      validate: (d) => d.querySelector('#fd-name').value.trim() !== '',
      result: (ok, d) => (ok ? d.querySelector('#fd-name').value.trim() : null),
    });
  }

  async function saveAs() {
    let name = await fileDialog('Save As', '&Save', fileName || '*.txt');
    if (!name) return false;
    name = name.replace(/[\\/:*?"<>|]/g, '');
    if (!name || name === '*.txt') return false;
    if (!/\.[a-z0-9]+$/i.test(name)) name += '.txt';
    name = name.toUpperCase();
    const files = loadFiles();
    if (name in files && name !== fileName) {
      const r = await Win95.confirm(`${name} already exists.\nDo you want to replace it?`, { title: 'Save As', icon: 'warning' });
      if (r !== '&Yes') return false;
    }
    fileName = name;
    return save();
  }

  async function open() {
    if (!(await confirmDiscard())) return;
    const name = await fileDialog('Open', '&Open', '');
    if (!name) return;
    const files = loadFiles();
    const key = Object.keys(files).find((k) => k.toLowerCase() === name.toLowerCase());
    if (!key) {
      Win95.alert(`${name}\nFile not found.\nPlease verify the correct file name was given.`, { title: 'Open', icon: 'warning' });
      return;
    }
    setDoc(key, files[key]);
  }

  function download() {
    const blob = new Blob([text.value.replace(/\r?\n/g, '\r\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName || 'Untitled.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    f.text().then((content) => {
      setDoc(null, '');
      text.value = content;
      fileName = f.name.toUpperCase();
      saved = '';
      updateTitle();
    });
    fileInput.value = '';
  });

  async function find() {
    const r = await Win95.dialog({
      title: 'Find',
      width: 340,
      html: `<div style="display:flex;flex-direction:column;gap:8px">
        <label><span>Fi<u>n</u>d what:</span><input class="field" id="f-term" style="flex:1;width:220px"></label>
        <label><input type="checkbox" id="f-case"> Match <u>c</u>ase</label></div>`,
      buttons: [{ label: '&Find Next', value: true }, { label: 'Cancel', value: false }],
      onOpen: (d) => {
        d.querySelector('#f-term').value = text.value.substring(text.selectionStart, text.selectionEnd) || lastFind.term;
        d.querySelector('#f-case').checked = lastFind.matchCase;
      },
      result: (ok, d) => ok && { term: d.querySelector('#f-term').value, matchCase: d.querySelector('#f-case').checked },
    });
    if (!r || !r.term) return;
    lastFind = r;
    findNext();
  }

  function findNext() {
    if (!lastFind.term) return find();
    const hay = lastFind.matchCase ? text.value : text.value.toLowerCase();
    const needle = lastFind.matchCase ? lastFind.term : lastFind.term.toLowerCase();
    const at = hay.indexOf(needle, text.selectionEnd);
    if (at < 0) {
      Win95.alert(`Cannot find "${lastFind.term}"`, { title: 'Notepad', icon: 'info' }).then(() => text.focus());
      return;
    }
    text.focus();
    text.setSelectionRange(at, at + needle.length);
    // Scroll the selection into view.
    const line = text.value.slice(0, at).split('\n').length - 1;
    text.scrollTop = Math.max(0, line * 16 - text.clientHeight / 2);
  }

  function insert(str) {
    text.focus();
    if (!document.execCommand('insertText', false, str)) text.setRangeText(str, text.selectionStart, text.selectionEnd, 'end');
  }

  function timeDate() {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ' +
      d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  }

  function setWrap(on) {
    text.classList.toggle('wrap', on);
    text.wrap = on ? 'soft' : 'off';
    Win95.setChecked('wrap', on);
    try { localStorage.setItem(WRAP, on ? '1' : ''); } catch (e) { /* ignore */ }
  }

  Win95.onMenu((action) => {
    switch (action) {
      case 'new':
        confirmDiscard().then((ok) => ok && setDoc(null, ''));
        return true;
      case 'open': open(); return true;
      case 'save': save(); return true;
      case 'saveas': saveAs(); return true;
      case 'upload':
        confirmDiscard().then((ok) => ok && fileInput.click());
        return true;
      case 'download': download(); return true;
      case 'undo': text.focus(); document.execCommand('undo'); return true;
      case 'cut': text.focus(); document.execCommand('cut'); return true;
      case 'copy': text.focus(); document.execCommand('copy'); return true;
      case 'paste':
        text.focus();
        if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(insert).catch(() => {});
        return true;
      case 'delete': text.focus(); document.execCommand('delete'); return true;
      case 'selectall': text.focus(); text.select(); return true;
      case 'timedate': insert(timeDate()); return true;
      case 'wrap': setWrap(!text.classList.contains('wrap')); return true;
      case 'find': find(); return true;
      case 'findnext': findNext(); return true;
    }
  });

  // Menu items that depend on the selection.
  document.querySelector('.menubar').addEventListener('pointerdown', () => {
    const hasSel = text.selectionStart !== text.selectionEnd;
    ['cut', 'copy', 'delete'].forEach((a) => Win95.setDisabled(a, !hasSel));
  }, true);

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-layer')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    else if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); open(); }
    else if (e.key === 'F3') { e.preventDefault(); findNext(); }
    else if (e.key === 'F5') { e.preventDefault(); insert(timeDate()); }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty() && !leaving) { e.preventDefault(); e.returnValue = ''; }
  });
  let leaving = false;
  Win95.beforeClose = async () => {
    const ok = await confirmDiscard();
    if (ok) leaving = true;
    return ok;
  };

  let wrapPref = false;
  try { wrapPref = !!localStorage.getItem(WRAP); } catch (e) { /* ignore */ }
  setWrap(wrapPref);

  // Ensure the README exists on first run so File > Open has something in it.
  const files = loadFiles();
  storeFiles(files);
  setDoc(null, '');
})();
