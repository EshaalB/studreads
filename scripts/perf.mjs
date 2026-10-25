// Speed and memory of the slow parts of importing, on the real timetables and the benchmark
// date sheets: `npm run perf`. Pass more files to include them: `npm run perf -- sheet.xlsx`.
import { readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import * as XLSX from 'xlsx';
import { mayBeDateSheet, parseExamWorkbook } from '../src/parsers/examParser.js';
import { readDateSheetBook, readTimetableBook } from '../src/parsers/readWorkbook.js';
import { parseWorkbook } from '../src/parsers/spreadsheetParser.js';
import { coursesForSection, findSections } from '../src/utils/timetableSource.js';

const RUNS = 5;
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Average time over RUNS, and the extra heap one run holds onto (with --expose-gc).
const measure = (label, task) => {
  task();
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  let kept;
  for (let run = 0; run < RUNS; run += 1) kept = task();
  const milliseconds = (performance.now() - started) / RUNS;
  globalThis.gc?.();
  const held = process.memoryUsage().heapUsed - heapBefore;
  console.log(`${label.padEnd(52)} ${milliseconds.toFixed(1).padStart(8)} ms   ${globalThis.gc ? megabytes(Math.max(held, 0)).padStart(8) : ''}`);
  return kept;
};

const timetables = readdirSync('fixtures/timetables').map((file) => `fixtures/timetables/${file}`);
const dateSheets = readdirSync('fixtures/datesheets').filter((file) => /\.(csv|xlsx)$/i.test(file)).map((file) => `fixtures/datesheets/${file}`);
const extra = process.argv.slice(2);

const readBook = (path) => readTimetableBook(XLSX, readFileSync(path), path);
const readSheet = (path) => readDateSheetBook(XLSX, readFileSync(path), path);

console.log(`${'step'.padEnd(52)} ${'time'.padStart(8)}      ${globalThis.gc ? 'heap held' : '(run with --expose-gc for memory)'}`);
timetables.forEach((path) => {
  const name = basename(path).slice(0, 24);
  measure(`read ${name}`, () => readBook(path));
  const book = readBook(path);
  measure(`quick date check ${name}`, () => mayBeDateSheet(XLSX, book));
  const parsed = measure(`parse timetable ${name}`, () => parseWorkbook(XLSX, readBook(path)));
  const sections = findSections(parsed.rows, parsed.mapping);
  measure(`classes for all ${sections.length} sections`, () => sections.map((section) => coursesForSection(parsed.rows, parsed.mapping, section)));
});
[...dateSheets, ...extra].forEach((path) => {
  const result = measure(`parse date sheet ${basename(path).slice(0, 24)}`, () => parseExamWorkbook(XLSX, readSheet(path)));
  if (extra.includes(path)) console.log(`${''.padEnd(4)}${result.records.length} exams`);
});
