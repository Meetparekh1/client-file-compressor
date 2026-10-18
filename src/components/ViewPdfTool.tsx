import React, { useState, useRef } from 'react';
import { ArrowLeft, Eye, UploadCloud } from 'lucide-react';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';
import { validateFileSize } from '../lib/securityLimits';
import type { ToastMessage } from './Toast';

interface ViewPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const ViewPdfTool: React.FC<ViewPdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF document.', 'error');
      return;
    }
    try {
      validateFileSize(selected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid file';
      onToast(msg, 'error');
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (dropped.type !== 'application/pdf' && !dropped.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please drop a valid PDF document.', 'error');
      return;
    }
    try {
      validateFileSize(dropped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid file';
      onToast(msg, 'error');
      return;
    }
    setFile(dropped);
  };

  if (file) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setFile(null)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium
              bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900 shadow-xs
              dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-[#1f2430] dark:hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Choose Another Document</span>
          </button>
        </div>

        <DocumentViewerWorkspace
          file={file}
          fileName={file.name}
          mode="embedded"
          embeddedHeight="calc(100vh - 180px)"
          onClose={() => setFile(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium
            bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900 shadow-xs
            dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-[#1f2430] dark:hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
          <Eye className="w-3.5 h-3.5" />
          <span>100% On-Device Reader</span>
        </div>
      </div>

      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
          <Eye className="w-3.5 h-3.5" />
          <span>Document Reader & Viewer</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          View & Read PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Read, zoom, search text, inspect metadata, and review pages in an interactive workspace with thumbnail sidebar.
        </p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-blue-500/60 dark:hover:border-blue-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-800 dark:text-zinc-200">
          Drop a PDF document here to open
        </h3>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
          or click anywhere to browse files
        </p>
      </div>
    </div>
  );
};
