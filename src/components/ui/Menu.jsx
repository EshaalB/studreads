import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 250;

// A small dropdown of actions. Items: { label, hint?, icon?, onSelect, disabled? } or { separator: true }.
// The list is rendered at the end of <body> and positioned against the button, so scrolling
// rows and clipped containers (like the action bar on phones) never cut it off.
const Menu = ({ trigger, triggerClassName = 'btn', items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!isOpen) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8);
    const height = listRef.current?.offsetHeight || 0;
    const below = rect.bottom + 6 + height <= window.innerHeight - 8;
    setPosition({ left, top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height) });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    listRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });

    const close = () => setIsOpen(false);
    const handlePointer = (event) => {
      if (!listRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') { close(); triggerRef.current?.focus(); }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const options = [...(listRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
      const index = options.indexOf(document.activeElement);
      options[event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length]?.focus();
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        {trigger}
      </button>
      {isOpen && createPortal(
        <div
          ref={listRef}
          className="menu-popover"
          role="menu"
          id={menuId}
          style={{ width: MENU_WIDTH, ...(position || { visibility: 'hidden' }) }}
        >
          {items.map((item, index) => item.separator ? (
            <div className="menu-separator" role="separator" key={`separator-${index}`} />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
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
        </div>,
        document.body
      )}
    </>
  );
};

export default Menu;
