# StudReads

A university timetable and exam planner that runs entirely in the browser.

Universities publish timetables and exam date sheets as huge spreadsheets, PDFs and scans. StudReads reads those files, lets a student tick their own courses and exams, and puts everything on one week grid. Nothing is uploaded: files are read on the device.

![StudReads](public/og-image.png)

## What it does

### Classes
- Reads timetable files in `.xlsx`, `.xls`, `.ods` or `.csv`, as a table (Course, Day, Start, End…) or as a grid (days down the side, time slots across the top).
- After an upload, the student picks a section and ticks courses. Courses from another section can be found with search and tried out first: they show dashed, clashes are marked, and the student keeps or discards them.
- "Edit courses" reopens the picker at any time without uploading again.
- Classes can also be added by hand: click an empty slot, or use Add. A class can be marked as every other week, with the week it starts; fortnightly classes on opposite weeks don't count as a clash.

### Exams
- Reads date sheets in PDF (typed or scanned), Excel, CSV, Word `.docx`, photos and screenshots, or pasted text.
- Suggests the exams that match the student's courses. Sure matches (same code or name) are ticked; possible ones (shared words, abbreviations like OOP) are shown but left for the student. Search finds any others, and "Edit exams" changes the picks later.
- Long imports (scanned PDFs, photos) can be cancelled, and a newer file always replaces one still being read. Spreadsheets are read in a background worker, so the page never freezes.
- If a sheet's dates could be read either way (03/04 as 3 April or 4 March), the app asks which order the sheet uses.
- Any exam can be corrected in the picker before it is added. Exams read from a photo or scan have "See in scan", which shows the page with that line highlighted.
- When a revised date sheet is uploaded, it shows which picked exams moved (date, time or room) and which are missing. Exams are matched across the whole sheet, and any matched by name only are flagged to check.

### One planner
- Exams and classes share one grid. Exam dates come first in date order, then weekly classes by day. The List view groups the same way.
- Clashes are marked, and deleting or editing a class or exam can be undone.
- Block text is black or white, whichever meets the WCAG contrast ratio better against the block's colour.
- On phones the week fits the screen width with no sideways scrolling; only grids with many exam dates scroll, with the hour labels pinned.
- Click any class or exam to edit it, including its colour.
- Customise: colour palettes, filled or tinted blocks, row height, which details to show, 12 or 24-hour clock.
- Light and dark mode in the eshaaldev brand colours.

### Getting it out
- Save as an image or print/PDF. Images are always drawn at the desktop layout, so one saved on a phone matches one saved on a laptop. In a PDF the title links back to the site.
- A calendar file (`.ics`) with weekly classes and exams, including exam reminders the day before and two hours before.
- A backup file (`.json`) that can be opened again later.
- Two kinds of share link:
  - **My planner** opens an editable copy of your classes and exams.
  - **For classmates** carries the uploaded files, so each person picks their own courses and exams.
- Installable as an app, and works offline after the first visit.

### My pages
- Save what is on screen as a named page ("Fall 2026 semester", "Mid-2 exams") and reopen it any time from My pages in the header. A page keeps everything, including the uploaded files, which are stored once even when several pages use them. If a page can't be opened for lack of space, nothing on screen changes.
- To move to another device, copy a transfer link, or back up to a file and restore it there. Restoring adds pages and keeps whichever copy of a page was saved last.
- Saving asks the browser to keep the site's data instead of clearing it on its own.

## How the file reading works

Every file, whatever its format, is first turned into rows of cells. PDF text and OCR results keep each word's position so columns can be rebuilt.

**Timetables** (`src/parsers/spreadsheetParser.js`): if time ranges appear across a row, the sheet is read as a grid (`heuristicParser.js`). Otherwise it is read as a table. `columnDetector.js` matches headers first, then finds the day and time columns from their values when the headers are unusual. Anything missing or found only from values is shown in a short check, with an example from each column.

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
- scanner mistakes such as O for 0 and l for 1, and recognised words regrouped into phrases so single spaces don't split a subject or room
- letter-spaced PDF text
- printed weekdays, which settle whether 03/04 means March or April

`src/parsers/examLoaders.js` turns each file type into rows. PDF.js reads PDFs and Tesseract.js handles OCR. They load only when a file needs them.

## Accuracy

```bash
npm run benchmark
```

The benchmark reads every sheet in `fixtures/datesheets` and checks each exam as a complete record (course, date, start time and, where given, room) against `expected.json`. It reports precision, recall and F1, and lists every error by file as missing, wrong (with the field that is wrong) or extra. It covers seven layouts:
- a header table with merged dates and notes
- time-slot columns
- dates across the top
- a notice-board text
- scanner noise
- codes with a separate legend
- duplicated rows, day/month-ambiguous dates and a missing time

The current result is **53 of 53 exams correct: precision, recall and F1 all 100%, with no extras**.

`npm run perf` times each import step and the memory it holds on the real timetables and the benchmark sheets (add your own files after `--`). Parsing the largest real timetable (772 classes) takes about 0.3 s in the background worker; dropped spreadsheets get a quick date check first, so timetables are not also read as date sheets (that took about 1.3 s before).

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
| `npm run perf` | Import speed and memory |
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
  styles/       tokens, base, components (buttons), forms, dialogs, layout, calendar, timetable, print
fixtures/       real timetables and sample date sheets for tests and the benchmark
scripts/        tests, benchmark, domain switcher
public/         icons, service worker, app manifest, SEO and privacy pages
```

## Privacy

- Files are read in the browser. There is no backend.
- Reading a photo or scanned PDF downloads the OCR engine (about 4 MB) from a public CDN the first time. The image itself stays on the device.
- Classes, exams, settings and saved pages are kept in the browser's `localStorage`. Back them up from My pages before clearing site data.
- Share links carry their data after the `#` in the URL, which browsers never send to a server. Ones too long for chat apps are saved as a file instead.
- If the browser can't save (storage full or blocked), the app says so instead of failing silently.

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
