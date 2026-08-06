import { Building2, FileText, Mail, Phone, Shield } from 'lucide-react';

const Footer = ({ onOpenPrivacy, onOpenContact }) => {
  return (
    <footer className="app-footer" id="contact">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-badge">TT</span>
            <h3>Academic Timetable Generator</h3>
          </div>
          <p className="footer-tagline">
            Minimal, client-side weekly timetable parser & schedule generator for university students and educators.
          </p>
          <div className="footer-location">
            <Building2 size={16} />
            <span>Sydney / Melbourne Campus, Australia</span>
          </div>
        </div>

        <div className="footer-links-group">
          <h4>Navigation & Privacy</h4>
          <ul>
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
            <li>
              <a href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer" className="footer-link-a">
                GitHub Repository
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-contact-group">
          <h4>Direct Contact</h4>
          <ul className="contact-list">
            <li>
              <Mail size={15} className="footer-icon" />
              <a href="mailto:support@timetablegen.org" className="footer-contact-link">
                support@timetablegen.org
              </a>
            </li>
            <li>
              <Phone size={15} className="footer-icon" />
              <a href="tel:+61400000000" className="footer-contact-link">
                +61 (04) 0000 0000
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Academic Timetable Generator. All rights reserved.</p>
        <p className="privacy-act-note">Compliant with the Australian Privacy Act 1988.</p>
      </div>
    </footer>
  );
};

export default Footer;
