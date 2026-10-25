// When an updated date sheet comes in, find each picked exam in it
// and list what changed (date, time or room). Unsure matches are flagged.
import { compact } from './validation.js';

const CODE_MATCH = 4;
const SUBJECT_MATCH = 2;

const score = (before, candidate) => {
  const sameCode = compact(before.code) && compact(before.code) === compact(candidate.code);
  const sameSubject = compact(before.subject) === compact(candidate.subject);
  if (!sameCode && !sameSubject) return 0;
  return (sameCode ? CODE_MATCH : 0) + (sameSubject ? SUBJECT_MATCH : 0)
    + (before.program && before.program === candidate.program ? 1 : 0)
    + (before.date === candidate.date ? 0.5 : 0);
};

const timeOf = (record) => record.time || 'no time';
// Compare times as minutes so different formats still match.
const sameTime = (a, b) => (a.start ?? null) === (b.start ?? null) && (a.end ?? null) === (b.end ?? null) && (a.start != null || timeOf(a) === timeOf(b));

const differencesBetween = (before, after) => [
  before.date !== after.date && { field: 'Date', from: before.date, to: after.date },
  !sameTime(before, after) && { field: 'Time', from: timeOf(before), to: timeOf(after) },
  (before.room || '') !== (after.room || '') && { field: 'Room', from: before.room || 'none', to: after.room || 'none' }
].filter(Boolean);

export const findExamChanges = (previous, nextRecords) => {
  const pairs = previous.flatMap((before, index) => nextRecords
    .map((candidate) => ({ index, candidate, value: score(before, candidate) }))
    .filter((pair) => pair.value > 0));
  pairs.sort((a, b) => b.value - a.value);

  const matchedBy = new Map();
  const taken = new Set();
  pairs.forEach((pair) => {
    if (matchedBy.has(pair.index) || taken.has(pair.candidate.id)) return;
    matchedBy.set(pair.index, pair);
    taken.add(pair.candidate.id);
  });

  const matched = [];
  const missing = [];
  previous.forEach((before, index) => {
    const pair = matchedBy.get(index);
    if (!pair) { missing.push(before); return; }
    // Unsure if the code didn't match or another exam scored the same.
    const tied = pairs.filter((other) => other.index === index && other.value === pair.value).length > 1;
    matched.push({ before, after: pair.candidate, differences: differencesBetween(before, pair.candidate), uncertain: pair.value < CODE_MATCH || tied });
  });

  return {
    ids: matched.map((item) => item.after.id),
    changed: matched.filter((item) => item.differences.length > 0),
    unchanged: matched.filter((item) => item.differences.length === 0).length,
    uncertain: matched.filter((item) => item.uncertain),
    missing
  };
};
