// Times are handled as minutes after midnight; classes keep the text from the file
// ("8:30 AM", "08:30") and are converted when drawn or compared.

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

// 540 -> "09:00", the value an <input type="time"> expects.
export const minutesToInput = (minutes) => (minutes === null || minutes === undefined ? '' : formatMinutes(minutes, '24h'));

// A stored time string shown in the chosen clock format.
export const displayTime = (value, format = '12h') => {
  const minutes = parseTime(value);
  return minutes === null ? value || '' : formatMinutes(minutes, format);
};

export const displayTimeRange = (start, end, format = '12h') => [displayTime(start, format), displayTime(end, format)].filter(Boolean).join(' – ');

export const toInputTime = (value) => minutesToInput(parseTime(value));

// Two classes on the same day whose times overlap.
export const checkOverlap = (a, b) => {
  if (a.day !== b.day) return false;
  const [startA, endA, startB, endB] = [a.startTime, a.endTime, b.startTime, b.endTime].map(parseTime);
  return [startA, endA, startB, endB].every((value) => value !== null) && startA < endB && endA > startB;
};
