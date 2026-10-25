import { useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { minutesToInput, parseTime } from '../../utils/timeUtils';
import ColorField from '../ui/ColorField';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';
import { isAddedByHand } from '../../hooks/useExams';

export const ExamForm = ({ exam, onSave, onDelete, onClose }) => {
  const [form, setForm] = useState({
    subject: exam.subject || '',
    code: exam.code || '',
    date: exam.date || '',
    start: minutesToInput(exam.start),
    end: minutesToInput(exam.end),
    room: exam.room || ''
  });
  const { palette, getOrAssignColor, setColorMap } = useTimetable();
  const [color, setColor] = useState('');
  const [error, setError] = useState('');
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const name = form.subject.trim() || form.code.trim();

  const submit = (event) => {
    event.preventDefault();
    if (!form.subject.trim() && !form.code.trim()) return setError('Add a subject or course code.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setError('Choose the exam date.');
    const start = form.start ? parseTime(form.start) : null;
    const end = form.end ? parseTime(form.end) : null;
    if (start !== null && end !== null && end <= start) return setError('The end time must be after the start time.');
    onSave({ ...form, start, end });
    if (color) setColorMap((current) => ({ ...current, [name]: color }));
    onClose();
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="field-row field-row-wide">
        <label className="field">
          <span className="field-label">Subject</span>
          <input className="input" value={form.subject} onChange={update('subject')} maxLength={100} autoFocus={!exam.id} />
        </label>
        <label className="field">
          <span className="field-label">Code</span>
          <input className="input" value={form.code} onChange={update('code')} maxLength={20} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Date</span>
        <input className="input" type="date" value={form.date} onChange={update('date')} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Starts</span>
          <input className="input" type="time" value={form.start} onChange={update('start')} />
        </label>
        <label className="field">
          <span className="field-label">Ends</span>
          <input className="input" type="time" value={form.end} onChange={update('end')} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Room</span>
        <input className="input" value={form.room} onChange={update('room')} maxLength={50} placeholder="Optional" />
      </label>
      <div className="field">
        <span className="field-label">Colour</span>
        <ColorField value={color || (name ? getOrAssignColor(name) : palette[0])} palette={palette} onChange={setColor} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        {exam.id && (
          <button type="button" className="btn btn-danger" onClick={() => { onClose(); onDelete(exam.id); }}>
            {isAddedByHand(exam) ? 'Delete exam' : 'Remove from my exams'}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <PushButton type="submit">{exam.id ? 'Save' : 'Add exam'}</PushButton>
      </div>
    </form>
  );
};

const ExamDialog = ({ exam, onSave, onDelete, onClose }) => (
  <Dialog isOpen={Boolean(exam)} onClose={onClose} title={exam?.id ? 'Edit exam' : 'Add an exam'} width={460}>
    {exam && <ExamForm key={exam.id || 'new'} exam={exam} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
  </Dialog>
);

export default ExamDialog;
