import { useState } from 'react';

// File drop area with a browse button. While `busy`, it shows progress text instead.
const Dropzone = ({ title, hint, busy, busyText, onFile, onBrowse }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setIsDragging(false); onFile(event.dataTransfer.files?.[0]); }}
    >
      {busy ? (
        <div className="dropzone-body" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p className="dropzone-title">{busyText}</p>
        </div>
      ) : (
        <div className="dropzone-body">
          <p className="dropzone-title">{title}</p>
          <p className="dropzone-hint">{hint}</p>
          <button type="button" className="btn btn-primary" onClick={onBrowse}>Choose file</button>
        </div>
      )}
    </div>
  );
};

export default Dropzone;
