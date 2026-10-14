import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Camera, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  FileCheck 
} from 'lucide-react';
import { imagesToPdfDocument, type PageSizeFormat } from '../lib/scanAndSignEngines';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { saveAs } from 'file-saver';

interface ScanToPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

interface ImageScanItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export const ScanToPdfTool: React.FC<ScanToPdfToolProps> = ({ onBack, onToast }) => {
  const [images, setImages] = useState<ImageScanItem[]>([]);
  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach(i => URL.revokeObjectURL(i.previewUrl));
    };
  }, []);
  const [pageSize, setPageSize] = useState<PageSizeFormat>('a4');
  const [filterMode, setFilterMode] = useState<'original' | 'grayscale' | 'contrast'>('original');
  const [outputFileName, setOutputFileName] = useState('scanned_document.pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles?.length) return;
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    if (valid.length === 0) {
      onToast('Please upload valid image files (JPG, PNG, WebP, etc.).', 'error');
      return;
    }

    const items: ImageScanItem[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      file: f,
      name: sanitizeFilename(f.name),
      size: f.size,
      previewUrl: URL.createObjectURL(f),
    }));

    setImages(prev => [...prev, ...items]);
    setIsComplete(false);
    setResultBlob(null);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const target = prev.find(i => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setImages(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === images.length - 1) return;
    setImages(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) {
      onToast('Please add at least one image or photo to scan.', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      setProgressMsg('Aligning and rendering pages...');
      const blob = await imagesToPdfDocument(
        images.map(i => i.file),
        { pageSize, filter: filterMode, margin: 20 },
        (prog, name) => {
          setProgressMsg(`${prog}% - ${name}`);
        }
      );

      setResultBlob(blob);
      setIsComplete(true);
      onToast(`Converted ${images.length} page(s) to ${pageSize.toUpperCase()} PDF successfully!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate PDF';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const finalName = outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`;
    saveAs(resultBlob, finalName);
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
          Scan Documents & Images to PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Turn camera snapshots or photo scans into clean, standardized PDF pages with custom page sizing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Image Drop & Reorder */}
        <div className="lg:col-span-8 space-y-4">
          <label className="relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all
            border-stone-300 bg-white/60 hover:bg-white hover:border-teal-400 shadow-sm
            dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24] dark:hover:border-teal-500/80">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="sr-only"
            />
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/50 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 shadow-sm">
              <Camera className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
              Drop images or document scans here, or <span className="text-teal-600 dark:text-teal-400 underline">browse</span>
            </p>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
              Supports JPG, PNG, WebP, HEIC/camera shots.
            </p>
          </label>

          {images.length > 0 && (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
                <span>Page Sequence ({images.length} pages)</span>
                <button
                  onClick={() => {
                    images.forEach(i => URL.revokeObjectURL(i.previewUrl));
                    setImages([]);
                  }}
                  className="text-rose-500 hover:text-rose-600 cursor-pointer font-medium"
                >
                  Clear all
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative group rounded-2xl border overflow-hidden bg-stone-50 dark:bg-[#161a23] border-stone-200 dark:border-white/5 flex flex-col justify-between"
                  >
                    <div className="aspect-3/4 relative overflow-hidden bg-stone-100 dark:bg-black/20 flex items-center justify-center">
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className={`w-full h-full object-contain ${
                          filterMode === 'grayscale' ? 'grayscale contrast-125' : filterMode === 'contrast' ? 'contrast-125 brightness-105' : ''
                        }`}
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 text-white backdrop-blur-xs">
                        Page {idx + 1}
                      </span>
                    </div>

                    <div className="p-2 flex items-center justify-between gap-1 text-xs">
                      <span className="truncate text-stone-700 dark:text-zinc-300 font-medium max-w-[100px]">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          title="Move earlier"
                          className="p-1 rounded text-stone-500 hover:text-stone-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveDown(idx)}
                          disabled={idx === images.length - 1}
                          title="Move later"
                          className="p-1 rounded text-stone-500 hover:text-stone-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeImage(item.id)}
                          title="Remove"
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Configuration & Run */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-500" />
              <span>Page Formatting</span>
            </h2>

            {/* Page Size Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Document Page Standard
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as PageSizeFormat)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="a4">A4 (210 × 297 mm - Standard)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
                <option value="auto">Auto Fit (Match Image Dimensions)</option>
              </select>
            </div>

            {/* Scan Appearance / Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Scan Appearance & Contrast
              </label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as 'original' | 'grayscale' | 'contrast')}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="original">Original Colors</option>
                <option value="grayscale">B&W Document (Grayscale Clean)</option>
                <option value="contrast">High Contrast (Text Sharpening)</option>
              </select>
            </div>

            {/* Output File Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Output File Name
              </label>
              <input
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-[#2a3243] bg-stone-50/50 dark:bg-[#171b25] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Action */}
            {!isComplete ? (
              <button
                onClick={handleGeneratePdf}
                disabled={images.length === 0 || isProcessing}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressMsg || 'Generating PDF...'}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Generate Standardized PDF</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>PDF Created!</span>
                  </div>
                  <p>Document Pages: {images.length}</p>
                  <p>File Size: {resultBlob ? formatBytes(resultBlob.size) : ''}</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF Document</span>
                </button>

                <button
                  onClick={() => setIsComplete(false)}
                  className="w-full py-2 px-3 text-xs text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
                >
                  Modify pages or re-generate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
