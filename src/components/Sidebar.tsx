import React, { useState, useEffect } from 'react';
import { 
  Home,
  Clock,
  Heart,
  Info,
  Moon,
  Sun,
  ShieldCheck,
  X
} from 'lucide-react';
import type { ToolCategory } from '../lib/toolsRegistry';
import type { UiMode } from '../lib/useUiMode';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  selectedCategory: ToolCategory;
  onSelectCategory: (cat: ToolCategory) => void;
  theme: string;
  onToggleTheme: (event?: React.MouseEvent) => void;
  uiMode?: UiMode;
  onChangeUiMode?: (mode: UiMode) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  selectedCategory,
  onSelectCategory,
  theme,
  onToggleTheme,
  uiMode: _uiMode,
  onChangeUiMode: _onChangeUiMode,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAboutOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNav = (action: () => void) => {
    action();
    if (onCloseMobile) onCloseMobile();
  };

  const handleHomeClick = () => {
    handleNav(() => {
      onSelectCategory('all');
      onSelectView('dashboard');
    });
  };

  const handleRecentFilesClick = () => {
    handleNav(() => {
      onSelectView('history');
    });
  };

  const handleFavoritesClick = () => {
    handleNav(() => {
      onSelectCategory('favorites' as any);
      onSelectView('dashboard');
    });
  };

  const isHomeActive = activeView === 'dashboard' && (selectedCategory as string) !== 'favorites';
  const isFavoritesActive = activeView === 'dashboard' && (selectedCategory as string) === 'favorites';
  const isHistoryActive = activeView === 'history';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:sticky z-50 md:z-20 top-0 md:top-0 left-0
          h-full md:h-screen w-72 md:w-[272px] lg:w-[280px] shrink-0
          flex flex-col justify-between p-4 md:p-5
          rounded-3xl
          bg-white dark:bg-[#0e121a] border border-stone-200/80 dark:border-[#1d2330] shadow-2xl md:shadow-none
          transition-transform duration-300 ease-in-out md:translate-x-0 md:transform-none md:self-start
          overflow-y-auto scrollbar-none
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* 1. ShrinkByte Branding Header matching screenshot */}
          <div className="flex items-center justify-between px-1 pt-1 shrink-0">
            <div 
              onClick={handleHomeClick}
              className="flex items-center gap-3 cursor-pointer group"
            >
              {/* Stylized Logo Icon */}
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-[#0c1424] flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-5 h-5 text-sky-400"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 14h6v6" />
                    <path d="M20 10h-6V4" />
                    <path d="M14 10l7-7" />
                    <path d="M3 21l7-7" />
                  </svg>
                </div>
              </div>

              {/* Brand Typography */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg tracking-tight text-stone-900 dark:text-white">
                    <span className="text-[#f97316]">Shrink</span>
                    <span className="text-[#8b5cf6]">Byte</span>
                  </span>
                </div>
                <span className="block text-[10px] font-medium text-stone-400 dark:text-zinc-500 truncate -mt-0.5">
                  Document Tools for Everyone
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-[#1b212c]"
                aria-label="Close Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 2. Primary Navigation Links */}
          <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {/* Home */}
            <button
              type="button"
              onClick={handleHomeClick}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isHomeActive
                  ? 'bg-[#ebf3ff] text-[#2563eb] dark:bg-[#1a2842] dark:text-[#38bdf8] shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/80 dark:hover:bg-[#161c28] hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Home className={`w-4 h-4 shrink-0 ${isHomeActive ? 'text-[#2563eb] dark:text-[#38bdf8]' : 'text-stone-400 dark:text-zinc-500'}`} />
              <span>Home</span>
            </button>

            {/* Recent Files */}
            <button
              type="button"
              onClick={handleRecentFilesClick}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isHistoryActive
                  ? 'bg-[#ebf3ff] text-[#2563eb] dark:bg-[#1a2842] dark:text-[#38bdf8] shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/80 dark:hover:bg-[#161c28] hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Clock className={`w-4 h-4 shrink-0 ${isHistoryActive ? 'text-[#2563eb] dark:text-[#38bdf8]' : 'text-stone-400 dark:text-zinc-500'}`} />
              <span>Recent Files</span>
            </button>

            {/* Favorites */}
            <button
              type="button"
              onClick={handleFavoritesClick}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isFavoritesActive
                  ? 'bg-[#ebf3ff] text-[#2563eb] dark:bg-[#1a2842] dark:text-[#38bdf8] shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/80 dark:hover:bg-[#161c28] hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 shrink-0 ${isFavoritesActive ? 'text-rose-500 fill-rose-500' : 'text-stone-400 dark:text-zinc-500'}`} />
              <span>Favorites</span>
            </button>

            {/* Spacer / Divider */}
            <div className="pt-3 pb-2">
              <div className="h-px bg-stone-200/60 dark:bg-white/5" />
            </div>

            {/* About */}
            <button
              type="button"
              onClick={() => setIsAboutOpen(true)}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-stone-600 dark:text-zinc-400 hover:bg-stone-100/80 dark:hover:bg-[#161c28] hover:text-stone-900 dark:hover:text-white transition-all duration-200 cursor-pointer"
            >
              <Info className="w-4 h-4 shrink-0 text-stone-400 dark:text-zinc-500" />
              <span>About</span>
            </button>
          </nav>
        </div>

        {/* 3. Bottom Region: Theme Toggle & 100% Private Card exactly matching screenshot */}
        <div className="pt-4 shrink-0 space-y-3.5">
          {/* Dual Pill Theme Switch */}
          <div className="flex items-center px-1">
            <div className="inline-flex items-center p-1 rounded-full bg-stone-100 dark:bg-[#161b24] border border-stone-200/80 dark:border-white/5 shadow-2xs">
              <button
                type="button"
                onClick={(e) => { if (theme !== 'dark') onToggleTheme(e); }}
                title="Switch to Dark Mode"
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#222938] text-sky-400 shadow-xs'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
                aria-label="Dark Mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => { if (theme !== 'light') onToggleTheme(e); }}
                title="Switch to Light Mode"
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-amber-500 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                aria-label="Light Mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 100% Private Assurance Card */}
          <div className="rounded-2xl p-3.5 border transition-all bg-[#ecfdf5]/80 dark:bg-[#062419]/50 border-[#a7f3d0] dark:border-emerald-900/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                100% Private
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Files stay on your device. No uploads. No tracking. Fast. Secure. Reliable.
            </p>
          </div>
        </div>
      </aside>

      {/* About Modal */}
      {isAboutOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsAboutOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#121620] border border-stone-200 dark:border-[#202735] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-xl transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-white"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 14h6v6" />
                  <path d="M20 10h-6V4" />
                  <path d="M14 10l7-7" />
                  <path d="M3 21l7-7" />
                </svg>
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-stone-900 dark:text-white tracking-tight">
                  <span className="text-[#f97316]">Shrink</span>
                  <span className="text-[#8b5cf6]">Byte</span>
                </h3>
                <p className="text-xs text-stone-400 dark:text-zinc-500">
                  Version 1.0.0 • Production Build
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 leading-relaxed">
              ShrinkByte is a privacy-first document and PDF workstation. Built with WebAssembly, Web Workers, and local algorithms to process files on-device without remote transit, with optional hybrid office conversion.
            </p>

            <div className="bg-stone-50 dark:bg-[#181d28] rounded-2xl p-3.5 border border-stone-200/60 dark:border-white/5 space-y-1.5 text-[11px] text-stone-500 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Privacy Mode:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">On-Device Local First</span>
              </div>
              <div className="flex justify-between">
                <span>Engines:</span>
                <span className="font-semibold text-stone-700 dark:text-zinc-200">PDF-Lib, WebAssembly, UPNG &amp; Hybrid API</span>
              </div>
              <div className="flex justify-between">
                <span>Themes:</span>
                <span className="font-semibold text-stone-700 dark:text-zinc-200">Classic &amp; Deep Frosted Glass</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
