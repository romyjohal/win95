# Windows 95 in the browser

A small Windows 95 desktop built as a static GitHub Pages site. Each application
lives on its own page; opening an app from the desktop (or the Start menu) takes
you to that page, where it runs in a window on the Windows 95 desktop.

| App | Page | Notes |
| --- | --- | --- |
| Desktop | [`/`](index.html) | Desktop icons, Start menu, Run…, Shut Down… |
| Calculator | [`/calculator/`](calculator/index.html) | Standard calculator, memory keys, keyboard input |
| Notepad | [`/notepad/`](notepad/index.html) | Open/Save to `C:\My Documents` (browser storage), import/export real files, Find, Word Wrap |
| Paint | [`/paint/`](paint/index.html) | Pencil, brush, airbrush, eraser, fill, colour picker, line, rectangle, ellipse, rounded rectangle; save as PNG |
| Solitaire | [`/solitaire/`](solitaire/index.html) | Klondike, Draw One / Draw Three, standard scoring, undo, card backs, bouncing-cards finish |
| FreeCell | [`/freecell/`](freecell/index.html) | Games #1–32000 dealt exactly like the original, supermoves, auto-play, statistics |
| Minesweeper | [`/minesweeper/`](minesweeper/index.html) | Beginner / Intermediate / Expert / Custom, flags & marks, chording, best times |

Everything is plain HTML, CSS and JavaScript with no build step and no external
requests.

## Publishing on GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to *Deploy from a branch*, choose
   `main` and `/ (root)`, and save.
3. The site appears at `https://<user>.github.io/<repo>/`.

All links are relative, so the site also works when opened straight from the
file system.

## Layout

```
index.html                 desktop
<app>/index.html           one page per application
<app>/<app>.js             application logic
assets/css/win95.css       window chrome, controls, taskbar, Start menu
assets/css/cards.css       playing cards
assets/js/win95.js         shell: desktop icons, taskbar, menus, dialogs
assets/js/cards.js         card rendering, drag & drop, win animation
assets/icons/              32×32 SVG icons
assets/fonts/              pixel "MS Sans Serif" webfont from 98.css (MIT)
```

To add an application, create `<id>/index.html` using one of the existing pages
as a template, add an icon at `assets/icons/<id>.svg`, and register it in the
`APPS` list at the top of `assets/js/win95.js`.

## Credits

This is a fan-made tribute and is not affiliated with or endorsed by Microsoft.
The pixel font comes from [98.css](https://github.com/jdan/98.css) by Jordan
Scales (MIT licence, see `assets/fonts/LICENSE-98css.txt`).
