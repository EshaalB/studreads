// A styled replacement for window.confirm, built from the app's own dialog classes.
// Resolves true or false. Escape, the backdrop and Cancel all mean no.
export const confirmAction = (message, { title = 'Are you sure?', confirmLabel = 'Continue', cancelLabel = 'Cancel', danger = false } = {}) => new Promise((resolve) => {
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="dialog dialog-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <header class="dialog-header"><h2 id="confirm-title"></h2></header>
      <div class="dialog-body"><p id="confirm-text"></p></div>
      <footer class="dialog-footer">
        <button type="button" class="btn" data-answer="no">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-answer="yes"></button>
      </footer>
    </div>`;
  overlay.querySelector('h2').textContent = title;
  overlay.querySelector('p').textContent = message;
  overlay.querySelector('[data-answer="yes"]').textContent = confirmLabel;
  overlay.querySelector('[data-answer="no"]').textContent = cancelLabel;

  const finish = (answer) => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    previousFocus?.focus?.();
    resolve(answer);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); finish(false); }
    if (event.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button')];
      const next = buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
      event.preventDefault();
      next.focus();
    }
  };
  overlay.addEventListener('click', (event) => {
    const answer = event.target.dataset?.answer;
    if (answer) finish(answer === 'yes');
    else if (event.target === overlay) finish(false);
  });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  overlay.querySelector('[data-answer="yes"]').focus();
});
