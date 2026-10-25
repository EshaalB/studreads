// Checks the date sheet reader against hand-checked answers and lists every mistake.
// `npm run benchmark` uses fixtures/datesheets, or pass another folder with its own expected.json.
// expected.json: file -> [[code or subject, YYYY-MM-DD, HH:MM or null, room?], ...]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { extractExams, parseExamWorkbook, textToRows } from '../src/parsers/examParser.js';
import { minutesToInput } from '../src/utils/timeUtils.js';
import { compact } from '../src/utils/validation.js';

const folder = process.argv[2] || 'fixtures/datesheets';
const expected = JSON.parse(readFileSync(join(folder, 'expected.json'), 'utf8'));

const read = (file) => {
  const path = join(folder, file);
  if (/\.txt$/i.test(file)) return extractExams(textToRows(readFileSync(path, 'utf8'))).records;
  const workbook = /\.(csv|tsv)$/i.test(file)
    ? XLSX.read(readFileSync(path, 'utf8'), { type: 'string', raw: true })
    : XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true, cellNF: true });
  return parseExamWorkbook(XLSX, workbook).records;
};

const sameCourse = (record, key) => compact(record.code) === compact(key) || compact(record.subject) === compact(key);

// What's wrong with a found exam ([] if nothing).
const faults = (record, [, date, start, room]) => [
  record.date !== date && `date ${record.date || 'none'} (expected ${date})`,
  start !== null && minutesToInput(record.start) !== start && `time ${minutesToInput(record.start) || 'none'} (expected ${start})`,
  room !== undefined && compact(record.room) !== compact(room) && `room "${record.room || ''}" (expected "${room}")`
].filter(Boolean);

const totals = { correct: 0, expected: 0, found: 0 };
const byType = { missing: 0, wrong: 0, extra: 0 };

Object.entries(expected).forEach(([file, exams]) => {
  const records = read(file);
  const used = new Set();
  const errors = [];
  let correct = 0;

  exams.forEach((exam) => {
    const candidates = records.map((record, index) => ({ record, index })).filter(({ record, index }) => !used.has(index) && sameCourse(record, exam[0]));
    if (!candidates.length) { errors.push(`missing ${exam[0]} on ${exam[1]}`); byType.missing += 1; return; }
    const best = candidates.find(({ record }) => faults(record, exam).length === 0) || candidates[0];
    used.add(best.index);
    const problems = faults(best.record, exam);
    if (problems.length) { errors.push(`wrong ${exam[0]}: ${problems.join(', ')}`); byType.wrong += 1; } else correct += 1;
  });

  records.forEach((record, index) => {
    if (used.has(index)) return;
    errors.push(`extra "${record.code || record.subject}" on ${record.date}`);
    byType.extra += 1;
  });

  totals.correct += correct;
  totals.expected += exams.length;
  totals.found += records.length;
  console.log(`${errors.length ? '✗' : '✓'} ${file}: ${correct}/${exams.length} correct, ${records.length} read`);
  errors.forEach((error) => console.log(`    ${error}`));
});

const precision = totals.found ? totals.correct / totals.found : 0;
const recall = totals.expected ? totals.correct / totals.expected : 0;
const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
const percent = (value) => `${(value * 100).toFixed(1)}%`;
console.log(`\nprecision ${percent(precision)} · recall ${percent(recall)} · F1 ${percent(f1)}`);
console.log(`errors: ${byType.missing} missing, ${byType.wrong} wrong, ${byType.extra} extra`);
console.log(`${totals.correct}/${totals.expected} exams read correctly`);
if (totals.correct < totals.expected || byType.extra) process.exitCode = 1;
