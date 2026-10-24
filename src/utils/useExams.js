import { useCallback, useEffect, useMemo, useState } from 'react';
import { showSuccess } from './errorHandler.js';
import { formatClock } from './examParser.js';
import { readStored, writeStored } from './storage.js';

const STORAGE_KEY = 'studreads_exams_v1';

export const isAddedByHand = (record) => record.source === 'Added by you';
export const byDateAndTime = (a, b) => a.date.localeCompare(b.date) || (a.start ?? 0) - (b.start ?? 0);

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Exams on the same day whose times overlap (or whose time is unknown).
const findClashes = (records) => {
  const clashes = new Set();
  records.forEach((a, index) => records.slice(index + 1).forEach((b) => {
    if (a.date !== b.date) return;
    const overlap = a.start === null || b.start === null || (a.start < (b.end ?? b.start + 180) && b.start < (a.end ?? a.start + 180));
    if (overlap) { clashes.add(a.id); clashes.add(b.id); }
  }));
  return clashes;
};

/**
 * The exam side of the planner: every exam found in the uploaded date sheet (records),
 * the ones the student picked (mine), and exams they typed in themselves.
 */
export const useExams = () => {
  const [saved] = useState(() => readStored(STORAGE_KEY, { records: [], selectedIds: [], fileInfo: null }));
  const [records, setRecords] = useState(Array.isArray(saved.records) ? saved.records : []);
  const [selectedIds, setSelectedIds] = useState(Array.isArray(saved.selectedIds) ? saved.selectedIds : []);
  const [fileInfo, setFileInfo] = useState(saved.fileInfo || null);

  useEffect(() => {
    writeStored(STORAGE_KEY, records.length ? { records, selectedIds, fileInfo } : null);
  }, [records, selectedIds, fileInfo]);

  const mine = useMemo(() => records.filter((record) => selectedIds.includes(record.id)).sort(byDateAndTime), [records, selectedIds]);
  const clashes = useMemo(() => findClashes(mine), [mine]);
  const nextExam = mine.find((record) => record.date >= todayIso()) || null;

  // A new date sheet replaces the old one, but exams typed in by hand are kept.
  const loadDateSheet = useCallback((nextRecords, info, selected = []) => {
    setRecords((current) => [...current.filter(isAddedByHand), ...nextRecords].sort(byDateAndTime));
    setSelectedIds((current) => [...current.filter((id) => records.some((record) => record.id === id && isAddedByHand(record))), ...selected]);
    setFileInfo(info);
  }, [records]);

  const setPicked = useCallback((ids) => setSelectedIds((current) => {
    const manual = current.filter((id) => records.some((record) => record.id === id && isAddedByHand(record)));
    return [...new Set([...manual, ...ids])];
  }), [records]);

  const saveExam = useCallback((values, editing) => {
    const time = values.start !== null ? (values.end !== null ? `${formatClock(values.start)} – ${formatClock(values.end)}` : formatClock(values.start)) : '';
    const record = {
      ...editing,
      id: editing.id || `manual-${Date.now()}`,
      subject: values.subject.trim() || values.code.trim(),
      code: values.code.trim(),
      date: values.date,
      day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${values.date}T00:00:00Z`)),
      time,
      start: values.start,
      end: values.end,
      room: values.room.trim(),
      program: editing.program || '',
      source: editing.source || 'Added by you'
    };
    setRecords((current) => (editing.id ? current.map((item) => (item.id === record.id ? record : item)) : [...current, record]).sort(byDateAndTime));
    setSelectedIds((current) => (current.includes(record.id) ? current : [...current, record.id]));
  }, []);

  // Exams from the date sheet leave the list but stay pickable; typed-in exams are deleted.
  const removeExam = useCallback((id) => {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    setSelectedIds((current) => current.filter((item) => item !== id));
    if (isAddedByHand(record)) setRecords((current) => current.filter((item) => item.id !== id));
    showSuccess(`Removed ${record.subject}.`, {
      label: 'Undo',
      onClick: () => {
        if (isAddedByHand(record)) setRecords((current) => [...current.filter((item) => item.id !== id), record].sort(byDateAndTime));
        setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
      }
    });
  }, [records]);

  const clearExams = useCallback(() => {
    const previous = { records, selectedIds, fileInfo };
    setRecords([]);
    setSelectedIds([]);
    setFileInfo(null);
    showSuccess('Removed your exams.', { label: 'Undo', onClick: () => { setRecords(previous.records); setSelectedIds(previous.selectedIds); setFileInfo(previous.fileInfo); } });
  }, [records, selectedIds, fileInfo]);

  return { records, mine, selectedIds, fileInfo, clashes, nextExam, loadDateSheet, setPicked, saveExam, removeExam, clearExams };
};
