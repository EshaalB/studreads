import { Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppearance } from '../../utils/useAppearance';
import ExamTool from '../exams/ExamTool';
import TimetableTool from '../timetable/TimetableTool';
import Segmented from '../ui/Segmented';
import ThemeToggle from '../ui/ThemeToggle';
import AboutDialog from './AboutDialog';
import Footer from './Footer';
import Faq from './Faq';

// Read once at start-up; the URL is cleaned after the shared data is applied.
const launchParams = new URLSearchParams(window.location.search);
const LAUNCH = {
  timetable: launchParams.get('t'),
  legacyTimetable: launchParams.get('s'),
  exams: launchParams.get('x')
};

const AppShell = () => {
  const [activeTool, setActiveTool] = useState(LAUNCH.exams && !LAUNCH.timetable ? 'exams' : 'timetable');
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
            <button type="button" className="header-link" onClick={() => setIsAboutOpen(true)}>About</button>
            <a className="icon-btn" href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub">
              <Github size={17} />
            </a>
          </div>
        </div>
      </header>

      <main className="page" id="main-content">
        <h1 className="visually-hidden">StudReads: university timetable maker and exam date sheet finder</h1>
        {/* Both tools stay mounted so switching tabs keeps unsaved work. */}
        <div hidden={activeTool !== 'timetable'}>
          <TimetableTool sharedTimetable={LAUNCH.timetable} legacyTimetable={LAUNCH.legacyTimetable} />
        </div>
        <div hidden={activeTool !== 'exams'}>
          <ExamTool sharedExams={LAUNCH.exams} />
        </div>
        <Faq />
      </main>

      <Footer onOpenAbout={() => setIsAboutOpen(true)} />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default AppShell;
