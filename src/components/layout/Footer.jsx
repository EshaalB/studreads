import { SITE } from '../../content/site';

// About and the source code are in the header, so the footer keeps only what is not.
const Footer = () => (
  <footer className="app-footer">
    <p>
      Built by <a href="https://github.com/EshaalB" target="_blank" rel="noopener noreferrer">Eshaal</a>.
    </p>
    <nav aria-label="Footer">
      <a href="/privacy.html">Privacy</a>
      <a href={`mailto:${SITE.email}`}>Contact</a>
    </nav>
  </footer>
);

export default Footer;
