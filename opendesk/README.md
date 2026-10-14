# OpenDesk

A free, open-source office suite that runs entirely in the browser. No server, no account — files stay on your device.

| App | Does | Opens | Saves |
|---|---|---|---|
| **Writer** | Rich text: headings, fonts, colors, lists, tables, images, links | .docx, .html, .txt | .doc (Word), .html, .txt, PDF (print) |
| **Sheets** | 26×100 grid, formulas, AutoSum, bold | .xlsx, .xls, .ods, .csv | .xlsx (keeps formulas), .csv |
| **Slides** | Text/image boxes, drag & resize, backgrounds, fullscreen present (F5) | OpenDesk .json | .pptx, OpenDesk .json |

Work autosaves to your browser's local storage.

## Run it

It's static files. Open `index.html` through any static server:

```sh
cd opendesk && python3 -m http.server 8000
```

Or host it free on GitHub Pages.

## Known limits (honest list)

- Writer saves Word-compatible HTML as `.doc`, not real `.docx`. `.docx` import drops some layout (mammoth focuses on structure).
- Sheets: one sheet, A1:Z100, no charts, no cell formatting beyond bold.
- Slides cannot import `.pptx` yet.
- `.docx`/`.xlsx`/`.pptx` support loads three libraries from CDNs (mammoth, SheetJS, PptxGenJS). Offline, those buttons alert instead of working; everything else works offline.

## License

MIT
