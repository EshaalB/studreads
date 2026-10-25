import { EXCLUDED_COURSES } from '../utils/constants.js';
import { parseTime } from '../utils/timeUtils.js';
import { sanitizeString } from '../utils/validation.js';

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

// Times written inside a course cell, like "[1:00 to 3:00]" or "[2:30 to 4:20 & 4:30 to 5:20]",
// plus the teacher's name if it comes after the brackets.
const extractEmbeddedTimes = (text) => {
  const bracketMatch = text.match(/\[([^\]]+)\]\s*(.*)/);
  if (!bracketMatch) return null;

  const bracketContent = bracketMatch[1];
  const afterBracket = bracketMatch[2] ? bracketMatch[2].trim() : '';
  const timeRanges = [];

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
    // Teacher name after the brackets, minus any leftover times.
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



// Any "8:30-9:50", "8:15 AM-10:15 AM", "1:00 PM to 2:20 PM" or "(8:15- am-10:15 am )".
const TIME_RANGE = /(\d{1,2}[:.]\d{2})\s*-?\s*([ap]\.?\s?m\.?)?\s*(?:-|–|to)\s*(\d{1,2}[:.]\d{2})\s*([ap]\.?\s?m\.?)?/i;
const TEACHER_LINE = /^(mr|mrs|ms|miss|dr|prof|professor|engr|sir|madam)\b\.?/i;
const ROOM_LINE = /\b(room|venue)\b|#|^(lab|hall|auditorium)\b/i;
const SECTION_IN_PARENS = /\([A-Z]{2,5}-?\d[A-Z]?\d?\)/i;

const readTimeRange = (text) => {
  const match = String(text).match(TIME_RANGE);
  if (!match) return null;
  const withPeriod = (clock, period) => `${clock.replace('.', ':')}${period ? ` ${period.replace(/[.\s]/g, '').toUpperCase()}` : ''}`;
  return { start: withPeriod(match[1], match[2]), end: withPeriod(match[3], match[4]) };
};

// "VENUE-Room-B-11", "Room.# (9)", "Room # A-24" -> "B-11", "9", "A-24"
const readRoom = (line) => sanitizeString(line
  .replace(/^.*?\b(?:venue|room)\b\s*[.#:-]*\s*(?:room\s*[.#:-]*)?/i, '')
  .replace(/[()]/g, '')
  .replace(/^#\s*/, ''));

// Course, teacher, time and room on separate lines in one cell, in any order
// (PUCIT does this).
const readStackedCell = (text) => {
  const lines = text.split(/\n+/).map((line) => sanitizeString(line)).filter(Boolean);
  if (lines.length < 2) return null;
  const entry = { course: '', instructor: '', room: '', time: null };
  lines.forEach((line) => {
    const time = readTimeRange(line);
    if (time && !entry.time && line.replace(TIME_RANGE, '').replace(/[()\s-]/g, '').length < 3) entry.time = time;
    else if (ROOM_LINE.test(line) && !entry.room) entry.room = readRoom(line);
    else if (TEACHER_LINE.test(line) && !entry.instructor) entry.instructor = line;
    else if (!entry.course) entry.course = line;
    else if (!entry.instructor) entry.instructor = line;
  });
  return entry.course ? entry : null;
};

// A row like "BSCS F25 (III) Room # B-6" names the group for the rows below it.
const readGroupLabel = (text) => {
  const value = sanitizeString(text);
  if (!value || value.includes('\n') || !/room\s*[.#]/i.test(value)) return null;
  const [group, room = ''] = value.split(/room\s*[.#]+/i);
  return { group: sanitizeString(group), room: sanitizeString(room) };
};

const mergeSlots = (slots) => {
  if (slots.length <= 1) return slots;

  const groups = {};
  slots.forEach(slot => {
    const key = `${slot.courseName}|${slot.section}|${slot.instructor}|${slot.room}|${slot.day}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(slot);
  });

  const merged = [];
  Object.values(groups).forEach(group => {
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

        // Merge back-to-back slots of the same class (gap of 20 minutes or less).

        if (nextStart !== null && currentEnd !== null && nextStart <= currentEnd + 20) {
          if (nextEnd !== null && nextEnd > currentEnd) {
            current.endTime = slot.endTime;
          }
        } else {
          merged.push(current);
          current = { ...slot };
        }
      }
    });
    if (current) merged.push(current);
  });

  return merged;
};

export const parseHeuristicExcel = (jsonData, { sheetName = '' } = {}) => {
  if (!Array.isArray(jsonData)) return [];
  const rawResults = [];
  let currentDay = '';

  // Find the row with the time slots.
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
          TIME_RANGE.test(s) ||
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

  timeColumns.sort((a, b) => a.colIndex - b.colIndex);
  // There's only a room column if something sits between the day and the first slot.
  const hasRoomColumn = timeColumns[0].colIndex > 1;
  let group = null;

  for (let i = timeRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    // A new day starts in one of the first three columns.
    for (let col = 0; col < Math.min(row.length, 3); col++) {
      const cellText = sanitizeString(row[col]?.toString() || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (cellText && DAY_VARIANTS.includes(cellText)) {
        currentDay = DAY_MAP[cellText] || '';
        break;
      }
    }

    if (!currentDay) continue;

    const slotCells = timeColumns.map((tc) => sanitizeString(row[tc.colIndex]?.toString() || '')).filter(Boolean);
    // A group label spread across all slots (merged cell) is a label, not a class.
    const label = slotCells.length > 0 && new Set(slotCells).size === 1 ? readGroupLabel(slotCells[0]) : null;
    if (label) { group = label; continue; }

    // Room from column 1 or 2.
    let room = hasRoomColumn ? sanitizeString(row[1]?.toString() || '') : '';
    if (hasRoomColumn && (!room || room.length < 2)) {
      room = sanitizeString(row[2]?.toString() || '');
    }
    if (!room && group?.room) room = group.room;

    if (['Room', 'Periods', 'Days', 'ROOM', 'PERIODS', 'DAYS'].includes(room)) continue;

    if (!room || room.length < 1) {
      room = 'TBD';
    }

    for (let tcIdx = 0; tcIdx < timeColumns.length; tcIdx++) {
      const tc = timeColumns[tcIdx];
      const nextTc = timeColumns[tcIdx + 1];

      const startCol = tc.colIndex;
      const endCol = nextTc ? nextTc.colIndex : row.length;

      for (let colIdx = startCol; colIdx < endCol; colIdx++) {
        const cellContent = row[colIdx];
        if (!cellContent) continue;

        const contentStr = sanitizeString(cellContent?.toString() || '');
        if (contentStr.length < 3) continue;

        // Stacked cell (no "Course (Section)" pattern).
        const stacked = SECTION_IN_PARENS.test(contentStr) ? null : readStackedCell(contentStr);
        if (stacked) {
          const time = stacked.time || readTimeRange(tc.range);
          if (!time || EXCLUDED_COURSES.some((word) => stacked.course.toUpperCase().includes(word))) continue;
          rawResults.push({
            courseName: stacked.course,
            section: sheetName || group?.group || 'All',
            instructor: stacked.instructor || 'N/A',
            room: stacked.room || room,
            day: currentDay,
            startTime: time.start,
            endTime: time.end,
            credits: ''
          });
          continue;
        }

        // Times written in the cell win over the column's time.
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

          const allParens = [...text.matchAll(/\(([^)]+)\)/g)];

          // The section is the bracket that looks like BFT-4A or BSBA-2F.
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

            const sectionStart = text.indexOf(sectionMatch[0]);
            course = sanitizeString(text.substring(0, sectionStart));

            // Teacher is whatever comes after the section.
            let afterSection = text.substring(sectionStart + sectionMatch[0].length).trim();

            afterSection = afterSection.replace(/^\s*:?\s*/, ''); // Remove leading colon
            let potentialInstructor = afterSection.replace(/\s*\[.*$/, '').trim(); // Remove time brackets

            // A "teacher" that is really a time range is dropped.
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
            // Fallback for cells that don't fit the pattern above.
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

          if (!course || course.length < 2) return;

          // One entry per time range: from the cell if it has times, otherwise the column header.
          const timeRangesToUse = [];

          if (embeddedTimes && embeddedTimes.times.length > 0) {
            embeddedTimes.times.forEach(t => {
              timeRangesToUse.push({ start: t.start, end: t.end });
            });
          } else {
            const timeRange = sanitizeString(tc.range)
              .replace(/\.+$/, '') // Remove trailing periods
              .replace(/\s+/g, ' '); // Normalize whitespace

            const timeParts = timeRange.split(/\s*(?:to|TO|To|-)\s*/i);
            timeRangesToUse.push({
              start: sanitizeString(timeParts[0]),
              end: sanitizeString(timeParts[1] || '')
            });
          }

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
