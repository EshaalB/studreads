import { FolderOpen, Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SITE } from '../../content/site';
import { useTimetable } from '../../context/useTimetable';
import { decodeShare } from '../../export/sharingUtils';
import { showError, showSuccess } from '../../utils/errorHandler';
import { mergePages } from '../../utils/pages';
import { onStorageFailure } from '../../utils/storage';
import TimetableTool from '../timetable/TimetableTool';
import ThemeToggle from '../ui/ThemeToggle';
import AboutDialog from './AboutDialog';
import Footer from './Footer';
import Faq from './Faq';
import PagesDialog from './PagesDialog';

// Read once at start-up; the URL is cleaned after the shared data is applied.
// Links carry their data after # so it is never sent to the server; ?t= links from before still open.
const launchParams = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`);
const LAUNCH = {
  timetable: launchParams.get('t'),
  classmates: launchParams.get('c'),
  pages: launchParams.get('p')
};

const AppShell = () => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isPagesOpen, setIsPagesOpen] = useState(false);
  const { appearance: theme, toggleAppearance: toggleTheme } = useTimetable();

  useEffect(() => {
    onStorageFailure((reason) => showError(reason === 'full'
      ? 'This browser is out of space, so changes are not being saved. Back up from My pages and delete old pages.'
      : 'This browser is blocking storage (private mode or site settings), so changes will be lost when you close the tab.'));
    if (Object.values(LAUNCH).some(Boolean)) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (LAUNCH.pages) {
      decodeShare(LAUNCH.pages).then((data) => {
        if (!Array.isArray(data?.p)) { showError('This pages link is empty or damaged.'); return; }
        try {
          showSuccess(`${mergePages(data.p)} pages added from the link.`);
          setIsPagesOpen(true);
        } catch (error) {
          showError(error.message);
        }
      });
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
            <button type="button" className="header-link header-pages" onClick={() => setIsPagesOpen(true)}><FolderOpen size={16} /> <span>My pages</span></button>
            <button type="button" className="header-link" onClick={() => setIsAboutOpen(true)}>About</button>
            <span className="header-divider" aria-hidden="true" />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <a className="icon-btn" href={SITE.repo} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub">
              <Github size={17} />
            </a>
          </div>
        </div>
      </header>

      <main className="page" id="main-content">
        <h1 className="visually-hidden">StudReads: free timetable generator for university students, with an exam date sheet finder</h1>
        <TimetableTool launch={LAUNCH} />
        <Faq />
      </main>

      <Footer />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      {isPagesOpen && <PagesDialog isOpen onClose={() => setIsPagesOpen(false)} />}
    </div>
  );
};

export default AppShell;
