// When a revised date sheet arrives, finds each exam the student had picked in the new
// sheet and lists what moved: date, time or room. Pure functions, so they are tested.

const compact = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const score = (before, candidate) => {
  const sameCode = compact(before.code) && compact(before.code) === compact(candidate.code);
  const sameSubject = compact(before.subject) === compact(candidate.subject);
  if (!sameCode && !sameSubject) return 0;
  return (sameCode ? 4 : 0) + (sameSubject ? 2 : 0)
    + (before.program && before.program === candidate.program ? 1 : 0)
    + (before.date === candidate.date ? 0.5 : 0);
};

const timeOf = (record) => record.time || 'no time';
// Times compare by minutes, so "9:00 - 12:00" and "9:00 AM – 12:00 PM" are the same time.
const sameTime = (a, b) => (a.start ?? null) === (b.start ?? null) && (a.end ?? null) === (b.end ?? null) && (a.start != null || timeOf(a) === timeOf(b));

export const findExamChanges = (previous, nextRecords) => {
  const taken = new Set();
  const matched = [];
  const missing = [];
  previous.forEach((before) => {
    let best = null;
    let bestScore = 0;
    nextRecords.forEach((candidate) => {
      const value = taken.has(candidate.id) ? 0 : score(before, candidate);
      if (value > bestScore) { best = candidate; bestScore = value; }
    });
    if (!best) { missing.push(before); return; }
    taken.add(best.id);
    const differences = [
      before.date !== best.date && { field: 'Date', from: before.date, to: best.date },
      !sameTime(before, best) && { field: 'Time', from: timeOf(before), to: timeOf(best) },
      (before.room || '') !== (best.room || '') && { field: 'Room', from: before.room || 'none', to: best.room || 'none' }
    ].filter(Boolean);
    matched.push({ before, after: best, differences });
  });
  return {
    ids: matched.map((item) => item.after.id),
    changed: matched.filter((item) => item.differences.length > 0),
    unchanged: matched.filter((item) => item.differences.length === 0).length,
    missing
  };
};
