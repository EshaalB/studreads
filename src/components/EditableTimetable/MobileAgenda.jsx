import { DAY_ORDER } from '../../utils/constants';
import { displayTimeRange } from '../../utils/timeUtils';

const MobileAgenda = ({ classes, getOrAssignColor, displayOptions, conflicts }) => {
  const days = [...new Set(classes.map((item) => item.day))]
    .sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99));

  return (
    <div className="agenda">
      {days.map((day) => (
        <section className="agenda-day" key={day} aria-label={day}>
          <h3>{day}</h3>
          <ul>
            {classes.filter((item) => item.day === day).map((item, index) => (
              <li className="agenda-item" key={`${item.id}-${index}`}>
                <span className="agenda-time">{displayTimeRange(item.startTime, item.endTime, displayOptions.timeFormat)}</span>
                <span className="agenda-bar" style={{ background: getOrAssignColor(item.name) }} aria-hidden="true" />
                <span className="agenda-text">
                  <strong>{item.name}</strong>
                  <span>{[
                    displayOptions.showRoom && item.room,
                    displayOptions.showTeacher && item.teacher,
                    displayOptions.showSection && item.section
                  ].filter(Boolean).join(' · ')}</span>
                </span>
                {conflicts.has(item.id) && <span className="badge badge-warn">Clash</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default MobileAgenda;
