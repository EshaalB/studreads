import { isHexColor } from '../../utils/themes';

// Palette swatches plus a free colour picker. Used wherever a course colour is chosen.
const ColorField = ({ value, palette, onChange, label = 'Colour' }) => {
  const current = (value || '').toUpperCase();
  const isCustom = !palette.some((color) => color.toUpperCase() === current);

  return (
    <div className="color-field" role="radiogroup" aria-label={label}>
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color.toUpperCase() === current}
          aria-label={color}
          className="swatch"
          style={{ background: color }}
          onClick={() => onChange(color.toUpperCase())}
        />
      ))}
      <label className={`swatch swatch-any ${isCustom ? 'is-selected' : ''}`} style={isCustom && isHexColor(value) ? { background: value } : undefined} title="Any colour">
        <input type="color" value={isHexColor(value) ? value : '#FFA1BD'} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label="Pick any colour" />
      </label>
    </div>
  );
};

export default ColorField;
