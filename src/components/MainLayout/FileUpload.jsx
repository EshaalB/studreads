import { FileSpreadsheet, PencilLine, Play, RefreshCcw, Upload } from 'lucide-react';
import { useState } from 'react';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';

const REVIEW_FIELDS = [
  ['courseName', 'Course'], ['section', 'Section'], ['day', 'Day'], ['startTime', 'Starts'],
  ['endTime', 'Ends'], ['instructor', 'Teacher'], ['room', 'Room']
];

const FileUpload = ({ rawData, isLoading, error, fileSummary, setFileSummary, fileInputRef, handleFileUpload, resetUpload, processData, onStartManual, pendingImport, onConfirmImport, onCancelImport, onUpdateMapping }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      handleFileUpload({ target: { files: event.dataTransfer.files } });
    }
  };
  const handleLoadDemo = () => {
    processData(DEMO_TIMETABLE_DATA, {
      courseName: 'courseName',
      section: 'section',
      day: 'day',
      startTime: 'startTime',
      endTime: 'endTime',
      instructor: 'instructor',
      room: 'room',
      credits: 'credits'
    });
    setFileSummary({ name: 'Sample timetable', sheetName: 'Demo data', rowCount: DEMO_TIMETABLE_DATA.length, warnings: [] });
  };

  return (
    <section className="file-upload-section" id="upload">
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls"
        aria-label="Upload timetable file"
      />
      
      {pendingImport ? (
        <div className="import-review" aria-labelledby="import-review-title">
          <div className="import-review-heading">
            <div>
              <span className="manual-eyebrow">Check before importing</span>
              <h2 id="import-review-title">Does this look like your timetable?</h2>
              <p>{pendingImport.rowCount} entries found on “{pendingImport.sheetName}”.</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={onCancelImport}>Choose another file</button>
          </div>

          {pendingImport.kind === 'table' && (
            <div className="mapping-fields">
              {REVIEW_FIELDS.map(([field, label]) => (
                <label key={field}>
                  <span>{label}{['courseName', 'day', 'startTime'].includes(field) ? ' *' : ''}</span>
                  <select value={pendingImport.mapping[field] || ''} onChange={(event) => onUpdateMapping(field, event.target.value)}>
                    <option value="">Not included</option>
                    {Object.keys(pendingImport.rows[0] || {}).map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          <div className="import-preview-list">
            {pendingImport.rows.slice(0, 4).map((row, index) => (
              <div className="import-preview-row" key={`${pendingImport.sheetName}-${index}`}>
                <strong>{row[pendingImport.mapping.courseName] || 'Course not detected'}</strong>
                <span>{[
                  row[pendingImport.mapping.day],
                  row[pendingImport.mapping.startTime],
                  row[pendingImport.mapping.endTime],
                  row[pendingImport.mapping.room]
                ].filter(Boolean).join(' · ') || 'Schedule details not detected'}</span>
              </div>
            ))}
          </div>
          {pendingImport.warnings.map((warning) => <p className="import-note" key={warning}>{warning}</p>)}
          {error && <div className="error-banner" role="alert">{error}</div>}
          <div className="import-review-actions">
            <button type="button" className="btn btn-primary" onClick={onConfirmImport}>Use this timetable</button>
            <span>You can edit individual details afterwards.</span>
          </div>
        </div>
      ) : rawData.length === 0 ? (
        <div className="upload-container">
          <div
            className={`upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
            }}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <div className="upload-icon-wrapper">
              <Upload size={36} className="upload-icon" />
            </div>
            
            {isLoading ? (
              <div className="upload-loading">
                <div className="spinner"></div>
                <h3>Reading your timetable…</h3>
                <p>Finding the right sheet, sections, and class times</p>
              </div>
            ) : (
              <div className="upload-text">
                <h3>Drop your Excel timetable here</h3>
                <p className="upload-subtitle">or click to choose a file</p>
                <div className="upload-meta-chips">
                  <span className="meta-chip"><FileSpreadsheet size={14} /> XLSX or XLS</span>
                  <span className="meta-chip">Up to 10 MB</span>
                  <span className="meta-chip">Your file stays on this device</span>
                </div>
              </div>
            )}
          </div>

          <div className="cta-action-bar">
            <button
              type="button"
              className="btn btn-primary btn-lg cta-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} /> Choose Excel file
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg cta-btn"
              onClick={handleLoadDemo}
            >
              <Play size={18} /> Show me an example
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg cta-btn"
              onClick={onStartManual}
            >
              <PencilLine size={18} /> Build it manually
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}
        </div>
      ) : (
        <div className="active-file-bar">
          <div className="active-file-info">
            <FileSpreadsheet size={20} className="icon-success" />
            <div>
              <span className="file-status-title">{fileSummary?.name || 'Timetable data ready'}</span>
              <span className="file-status-sub">
                {fileSummary ? `${fileSummary.sheetName} · ${fileSummary.rowCount} entries found` : `${rawData.length} schedule entries`}
              </span>
            </div>
          </div>
          
          <div className="file-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> Change file
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleLoadDemo}
            >
              <Play size={14} /> Use example
            </button>
            <button
              type="button"
              className="btn btn-danger-outline btn-sm"
              onClick={resetUpload}
            >
              <RefreshCcw size={14} /> Start over
            </button>
          </div>
          {fileSummary?.warnings?.length > 0 && (
            <div className="import-notes" role="status">
              {fileSummary.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default FileUpload;
