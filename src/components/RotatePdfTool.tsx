import React, { useState } from 'react';
import { 
  ArrowLeft, 
  RotateCw, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  FileText,
  Eye
} from 'lucide-react';
import { rotatePdfPages } from '../lib/advancedPdfEngines';
import { parsePageRangeString } from '../lib/pdfOperations';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';

interface RotatePdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const RotatePdfTool: React.FC<RotatePdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>('all');
  const [customRange, setCustomRange] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [showEmbeddedViewer] = useState<boolean>(true);
  const [isModalViewerOpen, setIsModalViewerOpen] = useState<boolean>(false);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const selected = e.target.files[0];
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

  const handleRotate = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      let pages: 'all' | number[] = 'all';
      if (targetMode === 'custom') {
        const parsed = parsePageRangeString(customRange, totalPages);
        if (parsed.length === 0) {
          throw new Error('Please enter valid page numbers to rotate (e.g. 1, 3, 5).');
        }
        pages = parsed;
      }
      const blob = await rotatePdfPages(file, angle, pages);
      setResultBlob(blob);
      onToast(`Rotated PDF by ${angle}° successfully!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rotate PDF';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(resultBlob, `${base}_rotated.pdf`);
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
          Rotate PDF Pages
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Quickly rotate all or selected pages by 90°, 180°, or 270° clockwise.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {!file ? (
            <label className="border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer border-stone-300 bg-white/60 hover:bg-white hover:border-blue-400 shadow-sm dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24]">
              <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <RotateCw className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
                Drop PDF file here or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Processed 100% locally on your computer.</p>
            </label>
          ) : (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-[#222834]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-sm">{file.name}</h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{formatBytes(file.size)} • {totalPages} pages</p>
                  </div>
                </div>
                <label className="text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                  Change PDF
                  <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
                </label>
              </div>

              {/* Angle selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Choose Rotation Angle</label>
                <div className="grid grid-cols-3 gap-3">
                  {[90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setAngle(deg as 90 | 180 | 270)}
                      className={`py-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        angle === deg
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                          : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                      }`}
                    >
                      +{deg}° Clockwise
                    </button>
                  ))}
                </div>
              </div>

              {/* Target pages */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Target Pages</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetMode('all')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      targetMode === 'all'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                    }`}
                  >
                    All {totalPages} Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode('custom')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      targetMode === 'custom'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                    }`}
                  >
                    Custom Page Numbers
                  </button>
                </div>
                {targetMode === 'custom' && (
                  <input
                    type="text"
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    placeholder="e.g. 1, 3, 5"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white"
                  />
                )}
              </div>

              {/* Embedded Document Viewer Preview */}
              {file && showEmbeddedViewer && (
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-500" />
                      Live Document Workspace Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModalViewerOpen(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Expand to Fullscreen</span>
                    </button>
                  </div>
                  <DocumentViewerWorkspace
                    file={resultBlob || file}
                    fileName={file.name}
                    compareFile={resultBlob ? file : null}
                    compareFileName="Original PDF"
                    mode="embedded"
                    embeddedHeight="460px"
                    initialRotation={resultBlob ? 0 : angle}
                    badgeLabel={resultBlob ? 'Rotated' : `Pending +${angle}°`}
                    badgeColorClass={resultBlob ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-blue-500" />
              <span>Apply Rotation</span>
            </h2>

            {file && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-[#181d28] border border-stone-200/80 dark:border-white/5 text-xs">
                <span className="text-stone-600 dark:text-zinc-400">Preview Angle:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">+{angle}°</span>
              </div>
            )}

            {!resultBlob ? (
              <button
                onClick={handleRotate}
                disabled={!file || isProcessing || (targetMode === 'custom' && !customRange.trim())}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                <span>Rotate PDF by {angle}°</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Rotation Complete!</span>
                  </div>
                  <p className="mt-1">Document successfully rotated by {angle}°.</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Rotated PDF</span>
                </button>

                <button
                  onClick={() => setIsModalViewerOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Compare in Fullscreen</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Document Viewer Modal */}
      {isModalViewerOpen && file && (
        <DocumentViewerWorkspace
          file={resultBlob || file}
          fileName={file.name}
          compareFile={resultBlob ? file : null}
          compareFileName="Original PDF"
          mode="modal"
          onClose={() => setIsModalViewerOpen(false)}
          initialRotation={resultBlob ? 0 : angle}
          badgeLabel={resultBlob ? 'Rotated' : `Pending +${angle}°`}
          badgeColorClass={resultBlob ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}
        />
      )}
    </div>
  );
};
