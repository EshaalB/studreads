# StudReads

StudReads is a privacy-first timetable and exam planner for university students. It supports common university Excel layouts and text-based PDF date sheets, turning them into personal weekly schedules and searchable exam plans directly in the browser.

## Features

- Parses grid-style and column-based `.xlsx` and `.xls` timetables
- Builds a timetable manually when no spreadsheet is available
- Lets students review detected columns and sample rows before importing
- Checks every worksheet and chooses the strongest timetable candidate
- Keeps spreadsheet processing in the browser
- Supports primary sections and courses from other sections
- Provides a mobile agenda and desktop weekly grid
- Detects overlapping classes
- Supports inline edits, colour themes, PNG export, and self-contained share links
- Saves display preferences locally
- Restores manually created timetables after a refresh
- Reads text-based PDF, `.xlsx`, and `.xls` exam date sheets
- Searches exams by subject, course code, programme, or room
- Builds a personal exam list and exports it as an `.ics` calendar file

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

For exam date sheets, StudReads recognizes common columns such as subject, course code, date, day, time, and venue. It can also infer these fields from simple text rows in a PDF. Image-only scanned PDFs are intentionally rejected with guidance to run OCR first.

## Privacy

Uploaded spreadsheet contents are parsed locally in the browser. The application does not include a backend or upload timetable files to a server. Preferences are stored in browser `localStorage`.

## Tech stack

- React 19
- Vite 7
- SheetJS (`xlsx`) and PDF.js, loaded only during import
- html2canvas, loaded only during PNG export
- Vanilla modular CSS

## Engineering highlights

- Normalizes inconsistent dates, times, headers, and worksheet layouts into stable data models
- Keeps large parsing libraries out of the initial application bundle through dynamic imports
- Provides responsive desktop and mobile views from the same selected-course data
- Covers both real university workbook fixtures and focused parser cases with automated tests

## Author

Built by [Eshaal B](https://github.com/EshaalB).
