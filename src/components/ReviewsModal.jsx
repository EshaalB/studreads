import { Star, Users, X, Zap } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

const ReviewsModal = ({ isOpen, onClose }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="reviews-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Star className="icon-primary" size={22} fill="currentColor" />
            <h2 id="reviews-title">About this project</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close Reviews Modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="proof-metrics-grid proof-metrics-spaced">
            <div className="metric-card">
              <Users className="metric-icon" size={22} />
              <div className="metric-number">2 views</div>
              <div className="metric-label">Agenda and weekly grid</div>
            </div>
            <div className="metric-card">
              <Zap className="metric-icon" size={22} />
              <div className="metric-number">Local</div>
              <div className="metric-label">Spreadsheet processing</div>
            </div>
          </div>

          <p className="project-about-copy">
            StudReads turns common university timetable spreadsheets into a focused weekly schedule. Files stay in the browser, clashes are highlighted, and the finished timetable can be exported as an image.
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

export default ReviewsModal;
