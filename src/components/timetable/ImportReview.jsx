import Dialog from '../ui/Dialog';

const REVIEW_FIELDS = [
  ['courseName', 'Course', true], ['section', 'Section'], ['day', 'Day', true], ['startTime', 'Starts', true],
  ['endTime', 'Ends'], ['instructor', 'Teacher'], ['room', 'Room']
];

// Shown after uploading a column-based sheet, so the detected columns can be corrected
// before courses are chosen. Grid-style timetables skip it.
const ImportReview = ({ pendingImport, error, onConfirm, onCancel, onUpdateMapping }) => {
  const { rows = [], mapping = {}, rowCount, sheetName, name, warnings = [] } = pendingImport || {};
  const columns = Object.keys(rows[0] || {});

  return (
    <Dialog
      isOpen={Boolean(pendingImport)}
      onClose={onCancel}
      title="Check the columns"
      width={640}
      footer={<>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>Continue</button>
      </>}
    >
      <div className="form">
        <p className="muted">{rowCount} entries found on “{sheetName}” in {name}. Make sure each detail points at the right column.</p>
        <div className="mapping-grid">
          {REVIEW_FIELDS.map(([field, label, required]) => (
            <label className="field" key={field}>
              <span className="field-label">{label}{required && <span className="required" aria-hidden="true"> *</span>}</span>
              <select className="input" value={mapping[field] || ''} onChange={(event) => onUpdateMapping(field, event.target.value)} required={required}>
                <option value="">Not in file</option>
                {columns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="table-wrap">
          <table className="preview-table">
            <thead>
              <tr><th>Course</th><th>Day</th><th>Time</th><th>Room</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 4).map((row, index) => (
                <tr key={`${sheetName}-${index}`}>
                  <td>{row[mapping.courseName] || <span className="muted">Not found</span>}</td>
                  <td>{row[mapping.day] || '—'}</td>
                  <td>{[row[mapping.startTime], mapping.endTime !== mapping.startTime ? row[mapping.endTime] : ''].filter(Boolean).join(' – ') || '—'}</td>
                  <td>{row[mapping.room] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
};

export default ImportReview;
