import { FileSpreadsheet, Play, RefreshCcw, Upload } from 'lucide-react';
import { DEMO_TIMETABLE_DATA } from '../../utils/demoData';

const FileUpload = ({ rawData, isLoading, error, fileInputRef, handleFileUpload, resetUpload, processData }) => {
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
      
      {rawData.length === 0 ? (
        <div className="upload-container">
          <div
            className="upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
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
                <h3>Processing Timetable File...</h3>
                <p>Analyzing sheets, time headers, and course sections</p>
              </div>
            ) : (
              <div className="upload-text">
                <h3>Upload Your University Timetable</h3>
                <p className="upload-subtitle">Drag & drop your Excel file here, or click to browse</p>
                <div className="upload-meta-chips">
                  <span className="meta-chip"><FileSpreadsheet size={14} /> .XLSX / .XLS</span>
                  <span className="meta-chip">Max 10MB</span>
                  <span className="meta-chip">100% Private Client-Side</span>
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
              <Upload size={18} /> Upload Timetable Excel
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg cta-btn"
              onClick={handleLoadDemo}
            >
              <Play size={18} /> Try Sample Timetable
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}
        </div>
      ) : (
        <div className="active-file-bar">
          <div className="active-file-info">
            <FileSpreadsheet size={20} className="icon-success" />
            <div>
              <span className="file-status-title">Timetable Data Active</span>
              <span className="file-status-sub">{rawData.length} schedule slots indexed</span>
            </div>
          </div>
          
          <div className="file-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> Change File
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleLoadDemo}
            >
              <Play size={14} /> Reload Sample
            </button>
            <button
              type="button"
              className="btn btn-danger-outline btn-sm"
              onClick={resetUpload}
            >
              <RefreshCcw size={14} /> Reset
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default FileUpload;
