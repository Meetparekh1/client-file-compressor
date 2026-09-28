import React from 'react';
import { X, ShieldCheck, Terminal } from 'lucide-react';

interface FormatGuideModalProps {
  onClose: () => void;
}

export const FormatGuideModal: React.FC<FormatGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border transition-colors
        bg-white border-slate-200 dark:bg-[#0c0d10] dark:border-[#22252c]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b
          bg-slate-50 border-slate-200 text-slate-800
          dark:bg-[#101215] dark:border-[#1f2228] dark:text-zinc-100"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600 dark:text-zinc-300" />
            <h3 className="font-semibold text-sm">Format & Engine Specifications</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition cursor-pointer
              text-slate-400 hover:text-slate-700 hover:bg-slate-100
              dark:text-zinc-400 dark:hover:text-white dark:hover:bg-[#1c1f26]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans text-slate-700 dark:text-zinc-300">
          {/* Privacy Note */}
          <div className="p-3.5 rounded-xl border flex items-start gap-3
            bg-emerald-50/70 border-emerald-200/80 text-emerald-950
            dark:bg-[#14161a] dark:border-[#23272f] dark:text-zinc-300"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-emerald-900 dark:text-zinc-100">Zero Network Transit:</strong> All compression runs inside your browser tab via HTML5 Canvas, WebAssembly, and local worker memory. No file data is ever transmitted across any server.
            </div>
          </div>

          {/* Specifications table */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
              Compression Matrix
            </span>
            
            <div className="rounded-xl border divide-y overflow-hidden text-xs
              border-slate-200 divide-slate-100 bg-white
              dark:border-[#20232a] dark:divide-[#1b1e24] dark:bg-[#0f1114]"
            >
              <div className="p-3.5">
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  <span>JPEG / WebP</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    ~99% Target Accuracy
                  </span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Native lossy bisection search. Iterates image quality and scales dimensions automatically if low quality is insufficient to reach the target size.
                </p>
              </div>

              <div className="p-3.5">
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  <span>AVIF (Next-Gen AV1)</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded">
                    Ultra High Density
                  </span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Encodes using modern AV1 image compression when supported by browser canvas, offering up to 30% greater reduction than WebP with auto-fallback.
                </p>
              </div>

              <div className="p-3.5">
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  <span>SVG Vector Graphics</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Vector Minifier & Sanitizer
                  </span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Strips metadata, comments, redundant XML namespaces, and rounds coordinates. Also supports direct conversion to WebP, PNG, JPEG, or PDF.
                </p>
              </div>

              <div className="p-3.5">
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  <span>PNG / BMP / GIF</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                    Color Quantization
                  </span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  PNG is lossless by default. Uses 8-bit palette quantization (UPNG) with Floyd-Steinberg dithering or converts directly into ultra-compact WebP/AVIF.
                </p>
              </div>

              <div className="p-3.5">
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  <span>PDF Documents & Merging</span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded">
                    Raster Stream Optimization
                  </span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Renders pages in memory via pdfjs, compresses image streams to fit your per-page budget, and rebuilds compact PDF objects via pdf-lib. Also supports merging multiple images into 1 PDF document.
                </p>
              </div>

              <div className="p-3.5">
                <div className="flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  <span>Word (.docx)</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Media Extraction & Deflate 9
                  </span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Extracts bloated embedded images from <code>word/media/</code>, downsamples them to fit document budget, and recompresses the archive with maximum DEFLATE.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border text-[11px] leading-relaxed
            bg-slate-50 border-slate-200 text-slate-600
            dark:bg-[#14161a] dark:border-[#23272f] dark:text-zinc-400"
          >
            <strong className="text-slate-800 dark:text-zinc-300">Legacy Word (.doc):</strong> Old binary Word 97-2003 files (<code>.doc</code>) cannot be processed in-browser without massive desktop runtimes. Please re-save as <code>.docx</code> prior to compressing.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex justify-end
          bg-slate-50 border-slate-200
          dark:bg-[#101215] dark:border-[#1f2228]"
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs
              bg-slate-900 hover:bg-slate-800 text-white
              dark:bg-zinc-200 dark:hover:bg-white dark:text-zinc-950"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
