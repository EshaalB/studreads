// "My pages": saved copies of the whole planner, kept in this browser.
// Opening a page writes it back and reloads the app.
// Uploaded files can be big, so each one is stored once and pages point to it.
import { readStored, writeStored } from './storage.js';

const PAGES_KEY = 'studreads_pages_v1';
const FILES_KEY = 'studreads_page_files';
const PAGES_VERSION_KEY = 'studreads_pages_version';
const PAGES_VERSION = 2;
const CURRENT_KEY = 'studreads_current_page';
const BACKUP_KEY = 'studreads_backed_up_at';
const SOURCE_KEY = 'timetable_source_v6';
const FILE_REF = '@file:';

// What a page saves. Light/dark mode isn't included.
const PLANNER_KEYS = [
  'timetable_classes_v7', SOURCE_KEY, 'timetable_section_v6', 'timetable_display_v6',
  'timetable_colors_v6', 'timetable_theme_v7', 'studreads_exams_v1'
];

// Raw saved values, copied as-is.
const raw = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const snapshot = () => Object.fromEntries(PLANNER_KEYS.map((key) => [key, raw(key)]).filter(([, value]) => typeof value === 'string'));
const parse = (text, fallback) => {
  try {
    return JSON.parse(text) ?? fallback;
  } catch {
    return fallback;
  }
};

const isPage = (page) => page && typeof page.id === 'string' && typeof page.name === 'string'
  && Number.isFinite(page.savedAt) && page.data && typeof page.data === 'object';

const setRaw = (key, value, message) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw new Error(message);
  }
};
const OUT_OF_SPACE = 'This browser is out of space for saved pages. Delete an old page or back them up and remove some.';

// Short hash used as a file's id.
const fileId = (text) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return `${(hash >>> 0).toString(16)}-${text.length}`;
};

const readFiles = () => readStored(FILES_KEY, {});

// Swap between "file inside the page" and "page points at file".
const withFileRef = (data, files) => {
  const source = data[SOURCE_KEY];
  if (typeof source !== 'string' || source.startsWith(FILE_REF)) return data;
  const id = fileId(source);
  files[id] = source;
  return { ...data, [SOURCE_KEY]: `${FILE_REF}${id}` };
};
const withFileText = (data, files = readFiles()) => {
  const source = data[SOURCE_KEY];
  if (typeof source !== 'string' || !source.startsWith(FILE_REF)) return data;
  const text = files[source.slice(FILE_REF.length)];
  const rest = { ...data };
  delete rest[SOURCE_KEY];
  return typeof text === 'string' ? { ...rest, [SOURCE_KEY]: text } : rest;
};

// Save pages, and drop files no page uses anymore.
const writePages = (pages, files) => {
  const used = new Set(pages.map((page) => page.data[SOURCE_KEY]).filter((ref) => ref?.startsWith(FILE_REF)).map((ref) => ref.slice(FILE_REF.length)));
  setRaw(FILES_KEY, JSON.stringify(Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id)))), OUT_OF_SPACE);
  setRaw(PAGES_KEY, JSON.stringify(pages), OUT_OF_SPACE);
};

// Old pages kept a full copy of the file inside each page.
const migrate = () => {
  if (readStored(PAGES_VERSION_KEY, 1) >= PAGES_VERSION) return;
  const files = readFiles();
  const pages = readStored(PAGES_KEY, []).filter(isPage).map((page) => ({ ...page, data: withFileRef(page.data, files) }));
  try {
    writePages(pages, files);
    writeStored(PAGES_VERSION_KEY, PAGES_VERSION);
  } catch {
    // Out of space; old pages still work, so try again later.
  }
};

const storedPages = () => {
  migrate();
  return readStored(PAGES_KEY, []).filter(isPage);
};

// Pages with their files put back in.
export const readPages = () => {
  const files = readFiles();
  return storedPages().map((page) => ({ ...page, data: withFileText(page.data, files) }));
};
export const currentPageId = () => readStored(CURRENT_KEY, '');
export const lastBackup = () => readStored(BACKUP_KEY, 0);
export const markBackedUp = () => writeStored(BACKUP_KEY, Date.now());
export const leaveCurrentPage = () => writeStored(CURRENT_KEY, null);

export const savePage = (name, { asNew = false } = {}) => {
  const pages = storedPages();
  const files = readFiles();
  const id = !asNew && pages.some((page) => page.id === currentPageId()) ? currentPageId() : globalThis.crypto?.randomUUID?.() || `page-${Date.now()}`;
  const page = { id, name: String(name).trim().slice(0, 60) || 'Untitled', savedAt: Date.now(), data: withFileRef(snapshot(), files) };
  writePages([page, ...pages.filter((item) => item.id !== id)], files);
  writeStored(CURRENT_KEY, id);
  navigator.storage?.persist?.(); // asks the browser not to clear this site's data on its own
  return page;
};

// True if there are unsaved changes.
export const hasUnsavedWork = () => {
  const current = readPages().find((page) => page.id === currentPageId());
  const now = snapshot();
  if (!current) return parse(now.timetable_classes_v7, []).length > 0 || Boolean(now.studreads_exams_v1);
  return PLANNER_KEYS.some((key) => (now[key] ?? null) !== (current.data[key] ?? null));
};

const restoreSnapshot = (data) => PLANNER_KEYS.forEach((key) => {
  try {
    if (typeof data[key] === 'string') localStorage.setItem(key, data[key]);
    else localStorage.removeItem(key);
  } catch {
    // Removing a key always frees space.
  }
});

// Load a page into the planner. If storage runs out halfway, undo everything.
export const openPage = (id) => {
  const page = readPages().find((item) => item.id === id);
  if (!page) return;
  const before = snapshot();
  try {
    PLANNER_KEYS.forEach((key) => {
      if (typeof page.data[key] === 'string') localStorage.setItem(key, page.data[key]);
      else localStorage.removeItem(key);
    });
  } catch {
    restoreSnapshot(before);
    throw new Error(`There is not enough space to open “${page.name}”. Nothing on screen was changed.`);
  }
  writeStored(CURRENT_KEY, id);
  window.location.reload();
};

export const deletePage = (id) => {
  writePages(storedPages().filter((page) => page.id !== id), readFiles());
  if (currentPageId() === id) leaveCurrentPage();
};

// Add pages from a backup or link. If a page exists on both, keep the newer one.
export const mergePages = (incoming) => {
  const pages = storedPages();
  const files = readFiles();
  const valid = (Array.isArray(incoming) ? incoming : []).filter(isPage).map((page) => ({
    id: page.id,
    name: page.name.slice(0, 60),
    savedAt: page.savedAt,
    data: withFileRef(Object.fromEntries(PLANNER_KEYS.filter((key) => typeof page.data[key] === 'string' && !page.data[key].startsWith(FILE_REF)).map((key) => [key, page.data[key]])), files)
  }));
  let changed = 0;
  valid.forEach((page) => {
    const index = pages.findIndex((item) => item.id === page.id);
    if (index === -1) { pages.push(page); changed += 1; } else if (page.savedAt > pages[index].savedAt) { pages[index] = page; changed += 1; }
  });
  writePages(pages.sort((a, b) => b.savedAt - a.savedAt), files);
  return changed;
};

export const pagesBackup = () => ({ app: 'studreads', kind: 'pages', version: 1, exportedAt: new Date().toISOString(), pages: readPages() });

export const pageSummary = (page) => {
  const classes = parse(page.data.timetable_classes_v7, []);
  const courses = new Set(classes.map((cls) => cls.name)).size;
  const exams = parse(page.data.studreads_exams_v1, {}).selectedIds?.length || 0;
  return [courses && `${courses} ${courses === 1 ? 'course' : 'courses'}`, exams && `${exams} ${exams === 1 ? 'exam' : 'exams'}`].filter(Boolean).join(' · ') || 'Empty';
};
