import { useRef } from 'react';
import { readableText } from '../../utils/themes';
import ColorPicker from '../ui/ColorPicker';
import { displayTimeRange } from '../../utils/timeUtils';

// A value that turns into a text field when clicked.
const EditableText = ({ value, display, label, isEditing, editable, onStart, onSave, onCancel, placeholder = '—' }) => {
  const cancelled = useRef(false);
  if (!editable) return <span>{display ?? value ?? placeholder}</span>;
  if (isEditing) {
    return (
      <input
        className="cell-input"
        defaultValue={value}
        autoFocus
        aria-label={label}
        onFocus={(event) => { cancelled.current = false; event.target.select(); }}
        onBlur={(event) => { if (!cancelled.current) onSave(event.target.value); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') { cancelled.current = true; onCancel(); }
        }}
      />
    );
  }
  return (
    <button type="button" className="cell-edit" onClick={onStart} aria-label={`${label}: ${value || 'empty'}. Edit`}>
      {display || value || <span className="muted">{placeholder}</span>}
    </button>
  );
};

const TimetableTable = ({ classes, getOrAssignColor, displayOptions, conflicts, editingCell, setEditingCell, onSave, editable, palette, onColorChange }) => {
  const field = (cls, name) => ({
    editable,
    isEditing: editingCell === `${cls.editKey}:${name}`,
    onStart: () => setEditingCell(`${cls.editKey}:${name}`),
    onCancel: () => setEditingCell(null),
    onSave: (value) => { onSave(cls.editKey, name, value); setEditingCell(null); }
  });

  return (
    <div className="list-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th scope="col" className="col-day">Day</th>
            <th scope="col" className="col-time">Time</th>
            <th scope="col">Course</th>
            {displayOptions.showRoom && <th scope="col" className="col-room">Room</th>}
          </tr>
        </thead>
        <tbody>
          {classes.map((cls, index) => {
            const isFirstOfDay = index === 0 || classes[index - 1].day !== cls.day;
            const dayCount = isFirstOfDay ? classes.filter((item) => item.day === cls.day).length : 0;
            const meta = [
              displayOptions.showTeacher && cls.teacher,
              displayOptions.showCredits && cls.credits && `${cls.credits} credit${cls.credits === '1' ? '' : 's'}`,
              displayOptions.showSection && cls.section
            ].filter(Boolean);
            return (
              <tr
                key={`${cls.id}-${index}`}
                className={`course-row ${isFirstOfDay ? 'is-day-start' : ''}`}
                style={{ '--row-bg': getOrAssignColor(cls.name), '--row-text': readableText(getOrAssignColor(cls.name)) }}
              >
                {isFirstOfDay && <th scope="rowgroup" rowSpan={dayCount} className="col-day">{cls.day}</th>}
                <td className="col-time">
                  <EditableText
                    {...field(cls, 'time')}
                    label={`Time for ${cls.name}`}
                    value={`${cls.startTime} - ${cls.endTime}`}
                    display={displayTimeRange(cls.startTime, cls.endTime, displayOptions.timeFormat)}
                  />
                </td>
                <td>
                  <div className="course-cell">
                    <ColorPicker value={getOrAssignColor(cls.name)} palette={palette} label={cls.name} onChange={(color) => onColorChange(cls.name, color)} />
                    <div className="course-text">
                      <EditableText {...field(cls, 'name')} label="Course name" value={cls.name} />
                      {(meta.length > 0 || (editable && displayOptions.showTeacher)) && (
                        <span className="course-meta">
                          {displayOptions.showTeacher
                            ? <EditableText {...field(cls, 'teacher')} label={`Teacher for ${cls.name}`} value={cls.teacher} placeholder="Add teacher" />
                            : null}
                          {meta.slice(displayOptions.showTeacher && cls.teacher ? 1 : 0).map((item) => <span key={item}>{item}</span>)}
                        </span>
                      )}
                    </div>
                    {conflicts.has(cls.id) && <span className="badge badge-warn">Clash</span>}
                  </div>
                </td>
                {displayOptions.showRoom && (
                  <td className="col-room"><EditableText {...field(cls, 'room')} label={`Room for ${cls.name}`} value={cls.room} placeholder={editable ? 'Add room' : '—'} /></td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableTable;
