import { useCallback, useEffect, useState } from 'react';

// Screen-level navigation that works with the browser and phone back gesture.
// Each tool keeps its own step inside history.state, so the two tabs do not interfere.
export const useHistoryStep = (tool, initialStep) => {
  const [step, setStep] = useState(initialStep);

  useEffect(() => {
    const onPop = (event) => setStep(event.state?.[tool] || 'start');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tool]);

  const goTo = useCallback((next) => {
    setStep(next);
    window.history.pushState({ ...(window.history.state || {}), [tool]: next }, '');
  }, [tool]);

  const goBack = useCallback(() => {
    // Only step back through entries this app added; never leave the site.
    if (window.history.state?.[tool]) window.history.back();
    else setStep('start');
  }, [tool]);

  return [step, goTo, goBack];
};
