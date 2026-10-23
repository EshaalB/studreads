import { CalendarPlus, ChevronDown, Download, FileJson, FileSpreadsheet, Image, Link2, Printer, SlidersHorizontal } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { DAY_ORDER } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/errorHandler';
import { classesToCsv, classesToIcs, downloadFile, fileSlug } from '../../utils/exportUtils';
import { encodeShare, shareOrCopy } from '../../utils/sharingUtils';
import { getThemeColors } from '../../utils/themes';
import { parseTime } from '../../utils/timeUtils';
import { buildTimetableBackup, buildTimetableShare } from '../../utils/transfer';
import Menu from '../ui/Menu';
import Segmented from '../ui/Segmented';
import CustomizePanel from './CustomizePanel';
import MobileAgenda from './MobileAgenda';
import TimetableGrid from './TimetableGrid';
import TimetableTable from './TimetableTable';

const EditableTimetable = () => {
  const {
    finalActiveClasses, getOrAssignColor, displayOptions, setDisplayOptions, updateClassField,
    conflicts, colorMap, setColorMap, selectedTheme, isManual
  } = useTimetable();
  const exportRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const view = displayOptions.view === 'grid' ? 'grid' : 'list';
  const title = displayOptions.title.trim() || 'My timetable';
  const slug = fileSlug(displayOptions.title, 'timetable');

  const sortedClasses = useMemo(() => [...finalActiveClasses].sort((a, b) =>
    (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99) || (parseTime(a.startTime) || 0) - (parseTime(b.startTime) || 0)
  ), [finalActiveClasses]);

  const courseCount = useMemo(() => new Set(sortedClasses.map((cls) => cls.name)).size, [sortedClasses]);
  const clashCount = useMemo(() => Math.ceil(sortedClasses.filter((cls) => conflicts.has(cls.id)).length / 2), [sortedClasses, conflicts]);

  const saveEdit = useCallback((editKey, field, value) => {
    if (field === 'time') {
      const [start, end] = value.split(/\s*(?:-|–|to)\s*/i).map((part) => part.trim());
      if (parseTime(start) === null || parseTime(end) === null) {
        showError('Use a time range such as 9:00 AM - 10:30 AM.');
        return;
      }
      updateClassField(editKey, 'startTime', start);
      updateClassField(editKey, 'endTime', end);
    } else if (field !== 'name' || value.trim()) {
      updateClassField(editKey, field, value);
    }
  }, [updateClassField]);

  const exportImage = useCallback(async () => {
    if (!exportRef.current) return;
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
      canvas.toBlob((blob) => {
        if (blob) downloadFile(`${slug}.png`, blob);
        else showError('The image could not be created.');
      }, 'image/png');
    } catch {
      showError('The image could not be created.');
    } finally {
      setIsExporting(false);
    }
  }, [slug]);

  const share = useCallback(async () => {
    try {
      const code = await encodeShare(buildTimetableShare({ classes: sortedClasses, title: displayOptions.title.trim(), colorMap, theme: selectedTheme }));
      const url = `${window.location.origin}${window.location.pathname}?t=${code}`;
      const result = await shareOrCopy({ url, title });
      if (result === 'copied') showSuccess('Link copied. Anyone with it can open and edit their own copy.');
    } catch {
      showError('The link could not be copied.');
    }
  }, [sortedClasses, displayOptions.title, colorMap, selectedTheme, title]);

  const exportItems = [
    { label: 'Image', hint: 'PNG of the week view', icon: <Image size={15} />, onSelect: exportImage, disabled: isExporting },
    { label: 'Print or PDF', hint: 'Use “Save as PDF” in the print dialog', icon: <Printer size={15} />, onSelect: () => window.print() },
    { label: 'Calendar', hint: '.ics, repeats weekly for 16 weeks', icon: <CalendarPlus size={15} />, onSelect: () => downloadFile(`${slug}.ics`, classesToIcs(sortedClasses, { title }), 'text/calendar') },
    { label: 'Spreadsheet', hint: '.csv for Excel or Sheets', icon: <FileSpreadsheet size={15} />, onSelect: () => downloadFile(`${slug}.csv`, classesToCsv(sortedClasses), 'text/csv') },
    { separator: true },
    {
      label: 'Backup',
      hint: '.json you can restore later',
      icon: <FileJson size={15} />,
      onSelect: () => downloadFile(`${slug}.json`, JSON.stringify(buildTimetableBackup({ classes: sortedClasses, title: displayOptions.title.trim(), colorMap, theme: selectedTheme, display: displayOptions }), null, 2), 'application/json')
    }
  ];

  if (sortedClasses.length === 0) return null;

  const shared = { getOrAssignColor, displayOptions, conflicts };
  const colouring = { palette: getThemeColors(selectedTheme), onColorChange: (name, color) => setColorMap((current) => ({ ...current, [name]: color })) };

  return (
    <div className="timetable">
      <div className="toolbar">
        <div className="toolbar-title">
          <h2>{title}</h2>
          <p>
            {courseCount} {courseCount === 1 ? 'course' : 'courses'} · {sortedClasses.length} {sortedClasses.length === 1 ? 'class' : 'classes'} a week
            {clashCount > 0 && <span className="text-warn"> · {clashCount} {clashCount === 1 ? 'clash' : 'clashes'}</span>}
          </p>
        </div>
        <div className="toolbar-actions">
          <Segmented
            label="Layout"
            value={view}
            onChange={(next) => setDisplayOptions((current) => ({ ...current, view: next }))}
            options={[{ value: 'list', label: 'List' }, { value: 'grid', label: 'Week' }]}
          />
          <button type="button" className="btn" onClick={() => setIsCustomizeOpen(true)}>
            <SlidersHorizontal size={15} /> <span className="hide-narrow">Customize</span>
          </button>
          <button type="button" className="btn" onClick={share}>
            <Link2 size={15} /> Share
          </button>
          <Menu
            triggerClassName="btn btn-primary"
            trigger={<><Download size={15} /> {isExporting ? 'Saving' : 'Export'} <ChevronDown size={14} /></>}
            items={exportItems}
          />
        </div>
      </div>

      {view === 'list' ? (
        <>
          <MobileAgenda classes={sortedClasses} {...shared} {...colouring} />
          <TimetableTable
            classes={sortedClasses}
            {...shared}
            {...colouring}
            editable={!isManual}
            editingCell={editingCell}
            setEditingCell={setEditingCell}
            onSave={saveEdit}
          />
        </>
      ) : (
        <TimetableGrid classes={sortedClasses} {...shared} />
      )}

      {!isManual && view === 'list' && <p className="hint hide-narrow">Click a time, course, teacher or room to correct it.</p>}

      {/* Rendered off-screen for image export and shown on its own when printing. */}
      <div className="export-sheet" ref={exportRef} aria-hidden="true">
        <div className="export-head">
          <strong>{title}</strong>
          <span>{courseCount} courses · {sortedClasses.length} classes a week</span>
        </div>
        <TimetableGrid classes={sortedClasses} {...shared} />
      </div>

      <CustomizePanel isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} />
    </div>
  );
};

export default EditableTimetable;
