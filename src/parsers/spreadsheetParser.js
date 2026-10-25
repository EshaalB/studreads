import { autoDetectColumnMapping } from './columnDetector.js';
import { ImportError } from './importError.js';
import { parseHeuristicExcel } from './heuristicParser.js';
import { parseWeekdayTable } from './weekdayTable.js';
import { STANDARD_MAPPING } from '../utils/timetableSource.js';

const TIME_RANGE = /\d{1,2}:\d{2}\s*(?:AM|PM|A\.M|P\.M)?\s*(?:-|TO)\s*\d{1,2}:\d{2}/i;

const REQUIRED_FIELDS = ['courseName', 'day', 'startTime'];

const expandMergedCells = (XLSX, worksheet) => {
  if (!worksheet?.['!merges']) return;

  worksheet['!merges'].forEach((merge) => {
    const sourceRef = XLSX.utils.encode_cell(merge.s);
    const sourceCell = worksheet[sourceRef];
    if (!sourceCell) return;

    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      for (let column = merge.s.c; column <= merge.e.c; column += 1) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: column });
        if (!worksheet[cellRef]) worksheet[cellRef] = { ...sourceCell };
      }
    }
  });
};

const scoreCandidate = (candidate) => {
  const requiredMatches = REQUIRED_FIELDS.filter((field) => candidate.mapping[field]).length;
  return candidate.rows.length + requiredMatches * 100 + (candidate.kind === 'grid' ? 25 : 0);
};

const parseWorksheet = (XLSX, worksheet, sheetName) => {
  expandMergedCells(XLSX, worksheet);
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Header with 3+ weekdays: one course per row, one column per day.
  const weekly = parseWeekdayTable(matrix, { sheetName });
  if (weekly.length > 0) return { sheetName, kind: 'weekly', rows: weekly, mapping: STANDARD_MAPPING };
  const hasGridTimes = matrix.slice(0, 40).some((row) =>
    Array.isArray(row) && row.some((cell) => TIME_RANGE.test(String(cell).trim()))
  );

  if (hasGridTimes) {
    const rows = parseHeuristicExcel(matrix, { sheetName });
    if (rows.length > 0) {
      return { sheetName, kind: 'grid', rows, mapping: STANDARD_MAPPING };
    }
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  if (rows.length === 0) return null;

  const { mapping, guessed } = autoDetectColumnMapping(Object.keys(rows[0]), rows);
  if (!mapping.courseName) return null;

  return { sheetName, kind: 'table', rows, mapping, guessed };
};

export const parseWorkbook = (XLSX, workbook) => {
  const candidates = workbook.SheetNames
    .map((sheetName) => parseWorksheet(XLSX, workbook.Sheets[sheetName], sheetName))
    .filter(Boolean)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  if (candidates.length === 0) {
    throw new ImportError('empty', 'No timetable data was detected. Use a sheet with course, day and time information.');
  }

  // Read all batch sheets together, unless they repeat the same sections
  // (then classes would show up twice).
  const grids = candidates.filter((candidate) => candidate.kind === candidates[0].kind && candidate.kind !== 'table');
  const sectionSets = grids.map((grid) => new Set(grid.rows.map((row) => row.section)));
  const separate = sectionSets.every((set, index) => sectionSets.slice(index + 1).every((other) => [...set].every((section) => !other.has(section))));
  if (grids.length > 1 && separate) {
    return { sheetName: `${grids.length} sheets`, kind: candidates[0].kind, rows: grids.flatMap((grid) => grid.rows), mapping: STANDARD_MAPPING };
  }
  return candidates[0];
};
