import React from 'react';
import { X, ShieldCheck, Terminal } from 'lucide-react';

interface FormatGuideModalProps {
  onClose: () => void;
}

export const FormatGuideModal: React.FC<FormatGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0c0d10] border border-[#22252c] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f2228] bg-[#101215]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-300" />
            <h3 className="font-medium text-sm text-zinc-100">Format & Engine Specifications</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-[#1c1f26] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-zinc-300 font-sans">
          {/* Privacy Note */}
          <div className="p-3 rounded-lg bg-[#14161a] border border-[#23272f] flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-100">Zero Network Transit:</strong> All compression runs inside your browser tab via HTML5 Canvas, WebAssembly, and local worker memory. No file data is ever transmitted across the internet.
            </div>
          </div>

          {/* Specifications table */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Compression Matrix</span>
            
            <div className="border border-[#20232a] rounded-lg divide-y divide-[#1b1e24] overflow-hidden text-xs">
              <div className="p-3 bg-[#0f1114]">
                <div className="flex items-center justify-between font-mono font-medium text-zinc-100 mb-1">
                  <span>JPEG / WebP</span>
                  <span className="text-[10px] text-emerald-400">~99% Target Accuracy</span>
                </div>
                <p className="text-zinc-400">
                  Native lossy bisection search. Iterates image quality and scales dimensions automatically if low quality is insufficient.
                </p>
              </div>

              <div className="p-3 bg-[#0f1114]">
                <div className="flex items-center justify-between font-mono font-medium text-zinc-100 mb-1">
                  <span>PNG</span>
                  <span className="text-[10px] text-blue-400">Color Quantization</span>
                </div>
                <p className="text-zinc-400">
                  PNG is lossless by default. Uses 8-bit palette quantization (UPNG) with Floyd-Steinberg dithering to reduce color overhead.
                </p>
              </div>

              <div className="p-3 bg-[#0f1114]">
                <div className="flex items-center justify-between font-mono font-medium text-zinc-100 mb-1">
                  <span>PDF Documents</span>
                  <span className="text-[10px] text-zinc-400">Raster Stream Optimization</span>
                </div>
                <p className="text-zinc-400">
                  Renders pages in memory via pdfjs, compresses image streams to fit your per-page budget, and rebuilds compact PDF objects via pdf-lib.
                </p>
              </div>

              <div className="p-3 bg-[#0f1114]">
                <div className="flex items-center justify-between font-mono font-medium text-zinc-100 mb-1">
                  <span>Word (.docx)</span>
                  <span className="text-[10px] text-amber-400">Media Extraction & Deflate 9</span>
                </div>
                <p className="text-zinc-400">
                  Extracts bloated embedded images from <code>word/media/</code>, downsamples them to fit document budget, and recompresses with maximum DEFLATE.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#14161a] border border-[#23272f] text-[11px] text-zinc-400 leading-relaxed">
            <strong className="text-zinc-300">Legacy Word (.doc):</strong> Old binary Word 97-2003 files (<code>.doc</code>) cannot be processed in-browser without massive desktop runtimes. Please re-save as <code>.docx</code> prior to compressing.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1f2228] bg-[#101215] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
