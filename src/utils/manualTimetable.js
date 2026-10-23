import { DAYS } from './constants.js';
import { parseTime } from './timeUtils.js';

export const normalizeManualEntry = (entry = {}) => ({
  id: String(entry.id || ''),
  courseName: String(entry.courseName || '').trim().slice(0, 80),
  day: DAYS.includes(entry.day) ? entry.day : 'Monday',
  startTime: String(entry.startTime || ''),
  endTime: String(entry.endTime || ''),
  room: String(entry.room || '').trim().slice(0, 50),
  instructor: String(entry.instructor || '').trim().slice(0, 80),
  credits: String(entry.credits || '').trim().slice(0, 10)
});

export const validateManualEntry = (entry) => {
  const normalized = normalizeManualEntry(entry);
  if (!normalized.courseName) return { valid: false, error: 'Add a course name.' };
  const start = parseTime(normalized.startTime);
  const end = parseTime(normalized.endTime);
  if (start === null || end === null || end <= start) {
    return { valid: false, error: 'Choose an end time after the start time.' };
  }
  return { valid: true, entry: normalized };
};

export const isDuplicateManualEntry = (candidate, entries, ignoredId = '') => entries.some((entry) =>
  entry.id !== ignoredId
  && entry.courseName.trim().toLowerCase() === candidate.courseName.trim().toLowerCase()
  && entry.day === candidate.day
  && entry.startTime === candidate.startTime
  && entry.endTime === candidate.endTime
);

const toClock = (value) => {
  const minutes = parseTime(String(value || ''));
  return minutes === null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const toDay = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return DAYS.find((day) => text && day.toLowerCase().startsWith(text.slice(0, 3))) || '';
};

let counter = 0;
const newId = () => globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${counter++}`;

// Turns classes from a share link, backup file or uploaded timetable into editable entries.
export const classesToManualEntries = (classes = []) => classes
  .filter((item) => toDay(item.day))
  .map((item) => normalizeManualEntry({
    id: newId(),
    courseName: item.name ?? item.courseName,
    day: toDay(item.day),
    startTime: toClock(item.startTime),
    endTime: toClock(item.endTime),
    room: item.room,
    instructor: item.teacher ?? item.instructor,
    credits: item.credits
  }))
  .filter((entry) => validateManualEntry(entry).valid);
