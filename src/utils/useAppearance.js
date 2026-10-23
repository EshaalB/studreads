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

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setSystem(query.matches ? 'dark' : 'light');
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (saved === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = saved;
    try {
      localStorage.setItem(KEY, saved);
    } catch {
      // Preference only lasts for this visit.
    }
  }, [saved]);

  const theme = saved === 'system' ? system : saved;
  const toggle = () => setSaved(theme === 'dark' ? 'light' : 'dark');
  return [theme, toggle];
};
