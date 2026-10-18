import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Eye,
} from 'lucide-react';
import { convertDocxToPdf, downloadBlob, checkConverterHealth } from '../lib/remoteConverter';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { parseFriendlyError } from '../lib/errorParser';
import { validateFileSize } from '../lib/securityLimits';
import { setRemoteProcessingConsent } from '../lib/remoteConsent';
import { addHistoryEntry } from '../lib/historyStore';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';
import type { ToastMessage } from './Toast';

interface WordToPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
  initialFile?: File | null;
}

export const WordToPdfTool: React.FC<WordToPdfToolProps> = ({ onBack, onToast, initialFile }) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [isConverting, setIsConverting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedName, setConvertedName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!name.endsWith('.docx') && !name.endsWith('.doc')) {
      onToast('Please upload a Microsoft Word document (.docx or .doc).', 'error');
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
    setConvertedBlob(null);
    setErrorMessage(null);
    checkConverterHealth().catch(() => {});
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    const name = dropped.name.toLowerCase();
    if (!name.endsWith('.docx') && !name.endsWith('.doc')) {
      onToast('Please drop a Microsoft Word document (.docx or .doc).', 'error');
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
    setConvertedBlob(null);
    setErrorMessage(null);
    checkConverterHealth().catch(() => {});
  };

  const handleConvert = async () => {
    if (!file || isConverting) return;
    setRemoteProcessingConsent(true);
    setIsConverting(true);
    setErrorMessage(null);
    setProgressText('Connecting to conversion engine...');

    try {
      const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ''));
      const outputFileName = `${baseName}.pdf`;

      const pdfBlob = await convertDocxToPdf(file, {
        onProgress: (status) => setProgressText(status),
      });

      setConvertedBlob(pdfBlob);
      setConvertedName(outputFileName);
      addHistoryEntry({
        toolId: 'word-to-pdf',
        toolName: 'Word to PDF',
        fileName: file.name,
        fileSize: file.size,
        status: 'completed',
        resultFileName: outputFileName,
        resultSize: pdfBlob.size,
        resultBlob: pdfBlob,
      }).catch(() => {});
      onToast('Successfully converted Word document to PDF!', 'success');
    } catch (err: unknown) {
      const friendly = parseFriendlyError(err);
      const fullMsg = `${friendly.title}: ${friendly.message}`;
      setErrorMessage(fullMsg);
      onToast(fullMsg, 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedBlob) return;
    downloadBlob(convertedBlob, convertedName);
    onToast(`Downloaded ${convertedName}`, 'success');
  };

  const handleReset = () => {
    setFile(null);
    setConvertedBlob(null);
    setErrorMessage(null);
    setProgressText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation Bar */}
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
          <Sparkles className="w-3.5 h-3.5" />
          <span>Adobe PDF Services</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
          <FileText className="w-3.5 h-3.5" />
          <span>Document Converter</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          Word to PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Convert Microsoft Word documents (.docx, .doc) into standard, publication-ready PDF files with exact typography, tables, and pagination.
        </p>
      </div>

      {/* File Upload / Selected State */}
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-blue-500/60 dark:hover:border-blue-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
            Choose a Word document or drag it here
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1.5">
            Supports DOCX and DOC files (up to 50MB)
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-[#222838] bg-white dark:bg-[#121620] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  <span>{formatBytes(file.size)}</span>
                  <span>•</span>
                  <span>Output: PDF</span>
                </div>
              </div>
            </div>

            <button
              disabled={isConverting}
              onClick={handleReset}
              className="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 transition disabled:opacity-40 cursor-pointer"
            >
              Change file
            </button>
          </div>

          {/* Progress / Status */}
          {isConverting && (
            <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>{progressText || 'Converting Word document to PDF...'}</span>
              </div>
            </div>
          )}

          {/* Error Message & Retry */}
          {errorMessage && !isConverting && (
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Conversion Failed</p>
                  <p className="mt-0.5 leading-relaxed text-rose-700 dark:text-rose-300">
                    {errorMessage}
                  </p>
                </div>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConvert()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Conversion</span>
                </button>
              </div>
            </div>
          )}

          {/* Result / Download Card */}
          {convertedBlob && !isConverting && (
            <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    PDF Document Ready!
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-zinc-400">
                    {convertedName} ({formatBytes(convertedBlob.size)})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl font-semibold text-xs border border-stone-200 dark:border-[#2a3243] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#1a202c] transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  <span>Preview Converted PDF Workspace</span>
                </button>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-[#1a1f2c] dark:hover:bg-[#252c3c] dark:text-zinc-300 transition-all cursor-pointer"
                >
                  <span>Convert Another File</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Button: Convert */}
          {!convertedBlob && !isConverting && (
            <button
              onClick={() => handleConvert()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Convert to PDF</span>
            </button>
          )}
        </div>
      )}

      {/* Converted Document Viewer Workspace */}
      {isPreviewOpen && convertedBlob && (
        <DocumentViewerWorkspace
          file={convertedBlob}
          fileName={convertedName || 'Converted.pdf'}
          mode="modal"
          onClose={() => setIsPreviewOpen(false)}
          badgeLabel="Converted PDF"
          badgeColorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
      )}
    </div>
  );
};
