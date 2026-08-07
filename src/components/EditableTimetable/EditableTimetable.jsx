import { ChevronDown, ChevronUp, Download, Grid3X3, List, Palette } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { DAY_ORDER } from '../../utils/constants';
import { showError } from '../../utils/errorHandler';
import { parseTime } from '../../utils/timeUtils';
import ColorCustomization from '../ColorCustomization';
import TimetableGrid from './TimetableGrid';
import TimetableTable from './TimetableTable';
import MobileAgenda from './MobileAgenda';

const EditableTimetable = () => {
  const { finalActiveClasses, getOrAssignColor, displayOptions, updateClassField } = useTimetable();
  const tableRef = useRef();
  const [isExporting, setIsExporting] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  const sortedClasses = useMemo(() => {
    return [...finalActiveClasses].sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      if (dayDiff !== 0) return dayDiff;
      return (parseTime(a.startTime) || 0) - (parseTime(b.startTime) || 0);
    });
  }, [finalActiveClasses]);

  const getContrastYIQ = useCallback((hex) => {
    if (!hex || typeof hex !== 'string') return 'black';
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return 'black';
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
  }, []);

  const startEdit = useCallback((classKey, field, currentValue) => {
    setEditingCell(`${classKey}-${field}`);
    setEditValue(currentValue || '');
  }, []);

  const saveEdit = useCallback((classKey, field) => {
    if (field === 'time') {
      const parts = editValue.split('-').map(s => s.trim());
      if (parts.length >= 2) { updateClassField(classKey, 'startTime', parts[0]); updateClassField(classKey, 'endTime', parts[1]); }
    } else { updateClassField(classKey, field, editValue); }
    setEditingCell(null); setEditValue('');
  }, [editValue, updateClassField]);

  const cancelEdit = useCallback(() => { setEditingCell(null); setEditValue(''); }, []);

  const exportAsPng = useCallback(async () => {
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const content = clonedDoc.querySelector('.timetable-wrapper') || clonedDoc.querySelector('.timetable-grid-wrapper');
          if (content) {
            content.style.overflow = 'visible';
            content.style.width = 'fit-content';
            content.style.height = 'auto';
            content.style.padding = '20px';
          }
        },
        windowWidth: 1200
      });
      const link = document.createElement('a');
      link.download = `timetable-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { showError('Failed to export timetable.'); } finally { setIsExporting(false); }
  }, []);

  if (sortedClasses.length === 0) return null;

  return (
    <div className="timetable-preview-section">
      <div className="preview-header">
        <h2>Your Timetable</h2>
        <div className="preview-actions">
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              title="Grid view"
            >
              <Grid3X3 size={16} />
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={exportAsPng} disabled={isExporting}>
            <Download size={16} /> {isExporting ? 'Exporting...' : 'Export PNG'}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="accordion-trigger"
        onClick={() => setIsColorPaletteOpen(!isColorPaletteOpen)}
        aria-expanded={isColorPaletteOpen}
        aria-controls="colour-palette-panel"
      >
        <div className="accordion-label"><Palette size={16} /><span>Colour Palette</span></div>
        {isColorPaletteOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isColorPaletteOpen && <div className="accordion-content" id="colour-palette-panel"><ColorCustomization /></div>}

      {viewMode === 'list' ? (
        <>
          <MobileAgenda classes={sortedClasses} getOrAssignColor={getOrAssignColor} />
          <TimetableTable
            tableRef={tableRef} sortedClasses={sortedClasses} getOrAssignColor={getOrAssignColor} getContrastYIQ={getContrastYIQ}
            displayOptions={displayOptions} editingCell={editingCell} editValue={editValue} setEditValue={setEditValue} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit}
          />
        </>
      ) : (
        <div ref={tableRef}>
          <TimetableGrid
            sortedClasses={sortedClasses} getOrAssignColor={getOrAssignColor} getContrastYIQ={getContrastYIQ}
            displayOptions={displayOptions}
          />
        </div>
      )}
    </div>
  );
};

export default EditableTimetable;
