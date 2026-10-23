import { X } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

const AboutModal = ({ isOpen, onClose }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <article ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
        <header className="dialog-header">
          <h2 id="about-title">About StudReads</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="dialog-body prose">
          <p>
            I built this after dealing with university timetable workbooks that were useful for administration but hard for one student to read. Finding one section meant searching a huge sheet and rebuilding the week by hand.
          </p>
          <p>
            StudReads checks every worksheet in the file, finds the most likely timetable, and turns its rows or grid cells into classes. You choose your section and courses and the week builds beside them.
          </p>
          <p>
            The exam finder came from the same problem. Date sheets arrive as PDFs, spreadsheets, Word files and photos of notice boards. It reads all of them, tries table, grid and plain-text layouts, and keeps whichever finds the most exams.
          </p>

          <h3>Worth knowing</h3>
          <ul>
            <li>Shared links open as an editable copy for the person you send them to.</li>
            <li>Exports include an image, a print-ready page, a calendar file, a spreadsheet and a backup you can restore.</li>
            <li>Photos and scans are read with text recognition, so check names and times against the original.</li>
          </ul>
        </div>

        <footer className="dialog-footer">
          <a href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer" className="btn">Source code</a>
          <a href="mailto:eshaalrehamat@gmail.com" className="btn btn-primary">Email me</a>
        </footer>
      </article>
    </div>
  );
};

export default AboutModal;
