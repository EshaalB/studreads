// A class is one weekly meeting: { id, name, day, startTime, endTime, room, teacher, credits, section }.
import { DAYS } from './constants.js';
import { parseTime } from './timeUtils.js';

let counter = 0;
export const newClassId = () => globalThis.crypto?.randomUUID?.() || `class-${Date.now()}-${counter++}`;

// "mon", "Monday", "MONDAY " -> "Monday"
const canonicalDay = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return (text && DAYS.find((day) => day.toLowerCase().startsWith(text.slice(0, 3)))) || '';
};

const clip = (value, length) => String(value ?? '').replace(/[<>]/g, '').trim().slice(0, length);

export const normalizeClass = (item = {}) => ({
  id: String(item.id || ''),
  name: clip(item.name ?? item.courseName, 80),
  day: canonicalDay(item.day),
  startTime: clip(item.startTime, 20),
  endTime: clip(item.endTime, 20),
  room: clip(item.room, 50),
  teacher: clip(item.teacher ?? item.instructor, 80),
  credits: clip(item.credits, 10),
  section: clip(item.section, 40)
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

// Classes from a share link, backup or older saved data, checked and given fresh ids.
export const importClasses = (list = []) => list
  .map((item) => normalizeClass({ ...item, id: newClassId() }))
  .filter((item) => validateClass(item).valid);
