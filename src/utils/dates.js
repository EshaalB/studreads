// Exam dates are stored as "YYYY-MM-DD" and read in UTC, so a date never moves by a day
// because of the device's time zone.
import { DAYS } from './constants.js';

const pad = (value) => String(value).padStart(2, '0');
const toDate = (isoDate) => new Date(`${isoDate}T00:00:00Z`);
const localIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const formatDate = (isoDate, options) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(toDate(isoDate));

// "Mon 2 Nov"
export const shortDate = (isoDate) => formatDate(isoDate, { weekday: 'short', day: 'numeric', month: 'short' });

// "Monday" (or "Mon" with style 'short')
export const weekdayOf = (isoDate, style = 'long') => formatDate(isoDate, { weekday: style });

export const todayIso = () => localIso(new Date());

// The next date, today or later, that falls on a weekday such as "Monday".
export const nextDateFor = (day) => {
  const date = new Date();
  const target = DAYS.indexOf(day);
  if (target >= 0) date.setDate(date.getDate() + ((target - ((date.getDay() + 6) % 7) + 7) % 7));
  return localIso(date);
};

// "today", "tomorrow" or "in 5 days"
export const relativeDay = (isoDate) => {
  const days = Math.round((toDate(isoDate) - toDate(todayIso())) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
};
