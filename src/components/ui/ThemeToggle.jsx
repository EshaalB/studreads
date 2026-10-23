import { Moon, Sun } from 'lucide-react';

const ThemeToggle = ({ theme, onToggle }) => (
  <button
    type="button"
    className="icon-btn theme-toggle"
    onClick={onToggle}
    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    data-theme-state={theme}
  >
    <Sun size={17} className="theme-icon theme-icon-sun" aria-hidden="true" />
    <Moon size={17} className="theme-icon theme-icon-moon" aria-hidden="true" />
  </button>
);

export default ThemeToggle;
