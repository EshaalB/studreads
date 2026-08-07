export const encodeState = (state) => {
  try {
    const json = JSON.stringify(state);
    return btoa(encodeURIComponent(json));
  } catch (err) {
    console.error('Failed to encode state:', err);
    return '';
  }
};

export const decodeState = (base64) => {
  try {
    return JSON.parse(decodeURIComponent(atob(base64)));
  } catch (err) {
    console.error('Failed to decode state:', err);
    return null;
  }
};
