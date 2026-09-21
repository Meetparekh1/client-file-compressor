import React from 'react';
import { HelpCircle, Shield } from 'lucide-react';

interface NavbarProps {
  onOpenGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenGuide }) => {
  return (
    <header className="border-b border-[#1f2227] bg-[#090a0c]/85 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#141619] border border-[#262930] flex items-center justify-center text-white shadow-sm">
            {/* Minimalist converging compression mark */}
            <svg
              className="w-4 h-4 text-zinc-100"
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
            <span className="font-semibold text-sm text-zinc-100 tracking-tight">ZeroUpload</span>
            <span className="text-[11px] text-zinc-500 font-mono">compressor</span>
          </div>
        </div>

        {/* Status indicator & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#131518] border border-[#23262d] text-zinc-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>in-memory engine</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 border-l border-[#1f2227] pl-3">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            <span>no server storage</span>
          </div>

          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-[#181a1f] border border-transparent hover:border-[#272b33] text-zinc-400 hover:text-zinc-200 text-xs font-medium transition cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Format Specs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
