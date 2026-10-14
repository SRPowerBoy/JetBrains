# OpenDesk

A free, open-source office suite that runs entirely in the browser. No server, no account — files stay on your device.

| App | Does | Opens | Saves |
|---|---|---|---|
| **Writer** | Rich text: headings, fonts, colors, lists, tables, images, links | .docx, .html, .txt | .doc (Word), .html, .txt, PDF (print) |
| **Sheets** | 26×100 grid, formulas, AutoSum, bold | .xlsx, .xls, .ods, .csv | .xlsx (keeps formulas), .csv |
| **Slides** | Text/image boxes, drag & resize, backgrounds, fullscreen present (F5) | OpenDesk .json | .pptx, OpenDesk .json |

Work autosaves to your browser. The home page lists all your files (search, filter, copy, delete) with a storage meter and one-click **backup / restore** of every file.

**Works offline and installs like an app** (service worker + web manifest). All libraries are bundled in `vendor/` — nothing loads from a CDN.

## What makes it different

- **🔗 Share by link, no upload.** The whole document is compressed into the link's `#fragment`, which browsers never send to a server — not even the one hosting OpenDesk. Add a password and the link is AES-256 encrypted in your browser (PBKDF2, 250k rounds). Best for text/data; images make links long.
- **🕘 Version history with diffs.** A snapshot every minute (and whenever you leave the tab). Pick any version to see exactly what was added/removed since, then restore it in one click. Restores and opened share links snapshot first, so nothing is lost.
- **⇄ Live spreadsheet data.** Drop a Sheets range into a document or slide as a table or bar chart. Pick which spreadsheet it comes from. Edit that spreadsheet — even in another tab — and every linked document and slide updates. Shared documents keep the last values as a snapshot when the recipient doesn't have the spreadsheet. Exports to `.pptx` as a real PowerPoint table/chart.
- **→ Document to slides.** One click in Writer turns a document into a new deck: headings become slide titles, paragraphs and list items become bullets (split across slides when long), live charts get their own slide.


## Work faster

- **⌘ Command palette — Ctrl+K (⌘K on Mac), every app.** Type any action ("bold", "heading 2", "insert sum", "present", "go to slide 4") or any file name to jump to it. Fuzzy matching; ↑↓ + Enter.
- **Markdown shortcuts in Writer.** At the start of a line: `# ` `## ` `### ` headings, `- ` bullets, `1. ` numbering, `> ` quote, ` ``` ` code block, `---` + Enter divider. Inline: `**bold**`, `*italic*` / `_italic_`, `~~strike~~`. Enter on an empty quote/code line returns to normal text.
- **Fill handle in Sheets.** Select cells, drag the green corner square to continue the pattern: `1, 2` → `3, 4…`, `Mon` → `Tue…`, `Jan, Mar` → `May…`, `Item 1` → `Item 2…`, dates (`2026-01-30` → `2026-01-31…`). Formulas shift their references (`$A$1` stays fixed). Double-click the square to fill down alongside the neighbouring column. **Ctrl+D / Ctrl+R** copy down/right.
- **Templates.** Resume, cover letter, meeting notes, invoice (totals and tax calculated), monthly budget, pitch deck — one click from the home page.
- **Copy & paste ranges in Sheets.** Paste from Excel, Google Sheets or any web table and it lands in cells (`1,200` becomes a number). Copy a range out as tab-separated text; copying between OpenDesk sheets keeps formulas and shifts their references. Ctrl+X cuts.
- **Find & replace — Ctrl+H** in Writer and Sheets (Ctrl+F too in Sheets, since the browser's own find can't see inside cells). Match case, next/previous, replace one or all; Replace all snapshots history first.
- **Search inside files** from the home page — matches file contents, not just names, with a snippet.
- **Range selection in Sheets.** Drag, Shift+click or Shift+arrows. Bold/Clear/Delete apply to the whole range; the status bar shows Sum · Average · Count · Min · Max.

## Run it

It's static files. Open `index.html` through any static server:

```sh
cd opendesk && python3 -m http.server 8000
```

Or host it free on GitHub Pages: `.github/workflows/pages.yml` deploys the `opendesk/` folder on every push. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Known limits (honest list)

- Files live in this browser's storage (~5 MB total, shown on the home page). Clearing site data erases them — use **Back up all files** regularly. Images use space fast.
- Offline updates arrive one visit late (the cached version loads first, the new one is fetched in the background).

- Writer saves Word-compatible HTML as `.doc`, not real `.docx`. `.docx` import drops some layout (mammoth focuses on structure).
- Sheets: one sheet, A1:Z100, no charts, no cell formatting beyond bold.
- Slides cannot import `.pptx` yet.
- Writer find doesn't match text that spans a formatting change (e.g. half-bold words).
- Bundled libraries: mammoth 1.6.0, SheetJS 0.18.5, PptxGenJS 3.12.0 (licenses in `vendor/`).

## License

MIT
