import { useMemo, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';

const CheckRow = ({ checked, onChange, label, detail }) => (
  <label className={`check-row ${checked ? 'is-checked' : ''}`}>
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="check-row-text">
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </span>
  </label>
);

// Pick courses from an uploaded timetable: choose a section, tick courses. Courses taken
// with another section stay tucked away until asked for.
const CoursePicker = ({ isOpen, onClose }) => {
  const { rootSections, activeSection, setActiveSection, getCoursesForSection, allCourses, isCourseAdded, toggleCourse } = useTimetable();
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');

  const sectionCourses = useMemo(() => {
    const seen = new Set();
    return getCoursesForSection(activeSection)
      .filter((course) => !seen.has(course.name) && seen.add(course.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSection, getCoursesForSection]);

  const searchResults = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return allCourses
      .filter((course) => course.section !== activeSection && terms.every((term) => `${course.name} ${course.section}`.toLowerCase().includes(term)))
      .slice(0, 40);
  }, [query, allCourses, activeSection]);

  const allTicked = sectionCourses.length > 0 && sectionCourses.every((course) => isCourseAdded(activeSection, course.name));
  const toggleAll = () => sectionCourses
    .filter((course) => isCourseAdded(activeSection, course.name) === allTicked)
    .forEach((course) => toggleCourse(activeSection, course.name));

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Choose your courses" width={520} footer={<PushButton onClick={onClose}>Done</PushButton>}>
      <div className="form">
        <select className="input" value={activeSection} onChange={(event) => setActiveSection(event.target.value)} aria-label="Your section">
          <option value="" disabled>Choose your section</option>
          {rootSections.map((section) => <option key={section}>{section}</option>)}
        </select>

        {activeSection && (
          <div className="field">
            <div className="field-head">
              <span className="field-label">Courses</span>
              <button type="button" className="link-btn" onClick={toggleAll}>{allTicked ? 'Clear all' : 'Select all'}</button>
            </div>
            <div className="check-list">
              {sectionCourses.map((course) => (
                <CheckRow
                  key={course.name}
                  label={course.name}
                  checked={isCourseAdded(activeSection, course.name)}
                  onChange={() => toggleCourse(activeSection, course.name)}
                />
              ))}
            </div>
          </div>
        )}

        {rootSections.length > 1 && (isSearching ? (
          <div className="field">
            <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course or section name" aria-label="Find a course in another section" autoFocus />
            {searchResults.length > 0 && (
              <div className="check-list">
                {searchResults.map((course) => (
                  <CheckRow
                    key={`${course.section}-${course.name}`}
                    label={course.name}
                    detail={course.section}
                    checked={isCourseAdded(course.section, course.name)}
                    onChange={() => toggleCourse(course.section, course.name, { preview: true })}
                  />
                ))}
              </div>
            )}
            {query.trim() && searchResults.length === 0 && <p className="muted small">No courses match “{query}”.</p>}
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setIsSearching(true)}>Taking a course with another section?</button>
        ))}
      </div>
    </Dialog>
  );
};

export default CoursePicker;
