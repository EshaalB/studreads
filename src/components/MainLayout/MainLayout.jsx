import { Calendar, Mail, Share2, Shield, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTimetable } from '../../context/TimetableContext';
import { TIME_REGEX } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/errorHandler';
import { parseHeuristicExcel } from '../../utils/heuristicParser';
import { decodeState, encodeState } from '../../utils/sharingUtils';
import { autoDetectColumnMapping } from '../../utils/columnDetector';
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
    displayOptions, setDisplayOptions, getCoursesForSection
  } = useTimetable();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExtraOpen, setIsExtraOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const fileInputRef = useRef();

  // URL state restoration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedState = params.get('s');
    if (sharedState) {
      const decoded = decodeState(sharedState);
      if (decoded) {
        if (decoded.activeSection) setActiveSection(decoded.activeSection);
        if (decoded.selectedCourseIds) setSelectedCourseIds(decoded.selectedCourseIds);
        if (decoded.extraSelections) setExtraSelections(decoded.extraSelections);
        window.history.replaceState({}, document.title, window.location.pathname);
        showSuccess(`Restored ${decoded.userName ? decoded.userName + "'s" : "shared"} timetable!`);
      }
    }
  }, [setActiveSection, setSelectedCourseIds, setExtraSelections]);

  const handleShare = useCallback(() => {
    const state = {
      activeSection,
      selectedCourseIds,
      extraSelections,
      userName: userName.trim()
    };
    const encoded = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;

    navigator.clipboard.writeText(url).then(() => {
      showSuccess('Share link copied to clipboard!');
    }).catch(() => {
      showError('Failed to copy link.');
    });
  }, [activeSection, selectedCourseIds, extraSelections, userName]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) { setError(validation.error); showError(validation.error); return; }
    setIsLoading(true); setError('');
    const reader = new FileReader();
    reader.onerror = () => { setIsLoading(false); showError('Failed to read file.'); };
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Helper to expand merged cells
        if (ws['!merges']) {
          ws['!merges'].forEach(merge => {
            const startStr = XLSX.utils.encode_cell(merge.s);
            const startVal = ws[startStr];
            if (!startVal) return;

            for (let R = merge.s.r; R <= merge.e.r; ++R) {
              for (let C = merge.s.c; C <= merge.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cellRef]) {
                  ws[cellRef] = { ...startVal };
                }
              }
            }
          });
        }

        const rawMatrix = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const hasGrid = rawMatrix.slice(0, 30).some(row => Array.isArray(row) && row.some(c => TIME_REGEX.test(String(c || '').trim())));

        if (hasGrid) {
          const parsed = parseHeuristicExcel(rawMatrix);
          if (parsed.length === 0) {
            showError('Could not extract any courses from this spreadsheet layout. Check the file format.');
            return;
          }
          processData(parsed, { courseName: 'courseName', section: 'section', day: 'day', startTime: 'startTime', endTime: 'endTime', instructor: 'instructor', room: 'room', credits: 'credits' });
        } else {
          // Flat table: auto-detect column mapping from header names
          const data = XLSX.utils.sheet_to_json(ws);
          if (data.length === 0) {
            showError('No data rows found in spreadsheet.');
            return;
          }

          const headers = Object.keys(data[0]);
          const mapping = autoDetectColumnMapping(headers);

          if (!mapping.courseName) {
            showError('Could not detect a course name column. Expected headers like "Course", "Subject", "Course Name", etc.');
            return;
          }

          processData(data, mapping);
        }
        showSuccess('Timetable parsed and loaded successfully!');
      } catch (err) { showError(err.message); } finally { setIsLoading(false); }
    };
    reader.readAsBinaryString(file);
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
  const resetUpload = useCallback(() => { localStorage.clear(); window.location.reload(); }, []);

  const displayOptionsList = useMemo(() => [
    { key: 'showTeacher', label: 'Show Teachers' },
    { key: 'showCredits', label: 'Show Credits' },
    { key: 'showSection', label: 'Section View' }
  ], []);

  const hasSelectedCourses = selectedCourseIds.length > 0 || extraSelections.filter(s => s.courseId).length > 0;

  return (
    <div className="main-layout-container">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <div className="nav-brand">
          <div className="brand-icon"><Calendar size={20} /></div>
          <span className="brand-title">StudReads</span>
        </div>
        <div className="nav-actions">
          <button type="button" className="nav-btn" onClick={() => setIsReviewsOpen(true)}>
            <Star size={16} /> Reviews
          </button>
          <button type="button" className="nav-btn" onClick={() => setIsContactOpen(true)}>
            <Mail size={16} /> Contact
          </button>
          <button type="button" className="nav-btn" onClick={() => setIsPrivacyOpen(true)}>
            <Shield size={16} /> Privacy
          </button>
        </div>
      </nav>

      <div className="app-card">
        {/* Simplified hero — no bloat, straight to the point */}
        <header className="hero-header">
          <div className="hero-title-group">
            <h1>Generate Your Timetable</h1>
            <p className="hero-description">
              Upload your university spreadsheet → pick your section → get your timetable. That's it.
            </p>
          </div>

          {hasSelectedCourses && (
            <div className="share-actions-bar">
              <input
                type="text"
                placeholder="Your Name (Optional)"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="input-field name-input"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleShare}
              >
                <Share2 size={16} /> Share Link
              </button>
            </div>
          )}
        </header>

        {/* Step 1: Upload */}
        <FileUpload
          rawData={rawData}
          isLoading={isLoading}
          error={error}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          resetUpload={resetUpload}
          processData={processData}
        />

        {rawData.length > 0 && (
          <main className="builder-content">
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
            <DisplayOptions
              displayOptions={displayOptions}
              setDisplayOptions={setDisplayOptions}
              displayOptionsList={displayOptionsList}
            />

            {/* Step 3: View & export timetable */}
            {hasSelectedCourses && <EditableTimetable />}
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
