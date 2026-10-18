import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  UploadCloud, 
  PenTool, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Eraser, 
  Type, 
  Stamp, 
  FileText,
  Eye
} from 'lucide-react';
import { applyWatermarkOrSignature, type WatermarkOptions } from '../lib/scanAndSignEngines';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { PDFDocument } from 'pdf-lib';
import { validateFileSize } from '../lib/securityLimits';
import { saveAs } from 'file-saver';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';

interface SignWatermarkToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SignWatermarkTool: React.FC<SignWatermarkToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [activeMode, setActiveMode] = useState<'signature' | 'watermark'>('signature');
  
  // Signature Drawing Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  
  // Watermark Settings
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [position, setPosition] = useState<'center' | 'bottom-right' | 'diagonal-all'>('bottom-right');
  const [opacity, setOpacity] = useState<number>(0.85);
  const [pageRange, setPageRange] = useState<'all' | 'first'>('all');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Setup signature drawing canvas
  useEffect(() => {
    if (activeMode !== 'signature') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [activeMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawnSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const selected = e.target.files[0];
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF file.', 'error');
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
      const buffer = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setFile(selected);
      setTotalPages(doc.getPageCount());
      setIsDone(false);
      setResultBlob(null);
    } catch {
      onToast('Failed to load PDF. Check if it is encrypted.', 'error');
    }
  };

  const handleApply = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      let signatureDataUrl: string | undefined;

      if (activeMode === 'signature') {
        if (!hasDrawnSignature || !canvasRef.current) {
          throw new Error('Please draw your signature first.');
        }
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      }

      const options: WatermarkOptions = {
        type: activeMode === 'signature' ? 'signature' : 'text',
        signatureDataUrl,
        text: watermarkText,
        position: activeMode === 'signature' ? position : position,
        opacity,
        pageRange,
      };

      const stampedBlob = await applyWatermarkOrSignature(file, options);
      setResultBlob(stampedBlob);
      setIsDone(true);
      onToast(
        activeMode === 'signature' ? 'Signature stamped onto PDF!' : 'Watermark applied successfully!',
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(resultBlob, `${base}_${activeMode === 'signature' ? 'signed' : 'watermarked'}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
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
          Sign & Watermark PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Draw your electronic signature or apply official text stamps onto PDF pages in your browser.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: PDF File selection & Signature Pad */}
        <div className="lg:col-span-8 space-y-4">
          {!file ? (
            <label className="relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all
              border-stone-300 bg-white/60 hover:bg-white hover:border-amber-400 shadow-sm
              dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24] dark:hover:border-amber-500/80">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                className="sr-only"
              />
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
                Drop PDF file here or <span className="text-amber-600 dark:text-amber-400 underline">browse</span>
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                Your PDF never uploads to any server. Processed safely inside your browser.
              </p>
            </label>
          ) : (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-[#222834]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-sm">
                      {file.name}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                      {formatBytes(file.size)} • <span className="text-amber-600 dark:text-amber-400 font-semibold">{totalPages} pages</span>
                    </p>
                  </div>
                </div>

                <label className="text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer hover:underline">
                  Change PDF
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileInput}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Mode Toggle */}
              <div className="flex rounded-2xl p-1 bg-stone-100 dark:bg-[#161a23] border border-stone-200/80 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => { setActiveMode('signature'); setPosition('bottom-right'); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeMode === 'signature'
                      ? 'bg-white dark:bg-[#202735] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5 text-amber-500" />
                  <span>Draw Digital Signature</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveMode('watermark'); setPosition('diagonal-all'); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeMode === 'watermark'
                      ? 'bg-white dark:bg-[#202735] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900'
                  }`}
                >
                  <Type className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Text Watermark</span>
                </button>
              </div>

              {/* Interactive Canvas Pad when Signature is selected */}
              {activeMode === 'signature' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700 dark:text-zinc-300">
                      Sign in the box below:
                    </span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>Clear Signature</span>
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-stone-300 dark:border-[#2a3243] rounded-2xl bg-stone-50/80 dark:bg-white overflow-hidden touch-none flex items-center justify-center shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={520}
                      height={180}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="cursor-crosshair w-full max-w-full"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400 dark:text-zinc-500 text-center">
                    Use your mouse, trackpad, or finger/stylus on touch screens to sign.
                  </p>
                </div>
              )}

              {/* Watermark Input when Text mode selected */}
              {activeMode === 'watermark' && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL / DRAFT / DO NOT COPY"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Placement & Actions */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Stamp className="w-4 h-4 text-amber-500" />
              <span>Stamp Placement</span>
            </h2>

            {/* Position */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Position on Page
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as 'center' | 'bottom-right' | 'diagonal-all')}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="bottom-right">Bottom Right Corner (Standard Signature)</option>
                <option value="center">Centered on Page</option>
                <option value="diagonal-all">Diagonal 45° (Watermark Style)</option>
              </select>
            </div>

            {/* Target Pages */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Apply to Pages
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPageRange('all')}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    pageRange === 'all'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                      : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                  }`}
                >
                  All Pages
                </button>
                <button
                  type="button"
                  onClick={() => setPageRange('first')}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    pageRange === 'first'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                      : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                  }`}
                >
                  First Page Only
                </button>
              </div>
            </div>

            {/* Opacity slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-stone-600 dark:text-zinc-300">
                  Opacity / Transparency
                </label>
                <span className="font-mono text-stone-500">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Action Button */}
            {!isDone ? (
              <button
                onClick={handleApply}
                disabled={!file || isProcessing || (activeMode === 'signature' && !hasDrawnSignature)}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Stamp...</span>
                  </>
                ) : (
                  <>
                    <Stamp className="w-4 h-4" />
                    <span>{activeMode === 'signature' ? 'Stamp Signature to PDF' : 'Apply Watermark'}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>PDF Ready!</span>
                  </div>
                  <p>Applied {activeMode === 'signature' ? 'Digital Signature' : 'Watermark'} to {pageRange === 'all' ? 'all pages' : 'first page'}.</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Stamped PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-500" />
                  <span>Preview Stamped PDF Workspace</span>
                </button>

                <button
                  onClick={() => setIsDone(false)}
                  className="w-full py-2 px-3 text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                >
                  Re-sign or adjust stamp
                </button>
              </div>
            )}

            {file && !isDone && (
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                <span>Preview Document Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Viewer Workspace Modal */}
      {isPreviewOpen && file && (
        <DocumentViewerWorkspace
          file={resultBlob || file}
          fileName={file.name}
          compareFile={resultBlob ? file : null}
          compareFileName="Original PDF"
          mode="modal"
          onClose={() => setIsPreviewOpen(false)}
          badgeLabel={resultBlob ? (activeMode === 'signature' ? 'Signed' : 'Watermarked') : 'Source PDF'}
          badgeColorClass={resultBlob ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}
        />
      )}
    </div>
  );
};
