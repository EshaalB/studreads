import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ImportError } from './importError.js';
import { readPdfText } from './pdfText.js';
import { timetableFromPdf } from './pdfTimetable.js';
import { joinSpacedWords, locateInScan } from './scanLocate.js';
import { docxXmlToRows, extractExams, positionedItemsToRows, textToRows } from './examParser.js';

export const EXAM_FILE_ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.docx,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/*';
const MAX_EXAM_FILE_SIZE = 25 * 1024 * 1024;
const MAX_OCR_PAGES = 20;
const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];

// Each loader returns { records, hasAmbiguousDates, note, readAs }.
// note: a warning to show (e.g. read by OCR). readAs: re-read with a different date order.
// scan: OCR words and page images, to show each exam on the page.
const fromRows = (rows, source, note = '', scan = null) => {
  const read = (options) => {
    const { records } = extractExams(rows, source, options);
    return scan ? locateInScan(records, scan.words) : records;
  };
  const result = extractExams(rows, source);
  return { records: read(), hasAmbiguousDates: result.ambiguousDates, note, readAs: read, scans: scan?.pages || [] };
};

const noExamsError = (kind) => new ImportError('empty', `No exams with a recognisable date were found in this ${kind}. Try pasting the text instead, or check that the dates are visible.`);

// OCR runs in a web worker. It downloads about 4 MB the first time;
// the image never leaves the browser.
const recognise = async (images, onProgress, signal) => {
  const { createWorker } = await import('tesseract.js');
  let current = 1;
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        const page = images.length > 1 ? `page ${current} of ${images.length}, ` : '';
        onProgress?.(`Recognising text (${page}${Math.round(message.progress * 100)}%)`);
      } else if (message.status?.startsWith('loading')) {
        onProgress?.('Loading text recognition');
      }
    }
  });

  const stop = () => worker.terminate();
  signal?.addEventListener('abort', stop);
  try {
    const items = [];
    const words = [];
    let offset = 0;
    for (const [page, image] of images.entries()) {
      signal?.throwIfAborted();
      const { data } = await worker.recognize(image.source);
      const pageWords = (data.words || []).filter((word) => word.confidence > 25).map((word) => ({
        text: word.text, page, x: word.bbox.x0, y: word.bbox.y0, width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0
      }));
      words.push(...pageWords);
      joinSpacedWords(pageWords).forEach((phrase) => items.push({ ...phrase, y: phrase.y + offset }));
      offset += image.height + 100;
      current += 1;
    }
    signal?.throwIfAborted();
    return { rows: positionedItemsToRows(items), words };
  } finally {
    signal?.removeEventListener('abort', stop);
    await worker.terminate();
  }
};

const imageSize = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
  image.onerror = () => { resolve({ width: 2000, height: 2000 }); URL.revokeObjectURL(url); };
  image.src = url;
});

const loadImage = async (file, onProgress, signal) => {
  const size = await imageSize(file);
  const { rows, words } = await recognise([{ source: file, height: size.height }], onProgress, signal);
  const pages = [{ url: URL.createObjectURL(file), ...size }];
  const result = fromRows(rows, file.name, 'Read with text recognition. Check names and times against the original.', { words, pages });
  if (result.records.length === 0) throw noExamsError('image');
  return result;
};

const openPdf = async (buffer, onProgress) => {
  onProgress?.('Opening PDF');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  try {
    return { pdfjs, pdf: await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise };
  } catch (error) {
    if (error?.name === 'PasswordException') throw new ImportError('invalid', 'This PDF is password protected. Remove the password and try again.');
    throw new ImportError('invalid', 'This PDF could not be opened. It may be damaged.');
  }
};

// Class timetable from a PDF (see pdfTimetable.js).
export const readTimetablePdf = async (file, onProgress, signal) => {
  if (file.size > MAX_EXAM_FILE_SIZE) throw new ImportError('invalid', 'The file must be smaller than 25 MB.');
  const { pdfjs, pdf } = await openPdf(await file.arrayBuffer(), onProgress);
  try {
    const { items, characters, lines } = await readPdfText(pdfjs, pdf, { onProgress, signal, lines: true });
    if (characters < 30) throw new ImportError('unsupported', 'This PDF is scanned, so its timetable cannot be read. Upload the Excel file, or a PDF saved from it.');
    const parsed = timetableFromPdf({ rows: positionedItemsToRows(items), lines });
    if (!parsed) throw new ImportError('empty', 'No timetable grid was found in this PDF. It needs class times across the top and days down the side.');
    return parsed;
  } finally {
    pdf.loadingTask.destroy();
  }
};

const loadPdf = async (buffer, fileName, onProgress, signal) => {
  const { pdfjs, pdf } = await openPdf(buffer, onProgress);

  try {
    const { items, characters } = await readPdfText(pdfjs, pdf, { onProgress, signal });

    if (characters >= 30 * Math.min(pdf.numPages, 3)) {
      const result = fromRows(positionedItemsToRows(items), fileName);
      if (result.records.length > 0) return result;
    }

    // Scanned PDF: turn each page into an image and OCR it.
    const pages = Math.min(pdf.numPages, MAX_OCR_PAGES);
    const images = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      signal?.throwIfAborted();
      onProgress?.(`Preparing page ${pageNumber} of ${pages}`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
      images.push({ source: canvas, height: canvas.height });
    }
    const skipped = pdf.numPages > MAX_OCR_PAGES ? ` Only the first ${MAX_OCR_PAGES} pages were read.` : '';
    const { rows, words } = await recognise(images, onProgress, signal);
    const pageImages = await Promise.all(images.map(async ({ source }) => ({ url: URL.createObjectURL(await new Promise((resolve) => source.toBlob(resolve))), width: source.width, height: source.height })));
    const result = fromRows(rows, fileName, `This PDF is scanned, so it was read with text recognition. Check names and times against the original.${skipped}`, { words, pages: pageImages });
    if (result.records.length === 0) throw noExamsError('PDF');
    return result;
  } finally {
    pdf.loadingTask.destroy();
  }
};

const loadDocx = async (buffer, fileName) => {
  const XLSX = await import('xlsx');
  const zip = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' });
  const entry = XLSX.CFB.find(zip, '/word/document.xml');
  if (!entry) throw new ImportError('invalid', 'This Word file could not be read. Save it as .docx or PDF and try again.');
  const result = fromRows(docxXmlToRows(new TextDecoder().decode(entry.content)), fileName);
  if (result.records.length === 0) throw noExamsError('document');
  return result;
};

export const readExamText = (text, source = 'Pasted text') => {
  const result = fromRows(textToRows(text), source);
  if (result.records.length === 0) throw noExamsError('text');
  return result;
};

export const readExamFile = async (file, onProgress, signal) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_EXAM_FILE_SIZE) throw new ImportError('invalid', 'The file must be smaller than 25 MB.');
  if (extension === 'doc') throw new ImportError('unsupported', 'Older .doc files are not supported. Save it as .docx or PDF first.');

  if (IMAGES.includes(extension) || file.type.startsWith('image/')) return loadImage(file, onProgress, signal);

  const buffer = await file.arrayBuffer();
  if (extension === 'pdf' || file.type === 'application/pdf') return loadPdf(buffer, file.name, onProgress, signal);
  if (extension === 'docx') return loadDocx(buffer, file.name);
  if (extension === 'txt') return readExamText(new TextDecoder().decode(buffer), file.name);
  throw new ImportError('unsupported', 'Choose a PDF, Excel, CSV, Word or image file.');
};
