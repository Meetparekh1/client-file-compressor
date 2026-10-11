import { useState, useEffect, useCallback } from 'react';

export type UiMode = 'classic' | 'glassy';

export function useUiMode(): [UiMode, (mode: UiMode) => void] {
  const [uiMode, setUiMode] = useState<UiMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docukit-ui-mode');
      if (stored === 'classic' || stored === 'glassy') {
        return stored;
      }
    }
    return 'glassy'; // Default to glassy on fresh installation
  });

  useEffect(() => {
    const root = document.documentElement;
    if (uiMode === 'glassy') {
      root.classList.add('theme-glassy');
      root.classList.remove('theme-classic');
    } else {
      root.classList.add('theme-classic');
      root.classList.remove('theme-glassy');
    }
    localStorage.setItem('docukit-ui-mode', uiMode);
  }, [uiMode]);

  const changeUiMode = useCallback((newMode: UiMode) => {
    // Add transition class to body for smooth morphing
    document.body.classList.add('theme-transitioning');
    setUiMode(newMode);
    
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
    }, 500); // Wait for transitions to finish
  }, []);

  return [uiMode, changeUiMode];
}
