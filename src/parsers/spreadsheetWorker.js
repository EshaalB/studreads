// Reads spreadsheets in the background so big files don't freeze the page.
// In: { buffer, name, kind, dayFirst? }
// Out: a timetable, exams, or { error }.
import * as XLSX from 'xlsx';
import { mayBeDateSheet, parseExamWorkbook } from './examParser.js';
import { readDateSheetBook, readTimetableBook } from './readWorkbook.js';
import { parseWorkbook } from './spreadsheetParser.js';

// Several different dates means a date sheet; a timetable only has days.
const looksLikeDateSheet = (workbook) => {
  if (!mayBeDateSheet(XLSX, workbook)) return false;
  try {
    const { records } = parseExamWorkbook(XLSX, workbook);
    return records.length >= 3 && new Set(records.map((record) => record.date)).size >= 2;
  } catch {
    return false;
  }
};

const readExams = (buffer, name, dayFirst) => ({ type: 'exams', ...parseExamWorkbook(XLSX, readDateSheetBook(XLSX, buffer, name), { dayFirst }) });

self.onmessage = ({ data: { buffer, name, kind, dayFirst } }) => {
  try {
    if (kind === 'exams') { self.postMessage(readExams(buffer, name, dayFirst)); return; }
    const workbook = readTimetableBook(XLSX, buffer, name);
    if (kind === 'auto' && looksLikeDateSheet(workbook)) { self.postMessage(readExams(buffer, name, dayFirst)); return; }
    self.postMessage({ type: 'timetable', parsed: parseWorkbook(XLSX, workbook) });
  } catch (error) {
    self.postMessage({ error: { kind: error?.kind, message: error?.message || 'This file could not be read.' } });
  }
};
