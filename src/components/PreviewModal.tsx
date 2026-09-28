import React, { useState } from 'react';
import { X, Columns, SplitSquareVertical } from 'lucide-react';
import { formatBytes } from '../lib/utils';
import type { FileItem } from '../lib/types';

interface PreviewModalProps {
  item: FileItem;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ item, onClose }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border transition-colors
        bg-white border-slate-200 dark:bg-[#0c0d10] dark:border-[#22252c]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b
          bg-slate-50 border-slate-200 text-slate-800
          dark:bg-[#101215] dark:border-[#1f2228] dark:text-zinc-100"
        >
          <div className="min-w-0 flex items-center gap-3">
            <h3 className="font-semibold text-sm truncate max-w-xs sm:max-w-md">{item.name}</h3>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400">
              <span>{formatBytes(item.originalSize)}</span>
              <span>→</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{item.compressedSize ? formatBytes(item.compressedSize) : ''}</span>
              {item.savingsPercent !== undefined && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">(-{item.savingsPercent}%)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'slider' ? 'side-by-side' : 'slider')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer border
                bg-white hover:bg-slate-100 border-slate-200 text-slate-700
                dark:bg-[#181a20] dark:hover:bg-[#20232a] dark:border-[#272b33] dark:text-zinc-300"
            >
              {viewMode === 'slider' ? (
                <>
                  <Columns className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                  <span className="hidden sm:inline">Side-by-Side</span>
                </>
              ) : (
                <>
                  <SplitSquareVertical className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                  <span className="hidden sm:inline">Split Slider</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition cursor-pointer
                text-slate-400 hover:text-slate-700 hover:bg-slate-100
                dark:text-zinc-400 dark:hover:text-white dark:hover:bg-[#1c1f26]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 min-h-[380px] p-4 sm:p-8 flex items-center justify-center overflow-auto select-none
          bg-slate-100 dark:bg-[#07080a]"
        >
          {viewMode === 'slider' ? (
            <div
              className="relative max-w-full max-h-[65vh] overflow-hidden rounded-xl shadow-2xl cursor-ew-resize border
                border-slate-300 dark:border-[#1f2229]"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                setSliderPos(pos);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
                setSliderPos(pos);
              }}
            >
              {/* After (Compressed) */}
              <img
                src={item.compressedPreviewUrl || item.originalPreviewUrl}
                alt="Compressed"
                className="max-h-[65vh] w-auto object-contain block"
              />

              {/* Before (Original) with clip-path */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
              >
                <img
                  src={item.originalPreviewUrl}
                  alt="Original"
                  className="max-h-[65vh] w-auto object-contain block"
                />
              </div>

              {/* Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.4)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg text-[11px] font-mono font-bold border border-slate-200">
                  ↔
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
                Original ({formatBytes(item.originalSize)})
              </div>
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
                Compressed ({item.compressedSize ? formatBytes(item.compressedSize) : ''})
              </div>
            </div>
          ) : (
            /* Side-by-side mode */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-h-[65vh] overflow-auto">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                  Original: {formatBytes(item.originalSize)}
                </span>
                <div className="rounded-xl overflow-hidden border p-2 bg-white border-slate-200 dark:bg-[#101216] dark:border-[#232730] shadow-sm">
                  <img
                    src={item.originalPreviewUrl}
                    alt="Original"
                    className="max-h-[50vh] w-auto object-contain"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  Compressed: {item.compressedSize ? formatBytes(item.compressedSize) : ''} (-{item.savingsPercent}%)
                </span>
                <div className="rounded-xl overflow-hidden border p-2 bg-white border-slate-200 dark:bg-[#101216] dark:border-[#232730] shadow-sm">
                  <img
                    src={item.compressedPreviewUrl || item.originalPreviewUrl}
                    alt="Compressed"
                    className="max-h-[50vh] w-auto object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
