// Checks and clean-up for anything that comes from a file, a link or a form.
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from './constants.js';

// Trimmed, without angle brackets, and no longer than `max` characters.
export const cleanText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);

export const sanitizeString = (value) => (typeof value === 'string' ? cleanText(value, Infinity) : '');

export const sanitizeObject = (object) => Object.fromEntries(Object.entries(object && typeof object === 'object' ? object : {})
  .map(([key, value]) => [key, typeof value === 'string' ? sanitizeString(value) : value]));

// Letters and digits only, for matching names and codes ("CS-204" matches "cs204").
export const compact = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const validateFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };
  if (!ACCEPTED_FILE_TYPES.includes(`.${file.name.split('.').pop().toLowerCase()}`)) return { valid: false, error: 'Choose an Excel, OpenDocument or CSV file.' };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'The file must be smaller than 10 MB.' };
  return { valid: true };
};
