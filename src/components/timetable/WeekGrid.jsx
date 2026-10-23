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

const hourLabel = (hour, format) => (format === '24h' ? `${String(hour).padStart(2, '0')}:00` : displayTime(`${hour}:00`).replace(':00', ''));

const WeekGrid = ({ classes, getOrAssignColor, displayOptions, conflicts, onSelect, onAddAt }) => {
  const { days, startHour, endHour, blocksByDay } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    classes.forEach((cls) => {
      const start = parseTime(cls.startTime);
      const end = parseTime(cls.endTime);
      if (start !== null) min = Math.min(min, start);
      if (end !== null) max = Math.max(max, end);
    });
    // Monday to Friday always show; weekends only when they have classes.
    const visibleDays = DAYS.filter((day, index) => index < 5 || classes.some((cls) => cls.day === day));
    return {
      days: visibleDays,
      startHour: Number.isFinite(min) ? Math.min(Math.floor(min / 60), 8) : 8,
      endHour: Number.isFinite(max) ? Math.max(Math.ceil(max / 60), 15) : 17,
      blocksByDay: Object.fromEntries(visibleDays.map((day) => [day, layoutDay(classes.filter((cls) => cls.day === day))]))
    };
  }, [classes]);

  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const top = (minutes) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

  const addAt = (day, event) => {
    if (!onAddAt || event.target !== event.currentTarget) return;
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minutes = startHour * 60 + Math.floor((offset / HOUR_HEIGHT) * 2) * 30;
    onAddAt(day, Math.min(minutes, 23 * 60));
  };

  return (
    <div className="week-scroll">
      <div className="week" style={{ '--days': days.length, '--hour': `${HOUR_HEIGHT}px` }}>
        <div className="week-head" aria-hidden="true">
          <span />
          {days.map((day) => (
            <span key={day} className="week-day"><span className="day-long">{day}</span><span className="day-short">{day.slice(0, 3)}</span></span>
          ))}
        </div>
        <div className="week-body" style={{ height: hours.length * HOUR_HEIGHT }}>
          <div className="week-times" aria-hidden="true">
            {hours.map((hour) => <span key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }}>{hourLabel(hour, displayOptions.timeFormat)}</span>)}
          </div>
          {days.map((day) => (
            <div className={`week-col ${onAddAt ? 'is-addable' : ''}`} key={day} role="list" aria-label={day} onClick={(event) => addAt(day, event)} title={onAddAt ? 'Click an empty slot to add a class' : undefined}>
              {blocksByDay[day].map(({ cls, start, end, lane, lanes }) => {
                const background = getOrAssignColor(cls.name);
                const height = Math.max(top(end) - top(start), 24);
                const time = displayTimeRange(cls.startTime, cls.endTime, displayOptions.timeFormat);
                return (
                  <button
                    type="button"
                    role="listitem"
                    key={cls.id}
                    className={`week-block ${conflicts?.has(cls.id) ? 'has-clash' : ''} ${height < 52 ? 'is-short' : ''}`}
                    style={{
                      top: top(start),
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                      background,
                      color: readableText(background)
                    }}
                    onClick={() => onSelect?.(cls)}
                    tabIndex={onSelect ? 0 : -1}
                    aria-label={`${cls.name}, ${day}, ${time}${cls.room ? `, ${cls.room}` : ''}`}
                  >
                    <span className="week-block-time">{time}</span>
                    <strong>{cls.name}</strong>
                    {displayOptions.showRoom && cls.room && <span>{cls.room}</span>}
                    {displayOptions.showTeacher && cls.teacher && <span>{cls.teacher}</span>}
                    {displayOptions.showSection && cls.section && <span>{cls.section}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekGrid;
