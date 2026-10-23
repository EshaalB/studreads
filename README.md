# StudReads

StudReads is a privacy-first timetable and exam planner for university students. It turns timetable spreadsheets and exam date sheets in almost any format into personal weekly schedules and searchable exam plans, entirely in the browser.

## Features

**Timetable**
- Parses grid-style and column-based `.xlsx`, `.xls`, `.ods` and `.csv` timetables, checking every worksheet
- Lets students confirm detected columns before importing
- Supports a primary section plus courses taken in other sections
- Builds a timetable by hand when no file is available, or turns an imported one into an editable list
- List and week views, a phone agenda, clash detection and inline corrections
- Custom name, five colour palettes plus per-course colours, choice of visible details, 12 or 24-hour clock
- Exports to PNG, print/PDF, calendar (`.ics`, weekly for 16 weeks), CSV and a restorable `.json` backup
- Share links that open as an editable copy for the recipient
- Remembers the imported timetable and settings after a refresh; light and dark appearance

**Exam finder**
- Reads date sheets from PDF (text or scanned), Excel, OpenDocument, CSV, Word `.docx`, photos and screenshots, or pasted text
- Handles header tables, grids with dates or time slots across the top, and free-text lists with dates on their own lines
- Copes with merged date cells, two-row headers, wrapped titles, multi-page PDFs, landscape pages and dates without a year
- Uses printed weekdays to tell day/month from month/day
- Search and programme filter, a personal exam list with clash warnings, and exams added or edited by hand
- Exports to calendar (`.ics`), CSV and print, and shares the list as a link

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
