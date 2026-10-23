import { useLayoutEffect, useRef, useState } from 'react';

// Segmented control with a sliding indicator. kind: 'tabs' (role tablist) or 'radio'.
const Segmented = ({ options, value, onChange, label, kind = 'radio', full = false, className = '' }) => {
  const containerRef = useRef(null);
  const [indicator, setIndicator] = useState(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const measure = () => {
      const active = container.querySelector('[data-active="true"]');
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [value, options.length]);

  const isTabs = kind === 'tabs';

  return (
    <div
      ref={containerRef}
      className={`segmented ${full ? 'segmented-full' : ''} ${className}`}
      role={isTabs ? 'tablist' : 'radiogroup'}
      aria-label={label}
    >
      {indicator && <span className="segmented-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} aria-hidden="true" />}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={isTabs ? 'tab' : 'radio'}
            aria-selected={isTabs ? active : undefined}
            aria-checked={isTabs ? undefined : active}
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
