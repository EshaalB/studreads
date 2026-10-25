import { useRef, useState } from 'react';
import { encodeShare, shareOrCopy } from '../../export/sharingUtils';
import { downloadFile } from '../../export/exportUtils';
import { shortDate } from '../../utils/dates';
import { confirmAction } from '../../utils/confirm';
import { showError, showSuccess } from '../../utils/errorHandler';
import {
  currentPageId, deletePage, hasUnsavedWork, lastBackup, markBackedUp, mergePages, openPage,
  pageSummary, pagesBackup, readPages, savePage
} from '../../utils/pages';
import { readStored } from '../../utils/storage';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';

// Links longer than this get cut off by some chat apps; the backup file has no limit.
const MAX_LINK = 8000;
const savedOn = (time) => shortDate(new Date(time).toISOString().slice(0, 10));

// Saved semesters and exam plans, plus moving them to another device.
const PagesDialog = ({ isOpen, onClose }) => {
  const [pages, setPages] = useState(readPages);
  const current = pages.find((page) => page.id === currentPageId());
  const [name, setName] = useState(() => current?.name || readStored('timetable_display_v6', {}).title || '');
  const fileInput = useRef(null);
  const refresh = () => setPages(readPages());

  const run = (action) => {
    try {
      action();
      refresh();
    } catch (error) {
      showError(error.message);
    }
  };

  const save = (asNew) => run(() => {
    const page = savePage(name || 'Untitled', { asNew });
    showSuccess(`Saved “${page.name}”.`);
  });

  const open = async (page) => {
    if (page.id !== currentPageId() && hasUnsavedWork() && !await confirmAction('What is on screen now is not saved as a page and will be replaced.', { title: `Open “${page.name}”?`, confirmLabel: 'Open page' })) return;
    try {
      openPage(page.id);
    } catch (error) {
      showError(error.message);
    }
  };

  const remove = async (page) => {
    if (await confirmAction('It is removed from this browser. Backups you saved still have it.', { title: `Delete “${page.name}”?`, confirmLabel: 'Delete', danger: true })) run(() => deletePage(page.id));
  };

  const backUp = () => {
    downloadFile('studreads-pages.json', JSON.stringify(pagesBackup(), null, 2), 'application/json');
    markBackedUp();
    refresh();
  };

  const restore = async (file) => {
    fileInput.current.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      run(() => showSuccess(`${mergePages(data.pages)} pages added or updated.`));
    } catch {
      showError('This is not a StudReads pages backup.');
    }
  };

  const transferLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#p=${await encodeShare({ p: readPages() })}`;
      if (url.length > MAX_LINK) {
        backUp();
        showSuccess('Your pages are too big for one link, so they were saved as a file instead. Open it on the other device with Restore.');
        return;
      }
      if (await shareOrCopy({ url, title: 'My StudReads pages' }) === 'copied') showSuccess('Link copied. Open it on your other device to add these pages there.');
    } catch {
      showError('The link could not be copied.');
    }
  };

  const backedUp = lastBackup();

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="My pages" width={540}>
      <div className="form">
        <div className="pages-save">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Fall 2026 semester" maxLength={60} aria-label="Page name" />
          <PushButton onClick={() => save(false)}>{current ? 'Save changes' : 'Save page'}</PushButton>
        </div>
        {current && <button type="button" className="link-btn" onClick={() => save(true)}>Save as a new page instead</button>}

        {pages.length > 0 ? (
          <ul className="pages-list">
            {pages.map((page) => (
              <li key={page.id} className={page.id === current?.id ? 'is-current' : ''}>
                <button type="button" className="pages-open" onClick={() => open(page)}>
                  <strong>{page.name}</strong>
                  <span>{pageSummary(page)} · saved {savedOn(page.savedAt)}{page.id === current?.id ? ' · open now' : ''}</span>
                </button>
                <button type="button" className="link-btn" onClick={() => remove(page)}>Delete</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Save what is on screen as a page, like “Fall 2026 semester” or “Mid-2 exams”, and come back to it any time.</p>
        )}

        <section className="pages-move" aria-labelledby="move-title">
          <h3 id="move-title">Another device</h3>
          <p className="muted small">
            Pages live in this browser only.{' '}
            {pages.length > 0 && (backedUp ? `Last backed up ${savedOn(backedUp)}.` : 'They have never been backed up.')}
          </p>
          <div className="pages-actions">
            <button type="button" className="btn" onClick={transferLink} disabled={!pages.length}>Copy transfer link</button>
            <button type="button" className="btn" onClick={backUp} disabled={!pages.length}>Back up to a file</button>
            <button type="button" className="btn" onClick={() => fileInput.current.click()}>Restore from a file</button>
          </div>
          <input ref={fileInput} type="file" accept=".json" hidden onChange={(event) => restore(event.target.files?.[0])} />
        </section>
      </div>
    </Dialog>
  );
};

export default PagesDialog;
