// Exam date-sheet extraction.
//
// Every source (spreadsheet, CSV, Word table, PDF text layer, OCR, pasted text) is
// reduced to rows of cells. A cell is either a primitive or { text, x, x2 } where x is
// a horizontal position (column index for spreadsheets, points/pixels for PDF and OCR).
// Three strategies then run over the same rows and the most productive one wins:
//   table - a header row names the columns (Subject, Date, Time, Venue...)
//   grid  - dates or time slots run across a row and course names fill the cells
//   loose - free text where each line mentions a course and a date nearby
import { weekdayOf } from '../utils/dates.js';
import { formatMinutes } from '../utils/timeUtils.js';

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const ORDINAL = '(?:st|nd|rd|th)?';
const YEAR = '(?:(\\d{4})|\'?(\\d{2})(?![:.]\\d))';

const ISO_DATE = /\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/;
const NUMERIC_DATE = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{4}|\d{2})\b/;
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})${ORDINAL}[\\s\\-./,]*(?:of\\s+)?${MONTH}(?:[\\s\\-./,]+${YEAR})?\\b`, 'i');
const MONTH_DAY = new RegExp(`\\b${MONTH}[\\s\\-./]+(\\d{1,2})${ORDINAL}(?![:\\d])(?:,?\\s+(\\d{4}))?\\b`, 'i');

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_PATTERN = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b\.?/i;

const CLOCK = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*([ap]\\.?\\s?m\\.?)?';
const TIME_RANGE = new RegExp(`\\b${CLOCK}\\s*(?:-|–|—|to|till|until)\\s*${CLOCK}(?![\\d])`, 'i');
const SINGLE_TIME = /\b(\d{1,2})(?:[:.](\d{2}))\s*([ap]\.?\s?m\.?)?|\b(\d{1,2})\s*([ap]\.?\s?m\.?)(?=\W|$)/i;

const CODE_PATTERN = /\b(?!(?:HALL|ROOM|LAB|BLOCK|AUDI|PAGE|SEM|SR|NO)\b)([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z]?)\b/;
const ROOM_HINT = /\b(room|hall|lab|labs|block|auditorium|audi|venue|building|floor|campus)\b|^[A-Z]{1,2}-?\d{1,3}[A-Z]?$/i;
const PROGRAM_HINT = /\b(bs|ms|ba|ma|bba|mba|bsc|msc|phd|be|semester|sem|batch|section|programme|program|class|year|level|department|dept)\b/i;
const NOISE_LINE = /^(note|notes|nb|page|signature|signed|controller|registrar|instructions?|important|remarks?|prepared by|approved by|copy to|cc)\b|^(-|_|=|\*|\.){3,}$/i;
// Instructions printed around the schedule ("Students must bring their ID cards.").
const INSTRUCTION = /^(students|candidates|please|kindly|mobile|no student)\b|\b(must|not allowed|are required|is required|should be|strictly)\b/i;
const isNoise = (text) => NOISE_LINE.test(text) || (INSTRUCTION.test(text) && !CODE_PATTERN.test(text));

const HEADER_RULES = [
  ['code', /\b(course|subject|paper|module|class|crs)\s*(code|no|number|id|#)\b|^(code|codes|c code|course #)$/],
  ['date', /\bdated?\b/],
  ['day', /^(day|days|week ?day|exam day)$/],
  ['startTime', /^(start|starts|starting|start time|from|time from|begins?|starting time)$/],
  ['endTime', /^(end|ends|ending|end time|to|time to|finish|finishes|ending time)$/],
  ['time', /\b(time|times|timing|timings|slot|slots|session|shift|duration)\b/],
  ['room', /\b(room|rooms|venue|venues|location|hall|halls|centre|center|building|block|place)\b/],
  ['teacher', /\b(teacher|instructor|faculty|invigilators?|examiner|lecturer|professor|supervisor)\b/],
  ['program', /\b(program|programme|programs|degree|semester|sem|class|batch|section|sections|discipline|department|dept|group|year|level)\b/],
  ['subject', /\b(subject|subjects|course|courses|paper|papers|module|modules|title|description|exam|examination|unit)\b/]
];

// Messy input, fixed before anything else looks at it:
// - full-width characters, ligatures (ﬁ) and odd spaces or dashes from PDFs
// - letter-spaced text ("D a t a  S t r u c t u r e s") from some PDF exports
// - scanner misreads inside numbers: O for 0 and I or l for 1 ("CS2O4", "18/O5/2026", "9:OO")
const OCR_DIGITS = { O: '0', o: '0', I: '1', l: '1', '|': '1' };
const fixOcrDigits = (text) => text
  .replace(/\b([A-Z]{2,5})([\s-]?)([0-9OIl|]{3,4})(?![A-Za-z0-9])/g, (match, letters, separator, digits) => (
    /^\d/.test(digits) || (digits.match(/\d/g) || []).length >= 2 ? letters + separator + digits.replace(/[OoIl|]/g, (c) => OCR_DIGITS[c]) : match
  ))
  .replace(/(?<![A-Za-z])[0-9OIl]{1,4}(?:[:./-][0-9OIl]{1,4}){1,2}(?![A-Za-z])/g, (match) => {
    const digits = (match.match(/\d/g) || []).length;
    return /[OIl]/.test(match) && digits >= (match.includes(':') ? 1 : 2) ? match.replace(/[OIl]/g, (c) => OCR_DIGITS[c]) : match;
  });

const joinSpacedLetters = (text) => text
  .split(/( {2,}|\t|\n)/)
  .map((part) => (/^(?:\S ){3,}\S$/.test(part) ? part.replace(/ /g, '').replace(/([a-z])([A-Z])/g, '$1 $2') : part))
  .join('');

const clean = (value) => fixOcrDigits(joinSpacedLetters(
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u2010-\u2012\u2212\uFE63\uFF0D]/g, '-')
))
  .replace(/[ \t]+/g, ' ')
  .replace(/\s*\n\s*/g, '\n')
  .trim();
const flat = (value) => clean(value).replace(/\n/g, ' ');
const headerKey = (value) => flat(value).toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();
const pad = (value) => String(value).padStart(2, '0');

const toIsoDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
};

const expandYear = (full, short, fallback) => {
  if (full) return Number(full);
  if (short) return 2000 + Number(short);
  return fallback;
};

// Finds the first date in a piece of text. Returns { iso, index, length } or null.
const findDate = (text, options = {}) => {
  const value = flat(text);
  if (!value) return null;
  const fallbackYear = options.year || new Date().getFullYear();
  const candidates = [];

  const iso = value.match(ISO_DATE);
  if (iso) candidates.push({ match: iso, iso: toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) });

  const numeric = value.match(NUMERIC_DATE);
  if (numeric && !iso) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = expandYear(numeric[3].length === 4 ? numeric[3] : '', numeric[3].length === 2 ? numeric[3] : '', fallbackYear);
    let dayFirst = options.dayFirst ?? true;
    if (first > 12) dayFirst = true;
    else if (second > 12) dayFirst = false;
    candidates.push({ match: numeric, iso: dayFirst ? toIsoDate(year, second, first) : toIsoDate(year, first, second) });
  }

  const dayMonth = value.match(DAY_MONTH);
  if (dayMonth) {
    const month = MONTHS[dayMonth[2].slice(0, 3).toLowerCase()];
    candidates.push({ match: dayMonth, iso: toIsoDate(expandYear(dayMonth[3], dayMonth[4], fallbackYear), month, Number(dayMonth[1])) });
  }

  const monthDay = value.match(MONTH_DAY);
  if (monthDay) {
    const month = MONTHS[monthDay[1].slice(0, 3).toLowerCase()];
    candidates.push({ match: monthDay, iso: toIsoDate(monthDay[3] ? Number(monthDay[3]) : fallbackYear, month, Number(monthDay[2])) });
  }

  const best = candidates.filter((candidate) => candidate.iso).sort((a, b) => a.match.index - b.match.index)[0];
  return best ? { iso: best.iso, index: best.match.index, length: best.match[0].length } : null;
};

// ---------------------------------------------------------------------------
// Times

const toMinutes = (hours, minutes, meridiem) => {
  let h = Number(hours);
  const m = Number(minutes || 0);
  if (Number.isNaN(h) || m > 59) return null;
  const period = meridiem ? meridiem.replace(/[\s.]/g, '').toLowerCase() : '';
  if (period) {
    if (h < 1 || h > 12) return null;
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return h * 60 + m;
};


// Exams are not held overnight, so "2:00 - 5:00" means the afternoon.
const assumeDaytime = (minutes, hadMeridiem) => (minutes !== null && !hadMeridiem && minutes < 7 * 60 ? minutes + 12 * 60 : minutes);

const findTime = (text, { strict = true } = {}) => {
  const value = flat(text).replace(/\b([01]\d|2[0-3])([0-5]\d)(\s*)(hrs?|h)\b/gi, (match, hours, minutes) => `${hours}:${minutes}`.padEnd(match.length, ' '));
  if (!value.trim()) return null;
  const range = value.match(TIME_RANGE);
  if (range) {
    const [, h1, m1, p1, h2, m2, p2] = range;
    const explicit = m1 || m2 || p1 || p2;
    if (explicit || !strict) {
      // "2:00 - 5:00 PM" shares the PM; "9:00 - 12:00 PM" does not.
      const inherit = !p1 && p2 && Number(h1) <= Number(h2) && Number(h2) !== 12;
      let start = toMinutes(h1, m1, p1 || (inherit ? p2 : ''));
      let end = toMinutes(h2, m2, p2);
      start = assumeDaytime(start, p1 || p2);
      end = assumeDaytime(end, p2);
      if (start !== null && end !== null && end <= start && !p2) end += 12 * 60;
      if (start !== null && end !== null && end > start && end - start <= 8 * 60) {
        return { start, end, index: range.index, length: range[0].length };
      }
    }
  }
  const single = value.match(SINGLE_TIME);
  if (single) {
    const hadMeridiem = single[3] || single[5];
    const start = assumeDaytime(single[1] ? toMinutes(single[1], single[2], single[3]) : toMinutes(single[4], 0, single[5]), hadMeridiem);
    if (start !== null) return { start, end: null, index: single.index, length: single[0].length };
  }
  return null;
};

// Times inside a column known to hold times can be written loosely: "0900-1200",
// "9" and "12" in separate columns, "09:00 hrs", an Excel fraction such as 0.375, or a
// session name ("Morning") defined elsewhere in the sheet.
const SESSION_WORD = '(morning|afternoon|evening|night|first|second|third|1st|2nd|3rd|(?:slot|session|shift|paper)\\s*(?:[a-c]|[1-3]|i{1,3}))';
const SESSION_DEFINITION = new RegExp(`\\b${SESSION_WORD}\\b(?:\\s*(?:session|shift|slot|paper))?\\s*[:(=\\-–]?\\s*`, 'gi');
const sessionKey = (word) => word.toLowerCase().replace(/\s+/g, '').replace(/^1st$/, 'first').replace(/^2nd$/, 'second').replace(/^3rd$/, 'third');

const collectSessions = (rows) => {
  const sessions = new Map();
  rows.forEach((row) => row.forEach((cell) => {
    const text = flat(cell.text);
    for (const match of text.matchAll(SESSION_DEFINITION)) {
      const time = findTime(text.slice(match.index + match[0].length, match.index + match[0].length + 40));
      if (time && time.index < 4 && !sessions.has(sessionKey(match[1]))) sessions.set(sessionKey(match[1]), time);
    }
  }));
  return sessions;
};

const sessionTime = (text, sessions) => {
  if (!sessions?.size) return null;
  const words = flat(text).toLowerCase();
  for (const [key, time] of sessions) {
    const pattern = new RegExp(`\\b${key.replace(/(\D)(\d|[a-c]|i+)$/, '$1\\s*$2')}\\b`, 'i');
    if (pattern.test(words) || (key === 'first' && /\b1st\b/.test(words)) || (key === 'second' && /\b2nd\b/.test(words)) || (key === 'third' && /\b3rd\b/.test(words))) return time;
  }
  return null;
};

const findTimeLoose = (text, sessions) => {
  let value = flat(text).replace(/\s*\b(?:hours|hrs?)\b\.?/gi, '');
  if (!value) return null;
  const fraction = value.match(/^0?\.\d+$/);
  if (fraction) return { start: Math.round(Number(value) * 1440) % 1440, end: null };
  const bare = value.match(/^(\d{1,2})$/);
  if (bare && Number(bare[1]) >= 1 && Number(bare[1]) <= 23) return { start: assumeDaytime(Number(bare[1]) * 60, false), end: null };
  value = value.replace(/\b([01]\d|2[0-3])([0-5]\d)\b/g, '$1:$2');
  return findTime(value, { strict: false }) || sessionTime(value, sessions);
};

const timeLabel = (time) => {
  if (!time) return '';
  return time.end !== null ? `${formatMinutes(time.start)} – ${formatMinutes(time.end)}` : formatMinutes(time.start);
};

// ---------------------------------------------------------------------------
// Cells and rows

function cellText(cell) {
  if (cell && typeof cell === 'object' && !(cell instanceof Date)) return cell.text ?? '';
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return '';
    if (cell.getFullYear() < 1902) return formatMinutes(cell.getHours() * 60 + cell.getMinutes());
    const date = toIsoDate(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
    const minutes = cell.getHours() * 60 + cell.getMinutes();
    return minutes ? `${date} ${formatMinutes(minutes)}` : date;
  }
  return cell ?? '';
}

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : [])
  .filter(Array.isArray)
  .map((row) => row.map((cell, index) => {
    const positioned = cell && typeof cell === 'object' && !(cell instanceof Date);
    const text = clean(cellText(cell));
    return {
      text,
      x: positioned ? cell.x : index,
      x2: positioned ? (cell.x2 ?? cell.x) : index + 1
    };
  }).filter((cell) => cell.text && !/^[-–—_.]+$/.test(cell.text)));

const center = (cell) => (cell.x + cell.x2) / 2;

const matchHeader = (text) => {
  const key = headerKey(text);
  if (!key || key.length > 48 || key.split(' ').length > 6) return null;
  const rule = HEADER_RULES.find(([, pattern]) => pattern.test(key));
  return rule ? rule[0] : null;
};

const scoreHeader = (row) => {
  const mapping = {};
  row.forEach((cell) => {
    const field = matchHeader(cell.text);
    if (field && !mapping[field]) mapping[field] = cell;
  });
  const fields = Object.keys(mapping);
  const hasCourse = mapping.subject || mapping.code;
  const hasWhen = mapping.date || mapping.day || mapping.time || mapping.startTime;
  const looksLikeData = row.some((cell) => findDate(cell.text));
  if (!hasCourse || !hasWhen || fields.length < 2 || looksLikeData) return null;
  return { mapping, score: fields.length };
};

const splitCode = (text) => {
  const value = flat(text);
  const match = value.match(CODE_PATTERN);
  if (!match) return { code: '', subject: value };
  const rest = (value.slice(0, match.index) + value.slice(match.index + match[0].length))
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s:–—\-|,/()]+|[\s:–—\-|,/(]+$/g, '')
    .trim();
  return { code: match[0].trim(), subject: rest };
};

const splitRoom = (text) => {
  const bracketed = text.match(/\(([^)]*)\)\s*$/);
  if (bracketed && ROOM_HINT.test(bracketed[1])) return { subject: text.slice(0, bracketed.index).trim(), room: bracketed[1].trim() };
  const trailing = text.match(/[\s,–-]+((?:room|hall|lab|block|auditorium|venue)\s*[:#]?\s*[\w-]{1,8})$/i);
  if (trailing) return { subject: text.slice(0, trailing.index).trim(), room: trailing[1].replace(/^venue\s*[:#]?\s*/i, '').trim() };
  return { subject: text, room: '' };
};

const tidySubject = (text) => flat(text)
  .replace(/^\d{1,3}[.)]\s+/, '')
  .replace(/^[\s:–—\-|,•*]+|[\s:–—\-|,•*]+$/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const isUsefulSubject = (text) => {
  if (!text || text.length < 2 || text.length > 140) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (isNoise(text)) return false;
  const stripped = text.replace(DAY_PATTERN, '').replace(/\b(exam|exams|paper|morning|evening|afternoon|session|break|holiday|off|no exam|reserved)\b/gi, '').replace(/[^a-z]/gi, '');
  return stripped.length >= 2;
};

const makeRecord = (values, source, index) => {
  let subject = tidySubject(values.subject);
  let code = flat(values.code);
  let room = flat(values.room);
  if (!code) {
    const split = splitCode(subject);
    code = split.code;
    subject = tidySubject(split.subject);
  }
  if (!room) {
    const split = splitRoom(subject);
    subject = split.subject;
    room = split.room;
  }
  if (!subject && code) subject = code;
  if (!values.date || !isUsefulSubject(subject)) return null;

  return {
    id: `${source}-${values.date}-${code || subject}-${index}`.replace(/\s+/g, '_'),
    subject,
    code,
    date: values.date,
    day: weekdayOf(values.date, 'short'),
    time: timeLabel(values.time) || flat(values.timeText),
    start: values.time?.start ?? null,
    end: values.time?.end ?? null,
    room,
    program: flat(values.program),
    teacher: flat(values.teacher),
    source
  };
};

// A cell can hold several courses ("CS-101 Programming\nMA-102 Calculus") or one course
// with extra lines ("Data Structures\nBSCS-3A\nHall 2").
const parseCellCourses = (text) => {
  const lines = clean(text).split(/\n|;/).map((part) => part.trim()).filter(Boolean)
    // "CS-204, MA-201" or "CS-204 / MA-201": several codes on one line.
    .flatMap((line) => {
      const parts = line.split(/\s*[,/&]\s*/).filter(Boolean);
      return parts.length > 1 && parts.every((part) => CODE_PATTERN.test(part) && part.replace(CODE_PATTERN, '').trim().length < 3) ? parts : [line];
    });
  if (lines.length > 1 && lines.every((line) => CODE_PATTERN.test(line))) {
    return lines.map((line) => ({ subject: line, room: '', program: '' }));
  }
  const course = { subject: '', room: '', program: '' };
  lines.forEach((line, index) => {
    if (index > 0 && !course.room && ROOM_HINT.test(line) && line.length < 30) course.room = line;
    else if (index > 0 && !course.program && PROGRAM_HINT.test(line) && line.length < 50) course.program = line;
    else course.subject = course.subject ? `${course.subject} ${line}` : line;
  });
  return course.subject ? [course] : [];
};

const splitCodes = (text) => clean(text).split(/\n|;|,|\s\/\s/).map((part) => part.trim()).filter(Boolean);
const TITLE_LINE = /\b(exam(ination)?s?|schedule|date ?sheet|time ?table|university|notification|notice|term|spring|fall|autumn|summer|winter)\b/i;

// ---------------------------------------------------------------------------
// Date interpretation shared by the whole document

const analyseDates = (rows) => {
  const years = new Map();
  let dayFirstVotes = 0;
  let monthFirstVotes = 0;
  let ambiguous = false;

  rows.forEach((row) => row.forEach((cell) => {
    const text = flat(cell.text);
    const year = text.match(/\b(20\d{2})\b/);
    if (year && findDate(text)) years.set(year[1], (years.get(year[1]) || 0) + 1);

    const numeric = !text.match(ISO_DATE) && text.match(NUMERIC_DATE);
    if (!numeric) return;
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    if (first > 12) dayFirstVotes += 5;
    else if (second > 12) monthFirstVotes += 5;
    else if (first !== second) {
      ambiguous = true;
      // A weekday printed next to the date settles the order.
      const weekday = text.match(DAY_PATTERN)?.[1]?.slice(0, 3).toLowerCase();
      if (weekday) {
        const yearValue = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
        const asDayFirst = toIsoDate(yearValue, second, first);
        const asMonthFirst = toIsoDate(yearValue, first, second);
        if (asDayFirst && weekdayOf(asDayFirst, 'short').toLowerCase() === weekday) dayFirstVotes += 1;
        if (asMonthFirst && weekdayOf(asMonthFirst, 'short').toLowerCase() === weekday) monthFirstVotes += 1;
      }
    }
  }));

  const year = [...years.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    dayFirst: monthFirstVotes <= dayFirstVotes,
    year: year ? Number(year) : new Date().getFullYear(),
    sessions: collectSessions(rows),
    ambiguous: ambiguous && dayFirstVotes === monthFirstVotes
  };
};

// ---------------------------------------------------------------------------
// Strategy 1: header-driven tables

// Every header cell becomes an anchor, including unrecognised ones such as "Sr. No",
// so their values are not pulled into a neighbouring column.
// A header cell that is itself a time or date ("09:00 - 10:00", "Mon 18 May") marks a slot
// column: its cells are courses examined at that time or on that date.
const headerAnchors = (row, dateOptions) => row.map((cell) => {
  const field = matchHeader(cell.text);
  const slot = classify(cell.text, dateOptions);
  // "Slot 1 (9:00-12:00)" names a time column but also carries the time itself.
  if (field && !(field === 'time' && slot.time)) return { field, x: cell.x, x2: cell.x2 };
  return slot.isAxis || slot.time
    ? { field: 'slot', time: slot.time, date: slot.date?.iso || '', x: cell.x, x2: cell.x2 }
    : { field: null, x: cell.x, x2: cell.x2 };
});

const assignToColumns = (row, anchors) => {
  const values = {};
  const byAnchor = new Map();
  row.forEach((cell) => {
    let best = null;
    anchors.forEach((anchor) => {
      const overlap = Math.min(cell.x2, anchor.x2) - Math.max(cell.x, anchor.x);
      const score = overlap > 0 ? -overlap : Math.abs(center(cell) - center(anchor));
      if (!best || score < best.score) best = { anchor, score };
    });
    if (!best) return;
    byAnchor.set(best.anchor, byAnchor.has(best.anchor) ? `${byAnchor.get(best.anchor)}\n${cell.text}` : cell.text);
    // Columns with an unrecognised header are kept aside as a fallback for titles.
    const field = best.anchor.field || '_other';
    values[field] = values[field] ? `${values[field]}\n${cell.text}` : cell.text;
  });
  return { values, byAnchor };
};

const isLabelRow = (text) => PROGRAM_HINT.test(text) && text.length < 60 && text.split(/\s+/).length <= 6
  && !CODE_PATTERN.test(text) && !TITLE_LINE.test(text) && !findTime(text);

const parseTable = (rows, source, dateOptions) => {
  const records = [];
  let anchors = null;
  let pendingLabel = '';
  let defaultTime = null;
  const undated = [];
  const context = { date: '', time: null, program: '' };

  rows.forEach((row, rowIndex) => {
    if (scoreHeader(row)) {
      anchors = headerAnchors(row, dateOptions);
      // Two-row headers such as "Time" above "From | To".
      rows[rowIndex + 1]?.forEach((cell) => {
        const field = matchHeader(cell.text);
        if (field && !anchors.some((anchor) => anchor.field === field) && !findDate(cell.text)) {
          const overlaps = (anchor) => Math.min(cell.x2, anchor.x2) - Math.max(cell.x, anchor.x) > 0;
          anchors = anchors.filter((anchor) => !(overlaps(anchor) && (!anchor.field || anchor.field === 'time')));
          anchors.push({ field, x: cell.x, x2: cell.x2 });
        }
      });
      anchors.sort((a, b) => a.x - b.x);
      context.date = '';
      context.time = null;
      context.program = pendingLabel;
      pendingLabel = '';
      return;
    }

    if (row.length === 1) {
      const only = row[0].text;
      const date = findDate(only, dateOptions);
      if (date && flat(only).length < 48) {
        context.date = date.iso;
        const time = findTime(flat(only).slice(0, date.index) + ' ' + flat(only).slice(date.index + date.length));
        if (time) context.time = time;
        return;
      }
      if (isLabelRow(only)) {
        if (anchors) context.program = only; else pendingLabel = only;
        return;
      }
    }
    if (!anchors) {
      // "All papers will be held from 9:00 AM to 12:00 PM" above the table.
      const text = row.map((cell) => cell.text).join(' ');
      const time = !findDate(text, dateOptions) && findTime(text);
      if (time) defaultTime = time;
      return;
    }
    if (row.every((cell) => matchHeader(cell.text))) return;

    // A table continued on another PDF page can have different column widths. When a
    // complete row no longer lines up with the header, re-anchor the columns on it.
    if (row.length === anchors.length) {
      const used = new Set(row.map((cell) => anchors.reduce((best, anchor, index) => {
        const distance = Math.abs(center(cell) - center(anchor));
        return distance < best.distance ? { index, distance } : best;
      }, { index: -1, distance: Infinity }).index));
      if (used.size < row.length) anchors = anchors.map((anchor, index) => ({ ...anchor, x: row[index].x, x2: row[index].x2 }));
    }

    const { values, byAnchor } = assignToColumns(row, anchors);
    const dateText = flat([values.date, values.day].filter(Boolean).join(' '));
    const date = findDate(dateText, dateOptions);
    // A time carried down from earlier rows never crosses into a new date.
    if (date && date.iso !== context.date) context.time = null;
    if (date) context.date = date.iso;
    if (date && undated.length) {
      undated.splice(0).forEach((values) => {
        const record = makeRecord({ ...values, date: context.date }, source, records.length);
        if (record) records.push({ ...record, rowIndex: values.rowIndex });
      });
    }

    let time = null;
    const startText = values.startTime || (values.endTime ? values.time : '');
    if (startText) {
      const start = findTimeLoose(startText, dateOptions.sessions);
      const end = findTimeLoose(values.endTime || '', dateOptions.sessions);
      if (start) time = { start: start.start, end: end?.start ?? start.end ?? null };
    }
    if (!time && values.time) time = findTimeLoose(values.time, dateOptions.sessions);
    if (!time && date) time = findTime(dateText.slice(0, date.index) + ' ' + dateText.slice(date.index + date.length));
    if (time) context.time = time;
    if (values.program) context.program = flat(values.program);

    // Slot columns: one exam per filled slot, its code taken from the "Code" column
    // just before it (e.g. Code | 09:00 - 10:00 | Code | 10:30 - 11:30 ...).
    if (anchors.some((anchor) => anchor.field === 'slot')) {
      anchors.forEach((slot, index) => {
        if (slot.field !== 'slot') return;
        let code = '';
        for (let i = index - 1; i >= 0 && anchors[i].field !== 'slot'; i -= 1) {
          if (anchors[i].field === 'code' && byAnchor.get(anchors[i])) { code = flat(byAnchor.get(anchors[i])); break; }
        }
        const text = byAnchor.get(slot) || '';
        if (!text && !code) return;
        const courses = text ? parseCellCourses(text) : [{ subject: code, room: '', program: '' }];
        courses.forEach((course) => {
          const record = makeRecord({
            subject: course.subject,
            code: courses.length === 1 ? code : '',
            date: slot.date || context.date,
            time: slot.time || time || context.time || defaultTime,
            room: values.room || course.room,
            program: values.program || course.program || context.program
          }, source, records.length);
          if (record) records.push({ ...record, rowIndex });
        });
      });
      return;
    }

    const subjectText = values.subject || (values.code ? pickTitle(values._other) : '');
    const codeText = values.code || '';
    if (!subjectText && !codeText) return;

    // A wrapped title arrives as a row with nothing but more title text.
    const previous = records[records.length - 1];
    const onlySubject = subjectText && !codeText && !values.date && !values.day && !values.time && !values.startTime && !values.room;
    if (onlySubject && previous?.rowIndex === rowIndex - 1 && previous.code && anchors.some((anchor) => anchor.field === 'code')) {
      previous.subject = tidySubject(`${previous.subject} ${flat(subjectText)}`);
      previous.rowIndex = rowIndex;
      return;
    }

    const codes = codeText ? splitCodes(codeText) : [];
    const courses = codes.length > 1
      ? codes.map((code) => ({ code, subject: '', room: '', program: '' }))
      : (subjectText ? parseCellCourses(subjectText) : [{ subject: '', room: '', program: '' }]).map((course) => ({ ...course, code: codes[0] || '' }));
    courses.forEach((course) => {
      const recordValues = {
        subject: course.subject,
        code: course.code,
        date: context.date,
        time: time || context.time || defaultTime,
        timeText: values.time,
        room: values.room || course.room,
        program: values.program || course.program || context.program,
        teacher: values.teacher
      };
      // A merged date cell printed lower down still belongs to these rows.
      if (!context.date) { undated.push({ ...recordValues, rowIndex }); return; }
      const record = makeRecord(recordValues, source, records.length);
      if (record) records.push({ ...record, rowIndex });
    });
  });

  return records;
};

// A course title among unlabelled cells: the longest text that is not a code, date,
// time or room.
const pickTitle = (text) => clean(text).split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length >= 4 && /[a-z]{3}/i.test(line) && !isCodeOnly(line) && !findDate(line) && !findTime(line) && !ROOM_HINT.test(line) && !isNoise(line))
  .sort((a, b) => b.length - a.length)[0] || '';

// ---------------------------------------------------------------------------
// Strategy 2: grids with dates or time slots across the top

const classify = (text, dateOptions) => {
  const value = flat(text);
  const date = findDate(value, dateOptions);
  const withoutDate = date ? value.slice(0, date.index) + ' ' + value.slice(date.index + date.length) : value;
  const time = findTime(withoutDate, { strict: true }) || sessionTime(withoutDate, dateOptions.sessions);
  const leftover = (time ? withoutDate.slice(0, time.index) + withoutDate.slice(time.index + time.length) : withoutDate)
    .replace(DAY_PATTERN, '')
    .replace(/\b(morning|evening|afternoon|session|slot|shift|time|date|day|paper|exam|i|ii|iii|1st|2nd|3rd)\b/gi, '')
    .replace(/[^a-z]/gi, '');
  return { date, time, isAxis: Boolean(date || time) && leftover.length <= 2 };
};

const axisBoundary = (axis) => {
  const sorted = [...axis].sort((a, b) => a.x - b.x);
  const gap = sorted.length > 1 ? Math.max(0, sorted[1].x - sorted[0].x2) : 0;
  return sorted[0].x - gap / 2;
};

const findAxis = (row, dateOptions) => {
  const classified = row.map((cell) => ({ ...cell, ...classify(cell.text, dateOptions) }));
  const axis = classified.filter((cell) => cell.isAxis);
  if (axis.length < 2 || axis.length < classified.length - 2) return null;
  const allDates = axis.every((cell) => cell.date);
  const allTimes = axis.every((cell) => cell.time && !cell.date);
  return allDates || allTimes ? axis : null;
};

const parseGrid = (rows, source, dateOptions) => {
  let axis = null;
  let start = -1;
  for (let index = 0; index < Math.min(rows.length, 60) && !axis; index += 1) {
    axis = findAxis(rows[index], dateOptions);
    if (axis) start = index;
  }
  if (!axis) return [];

  const records = [];
  const context = { date: '', time: null };
  let boundary = axisBoundary(axis);
  let ended = false;

  rows.slice(start + 1).forEach((row, offset) => {
    // A new header row ("Course Code | Course Title") starts a legend or another table.
    if (ended || row.filter((cell) => matchHeader(cell.text)).length >= 2) { ended = true; return; }
    const rowIndex = start + 1 + offset;
    // A later axis row (next week, next block) replaces the current one.
    const right = row.filter((cell) => center(cell) >= boundary);
    const nextAxis = findAxis(right, dateOptions);
    if (nextAxis && nextAxis.length >= right.length - 1) {
      axis = nextAxis;
      boundary = axisBoundary(axis);
      return;
    }

    let rowProgram = '';
    let rowCode = '';
    const body = [];
    row.forEach((cell) => {
      const info = { ...cell, ...classify(cell.text, dateOptions) };
      if (center(cell) >= boundary) { body.push(info); return; }
      if (info.date) context.date = info.date.iso;
      if (info.time) context.time = info.time;
      // A bare course code labelling the row is that row's course, not a programme.
      if (!info.isAxis && isCodeOnly(info.text)) { rowCode = flat(info.text); return; }
      if (!info.isAxis && !/^\d+$/.test(info.text) && info.text.replace(DAY_PATTERN, '').trim()) rowProgram = rowProgram ? `${rowProgram} ${flat(info.text)}` : flat(info.text);
    });

    body.filter((cell) => !cell.isAxis).forEach((cell) => {
      let column = null;
      axis.forEach((candidate) => {
        const distance = Math.abs(center(candidate) - center(cell));
        if (!column || distance < column.distance) column = { cell: candidate, distance };
      });
      const date = column.cell.date?.iso || context.date;
      const time = column.cell.time || context.time;
      parseCellCourses(cell.text).forEach((course) => {
        const record = makeRecord({ subject: course.subject, code: rowCode, room: course.room, date, time, program: course.program || rowProgram }, source, records.length);
        if (record) records.push({ ...record, rowIndex });
      });
    });
  });

  return records;
};

// ---------------------------------------------------------------------------
// Strategy 3: free text, one exam per line, dates may sit on their own line

const parseLoose = (rows, source, dateOptions) => {
  const records = [];
  const context = { date: '', time: null };

  rows.forEach((row, rowIndex) => {
    const cells = row.map((cell) => flat(cell.text));
    const line = cells.join('  ');
    if (!line || isNoise(line) || line.length > 220) return;
    // A header row ("Course Code | Course Title") starts a legend, not more exams.
    if (row.filter((cell) => matchHeader(cell.text)).length >= 2) { context.date = ''; return; }
    // A row listing several dates or times is a column header, not an exam.
    const axisCells = row.map((cell) => classify(cell.text, dateOptions)).filter((info) => info.isAxis);
    if (axisCells.filter((info) => info.date).length >= 2 || axisCells.filter((info) => info.time && !info.date).length >= 2) return;

    const date = findDate(line, dateOptions);
    if (date && date.iso !== context.date) context.time = null;
    if (date) context.date = date.iso;
    const remaining = cells.map((text) => {
      let value = text;
      const cellDate = findDate(value, dateOptions);
      if (cellDate) value = value.slice(0, cellDate.index) + ' ' + value.slice(cellDate.index + cellDate.length);
      return flat(value.replace(DAY_PATTERN, ' '));
    });

    const time = findTime(remaining.join('  '));
    if (time) context.time = time;
    const withoutTime = remaining.map((text) => {
      const cellTime = findTime(text);
      return cellTime ? text.slice(0, cellTime.index) + ' ' + text.slice(cellTime.index + cellTime.length) : text;
    }).map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);

    if (!context.date || withoutTime.length === 0) return;

    const room = withoutTime.find((text) => ROOM_HINT.test(text) && !CODE_PATTERN.test(text) && text.length < 40) || '';
    const program = withoutTime.find((text) => text !== room && PROGRAM_HINT.test(text) && !CODE_PATTERN.test(text) && text.length < 60) || '';
    const rest = withoutTime.filter((text) => text !== room && text !== program);
    // Several bare codes on one line are separate exams in the same slot.
    const bareCodes = rest.flatMap((text) => text.split(/\s*[,/&]\s*|\s{2,}/)).filter(Boolean);
    if (bareCodes.length > 1 && bareCodes.every(isCodeOnly)) {
      bareCodes.forEach((code) => {
        const record = makeRecord({ subject: code, code, date: context.date, time: time || context.time, room, program }, source, records.length);
        if (record) records.push({ ...record, rowIndex });
      });
      return;
    }
    const codeCell = rest.find((text) => CODE_PATTERN.test(text) && text.replace(CODE_PATTERN, '').trim().length < 3);
    const subjectCell = rest.filter((text) => text !== codeCell).sort((a, b) => b.length - a.length)[0] || codeCell || '';
    if (!subjectCell) return;

    const record = makeRecord({
      subject: subjectCell,
      code: codeCell ? codeCell.match(CODE_PATTERN)[0] : '',
      date: context.date,
      time: time || context.time,
      room,
      program
    }, source, records.length);
    if (record) records.push({ ...record, rowIndex });
  });

  return records;
};

// ---------------------------------------------------------------------------

const quality = (records) => records.reduce((total, record) => total + 1 + (record.start !== null ? 0.3 : 0) + (record.code ? 0.2 : 0) + (record.room ? 0.1 : 0), 0);

const dedupeAndSort = (records) => {
  const seen = new Set();
  return records
    .map((record) => {
      const copy = { ...record };
      delete copy.rowIndex;
      return copy;
    })
    .filter((record) => {
      const identity = `${record.date}|${record.start}|${record.code}|${record.subject}|${record.program}`.toLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0) || a.subject.localeCompare(b.subject));
};

// Course codes mapped to titles, gathered from anywhere in the file. Date sheets often
// print only codes in the schedule and list "CS-204  Data Structures" elsewhere.
const codeKey = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const isCodeOnly = (text) => {
  const match = flat(text).match(CODE_PATTERN);
  return Boolean(match) && flat(text).replace(match[0], '').replace(/[\s:–—\-|,/()]/g, '').length === 0;
};

const collectCourseTitles = (rows, titles = new Map()) => {
  const looksLikeTitle = (text) => text.length >= 4 && /[a-z]{3}/i.test(text) && !CODE_PATTERN.test(text)
    && !findDate(text) && !findTime(text) && !ROOM_HINT.test(text) && !matchHeader(text) && !isNoise(text);
  const remember = (code, title) => {
    const key = codeKey(code);
    const cleaned = tidySubject(title);
    if (key && cleaned && (!titles.has(key) || titles.get(key).length < cleaned.length)) titles.set(key, cleaned);
  };
  rows.forEach((row) => row.forEach((cell, index) => {
    clean(cell.text).split('\n').forEach((line) => {
      const match = line.match(CODE_PATTERN);
      if (!match) return;
      const rest = tidySubject(line.slice(0, match.index) + ' ' + line.slice(match.index + match[0].length));
      if (rest && looksLikeTitle(rest)) { remember(match[0], rest); return; }
      if (!isCodeOnly(line)) return;
      const neighbour = row.slice(index + 1).map((other) => flat(other.text)).find(looksLikeTitle);
      if (neighbour) remember(match[0], neighbour);
    });
  }));
  return titles;
};

const fillCourseTitles = (records, titles) => records.map((record) => {
  const title = record.code && titles.get(codeKey(record.code));
  return title && (!record.subject || record.subject === record.code) ? { ...record, subject: title } : record;
});

export const extractExams = (matrix, source = 'Uploaded file') => {
  const rows = normalizeRows(matrix).filter((row) => row.length > 0);
  const dateOptions = analyseDates(rows);
  const attempts = [
    { mode: 'table', records: parseTable(rows, source, dateOptions) },
    { mode: 'grid', records: parseGrid(rows, source, dateOptions) },
    { mode: 'text', records: parseLoose(rows, source, dateOptions) }
  ].map((attempt) => ({ ...attempt, score: quality(attempt.records) }));

  // A table with a recognised header is the most reliable reading; another strategy only
  // wins when it finds clearly more exams (for example a grid below a small header table).
  const [table, ...others] = attempts;
  const bestOther = others.sort((a, b) => b.score - a.score)[0];
  const best = table.records.length > 0 && table.records.length >= bestOther.records.length * 0.6 ? table : [table, bestOther].sort((a, b) => b.score - a.score)[0];
  const records = fillCourseTitles(best.records, collectCourseTitles(rows));
  return { records: dedupeAndSort(records), mode: best.mode, ambiguousDates: dateOptions.ambiguous };
};


// ---------------------------------------------------------------------------
// Source adapters

// Spreadsheet cells are read directly so date serials are decoded without timezone drift
// and merged cells (a date spanning several rows) are copied down.
const sheetToMatrix = (XLSX, sheet) => {
  if (!sheet?.['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const matrix = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? readCell(XLSX, cell) : '');
    }
    matrix.push(row);
  }
  (sheet['!merges'] || []).forEach((merge) => {
    const value = matrix[merge.s.r - range.s.r]?.[merge.s.c - range.s.c];
    for (let r = merge.s.r + 1; r <= merge.e.r; r += 1) {
      const row = matrix[r - range.s.r];
      if (row && !row[merge.s.c - range.s.c]) row[merge.s.c - range.s.c] = value;
    }
  });
  return matrix;
};

const readCell = (XLSX, cell) => {
  if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
    const parts = XLSX.SSF.parse_date_code(cell.v);
    if (parts) {
      const minutes = parts.H * 60 + parts.M;
      if (cell.v < 1) return formatMinutes(minutes);
      const date = toIsoDate(parts.y, parts.m, parts.d);
      return minutes ? `${date} ${formatMinutes(minutes)}` : date;
    }
  }
  if (cell.t === 'd' && cell.v instanceof Date) return cellText(cell.v);
  return cell.w ?? String(cell.v ?? '');
};

export const parseExamWorkbook = (XLSX, workbook) => {
  const titles = new Map();
  const candidates = workbook.SheetNames.map((sheetName) => {
    const matrix = sheetToMatrix(XLSX, workbook.Sheets[sheetName]);
    collectCourseTitles(normalizeRows(matrix), titles);
    const result = extractExams(matrix, sheetName);
    return { sheetName, ...result };
  }).filter((candidate) => candidate.records.length > 0)
    .sort((a, b) => b.records.length - a.records.length);

  if (candidates.length === 0) throw new Error('No exams with a recognisable date were found in this file.');

  // Date sheets are often split into one tab per programme or week; keep them all.
  const combined = candidates.length > 1 && candidates[1].records.length >= Math.max(3, candidates[0].records.length * 0.2);
  const chosen = combined ? candidates : [candidates[0]];
  return {
    records: dedupeAndSort(fillCourseTitles(chosen.flatMap((candidate) => candidate.records), titles)),
    hasAmbiguousDates: chosen.some((candidate) => candidate.ambiguousDates)
  };
};

// Pasted text or .txt files: columns separated by tabs, pipes or runs of spaces.
export const textToRows = (text) => String(text || '')
  .split(/\r?\n/)
  .map((line) => line.split(/\t|\s\|\s|\|(?=\S)|\s{2,}/).map((cell) => cell.trim()).filter(Boolean));

// Positioned words (PDF text layer or OCR) grouped into lines and cells.
// items: [{ text, x, y, width, height }] with y growing downwards.
export const positionedItemsToRows = (items) => {
  const words = items
    .map((item) => ({ ...item, text: String(item.text ?? '').replace(/\s+/g, ' ') }))
    .filter((item) => item.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines = [];
  words.forEach((word) => {
    const height = word.height || 10;
    const middle = word.y + height / 2;
    const line = lines.slice(-4).find((candidate) => Math.abs(candidate.middle - middle) < Math.max(2, Math.min(candidate.height, height) * 0.5));
    if (line) {
      line.words.push(word);
      line.middle = (line.middle * (line.words.length - 1) + middle) / line.words.length;
    } else {
      lines.push({ middle, height, words: [word] });
    }
  });

  return lines
    .sort((a, b) => a.middle - b.middle)
    .map((line) => {
      const sorted = line.words.sort((a, b) => a.x - b.x);
      const cells = [];
      sorted.forEach((word) => {
        const previous = cells[cells.length - 1];
        const gap = previous ? word.x - previous.x2 : Infinity;
        const threshold = Math.max(3, (word.height || line.height || 10) * 0.55);
        if (previous && gap < threshold) {
          previous.text = `${previous.text}${gap > 0.5 && !previous.text.endsWith(' ') && !word.text.startsWith(' ') ? ' ' : ''}${word.text}`;
          previous.x2 = Math.max(previous.x2, word.x + (word.width || 0));
        } else {
          cells.push({ text: word.text, x: word.x, x2: word.x + (word.width || 0) });
        }
      });
      return cells.map((cell) => ({ ...cell, text: cell.text.trim() })).filter((cell) => cell.text);
    })
    .filter((row) => row.length > 0);
};

// Word documents: tables become rows, other paragraphs become single-cell rows.
export const docxXmlToRows = (xml) => {
  const rows = [];
  let row = null;
  let cell = null;
  let paragraph = '';
  let depth = 0;
  const decode = (value) => value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  const tokens = String(xml).match(/<w:tbl\b[^>]*>|<\/w:tbl>|<w:tr\b[^>]*>|<\/w:tr>|<w:tc\b[^>]*>|<\/w:tc>|<w:p\b[^>]*\/>|<w:p\b[^>]*>|<\/w:p>|<w:t\b[^>]*\/>|<w:t\b[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || [];
  tokens.forEach((token) => {
    if (token.startsWith('<w:tbl')) depth += 1;
    else if (token === '</w:tbl>') depth -= 1;
    else if (token.startsWith('<w:tr')) row = [];
    else if (token === '</w:tr>') { if (row) rows.push(row); row = null; }
    else if (token.startsWith('<w:tc')) cell = [];
    else if (token === '</w:tc>') { if (row && cell) row.push(cell.join('\n')); cell = null; }
    else if (token.startsWith('<w:p') && token.endsWith('/>')) { /* empty paragraph */ }
    else if (token.startsWith('<w:p')) paragraph = '';
    else if (token === '</w:p>') {
      if (depth > 0 && cell) cell.push(paragraph);
      else if (paragraph.trim()) rows.push(paragraph.split('\t').map((part) => part.trim()).filter(Boolean));
      paragraph = '';
    } else if (token === '<w:tab/>') paragraph += '\t';
    else if (token === '<w:br/>') paragraph += '\n';
    else if (token.startsWith('<w:t')) paragraph += decode(token.replace(/<[^>]+>/g, ''));
  });
  return rows;
};
