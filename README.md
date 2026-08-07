# StudReads

StudReads is a browser-based timetable builder for university students. It reads common Excel timetable layouts, detects sections and courses, highlights schedule clashes, and exports a clean weekly schedule.

## Features

- Parses grid-style and column-based `.xlsx` and `.xls` timetables
- Checks every worksheet and chooses the strongest timetable candidate
- Keeps spreadsheet processing in the browser
- Supports primary sections and courses from other sections
- Provides a mobile agenda and desktop weekly grid
- Detects overlapping classes
- Supports inline edits, colour themes, PNG export, and self-contained share links
- Saves display preferences locally

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

## Supported spreadsheet shapes

The importer handles two broad structures:

1. A flat table with recognizable headers such as Course, Section, Day, Start Time, End Time, Instructor, and Room.
2. A weekly grid with day labels and time ranges across the columns.

University spreadsheets vary widely. If a workbook contains several plausible timetable sheets, StudReads evaluates them and reports which sheet it selected. Unsupported or incomplete files receive an actionable error instead of being silently accepted.

## Privacy

Uploaded spreadsheet contents are parsed locally in the browser. The application does not include a backend or upload timetable files to a server. Preferences are stored in browser `localStorage`.

## Tech stack

- React 19
- Vite 7
- SheetJS (`xlsx`), loaded only during import
- html2canvas, loaded only during PNG export
- Vanilla modular CSS

## Author

Built by [Eshaal B](https://github.com/EshaalB).
