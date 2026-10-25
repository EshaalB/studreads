// Does this exam match one of your courses?
// 'sure' = same code or name, 'maybe' = similar name or abbreviation ("OOP"), null = no.
// Only sure matches are ticked automatically.
import { compact } from './validation.js';

const MIN_CONTAINED_LENGTH = 6;
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'intro', 'introduction', 'lab', 'to', 'of', 'in', 'i', 'ii', 'iii']);

const words = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
const initials = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word && !STOP_WORDS.has(word)).map((word) => word[0]).join('');

const strength = (exam, name) => {
  const course = compact(name);
  const subject = compact(exam.subject);
  const code = compact(exam.code);
  if (!course) return null;
  if ((code && course.includes(code)) || subject === course) return 'sure';
  if (Math.min(subject.length, course.length) >= MIN_CONTAINED_LENGTH && (subject.includes(course) || course.includes(subject))) return 'sure';

  const courseWords = new Set(words(name));
  const subjectWords = new Set(words(exam.subject));
  const shared = [...courseWords].filter((word) => subjectWords.has(word)).length;
  if (shared >= 2 && shared / Math.max(courseWords.size, subjectWords.size) >= 0.6) return 'maybe';
  const short = [subject, course].find((text) => text.length >= 2 && text.length <= 5);
  if (short && (initials(exam.subject) === short || initials(name) === short)) return 'maybe';
  return null;
};

export const courseMatch = (exam, courseNames) => {
  const found = courseNames.map((name) => strength(exam, name));
  return found.includes('sure') ? 'sure' : found.includes('maybe') ? 'maybe' : null;
};
