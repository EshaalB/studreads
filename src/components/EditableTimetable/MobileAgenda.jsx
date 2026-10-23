import { DAY_ORDER } from '../../utils/constants';
import { readableText } from '../../utils/themes';
import { displayTimeRange } from '../../utils/timeUtils';
import ColorPicker from '../ui/ColorPicker';

const MobileAgenda = ({ classes, getOrAssignColor, displayOptions, conflicts, palette, onColorChange }) => {
  const days = [...new Set(classes.map((item) => item.day))]
    .sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99));

  return (
    <div className="agenda">
      {days.map((day) => (
        <section className="agenda-day" key={day} aria-label={day}>
          <h3>{day}</h3>
          <ul>
            {classes.filter((item) => item.day === day).map((item, index) => (
              <li
                className="agenda-item"
                key={`${item.id}-${index}`}
                style={{ background: getOrAssignColor(item.name), color: readableText(getOrAssignColor(item.name)) }}
              >
                <span className="agenda-time">{displayTimeRange(item.startTime, item.endTime, displayOptions.timeFormat)}</span>
                <span className="agenda-text">
                  <strong>{item.name}</strong>
                  <span>{[
                    displayOptions.showRoom && item.room,
                    displayOptions.showTeacher && item.teacher,
                    displayOptions.showSection && item.section
                  ].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="agenda-end">
                  {conflicts.has(item.id) && <span className="badge badge-warn">Clash</span>}
                  <ColorPicker value={getOrAssignColor(item.name)} palette={palette} label={item.name} onChange={(color) => onColorChange(item.name, color)} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default MobileAgenda;
