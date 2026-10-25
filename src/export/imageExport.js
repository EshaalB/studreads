import { downloadFile } from './exportUtils.js';

// Saves the planner as a PNG, with its title and the full grid.
// We put the app's CSS straight into the copy, otherwise on slow
// connections the image can come out unstyled.
const sameOriginCss = () => [...document.styleSheets].map((sheet) => {
  try {
    return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
  } catch {
    return ''; // another site's stylesheet (web fonts): its link is kept in the copy
  }
}).join('\n');

const inlineStyles = (clonedDocument, css) => {
  clonedDocument.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    if (node.tagName === 'STYLE' || new URL(node.href, window.location.href).origin === window.location.origin) node.remove();
  });
  const style = clonedDocument.createElement('style');
  style.textContent = css;
  clonedDocument.head.appendChild(style);
};

// Always draw at laptop size, so phone and desktop images look the same.
const EXPORT_WINDOW_WIDTH = 1280;
const EXPORT_WIDTH = 1100;

export const saveElementAsImage = async (element, fileName) => {
  const { default: html2canvas } = await import('html2canvas');
  const background = getComputedStyle(document.body).backgroundColor;
  const css = sameOriginCss();
  element.dataset.capturing = 'true';
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: background,
      logging: false,
      windowWidth: EXPORT_WINDOW_WIDTH,
      onclone: (clonedDocument) => {
        inlineStyles(clonedDocument, css);
        const copy = clonedDocument.querySelector('[data-capturing="true"]');
        if (!copy) return;
        copy.classList.add('is-capturing');
        const grid = copy.querySelector('.time-grid');
        copy.style.width = `${EXPORT_WIDTH}px`;
        if (grid) copy.style.width = `${Math.max(EXPORT_WIDTH, grid.scrollWidth + 48)}px`;
      }
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No image');
    downloadFile(fileName, blob);
  } finally {
    delete element.dataset.capturing;
  }
};
