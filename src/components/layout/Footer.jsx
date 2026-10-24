import { SITE } from '../../content/site';

const Footer = ({ onOpenAbout }) => (
  <footer className="app-footer">
    <p>
      Built by <a href="https://github.com/EshaalB" target="_blank" rel="noopener noreferrer">Eshaal</a>. Files are read in your browser and never uploaded.
    </p>
    <nav aria-label="Footer">
      <button type="button" className="link-btn" onClick={onOpenAbout}>About</button>
      <a href="/privacy.html">Privacy</a>
      <a href={SITE.repo} target="_blank" rel="noopener noreferrer">Source</a>
      <a href={`mailto:${SITE.email}`}>Contact</a>
    </nav>
  </footer>
);

export default Footer;
