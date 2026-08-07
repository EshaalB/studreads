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
