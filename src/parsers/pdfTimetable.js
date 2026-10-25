// PDF grid timetables: time slots across the top, days and rooms down the side,
// each class written as a code line then its title (CUST).
// Side labels are usually centred, so each class takes the nearest day and room.
import { STANDARD_MAPPING } from '../utils/timetableSource.js';
import { DATE } from './textTimetable.js';

const SLOT = /^(\d{1,2}[:.]\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}[:.]\d{2})$/i;
const WEEKDAY = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
const CODE = /^([A-Z]{2,}[- ]?\d{3,5}[A-Z]?)\s*(?:\(([^)]+)\))?\s*(.*)$/;
const MAX_LABEL_LENGTH = 10;

const centre = (cell) => (cell.x + (cell.x2 ?? cell.x)) / 2;
const nearest = (marks, y) => marks.reduce((best, mark) => (!best || Math.abs(mark.y - y) < Math.abs(best.y - y) ? mark : best), null);
const capitalise = (day) => day[0].toUpperCase() + day.slice(1).toLowerCase();

export const classesFromPdfRows = (rows) => {
  const headerIndex = rows.findIndex((row) => row.filter((cell) => SLOT.test(cell.text)).length >= 3);
  if (headerIndex < 0) return [];
  const slots = rows[headerIndex].filter((cell) => SLOT.test(cell.text)).map((cell) => {
    const [, start, end] = cell.text.match(SLOT);
    return { centre: centre(cell), left: cell.x, start: start.replace('.', ':'), end: end.replace('.', ':') };
  });
  const labelEdge = Math.min(...slots.map((slot) => slot.left)) - 4;

  const days = [];
  const rooms = [];
  const entries = slots.map(() => []);
  rows.slice(headerIndex + 1).forEach((row) => row.forEach((cell) => {
    const y = cell.y ?? 0;
    if (cell.x2 <= labelEdge || centre(cell) < labelEdge) {
      const day = cell.text.match(WEEKDAY);
      if (day) days.push({ y, day: capitalise(day[1]) });
      const rest = (day ? cell.text.slice(day[0].length) : cell.text).trim();
      if (rest && rest.length <= MAX_LABEL_LENGTH && !/^(day|days|room|rooms|time|venue)$/i.test(rest)) rooms.push({ y, room: rest });
      return;
    }
    const slot = slots.reduce((best, candidate, index) => (Math.abs(candidate.centre - centre(cell)) < Math.abs(slots[best].centre - centre(cell)) ? index : best), 0);
    const code = cell.text.match(CODE);
    const column = entries[slot];
    if (code) column.push({ code: code[1], section: code[2] || '', title: code[3] ? [code[3]] : [], top: y, bottom: y });
    else if (column.length) {
      const entry = column[column.length - 1];
      entry.title.push(cell.text);
      entry.bottom = y;
    }
  }));
  if (!days.length) return [];

  const classes = [];
  entries.forEach((column, index) => column.forEach((entry) => {
    const middle = (entry.top + entry.bottom) / 2;
    const day = nearest(days, middle).day;
    const room = nearest(rooms, middle)?.room || '';
    const courseName = entry.title.join(' ').replace(/\s+/g, ' ').trim() || entry.code;
    const previous = classes.find((cls) => cls.day === day && cls.code === entry.code && cls.section === (entry.section || 'All') && cls.slot === index - 1);
    // Same class in back-to-back slots = one longer class.
    if (previous) { previous.endTime = slots[index].end; previous.slot = index; return; }
    classes.push({ code: entry.code, slot: index, courseName, section: entry.section || 'All', day, startTime: slots[index].start, endTime: slots[index].end, instructor: '', room, credits: '' });
  }));
  return classes.map((cls) => { const copy = { ...cls }; delete copy.code; delete copy.slot; return copy; });
};

// aSc Timetables PDFs (one page per section) draw a line at every cell edge,
// so we use those lines to see which slots each class covers.
// Inside a cell: teacher, title, room.
const SHORT_DAY = /^(mo|tu|we|th|fr|sa|su)[a-z]*\.?$/i;
const DAY_NAMES = { mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday' };
const ROOM_LINE = /^[A-Z][A-Z0-9]*(?:[ -]?[A-Z0-9]+)?$/;
const TEACHER_LINE = /^(mr|mrs|ms|miss|dr|prof|engr|sir|madam|muhammad|syed)\b\.?/i;

const readCell = (lines) => {
  lines.sort((a, b) => a.y - b.y || a.x - b.x);
  // The title is in bigger text than the teacher (above) and room (below).
  const largest = Math.max(...lines.map((line) => line.height || 0));
  const smallest = Math.min(...lines.map((line) => line.height || 0));
  if (smallest > 0 && largest > smallest * 1.3) {
    const isTitle = (line) => line.height >= largest * 0.8;
    const first = lines.findIndex(isTitle);
    const last = lines.length - 1 - [...lines].reverse().findIndex(isTitle);
    const join = (part) => part.map((line) => line.text.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return { courseName: join(lines.slice(first, last + 1)), instructor: join(lines.slice(0, first)), room: join(lines.slice(last + 1)) };
  }
  const texts = lines.map((line) => line.text.trim()).filter(Boolean);
  const room = texts.length > 1 && ROOM_LINE.test(texts[texts.length - 1]) && texts[texts.length - 1].length <= 12 ? texts.pop() : '';
  const instructor = texts.length > 1 && (TEACHER_LINE.test(texts[0]) || texts.length > 2) ? texts.shift() : '';
  return { courseName: texts.join(' ').replace(/\s+/g, ' ').trim(), instructor, room };
};

const classesFromBoxedPage = (rows, rules) => {
  const headerIndex = rows.findIndex((row) => row.filter((cell) => SLOT.test(cell.text)).length >= 3);
  if (headerIndex < 0) return [];
  const slots = rows[headerIndex].filter((cell) => SLOT.test(cell.text)).map((cell) => {
    const [, start, end] = cell.text.match(SLOT);
    return { centre: centre(cell), start: start.replace('.', ':'), end: end.replace('.', ':') };
  }).sort((a, b) => a.centre - b.centre);
  const width = slots.length > 1 ? (slots[slots.length - 1].centre - slots[0].centre) / (slots.length - 1) : 80;
  const gridLeft = slots[0].centre - width / 2;
  const gridRight = slots[slots.length - 1].centre + width / 2;
  const headerY = rows[headerIndex][0].y;

  const bands = [];
  rules.filter((rule) => rule.top > headerY && rule.x > gridLeft + 3 && rule.x < gridRight - 3).forEach((rule) => {
    const band = bands.find((candidate) => Math.abs(candidate.top - rule.top) < 2 && Math.abs(candidate.bottom - rule.bottom) < 2);
    if (band) band.edges.push(rule.x);
    else bands.push({ top: rule.top, bottom: rule.bottom, edges: [rule.x] });
  });
  if (!bands.length) return [];

  const body = rows.slice(headerIndex + 1).flat();
  const titleRow = rows.slice(0, headerIndex).find((row) => row.length === 1 && row[0].text.length <= 30 && !/,/.test(row[0].text) && !/^\d+$/.test(row[0].text));
  const section = titleRow?.[0].text || 'All';
  const classes = [];
  bands.forEach((band) => {
    const inBand = body.filter((cell) => cell.y >= band.top && cell.y <= band.bottom);
    const label = inBand.find((cell) => centre(cell) < gridLeft && SHORT_DAY.test(cell.text));
    if (!label) return;
    const day = DAY_NAMES[label.text.slice(0, 2).toLowerCase()];
    const edges = [gridLeft, ...band.edges.sort((a, b) => a - b), gridRight];
    edges.slice(1).forEach((right, index) => {
      const left = edges[index];
      const lines = inBand.filter((cell) => centre(cell) > left && centre(cell) < right);
      const covered = slots.filter((slot) => slot.centre > left && slot.centre < right);
      if (!lines.length || !covered.length) return;
      const cell = readCell(lines);
      if (!cell.courseName) return;
      classes.push({ ...cell, section, day, startTime: covered[0].start, endTime: covered[covered.length - 1].end, credits: '' });
    });
  });
  return classes;
};

export const timetableFromPdf = ({ rows, lines = [] }) => {
  // Lots of different dates means it's an exam date sheet, not a weekly timetable.
  const dates = new Set(rows.flat().map((cell) => cell.text.match(DATE)?.[0]).filter(Boolean));
  if (dates.size >= 3) return null;
  const pages = [...new Set(rows.map((row) => row[0].page ?? 0))];
  const boxed = pages.flatMap((page) => classesFromBoxedPage(rows.filter((row) => (row[0].page ?? 0) === page), lines.filter((line) => line.page === page)));
  const classes = boxed.length ? boxed : classesFromPdfRows(rows);
  return classes.length ? { sheetName: 'PDF', kind: 'grid', rows: classes, mapping: STANDARD_MAPPING } : null;
};
