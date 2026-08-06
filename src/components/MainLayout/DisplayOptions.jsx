import { Check } from 'lucide-react';

const DisplayOptions = ({ displayOptions, setDisplayOptions, displayOptionsList }) => {
  return (
    <div className="display-options-bar">
      {displayOptionsList.map(opt => (
        <button
          key={opt.key}
          type="button"
          className={`tick-item ${displayOptions[opt.key] ? 'selected' : ''}`}
          onClick={() => setDisplayOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
          aria-pressed={displayOptions[opt.key]}
        >
          <div className="tick-indicator">
            {displayOptions[opt.key] && <Check size={14} />}
          </div>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DisplayOptions;
