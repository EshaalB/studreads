import { Check, Palette } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isHexColor, readableText } from '../../utils/themes';

// A colour chip that opens a small picker: palette swatches, a custom colour and a hex field.
// The popover is fixed-positioned so tables with hidden overflow do not clip it.
const ColorPicker = ({ value, palette, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [hex, setHex] = useState(value);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 236;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = rect.bottom + 6 + 170 < window.innerHeight;
    setPosition({ left, top: below ? rect.bottom + 6 : rect.top - 6 - 170 });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const close = (event) => {
      if (!popoverRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') { setIsOpen(false); triggerRef.current?.focus(); } };
    const onScroll = () => setIsOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen]);

  const choose = (color) => {
    onChange(color.toUpperCase());
    setHex(color.toUpperCase());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="color-chip"
        onClick={(event) => { event.stopPropagation(); setHex(value); setIsOpen((open) => !open); }}
        aria-label={`Change colour for ${label}`}
        aria-expanded={isOpen}
        title="Change colour"
      >
        <Palette size={13} aria-hidden="true" />
      </button>
      {isOpen && position && (
        <div ref={popoverRef} className="color-popover" style={position} role="dialog" aria-label={`Colour for ${label}`}>
          <div className="color-popover-grid">
            {palette.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch-btn"
                style={{ background: color, color: readableText(color) }}
                aria-label={color}
                aria-pressed={value.toUpperCase() === color.toUpperCase()}
                onClick={() => choose(color)}
              >
                {value.toUpperCase() === color.toUpperCase() && <Check size={11} strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="color-popover-custom">
            <label className="swatch-btn swatch-custom" title="Pick any colour">
              <input type="color" value={isHexColor(value) ? value : '#FFA1BD'} onChange={(event) => choose(event.target.value)} aria-label="Pick any colour" />
            </label>
            <input
              className="input input-sm"
              value={hex}
              maxLength={7}
              spellCheck={false}
              aria-label="Hex colour"
              onChange={(event) => {
                const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
                setHex(next);
                if (isHexColor(next)) onChange(next.toUpperCase());
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ColorPicker;
