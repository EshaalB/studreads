import { TIME_REGEX } from '../utils/constants.js';
import { autoDetectColumnMapping } from './columnDetector.js';
import { parseHeuristicExcel } from './heuristicParser.js';

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
  const hasGridTimes = matrix.slice(0, 40).some((row) =>
    Array.isArray(row) && row.some((cell) => TIME_REGEX.test(String(cell).trim()))
  );

  if (hasGridTimes) {
    const rows = parseHeuristicExcel(matrix);
    if (rows.length > 0) {
      return {
        sheetName,
        kind: 'grid',
        rows,
        mapping: {
          courseName: 'courseName', section: 'section', day: 'day',
          startTime: 'startTime', endTime: 'endTime', instructor: 'instructor',
          room: 'room', credits: 'credits'
        },
        warnings: []
      };
    }
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  if (rows.length === 0) return null;

  const mapping = autoDetectColumnMapping(Object.keys(rows[0]));
  if (!mapping.courseName) return null;

  const missing = REQUIRED_FIELDS.filter((field) => !mapping[field]);
  return {
    sheetName,
    kind: 'table',
    rows,
    mapping,
    warnings: missing.length
      ? [`Missing ${missing.join(', ')} column${missing.length > 1 ? 's' : ''}; some schedule details may be unavailable.`]
      : []
  };
};

export const parseWorkbook = (XLSX, workbook) => {
  const candidates = workbook.SheetNames
    .map((sheetName) => parseWorksheet(XLSX, workbook.Sheets[sheetName], sheetName))
    .filter(Boolean)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  if (candidates.length === 0) {
    throw new Error('No timetable data was detected. Use a sheet with course, day and time information.');
  }

  const selected = candidates[0];
  return {
    ...selected,
    availableSheets: candidates.map((candidate) => candidate.sheetName),
    warnings: [
      ...selected.warnings,
      ...(candidates.length > 1
        ? [`Detected ${candidates.length} possible timetable sheets and selected “${selected.sheetName}”.`]
        : [])
    ]
  };
};
