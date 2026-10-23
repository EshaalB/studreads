import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import SearchableSelect from '../SearchableSelect';

const CourseSelection = ({
  sectionOptions,
  activeSection,
  handleSectionChange,
  coursesInActiveSection,
  selectedCourseIds,
  toggleCourse
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { setSelectedCourseIds } = useTimetable();

  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) return coursesInActiveSection;
    const lower = searchTerm.toLowerCase();
    return coursesInActiveSection.filter(c => c.name.toLowerCase().includes(lower));
  }, [coursesInActiveSection, searchTerm]);

  const selectedHere = coursesInActiveSection.filter((course) => selectedCourseIds.includes(course.id)).length;
  const allSelected = coursesInActiveSection.length > 0 && selectedHere === coursesInActiveSection.length;

  return (
    <>
      <section className="side-section">
        <h2 className="side-title" id="section-title">Section</h2>
        <SearchableSelect
          options={sectionOptions}
          value={activeSection}
          onChange={handleSectionChange}
          placeholder="Choose your section"
          ariaLabel="Choose your section"
        />
      </section>

      {activeSection && (
        <section className="side-section" aria-labelledby="courses-title">
          <div className="side-title-row">
            <h2 className="side-title" id="courses-title">Courses <span className="count">{selectedHere}/{coursesInActiveSection.length}</span></h2>
            <button
              type="button"
              className="link-btn"
              onClick={() => setSelectedCourseIds(allSelected ? [] : coursesInActiveSection.map((course) => course.id))}
            >
              {allSelected ? 'Clear' : 'Select all'}
            </button>
          </div>
          {coursesInActiveSection.length > 8 && (
            <label className="search-field">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder="Filter courses"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Filter courses"
              />
            </label>
          )}
          <div className="check-list">
            {filteredCourses.map(c => {
              const selected = selectedCourseIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`check-item ${selected ? 'is-checked' : ''}`}
                  onClick={() => toggleCourse(c.id)}
                  aria-pressed={selected}
                >
                  <span className="checkbox" aria-hidden="true">{selected && <Check size={12} strokeWidth={3} />}</span>
                  <span className="check-label">{c.name}</span>
                </button>
              );
            })}
            {filteredCourses.length === 0 && <p className="muted small">No courses match “{searchTerm}”.</p>}
          </div>
        </section>
      )}
    </>
  );
};

export default CourseSelection;
