import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXCLUDED_COURSES } from '../utils/constants';
import { COLOR_THEMES, getThemeColors } from '../utils/themes';
import { parseTime } from '../utils/timeUtils';
import { sanitizeObject, sanitizeString, validateSection } from '../utils/validation';
import { TimetableContext } from './useTimetable';

const STORAGE_KEYS = {
  display: 'timetable_display_v6',
  colors: 'timetable_colors_v6',
  theme: 'timetable_theme_v6',
  editedClasses: 'timetable_edited_classes_v6',
  selectedCourses: 'timetable_selected_v6',
  extraSelections: 'timetable_extra_v6',
  activeSection: 'timetable_section_v6',
  source: 'timetable_source_v6'
};

const DEFAULT_DISPLAY = {
  title: '',
  showTeacher: true,
  showRoom: true,
  showCredits: false,
  showSection: false,
  timeFormat: '12h',
  view: 'list'
};

const MANUAL_MAPPING = {
  courseName: 'courseName', section: 'section', day: 'day',
  startTime: 'startTime', endTime: 'endTime', instructor: 'instructor',
  room: 'room', credits: 'credits'
};

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === typeof fallback ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key, value) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or disabled; the app keeps working for this visit.
  }
};

const findSections = (data, mapping) => {
  const sectionCol = mapping.section;
  const roots = new Set();
  if (sectionCol) {
    data.forEach(item => {
      const value = item[sectionCol]?.toString().trim();
      if (value && validateSection(value)) roots.add(sanitizeString(value));
    });
  } else {
    roots.add('All');
  }
  return [...roots].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};

export const TimetableProvider = ({ children }) => {
  // An uploaded timetable is kept so a refresh does not lose the student's work.
  const [savedSource] = useState(() => readStored(STORAGE_KEYS.source, null));
  const [rawData, setRawData] = useState(() => (Array.isArray(savedSource?.data) ? savedSource.data : []));
  const [columnMapping, setColumnMapping] = useState(() => savedSource?.mapping || {});
  const [sourceMeta, setSourceMeta] = useState(() => savedSource?.meta || null);
  const [isManual, setIsManual] = useState(false);
  const [rootSections, setRootSections] = useState(() => (savedSource ? findSections(savedSource.data || [], savedSource.mapping || {}) : []));
  const [activeSection, setActiveSection] = useState(() => (savedSource ? readStored(STORAGE_KEYS.activeSection, '') : ''));

  const [selectedCourseIds, setSelectedCourseIds] = useState(() => readStored(STORAGE_KEYS.selectedCourses, []));
  const [extraSelections, setExtraSelections] = useState(() => readStored(STORAGE_KEYS.extraSelections, []));
  const [editedClasses, setEditedClasses] = useState(() => readStored(STORAGE_KEYS.editedClasses, {}));
  const [selectedTheme, setSelectedTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.theme) || COLOR_THEMES[0].id;
    } catch {
      return COLOR_THEMES[0].id;
    }
  });
  const [displayOptions, setDisplayOptions] = useState(() => ({ ...DEFAULT_DISPLAY, ...readStored(STORAGE_KEYS.display, {}) }));
  const [colorMap, setColorMap] = useState(() => readStored(STORAGE_KEYS.colors, {}));

  useEffect(() => writeStored(STORAGE_KEYS.selectedCourses, selectedCourseIds), [selectedCourseIds]);
  useEffect(() => writeStored(STORAGE_KEYS.extraSelections, extraSelections), [extraSelections]);
  useEffect(() => writeStored(STORAGE_KEYS.editedClasses, editedClasses), [editedClasses]);
  useEffect(() => writeStored(STORAGE_KEYS.display, displayOptions), [displayOptions]);
  useEffect(() => writeStored(STORAGE_KEYS.colors, colorMap), [colorMap]);
  useEffect(() => writeStored(STORAGE_KEYS.activeSection, activeSection), [activeSection]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.theme, selectedTheme);
    } catch {
      // Not critical.
    }
  }, [selectedTheme]);

  const processData = useCallback((data, mapping, meta = null) => {
    const sanitizedData = Array.isArray(data) ? data.map(item => sanitizeObject(item)) : [];
    // Keep internal keys like _combinedTime in the mapping (sanitizeObject would strip them)
    const sanitizedMapping = { ...sanitizeObject(mapping) };
    if (mapping._combinedTime) sanitizedMapping._combinedTime = mapping._combinedTime;

    setRawData(sanitizedData);
    setColumnMapping(sanitizedMapping);
    setSourceMeta(meta);
    setIsManual(false);
    setRootSections(findSections(sanitizedData, sanitizedMapping));
    setActiveSection('');
    setSelectedCourseIds([]);
    setExtraSelections([]);
    writeStored(STORAGE_KEYS.source, { data: sanitizedData, mapping: sanitizedMapping, meta });
  }, []);

  const loadManualTimetable = useCallback((entries = []) => {
    const normalized = entries.map((item) => ({
      courseName: sanitizeString(item.courseName || ''),
      section: 'My timetable',
      day: sanitizeString(item.day || ''),
      startTime: sanitizeString(item.startTime || ''),
      endTime: sanitizeString(item.endTime || ''),
      instructor: sanitizeString(item.instructor || ''),
      room: sanitizeString(item.room || ''),
      credits: sanitizeString(item.credits || '')
    })).filter((item) => item.courseName && item.day && item.startTime && item.endTime);

    setRawData(normalized);
    setColumnMapping(MANUAL_MAPPING);
    setSourceMeta(null);
    setIsManual(true);
    setRootSections(normalized.length ? ['My timetable'] : []);
    setActiveSection(normalized.length ? 'My timetable' : '');
    writeStored(STORAGE_KEYS.source, undefined);

    const firstIdByCourse = new Map();
    normalized.forEach((item, index) => {
      if (!firstIdByCourse.has(item.courseName)) {
        firstIdByCourse.set(item.courseName, `${item.courseName}-${item.day}-${item.startTime}-${index}`);
      }
    });
    setSelectedCourseIds([...firstIdByCourse.values()]);
    setExtraSelections([]);
  }, []);

  const currentThemeColors = useMemo(() => getThemeColors(selectedTheme), [selectedTheme]);

  const getOrAssignColor = useCallback((name) => {
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName) return currentThemeColors[0];

    if (colorMap[sanitizedName]) return colorMap[sanitizedName];
    const hash = [...sanitizedName].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
    return currentThemeColors[hash % currentThemeColors.length];
  }, [colorMap, currentThemeColors]);

  const getCoursesForSection = useCallback((section) => {
    if (!section || !rawData.length) return [];

    const sanitizedSection = sanitizeString(section).toUpperCase();
    const sectionCol = columnMapping.section;
    const hasCombinedTime = columnMapping._combinedTime && columnMapping.startTime === columnMapping.endTime;

    return rawData
      .filter(item => {
        // If no section column mapped, all items match (they were assigned 'All')
        if (!sectionCol) return true;
        const itemSection = sanitizeString(item[sectionCol]?.toString() || '').toUpperCase();
        return itemSection && (itemSection === sanitizedSection || itemSection === 'ALL');
      })
      .filter(item => {
        const name = sanitizeString(item[columnMapping.courseName]?.toString() || '').toUpperCase();
        return name.length > 0 && !EXCLUDED_COURSES.some(word => name.includes(word));
      })
      .map((item, idx) => {
        let startTime = '';
        let endTime = '';

        if (hasCombinedTime) {
          // Split combined time like "8:30 AM - 9:50 AM" or "8:30 AM to 9:50 AM"
          const timeVal = sanitizeString(item[columnMapping.startTime]?.toString() || '');
          const parts = timeVal.split(/\s*(?:-|–|to|TO|To)\s*/i);
          startTime = parts[0]?.trim() || '';
          endTime = parts[1]?.trim() || '';
        } else {
          startTime = columnMapping.startTime ? sanitizeString(item[columnMapping.startTime]?.toString() || '') : '';
          endTime = columnMapping.endTime ? sanitizeString(item[columnMapping.endTime]?.toString() || '') : '';
        }

        const courseName = sanitizeString(item[columnMapping.courseName]?.toString() || '');
        const day = columnMapping.day ? sanitizeString(item[columnMapping.day]?.toString() || '') : '';

        return {
          id: `${courseName}-${day}-${startTime}-${idx}`,
          name: courseName,
          section: sectionCol ? sanitizeString(item[sectionCol]?.toString() || '') : 'All',
          day: day,
          startTime: startTime,
          endTime: endTime,
          teacher: columnMapping.instructor ? sanitizeString(item[columnMapping.instructor]?.toString() || '') : '',
          room: columnMapping.room ? sanitizeString(item[columnMapping.room]?.toString() || '') : '',
          credits: columnMapping.credits ? sanitizeString(item[columnMapping.credits]?.toString() || '') : ''
        };
      });
  }, [rawData, columnMapping]);

  const finalActiveClasses = useMemo(() => {
    const list = [];

    if (activeSection) {
      const activeCourses = getCoursesForSection(activeSection);
      selectedCourseIds.forEach(id => {
        const match = activeCourses.find(c => c.id === id);
        if (match) {
          list.push(...activeCourses.filter(c => c.name === match.name));
        }
      });
    }

    extraSelections.forEach(sel => {
      if (sel.section && sel.courseId) {
        const courses = getCoursesForSection(sel.section);
        const match = courses.find(c => c.id === sel.courseId);
        if (match) {
          list.push(...courses.filter(c => c.name === match.name));
        }
      }
    });

    return list.map(cls => {
      const editKey = `${cls.day}-${cls.startTime}-${cls.name}`;
      const edits = editedClasses[editKey];
      return edits ? { ...cls, ...edits, editKey } : { ...cls, editKey };
    });
  }, [activeSection, selectedCourseIds, extraSelections, getCoursesForSection, editedClasses]);

  const conflicts = useMemo(() => {
    const conflictSet = new Set();
    const classes = finalActiveClasses;
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        const c1 = classes[i];
        const c2 = classes[j];
        if (c1.day === c2.day) {
          const s1 = parseTime(c1.startTime);
          const e1 = parseTime(c1.endTime);
          const s2 = parseTime(c2.startTime);
          const e2 = parseTime(c2.endTime);

          if (s1 !== null && e1 !== null && s2 !== null && e2 !== null) {
            if (s1 < e2 && e1 > s2) {
              conflictSet.add(c1.id);
              conflictSet.add(c2.id);
            }
          }
        }
      }
    }
    return conflictSet;
  }, [finalActiveClasses]);

  const updateClassField = useCallback((classKey, field, value) => {
    setEditedClasses(prev => ({
      ...prev,
      [classKey]: {
        ...prev[classKey],
        [field]: sanitizeString(value)
      }
    }));
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedCourseIds([]);
    setExtraSelections([]);
  }, []);

  const value = {
    rawData,
    sourceMeta,
    isManual,
    rootSections,
    activeSection,
    setActiveSection,
    selectedCourseIds,
    setSelectedCourseIds,
    extraSelections,
    setExtraSelections,
    finalActiveClasses,
    conflicts,
    displayOptions,
    setDisplayOptions,
    colorMap,
    setColorMap,
    selectedTheme,
    setSelectedTheme,
    editedClasses,
    setEditedClasses,
    updateClassField,
    processData,
    loadManualTimetable,
    getCoursesForSection,
    getOrAssignColor,
    clearAllSelections,
    COLOR_THEMES
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
};
