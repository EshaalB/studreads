import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/utils/spreadsheetParser.js';
import { normalizeExamDate, parseExamMatrix, parseExamWorkbook } from '../src/utils/examParser.js';
import { checkOverlap, parseTime } from '../src/utils/timeUtils.js';

const fixtures = [
  { path: './src/FSC TT Spring 2026 v1.1.xlsx', minimumRows: 700 },
  { path: './src/Spring_26 FSM Time Table.xlsx', minimumRows: 600 }
];

fixtures.forEach(({ path, minimumRows }) => {
  const workbook = XLSX.read(readFileSync(path), { type: 'buffer' });
  const parsed = parseWorkbook(XLSX, workbook);
  assert.ok(parsed.sheetName, `${path} should select a worksheet`);
  assert.ok(parsed.rows.length >= minimumRows, `${path} should parse at least ${minimumRows} entries`);
  assert.ok(parsed.rows.every((row) => row.courseName && row.day), `${path} should only return usable course rows`);
  console.log(`✓ ${path}: ${parsed.rows.length} entries from ${parsed.sheetName}`);
});

assert.equal(parseTime('8:30 AM'), 510);
assert.equal(parseTime('14:05'), 845);
assert.equal(parseTime('25:00'), null);
assert.equal(checkOverlap(
  { day: 'Monday', startTime: '9:00 AM', endTime: '10:30 AM' },
  { day: 'Monday', startTime: '10:00 AM', endTime: '11:00 AM' }
), true);

console.log('✓ time parsing and conflict checks');

const examMatrix = [
  ['Course Code', 'Subject Name', 'Exam Date', 'Day', 'Exam Time', 'Venue'],
  ['CS-204', 'Data Structures', '18/05/2026', 'Monday', '9:00 AM - 12:00 PM', 'Hall B'],
  ['SE-301', 'Software Engineering', '21/05/2026', 'Thursday', '2:00 PM - 5:00 PM', 'Lab 4']
];
const parsedExams = parseExamMatrix(examMatrix, 'Test sheet');
assert.equal(parsedExams.length, 2);
assert.equal(parsedExams[0].subject, 'Data Structures');
assert.equal(parsedExams[0].date, '2026-05-18');
assert.equal(parsedExams[1].room, 'Lab 4');
assert.equal(normalizeExamDate('7 June 2026'), '2026-06-07');

const loosePdfRows = parseExamMatrix([
  ['18/05/2026', 'Monday', 'CS-204', 'Data Structures', '9:00 AM - 12:00 PM', 'Hall B']
], 'Text PDF');
assert.equal(loosePdfRows.length, 1);
assert.equal(loosePdfRows[0].code, 'CS-204');
assert.equal(loosePdfRows[0].subject, 'Data Structures');

const examWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(examWorkbook, XLSX.utils.aoa_to_sheet(examMatrix), 'Final exams');
const workbookExams = parseExamWorkbook(XLSX, examWorkbook);
assert.equal(workbookExams.records.length, 2);
assert.equal(workbookExams.source, 'Final exams');
console.log('✓ Excel exam date-sheet parsing');
