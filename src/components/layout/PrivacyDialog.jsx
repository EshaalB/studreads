import Dialog from '../ui/Dialog';

const PrivacyDialog = ({ isOpen, onClose }) => (
  <Dialog isOpen={isOpen} onClose={onClose} title="Privacy" width={520}>
    <div className="prose">
      <p>Timetables, date sheets, photos and pasted text are read inside your browser. StudReads has no server and never uploads them.</p>
      <p>Reading a photo or scanned PDF downloads the text recognition engine (about 4 MB) from a public CDN the first time. Only the engine is downloaded; your image stays on your device.</p>
      <p>Your timetable, exam list, colours and settings are saved in this browser so they are here when you come back. “New timetable” and “Start over” remove them.</p>
      <p>Share links contain the classes or exams themselves. Anyone you send a link to can read what it contains.</p>
      <p>Questions? Email <a href="mailto:eshaalrehamat@gmail.com">eshaalrehamat@gmail.com</a>.</p>
    </div>
  </Dialog>
);

export default PrivacyDialog;
