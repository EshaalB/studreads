import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { importClasses } from '../../utils/classes';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';
import { showError, showSuccess } from '../../utils/errorHandler';
import { EXAM_FILE_ACCEPT, readExamFile, readExamText } from '../../parsers/examLoaders';
import { parseExamWorkbook } from '../../parsers/examParser';
import { decodeLegacyState, decodeShare } from '../../export/sharingUtils';
import { parseWorkbook } from '../../parsers/spreadsheetParser';
import { readClassmatePayload, readExamPayload, readTimetablePayload } from '../../export/transfer';
import { useExams } from '../../hooks/useExams';
import { ACCEPTED_FILE_TYPES } from '../../utils/constants';
import { validateFile } from '../../utils/validation';
import RevisionDialog from '../exams/RevisionDialog';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';
import Editor from './Editor';
import ImportReview from './ImportReview';

const DEMO_MAPPING = {
  courseName: 'courseName', section: 'section', day: 'day', startTime: 'startTime',
  endTime: 'endTime', instructor: 'instructor', room: 'room', credits: 'credits'
};

const EXAM_ONLY = /\.(pdf|docx|txt|png|jpe?g|webp|bmp|gif)$/i;
const SPREADSHEET = /\.(xlsx|xls|xlsm|ods|csv|tsv)$/i;

const readWorkbook = async (file) => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = /\.(csv|tsv)$/i.test(file.name)
    ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true })
    : XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true });
  return { XLSX, workbook };
};

// A spreadsheet with real dates across several days is a date sheet; a weekly
// timetable has days and times but no dates.
const looksLikeDateSheet = (XLSX, workbook) => {
  try {
    const { records } = parseExamWorkbook(XLSX, workbook);
    return records.length >= 3 && new Set(records.map((record) => record.date)).size >= 2;
  } catch {
    return false;
  }
};

const useToggle = (onClose) => {
  const [isOpen, setIsOpen] = useState(false);
  return { isOpen, open: () => setIsOpen(true), close: () => { setIsOpen(false); onClose?.(); } };
};

// launch: codes from the opening URL — ?t= a planner, ?c= files shared with classmates,
// and ?s= / ?x= from older versions.
const TimetableTool = ({ launch }) => {
  const { classes, loadSource, replaceTimetable, setDisplayOptions, setColorMap, setSelectedTheme } = useTimetable();
  const exams = useExams();
  const [pendingImport, setPendingImport] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [revision, setRevision] = useState(null);
  // Opening a classmate link with both files shows the exam step after the course step.
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

  // Share links and backups bring classes, exams or both.
  const openShared = useCallback((data, label) => {
    const payload = readTimetablePayload(data);
    const sharedList = readExamPayload(data);
    if (!payload && sharedList.length === 0) { showError(`The ${label} is empty or damaged.`); return; }
    if ((classes.length || exams.mine.length) && !window.confirm(`Replace what you have with the ${label}?`)) return;
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

  // A first date sheet opens the picker; a revised one shows what changed in your exams.
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
      const code = launch.timetable || launch.exams;
      openShared(code ? await decodeShare(code) : decodeLegacyState(launch.legacyTimetable), 'shared link');
    })();
  }, [launch, openShared, openClassmates]);

  const loadTimetable = async (file, prepared) => {
    const validation = validateFile(file);
    if (!validation.valid) { showError(validation.error); return; }
    const { XLSX, workbook } = prepared || await readWorkbook(file);
    const parsed = { ...parseWorkbook(XLSX, workbook), name: file.name };
    const mapping = parsed.mapping;
    // Only ask about columns when something required could not be found.
    if (parsed.kind === 'table' && (!mapping.courseName || !mapping.day || !mapping.startTime)) {
      setPendingImport({ ...parsed, rowCount: parsed.rows.length });
    } else {
      applyTimetable(parsed);
    }
  };


  const loadExams = async (file) => {
    const result = await readExamFile(file, (message) => setBusy(`${message}…`));
    applyDateSheet(result.records, { name: file.name });
    if (result.hasAmbiguousDates) showSuccess('Dates like 03/04 were read as day/month. Check them if your exams look a month off.');
  };

  const loadBackup = async (file) => {
    try {
      openShared(JSON.parse(await file.text()), 'backup');
    } catch {
      showError('This file is not a StudReads backup.');
    }
  };

  // kind: 'timetable', 'exams' or 'auto' (dropped files)
  const handleFile = async (file, kind = 'auto') => {
    if (timetableInput.current) timetableInput.current.value = '';
    if (examInput.current) examInput.current.value = '';
    if (!file) return;
    if (/\.json$/i.test(file.name)) { await loadBackup(file); return; }
    setBusy('Reading file…');
    try {
      if (kind === 'exams' || (kind === 'auto' && EXAM_ONLY.test(file.name))) {
        await loadExams(file);
      } else if (kind === 'timetable' || !SPREADSHEET.test(file.name)) {
        await loadTimetable(file);
      } else {
        const prepared = await readWorkbook(file);
        if (looksLikeDateSheet(prepared.XLSX, prepared.workbook)) await loadExams(file);
        else await loadTimetable(file, prepared);
      }
    } catch (readError) {
      showError(readError instanceof Error && readError.message ? readError.message : 'This file could not be read.');
    } finally {
      setBusy('');
    }
  };

  const submitPaste = () => {
    try {
      const result = readExamText(pasteText);
      setPasteText('');
      setError('');
      paste.close();
      applyDateSheet(result.records, { name: 'Pasted text' });
    } catch (pasteError) {
      setError(pasteError.message);
    }
  };

  const loadSample = () => applyTimetable({ rows: DEMO_TIMETABLE_DATA, mapping: DEMO_MAPPING, name: 'Sample timetable', sheetName: 'Sample' });

  const startNew = () => {
    if (!window.confirm('Start over? Your classes and exams will be removed.')) return;
    replaceTimetable([]);
    if (exams.records.length) exams.clearExams();
    setDisplayOptions((current) => ({ ...current, title: '' }));
  };

  return (
    <>
      <input ref={timetableInput} type="file" hidden accept={[...ACCEPTED_FILE_TYPES, '.json'].join(',')} onChange={(event) => handleFile(event.target.files?.[0], 'timetable')} aria-label="Upload a class timetable or backup" />
      <input ref={examInput} type="file" hidden accept={EXAM_FILE_ACCEPT} onChange={(event) => handleFile(event.target.files?.[0], 'exams')} aria-label="Upload an exam date sheet" />
      <Editor
        busy={busy}
        exams={exams}
        coursePicker={coursePicker}
        examPicker={examPicker}
        upload={{
          timetable: () => timetableInput.current?.click(),
          exams: () => examInput.current?.click(),
          paste: paste.open,
          backup: () => timetableInput.current?.click()
        }}
        onFile={(file) => handleFile(file, 'auto')}
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
        title="Paste exam dates"
        width={560}
        footer={<PushButton onClick={submitPaste} disabled={!pasteText.trim()}>Find exams</PushButton>}
      >
        <div className="form">
          <textarea
            className="input textarea"
            rows={10}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={'Monday 18 May 2026\nCS-204 Data Structures   9:00 AM - 12:00 PM   Hall B'}
            aria-label="Exam date sheet text"
            autoFocus
          />
          {error && <p className="notice notice-error" role="alert">{error}</p>}
        </div>
      </Dialog>
    </>
  );
};

export default TimetableTool;
