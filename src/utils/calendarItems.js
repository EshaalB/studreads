// Turns classes and exams into the shape used by TimeGrid and AgendaList.
import { DAYS } from './constants.js';
import { formatDate } from './dates.js';
import { displayTimeRange, parseTime } from './timeUtils.js';

const DATE_KEY = 'date:';

// Column keys are a weekday ("Monday") or a date ("date:2026-11-02").
export const dateFromColumn = (key) => (key.startsWith(DATE_KEY) ? key.slice(DATE_KEY.length) : '');

/**
 * Anything with a date (exams) gets a column per date, in date order. Weekly classes keep
 * weekday columns after them: Monday to Friday plus any weekend day in use, or only the
 * days with classes when dates are also shown, so no empty columns are added.
 */
export const plannerColumns = (items) => {
  const dates = [...new Set(items.filter((item) => item.date).map((item) => item.date))].sort();
  const weekly = items.filter((item) => !item.date);
  const dateColumns = dates.map((date) => ({
    key: `${DATE_KEY}${date}`,
    label: formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }),
    short: formatDate(date, { day: 'numeric', month: 'short' }),
    groupLabel: formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
  }));
  const dayColumns = DAYS
    .filter((day, index) => weekly.some((item) => item.column === day) || (!dates.length && index < 5))
    .map((day, index) => ({
      key: day,
      label: dates.length ? `Every ${day.slice(0, 3)}` : day,
      short: day.slice(0, 3),
      groupLabel: dates.length ? `Every ${day}` : day,
      divided: dates.length > 0 && index === 0
    }));
  return [...dateColumns, ...dayColumns];
};

export const classToItem = (cls, { getColor, displayOptions, conflicts }) => ({
  id: cls.id,
  column: cls.day,
  start: parseTime(cls.startTime),
  end: parseTime(cls.endTime),
  kind: 'class',
  title: cls.name,
  time: displayTimeRange(cls.startTime, cls.endTime, displayOptions.timeFormat),
  details: [
    displayOptions.showRoom && cls.room,
    displayOptions.showTeacher && cls.teacher,
    displayOptions.showCredits && cls.credits && `${cls.credits} cr`,
    displayOptions.showSection && cls.section
  ].filter(Boolean),
  color: getColor(cls.name),
  clash: conflicts.has(cls.id)
});

export const examToItem = (exam, { getColor, clashes }) => ({
  id: exam.id,
  kind: 'exam',
  column: `${DATE_KEY}${exam.date}`,
  date: exam.date,
  start: exam.start ?? null,
  // Exams without an end time are drawn as three hours long.
  end: exam.start === null || exam.start === undefined ? null : exam.end ?? exam.start + 180,
  badge: 'Exam',
  title: exam.subject,
  time: exam.time,
  details: [exam.code !== exam.subject && exam.code, exam.room].filter(Boolean),
  color: getColor(exam.subject),
  clash: clashes.has(exam.id)
});

export const groupByColumn = (columns, items) => columns
  .map((column) => ({
    key: column.key,
    label: column.groupLabel || column.label,
    items: items.filter((item) => item.column === column.key).sort((a, b) => (a.start ?? -1) - (b.start ?? -1))
  }))
  .filter((group) => group.items.length > 0);
