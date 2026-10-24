import { Plus, Search } from 'lucide-react';
import { useMemo } from 'react';
import { examColumns, examToItem, groupByColumn } from '../../utils/calendarItems';
import AgendaList from '../calendar/AgendaList';

const relativeDay = (isoDate) => {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
};

// "Exams" under the timetable: the student's own exams, by date.
const ExamSection = ({ exams, getColor, blockStyle, onOpen, onAdd, onFind }) => {
  const groups = useMemo(() => {
    const items = exams.mine.map((exam) => examToItem(exam, { getColor, clashes: exams.clashes }));
    return groupByColumn(examColumns(exams.mine), items);
  }, [exams.mine, exams.clashes, getColor]);

  if (exams.mine.length === 0 && exams.records.length === 0) return null;

  return (
    <section className="exam-section" aria-labelledby="exams-title">
      <div className="exam-section-head">
        <div>
          <h2 id="exams-title">Exams</h2>
          {exams.nextExam && <p className="muted small">Next: {exams.nextExam.subject}, {relativeDay(exams.nextExam.date)}</p>}
        </div>
        <div className="exam-section-actions no-capture">
          {exams.records.some((record) => record.source !== 'Added by you') && (
            <button type="button" className="btn" onClick={onFind}><Search size={15} /> Find exams</button>
          )}
          <button type="button" className="btn" onClick={onAdd}><Plus size={15} /> Add exam</button>
        </div>
      </div>

      {exams.clashes.size > 0 && <p className="notice notice-warn">Two of your exams are on the same day at overlapping times.</p>}
      {exams.mine.length > 0
        ? <AgendaList groups={groups} onSelect={onOpen} onRemove={exams.removeExam} removeLabel="Remove" blockStyle={blockStyle} />
        : <p className="muted small">No exams picked yet. Use “Find exams” to search the date sheet for your courses.</p>}
    </section>
  );
};

export default ExamSection;
