import { useEffect, useState } from 'react';

const KEY = 'studreads_appearance';
const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Follows the device until the user picks light or dark; index.html applies a saved
// choice before first paint so the page never flashes the wrong theme.
export const useAppearance = () => {
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem(KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [system, setSystem] = useState(systemTheme);
  const theme = saved === 'system' ? system : saved;

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setSystem(query.matches ? 'dark' : 'light');
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, saved);
    } catch {
      // storage unavailable: the choice lasts for this visit only
    }
  }, [saved]);

  const toggle = () => setSaved(theme === 'dark' ? 'light' : 'dark');
  return [theme, toggle];
};
