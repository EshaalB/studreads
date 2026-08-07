import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { DAYS } from '../../utils/constants';
import { parseTime } from '../../utils/timeUtils';

const EMPTY_CLASS = {
  courseName: '', day: 'Monday', startTime: '09:00', endTime: '10:00',
  room: '', instructor: '', credits: ''
};

const ManualTimetable = ({ entries, onChange, onCancel }) => {
  const [draft, setDraft] = useState(EMPTY_CLASS);
  const [error, setError] = useState('');

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const addClass = (event) => {
    event.preventDefault();
    const name = draft.courseName.trim();
    const start = parseTime(draft.startTime);
    const end = parseTime(draft.endTime);
    if (!name) return setError('Add a course name.');
    if (start === null || end === null || end <= start) return setError('Choose an end time after the start time.');

    onChange([...entries, { ...draft, courseName: name, id: crypto.randomUUID() }]);
    setDraft((current) => ({ ...EMPTY_CLASS, day: current.day, startTime: current.startTime, endTime: current.endTime }));
    setError('');
  };

  const removeClass = (id) => onChange(entries.filter((entry) => entry.id !== id));

  return (
    <section className="manual-builder" aria-labelledby="manual-builder-title">
      <div className="manual-builder-header">
        <div>
          <span className="manual-eyebrow">No spreadsheet needed</span>
          <h2 id="manual-builder-title">Add your classes</h2>
          <p>Enter one class at a time. Your week updates immediately below.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          <X size={14} /> {entries.length ? 'Start over' : 'Back to upload'}
        </button>
      </div>

      <form className="manual-class-form" onSubmit={addClass}>
        <label className="manual-field manual-field-name">
          <span>Course name</span>
          <input value={draft.courseName} onChange={(event) => updateDraft('courseName', event.target.value)} placeholder="e.g. Data Structures" maxLength={80} autoFocus />
        </label>
        <label className="manual-field">
          <span>Day</span>
          <select value={draft.day} onChange={(event) => updateDraft('day', event.target.value)}>
            {DAYS.map((day) => <option key={day}>{day}</option>)}
          </select>
        </label>
        <label className="manual-field">
          <span>Starts</span>
          <input type="time" value={draft.startTime} onChange={(event) => updateDraft('startTime', event.target.value)} />
        </label>
        <label className="manual-field">
          <span>Ends</span>
          <input type="time" value={draft.endTime} onChange={(event) => updateDraft('endTime', event.target.value)} />
        </label>
        <label className="manual-field">
          <span>Room <small>optional</small></span>
          <input value={draft.room} onChange={(event) => updateDraft('room', event.target.value)} placeholder="C-201" maxLength={50} />
        </label>
        <label className="manual-field">
          <span>Teacher <small>optional</small></span>
          <input value={draft.instructor} onChange={(event) => updateDraft('instructor', event.target.value)} placeholder="Teacher name" maxLength={80} />
        </label>
        <button type="submit" className="btn btn-primary manual-add-button"><Plus size={16} /> Add class</button>
      </form>
      {error && <p className="manual-error" role="alert">{error}</p>}

      {entries.length > 0 && (
        <div className="manual-entry-list" aria-label="Manually added classes">
          {entries.map((entry) => (
            <div className="manual-entry" key={entry.id}>
              <div><strong>{entry.courseName}</strong><span>{entry.day} · {entry.startTime}–{entry.endTime}{entry.room ? ` · ${entry.room}` : ''}</span></div>
              <button type="button" className="btn-icon" onClick={() => removeClass(entry.id)} aria-label={`Remove ${entry.courseName}`}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ManualTimetable;
