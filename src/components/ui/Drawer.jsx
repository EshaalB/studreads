import { X } from 'lucide-react';
import { useId } from 'react';
import { useModalAccessibility } from '../../utils/useModalAccessibility';

// Side panel on wide screens, bottom sheet on phones.
const Drawer = ({ isOpen, onClose, title, children, footer }) => {
  const dialogRef = useModalAccessibility(isOpen, onClose);
  const titleId = useId();
  if (!isOpen) return null;

  return (
    <div className="overlay overlay-drawer" onClick={onClose}>
      <aside ref={dialogRef} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </div>
  );
};

export default Drawer;
