import { Mail, Send, X } from 'lucide-react';
import { useState } from 'react';
import { showSuccess } from '../utils/errorHandler';

const ContactModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    showSuccess('Thank you! Your message has been sent.');
    setFormData({ name: '', email: '', message: '' });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Mail className="icon-primary" size={22} />
            <h2>Contact & Support</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close Contact Modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="contact-quick-info">
            <div className="info-chip">
              <Mail size={16} />
              <span>Email: <a href="mailto:support@timetablegen.org" className="link-text">support@timetablegen.org</a></span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
              <label htmlFor="contact-name">Your Name</label>
              <input
                id="contact-name"
                type="text"
                required
                placeholder="Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact-email">Email Address</label>
              <input
                id="contact-email"
                type="email"
                required
                placeholder="jane@university.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact-message">Message or Feedback</label>
              <textarea
                id="contact-message"
                required
                rows={4}
                placeholder="Describe any issue, format request, or question..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="input-field textarea-field"
              />
            </div>
            <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Send size={16} /> Send Message
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
