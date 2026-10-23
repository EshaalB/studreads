import { Check } from 'lucide-react';
import { useMemo } from 'react';
import { useTimetable } from '../../context/useTimetable';
import { getThemeColors, readableText } from '../../utils/themes';
import Drawer from '../ui/Drawer';
import Segmented from '../ui/Segmented';

const FIELDS = [
  ['showRoom', 'Room'],
  ['showTeacher', 'Teacher'],
  ['showCredits', 'Credits'],
  ['showSection', 'Section']
];

const CustomizePanel = ({ isOpen, onClose }) => {
  const {
    finalActiveClasses, displayOptions, setDisplayOptions, selectedTheme, setSelectedTheme,
    COLOR_THEMES, colorMap, setColorMap, getOrAssignColor
  } = useTimetable();

  const courses = useMemo(() => [...new Set(finalActiveClasses.map((cls) => cls.name))].sort(), [finalActiveClasses]);
  const palette = getThemeColors(selectedTheme);
  const setOption = (key, value) => setDisplayOptions((current) => ({ ...current, [key]: value }));

  const choosePalette = (themeId) => {
    // Colours picked from the old palette follow the switch; hand-picked custom colours stay.
    setColorMap((current) => Object.fromEntries(Object.entries(current).filter(([, color]) => !palette.includes(color))));
    setSelectedTheme(themeId);
  };

  const hasCustomColours = courses.some((course) => colorMap[course]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Customize">
      <section className="panel-section">
        <label className="field">
          <span className="field-label">Timetable name</span>
          <input
            className="input"
            value={displayOptions.title}
            maxLength={60}
            placeholder="My timetable"
            onChange={(event) => setOption('title', event.target.value)}
          />
        </label>
      </section>

      <section className="panel-section" aria-labelledby="palette-title">
        <h3 className="panel-title" id="palette-title">Palette</h3>
        <div className="palette-list" role="radiogroup" aria-labelledby="palette-title">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selectedTheme === theme.id}
              className="palette-option"
              onClick={() => choosePalette(theme.id)}
            >
              <span className="palette-strip" aria-hidden="true">
                {theme.colors.slice(0, 6).map((color) => <span key={color} style={{ background: color }} />)}
              </span>
              <span>{theme.name}</span>
              {selectedTheme === theme.id && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="course-colours-title">
        <div className="side-title-row">
          <h3 className="panel-title" id="course-colours-title">Course colours</h3>
          {hasCustomColours && (
            <button type="button" className="link-btn" onClick={() => setColorMap((current) => Object.fromEntries(Object.entries(current).filter(([name]) => !courses.includes(name))))}>
              Reset
            </button>
          )}
        </div>
        <ul className="colour-list">
          {courses.map((course) => {
            const current = getOrAssignColor(course);
            return (
              <li key={course}>
                <span className="colour-name">{course}</span>
                <div className="swatches" role="radiogroup" aria-label={`Colour for ${course}`}>
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={current === color}
                      aria-label={color}
                      className="swatch-btn"
                      style={{ background: color, color: readableText(color) }}
                      onClick={() => setColorMap((map) => ({ ...map, [course]: color }))}
                    >
                      {current === color && <Check size={11} strokeWidth={3} />}
                    </button>
                  ))}
                  <label className={`swatch-btn swatch-custom ${palette.includes(current) ? '' : 'is-custom'}`} style={palette.includes(current) ? undefined : { background: current }} title="Custom colour">
                    <input
                      type="color"
                      value={current}
                      onChange={(event) => setColorMap((map) => ({ ...map, [course]: event.target.value.toUpperCase() }))}
                      aria-label={`Custom colour for ${course}`}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel-section" aria-labelledby="details-title">
        <h3 className="panel-title" id="details-title">Show on timetable</h3>
        <div className="toggle-list">
          {FIELDS.map(([key, label]) => (
            <label className="toggle" key={key}>
              <span>{label}</span>
              <input type="checkbox" role="switch" checked={Boolean(displayOptions[key])} onChange={(event) => setOption(key, event.target.checked)} />
            </label>
          ))}
        </div>
      </section>

      <section className="panel-section" aria-labelledby="clock-title">
        <h3 className="panel-title" id="clock-title">Clock</h3>
        <Segmented
          full
          label="Clock"
          value={displayOptions.timeFormat === '24h' ? '24h' : '12h'}
          onChange={(next) => setOption('timeFormat', next)}
          options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]}
        />
      </section>
    </Drawer>
  );
};

export default CustomizePanel;
