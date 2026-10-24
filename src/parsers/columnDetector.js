// Finds which header in a column-based timetable holds each detail, from the names
// universities commonly use. Each header is used for one detail at most.
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

// One "Time" column holding "8:30 AM - 9:50 AM" serves as both start and end.
const COMBINED_TIME = /^(time|timings?|schedule|period|slot|time\s*slot)$/i;

export const autoDetectColumnMapping = (headers) => {
  const mapping = {};
  const used = new Set();
  const take = (pattern) => headers.find((header) => !used.has(header) && pattern.test(header.trim()));

  Object.entries(FIELD_HEADERS).forEach(([field, pattern]) => {
    const header = take(pattern);
    if (header) { mapping[field] = header; used.add(header); }
  });

  if (!mapping.startTime && !mapping.endTime) {
    const header = take(COMBINED_TIME);
    if (header) Object.assign(mapping, { startTime: header, endTime: header, _combinedTime: header });
  }
  return mapping;
};
