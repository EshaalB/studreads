export const showError = (message) => {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'app-toast app-toast-error';
  errorDiv.textContent = message;
  errorDiv.setAttribute('role', 'alert');

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(errorDiv);
    }, 300);
  }, 5000);
};
export const showSuccess = (message) => {
const successDiv = document.createElement('div');
  successDiv.className = 'app-toast app-toast-success';
  successDiv.textContent = message;
  successDiv.setAttribute('role', 'status');
  successDiv.setAttribute('aria-live', 'polite');

  document.body.appendChild(successDiv);

  setTimeout(() => {
    successDiv.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(successDiv);
    }, 300);
  }, 3000);
};
