import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/parsers/spreadsheetParser.js';
import { docxXmlToRows, extractExams, parseExamWorkbook, positionedItemsToRows, textToRows } from '../src/parsers/examParser.js';
import { importClasses, isDuplicateClass, normalizeClass, validateClass } from '../src/utils/classes.js';
import { buildTimetableShare, readTimetablePayload } from '../src/export/transfer.js';
import { checkOverlap, parseTime } from '../src/utils/timeUtils.js';

const fixtures = [
  { path: './fixtures/timetables/FSC TT Spring 2026 v1.1.xlsx', minimumRows: 700 },
  { path: './fixtures/timetables/Spring_26 FSM Time Table.xlsx', minimumRows: 600 }
];

const { readTimetableBook } = await import('../src/parsers/readWorkbook.js');
fixtures.forEach(({ path, minimumRows }) => {
  // Read the same way the app does.
  const workbook = readTimetableBook(XLSX, readFileSync(path), path);
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
const parsedExams = extractExams(examMatrix, 'Test sheet').records;
assert.equal(parsedExams.length, 2);
assert.equal(parsedExams[0].subject, 'Data Structures');
assert.equal(parsedExams[0].date, '2026-05-18');
assert.equal(parsedExams[1].room, 'Lab 4');
const dateOf = (text) => extractExams([['Subject', 'Date'], ['Physics', text]]).records[0]?.date;
assert.equal(dateOf('7 June 2026'), '2026-06-07');
assert.equal(dateOf('05/18/2026'), '2026-05-18');
assert.equal(extractExams([['Subject', 'Date'], ['Physics', '03/04/2026']]).ambiguousDates, true);
assert.equal(extractExams([['Subject', 'Date'], ['Physics', '18/05/2026']]).ambiguousDates, false);

const loosePdfRows = extractExams([
  ['18/05/2026', 'Monday', 'CS-204', 'Data Structures', '9:00 AM - 12:00 PM', 'Hall B']
], 'Text PDF').records;
assert.equal(loosePdfRows.length, 1);
assert.equal(loosePdfRows[0].code, 'CS-204');
assert.equal(loosePdfRows[0].subject, 'Data Structures');

const examWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(examWorkbook, XLSX.utils.aoa_to_sheet(examMatrix), 'Final exams');
const workbookExams = parseExamWorkbook(XLSX, examWorkbook);
assert.equal(workbookExams.records.length, 2);

const manualClass = normalizeClass({
  id: 'one', name: '  Data Structures  ', day: 'mon',
  startTime: '09:00', endTime: '10:00', room: '<Lab 4>'
});
assert.equal(manualClass.name, 'Data Structures');
assert.equal(manualClass.day, 'Monday');
assert.equal(manualClass.room, 'Lab 4');
assert.equal(validateClass(manualClass).valid, true);
assert.equal(validateClass({ ...manualClass, endTime: '08:00' }).valid, false);
assert.equal(isDuplicateClass(manualClass, [{ ...manualClass, startTime: '9:00 AM' }]), true, 'times compare by value');
assert.equal(isDuplicateClass(manualClass, [{ ...manualClass }], 'one'), false);
console.log('✓ Excel exam date-sheet parsing');

// Date sheets laid out the way universities publish them.
const summary = (records) => records.map((r) => [r.date, r.time, r.code, r.subject, r.room].join(' | '));

const serialAndMerged = extractExams([
  ['Final Term Examination Schedule Spring 2026'],
  ['Sr. No', 'Date & Day', 'Course Code', 'Course Title', 'Time', 'Venue'],
  ['1', 'Mon 18-May-2026', 'CS-204', 'Data Structures', '9:00 - 12:00', 'Hall B'],
  ['2', '', 'MA-101', 'Calculus I', '', 'Hall C'],
  ['3', 'Tue 19-May-2026', 'SE301', 'Software Engineering', '2:00 - 5:00 PM', '']
]);
assert.deepEqual(summary(serialAndMerged.records), [
  '2026-05-18 | 9:00 AM – 12:00 PM | MA-101 | Calculus I | Hall C',
  '2026-05-18 | 9:00 AM – 12:00 PM | CS-204 | Data Structures | Hall B',
  '2026-05-19 | 2:00 PM – 5:00 PM | SE301 | Software Engineering | '
]);

const twoRowHeader = extractExams([
  ['Subject', 'Exam Date', 'Time', ''],
  ['', '', 'From', 'To'],
  ['Physics', '2026-06-01', '09:00', '11:00']
]);
assert.equal(twoRowHeader.records[0].time, '9:00 AM – 11:00 AM');

const datesAcross = extractExams([
  ['Programme', 'Mon 18/05/2026', 'Tue 19/05/2026', 'Wed 20/05/2026'],
  ['BSCS-3A', 'CS-204 Data Structures', 'MA-201 Linear Algebra', ''],
  ['BSSE-5B', 'SE-301 Software Engineering', '', 'SE-310 Testing\nSE-320 HCI']
]);
assert.equal(datesAcross.mode, 'grid');
assert.equal(datesAcross.records.length, 5);
assert.ok(datesAcross.records.some((r) => r.code === 'SE-320' && r.date === '2026-05-20' && r.program === 'BSSE-5B'));

const slotsAcross = extractExams([
  ['Date', 'Day', '9:00 AM - 12:00 PM', '2:00 PM - 5:00 PM'],
  ['18 May 2026', 'Monday', 'Data Structures (Hall B)', 'Calculus'],
  ['19 May 2026', 'Tuesday', 'Operating Systems', '']
]);
assert.deepEqual(summary(slotsAcross.records), [
  '2026-05-18 | 9:00 AM – 12:00 PM |  | Data Structures | Hall B',
  '2026-05-18 | 2:00 PM – 5:00 PM |  | Calculus | ',
  '2026-05-19 | 9:00 AM – 12:00 PM |  | Operating Systems | '
]);

const pasted = extractExams(textToRows(`FINAL TERM EXAMINATION SCHEDULE SPRING 2026
Monday, 18 May 2026
Morning 9:00 AM - 12:00 PM
CS-204 Data Structures   BSCS-3A   Hall B
Tuesday, 19 May 2026
SE-301 Software Engineering (Lab 4) 2:00 - 5:00 PM
Note: Students must bring their ID cards.`));
assert.deepEqual(summary(pasted.records), [
  '2026-05-18 | 9:00 AM – 12:00 PM | CS-204 | Data Structures | Hall B',
  '2026-05-19 | 2:00 PM – 5:00 PM | SE-301 | Software Engineering | Lab 4'
]);

const oneLine = extractExams(textToRows('18/05/2026 Monday CS-204 Data Structures 9:00 AM - 12:00 PM Hall B'));
assert.equal(summary(oneLine.records)[0], '2026-05-18 | 9:00 AM – 12:00 PM | CS-204 | Data Structures | Hall B');

const monthFirst = extractExams(textToRows('05/06/2026 Wednesday  Biology  9:00 AM'));
assert.equal(monthFirst.records[0].date, '2026-05-06', 'a printed weekday decides between day/month and month/day');
assert.equal(monthFirst.ambiguousDates, false);
assert.equal(extractExams(textToRows('Exams 2026\n18 May   Data Structures   9am')).records[0].date, '2026-05-18');

// PDF table that continues on page two with different column widths.
const word = (text, x, y, width = text.length * 5) => ({ text, x, y, width, height: 10 });
const pdfRows = positionedItemsToRows([
  word('Code', 40, 100), word('Subject', 120, 100), word('Date', 300, 100), word('Time', 400, 100), word('Room', 520, 100),
  word('CS-204', 40, 120), word('Data', 120, 120, 20), word('Structures', 143, 120, 50), word('18/05/2026', 300, 120), word('9:00 AM - 12:00 PM', 400, 120), word('Hall B', 520, 120),
  word('HU-110', 40, 140), word('Islamic and Pakistan', 120, 140), word('20/05/2026', 300, 140), word('9:00 AM - 12:00 PM', 400, 140), word('Hall A', 520, 140),
  word('Studies', 120, 152),
  word('SE-301', 80, 900), word('Software Engineering', 150, 900), word('21/05/2026', 290, 900), word('9:00 AM - 12:00 PM', 360, 900), word('Lab 4', 470, 900)
]);
assert.deepEqual(summary(extractExams(pdfRows).records), [
  '2026-05-18 | 9:00 AM – 12:00 PM | CS-204 | Data Structures | Hall B',
  '2026-05-20 | 9:00 AM – 12:00 PM | HU-110 | Islamic and Pakistan Studies | Hall A',
  '2026-05-21 | 9:00 AM – 12:00 PM | SE-301 | Software Engineering | Lab 4'
]);

const docxRows = docxXmlToRows('<w:body><w:p><w:r><w:t>Date Sheet</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Date</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Paper</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Timing</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>12 Dec 2026</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Data &amp; Society</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10:00-13:00</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>');
assert.equal(summary(extractExams(docxRows).records)[0], '2026-12-12 | 10:00 AM – 1:00 PM |  | Data & Society | ');

// Excel dates, with a date cell merged over two rows.
const datedSheet = XLSX.utils.aoa_to_sheet([
  ['Course', 'Date', 'Start Time', 'End Time', 'Hall'],
  ['Data Structures', new Date(2026, 4, 6), '09:00', '12:00', 'B'],
  ['Calculus', null, '14:00', '17:00', 'C']
], { cellDates: true });
datedSheet['!merges'] = [{ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }];
const datedBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(datedBook, datedSheet, 'Finals');
const reread = XLSX.read(XLSX.write(datedBook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellNF: true });
assert.deepEqual(parseExamWorkbook(XLSX, reread).records.map((r) => [r.date, r.time, r.subject]), [
  ['2026-05-06', '9:00 AM – 12:00 PM', 'Data Structures'],
  ['2026-05-06', '2:00 PM – 5:00 PM', 'Calculus']
]);
console.log('✓ exam date sheets: tables, grids, text, PDF layout, Word and Excel dates');

// Share links and backups open as normal classes.
const shared = readTimetablePayload(buildTimetableShare({
  classes: [{ name: 'Linear Algebra', day: 'Tuesday', startTime: '8:30 AM', endTime: '9:50 AM', room: 'Room 104', teacher: '', credits: '3' }],
  title: 'Spring', colorMap: { 'Linear Algebra': '#123456', Other: 'red' }, theme: 'brand'
}));
assert.deepEqual(shared.colors, { 'Linear Algebra': '#123456' });
assert.equal(shared.theme, 'brand');
const reopened = importClasses(shared.classes);
assert.equal(reopened.length, 1);
assert.ok(reopened[0].id);
assert.equal(importClasses([{ name: 'No day', day: 'Someday', startTime: '9:00', endTime: '10:00' }]).length, 0);
console.log('✓ share links and backups');

// Sheets that list codes in the schedule and titles somewhere else.
const codesWithLegend = extractExams([
  ['Date', '9:00 AM - 12:00 PM', '2:00 PM - 5:00 PM'],
  ['18/05/2026', 'CS-204', 'MA-201'],
  ['19/05/2026', 'SE-301', ''],
  ['Course Code', 'Course Title'],
  ['CS-204', 'Data Structures'], ['MA-201', 'Linear Algebra'], ['SE-301', 'Software Engineering']
]);
assert.deepEqual(codesWithLegend.records.map((r) => [r.code, r.subject]), [
  ['CS-204', 'Data Structures'], ['MA-201', 'Linear Algebra'], ['SE-301', 'Software Engineering']
]);

const longHeader = extractExams([
  ['Sr', 'Course Code', 'Name of the Course / Subject', 'Exam Date', 'Time'],
  ['1', 'CS-204', 'Data Structures', '18/05/2026', '9:00 AM']
]);
assert.equal(longHeader.records[0].subject, 'Data Structures');
assert.equal(extractExams([['Code', 'Descr.', 'Date', 'Time'], ['CS-204', 'Data Structures', '18/05/2026', '9:00 AM']]).records[0].subject, 'Data Structures');

const legendBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(legendBook, XLSX.utils.aoa_to_sheet([
  ['Date', 'Slot 1 (9:00-12:00)', 'Slot 2 (2:00-5:00)'],
  ['Mon 18-May-2026', 'CS-204, MA-201', 'SE-301']
]), 'Schedule');
XLSX.utils.book_append_sheet(legendBook, XLSX.utils.aoa_to_sheet([
  ['Code', 'Title', 'Credit Hours'], ['CS-204', 'Data Structures', 3], ['MA-201', 'Linear Algebra', 3], ['SE-301', 'Software Engineering', 3]
]), 'Courses');
assert.deepEqual(parseExamWorkbook(XLSX, legendBook).records.map((r) => r.subject), ['Data Structures', 'Linear Algebra', 'Software Engineering']);
console.log('✓ course titles found for code-only date sheets');

// Loose time formats.
const timeOf = (matrix) => extractExams(matrix).records.map((r) => r.time);
assert.deepEqual(timeOf([['Subject', 'Date', 'Time'], ['Physics', '18/05/2026', '0900-1200']]), ['9:00 AM – 12:00 PM']);
assert.deepEqual(timeOf([['Subject', 'Date', 'Start', 'End'], ['Physics', '18/05/2026', '9', '12']]), ['9:00 AM – 12:00 PM']);
assert.deepEqual(timeOf([['Subject', 'Date', 'Timing'], ['Physics', '18/05/2026', '09:00 hrs to 12:00 hrs']]), ['9:00 AM – 12:00 PM']);
assert.deepEqual(timeOf([['Course', 'Date', 'Start'], ['Physics', '18/05/2026', '0.375']]), ['9:00 AM']);
assert.deepEqual(timeOf([
  ['Morning session: 9:00 AM - 12:00 PM, Evening session: 2:00 PM - 5:00 PM'],
  ['Subject', 'Date', 'Session'], ['Physics', '18/05/2026', 'Morning'], ['Maths', '19/05/2026', 'Evening']
]), ['9:00 AM – 12:00 PM', '2:00 PM – 5:00 PM']);
assert.deepEqual(timeOf([['All papers will be held from 9:00 AM to 12:00 PM'], ['Subject', 'Date'], ['Physics', '18/05/2026']]), ['9:00 AM – 12:00 PM']);
assert.deepEqual(timeOf([['Course', 'Date', 'Time'], ['Physics', '18/05/2026', 'After Zuhr']]), ['After Zuhr'], 'unreadable times are shown as written');
assert.deepEqual(timeOf([['Morning: 9:00-12:00 | Evening: 2:00-5:00'], ['Date', 'Morning', 'Evening'], ['18/05/2026', 'Physics', 'Maths']]), ['9:00 AM – 12:00 PM', '2:00 PM – 5:00 PM']);
console.log('✓ exam times in loose formats');

// Picking a section gives its classes plus the "All" rows.
const { DEMO_TIMETABLE_DATA } = await import('../src/utils/demoData.js');
const { coursesForSection, findSections, STANDARD_MAPPING } = await import('../src/utils/timetableSource.js');
const sectionCourses = coursesForSection(DEMO_TIMETABLE_DATA, STANDARD_MAPPING, 'BSCS-3A');
assert.ok(sectionCourses.length > 0 && sectionCourses.every((cls) => ['BSCS-3A', 'All'].includes(cls.section)));
console.log('✓ classes for a section');

// Time slots as column headers, each with a Code column before it.
const slotSheet = extractExams([
  ['COMPLETE DATE SHEET - MIDTERM-II'],
  ['Fall 2026 Semester'],
  ['Day', 'Date', 'Code', '09:00 - 10:00', 'Code', '10:30 - 11:30', 'Code', '14:00 - 15:00'],
  ['Thursday', '29-Oct-2026', 'AF3006', 'Financing New Ventures', 'SS1022', 'Understanding of Holy Quran II/Introduction to Major World Religions II', 'SS2019', 'Psychology'],
  ['Thursday', '29-Oct-2026', 'CS2009', 'Design and Analysis of Algorithms', '', '', 'CV4001', 'Environmental Engineering-II'],
  [],
  ['Friday', '30-Oct-2026', 'NS1002', 'Physics for Engineers', 'MT1003', 'Calculus and Analytical Geometry', '', '']
]);
assert.deepEqual(summary(slotSheet.records.filter((r) => ['AF3006', 'SS1022', 'SS2019', 'NS1002'].includes(r.code))), [
  '2026-10-29 | 9:00 AM – 10:00 AM | AF3006 | Financing New Ventures | ',
  '2026-10-29 | 10:30 AM – 11:30 AM | SS1022 | Understanding of Holy Quran II/Introduction to Major World Religions II | ',
  '2026-10-29 | 2:00 PM – 3:00 PM | SS2019 | Psychology | ',
  '2026-10-30 | 9:00 AM – 10:00 AM | NS1002 | Physics for Engineers | '
]);
assert.equal(slotSheet.records.length, 7);

// Same, but with dates as the headers and no code columns.
const slotsNoCodes = extractExams([['Course Code', 'Mon 18/05/2026', 'Tue 19/05/2026'], ['CS-204', 'Data Structures', ''], ['MA-201', '', 'Linear Algebra']]);
assert.deepEqual(slotsNoCodes.records.map((r) => [r.date, r.subject]), [['2026-05-18', 'Data Structures'], ['2026-05-19', 'Linear Algebra']]);
const slotsLabelled = extractExams([['Date', 'Code', 'Slot 1 (9:00-12:00)', 'Code', 'Slot 2 (2:00-5:00)'], ['18/05/2026', 'CS-204', 'Data Structures', 'MA-201', 'Linear Algebra']]);
assert.deepEqual(slotsLabelled.records.map((r) => [r.code, r.time]), [['CS-204', '9:00 AM – 12:00 PM'], ['MA-201', '2:00 PM – 5:00 PM']]);
console.log('✓ date sheets with time-slot columns');

// A time from one day doesn't carry into the next.
const nextDay = extractExams(textToRows(`Tuesday, 3 November 2026
SE-301 Software Engineering   2:00 PM - 5:00 PM   Lab 4
Wednesday, 4 November 2026
HU-110 Pakistan Studies   Hall A`));
assert.deepEqual(nextDay.records.map((r) => [r.code, r.time]), [['SE-301', '2:00 PM – 5:00 PM'], ['HU-110', '']]);
console.log('✓ times stay on their own date');

// Saved data loads back correctly.
const memory = new Map();
globalThis.localStorage = { getItem: (key) => (memory.has(key) ? memory.get(key) : null), setItem: (key, value) => memory.set(key, String(value)), removeItem: (key) => memory.delete(key) };
const { readStored, writeStored } = await import('../src/utils/storage.js');
writeStored('list', [{ id: 'a' }]);
assert.deepEqual(readStored('list', null), [{ id: 'a' }]);
assert.deepEqual(readStored('list', {}), {}, 'a list is not accepted where an object is expected');
assert.equal(readStored('missing', null), null);
writeStored('list', null);
assert.equal(readStored('list', 'x'), 'x');
console.log('✓ saved data reads back');

// FAQ text matches in the app, index.html and the structured data.
const indexHtml = readFileSync('./index.html', 'utf8');
const { FAQ } = await import('../src/content/faq.js');
const graph = JSON.parse(indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const faqSchema = graph.find((node) => node['@type'] === 'FAQPage').mainEntity;
assert.deepEqual(faqSchema.map((q) => [q.name, q.acceptedAnswer.text]), FAQ.map((item) => [item.question, item.answer]));
FAQ.forEach((item) => assert.ok(indexHtml.includes(`<h3>${item.question}</h3>`) && indexHtml.includes(item.answer), `fallback page includes "${item.question}"`));
assert.equal((indexHtml.match(/<h1[\s>]/g) || []).length, 1);
['llms.txt', 'robots.txt', 'sitemap.xml', 'privacy.html', 'og-image.png', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png'].forEach((file) => assert.ok(readFileSync(`./public/${file}`).length > 0, file));
console.log('✓ SEO files and FAQ in step');

// Messy input: scan mistakes, spaced-out letters, odd characters, rows before their date.
const messy = (matrix) => extractExams(matrix).records.map((r) => [r.date, r.time, r.code, r.subject]);
assert.deepEqual(messy([['Course Code', 'Course Title', 'Date', 'Time'], ['CS2O4', 'Data Structures', '18/O5/2026', '9:OO AM - 12:OO PM'], ['MA-2Ol', 'Linear Algebra', '19/05/2O26', '2:00 PM - 5:00 PM']]), [
  ['2026-05-18', '9:00 AM – 12:00 PM', 'CS204', 'Data Structures'],
  ['2026-05-19', '2:00 PM – 5:00 PM', 'MA-201', 'Linear Algebra']
]);
assert.deepEqual(messy([['C o u r s e', 'D a t e', 'T i m e'], ['D a t a  S t r u c t u r e s', '1 8 / 0 5 / 2 0 2 6', '9:00 AM']]), [['2026-05-18', '9:00 AM', '', 'Data Structures']]);
assert.deepEqual(messy([['Subject', 'Date', 'Time'], ['Physics', '１８/０５/２０２６', '０９：００ – １２：００']]), [['2026-05-18', '9:00 AM – 12:00 PM', '', 'Physics']]);
assert.equal(messy([['Subject', 'Date', 'Time'], ['Deﬁnitions of Finance', '18/05/2026', '9:00 AM']])[0][3], 'Definitions of Finance');
assert.deepEqual(messy(textToRows('18/05/2026  CS-204 Data Structures  0900 hrs - 1200 hrs  Hall B')), [['2026-05-18', '9:00 AM – 12:00 PM', 'CS-204', 'Data Structures']]);
assert.deepEqual(messy([['Subject', 'Date', 'Time'], ['Physics', '', '9:00 AM'], ['Chemistry', '19/05/2026', '9:00 AM']]).map((r) => r[3]).sort(), ['Chemistry', 'Physics']);
console.log('✓ messy date sheets');

// Updated date sheet: your exams are found again and changes are listed.
const { findExamChanges } = await import('../src/utils/examChanges.js');
const exam = (id, code, subject, date, time, room = '') => ({ id, code, subject, date, time, room, start: time ? 540 : null, end: null });
const revised = findExamChanges(
  [exam('a', 'CS-204', 'Data Structures', '2026-12-07', '9:00 AM', 'Hall A'), exam('b', 'MA-101', 'Calculus', '2026-12-08', '9:00 AM'), exam('c', 'PH-100', 'Physics', '2026-12-09', '')],
  [exam('n1', 'CS204', 'Data Structures', '2026-12-10', '9:00 AM', 'Hall A'), exam('n2', '', 'Calculus', '2026-12-08', '9:00 AM'), exam('n3', 'EE-100', 'Circuits', '2026-12-09', '')]
);
assert.deepEqual(revised.ids, ['n1', 'n2']);
assert.deepEqual(revised.changed.map((item) => item.differences.map((d) => `${d.field} ${d.from}→${d.to}`)), [['Date 2026-12-07→2026-12-10']]);
assert.equal(revised.unchanged, 1);
assert.deepEqual(revised.missing.map((item) => item.subject), ['Physics']);
console.log('✓ revised date sheets');

// Classmate links carry the timetable and the whole date sheet.
const { buildClassmateShare, readClassmatePayload } = await import('../src/export/transfer.js');
const classmate = readClassmatePayload(buildClassmateShare({
  title: 'BSCS',
  source: { name: 'tt.xlsx', mapping: { courseName: 'Course', day: 'Day', startTime: 'Time', endTime: 'Time', section: 'Sec', _combinedTime: 'Time' }, columns: ['Course', 'Day', 'Time', 'Sec'], rows: [['Physics', 'Monday', '9:00 - 10:00', 'A'], ['<b>Chem</b>', 'Tuesday', '10:00 - 11:00', 'B']] },
  exams: [exam('x', 'PH-100', 'Physics', '2026-12-09', '9:00 AM')],
  examFile: 'sheet.pdf'
}));
assert.equal(classmate.source.rows.length, 2);
assert.equal(classmate.source.rows[1].Course, 'bChem/b', 'markup is stripped');
assert.equal(classmate.source.mapping._combinedTime, 'Time');
assert.equal(classmate.exams[0].subject, 'Physics');
assert.equal(classmate.examFile, 'sheet.pdf');
assert.equal(readClassmatePayload({ t: { h: [], r: [], m: {} } }), null);
console.log('✓ classmate links');

// Exams first by date, then weekly classes by day.
const { plannerColumns } = await import('../src/utils/calendarItems.js');
assert.deepEqual(plannerColumns([{ column: 'Friday' }]).map((c) => c.key), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
assert.deepEqual(plannerColumns([{ column: 'Friday' }, { date: '2026-12-09' }, { date: '2026-12-02' }]).map((c) => c.key), ['date:2026-12-02', 'date:2026-12-09', 'Friday']);
console.log('✓ planner columns in date order');

// Restoring pages never overwrites a newer copy.
const { mergePages, readPages } = await import('../src/utils/pages.js');
const page = (id, savedAt, extra = {}) => ({ id, name: id, savedAt, data: { timetable_classes_v7: '[]', ...extra } });
mergePages([page('sem', 200)]);
assert.equal(mergePages([page('sem', 100), page('exams', 50, { other_key: 'x' })]), 1, 'the older copy of "sem" is ignored');
assert.deepEqual(readPages().map((p) => [p.id, p.savedAt]), [['sem', 200], ['exams', 50]]);
assert.equal('other_key' in readPages()[1].data, false);
console.log('✓ saved pages merge');

// Storage errors, link checks, alternate weeks and updated sheets.
const storage = await import('../src/utils/storage.js');
const failures = [];
storage.onStorageFailure((reason) => failures.push(reason));
const realSet = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
assert.equal(storage.writeStored('x', 1), false);
storage.writeStored('y', 2);
globalThis.localStorage.setItem = realSet;
assert.deepEqual(failures, ['full'], 'reported once, as "full"');
console.log('✓ storage failures are reported');

const { decodeShare, encodeShare } = await import('../src/export/sharingUtils.js');
assert.deepEqual(await decodeShare(await encodeShare({ a: 1 })), { a: 1 });
for (const bad of [null, '', 'zzz***', 'j' + 'a'.repeat(10), 'z' + 'A'.repeat(400001)]) assert.equal(await decodeShare(bad), null);
console.log('✓ malformed share links are refused');

const { checkOverlap: overlaps } = await import('../src/utils/timeUtils.js');
const fortnightly = (alternateFrom) => ({ day: 'Monday', startTime: '09:00', endTime: '10:00', alternate: true, alternateFrom });
assert.equal(overlaps(fortnightly('2026-11-02'), fortnightly('2026-11-09')), false, 'opposite weeks never meet');
assert.equal(overlaps(fortnightly('2026-11-02'), fortnightly('2026-11-16')), true, 'same weeks clash');
assert.equal(overlaps(fortnightly('2026-11-02'), { day: 'Monday', startTime: '09:30', endTime: '10:30' }), true, 'a weekly class always clashes');
const { classesToIcs } = await import('../src/export/exportUtils.js');
const { weekParity } = await import('../src/utils/dates.js');
const ics = classesToIcs([{ name: 'Lab', ...fortnightly('2026-11-09') }]);
const firstDate = ics.match(/DTSTART:(\d{4})(\d{2})(\d{2})/).slice(1).join('-');
assert.equal(weekParity(firstDate), weekParity('2026-11-09'), 'calendar starts on a matching week');
assert.match(ics, /INTERVAL=2/);
console.log('✓ alternate-week classes');

const sheet = [exam('n1', 'CS-204', 'Data Structures', '2026-12-10', '9:00 AM'), exam('n2', 'CS-205', 'Data Structures Lab', '2026-12-11', '9:00 AM'), exam('n3', '', 'Physics', '2026-12-12', '')];
const global = findExamChanges([exam('lab', 'CS-205', 'Data Structures Lab', '2026-12-11', '9:00 AM'), exam('ds', 'CS-204', 'Data Structures', '2026-12-10', '9:00 AM'), exam('ph', 'PH-100', 'Physics', '2026-12-12', '')], sheet);
assert.deepEqual(global.ids, ['n2', 'n1', 'n3'], 'each pick gets its own exam');
assert.deepEqual(global.uncertain.map((item) => item.after.id), ['n3'], 'a name-only match is flagged');
console.log('✓ revised sheets match across the whole sheet');

// Guessed columns are flagged; course matching tells sure from possible.
const { autoDetectColumnMapping } = await import('../src/parsers/columnDetector.js');
const byHeader = autoDetectColumnMapping(['Course', 'Day', 'Start Time', 'End Time'], []);
assert.deepEqual([byHeader.mapping.day, byHeader.mapping.startTime, byHeader.guessed], ['Day', 'Start Time', []]);
const byValue = autoDetectColumnMapping(['Course', 'When', 'Slot A', 'Slot B'], [
  { Course: 'Physics', When: 'Monday', 'Slot A': '9:00', 'Slot B': '10:30' },
  { Course: 'Maths', When: 'Tue', 'Slot A': '11:00 AM', 'Slot B': '12:20 PM' }
]);
assert.deepEqual([byValue.mapping.day, byValue.mapping.startTime, byValue.mapping.endTime], ['When', 'Slot A', 'Slot B']);
assert.deepEqual(byValue.guessed, ['day', 'startTime', 'endTime']);
const combined = autoDetectColumnMapping(['Course', 'Day', 'Hours'], [{ Course: 'Physics', Day: 'Mon', Hours: '8:30 AM - 9:50 AM' }]);
assert.equal(combined.mapping._combinedTime, 'Hours');
assert.equal(autoDetectColumnMapping(['Course', 'Notes'], [{ Course: 'X', Notes: 'bring a calculator' }]).mapping.day, undefined, 'nothing is guessed from unrelated text');
console.log('✓ columns from headers and values');

const { courseMatch } = await import('../src/utils/courseMatch.js');
const examOf = (subject, code = '') => ({ subject, code });
assert.equal(courseMatch(examOf('Data Structures', 'CS-204'), ['CS204 Data Structures']), 'sure');
assert.equal(courseMatch(examOf('Object Oriented Programming'), ['Object Oriented Programming Lab']), 'sure');
assert.equal(courseMatch(examOf('OOP'), ['Object Oriented Programming']), 'maybe', 'abbreviation');
assert.equal(courseMatch(examOf('Intro to Software Engineering Design'), ['Software Engineering Design Patterns']), 'maybe');
assert.equal(courseMatch(examOf('Linear Algebra'), ['Data Structures']), null);
assert.equal(courseMatch(examOf('Data Structures', 'CS-204'), ['CS-205 Data Structures Lab']), 'sure', 'name containment still counts');
console.log('✓ course matching: sure and possible');

const launch = (search, hash) => new URLSearchParams(`${search.slice(1)}&${hash.slice(1)}`);
assert.equal(launch('', '#t=zabc').get('t'), 'zabc');
assert.equal(launch('?t=zold', '').get('t'), 'zold', 'old ?t= links still read');
console.log('✓ links read from # or ?');

// Text on every colour is readable (WCAG AA); previewed classes stay marked.
const { COLOR_THEMES, readableText, contrastRatio } = await import('../src/utils/themes.js');
COLOR_THEMES.flatMap((theme) => [...theme.colors, ...theme.dark]).forEach((color) => assert.ok(contrastRatio(color, readableText(color)) >= 4.5, color));
assert.equal(readableText('#FFFF00'), '#111111');
assert.equal(readableText('#000080'), '#ffffff');
assert.equal(normalizeClass({ id: 'p', name: 'X', day: 'Mon', startTime: '9:00', endTime: '10:00', preview: true }).preview, true);
assert.equal(normalizeClass({ id: 'q', name: 'X', day: 'Mon', startTime: '9:00', endTime: '10:00' }).preview, false);
console.log('✓ readable block text and preview classes');

// Broken backups are refused safely; calendar exports have reminders; duplicates merge.
for (const junk of [null, 42, 'text', [], {}, { c: 'no' }, { classes: [{ name: '', day: 'Funday' }] }]) {
  assert.equal(readTimetablePayload(junk), null, JSON.stringify(junk));
  assert.equal(readClassmatePayload(junk), null, JSON.stringify(junk));
}
assert.equal(mergePages('not a list'), 0);
assert.equal(mergePages([{ id: 1 }, { id: 'x', name: 'n', savedAt: 'soon', data: {} }, null]), 0, 'malformed pages are skipped');
const { examsToIcs } = await import('../src/export/exportUtils.js');
const examIcs = examsToIcs([{ id: 'e', subject: 'Physics', code: 'PH-1', date: '2026-12-09', start: 540, end: 720, room: 'Hall A' }, { id: 'f', subject: 'Maths', code: '', date: '2026-12-10', start: null, end: null }]);
assert.equal((examIcs.match(/BEGIN:VEVENT/g) || []).length, 2);
assert.equal((examIcs.match(/TRIGGER:-P1D/g) || []).length, 2, 'a day-before reminder on every exam');
assert.equal((examIcs.match(/TRIGGER:-PT2H/g) || []).length, 1, 'a two-hour reminder only when the time is known');
assert.match(examIcs, /DTSTART;VALUE=DATE:20261210/);
const twice = extractExams([['Code', 'Subject', 'Date', 'Time'], ['CS-101', 'Algebra', '01/12/2026', '9:00'], ['CS-101', 'Algebra', '01/12/2026', '9:00']]).records;
assert.equal(twice.length, 1, 'identical rows are one exam');
console.log('✓ damaged input, exam reminders and duplicates');

// The quick "is this a date sheet?" check.
const { mayBeDateSheet } = await import('../src/parsers/examParser.js');
fixtures.forEach(({ path }) => assert.equal(mayBeDateSheet(XLSX, XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true })), false, path));
readdirSync('./fixtures/datesheets').filter((file) => file.endsWith('.csv')).forEach((file) => {
  assert.equal(mayBeDateSheet(XLSX, XLSX.read(readFileSync(`./fixtures/datesheets/${file}`, 'utf8'), { type: 'string', raw: true })), true, file);
});
const noYear = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(noYear, XLSX.utils.aoa_to_sheet([['Subject', 'Date'], ['A', '18 May'], ['B', '19 May'], ['C', 'May 20']]), 'S');
assert.equal(mayBeDateSheet(XLSX, noYear), true, 'dates without a year');
console.log('✓ quick date-sheet check');

// Pages share uploaded files, old pages upgrade, and a failed switch changes nothing.
const pagesModule = await import('../src/utils/pages.js');
const source = JSON.stringify({ data: [{ Course: 'Physics' }], mapping: { courseName: 'Course' } });
globalThis.localStorage.setItem('timetable_source_v6', source);
globalThis.localStorage.setItem('timetable_classes_v7', '[]');
pagesModule.savePage('One', { asNew: true });
pagesModule.savePage('Two', { asNew: true });
const storedFiles = JSON.parse(globalThis.localStorage.getItem('studreads_page_files'));
assert.equal(Object.keys(storedFiles).length, 1, 'one copy of a file shared by two pages');
assert.ok(pagesModule.readPages().filter((p) => ['One', 'Two'].includes(p.name)).every((p) => p.data.timetable_source_v6 === source), 'pages read back complete');

globalThis.localStorage.setItem('timetable_classes_v7', '["before"]');
const realSetItem = globalThis.localStorage.setItem;
const target = pagesModule.readPages().find((p) => p.name === 'One');
globalThis.localStorage.setItem = (key, value) => { if (key === 'timetable_source_v6') throw new Error('full'); realSetItem(key, value); };
assert.throws(() => pagesModule.openPage(target.id), /Nothing on screen was changed/);
globalThis.localStorage.setItem = realSetItem;
assert.equal(globalThis.localStorage.getItem('timetable_classes_v7'), '["before"]', 'rolled back');
console.log('✓ pages: one copy per file, safe switching');
globalThis.localStorage.setItem('studreads_pages_version', '1');
globalThis.localStorage.setItem('studreads_pages_v1', JSON.stringify([{ id: 'old', name: 'Old', savedAt: 1, data: { timetable_source_v6: source } }]));
assert.equal(pagesModule.readPages()[0].data.timetable_source_v6, source, 'old pages still read');
assert.match(JSON.parse(globalThis.localStorage.getItem('studreads_pages_v1'))[0].data.timetable_source_v6, /^@file:/, 'and are migrated to one shared copy');
assert.equal(globalThis.localStorage.getItem('studreads_pages_version'), '2');
console.log('✓ pages migrate from the first format');

// Choosing day-first or month-first only changes unclear dates.
const ambiguousRows = [['Subject', 'Date'], ['Physics', '03/04/2026'], ['Maths', '05/04/2026'], ['Biology', '18/04/2026']];
assert.equal(extractExams(ambiguousRows).records.find((r) => r.subject === 'Physics').date, '2026-04-03');
const monthFirstRead = extractExams([['Subject', 'Date'], ['Physics', '03/04/2026'], ['Maths', '05/04/2026']], 'x', { dayFirst: false }).records;
assert.deepEqual(monthFirstRead.map((r) => r.date).sort(), ['2026-03-04', '2026-05-04']);
assert.equal(extractExams(ambiguousRows, 'x', { dayFirst: false }).records.find((r) => r.subject === 'Biology').date, '2026-04-18', '18/04 can only be day first');
console.log('✓ chosen date order');

// Import error messages.
const { ImportError, describeImportFailure } = await import('../src/parsers/importError.js');
assert.throws(() => parseWorkbook(XLSX, XLSX.utils.book_new()), (error) => error.kind === 'empty' || error instanceof Error);
const emptyBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(emptyBook, XLSX.utils.aoa_to_sheet([['nothing here']]), 'S');
assert.throws(() => parseExamWorkbook(XLSX, emptyBook), (error) => error instanceof ImportError && error.kind === 'empty');
assert.equal(describeImportFailure(new ImportError('invalid', 'Too big.')), 'Too big.');
assert.match(describeImportFailure(new TypeError('x is undefined')), /Something went wrong/);
console.log('✓ typed import errors');

// Exams from a scan remember where they were on the page.
const { locateInScan } = await import('../src/parsers/scanLocate.js');
const scanWord = (text, page, x, y) => ({ text, page, x, y, width: text.length * 8, height: 12 });
const scanWords = [scanWord('CS-204', 0, 10, 100), scanWord('Data', 0, 80, 101), scanWord('Structures', 0, 120, 99), scanWord('Hall', 0, 300, 100),
  scanWord('MA-101', 0, 10, 140), scanWord('Calculus', 0, 80, 140), scanWord('Physics', 1, 10, 50)];
const located = locateInScan([{ code: 'CS-204', subject: 'Data Structures' }, { code: '', subject: 'Physics' }, { code: 'EE-999', subject: 'Circuits' }], scanWords);
assert.deepEqual([located[0].scan.page, located[0].scan.x, located[0].scan.y, located[0].scan.width], [0, 10, 99, 322], 'the whole line, not the code alone');
assert.equal(located[1].scan.page, 1, 'found by subject word on page 2');
assert.equal(located[2].scan, undefined, 'not found, no box');
console.log('✓ exams located in scans');

// OCR words: small gaps join words, big gaps split cells.
const { joinSpacedWords } = await import('../src/parsers/scanLocate.js');
const ocrWord = (text, x, width, y = 60) => ({ text, x, y, width, height: 20 });
const ocrLine = [ocrWord('CS-204', 21, 93), ocrWord('Data', 125, 55), ocrWord('Structures', 191, 125), ocrWord('18/05/2026', 328, 136), ocrWord('9:00', 474, 52), ocrWord('AM', 535, 40), ocrWord('Hall', 587, 44), ocrWord('B', 643, 15)];
const ocrRead = extractExams(positionedItemsToRows(joinSpacedWords(ocrLine))).records;
assert.deepEqual(ocrRead.map((r) => [r.code, r.subject, r.room]), [['CS-204', 'Data Structures', 'Hall B']]);
const tableLine = [ocrWord('Physics', 20, 80), ocrWord('18/05/2026', 300, 130), ocrWord('Hall', 600, 44), ocrWord('A', 650, 14)];
assert.deepEqual(joinSpacedWords(tableLine).map((p) => p.text), ['Physics', '18/05/2026', 'Hall A'], 'column gaps still split');
console.log('✓ scanned words grouped into phrases');

// Times without AM/PM are read as daytime ("1:00 - 3:00" is the afternoon).
const { inferClassTimes } = await import('../src/utils/timeUtils.js');
assert.deepEqual(inferClassTimes('1:00', '3:00'), { startTime: '1:00 PM', endTime: '3:00 PM' });
assert.deepEqual(inferClassTimes('11:00', '1:00'), { startTime: '11:00 AM', endTime: '1:00 PM' });
assert.deepEqual(inferClassTimes('8:30', '10:30'), { startTime: '8:30 AM', endTime: '10:30 AM' });
assert.deepEqual(inferClassTimes('6:00 P.M.', '9:00 PM'), { startTime: '6:00 PM', endTime: '9:00 PM' }, 'marked times are kept');
assert.deepEqual(inferClassTimes('12:30', '2:00'), { startTime: '12:30 PM', endTime: '2:00 PM' });
assert.deepEqual(inferClassTimes('', ''), { startTime: '', endTime: '' });
fixtures.forEach(({ path }) => {
  const timetable = parseWorkbook(XLSX, readTimetableBook(XLSX, readFileSync(path), path));
  const all = findSections(timetable.rows, timetable.mapping).flatMap((section) => coursesForSection(timetable.rows, timetable.mapping, section));
  assert.equal(all.filter((cls) => !validateClass(cls).valid).length, 0, `${path}: every class is valid`);
  assert.equal(all.filter((cls) => parseTime(cls.startTime) < 7 * 60 || parseTime(cls.endTime) > 22 * 60).length, 0, `${path}: all classes in the daytime`);
});
console.log('✓ unmarked times read as daytime; every real class kept');

// Pasted timetable text, and telling it apart from an exam list.
{
  const { parseTimetableText, looksLikeExams } = await import('../src/parsers/textTimetable.js');
  const read = (text) => parseTimetableText(text).classes.map((item) => `${item.day.slice(0, 3)} ${item.startTime}-${item.endTime} ${item.courseName}|${item.room}|${item.instructor}`);

  assert.deepEqual(read('Monday\n9:00-10:30 Data Structures, Room B-11, Dr. Asim\n11:00-12:30 Calculus II'), [
    'Mon 9:00 AM-10:30 AM Data Structures|B-11|Dr. Asim', 'Mon 11:00 AM-12:30 PM Calculus II||'
  ]);
  assert.deepEqual(read('Tue 2:00 - 3:15 pm  Operating Systems  (Lab 3)'), ['Tue 2:00 PM-3:15 PM Operating Systems|Lab 3|']);
  assert.deepEqual(read('Wed, Fri 8:30-9:50 Linear Algebra'), ['Wed 8:30 AM-9:50 AM Linear Algebra||', 'Fri 8:30 AM-9:50 AM Linear Algebra||']);
  assert.equal(read('Mon-Wed 9am-10am Yoga').length, 3, 'a day range covers every day in it');
  assert.deepEqual(read('Thursday: 12-1 pm Seminar'), ['Thu 12:00 PM-1:00 PM Seminar||']);
  assert.deepEqual(read('1. Friday 14.00-15.30 Physics Lab, Dr. Khan'), ['Fri 2:00 PM-3:30 PM Physics Lab||Dr. Khan']);
  assert.deepEqual(read('Course\tDay\tTime\tRoom\nCalculus II\tMon/Wed\t11:00-12:30\tA-4'), [
    'Mon 11:00 AM-12:30 PM Calculus II|A-4|', 'Wed 11:00 AM-12:30 PM Calculus II|A-4|'
  ]);
  assert.deepEqual(read('Course            Day   Time\nData Structures   Mon   9:00-10:30'), ['Mon 9:00 AM-10:30 AM Data Structures||']);
  // No AM/PM still means daytime.
  assert.deepEqual(read('Mon 2:00-3:30 Databases'), ['Mon 2:00 PM-3:30 PM Databases||']);

  // Junk input never becomes a class.
  assert.deepEqual(read(''), []);
  assert.deepEqual(read('   \n\n'), []);
  assert.deepEqual(read('9:00-10:30 No day given'), []);
  assert.deepEqual(read('Monday\n9-10 bare numbers are not times'), []);
  assert.deepEqual(read('Mon 25:00-26:00 Impossible'), []);
  assert.deepEqual(read('Mon 9:00-10:00'), [], 'a time with no course name is skipped');
  assert.equal(parseTimetableText('hello\nMonday\nno time here').skipped.length, 2);
  assert.equal(read('Mon 9:00-10:00 Algebra\nMonday 9:00-10:00 Algebra').length, 1, 'repeats are dropped');
  assert.equal(read('Monitoring 9:00-10:00 Session').length, 0, 'day names inside words are not days');

  assert.equal(looksLikeExams('Monday 18 May 2026\nCS-204 Data Structures 9:00 AM - 12:00 PM'), true);
  assert.equal(looksLikeExams('20/05/2026 MA-101 Calculus 2:00-5:00 pm'), true);
  assert.equal(looksLikeExams('Monday\n9:00-10:30 Data Structures\nTue 2:00-3:15 pm OS'), false);
  console.log('✓ pasted timetable text');
}
