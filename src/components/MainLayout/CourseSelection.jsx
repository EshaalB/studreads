import { Check, HelpCircle, Search, Trash2 } from 'lucide-react';
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
  const { clearAllSelections } = useTimetable();

  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) return coursesInActiveSection;
    const lower = searchTerm.toLowerCase();
    return coursesInActiveSection.filter(c => c.name.toLowerCase().includes(lower));
  }, [coursesInActiveSection, searchTerm]);

  return (
    <div className="section-container">
      <div className="form-group">
        <div className="form-heading-row">
          <label className="label-with-tooltip label-reset">
            <span className="label-text">Primary section</span>
            <div className="tooltip-wrapper">
              <HelpCircle size={14} />
              <span className="tooltip">Select your main section to automatically load courses</span>
            </div>
          </label>
          {selectedCourseIds.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-danger-outline"
              onClick={clearAllSelections}
            >
              <Trash2 size={13} /> Clear selections
            </button>
          )}
        </div>
        <SearchableSelect
          options={sectionOptions}
          value={activeSection}
          onChange={handleSectionChange}
          placeholder="Select your main section (e.g. BSCS-3A)"
          ariaLabel="Select primary section"
        />
      </div>

      {activeSection && (
        <div className="form-group form-group-spaced">
          <div className="form-heading-row form-heading-wrap">
            <label className="label-text label-reset">
              Available courses
              {selectedCourseIds.length > 0 && <span className="selection-count">{selectedCourseIds.length} selected</span>}
            </label>
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Find a course…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field search-input"
              />
            </div>
          </div>
          <div className="tick-grid">
            {filteredCourses.map(c => (
              <button
                key={c.id}
                type="button"
                className={`tick-item ${selectedCourseIds.includes(c.id) ? 'selected' : ''}`}
                onClick={() => toggleCourse(c.id)}
                aria-pressed={selectedCourseIds.includes(c.id)}
              >
                <div className="tick-indicator">
                  {selectedCourseIds.includes(c.id) && <Check size={13} />}
                </div>
                <span>{c.name}</span>
              </button>
            ))}
            {filteredCourses.length === 0 && (
              <p className="empty-state">No courses match that search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseSelection;
