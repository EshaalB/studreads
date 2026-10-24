import { useCallback, useEffect, useMemo, useState } from 'react';
import { importClasses, newClassId, normalizeClass, validateClass } from '../utils/classes';
import { DAYS } from '../utils/constants';
import { COLOR_THEMES, getThemeColors } from '../utils/themes';
import { coursesForSection, findSections, legacySelectionToClasses } from '../utils/timetableSource';
import { readStored, writeStored } from '../utils/storage';
import { checkOverlap, parseTime } from '../utils/timeUtils';
import { sanitizeObject, sanitizeString } from '../utils/validation';
import { TimetableContext } from './useTimetable';

const KEYS = {
  classes: 'timetable_classes_v7',
  source: 'timetable_source_v6',
  section: 'timetable_section_v6',
  display: 'timetable_display_v6',
  colors: 'timetable_colors_v6',
  theme: 'timetable_theme_v6',
  // Older versions, read once to carry existing timetables over.
  legacyManual: 'timetable_manual_v1',
  legacySelected: 'timetable_selected_v6',
  legacyExtra: 'timetable_extra_v6',
  legacyEdits: 'timetable_edited_classes_v6'
};

const DEFAULT_DISPLAY = {
  title: '',
  showTeacher: true,
  showRoom: true,
  showCredits: false,
  showSection: false,
  timeFormat: '12h',
  view: 'grid',
  rowHeight: 'regular',
  blockStyle: 'filled'
};

const initialClasses = (source) => {
  const saved = readStored(KEYS.classes, null);
  if (Array.isArray(saved)) return saved.map(normalizeClass).filter((item) => item.id && validateClass(item).valid);
  const manual = readStored(KEYS.legacyManual, []);
  if (manual.length) return importClasses(manual);
  if (source?.data?.length) {
    return importClasses(legacySelectionToClasses(source.data, source.mapping || {}, {
      section: readStored(KEYS.section, ''),
      selectedIds: readStored(KEYS.legacySelected, []),
      extras: readStored(KEYS.legacyExtra, []),
      edits: readStored(KEYS.legacyEdits, {})
    }));
  }
  return [];
};

export const TimetableProvider = ({ children }) => {
  const [source, setSource] = useState(() => {
    const saved = readStored(KEYS.source, null);
    return saved && Array.isArray(saved.data) ? saved : null;
  });
  const [classes, setClasses] = useState(() => initialClasses(source));
  const [activeSection, setActiveSection] = useState(() => readStored(KEYS.section, ''));
  const [displayOptions, setDisplayOptions] = useState(() => ({ ...DEFAULT_DISPLAY, ...readStored(KEYS.display, {}) }));
  const [colorMap, setColorMap] = useState(() => readStored(KEYS.colors, {}));
  const [selectedTheme, setSelectedTheme] = useState(() => {
    const saved = readStored(KEYS.theme, '');
    return COLOR_THEMES.some((theme) => theme.id === saved) ? saved : COLOR_THEMES[0].id;
  });

  useEffect(() => writeStored(KEYS.classes, classes), [classes]);
  useEffect(() => writeStored(KEYS.section, activeSection), [activeSection]);
  useEffect(() => writeStored(KEYS.display, displayOptions), [displayOptions]);
  useEffect(() => writeStored(KEYS.colors, colorMap), [colorMap]);
  useEffect(() => writeStored(KEYS.theme, selectedTheme), [selectedTheme]);
  useEffect(() => {
    [KEYS.legacyManual, KEYS.legacySelected, KEYS.legacyExtra, KEYS.legacyEdits].forEach((key) => writeStored(key, null));
  }, []);

  // Imported timetable file -------------------------------------------------

  const loadSource = useCallback((data, mapping, meta) => {
    const cleanMapping = { ...sanitizeObject(mapping) };
    if (mapping._combinedTime) cleanMapping._combinedTime = mapping._combinedTime;
    const next = { data: data.map((row) => sanitizeObject(row)), mapping: cleanMapping, meta };
    setSource(next);
    setActiveSection('');
    writeStored(KEYS.source, next);
  }, []);

  // The imported file cut down to its mapped columns, small enough to share in a link.
  const shareableSource = useCallback(() => {
    if (!source?.data?.length) return null;
    const columns = [...new Set(Object.entries(source.mapping).filter(([key, column]) => !key.startsWith('_') && typeof column === 'string' && column).map(([, column]) => column))];
    return { name: source.meta?.name || '', mapping: source.mapping, columns, rows: source.data.map((row) => columns.map((column) => row[column] ?? '')) };
  }, [source]);

  const rootSections = useMemo(() => (source ? findSections(source.data, source.mapping) : []), [source]);
  const getCoursesForSection = useCallback((section) => (source ? coursesForSection(source.data, source.mapping, section) : []), [source]);

  // Every course in the file once per section, for searching across sections.
  const allCourses = useMemo(() => rootSections.flatMap((section) => {
    const seen = new Set();
    return getCoursesForSection(section).filter((course) => !seen.has(course.name) && seen.add(course.name))
      .map((course) => ({ name: course.name, section }));
  }), [rootSections, getCoursesForSection]);

  // The timetable ----------------------------------------------------------

  const sortedClasses = useMemo(() => [...classes].sort((a, b) =>
    (DAYS.indexOf(a.day) >>> 0) - (DAYS.indexOf(b.day) >>> 0) || (parseTime(a.startTime) ?? 0) - (parseTime(b.startTime) ?? 0)
  ), [classes]);

  const conflicts = useMemo(() => {
    const clashing = new Set();
    sortedClasses.forEach((a, index) => sortedClasses.slice(index + 1).forEach((b) => {
      if (checkOverlap(a, b)) {
        clashing.add(a.id);
        clashing.add(b.id);
      }
    }));
    return clashing;
  }, [sortedClasses]);

  const addClasses = useCallback((list) => setClasses((current) => [...current, ...list.map((item) => ({ ...item, id: item.id || newClassId() }))]), []);
  const updateClass = useCallback((id, values) => setClasses((current) => current.map((item) => (item.id === id ? { ...item, ...values, id } : item))), []);
  const removeClass = useCallback((id) => setClasses((current) => current.filter((item) => item.id !== id)), []);

  const isCourseAdded = useCallback((section, name) => classes.some((item) => item.name === name && item.section === section), [classes]);
  const toggleCourse = useCallback((section, name) => {
    if (isCourseAdded(section, name)) {
      setClasses((current) => current.filter((item) => !(item.name === name && item.section === section)));
    } else {
      addClasses(getCoursesForSection(section).filter((course) => course.name === name).map((course) => ({ ...course, id: newClassId() })));
    }
  }, [isCourseAdded, addClasses, getCoursesForSection]);

  const replaceTimetable = useCallback((list) => setClasses(list), []);

  // Colours ----------------------------------------------------------------

  const palette = useMemo(() => getThemeColors(selectedTheme), [selectedTheme]);
  const getOrAssignColor = useCallback((name) => {
    const key = sanitizeString(name);
    if (colorMap[key]) return colorMap[key];
    const hash = [...key].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
    return palette[hash % palette.length];
  }, [colorMap, palette]);
  const setCourseColor = useCallback((name, color) => setColorMap((current) => ({ ...current, [name]: color })), []);

  const value = {
    source: source?.meta || null,
    hasSource: Boolean(source?.data?.length),
    loadSource,
    shareableSource,
    rootSections,
    activeSection,
    setActiveSection,
    getCoursesForSection,
    allCourses,
    classes: sortedClasses,
    conflicts,
    addClasses,
    updateClass,
    removeClass,
    replaceTimetable,
    isCourseAdded,
    toggleCourse,
    displayOptions,
    setDisplayOptions,
    colorMap,
    setColorMap,
    setCourseColor,
    selectedTheme,
    setSelectedTheme,
    palette,
    getOrAssignColor,
    COLOR_THEMES
  };

  return <TimetableContext.Provider value={value}>{children}</TimetableContext.Provider>;
};
