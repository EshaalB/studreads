/**
 * Auto-detect column mapping from flat table header names.
 * Matches common header variations used in university timetable spreadsheets.
 * Returns a mapping object: { courseName, section, day, startTime, endTime, instructor, room, credits }
 */

// Each field has a list of patterns (case-insensitive) to match against header names
const FIELD_PATTERNS = {
  courseName: [
    /^course\s*name$/i,
    /^course$/i,
    /^subject\s*name$/i,
    /^subject$/i,
    /^course\s*title$/i,
    /^class\s*name$/i,
    /^class$/i,
    /^module$/i,
    /^module\s*name$/i,
    /^course\s*code$/i,
    /^code$/i,
  ],
  section: [
    /^section$/i,
    /^sec$/i,
    /^group$/i,
    /^batch$/i,
    /^class\s*group$/i,
    /^class\s*section$/i,
    /^section\s*name$/i,
    /^program$/i,
    /^programme$/i,
    /^semester$/i,
    /^sem$/i,
  ],
  day: [
    /^day$/i,
    /^day\s*name$/i,
    /^days$/i,
    /^week\s*day$/i,
    /^weekday$/i,
  ],
  startTime: [
    /^start\s*time$/i,
    /^start$/i,
    /^from$/i,
    /^time\s*from$/i,
    /^begin$/i,
    /^begin\s*time$/i,
    /^class\s*start$/i,
  ],
  endTime: [
    /^end\s*time$/i,
    /^end$/i,
    /^to$/i,
    /^time\s*to$/i,
    /^finish$/i,
    /^finish\s*time$/i,
    /^class\s*end$/i,
  ],
  instructor: [
    /^instructor$/i,
    /^teacher$/i,
    /^faculty$/i,
    /^prof$/i,
    /^professor$/i,
    /^lecturer$/i,
    /^instructor\s*name$/i,
    /^teacher\s*name$/i,
    /^faculty\s*name$/i,
    /^taught\s*by$/i,
    /^staff$/i,
  ],
  room: [
    /^room$/i,
    /^venue$/i,
    /^location$/i,
    /^class\s*room$/i,
    /^classroom$/i,
    /^room\s*no$/i,
    /^room\s*number$/i,
    /^hall$/i,
    /^lab$/i,
    /^building$/i,
    /^place$/i,
  ],
  credits: [
    /^credits?$/i,
    /^credit\s*hours?$/i,
    /^cr$/i,
    /^ch$/i,
    /^hours?$/i,
    /^units?$/i,
  ],
};

// Special case: a single "Time" column that might contain "8:30 AM - 9:50 AM"
const COMBINED_TIME_PATTERNS = [
  /^time$/i,
  /^timing$/i,
  /^timings$/i,
  /^schedule$/i,
  /^period$/i,
  /^slot$/i,
  /^time\s*slot$/i,
];

export const autoDetectColumnMapping = (headers) => {
  const mapping = {};
  const usedHeaders = new Set();

  // First pass: match exact field patterns
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const trimmed = header.trim();
      if (patterns.some(p => p.test(trimmed))) {
        mapping[field] = header; // Use original header as key (sheet_to_json uses original header names)
        usedHeaders.add(header);
        break;
      }
    }
  }

  // If we didn't find startTime/endTime but find a combined "Time" header, use it for both
  if (!mapping.startTime && !mapping.endTime) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const trimmed = header.trim();
      if (COMBINED_TIME_PATTERNS.some(p => p.test(trimmed))) {
        mapping.startTime = header;
        mapping.endTime = header;
        mapping._combinedTime = header; // Flag for the context to split
        usedHeaders.add(header);
        break;
      }
    }
  }

  return mapping;
};
