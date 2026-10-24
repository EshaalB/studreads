import { useLayoutEffect, useRef, useState } from 'react';

// Segmented control (a radio group) with a sliding indicator.
// The indicator spans the whole control and is clipped to the active option, so moving it
// animates a clip rather than its width and never triggers layout.
const Segmented = ({ options, value, onChange, label, full = false }) => {
  const containerRef = useRef(null);
  const [indicator, setIndicator] = useState(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const measure = () => {
      const active = container.querySelector('[data-active="true"]');
      if (active) setIndicator({ left: active.offsetLeft, right: container.clientWidth - active.offsetLeft - active.offsetWidth });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [value, options.length]);

  return (
    <div
      ref={containerRef}
      className={`segmented ${full ? 'segmented-full' : ''}`}
      role="radiogroup"
      aria-label={label}
    >
      {indicator && <span className="segmented-indicator" style={{ clipPath: `inset(0 ${indicator.right}px -3px ${indicator.left}px round var(--radius))` }} aria-hidden="true" />}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default Segmented;
