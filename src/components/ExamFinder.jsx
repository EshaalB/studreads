import { CalendarPlus, ChevronDown, ChevronRight, Download, FileSpreadsheet, Link2, Pencil, Plus, Printer, Search, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showError, showSuccess } from '../utils/errorHandler';
import { EXAM_FILE_ACCEPT, readExamFile, readExamText } from '../utils/examLoaders';
import { formatClock } from '../utils/examParser';
import { downloadFile, examsToCsv, examsToIcs } from '../utils/exportUtils';
import { decodeShare, encodeShare, shareOrCopy } from '../utils/sharingUtils';
import { parseTime } from '../utils/timeUtils';
import { buildExamShare, readExamPayload } from '../utils/transfer';
import Menu from './ui/Menu';

const STORAGE_KEY = 'studreads_exams_v1';
const EMPTY_FORM = { subject: '', code: '', date: '', start: '', end: '', room: '' };

const readSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.records)) return saved;
  } catch {
    // Fall through to an empty state.
  }
  return { records: [], selectedIds: [], fileInfo: null };
};

const formatDate = (isoDate, style = 'long') => new Intl.DateTimeFormat('en-GB', style === 'long'
  ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
  : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
).format(new Date(`${isoDate}T00:00:00Z`));

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const daysUntil = (isoDate) => Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86400000);
const relativeDay = (days) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`);
const toInput = (minutes) => (minutes === null || minutes === undefined ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);

const findClashes = (records) => {
  const clashes = new Set();
  records.forEach((a, index) => records.slice(index + 1).forEach((b) => {
    if (a.date !== b.date) return;
    const overlap = a.start === null || b.start === null
      ? true
      : a.start < (b.end ?? b.start + 180) && b.start < (a.end ?? a.start + 180);
    if (overlap) { clashes.add(a.id); clashes.add(b.id); }
  }));
  return clashes;
};

const ExamForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.subject.trim() && !form.code.trim()) return setError('Add a subject or course code.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setError('Choose the exam date.');
    const start = form.start ? parseTime(form.start) : null;
    const end = form.end ? parseTime(form.end) : null;
    if (start !== null && end !== null && end <= start) return setError('The end time must be after the start time.');
    onSave({ ...form, start, end });
  };

  return (
    <form className="exam-form" onSubmit={submit}>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Subject</span>
          <input className="input" value={form.subject} onChange={(event) => update('subject', event.target.value)} maxLength={100} autoFocus />
        </label>
        <label className="field field-narrow">
          <span className="field-label">Code</span>
          <input className="input" value={form.code} onChange={(event) => update('code', event.target.value)} maxLength={20} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Date</span>
        <input className="input" type="date" value={form.date} onChange={(event) => update('date', event.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Starts</span>
          <input className="input" type="time" value={form.start} onChange={(event) => update('start', event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Ends</span>
          <input className="input" type="time" value={form.end} onChange={(event) => update('end', event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Room</span>
        <input className="input" value={form.room} onChange={(event) => update('room', event.target.value)} maxLength={50} placeholder="Optional" />
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary btn-sm">Save exam</button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

const ExamFinder = ({ sharedExams }) => {
  const inputRef = useRef(null);
  const [saved] = useState(readSaved);
  const [records, setRecords] = useState(saved.records);
  const [selectedIds, setSelectedIds] = useState(saved.selectedIds || []);
  const [fileInfo, setFileInfo] = useState(saved.fileInfo);
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [form, setForm] = useState(null);
  const [mobilePanel, setMobilePanel] = useState('all');
  const sharedAppliedRef = useRef(false);
  const isLoading = Boolean(progress);

  useEffect(() => {
    try {
      if (records.length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, selectedIds, fileInfo }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Very large date sheets may not fit in storage; the list still works for this visit.
    }
  }, [records, selectedIds, fileInfo]);

  const loadResult = useCallback((result, name) => {
    setRecords(result.records);
    setSelectedIds([]);
    setQuery('');
    setProgram('');
    setMobilePanel('all');
    setFileInfo({
      name,
      source: result.source,
      warnings: [
        ...(result.warnings || []),
        ...(result.hasAmbiguousDates ? ['Dates such as 03/04 are read as day/month. Check them before adding exams to your calendar.'] : [])
      ]
    });
  }, []);

  useEffect(() => {
    if (sharedAppliedRef.current || !sharedExams) return;
    sharedAppliedRef.current = true;
    (async () => {
      const shared = readExamPayload(await decodeShare(sharedExams));
      if (shared.length === 0) { showError('This exam link is incomplete or damaged.'); return; }
      if (records.length && !window.confirm('Replace your current exam list with the shared one?')) return;
      setRecords(shared);
      setSelectedIds(shared.map((record) => record.id));
      setFileInfo({ name: 'Shared exam list', source: 'a shared link', warnings: [] });
      setMobilePanel('mine');
      showSuccess(`Opened ${shared.length} shared ${shared.length === 1 ? 'exam' : 'exams'}.`);
    })();
  }, [sharedExams, records.length]);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setProgress('Reading file');
    try {
      loadResult(await readExamFile(file, setProgress), file.name);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The date sheet could not be read.');
    } finally {
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handlePaste = () => {
    setError('');
    try {
      loadResult(readExamText(pasteText), 'Pasted text');
      setIsPasteOpen(false);
      setPasteText('');
    } catch (pasteError) {
      setError(pasteError.message);
    }
  };

  const programs = useMemo(() => [...new Set(records.map((record) => record.program).filter(Boolean))].sort(), [records]);

  const filteredRecords = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return records.filter((record) => {
      if (program && record.program !== program) return false;
      if (terms.length === 0) return true;
      const haystack = [record.subject, record.code, record.program, record.room, record.teacher].join(' ').toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [query, program, records]);

  const groupedResults = useMemo(() => {
    const groups = [];
    filteredRecords.forEach((record) => {
      const group = groups[groups.length - 1];
      if (group?.date === record.date) group.records.push(record);
      else groups.push({ date: record.date, records: [record] });
    });
    return groups;
  }, [filteredRecords]);

  const selectedRecords = useMemo(() => records.filter((record) => selectedIds.includes(record.id))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0)), [records, selectedIds]);
  const clashes = useMemo(() => findClashes(selectedRecords), [selectedRecords]);
  const nextExam = selectedRecords.find((record) => record.date >= todayIso()) || null;

  const toggleExam = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const saveForm = (values) => {
    const time = values.start !== null ? (values.end !== null ? `${formatClock(values.start)} – ${formatClock(values.end)}` : formatClock(values.start)) : '';
    const record = {
      id: form.id || `manual-${Date.now()}`,
      subject: values.subject.trim() || values.code.trim(),
      code: values.code.trim(),
      date: values.date,
      day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${values.date}T00:00:00Z`)),
      time,
      start: values.start,
      end: values.end,
      room: values.room.trim(),
      program: form.program || '',
      teacher: '',
      source: form.source || 'Added by you'
    };
    setRecords((current) => (form.id ? current.map((item) => item.id === form.id ? record : item) : [...current, record])
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0)));
    setSelectedIds((current) => current.includes(record.id) ? current : [...current, record.id]);
    if (!fileInfo) setFileInfo({ name: 'My exams', source: 'exams you added', warnings: [] });
    setForm(null);
  };

  const editExam = (record) => setForm({
    id: record.id, program: record.program, source: record.source,
    subject: record.subject, code: record.code, date: record.date,
    start: toInput(record.start), end: toInput(record.end), room: record.room
  });

  const share = async () => {
    try {
      const code = await encodeShare(buildExamShare(selectedRecords));
      const result = await shareOrCopy({ url: `${window.location.origin}${window.location.pathname}?x=${code}`, title: 'My exams' });
      if (result === 'copied') showSuccess('Link to your exam list copied.');
    } catch {
      showError('The link could not be copied.');
    }
  };

  const reset = () => {
    if (!window.confirm('Remove this date sheet and your exam list?')) return;
    setRecords([]);
    setSelectedIds([]);
    setFileInfo(null);
    setQuery('');
    setProgram('');
    setError('');
    setForm(null);
  };

  const fileInput = <input ref={inputRef} type="file" hidden accept={EXAM_FILE_ACCEPT} onChange={(event) => handleFile(event.target.files?.[0])} aria-label="Upload an exam date sheet" />;

  if (records.length === 0 && !form) {
    return (
      <section className="start" aria-labelledby="exam-start-title">
        {fileInput}
        <header className="page-head">
          <h1 id="exam-start-title">Find your exams</h1>
          <p>Upload the exam date sheet in whatever format it came in, search for your subjects and keep a list of just your exams.</p>
        </header>

        {isPasteOpen ? (
          <div className="panel paste-panel">
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
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={handlePaste} disabled={!pasteText.trim()}>Find exams</button>
              <button type="button" className="btn" onClick={() => { setIsPasteOpen(false); setError(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files?.[0]); }}
            >
              {isLoading ? (
                <div className="dropzone-body" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <p className="dropzone-title">{progress}</p>
                  <p className="dropzone-hint">Large or scanned files can take a little while.</p>
                </div>
              ) : (
                <div className="dropzone-body">
                  <Upload size={20} aria-hidden="true" />
                  <p className="dropzone-title">Drop a date sheet here</p>
                  <p className="dropzone-hint">PDF, Excel, CSV, Word, or a photo or screenshot. Read on this device, never uploaded.</p>
                  <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>Choose file</button>
                </div>
              )}
            </div>
            {error && <p className="notice notice-error" role="alert">{error}</p>}

            <div className="option-list" aria-label="Other ways to start">
              <button type="button" className="option-row" onClick={() => { setError(''); setIsPasteOpen(true); }}>
                <span><strong>Paste text</strong><small>Copied from a website, email, PDF or group chat</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="option-row" onClick={() => setForm({ ...EMPTY_FORM })}>
                <span><strong>Add exams by hand</strong><small>Type in your own dates and times</small></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="exams">
      {fileInput}
      <div className="exams-head">
        <div className="source-bar source-bar-flat">
          <span className="source-icon" aria-hidden="true"><FileSpreadsheet size={15} /></span>
          <div className="source-text">
            <strong title={fileInfo?.name}>{fileInfo?.name || 'My exams'}</strong>
            <span>{records.length} {records.length === 1 ? 'exam' : 'exams'} from {fileInfo?.source || 'your list'}</span>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={isLoading}>
            {isLoading ? progress : 'Upload another'}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={reset}>Start over</button>
        </div>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {fileInfo?.warnings?.map((warning) => <p className="notice" key={warning}>{warning}</p>)}

      <div className="segmented segmented-full show-narrow" role="tablist" aria-label="Exam lists">
        <button type="button" role="tab" aria-selected={mobilePanel === 'all'} onClick={() => setMobilePanel('all')}>All exams</button>
        <button type="button" role="tab" aria-selected={mobilePanel === 'mine'} onClick={() => setMobilePanel('mine')}>My exams ({selectedRecords.length})</button>
      </div>

      <div className="exams-layout" data-panel={mobilePanel}>
        <section className="exam-results" aria-label="All exams">
          <div className="filters">
            <label className="search-field">
              <Search size={15} aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, code or room" aria-label="Search exams" />
              {query && <button type="button" className="icon-btn icon-btn-sm" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
            </label>
            {programs.length > 1 && (
              <select className="input" value={program} onChange={(event) => setProgram(event.target.value)} aria-label="Filter by programme">
                <option value="">All programmes</option>
                {programs.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            )}
          </div>

          {groupedResults.length > 0 ? (
            <div className="result-groups">
              {groupedResults.map((group) => (
                <section className="result-group" key={group.date} aria-label={formatDate(group.date)}>
                  <h3 className="result-date">{formatDate(group.date)}</h3>
                  <ul>
                    {group.records.map((record) => {
                      const selected = selectedIds.includes(record.id);
                      return (
                        <li key={record.id}>
                          <button type="button" className={`result ${selected ? 'is-checked' : ''}`} onClick={() => toggleExam(record.id)} aria-pressed={selected}>
                            <span className="checkbox" aria-hidden="true">{selected && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
                            <span className="result-main">
                              <strong>{record.subject}</strong>
                              <small>{[record.code !== record.subject && record.code, record.program].filter(Boolean).join(' · ')}</small>
                            </span>
                            <span className="result-time">{record.time || <span className="muted">No time</span>}</span>
                            <span className="result-room">{record.room}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="empty-note">No exams match{query ? ` “${query}”` : ''}. Try a course code or a shorter part of the name.</p>
          )}
        </section>

        <aside className="my-exams" aria-labelledby="my-exams-title" data-print-target="exams">
          <div className="my-exams-head">
            <h2 id="my-exams-title">My exams <span className="count">{selectedRecords.length}</span></h2>
            <div className="actions no-print">
              <button type="button" className="icon-btn" onClick={share} disabled={selectedRecords.length === 0} aria-label="Share my exams"><Link2 size={16} /></button>
              <Menu
                triggerClassName="btn btn-primary btn-sm"
                trigger={<><Download size={14} /> Export <ChevronDown size={13} /></>}
                items={[
                  { label: 'Calendar', hint: '.ics for Google, Apple or Outlook', icon: <CalendarPlus size={15} />, disabled: selectedRecords.length === 0, onSelect: () => downloadFile('my-exams.ics', examsToIcs(selectedRecords), 'text/calendar') },
                  { label: 'Spreadsheet', hint: '.csv', icon: <FileSpreadsheet size={15} />, disabled: selectedRecords.length === 0, onSelect: () => downloadFile('my-exams.csv', examsToCsv(selectedRecords), 'text/csv') },
                  { label: 'Print or PDF', icon: <Printer size={15} />, disabled: selectedRecords.length === 0, onSelect: () => window.print() }
                ]}
              />
            </div>
          </div>

          {nextExam && (
            <p className="next-exam">
              <span>Next</span> {nextExam.code || nextExam.subject}, {relativeDay(daysUntil(nextExam.date)).toLowerCase()}
            </p>
          )}
          {clashes.size > 0 && <p className="notice notice-warn">Some of your exams are on the same day at overlapping times.</p>}

          {selectedRecords.length > 0 ? (
            <ol className="my-exam-list">
              {selectedRecords.map((record) => (
                <li key={record.id} className={clashes.has(record.id) ? 'has-clash' : ''}>
                  <time dateTime={record.date}>{formatDate(record.date, 'short')}</time>
                  <div className="my-exam-text">
                    <strong>{record.subject}</strong>
                    <span>{record.time || 'Time not listed'}</span>
                    {(record.code !== record.subject && record.code) || record.room
                      ? <span>{[record.code !== record.subject && record.code, record.room].filter(Boolean).join(' · ')}</span>
                      : null}
                  </div>
                  <div className="row-actions no-print">
                    <button type="button" className="icon-btn icon-btn-sm" onClick={() => editExam(record)} aria-label={`Edit ${record.subject}`}><Pencil size={13} /></button>
                    <button type="button" className="icon-btn icon-btn-sm" onClick={() => toggleExam(record.id)} aria-label={`Remove ${record.subject} from my exams`}><X size={14} /></button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-note">Tick exams in the list to collect them here.</p>
          )}

          {form ? (
            <ExamForm initial={form} onSave={saveForm} onCancel={() => setForm(null)} />
          ) : (
            <button type="button" className="btn btn-sm btn-ghost add-exam no-print" onClick={() => setForm({ ...EMPTY_FORM })}>
              <Plus size={14} /> Add an exam
            </button>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ExamFinder;
