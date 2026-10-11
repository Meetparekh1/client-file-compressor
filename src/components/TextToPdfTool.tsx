import React, { useState } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';
import { textToPdf } from '../lib/advancedPdfEngines';
import { saveAs } from 'file-saver';

interface TextToPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const TextToPdfTool: React.FC<TextToPdfToolProps> = ({ onBack, onToast }) => {
  const [docTitle, setDocTitle] = useState('Meeting Notes & Documentation');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState(`Project Overview
This document is generated 100% locally on this device using client-side WebAssembly and modern PDF rendering.

Key Requirements:
• Strict data privacy: No documents or text ever leave this machine.
• High fidelity layout: Standardized A4 formatting with clean margins and typography.
• Zero server reliance: Works fully offline without internet connection.`);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const handleGenerate = async () => {
    if (!content.trim()) {
      onToast('Please enter text content for your document.', 'error');
      return;
    }
    try {
      setIsProcessing(true);
      const blob = await textToPdf(docTitle, content, author);
      setResultBlob(blob);
      onToast('Generated A4 PDF from text successfully!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate PDF';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const cleanName = (docTitle.trim() || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');
    saveAs(resultBlob, `${cleanName}.pdf`);
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
          Text / Note to PDF Document
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Type, draft, or paste notes, articles, or documentation and format directly into an A4 PDF document.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Document Title</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white"
                placeholder="Enter title..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Author / Subtitle (Optional)</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white"
                placeholder="e.g. John Doe / Engineering Dept"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Document Content</label>
              <textarea
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white font-mono leading-relaxed"
                placeholder="Write or paste text content here..."
              />
            </div>
          </div>
        </div>

        {/* Action column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-lime-500" />
              <span>Generate PDF</span>
            </h2>

            {!resultBlob ? (
              <button
                onClick={handleGenerate}
                disabled={!content.trim() || isProcessing}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>Create PDF Document</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Document Created!</span>
                  </div>
                  <p className="mt-1">Formatted into standard A4 PDF pages with automated margins.</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Created PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
