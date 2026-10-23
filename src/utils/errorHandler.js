// Small toast messages. An optional action (e.g. Undo) turns the toast into a button bar.
const showToast = (message, { tone, duration, action }) => {
  document.querySelectorAll('.app-toast').forEach((toast) => toast.remove());
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  };

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => { action.onClick(); dismiss(); });
    toast.appendChild(button);
  }

  document.body.appendChild(toast);
  timer = setTimeout(dismiss, action ? Math.max(duration, 6000) : duration);
};

export const showError = (message) => showToast(message, { tone: 'error', duration: 5000 });
export const showSuccess = (message, action) => showToast(message, { tone: 'success', duration: 3200, action });
