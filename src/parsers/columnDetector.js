// Works out which column is which, by header name first and then by what's in the cells.
// Columns found from their contents are marked as guesses so the student can check them.
const FIELD_HEADERS = {
  courseName: /^(course|subject|class|module)(\s*(name|title))?$|^(course\s*)?code$/i,
  section: /^(section|sec|group|batch|class\s*(group|section)|section\s*name|programm?e?|semester|sem)$/i,
  day: /^(day|days|day\s*name|week\s*day|weekday)$/i,
  startTime: /^(start(\s*time)?|from|time\s*from|begin(\s*time)?|class\s*start)$/i,
  endTime: /^(end(\s*time)?|to|time\s*to|finish(\s*time)?|class\s*end)$/i,
  instructor: /^(instructor|teacher|faculty|prof|professor|lecturer|staff|taught\s*by)(\s*name)?$/i,
  room: /^(room|venue|location|class\s*room|classroom|room\s*(no|number)|hall|lab|building|place)$/i,
  credits: /^(credits?|credit\s*hours?|cr|ch|hours?|units?)$/i
};

// A single "8:30 AM - 9:50 AM" column is both start and end.
const COMBINED_TIME = /^(time|timings?|schedule|period|slot|time\s*slot)$/i;

const DAY_VALUE = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i;
const TIME_VALUE = /^\d{1,2}[:.]\d{2}\s*([ap]\.?m\.?)?$/i;
const RANGE_VALUE = /^\d{1,2}[:.]\d{2}\s*([ap]\.?m\.?)?\s*(-|–|to)\s*\d{1,2}[:.]\d{2}\s*([ap]\.?m\.?)?$/i;
const SAMPLE_ROWS = 30;
const TIME_FIELDS = ['startTime', 'endTime'];
const MIN_SHARE = 0.6;

// How many of the first filled cells match `pattern` (0 to 1).
const shareMatching = (rows, header, pattern) => {
  const values = rows.slice(0, SAMPLE_ROWS).map((row) => String(row[header] ?? '').trim()).filter(Boolean);
  return values.length ? values.filter((value) => pattern.test(value)).length / values.length : 0;
};

export const autoDetectColumnMapping = (headers, rows = []) => {
  const mapping = {};
  const guessed = [];
  const used = new Set();
  const take = (header, field) => { mapping[field] = header; used.add(header); };
  const free = () => headers.filter((header) => !used.has(header));
  const byValues = (pattern) => free().filter((header) => shareMatching(rows, header, pattern) >= MIN_SHARE);

  // "Hours" could be credits or times; the cells decide.
  const isTimeColumn = (header) => shareMatching(rows, header, RANGE_VALUE) >= MIN_SHARE;
  Object.entries(FIELD_HEADERS).forEach(([field, pattern]) => {
    const header = free().find((item) => pattern.test(item.trim()) && (TIME_FIELDS.includes(field) || !isTimeColumn(item)));
    if (header) take(header, field);
  });

  if (!mapping.startTime && !mapping.endTime) {
    const header = free().find((item) => COMBINED_TIME.test(item.trim())) || byValues(RANGE_VALUE)[0];
    if (header) {
      Object.assign(mapping, { startTime: header, endTime: header, _combinedTime: header });
      used.add(header);
      if (!COMBINED_TIME.test(header.trim())) guessed.push('startTime');
    }
  }

  if (!mapping.day) {
    const [header] = byValues(DAY_VALUE);
    if (header) { take(header, 'day'); guessed.push('day'); }
  }

  if (!mapping.startTime) {
    const [first, second] = byValues(TIME_VALUE);
    if (first) { take(first, 'startTime'); guessed.push('startTime'); }
    if (second && !mapping.endTime) { take(second, 'endTime'); guessed.push('endTime'); }
  }

  return { mapping, guessed };
};
