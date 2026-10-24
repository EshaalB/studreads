import { useMemo } from 'react';
import { readableText } from '../../utils/themes';
import { displayTime } from '../../utils/timeUtils';

const ROW_HEIGHTS = { compact: 48, regular: 64, large: 84 };
const DEFAULT_HOURS = [8, 15];

// Items that overlap in one column sit side by side.
const layoutColumn = (items) => {
  const blocks = items
    .filter((item) => item.start !== null && item.end !== null && item.end > item.start)
    .map((item) => ({ item }))
    .sort((a, b) => a.item.start - b.item.start || b.item.end - a.item.end);

  const clusters = [];
  blocks.forEach((block) => {
    const cluster = clusters[clusters.length - 1];
    if (cluster && block.item.start < cluster.end) {
      cluster.blocks.push(block);
      cluster.end = Math.max(cluster.end, block.item.end);
    } else {
      clusters.push({ blocks: [block], end: block.item.end });
    }
  });

  clusters.forEach((cluster) => {
    const laneEnds = [];
    cluster.blocks.forEach((block) => {
      let lane = laneEnds.findIndex((end) => end <= block.item.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(block.item.end); } else laneEnds[lane] = block.item.end;
      block.lane = lane;
    });
    cluster.blocks.forEach((block) => { block.lanes = laneEnds.length; });
  });
  return blocks;
};

const hourLabel = (hour, format) => (format === '24h' ? `${String(hour).padStart(2, '0')}:00` : displayTime(`${hour}:00`).replace(':00', ''));

/**
 * A time-of-day grid with one column per day (weekdays for a timetable, dates for exams).
 * columns: [{ key, label, short }]
 * items:   [{ id, column, start, end, title, time, details, color, clash }] with start/end
 *          in minutes; items without a start are shown in an "untimed" row under the header.
 */
const TimeGrid = ({ columns, items, timeFormat = '12h', onSelect, onAddAt, minHours = DEFAULT_HOURS, rowHeight = 'regular', blockStyle = 'filled' }) => {
  const HOUR_HEIGHT = ROW_HEIGHTS[rowHeight] || ROW_HEIGHTS.regular;
  const { startHour, endHour, timed, untimed } = useMemo(() => {
    const placed = items.filter((item) => item.start !== null && item.start !== undefined);
    const min = Math.min(...placed.map((item) => item.start));
    const max = Math.max(...placed.map((item) => item.end ?? item.start + 60));
    return {
      startHour: Number.isFinite(min) ? Math.min(Math.floor(min / 60), minHours[0]) : minHours[0],
      endHour: Number.isFinite(max) ? Math.max(Math.ceil(max / 60), minHours[1]) : minHours[1] + 2,
      timed: Object.fromEntries(columns.map((column) => [column.key, layoutColumn(placed.filter((item) => item.column === column.key))])),
      untimed: items.filter((item) => item.start === null || item.start === undefined)
    };
  }, [columns, items, minHours]);

  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const top = (minutes) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

  const addAt = (columnKey, event) => {
    if (!onAddAt || event.target !== event.currentTarget) return;
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
    onAddAt(columnKey, Math.min(startHour * 60 + Math.floor((offset / HOUR_HEIGHT) * 2) * 30, 23 * 60));
  };

  const block = (item, style, className = '') => (
    <button
      type="button"
      key={item.id}
      className={`grid-block ${item.kind === 'exam' ? 'is-exam' : ''} ${item.clash ? 'has-clash' : ''} ${className}`}
      style={{ ...style, '--block': item.color, '--block-text': readableText(item.color) }}
      onClick={() => onSelect?.(item.id)}
      tabIndex={onSelect ? 0 : -1}
      aria-label={[item.badge, item.title, item.time, ...item.details].filter(Boolean).join(', ')}
    >
      {item.badge && <span className="grid-block-badge">{item.badge}</span>}
      {item.time && <span className="grid-block-time">{item.time}</span>}
      <strong>{item.title}</strong>
      {item.details.length > 0 && <span className="grid-block-details">{item.details.join(' · ')}</span>}
    </button>
  );

  return (
    <div className="grid-scroll">
      <div className={`time-grid ${blockStyle === 'tinted' ? 'is-tinted' : ''}`} style={{ '--columns': columns.length, '--hour': `${HOUR_HEIGHT}px` }}>
        <div className="grid-head" aria-hidden="true">
          <span />
          {columns.map((column) => (
            <span key={column.key} className="grid-day"><span className="label-long">{column.label}</span><span className="label-short">{column.short}</span></span>
          ))}
        </div>

        {untimed.length > 0 && (
          <div className="grid-untimed">
            <span className="grid-untimed-label">No time</span>
            {columns.map((column) => (
              <div key={column.key} className="grid-untimed-cell">
                {untimed.filter((item) => item.column === column.key).map((item) => block(item, {}, 'is-untimed'))}
              </div>
            ))}
          </div>
        )}

        <div className="grid-body" style={{ height: hours.length * HOUR_HEIGHT }}>
          <div className="grid-times" aria-hidden="true">
            {hours.map((hour) => <span key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }}>{hourLabel(hour, timeFormat)}</span>)}
          </div>
          {columns.map((column) => (
            <div
              key={column.key}
              className={`grid-col ${onAddAt ? 'is-addable' : ''}`}
              role="list"
              aria-label={column.label}
              onClick={(event) => addAt(column.key, event)}
              title={onAddAt ? 'Click an empty slot to add' : undefined}
            >
              {timed[column.key].map(({ item, lane, lanes }) => {
                const height = Math.max(top(item.end) - top(item.start), 24);
                return block(item, {
                  top: top(item.start),
                  height,
                  left: `calc(${(lane / lanes) * 100}% + 3px)`,
                  width: `calc(${100 / lanes}% - 6px)`
                  // Only whole lines are shown: short blocks drop the details, then the time.
                }, height < 46 ? 'is-short' : height < 80 ? 'is-compact' : height >= 110 ? 'is-tall' : '');
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimeGrid;
