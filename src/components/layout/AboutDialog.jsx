import { SITE } from '../../content/site';
import Dialog from '../ui/Dialog';

const AboutDialog = ({ isOpen, onClose }) => (
  <Dialog
    isOpen={isOpen}
    onClose={onClose}
    title="About StudReads"
    width={520}
    footer={<>
      <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className="btn">Source code</a>
      <a href={`mailto:${SITE.email}`} className="btn btn-primary">Email me</a>
    </>}
  >
    <div className="prose">
      <p>I built this after dealing with university timetable workbooks that were useful for administration but hard for one student to read. Finding one section meant searching a huge sheet and rebuilding the week by hand.</p>
      <p>StudReads reads the timetable file, lets you tick your courses, and draws your week. You can also build a timetable class by class, like on a paper planner.</p>
      <p>The exam finder reads date sheets from PDFs, spreadsheets, Word files and photos of notice boards, so you can keep a list of only your own exams.</p>
      <h3>Worth knowing</h3>
      <ul>
        <li>Shared links open as an editable copy for the person you send them to.</li>
        <li>Photos and scans are read with text recognition, so check names and times against the original.</li>
      </ul>
    </div>
  </Dialog>
);

export default AboutDialog;
