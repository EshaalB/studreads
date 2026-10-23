import { CalendarPlus, Download, FileJson, FilePlus2, Image, Link2, ListChecks, Plus, Printer, Settings, Upload } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { classToItem, groupByColumn, weekColumns } from '../../utils/calendarItems';
import { showError, showSuccess } from '../../utils/errorHandler';
import { classesToIcs, downloadFile, fileSlug } from '../../utils/exportUtils';
import { saveElementAsImage } from '../../utils/imageExport';
import { encodeShare, shareOrCopy } from '../../utils/sharingUtils';
import { buildTimetableBackup, buildTimetableShare } from '../../utils/transfer';
import AgendaList from '../calendar/AgendaList';
import TimeGrid from '../calendar/TimeGrid';
import Menu from '../ui/Menu';
import Segmented from '../ui/Segmented';
import ClassDialog from './ClassDialog';
import CoursePicker from './CoursePicker';
import SettingsPanel from './SettingsPanel';

const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const Editor = ({ isLoading, pickerRequest, onUpload, onFile, onSample, onNew }) => {
  const {
    classes, conflicts, getOrAssignColor, displayOptions, setDisplayOptions, colorMap, selectedTheme,
    hasSource, removeClass, addClasses
  } = useTimetable();
  const captureRef = useRef(null);
  const [editing, setEditing] = useState(null);
  // The picker opens when asked from here, or whenever a new file has been loaded.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [handledRequest, setHandledRequest] = useState(pickerRequest);
  const pickerVisible = isPickerOpen || pickerRequest !== handledRequest;
  const closePicker = () => { setIsPickerOpen(false); setHandledRequest(pickerRequest); };
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const view = displayOptions.view === 'list' ? 'list' : 'grid';
  const title = displayOptions.title.trim();
  const slug = fileSlug(title, 'timetable');
  const empty = classes.length === 0;
  const courseCount = new Set(classes.map((cls) => cls.name)).size;
  const clashCount = Math.ceil(conflicts.size / 2);
  const summary = empty ? 'No classes yet' : `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}, ${classes.length} ${classes.length === 1 ? 'class' : 'classes'} a week`;

  const columns = useMemo(() => weekColumns(classes, displayOptions.days), [classes, displayOptions.days]);
  const items = useMemo(() => classes.map((cls) => classToItem(cls, { getColor: getOrAssignColor, displayOptions, conflicts })), [classes, getOrAssignColor, displayOptions, conflicts]);
  const selectClass = (id) => setEditing(classes.find((cls) => cls.id === id));

  const deleteClass = (id) => {
    const removed = classes.find((cls) => cls.id === id);
    if (!removed) return;
    removeClass(id);
    showSuccess(`Deleted ${removed.name} (${removed.day.slice(0, 3)}).`, { label: 'Undo', onClick: () => addClasses([removed]) });
  };

  // The image is taken from the timetable on screen, so it looks exactly like what you see.
  const saveImage = useCallback(async () => {
    if (!captureRef.current || empty) return;
    setIsSaving(true);
    try {
      await saveElementAsImage(captureRef.current, `${slug}.png`);
    } catch {
      showError('The image could not be created.');
    } finally {
      setIsSaving(false);
    }
  }, [empty, slug]);

  const share = useCallback(async () => {
    try {
      const code = await encodeShare(buildTimetableShare({ classes, title, colorMap, theme: selectedTheme }));
      const result = await shareOrCopy({ url: `${window.location.origin}${window.location.pathname}?t=${code}`, title: title || 'My timetable' });
      if (result === 'copied') showSuccess('Link copied. Whoever opens it gets their own copy to edit.');
    } catch {
      showError('The link could not be copied.');
    }
  }, [classes, title, colorMap, selectedTheme]);

  const exportItems = [
    { label: 'Calendar', hint: '.ics for Google, Apple or Outlook', icon: <CalendarPlus size={15} />, onSelect: () => downloadFile(`${slug}.ics`, classesToIcs(classes, { title: title || 'Timetable' }), 'text/calendar') },
    {
      label: 'Backup',
      hint: '.json you can import later',
      icon: <FileJson size={15} />,
      onSelect: () => downloadFile(`${slug}.json`, JSON.stringify(buildTimetableBackup({ classes, title, colorMap, theme: selectedTheme, display: displayOptions }), null, 2), 'application/json')
    }
  ].map((item) => ({ ...item, disabled: empty }));

  return (
    <div
      className={`screen schedule ${isDragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setIsDragging(true); } }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setIsDragging(false); onFile(event.dataTransfer.files?.[0]); }}
    >
      <header className="schedule-bar">
        <input
          className="schedule-title"
          value={displayOptions.title}
          onChange={(event) => setDisplayOptions((current) => ({ ...current, title: event.target.value }))}
          placeholder="Untitled timetable"
          maxLength={60}
          aria-label="Timetable name"
        />
        <button type="button" className="bar-button" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={16} /> <span>Customise</span>
        </button>
      </header>

      <div className="schedule-body">
        <nav className="schedule-actions" aria-label="Timetable actions">
          <button type="button" className="action action-primary" onClick={() => setEditing({ day: 'Monday', startTime: '09:00', endTime: '10:00' })}><Plus size={16} /> Add class</button>
          <button type="button" className="action" onClick={onUpload} disabled={isLoading}><Upload size={16} /> {isLoading ? 'Reading…' : 'Upload file'}</button>
          {hasSource && <button type="button" className="action" onClick={() => setIsPickerOpen(true)}><ListChecks size={16} /> Choose courses</button>}
          <button type="button" className="action" onClick={saveImage} disabled={empty || isSaving}><Image size={16} /> {isSaving ? 'Saving…' : 'Save image'}</button>
          <button type="button" className="action" onClick={() => window.print()} disabled={empty}><Printer size={16} /> Print</button>
          <Menu triggerClassName="action" trigger={<><Download size={16} /> Export</>} items={exportItems} />
          <button type="button" className="action" onClick={share} disabled={empty}><Link2 size={16} /> Share</button>
          <button type="button" className="action" onClick={onNew}><FilePlus2 size={16} /> New timetable</button>
        </nav>

        <section className="schedule-canvas" aria-label="Timetable">
          <div className="canvas-head">
            <p className="canvas-summary">
              {summary}
              {clashCount > 0 && <span className="text-warn"> · {clashCount} {clashCount === 1 ? 'clash' : 'clashes'}</span>}
            </p>
            <Segmented
              label="Layout"
              value={view}
              onChange={(next) => setDisplayOptions((current) => ({ ...current, view: next }))}
              options={[{ value: 'grid', label: 'Week' }, { value: 'list', label: 'List' }]}
            />
          </div>

          {empty && (
            <div className="welcome" role="note">
              <div>
                <strong>{isLoading ? 'Reading your file…' : 'Start with your university’s timetable'}</strong>
                <span>Upload or drop the Excel or CSV file, or click any time slot below to add classes yourself.</span>
              </div>
              <div className="welcome-actions">
                <button type="button" className="btn btn-primary" onClick={onUpload} disabled={isLoading}><Upload size={15} /> Upload file</button>
                <button type="button" className="btn" onClick={onSample}>Try the sample</button>
              </div>
            </div>
          )}

          {/* What you see here is what is saved as an image and printed. */}
          <div className="capture" ref={captureRef} data-print-target="timetable">
            <div className="capture-head">
              <strong>{title || 'My timetable'}</strong>
              <span>{summary}</span>
            </div>
            {view === 'grid' || empty ? (
              <TimeGrid
                columns={columns}
                items={items}
                timeFormat={displayOptions.timeFormat}
                rowHeight={displayOptions.rowHeight}
                blockStyle={displayOptions.blockStyle}
                onSelect={selectClass}
                onAddAt={(day, minutes) => setEditing({ day, startTime: toClock(minutes), endTime: toClock(Math.min(minutes + 60, 23 * 60 + 59)) })}
              />
            ) : (
              <AgendaList groups={groupByColumn(columns, items)} onSelect={selectClass} onRemove={deleteClass} removeLabel="Delete" blockStyle={displayOptions.blockStyle} />
            )}
          </div>

          {!empty && <p className="canvas-hint">Click a class to edit it, change its colour or delete it. Drop a file here to import another timetable.</p>}
        </section>
      </div>

      <ClassDialog item={editing} onClose={() => setEditing(null)} />
      {hasSource && <CoursePicker isOpen={pickerVisible} onClose={closePicker} />}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Editor;
