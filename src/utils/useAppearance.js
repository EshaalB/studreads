import { useEffect, useState } from 'react';

const KEY = 'studreads_appearance';

// 'system' follows the device; index.html applies the saved choice before first paint.
export const useAppearance = () => {
  const [appearance, setAppearance] = useState(() => {
    try {
      return localStorage.getItem(KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (appearance === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = appearance;
    try {
      localStorage.setItem(KEY, appearance);
    } catch {
      // Preference only lasts for this visit.
    }
  }, [appearance]);

  return [appearance, setAppearance];
};
