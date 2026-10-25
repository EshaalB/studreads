// One course per row, one column per weekday (UMT, UConn).
// A day cell has the time ("3:30-4:45(CB2-502)") or a Y flag with separate start/end columns.
import { sanitizeString } from '../utils/validation.js';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MIN_DAY_COLUMNS = 3;
// "Monday", "Mon", "Tues", "Thurs"...
const dayOf = (heading) => {
  const value = text(heading).toLowerCase().replace(/[.:]/g, '');
  return WEEKDAYS.find((day) => value.includes(day.toLowerCase()) || (value.length >= 3 && day.toLowerCase().startsWith(value)));
};
// For a room column with no heading: cells like "3L-09" or "Field".
const ROOM_VALUE = /^([A-Z]*\d*[A-Z]*\s?-\s?\d+[A-Z]?|field|lab|online)(\s*\/.*)?$/i;
const HEADER_SEARCH_ROWS = 30;

const COLUMN_HEADERS = {
  code: /course\s*code|subject_cd|^\s*code\s*$|paper\s*code/i,
  catalog: /catalog/i,
  title: /course\s*tit+le|descr\b|course\s*name|^\s*title\s*$|subject\s*name|^\s*course\s*$/i,
  section: /section|^\s*sec\s*$/i,
  instructor: /resource\s*person|instructor|teacher|faculty|pers_name|lecturer/i,
  room: /room|facility|venue|location/i,
  start: /time_start|start\s*time|^\s*start\s*$|^\s*from\s*$/i,
  end: /time_end|end\s*time|^\s*end\s*$|^\s*to\s*$/i,
  credits: /cr\.?\s*hrs?|credit|units_min/i,
  group: /subject_ldesc|department|^\s*program/i
};

const TIME_RANGE = /(\d{1,2}[:.]\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?\s*(?:-|–|to)\s*(\d{1,2}[:.]\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?/gi;
// UConn uses 12:00 AM - 12:00 PM for courses with no set time.
const PLACEHOLDER = /^12:00 AM$/i;
const YES = /^(y|yes|x|✓|✔|true|1)$/i;
// "Bacth-F2024266001-050 (1300) 1st Semester", "Batch 21 (S2024) 2nd Semester"
const GROUP_LABEL = /\b(batch|bacth|semester|program|programme|year|intake)\b/i;

const text = (value) => sanitizeString(String(value ?? '').replace(/\s+/g, ' '));
const clock = (time, period) => `${time.replace('.', ':')}${period ? ` ${period.replace(/[.\s]/g, '').toUpperCase()}` : ''}`;
// "03:30:00 PM" -> "03:30 PM"
const withoutSeconds = (value) => text(value).replace(/^(\d{1,2}:\d{2}):\d{2}/, '$1');

const findHeader = (matrix) => {
  for (let index = 0; index < Math.min(matrix.length, HEADER_SEARCH_ROWS); index += 1) {
    const row = matrix[index] || [];
    const days = row.map((cell, column) => ({ column, day: dayOf(cell) }))
      .filter((entry) => entry.day);
    if (days.length >= MIN_DAY_COLUMNS) return { index, row, days };
  }
  return null;
};

const findColumns = (row, dayColumns) => {
  const taken = new Set(dayColumns.map((entry) => entry.column));
  const columns = {};
  Object.entries(COLUMN_HEADERS).forEach(([field, pattern]) => {
    const column = row.findIndex((cell, index) => !taken.has(index) && pattern.test(text(cell)));
    if (column >= 0) { columns[field] = column; taken.add(column); }
  });
  return columns;
};

// Time ranges in a day cell, with the room if one follows.
const meetingsIn = (cell) => {
  const value = text(cell);
  const ranges = [...value.matchAll(TIME_RANGE)];
  return ranges.map((match, index) => {
    const after = value.slice(match.index + match[0].length, ranges[index + 1]?.index ?? value.length);
    return { start: clock(match[1], match[2]), end: clock(match[3], match[4]), room: text(after.replace(/[()[\],;/&]/g, ' ')) };
  });
};

export const parseWeekdayTable = (matrix, { sheetName = '' } = {}) => {
  if (!Array.isArray(matrix)) return [];
  const header = findHeader(matrix);
  if (!header) return [];
  const columns = findColumns(header.row, header.days);
  if (columns.room === undefined) {
    const body = matrix.slice(header.index + 1, header.index + 41);
    const room = header.row.findIndex((heading, index) => {
      if (text(heading) || header.days.some((entry) => entry.column === index)) return false;
      const values = body.map((row) => text(row?.[index])).filter(Boolean);
      return values.length >= 3 && values.filter((value) => ROOM_VALUE.test(value)).length >= values.length * 0.6;
    });
    if (room >= 0) columns.room = room;
  }
  if (columns.code === undefined && columns.title === undefined) return [];
  const cell = (row, field) => (columns[field] === undefined ? '' : text(row[columns[field]]));

  const classes = [];
  let label = '';
  matrix.slice(header.index + 1).forEach((row) => {
    if (!Array.isArray(row)) return;
    const dayCells = header.days.map(({ column, day }) => ({ day, value: row[column] }));
    const filledDays = dayCells.filter(({ value }) => text(value));
    const rowText = row.map(text).filter(Boolean);
    if (!filledDays.length && rowText.length && rowText.length <= 4 && GROUP_LABEL.test(rowText.join(' '))) {
      label = rowText.find((value) => GROUP_LABEL.test(value)) || rowText[0];
      return;
    }

    const code = [cell(row, 'code'), cell(row, 'catalog')].filter(Boolean).join(' ');
    const title = cell(row, 'title');
    const name = title && code && !title.toLowerCase().includes(code.toLowerCase()) ? `${code} ${title}` : (title || code);
    if (!name || !filledDays.length) return;

    const section = cell(row, 'section');
    const group = cell(row, 'group');
    // With a department column, group by department and keep the section in the name.
    // Otherwise group by batch label + section.
    const sectionName = group || [label, section].filter(Boolean).join(' · ') || sheetName || 'All';
    const courseName = group && section ? `${name} (${section})` : name;
    const start = withoutSeconds(cell(row, 'start'));
    const end = withoutSeconds(cell(row, 'end'));

    filledDays.forEach(({ day, value }) => {
      const meetings = YES.test(text(value)) ? (/\d/.test(start) && /\d/.test(end) && !PLACEHOLDER.test(start) ? [{ start, end, room: '' }] : []) : meetingsIn(value);
      meetings.forEach((meeting) => classes.push({
        courseName,
        section: sectionName,
        day,
        startTime: meeting.start,
        endTime: meeting.end,
        instructor: cell(row, 'instructor'),
        room: meeting.room || cell(row, 'room'),
        credits: cell(row, 'credits')
      }));
    });
  });
  return classes;
};
