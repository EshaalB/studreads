// Turns classes and exams into the shape used by TimeGrid and AgendaList.
import { DAYS } from './constants.js';
import { displayTimeRange, parseTime } from './timeUtils.js';

// Monday to Friday always; weekends only when something is on them.
export const weekColumns = (classes) => DAYS
  .filter((day, index) => index < 5 || classes.some((cls) => cls.day === day))
  .map((day) => ({ key: day, label: day, short: day.slice(0, 3) }));

export const classToItem = (cls, { getColor, displayOptions, conflicts }) => ({
  id: cls.id,
  column: cls.day,
  start: parseTime(cls.startTime),
  end: parseTime(cls.endTime),
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
  .map((column) => ({ key: column.key, label: column.groupLabel || column.label, items: items.filter((item) => item.column === column.key) }))
  .filter((group) => group.items.length > 0);

const dateLabel = (isoDate, options) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

export const examColumns = (exams) => [...new Set(exams.map((exam) => exam.date))].sort().map((date) => ({
  key: date,
  label: dateLabel(date, { weekday: 'short', day: 'numeric', month: 'short' }),
  short: dateLabel(date, { day: 'numeric', month: 'short' }),
  groupLabel: dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}));

export const examToItem = (exam, { getColor, clashes }) => ({
  id: exam.id,
  column: exam.date,
  start: exam.start ?? null,
  // Exams without an end time are drawn as three hours long.
  end: exam.start === null || exam.start === undefined ? null : exam.end ?? exam.start + 180,
  title: exam.subject,
  time: exam.time,
  details: [exam.code !== exam.subject && exam.code, exam.room].filter(Boolean),
  color: getColor(exam.subject),
  clash: clashes.has(exam.id)
});
