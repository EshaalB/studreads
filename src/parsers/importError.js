// Import failures the student can act on, by kind: 'unsupported' (file type), 'invalid'
// (too large, damaged or locked) or 'empty' (nothing usable found). Any other error thrown
// while reading a file is unexpected and shown as a general failure.
export class ImportError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'ImportError';
    this.kind = kind;
  }
}

export const describeImportFailure = (error) => (error?.kind
  ? error.message
  : 'Something went wrong while reading this file. Try again, or paste the text instead.');
