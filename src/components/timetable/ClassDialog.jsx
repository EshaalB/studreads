import { useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { isDuplicateClass, validateClass } from '../../utils/classes';
import { DAYS } from '../../utils/constants';
import { showSuccess } from '../../utils/errorHandler';
import { parseTime, toInputTime } from '../../utils/timeUtils';
import ColorField from '../ui/ColorField';
import { ExamForm } from '../exams/ExamDialog';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';
import Segmented from '../ui/Segmented';

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
    showSuccess(`Deleted ${item.name} (${item.day.slice(0, 3)}).`, { label: 'Undo', onClick: () => addClasses([item]) });
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
        <PushButton type="submit">{isEditing ? 'Save' : 'Add class'}</PushButton>
      </div>
    </form>
  );
};

const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// The next date (today or later) that falls on the given weekday, as YYYY-MM-DD.
const nextDateFor = (day) => {
  const date = new Date();
  date.setDate(date.getDate() + ((DAY_INDEX[day] ?? date.getDay()) - date.getDay() + 7) % 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Adding asks whether it is a weekly class or a one-off exam; editing goes straight to the form.
const AddOrEdit = ({ item, exams, onClose }) => {
  const [mode, setMode] = useState('class');
  if (item.id) return <ClassForm item={item} onClose={onClose} />;
  const start = parseTime(item.startTime);
  return (
    <div className="form">
      <Segmented
        full
        label="What are you adding?"
        value={mode}
        onChange={setMode}
        options={[{ value: 'class', label: 'Weekly class' }, { value: 'exam', label: 'Exam' }]}
      />
      {mode === 'class'
        ? <ClassForm item={item} onClose={onClose} />
        : <ExamForm exam={{ subject: '', date: nextDateFor(item.day), start, end: start === null ? null : Math.min(start + 180, 23 * 60 + 59) }} onSave={(values) => exams.saveExam(values, {})} onDelete={() => {}} onClose={onClose} />}
    </div>
  );
};

const ClassDialog = ({ item, exams, onClose }) => (
  <Dialog isOpen={Boolean(item)} onClose={onClose} title={item?.id ? 'Edit class' : 'Add to your timetable'} width={460}>
    {item && <AddOrEdit key={item.id || `${item.day}-${item.startTime}`} item={item} exams={exams} onClose={onClose} />}
  </Dialog>
);

export default ClassDialog;
