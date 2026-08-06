import { Star, Users, X, Zap } from 'lucide-react';

const ReviewsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <Star className="icon-primary" size={22} fill="currentColor" />
            <h2>Student Reviews & Social Proof</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close Reviews Modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="proof-metrics-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="metric-card">
              <Users className="metric-icon" size={22} />
              <div className="metric-number">50,000+</div>
              <div className="metric-label">Schedules Generated</div>
            </div>
            <div className="metric-card">
              <Zap className="metric-icon" size={22} />
              <div className="metric-number">100%</div>
              <div className="metric-label">Client-Side Privacy</div>
            </div>
          </div>

          <div className="testimonials-grid">
            <blockquote className="testimonial-card">
              <div className="rating-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="star-filled" fill="currentColor" />
                ))}
              </div>
              <p className="testimonial-text">
                &ldquo;This tool completely eliminated enrollment day headache for our cohort. Uploaded the Excel file, picked my section, and had my clash-free timetable exported in under 30 seconds.&rdquo;
              </p>
              <footer className="testimonial-author">
                <span className="author-name">Alex Chen</span>
                <span className="author-role">Software Engineering Student</span>
              </footer>
            </blockquote>

            <blockquote className="testimonial-card">
              <div className="rating-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="star-filled" fill="currentColor" />
                ))}
              </div>
              <p className="testimonial-text">
                &ldquo;The custom color palette and section clash indicators are brilliant. It automatically merged multi-period labs seamlessly. Essential tool for university registration!&rdquo;
              </p>
              <footer className="testimonial-author">
                <span className="author-name">Sarah Jenkins</span>
                <span className="author-role">Business Administration Student</span>
              </footer>
            </blockquote>
          </div>
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
