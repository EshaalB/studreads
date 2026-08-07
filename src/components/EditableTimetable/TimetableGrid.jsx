import { useMemo } from 'react';
import { DAYS } from '../../utils/constants';
import { parseTime, formatTime } from '../../utils/timeUtils';
import { sanitizeString } from '../../utils/validation';

const TimetableGrid = ({
  sortedClasses, getOrAssignColor, getContrastYIQ,
  displayOptions
}) => {
  // Compute time boundaries: earliest start, latest end across all classes
  const { timeSlots, activeDays } = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    const daySet = new Set();

    sortedClasses.forEach(cls => {
      const start = parseTime(cls.startTime);
      const end = parseTime(cls.endTime);
      if (start !== null && start < minTime) minTime = start;
      if (end !== null && end > maxTime) maxTime = end;
      if (cls.day) daySet.add(cls.day);
    });

    // Round down to nearest hour for start, round up for end
    minTime = Math.floor(minTime / 60) * 60;
    maxTime = Math.ceil(maxTime / 60) * 60;

    // Generate 30-minute time slots
    const slots = [];
    for (let t = minTime; t < maxTime; t += 30) {
      slots.push(t);
    }

    // Filter DAYS to only include days that have classes
    const active = DAYS.filter(d => daySet.has(d));

    return { timeSlots: slots, activeDays: active };
  }, [sortedClasses]);

  // Map classes into a grid structure: { [day]: { [slotStart]: [classes] } }
  const gridMap = useMemo(() => {
    const map = {};
    activeDays.forEach(day => { map[day] = {}; });

    sortedClasses.forEach(cls => {
      if (!map[cls.day]) return;
      const start = parseTime(cls.startTime);
      const end = parseTime(cls.endTime);
      if (start === null || end === null) return;

      // Find which slots this class spans
      timeSlots.forEach(slot => {
        if (start <= slot && slot < end) {
          if (!map[cls.day][slot]) map[cls.day][slot] = [];
          map[cls.day][slot].push(cls);
        }
      });
    });

    return map;
  }, [sortedClasses, activeDays, timeSlots]);

  // For rendering: compute which cells are "start" cells vs continuation cells
  const renderInfo = useMemo(() => {
    const info = {};
    activeDays.forEach(day => {
      info[day] = {};
      const rendered = new Set(); // track class IDs already placed

      timeSlots.forEach(slot => {
        const classes = gridMap[day]?.[slot] || [];
        const newClasses = classes.filter(cls => !rendered.has(cls.id || `${cls.name}-${cls.startTime}`));

        if (newClasses.length > 0) {
          newClasses.forEach(cls => {
            const clsKey = cls.id || `${cls.name}-${cls.startTime}`;
            rendered.add(clsKey);

            const start = parseTime(cls.startTime);
            const end = parseTime(cls.endTime);
            const span = Math.max(1, Math.round((end - start) / 30));

            if (!info[day][slot]) info[day][slot] = [];
            info[day][slot].push({ cls, rowSpan: span });
          });
        } else if (classes.length === 0) {
          // Empty cell
          info[day][slot] = null;
        }
        // If classes.length > 0 but all are already rendered, this is a continuation cell; skip.
      });
    });
    return info;
  }, [activeDays, timeSlots, gridMap]);

  if (timeSlots.length === 0) return null;

  return (
    <div className="timetable-grid-wrapper">
      <table className="timetable-grid">
        <thead>
          <tr>
            <th className="grid-time-header">Time</th>
            {activeDays.map(day => (
              <th key={day} className="grid-day-header">{day.substring(0, 3)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, slotIdx) => (
            <tr key={slot} className={slotIdx % 2 === 0 ? 'grid-row-even' : 'grid-row-odd'}>
              <td className="grid-time-cell">{formatTime(slot)}</td>
              {activeDays.map(day => {
                const cellInfo = renderInfo[day]?.[slot];

                // If cellInfo is undefined, this slot is a continuation; skip rendering.
                if (cellInfo === undefined) return null;

                // If null, empty cell
                if (cellInfo === null) {
                  return <td key={day} className="grid-empty-cell" />;
                }

                // Render class blocks
                return cellInfo.map(({ cls, rowSpan }, i) => {
                  const bgColor = getOrAssignColor(cls.name);
                  const textColor = getContrastYIQ(bgColor);
                  const sanitizedName = sanitizeString(cls.name);

                  return (
                    <td
                      key={`${day}-${cls.name}-${i}`}
                      rowSpan={rowSpan}
                      className="grid-class-cell"
                      style={{ background: bgColor, color: textColor }}
                    >
                      <div className="grid-class-name">{sanitizedName}</div>
                      <div className="grid-class-time">
                        {sanitizeString(cls.startTime)} to {sanitizeString(cls.endTime)}
                      </div>
                      {displayOptions.showTeacher && cls.teacher && (
                        <div className="grid-class-teacher">{sanitizeString(cls.teacher)}</div>
                      )}
                      {cls.room && (
                        <div className="grid-class-room">{sanitizeString(cls.room)}</div>
                      )}
                    </td>
                  );
                });
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid;
