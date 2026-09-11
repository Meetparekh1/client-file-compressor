import React, { useState } from 'react';
import { X, ZoomIn, ArrowLeftRight } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div>
            <h3 className="font-semibold text-white truncate max-w-md">{item.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Original: <span className="text-slate-300 font-medium">{formatBytes(item.originalSize)}</span>
              {item.compressedSize && (
                <>
                  {' '}→ Compressed:{' '}
                  <span className="text-emerald-400 font-medium">{formatBytes(item.compressedSize)}</span>
                  {item.savingsPercent !== undefined && (
                    <span className="ml-1.5 text-xs text-emerald-400 font-bold">
                      (-{item.savingsPercent}%)
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'slider' ? 'side-by-side' : 'slider')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{viewMode === 'slider' ? 'Side-by-Side' : 'Split Slider'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 min-h-[350px] p-6 flex items-center justify-center overflow-auto bg-slate-950/60 select-none">
          {viewMode === 'slider' ? (
            <div
              className="relative max-w-full max-h-[60vh] overflow-hidden rounded-lg shadow-lg border border-slate-800 cursor-ew-resize"
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
                alt="Compressed preview"
                className="max-h-[60vh] w-auto object-contain block"
              />

              {/* Before (Original) with clip-path */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
              >
                <img
                  src={item.originalPreviewUrl}
                  alt="Original preview"
                  className="max-h-[60vh] w-auto object-contain block"
                />
              </div>

              {/* Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-md">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Badges */}
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur px-2 py-1 rounded text-[11px] font-semibold text-slate-300 border border-slate-700">
                Original (Before)
              </div>
              <div className="absolute top-3 right-3 bg-indigo-950/80 backdrop-blur px-2 py-1 rounded text-[11px] font-semibold text-indigo-300 border border-indigo-700">
                Compressed (After)
              </div>
            </div>
          ) : (
            /* Side-by-side mode */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-400 mb-2">Original</span>
                <div className="rounded-lg border border-slate-800 p-2 bg-slate-900/50 flex items-center justify-center">
                  <img
                    src={item.originalPreviewUrl}
                    alt="Original"
                    className="max-h-[45vh] object-contain rounded"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-indigo-400 mb-2">Compressed</span>
                <div className="rounded-lg border border-indigo-900/50 p-2 bg-indigo-950/20 flex items-center justify-center">
                  <img
                    src={item.compressedPreviewUrl || item.originalPreviewUrl}
                    alt="Compressed"
                    className="max-h-[45vh] object-contain rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
            <span>Drag slider horizontally to inspect pixel fidelity</span>
          </div>
          {item.accuracy !== undefined && (
            <div className="text-emerald-400 font-medium">
              Target Size Match: {item.accuracy}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
