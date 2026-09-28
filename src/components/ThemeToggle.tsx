import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to Light mode (L)' : 'Switch to Dark mode (D)'}
      className="relative p-2 rounded-lg border transition-all duration-300 cursor-pointer overflow-hidden group
        bg-white/80 hover:bg-slate-100 border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-sm
        dark:bg-[#131519] dark:hover:bg-[#1a1c22] dark:border-[#262932] dark:text-zinc-300 dark:hover:text-white"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {/* Sun Icon (shown in dark mode or transitioning) */}
        <Sun
          className={`w-4 h-4 text-amber-400 absolute transition-all duration-500 transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-0 pointer-events-none'
          }`}
        />

        {/* Moon Icon (shown in light mode or transitioning) */}
        <Moon
          className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute transition-all duration-500 transform ${
            !isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 rotate-90 scale-0 pointer-events-none'
          }`}
        />
      </div>

      {/* Subtle indicator ring on hover */}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};
