// A class is one weekly meeting: { id, name, day, startTime, endTime, room, teacher,
// credits, section, alternate, alternateFrom, preview }.
// alternate = every other week from alternateFrom. preview = tried out, not kept yet.
import { DAYS } from './constants.js';
import { parseTime } from './timeUtils.js';
import { isIsoDate } from './dates.js';
import { cleanText } from './validation.js';

let counter = 0;
export const newClassId = () => globalThis.crypto?.randomUUID?.() || `class-${Date.now()}-${counter++}`;

const canonicalDay = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return (text && DAYS.find((day) => day.toLowerCase().startsWith(text.slice(0, 3)))) || '';
};

export const normalizeClass = (item = {}) => ({
  id: String(item.id || ''),
  name: cleanText(item.name ?? item.courseName, 160),
  day: canonicalDay(item.day),
  startTime: cleanText(item.startTime, 20),
  endTime: cleanText(item.endTime, 20),
  room: cleanText(item.room, 50),
  teacher: cleanText(item.teacher ?? item.instructor, 80),
  credits: cleanText(item.credits, 10),
  section: cleanText(item.section, 40),
  alternate: item.alternate === true,
  alternateFrom: item.alternate === true && isIsoDate(item.alternateFrom) ? item.alternateFrom : '',
  preview: item.preview === true
});

export const validateClass = (item) => {
  const value = normalizeClass(item);
  if (!value.name) return { valid: false, error: 'Add a course name.' };
  if (!value.day) return { valid: false, error: 'Choose a day.' };
  const start = parseTime(value.startTime);
  const end = parseTime(value.endTime);
  if (start === null || end === null || end <= start) return { valid: false, error: 'Choose an end time after the start time.' };
  return { valid: true, value };
};

export const isDuplicateClass = (candidate, classes, ignoredId = '') => classes.some((item) =>
  item.id !== ignoredId
  && item.name.toLowerCase() === candidate.name.toLowerCase()
  && item.day === candidate.day
  && parseTime(item.startTime) === parseTime(candidate.startTime)
  && parseTime(item.endTime) === parseTime(candidate.endTime)
);

// Clean up classes from a link or backup and give them new ids.
export const importClasses = (list = []) => list
  .map((item) => normalizeClass({ ...item, id: newClassId() }))
  .filter((item) => validateClass(item).valid);
