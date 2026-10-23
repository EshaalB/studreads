import { X } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

const PrivacyModal = ({ isOpen, onClose }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={(e) => e.stopPropagation()}>
        <header className="dialog-header">
          <h2 id="privacy-title">Privacy</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="dialog-body prose">
          <p>Timetables, date sheets, photos and pasted text are read inside your browser. StudReads has no server and never uploads them.</p>
          <p>Reading a photo or scanned PDF downloads the text recognition engine (about 4 MB) from a public CDN the first time. Only the engine is downloaded; your image stays on your device.</p>
          <p>Your timetable, exam list, colours and settings are saved in this browser’s local storage so they are here when you come back. <strong>Start over</strong> removes them.</p>
          <p>Share links contain the classes or exams themselves, encoded in the link. Anyone you send a link to can read what it contains.</p>
          <p>Questions? Email <a href="mailto:eshaalrehamat@gmail.com">eshaalrehamat@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
