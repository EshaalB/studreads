import { Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { DAYS } from '../../utils/constants';
import { isDuplicateManualEntry, validateManualEntry } from '../../utils/manualTimetable';

const EMPTY_CLASS = {
  courseName: '', day: 'Monday', startTime: '09:00', endTime: '10:00',
  room: '', instructor: '', credits: ''
};

const ManualTimetable = ({ entries, onChange, onCancel }) => {
  const [draft, setDraft] = useState(EMPTY_CLASS);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');

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
    setDraft((current) => ({ ...EMPTY_CLASS, day: current.day, startTime: current.startTime, endTime: current.endTime }));
    setEditingId('');
    setError('');
  };

  const removeClass = (id) => {
    onChange(entries.filter((entry) => entry.id !== id));
    if (editingId === id) { setEditingId(''); setDraft(EMPTY_CLASS); setError(''); }
  };

  const editClass = (entry) => {
    setDraft(entry);
    setEditingId(entry.id);
    setError('');
  };

  const cancelEdit = () => { setDraft(EMPTY_CLASS); setEditingId(''); setError(''); };

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

      <form className="manual-class-form" onSubmit={saveClass}>
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
        <button type="submit" className="btn btn-primary manual-add-button">{editingId ? <Check size={16} /> : <Plus size={16} />} {editingId ? 'Save class' : 'Add class'}</button>
        {editingId && <button type="button" className="btn btn-outline manual-cancel-edit" onClick={cancelEdit}>Cancel</button>}
      </form>
      {error && <p className="manual-error" role="alert">{error}</p>}

      {entries.length > 0 && (
        <div className="manual-entry-list" aria-label="Manually added classes">
          {entries.map((entry) => (
            <div className="manual-entry" key={entry.id}>
              <div><strong>{entry.courseName}</strong><span>{entry.day} · {entry.startTime}–{entry.endTime}{entry.room ? ` · ${entry.room}` : ''}</span></div>
              <div className="manual-entry-actions">
                <button type="button" className="btn-icon" onClick={() => editClass(entry)} aria-label={`Edit ${entry.courseName}`}><Edit2 size={15} /></button>
                <button type="button" className="btn-icon" onClick={() => removeClass(entry.id)} aria-label={`Remove ${entry.courseName}`}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ManualTimetable;
