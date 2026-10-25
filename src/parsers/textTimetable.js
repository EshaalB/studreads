// Reads a timetable typed or pasted as text. Each line with a time is a class
// on the days it names, or the day heading above it:
//   Monday                                   Tue 2:00 - 3:15 pm Operating Systems (Lab 3)
//   9:00-10:30 Data Structures, B-11, Dr. Asim   Wed, Fri 8:30-9:50 Linear Algebra
// Tables with Day and Time columns work too.
// Text with dates is an exam list instead (see looksLikeExams).
import { inferClassTimes } from '../utils/timeUtils.js';

const MAX_TEXT_LENGTH = 200_000;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_WORD = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b\.?/gi;
// "Mon-Fri", "Monday to Wednesday"
const DAY_RANGE = new RegExp(`${DAY_WORD.source}\\s*(?:-|–|—|to|till|through)\\s*${DAY_WORD.source}`, 'i');
const CLOCK = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?`;
const TIME_RANGE = new RegExp(`${CLOCK}\\s*(?:-|–|—|to|till|until)\\s*${CLOCK}`, 'i');
const DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/i;
const TEACHER = /^(mr|mrs|ms|miss|dr|prof|professor|engr|sir|madam|instructor|teacher)\b\.?/i;
const ROOM = /^(room|venue|lab|hall|auditorium)\b|^#|^[A-Z]{1,6}\s?-?\s?\d{1,4}[A-Z]?$/i;
const HEADERS = {
  day: /^days?$/i,
  time: /^(time|timing|slot|hours?)$/i,
  start: /^(start|from|begins?)(\s*time)?$/i,
  end: /^(end|to|until|finish(es)?)(\s*time)?$/i,
  course: /^(course|subject|class|module|title|course\s*(name|title)|subject\s*name)$/i,
  room: /^(room|venue|location|hall)$/i,
  teacher: /^(teacher|instructor|lecturer|faculty|professor|tutor)$/i
};

const dayOf = (word) => DAYS.find((day) => day.toLowerCase().startsWith(word.toLowerCase().replace('.', '').slice(0, 3)));

// Days named in the text. "Mon-Wed" gives three days.
const daysIn = (text) => {
  const range = text.match(DAY_RANGE);
  if (range) {
    const [from, to] = [dayOf(range[1]), dayOf(range[2])].map((day) => DAYS.indexOf(day));
    if (from >= 0 && to >= from) return DAYS.slice(from, to + 1);
  }
  return [...new Set([...text.matchAll(DAY_WORD)].map((match) => dayOf(match[1])).filter(Boolean))];
};

const clock = (hours, minutes, period) => {
  const value = `${Number(hours)}:${minutes || '00'}`;
  return period ? `${value} ${period.replace(/[.\s]/g, '').toUpperCase()}` : value;
};

// "9-10:30", "2:00 - 3:15 pm" (the pm covers both), "9am to 11am", "14.00-15.30"
const readTime = (text) => {
  const match = text.match(TIME_RANGE);
  if (!match) return null;
  const [, h1, m1, p1, h2, m2, p2] = match;
  if (Number(h1) > 23 || Number(h2) > 23 || Number(m1 || 0) > 59 || Number(m2 || 0) > 59) return null;
  // "9-10" alone isn't a time; it needs minutes or am/pm.
  if (!m1 && !m2 && !p1 && !p2) return null;
  const startPeriod = p1 || (p2 && Number(h1) <= Number(h2) && Number(h2) !== 12 ? p2 : '');
  const times = inferClassTimes(clock(h1, m1, startPeriod), clock(h2, m2, p2));
  return { ...times, matched: match[0] };
};

// After removing day and time: course, then room and teacher.
const readDetails = (text) => {
  const parts = text
    .split(/\s*(?:[,;|•·]|\s[-–—]\s|\(|\)|\t|\s{2,})\s*/)
    .map((part) => part.replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim())
    .filter((part) => part && !/^(at|in|on|and|&)$/i.test(part));
  const details = { courseName: '', room: '', instructor: '' };
  parts.forEach((part) => {
    if (!details.instructor && TEACHER.test(part)) details.instructor = part;
    else if (!details.courseName) details.courseName = part;
    else if (!details.room && (ROOM.test(part) || (/\d/.test(part) && part.length <= 12))) details.room = part.replace(/^(room|venue)\s*[:#.-]*\s*/i, '');
    else if (!details.instructor) details.instructor = part;
    else details.courseName = `${details.courseName} ${part}`;
  });
  return details;
};

const cellsOf = (line) => line.split(/\t|\s*\|\s*|\s{3,}/).map((cell) => cell.trim());

// Table with a header row that has Day and Time (or Start) columns.
const readTable = (lines) => {
  const headerIndex = lines.findIndex((line) => {
    const cells = cellsOf(line);
    return cells.some((cell) => HEADERS.day.test(cell)) && cells.some((cell) => HEADERS.time.test(cell) || HEADERS.start.test(cell));
  });
  if (headerIndex < 0) return null;
  const header = cellsOf(lines[headerIndex]);
  const column = (field) => header.findIndex((cell) => HEADERS[field].test(cell));
  const at = (cells, field) => (column(field) >= 0 ? cells[column(field)] || '' : '');
  const classes = [];
  const skipped = [];
  lines.slice(headerIndex + 1).forEach((line) => {
    const cells = cellsOf(line);
    const time = readTime(at(cells, 'time') || `${at(cells, 'start')} - ${at(cells, 'end')}`);
    const days = daysIn(at(cells, 'day'));
    const courseName = at(cells, 'course') || cells.find((cell, index) => cell && ![column('day'), column('time'), column('start'), column('end'), column('room'), column('teacher')].includes(index)) || '';
    if (!time || !days.length || !courseName) { skipped.push(line); return; }
    days.forEach((day) => classes.push({ courseName, day, startTime: time.startTime, endTime: time.endTime, room: at(cells, 'room'), instructor: at(cells, 'teacher') }));
  });
  return { classes, skipped };
};

export const parseTimetableText = (input) => {
  const text = String(input ?? '').slice(0, MAX_TEXT_LENGTH).replace(/\r\n?/g, '\n');
  const lines = text.split('\n').map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trimEnd()).filter((line) => line.trim());
  const table = readTable(lines);
  if (table && table.classes.length) return finish(table);

  const classes = [];
  const skipped = [];
  let headingDays = [];
  lines.forEach((line) => {
    const time = readTime(line);
    const days = daysIn(line);
    if (!time) {
      // A line that is only days ("Monday", "Tue & Thu:") is a heading.
      const rest = line.replace(DAY_RANGE, ' ').replace(DAY_WORD, ' ').replace(/[\s,&/:;+-]|and/gi, '');
      if (days.length && !rest) headingDays = days;
      else skipped.push(line.trim());
      return;
    }
    const lineDays = days.length ? days : headingDays;
    const rest = line.replace(time.matched, ' ').replace(DAY_RANGE, ' ').replace(DAY_WORD, ' ');
    const details = readDetails(rest);
    if (!lineDays.length || !details.courseName) { skipped.push(line.trim()); return; }
    lineDays.forEach((day) => classes.push({ ...details, day, startTime: time.startTime, endTime: time.endTime }));
  });
  return finish({ classes, skipped });
};

// Remove repeated classes.
const finish = ({ classes, skipped }) => {
  const seen = new Set();
  const kept = classes.filter((item) => {
    const key = [item.courseName.toLowerCase(), item.day, item.startTime].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { classes: kept.map((item) => ({ section: 'Pasted', credits: '', room: '', instructor: '', ...item })), skipped };
};

// It's an exam list if lots of lines have dates.
export const looksLikeExams = (input, timetable = parseTimetableText(input)) => {
  const lines = String(input ?? '').split(/\r?\n/).filter((line) => line.trim());
  const dated = lines.filter((line) => DATE.test(line)).length;
  return dated > 0 && dated >= timetable.classes.length / 2;
};
