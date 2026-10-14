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
- Bundled libraries: mammoth 1.6.0, SheetJS 0.18.5, PptxGenJS 3.12.0 (licenses in `vendor/`).

## License

MIT
