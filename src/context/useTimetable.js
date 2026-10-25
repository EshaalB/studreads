import { createContext, useContext } from 'react';

export const TimetableContext = createContext(null);

export const useTimetable = () => {
  const context = useContext(TimetableContext);
  if (!context) throw new Error('useTimetable must be used inside TimetableProvider');
  return context;
};
