// Hands a spreadsheet to the reading worker and waits for the result. Cancelling stops the
// worker at once; every worker is closed when its answer arrives.
import { ImportError } from './importError.js';

const MAX_SPREADSHEET_SIZE = 25 * 1024 * 1024;

export const readSpreadsheet = (file, { kind, dayFirst, signal }) => {
  if (file.size > MAX_SPREADSHEET_SIZE) return Promise.reject(new ImportError('invalid', 'The file must be smaller than 25 MB.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./spreadsheetWorker.js', import.meta.url), { type: 'module' });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { finish(); reject(signal.reason); };
    signal?.addEventListener('abort', onAbort);
    worker.onmessage = ({ data }) => {
      finish();
      if (!data.error) resolve(data);
      else reject(data.error.kind ? new ImportError(data.error.kind, data.error.message) : new Error(data.error.message));
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message)); };
    file.arrayBuffer().then((buffer) => worker.postMessage({ buffer, name: file.name, kind, dayFirst }, [buffer]), (error) => { finish(); reject(error); });
  });
};
