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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-[#0c0d10] border border-[#22252c] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f2228] bg-[#101215]">
          <div className="min-w-0 flex items-center gap-3">
            <h3 className="font-medium text-sm text-zinc-100 truncate max-w-xs sm:max-w-md">{item.name}</h3>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span>{formatBytes(item.originalSize)}</span>
              <span>→</span>
              <span className="text-emerald-400 font-semibold">{item.compressedSize ? formatBytes(item.compressedSize) : ''}</span>
              {item.savingsPercent !== undefined && (
                <span className="text-emerald-400 font-bold">(-{item.savingsPercent}%)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'slider' ? 'side-by-side' : 'slider')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181a20] hover:bg-[#20232a] border border-[#272b33] text-xs text-zinc-300 font-mono transition"
            >
              {viewMode === 'slider' ? (
                <>
                  <Columns className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Side-by-Side</span>
                </>
              ) : (
                <>
                  <SplitSquareVertical className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Split Slider</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#1c1f26] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 min-h-[380px] p-4 sm:p-8 flex items-center justify-center overflow-auto bg-[#07080a] select-none">
          {viewMode === 'slider' ? (
            <div
              className="relative max-w-full max-h-[65vh] overflow-hidden rounded-lg border border-[#1f2229] shadow-2xl cursor-ew-resize"
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
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.7)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg text-[10px] font-mono font-bold">
                  ↔
                </div>
              </div>

              {/* Subtle Corner Markers */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-white/10">
                Original ({formatBytes(item.originalSize)})
              </div>
              <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                Compressed ({item.compressedSize ? formatBytes(item.compressedSize) : ''})
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="flex flex-col items-center">
                <span className="text-xs font-mono text-zinc-400 mb-2">Original · {formatBytes(item.originalSize)}</span>
                <div className="rounded-lg border border-[#1f2229] p-2 bg-[#0d0e11] max-h-[50vh] flex items-center justify-center">
                  <img
                    src={item.originalPreviewUrl}
                    alt="Original"
                    className="max-h-[46vh] object-contain rounded"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-mono text-emerald-400 mb-2">Compressed · {item.compressedSize ? formatBytes(item.compressedSize) : ''}</span>
                <div className="rounded-lg border border-[#1f2229] p-2 bg-[#0d0e11] max-h-[50vh] flex items-center justify-center">
                  <img
                    src={item.compressedPreviewUrl || item.originalPreviewUrl}
                    alt="Compressed"
                    className="max-h-[46vh] object-contain rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#1f2228] bg-[#101215] flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Drag slider left/right to inspect pixel quality</span>
          {item.accuracy !== undefined && (
            <span className="text-zinc-300">
              Target match: <strong className="text-emerald-400">{item.accuracy}%</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
