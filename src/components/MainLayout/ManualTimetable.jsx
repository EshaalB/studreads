import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { DAY_ORDER, DAYS } from '../../utils/constants';
import { isDuplicateManualEntry, validateManualEntry } from '../../utils/manualTimetable';
import { displayTimeRange, parseTime } from '../../utils/timeUtils';

const EMPTY_CLASS = {
  courseName: '', day: 'Monday', startTime: '09:00', endTime: '10:00',
  room: '', instructor: '', credits: ''
};

const ManualTimetable = ({ entries, onChange }) => {
  const { displayOptions } = useTimetable();
  const [draft, setDraft] = useState(EMPTY_CLASS);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');

  const sortedEntries = useMemo(() => [...entries].sort((a, b) =>
    (DAY_ORDER[a.day] || 9) - (DAY_ORDER[b.day] || 9) || (parseTime(a.startTime) ?? 0) - (parseTime(b.startTime) ?? 0)
  ), [entries]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const saveClass = (event) => {
    event.preventDefault();
    const validation = validateManualEntry(draft);
    if (!validation.valid) return setError(validation.error);
    if (isDuplicateManualEntry(validation.entry, entries, editingId)) return setError('That class is already in your timetable.');

    if (editingId) {
      onChange(entries.map((entry) => entry.id === editingId ? { ...validation.entry, id: editingId } : entry));
    } else {
      const id = globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${Math.random()}`;
      onChange([...entries, { ...validation.entry, id }]);
    }
    // The next class is often on the same day, straight after this one.
    const start = parseTime(validation.entry.startTime);
    const end = parseTime(validation.entry.endTime);
    const nextEnd = Math.min(end + (end - start), 23 * 60 + 59);
    setDraft({ ...EMPTY_CLASS, day: validation.entry.day, startTime: validation.entry.endTime, endTime: `${String(Math.floor(nextEnd / 60)).padStart(2, '0')}:${String(nextEnd % 60).padStart(2, '0')}` });
    setEditingId('');
    setError('');
  };

  const removeClass = (entry) => {
    onChange(entries.filter((item) => item.id !== entry.id));
    if (editingId === entry.id) cancelEdit();
  };

  const editClass = (entry) => {
    setDraft(entry);
    setEditingId(entry.id);
    setError('');
  };

  const cancelEdit = () => { setDraft(EMPTY_CLASS); setEditingId(''); setError(''); };

  return (
    <section className="side-section" aria-labelledby="manual-title">
      <h2 className="side-title" id="manual-title">{editingId ? 'Edit class' : 'Add a class'}</h2>
      <form className="class-form" onSubmit={saveClass}>
        <label className="field">
          <span className="field-label">Course</span>
          <input className="input" value={draft.courseName} onChange={(event) => updateDraft('courseName', event.target.value)} placeholder="Data Structures" maxLength={80} />
        </label>
        <label className="field">
          <span className="field-label">Day</span>
          <select className="input" value={draft.day} onChange={(event) => updateDraft('day', event.target.value)}>
            {DAYS.map((day) => <option key={day}>{day}</option>)}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Starts</span>
            <input className="input" type="time" value={draft.startTime} onChange={(event) => updateDraft('startTime', event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Ends</span>
            <input className="input" type="time" value={draft.endTime} onChange={(event) => updateDraft('endTime', event.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Room</span>
            <input className="input" value={draft.room} onChange={(event) => updateDraft('room', event.target.value)} placeholder="Optional" maxLength={50} />
          </label>
          <label className="field">
            <span className="field-label">Teacher</span>
            <input className="input" value={draft.instructor} onChange={(event) => updateDraft('instructor', event.target.value)} placeholder="Optional" maxLength={80} />
          </label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : <><Plus size={15} /> Add class</>}</button>
          {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      {sortedEntries.length > 0 && (
        <ul className="entry-list" aria-label="Your classes">
          {sortedEntries.map((entry) => (
            <li className={`entry ${editingId === entry.id ? 'is-editing' : ''}`} key={entry.id}>
              <div className="entry-text">
                <strong>{entry.courseName}</strong>
                <span>{entry.day.slice(0, 3)} · {displayTimeRange(entry.startTime, entry.endTime, displayOptions.timeFormat)}{entry.room ? ` · ${entry.room}` : ''}</span>
              </div>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => editClass(entry)} aria-label={`Edit ${entry.courseName}`}><Pencil size={14} /></button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeClass(entry)} aria-label={`Remove ${entry.courseName}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ManualTimetable;
