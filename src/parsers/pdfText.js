// Reads the text of a PDF with positions. pdf.js is passed in so the app
// and the Node scripts can both use this.
// With `lines`, it also returns vertical lines drawn on the page
// (cell edges in aSc timetables).
export const readPdfText = async (pdfjs, pdf, { onProgress, signal, lines: withLines = false } = {}) => {
  const items = [];
  const lines = [];
  let offset = 0;
  let characters = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    signal?.throwIfAborted();
    onProgress?.(`Reading page ${pageNumber} of ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    content.items.forEach((item) => {
      if (!item.str?.trim()) return;
      // Handles rotated (landscape) pages.
      const matrix = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(matrix[2], matrix[3]) || item.height || 10;
      characters += item.str.trim().length;
      items.push({ text: item.str, x: matrix[4], y: matrix[5] - height + offset, width: item.width * viewport.scale, height, page: pageNumber - 1 });
    });
    if (withLines) lines.push(...await verticalRules(pdfjs, page, viewport, offset));
    offset += viewport.height + 40;
  }
  return { items, characters, lines };
};

// Vertical lines on a page, in the same coordinates as the text.
const apply = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f];
const verticalRules = async (pdfjs, page, viewport, offset) => {
  const { OPS, Util } = pdfjs;
  const { fnArray, argsArray } = await page.getOperatorList();
  const rules = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  fnArray.forEach((fn, index) => {
    const args = argsArray[index];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
    else if (fn === OPS.constructPath) {
      const box = args?.[2];
      if (!box || box.length < 4) return;
      const toPage = Util.transform(viewport.transform, ctm);
      const [x1, y1] = apply(toPage, box[0], box[1]);
      const [x2, y2] = apply(toPage, box[2], box[3]);
      if (Math.abs(x1 - x2) < 1.5 && Math.abs(y1 - y2) > 5) {
        rules.push({ x: (x1 + x2) / 2, top: Math.min(y1, y2) + offset, bottom: Math.max(y1, y2) + offset, page: page.pageNumber - 1 });
      }
    }
  });
  return rules;
};
