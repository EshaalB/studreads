import { useMemo } from 'react';
import { DAYS } from '../../utils/constants';
import { readableText } from '../../utils/themes';
import { displayTime, displayTimeRange, parseTime } from '../../utils/timeUtils';

const HOUR_HEIGHT = 64;

// Classes that overlap share the column side by side.
const layoutDay = (classes) => {
  const blocks = classes
    .map((cls) => ({ cls, start: parseTime(cls.startTime), end: parseTime(cls.endTime) }))
    .filter((block) => block.start !== null && block.end !== null && block.end > block.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const clusters = [];
  blocks.forEach((block) => {
    const cluster = clusters[clusters.length - 1];
    if (cluster && block.start < cluster.end) {
      cluster.items.push(block);
      cluster.end = Math.max(cluster.end, block.end);
    } else {
      clusters.push({ items: [block], end: block.end });
    }
  });

  clusters.forEach((cluster) => {
    const laneEnds = [];
    cluster.items.forEach((block) => {
      let lane = laneEnds.findIndex((end) => end <= block.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(block.end); } else laneEnds[lane] = block.end;
      block.lane = lane;
    });
    cluster.items.forEach((block) => { block.lanes = laneEnds.length; });
  });
  return blocks;
};

const TimetableGrid = ({ classes, getOrAssignColor, displayOptions, conflicts }) => {
  const { days, startHour, endHour, blocksByDay } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    classes.forEach((cls) => {
      const start = parseTime(cls.startTime);
      const end = parseTime(cls.endTime);
      if (start !== null) min = Math.min(min, start);
      if (end !== null) max = Math.max(max, end);
    });
    const usedDays = DAYS.filter((day) => classes.some((cls) => cls.day === day));
    // Always show the working week so a sparse timetable still reads as a week.
    const visibleDays = DAYS.filter((day, index) => index < 5 || usedDays.includes(day));
    return {
      days: visibleDays,
      startHour: Number.isFinite(min) ? Math.floor(min / 60) : 8,
      endHour: Number.isFinite(max) ? Math.ceil(max / 60) : 17,
      blocksByDay: Object.fromEntries(visibleDays.map((day) => [day, layoutDay(classes.filter((cls) => cls.day === day))]))
    };
  }, [classes]);

  const hours = Array.from({ length: Math.max(endHour - startHour, 1) }, (_, index) => startHour + index);
  const bodyHeight = hours.length * HOUR_HEIGHT;
  const top = (minutes) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="week-scroll">
      <div className="week" style={{ '--days': days.length, '--hour': `${HOUR_HEIGHT}px` }}>
        <div className="week-head" aria-hidden="true">
          <span />
          {days.map((day) => <span key={day} className="week-day">{day.slice(0, 3)}</span>)}
        </div>
        <div className="week-body" style={{ height: bodyHeight }}>
          <div className="week-times" aria-hidden="true">
            {hours.map((hour) => (
              <span key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }}>{displayOptions.timeFormat === '24h' ? `${String(hour).padStart(2, '0')}:00` : displayTime(`${hour}:00`).replace(':00', '')}</span>
            ))}
          </div>
          {days.map((day) => (
            <div className="week-col" key={day} role="list" aria-label={day}>
              {blocksByDay[day].map(({ cls, start, end, lane, lanes }) => {
                const background = getOrAssignColor(cls.name);
                const height = Math.max(top(end) - top(start), 22);
                return (
                  <div
                    role="listitem"
                    key={`${cls.id}-${cls.startTime}`}
                    className={`week-block ${conflicts?.has(cls.id) ? 'has-clash' : ''} ${height < 48 ? 'is-short' : ''}`}
                    style={{
                      top: top(start),
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                      background,
                      color: readableText(background)
                    }}
                    title={`${cls.name}, ${displayTimeRange(cls.startTime, cls.endTime, displayOptions.timeFormat)}${cls.room ? `, ${cls.room}` : ''}`}
                  >
                    <strong>{cls.name}</strong>
                    <span>{displayTimeRange(cls.startTime, cls.endTime, displayOptions.timeFormat)}</span>
                    {displayOptions.showRoom && cls.room && <span>{cls.room}</span>}
                    {displayOptions.showTeacher && cls.teacher && <span>{cls.teacher}</span>}
                    {displayOptions.showSection && cls.section && <span>{cls.section}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimetableGrid;
