import Dropzone from '../ui/Dropzone';
import ResumeCard from '../ui/ResumeCard';

const StartScreen = ({ isLoading, error, resume, onFile, onBrowse, onSample, onScratch }) => (
  <section className="screen start" aria-labelledby="start-title">
    <header className="start-head">
      <h1 id="start-title">Make your timetable</h1>
      <p>Upload the timetable your university shared and pick your courses, or build one class by class.</p>
    </header>

    {resume && <ResumeCard {...resume} />}

    <Dropzone
      title="Drop your university’s timetable file"
      hint="Excel, OpenDocument or CSV. It is read on this device and never uploaded."
      busy={isLoading}
      busyText="Reading the timetable…"
      onFile={onFile}
      onBrowse={onBrowse}
    />
    {error && <p className="notice notice-error" role="alert">{error}</p>}

    <div className="start-links">
      <button type="button" className="btn" onClick={onScratch}>Start from scratch</button>
      <button type="button" className="btn" onClick={onSample}>Try the sample</button>
      <button type="button" className="btn" onClick={onBrowse}>Open a backup</button>
    </div>
  </section>
);

export default StartScreen;
