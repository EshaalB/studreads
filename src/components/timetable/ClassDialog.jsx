import { useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { isDuplicateClass, validateClass } from '../../utils/classes';
import { DAYS } from '../../utils/constants';
import { toInputTime } from '../../utils/timeUtils';
import ColorField from '../ui/ColorField';
import Dialog from '../ui/Dialog';

const toDraft = (item) => ({
  name: item?.name || '',
  day: item?.day || 'Monday',
  startTime: toInputTime(item?.startTime) || '09:00',
  endTime: toInputTime(item?.endTime) || '10:00',
  room: item?.room || '',
  teacher: item?.teacher || ''
});

// Adds a class, or edits / deletes an existing one when `item.id` is set.
const ClassForm = ({ item, onClose }) => {
  const { classes, addClasses, updateClass, removeClass, palette, getOrAssignColor, setColorMap } = useTimetable();
  const [draft, setDraft] = useState(() => toDraft(item));
  const [color, setColor] = useState(() => (item?.name ? getOrAssignColor(item.name) : ''));
  const [error, setError] = useState('');
  const isEditing = Boolean(item?.id);
  const update = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  const save = (event) => {
    event.preventDefault();
    const check = validateClass({ ...item, ...draft });
    if (!check.valid) { setError(check.error); return; }
    if (isDuplicateClass(check.value, classes, item?.id)) { setError('This class is already on your timetable.'); return; }

    const name = check.value.name;
    if (isEditing) updateClass(item.id, check.value);
    else addClasses([check.value]);

    // Colours belong to the course name, so renaming carries the colour along.
    setColorMap((current) => {
      const next = { ...current };
      if (color) next[name] = color;
      else if (isEditing && item.name !== name && current[item.name] && !current[name]) next[name] = current[item.name];
      return next;
    });
    onClose();
  };

  const remove = () => {
    removeClass(item.id);
    onClose();
  };

  const previewColor = color || (draft.name.trim() ? getOrAssignColor(draft.name.trim()) : palette[0]);
  const sameCourse = isEditing ? classes.filter((other) => other.name === item.name).length : 0;

  return (
    <form className="form" onSubmit={save}>
      <label className="field">
        <span className="field-label">Course</span>
        <input className="input" value={draft.name} onChange={update('name')} placeholder="Data Structures" maxLength={80} autoFocus={!isEditing} />
      </label>
      <label className="field">
        <span className="field-label">Day</span>
        <select className="input" value={draft.day} onChange={update('day')}>
          {DAYS.map((day) => <option key={day}>{day}</option>)}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Starts</span>
          <input className="input" type="time" value={draft.startTime} onChange={update('startTime')} />
        </label>
        <label className="field">
          <span className="field-label">Ends</span>
          <input className="input" type="time" value={draft.endTime} onChange={update('endTime')} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Room</span>
          <input className="input" value={draft.room} onChange={update('room')} placeholder="Optional" maxLength={50} />
        </label>
        <label className="field">
          <span className="field-label">Teacher</span>
          <input className="input" value={draft.teacher} onChange={update('teacher')} placeholder="Optional" maxLength={80} />
        </label>
      </div>
      <div className="field">
        <span className="field-label">Colour{sameCourse > 1 ? ` (all ${sameCourse} ${item.name} classes)` : ''}</span>
        <ColorField value={previewColor} palette={palette} onChange={setColor} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="form-actions">
        {isEditing && <button type="button" className="btn btn-danger" onClick={remove}>Delete</button>}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">{isEditing ? 'Save' : 'Add class'}</button>
      </div>
    </form>
  );
};

const ClassDialog = ({ item, onClose }) => (
  <Dialog isOpen={Boolean(item)} onClose={onClose} title={item?.id ? 'Edit class' : 'Add a class'} width={460}>
    {item && <ClassForm key={item.id || `${item.day}-${item.startTime}`} item={item} onClose={onClose} />}
  </Dialog>
);

export default ClassDialog;
