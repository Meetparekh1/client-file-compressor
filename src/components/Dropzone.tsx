import React, { useRef, useState, useEffect } from 'react';
import { ArrowDown, Plus, Sparkles, Shield, Cpu } from 'lucide-react';
import type { ToolTab } from '../lib/types';

interface DropzoneProps {
  activeTab: ToolTab;
  hasItems: boolean;
  onFilesAdded: (files: File[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ activeTab, hasItems, onFilesAdded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Native clipboard paste support (Ctrl+V anywhere on page)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const filesArray = Array.from(e.clipboardData.files);
        onFilesAdded(filesArray);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesAdded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesAdded(filesArray);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onFilesAdded(filesArray);
      e.target.value = '';
    }
  };

  const getAcceptAttribute = () => {
    switch (activeTab) {
      case 'images':
        return '.jpg,.jpeg,.png,.webp,.avif,.svg,.gif,.bmp';
      case 'pdf':
        return '.pdf,.jpg,.jpeg,.png,.webp';
      case 'docx':
        return '.docx,.doc,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return '.jpg,.jpeg,.png,.webp,.avif,.svg,.gif,.bmp,.pdf,.docx,.doc';
    }
  };

  // Compact Quick-Add Bar when files are already in queue
  if (hasItems) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border transition-all duration-150 px-4 py-3 cursor-pointer flex items-center justify-between gap-3 text-xs select-none shadow-sm ${
          isDragging
            ? 'border-blue-500 bg-blue-500/[0.08] ring-2 ring-blue-500/40'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#0c0d10] dark:hover:bg-[#111317] dark:border-[#22252c] dark:hover:border-[#32363f]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getAcceptAttribute()}
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex items-center gap-2.5 text-slate-800 dark:text-zinc-200">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 bg-slate-100 border border-slate-200 dark:bg-[#16181d] dark:border-[#272b33] dark:text-zinc-400">
            <Plus className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium text-slate-900 dark:text-zinc-100">Add more files</span>
          <span className="text-slate-500 dark:text-zinc-500 hidden sm:inline">or drag & drop here</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-zinc-500">
          <span className="hidden md:inline">Ctrl+V paste</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 dark:bg-[#15171c] dark:border-[#23262e] dark:text-zinc-400 font-medium">
            {activeTab === 'images' ? 'Images & SVG' : activeTab === 'pdf' ? 'PDFs' : activeTab === 'docx' ? 'DOCX' : 'All formats'}
          </span>
        </div>
      </div>
    );
  }

  // Full Hero Workspace Deck when queue is empty
  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group rounded-2xl border transition-all duration-200 p-8 sm:p-12 text-center cursor-pointer select-none overflow-hidden shadow-sm hover:shadow-md ${
          isDragging
            ? 'border-blue-500 bg-blue-500/[0.06] ring-2 ring-blue-500/50'
            : 'bg-white/80 hover:bg-white border-slate-200/90 hover:border-blue-500/60 dark:bg-[#0d0e12]/80 dark:hover:bg-[#101217] dark:border-[#22252c] dark:hover:border-[#32363f]'
        }`}
      >
        {/* Precision corner crosshairs */}
        <div className="absolute top-3 left-3 w-2 h-2 border-t border-l border-slate-300 dark:border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-3 right-3 w-2 h-2 border-t border-r border-slate-300 dark:border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-slate-300 dark:border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-slate-300 dark:border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getAcceptAttribute()}
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="relative z-10 flex flex-col items-center">
          {/* Centered upload button circle */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 shadow-sm
            bg-slate-100 border border-slate-200 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 group-hover:scale-105
            dark:bg-[#16181e] dark:border-[#272b35] dark:text-zinc-300 dark:group-hover:text-white dark:group-hover:border-blue-500/40 dark:group-hover:bg-blue-500/10"
          >
            <ArrowDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-zinc-100 tracking-tight mb-1.5">
            Drop files to compress or convert, or <span className="text-blue-600 dark:text-blue-400 underline underline-offset-4 decoration-blue-500/30 group-hover:decoration-blue-500">browse</span>
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
            {activeTab === 'images'
              ? 'JPG, PNG, WebP, AVIF, SVG, GIF & BMP. Precision size targeting or instant format conversion.'
              : activeTab === 'pdf'
              ? 'Compress large PDFs, downscale raster streams, or merge multiple images into a single PDF.'
              : activeTab === 'docx'
              ? 'Compress modern Word documents by recompressing embedded graphics and media.'
              : 'Images (JPG, PNG, WebP, AVIF, SVG), PDFs, and Word documents processed 100% in-browser.'}
          </p>

          {/* Interactive Format Badges */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-mono">
            {[
              { ext: 'JPG', dot: 'bg-blue-500' },
              { ext: 'PNG', dot: 'bg-cyan-500' },
              { ext: 'WEBP', dot: 'bg-emerald-500' },
              { ext: 'AVIF', dot: 'bg-purple-500' },
              { ext: 'SVG', dot: 'bg-amber-500' },
              { ext: 'PDF', dot: 'bg-rose-500' },
              { ext: 'DOCX', dot: 'bg-blue-500' },
              { ext: 'DOC', dot: 'bg-indigo-500' },
            ].map(({ ext, dot }) => (
              <span
                key={ext}
                className="px-2.5 py-0.5 rounded-md flex items-center gap-1.5 transition
                  bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700
                  dark:bg-[#14161b] dark:hover:bg-[#1a1c22] dark:border-[#242730] dark:text-zinc-300"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span>{ext}</span>
              </span>
            ))}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-500 ml-1.5 pl-2.5 border-l border-slate-200 dark:border-zinc-800 text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-600 dark:bg-[#181a20] dark:border-zinc-800 dark:text-zinc-300 shadow-2xs">
                Ctrl+V
              </kbd>{' '}
              to paste
            </span>
          </div>
        </div>
      </div>

      {/* Feature Value Props Strip Underneath */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex items-start gap-2.5 p-3 rounded-xl border transition-colors
          bg-white/60 border-slate-200/80 dark:bg-[#0c0d10]/60 dark:border-[#1e222a]"
        >
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-medium text-slate-800 dark:text-zinc-200">~99% Target Accuracy</div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
              Bisection binary search hits your exact target size without overshoot.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl border transition-colors
          bg-white/60 border-slate-200/80 dark:bg-[#0c0d10]/60 dark:border-[#1e222a]"
        >
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-medium text-slate-800 dark:text-zinc-200">100% Client-Side Privacy</div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
              Zero bytes leave your computer. Works fully offline in browser RAM.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl border transition-colors
          bg-white/60 border-slate-200/80 dark:bg-[#0c0d10]/60 dark:border-[#1e222a]"
        >
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-medium text-slate-800 dark:text-zinc-200">Universal Format Engine</div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
              Convert images to WebP, AVIF, PNG, or merge directly to a single PDF.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
