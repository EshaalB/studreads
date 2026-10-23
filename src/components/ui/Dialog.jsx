import { X } from 'lucide-react';
import { useId } from 'react';
import { useModalAccessibility } from '../../utils/useModalAccessibility';

// Centred modal on wide screens, bottom sheet on phones. `side` turns it into a side panel.
const Dialog = ({ isOpen, onClose, title, children, footer, side = false, width }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  const titleId = useId();
  if (!isOpen) return null;

  return (
    <div className={`overlay ${side ? 'overlay-side' : ''}`} onClick={onClose}>
      <div
        ref={dialogRef}
        className={side ? 'dialog dialog-side' : 'dialog'}
        style={width ? { maxWidth: width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
};

export default Dialog;
