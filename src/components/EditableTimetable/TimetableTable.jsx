import { useTimetable } from '../../context/useTimetable';
import TimetableRow from './TimetableRow';

const TimetableTable = ({
  tableRef, sortedClasses, getOrAssignColor, getContrastYIQ,
  displayOptions, editingCell, editValue, setEditValue, startEdit, saveEdit, cancelEdit
}) => {
  const { conflicts } = useTimetable();

  return (
    <div className="timetable-wrapper" ref={tableRef}>
      <table className="timetable-table">
        <thead>
          <tr>
            <th className="col-day">Day</th>
            <th className="col-course">Course</th>
            <th className="col-time">Time</th>
            <th className="col-venue">Venue</th>
          </tr>
        </thead>
        <tbody>
          {sortedClasses.map((cls, idx) => {
            const isFirstOfDay = idx === 0 || sortedClasses[idx - 1].day !== cls.day;
            const dayCount = sortedClasses.filter(c => c.day === cls.day).length;
            const classKey = `${cls.day}-${cls.startTime}-${cls.name}`;
            const bgColor = getOrAssignColor(cls.name);
            const textColor = getContrastYIQ(bgColor);
            const isConflicted = conflicts.has(cls.id);

            return (
              <TimetableRow
                key={`${cls.day}-${cls.startTime}-${idx}`}
                cls={cls} idx={idx} isFirstOfDay={isFirstOfDay} dayCount={dayCount} classKey={classKey} bgColor={bgColor} textColor={textColor}
                isConflicted={isConflicted}
                displayOptions={displayOptions} editingCell={editingCell} editValue={editValue} setEditValue={setEditValue} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableTable;
