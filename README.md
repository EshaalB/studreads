# StudReads

A university timetable and exam planner that runs entirely in the browser.

Universities publish timetables and exam date sheets as huge spreadsheets, PDFs and scans. StudReads reads those files, lets a student tick their own courses and exams, and puts everything on one week grid. Nothing is uploaded: files are read on the device.

![StudReads](public/og-image.png)

## What it does

### Classes
- Reads timetable files in `.xlsx`, `.xls`, `.ods` or `.csv`, as a table (Course, Day, Start, End…) or as a grid (days down the side, time slots across the top).
- After an upload, the student picks a section and ticks courses. Courses from another section can be found with search.
- "Edit courses" reopens the picker at any time without uploading again.
- Classes can also be added by hand: click an empty slot, or use Add.

### Exams
- Reads date sheets in PDF (typed or scanned), Excel, CSV, Word `.docx`, photos and screenshots, or pasted text.
- Suggests the exams that match the student's courses. Search finds any others, and "Edit exams" changes the picks later.
- When a revised date sheet is uploaded, it shows which picked exams moved (date, time or room) and which are missing.

### One planner
- Exams and classes share one grid. Exam dates come first in date order, then weekly classes by day. The List view groups the same way.
- Clashes are marked, and deleting a class or exam can be undone.
- Click any class or exam to edit it, including its colour.
- Customise: colour palettes, filled or tinted blocks, row height, which details to show, 12 or 24-hour clock.
- Light and dark mode in the eshaaldev brand colours.

### Getting it out
- Save as an image or print/PDF, exactly as shown, with a small "Made with StudReads" line.
- A calendar file (`.ics`) with weekly classes and exams, including exam reminders the day before and two hours before.
- A backup file (`.json`) that can be opened again later.
- Two kinds of share link:
  - **My planner** opens an editable copy of your classes and exams.
  - **For classmates** carries the uploaded files, so each person picks their own courses and exams.
- Installable as an app, and works offline after the first visit.

## How the file reading works

Every file, whatever its format, is first turned into rows of cells. PDF text and OCR results keep each word's position so columns can be rebuilt.

**Timetables** (`src/parsers/spreadsheetParser.js`): if time ranges appear across a row, the sheet is read as a grid (`heuristicParser.js`). Otherwise it is read as a table, and `columnDetector.js` matches the headers. If the course, day or start column can't be found, the student is asked to point at them.

**Exam date sheets** (`src/parsers/examParser.js`) are read in three ways, and the best result wins:

| Reading | For sheets like |
| --- | --- |
| Table | A header row names the columns: Code, Subject, Date, Time, Venue |
| Grid | Dates or time slots run across the top, and course names fill the cells |
| Loose text | Notices and emails where each line mentions a course near a date |

On top of that, it handles:
- merged date cells and two-row headers
- course titles printed in a separate legend
- times written as `0900 hrs` or as session names ("Morning: 9–12")
- scanner mistakes such as O for 0 and l for 1
- letter-spaced PDF text
- printed weekdays, which settle whether 03/04 means March or April

`src/parsers/examLoaders.js` turns each file type into rows. PDF.js reads PDFs and Tesseract.js handles OCR. They load only when a file needs them.

## Accuracy

```bash
npm run benchmark
```

The benchmark reads every sheet in `fixtures/datesheets` and checks each exam's course, date and start time against `expected.json`. It covers six layouts:
- a header table with merged dates and notes
- time-slot columns
- dates across the top
- a notice-board text
- scanner noise
- codes with a separate legend

The current result is **49 of 49 exams read correctly, with no extras**.

To check sheets you can't publish, put them in a folder with their own `expected.json` and run:

```bash
npm run benchmark -- path/to/folder
```

Layouts that read wrong can be reported from the exam picker.

## Run it locally

```bash
npm install
npm run dev
```

The empty planner has a "Try the sample" link if you don't have a timetable file.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Parser, storage, sharing and FAQ checks |
| `npm run benchmark` | Date sheet accuracy |
| `npm run lint` | ESLint, including the React Compiler rules |
| `npm run build` | Production build in `dist/` |
| `npm run set-domain -- example.com` | Moves every public address to a new domain |

## Where things live

```
src/
  components/
    timetable/  the planner screen (Editor), file handling (TimetableTool), class and course dialogs, Customise
    exams/      exam picker, exam form, revised-sheet summary
    calendar/   TimeGrid and AgendaList, shared by classes and exams
    layout/     header, footer, about dialog, FAQ
    ui/         Dialog, Menu, Segmented, PushButton, ColorField, SearchableSelect, ThemeToggle
  context/      timetable state: classes, the uploaded file, colours, settings
  hooks/        exam state, light/dark mode, dialog focus
  parsers/      reading timetables and date sheets
  export/       images, calendar files, backups, share links
  utils/        small helpers: dates, times, text clean-up, classes, colours, storage
  content/      FAQ text and the site's addresses
  styles/       tokens (brand colours and type), then one file per area
fixtures/       real timetables and sample date sheets for tests and the benchmark
scripts/        tests, benchmark, domain switcher
public/         icons, service worker, app manifest, SEO and privacy pages
```

## Privacy

- Files are read in the browser. There is no backend.
- Reading a photo or scanned PDF downloads the OCR engine (about 4 MB) from a public CDN the first time. The image itself stays on the device.
- Classes, exams and settings are saved in the browser's `localStorage`.
- Share links carry their data inside the URL.

## Search and AI assistants

- `index.html` holds the page title, description, link previews and structured data (WebApplication, FAQPage), plus a copy of the FAQ for crawlers that don't run JavaScript.
- `public/llms.txt` is a plain summary for AI assistants.
- `public/robots.txt` and `public/sitemap.xml` list the pages. `robots.txt` allows AI crawlers.
- `npm test` checks that the FAQ in the app and the FAQ in `index.html` match.

## Built with

- React 19 and Vite 7
- SheetJS, PDF.js, Tesseract.js and html2canvas, each loaded only when needed
- Plain CSS with design tokens, and Lucide icons

Built by [Eshaal](https://github.com/EshaalB).
