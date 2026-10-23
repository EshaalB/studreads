import { useMemo, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import Dialog from '../ui/Dialog';
import SearchableSelect from '../ui/SearchableSelect';

const CheckRow = ({ checked, onChange, label, detail }) => (
  <label className={`check-row ${checked ? 'is-checked' : ''}`}>
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="check-row-text">
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </span>
  </label>
);

// Picks courses from an imported timetable file: a section's courses, plus any course
// from another section found by search. Ticking adds every meeting of that course.
const CoursePicker = ({ isOpen, onClose }) => {
  const { rootSections, activeSection, setActiveSection, getCoursesForSection, allCourses, isCourseAdded, toggleCourse, classes, source } = useTimetable();
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
  const courseCount = new Set(classes.map((item) => item.name)).size;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Choose your courses"
      width={520}
      footer={<><span className="muted">{courseCount} {courseCount === 1 ? 'course' : 'courses'} on your timetable</span><button type="button" className="btn btn-primary" onClick={onClose}>Done</button></>}
    >
      <div className="form">
        {source?.name && <p className="muted small">From {source.name}</p>}
        <div className="field">
          <span className="field-label">Your section</span>
          <SearchableSelect
            options={rootSections.map((section) => ({ value: section, label: section }))}
            value={activeSection}
            onChange={setActiveSection}
            placeholder="Choose a section"
            ariaLabel="Your section"
          />
        </div>

        {activeSection && (
          <div className="field">
            <div className="field-head">
              <span className="field-label">Courses in {activeSection}</span>
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

        {rootSections.length > 1 && (
          <div className="field">
            <span className="field-label">Taking a course with another section?</span>
            <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course or section" />
            {searchResults.length > 0 && (
              <div className="check-list">
                {searchResults.map((course) => (
                  <CheckRow
                    key={`${course.section}-${course.name}`}
                    label={course.name}
                    detail={course.section}
                    checked={isCourseAdded(course.section, course.name)}
                    onChange={() => toggleCourse(course.section, course.name)}
                  />
                ))}
              </div>
            )}
            {query.trim() && searchResults.length === 0 && <p className="muted small">No courses match “{query}”.</p>}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default CoursePicker;
