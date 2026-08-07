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
  extraSelections: 'timetable_extra_v6'
};

const safeParseJSON = (str, defaultValue) => {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const TimetableProvider = ({ children }) => {
  const [rawData, setRawData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [rootSections, setRootSections] = useState([]);
  const [activeSection, setActiveSection] = useState('');

  const [selectedCourseIds, setSelectedCourseIds] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.selectedCourses);
    return saved ? safeParseJSON(saved, []) : [];
  });
  const [extraSelections, setExtraSelections] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.extraSelections);
    return saved ? safeParseJSON(saved, []) : [];
  });
  const [editedClasses, setEditedClasses] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.editedClasses);
    return saved ? safeParseJSON(saved, {}) : {};
  });
  const [selectedTheme, setSelectedTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    return saved || COLOR_THEMES[0].id;
  });

  const [displayOptions, setDisplayOptions] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.display);
    const defaultOptions = {
      showTeacher: true,
      showCredits: false,
      showSection: false
    };
    return saved ? safeParseJSON(saved, defaultOptions) : defaultOptions;
  });

  const [colorMap, setColorMap] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.colors);
    return saved ? safeParseJSON(saved, {}) : {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.selectedCourses, JSON.stringify(selectedCourseIds));
  }, [selectedCourseIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.extraSelections, JSON.stringify(extraSelections));
  }, [extraSelections]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.theme, selectedTheme);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  }, [selectedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.editedClasses, JSON.stringify(editedClasses));
    } catch (error) {
      console.warn('Failed to save edited classes:', error);
    }
  }, [editedClasses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.display, JSON.stringify(displayOptions));
    } catch (error) {
      console.warn('Failed to save display options:', error);
    }
  }, [displayOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.colors, JSON.stringify(colorMap));
    } catch (error) {
      console.warn('Failed to save color map:', error);
    }
  }, [colorMap]);

  const processData = useCallback((data, mapping) => {
    const sanitizedData = Array.isArray(data) ? data.map(item => sanitizeObject(item)) : [];
    // Keep internal keys like _combinedTime in the mapping (sanitizeObject would strip them)
    const sanitizedMapping = { ...sanitizeObject(mapping) };
    if (mapping._combinedTime) sanitizedMapping._combinedTime = mapping._combinedTime;

    setRawData(sanitizedData);
    setColumnMapping(sanitizedMapping);

    const sectionCol = sanitizedMapping.section;
    const rootsSet = new Set();

    if (sectionCol) {
      // Section column exists: discover unique section values
      sanitizedData.forEach(item => {
        const val = item[sectionCol]?.toString().trim();
        if (val && validateSection(val)) {
          rootsSet.add(sanitizeString(val));
        }
      });
    } else {
      // No section column: use a default "All Courses" section
      rootsSet.add('All');
    }

    const sortedRoots = Array.from(rootsSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    setRootSections(sortedRoots);
    setActiveSection('');
    setSelectedCourseIds([]);
    setExtraSelections([]);
  }, []);

  const loadSharedTimetable = useCallback((classes = []) => {
    const normalized = classes.map((item) => ({
      courseName: sanitizeString(item.name || item.courseName || ''),
      section: 'Shared timetable',
      day: sanitizeString(item.day || ''),
      startTime: sanitizeString(item.startTime || ''),
      endTime: sanitizeString(item.endTime || ''),
      instructor: sanitizeString(item.teacher || item.instructor || ''),
      room: sanitizeString(item.room || ''),
      credits: sanitizeString(item.credits || '')
    })).filter((item) => item.courseName && item.day);

    const mapping = {
      courseName: 'courseName', section: 'section', day: 'day',
      startTime: 'startTime', endTime: 'endTime', instructor: 'instructor',
      room: 'room', credits: 'credits'
    };

    setRawData(normalized);
    setColumnMapping(mapping);
    setRootSections(['Shared timetable']);
    setActiveSection('Shared timetable');

    const firstIdByCourse = new Map();
    normalized.forEach((item, index) => {
      if (!firstIdByCourse.has(item.courseName)) {
        firstIdByCourse.set(item.courseName, `${item.courseName}-${item.day}-${item.startTime}-${index}`);
      }
    });
    setSelectedCourseIds([...firstIdByCourse.values()]);
    setExtraSelections([]);
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

    const mapping = {
      courseName: 'courseName', section: 'section', day: 'day',
      startTime: 'startTime', endTime: 'endTime', instructor: 'instructor',
      room: 'room', credits: 'credits'
    };

    setRawData(normalized);
    setColumnMapping(mapping);
    setRootSections(normalized.length ? ['My timetable'] : []);
    setActiveSection(normalized.length ? 'My timetable' : '');

    const firstIdByCourse = new Map();
    normalized.forEach((item, index) => {
      if (!firstIdByCourse.has(item.courseName)) {
        firstIdByCourse.set(item.courseName, `${item.courseName}-${item.day}-${item.startTime}-${index}`);
      }
    });
    setSelectedCourseIds([...firstIdByCourse.values()]);
    setExtraSelections([]);
  }, []);

  const currentThemeColors = useMemo(() => {
    return getThemeColors(selectedTheme);
  }, [selectedTheme]);

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
      return edits ? { ...cls, ...edits } : cls;
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
    colorMap,
    selectedTheme,
    setSelectedTheme,
    editedClasses,
    updateClassField,
    processData,
    loadSharedTimetable,
    loadManualTimetable,
    getCoursesForSection,
    getOrAssignColor,
    setDisplayOptions,
    setColorMap,
    clearAllSelections,
    COLOR_THEMES
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
};
