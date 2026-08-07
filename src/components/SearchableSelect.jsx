import { ChevronDown, Search, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

const SearchableSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Search...',
  disabled = false,
  className = '',
  ariaLabel = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => {
      const label = typeof opt === 'string' ? opt : opt.label || opt.value || '';
      return label.toLowerCase().includes(term);
    });
  }, [options, searchTerm]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const option = options.find(opt => {
      const optValue = typeof opt === 'string' ? opt : opt.value || '';
      return optValue === value;
    });
    return typeof option === 'string' ? option : option?.label || option?.value || value;
  }, [options, value]);

  const handleSelect = useCallback((selectedValue) => {
    onChange(selectedValue);
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      requestAnimationFrame(() => optionRefs.current[0]?.focus());
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [disabled, isOpen]);

  return (
    <div className={`searchable-select ${className} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className="searchable-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel || placeholder}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
      >
        <span className="searchable-select-value">
          {selectedLabel || <span className="placeholder">{placeholder}</span>}
        </span>
        <div className="searchable-select-actions">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="searchable-select-clear"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  handleClear(e);
                }
              }}
              aria-label="Clear selection"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search">
            <Search size={16} />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                  setSearchTerm('');
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  optionRefs.current[0]?.focus();
                }
              }}
              placeholder={placeholder}
              className="searchable-select-input"
            />
          </div>
          <div className="searchable-select-options" role="listbox" id={listboxId}>
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-empty" role="option">No options found</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optValue = typeof opt === 'string' ? opt : opt.value || '';
                const optLabel = typeof opt === 'string' ? opt : opt.label || opt.value || '';
                const isSelected = optValue === value;

                return (
                  <button
                    key={optValue || idx}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`searchable-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(optValue)}
                    ref={(node) => { optionRefs.current[idx] = node; }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        optionRefs.current[(idx + 1) % filteredOptions.length]?.focus();
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        optionRefs.current[(idx - 1 + filteredOptions.length) % filteredOptions.length]?.focus();
                      } else if (event.key === 'Escape') {
                        setIsOpen(false);
                        setSearchTerm('');
                      }
                    }}
                  >
                    {optLabel}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
