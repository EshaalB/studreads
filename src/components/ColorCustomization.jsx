import { useCallback, useMemo } from 'react';
import { useTimetable } from '../context/useTimetable';
import { getThemeColors } from '../utils/themes';
import { sanitizeString } from '../utils/validation';

const ColorCustomization = () => {
  const {
    finalActiveClasses,
    selectedTheme,
    setSelectedTheme,
    COLOR_THEMES,
    colorMap,
    setColorMap,
    getOrAssignColor
  } = useTimetable();

  const uniqueCourses = useMemo(() => {
    const courses = new Set();
    finalActiveClasses.forEach(cls => {
      const name = sanitizeString(cls.name);
      if (name) courses.add(name);
    });
    return Array.from(courses).sort();
  }, [finalActiveClasses]);

  const currentThemeColors = useMemo(() => {
    return getThemeColors(selectedTheme);
  }, [selectedTheme]);

  const handleThemeChange = useCallback((themeId) => {
    setSelectedTheme(themeId);
    const newThemeColors = getThemeColors(themeId);
    const newColorMap = {};
    uniqueCourses.forEach((course, idx) => {
      if (colorMap[course] && currentThemeColors.includes(colorMap[course])) {
        newColorMap[course] = newThemeColors[idx % newThemeColors.length];
      }
    });
    if (Object.keys(newColorMap).length > 0) {
      setColorMap(prev => ({ ...prev, ...newColorMap }));
    }
  }, [setSelectedTheme, uniqueCourses, colorMap, currentThemeColors, setColorMap]);

  const handleColorChange = useCallback((courseName, color) => {
    setColorMap(prev => ({ ...prev, [courseName]: color }));
  }, [setColorMap]);

  if (uniqueCourses.length === 0) {
    return null;
  }

  return (
    <div className="color-customization">
      <div className="color-customization-header">
        <label>Color Theme:</label>
        <div className="theme-buttons">
          {COLOR_THEMES.map(theme => (
            <button
              key={theme.id}
              type="button"
              className={`theme-btn ${selectedTheme === theme.id ? 'active' : ''}`}
              onClick={() => handleThemeChange(theme.id)}
            >
              {theme.name}
            </button>
          ))}
        </div>
      </div>

      <div className="course-colors">
        {uniqueCourses.map(courseName => {
          const currentColor = getOrAssignColor(courseName);
          return (
            <div key={courseName} className="course-color-item">
              <div className="course-color-label">
                <div
                  className="course-color-preview"
                  style={{ backgroundColor: currentColor }}
                />
                <span>{courseName}</span>
              </div>
              <div className="course-color-picker">
                {currentThemeColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${currentColor === color ? 'active' : ''}`}
                    onClick={() => handleColorChange(courseName, color)}
                    style={{ backgroundColor: color }}
                    aria-label={`Set ${courseName} to ${color}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ColorCustomization;
