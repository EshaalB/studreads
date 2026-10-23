import { DAYS } from '../../utils/constants';
import { readableText } from '../../utils/themes';
import { displayTimeRange } from '../../utils/timeUtils';

// Day-by-day list. Each class row is filled with its course colour; tapping it edits it.
const ClassList = ({ classes, getOrAssignColor, displayOptions, conflicts, onSelect }) => {
  const days = DAYS.filter((day) => classes.some((cls) => cls.day === day));

  return (
    <div className="day-list">
      {days.map((day) => (
        <section className="day-group" key={day} aria-label={day}>
          <h3>{day}</h3>
          <ul>
            {classes.filter((cls) => cls.day === day).map((cls) => {
              const background = getOrAssignColor(cls.name);
              const details = [
                displayOptions.showRoom && cls.room,
                displayOptions.showTeacher && cls.teacher,
                displayOptions.showCredits && cls.credits && `${cls.credits} cr`,
                displayOptions.showSection && cls.section
              ].filter(Boolean);
              return (
                <li key={cls.id}>
                  <button type="button" className="class-row" style={{ background, color: readableText(background) }} onClick={() => onSelect(cls)}>
                    <span className="class-row-time">{displayTimeRange(cls.startTime, cls.endTime, displayOptions.timeFormat)}</span>
                    <span className="class-row-text">
                      <strong>{cls.name}</strong>
                      {details.length > 0 && <span>{details.join(' · ')}</span>}
                    </span>
                    {conflicts.has(cls.id) && <span className="badge">Clash</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ClassList;
