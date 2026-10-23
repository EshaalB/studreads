// Reading classes out of an imported timetable file (rows plus a column mapping).
import { EXCLUDED_COURSES } from './constants.js';
import { sanitizeString, validateSection } from './validation.js';

export const findSections = (data, mapping) => {
  const sectionCol = mapping.section;
  if (!sectionCol) return data.length ? ['All'] : [];
  const sections = new Set();
  data.forEach((item) => {
    const value = item[sectionCol]?.toString().trim();
    if (value && validateSection(value)) sections.add(sanitizeString(value));
  });
  return [...sections].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};

const cellText = (item, column) => (column ? sanitizeString(item[column]?.toString() || '') : '');

// Every class meeting for one section. Rows marked "All" belong to every section.
export const coursesForSection = (data, mapping, section) => {
  if (!section || !data.length) return [];
  const wanted = sanitizeString(section).toUpperCase();
  const combinedTime = mapping._combinedTime && mapping.startTime === mapping.endTime;

  return data
    .filter((item) => {
      if (!mapping.section) return true;
      const itemSection = cellText(item, mapping.section).toUpperCase();
      return itemSection === wanted || itemSection === 'ALL';
    })
    .filter((item) => {
      const name = cellText(item, mapping.courseName).toUpperCase();
      return name && !EXCLUDED_COURSES.some((word) => name.includes(word));
    })
    .map((item, index) => {
      let startTime = cellText(item, mapping.startTime);
      let endTime = cellText(item, mapping.endTime);
      if (combinedTime) {
        // "8:30 AM - 9:50 AM" in a single column
        [startTime = '', endTime = ''] = startTime.split(/\s*(?:-|–|to)\s*/i).map((part) => part.trim());
      }
      const name = cellText(item, mapping.courseName);
      const day = cellText(item, mapping.day);
      return {
        id: `${name}-${day}-${startTime}-${index}`,
        name,
        section: mapping.section ? cellText(item, mapping.section) : 'All',
        day,
        startTime,
        endTime,
        teacher: cellText(item, mapping.instructor),
        room: cellText(item, mapping.room),
        credits: cellText(item, mapping.credits)
      };
    });
};

// Rebuilds the classes picked with the previous version of the app (a section, ticked
// course ids, extra courses from other sections and inline edits).
export const legacySelectionToClasses = (data, mapping, { section, selectedIds = [], extras = [], edits = {} }) => {
  const picked = [];
  const pick = (sectionName, id) => {
    const courses = coursesForSection(data, mapping, sectionName);
    const match = courses.find((course) => course.id === id);
    if (match) picked.push(...courses.filter((course) => course.name === match.name));
  };
  if (section) selectedIds.forEach((id) => pick(section, id));
  extras.forEach((extra) => extra.section && extra.courseId && pick(extra.section, extra.courseId));
  return picked.map((cls) => ({ ...cls, ...(edits[`${cls.day}-${cls.startTime}-${cls.name}`] || {}) }));
};
