import React, { useState, useRef, useEffect } from 'react';
import {
  Brain,
  UploadCloud,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Download,
  Copy,
  Check,
  FileText,
  Clock,
  BookOpen,
  ListOrdered,
  Tag,
  Zap,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  Layers,
  SlidersHorizontal,
  Target,
  Code2,
  HelpCircle,
  FlaskConical,
  GraduationCap,
  Briefcase,
  Wrench,
  AlignLeft,
  FileQuestion,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  summarizePdfDocument,
  type SummaryResult,
  type SummaryMode,
  type DocumentType,
} from '../lib/aiSummarizer';
import { textToPdf } from '../lib/advancedPdfEngines';
import { pdfjsLib } from '../lib/pdfjsClient';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { parseFriendlyError } from '../lib/errorParser';
import type { ToastMessage } from './Toast';

interface AiSummarizerToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

// ---------------------------------------------------------------------------
// Document type display helpers
// ---------------------------------------------------------------------------

const DOC_TYPE_META: Record<DocumentType, { label: string; icon: React.ReactNode; color: string }> = {
  'academic': {
    label: 'Academic / Study Material',
    icon: <GraduationCap className="w-3.5 h-3.5" />,
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  'qa-document': {
    label: 'Q&A / Exam Document',
    icon: <FileQuestion className="w-3.5 h-3.5" />,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  'business': {
    label: 'Business / Report',
    icon: <Briefcase className="w-3.5 h-3.5" />,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  'technical': {
    label: 'Technical / Documentation',
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  },
  'general': {
    label: 'General Document',
    icon: <AlignLeft className="w-3.5 h-3.5" />,
    color: 'bg-stone-500/10 text-stone-600 dark:text-zinc-400 border-stone-500/20',
  },
};

// ---------------------------------------------------------------------------
// Collapsible Q&A Card
// ---------------------------------------------------------------------------

const QaCard: React.FC<{ q: string; a: string; idx: number; pageRef?: number }> = ({ q, a, idx, pageRef }) => {
  const [open, setOpen] = useState(idx < 3); // first 3 open by default

  return (
    <div className="rounded-2xl border border-stone-200/80 dark:border-[#252c3a] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-stone-50 dark:hover:bg-[#191e2b] transition cursor-pointer"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[11px] font-bold mt-0.5">
            {idx + 1}
          </span>
          <span className="text-sm font-semibold text-stone-800 dark:text-zinc-200 leading-snug">
            {q}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pageRef && (
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">p.{pageRef}</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-sm text-stone-700 dark:text-zinc-300 leading-relaxed border-t border-stone-100 dark:border-white/5 bg-stone-50/50 dark:bg-[#13171f]/50">
          {a || <span className="italic text-stone-400">No answer text extracted.</span>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Code block renderer
// ---------------------------------------------------------------------------

const CodeBlock: React.FC<{ code: string; language?: string; pageRef?: number }> = ({ code, language, pageRef }) => (
  <div className="rounded-2xl border border-stone-200/80 dark:border-[#252c3a] overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2 bg-stone-100/70 dark:bg-[#1a1f2c] border-b border-stone-200/60 dark:border-white/5">
      <div className="flex items-center gap-2">
        <Code2 className="w-3.5 h-3.5 text-stone-500 dark:text-zinc-400" />
        <span className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
          {language || 'code'}
        </span>
      </div>
      {pageRef && (
        <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">p.{pageRef}</span>
      )}
    </div>
    <pre className="p-4 text-xs text-stone-800 dark:text-zinc-200 overflow-x-auto bg-white dark:bg-[#131722] leading-relaxed font-mono whitespace-pre-wrap break-words">
      <code>{code}</code>
    </pre>
  </div>
);

// ---------------------------------------------------------------------------
// Formula block renderer
// ---------------------------------------------------------------------------

const FormulaBlock: React.FC<{ raw: string; context?: string; pageRef?: number }> = ({ raw, context, pageRef }) => (
  <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 p-4 space-y-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Formula</span>
      </div>
      {pageRef && <span className="text-[10px] text-stone-400 font-mono">p.{pageRef}</span>}
    </div>
    <p className="font-mono text-sm text-stone-800 dark:text-zinc-200 bg-white/60 dark:bg-black/20 rounded-xl px-3 py-2 leading-relaxed">
      {raw}
    </p>
    {context && (
      <p className="text-xs text-stone-600 dark:text-zinc-400 italic leading-relaxed">{context}</p>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AiSummarizerTool: React.FC<AiSummarizerToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePageCount, setFilePageCount] = useState<number | null>(null);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('executive');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeProgress, setSummarizeProgress] = useState({ stage: '', percent: 0 });
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Quick page count preview — load pdfjs after file chosen with guaranteed destroy
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let pdfDoc: any = null;
    (async () => {
      try {
        const ab = await file.arrayBuffer();
        if (cancelled) return;
        pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
        if (!cancelled) setFilePageCount(pdfDoc.numPages);
      } catch { /* ignore */ }
      finally {
        if (pdfDoc) {
          try { await pdfDoc.destroy(); } catch {}
        }
      }
    })();
    return () => {
      cancelled = true;
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch {}
      }
    };
  }, [file]);

  // Cleanup in-flight operations on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF document.', 'error');
      return;
    }
    setFilePageCount(null);
    setFile(selected);
    setSummaryResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (dropped.type !== 'application/pdf' && !dropped.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please drop a valid PDF document.', 'error');
      return;
    }
    setFilePageCount(null);
    setFile(dropped);
    setSummaryResult(null);
  };

  const handleStartSummarize = () => {
    if (!file) return;
    executeSummarize(summaryMode);
  };

  const executeSummarize = async (mode: SummaryMode) => {
    if (!file) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSummarizing(true);
    setSummarizeProgress({ stage: 'Opening PDF…', percent: 10 });

    try {
      const result = await summarizePdfDocument(
        file,
        mode,
        (stage, percent) => {
          if (controller.signal.aborted) return;
          setSummarizeProgress({ stage, percent });
        },
        { signal: controller.signal }
      );
      if (!controller.signal.aborted) {
        setSummaryResult(result);
        onToast('Document summarized successfully!', 'success');
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const friendly = parseFriendlyError(err);
        onToast(friendly.title + ': ' + friendly.message, 'error');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSummarizing(false);
      }
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsSummarizing(false);
    setSummarizeProgress({ stage: '', percent: 0 });
    onToast('Summarization cancelled.', 'info');
  };

  const buildCopyText = (r: SummaryResult): string => {
    const lines: string[] = [];
    lines.push(`DOCUMENT: ${r.documentTitle}`);
    lines.push(`TYPE: ${DOC_TYPE_META[r.documentType].label}\n`);
    lines.push('EXECUTIVE OVERVIEW');
    lines.push(r.executiveSummary + '\n');
    lines.push('KEY FINDINGS');
    r.keyPoints.forEach((k, i) => lines.push(`${i + 1}. ${k}`));
    if (r.questionsAndAnswers.length > 0) {
      lines.push('\nQUESTIONS & ANSWERS');
      r.questionsAndAnswers.forEach(qa => {
        lines.push(`Q: ${qa.question}`);
        lines.push(`A: ${qa.answer}\n`);
      });
    }
    if (r.formulas.length > 0) {
      lines.push('\nFORMULAS');
      r.formulas.forEach(f => lines.push(f.raw));
    }
    if (r.codeExamples.length > 0) {
      lines.push('\nCODE EXAMPLES');
      r.codeExamples.forEach(c => {
        lines.push(`[${c.language || 'code'}]`);
        lines.push(c.code + '\n');
      });
    }
    if (r.thematicSections.length > 0) {
      lines.push('\nDOCUMENT SECTIONS');
      r.thematicSections.forEach(sec => {
        lines.push(`\n${sec.title.toUpperCase()}`);
        sec.points.forEach(p => lines.push(`• ${p}`));
      });
    }
    if (r.actionItems.length > 0) {
      lines.push('\nACTION ITEMS');
      r.actionItems.forEach(a => lines.push(`• ${a}`));
    }
    lines.push(`\nSTATS: ${r.stats.pageCount} pages · ${r.stats.wordCount.toLocaleString()} words · ${r.stats.reductionPercentage}% condensed · ~${r.stats.readingTimeMinutes} min read`);
    return lines.join('\n');
  };

  const handleCopy = () => {
    if (!summaryResult) return;
    navigator.clipboard.writeText(buildCopyText(summaryResult));
    setCopied(true);
    onToast('Summary copied to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportPdf = async () => {
    if (!summaryResult || !file) return;
    try {
      const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ''));
      const pdfBlob = await textToPdf(
        `AI Summary — ${summaryResult.documentTitle}`,
        buildCopyText(summaryResult),
        'DocuKit On-Device NLP'
      );
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_AI_Summary.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onToast('Summary exported as PDF!', 'success');
    } catch (err: unknown) {
      const friendly = parseFriendlyError(err);
      onToast(friendly.title + ': ' + friendly.message, 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Nav */}
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
          <span>100% On-Device · Zero Uploads · Private</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 mb-2">
          <Brain className="w-3.5 h-3.5" />
          <span>On-Device NLP · Extractive Summarization</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          AI Document Summarizer
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Extracts structured summaries, key findings, Q&amp;A pairs, code, and formulas from PDF documents — entirely in your browser.
        </p>
      </div>

      {/* File Upload */}
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-violet-500/60 dark:hover:border-violet-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-zinc-200">
            Click to upload or drag &amp; drop a PDF
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            Academic papers, business reports, technical docs, study notes, contracts. Kept 100% on your device.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* File card + contextual info */}
          <div className="flex flex-wrap items-start gap-4">
            {/* File card */}
            <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] shadow-xs gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  PDF
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    {formatBytes(file.size)}
                    {filePageCount !== null && ` · ${filePageCount} page${filePageCount !== 1 ? 's' : ''}`}
                    {filePageCount !== null && ` · ~${Math.max(1, Math.round((filePageCount * 250) / 200))} min read`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setFile(null); setSummaryResult(null); setFilePageCount(null); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#1b212c] transition cursor-pointer"
              >
                Choose Different File
              </button>
            </div>
          </div>

          {/* Summary Mode Controls */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Summary Mode
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {([
                { mode: 'executive' as SummaryMode, icon: <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />, label: 'Executive Brief', desc: 'High-level synthesis: premise, conclusion, and top takeaway.' },
                { mode: 'comprehensive' as SummaryMode, icon: <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />, label: 'Comprehensive', desc: 'Full breakdown across sections, Q&A, code, and findings.' },
                { mode: 'action' as SummaryMode, icon: <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />, label: 'Action Directives', desc: 'Extracts obligations, decisions, and next steps.' },
              ] as const).map(({ mode, icon, label, desc }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSummaryMode(mode);
                    if (summaryResult) executeSummarize(mode);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    summaryMode === mode
                      ? 'border-violet-600 bg-violet-50/60 dark:bg-violet-950/30 dark:border-violet-500 shadow-xs'
                      : 'border-stone-200 dark:border-[#232838] hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="text-xs font-bold text-stone-900 dark:text-white">{label}</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy info + Generate button */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#151924] border border-stone-200/80 dark:border-[#222838] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-900 dark:text-white block">
                  On-Device Extractive NLP
                </span>
                <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                  Runs entirely in your browser. No internet connection needed. No files leave your device.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSummarizing && (
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold
                    bg-stone-200 hover:bg-stone-300 dark:bg-[#2a2f3e] dark:hover:bg-[#353c4e] text-stone-700 dark:text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                disabled={isSummarizing}
                onClick={handleStartSummarize}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                  bg-violet-600 hover:bg-violet-500 active:scale-95 text-white shadow-md shadow-violet-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{summaryResult ? 'Re-Summarize' : 'Generate Summary'}</span>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {isSummarizing && (
            <div className="p-4 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-violet-700 dark:text-violet-300">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {summarizeProgress.stage}
                </span>
                <span>{summarizeProgress.percent}%</span>
              </div>
              <div className="w-full bg-violet-200/50 dark:bg-violet-900/40 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-violet-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${summarizeProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* ============================================================
              SUMMARY RESULTS AREA
          ============================================================ */}
          {summaryResult && !isSummarizing && (
            <div className="space-y-5 pt-1 animate-in fade-in duration-300">

              {/* Document identity header */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-2 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${DOC_TYPE_META[summaryResult.documentType].color}`}>
                    {DOC_TYPE_META[summaryResult.documentType].icon}
                    {DOC_TYPE_META[summaryResult.documentType].label}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-[#1c212d] text-stone-600 dark:text-zinc-400 border border-stone-200/60 dark:border-stone-800">
                    <Sparkles className="w-3 h-3 text-violet-500" />
                    {summaryMode.toUpperCase()} MODE
                  </span>
                </div>
                <h2 className="text-base font-bold text-stone-900 dark:text-white leading-snug line-clamp-2">
                  {summaryResult.documentTitle}
                </h2>
              </div>

              {/* Stats ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: <FileText className="w-3.5 h-3.5" />, label: 'Total Pages', value: summaryResult.stats.pageCount },
                  { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Source Words', value: summaryResult.stats.wordCount.toLocaleString() },
                  { icon: <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />, label: 'Condensation', value: `${summaryResult.stats.reductionPercentage}%`, accent: 'text-emerald-600 dark:text-emerald-400' },
                  {
                    icon: <Clock className="w-3.5 h-3.5" />,
                    label: summaryResult.stats.inferenceDurationMs ? 'AI Time' : 'Est. Read',
                    value: summaryResult.stats.inferenceDurationMs
                      ? `${(summaryResult.stats.inferenceDurationMs / 1000).toFixed(1)}s`
                      : `~${summaryResult.stats.readingTimeMinutes} min`,
                  },
                ].map(({ icon, label, value, accent }) => (
                  <div key={label} className="p-3.5 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736]">
                    <div className="flex items-center gap-2 text-stone-400 dark:text-zinc-500 mb-1">
                      {icon}
                      <span className="text-[11px] font-semibold">{label}</span>
                    </div>
                    <span className={`text-lg font-bold ${accent ?? 'text-stone-900 dark:text-white'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {(summaryResult.stats.modelLoadDurationMs || summaryResult.stats.memoryUsedMb) ? (
                <div className="px-3.5 py-2 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 flex items-center justify-between text-xs font-mono text-violet-700 dark:text-violet-300">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-violet-500" />
                    <span>Engine Telemetry:</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {summaryResult.stats.modelLoadDurationMs ? (
                      <span>Model Load: <strong>{(summaryResult.stats.modelLoadDurationMs / 1000).toFixed(2)}s</strong></span>
                    ) : null}
                    {summaryResult.stats.memoryUsedMb ? (
                      <span>JS Heap: <strong>{summaryResult.stats.memoryUsedMb} MB</strong></span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Action toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736]">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Summary ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                      bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-[#1d222e] dark:hover:bg-[#282f42] dark:text-zinc-300 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy All'}</span>
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                      bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              {/* Executive Overview */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-2 shadow-xs">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-500" />
                  Executive Overview
                </h3>
                <p className="text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                  {summaryResult.executiveSummary}
                </p>
              </div>

              {/* Q&A Section — shown for academic and qa-document types, or when Q&A pairs are found */}
              {summaryResult.questionsAndAnswers.length > 0 && (
                <div className="p-5 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-violet-500" />
                    Questions &amp; Answers
                    <span className="ml-auto text-[11px] text-stone-400 dark:text-zinc-500 font-normal">
                      {summaryResult.questionsAndAnswers.length} extracted
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {summaryResult.questionsAndAnswers.map((qa, idx) => (
                      <QaCard key={idx} q={qa.question} a={qa.answer} idx={idx} pageRef={qa.pageRef} />
                    ))}
                  </div>
                </div>
              )}

              {/* Key Findings */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-indigo-500" />
                  Key Findings &amp; Evidence
                </h3>
                <ul className="space-y-3">
                  {summaryResult.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Formulas */}
              {summaryResult.formulas.length > 0 && (
                <div className="p-5 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-amber-500" />
                    Formulas &amp; Equations
                    <span className="ml-auto text-[11px] text-stone-400 dark:text-zinc-500 font-normal">
                      {summaryResult.formulas.length} found
                    </span>
                  </h3>
                  <div className="space-y-2.5">
                    {summaryResult.formulas.map((f, idx) => (
                      <FormulaBlock key={idx} raw={f.raw} context={f.context} pageRef={f.pageRef} />
                    ))}
                  </div>
                </div>
              )}

              {/* Code Examples */}
              {summaryResult.codeExamples.length > 0 && (
                <div className="p-5 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-teal-500" />
                    Code Examples
                    <span className="ml-auto text-[11px] text-stone-400 dark:text-zinc-500 font-normal">
                      {summaryResult.codeExamples.length} found
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {summaryResult.codeExamples.map((ex, idx) => (
                      <CodeBlock key={idx} code={ex.code} language={ex.language} pageRef={ex.pageRef} />
                    ))}
                  </div>
                </div>
              )}

              {/* Document Sections / Thematic Sections */}
              {summaryResult.thematicSections.length > 0 && (
                <div className="p-6 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Document Sections
                  </h3>
                  <div className="space-y-4">
                    {summaryResult.thematicSections.map((sec, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-xs font-bold text-stone-600 dark:text-zinc-400 uppercase tracking-wide">
                          {sec.title}
                        </p>
                        <ul className="space-y-1.5">
                          {sec.points.map((p, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-stone-700 dark:text-zinc-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              {summaryResult.actionItems.length > 0 && (
                <div className="p-6 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Action Items &amp; Next Steps
                  </h3>
                  <ul className="space-y-2.5">
                    {summaryResult.actionItems.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Numeric Insights */}
              {summaryResult.numericInsights.length > 0 && (
                <div className="p-5 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Key Metrics &amp; Data Points
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {summaryResult.numericInsights.map((ni, idx) => (
                      <div key={idx} className="p-3 rounded-2xl bg-stone-50 dark:bg-[#191e2b] border border-stone-200/60 dark:border-stone-800">
                        <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 block mb-1">{ni.metric}</span>
                        <p className="text-[11px] text-stone-600 dark:text-zinc-400 line-clamp-2">{ni.context}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic badges */}
              {summaryResult.topics.length > 0 && (
                <div className="p-5 rounded-3xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] space-y-3 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" />
                    Key Topics Identified
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {summaryResult.topics.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 dark:bg-[#1c212d] text-stone-700 dark:text-zinc-300 border border-stone-200/60 dark:border-stone-800"
                      >
                        #{t.text} <span className="text-stone-400 dark:text-stone-500 text-[10px]">({t.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback info for long-document chunking */}
              {(summaryResult as SummaryResult & { _chunked?: boolean })._chunked && (
                <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30 text-xs text-amber-800 dark:text-amber-300">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    This is a long document — the summary covers key sections. For full coverage, review the complete document alongside this summary.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
