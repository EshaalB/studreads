import { CalendarPlus, Check, FileSearch, Search, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseExamMatrix, parseExamWorkbook } from '../utils/examParser';
import { parseTime } from '../utils/timeUtils';

const MAX_EXAM_FILE_SIZE = 15 * 1024 * 1024;

const groupPdfItemsIntoRows = (items) => {
  const rows = new Map();
  items.forEach((item) => {
    const y = Math.round((item.transform?.[5] || 0) / 3) * 3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: item.transform?.[4] || 0, text: item.str });
  });
  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text.trim()).filter(Boolean));
};

const formatExamDate = (isoDate) => new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
}).format(new Date(`${isoDate}T00:00:00Z`));

const calendarTime = (time) => {
  const minutes = parseTime(time);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}00`;
};

const escapeCalendarText = (value) => String(value || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

const ExamFinder = () => {
  const inputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => [record.subject, record.code, record.program, record.room]
      .some((value) => value?.toLowerCase().includes(term)));
  }, [query, records]);

  const selectedRecords = useMemo(() => records.filter((record) => selectedIds.includes(record.id)), [records, selectedIds]);

  const nextExam = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return selectedRecords.find((record) => record.date >= today) || null;
  }, [selectedRecords]);

  const loadPdf = async (buffer, fileName) => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const parsed = [];
    let textItems = 0;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      textItems += content.items.length;
      parsed.push(...parseExamMatrix(groupPdfItemsIntoRows(content.items), `${fileName}, page ${pageNumber}`));
    }

    if (textItems === 0) throw new Error('This PDF appears to be scanned. Export a text-based PDF or upload the Excel date sheet instead.');
    if (parsed.length === 0) throw new Error('The PDF contains text, but no dated exam rows could be identified.');
    return { records: parsed, source: `${document.numPages} PDF page${document.numPages === 1 ? '' : 's'}`, warnings: [] };
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'xlsx', 'xls'].includes(extension)) {
      setError('Choose a PDF, XLSX or XLS exam date sheet.');
      return;
    }
    if (file.size > MAX_EXAM_FILE_SIZE) {
      setError('The exam file must be smaller than 15 MB.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      let result;
      if (extension === 'pdf') {
        result = await loadPdf(buffer, file.name);
      } else {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        result = parseExamWorkbook(XLSX, workbook);
      }
      setRecords(result.records);
      setSelectedIds([]);
      setQuery('');
      setFileInfo({ name: file.name, source: result.source, warnings: result.warnings });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The exam date sheet could not be read.');
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggleExam = (id) => setSelectedIds((current) => current.includes(id)
    ? current.filter((selectedId) => selectedId !== id)
    : [...current, id]);

  const exportCalendar = () => {
    if (selectedRecords.length === 0) return;
    const events = selectedRecords.map((record) => {
      const compactDate = record.date.replaceAll('-', '');
      const [startText = '', endText = ''] = record.time.split(/\s*(?:-|to|–)\s*/i);
      const start = calendarTime(startText);
      const end = calendarTime(endText);
      const timing = start ? `DTSTART:${compactDate}T${start}\r\n${end ? `DTEND:${compactDate}T${end}` : ''}` : `DTSTART;VALUE=DATE:${compactDate}`;
      return [
        'BEGIN:VEVENT',
        `UID:${escapeCalendarText(record.id)}@studreads`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
        timing,
        `SUMMARY:${escapeCalendarText(`Exam: ${record.code || record.subject}`)}`,
        `DESCRIPTION:${escapeCalendarText(record.subject)}`,
        record.room ? `LOCATION:${escapeCalendarText(record.room)}` : '',
        'END:VEVENT'
      ].filter(Boolean).join('\r\n');
    }).join('\r\n');
    const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//StudReads//Exam Finder//EN\r\n${events}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'my-exams.ics';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const reset = () => {
    setRecords([]);
    setSelectedIds([]);
    setQuery('');
    setError('');
    setFileInfo(null);
  };

  return (
    <main className="exam-workspace" id="main-content">
      <header className="workspace-header">
        <div>
          <h1>Find your exams</h1>
          <p>Upload the official date sheet, search for subjects, then save your own exam list.</p>
        </div>
        {records.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Start over</button>}
      </header>

      <input ref={inputRef} type="file" hidden accept=".pdf,.xlsx,.xls" onChange={handleFile} aria-label="Upload exam date sheet" />

      {records.length === 0 ? (
        <section className="exam-upload">
          <FileSearch size={34} />
          <div>
            <h2>{isLoading ? 'Reading the date sheet…' : 'Upload an exam date sheet'}</h2>
            <p>Text-based PDF, XLSX or XLS. Scanned PDFs are not supported yet.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={isLoading}>
            <Upload size={16} /> {isLoading ? 'Reading…' : 'Choose file'}
          </button>
          {error && <p className="error-banner" role="alert">{error}</p>}
        </section>
      ) : (
        <div className="exam-layout">
          <section className="exam-results" aria-labelledby="exam-results-title">
            <div className="exam-results-header">
              <div>
                <h2 id="exam-results-title">{fileInfo.name}</h2>
                <p>{records.length} exams found in {fileInfo.source}</p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()}>Change file</button>
            </div>
            {fileInfo.warnings.map((warning) => <p className="import-notes" key={warning}>{warning}</p>)}
            <label className="exam-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, code, programme or room" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear exam search"><X size={15} /></button>}
            </label>

            <div className="exam-result-list">
              {filteredRecords.map((record) => {
                const selected = selectedIds.includes(record.id);
                return (
                  <button type="button" className={`exam-result ${selected ? 'is-selected' : ''}`} key={record.id} onClick={() => toggleExam(record.id)} aria-pressed={selected}>
                    <span className="exam-check">{selected && <Check size={14} />}</span>
                    <span className="exam-result-main"><strong>{record.subject}</strong><small>{[record.code, record.program].filter(Boolean).join(' · ')}</small></span>
                    <span className="exam-result-date"><strong>{formatExamDate(record.date)}</strong><small>{record.time || 'Time not listed'}</small></span>
                    <span className="exam-result-room">{record.room || 'Room not listed'}</span>
                  </button>
                );
              })}
              {filteredRecords.length === 0 && <p className="exam-empty">No exams match “{query}”. Try the course code or a shorter subject name.</p>}
            </div>
          </section>

          <aside className="my-exams" aria-labelledby="my-exams-title">
            <div className="my-exams-header">
              <div><h2 id="my-exams-title">My exams</h2><p>{selectedRecords.length} selected</p></div>
              <button type="button" className="btn btn-primary btn-sm" onClick={exportCalendar} disabled={selectedRecords.length === 0}><CalendarPlus size={15} /> Add to calendar</button>
            </div>
            {nextExam && <div className="next-exam"><span>Next exam</span><strong>{nextExam.code || nextExam.subject}</strong><small>{formatExamDate(nextExam.date)} · {nextExam.time || 'Time not listed'}</small></div>}
            {selectedRecords.length > 0 ? (
              <ol className="my-exam-list">
                {selectedRecords.map((record) => <li key={record.id}><time dateTime={record.date}>{formatExamDate(record.date)}</time><strong>{record.code || record.subject}</strong><span>{record.time || 'Time not listed'}</span></li>)}
              </ol>
            ) : <p className="exam-empty">Select subjects from the results to build your exam list.</p>}
          </aside>
        </div>
      )}
    </main>
  );
};

export default ExamFinder;
