const FIELD_ALIASES = {
  subject: ['subject', 'subject name', 'course', 'course name', 'paper', 'paper title', 'module', 'module name'],
  code: ['code', 'course code', 'subject code', 'paper code', 'module code'],
  date: ['date', 'exam date', 'examination date'],
  day: ['day', 'exam day'],
  time: ['time', 'exam time', 'timing', 'slot', 'session'],
  startTime: ['start time', 'from', 'starts'],
  endTime: ['end time', 'to', 'ends'],
  room: ['room', 'venue', 'location', 'hall', 'exam hall'],
  program: ['program', 'programme', 'degree', 'semester', 'class']
};

const DATE_PATTERNS = [
  /\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/,
  /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i
];

const TIME_PATTERN = /\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.M\.?|P\.M\.?)?(?:\s*(?:-|to|–)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.M\.?|P\.M\.?)?)?\b/i;
const DAY_PATTERN = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i;

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const toIsoDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const normalizeExamDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const text = clean(value);
  if (!text) return '';
  const numeric = text.match(DATE_PATTERNS[0]);
  if (numeric) {
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    return toIsoDate(year, Number(numeric[2]), Number(numeric[1]));
  }

  if (DATE_PATTERNS.slice(1).some((pattern) => pattern.test(text))) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return '';
};

const getDay = (value, isoDate) => {
  const explicit = clean(value).match(DAY_PATTERN)?.[1];
  if (explicit) return explicit.slice(0, 3).toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
  if (!isoDate) return '';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
};

const detectHeader = (matrix) => {
  let best = null;
  matrix.slice(0, 30).forEach((row, rowIndex) => {
    const mapping = {};
    row.forEach((cell, columnIndex) => {
      const normalized = key(cell);
      Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
        if (mapping[field] === undefined && aliases.includes(normalized)) mapping[field] = columnIndex;
      });
    });
    const score = Object.keys(mapping).length + (mapping.subject !== undefined ? 2 : 0) + (mapping.date !== undefined ? 2 : 0);
    if (!best || score > best.score) best = { rowIndex, mapping, score };
  });
  return best?.score >= 4 ? best : null;
};

const makeRecord = (values, source, index) => {
  const subject = clean(values.subject);
  const code = clean(values.code);
  const date = normalizeExamDate(values.date);
  const start = clean(values.startTime);
  const end = clean(values.endTime);
  const time = clean(values.time) || [start, end].filter(Boolean).join(' to ');
  if ((!subject && !code) || !date) return null;

  return {
    id: `${source}-${date}-${code || subject}-${index}`,
    subject: subject || code,
    code,
    date,
    day: getDay(values.day, date),
    time,
    room: clean(values.room),
    program: clean(values.program),
    source
  };
};

const parseMappedRows = (matrix, header, source) => matrix
  .slice(header.rowIndex + 1)
  .map((row, index) => {
    const values = {};
    Object.entries(header.mapping).forEach(([field, columnIndex]) => { values[field] = row[columnIndex]; });
    return makeRecord(values, source, index);
  })
  .filter(Boolean);

const parseLooseRows = (matrix, source) => matrix.map((row, index) => {
  const cells = row.map(clean).filter(Boolean);
  const dateCell = cells.find((cell) => normalizeExamDate(cell));
  if (!dateCell) return null;
  const timeCell = cells.find((cell) => cell !== dateCell && TIME_PATTERN.test(cell));
  const dayCell = cells.find((cell) => DAY_PATTERN.test(cell));
  const codeCell = cells.find((cell) => /^(?=.*[A-Z])(?=.*\d)[A-Z0-9][A-Z0-9 ./-]{2,14}$/i.test(cell));
  const ignored = new Set([dateCell, timeCell, dayCell, codeCell].filter(Boolean));
  const subject = cells.filter((cell) => !ignored.has(cell)).sort((a, b) => b.length - a.length)[0] || '';
  return makeRecord({ subject, code: codeCell, date: dateCell, day: dayCell, time: timeCell }, source, index);
}).filter(Boolean);

const dedupeAndSort = (records) => {
  const seen = new Set();
  return records.filter((record) => {
    const identity = `${record.date}|${record.time}|${record.code}|${record.subject}`.toLowerCase();
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.subject.localeCompare(b.subject));
};

export const parseExamMatrix = (matrix, source = 'Uploaded file') => {
  if (!Array.isArray(matrix)) return [];
  const normalized = matrix.filter(Array.isArray);
  const header = detectHeader(normalized);
  return dedupeAndSort(header ? parseMappedRows(normalized, header, source) : parseLooseRows(normalized, source));
};

export const parseExamWorkbook = (XLSX, workbook) => {
  const candidates = workbook.SheetNames.map((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
    return { sheetName, records: parseExamMatrix(matrix, sheetName) };
  }).filter((candidate) => candidate.records.length > 0)
    .sort((a, b) => b.records.length - a.records.length);

  if (candidates.length === 0) throw new Error('No dated exam rows were found in this workbook.');
  return {
    records: candidates[0].records,
    source: candidates[0].sheetName,
    warnings: candidates.length > 1 ? [`Found exam data on ${candidates.length} sheets and selected “${candidates[0].sheetName}”.`] : []
  };
};
