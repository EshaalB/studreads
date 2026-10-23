import { useTimetable } from '../../context/useTimetable';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';

const FIELDS = [
  ['showRoom', 'Room'],
  ['showTeacher', 'Teacher'],
  ['showCredits', 'Credits'],
  ['showSection', 'Section']
];

const SettingsPanel = ({ isOpen, onClose }) => {
  const { displayOptions, setDisplayOptions, selectedTheme, setSelectedTheme, COLOR_THEMES, colorMap, setColorMap } = useTimetable();
  const setOption = (key, value) => setDisplayOptions((current) => ({ ...current, [key]: value }));
  const hasCustomColours = Object.keys(colorMap).length > 0;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Settings" side>
      <section className="settings-section" aria-labelledby="palette-title">
        <h3 id="palette-title">Colour palette</h3>
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
        <p className="muted small">To give one course its own colour, click any of its classes.</p>
        {hasCustomColours && <button type="button" className="link-btn" onClick={() => setColorMap({})}>Reset course colours to the palette</button>}
      </section>

      <section className="settings-section" aria-labelledby="details-title">
        <h3 id="details-title">Show on classes</h3>
        {FIELDS.map(([key, label]) => (
          <label className="toggle" key={key}>
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={Boolean(displayOptions[key])} onChange={(event) => setOption(key, event.target.checked)} />
          </label>
        ))}
      </section>

      <section className="settings-section" aria-labelledby="clock-title">
        <h3 id="clock-title">Clock</h3>
        <Segmented
          full
          label="Clock"
          value={displayOptions.timeFormat === '24h' ? '24h' : '12h'}
          onChange={(next) => setOption('timeFormat', next)}
          options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]}
        />
      </section>
    </Dialog>
  );
};

export default SettingsPanel;
