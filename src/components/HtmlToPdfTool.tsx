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
import type { ToastMessage } from './Toast';

interface HtmlToPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const HtmlToPdfTool: React.FC<HtmlToPdfToolProps> = ({ onBack, onToast }) => {
  const [htmlContent, setHtmlContent] = useState('<h1>Hello World</h1>\\n<p>This is a sample HTML document converted directly to PDF.</p>');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const handleGenerate = async () => {
    if (!htmlContent.trim()) {
      onToast('Please enter HTML content.', 'error');
      return;
    }
    try {
      setIsProcessing(true);
      const blob = await convertHtmlToPdf(htmlContent, (percent, stage) => {
        setProgressPercent(percent);
        setProgressStage(stage);
      });
      setResultBlob(blob);
      onToast('Generated PDF from HTML successfully!', 'success');
    } catch (err: any) {
      onToast(err.message || 'Failed to generate PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    saveAs(resultBlob, `web_document.pdf`);
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
          <span>100% On-Device Rendering</span>
        </div>
      </div>

      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
          <Layout className="w-8 h-8 text-blue-500" />
          HTML to PDF Converter
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Paste your raw HTML and render it into a standardized PDF format.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">HTML Source Code</label>
              <textarea
                rows={16}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white font-mono leading-relaxed focus:outline-none focus:border-blue-500"
                placeholder="<html>...</html>"
              />
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
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />}
                <span>Render Document</span>
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
