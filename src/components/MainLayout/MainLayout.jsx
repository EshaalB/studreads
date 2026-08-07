import { Calendar, Mail, Share2, Shield, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { showError, showSuccess } from '../../utils/errorHandler';
import { decodeState, encodeState } from '../../utils/sharingUtils';
import { parseWorkbook } from '../../utils/spreadsheetParser';
import { validateFile } from '../../utils/validation';
import ContactModal from '../ContactModal';
import EditableTimetable from '../EditableTimetable/EditableTimetable';
import Footer from '../Footer';
import PrivacyModal from '../PrivacyModal';
import ReviewsModal from '../ReviewsModal';
import AdditionalCourses from './AdditionalCourses';
import CourseSelection from './CourseSelection';
import DisplayOptions from './DisplayOptions';
import FileUpload from './FileUpload';

const MainLayout = () => {
  const {
    rawData, processData, rootSections, activeSection, setActiveSection,
    selectedCourseIds, setSelectedCourseIds, extraSelections, setExtraSelections,
    displayOptions, setDisplayOptions, getCoursesForSection, finalActiveClasses,
    loadSharedTimetable
  } = useTimetable();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExtraOpen, setIsExtraOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const [fileSummary, setFileSummary] = useState(null);
  const fileInputRef = useRef();

  // URL state restoration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedState = params.get('s');
    if (sharedState) {
      const decoded = decodeState(sharedState);
      if (decoded) {
        if (Array.isArray(decoded.classes) && decoded.classes.length > 0) {
          loadSharedTimetable(decoded.classes);
        } else {
          if (decoded.activeSection) setActiveSection(decoded.activeSection);
          if (decoded.selectedCourseIds) setSelectedCourseIds(decoded.selectedCourseIds);
          if (decoded.extraSelections) setExtraSelections(decoded.extraSelections);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        showSuccess(`Restored ${decoded.userName ? `${decoded.userName}'s` : 'the shared'} timetable.`);
      }
    }
  }, [loadSharedTimetable, setActiveSection, setSelectedCourseIds, setExtraSelections]);

  const handleShare = useCallback(() => {
    const state = {
      activeSection,
      selectedCourseIds,
      extraSelections,
      classes: finalActiveClasses,
      userName: userName.trim()
    };
    const encoded = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;

    navigator.clipboard.writeText(url).then(() => {
      showSuccess('Share link copied to clipboard.');
    }).catch(() => {
      showError('Failed to copy link.');
    });
  }, [activeSection, selectedCourseIds, extraSelections, finalActiveClasses, userName]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) { setError(validation.error); showError(validation.error); return; }
    setIsLoading(true); setError('');
    const reader = new FileReader();
    reader.onerror = () => {
      const message = 'The file could not be read. Try saving it as a new .xlsx file.';
      setIsLoading(false);
      setError(message);
      showError(message);
    };
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const parsed = parseWorkbook(XLSX, workbook);
        processData(parsed.rows, parsed.mapping);
        setFileSummary({
          name: file.name,
          sheetName: parsed.sheetName,
          rowCount: parsed.rows.length,
          warnings: parsed.warnings
        });
        showSuccess(`Loaded ${parsed.rows.length} timetable entries from ${parsed.sheetName}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The spreadsheet could not be parsed.';
        setError(message);
        showError(message);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }, [processData]);

  const coursesInActiveSection = useMemo(() => {
    if (!activeSection) return [];
    const courses = getCoursesForSection(activeSection);
    const unique = []; const seen = new Set();
    courses.forEach(c => { if (!seen.has(c.name)) { unique.push(c); seen.add(c.name); } });
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSection, getCoursesForSection]);

  const sectionOptions = useMemo(() => rootSections.map(s => ({ value: s, label: s })), [rootSections]);
  const toggleCourse = useCallback((id) => setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]), [setSelectedCourseIds]);
  const handleSectionChange = useCallback((v) => { setActiveSection(v); setSelectedCourseIds([]); }, [setActiveSection, setSelectedCourseIds]);
  const addExtra = useCallback(() => setExtraSelections(prev => [...prev, { id: Date.now() + Math.random(), courseName: '', section: '', courseId: '' }]), [setExtraSelections]);
  const removeExtra = useCallback((id) => setExtraSelections(prev => prev.filter(s => s.id !== id)), [setExtraSelections]);
  const updateExtra = useCallback((id, updates) => setExtraSelections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)), [setExtraSelections]);
  const resetUpload = useCallback(() => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('timetable_'))
      .forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  }, []);

  const displayOptionsList = useMemo(() => [
    { key: 'showTeacher', label: 'Teacher names' },
    { key: 'showCredits', label: 'Course credits' },
    { key: 'showSection', label: 'Section labels' }
  ], []);

  const hasSelectedCourses = selectedCourseIds.length > 0 || extraSelections.filter(s => s.courseId).length > 0;

  return (
    <div className="main-layout-container">
      <a className="skip-link" href="#main-content">Skip to timetable builder</a>
      {/* Top Navbar */}
      <nav className="top-navbar">
        <div className="nav-brand">
          <div className="brand-icon"><Calendar size={20} /></div>
          <span className="brand-title">StudReads</span>
        </div>
        <div className="nav-actions">
          <button type="button" className="nav-btn" onClick={() => setIsReviewsOpen(true)}>
            <Star size={16} /> <span>About</span>
          </button>
          <button type="button" className="nav-btn" onClick={() => setIsContactOpen(true)}>
            <Mail size={16} /> <span>Contact</span>
          </button>
          <button type="button" className="nav-btn" onClick={() => setIsPrivacyOpen(true)}>
            <Shield size={16} /> <span>Privacy</span>
          </button>
        </div>
      </nav>

      <div className="app-card">
        {/* Simplified hero — no bloat, straight to the point */}
        <header className="hero-header">
          <div className="hero-title-group">
            <span className="hero-eyebrow">Your week, sorted</span>
            <h1>Turn your timetable sheet into a week you can read</h1>
            <p className="hero-description">
              Upload the spreadsheet from your university, choose your courses, and get a clean schedule in a few clicks.
            </p>
          </div>

          {hasSelectedCourses && (
            <div className="share-actions-bar">
              <input
                type="text"
                placeholder="Name on shared schedule"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="input-field name-input"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleShare}
              >
                <Share2 size={16} /> Copy share link
              </button>
            </div>
          )}
        </header>

        <ol className="progress-steps" aria-label="Timetable setup progress">
          <li className={rawData.length > 0 ? 'is-complete' : 'is-current'}>
            <span>1</span><div><strong>Upload</strong><small>Your Excel file</small></div>
          </li>
          <li className={rawData.length > 0 ? (hasSelectedCourses ? 'is-complete' : 'is-current') : ''}>
            <span>2</span><div><strong>Choose</strong><small>Section and courses</small></div>
          </li>
          <li className={hasSelectedCourses ? 'is-current' : ''}>
            <span>3</span><div><strong>Save</strong><small>Export or share</small></div>
          </li>
        </ol>

        {/* Step 1: Upload */}
        <FileUpload
          rawData={rawData}
          isLoading={isLoading}
          error={error}
          fileSummary={fileSummary}
          setFileSummary={setFileSummary}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          resetUpload={resetUpload}
          processData={processData}
        />

        {rawData.length > 0 && (
          <main className="builder-content" id="main-content">
            <div className="builder-heading">
              <span className="step-kicker">Step 2</span>
              <div>
                <h2>Pick what belongs in your week</h2>
                <p>Start with your main section, then tick the courses you actually take.</p>
              </div>
            </div>
            {/* Step 2: Select your section & courses */}
            <CourseSelection
              sectionOptions={sectionOptions}
              activeSection={activeSection}
              handleSectionChange={handleSectionChange}
              coursesInActiveSection={coursesInActiveSection}
              selectedCourseIds={selectedCourseIds}
              toggleCourse={toggleCourse}
            />

            {/* Optional: Additional courses from other sections */}
            <AdditionalCourses
              isExtraOpen={isExtraOpen}
              setIsExtraOpen={setIsExtraOpen}
              extraSelections={extraSelections}
              getCoursesForSection={getCoursesForSection}
              updateExtra={updateExtra}
              removeExtra={removeExtra}
              addExtra={addExtra}
            />

            {/* Display toggles */}
            <section className="display-preferences" aria-labelledby="display-title">
              <div>
                <h3 id="display-title">What should each class show?</h3>
                <p>Keep it simple or add the details you need.</p>
              </div>
              <DisplayOptions
                displayOptions={displayOptions}
                setDisplayOptions={setDisplayOptions}
                displayOptionsList={displayOptionsList}
              />
            </section>

            {/* Step 3: View & export timetable */}
            {hasSelectedCourses && <EditableTimetable />}
            {!hasSelectedCourses && activeSection && (
              <div className="selection-nudge" role="status">
                Choose at least one course above and your timetable will appear here.
              </div>
            )}
          </main>
        )}
      </div>

      <Footer
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenContact={() => setIsContactOpen(true)}
        onOpenReviews={() => setIsReviewsOpen(true)}
      />

      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <ReviewsModal isOpen={isReviewsOpen} onClose={() => setIsReviewsOpen(false)} />
    </div>
  );
};

export default MainLayout;
