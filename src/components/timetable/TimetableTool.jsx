import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { importClasses } from '../../utils/classes';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';
import { showError, showSuccess } from '../../utils/errorHandler';
import { decodeLegacyState, decodeShare } from '../../utils/sharingUtils';
import { parseWorkbook } from '../../utils/spreadsheetParser';
import { readTimetablePayload } from '../../utils/transfer';
import { validateFile } from '../../utils/validation';
import Editor from './Editor';
import ImportReview from './ImportReview';

const DEMO_MAPPING = {
  courseName: 'courseName', section: 'section', day: 'day', startTime: 'startTime',
  endTime: 'endTime', instructor: 'instructor', room: 'room', credits: 'credits'
};

// The timetable is a single screen. Files (a university timetable or a backup) can be
// chosen from the action bar or dropped anywhere on it.
const TimetableTool = ({ sharedTimetable, legacyTimetable }) => {
  const { classes, loadSource, replaceTimetable, setDisplayOptions, setColorMap, setSelectedTheme } = useTimetable();
  const [pendingImport, setPendingImport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pickerRequest, setPickerRequest] = useState(0);
  const fileInputRef = useRef(null);
  const sharedAppliedRef = useRef(false);

  const openPicker = () => setPickerRequest((count) => count + 1);

  // Share links and backup files replace the timetable with their classes.
  const openPayload = useCallback((payload, label) => {
    const list = importClasses(payload?.classes);
    if (list.length === 0) { showError(`The ${label} has no classes with a day and time.`); return; }
    if (classes.length && !window.confirm(`Replace your current timetable with the ${label}?`)) return;
    replaceTimetable(list);
    if (payload.theme) setSelectedTheme(payload.theme);
    if (Object.keys(payload.colors).length) setColorMap((current) => ({ ...current, ...payload.colors }));
    setDisplayOptions((current) => ({ ...current, ...payload.display, title: payload.title || '' }));
    showSuccess(`Opened ${payload.title || `the ${label}`}.`);
  }, [classes.length, replaceTimetable, setSelectedTheme, setColorMap, setDisplayOptions]);

  useEffect(() => {
    if (sharedAppliedRef.current || (!sharedTimetable && !legacyTimetable)) return;
    sharedAppliedRef.current = true;
    (async () => {
      const payload = readTimetablePayload(sharedTimetable ? await decodeShare(sharedTimetable) : decodeLegacyState(legacyTimetable));
      if (payload) openPayload(payload, 'shared timetable');
      else showError('This share link is incomplete or damaged.');
    })();
  }, [sharedTimetable, legacyTimetable, openPayload]);

  const applyImport = useCallback((parsed) => {
    loadSource(parsed.rows, parsed.mapping, { name: parsed.name, sheetName: parsed.sheetName, warnings: parsed.warnings });
    setPendingImport(null);
    setError('');
    showSuccess(`Found ${parsed.rows.length} entries in ${parsed.name}. Choose your courses.`);
    openPicker();
  }, [loadSource]);

  const handleFile = useCallback(async (file) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const payload = readTimetablePayload(JSON.parse(await file.text()));
        if (!payload) throw new Error();
        openPayload(payload, 'backup');
      } catch {
        showError('This file is not a StudReads timetable backup.');
      }
      return;
    }
    const validation = validateFile(file);
    if (!validation.valid) { showError(validation.error); return; }
    setIsLoading(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = /\.(csv|tsv|txt)$/i.test(file.name)
        ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true })
        : XLSX.read(buffer, { type: 'array', cellDates: true });
      const parsed = { ...parseWorkbook(XLSX, workbook), name: file.name };
      // Column-based sheets get a quick check; grid timetables are read without one.
      if (parsed.kind === 'table') setPendingImport({ ...parsed, rowCount: parsed.rows.length });
      else applyImport(parsed);
    } catch (readError) {
      showError(readError instanceof Error && readError.message ? readError.message : 'The spreadsheet could not be read.');
    } finally {
      setIsLoading(false);
    }
  }, [openPayload, applyImport]);

  const confirmImport = () => {
    const { mapping } = pendingImport;
    if (!mapping.courseName || !mapping.day || !mapping.startTime) {
      setError('Choose the course, day and start time columns.');
      return;
    }
    applyImport(pendingImport);
  };

  const loadSample = () => applyImport({ rows: DEMO_TIMETABLE_DATA, mapping: DEMO_MAPPING, name: 'the sample timetable', sheetName: 'Sample', warnings: [] });

  const startNew = () => {
    if (classes.length && !window.confirm('Start a new timetable? All classes on this one will be removed.')) return;
    replaceTimetable([]);
    setDisplayOptions((current) => ({ ...current, title: '' }));
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".xlsx,.xls,.xlsm,.ods,.csv,.json"
        onChange={(event) => handleFile(event.target.files?.[0])}
        aria-label="Upload a timetable file or backup"
      />
      <Editor
        isLoading={isLoading}
        pickerRequest={pickerRequest}
        onUpload={() => fileInputRef.current?.click()}
        onFile={handleFile}
        onSample={loadSample}
        onNew={startNew}
      />
      <ImportReview
        pendingImport={pendingImport}
        error={error}
        onConfirm={confirmImport}
        onCancel={() => { setPendingImport(null); setError(''); }}
        onUpdateMapping={(field, column) => setPendingImport((current) => ({ ...current, mapping: { ...current.mapping, [field]: column } }))}
      />
    </>
  );
};

export default TimetableTool;
