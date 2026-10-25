// Two colour palettes, each with a light and a dark version.
// You can still pick any colour for a course.
export const COLOR_THEMES = [
  {
    id: 'basic',
    name: 'Basic',
    colors: ['#A9C8EC', '#B5DDBC', '#F0DDA0', '#EDB4AB', '#C9BCEB', '#F1C9A0', '#A9DCD7', '#EBBDD3', '#CBD3AE', '#BEC6D2'],
    dark: ['#3E5F8F', '#3F7558', '#8C7330', '#9A4A44', '#62549A', '#9A6338', '#2F7470', '#94506F', '#5F6B3C', '#4F5A6C']
  },
  {
    id: 'brand',
    name: 'eshaaldev',
    colors: ['#F3BCCB', '#A9BAD6', '#EDE3C8', '#DDAFC3', '#BFCBDF', '#F7D6E0', '#CBD6E8', '#E6BFD0', '#E4D9B8', '#B3BDCD'],
    dark: ['#A85A78', '#34507F', '#7D6F4E', '#8A4B67', '#46608C', '#7A4860', '#566F98', '#94546F', '#6A6146', '#3A4A66']
  }
];

export const getThemeColors = (themeId, mode = 'light') => {
  const theme = COLOR_THEMES.find((item) => item.id === themeId) || COLOR_THEMES[0];
  return (mode === 'dark' && theme.dark) || theme.colors;
};

export const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

// Pick black or white text, whichever is easier to read on the colour.
const DARK_TEXT = '#111111';
const LIGHT_TEXT = '#ffffff';
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrastRatio = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

export const readableText = (hex) => {
  if (!isHexColor(hex)) return DARK_TEXT;
  return contrastRatio(hex, DARK_TEXT) >= contrastRatio(hex, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
};
