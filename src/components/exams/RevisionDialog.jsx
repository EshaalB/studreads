import { shortDate } from '../../utils/dates';
import Dialog from '../ui/Dialog';
import PushButton from '../ui/PushButton';

const show = (field, value) => (field === 'Date' ? shortDate(value) : value);
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// After a revised date sheet is loaded: which of your exams moved, and which are gone.
const RevisionDialog = ({ revision, onClose, onEdit }) => {
  if (!revision) return null;
  const { changed, unchanged, uncertain = [], missing, name } = revision;
  const summary = [
    changed.length && `${plural(changed.length, 'exam')} changed`,
    unchanged && `${unchanged} the same`,
    missing.length && `${missing.length} not found`
  ].filter(Boolean).join(' · ');

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={changed.length ? 'Your exams changed' : 'Your exams are the same'}
      width={520}
      footer={<><button type="button" className="link-btn" onClick={onEdit}>Edit exams</button><PushButton onClick={onClose}>Got it</PushButton></>}
    >
      <div className="form">
        <p className="muted small">In {name}: {summary}.</p>
        {changed.length > 0 && (
          <ul className="change-list">
            {changed.map(({ after, differences, uncertain: unsure }) => (
              <li key={after.id}>
                <strong>{after.subject}{unsure && <span className="badge">Check</span>}</strong>
                {differences.map(({ field, from, to }) => (
                  <span key={field}>{field}: <s>{show(field, from)}</s> → <b>{show(field, to)}</b></span>
                ))}
              </li>
            ))}
          </ul>
        )}
        {uncertain.length > 0 && (
          <p className="notice">
            Matched by name only, so check {uncertain.length === 1 ? 'this one' : 'these'} against the sheet: {uncertain.map(({ after }) => `${after.subject} (${show('Date', after.date)})`).join(', ')}.
          </p>
        )}
        {missing.length > 0 && (
          <p className="notice notice-warn">
            Not in the new sheet: {missing.map((exam) => exam.subject).join(', ')}. Use Edit exams to search for {missing.length === 1 ? 'it' : 'them'}.
          </p>
        )}
      </div>
    </Dialog>
  );
};

export default RevisionDialog;
