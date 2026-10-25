import { useTimetable } from '../../context/useTimetable';
import { getThemeColors } from '../../utils/themes';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';

const FIELDS = [
  ['showRoom', 'Room', 'room'],
  ['showTeacher', 'Teacher', 'teacher'],
  ['showCredits', 'Credits', 'credits'],
  ['showSection', 'Section', 'section']
];

// Every visual choice in one place, for classes and exams alike. A detail can only be
// shown or hidden when at least one class has it.
const SettingsPanel = ({ isOpen, onClose }) => {
  const { appearance, classes, displayOptions, setDisplayOptions, selectedTheme, setSelectedTheme, COLOR_THEMES, colorMap, setColorMap } = useTimetable();
  const setOption = (key) => (value) => setDisplayOptions((current) => ({ ...current, [key]: value }));
  const hasCustomColours = Object.keys(colorMap).length > 0;
  const fields = FIELDS.filter(([, , field]) => classes.some((cls) => String(cls[field] ?? '').trim()));

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Customise" side>
      <section className="settings-section" aria-labelledby="palette-title">
        <h3 id="palette-title">Colours</h3>
        <div className="palette-list" role="radiogroup" aria-labelledby="palette-title">
          {COLOR_THEMES.map((theme) => (
            <button key={theme.id} type="button" role="radio" aria-checked={selectedTheme === theme.id} className="palette-option" onClick={() => setSelectedTheme(theme.id)}>
              <span className="palette-strip" aria-hidden="true">
                {getThemeColors(theme.id, appearance).slice(0, 6).map((color) => <span key={color} style={{ background: color }} />)}
              </span>
              {theme.name}
            </button>
          ))}
        </div>
        <p className="muted small">Colours soften in light mode and deepen in dark mode. To give one course its own colour, click one of its classes.</p>
        {hasCustomColours && <button type="button" className="link-btn" onClick={() => setColorMap({})}>Reset course colours to the palette</button>}
      </section>

      <section className="settings-section">
        <h3>Style</h3>
        <Segmented full label="Style" value={displayOptions.blockStyle} onChange={setOption('blockStyle')}
          options={[{ value: 'filled', label: 'Filled' }, { value: 'tinted', label: 'Tinted' }]} />
      </section>

      <section className="settings-section">
        <h3>Row height</h3>
        <Segmented full label="Row height" value={displayOptions.rowHeight} onChange={setOption('rowHeight')}
          options={[{ value: 'compact', label: 'Compact' }, { value: 'regular', label: 'Regular' }, { value: 'large', label: 'Large' }]} />
      </section>

      {fields.length > 0 && (
        <section className="settings-section" aria-labelledby="details-title">
          <h3 id="details-title">Show on classes</h3>
          {fields.map(([key, label]) => (
            <label className="toggle" key={key}>
              <span>{label}</span>
              <input type="checkbox" role="switch" checked={Boolean(displayOptions[key])} onChange={(event) => setOption(key)(event.target.checked)} />
            </label>
          ))}
        </section>
      )}

      <section className="settings-section">
        <h3>Clock</h3>
        <Segmented full label="Clock" value={displayOptions.timeFormat === '24h' ? '24h' : '12h'} onChange={setOption('timeFormat')}
          options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} />
      </section>
    </Dialog>
  );
};

export default SettingsPanel;
