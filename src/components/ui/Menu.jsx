import { useEffect, useId, useRef, useState } from 'react';

// A small dropdown of actions. Items: { label, hint?, icon?, onSelect, disabled? } or { separator: true }.
const Menu = ({ trigger, triggerClassName = 'btn', triggerLabel, items, align = 'end' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef.current;
    container?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();

    const handlePointer = (event) => {
      if (!container?.contains(event.target)) setIsOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        container?.querySelector('[aria-haspopup="menu"]')?.focus();
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const options = [...(container?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
      options[next]?.focus();
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div className="menu" ref={containerRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        {trigger}
      </button>
      {isOpen && (
        <div className={`menu-popover menu-${align}`} role="menu" id={menuId}>
          {items.map((item, index) => item.separator ? (
            <div className="menu-separator" role="separator" key={`separator-${index}`} />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu-item ${item.active ? 'is-active' : ''}`}
              disabled={item.disabled}
              onClick={() => { setIsOpen(false); item.onSelect(); }}
            >
              {item.icon}
              <span className="menu-item-text">
                <span>{item.label}</span>
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Menu;
