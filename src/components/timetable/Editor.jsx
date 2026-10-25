import { CalendarPlus, ChevronDown, ClipboardList, Download, FileJson, FilePlus2, Image, Link2, ListChecks, Plus, Printer, Search, Settings, Upload, Users } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SITE } from '../../content/site';
import { useTimetable } from '../../context/useTimetable';
import { classToItem, dateFromColumn, examToItem, groupByColumn, plannerColumns } from '../../utils/calendarItems';
import { relativeDay, weekdayOf } from '../../utils/dates';
import { minutesToInput } from '../../utils/timeUtils';
import { showError, showSuccess } from '../../utils/errorHandler';
import { classesToIcs, downloadFile, examsToIcs, fileSlug } from '../../export/exportUtils';
import { saveElementAsImage } from '../../export/imageExport';
import { encodeShare, shareOrCopy } from '../../export/sharingUtils';
import { buildClassmateShare, buildTimetableBackup, buildTimetableShare } from '../../export/transfer';
import { isAddedByHand } from '../../hooks/useExams';
import AgendaList from '../calendar/AgendaList';
import ItemPreview from '../calendar/ItemPreview';
import ImportProgress from '../ui/ImportProgress';
import TimeGrid from '../calendar/TimeGrid';
import ExamDialog from '../exams/ExamDialog';
import ExamPicker from '../exams/ExamPicker';
import Menu from '../ui/Menu';
import PushButton from '../ui/PushButton';
import Segmented from '../ui/Segmented';
import ClassDialog from './ClassDialog';
import CoursePicker from './CoursePicker';
import SettingsPanel from './SettingsPanel';

// The whole planner on one screen: exams and classes together in a week grid or a list.
const Editor = ({ busy, upload, onFile, onCancel, onSample, onNew, coursePicker, examPicker, exams }) => {
  const {
    classes, conflicts, getOrAssignColor, displayOptions, setDisplayOptions, colorMap, selectedTheme,
    hasSource, shareableSource, removeClass, addClasses, keepPreviews, discardPreviews
  } = useTimetable();
  const captureRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const view = displayOptions.view === 'list' ? 'list' : 'grid';
  const title = displayOptions.title.trim();
  const slug = fileSlug(title, 'timetable');
  const nothing = classes.length === 0 && exams.mine.length === 0;
  const previewCourses = [...new Set(classes.filter((cls) => cls.preview).map((cls) => `${cls.name} (${cls.section})`))];
  const hasSheet = exams.records.some((record) => !isAddedByHand(record));
  const courseNames = useMemo(() => [...new Set(classes.map((cls) => cls.name))], [classes]);
  const clashCount = Math.ceil(conflicts.size / 2) + Math.ceil(exams.clashes.size / 2);
  const summary = [
    courseNames.length ? `${courseNames.length} ${courseNames.length === 1 ? 'course' : 'courses'}` : '',
    exams.mine.length ? `${exams.mine.length} ${exams.mine.length === 1 ? 'exam' : 'exams'}` : ''
  ].filter(Boolean).join(', ') || 'Nothing added yet';
  const nextExamNote = exams.nextExam ? `Next exam: ${exams.nextExam.subject}, ${relativeDay(exams.nextExam.date)}` : '';

  const items = useMemo(() => [
    ...classes.map((cls) => classToItem(cls, { getColor: getOrAssignColor, displayOptions, conflicts })),
    ...exams.mine.map((exam) => examToItem(exam, { getColor: getOrAssignColor, clashes: exams.clashes }))
  ], [classes, exams.mine, exams.clashes, getOrAssignColor, displayOptions, conflicts]);
  const columns = useMemo(() => plannerColumns(items), [items]);
  const kindOf = (id) => items.find((item) => item.id === id)?.kind;
  const editItem = (id) => (kindOf(id) === 'exam'
    ? setEditingExam(exams.records.find((exam) => exam.id === id))
    : setEditing(classes.find((cls) => cls.id === id)));
  // Touch screens get a details card first; with a mouse, a click goes straight to editing.
  const openItem = (id) => (window.matchMedia('(pointer: coarse)').matches ? setPreviewId(id) : editItem(id));

  const removeItem = (id) => {
    if (kindOf(id) === 'exam') { exams.removeExam(id); return; }
    const removed = classes.find((cls) => cls.id === id);
    if (!removed) return;
    removeClass(id);
    showSuccess(`Deleted ${removed.name} (${removed.day.slice(0, 3)}).`, { label: 'Undo', onClick: () => addClasses([removed]) });
  };

  const saveImage = useCallback(async () => {
    try {
      await saveElementAsImage(captureRef.current, `${slug}.png`);
    } catch {
      showError('The image could not be created.');
    }
  }, [slug]);

  const shareLink = async (key, payload, copiedMessage) => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#${key}=${await encodeShare(payload)}`;
      // Some chat apps cut long links short; a file has no limit and opens with "Open a backup".
      if (url.length > 8000) {
        downloadFile(`${slug}-${key === 'c' ? 'for-classmates' : 'planner'}.json`, JSON.stringify(payload), 'application/json');
        showSuccess('Too long for a link, so it was saved as a file. Send the file; it opens with Upload › Open a backup.');
        return;
      }
      const result = await shareOrCopy({ url, title: title || 'My timetable' });
      if (result === 'copied') showSuccess(copiedMessage);
    } catch {
      showError('The link could not be copied.');
    }
  };

  const exportCalendar = () => {
    const calendar = classesToIcs(classes, { title: title || 'Timetable' });
    const examCalendar = exams.mine.length ? examsToIcs(exams.mine) : '';
    const merged = examCalendar
      ? calendar.replace(/END:VCALENDAR\s*$/, examCalendar.slice(examCalendar.indexOf('BEGIN:VEVENT')))
      : calendar;
    downloadFile(`${slug}.ics`, merged, 'text/calendar');
  };

  const uploadItems = [
    { label: 'Class timetable', hint: 'Excel, CSV or PDF from your university', icon: <Upload size={15} />, onSelect: upload.timetable },
    { label: 'Exam date sheet', hint: 'PDF, Excel, Word or a photo', icon: <CalendarPlus size={15} />, onSelect: upload.exams },
    { label: 'Paste text', hint: 'A timetable or exam dates, typed or copied', icon: <ClipboardList size={15} />, onSelect: upload.paste },
    { separator: true },
    { label: 'Open a backup', hint: '.json saved from StudReads', icon: <FileJson size={15} />, onSelect: upload.backup }
  ];

  const exportItems = [
    { label: 'Save as image', hint: 'PNG, exactly as shown', icon: <Image size={15} />, onSelect: saveImage, disabled: nothing },
    { label: 'Print or PDF', hint: 'Choose “Save as PDF” to keep a file', icon: <Printer size={15} />, onSelect: () => window.print(), disabled: nothing },
    { label: 'Add to calendar', hint: 'With exam reminders, for any calendar app', icon: <CalendarPlus size={15} />, onSelect: exportCalendar, disabled: nothing },
    {
      label: 'Backup',
      hint: '.json you can open later',
      icon: <FileJson size={15} />,
      disabled: nothing,
      onSelect: () => downloadFile(`${slug}.json`, JSON.stringify(buildTimetableBackup({ classes, title, colorMap, theme: selectedTheme, display: displayOptions, exams: exams.mine }), null, 2), 'application/json')
    }
  ];

  const shareItems = [
    {
      label: 'My planner',
      hint: 'A copy of your classes and exams',
      icon: <Link2 size={15} />,
      disabled: nothing,
      onSelect: () => shareLink('t', buildTimetableShare({ classes, title, colorMap, theme: selectedTheme, exams: exams.mine }), 'Link copied. Whoever opens it gets their own copy to edit.')
    },
    {
      label: 'For classmates',
      hint: 'Your uploaded files, so each picks their own',
      icon: <Users size={15} />,
      disabled: !hasSource && !hasSheet,
      onSelect: () => shareLink('c', buildClassmateShare({ title, source: shareableSource(), exams: exams.records.filter((record) => !isAddedByHand(record)), examFile: exams.fileInfo?.name }), 'Link copied. Classmates who open it pick their own courses and exams.')
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
        <button type="button" className="bar-button" onClick={onNew} disabled={nothing}>
          <FilePlus2 size={16} /> <span>New</span>
        </button>
        <button type="button" className="bar-button" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={16} /> <span>Customise</span>
        </button>
      </header>

      <div className="schedule-body">
        <nav className="schedule-actions" aria-label="Planner actions">
          <PushButton className="push-quiet" onClick={() => setEditing({ day: 'Monday', startTime: '09:00', endTime: '10:00' })}><Plus size={16} /> Add</PushButton>
          <Menu triggerClassName="action" trigger={<><Upload size={16} /> {busy || 'Upload'} <ChevronDown size={14} className="action-chevron" /></>} items={uploadItems} />
          <Menu triggerClassName="action" trigger={<><Download size={16} /> Export <ChevronDown size={14} className="action-chevron" /></>} items={exportItems} />
          <Menu triggerClassName="action" trigger={<><Link2 size={16} /> Share <ChevronDown size={14} className="action-chevron" /></>} items={shareItems} />
        </nav>

        <section className="schedule-canvas" aria-label="Your planner">
          <div className="canvas-head">
            <p className="canvas-summary">
              {busy || summary}
              {busy && <> <button type="button" className="link-btn" onClick={onCancel}>Cancel</button></>}
              {!busy && nextExamNote && <span> · {nextExamNote}</span>}
              {clashCount > 0 && <span className="text-warn"> · {clashCount} {clashCount === 1 ? 'clash' : 'clashes'}</span>}
            </p>
            <div className="canvas-tools">
              {hasSource && <button type="button" className="chip-btn" onClick={coursePicker.open}><ListChecks size={14} /> Edit courses</button>}
              {hasSheet && <button type="button" className="chip-btn" onClick={examPicker.open}><Search size={14} /> Edit exams</button>}
              <Segmented
                label="Layout"
                value={view}
                onChange={(next) => setDisplayOptions((current) => ({ ...current, view: next }))}
                options={[{ value: 'grid', label: 'Week' }, { value: 'list', label: 'List' }]}
              />
            </div>
          </div>

          {busy && <ImportProgress message={busy} />}

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

          {previewCourses.length > 0 && (
            <div className="preview-bar" role="status">
              <span>Trying {previewCourses.join(', ')}. Dashed classes are not kept yet.</span>
              <button type="button" className="btn" onClick={discardPreviews}>Discard</button>
              <button type="button" className="btn btn-primary" onClick={keepPreviews}>Keep</button>
            </div>
          )}

          <div className="capture" ref={captureRef} data-print-target="timetable">
            <div className="capture-head">
              <a href={SITE.url} target="_blank" rel="noopener noreferrer">{title || 'My timetable'}</a>
            </div>
            {view === 'grid' || nothing ? (
              <TimeGrid
                columns={columns}
                items={items}
                timeFormat={displayOptions.timeFormat}
                rowHeight={displayOptions.rowHeight}
                blockStyle={displayOptions.blockStyle}
                onSelect={openItem}
                onAddAt={(column, minutes) => {
                  const date = dateFromColumn(column);
                  setEditing({ day: date ? weekdayOf(date) : column, date, startTime: minutesToInput(minutes), endTime: minutesToInput(Math.min(minutes + 60, 23 * 60 + 59)) });
                }}
              />
            ) : (
              <AgendaList groups={groupByColumn(columns, items)} onSelect={openItem} onRemove={removeItem} blockStyle={displayOptions.blockStyle} />
            )}
          </div>

          {!nothing && <p className="canvas-hint">Click an empty slot to add a class or exam, or click one to edit it.</p>}
        </section>
      </div>

      <ItemPreview item={items.find((item) => item.id === previewId)} onEdit={editItem} onRemove={removeItem} onClose={() => setPreviewId(null)} />
      <ClassDialog item={editing} exams={exams} onClose={() => setEditing(null)} />
      <ExamDialog exam={editingExam} onSave={(values) => exams.saveExam(values, editingExam)} onDelete={exams.removeExam} onClose={() => setEditingExam(null)} />
      {hasSource && <CoursePicker isOpen={coursePicker.isOpen} onClose={coursePicker.close} />}
      <ExamPicker isOpen={examPicker.isOpen} onClose={examPicker.close} exams={exams} courseNames={courseNames} original={examPicker.original} scans={examPicker.scans} onEditExam={setEditingExam} onAddExam={(subject) => { examPicker.close(); setEditingExam({ subject, date: '', start: null, end: null, room: '', code: '' }); }} />
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Editor;
