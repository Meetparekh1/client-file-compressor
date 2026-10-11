import React from 'react';
import { HelpCircle, Layers, Image as ImageIcon, FileText, FileType, Server } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { ToolTab } from '../lib/types';

interface NavbarProps {
  activeTab: ToolTab;
  onTabChange: (tab: ToolTab) => void;
  onOpenGuide: () => void;
  onOpenApiSettings?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenGuide,
  onOpenApiSettings,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="border-b transition-colors duration-250 sticky top-0 z-30
      bg-white/85 border-slate-200/90 text-slate-800 backdrop-blur-md
      dark:bg-[#090a0f]/85 dark:border-[#1e222b] dark:text-zinc-100"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-all
            bg-slate-900 border border-slate-800 text-white
            dark:bg-[#14161a] dark:border-[#262930] dark:text-zinc-100"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-zinc-100">
              Local File Engine
            </span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded text-slate-500 bg-slate-100 border border-slate-200 dark:text-zinc-400 dark:bg-[#15171d] dark:border-[#22252c] hidden sm:inline">
              studio
            </span>
          </div>
        </div>

        {/* Center Tool Tabs */}
        <nav className="hidden md:flex items-center rounded-xl p-1 text-xs font-medium border transition-colors
          bg-slate-100/90 border-slate-200 text-slate-600
          dark:bg-[#111317] dark:border-[#21242b] dark:text-zinc-400"
        >
          {[
            { id: 'all', label: 'All Tools', icon: Layers },
            { id: 'images', label: 'Images & SVG', icon: ImageIcon },
            { id: 'pdf', label: 'PDF Tools', icon: FileText },
            { id: 'docx', label: 'Word DOCX', icon: FileType },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as ToolTab)}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 dark:bg-zinc-200 dark:text-zinc-950 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Info & Theme Controls */}
        <div className="flex items-center gap-2">
          {/* In-Memory Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono border
            bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">in-memory</span>
          </div>

          {/* Format Matrix Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border
              border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900
              dark:hover:border-[#272b33] dark:hover:bg-[#181a1f] dark:text-zinc-400 dark:hover:text-zinc-200"
            title="Inspect supported formats & specifications"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Format Matrix</span>
          </button>

          {/* Converter API Engine Button */}
          {onOpenApiSettings && (
            <button
              onClick={onOpenApiSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border
                border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900
                dark:hover:border-[#272b33] dark:hover:bg-[#181a1f] dark:text-zinc-400 dark:hover:text-zinc-200"
              title="Configure self-hosted Document Converter API"
            >
              <Server className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden md:inline">API Engine</span>
            </button>
          )}

          {/* Animated Theme Toggle Button */}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t px-4 py-1.5 overflow-x-auto gap-1 border-slate-200 bg-slate-50 dark:border-[#1b1e24] dark:bg-[#0b0d10]">
        {[
          { id: 'all', label: 'All', icon: Layers },
          { id: 'images', label: 'Images & SVG', icon: ImageIcon },
          { id: 'pdf', label: 'PDF Tools', icon: FileText },
          { id: 'docx', label: 'Word DOCX', icon: FileType },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as ToolTab)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 flex items-center gap-1.5 transition ${
                isActive
                  ? 'bg-white text-slate-900 dark:bg-zinc-200 dark:text-zinc-950 font-semibold shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
