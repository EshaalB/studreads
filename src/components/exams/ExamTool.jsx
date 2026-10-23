import { ArrowLeft, CalendarPlus, Image, Link2, Plus, Printer, Search, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { examColumns, examToItem, groupByColumn } from '../../utils/calendarItems';
import { showError, showSuccess } from '../../utils/errorHandler';
import { EXAM_FILE_ACCEPT, readExamFile, readExamText } from '../../utils/examLoaders';
import { formatClock } from '../../utils/examParser';
import { downloadFile, examsToIcs } from '../../utils/exportUtils';
import { saveElementAsImage } from '../../utils/imageExport';
import { decodeShare, encodeShare, shareOrCopy } from '../../utils/sharingUtils';
import { buildExamShare, readExamPayload } from '../../utils/transfer';
import { useHistoryStep } from '../../utils/useHistoryStep';
import AgendaList from '../calendar/AgendaList';
import TimeGrid from '../calendar/TimeGrid';
import Dropzone from '../ui/Dropzone';
import ResumeCard from '../ui/ResumeCard';
import Segmented from '../ui/Segmented';
import ExamDialog from './ExamDialog';

const STORAGE_KEY = 'studreads_exams_v1';
const EXAM_HOURS = [9, 17];

const readSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.records)) return saved;
  } catch {
    // Fall through to an empty list.
  }
  return { records: [], selectedIds: [], fileInfo: null, view: 'list' };
};

const formatDate = (isoDate, style = 'long') => new Intl.DateTimeFormat('en-GB', style === 'long'
  ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
  : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
).format(new Date(`${isoDate}T00:00:00Z`));

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const relativeDay = (isoDate) => {
  const days = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
};

const isAddedByHand = (record) => record.source === 'Added by you';

const byDateAndTime = (a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0);

// Exams on the same day whose times overlap (or whose time is unknown).
const findClashes = (records) => {
  const clashes = new Set();
  records.forEach((a, index) => records.slice(index + 1).forEach((b) => {
    if (a.date !== b.date) return;
    const overlap = a.start === null || b.start === null || (a.start < (b.end ?? b.start + 180) && b.start < (a.end ?? a.start + 180));
    if (overlap) { clashes.add(a.id); clashes.add(b.id); }
  }));
  return clashes;
};

const ExamTool = ({ sharedExams }) => {
  const inputRef = useRef(null);
  const captureRef = useRef(null);
  const sharedAppliedRef = useRef(false);
  const [saved] = useState(readSaved);
  const [records, setRecords] = useState(saved.records);
  const [selectedIds, setSelectedIds] = useState(saved.selectedIds || []);
  const [fileInfo, setFileInfo] = useState(saved.fileInfo);
  const [step, goTo, goBack] = useHistoryStep('exams', saved.records.length ? 'results' : 'start');
  const [panel, setPanel] = useState('all');
  const [view, setView] = useState(saved.view === 'grid' ? 'grid' : 'list');
  const { getOrAssignColor, displayOptions } = useTimetable();
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    try {
      if (records.length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, selectedIds, fileInfo, view }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Very large date sheets may not fit in storage; the list still works for this visit.
    }
  }, [records, selectedIds, fileInfo, view]);

  const showResults = useCallback((nextRecords, info, selected = []) => {
    setRecords(nextRecords);
    setSelectedIds(selected);
    setFileInfo(info);
    setQuery('');
    setProgram('');
    setError('');
    setPanel(selected.length ? 'mine' : 'all');
    goTo('results');
  }, [goTo]);

  const loadResult = useCallback((result, name) => showResults(result.records, {
    name,
    source: result.source,
    warnings: [
      ...(result.warnings || []),
      ...(result.hasAmbiguousDates ? ['Dates such as 03/04 are read as day/month. Check them before adding exams to your calendar.'] : [])
    ]
  }), [showResults]);

  useEffect(() => {
    if (sharedAppliedRef.current || !sharedExams) return;
    sharedAppliedRef.current = true;
    (async () => {
      const shared = readExamPayload(await decodeShare(sharedExams));
      if (shared.length === 0) { showError('This exam link is incomplete or damaged.'); return; }
      if (records.length && !window.confirm('Replace your current exam list with the shared one?')) return;
      showResults(shared, { name: 'Shared exam list', source: 'a shared link', warnings: [] }, shared.map((record) => record.id));
      showSuccess(`Opened ${shared.length} shared ${shared.length === 1 ? 'exam' : 'exams'}.`);
    })();
  }, [sharedExams, records.length, showResults]);

  const handleFile = async (file) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setError('');
    setProgress('Reading file…');
    try {
      loadResult(await readExamFile(file, (message) => setProgress(`${message}…`)), file.name);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'The date sheet could not be read.';
      setError(message);
      if (step !== 'start') showError(message);
    } finally {
      setProgress('');
    }
  };

  const handlePaste = () => {
    try {
      loadResult(readExamText(pasteText), 'Pasted text');
      setIsPasteOpen(false);
      setPasteText('');
    } catch (pasteError) {
      setError(pasteError.message);
    }
  };

  const programs = useMemo(() => [...new Set(records.map((record) => record.program).filter(Boolean))].sort(), [records]);

  const groups = useMemo(() => {
    // "cs-2021", "cs 2021" and "CS2021" all find the same code.
    const compact = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = records.filter((record) => {
      if (program && record.program !== program) return false;
      const text = [record.subject, record.code, record.program, record.room].join(' ').toLowerCase();
      return terms.every((term) => text.includes(term)) || (compact(query) && compact(text).includes(compact(query)));
    });
    const grouped = [];
    list.forEach((record) => {
      const last = grouped[grouped.length - 1];
      if (last?.date === record.date) last.records.push(record);
      else grouped.push({ date: record.date, records: [record] });
    });
    return grouped;
  }, [records, query, program]);

  const mine = useMemo(() => records.filter((record) => selectedIds.includes(record.id)).sort(byDateAndTime), [records, selectedIds]);
  const clashes = useMemo(() => findClashes(mine), [mine]);
  const nextExam = mine.find((record) => record.date >= todayIso());

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const columns = useMemo(() => examColumns(mine), [mine]);
  const items = useMemo(() => mine.map((record) => examToItem(record, { getColor: getOrAssignColor, clashes })), [mine, getOrAssignColor, clashes]);

  // Exams from the date sheet leave "My exams" but stay in the full list; exams added
  // by hand are deleted. Either way the toast offers Undo.
  const deleteExam = (id) => {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    setSelectedIds((current) => current.filter((item) => item !== id));
    if (isAddedByHand(record)) {
      setRecords((current) => current.filter((item) => item.id !== id));
      showSuccess(`Deleted ${record.subject}.`, { label: 'Undo', onClick: () => { setRecords((current) => [...current, record].sort(byDateAndTime)); setSelectedIds((current) => [...current, id]); } });
    } else {
      showSuccess(`Removed ${record.subject} from your exams.`, { label: 'Undo', onClick: () => setSelectedIds((current) => (current.includes(id) ? current : [...current, id])) });
    }
  };

  const clearMine = () => {
    if (!window.confirm(`Remove all ${mine.length} exams from your list?`)) return;
    const previous = { records, selectedIds };
    setSelectedIds([]);
    setRecords((current) => current.filter((record) => !isAddedByHand(record)));
    showSuccess('Cleared your exam list.', { label: 'Undo', onClick: () => { setRecords(previous.records); setSelectedIds(previous.selectedIds); } });
  };

  const openExam = (id) => setEditing(records.find((record) => record.id === id));

  const saveExam = (values) => {
    const time = values.start !== null ? (values.end !== null ? `${formatClock(values.start)} – ${formatClock(values.end)}` : formatClock(values.start)) : '';
    const record = {
      ...editing,
      id: editing.id || `manual-${Date.now()}`,
      subject: values.subject.trim() || values.code.trim(),
      code: values.code.trim(),
      date: values.date,
      day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${values.date}T00:00:00Z`)),
      time,
      start: values.start,
      end: values.end,
      room: values.room.trim(),
      program: editing.program || '',
      source: editing.source || 'Added by you'
    };
    setRecords((current) => (editing.id ? current.map((item) => (item.id === record.id ? record : item)) : [...current, record]).sort(byDateAndTime));
    setSelectedIds((current) => (current.includes(record.id) ? current : [...current, record.id]));
    if (!fileInfo) setFileInfo({ name: 'My exams', source: 'exams you added', warnings: [] });
    setPanel('mine');
    goTo('results');
  };

  const share = async () => {
    try {
      const code = await encodeShare(buildExamShare(mine));
      const result = await shareOrCopy({ url: `${window.location.origin}${window.location.pathname}?x=${code}`, title: 'My exams' });
      if (result === 'copied') showSuccess('Link to your exam list copied.');
    } catch {
      showError('The link could not be copied.');
    }
  };

  const startOver = () => {
    if (!window.confirm('Remove this date sheet and your exam list?')) return;
    setRecords([]);
    setSelectedIds([]);
    setFileInfo(null);
    goBack();
  };

  const fileInput = <input ref={inputRef} type="file" hidden accept={EXAM_FILE_ACCEPT} onChange={(event) => handleFile(event.target.files?.[0])} aria-label="Upload an exam date sheet" />;
  const dialog = <ExamDialog exam={editing} onSave={saveExam} onDelete={deleteExam} onClose={() => setEditing(null)} />;

  if (step !== 'results' || (records.length === 0 && !editing)) {
    return (
      <section className="screen start" aria-labelledby="exam-start-title">
        {fileInput}
        <header className="start-head">
          <h1 id="exam-start-title">Find your exams</h1>
          <p>Upload the exam date sheet in whatever format it came in, then keep a list of just your exams.</p>
        </header>

        {records.length > 0 && (
          <ResumeCard title={fileInfo?.name || 'My exams'} detail={`${mine.length} of ${records.length} exams in your list`} onContinue={() => goTo('results')} />
        )}

        {isPasteOpen ? (
          <div className="paste">
            <label className="field">
              <span className="field-label">Paste the date sheet</span>
              <textarea
                className="input textarea"
                rows={9}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={'Monday 18 May 2026\nCS-204 Data Structures   9:00 AM - 12:00 PM   Hall B'}
                autoFocus
              />
            </label>
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => { setIsPasteOpen(false); setError(''); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handlePaste} disabled={!pasteText.trim()}>Find exams</button>
            </div>
          </div>
        ) : (
          <>
            <Dropzone
              title="Drop your exam date sheet"
              hint="PDF, Excel, CSV, Word, or a photo or screenshot. Read on this device, never uploaded."
              busy={Boolean(progress)}
              busyText={progress}
              onFile={handleFile}
              onBrowse={() => inputRef.current?.click()}
            />
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <div className="start-links">
              <button type="button" className="btn" onClick={() => { setError(''); setIsPasteOpen(true); }}>Paste text</button>
              <button type="button" className="btn" onClick={() => setEditing({ subject: '', date: '' })}>Add exams by hand</button>
            </div>
          </>
        )}
        {dialog}
      </section>
    );
  }

  return (
    <div className="screen exams">
      {fileInput}
      <header className="schedule-bar">
        <button type="button" className="bar-icon" onClick={goBack} aria-label="Back to start"><ArrowLeft size={18} /></button>
        <div className="bar-title">
          <strong>{fileInfo?.name || 'My exams'}</strong>
          <span>{records.length} {records.length === 1 ? 'exam' : 'exams'} from {fileInfo?.source || 'your list'}</span>
        </div>
        <button type="button" className="bar-button" onClick={() => inputRef.current?.click()} disabled={Boolean(progress)}>
          <Upload size={16} /> <span>{progress || 'Upload another'}</span>
        </button>
      </header>

      <div className="exams-body">
        {fileInfo?.warnings?.map((warning) => <p className="notice" key={warning}>{warning}</p>)}

        <Segmented
          full
          kind="tabs"
          label="Exam lists"
          value={panel}
          onChange={setPanel}
          options={[{ value: 'all', label: `All exams (${records.length})` }, { value: 'mine', label: `My exams (${mine.length})` }]}
        />

        {panel === 'all' ? (
          <section aria-label="All exams">
            <div className="filters">
              <label className="search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, code or room" aria-label="Search exams" />
                {query && <button type="button" className="icon-btn icon-btn-sm" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
              </label>
              {programs.length > 1 && (
                <select className="input" value={program} onChange={(event) => setProgram(event.target.value)} aria-label="Filter by programme">
                  <option value="">All programmes</option>
                  {programs.map((item) => <option key={item}>{item}</option>)}
                </select>
              )}
            </div>
            <p className="muted small">Tick your exams to add them to “My exams”.</p>

            {groups.length ? groups.map((group) => (
              <section className="exam-day" key={group.date} aria-label={formatDate(group.date)}>
                <h3>{formatDate(group.date)}</h3>
                <ul>
                  {group.records.map((record) => (
                    <li key={record.id}>
                      <label className={`exam-row ${selectedIds.includes(record.id) ? 'is-checked' : ''}`}>
                        <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} />
                        <span className="exam-row-main">
                          <strong>{record.subject}</strong>
                          <small>{[record.code !== record.subject && record.code, record.program].filter(Boolean).join(' · ')}</small>
                        </span>
                        <span className="exam-row-meta">
                          <span>{record.time || 'Time not listed'}</span>
                          {record.room && <small>{record.room}</small>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )) : <p className="empty-note">No exams match{query ? ` “${query}”` : ''}. Try the course code or a shorter part of the name.</p>}
          </section>
        ) : (
          <section aria-label="My exams">
            {mine.length > 0 && (
              <div className="my-actions">
                <button type="button" className="btn" onClick={() => downloadFile('my-exams.ics', examsToIcs(mine), 'text/calendar')}><CalendarPlus size={15} /> Add to calendar</button>
                <button type="button" className="btn" onClick={() => saveElementAsImage(captureRef.current, 'my-exams.png').catch(() => showError('The image could not be created.'))}><Image size={15} /> Save image</button>
                <button type="button" className="btn" onClick={() => window.print()}><Printer size={15} /> Print</button>
                <button type="button" className="btn" onClick={share}><Link2 size={15} /> Share</button>
              </div>
            )}
            {nextExam && <p className="next-exam">Next: <strong>{nextExam.subject}</strong>, {relativeDay(nextExam.date)}</p>}
            {clashes.size > 0 && <p className="notice notice-warn">Some of your exams are on the same day at overlapping times.</p>}

            {mine.length > 0 ? (
              <>
                <div className="my-view">
                  <Segmented
                    label="View"
                    value={view}
                    onChange={setView}
                    options={[{ value: 'list', label: 'List' }, { value: 'grid', label: 'Calendar' }]}
                  />
                  <button type="button" className="link-btn" onClick={clearMine}>Clear list</button>
                </div>
                {/* What you see here is what is saved as an image and printed. */}
                <div className="capture" ref={captureRef} data-print-target="exams">
                  <div className="capture-head">
                    <strong>My exams</strong>
                    <span>{mine.length} {mine.length === 1 ? 'exam' : 'exams'}</span>
                  </div>
                  {view === 'grid'
                    ? <TimeGrid columns={columns} items={items} onSelect={openExam} minHours={EXAM_HOURS} rowHeight={displayOptions.rowHeight} blockStyle={displayOptions.blockStyle} />
                    : <AgendaList groups={groupByColumn(columns, items)} onSelect={openExam} onRemove={deleteExam} removeLabel="Remove" blockStyle={displayOptions.blockStyle} />}
                </div>
              </>
            ) : <p className="empty-note">No exams yet. Tick them in “All exams”, or add one yourself.</p>}

            <button type="button" className="btn add-exam" onClick={() => setEditing({ subject: '', date: '' })}><Plus size={15} /> Add an exam</button>
          </section>
        )}

        <button type="button" className="link-btn start-over" onClick={startOver}>Start over with a different date sheet</button>
      </div>
      {dialog}
    </div>
  );
};

export default ExamTool;
