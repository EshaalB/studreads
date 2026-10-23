import { X } from 'lucide-react';
import { readableText } from '../../utils/themes';

/**
 * Items grouped under headings (days or dates). Each row is filled with the item's colour;
 * the row opens the item, and an optional remove button sits at its end.
 * groups: [{ key, label, items: [{ id, time, title, details, color, clash }] }]
 */
const AgendaList = ({ groups, onSelect, onRemove, removeLabel = 'Delete' }) => (
  <div className="agenda">
    {groups.map((group) => (
      <section className="agenda-group" key={group.key} aria-label={group.label}>
        <h3>{group.label}</h3>
        <ul>
          {group.items.map((item) => (
            <li key={item.id} className="agenda-row" style={{ background: item.color, color: readableText(item.color) }}>
              <button type="button" className="agenda-row-main" onClick={() => onSelect(item.id)}>
                <span className="agenda-row-time">{item.time || 'Time not listed'}</span>
                <span className="agenda-row-text">
                  <strong>{item.title}</strong>
                  {item.details.length > 0 && <span>{item.details.join(' · ')}</span>}
                </span>
                {item.clash && <span className="badge">Clash</span>}
              </button>
              {onRemove && (
                <button type="button" className="agenda-row-remove" onClick={() => onRemove(item.id)} aria-label={`${removeLabel} ${item.title}`} title={removeLabel}>
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
