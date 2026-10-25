import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { importClasses, isDuplicateClass } from '../../utils/classes';
import { looksLikeExams, parseTimetableText } from '../../parsers/textTimetable';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';
import { STANDARD_MAPPING } from '../../utils/timetableSource';
import { confirmAction } from '../../utils/confirm';
import { showError, showSuccess } from '../../utils/errorHandler';
import { EXAM_FILE_ACCEPT, readExamFile, readExamText, readTimetablePdf } from '../../parsers/examLoaders';
import { describeImportFailure } from '../../parsers/importError';
import { readSpreadsheet } from '../../parsers/readSpreadsheet';
import { decodeShare } from '../../export/sharingUtils';
import { readClassmatePayload, readExamPayload, readTimetablePayload } from '../../export/transfer';
import { useExams } from '../../hooks/useExams';
import { leaveCurrentPage, mergePages } from '../../utils/pages';
import { ACCEPTED_FILE_TYPES } from '../../utils/constants';
import { validateFile } from '../../utils/validation';
import RevisionDialog from '../exams/RevisionDialog';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';
import Editor from './Editor';
import ImportReview from './ImportReview';

const SPREADSHEET = /\.(xlsx|xls|xlsm|ods|csv|tsv)$/i;

const useToggle = (onClose) => {
  const [isOpen, setIsOpen] = useState(false);
  return { isOpen, open: () => setIsOpen(true), close: () => { setIsOpen(false); onClose?.(); } };
};

// launch: data from a shared link (t = planner, c = classmate files).
const TimetableTool = ({ launch }) => {
  const { classes, addClasses, loadSource, replaceTimetable, setDisplayOptions, setColorMap, setSelectedTheme } = useTimetable();
  const exams = useExams();
  const [pendingImport, setPendingImport] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [revision, setRevision] = useState(null);
  // The uploaded PDF/image, so OCR results can be checked against it.
  const [original, setOriginal] = useState('');
  // Page images of a scan.
  const [scans, setScans] = useState([]);
  useEffect(() => () => scans.forEach((scan) => URL.revokeObjectURL(scan.url)), [scans]);
  useEffect(() => () => { if (original) URL.revokeObjectURL(original); }, [original]);
  // For classmate links: show the exam picker after the course picker.
  const afterCourses = useRef(null);
  const coursePicker = useToggle(() => {
    const next = afterCourses.current;
    afterCourses.current = null;
    next?.();
  });
  const examPicker = useToggle();
  const paste = useToggle();
  const timetableInput = useRef(null);
  const examInput = useRef(null);
  const sharedAppliedRef = useRef(false);
  const importRef = useRef(null);

  const openShared = useCallback(async (data, label) => {
    const payload = readTimetablePayload(data);
    const sharedList = readExamPayload(data);
    if (!payload && sharedList.length === 0) { showError(`The ${label} is empty or damaged.`); return; }
    if ((classes.length || exams.mine.length) && !await confirmAction(`Your current classes and exams will be replaced with the ones in the ${label}.`, { title: `Open the ${label}?`, confirmLabel: 'Replace' })) return;
    if (payload) {
      replaceTimetable(importClasses(payload.classes));
      if (payload.theme) setSelectedTheme(payload.theme);
      if (Object.keys(payload.colors).length) setColorMap((current) => ({ ...current, ...payload.colors }));
      setDisplayOptions((current) => ({ ...current, ...payload.display, title: payload.title || '' }));
    }
    if (sharedList.length) exams.loadDateSheet(sharedList, { name: 'Shared exams' }, sharedList.map((exam) => exam.id));
    showSuccess(`Opened ${payload?.title || `the ${label}`}.`);
  }, [classes.length, exams, replaceTimetable, setSelectedTheme, setColorMap, setDisplayOptions]);

  const applyTimetable = useCallback((parsed) => {
    loadSource(parsed.rows, parsed.mapping, { name: parsed.name, sheetName: parsed.sheetName });
    setPendingImport(null);
    setError('');
    coursePicker.open();
  }, [loadSource, coursePicker]);

  // First date sheet opens the picker; an updated one shows what changed.
  const applyDateSheet = useCallback((records, info, { later = false } = {}) => {
    const changes = exams.loadDateSheet(records, info);
    const show = () => (changes ? setRevision({ ...changes, name: info.name }) : examPicker.open());
    if (later) afterCourses.current = show; else show();
  }, [exams, examPicker]);

  const openClassmates = useCallback((data) => {
    const shared = readClassmatePayload(data);
    if (!shared) { showError('The shared link is empty or damaged.'); return; }
    if (shared.exams.length) applyDateSheet(shared.exams, { name: shared.examFile }, { later: Boolean(shared.source) });
    if (shared.source) applyTimetable({ rows: shared.source.rows, mapping: shared.source.mapping, name: shared.source.name, sheetName: '' });
  }, [applyDateSheet, applyTimetable]);

  useEffect(() => {
    if (sharedAppliedRef.current || !Object.values(launch).some(Boolean)) return;
    sharedAppliedRef.current = true;
    (async () => {
      if (launch.classmates) { openClassmates(await decodeShare(launch.classmates)); return; }
      openShared(await decodeShare(launch.timetable), 'shared link');
    })();
  }, [launch, openShared, openClassmates]);

  const loadTimetable = (file, result) => {
    const parsed = { ...result, name: file.name };
    const mapping = parsed.mapping;
    const needsCheck = !mapping.courseName || !mapping.day || !mapping.startTime || parsed.guessed?.length > 0;
    if (parsed.kind === 'table' && needsCheck) {
      setPendingImport({ ...parsed, rowCount: parsed.rows.length });
    } else {
      applyTimetable(parsed);
    }
  };


  // If 03/04 could be 3 April or 4 March, ask.
  const recordsInChosenOrder = async (result) => {
    if (!result.hasAmbiguousDates) return result.records;
    const dayFirst = await confirmAction('A date like 03/04/2026 in this sheet could mean 3 April or 4 March, and nothing in the sheet settles it.', {
      title: 'How are the dates written?', confirmLabel: 'Day first (3 April)', cancelLabel: 'Month first (4 March)'
    });
    return dayFirst ? result.records : result.readAs({ dayFirst: false });
  };

  const applyExamResult = async (file, result, signal) => {
    setOriginal(/\.(pdf|png|jpe?g|webp|bmp|gif)$/i.test(file.name) ? URL.createObjectURL(file) : '');
    setScans(result.scans || []);
    const records = await recordsInChosenOrder(result);
    signal?.throwIfAborted();
    applyDateSheet(records, { name: file.name });
    if (result.note) showSuccess(result.note);
  };

  const loadBackup = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.kind === 'pages') { showSuccess(`${mergePages(data.pages)} pages added. Find them under My pages.`); return; }
      if ((data.t || data.x) && !data.c) { openClassmates(data); return; }
      openShared(data, 'backup');
    } catch {
      showError('This file is not a StudReads backup.');
    }
  };

  const handleFile = async (file, kind = 'auto') => {
    if (timetableInput.current) timetableInput.current.value = '';
    if (examInput.current) examInput.current.value = '';
    if (!file) return;
    if (/\.json$/i.test(file.name)) { await loadBackup(file); return; }
    // Cancel any file still being read.
    importRef.current?.abort();
    const controller = new AbortController();
    importRef.current = controller;
    const { signal } = controller;
    setBusy('Reading file…');
    try {
      const progress = (message) => { if (!signal.aborted) setBusy(`${message}…`); };
      if (/\.pdf$/i.test(file.name) && kind === 'timetable') {
        const parsed = await readTimetablePdf(file, progress, signal);
        signal.throwIfAborted();
        loadTimetable(file, parsed);
        return;
      }
      if (!SPREADSHEET.test(file.name) && kind !== 'timetable') {
        const result = await readExamFile(file, progress, signal);
        signal.throwIfAborted();
        await applyExamResult(file, result, signal);
        return;
      }
      if (kind === 'timetable') {
        const validation = validateFile(file);
        if (!validation.valid) { showError(validation.error); return; }
      }
      const result = await readSpreadsheet(file, { kind, signal });
      signal.throwIfAborted();
      if (result.type === 'exams') {
        await applyExamResult(file, { ...result, note: '', readAs: (options) => readSpreadsheet(file, { kind: 'exams', dayFirst: options.dayFirst, signal }).then((again) => again.records) }, signal);
      } else {
        loadTimetable(file, result.parsed);
      }
    } catch (readError) {
      if (signal.aborted) {
        if (importRef.current === controller) showSuccess('Import cancelled.');
        return;
      }
      if (!readError?.kind) console.error(readError);
      showError(describeImportFailure(readError));
    } finally {
      if (importRef.current === controller) {
        importRef.current = null;
        setBusy('');
      }
    }
  };

  // Pasted text: dates mean exams, days and times mean a timetable.
  // The dialog shows which before anything is added.
  const pasted = useMemo(() => {
    if (!pasteText.trim()) return null;
    const timetable = parseTimetableText(pasteText);
    const kind = looksLikeExams(pasteText, timetable) ? 'exams' : timetable.classes.length ? 'timetable' : 'unknown';
    return { kind, timetable };
  }, [pasteText]);

  const addPastedClasses = ({ classes: found, skipped }) => {
    const fresh = importClasses(found.map((item) => ({ ...item, name: item.courseName, teacher: item.instructor })))
      .filter((item, index, list) => !isDuplicateClass(item, classes) && !isDuplicateClass(item, list.slice(0, index)));
    if (!fresh.length) { setError('These classes are already in your timetable.'); return; }
    addClasses(fresh);
    setPasteText('');
    setError('');
    paste.close();
    const extra = [found.length - fresh.length && `${found.length - fresh.length} already added`, skipped.length && `${skipped.length} ${skipped.length === 1 ? 'line' : 'lines'} without a day or time skipped`].filter(Boolean).join(', ');
    showSuccess(`Added ${fresh.length} ${fresh.length === 1 ? 'class' : 'classes'}${extra ? ` (${extra})` : ''}.`);
  };

  const submitPaste = async () => {
    if (pasted?.kind === 'timetable') { addPastedClasses(pasted.timetable); return; }
    try {
      const result = readExamText(pasteText);
      setPasteText('');
      setError('');
      paste.close();
      applyDateSheet(await recordsInChosenOrder(result), { name: 'Pasted text' });
    } catch (pasteError) {
      setError(pasted?.kind === 'unknown'
        ? 'No classes or exams found. Write each class with a day and time (Monday 9:00-10:30 Data Structures), or each exam with a date.'
        : describeImportFailure(pasteError));
    }
  };

  const loadSample = () => applyTimetable({ rows: DEMO_TIMETABLE_DATA, mapping: STANDARD_MAPPING, name: 'Sample timetable', sheetName: 'Sample' });

  const startNew = async () => {
    if (!await confirmAction('Your classes and exams will be cleared. Saved pages are kept.', { title: 'Start a new timetable?', confirmLabel: 'Start new', danger: true })) return;
    replaceTimetable([]);
    leaveCurrentPage(); // so saving next creates a new page instead of overwriting the last one
    if (exams.records.length) exams.clearExams();
    setDisplayOptions((current) => ({ ...current, title: '' }));
  };

  return (
    <>
      <input ref={timetableInput} type="file" hidden accept={[...ACCEPTED_FILE_TYPES, '.pdf', '.json'].join(',')} onChange={(event) => handleFile(event.target.files?.[0], 'timetable')} aria-label="Upload a class timetable or backup" />
      <input ref={examInput} type="file" hidden accept={EXAM_FILE_ACCEPT} onChange={(event) => handleFile(event.target.files?.[0], 'exams')} aria-label="Upload an exam date sheet" />
      <Editor
        busy={busy}
        exams={exams}
        coursePicker={coursePicker}
        examPicker={{ ...examPicker, original, scans }}
        upload={{
          timetable: () => timetableInput.current?.click(),
          exams: () => examInput.current?.click(),
          paste: paste.open,
          backup: () => timetableInput.current?.click()
        }}
        onFile={(file) => handleFile(file, 'auto')}
        onCancel={() => importRef.current?.abort()}
        onSample={loadSample}
        onNew={startNew}
      />
      <ImportReview
        pendingImport={pendingImport}
        error={error}
        onConfirm={() => {
          const { mapping } = pendingImport;
          if (!mapping.courseName || !mapping.day || !mapping.startTime) { setError('Choose the course, day and start time columns.'); return; }
          applyTimetable(pendingImport);
        }}
        onCancel={() => { setPendingImport(null); setError(''); }}
        onUpdateMapping={(field, column) => setPendingImport((current) => ({ ...current, mapping: { ...current.mapping, [field]: column } }))}
      />
      <RevisionDialog revision={revision} onClose={() => setRevision(null)} onEdit={() => { setRevision(null); examPicker.open(); }} />
      <Dialog
        isOpen={paste.isOpen}
        onClose={() => { paste.close(); setError(''); }}
        title="Paste text"
        width={560}
        footer={<PushButton onClick={submitPaste} disabled={!pasteText.trim()}>{pasted?.kind === 'timetable' ? `Add ${pasted.timetable.classes.length} ${pasted.timetable.classes.length === 1 ? 'class' : 'classes'}` : 'Find exams'}</PushButton>}
      >
        <div className="form">
          <textarea
            className="input textarea"
            rows={10}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={'Your timetable:\nMonday\n9:00-10:30 Data Structures, B-11, Dr. Asim\nTue, Thu 2:00-3:15 pm Operating Systems\n\nOr your exams:\n18 May 2026  CS-204 Data Structures  9:00 AM - 12:00 PM'}
            aria-label="Timetable or exam dates as text"
            autoFocus
          />
          <p className="muted small" aria-live="polite">
            {!pasted && 'Paste a timetable (days and times) or an exam list (dates). It is read as you paste.'}
            {pasted?.kind === 'timetable' && `Reads as a timetable: ${pasted.timetable.classes.length} ${pasted.timetable.classes.length === 1 ? 'class' : 'classes'} on ${[...new Set(pasted.timetable.classes.map((item) => item.day.slice(0, 3)))].join(', ')}.${pasted.timetable.skipped.length ? ` ${pasted.timetable.skipped.length} ${pasted.timetable.skipped.length === 1 ? 'line has' : 'lines have'} no day or time and will be skipped.` : ''}`}
            {pasted?.kind === 'exams' && 'Reads as exam dates. You will pick your exams next.'}
            {pasted?.kind === 'unknown' && 'No days with times found yet. Each class needs a day and a time, like “Mon 9:00-10:30 Data Structures”.'}
          </p>
          {error && <p className="notice notice-error" role="alert">{error}</p>}
        </div>
      </Dialog>
    </>
  );
};

export default TimetableTool;
