import { ChevronDown, Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import { useTimetable } from '../../context/useTimetable';
import SearchableSelect from '../SearchableSelect';

const AdditionalCourseRow = ({
  sel, index, extraSelections, rootSections, allUniqueCourses,
  primarySelectedNames, getCoursesForSection, updateExtra, removeExtra
}) => {
  // Sections that teach the chosen course
  const sectionsForCourse = useMemo(() => {
    if (!sel.courseName) return [];
    return rootSections
      .filter(section => getCoursesForSection(section).some(item => item.name === sel.courseName))
      .map(section => ({ value: section, label: section }));
  }, [sel.courseName, rootSections, getCoursesForSection]);

  // Hide courses already picked in the main section or in another row
  const filteredCourseOptions = useMemo(() => allUniqueCourses.filter(opt => {
    if (opt.value === sel.courseName) return true;
    if (primarySelectedNames.has(opt.value)) return false;
    return !extraSelections.some((s, idx) => idx !== index && s.courseName === opt.value);
  }), [allUniqueCourses, sel.courseName, primarySelectedNames, extraSelections, index]);

  return (
    <div className="extra-row">
      <div className="extra-fields">
        <SearchableSelect
          options={filteredCourseOptions}
          value={sel.courseName}
          onChange={(value) => updateExtra(sel.id, { courseName: value, section: '', courseId: '' })}
          placeholder="Course"
          ariaLabel="Course from another section"
        />
        <SearchableSelect
          options={sectionsForCourse}
          value={sel.section}
          onChange={(value) => {
            const match = getCoursesForSection(value).find(c => c.name === sel.courseName);
            updateExtra(sel.id, { section: value, courseId: match ? match.id : '' });
          }}
          placeholder={sel.courseName ? 'Section' : 'Choose a course first'}
          disabled={!sel.courseName}
          ariaLabel="Section for this course"
        />
      </div>
      <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeExtra(sel.id)} aria-label="Remove this course">
        <X size={15} />
      </button>
    </div>
  );
};

const AdditionalCourses = ({
  isExtraOpen,
  setIsExtraOpen,
  extraSelections,
  getCoursesForSection,
  updateExtra,
  removeExtra,
  addExtra
}) => {
  const { rootSections, selectedCourseIds, activeSection } = useTimetable();

  const allUniqueCourses = useMemo(() => {
    const courses = [];
    const seen = new Set();
    rootSections.forEach(section => {
      getCoursesForSection(section).forEach(item => {
        if (item.name && !seen.has(item.name)) {
          courses.push({ value: item.name, label: item.name });
          seen.add(item.name);
        }
      });
    });
    return courses.sort((a, b) => a.label.localeCompare(b.label));
  }, [rootSections, getCoursesForSection]);

  const primarySelectedNames = useMemo(() => {
    if (!activeSection) return new Set();
    return new Set(getCoursesForSection(activeSection).filter(c => selectedCourseIds.includes(c.id)).map(c => c.name));
  }, [activeSection, selectedCourseIds, getCoursesForSection]);

  const count = extraSelections.filter((sel) => sel.courseId).length;

  return (
    <section className="side-section">
      <button
        type="button"
        className="disclosure"
        onClick={() => setIsExtraOpen(!isExtraOpen)}
        aria-expanded={isExtraOpen}
        aria-controls="additional-courses-panel"
      >
        <span className="side-title">Courses from other sections{count > 0 && <span className="count">{count}</span>}</span>
        <ChevronDown size={16} className="disclosure-icon" aria-hidden="true" />
      </button>

      {isExtraOpen && (
        <div className="extra-list" id="additional-courses-panel">
          {extraSelections.map((sel, index) => (
            <AdditionalCourseRow
              key={sel.id}
              sel={sel}
              index={index}
              extraSelections={extraSelections}
              rootSections={rootSections}
              allUniqueCourses={allUniqueCourses}
              primarySelectedNames={primarySelectedNames}
              getCoursesForSection={getCoursesForSection}
              updateExtra={updateExtra}
              removeExtra={removeExtra}
            />
          ))}
          <button type="button" className="btn btn-sm" onClick={addExtra}>
            <Plus size={14} /> Add a course
          </button>
        </div>
      )}
    </section>
  );
};

export default AdditionalCourses;
