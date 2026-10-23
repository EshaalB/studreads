import { ChevronRight, Upload } from 'lucide-react';
import { useState } from 'react';

const FileUpload = ({ isLoading, error, onFile, onBrowse, onSample, onManual }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    onFile(event.dataTransfer.files?.[0]);
  };

  return (
    <section className="start" aria-labelledby="start-title">
      <header className="page-head">
        <h1 id="start-title">Build your weekly timetable</h1>
        <p>Upload the timetable your university shared, pick your section and courses, then export or share the result.</p>
      </header>

      <div
        className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="dropzone-body" role="status">
            <span className="spinner" aria-hidden="true" />
            <p className="dropzone-title">Reading the timetable</p>
            <p className="dropzone-hint">Checking each sheet for sections, days and times.</p>
          </div>
        ) : (
          <div className="dropzone-body">
            <Upload size={20} aria-hidden="true" />
            <p className="dropzone-title">Drop a timetable file here</p>
            <p className="dropzone-hint">Excel, OpenDocument or CSV up to 10 MB. Read on this device, never uploaded.</p>
            <button type="button" className="btn btn-primary" onClick={onBrowse}>Choose file</button>
          </div>
        )}
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <div className="option-list" aria-label="Other ways to start">
        <button type="button" className="option-row" onClick={onManual}>
          <span><strong>Enter classes by hand</strong><small>For when there is no file to upload</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="option-row" onClick={onSample}>
          <span><strong>Open a sample timetable</strong><small>See how it works before using your own file</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="option-row" onClick={onBrowse}>
          <span><strong>Restore a backup</strong><small>Open a .json file exported from StudReads</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default FileUpload;
