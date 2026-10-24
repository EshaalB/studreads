import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
assert.equal(workbookExams.source, 'Final exams');

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

// Exam sheets in the shapes universities actually publish.
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

// PDF text: a header on page one, a continuation table with different column widths on page two.
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

// Real Excel date serials with a date cell merged across two rows.
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

// Share links and backups reopen as editable classes.
const shared = readTimetablePayload(buildTimetableShare({
  classes: [{ name: 'Linear Algebra', day: 'Tuesday', startTime: '8:30 AM', endTime: '9:50 AM', room: 'Room 104', teacher: '', credits: '3' }],
  title: 'Spring', colorMap: { 'Linear Algebra': '#123456', Other: 'red' }, theme: 'earth'
}));
assert.deepEqual(shared.colors, { 'Linear Algebra': '#123456' });
assert.equal(shared.theme, 'earth');
const reopened = importClasses(shared.classes);
assert.equal(reopened.length, 1);
assert.ok(reopened[0].id);
assert.equal(importClasses([{ name: 'No day', day: 'Someday', startTime: '9:00', endTime: '10:00' }]).length, 0);
console.log('✓ share links and backups');

// Sheets that print only course codes in the schedule and the titles elsewhere.
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

// Times written loosely in a time column, or defined once for the whole sheet.
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

// Classes picked with the previous version of the app carry over.
const demoMapping = { courseName: 'courseName', section: 'section', day: 'day', startTime: 'startTime', endTime: 'endTime', instructor: 'instructor', room: 'room' };
const { DEMO_TIMETABLE_DATA } = await import('../src/utils/demoData.js');
const { coursesForSection, legacySelectionToClasses } = await import('../src/utils/timetableSource.js');
const sectionCourses = coursesForSection(DEMO_TIMETABLE_DATA, demoMapping, 'BSCS-3A');
const carried = legacySelectionToClasses(DEMO_TIMETABLE_DATA, demoMapping, { section: 'BSCS-3A', selectedIds: [sectionCourses[0].id] });
assert.ok(carried.length >= 1 && carried.every((cls) => cls.name === sectionCourses[0].name));
console.log('✓ classes and older saved timetables');

// Slot columns: headers that are themselves times, each paired with a "Code" column
// (the layout of a real university mid-term date sheet).
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

// The same idea without code columns, and with dates as the slot headers.
const slotsNoCodes = extractExams([['Course Code', 'Mon 18/05/2026', 'Tue 19/05/2026'], ['CS-204', 'Data Structures', ''], ['MA-201', '', 'Linear Algebra']]);
assert.deepEqual(slotsNoCodes.records.map((r) => [r.date, r.subject]), [['2026-05-18', 'Data Structures'], ['2026-05-19', 'Linear Algebra']]);
const slotsLabelled = extractExams([['Date', 'Code', 'Slot 1 (9:00-12:00)', 'Code', 'Slot 2 (2:00-5:00)'], ['18/05/2026', 'CS-204', 'Data Structures', 'MA-201', 'Linear Algebra']]);
assert.deepEqual(slotsLabelled.records.map((r) => [r.code, r.time]), [['CS-204', '9:00 AM – 12:00 PM'], ['MA-201', '2:00 PM – 5:00 PM']]);
console.log('✓ date sheets with time-slot columns');

// A remembered time does not leak into the next day.
const nextDay = extractExams(textToRows(`Tuesday, 3 November 2026
SE-301 Software Engineering   2:00 PM - 5:00 PM   Lab 4
Wednesday, 4 November 2026
HU-110 Pakistan Studies   Hall A`));
assert.deepEqual(nextDay.records.map((r) => [r.code, r.time]), [['SE-301', '2:00 PM – 5:00 PM'], ['HU-110', '']]);
console.log('✓ times stay on their own date');

// Saved data reads back in the right shape (a saved list must survive a reload).
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

// The FAQ in the app, the structured data and the no-JavaScript page say the same thing.
const indexHtml = readFileSync('./index.html', 'utf8');
const { FAQ } = await import('../src/content/faq.js');
const graph = JSON.parse(indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const faqSchema = graph.find((node) => node['@type'] === 'FAQPage').mainEntity;
assert.deepEqual(faqSchema.map((q) => [q.name, q.acceptedAnswer.text]), FAQ.map((item) => [item.question, item.answer]));
FAQ.forEach((item) => assert.ok(indexHtml.includes(`<h3>${item.question}</h3>`) && indexHtml.includes(item.answer), `fallback page includes "${item.question}"`));
assert.equal((indexHtml.match(/<h1[\s>]/g) || []).length, 1);
['llms.txt', 'robots.txt', 'sitemap.xml', 'privacy.html', 'og-image.png', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png'].forEach((file) => assert.ok(readFileSync(`./public/${file}`).length > 0, file));
console.log('✓ SEO files and FAQ in step');

// Messy input: scanner misreads, letter-spaced PDF text, full-width digits, ligatures,
// "hrs" times in free text, and rows that come before their (merged) date cell.
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

// A revised date sheet: picked exams are found again and their changes listed.
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

// A classmate link carries the uploaded timetable and every exam in the sheet.
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

// Dated items come first in date order; weekly classes follow by weekday.
const { plannerColumns } = await import('../src/utils/calendarItems.js');
assert.deepEqual(plannerColumns([{ column: 'Friday' }]).map((c) => c.key), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
assert.deepEqual(plannerColumns([{ column: 'Friday' }, { date: '2026-12-09' }, { date: '2026-12-02' }]).map((c) => c.key), ['date:2026-12-02', 'date:2026-12-09', 'Friday']);
console.log('✓ planner columns in date order');
