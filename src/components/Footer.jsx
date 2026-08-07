const Footer = ({ onOpenPrivacy }) => {
  return (
    <footer className="app-footer" id="contact">
      <p className="footer-note">
        Built by <a href="https://github.com/EshaalB" target="_blank" rel="noopener noreferrer">Eshaal</a> after getting tired of rebuilding university timetables by hand.
      </p>
      <div className="footer-simple-links">
        <a href="https://github.com/EshaalB/University-timetable-gen" target="_blank" rel="noopener noreferrer">Source code</a>
        <button type="button" onClick={onOpenPrivacy}>Privacy</button>
        <a href="mailto:eshaalrehamat@gmail.com">Email</a>
      </div>
    </footer>
  );
};

export default Footer;
