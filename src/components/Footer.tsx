import React from 'react';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#1a1c22] bg-[#090a0c] py-6 text-xs text-zinc-500 mt-auto font-mono">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-zinc-400" />
          <span>No files or telemetry leave this device.</span>
        </div>

        <div className="flex items-center gap-3 text-zinc-400">
          <span>In-browser WebAssembly & Canvas engine</span>
        </div>
      </div>
    </footer>
  );
};
