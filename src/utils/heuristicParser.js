import { EXCLUDED_COURSES } from './constants.js';
import { parseTime } from './timeUtils.js';
import { sanitizeString } from './validation.js';

const DAY_VARIANTS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const DAY_MAP = {
  'MONDAY': 'Monday', 'MON': 'Monday',
  'TUESDAY': 'Tuesday', 'TUE': 'Tuesday',
  'WEDNESDAY': 'Wednesday', 'WED': 'Wednesday',
  'THURSDAY': 'Thursday', 'THU': 'Thursday',
  'FRIDAY': 'Friday', 'FRI': 'Friday',
  'SATURDAY': 'Saturday', 'SAT': 'Saturday',
  'SUNDAY': 'Sunday', 'SUN': 'Sunday'
};

// Extract embedded time override(s) from course text like "[1:00 to 3:00]" or "[2:30 to 4:20 & 4:30 to 5:20]"
// Also extracts instructor name that appears after the time brackets
// Returns array of time ranges for handling multiple ranges in one course
const extractEmbeddedTimes = (text) => {
  // Match the entire bracket content including multiple ranges
  const bracketMatch = text.match(/\[([^\]]+)\]\s*(.*)/);
  if (!bracketMatch) return null;

  const bracketContent = bracketMatch[1];
  const afterBracket = bracketMatch[2] ? bracketMatch[2].trim() : '';
  const timeRanges = [];

  // Split by & or 'and' to handle multiple ranges
  const rangeParts = bracketContent.split(/\s*[&]\s*|\s+and\s+/i);

  rangeParts.forEach(part => {
    const timeMatch = part.match(/(\d{1,2}:\d{2})\s*(?:to|-)\s*(\d{1,2}:\d{2})/i);
    if (timeMatch) {
      timeRanges.push({
        start: timeMatch[1].trim(),
        end: timeMatch[2].trim()
      });
    }
  });

  if (timeRanges.length > 0) {
    // The instructor might be after the brackets
    // Clean it up - remove any remaining time patterns or special chars
    let instructorAfterBracket = afterBracket
      .replace(/^\s*:?\s*/, '') // Remove leading colon if any
      .replace(/\d{1,2}:\d{2}.*$/, '') // Remove any remaining time patterns
      .trim();

    return {
      times: timeRanges,
      instructorAfterBracket: instructorAfterBracket || null,
      cleanedText: text.replace(/\s*\[[^\]]+\]\s*.*$/, '').trim() // Remove brackets and everything after
    };
  }
  return null;
};



const mergeSlots = (slots) => {
  if (slots.length <= 1) return slots;

  // Group by unique identifiers excluding time
  const groups = {};
  slots.forEach(slot => {
    // Unique key: course, section, instructor, room, day
    const key = `${slot.courseName}|${slot.section}|${slot.instructor}|${slot.room}|${slot.day}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(slot);
  });

  const merged = [];
  Object.values(groups).forEach(group => {
    // Sort by start time (null values at the end)
    group.sort((a, b) => {
      const ta = parseTime(a.startTime);
      const tb = parseTime(b.startTime);
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta - tb;
    });

    let current = null;
    group.forEach(slot => {
      const nextStart = parseTime(slot.startTime);
      const nextEnd = parseTime(slot.endTime);

      if (!current) {
        current = { ...slot };
      } else {
        const currentEnd = parseTime(current.endTime);

        // MERGE CRITERIA:
        // 1. Overlapping (nextStart <= currentEnd)
        // 2. Adjacent with small gap (nextStart <= currentEnd + 20)
        // 3. One is missing time (if course and room match perfectly, we occasionally might merge, but usually time is key)

        if (nextStart !== null && currentEnd !== null && nextStart <= currentEnd + 20) {
          // It's a continuation. Extend the end time if the next one ends later.
          if (nextEnd !== null && nextEnd > currentEnd) {
            current.endTime = slot.endTime;
          }
        } else {
          // Not mergeable. Push current and start new.
          merged.push(current);
          current = { ...slot };
        }
      }
    });
    if (current) merged.push(current);
  });

  return merged;
};

export const parseHeuristicExcel = (jsonData) => {
  if (!Array.isArray(jsonData)) return [];
  const rawResults = [];
  let currentDay = '';

  // Find the row containing time ranges (e.g., "8:30 AM to 9:50 AM")
  let timeRowIndex = -1;
  let timeColumns = [];

  for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
    const row = jsonData[i];
    if (!row) continue;

    const potentialTimes = row.map((cell, idx) => ({ cell, idx }))
      .filter(item => {
        if (!item.cell) return false;
        const s = item.cell.toString().trim().toLowerCase();
        return s.includes('am to') || s.includes('pm to') ||
          s.includes('a.m') || s.includes('p.m') ||
          /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(s) ||
          /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(s);
      });

    if (potentialTimes.length >= 2) {
      timeRowIndex = i;
      timeColumns = potentialTimes.map(pt => ({
        colIndex: pt.idx,
        range: pt.cell.toString().trim()
      }));
      break;
    }
  }

  if (timeRowIndex === -1) return [];

  // Sort time columns by their index to enable proper processing
  timeColumns.sort((a, b) => a.colIndex - b.colIndex);

  for (let i = timeRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    // Check if this row starts a new day in columns 0-2.
    for (let col = 0; col < Math.min(row.length, 3); col++) {
      const cellText = sanitizeString(row[col]?.toString() || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (cellText && DAY_VARIANTS.includes(cellText)) {
        currentDay = DAY_MAP[cellText] || '';
        break;
      }
    }

    // Skip rows before we've found a day
    if (!currentDay) continue;

    // Extract room from column 1 or 2, use 'TBD' if not available
    let room = sanitizeString(row[1]?.toString() || '');
    if (!room || room.length < 2) {
      room = sanitizeString(row[2]?.toString() || '');
    }

    // Skip header-like rows but don't be too strict
    if (['Room', 'Periods', 'Days', 'ROOM', 'PERIODS', 'DAYS'].includes(room)) continue;

    // If room is still empty, use TBD but continue processing
    if (!room || room.length < 1) {
      room = 'TBD';
    }

    // Process each time slot column
    for (let tcIdx = 0; tcIdx < timeColumns.length; tcIdx++) {
      const tc = timeColumns[tcIdx];
      const nextTc = timeColumns[tcIdx + 1];

      // Determine the column range for this time slot
      const startCol = tc.colIndex;
      const endCol = nextTc ? nextTc.colIndex : row.length;

      // Check all cells in this time slot's column range
      for (let colIdx = startCol; colIdx < endCol; colIdx++) {
        const cellContent = row[colIdx];
        if (!cellContent) continue;

        const contentStr = sanitizeString(cellContent?.toString() || '');
        if (contentStr.length < 3) continue;

        // Check for embedded time override(s) - can be multiple like [2:30 to 4:20 & 4:30 to 5:20]
        const embeddedTimes = extractEmbeddedTimes(contentStr);
        const textToProcess = embeddedTimes ? embeddedTimes.cleanedText : contentStr;

        const rawLines = textToProcess.split(/\n+/).map(l => sanitizeString(l)).filter(Boolean);
        const processedEntries = [];
        let currentEntry = '';

        rawLines.forEach(line => {
          if (line.includes('(')) {
            if (currentEntry) processedEntries.push(currentEntry);
            currentEntry = line;
          } else {
            currentEntry = currentEntry ? currentEntry + ' ' + line : line;
          }
        });
        if (currentEntry) processedEntries.push(currentEntry);

        processedEntries.forEach(text => {
          let course = '';
          let section = 'All';
          let instructor = 'N/A';

          // Find all parentheses groups in the text
          const allParens = [...text.matchAll(/\(([^)]+)\)/g)];

          // Look for the parentheses that contains a section code pattern (like BFT-4A, BAF-2A, BSBA-2F)
          // Section codes typically have format: 2-4 letters + optional dash + numbers + optional letter
          const sectionPattern = /^[A-Z]{2,5}-?\d[A-Z]?\d?$/i;
          let sectionMatch = null;

          for (let i = allParens.length - 1; i >= 0; i--) {
            const content = allParens[i][1].trim();
            if (sectionPattern.test(content)) {
              sectionMatch = allParens[i];
              break;
            }
          }

          if (sectionMatch) {
            section = sanitizeString(sectionMatch[1]);

            // Extract course name - everything before the section parentheses
            const sectionStart = text.indexOf(sectionMatch[0]);
            course = sanitizeString(text.substring(0, sectionStart));

            // Extract instructor - everything after section parentheses (before time brackets if any)
            let afterSection = text.substring(sectionStart + sectionMatch[0].length).trim();

            // Remove time brackets and get instructor
            afterSection = afterSection.replace(/^\s*:?\s*/, ''); // Remove leading colon
            let potentialInstructor = afterSection.replace(/\s*\[.*$/, '').trim(); // Remove time brackets

            // If instructor looks like a time range (e.g. 8:30-9:50), it's probably wrong
            if (/^\d{1,2}:\d{2}/.test(potentialInstructor) || /^\[/.test(potentialInstructor)) {
              potentialInstructor = '';
            }

            // Check if instructor was found after time brackets (format: Course (Section) [times] Instructor)
            if (embeddedTimes && embeddedTimes.instructorAfterBracket && embeddedTimes.instructorAfterBracket.length > 1) {
              instructor = embeddedTimes.instructorAfterBracket;
            } else if (potentialInstructor && potentialInstructor.length > 1) {
              instructor = potentialInstructor;
            } else {
              instructor = 'N/A';
            }
          } else {
            // Fallback: try the original regex approach
            const fullMatch = text.match(/^(.+?)\s*\((.+?)\)\s*:?\s*(.*)$/);
            if (fullMatch) {
              course = sanitizeString(fullMatch[1]);
              section = sanitizeString(fullMatch[2]);
              let potentialInstructor = sanitizeString(fullMatch[3].replace(/^:\s*/, '')) || '';
              potentialInstructor = potentialInstructor.replace(/\[\d{1,2}:\d{2}.*$/, '').trim();

              if (/^\d{1,2}:\d{2}/.test(potentialInstructor) || /^\[/.test(potentialInstructor)) {
                potentialInstructor = '';
              }

              if (embeddedTimes && embeddedTimes.instructorAfterBracket && embeddedTimes.instructorAfterBracket.length > 1) {
                instructor = embeddedTimes.instructorAfterBracket;
              } else if (potentialInstructor && potentialInstructor.length > 1) {
                instructor = potentialInstructor;
              } else {
                instructor = 'N/A';
              }
            } else {
              course = sanitizeString(text);
            }
          }

          const courseUpper = course.toUpperCase();
          if (EXCLUDED_COURSES.some(word => courseUpper.includes(word))) return;

          // Skip empty courses
          if (!course || course.length < 2) return;

          // Determine times - use embedded times if available, otherwise use column header
          // If multiple time ranges exist, create separate entries for each
          const timeRangesToUse = [];

          if (embeddedTimes && embeddedTimes.times.length > 0) {
            // Use all embedded time ranges
            embeddedTimes.times.forEach(t => {
              timeRangesToUse.push({ start: t.start, end: t.end });
            });
          } else {
            // Parse time from header, handling formats like "1:00 PM to 2:20 PM."
            const timeRange = sanitizeString(tc.range)
              .replace(/\.+$/, '') // Remove trailing periods
              .replace(/\s+/g, ' '); // Normalize whitespace

            const timeParts = timeRange.split(/\s*(?:to|TO|To|-)\s*/i);
            timeRangesToUse.push({
              start: sanitizeString(timeParts[0]),
              end: sanitizeString(timeParts[1] || '')
            });
          }

          // Create a course entry for each time range
          timeRangesToUse.forEach(timeRange => {
            rawResults.push({
              courseName: course,
              section: section || 'All',
              instructor: instructor || 'N/A',
              room: room,
              day: currentDay,
              startTime: timeRange.start,
              endTime: timeRange.end,
              credits: ''
            });
          });
        });
      }
    }
  }


  return mergeSlots(rawResults);
};
