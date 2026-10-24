export const COLOR_THEMES = [
  {
    id: 'brand',
    name: 'eshaaldev',
    colors: ['#F1A5BC', '#234071', '#EBDDB8', '#BF5B86', '#4B6CA3', '#F7CAD8', '#9FB3D6', '#D98AAB', '#D6C08F', '#131F33']
  },
  {
    id: 'pastel',
    name: 'Soft',
    colors: ['#BFDBFE', '#FECACA', '#BBF7D0', '#FEF08A', '#DDD6FE', '#FBCFE8', '#CFFAFE', '#FED7AA', '#99F6E4', '#E2E8F0']
  },
  {
    id: 'muted',
    name: 'Muted',
    colors: ['#C9D6DF', '#E2C2B9', '#C7D3BF', '#E6D7A9', '#CFC4DD', '#E3C7D3', '#BFD8D5', '#E5CBB0', '#B9CBC2', '#D6D3CC']
  },
  {
    id: 'vivid',
    name: 'Vivid',
    colors: ['#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#EA580C', '#0D9488', '#475569']
  },
  {
    id: 'earth',
    name: 'Earth',
    colors: ['#A3B18A', '#DDA15E', '#BC6C25', '#6B705C', '#B5838D', '#E5989B', '#CB997E', '#7F8F70', '#D4A373', '#9C6644']
  },
  {
    id: 'minimal',
    name: 'Mono',
    colors: ['#F3F4F6', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563', '#374151', '#1F2937', '#111827', '#F9FAFB']
  }
];

export const getThemeColors = (themeId) => {
  const theme = COLOR_THEMES.find(t => t.id === themeId);
  return theme ? theme.colors : COLOR_THEMES[0].colors;
};

export const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

// Black or white text, whichever reads better on the given background.
export const readableText = (hex) => {
  if (!isHexColor(hex)) return '#111111';
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#111111' : '#ffffff';
};
