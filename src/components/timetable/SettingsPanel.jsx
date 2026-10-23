import { useTimetable } from '../../context/useTimetable';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';

const FIELDS = [
  ['showRoom', 'Room'],
  ['showTeacher', 'Teacher'],
  ['showCredits', 'Credits'],
  ['showSection', 'Section']
];

// Every visual choice in one place. Layout and colour settings also apply to "My exams".
const SettingsPanel = ({ isOpen, onClose }) => {
  const { displayOptions, setDisplayOptions, selectedTheme, setSelectedTheme, COLOR_THEMES, colorMap, setColorMap } = useTimetable();
  const setOption = (key) => (value) => setDisplayOptions((current) => ({ ...current, [key]: value }));
  const hasCustomColours = Object.keys(colorMap).length > 0;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Customise" side>
      <section className="settings-section" aria-labelledby="palette-title">
        <h3 id="palette-title">Colours</h3>
        <div className="palette-list" role="radiogroup" aria-labelledby="palette-title">
          {COLOR_THEMES.map((theme) => (
            <button key={theme.id} type="button" role="radio" aria-checked={selectedTheme === theme.id} className="palette-option" onClick={() => setSelectedTheme(theme.id)}>
              <span className="palette-strip" aria-hidden="true">
                {theme.colors.slice(0, 6).map((color) => <span key={color} style={{ background: color }} />)}
              </span>
              {theme.name}
            </button>
          ))}
        </div>
        <p className="muted small">To give one course any colour you like, click one of its classes.</p>
        {hasCustomColours && <button type="button" className="link-btn" onClick={() => setColorMap({})}>Reset course colours to the palette</button>}
      </section>

      <section className="settings-section">
        <h3>Class style</h3>
        <Segmented full label="Class style" value={displayOptions.blockStyle} onChange={setOption('blockStyle')}
          options={[{ value: 'filled', label: 'Filled' }, { value: 'tinted', label: 'Tinted' }]} />
      </section>

      <section className="settings-section">
        <h3>Row height</h3>
        <Segmented full label="Row height" value={displayOptions.rowHeight} onChange={setOption('rowHeight')}
          options={[{ value: 'compact', label: 'Compact' }, { value: 'regular', label: 'Regular' }, { value: 'large', label: 'Large' }]} />
      </section>

      <section className="settings-section">
        <h3>Days shown</h3>
        <Segmented full label="Days shown" value={displayOptions.days} onChange={setOption('days')}
          options={[{ value: 'auto', label: 'Mon–Fri' }, { value: 'six', label: 'Mon–Sat' }, { value: 'all', label: 'All 7' }]} />
        <p className="muted small">Weekend days with classes always appear.</p>
      </section>

      <section className="settings-section" aria-labelledby="details-title">
        <h3 id="details-title">Show on classes</h3>
        {FIELDS.map(([key, label]) => (
          <label className="toggle" key={key}>
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={Boolean(displayOptions[key])} onChange={(event) => setOption(key)(event.target.checked)} />
          </label>
        ))}
      </section>

      <section className="settings-section">
        <h3>Clock</h3>
        <Segmented full label="Clock" value={displayOptions.timeFormat === '24h' ? '24h' : '12h'} onChange={setOption('timeFormat')}
          options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} />
      </section>
    </Dialog>
  );
};

export default SettingsPanel;
