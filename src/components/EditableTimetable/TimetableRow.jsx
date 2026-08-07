import { Edit2 } from 'lucide-react';
import { sanitizeString } from '../../utils/validation';

const TimetableRow = ({
  cls, idx, isFirstOfDay, dayCount, classKey, bgColor, textColor, isConflicted,
  displayOptions, editingCell, editValue, setEditValue, startEdit, saveEdit, cancelEdit
}) => {
  const sanitizedName = sanitizeString(cls.name);

  return (
    <tr key={`${cls.day}-${cls.startTime}-${idx}`} className={isConflicted ? 'row-conflicted' : ''}>
      {isFirstOfDay && (
        <td rowSpan={dayCount} className="day-cell">
          {editingCell === `${classKey}-day` ? (
            <input
              type="text" value={editValue} autoFocus className="edit-input"
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveEdit(classKey, 'day')}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(classKey, 'day'); if (e.key === 'Escape') cancelEdit(); }}
            />
          ) : (
            <div className="cell-content">
              {sanitizeString(cls.day)}
              <button type="button" className="edit-btn" onClick={() => startEdit(classKey, 'day', cls.day)} aria-label="Edit day"><Edit2 size={12} /></button>
            </div>
          )}
        </td>
      )}
      <td
        className={`course-cell ${isConflicted ? 'conflicted' : ''}`}
        style={{ background: bgColor, color: textColor }}
      >
        {isConflicted && (
          <div className="table-conflict-label">
            Clash
          </div>
        )}
        {editingCell === `${classKey}-name` ? (
          <input
            type="text" value={editValue} autoFocus className="edit-input"
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(classKey, 'name')}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(classKey, 'name'); if (e.key === 'Escape') cancelEdit(); }}
          />
        ) : (
          <div className="cell-content">
            <span className="course-name">{sanitizedName}</span>
            <div className="course-details">
              {displayOptions.showTeacher && (
                <span className="teacher-name">
                  {editingCell === `${classKey}-teacher` ? (
                    <input
                      type="text" value={editValue} autoFocus className="edit-input inline-edit"
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(classKey, 'teacher')}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(classKey, 'teacher'); if (e.key === 'Escape') cancelEdit(); }}
                    />
                  ) : (
                    <>
                      {sanitizeString(cls.teacher) || 'Not Mentioned'}
                      <button type="button" className="edit-btn-small" onClick={() => startEdit(classKey, 'teacher', cls.teacher)} aria-label="Edit teacher"><Edit2 size={10} /></button>
                    </>
                  )}
                </span>
              )}
              {displayOptions.showCredits && cls.credits && <span className="credits">({sanitizeString(cls.credits)} Cr)</span>}
              {displayOptions.showSection && <span className="section">| {sanitizeString(cls.section)}</span>}
            </div>
          </div>
        )}
      </td>
      <td className="time-cell">
        {editingCell === `${classKey}-time` ? (
          <input
            type="text" value={editValue} autoFocus className="edit-input" placeholder="8:30 AM - 10:00 AM"
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(classKey, 'time')}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(classKey, 'time'); if (e.key === 'Escape') cancelEdit(); }}
          />
        ) : (
          <div className="cell-content">
            {sanitizeString(cls.startTime)} - {sanitizeString(cls.endTime)}
            <button type="button" className="edit-btn" onClick={() => startEdit(classKey, 'time', `${cls.startTime} - ${cls.endTime}`)} aria-label="Edit time"><Edit2 size={12} /></button>
          </div>
        )}
      </td>
      <td className="venue-cell">
        {editingCell === `${classKey}-room` ? (
          <input
            type="text" value={editValue} autoFocus className="edit-input"
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(classKey, 'room')}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(classKey, 'room'); if (e.key === 'Escape') cancelEdit(); }}
          />
        ) : (
          <div className="cell-content">
            {sanitizeString(cls.room) || 'N/A'}
            <button type="button" className="edit-btn" onClick={() => startEdit(classKey, 'room', cls.room)} aria-label="Edit venue"><Edit2 size={12} /></button>
          </div>
        )}
      </td>
    </tr>
  );
};

export default TimetableRow;
