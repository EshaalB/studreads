import { Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppearance } from '../../utils/useAppearance';
import AboutModal from '../AboutModal';
import ExamFinder from '../ExamFinder';
import Footer from '../Footer';
import PrivacyModal from '../PrivacyModal';
import Segmented from '../ui/Segmented';
import ThemeToggle from '../ui/ThemeToggle';
import TimetableWorkspace from './TimetableWorkspace';

// Read once at start-up; the URL is cleaned after the shared data is applied.
const launchParams = new URLSearchParams(window.location.search);
const LAUNCH = {
  timetable: launchParams.get('t'),
  legacyTimetable: launchParams.get('s'),
  exams: launchParams.get('x')
};

const MainLayout = () => {
  const [activeTool, setActiveTool] = useState(LAUNCH.exams && !LAUNCH.timetable ? 'exams' : 'timetable');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, toggleTheme] = useAppearance();

  // The print stylesheet prints the active tool.
  useEffect(() => { document.body.dataset.tool = activeTool; }, [activeTool]);

  useEffect(() => {
    if (LAUNCH.timetable || LAUNCH.legacyTimetable || LAUNCH.exams) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <div className="app-header-inner">
          <a className="wordmark" href="./" aria-label="StudReads, start page">
            <img src="/brand-mark.png" alt="" width="34" height="32" />
            <span>Stud<span className="wordmark-accent">Reads</span></span>
          </a>

          <Segmented
            kind="tabs"
            label="Planner"
            className="tool-tabs"
            value={activeTool}
            onChange={setActiveTool}
            options={[{ value: 'timetable', label: 'Timetable' }, { value: 'exams', label: 'Exams' }]}
          />

          <div className="header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" className="btn btn-ghost btn-sm hide-narrow" onClick={() => setIsAboutOpen(true)}>About</button>
            <a className="icon-btn" href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub">
              <Github size={17} />
            </a>
          </div>
        </div>
      </header>

      <main className="page" id="main-content">
        {/* Both tools stay mounted so switching tabs keeps unsaved work. */}
        <div hidden={activeTool !== 'timetable'}>
          <TimetableWorkspace sharedTimetable={LAUNCH.timetable} legacyTimetable={LAUNCH.legacyTimetable} />
        </div>
        <div hidden={activeTool !== 'exams'}>
          <ExamFinder sharedExams={LAUNCH.exams} />
        </div>
      </main>

      <Footer onOpenPrivacy={() => setIsPrivacyOpen(true)} onOpenAbout={() => setIsAboutOpen(true)} />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default MainLayout;
