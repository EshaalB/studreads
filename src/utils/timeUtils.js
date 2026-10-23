export const parseTime = (timeStr) => {
  if (!timeStr) return null;

  // Normalize the time string - remove extra characters
  const normalized = timeStr
    .toString()
    .trim()
    .replace(/\.+$/, '')  // Remove trailing periods
    .replace(/\s+/g, ' ') // Normalize spaces
    .toUpperCase();

  // Try to match HH:mm AM/PM or HH:mm A.M./P.M.
  const ampmMatch = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM|A\.M\.?|P\.M\.?)/i);
  const militaryMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);

  let hours, minutes;

  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].replace(/\./g, '').toUpperCase();

    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else if (militaryMatch) {
    hours = parseInt(militaryMatch[1], 10);
    minutes = parseInt(militaryMatch[2], 10);

    if (hours > 23 || minutes > 59) return null;
  } else {
    return null;
  }

  return hours * 60 + minutes;
};

export const formatTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Displays a stored time string ("08:30", "8:30 AM") in the chosen clock format.
export const displayTime = (timeStr, format = '12h') => {
  const minutes = parseTime(timeStr);
  if (minutes === null) return timeStr || '';
  if (format === '24h') return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return formatTime(minutes);
};

export const displayTimeRange = (start, end, format = '12h') => [displayTime(start, format), displayTime(end, format)].filter(Boolean).join(' – ');

// "08:30" style value for <input type="time">.
export const toInputTime = (timeStr) => {
  const minutes = parseTime(timeStr);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export const checkOverlap = (slot1, slot2) => {
  if (slot1.day !== slot2.day) return false;

  const start1 = parseTime(slot1.startTime);
  const end1 = parseTime(slot1.endTime);
  const start2 = parseTime(slot2.startTime);
  const end2 = parseTime(slot2.endTime);

  if (start1 === null || end1 === null || start2 === null || end2 === null) return false;

  return (start1 < end2) && (end1 > start2);
};

export { DAYS } from './constants.js';
