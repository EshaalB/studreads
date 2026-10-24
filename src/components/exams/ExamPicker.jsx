import { useMemo, useState } from 'react';
import { SITE } from '../../content/site';
import { isAddedByHand } from '../../hooks/useExams';
import { shortDate } from '../../utils/dates';
import { compact } from '../../utils/validation';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';

const words = (text) => new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));

// Does this exam belong to one of the student's courses? Matches codes, exact names,
// one name containing the other, or mostly shared words ("Intro to OOP Lab" vs "OOP Lab").
const matchesCourse = (exam, courseNames) => {
  const subject = compact(exam.subject);
  const code = compact(exam.code);
  const subjectWords = words(exam.subject);
  return courseNames.some((name) => {
    const course = compact(name);
    if (!course) return false;
    if (code && course.includes(code)) return true;
    if (subject === course) return true;
    if (Math.min(subject.length, course.length) >= 6 && (subject.includes(course) || course.includes(subject))) return true;
    const courseWords = words(name);
    const shared = [...courseWords].filter((word) => subjectWords.has(word)).length;
    return shared >= 2 && shared / Math.max(courseWords.size, subjectWords.size) >= 0.6;
  });
};

const REPORT_URL = `${SITE.issues}?title=${encodeURIComponent('Date sheet read wrong')}&body=${encodeURIComponent('University:\nFile type (PDF, Excel, photo…):\nWhat was missing or wrong:\n\nPlease do not attach files with personal details.')}`;

const Row = ({ exam, checked, onToggle }) => (
  <label className={`check-row ${checked ? 'is-checked' : ''}`}>
    <input type="checkbox" checked={checked} onChange={onToggle} />
    <span className="check-row-text">
      <span>{exam.subject}</span>
      <small>{[exam.code !== exam.subject && exam.code, shortDate(exam.date), exam.time].filter(Boolean).join(' · ')}</small>
    </span>
  </label>
);

// Pick your exams from a date sheet: suggestions from your timetable first, then search.
const PickerBody = ({ exams, courseNames, onClose }) => {
  const sheetExams = useMemo(() => exams.records.filter((record) => !isAddedByHand(record)), [exams.records]);
  const suggestions = useMemo(() => sheetExams.filter((exam) => matchesCourse(exam, courseNames)), [sheetExams, courseNames]);
  const [picked, setPicked] = useState(() => {
    const current = sheetExams.filter((exam) => exams.selectedIds.includes(exam.id)).map((exam) => exam.id);
    return new Set(current.length ? current : suggestions.map((exam) => exam.id));
  });
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return sheetExams.filter((exam) => {
      const text = [exam.subject, exam.code, exam.program, exam.room].join(' ').toLowerCase();
      return terms.every((term) => text.includes(term)) || compact(text).includes(compact(query));
    }).slice(0, 60);
  }, [query, sheetExams]);

  const toggle = (id) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const otherPicked = sheetExams.filter((exam) => picked.has(exam.id) && !suggestions.includes(exam));
  const list = query.trim() ? results : [...suggestions, ...otherPicked];

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
                ? `${suggestions.length} ${suggestions.length === 1 ? 'exam matches' : 'exams match'} your timetable. Search to add others.`
                : `${sheetExams.length} exams found. Search for your courses to add them.`}
            </p>
          )}
          {list.length > 0 && (
            <div className="check-list">
              {list.map((exam) => <Row key={exam.id} exam={exam} checked={picked.has(exam.id)} onToggle={() => toggle(exam.id)} />)}
            </div>
          )}
          {query.trim() && results.length === 0 && <p className="muted small">Nothing matches “{query}”. Try the course code or one word of the name.</p>}
          <p className="muted small">
            Exam missing or wrong? <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">Tell us how your sheet is laid out</a> so the reader can learn it.
          </p>
        </div>
      </div>
      <footer className="dialog-footer">
        <span className="muted">{picked.size} selected</span>
        <PushButton onClick={() => { exams.setPicked([...picked]); onClose(); }}>Done</PushButton>
      </footer>
    </>
  );
};

const ExamPicker = ({ isOpen, onClose, exams, courseNames }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title="Find your exams" width={520} bare>
    {isOpen && <PickerBody exams={exams} courseNames={courseNames} onClose={onClose} />}
  </Dialog>
);

export default ExamPicker;
