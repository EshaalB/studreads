import { DAYS } from '../utils/constants.js';
import { parseTime } from '../utils/timeUtils.js';

export const fileSlug = (name, fallback) => (String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback);

export const downloadFile = (fileName, content, type) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const pad = (value) => String(value).padStart(2, '0');
const icsText = (value) => String(value || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const icsDate = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const icsTime = (minutes) => `${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const calendar = (events, name) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//StudReads//Planner//EN',
  'CALSCALE:GREGORIAN',
  `X-WR-CALNAME:${icsText(name)}`,
  ...events,
  'END:VCALENDAR',
  ''
].join('\r\n');

// Weekly classes repeat from the next occurrence of each weekday.
export const classesToIcs = (classes, { title = 'Timetable', weeks = 16 } = {}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = classes.map((item, index) => {
    const dayIndex = DAYS.indexOf(item.day);
    const start = parseTime(item.startTime);
    const end = parseTime(item.endTime);
    if (dayIndex < 0 || start === null || end === null) return '';
    const first = new Date(today);
    const weekday = (dayIndex + 1) % 7; // DAYS starts on Monday, getDay() on Sunday
    first.setDate(today.getDate() + ((weekday - today.getDay() + 7) % 7));
    return [
      'BEGIN:VEVENT',
      `UID:class-${index}-${icsDate(first)}-${icsTime(start)}@studreads`,
      `DTSTAMP:${stamp()}`,
      `DTSTART:${icsDate(first)}T${icsTime(start)}`,
      `DTEND:${icsDate(first)}T${icsTime(end)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,
      `SUMMARY:${icsText(item.name)}`,
      item.room ? `LOCATION:${icsText(item.room)}` : '',
      item.teacher ? `DESCRIPTION:${icsText(item.teacher)}` : '',
      'END:VEVENT'
    ].filter(Boolean).join('\r\n');
  }).filter(Boolean);
  return calendar(events, title);
};

const reminder = (trigger, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(text)}`, `TRIGGER:${trigger}`, 'END:VALARM'];

// Each exam carries its own reminders: the day before, and two hours before when the time is known.
export const examsToIcs = (records) => calendar(records.map((record) => {
  const date = record.date.replaceAll('-', '');
  const timed = record.start !== null && record.start !== undefined;
  const timing = timed
    ? [`DTSTART:${date}T${icsTime(record.start)}`, `DTEND:${date}T${icsTime(record.end ?? Math.min(record.start + 180, 23 * 60 + 59))}`]
    : [`DTSTART;VALUE=DATE:${date}`];
  return [
    'BEGIN:VEVENT',
    `UID:${icsText(record.id)}@studreads`,
    `DTSTAMP:${stamp()}`,
    ...timing,
    `SUMMARY:${icsText(`Exam: ${record.code ? `${record.code} ` : ''}${record.subject !== record.code ? record.subject : ''}`.trim())}`,
    record.room ? `LOCATION:${icsText(record.room)}` : '',
    record.program ? `DESCRIPTION:${icsText(record.program)}` : '',
    ...reminder('-P1D', `Exam tomorrow: ${record.subject}`),
    ...(timed ? reminder('-PT2H', `Exam in 2 hours: ${record.subject}`) : []),
    'END:VEVENT'
  ].filter(Boolean).join('\r\n');
}), 'Exams');
