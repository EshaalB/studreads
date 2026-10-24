// Turns classes and exams into the shape used by TimeGrid and AgendaList.
import { DAYS } from './constants.js';
import { displayTimeRange, parseTime } from './timeUtils.js';

// days: 'auto' shows Monday to Friday plus any weekend day in use,
// 'six' Monday to Saturday, 'all' the whole week. items: anything with a `column` day.
export const weekColumns = (items, days = 'auto') => DAYS
  .filter((day, index) => days === 'all' || index < 5 || (days === 'six' && index === 5) || items.some((item) => item.column === day))
  .map((day) => ({ key: day, label: day, short: day.slice(0, 3) }));

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

export const groupByColumn = (columns, items) => columns
  .map((column) => ({
    key: column.key,
    label: column.groupLabel || column.label,
    items: items.filter((item) => item.column === column.key).sort((a, b) => (a.start ?? -1) - (b.start ?? -1) || (a.date || '').localeCompare(b.date || ''))
  }))
  .filter((group) => group.items.length > 0);

const dateLabel = (isoDate, options) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

const weekdayOf = (isoDate) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

// Exams sit on the same week grid as classes, in the column for their weekday, marked
// with their date so exams from different weeks stay distinguishable.
export const examToItem = (exam, { getColor, clashes }) => ({
  id: exam.id,
  kind: 'exam',
  column: weekdayOf(exam.date),
  date: exam.date,
  start: exam.start ?? null,
  // Exams without an end time are drawn as three hours long.
  end: exam.start === null || exam.start === undefined ? null : exam.end ?? exam.start + 180,
  badge: `Exam · ${dateLabel(exam.date, { day: 'numeric', month: 'short' })}`,
  title: exam.subject,
  time: exam.time,
  details: [exam.code !== exam.subject && exam.code, exam.room].filter(Boolean),
  color: getColor(exam.subject),
  clash: clashes.has(exam.id)
});
