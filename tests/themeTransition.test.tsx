import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTheme, applyThemeToDom } from '../src/lib/useTheme';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Lightweight hook testing harness using standard React 19 root and act
 */
function renderThemeHook() {
  const result: { current: ReturnType<typeof useTheme> } = {} as any;
  function TestHarness() {
    const themeHook = useTheme();
    React.useEffect(() => {
      result.current = themeHook;
    });
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(TestHarness));
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('DocuKit — Production-Quality Theme Transition Suite', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';

    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    delete (document as any).startViewTransition;
    vi.restoreAllMocks();
  });

  describe('1. Theme Switching and DOM Synchronization', () => {
    it('applies dark theme to document root when theme is dark', () => {
      applyThemeToDom('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('applies light theme to document root when theme is light', () => {
      applyThemeToDom('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('toggles from dark to light and updates DOM and localStorage', () => {
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('dark');

      act(() => {
        result.current[1]();
      });

      expect(result.current[0]).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('local-file-engine-theme')).toBe('light');
      unmount();
    });

    it('toggles from light to dark restoring dark colors and settings', () => {
      localStorage.setItem('local-file-engine-theme', 'light');
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('light');

      act(() => {
        result.current[1]();
      });

      expect(result.current[0]).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('local-file-engine-theme')).toBe('dark');
      unmount();
    });
  });

  describe('2. Theme Persistence & Initialization', () => {
    it('initializes from localStorage when a valid preference is stored', () => {
      localStorage.setItem('local-file-engine-theme', 'light');
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      unmount();
    });

    it('supports legacy storage keys for seamless migration', () => {
      localStorage.setItem('shrinkbyte-theme', 'light');
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('light');
      unmount();
    });

    it('defaults safely to dark mode on invalid or corrupt stored values', () => {
      localStorage.setItem('local-file-engine-theme', 'unsupported-random-mode');
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('dark');
      unmount();
    });

    it('initializes according to system preference if no stored preference exists', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-color-scheme: light'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      unmount();
    });
  });

  describe('3. View Transitions & Circular Reveal Animation', () => {
    it('uses document.startViewTransition and triggers circular clipPath animation', async () => {
      const animateMock = vi.fn().mockReturnValue({
        finished: Promise.resolve(),
        cancel: vi.fn(),
        finish: vi.fn(),
      });
      document.documentElement.animate = animateMock;

      const startViewTransitionMock = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return {
          ready: Promise.resolve(),
          finished: Promise.resolve(),
        };
      });
      (document as any).startViewTransition = startViewTransitionMock;

      const { result, unmount } = renderThemeHook();

      // Simulate click event with button rect
      const fakeEvent = {
        currentTarget: {
          getBoundingClientRect: () => ({
            left: 100,
            top: 50,
            width: 40,
            height: 40,
          }),
        },
      } as unknown as React.MouseEvent;

      await act(async () => {
        result.current[1](fakeEvent);
      });

      expect(startViewTransitionMock).toHaveBeenCalled();
      expect(result.current[0]).toBe('light');

      await act(async () => {
        await Promise.resolve();
      });

      expect(animateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          clipPath: [
            'circle(0px at 120px 70px)',
            expect.stringContaining('circle('),
          ],
        }),
        expect.objectContaining({
          duration: 750,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        })
      );
      unmount();
    });

    it('extracts coordinates safely from clientX/clientY when currentTarget is not available', async () => {
      const animateMock = vi.fn().mockReturnValue({
        finished: Promise.resolve(),
        cancel: vi.fn(),
        finish: vi.fn(),
      });
      document.documentElement.animate = animateMock;

      const startViewTransitionMock = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return {
          ready: Promise.resolve(),
          finished: Promise.resolve(),
        };
      });
      (document as any).startViewTransition = startViewTransitionMock;

      const { result, unmount } = renderThemeHook();

      const fakeMouseEvent = {
        clientX: 250,
        clientY: 150,
      } as unknown as MouseEvent;

      await act(async () => {
        result.current[1](fakeMouseEvent);
        await Promise.resolve();
      });

      expect(animateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          clipPath: [
            'circle(0px at 250px 150px)',
            expect.stringContaining('circle('),
          ],
        }),
        expect.any(Object)
      );
      unmount();
    });
  });

  describe('4. Accessibility: prefers-reduced-motion', () => {
    it('disables circular reveal and View Transition when prefers-reduced-motion is active', async () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const startViewTransitionMock = vi.fn();
      (document as any).startViewTransition = startViewTransitionMock;

      const { result, unmount } = renderThemeHook();

      act(() => {
        result.current[1]();
      });

      // View Transitions must be bypassed when user prefers reduced motion
      expect(startViewTransitionMock).not.toHaveBeenCalled();
      expect(result.current[0]).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      unmount();
    });
  });

  describe('5. Fallback Mode (No View Transitions API)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds theme-transitioning class and removes it after duration when View Transitions is unsupported', () => {
      delete (document as any).startViewTransition;

      const { result, unmount } = renderThemeHook();

      act(() => {
        result.current[1]();
      });

      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true);
      expect(result.current[0]).toBe('light');

      act(() => {
        vi.advanceTimersByTime(760);
      });

      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false);
      unmount();
    });

    it('handles rapid toggles gracefully without leaking stale transition classes', () => {
      delete (document as any).startViewTransition;

      const { result, unmount } = renderThemeHook();

      act(() => {
        result.current[1]();
        vi.advanceTimersByTime(50);
        result.current[1]();
        vi.advanceTimersByTime(50);
        result.current[1]();
        vi.advanceTimersByTime(50);
        result.current[1]();
      });

      expect(result.current[0]).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false);
      unmount();
    });
  });

  describe('6. Keyboard Shortcuts & Cleanup', () => {
    it('toggles theme when pressing D or L key outside inputs', () => {
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('dark');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
      });
      expect(result.current[0]).toBe('light');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      });
      expect(result.current[0]).toBe('dark');
      unmount();
    });

    it('ignores D and L key presses when focused inside an INPUT or TEXTAREA', () => {
      const { result, unmount } = renderThemeHook();
      expect(result.current[0]).toBe('dark');

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
      });

      expect(result.current[0]).toBe('dark');
      document.body.removeChild(input);
      unmount();
    });

    it('cleans up event listeners and ongoing transitions upon unmount', () => {
      delete (document as any).startViewTransition;

      const { result, unmount } = renderThemeHook();

      act(() => {
        result.current[1]();
      });
      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true);

      unmount();

      expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false);
    });
  });
});
