import { ArrowLeft, CalendarPlus, Download, FileJson, FilePlus2, FileSpreadsheet, Image, Link2, ListChecks, Plus, Printer, Settings, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { showError, showSuccess } from '../../utils/errorHandler';
import { classesToCsv, classesToIcs, downloadFile, fileSlug } from '../../utils/exportUtils';
import { encodeShare, shareOrCopy } from '../../utils/sharingUtils';
import { buildTimetableBackup, buildTimetableShare } from '../../utils/transfer';
import Menu from '../ui/Menu';
import Segmented from '../ui/Segmented';
import ClassDialog from './ClassDialog';
import ClassList from './ClassList';
import CoursePicker from './CoursePicker';
import SettingsPanel from './SettingsPanel';
import WeekGrid from './WeekGrid';

const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const Editor = ({ onBack, onImport, onNew, openPicker = false }) => {
  const { classes, conflicts, getOrAssignColor, displayOptions, setDisplayOptions, colorMap, selectedTheme, hasSource } = useTimetable();
  const exportRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(openPicker);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const view = displayOptions.view === 'list' ? 'list' : 'grid';
  const title = displayOptions.title.trim();
  const slug = fileSlug(title, 'timetable');
  const courseCount = new Set(classes.map((cls) => cls.name)).size;
  const clashCount = Math.ceil(conflicts.size / 2);
  const shared = { classes, getOrAssignColor, displayOptions, conflicts };

  const saveImage = useCallback(async () => {
    if (!exportRef.current || classes.length === 0) return;
    setIsExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#f9f3e2',
        logging: false,
        windowWidth: 1200,
        onclone: (clonedDocument) => {
          const sheet = clonedDocument.querySelector('.export-sheet');
          if (sheet) sheet.style.left = '0';
        }
      });
      canvas.toBlob((blob) => (blob ? downloadFile(`${slug}.png`, blob) : showError('The image could not be created.')), 'image/png');
    } catch {
      showError('The image could not be created.');
    } finally {
      setIsExporting(false);
    }
  }, [classes.length, slug]);

  const share = useCallback(async () => {
    try {
      const code = await encodeShare(buildTimetableShare({ classes, title, colorMap, theme: selectedTheme }));
      const result = await shareOrCopy({ url: `${window.location.origin}${window.location.pathname}?t=${code}`, title: title || 'My timetable' });
      if (result === 'copied') showSuccess('Link copied. Whoever opens it gets their own copy to edit.');
    } catch {
      showError('The link could not be copied.');
    }
  }, [classes, title, colorMap, selectedTheme]);

  const empty = classes.length === 0;
  const exportItems = [
    { label: 'Calendar', hint: '.ics, repeats weekly for 16 weeks', icon: <CalendarPlus size={15} />, onSelect: () => downloadFile(`${slug}.ics`, classesToIcs(classes, { title: title || 'Timetable' }), 'text/calendar') },
    { label: 'Spreadsheet', hint: '.csv for Excel or Google Sheets', icon: <FileSpreadsheet size={15} />, onSelect: () => downloadFile(`${slug}.csv`, classesToCsv(classes), 'text/csv') },
    {
      label: 'Backup',
      hint: '.json you can import later',
      icon: <FileJson size={15} />,
      onSelect: () => downloadFile(`${slug}.json`, JSON.stringify(buildTimetableBackup({ classes, title, colorMap, theme: selectedTheme, display: displayOptions }), null, 2), 'application/json')
    }
  ].map((item) => ({ ...item, disabled: empty }));

  return (
    <div className="screen schedule">
      <header className="schedule-bar">
        <button type="button" className="bar-icon" onClick={onBack} aria-label="Back to start"><ArrowLeft size={18} /></button>
        <input
          className="schedule-title"
          value={displayOptions.title}
          onChange={(event) => setDisplayOptions((current) => ({ ...current, title: event.target.value }))}
          placeholder="Untitled timetable"
          maxLength={60}
          aria-label="Timetable name"
        />
        <button type="button" className="bar-button" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={16} /> <span>Settings</span>
        </button>
      </header>

      <div className="schedule-body">
        <nav className="schedule-actions" aria-label="Timetable actions">
          <button type="button" className="action action-primary" onClick={() => setEditing({ day: 'Monday', startTime: '09:00', endTime: '10:00' })}><Plus size={16} /> Add class</button>
          {hasSource && <button type="button" className="action" onClick={() => setIsPickerOpen(true)}><ListChecks size={16} /> Choose courses</button>}
          <button type="button" className="action" onClick={saveImage} disabled={empty || isExporting}><Image size={16} /> {isExporting ? 'Saving…' : 'Save image'}</button>
          <button type="button" className="action" onClick={() => window.print()} disabled={empty}><Printer size={16} /> Print</button>
          <Menu triggerClassName="action" align="start" trigger={<><Download size={16} /> Export</>} items={exportItems} />
          <button type="button" className="action" onClick={share} disabled={empty}><Link2 size={16} /> Share</button>
          <button type="button" className="action" onClick={onImport}><Upload size={16} /> Import</button>
          <button type="button" className="action" onClick={onNew}><FilePlus2 size={16} /> New timetable</button>
        </nav>

        <section className="schedule-canvas" aria-label="Timetable">
          <div className="canvas-head">
            <p className="canvas-summary">
              {empty ? 'No classes yet' : `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}, ${classes.length} ${classes.length === 1 ? 'class' : 'classes'} a week`}
              {clashCount > 0 && <span className="text-warn"> · {clashCount} {clashCount === 1 ? 'clash' : 'clashes'}</span>}
            </p>
            <Segmented
              label="Layout"
              value={view}
              onChange={(next) => setDisplayOptions((current) => ({ ...current, view: next }))}
              options={[{ value: 'grid', label: 'Week' }, { value: 'list', label: 'List' }]}
            />
          </div>

          {view === 'grid' || empty ? (
            <WeekGrid
              {...shared}
              onSelect={setEditing}
              onAddAt={(day, minutes) => setEditing({ day, startTime: toClock(minutes), endTime: toClock(Math.min(minutes + 60, 23 * 60 + 59)) })}
            />
          ) : (
            <ClassList {...shared} onSelect={setEditing} />
          )}

          <p className="canvas-hint">
            {empty
              ? (hasSource ? 'Choose your courses from the file, or click a time slot to add a class.' : 'Click a time slot or “Add class” to start.')
              : 'Click a class to edit it, change its colour or delete it.'}
          </p>
        </section>
      </div>

      {/* Off-screen copy used for the image export, and the only thing printed. */}
      <div className="export-sheet" ref={exportRef} aria-hidden="true">
        <div className="export-head">
          <strong>{title || 'My timetable'}</strong>
          <span>{courseCount} courses · {classes.length} classes a week</span>
        </div>
        <WeekGrid {...shared} />
      </div>

      <ClassDialog item={editing} onClose={() => setEditing(null)} />
      {hasSource && <CoursePicker isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} />}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Editor;
