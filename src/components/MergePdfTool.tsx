import React, { useState } from 'react';
import { 
  ArrowLeft, 
  UploadCloud, 
  Files, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Plus, 
  FileText,
  AlertCircle 
} from 'lucide-react';
import { mergePdfFiles, type MergePdfItem } from '../lib/pdfOperations';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { parseFriendlyError } from '../lib/errorParser';
import { saveAs } from 'file-saver';

interface MergePdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const MergePdfTool: React.FC<MergePdfToolProps> = ({ onBack, onToast }) => {
  const [files, setFiles] = useState<MergePdfItem[]>([]);
  const [outputFileName, setOutputFileName] = useState('merged_document.pdf');
  const [isMerging, setIsMerging] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [isDone, setIsDone] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultSummary, setResultSummary] = useState<{ totalPages: number; size: number } | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const addedFiles: MergePdfItem[] = Array.from(e.target.files)
      .filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        name: sanitizeFilename(file.name),
        size: file.size,
      }));

    if (addedFiles.length === 0) {
      onToast('Please upload valid PDF documents.', 'error');
      return;
    }

    setFiles((prev) => [...prev, ...addedFiles]);
    setIsDone(false);
    setResultBlob(null);
    e.target.value = '';
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      onToast('Please select at least 2 PDF files to merge.', 'error');
      return;
    }

    try {
      setIsMerging(true);
      setProgressStatus('Reading documents...');
      const { blob, totalPages } = await mergePdfFiles(
        files.map((f) => f.file),
        (prog, currentFile) => {
          setProgressStatus(`${prog}% - ${currentFile}`);
        }
      );

      setResultBlob(blob);
      setResultSummary({ totalPages, size: blob.size });
      setIsDone(true);
      onToast(`Merged ${files.length} PDFs into ${totalPages} pages successfully!`, 'success');
    } catch (err: unknown) {
      const friendly = parseFriendlyError(err, 'Failed to merge PDF files.');
      onToast(`${friendly.title}: ${friendly.message}`, 'error');
    } finally {
      setIsMerging(false);
    }
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    const finalName = outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`;
    saveAs(resultBlob, finalName);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header / Breadcrumbs */}
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
          Merge PDF Files
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Combine multiple PDF files into one clean document in your chosen order.
        </p>
      </div>

      {/* Main Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Drag & Drop / File List */}
        <div className="lg:col-span-8 space-y-4">
          {/* Dropzone */}
          <label className="relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all
            border-stone-300 bg-white/60 hover:bg-white hover:border-indigo-400 shadow-sm
            dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24] dark:hover:border-indigo-500/80">
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileInput}
              className="sr-only"
            />
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-sm">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
              Drop PDF files here or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
            </p>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
              Select 2 or more PDF documents. Files are processed entirely in your browser.
            </p>
          </label>

          {/* Files Reordering List */}
          {files.length > 0 && (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
                <span>Merge Sequence ({files.length} documents)</span>
                <button
                  onClick={() => setFiles([])}
                  className="text-rose-500 hover:text-rose-600 text-xs font-medium cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-2">
                {files.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50/70 dark:bg-[#181d28] border border-stone-200/80 dark:border-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-zinc-400">
                          {formatBytes(item.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1.5 rounded-lg text-stone-500 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === files.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded-lg text-stone-500 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFile(item.id)}
                        title="Remove file"
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline mt-2">
                <Plus className="w-4 h-4" />
                <span>Add more PDF files</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={handleFileInput}
                  className="sr-only"
                />
              </label>
            </div>
          )}
        </div>

        {/* Right Column: Settings & Actions */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Files className="w-4 h-4 text-indigo-500" />
              <span>Merge Options</span>
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Output File Name
              </label>
              <input
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="merged_document.pdf"
              />
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#181d28] border border-stone-200/80 dark:border-white/5 space-y-1 text-xs text-stone-600 dark:text-zinc-400">
              <p className="font-semibold text-stone-800 dark:text-zinc-200">Documents selected:</p>
              <p className="text-stone-500 dark:text-zinc-400">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </p>
              {files.length === 1 && (
                <p className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Add at least 1 more file to merge.
                </p>
              )}
            </div>

            {/* Merge Action Button */}
            {!isDone ? (
              <button
                onClick={handleMerge}
                disabled={files.length < 2 || isMerging}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Merging ({progressStatus})...</span>
                  </>
                ) : (
                  <>
                    <Files className="w-4 h-4" />
                    <span>Merge PDFs Now</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Merged Successfully!</span>
                  </div>
                  <p>Total Pages: {resultSummary?.totalPages}</p>
                  <p>Output Size: {resultSummary ? formatBytes(resultSummary.size) : ''}</p>
                </div>

                <button
                  onClick={downloadResult}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Merged PDF</span>
                </button>

                <button
                  onClick={() => setIsDone(false)}
                  className="w-full py-2 px-3 text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                >
                  Re-arrange or merge again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
