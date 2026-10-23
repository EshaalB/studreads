import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { importClasses } from '../../utils/classes';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';
import { showError, showSuccess } from '../../utils/errorHandler';
import { decodeLegacyState, decodeShare } from '../../utils/sharingUtils';
import { parseWorkbook } from '../../utils/spreadsheetParser';
import { readTimetablePayload } from '../../utils/transfer';
import { useHistoryStep } from '../../utils/useHistoryStep';
import { validateFile } from '../../utils/validation';
import Editor from './Editor';
import ImportReview from './ImportReview';
import StartScreen from './StartScreen';

const DEMO_MAPPING = {
  courseName: 'courseName', section: 'section', day: 'day', startTime: 'startTime',
  endTime: 'endTime', instructor: 'instructor', room: 'room', credits: 'credits'
};

// Screens: start -> (review an imported file) -> editor. Back and the browser's back
// button move between them.
const TimetableTool = ({ sharedTimetable, legacyTimetable }) => {
  const {
    classes, hasSource, loadSource, replaceTimetable, displayOptions, setDisplayOptions,
    setColorMap, setSelectedTheme
  } = useTimetable();
  const [step, goTo, goBack] = useHistoryStep('timetable', classes.length || hasSource ? 'editor' : 'start');
  const [pendingImport, setPendingImport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [editorSession, setEditorSession] = useState({ key: 0, openPicker: false });
  const fileInputRef = useRef(null);
  const sharedAppliedRef = useRef(false);

  const openEditor = useCallback((openPicker = false) => {
    setEditorSession((current) => ({ key: current.key + 1, openPicker }));
    goTo('editor');
  }, [goTo]);

  // Share links and backup files replace the timetable with their classes.
  const openPayload = useCallback((payload, label) => {
    const list = importClasses(payload?.classes);
    if (list.length === 0) { showError(`The ${label} has no classes with a day and time.`); return; }
    if (classes.length && !window.confirm(`Replace your current timetable with the ${label}?`)) return;
    replaceTimetable(list);
    if (payload.theme) setSelectedTheme(payload.theme);
    if (Object.keys(payload.colors).length) setColorMap((current) => ({ ...current, ...payload.colors }));
    setDisplayOptions((current) => ({ ...current, ...payload.display, title: payload.title || '' }));
    setError('');
    openEditor();
    showSuccess(`Opened ${payload.title || `the ${label}`}.`);
  }, [classes.length, replaceTimetable, setSelectedTheme, setColorMap, setDisplayOptions, openEditor]);

  useEffect(() => {
    if (sharedAppliedRef.current || (!sharedTimetable && !legacyTimetable)) return;
    sharedAppliedRef.current = true;
    (async () => {
      const payload = readTimetablePayload(sharedTimetable ? await decodeShare(sharedTimetable) : decodeLegacyState(legacyTimetable));
      if (payload) openPayload(payload, 'shared timetable');
      else showError('This share link is incomplete or damaged.');
    })();
  }, [sharedTimetable, legacyTimetable, openPayload]);

  const handleFile = useCallback(async (file) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError('');
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const payload = readTimetablePayload(JSON.parse(await file.text()));
        if (!payload) throw new Error();
        openPayload(payload, 'backup');
      } catch {
        setError('This file is not a StudReads timetable backup.');
        if (step !== 'start') showError('This file is not a StudReads timetable backup.');
      }
      return;
    }
    const validation = validateFile(file);
    if (!validation.valid) { setError(validation.error); showError(validation.error); return; }
    setIsLoading(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = /\.(csv|tsv|txt)$/i.test(file.name)
        ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true })
        : XLSX.read(buffer, { type: 'array', cellDates: true });
      const parsed = parseWorkbook(XLSX, workbook);
      setPendingImport({ ...parsed, name: file.name, rowCount: parsed.rows.length });
      goTo('review');
    } catch (readError) {
      const message = readError instanceof Error && readError.message ? readError.message : 'The spreadsheet could not be read.';
      setError(message);
      if (step !== 'start') showError(message);
    } finally {
      setIsLoading(false);
    }
  }, [openPayload, goTo, step]);

  const confirmImport = useCallback(() => {
    const { mapping } = pendingImport;
    if (!mapping.courseName || !mapping.day || !mapping.startTime) {
      setError('Choose the course, day and start time columns before continuing.');
      return;
    }
    loadSource(pendingImport.rows, mapping, { name: pendingImport.name, sheetName: pendingImport.sheetName, warnings: pendingImport.warnings });
    setPendingImport(null);
    setError('');
    openEditor(true);
  }, [pendingImport, loadSource, openEditor]);

  const loadSample = useCallback(() => {
    loadSource(DEMO_TIMETABLE_DATA, DEMO_MAPPING, { name: 'Sample timetable', sheetName: 'Sample', warnings: [] });
    openEditor(true);
  }, [loadSource, openEditor]);

  const startNew = useCallback(() => {
    if (classes.length && !window.confirm('Start a new timetable? All classes on this one will be removed.')) return;
    replaceTimetable([]);
    setDisplayOptions((current) => ({ ...current, title: '' }));
  }, [classes.length, replaceTimetable, setDisplayOptions]);

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      hidden
      accept=".xlsx,.xls,.xlsm,.ods,.csv,.json"
      onChange={(event) => handleFile(event.target.files?.[0])}
      aria-label="Import a timetable file or backup"
    />
  );
  const browse = () => fileInputRef.current?.click();

  if (step === 'review' && pendingImport) {
    return (
      <div className="screen narrow">
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

  if (step === 'editor') {
    return (
      <>
        {fileInput}
        <Editor key={editorSession.key} openPicker={editorSession.openPicker} onBack={goBack} onImport={browse} onNew={startNew} />
      </>
    );
  }

  const courseCount = new Set(classes.map((cls) => cls.name)).size;
  return (
    <>
      {fileInput}
      <StartScreen
        isLoading={isLoading}
        error={error}
        onFile={handleFile}
        onBrowse={browse}
        onSample={loadSample}
        onScratch={() => openEditor(false)}
        resume={classes.length || hasSource ? {
          title: displayOptions.title.trim() || 'My timetable',
          detail: classes.length ? `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}, ${classes.length} classes` : 'No courses chosen yet',
          onContinue: () => openEditor(false)
        } : null}
      />
    </>
  );
};

export default TimetableTool;
