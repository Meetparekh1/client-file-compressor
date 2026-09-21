import React, { useRef, useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded }) => {
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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative group rounded-xl border transition-all duration-200 p-8 sm:p-12 text-center cursor-pointer select-none overflow-hidden ${
        isDragging
          ? 'border-blue-500 bg-blue-500/[0.04] ring-1 ring-blue-500/50'
          : 'border-[#22252c] hover:border-[#32363f] bg-[#0d0e11] hover:bg-[#101215]'
      }`}
    >
      {/* Subtle corner crosshairs for precision drafting aesthetic */}
      <div className="absolute top-2.5 left-2.5 w-2 h-2 border-t border-l border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-2.5 right-2.5 w-2 h-2 border-t border-r border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2.5 left-2.5 w-2 h-2 border-b border-l border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2.5 right-2.5 w-2 h-2 border-b border-r border-zinc-700 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity" />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Minimalist action circle */}
        <div className="w-11 h-11 rounded-full bg-[#16181d] border border-[#272b33] flex items-center justify-center text-zinc-300 group-hover:text-white group-hover:border-zinc-500 transition-all mb-4">
          <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
        </div>

        <h3 className="text-base sm:text-lg font-medium text-zinc-100 tracking-tight mb-1">
          Drop files to compress, or <span className="text-blue-400 underline underline-offset-4 decoration-blue-500/40 group-hover:decoration-blue-400">browse</span>
        </h3>
        
        <p className="text-xs text-zinc-400 max-w-sm mb-5">
          Images, PDFs, and Word documents. Compressed in your browser without uploading to any server.
        </p>

        {/* Minimalist format chips + paste hint */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-zinc-400">
          <span className="px-2 py-0.5 rounded bg-[#15171c] border border-[#23262e]">JPG</span>
          <span className="px-2 py-0.5 rounded bg-[#15171c] border border-[#23262e]">PNG</span>
          <span className="px-2 py-0.5 rounded bg-[#15171c] border border-[#23262e]">WEBP</span>
          <span className="px-2 py-0.5 rounded bg-[#15171c] border border-[#23262e]">PDF</span>
          <span className="px-2 py-0.5 rounded bg-[#15171c] border border-[#23262e]">DOCX</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-zinc-400 ml-1 pl-2 border-l border-zinc-800">
            <kbd className="px-1.5 py-0.5 rounded bg-[#181a20] border border-zinc-800 text-[10px]">Ctrl+V</kbd> to paste
          </span>
        </div>
      </div>
    </div>
  );
};
