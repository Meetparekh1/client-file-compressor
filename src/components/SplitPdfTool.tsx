import React, { useState } from 'react';
import { 
  ArrowLeft, 
  UploadCloud, 
  Scissors, 
  FileText, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Layers, 
  ListFilter,
  Eye
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '../lib/pdfjsClient';
import { extractPdfPages, parsePageRangeString, splitPdfIntoSinglePages } from '../lib/pdfOperations';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { validateFileSize } from '../lib/securityLimits';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';

interface SplitPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type SplitMode = 'range' | 'all';

export const SplitPdfTool: React.FC<SplitPdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [mode, setMode] = useState<SplitMode>('range');
  const [rangeInput, setRangeInput] = useState<string>('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  
  // Results
  const [extractedBlob, setExtractedBlob] = useState<Blob | null>(null);
  const [allPagesBlobs, setAllPagesBlobs] = useState<{ pageNumber: number; blob: Blob }[] | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const processSelectedFile = async (selected: File) => {
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please select a valid PDF file.', 'error');
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
    setTotalPages(0);
    setIsComplete(false);
    setExtractedBlob(null);
    setAllPagesBlobs(null);

    try {
      const buffer = await selected.arrayBuffer();
      // Fast page count using pdfjs
      try {
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const count = pdf.numPages;
        setTotalPages(count);
        setRangeInput(`1-${Math.min(count, 3)}`);
      } catch {
        // Fallback to pdf-lib
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const count = doc.getPageCount();
        setTotalPages(count);
        setRangeInput(`1-${Math.min(count, 3)}`);
      }
    } catch {
      onToast('Failed to read the PDF. The file may be password protected.', 'error');
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

  const handleProcess = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      if (mode === 'range') {
        setProgressMsg('Validating page ranges...');
        const pages = parsePageRangeString(rangeInput, totalPages);
        if (pages.length === 0) {
          throw new Error('Please enter valid page numbers to extract.');
        }

        setProgressMsg(`Extracting ${pages.length} pages...`);
        const { blob } = await extractPdfPages(file, pages);
        setExtractedBlob(blob);
        setAllPagesBlobs(null);
        setIsComplete(true);
        onToast(`Extracted ${pages.length} pages successfully!`, 'success');
      } else {
        setProgressMsg('Splitting document into individual pages...');
        const { pageBlobs } = await splitPdfIntoSinglePages(file, (curr, tot) => {
          setProgressMsg(`Processing page ${curr} of ${tot}...`);
        });
        setAllPagesBlobs(pageBlobs);
        setExtractedBlob(null);
        setIsComplete(true);
        onToast(`Split into ${pageBlobs.length} separate pages!`, 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to split PDF.';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadExtractedPdf = () => {
    if (!extractedBlob || !file) return;
    const baseName = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(extractedBlob, `${baseName}_extracted.pdf`);
  };

  const downloadAllPagesZip = async () => {
    if (!allPagesBlobs || !file) return;
    const baseName = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    const zip = new JSZip();

    allPagesBlobs.forEach(({ pageNumber, blob }) => {
      zip.file(`${baseName}_page_${pageNumber}.pdf`, blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${baseName}_all_pages.zip`);
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
          Extract & Split PDF Pages
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Extract specific page ranges into a new document or split every page into separate files.
        </p>
      </div>

      {/* Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Dropzone / Selected File */}
        <div className="lg:col-span-8 space-y-4">
          {!file ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all
                border-stone-300 bg-white/60 hover:bg-white hover:border-purple-400 shadow-sm
                dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24] dark:hover:border-purple-500/80">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                className="sr-only"
              />
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
                Drop your PDF here or <span className="text-purple-600 dark:text-purple-400 underline">browse</span>
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                Upload a single PDF to extract or split pages locally.
              </p>
            </label>
          ) : (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-[#222834]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-sm sm:max-w-md">
                      {file.name}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                      {formatBytes(file.size)} • <span className="text-purple-600 dark:text-purple-400 font-semibold">{totalPages} pages total</span>
                    </p>
                  </div>
                </div>

                <label className="text-xs font-semibold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline">
                  Change file
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileInput}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Split Mode Selector */}
              <div className="space-y-3 pt-1">
                <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                  Select Split Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setMode('range'); setIsComplete(false); }}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      mode === 'range'
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                        : 'border-stone-200 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] hover:border-purple-300'
                    }`}
                  >
                    <ListFilter className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-stone-900 dark:text-white">Custom Page Range</p>
                      <p className="text-xs text-stone-500 dark:text-zinc-400">Extract selected pages (e.g. 1-3, 5)</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('all'); setIsComplete(false); }}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      mode === 'all'
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                        : 'border-stone-200 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] hover:border-purple-300'
                    }`}
                  >
                    <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-stone-900 dark:text-white">Split Every Page</p>
                      <p className="text-xs text-stone-500 dark:text-zinc-400">Export each page as an individual PDF</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Range Input box if range mode */}
              {mode === 'range' && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-stone-700 dark:text-zinc-300">
                      Pages to extract:
                    </label>
                    <span className="text-stone-500 dark:text-zinc-400">
                      Valid: 1 to {totalPages}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => { setRangeInput(e.target.value); setIsComplete(false); }}
                    placeholder="e.g. 1-3, 5, 7"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Example: <span className="font-mono text-purple-600 dark:text-purple-400">1-3, 5</span> will extract page 1, 2, 3 and 5 into a single combined PDF.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Actions & Downloads */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-purple-500" />
              <span>Split Action</span>
            </h2>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#181d28] border border-stone-200/80 dark:border-white/5 space-y-1.5 text-xs text-stone-600 dark:text-zinc-400">
              <p className="font-semibold text-stone-800 dark:text-zinc-200">Processing Mode:</p>
              <p className="text-purple-600 dark:text-purple-400 font-medium">
                {mode === 'range' ? `Extract range: [${rangeInput}]` : `Split into ${totalPages} single files`}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-zinc-500 pt-1">
                Zero data sent to any server. Completely private on your machine.
              </p>
            </div>

            {!isComplete ? (
              <button
                onClick={handleProcess}
                disabled={!file || isProcessing || (mode === 'range' && !rangeInput.trim())}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressMsg || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    <span>{mode === 'range' ? 'Extract Pages' : 'Split All Pages'}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Pages Ready!</span>
                  </div>
                  <p>
                    {mode === 'range' 
                      ? 'Extracted document successfully generated.' 
                      : `Split into ${allPagesBlobs?.length || 0} separate PDF documents.`}
                  </p>
                </div>

                {mode === 'range' && extractedBlob && (
                  <>
                    <button
                      onClick={downloadExtractedPdf}
                      className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                        bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Extracted PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-purple-500" />
                      <span>Compare Extracted with Original</span>
                    </button>
                  </>
                )}

                {mode === 'all' && allPagesBlobs && (
                  <button
                    onClick={downloadAllPagesZip}
                    className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                      bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All Pages (.ZIP)</span>
                  </button>
                )}

                <button
                  onClick={() => setIsComplete(false)}
                  className="w-full py-2 px-3 text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                >
                  Adjust selection or re-run
                </button>
              </div>
            )}

            {file && !isComplete && (
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-purple-500" />
                <span>Preview Document Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Viewer Workspace Modal */}
      {isPreviewOpen && file && (
        <DocumentViewerWorkspace
          file={extractedBlob || file}
          fileName={file.name}
          compareFile={extractedBlob ? file : null}
          compareFileName="Original Document"
          mode="modal"
          onClose={() => setIsPreviewOpen(false)}
          badgeLabel={extractedBlob ? 'Extracted' : `Range: ${rangeInput}`}
          badgeColorClass={extractedBlob ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'}
        />
      )}
    </div>
  );
};
