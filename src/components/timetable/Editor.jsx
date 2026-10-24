import { CalendarPlus, ChevronDown, Download, FileJson, FilePlus2, Image, Link2, ListChecks, Plus, Printer, Settings, Upload } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { classToItem, groupByColumn, weekColumns } from '../../utils/calendarItems';
import { showError, showSuccess } from '../../utils/errorHandler';
import { classesToIcs, downloadFile, examsToIcs, fileSlug } from '../../utils/exportUtils';
import { saveElementAsImage } from '../../utils/imageExport';
import { encodeShare, shareOrCopy } from '../../utils/sharingUtils';
import { buildTimetableBackup, buildTimetableShare } from '../../utils/transfer';
import AgendaList from '../calendar/AgendaList';
import TimeGrid from '../calendar/TimeGrid';
import ExamDialog from '../exams/ExamDialog';
import ExamPicker from '../exams/ExamPicker';
import ExamSection from '../exams/ExamSection';
import Menu from '../ui/Menu';
import PushButton from '../ui/PushButton';
import Segmented from '../ui/Segmented';
import ClassDialog from './ClassDialog';
import CoursePicker from './CoursePicker';
import SettingsPanel from './SettingsPanel';

const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// The whole planner on one screen: classes in a week grid or list, exams underneath.
const Editor = ({ busy, upload, onFile, onSample, onNew, coursePicker, examPicker, exams }) => {
  const {
    classes, conflicts, getOrAssignColor, displayOptions, setDisplayOptions, colorMap, selectedTheme,
    hasSource, removeClass, addClasses
  } = useTimetable();
  const captureRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const view = displayOptions.view === 'list' ? 'list' : 'grid';
  const title = displayOptions.title.trim();
  const slug = fileSlug(title, 'timetable');
  const empty = classes.length === 0;
  const nothing = empty && exams.mine.length === 0;
  const courseNames = useMemo(() => [...new Set(classes.map((cls) => cls.name))], [classes]);
  const clashCount = Math.ceil(conflicts.size / 2);
  const summary = [
    courseNames.length ? `${courseNames.length} ${courseNames.length === 1 ? 'course' : 'courses'}` : 'No classes yet',
    exams.mine.length ? `${exams.mine.length} ${exams.mine.length === 1 ? 'exam' : 'exams'}` : ''
  ].filter(Boolean).join(', ');

  const columns = useMemo(() => weekColumns(classes, displayOptions.days), [classes, displayOptions.days]);
  const items = useMemo(() => classes.map((cls) => classToItem(cls, { getColor: getOrAssignColor, displayOptions, conflicts })), [classes, getOrAssignColor, displayOptions, conflicts]);
  const selectClass = (id) => setEditing(classes.find((cls) => cls.id === id));

  const deleteClass = (id) => {
    const removed = classes.find((cls) => cls.id === id);
    if (!removed) return;
    removeClass(id);
    showSuccess(`Deleted ${removed.name} (${removed.day.slice(0, 3)}).`, { label: 'Undo', onClick: () => addClasses([removed]) });
  };

  // The image is taken from the planner on screen, so it looks exactly like what you see.
  const saveImage = useCallback(async () => {
    try {
      await saveElementAsImage(captureRef.current, `${slug}.png`);
    } catch {
      showError('The image could not be created.');
    }
  }, [slug]);

  const share = async () => {
    try {
      const code = await encodeShare(buildTimetableShare({ classes, title, colorMap, theme: selectedTheme, exams: exams.mine }));
      const result = await shareOrCopy({ url: `${window.location.origin}${window.location.pathname}?t=${code}`, title: title || 'My timetable' });
      if (result === 'copied') showSuccess('Link copied. Whoever opens it gets their own copy to edit.');
    } catch {
      showError('The link could not be copied.');
    }
  };

  const exportCalendar = () => {
    const calendar = classesToIcs(classes, { title: title || 'Timetable' });
    const examCalendar = exams.mine.length ? examsToIcs(exams.mine) : '';
    // One file holds both: the weekly classes and the one-off exams.
    const merged = examCalendar
      ? calendar.replace(/END:VCALENDAR\s*$/, examCalendar.slice(examCalendar.indexOf('BEGIN:VEVENT')))
      : calendar;
    downloadFile(`${slug}.ics`, merged, 'text/calendar');
  };

  const uploadItems = [
    { label: 'Class timetable', hint: 'Excel or CSV from your university', icon: <Upload size={15} />, onSelect: upload.timetable },
    { label: 'Exam date sheet', hint: 'PDF, Excel, Word or a photo', icon: <CalendarPlus size={15} />, onSelect: upload.exams },
    { label: 'Paste exam dates', hint: 'Text copied from a website or email', icon: <ListChecks size={15} />, onSelect: upload.paste },
    ...(hasSource ? [{ separator: true }, { label: 'Pick my courses again', hint: 'From the timetable you uploaded', icon: <ListChecks size={15} />, onSelect: coursePicker.open }] : []),
    { separator: true },
    { label: 'Open a backup', hint: '.json saved from StudReads', icon: <FileJson size={15} />, onSelect: upload.backup }
  ];

  const exportItems = [
    { label: 'Save as image', hint: 'PNG, exactly as shown', icon: <Image size={15} />, onSelect: saveImage, disabled: nothing },
    { label: 'Print or PDF', hint: 'Choose “Save as PDF” to keep a file', icon: <Printer size={15} />, onSelect: () => window.print(), disabled: nothing },
    { label: 'Add to calendar', hint: '.ics for Google, Apple or Outlook', icon: <CalendarPlus size={15} />, onSelect: exportCalendar, disabled: nothing },
    {
      label: 'Backup',
      hint: '.json you can open later',
      icon: <FileJson size={15} />,
      disabled: nothing,
      onSelect: () => downloadFile(`${slug}.json`, JSON.stringify(buildTimetableBackup({ classes, title, colorMap, theme: selectedTheme, display: displayOptions, exams: exams.mine }), null, 2), 'application/json')
    }
  ];

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
        <nav className="schedule-actions" aria-label="Planner actions">
          <PushButton className="push-full" onClick={() => setEditing({ day: 'Monday', startTime: '09:00', endTime: '10:00' })}><Plus size={16} /> Add class</PushButton>
          <Menu triggerClassName="action" trigger={<><Upload size={16} /> {busy || 'Upload'} <ChevronDown size={14} className="action-chevron" /></>} items={uploadItems} />
          <Menu triggerClassName="action" trigger={<><Download size={16} /> Export <ChevronDown size={14} className="action-chevron" /></>} items={exportItems} />
          <button type="button" className="action" onClick={share} disabled={nothing}><Link2 size={16} /> Share</button>
          <button type="button" className="action" onClick={onNew} disabled={nothing}><FilePlus2 size={16} /> New</button>
        </nav>

        <section className="schedule-canvas" aria-label="Your planner">
          <div className="canvas-head">
            <p className="canvas-summary">
              {busy || summary}
              {clashCount > 0 && <span className="text-warn"> · {clashCount} {clashCount === 1 ? 'clash' : 'clashes'}</span>}
            </p>
            <Segmented
              label="Layout"
              value={view}
              onChange={(next) => setDisplayOptions((current) => ({ ...current, view: next }))}
              options={[{ value: 'grid', label: 'Week' }, { value: 'list', label: 'List' }]}
            />
          </div>

          {nothing && !busy && (
            <div className="welcome" role="note">
              <div>
                <strong>Start with your university’s files</strong>
                <span>Upload or drop your class timetable or exam date sheet, or click a time slot to add a class yourself.</span>
              </div>
              <div className="welcome-actions">
                <button type="button" className="btn btn-primary" onClick={upload.timetable}>Upload timetable</button>
                <button type="button" className="btn" onClick={upload.exams}>Upload date sheet</button>
                <button type="button" className="link-btn" onClick={onSample}>Try the sample</button>
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

            <ExamSection
              exams={exams}
              getColor={getOrAssignColor}
              blockStyle={displayOptions.blockStyle}
              onOpen={(id) => setEditingExam(exams.records.find((exam) => exam.id === id))}
              onAdd={() => setEditingExam({ subject: '', date: '' })}
              onFind={examPicker.open}
            />
          </div>

          {!nothing && <p className="canvas-hint">Click a class or exam to edit it. Drop another file here to add it.</p>}
        </section>
      </div>

      <ClassDialog item={editing} onClose={() => setEditing(null)} />
      <ExamDialog exam={editingExam} onSave={(values) => exams.saveExam(values, editingExam)} onDelete={exams.removeExam} onClose={() => setEditingExam(null)} />
      {hasSource && <CoursePicker isOpen={coursePicker.isOpen} onClose={coursePicker.close} />}
      <ExamPicker isOpen={examPicker.isOpen} onClose={examPicker.close} exams={exams} courseNames={courseNames} />
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Editor;
