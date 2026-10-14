import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Code, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Layout
} from 'lucide-react';
import { convertHtmlToPdf } from '../lib/htmlToPdfEngine';
import { saveAs } from 'file-saver';
import { parseFriendlyError } from '../lib/errorParser';
import type { ToastMessage } from './Toast';

interface HtmlToPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const HtmlToPdfTool: React.FC<HtmlToPdfToolProps> = ({ onBack, onToast }) => {
  const [htmlContent, setHtmlContent] = useState('<h1>Hello World</h1>\n<p>This is a sample HTML document converted directly to PDF.</p>');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const handleGenerate = async () => {
    if (isProcessing) return; // Prevent duplicate submissions

    const trimmed = htmlContent.trim();
    if (!trimmed) {
      onToast('Please enter HTML content before rendering.', 'error');
      return;
    }

    if (trimmed.length > 1_000_000) {
      onToast('HTML exceeds maximum allowed size limit of 1MB.', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      setProgressPercent(5);
      setProgressStage('Validating & preparing sandbox...');
      const blob = await convertHtmlToPdf(trimmed, (percent, stage) => {
        setProgressPercent(percent);
        setProgressStage(stage);
      });
      setResultBlob(blob);
      onToast('Generated PDF from HTML successfully!', 'success');
    } catch (err: unknown) {
      const parsed = parseFriendlyError(err);
      onToast(parsed.message || 'Failed to render HTML to PDF.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    saveAs(resultBlob, 'web_document.pdf');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 shadow-xs dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sandboxed Local Rendering</span>
        </div>
      </div>

      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
          <Layout className="w-8 h-8 text-blue-500" />
          HTML to PDF Converter
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Render modern HTML & CSS into a standardized PDF format inside a secure, client-side sandbox.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">HTML Source Code</label>
              <span className="text-[11px] font-mono text-stone-400 dark:text-zinc-500">
                {(new TextEncoder().encode(htmlContent).length / 1024).toFixed(1)} KB / 1000 KB
              </span>
            </div>
            <textarea
              rows={16}
              value={htmlContent}
              disabled={isProcessing}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white font-mono leading-relaxed focus:outline-none focus:border-blue-500 disabled:opacity-60"
              placeholder="<html>...</html>"
            />
          </div>

          {/* Supported HTML Features Guide */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] text-xs text-stone-600 dark:text-zinc-400 space-y-2">
            <h4 className="font-bold text-stone-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-blue-500" />
              Supported HTML & CSS Features
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed pt-1">
              <div>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Supported:</p>
                <ul className="list-disc list-inside space-y-0.5 text-stone-600 dark:text-zinc-400">
                  <li>Standard tags (h1-h6, p, table, ul, ol, div, span)</li>
                  <li>Inline CSS styles & layout (Flexbox, Grid, Colors)</li>
                  <li>Base64 embedded images (<code className="text-[10px]">data:image/...</code>)</li>
                  <li>Standard system web fonts</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-amber-600 dark:text-amber-400">⚠ Blocked for Security:</p>
                <ul className="list-disc list-inside space-y-0.5 text-stone-600 dark:text-zinc-400">
                  <li>JavaScript execution (<code className="text-[10px]">&lt;script&gt;</code>, inline <code className="text-[10px]">on*</code> handlers)</li>
                  <li>Interactive inputs (<code className="text-[10px]">&lt;form&gt;</code>, <code className="text-[10px]">&lt;input&gt;</code>)</li>
                  <li>Nested iframes, frames, or external plugin objects</li>
                  <li>Unauthenticated external third-party network fetches</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-blue-500" />
              <span>Generate PDF</span>
            </h2>

            {isProcessing && (
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progressStage}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-blue-200/50 dark:bg-blue-900/40 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}

            {!resultBlob ? (
              <button
                onClick={handleGenerate}
                disabled={!htmlContent.trim() || isProcessing}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />}
                <span>{isProcessing ? 'Rendering...' : 'Render Document'}</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Rendering Complete!</span>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                
                <button onClick={() => setResultBlob(null)} className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-[#1a1f2c] cursor-pointer">
                  Start Over
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
