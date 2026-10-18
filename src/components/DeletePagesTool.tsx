import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  FileText,
  Eye,
} from 'lucide-react';
import { deletePdfPages } from '../lib/advancedPdfEngines';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { validateFileSize } from '../lib/securityLimits';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';

interface DeletePagesToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const DeletePagesTool: React.FC<DeletePagesToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const processSelectedFile = async (selected: File) => {
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
    setFile(selected);
    setSelectedPages(new Set());
    setResultBlob(null);
    setTotalPages(0);

    try {
      const buf = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      setTotalPages(doc.getPageCount());
    } catch {
      onToast('Failed to load PDF file. The file may be password protected.', 'error');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    processSelectedFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processSelectedFile(dropped);
  };

  const togglePage = (pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!file || selectedPages.size === 0) return;
    try {
      setIsProcessing(true);
      const { blob, remainingCount } = await deletePdfPages(file, Array.from(selectedPages));
      setResultBlob(blob);
      onToast(`Deleted ${selectedPages.size} page(s). ${remainingCount} page(s) remaining.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete pages';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(resultBlob, `${base}_cleaned.pdf`);
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
          Delete PDF Pages
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Select and delete unwanted pages, extra covers, or blank sheets from your document.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {!file ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer border-stone-300 bg-white/60 hover:bg-white hover:border-rose-400 shadow-sm dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24]"
            >
              <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
                <Trash2 className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
                Drop PDF file here or <span className="text-rose-600 dark:text-rose-400 underline">browse</span>
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Processed 100% locally on your computer.</p>
            </label>
          ) : (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-[#222834]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-sm">{file.name}</h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{formatBytes(file.size)} • {totalPages} pages total</p>
                  </div>
                </div>
                <label className="text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer hover:underline">
                  Change PDF
                  <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
                </label>
              </div>

              {/* Interactive Page Tile Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-700 dark:text-zinc-300">
                    Click pages to mark for deletion:
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    {selectedPages.size} marked to delete
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-80 overflow-y-auto p-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                    const isSelected = selectedPages.has(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => togglePage(num)}
                        className={`h-16 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500 border-rose-600 text-white shadow-xs font-bold'
                            : 'bg-stone-50 dark:bg-[#181d28] border-stone-200 dark:border-white/5 text-stone-700 dark:text-zinc-300 hover:border-rose-300'
                        }`}
                      >
                        <span className="text-xs">p. {num}</span>
                        {isSelected && <Trash2 className="w-3.5 h-3.5 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Selection</span>
            </h2>

            {!resultBlob ? (
              <button
                onClick={handleDelete}
                disabled={!file || selectedPages.size === 0 || selectedPages.size >= totalPages || isProcessing}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Delete {selectedPages.size} Page(s)</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Pages Removed!</span>
                  </div>
                  <p className="mt-1">New PDF generated with {totalPages - selectedPages.size} pages.</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Cleaned PDF</span>
                </button>

                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Compare with Original</span>
                </button>
              </div>
            )}

            {file && !resultBlob && (
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-rose-500" />
                <span>Preview Document Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Document Viewer Modal */}
      {isPreviewOpen && file && (
        <DocumentViewerWorkspace
          file={resultBlob || file}
          fileName={file.name}
          compareFile={resultBlob ? file : null}
          compareFileName="Original PDF"
          mode="modal"
          onClose={() => setIsPreviewOpen(false)}
          badgeLabel={resultBlob ? 'Cleaned' : `${selectedPages.size} Marked to Delete`}
          badgeColorClass={resultBlob ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}
        />
      )}
    </div>
  );
};
