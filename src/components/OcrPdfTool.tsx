import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Scan, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  UploadCloud
} from 'lucide-react';
import { ocrScannedPdf } from '../lib/ocrEngine';
import { saveAs } from 'file-saver';
import { formatBytes } from '../lib/utils';
import type { ToastMessage } from './Toast';

interface OcrPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const OcrPdfTool: React.FC<OcrPdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [extractedText, setExtractedText] = useState<string>('');
  const [throughput, setThroughput] = useState<{
    totalPages: number;
    totalCharacters: number;
    durationMs: number;
    pagesPerSecond: number;
    charsPerSecond: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setExtractedText('');
      setThroughput(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setExtractedText('');
      setThroughput(null);
    }
  };

  const handleCancelOcr = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProgressStage('');
      setProgressPercent(0);
      onToast('OCR extraction cancelled.', 'info');
    }
  };

  const handleOcr = async () => {
    if (!file) return;
    const ac = new AbortController();
    abortControllerRef.current = ac;
    setIsProcessing(true);
    setThroughput(null);

    try {
      const result = await ocrScannedPdf(
        file,
        (stage, percent) => {
          setProgressStage(stage);
          setProgressPercent(percent);
        },
        { signal: ac.signal }
      );
      setExtractedText(result.text);
      if (result.throughput) {
        setThroughput(result.throughput);
      }
      onToast('OCR Extraction completed successfully.', 'success');
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        return;
      }
      const msg = err instanceof Error ? err.message : 'OCR failed';
      onToast(msg, 'error');
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  const handleDownloadText = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, file ? file.name.replace('.pdf', '_ocr.txt') : 'ocr_result.txt');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900 shadow-xs dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-[#1f2430] dark:hover:text-white transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% On-Device OCR</span>
        </div>
      </div>

      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
          <Scan className="w-8 h-8 text-emerald-500" />
          OCR Scanned PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Extract text from scanned images or flat PDFs using Tesseract.js directly in your browser.
        </p>
      </div>

      {!file ? (
        <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-emerald-500/60 dark:hover:border-emerald-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg">
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-zinc-200">Upload Scanned PDF</h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Text extraction happens locally on your device.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] shadow-xs gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">PDF</div>
              <div>
                <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-stone-500">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setExtractedText(''); }} className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 transition cursor-pointer dark:text-zinc-300 dark:border-[#222834] dark:hover:bg-[#1e2330]">
              Choose Different File
            </button>
          </div>

          {isProcessing && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progressStage}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-emerald-200/50 dark:bg-emerald-900/40 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleCancelOcr}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 border border-rose-200/60 dark:border-rose-800/50 transition cursor-pointer"
                >
                  Cancel Extraction
                </button>
              </div>
            </div>
          )}

          {!extractedText && !isProcessing && (
            <button onClick={handleOcr} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer">
              <Scan className="w-4 h-4" /> Start OCR Extraction
            </button>
          )}

          {throughput && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Throughput:</span>
                <span>{throughput.charsPerSecond} chars/s</span>
                <span>({throughput.pagesPerSecond} pages/s)</span>
              </div>
              <div className="text-stone-500 dark:text-zinc-400 text-[11px]">
                Processed {throughput.totalPages} page(s) ({throughput.totalCharacters} chars) in {(throughput.durationMs / 1000).toFixed(2)}s
              </div>
            </div>
          )}

          {extractedText && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Extracted Text</h3>
                <button onClick={handleDownloadText} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-[#1d222e] dark:hover:bg-[#282f42] dark:text-zinc-200 transition cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Download TXT
                </button>
              </div>
              <textarea
                readOnly
                value={extractedText}
                className="w-full h-64 text-sm px-4 py-3 rounded-2xl border border-stone-200 dark:border-[#222736] bg-stone-50 dark:bg-[#0b0e14] text-stone-900 dark:text-zinc-300 font-mono focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
