import { X } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

const PrivacyModal = ({ isOpen, onClose }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h2 id="privacy-title">What happens to your file?</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close Privacy Policy">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            Your timetable or exam file is read inside your browser. StudReads does not upload the file or its schedule data to a server.
          </p>
          <p>
            Your selected courses, display settings and colours are saved in this browser using local storage so they can still be here when you return.
          </p>
          <p>
            Choosing <strong>Start over</strong> clears the timetable information saved by this app. Shared links contain the classes needed to show that shared timetable.
          </p>
          <p>
            Questions? Email <a href="mailto:eshaalrehamat@gmail.com" className="link-text">eshaalrehamat@gmail.com</a>.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
