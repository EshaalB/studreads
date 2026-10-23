import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from './constants.js';

export const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  if (!ACCEPTED_FILE_TYPES.includes(fileExtension)) {
    return { valid: false, error: 'Choose an Excel, OpenDocument or CSV file.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'The file must be smaller than 10 MB.' };
  }

  return { valid: true };
};

export const validateSection = (section) => {
  if (!section || typeof section !== 'string') return false;
  const sanitized = sanitizeString(section);
  return sanitized.length > 0 && sanitized.length <= 50;
};

export const validateCourseData = (data) => {
  if (!Array.isArray(data)) return { valid: false, error: 'Invalid data format' };
  if (data.length === 0) return { valid: false, error: 'No data found in file' };
  return { valid: true };
};
