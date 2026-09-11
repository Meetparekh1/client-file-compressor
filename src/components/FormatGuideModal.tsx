import React from 'react';
import { X, Shield, Cpu, Image, FileText, FileType, CheckCircle2, AlertTriangle } from 'lucide-react';

interface FormatGuideModalProps {
  onClose: () => void;
}

export const FormatGuideModal: React.FC<FormatGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">How Client-Side Compression Works</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Privacy Box */}
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-white text-sm">100% In-Browser & Private</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your files are processed directly in your browser using modern WebAssembly, Canvas, and HTML5 Web APIs. No data is ever sent to any remote server or third party.
              </p>
            </div>
          </div>

          {/* Precision Target Sizing */}
          <div className="space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              How the ~99% Accuracy Target Sizing Works
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard sliders guess a quality percentage (like 70%), which often results in unpredictable file sizes. Our engine runs an in-memory <strong>Bisection / Binary Search Algorithm</strong> that iteratively checks file weight in bytes, dynamically tuning quality and resolution until it converges right at your target size (e.g. 5 MB → exactly ~2.0 MB).
            </p>
          </div>

          {/* Supported Formats breakdown */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white">Supported Formats</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* JPG / WebP */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                <div className="flex items-center gap-2 font-medium text-white">
                  <Image className="w-4 h-4 text-blue-400" />
                  JPEG & WebP
                </div>
                <p className="text-slate-400">
                  Compressed via native canvas lossy quantization. Reaches 98-99.5% exact target size.
                </p>
              </div>

              {/* PNG */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                <div className="flex items-center gap-2 font-medium text-white">
                  <Image className="w-4 h-4 text-cyan-400" />
                  PNG (Lossy Palette)
                </div>
                <p className="text-slate-400">
                  PNG is lossless by default. We quantize 32-bit colors down to an optimized 8-bit palette via UPNG.
                </p>
              </div>

              {/* PDF */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                <div className="flex items-center gap-2 font-medium text-white">
                  <FileText className="w-4 h-4 text-red-400" />
                  PDF Documents
                </div>
                <p className="text-slate-400">
                  Renders pages and optimizes raster layers into a clean, compact PDF structure with pdf-lib.
                </p>
              </div>

              {/* DOCX */}
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                <div className="flex items-center gap-2 font-medium text-white">
                  <FileType className="w-4 h-4 text-indigo-400" />
                  Word (.docx)
                </div>
                <p className="text-slate-400">
                  Modern DOCX files are zip archives. We compress high-res embedded graphics in <code>word/media/</code> and repack with DEFLATE 9.
                </p>
              </div>
            </div>
          </div>

          {/* DOC vs DOCX note */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200/90 leading-relaxed">
              <strong>Notice regarding legacy .doc:</strong> Old Microsoft Word 97-2003 binary files (<code>.doc</code>) cannot be modified client-side without massive 100MB+ desktop conversion runtimes. Please re-save old files as <strong>.docx</strong> in Microsoft Word or Google Docs before compressing.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
