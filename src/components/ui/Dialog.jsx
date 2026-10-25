import { X } from 'lucide-react';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

// Centred modal on wide screens, bottom sheet on phones. `side` turns it into a side panel.
// `bare` lets the content supply its own .dialog-body and .dialog-footer.
const Dialog = ({ isOpen, onClose, title, children, footer, side = false, width, bare = false }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  const titleId = useId();
  if (!isOpen) return null;

  return createPortal(
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
        {bare ? children : <div className="dialog-body">{children}</div>}
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
};

export default Dialog;
