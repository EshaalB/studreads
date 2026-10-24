import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { docxXmlToRows, extractExams, parseExamWorkbook, positionedItemsToRows, textToRows } from './examParser.js';

export const EXAM_FILE_ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.docx,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/*';
const MAX_EXAM_FILE_SIZE = 25 * 1024 * 1024;
const MAX_OCR_PAGES = 20;
const SPREADSHEETS = ['xlsx', 'xls', 'xlsm', 'ods'];
const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];

const fromRows = (rows, source) => {
  const result = extractExams(rows, source);
  return { records: result.records, hasAmbiguousDates: result.ambiguousDates };
};

const noExamsError = (kind) => new Error(`No exams with a recognisable date were found in this ${kind}. Try pasting the text instead, or check that the dates are visible.`);

// OCR runs in a web worker. The engine and English language data (about 4 MB) are
// downloaded on first use; the image itself never leaves the browser.
const recognise = async (images, onProgress) => {
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

  try {
    const items = [];
    let offset = 0;
    for (const image of images) {
      const { data } = await worker.recognize(image.source);
      (data.words || []).filter((word) => word.confidence > 25).forEach((word) => {
        items.push({
          text: word.text,
          x: word.bbox.x0,
          y: word.bbox.y0 + offset,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0
        });
      });
      offset += image.height + 100;
      current += 1;
    }
    return positionedItemsToRows(items);
  } finally {
    await worker.terminate();
  }
};

const imageSize = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { resolve(image.naturalHeight); URL.revokeObjectURL(url); };
  image.onerror = () => { resolve(2000); URL.revokeObjectURL(url); };
  image.src = url;
});

const loadImage = async (file, onProgress) => {
  const rows = await recognise([{ source: file, height: await imageSize(file) }], onProgress);
  const result = fromRows(rows, file.name);
  if (result.records.length === 0) throw noExamsError('image');
  return { ...result, source: 'text recognition', warnings: ['Read with text recognition. Check names and times against the original.'] };
};

const loadPdf = async (buffer, fileName, onProgress) => {
  onProgress?.('Opening PDF');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (error) {
    if (error?.name === 'PasswordException') throw new Error('This PDF is password protected. Remove the password and try again.');
    throw new Error('This PDF could not be opened. It may be damaged.');
  }

  const items = [];
  let offset = 0;
  let characters = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.(`Reading page ${pageNumber} of ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      if (!item.str?.trim()) return;
      // Map into viewport space so rotated (landscape) pages read left to right.
      const matrix = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(matrix[2], matrix[3]) || item.height || 10;
      characters += item.str.trim().length;
      items.push({ text: item.str, x: matrix[4], y: matrix[5] - height + offset, width: item.width * viewport.scale, height });
    });
    offset += viewport.height + 40;
  }

  const pageLabel = `${pdf.numPages} PDF page${pdf.numPages === 1 ? '' : 's'}`;
  if (characters >= 30 * Math.min(pdf.numPages, 3)) {
    const result = fromRows(positionedItemsToRows(items), fileName);
    if (result.records.length > 0) return { ...result, source: pageLabel, warnings: [] };
  }

  // Scanned or image-only PDF: render each page and read it with OCR.
  const pages = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const images = [];
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    onProgress?.(`Preparing page ${pageNumber} of ${pages}`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
    images.push({ source: canvas, height: canvas.height });
  }
  const result = fromRows(await recognise(images, onProgress), fileName);
  if (result.records.length === 0) throw noExamsError('PDF');
  return {
    ...result,
    source: `${pageLabel}, text recognition`,
    warnings: [
      'This PDF is scanned, so it was read with text recognition. Check names and times against the original.',
      ...(pdf.numPages > MAX_OCR_PAGES ? [`Only the first ${MAX_OCR_PAGES} pages were read.`] : [])
    ]
  };
};

const loadDocx = async (buffer, fileName) => {
  const XLSX = await import('xlsx');
  const zip = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' });
  const entry = XLSX.CFB.find(zip, '/word/document.xml');
  if (!entry) throw new Error('This Word file could not be read. Save it as .docx or PDF and try again.');
  const result = fromRows(docxXmlToRows(new TextDecoder().decode(entry.content)), fileName);
  if (result.records.length === 0) throw noExamsError('document');
  return { ...result, source: 'Word document', warnings: [] };
};

const loadSpreadsheet = async (buffer, extension) => {
  const XLSX = await import('xlsx');
  const workbook = ['csv', 'tsv'].includes(extension)
    ? XLSX.read(new TextDecoder().decode(buffer), { type: 'string', raw: true, FS: extension === 'tsv' ? '\t' : undefined })
    : XLSX.read(buffer, { type: 'array', cellNF: true });
  return parseExamWorkbook(XLSX, workbook);
};

export const readExamText = (text, source = 'Pasted text') => {
  const result = fromRows(textToRows(text), source);
  if (result.records.length === 0) throw noExamsError('text');
  return { ...result, source: 'pasted text', warnings: [] };
};

export const readExamFile = async (file, onProgress) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_EXAM_FILE_SIZE) throw new Error('The file must be smaller than 25 MB.');
  if (extension === 'doc') throw new Error('Older .doc files are not supported. Save it as .docx or PDF first.');

  if (IMAGES.includes(extension) || file.type.startsWith('image/')) return loadImage(file, onProgress);

  const buffer = await file.arrayBuffer();
  if (extension === 'pdf' || file.type === 'application/pdf') return loadPdf(buffer, file.name, onProgress);
  if (extension === 'docx') return loadDocx(buffer, file.name);
  if (extension === 'txt') return readExamText(new TextDecoder().decode(buffer), file.name);
  if (SPREADSHEETS.includes(extension) || ['csv', 'tsv'].includes(extension)) return loadSpreadsheet(buffer, extension);
  throw new Error('Choose a PDF, Excel, CSV, Word or image file.');
};
