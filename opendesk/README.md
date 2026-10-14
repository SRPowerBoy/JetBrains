# OpenDesk

A free, open-source office suite that runs entirely in the browser. No server, no account — files stay on your device.

| App | Does | Opens | Saves |
|---|---|---|---|
| **Writer** | Rich text: headings, fonts, colors, lists, tables, images, links | .docx, .html, .txt | .doc (Word), .html, .txt, PDF (print) |
| **Sheets** | 26×100 grid, formulas, AutoSum, bold | .xlsx, .xls, .ods, .csv | .xlsx (keeps formulas), .csv |
| **Slides** | Text/image boxes, drag & resize, backgrounds, fullscreen present (F5) | OpenDesk .json | .pptx, OpenDesk .json |

Work autosaves to your browser's local storage.

## What makes it different

- **🔗 Share by link, no upload.** The whole document is compressed into the link's `#fragment`, which browsers never send to a server — not even the one hosting OpenDesk. Add a password and the link is AES-256 encrypted in your browser (PBKDF2, 250k rounds). Best for text/data; images make links long.
- **🕘 Version history with diffs.** A snapshot every minute (and whenever you leave the tab). Pick any version to see exactly what was added/removed since, then restore it in one click. Restores and opened share links snapshot first, so nothing is lost.
- **⇄ Live spreadsheet data.** Drop a Sheets range into a document or slide as a table or bar chart. Edit the spreadsheet — even in another tab — and every linked document and slide updates. Exports to `.pptx` as a real PowerPoint table/chart.
- **→ Document to slides.** One click in Writer turns a document into a deck: headings become slide titles, paragraphs and list items become bullets (split across slides when long), live charts get their own slide.


## Run it

It's static files. Open `index.html` through any static server:

```sh
cd opendesk && python3 -m http.server 8000
```

Or host it free on GitHub Pages.

## Known limits (honest list)

- History and live data live in this browser's storage (~5 MB). Clearing site data erases them; share links and saved files don't depend on it.
- One spreadsheet at a time: live links always point at the spreadsheet currently open in Sheets.

- Writer saves Word-compatible HTML as `.doc`, not real `.docx`. `.docx` import drops some layout (mammoth focuses on structure).
- Sheets: one sheet, A1:Z100, no charts, no cell formatting beyond bold.
- Slides cannot import `.pptx` yet.
- `.docx`/`.xlsx`/`.pptx` support loads three libraries from CDNs (mammoth, SheetJS, PptxGenJS). Offline, those buttons alert instead of working; everything else works offline.

## License

MIT
