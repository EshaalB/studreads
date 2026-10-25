// Dates are "YYYY-MM-DD" and read in UTC so time zones can't shift them a day.
import { DAYS } from './constants.js';

const pad = (value) => String(value).padStart(2, '0');
const toDate = (isoDate) => new Date(`${isoDate}T00:00:00Z`);
const localIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const formatDate = (isoDate, options) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(toDate(isoDate));

export const shortDate = (isoDate) => formatDate(isoDate, { weekday: 'short', day: 'numeric', month: 'short' });

export const weekdayOf = (isoDate, style = 'long') => formatDate(isoDate, { weekday: style });

export const todayIso = () => localIso(new Date());

// Next date (today or later) that's on the given weekday.
export const nextDateFor = (day) => {
  const date = new Date();
  const target = DAYS.indexOf(day);
  if (target >= 0) date.setDate(date.getDate() + ((target - ((date.getDay() + 6) % 7) + 7) % 7));
  return localIso(date);
};

// 0 or 1: which alternate week a date is in.
const FIRST_MONDAY = Date.UTC(1970, 0, 5);
export const weekParity = (isoDate) => Math.floor((toDate(isoDate) - FIRST_MONDAY) / (7 * 86400000)) % 2;

export const relativeDay = (isoDate) => {
  const days = Math.round((toDate(isoDate) - toDate(todayIso())) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
};
