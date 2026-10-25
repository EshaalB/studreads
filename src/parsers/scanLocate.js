// Helpers for OCR results: join words into phrases, and find where each exam
// was on the page so the picker can highlight it.
import { compact } from '../utils/validation.js';

const MIN_KEY_LENGTH = 3;

const keyFor = (record) => {
  if (compact(record.code).length >= MIN_KEY_LENGTH) return compact(record.code);
  return String(record.subject || '').split(/\s+/).map(compact).find((word) => word.length >= MIN_KEY_LENGTH + 1) || '';
};

const lineAround = (word, words) => {
  const middle = word.y + word.height / 2;
  const line = words.filter((other) => other.page === word.page && Math.abs(other.y + other.height / 2 - middle) < Math.max(word.height, other.height) * 0.6);
  const left = Math.min(...line.map((item) => item.x));
  const top = Math.min(...line.map((item) => item.y));
  return {
    page: word.page,
    x: left,
    y: top,
    width: Math.max(...line.map((item) => item.x + item.width)) - left,
    height: Math.max(...line.map((item) => item.y + item.height)) - top
  };
};

// Each word is used for one exam at most, so repeated codes point at different lines.
export const locateInScan = (records, words) => {
  const used = new Set();
  return records.map((record) => {
    const key = keyFor(record);
    const match = key && words.find((word, index) => !used.has(index) && compact(word.text).includes(key) && used.add(index));
    return match ? { ...record, scan: lineAround(match, words) } : record;
  });
};

// OCR gives single words. Join words that are close together so normal spaces
// don't get mistaken for column gaps.
const SPACE_GAP = 0.9;
export const joinSpacedWords = (words) => {
  const phrases = [];
  [...words].sort((a, b) => a.y - b.y || a.x - b.x).forEach((word) => {
    const middle = word.y + word.height / 2;
    const phrase = phrases.findLast((item) => Math.abs(item.y + item.height / 2 - middle) < Math.max(item.height, word.height) * 0.5);
    const gap = phrase ? word.x - (phrase.x + phrase.width) : Infinity;
    if (phrase && gap >= 0 && gap < Math.max(phrase.height, word.height) * SPACE_GAP) {
      phrase.text = `${phrase.text} ${word.text}`;
      phrase.width = word.x + word.width - phrase.x;
      phrase.height = Math.max(phrase.height, word.height);
    } else {
      phrases.push({ text: word.text, x: word.x, y: word.y, width: word.width, height: word.height });
    }
  });
  return phrases;
};
