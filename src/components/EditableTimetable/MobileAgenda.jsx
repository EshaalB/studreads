import { AlertTriangle, Clock3, MapPin, UserRound } from 'lucide-react';
import { DAY_ORDER } from '../../utils/constants';
import { useTimetable } from '../../context/useTimetable';

const MobileAgenda = ({ classes, getOrAssignColor }) => {
  const { conflicts, displayOptions } = useTimetable();
  const days = [...new Set(classes.map((item) => item.day))]
    .sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99));

  return (
    <div className="mobile-agenda" aria-label="Mobile timetable agenda">
      {days.map((day) => (
        <section className="agenda-day" key={day}>
          <h3>{day}</h3>
          <div className="agenda-day-list">
            {classes.filter((item) => item.day === day).map((item, index) => (
              <article className={`agenda-item ${conflicts.has(item.id) ? 'has-conflict' : ''}`} key={`${item.id}-${index}`}>
                <span className="agenda-colour" style={{ backgroundColor: getOrAssignColor(item.name) }} aria-hidden="true" />
                <div className="agenda-copy">
                  <div className="agenda-title-row">
                    <h4>{item.name}</h4>
                    {conflicts.has(item.id) && <span className="conflict-label"><AlertTriangle size={12} /> Clash</span>}
                  </div>
                  <p><Clock3 size={14} /> {item.startTime} to {item.endTime}</p>
                  {item.room && <p><MapPin size={14} /> {item.room}</p>}
                  {displayOptions.showTeacher && item.teacher && <p><UserRound size={14} /> {item.teacher}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default MobileAgenda;
