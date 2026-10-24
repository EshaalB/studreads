import { Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SITE } from '../../content/site';
import { useAppearance } from '../../hooks/useAppearance';
import TimetableTool from '../timetable/TimetableTool';
import ThemeToggle from '../ui/ThemeToggle';
import AboutDialog from './AboutDialog';
import Footer from './Footer';
import Faq from './Faq';

// Read once at start-up; the URL is cleaned after the shared data is applied.
const launchParams = new URLSearchParams(window.location.search);
const LAUNCH = {
  timetable: launchParams.get('t'),
  legacyTimetable: launchParams.get('s'),
  exams: launchParams.get('x'),
  classmates: launchParams.get('c')
};

const AppShell = () => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, toggleTheme] = useAppearance();

  useEffect(() => {
    if (Object.values(LAUNCH).some(Boolean)) {
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

          <div className="header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" className="header-link" onClick={() => setIsAboutOpen(true)}>About</button>
            <a className="icon-btn" href={SITE.repo} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub">
              <Github size={17} />
            </a>
          </div>
        </div>
      </header>

      <main className="page" id="main-content">
        <h1 className="visually-hidden">StudReads: university timetable maker and exam date sheet finder</h1>
        <TimetableTool launch={LAUNCH} />
        <Faq />
      </main>

      <Footer onOpenAbout={() => setIsAboutOpen(true)} />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default AppShell;
