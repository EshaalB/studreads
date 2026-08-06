import { Shield, X } from 'lucide-react';

const PrivacyModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Shield className="icon-primary" size={22} />
            <h2>Privacy Policy</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close Privacy Policy">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="badge-pill">Compliance Notice: Australian Privacy Act 1988 & Global Privacy Standards</p>
          
          <h3>1. What Personal Information We Collect</h3>
          <p>
            The Academic Timetable Generator operates strictly with a <strong>privacy-first, client-side model</strong>. 
            When you use the app, optional input fields (such as your name for custom timetable export titles or email addresses provided in support enquiries) are handled locally in your browser memory.
          </p>

          <h3>2. How Your Spreadsheets & Timetables Are Processed</h3>
          <p>
            When you upload an Excel spreadsheet (<code>.xlsx</code> or <code>.xls</code>), your files are parsed directly inside your web browser. 
            <strong>No timetable data, file contents, or course selections are ever uploaded to an external server or database.</strong>
          </p>

          <h3>3. Local Storage Usage</h3>
          <p>
            We use your browser's local storage (<code>localStorage</code>) strictly to save your active section selections, display preferences, and custom theme colors so your timetable remains saved when you return. You can clear this data at any time using the "Reset Workspace" option.
          </p>

          <h3>4. How We Use Information</h3>
          <p>
            Any information you optionally input (such as your name on a generated schedule) is used solely to render your customized timetable export image or shareable URL hash.
          </p>

          <h3>5. How to Contact Us</h3>
          <p>
            If you have questions regarding this Privacy Policy, your privacy rights, or data handling, please contact our support team at:
            <br />
            <strong>Email:</strong> <a href="mailto:support@timetablegen.org" className="link-text">support@timetablegen.org</a>
            <br />
            <strong>Phone:</strong> <a href="tel:+61400000000" className="link-text">+61 (04) 0000 0000</a>
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
