import { useMemo, useState } from 'react';
import { SITE } from '../../content/site';
import { isAddedByHand } from '../../hooks/useExams';
import { shortDate } from '../../utils/dates';
import { courseMatch } from '../../utils/courseMatch';
import { compact } from '../../utils/validation';
import Dialog from '../ui/Dialog';
import ScanPreview from './ScanPreview';
import PushButton from '../ui/PushButton';

const REPORT_URL = `${SITE.issues}?title=${encodeURIComponent('Date sheet read wrong')}&body=${encodeURIComponent('University:\nFile type (PDF, Excel, photo…):\nWhat was missing or wrong:\n\nPlease do not attach files with personal details.')}`;

const Row = ({ exam, checked, onToggle, possible, onEdit, onShowScan }) => (
  <label className={`check-row ${checked ? 'is-checked' : ''}`}>
    <input type="checkbox" checked={checked} onChange={onToggle} />
    <span className="check-row-text">
      <span>{exam.subject}{possible && <span className="muted small"> · possible match</span>}</span>
      <small>{[exam.code !== exam.subject && exam.code, shortDate(exam.date), exam.time, exam.room].filter(Boolean).join(' · ')}</small>
    </span>
    {onShowScan && <button type="button" className="link-btn check-row-action" onClick={(event) => { event.preventDefault(); onShowScan(exam); }} aria-label={`See ${exam.subject} in the scan`}>See in scan</button>}
    <button type="button" className="link-btn check-row-action" onClick={(event) => { event.preventDefault(); onEdit(exam); }} aria-label={`Correct ${exam.subject}`}>Correct</button>
  </label>
);

const PAGE_SIZE = 25;

// One page of a long list at a time, so a date sheet with thousands of exams stays quick.
const PagedList = ({ items, renderItem, label }) => {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  return (
    <>
      <div className="check-list">{shown.map(renderItem)}</div>
      {pages > 1 && (
        <nav className="pager" aria-label={label}>
          <button type="button" className="link-btn" onClick={() => setPage(current - 1)} disabled={current === 0}>Previous</button>
          <span className="muted small">Page {current + 1} of {pages}</span>
          <button type="button" className="link-btn" onClick={() => setPage(current + 1)} disabled={current === pages - 1}>Next</button>
        </nav>
      )}
    </>
  );
};

// Pick your exams from a date sheet: suggestions from your timetable first, then search.
const PickerBody = ({ exams, courseNames, original, scans = [], onClose, onAddExam, onEditExam }) => {
  const [shownScan, setShownScan] = useState(null);
  const sheetExams = useMemo(() => exams.records.filter((record) => !isAddedByHand(record)), [exams.records]);
  const matches = useMemo(() => new Map(sheetExams.map((exam) => [exam.id, courseMatch(exam, courseNames)]).filter(([, match]) => match)), [sheetExams, courseNames]);
  const suggestions = useMemo(() => sheetExams.filter((exam) => matches.has(exam.id)).sort((a, b) => (matches.get(a.id) === 'sure' ? 0 : 1) - (matches.get(b.id) === 'sure' ? 0 : 1)), [sheetExams, matches]);
  const [picked, setPicked] = useState(() => {
    const current = sheetExams.filter((exam) => exams.selectedIds.includes(exam.id)).map((exam) => exam.id);
    return new Set(current.length ? current : suggestions.filter((exam) => matches.get(exam.id) === 'sure').map((exam) => exam.id));
  });
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return sheetExams.filter((exam) => {
      const text = [exam.subject, exam.code, exam.program, exam.room].join(' ').toLowerCase();
      return terms.every((term) => text.includes(term)) || compact(text).includes(compact(query));
    });
  }, [query, sheetExams]);
  const byDate = useMemo(() => [...sheetExams].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start ?? 0) - (b.start ?? 0)), [sheetExams]);

  const toggle = (id) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const otherPicked = sheetExams.filter((exam) => picked.has(exam.id) && !suggestions.includes(exam));
  const searching = Boolean(query.trim());
  const list = [...suggestions, ...otherPicked];
  const renderRow = (exam) => <Row key={exam.id} exam={exam} checked={picked.has(exam.id)} onToggle={() => toggle(exam.id)} possible={matches.get(exam.id) === 'maybe'} onEdit={(record) => { setPicked((current) => new Set(current).add(record.id)); onEditExam(record); }} onShowScan={exam.scan && scans[exam.scan.page] ? setShownScan : null} />;

  return (
    <>
      <div className="dialog-body">
        <div className="form">
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a course name or code"
            aria-label="Search exams"
            autoFocus
          />
          {!query.trim() && (
            <p className="muted small">
              {suggestions.length
                ? `${suggestions.length} ${suggestions.length === 1 ? 'exam matches' : 'exams match'} your timetable${suggestions.some((exam) => matches.get(exam.id) === 'maybe') ? '; possible matches are not ticked' : ''}. Search to add others.`
                : `${sheetExams.length} exams found. Search for your courses to add them.`}
            </p>
          )}
          {searching && results.length > 0 && (
            <>
              <p className="muted small">{results.length} {results.length === 1 ? 'exam matches' : 'exams match'} “{query.trim()}”.</p>
              <PagedList key={query} items={results} renderItem={renderRow} label="Search results pages" />
            </>
          )}
          {!searching && list.length > 0 && <div className="check-list">{list.map(renderRow)}</div>}
          {!searching && sheetExams.length > 0 && (
            <details className="all-exams">
              <summary>All {sheetExams.length} exams in this date sheet</summary>
              <PagedList items={byDate} renderItem={renderRow} label="All exams pages" />
            </details>
          )}
          {searching && results.length === 0 && (
            <p className="muted small">
              Nothing matches “{query}”. Try the course code or one word of the name, or{' '}
              <button type="button" className="link-btn" onClick={() => onAddExam(query.trim())}>add it yourself</button>.
            </p>
          )}
          {original && <p className="muted small"><a href={original} target="_blank" rel="noopener noreferrer">Open the original file</a> to check names and times side by side.</p>}
          <p className="muted small">
            Exam missing or wrong? <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">Tell us how your sheet is laid out</a> so the reader can learn it.
          </p>
        </div>
      </div>
      {shownScan && <ScanPreview exam={shownScan} page={scans[shownScan.scan.page]} onClose={() => setShownScan(null)} />}
      <footer className="dialog-footer">
        <span className="muted">{picked.size} selected</span>
        <PushButton onClick={() => { exams.setPicked([...picked]); onClose(); }}>Done</PushButton>
      </footer>
    </>
  );
};

const ExamPicker = ({ isOpen, onClose, exams, courseNames, original, scans, onAddExam, onEditExam }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title="Find your exams" width={520} bare>
    {isOpen && <PickerBody exams={exams} courseNames={courseNames} original={original} scans={scans} onClose={onClose} onAddExam={onAddExam} onEditExam={onEditExam} />}
  </Dialog>
);

export default ExamPicker;
