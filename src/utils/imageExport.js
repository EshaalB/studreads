import { downloadFile } from './exportUtils.js';

// Saves an on-screen element as a PNG, exactly as it looks (theme, colours, view).
// Two adjustments are made to the copy being drawn: the heading marked .capture-head
// (hidden on screen, shown when printing) is revealed, and a horizontally scrolled grid
// is widened so the whole week or every exam date is in the picture.
export const saveElementAsImage = async (element, fileName) => {
  const { default: html2canvas } = await import('html2canvas');
  const background = getComputedStyle(document.body).backgroundColor;
  element.dataset.capturing = 'true';
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: background,
      logging: false,
      onclone: (clonedDocument) => {
        const copy = clonedDocument.querySelector('[data-capturing="true"]');
        if (!copy) return;
        copy.classList.add('is-capturing');
        const grid = copy.querySelector('.time-grid');
        if (grid) copy.style.width = `${Math.max(copy.offsetWidth, grid.scrollWidth + 48)}px`;
      }
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No image');
    downloadFile(fileName, blob);
  } finally {
    delete element.dataset.capturing;
  }
};
