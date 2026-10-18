import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Binary, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';
import { addPageNumbersToPdf } from '../lib/advancedPdfEngines';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { validateFileSize } from '../lib/securityLimits';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

interface PageNumbersToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const PageNumbersTool: React.FC<PageNumbersToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');
  const [format, setFormat] = useState<'page-of-total' | 'number-only'>('page-of-total');
  const [fontSize, setFontSize] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const selected = e.target.files[0];
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF document.', 'error');
      return;
    }
    try {
      validateFileSize(selected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'File size exceeds limit.';
      onToast(msg, 'error');
      return;
    }
    try {
      const buf = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      setFile(selected);
      setTotalPages(doc.getPageCount());
      setResultBlob(null);
    } catch {
      onToast('Failed to load PDF file.', 'error');
    }
  };

  const handleApply = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      const blob = await addPageNumbersToPdf(file, { position, format, fontSize });
      setResultBlob(blob);
      onToast('Added page numbers successfully!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add page numbers';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(resultBlob, `${base}_numbered.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
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
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% On-Device Local Processing</span>
        </div>
      </div>

      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          Add Page Numbers to PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Insert automated page numbers or page counts into headers or footers with custom styling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {!file ? (
            <label className="border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer border-stone-300 bg-white/60 hover:bg-white hover:border-violet-400 shadow-sm dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24]">
              <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
              <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-3">
                <Binary className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
                Drop PDF file here or <span className="text-violet-600 dark:text-violet-400 underline">browse</span>
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Processed 100% locally on your computer.</p>
            </label>
          ) : (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-[#222834]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-sm">{file.name}</h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{formatBytes(file.size)} • {totalPages} pages total</p>
                  </div>
                </div>
                <label className="text-xs font-semibold text-violet-600 dark:text-violet-400 cursor-pointer hover:underline">
                  Change PDF
                  <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
                </label>
              </div>

              {/* Number Format */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Numbering Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('page-of-total')}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      format === 'page-of-total'
                        ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/20'
                        : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                    }`}
                  >
                    "Page 1 of {totalPages}"
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('number-only')}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      format === 'number-only'
                        ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/20'
                        : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                    }`}
                  >
                    "1", "2", "3"...
                  </button>
                </div>
              </div>

              {/* Position */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white"
                >
                  <option value="bottom-center">Bottom Center (Standard Footer)</option>
                  <option value="bottom-right">Bottom Right Corner</option>
                  <option value="top-right">Top Right Corner (Header)</option>
                </select>
              </div>

              {/* Font size */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-semibold text-stone-700 dark:text-zinc-300">Font Size</label>
                  <span>{fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="16"
                  step="1"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Binary className="w-4 h-4 text-violet-500" />
              <span>Apply Numbers</span>
            </h2>

            {!resultBlob ? (
              <button
                onClick={handleApply}
                disabled={!file || isProcessing}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Binary className="w-4 h-4" />}
                <span>Insert Page Numbers</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Pagination Complete!</span>
                  </div>
                  <p className="mt-1">All {totalPages} pages now include page numbers.</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Numbered PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
