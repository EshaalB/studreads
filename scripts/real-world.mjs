// Runs every file in fixtures/real-world through the app's code and prints what it found.
// Download the files first with `npm run fetch-real-world`.
import { existsSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractExams, parseExamWorkbook, positionedItemsToRows } from '../src/parsers/examParser.js';
import { readPdfText } from '../src/parsers/pdfText.js';
import { readDateSheetBook, readTimetableBook } from '../src/parsers/readWorkbook.js';
import { parseWorkbook } from '../src/parsers/spreadsheetParser.js';
import { timetableFromPdf } from '../src/parsers/pdfTimetable.js';
import { validateClass } from '../src/utils/classes.js';
import { parseTime } from '../src/utils/timeUtils.js';
import { coursesForSection, findSections } from '../src/utils/timetableSource.js';

const folder = 'fixtures/real-world';
const sources = JSON.parse(readFileSync(`${folder}/sources.json`, 'utf8'));
let failures = 0;

const pdfRows = async (data, withLines = false) => {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise;
  try {
    const { items, lines } = await readPdfText(pdfjs, pdf, { lines: withLines });
    if (!items.length) throw Object.assign(new Error('scanned PDF with no text layer; the app reads it with OCR'), { scanned: true });
    return withLines ? { rows: positionedItemsToRows(items), lines } : positionedItemsToRows(items);
  } finally {
    pdf.loadingTask.destroy();
  }
};

const timetableClasses = async (file, data) => {
  const parsed = /\.pdf$/i.test(file) ? timetableFromPdf(await pdfRows(data, true)) : parseWorkbook(XLSX, readTimetableBook(XLSX, data, file));
  if (!parsed) return [];
  return findSections(parsed.rows, parsed.mapping).flatMap((section) => coursesForSection(parsed.rows, parsed.mapping, section));
};

const dateSheetExams = async (file, data) => (/\.pdf$/i.test(file)
  ? extractExams(await pdfRows(data)).records
  : parseExamWorkbook(XLSX, readDateSheetBook(XLSX, data, file)).records);

for (const { file, kind, university } of sources) {
  const path = `${folder}/${file}`;
  if (!existsSync(path)) { console.log(`- ${university}: not downloaded`); continue; }
  const data = readFileSync(path);
  try {
    if (kind === 'timetable') {
      const classes = await timetableClasses(file, data);
      const invalid = classes.filter((cls) => !validateClass(cls).valid);
      const offHours = classes.filter((cls) => parseTime(cls.startTime) < 7 * 60 || parseTime(cls.endTime) > 22 * 60);
      const sections = new Set(classes.map((cls) => cls.section)).size;
      // A few early or late classes are fine (UConn has 6 AM lectures).
      const ok = classes.length > 0 && invalid.length === 0 && offHours.length <= classes.length * 0.01;
      if (!ok) failures += 1;
      console.log(`${ok ? '✓' : '✗'} ${university}: ${classes.length} classes, ${sections} sections${invalid.length ? `, ${invalid.length} invalid` : ''}${offHours.length ? `, ${offHours.length} outside 7 AM–10 PM` : ''}`);
      [...invalid, ...offHours].slice(0, 3).forEach((cls) => console.log(`    ${cls.day} ${cls.startTime}–${cls.endTime} ${cls.name} (${cls.section})`));
    } else {
      const exams = await dateSheetExams(file, data);
      const timed = exams.filter((exam) => exam.start !== null).length;
      const ok = exams.length > 0;
      if (!ok) failures += 1;
      console.log(`${ok ? '✓' : '✗'} ${university}: ${exams.length} exams over ${new Set(exams.map((exam) => exam.date)).size} dates, ${timed} with a time`);
      exams.slice(0, 2).forEach((exam) => console.log(`    ${exam.date} ${exam.time || '—'} ${exam.code} ${exam.subject} ${exam.room}`));
    }
  } catch (error) {
    if (error.scanned) { console.log(`◌ ${university}: ${error.message}`); continue; }
    failures += 1;
    console.log(`✗ ${university}: ${error.message}`);
  }
}
if (failures) process.exitCode = 1;
