import { FileText, Github, Mail, Shield, Star } from 'lucide-react';

const Footer = ({ onOpenPrivacy, onOpenContact, onOpenReviews }) => {
  return (
    <footer className="app-footer" id="contact">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-badge">TT</span>
            <h3>Academic Timetable Generator</h3>
          </div>
          <p className="footer-tagline">
            Minimal, client-side weekly timetable parser & schedule generator for university students and faculty. Built by <a href="https://github.com/EshaalB" target="_blank" rel="noopener noreferrer" className="link-text">Eshaal B</a>.
          </p>
        </div>

        <div className="footer-links-group">
          <h4>Navigation & Pages</h4>
          <ul>
            <li>
              <button type="button" className="footer-link-btn" onClick={onOpenReviews}>
                <Star size={14} /> Reviews & Proof
              </button>
            </li>
            <li>
              <button type="button" className="footer-link-btn" onClick={onOpenPrivacy}>
                <Shield size={14} /> Privacy Policy
              </button>
            </li>
            <li>
              <button type="button" className="footer-link-btn" onClick={onOpenContact}>
                <Mail size={14} /> Contact & Support
              </button>
            </li>
            <li>
              <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="footer-link-a">
                <FileText size={14} /> /llms.txt
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-contact-group">
          <h4>Connect & Source</h4>
          <ul className="contact-list">
            <li>
              <Mail size={15} className="footer-icon" />
              <a href="mailto:support@timetablegen.org" className="footer-contact-link">
                support@timetablegen.org
              </a>
            </li>
            <li>
              <Github size={15} className="footer-icon" />
              <a href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer" className="footer-contact-link">
                GitHub: EshaalB
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Eshaal B — Academic Timetable Generator. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
