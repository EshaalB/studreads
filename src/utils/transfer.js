// Formats for share links and backup files. Share links use compact arrays; backups use
// readable objects so the file still makes sense if opened in a text editor.
import { COLOR_THEMES, isHexColor } from './themes.js';

const text = (value, max = 120) => String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
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
  timeFormat: 'string', view: 'string', days: 'string', rowHeight: 'string', blockStyle: 'string'
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

  return { title: text(data.n ?? data.title ?? (data.userName ? `${data.userName}'s timetable` : ''), 60), classes, colors, theme, display };
};

export const readExamPayload = (data) => {
  if (!data || !Array.isArray(data.e)) return [];
  return data.e.map(([subject, code, date, time, room, program, start, end], index) => ({
    id: `shared-${index}-${text(date, 10)}`,
    subject: text(subject),
    code: text(code, 20),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    day: /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '',
    time: text(time, 40),
    room: text(room, 50),
    program: text(program, 80),
    teacher: '',
    start: Number.isFinite(start) ? start : null,
    end: Number.isFinite(end) ? end : null,
    source: 'Shared link'
  })).filter((record) => record.subject && record.date);
};
