import { X } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

const AboutModal = ({ isOpen, onClose }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title">
            <h2 id="about-title">Why I built StudReads</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close project notes">
            <X size={20} />
          </button>
        </header>

        <div className="modal-body about-story">
          <p>
            I built this after dealing with university timetable workbooks that were useful for administration but difficult for one student to read. Finding one section meant searching across a large sheet and rebuilding the week by hand.
          </p>
          <p>
            StudReads checks the worksheets in an Excel file, finds the most likely timetable, and turns its rows or grid cells into course entries. You can then choose your own classes and see the week update beside them.
          </p>

          <h3>What I worked on</h3>
          <ul className="about-list">
            <li>Handling both column-based and grid-style timetable sheets</li>
            <li>Finding course, section, day, room and time information</li>
            <li>Detecting clashes and joining multi-period classes</li>
            <li>Making the result useful on a phone as well as a laptop</li>
          </ul>

          <p className="about-limit">
            University files vary a lot, so the importer supports common timetable structures rather than every possible Excel layout.
          </p>

          <div className="about-links">
            <a href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer" className="btn btn-primary">View the source code</a>
            <a href="mailto:eshaalrehamat@gmail.com" className="btn btn-secondary">Email me</a>
          </div>
        </div>
      </article>
    </div>
  );
};

export default AboutModal;
