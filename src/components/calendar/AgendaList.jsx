import { X } from 'lucide-react';
import { readableText } from '../../utils/themes';

// Items grouped under day or date headings; each row opens its item and can be removed.
const AgendaList = ({ groups, onSelect, onRemove, blockStyle = 'filled' }) => (
  <div className={`agenda ${blockStyle === 'tinted' ? 'is-tinted' : ''}`}>
    {groups.map((group) => (
      <section className="agenda-group" key={group.key} aria-label={group.label}>
        <h3>{group.label}</h3>
        <ul>
          {group.items.map((item) => (
            <li key={item.id} className={`agenda-row ${item.kind === 'exam' ? 'is-exam' : ''} ${item.preview ? 'is-preview' : ''}`} style={{ '--block': item.color, '--block-text': readableText(item.color) }}>
              <button type="button" className="agenda-row-main" onClick={() => onSelect(item.id)}>
                <span className="agenda-row-time">{item.time || 'Time not listed'}</span>
                <span className="agenda-row-text">
                  {item.badge && <span className="agenda-row-badge">{item.badge}</span>}
                  <strong>{item.title}</strong>
                  {item.details.length > 0 && <span>{item.details.join(' · ')}</span>}
                </span>
                {item.clash && <span className="badge">Clash</span>}
              </button>
              {onRemove && (
                <button type="button" className="agenda-row-remove" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`} title="Remove">
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);

export default AgendaList;
