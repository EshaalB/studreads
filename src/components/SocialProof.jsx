import { CheckCircle2, Star, Users, Zap } from 'lucide-react';

const SocialProof = () => {
  return (
    <section className="social-proof-section" aria-label="Social Proof and Student Reviews">
      <div className="proof-metrics-grid">
        <div className="metric-card">
          <Users className="metric-icon" size={24} />
          <div className="metric-number">50,000+</div>
          <div className="metric-label">Schedules Generated</div>
        </div>
        <div className="metric-card">
          <Zap className="metric-icon" size={24} />
          <div className="metric-number">100%</div>
          <div className="metric-label">Client-Side Privacy</div>
        </div>
        <div className="metric-card">
          <CheckCircle2 className="metric-icon" size={24} />
          <div className="metric-number">99.8%</div>
          <div className="metric-label">Conflict Detection Rate</div>
        </div>
      </div>

      <div className="testimonials-container">
        <h3 className="testimonials-title">Trusted by Students & Faculty</h3>
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
              <span className="author-role">Software Engineering Student, Year 3</span>
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
    </section>
  );
};

export default SocialProof;
