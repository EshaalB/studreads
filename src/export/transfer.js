// Formats for share links and backup files. Share links use compact arrays; backups use
// readable objects so the file still makes sense if opened in a text editor.
import { isIsoDate, weekdayOf } from '../utils/dates.js';
import { COLOR_THEMES, isHexColor } from '../utils/themes.js';
import { TIMETABLE_FIELDS } from '../utils/timetableSource.js';
import { cleanText } from '../utils/validation.js';

const text = (value, max = 120) => cleanText(value, max);
const usedColors = (classes, colorMap = {}) => Object.fromEntries(
  [...new Set(classes.map((item) => item.name))].filter((name) => isHexColor(colorMap[name])).map((name) => [name, colorMap[name]])
);

const examRows = (records = []) => records.map((record) => [record.subject, record.code, record.date, record.time, record.room, record.program, record.start, record.end]);

export const buildTimetableShare = ({ classes, title, colorMap, theme, exams = [] }) => ({
  v: 1,
  e: exams.length ? examRows(exams) : undefined,
  n: title || undefined,
  p: theme,
  k: usedColors(classes, colorMap),
  c: classes.map((item) => [item.name, item.day, item.startTime, item.endTime, item.room || '', item.teacher || '', item.credits || ''])
});

export const buildTimetableBackup = ({ classes, title, colorMap, theme, display, exams = [] }) => ({
  app: 'studreads',
  kind: 'timetable',
  version: 1,
  exportedAt: new Date().toISOString(),
  title,
  theme,
  display,
  colors: usedColors(classes, colorMap),
  e: examRows(exams),
  classes: classes.map((item) => ({
    name: item.name, day: item.day, startTime: item.startTime, endTime: item.endTime,
    room: item.room || '', teacher: item.teacher || '', credits: item.credits || ''
  }))
});

const DISPLAY_KEYS = {
  showTeacher: 'boolean', showRoom: 'boolean', showCredits: 'boolean', showSection: 'boolean',
  timeFormat: 'string', view: 'string', rowHeight: 'string', blockStyle: 'string'
};

// Accepts a share payload, a backup file or a link from the previous format.
export const readTimetablePayload = (data) => {
  if (!data || typeof data !== 'object') return null;
  let classes = [];
  if (Array.isArray(data.c)) {
    classes = data.c.map(([name, day, startTime, endTime, room, teacher, credits]) => ({ name, day, startTime, endTime, room, teacher, credits }));
  } else if (Array.isArray(data.classes)) {
    classes = data.classes;
  }
  classes = classes.map((item) => ({
    name: text(item.name ?? item.courseName, 80),
    day: text(item.day, 20),
    startTime: text(item.startTime, 20),
    endTime: text(item.endTime, 20),
    room: text(item.room, 50),
    teacher: text(item.teacher ?? item.instructor, 80),
    credits: text(item.credits, 10)
  })).filter((item) => item.name && item.day);
  if (classes.length === 0) return null;

  const colors = Object.fromEntries(Object.entries(data.k || data.colors || {})
    .filter(([name, color]) => typeof name === 'string' && isHexColor(color))
    .map(([name, color]) => [text(name, 80), color]));
  const theme = COLOR_THEMES.some((item) => item.id === (data.p ?? data.theme)) ? (data.p ?? data.theme) : null;
  const display = Object.fromEntries(Object.entries(data.display || {})
    .filter(([key, value]) => DISPLAY_KEYS[key] && typeof value === DISPLAY_KEYS[key]));

  return { title: text(data.n ?? data.title, 60), classes, colors, theme, display };
};

// A link for classmates carries the uploaded files rather than one person's picks: the
// timetable cut down to its mapped columns, and every exam in the date sheet.
export const buildClassmateShare = ({ title, source, exams = [], examFile }) => ({
  v: 1,
  n: title || undefined,
  t: source ? { f: source.name, m: source.mapping, h: source.columns, r: source.rows } : undefined,
  e: exams.length ? examRows(exams) : undefined,
  x: exams.length ? examFile : undefined
});

export const readClassmatePayload = (data) => {
  if (!data || typeof data !== 'object') return null;
  let source = null;
  const table = data.t;
  if (table && Array.isArray(table.h) && Array.isArray(table.r) && table.m && typeof table.m === 'object') {
    const columns = table.h.map((column) => text(column, 80));
    const mapping = Object.fromEntries(TIMETABLE_FIELDS.filter((key) => columns.includes(table.m[key])).map((key) => [key, table.m[key]]));
    if (table.m._combinedTime) mapping._combinedTime = text(table.m._combinedTime, 80);
    const rows = table.r.filter(Array.isArray).map((row) => Object.fromEntries(columns.map((column, index) => [column, text(row[index], 120)])));
    if (mapping.courseName && mapping.day && rows.length) source = { name: text(table.f, 120) || 'Shared timetable', mapping, rows };
  }
  const exams = readExamPayload(data);
  if (!source && !exams.length) return null;
  return { title: text(data.n, 60), source, exams, examFile: text(data.x, 120) || 'Shared date sheet' };
};

export const readExamPayload = (data) => {
  if (!data || !Array.isArray(data.e)) return [];
  return data.e.map(([subject, code, date, time, room, program, start, end], index) => ({
    id: `shared-${index}-${text(date, 10)}`,
    subject: text(subject),
    code: text(code, 20),
    date: isIsoDate(date) ? date : '',
    day: isIsoDate(date) ? weekdayOf(date, 'short') : '',
    time: text(time, 40),
    room: text(room, 50),
    program: text(program, 80),
    teacher: '',
    start: Number.isFinite(start) ? start : null,
    end: Number.isFinite(end) ? end : null,
    source: 'Shared link'
  })).filter((record) => record.subject && record.date);
};
