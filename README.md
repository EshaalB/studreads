# StudReads

StudReads is a privacy-first timetable and exam planner for university students. It turns timetable spreadsheets and exam date sheets in almost any format into personal weekly schedules and searchable exam plans, entirely in the browser.

## Features

**Timetable**
- Opens straight to the week grid, modelled on a paper planner, with labelled actions beside it; upload or drop a file onto it at any time
- Import grid-style or column-based `.xlsx`, `.xls`, `.ods` and `.csv` timetables, confirm the columns, then tick your courses (including courses taken with another section)
- Or start from scratch: click an empty time slot or "Add class"; click any class to edit it, change its colour or delete it
- Week and list views, clash detection, and a Customise panel: palettes or any colour per course, filled or tinted classes, row height, days shown, visible details, 12 or 24-hour clock
- Save an image or print exactly what is on screen, or export a calendar (`.ics`) or backup (`.json`) that can be imported again
- Share links that open as an editable copy; light and dark mode

**Exams (on the same screen)**
- Reads date sheets from PDF (text or scanned), Excel, OpenDocument, CSV, Word `.docx`, photos and screenshots, or pasted text
- Handles header tables, grids with dates or time slots across the top, and free-text lists with dates on their own lines
- Copes with merged date cells, two-row headers, wrapped titles, multi-page PDFs, landscape pages and dates without a year
- Finds course titles printed elsewhere (a legend or another sheet) when the schedule lists only codes
- Reads times written as `0900-1200`, separate hour columns, Excel fractions, "hrs", session names such as "Morning" defined in a note, or one time printed above the table
- Uses printed weekdays to tell day/month from month/day
- Upload a date sheet from the Upload menu or drop it on the planner; spreadsheets with real dates are recognised as date sheets automatically
- Exams matching the courses on your timetable are suggested and pre-ticked; search adds any others
- Your exams appear under the timetable in both Week and List views, with clash warnings, editing, remove and Undo
- One Export menu saves an image or PDF, a single calendar file with classes and exams, or a backup; share links carry both
- Copes with scanner misreads (O for 0, l for 1), letter-spaced PDF text, full-width digits, ligatures and rows printed before their merged date cell

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. A sample timetable is available in the upload screen, so no spreadsheet is required for a quick review.

## Quality checks

```bash
npm run lint
npm run build
```

## Supported file shapes

The importer handles two broad structures:

1. A flat table with recognizable headers such as Course, Section, Day, Start Time, End Time, Instructor, and Room.
2. A weekly grid with day labels and time ranges across the columns.

University spreadsheets vary widely. If a workbook contains several plausible timetable sheets, StudReads evaluates them and reports which sheet it selected. Unsupported or incomplete files receive an actionable error instead of being silently accepted.

For exam date sheets, every source is reduced to rows of cells (PDF text and OCR keep each word's position). Three readings run over the same rows: a header-driven table, a date or time-slot grid, and a line-by-line text reading. A table with a recognised header wins unless another reading finds clearly more exams. Scanned PDFs and images go through Tesseract OCR, so results should be checked against the original.

## Project structure

```
src/
  components/
    layout/     app shell, header, footer, about and privacy dialogs
    timetable/  editor, column-check, class and course dialogs, customise panel
    exams/      exam picker, exam section and exam dialog
    calendar/   TimeGrid and AgendaList, shared by classes and exams
    ui/         shared controls: Dialog, Menu, Segmented, Dropzone, ColorField, ThemeToggle
  context/      timetable state (one list of classes, the imported file, colours, settings)
  utils/        parsers, exporters, share links and other plain functions
  styles/       tokens, base, components, layout, timetable, exams, print
```

## Search and AI discoverability

- `public/llms.txt`: plain summary of the site and its key pages for AI assistants
- `public/robots.txt` and `public/sitemap.xml`: crawling rules (AI crawlers explicitly allowed) and page list
- `public/privacy.html`: a static privacy page that crawlers can follow
- `index.html`: meta and link-preview tags, a PNG share image, JSON-LD (WebSite, WebApplication, Person, FAQPage), and a no-JavaScript copy of the heading and FAQ
- `src/content/faq.js`: the FAQ shown in the app; `npm test` checks it matches the structured data

The site address `university-timetable-gen.vercel.app` appears in `index.html`, `llms.txt`, `robots.txt`, `sitemap.xml` and `privacy.html`. Update all of them if the domain changes.

## Privacy

Files are parsed locally in the browser. The application has no backend and never uploads timetable or exam files. Reading an image or scanned PDF downloads the OCR engine and English language data from a public CDN on first use; the image itself stays on the device. Timetables, exam lists and preferences are stored in browser `localStorage`. Share links carry their data inside the URL.

## Tech stack

- React 19
- Vite 7
- SheetJS (`xlsx`), PDF.js and Tesseract.js, loaded only during import
- html2canvas, loaded only during PNG export
- Vanilla modular CSS

## Engineering highlights

- Normalizes inconsistent dates, times, headers, and worksheet layouts into stable data models
- Keeps large parsing libraries out of the initial application bundle through dynamic imports
- Provides responsive desktop and mobile views from the same selected-course data
- Covers both real university workbook fixtures and focused parser cases with automated tests

## Author

Built by [Eshaal B](https://github.com/EshaalB).
