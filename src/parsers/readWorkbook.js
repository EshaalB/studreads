// How spreadsheets are opened, shared by the app and the tests.
// Timetables skip number formats (cellNF) because they can
// change how time slots print and hide the grid.
const isText = (name) => /\.(csv|tsv)$/i.test(name);
const readText = (XLSX, data, name) => XLSX.read(typeof data === 'string' ? data : new TextDecoder().decode(data), { type: 'string', raw: true, FS: /\.tsv$/i.test(name) ? '\t' : undefined });

export const readTimetableBook = (XLSX, data, name) => (isText(name) ? readText(XLSX, data, name) : XLSX.read(data, { type: 'array', cellDates: true }));
export const readDateSheetBook = (XLSX, data, name) => (isText(name) ? readText(XLSX, data, name) : XLSX.read(data, { type: 'array', cellNF: true }));
