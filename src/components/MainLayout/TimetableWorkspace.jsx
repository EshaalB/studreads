import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';
import { showError, showSuccess } from '../../utils/errorHandler';
import { classesToManualEntries, normalizeManualEntry } from '../../utils/manualTimetable';
import { decodeLegacyState, decodeShare } from '../../utils/sharingUtils';
import { parseWorkbook } from '../../utils/spreadsheetParser';
import { readTimetablePayload } from '../../utils/transfer';
import { useHistoryStep } from '../../utils/useHistoryStep';
import { validateFile } from '../../utils/validation';
import EditableTimetable from '../EditableTimetable/EditableTimetable';
import AdditionalCourses from './AdditionalCourses';
import CourseSelection from './CourseSelection';
import FileUpload from './FileUpload';
import ImportReview from './ImportReview';
import ManualTimetable from './ManualTimetable';

const MANUAL_KEY = 'timetable_manual_v1';
const DEMO_MAPPING = {
  courseName: 'courseName', section: 'section', day: 'day', startTime: 'startTime',
  endTime: 'endTime', instructor: 'instructor', room: 'room', credits: 'credits'
};

const readManualEntries = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]');
    return Array.isArray(saved) ? saved.map(normalizeManualEntry).filter((entry) => entry.id && entry.courseName) : [];
  } catch {
    return [];
  }
};

const clearSavedTimetable = () => {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith('timetable_')).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing saved to clear.
  }
};

const TimetableWorkspace = ({ sharedTimetable, legacyTimetable }) => {
  const {
    rawData, sourceMeta, processData, rootSections, activeSection, setActiveSection,
    selectedCourseIds, setSelectedCourseIds, extraSelections, setExtraSelections,
    getCoursesForSection, finalActiveClasses, loadManualTimetable,
    setColorMap, setSelectedTheme, setDisplayOptions
  } = useTimetable();

  const [savedManualEntries] = useState(readManualEntries);
  const [manualEntries, setManualEntries] = useState(savedManualEntries);
  const [isManualMode, setIsManualMode] = useState(savedManualEntries.length > 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [isExtraOpen, setIsExtraOpen] = useState(extraSelections.length > 0);
  const fileInputRef = useRef(null);
  const sharedAppliedRef = useRef(false);
  const previewRef = useRef(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [step, goTo, goBack] = useHistoryStep('timetable', savedManualEntries.length > 0 || rawData.length > 0 ? 'builder' : 'start');

  const hasExisting = manualEntries.length > 0 || rawData.length > 0;
  const screen = step === 'review' && !pendingImport ? 'start' : step === 'builder' && !hasExisting && !isManualMode ? 'start' : step;

  useEffect(() => {
    if (savedManualEntries.length > 0) loadManualTimetable(savedManualEntries);
  }, [loadManualTimetable, savedManualEntries]);

  const updateManualEntries = useCallback((entries) => {
    setManualEntries(entries);
    loadManualTimetable(entries);
    try {
      if (entries.length) localStorage.setItem(MANUAL_KEY, JSON.stringify(entries));
      else localStorage.removeItem(MANUAL_KEY);
    } catch {
      showError('The timetable was updated, but this browser could not save it for your next visit.');
    }
  }, [loadManualTimetable]);

  // On phones the timetable sits below the course list; offer a shortcut while it is off screen.
  useEffect(() => {
    const node = previewRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setIsPreviewVisible(entry.isIntersecting || entry.boundingClientRect.top < 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, [screen]);

  // Opens classes from a share link or backup file as an editable timetable.
  const openPayload = useCallback((payload, label) => {
    const entries = classesToManualEntries(payload?.classes);
    if (entries.length === 0) {
      showError(`The ${label} does not contain any classes with a day and time.`);
      return;
    }
    if (hasExisting && !window.confirm(`Replace your current timetable with the ${label}?`)) return;
    setPendingImport(null);
    setError('');
    setIsManualMode(true);
    updateManualEntries(entries);
    if (payload.theme) setSelectedTheme(payload.theme);
    if (Object.keys(payload.colors).length) setColorMap((current) => ({ ...current, ...payload.colors }));
    setDisplayOptions((current) => ({ ...current, ...payload.display, title: payload.title || current.title }));
    goTo('builder');
    showSuccess(`Opened ${payload.title || `the ${label}`}.`);
  }, [hasExisting, updateManualEntries, setSelectedTheme, setColorMap, setDisplayOptions, goTo]);

  useEffect(() => {
    if (sharedAppliedRef.current || (!sharedTimetable && !legacyTimetable)) return;
    sharedAppliedRef.current = true;
    (async () => {
      const data = sharedTimetable ? await decodeShare(sharedTimetable) : decodeLegacyState(legacyTimetable);
      const payload = readTimetablePayload(data);
      if (payload) openPayload(payload, 'shared timetable');
      else showError('This share link is incomplete or damaged.');
    })();
  }, [sharedTimetable, legacyTimetable, openPayload]);

  const restoreBackup = useCallback(async (file) => {
    try {
      const payload = readTimetablePayload(JSON.parse(await file.text()));
      if (!payload) throw new Error();
      openPayload(payload, 'backup');
    } catch {
      setError('This file is not a StudReads timetable backup.');
    }
  }, [openPayload]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.json')) {
      await restoreBackup(file);
      return;
    }
    const validation = validateFile(file);
    if (!validation.valid) { setError(validation.error); return; }
    setIsLoading(true);
    setError('');
    try {
      const XLSX = await import('xlsx');
      const isText = /\.(csv|tsv|txt)$/i.test(file.name);
      const buffer = await file.arrayBuffer();
      const workbook = isText
        ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true })
        : XLSX.read(buffer, { type: 'array', cellDates: true });
      const parsed = parseWorkbook(XLSX, workbook);
      setPendingImport({
        rows: parsed.rows,
        mapping: parsed.mapping,
        kind: parsed.kind,
        name: file.name,
        sheetName: parsed.sheetName,
        rowCount: parsed.rows.length,
        warnings: parsed.warnings
      });
      goTo('review');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'The spreadsheet could not be read.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [restoreBackup, goTo]);

  const confirmImport = useCallback(() => {
    if (!pendingImport) return;
    const { mapping } = pendingImport;
    if (!mapping.courseName || !mapping.day || !mapping.startTime) {
      setError('Choose the course, day and start time columns before continuing.');
      return;
    }
    if (manualEntries.length && !window.confirm('Replace the classes you entered by hand with this file?')) return;
    if (manualEntries.length) updateManualEntries([]);
    setIsManualMode(false);
    processData(pendingImport.rows, mapping, {
      name: pendingImport.name,
      sheetName: pendingImport.sheetName,
      rowCount: pendingImport.rowCount,
      warnings: pendingImport.warnings
    });
    setPendingImport(null);
    setError('');
    goTo('builder');
  }, [pendingImport, processData, manualEntries.length, updateManualEntries, goTo]);

  const loadDemo = useCallback(() => {
    if (manualEntries.length) updateManualEntries([]);
    setIsManualMode(false);
    processData(DEMO_TIMETABLE_DATA, DEMO_MAPPING, { name: 'Sample timetable', sheetName: 'Sample', rowCount: DEMO_TIMETABLE_DATA.length, warnings: [] });
    setError('');
    goTo('builder');
  }, [manualEntries.length, processData, updateManualEntries, goTo]);

  const startManual = useCallback(() => {
    if (!isManualMode && rawData.length && !window.confirm('Start a new timetable by hand? Your uploaded timetable will be cleared.')) return;
    if (!isManualMode && rawData.length) { clearSavedTimetable(); loadManualTimetable([]); }
    setError('');
    setIsManualMode(true);
    goTo('builder');
  }, [isManualMode, rawData.length, loadManualTimetable, goTo]);

  const clearAll = useCallback(() => {
    if (!window.confirm('Delete your saved timetable, selections and colours from this browser?')) return;
    clearSavedTimetable();
    window.location.reload();
  }, []);

  const convertToManual = useCallback(() => {
    const entries = classesToManualEntries(finalActiveClasses);
    if (entries.length === 0) return;
    if (!window.confirm('Turn your selected classes into a list you can edit freely? Other sections from the file will no longer be available.')) return;
    setIsManualMode(true);
    updateManualEntries(entries);
  }, [finalActiveClasses, updateManualEntries]);

  const coursesInActiveSection = useMemo(() => {
    if (!activeSection) return [];
    const unique = [];
    const seen = new Set();
    getCoursesForSection(activeSection).forEach((course) => {
      if (!seen.has(course.name)) { unique.push(course); seen.add(course.name); }
    });
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSection, getCoursesForSection]);

  const sectionOptions = useMemo(() => rootSections.map((section) => ({ value: section, label: section })), [rootSections]);
  const toggleCourse = useCallback((id) => setSelectedCourseIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]), [setSelectedCourseIds]);
  const handleSectionChange = useCallback((value) => { setActiveSection(value); setSelectedCourseIds([]); }, [setActiveSection, setSelectedCourseIds]);
  const addExtra = useCallback(() => setExtraSelections((current) => [...current, { id: Date.now() + Math.random(), courseName: '', section: '', courseId: '' }]), [setExtraSelections]);
  const removeExtra = useCallback((id) => setExtraSelections((current) => current.filter((item) => item.id !== id)), [setExtraSelections]);
  const updateExtra = useCallback((id, updates) => setExtraSelections((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item)), [setExtraSelections]);

  const hasSelectedCourses = finalActiveClasses.length > 0;
  const sourceName = isManualMode ? 'Your classes' : sourceMeta?.name || 'Timetable file';
  const sourceDetail = isManualMode
    ? `${manualEntries.length} ${manualEntries.length === 1 ? 'class' : 'classes'}`
    : `${sourceMeta?.sheetName ? `${sourceMeta.sheetName} · ` : ''}${rawData.length} entries`;

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      hidden
      accept=".xlsx,.xls,.xlsm,.ods,.csv,.json"
      onChange={(event) => handleFile(event.target.files?.[0])}
      aria-label="Upload a timetable file"
    />
  );

  if (screen === 'review') {
    return (
      <div className="screen" key="review">
        {fileInput}
        <button type="button" className="back-btn" onClick={goBack}><ArrowLeft size={16} /> Back</button>
        <ImportReview
          pendingImport={pendingImport}
          error={error}
          onConfirm={confirmImport}
          onCancel={() => { setPendingImport(null); setError(''); goBack(); }}
          onUpdateMapping={(field, column) => setPendingImport((current) => ({ ...current, mapping: { ...current.mapping, [field]: column } }))}
        />
      </div>
    );
  }

  if (screen === 'start') {
    return (
      <div className="screen" key="start">
        {fileInput}
        <FileUpload
          isLoading={isLoading}
          error={error}
          onFile={handleFile}
          onBrowse={() => fileInputRef.current?.click()}
          onSample={loadDemo}
          onManual={startManual}
          resume={hasExisting || isManualMode ? { title: sourceName, detail: sourceDetail, onContinue: () => goTo('builder'), onClear: clearAll } : null}
        />
      </div>
    );
  }

  return (
    <div className="screen builder" key="builder">
      {fileInput}
      <aside className="builder-side" aria-label="Classes">
        <div className="side-head">
          <button type="button" className="back-btn" onClick={goBack}><ArrowLeft size={16} /> Back</button>
          <div className="source-text">
            <strong title={sourceName}>{sourceName}</strong>
            <span>{sourceDetail}</span>
          </div>
        </div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {!isManualMode && sourceMeta?.warnings?.length > 0 && (
          <div className="notice" role="status">{sourceMeta.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
        )}

        {isManualMode ? (
          <ManualTimetable entries={manualEntries} onChange={updateManualEntries} />
        ) : (
          <>
            <CourseSelection
              sectionOptions={sectionOptions}
              activeSection={activeSection}
              handleSectionChange={handleSectionChange}
              coursesInActiveSection={coursesInActiveSection}
              selectedCourseIds={selectedCourseIds}
              toggleCourse={toggleCourse}
            />
            {activeSection && (
              <AdditionalCourses
                isExtraOpen={isExtraOpen}
                setIsExtraOpen={setIsExtraOpen}
                extraSelections={extraSelections}
                getCoursesForSection={getCoursesForSection}
                updateExtra={updateExtra}
                removeExtra={removeExtra}
                addExtra={addExtra}
              />
            )}
            {hasSelectedCourses && (
              <button type="button" className="link-btn side-link" onClick={convertToManual}>
                Edit classes freely (add, remove or change any class)
              </button>
            )}
          </>
        )}
      </aside>

      <section className="builder-main" aria-label="Your timetable" ref={previewRef}>
        {hasSelectedCourses ? <EditableTimetable /> : (
          <div className="empty-preview">
            <p className="empty-title">{isManualMode ? 'Add a class to start' : activeSection ? 'Select a course' : 'Choose your section'}</p>
            <p>{isManualMode ? 'Your week appears here as you add classes.' : activeSection ? 'Your week updates as you tick courses.' : 'Pick the section you are enrolled in to see its courses.'}</p>
          </div>
        )}
      </section>

      {hasSelectedCourses && !isPreviewVisible && (
        <button type="button" className="jump-bar" onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          View timetable <span>{new Set(finalActiveClasses.map((cls) => cls.name)).size} courses</span>
        </button>
      )}
    </div>
  );
};

export default TimetableWorkspace;
