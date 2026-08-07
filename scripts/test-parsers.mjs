import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/utils/spreadsheetParser.js';
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
