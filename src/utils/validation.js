// Cleaning up text from files, links and forms.
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from './constants.js';

// Trim, remove < >, and cut to `max` characters.
export const cleanText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);

export const sanitizeString = (value) => (typeof value === 'string' ? cleanText(value, Infinity) : '');

export const sanitizeObject = (object) => Object.fromEntries(Object.entries(object && typeof object === 'object' ? object : {})
  .map(([key, value]) => [key, typeof value === 'string' ? sanitizeString(value) : value]));

// Letters and digits only, so "CS-204" matches "cs204".
export const compact = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const validateFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };
  if (!ACCEPTED_FILE_TYPES.includes(`.${file.name.split('.').pop().toLowerCase()}`)) return { valid: false, error: 'Choose an Excel, OpenDocument or CSV file.' };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'The file must be smaller than 10 MB.' };
  return { valid: true };
};
