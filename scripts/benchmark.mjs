// Measures how many exams the parser reads correctly from real-world date sheet layouts.
// `npm run benchmark` uses fixtures/datesheets; pass another folder with its own
// expected.json to check private sheets: `npm run benchmark -- path/to/folder`.
// expected.json maps each file to [code or subject, YYYY-MM-DD, HH:MM or null] per exam.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { extractExams, parseExamWorkbook, textToRows } from '../src/parsers/examParser.js';

const folder = process.argv[2] || 'fixtures/datesheets';
const expected = JSON.parse(readFileSync(join(folder, 'expected.json'), 'utf8'));

const compact = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clock = (minutes) => (minutes === null || minutes === undefined ? null : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);

const read = (file) => {
  const path = join(folder, file);
  if (/\.txt$/i.test(file)) return extractExams(textToRows(readFileSync(path, 'utf8'))).records;
  const workbook = /\.(csv|tsv)$/i.test(file)
    ? XLSX.read(readFileSync(path, 'utf8'), { type: 'string', raw: true })
    : XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true, cellNF: true });
  return parseExamWorkbook(XLSX, workbook).records;
};

let found = 0;
let total = 0;
let extra = 0;
Object.entries(expected).forEach(([file, exams]) => {
  const records = read(file);
  const used = new Set();
  const misses = exams.filter(([key, date, start]) => {
    const match = records.find((record, index) => !used.has(index)
      && (compact(record.code) === compact(key) || compact(record.subject) === compact(key))
      && record.date === date
      && (start === null || clock(record.start) === start));
    if (match) used.add(records.indexOf(match));
    return !match;
  });
  found += exams.length - misses.length;
  total += exams.length;
  extra += records.length - used.size;
  const mark = misses.length ? '✗' : '✓';
  console.log(`${mark} ${file}: ${exams.length - misses.length}/${exams.length}${records.length > used.size ? `, ${records.length - used.size} extra` : ''}`);
  misses.forEach(([key, date, start]) => console.log(`    missed ${key} on ${date}${start ? ` at ${start}` : ''}`));
});

console.log(`\n${found}/${total} exams read correctly (${((found / total) * 100).toFixed(1)}%), ${extra} extra`);
if (found < total) process.exitCode = 1;
