import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  UploadCloud,
  ArrowLeft,
  ShieldCheck,
  Download,
  Loader2,
  CheckCircle2,
  Settings2,
  FileType,
  Sparkles,
  Server,
  Laptop,
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import {
  convertPdfToDocx,
  convertPdfToXlsx,
  convertPdfToPptx,
  extractAndAnalyzePdf,
  type OfficeFormat,
  type DocumentAnalysis
} from '../lib/officeConverter';
import { convertPdfToDocx as remoteConvertPdfToDocx, checkConverterHealth, downloadBlob } from '../lib/remoteConverter';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { parseFriendlyError } from '../lib/errorParser';
import type { ToastMessage } from './Toast';

interface PdfToOfficeToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const PdfToOfficeTool: React.FC<PdfToOfficeToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<OfficeFormat>('docx');
  const [preservePageBreaks, setPreservePageBreaks] = useState(true);
  const [forceContinuousExcel, setForceContinuousExcel] = useState(false);
  const [useServerEngine, setUseServerEngine] = useState(false);
  const [isServerAvailable, setIsServerAvailable] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedName, setConvertedName] = useState('');
  const [showIncompatibilityModal, setShowIncompatibilityModal] = useState(false);
  // Phase 0.3: show a privacy notice before the first remote server upload
  const [showServerConsentModal, setShowServerConsentModal] = useState(false);
  const [serverConsentAcknowledged, setServerConsentAcknowledged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyze document characteristics upon file selection
  const analyzeSelectedFile = async (selectedFile: File) => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const { analysis: docAnalysis } = await extractAndAnalyzePdf(selectedFile);
      setAnalysis(docAnalysis);
      // Auto-suggest optimal format
      if (docAnalysis.recommendedFormat) {
        setSelectedFormat(docAnalysis.recommendedFormat);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleServer = async (enabled: boolean) => {
    setUseServerEngine(enabled);
    if (enabled && isServerAvailable === null) {
      const ok = await checkConverterHealth();
      setIsServerAvailable(ok);
      if (!ok) {
        onToast('Remote converter server not detected at localhost:7860. Using local in-browser engine instead.', 'info');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF document.', 'error');
      return;
    }
    setFile(selected);
    setConvertedBlob(null);
    setForceContinuousExcel(false);
    analyzeSelectedFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (dropped.type !== 'application/pdf' && !dropped.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please drop a valid PDF document.', 'error');
      return;
    }
    setFile(dropped);
    setConvertedBlob(null);
    setForceContinuousExcel(false);
    analyzeSelectedFile(dropped);
  };

  const handleSelectFormat = (fmt: OfficeFormat) => {
    setSelectedFormat(fmt);
    setConvertedBlob(null);

    // If selecting Excel on a document with NO tables, prompt custom warning
    if (fmt === 'xlsx' && analysis && !analysis.hasTabularData && !forceContinuousExcel) {
      setShowIncompatibilityModal(true);
    }
  };

  /** Actual conversion work — called only after all guards have passed */
  const executeConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    setProgressPercent(10);
    setProgressText('Reading PDF data in local memory...');

    try {
      let outputBlob: Blob;
      const baseName = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ''));
      const outputFileName = `${baseName}.${selectedFormat}`;

      if (useServerEngine && isServerAvailable && selectedFormat === 'docx') {
        setProgressText('Converting with LibreOffice Server Engine...');
        setProgressPercent(50);
        outputBlob = await remoteConvertPdfToDocx(file, {
          onProgress: (status) => setProgressText(status),
        });
      } else {
        if (selectedFormat === 'docx') {
          setProgressText('Extracting paragraphs, headings and XML tables...');
          outputBlob = await convertPdfToDocx(file, {
            preservePageBreaks,
            onProgress: (curr, total) => {
              setProgressPercent(Math.round((curr / total) * 90));
              setProgressText(`Formatting page ${curr} of ${total} into Word Document...`);
            },
          });
        } else if (selectedFormat === 'xlsx') {
          setProgressText('Structuring spreadsheet grid and column widths...');
          outputBlob = await convertPdfToXlsx(file, {
            forceContinuousText: forceContinuousExcel,
            onProgress: (curr, total) => {
              setProgressPercent(Math.round((curr / total) * 90));
              setProgressText(`Extracting tables from page ${curr} of ${total}...`);
            },
          });
        } else {
          setProgressText('Generating 16:9 widescreen presentation slides...');
          outputBlob = await convertPdfToPptx(file, {
            onProgress: (curr, total) => {
              setProgressPercent(Math.round((curr / total) * 90));
              setProgressText(`Building slide ${curr} of ${total}...`);
            },
          });
        }
      }

      setProgressPercent(100);
      setProgressText('Conversion completed!');
      setConvertedBlob(outputBlob);
      setConvertedName(outputFileName);
      onToast(`Successfully converted to ${selectedFormat.toUpperCase()}!`, 'success');
    } catch (err: unknown) {
      const friendly = parseFriendlyError(err);
      onToast(friendly.title + ': ' + friendly.message, 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvert = () => {
    if (!file) return;
    // Guard: incompatible format
    if (selectedFormat === 'xlsx' && analysis && !analysis.hasTabularData && !forceContinuousExcel) {
      setShowIncompatibilityModal(true);
      return;
    }
    // Phase 0.3: If server engine is selected and consent not yet given, show privacy notice first
    if (useServerEngine && isServerAvailable && selectedFormat === 'docx' && !serverConsentAcknowledged) {
      setShowServerConsentModal(true);
      return;
    }
    executeConvert();
  };

  const handleDownload = () => {
    if (!convertedBlob) return;
    downloadBlob(convertedBlob, convertedName);
    onToast(`Downloaded ${convertedName}`, 'success');
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

        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% On-Device Local Processing</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-2">
          <FileType className="w-3.5 h-3.5" />
          <span>Universal Office Suite</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          PDF to Word, Excel &amp; PowerPoint
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Intelligently converts PDF documents into editable DOCX, XLSX, and PPTX files with structure validation and table detection.
        </p>
      </div>

      {/* File Upload / Selected State */}
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-indigo-500/60 dark:hover:border-indigo-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-zinc-200">
            Click to upload or drag &amp; drop your PDF
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
            Compatible with single-page or multi-page documents. Analyzes text structure, tables, and slide orientations automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Card Info */}
          <div className="flex flex-wrap items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200/80 dark:border-[#222736] shadow-xs gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                PDF
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  {formatBytes(file.size)} {analysis ? `• ${analysis.totalPages} pages • ${analysis.totalWords} words` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setFile(null);
                setAnalysis(null);
                setConvertedBlob(null);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#1b212c] transition cursor-pointer"
            >
              Choose Different File
            </button>
          </div>

          {/* Document Intelligence Insights Banner */}
          {isAnalyzing && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center gap-2.5 text-xs text-indigo-700 dark:text-indigo-300">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Analyzing document layout, table density, and orientation...</span>
            </div>
          )}

          {analysis && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
              analysis.hasTabularData 
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                : analysis.isLandscapePresentation
                ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300'
                : 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40 text-blue-800 dark:text-blue-300'
            }`}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5">
                  {analysis.hasTabularData
                    ? `📊 Tabular Data Document (${analysis.tableCount} tables detected)`
                    : analysis.isLandscapePresentation
                    ? `🖥️ Presentation Slide Deck (${analysis.totalPages} landscape slides)`
                    : '📄 Continuous Text Document (Articles, contracts, or report)'}
                </span>
                <span>
                  {analysis.hasTabularData
                    ? 'This PDF contains structured tables and numerical columns. Excellent match for Excel (.xlsx) or Word (.docx).'
                    : analysis.isLandscapePresentation
                    ? 'This PDF matches presentation proportions. Excellent match for PowerPoint (.pptx).'
                    : 'This PDF consists of continuous narrative paragraphs. Word (.docx) is strongly recommended for clean layout and editable text.'}
                </span>
              </div>
            </div>
          )}

          {/* Format Selection Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-3">
              1. Select Output Office Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* DOCX Card */}
              <div
                onClick={() => handleSelectFormat('docx')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'docx'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm'
                    : 'border-stone-200 dark:border-[#222838] bg-white dark:bg-[#121620] hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      High Fidelity
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white">Word (.docx)</h4>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400">Editable Documents</span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
                    Stitches continuous paragraphs, formats headings, bullet lists, and genuine XML tables.
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Optimal for all narrative text</span>
                </div>
              </div>

              {/* XLSX Card */}
              <div
                onClick={() => handleSelectFormat('xlsx')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'xlsx'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm'
                    : 'border-stone-200 dark:border-[#222838] bg-white dark:bg-[#121620] hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    {analysis && !analysis.hasTabularData ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        No Tables
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Spreadsheet Grid
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white">Excel (.xlsx)</h4>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400">Data &amp; Tables</span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
                    Extracts structured rows, columns, numerical formulas, and auto-sized spreadsheet cells.
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-white/5 flex items-center gap-1.5 text-[11px] font-semibold">
                  {analysis && !analysis.hasTabularData ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Incompatible with plain text</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Ready for table extraction</span>
                    </span>
                  )}
                </div>
              </div>

              {/* PPTX Card */}
              <div
                onClick={() => handleSelectFormat('pptx')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedFormat === 'pptx'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm'
                    : 'border-stone-200 dark:border-[#222838] bg-white dark:bg-[#121620] hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Presentation className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      16:9 Widescreen
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white">PowerPoint (.pptx)</h4>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400">Slide Deck</span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
                    Transforms pages into presentation slides with header titles and bulleted overview cards.
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Condenses text into bullet slides</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#151924] border border-stone-200/80 dark:border-[#222838] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-zinc-300">
              <Settings2 className="w-4 h-4 text-indigo-500" />
              <span>Conversion Preferences</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              {selectedFormat === 'docx' && (
                <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preservePageBreaks}
                    onChange={(e) => setPreservePageBreaks(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Preserve individual PDF page breaks in Word document</span>
                </label>
              )}

              {selectedFormat === 'xlsx' && (
                <label className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceContinuousExcel}
                    onChange={(e) => setForceContinuousExcel(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Force export of non-tabular paragraphs into Column A</span>
                </label>
              )}

              {/* Execution Engine Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 dark:text-zinc-400">Engine:</span>
                <button
                  type="button"
                  onClick={() => handleToggleServer(false)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    !useServerEngine
                      ? 'bg-white dark:bg-[#202534] text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs'
                      : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>On-Device (Offline)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleServer(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    useServerEngine
                      ? 'bg-white dark:bg-[#202534] text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs'
                      : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Server (LibreOffice)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Progress / Status Display */}
          {isConverting && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {progressText}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/40 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <div className="flex flex-wrap items-center gap-3">
            {!convertedBlob ? (
              <button
                disabled={isConverting}
                onClick={handleConvert}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold
                  bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Converting Document...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Convert to {selectedFormat.toUpperCase()}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleDownload}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold
                    bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {convertedName}</span>
                </button>

                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready ({formatBytes(convertedBlob.size)})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incompatibility Custom Exception Modal */}
      {showIncompatibilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#141824] rounded-3xl border border-stone-200 dark:border-[#252c3c] p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                Incompatible Format: No Tabular Data Found
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
                This PDF consists of <strong>continuous narrative text</strong> (articles, contract paragraphs, or reports). Excel spreadsheets require data organized into rows, columns, or financial tables.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Recommended Solution:</p>
              <p>
                Convert this document to <strong>Word (.docx)</strong> instead. It will preserve paragraphs, headings, and margins in an editable document format.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => {
                  setSelectedFormat('docx');
                  setShowIncompatibilityModal(false);
                  onToast('Switched to Word (.docx) format.', 'info');
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                  bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Switch to Word (.docx) (Recommended)</span>
              </button>

              <button
                onClick={() => {
                  setForceContinuousExcel(true);
                  setShowIncompatibilityModal(false);
                  onToast('Proceeding with Excel export (raw text mode).', 'info');
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                  bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-[#1e2330] dark:hover:bg-[#282f42] dark:text-zinc-300 transition-all cursor-pointer"
              >
                <span>Export to Excel Anyway</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                onClick={() => setShowIncompatibilityModal(false)}
                className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition"
              >
                Cancel and review file
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Upload Consent Modal — Phase 0.3 */}
      {showServerConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#141824] rounded-3xl border border-stone-200 dark:border-[#252c3c] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                File Will Be Sent to Server
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
                You have selected the <strong>Server (LibreOffice)</strong> engine. Clicking confirm will{' '}
                <strong>upload your PDF file</strong> to the following API endpoint:
              </p>
              <code className="block mt-2 text-xs font-mono bg-stone-100 dark:bg-[#1a1f2c] text-stone-800 dark:text-zinc-300 px-3 py-2 rounded-xl break-all">
                {typeof window !== 'undefined'
                  ? (localStorage.getItem('converter-api-url') || 'http://localhost:7860')
                  : 'http://localhost:7860'}
              </code>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Privacy notice:</p>
              <p>Your file content will be transmitted to this endpoint. Only use this option if you trust and control the server. For full privacy, switch back to the <strong>On-Device</strong> engine instead.</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => {
                  setServerConsentAcknowledged(true);
                  setShowServerConsentModal(false);
                  executeConvert();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                  bg-amber-600 hover:bg-amber-500 active:scale-95 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Server className="w-4 h-4" />
                <span>I Understand — Upload to Server</span>
              </button>

              <button
                onClick={() => {
                  setShowServerConsentModal(false);
                  setUseServerEngine(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                  bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-[#1e2330] dark:hover:bg-[#282f42] dark:text-zinc-300 transition-all cursor-pointer"
              >
                <Laptop className="w-4 h-4" />
                <span>Stay On-Device (Safer)</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                onClick={() => setShowServerConsentModal(false)}
                className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
