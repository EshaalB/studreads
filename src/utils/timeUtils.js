// Times are minutes after midnight. Classes keep the original text
// and only get converted when drawn or compared.

import { weekParity } from './dates.js';

const pad = (value) => String(value).padStart(2, '0');

// "8:30 AM", "2:05 p.m.", "14:05" -> minutes after midnight, or null.
export const parseTime = (value) => {
  const text = String(value ?? '').trim().toUpperCase().replace(/\./g, '');
  const twelveHour = text.match(/(\d{1,2}):(\d{2})\s*([AP])M/);
  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);
  const match = twelveHour || twentyFourHour;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (twelveHour) return hours < 1 || hours > 12 ? null : ((hours % 12) + (match[3] === 'P' ? 12 : 0)) * 60 + minutes;
  return hours > 23 ? null : hours * 60 + minutes;
};

// 540 -> "9:00 AM" (or "09:00" with format '24h')
export const formatMinutes = (minutes, format = '12h') => {
  if (minutes === null || minutes === undefined) return '';
  const hours = Math.floor(minutes / 60) % 24;
  if (format === '24h') return `${pad(hours)}:${pad(minutes % 60)}`;
  return `${hours % 12 || 12}:${pad(minutes % 60)} ${hours >= 12 ? 'PM' : 'AM'}`;
};

export const minutesToInput = (minutes) => (minutes === null || minutes === undefined ? '' : formatMinutes(minutes, '24h'));

const displayTime = (value, format = '12h') => {
  const minutes = parseTime(value);
  return minutes === null ? value || '' : formatMinutes(minutes, format);
};

export const displayTimeRange = (start, end, format = '12h') => [displayTime(start, format), displayTime(end, format)].filter(Boolean).join(' – ');

export const toInputTime = (value) => minutesToInput(parseTime(value));

// Timetables often leave out AM/PM ("1:00 - 3:00"). Classes happen in the day,
// so early unmarked hours are PM, and an end before the start gets 12 hours added.
const EARLIEST_CLASS_HOUR = 7;
const HALF_DAY = 12 * 60;
const hasPeriod = (value) => /[ap]\.?\s?m/i.test(String(value));
export const inferClassTimes = (startTime, endTime) => {
  let start = parseTime(startTime);
  let end = parseTime(endTime);
  if (start === null || end === null) return { startTime, endTime };
  if (!hasPeriod(startTime) && start < EARLIEST_CLASS_HOUR * 60) start += HALF_DAY;
  if (!hasPeriod(endTime) && end < EARLIEST_CLASS_HOUR * 60) end += HALF_DAY;
  // Even "10:15 AM-12:15 AM" is a typo for 12:15 PM.
  if (end <= start && end + HALF_DAY > start && end + HALF_DAY < 2 * HALF_DAY) end += HALF_DAY;
  return { startTime: formatMinutes(start), endTime: formatMinutes(end) };
};

// Classes on opposite alternate weeks don't clash.
const onOppositeWeeks = (a, b) => a.alternateFrom && b.alternateFrom && weekParity(a.alternateFrom) !== weekParity(b.alternateFrom);

export const checkOverlap = (a, b) => {
  if (a.day !== b.day || onOppositeWeeks(a, b)) return false;
  const [startA, endA, startB, endB] = [a.startTime, a.endTime, b.startTime, b.endTime].map(parseTime);
  return [startA, endA, startB, endB].every((value) => value !== null) && startA < endB && endA > startB;
};
