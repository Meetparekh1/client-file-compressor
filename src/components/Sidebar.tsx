import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Files, 
  Scissors, 
  FileArchive, 
  Camera, 
  PenTool, 
  RotateCw, 
  Trash2, 
  Binary, 
  FileImage, 
  Lock, 
  FileText, 
  FileSpreadsheet,
  Brain,
  Moon, 
  Sun,
  X,
  Settings,
  User,
  Monitor,
  Palette
} from 'lucide-react';
import type { ToolCategory } from '../lib/toolsRegistry';
import type { UiMode } from '../lib/useUiMode';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  selectedCategory: ToolCategory;
  onSelectCategory: (cat: ToolCategory) => void;
  theme: string;
  onToggleTheme: () => void;
  uiMode: UiMode;
  onChangeUiMode: (mode: UiMode) => void;
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
  uiMode,
  onChangeUiMode,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelect = (view: string) => {
    onSelectView(view);
    if (onCloseMobile) onCloseMobile();
  };

  const handleCategory = (cat: ToolCategory) => {
    onSelectCategory(cat);
    onSelectView('dashboard');
    if (onCloseMobile) onCloseMobile();
  };

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
          fixed md:sticky z-50 md:z-20 top-0 md:top-5 left-0
          h-full md:h-[calc(100vh-2.5rem)] w-72 md:w-64 shrink-0
          flex flex-col justify-between p-4 md:p-5
          rounded-none md:rounded-3xl
          bg-white dark:bg-[#12161f] glass-sidebar border-r md:border border-stone-200/80 dark:border-[#202735] shadow-2xl md:shadow-xs
          transition-transform duration-300 ease-in-out md:translate-x-0 md:self-start
          ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1 shrink-0">
            <div 
              onClick={() => handleSelect('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                <span className="font-extrabold text-base tracking-tight">D</span>
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-stone-900 dark:text-white">
                  DocuKit
                </span>
                <span className="block text-[10px] font-medium text-stone-400 dark:text-zinc-500 -mt-0.5">
                  Local-First File Suite
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100
                  dark:text-zinc-400 dark:hover:text-white dark:hover:bg-[#1b212c] transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Mobile Close Button */}
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="md:hidden p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-[#1b212c]"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Primary Navigation with smooth transitions & scrolling */}
          <div className="space-y-1 flex-1 overflow-y-auto pr-1">
            <button
              onClick={() => handleSelect('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleSelect('compress-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'compress-pdf'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <FileArchive className="w-4 h-4 text-emerald-500" />
              <span>Compress Files</span>
            </button>

            <button
              onClick={() => handleSelect('merge-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'merge-pdf'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Files className="w-4 h-4 text-indigo-500" />
              <span>Merge PDFs</span>
            </button>

            <button
              onClick={() => handleSelect('split-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'split-pdf'
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Scissors className="w-4 h-4 text-purple-500" />
              <span>Split PDF Pages</span>
            </button>

            <button
              onClick={() => handleSelect('rotate-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'rotate-pdf'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <RotateCw className="w-4 h-4 text-blue-500" />
              <span>Rotate Pages</span>
            </button>

            <button
              onClick={() => handleSelect('delete-pages')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'delete-pages'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Pages</span>
            </button>

            <button
              onClick={() => handleSelect('page-numbers')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'page-numbers'
                  ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Binary className="w-4 h-4 text-violet-500" />
              <span>Page Numbers</span>
            </button>

            <button
              onClick={() => handleSelect('pdf-to-images')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'pdf-to-images'
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <FileImage className="w-4 h-4 text-sky-500" />
              <span>PDF to Images</span>
            </button>

            <button
              onClick={() => handleSelect('scan-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'scan-pdf'
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Camera className="w-4 h-4 text-teal-500" />
              <span>Scan to PDF</span>
            </button>

            <button
              onClick={() => handleSelect('sign-watermark-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'sign-watermark-pdf'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <PenTool className="w-4 h-4 text-amber-500" />
              <span>Sign & Watermark</span>
            </button>

            <button
              onClick={() => handleSelect('flatten-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'flatten-pdf'
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Lock className="w-4 h-4 text-orange-500" />
              <span>Flatten PDF</span>
            </button>

            <button
              onClick={() => handleSelect('text-to-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'text-to-pdf'
                  ? 'bg-lime-50 dark:bg-lime-950/40 text-lime-700 dark:text-lime-400 border border-lime-200 dark:border-lime-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <FileText className="w-4 h-4 text-lime-500" />
              <span>Text to PDF</span>
            </button>

            <button
              onClick={() => handleSelect('pdf-to-office')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'pdf-to-office'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              <span>PDF to Office</span>
            </button>

            <button
              onClick={() => handleSelect('ai-summarizer')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'ai-summarizer'
                  ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Brain className="w-4 h-4 text-violet-500" />
              <span>AI Summarizer</span>
            </button>

            <button
              onClick={() => handleSelect('ocr-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'ocr-pdf'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <FileImage className="w-4 h-4 text-emerald-500" />
              <span>OCR PDF</span>
            </button>

            <button
              onClick={() => handleSelect('html-to-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'html-to-pdf'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-500" />
              <span>HTML to PDF</span>
            </button>

            <button
              onClick={() => handleSelect('edit-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'edit-pdf'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <PenTool className="w-4 h-4 text-indigo-500" />
              <span>Edit PDF</span>
            </button>

            <button
              onClick={() => handleSelect('unlock-pdf')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeView === 'unlock-pdf'
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 shadow-xs translate-x-1'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28] hover:text-stone-900 dark:hover:text-white hover:translate-x-0.5'
              }`}
            >
              <Lock className="w-4 h-4 text-red-500" />
              <span>Unlock PDF</span>
            </button>
          </div>

          {/* Quick Filter Categories */}
          <div className="space-y-2 pt-2 border-t border-stone-200/60 dark:border-white/5">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
              Categories
            </p>
            <div className="space-y-1">
              <button
                onClick={() => handleCategory('pages')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  selectedCategory === 'pages' && activeView === 'dashboard'
                    ? 'bg-stone-200/70 dark:bg-[#1f2635] text-stone-900 dark:text-white font-bold'
                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28]'
                }`}
              >
                <span>Pages & Split</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-200/70 dark:bg-white/10 text-stone-600 dark:text-zinc-300">
                  3
                </span>
              </button>

              <button
                onClick={() => handleCategory('edit')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  selectedCategory === 'edit' && activeView === 'dashboard'
                    ? 'bg-stone-200/70 dark:bg-[#1f2635] text-stone-900 dark:text-white font-bold'
                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28]'
                }`}
              >
                <span>Compress & Edit</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-200/70 dark:bg-white/10 text-stone-600 dark:text-zinc-300">
                  3
                </span>
              </button>

              <button
                onClick={() => handleCategory('convert')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  selectedCategory === 'convert' && activeView === 'dashboard'
                    ? 'bg-stone-200/70 dark:bg-[#1f2635] text-stone-900 dark:text-white font-bold'
                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100/70 dark:hover:bg-[#181d28]'
                }`}
              >
                <span>Scan & Convert</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-200/70 dark:bg-white/10 text-stone-600 dark:text-zinc-300">
                  3
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Area with Profile and Settings */}
        <div className="pt-4 border-t border-stone-200/60 dark:border-white/5 shrink-0 relative" ref={profileRef}>
          {/* Settings Menu Popup */}
          <div
            className={`fixed md:absolute inset-x-4 bottom-20 md:inset-auto md:left-[calc(100%+0.75rem)] md:bottom-0 md:w-64 z-50
              bg-white/95 dark:bg-[#1a1f2e]/95 backdrop-blur-2xl border border-stone-200/80 dark:border-white/10 shadow-2xl rounded-3xl p-4
              transition-all duration-200 origin-bottom md:origin-bottom-left glass-card ${
              isProfileOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'
            }`}
          >
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 mb-2 block">
                  Appearance Mode
                </span>
                <div className="flex bg-stone-100/80 dark:bg-black/40 p-1 rounded-xl">
                  <button
                    onClick={() => { if (theme !== 'light') onToggleTheme(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      theme === 'light' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Light
                  </button>
                  <button
                    onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      theme === 'dark' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    Dark
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 mb-2 block">
                  UI Theme
                </span>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onChangeUiMode('glassy')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      uiMode === 'glassy' 
                        ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30' 
                        : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      <span>Glassy (Default)</span>
                    </div>
                    {uiMode === 'glassy' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </button>
                  
                  <button
                    onClick={() => onChangeUiMode('classic')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      uiMode === 'classic' 
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-white border border-stone-300 dark:border-stone-600' 
                        : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      <span>Classic</span>
                    </div>
                    {uiMode === 'classic' && <div className="w-2 h-2 rounded-full bg-stone-500" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-stone-100/80 dark:hover:bg-[#1a1f2e] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center border border-stone-300 dark:border-stone-700">
                <User className="w-4 h-4 text-stone-600 dark:text-zinc-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-stone-900 dark:text-white">Local User</p>
                <p className="text-[10px] text-stone-500 dark:text-zinc-500">Preferences</p>
              </div>
            </div>
            <Settings className="w-4 h-4 text-stone-400 dark:text-zinc-500 group-hover:rotate-45 transition-transform" />
          </button>
        </div>
      </aside>
    </>
  );
};

