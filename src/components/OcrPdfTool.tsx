import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Scan, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  UploadCloud,
  FileDown,
  Eye,
  Copy,
  Check,
  Globe,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  ocrScannedPdf, 
  SUPPORTED_OCR_LANGUAGES, 
  type OcrPageResult, 
  type OcrWord 
} from '../lib/ocrEngine';
import { saveAs } from 'file-saver';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { addHistoryEntry } from '../lib/historyStore';
import { PdfPreviewModal } from './PdfPreviewModal';
import type { ToastMessage } from './Toast';

interface OcrPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const OcrPdfTool: React.FC<OcrPdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>('eng');
  const [makeSearchablePdf, setMakeSearchablePdf] = useState<boolean>(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Output Results
  const [extractedText, setExtractedText] = useState<string>('');
  const [searchablePdfBlob, setSearchablePdfBlob] = useState<Blob | null>(null);
  const [pagesResults, setPagesResults] = useState<OcrPageResult[]>([]);
  const [overallConfidence, setOverallConfidence] = useState<number>(0);
  const [totalWords, setTotalWords] = useState<number>(0);
  const [copiedText, setCopiedText] = useState(false);

  // Inspector Viewer State
  const [activeInspectorPage, setActiveInspectorPage] = useState<number>(1);
  const [inspectorOverlayMode, setInspectorOverlayMode] = useState<'boxes' | 'heatmap' | 'none'>('boxes');
  const [hoveredWord, setHoveredWord] = useState<OcrWord | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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
      resetResults();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      resetResults();
    }
  };

  const resetResults = () => {
    setExtractedText('');
    setSearchablePdfBlob(null);
    setPagesResults([]);
    setOverallConfidence(0);
    setTotalWords(0);
    setThroughput(null);
    setActiveInspectorPage(1);
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
    resetResults();

    try {
      const result = await ocrScannedPdf(
        file,
        (stage, percent) => {
          setProgressStage(stage);
          setProgressPercent(percent);
        },
        { 
          signal: ac.signal, 
          language: selectedLang,
          makeSearchablePdf: makeSearchablePdf
        }
      );

      setExtractedText(result.text);
      if (result.pdfBlob) {
        setSearchablePdfBlob(result.pdfBlob);
      }
      if (result.pages) {
        setPagesResults(result.pages);
      }
      if (result.overallConfidence !== undefined) {
        setOverallConfidence(result.overallConfidence);
      }
      if (result.totalWords !== undefined) {
        setTotalWords(result.totalWords);
      }
      if (result.throughput) {
        setThroughput(result.throughput);
      }

      // Record to history store
      const outputName = file.name.replace(/\.pdf$/i, '_searchable.pdf');
      await addHistoryEntry({
        toolId: 'ocr-pdf',
        toolName: 'Searchable OCR PDF',
        fileName: file.name,
        fileSize: file.size,
        status: 'completed',
        resultFileName: outputName,
        resultBlob: result.pdfBlob,
        pageCount: result.pages?.length,
      });

      onToast('Searchable PDF with invisible text layer generated successfully!', 'success');
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

  const handleDownloadSearchablePdf = () => {
    if (!searchablePdfBlob || !file) return;
    const clean = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(searchablePdfBlob, `${clean}_searchable.pdf`);
    onToast('Downloaded Searchable OCR PDF.', 'success');
  };

  const handleDownloadText = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const clean = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, '')) : 'ocr_result';
    saveAs(blob, `${clean}_extracted.txt`);
  };

  const handleCopyText = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
    onToast('Extracted text copied to clipboard.', 'info');
  };

  const activePageData = pagesResults.find((p) => p.pageNum === activeInspectorPage);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900 shadow-xs dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-[#1f2430] dark:hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% On-Device Searchable OCR Engine</span>
        </div>
      </div>

      {/* Tool Title */}
      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Scan className="w-8 h-8 text-emerald-500" />
            Searchable OCR PDF
          </h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Sandwich PDF
          </span>
        </div>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Recognize text in scanned pages and overlay an invisible, searchable text layer directly onto the original scan while preserving 100% of the original appearance.
        </p>
      </div>

      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-emerald-500/60 bg-white/50 dark:bg-[#121620]/60 p-10 sm:p-14 text-center transition-all cursor-pointer hover:shadow-xl"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-zinc-200">
            Upload Scanned Document or Flat PDF
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
            All text recognition runs entirely on-device using local WebAssembly. Zero pages leave your machine.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Card & Configurations */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  PDF
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-xs sm:max-w-md">
                    {file.name}
                  </p>
                  <p className="text-xs text-stone-500 font-mono">{formatBytes(file.size)}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setFile(null);
                  resetResults();
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 transition cursor-pointer dark:text-zinc-300 dark:border-[#222834] dark:hover:bg-[#1e2330]"
              >
                Change PDF
              </button>
            </div>

            {/* OCR Language & Searchable PDF Options */}
            {!isProcessing && !extractedText && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-stone-200/60 dark:border-[#202735]">
                {/* Language Picker */}
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    Recognition Language:
                  </label>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-[#181d28] border border-stone-200 dark:border-[#262e3f] text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {SUPPORTED_OCR_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label} ({lang.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Searchable PDF Toggle */}
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-zinc-300 cursor-pointer p-2 rounded-xl bg-stone-50 dark:bg-[#181d28] border border-stone-200 dark:border-[#262e3f]">
                    <input
                      type="checkbox"
                      checked={makeSearchablePdf}
                      onChange={(e) => setMakeSearchablePdf(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span>Generate Invisible Searchable Text Layer (Sandwich PDF)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  {progressStage}
                </span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full bg-emerald-200/50 dark:bg-emerald-900/40 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
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
            <button
              onClick={handleOcr}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Scan className="w-4 h-4" />
              <span>Start Searchable OCR</span>
            </button>
          )}

          {/* Results Section */}
          {extractedText && (
            <div className="space-y-6 animate-in fade-in">
              {/* Quality & Confidence Diagnostics Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        OCR Processed Successfully
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                          {overallConfidence}% Confidence
                        </span>
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-zinc-400">
                        Recognized {totalWords} words across {pagesResults.length} page(s) using language code [{selectedLang}].
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {searchablePdfBlob && (
                      <>
                        <button
                          onClick={() => setIsPreviewModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1a202c] text-stone-800 dark:text-zinc-200 border border-stone-200 dark:border-[#283244] hover:bg-stone-100 transition cursor-pointer shadow-xs"
                        >
                          <Eye className="w-4 h-4 text-sky-500" />
                          <span>Preview &amp; Search PDF</span>
                        </button>

                        <button
                          onClick={handleDownloadSearchablePdf}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition cursor-pointer"
                        >
                          <FileDown className="w-4 h-4" />
                          <span>Download Searchable PDF</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={handleDownloadText}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-[#1d222e] dark:hover:bg-[#282f42] dark:text-zinc-200 transition cursor-pointer"
                      title="Download raw plain text"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>TXT</span>
                    </button>

                    <button
                      onClick={handleCopyText}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-[#1d222e] dark:hover:bg-[#282f42] dark:text-zinc-200 transition cursor-pointer"
                      title="Copy extracted text to clipboard"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {throughput && (
                  <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-stone-500 dark:text-zinc-400">
                    <span>Throughput: {throughput.charsPerSecond} chars/s ({throughput.pagesPerSecond} pages/s)</span>
                    <span>Processed {throughput.totalPages} page(s) in {(throughput.durationMs / 1000).toFixed(2)}s</span>
                  </div>
                )}
              </div>

              {/* Text Positioning & Quality Inspector */}
              {pagesResults.length > 0 && activePageData && (
                <div className="space-y-3 p-5 rounded-3xl bg-white dark:bg-[#121620] border border-stone-200 dark:border-[#222836] shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/60 dark:border-[#1e2432] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-900 dark:text-white">
                        Text Positioning &amp; Quality Inspector
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">
                        Page {activeInspectorPage} of {pagesResults.length} ({activePageData.words.length} words, {activePageData.confidence}% conf)
                      </span>
                    </div>

                    {/* Overlay Mode Selector */}
                    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-stone-100 dark:bg-[#1a202c] border border-stone-200 dark:border-[#262f40] text-xs font-medium">
                      <button
                        onClick={() => setInspectorOverlayMode('boxes')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          inspectorOverlayMode === 'boxes'
                            ? 'bg-white dark:bg-[#242c3c] text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        Bounding Boxes
                      </button>
                      <button
                        onClick={() => setInspectorOverlayMode('heatmap')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          inspectorOverlayMode === 'heatmap'
                            ? 'bg-white dark:bg-[#242c3c] text-emerald-700 dark:text-emerald-300 shadow-2xs font-bold'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        Confidence Heatmap
                      </button>
                      <button
                        onClick={() => setInspectorOverlayMode('none')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          inspectorOverlayMode === 'none'
                            ? 'bg-white dark:bg-[#242c3c] text-stone-900 dark:text-white shadow-2xs font-bold'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        Clean Scan
                      </button>
                    </div>

                    {/* Page Navigation */}
                    {pagesResults.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveInspectorPage((p) => Math.max(1, p - 1))}
                          disabled={activeInspectorPage <= 1}
                          className="p-1 rounded-lg border border-stone-200 dark:border-[#222836] disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono">{activeInspectorPage}/{pagesResults.length}</span>
                        <button
                          onClick={() => setActiveInspectorPage((p) => Math.min(pagesResults.length, p + 1))}
                          disabled={activeInspectorPage >= pagesResults.length}
                          className="p-1 rounded-lg border border-stone-200 dark:border-[#222836] disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Interactive Page Canvas / Overlay Container */}
                  <div className="relative max-w-2xl mx-auto rounded-xl overflow-hidden border border-stone-300 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 shadow-inner flex items-center justify-center">
                    {activePageData.previewDataUrl ? (
                      <div className="relative w-full">
                        <img
                          src={activePageData.previewDataUrl}
                          alt={`Page ${activeInspectorPage}`}
                          className="w-full block select-none pointer-events-none"
                        />

                        {/* Interactive Word Bounding Boxes Overlay */}
                        {inspectorOverlayMode !== 'none' && (
                          <div className="absolute inset-0 pointer-events-auto">
                            {activePageData.words.map((word, wIdx) => {
                              const leftPct = (word.bbox.x0 / activePageData.pageWidth) * 100;
                              const topPct = (word.bbox.y0 / activePageData.pageHeight) * 100;
                              const widthPct = ((word.bbox.x1 - word.bbox.x0) / activePageData.pageWidth) * 100;
                              const heightPct = ((word.bbox.y1 - word.bbox.y0) / activePageData.pageHeight) * 100;

                              // Heatmap color logic
                              let borderClass = 'border-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/35';
                              if (inspectorOverlayMode === 'heatmap') {
                                if (word.confidence >= 80) {
                                  borderClass = 'border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/40';
                                } else if (word.confidence >= 50) {
                                  borderClass = 'border-amber-500 bg-amber-500/20 hover:bg-amber-500/40';
                                } else {
                                  borderClass = 'border-rose-500 bg-rose-500/25 hover:bg-rose-500/45';
                                }
                              }

                              return (
                                <div
                                  key={wIdx}
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${widthPct}%`,
                                    height: `${heightPct}%`,
                                  }}
                                  onMouseEnter={() => setHoveredWord(word)}
                                  onMouseLeave={() => setHoveredWord(null)}
                                  className={`absolute border rounded-xs transition-all cursor-pointer ${borderClass}`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-xs text-stone-400">Loading page preview...</div>
                    )}
                  </div>

                  {/* Word Inspector Hover Bar */}
                  {hoveredWord && (
                    <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-[#1a202c] border border-stone-200 dark:border-[#252d3d] flex items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 dark:text-white">"{hoveredWord.text}"</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          hoveredWord.confidence >= 80
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : hoveredWord.confidence >= 50
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {Math.round(hoveredWord.confidence)}% Confidence
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500">
                        Box: [{hoveredWord.bbox.x0}, {hoveredWord.bbox.y0}] → [{hoveredWord.bbox.x1}, {hoveredWord.bbox.y1}]
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Text Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Complete Extracted Plain Text
                  </h3>
                  <span className="text-xs font-mono text-stone-400">
                    {extractedText.length} characters
                  </span>
                </div>
                <textarea
                  readOnly
                  value={extractedText}
                  className="w-full h-64 text-xs px-4 py-3 rounded-2xl border border-stone-200 dark:border-[#222736] bg-stone-50 dark:bg-[#0b0e14] text-stone-900 dark:text-zinc-300 font-mono focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF Full Preview Modal to test searchable text selection and searching */}
      {isPreviewModalOpen && searchablePdfBlob && (
        <PdfPreviewModal
          file={searchablePdfBlob}
          fileName={file ? file.name.replace(/\.pdf$/i, '_searchable.pdf') : 'Searchable_Document.pdf'}
          onClose={() => setIsPreviewModalOpen(false)}
        />
      )}
    </div>
  );
};
