import { useState } from 'react';
import { parseTime } from '../../utils/timeUtils';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';

const toInput = (minutes) => (minutes === null || minutes === undefined ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);

export const ExamForm = ({ exam, onSave, onDelete, onClose }) => {
  const [form, setForm] = useState({
    subject: exam.subject || '',
    code: exam.code || '',
    date: exam.date || '',
    start: toInput(exam.start),
    end: toInput(exam.end),
    room: exam.room || ''
  });
  const [error, setError] = useState('');
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.subject.trim() && !form.code.trim()) return setError('Add a subject or course code.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setError('Choose the exam date.');
    const start = form.start ? parseTime(form.start) : null;
    const end = form.end ? parseTime(form.end) : null;
    if (start !== null && end !== null && end <= start) return setError('The end time must be after the start time.');
    onSave({ ...form, start, end });
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
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        {exam.id && (
          <button type="button" className="btn btn-danger" onClick={() => { onClose(); onDelete(exam.id); }}>
            {exam.source === 'Added by you' ? 'Delete exam' : 'Remove from my exams'}
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
