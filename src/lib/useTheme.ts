import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';
export type ThemeToggler = (event?: React.MouseEvent | MouseEvent) => void;

const THEME_STORAGE_KEY = 'local-file-engine-theme';
const MANUAL_OVERRIDE_KEY = 'local-file-engine-theme-manual';
const LEGACY_STORAGE_KEYS = ['shrinkbyte-theme', 'zeroupload-theme'];

/**
 * Safely applies theme class and colorScheme to document.documentElement
 */
export function applyThemeToDom(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
}

/**
 * Resolves initial theme from storage or system preference
 */
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy === 'light' || legacy === 'dark') {
          return legacy;
        }
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {
      // Storage access may fail in restricted iframes or privacy modes
    }
  }
  return 'dark'; // Default dark mode
}

export function useTheme(): [Theme, ThemeToggler] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const currentThemeRef = useRef<Theme>(theme);

  const transitionTimeoutRef = useRef<number | null>(null);
  const activeAnimationRef = useRef<Animation | null>(null);

  // Synchronize DOM, ref, and localStorage whenever theme changes
  useEffect(() => {
    currentThemeRef.current = theme;
    applyThemeToDom(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Handle storage quota or restriction gracefully
    }
  }, [theme]);

  // Listen for system color scheme changes when user hasn't explicitly set a manual preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      try {
        const hasManualOverride = localStorage.getItem(MANUAL_OVERRIDE_KEY) === 'true';
        if (!hasManualOverride) {
          const systemTheme: Theme = e.matches ? 'dark' : 'light';
          currentThemeRef.current = systemTheme;
          setTheme(systemTheme);
        }
      } catch {
        // Fallback
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else if ('addListener' in mediaQuery) {
      (mediaQuery as any).addListener(handleSystemChange);
      return () => (mediaQuery as any).removeListener(handleSystemChange);
    }
  }, []);

  // Cleanup pending transitions and animations on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('theme-transitioning');
        }
      }
      if (activeAnimationRef.current) {
        try {
          activeAnimationRef.current.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const toggleTheme = useCallback((event?: React.MouseEvent | MouseEvent) => {
    const nextTheme: Theme = currentThemeRef.current === 'dark' ? 'light' : 'dark';
    currentThemeRef.current = nextTheme;

    try {
      localStorage.setItem(MANUAL_OVERRIDE_KEY, 'true');
    } catch {
      // Ignore storage restrictions
    }

    const doc = typeof document !== 'undefined'
      ? (document as unknown as { startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> } })
      : null;

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. If View Transitions API is supported and user does not prefer reduced motion:
    // Execute a smooth circular reveal originating from the trigger button
    if (doc && typeof doc.startViewTransition === 'function' && !prefersReducedMotion) {
      // Calculate origin point: prioritize button bounding box center
      let x = window.innerWidth / 2;
      let y = 40;

      if (event) {
        const currentTarget = (event.currentTarget || event.target) as HTMLElement | null;
        if (currentTarget && typeof currentTarget.getBoundingClientRect === 'function') {
          const rect = currentTarget.getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) {
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
          }
        } else if (typeof (event as any).clientX === 'number' && (event as any).clientX > 0) {
          x = (event as any).clientX;
          y = (event as any).clientY;
        }
      }

      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      // Cancel any ongoing animation from rapid clicking
      if (activeAnimationRef.current) {
        try {
          activeAnimationRef.current.finish();
        } catch {
          // Ignore
        }
        activeAnimationRef.current = null;
      }

      // Synchronously flush state and DOM update inside the View Transition callback
      const transition = doc.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
          applyThemeToDom(nextTheme);
        });
      });

      transition.ready
        .then(() => {
          const anim = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 750,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );

          activeAnimationRef.current = anim;
          anim.finished.finally(() => {
            if (activeAnimationRef.current === anim) {
              activeAnimationRef.current = null;
            }
          });
        })
        .catch(() => {
          // Fallback silently if transition was cancelled by rapid interactions
        });
    } else {
      // 2. Fallback mode: No View Transitions or reduced motion
      if (prefersReducedMotion) {
        // Immediate clean switch without spatial or harsh animation
        setTheme(nextTheme);
        applyThemeToDom(nextTheme);
      } else {
        // Controlled, non-spatial 700ms smooth CSS transition
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }

        document.documentElement.classList.add('theme-transitioning');
        setTheme(nextTheme);
        applyThemeToDom(nextTheme);

        transitionTimeoutRef.current = window.setTimeout(() => {
          document.documentElement.classList.remove('theme-transitioning');
          transitionTimeoutRef.current = null;
        }, 750);
      }
    }
  }, []);

  // Keyboard shortcut listener (press 'D' or 'L' when not inside a form control)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) ||
          (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === 'd' || e.key === 'D' || e.key === 'l' || e.key === 'L') {
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  return [theme, toggleTheme];
}

