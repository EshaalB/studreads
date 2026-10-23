// localStorage helpers that never throw (storage can be full, disabled or private).

export const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null) return fallback;
    // A null fallback accepts any saved object or list; otherwise the shape must match.
    if (fallback === null) return typeof parsed === 'object' ? parsed : null;
    return typeof parsed === typeof fallback && Array.isArray(parsed) === Array.isArray(fallback) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const writeStored = (key, value) => {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or disabled; the app keeps working for this visit.
  }
};
