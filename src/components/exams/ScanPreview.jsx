// The scanned page an exam was read from, with the line it came from highlighted.
import { useEffect, useRef } from 'react';
import Dialog from '../ui/Dialog';

const percent = (part, whole) => `${(part / whole) * 100}%`;

const ScanPreview = ({ exam, page, onClose }) => {
  const markRef = useRef(null);
  const { x, y, width, height } = exam.scan;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <Dialog isOpen onClose={onClose} title={`${exam.subject} in the scan`} width={760}>
      <div className="scan-preview">
        <img src={page.url} alt={`Scanned page showing ${exam.subject}`} />
        <span
          ref={markRef}
          className="scan-mark"
          style={{ left: percent(x, page.width), top: percent(y, page.height), width: percent(width, page.width), height: percent(height, page.height) }}
          aria-hidden="true"
        />
      </div>
    </Dialog>
  );
};

export default ScanPreview;
