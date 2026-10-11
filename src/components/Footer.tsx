import React from 'react';
import { ShieldCheck, Lock, Cpu, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 py-6 border-t border-stone-200/80 dark:border-[#202735] text-xs transition-colors">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-stone-500 dark:text-zinc-400">
        
        {/* Shield and On-Device guarantee */}
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="font-medium text-stone-700 dark:text-zinc-300">
            Local-First Architecture: Documents process on-device by default. Remote processing is strictly opt-in with explicit consent.
          </span>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#161a23] border border-stone-200/80 dark:border-white/5">
            <Lock className="w-3 h-3 text-indigo-500" />
            Default On-Device
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#161a23] border border-stone-200/80 dark:border-white/5">
            <Cpu className="w-3 h-3 text-emerald-500" />
            Client-Side WASM &amp; Web APIs
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#161a23] border border-stone-200/80 dark:border-white/5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Explicit Consent Required
          </span>
        </div>
      </div>
    </footer>
  );
};
