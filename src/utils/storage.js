// localStorage helpers that never throw. If saving fails,
// onStorageFailure is told once so the app can warn.

let failureListener = null;
let failureReported = false;
export const onStorageFailure = (listener) => { failureListener = listener; };

export const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null) return fallback;
    // With a null fallback any shape is fine; otherwise it must match.
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
    return true;
  } catch (error) {
    if (!failureReported) failureListener?.(error?.name === 'QuotaExceededError' ? 'full' : 'blocked');
    failureReported = true;
    return false;
  }
};
