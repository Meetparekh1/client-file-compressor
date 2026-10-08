import React from 'react';
import { Shield, Lock } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t py-6 text-xs transition-colors font-mono mt-auto
      bg-white border-slate-200 text-slate-500
      dark:bg-[#090a0f] dark:border-[#1a1c22] dark:text-zinc-500"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Local File Engine: Zero server uploads. No files or telemetry ever leave this device.</span>
        </div>

        <div className="flex items-center gap-3 text-slate-400 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            100% In-Browser Engine
          </span>
        </div>
      </div>
    </footer>
  );
};
