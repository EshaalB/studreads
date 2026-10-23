const Footer = ({ onOpenPrivacy, onOpenAbout }) => (
  <footer className="app-footer">
    <p>
      Built by <a href="https://github.com/EshaalB" target="_blank" rel="noopener noreferrer">Eshaal</a>. Files are read in your browser and never uploaded.
    </p>
    <nav aria-label="Footer">
      <button type="button" className="link-btn" onClick={onOpenAbout}>About</button>
      <button type="button" className="link-btn" onClick={onOpenPrivacy}>Privacy</button>
      <a href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer">Source</a>
      <a href="mailto:eshaalrehamat@gmail.com">Contact</a>
    </nav>
  </footer>
);

export default Footer;
