const showToast = (message, { tone, duration }) => {
  document.querySelectorAll('.app-toast').forEach((toast) => toast.remove());
  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${tone}`;
  toast.textContent = message;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  }, duration);
};

export const showError = (message) => showToast(message, { tone: 'error', duration: 5000 });
export const showSuccess = (message) => showToast(message, { tone: 'success', duration: 3200 });
