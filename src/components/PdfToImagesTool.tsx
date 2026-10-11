import React, { useState } from 'react';
import { 
  ArrowLeft, 
  FileImage, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';
import { pdfToImagesZip } from '../lib/advancedPdfEngines';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { parseFriendlyError } from '../lib/errorParser';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';

interface PdfToImagesToolProps {
  onBack: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const PdfToImagesTool: React.FC<PdfToImagesToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultZipBlob, setResultZipBlob] = useState<Blob | null>(null);

  const processSelectedFile = async (selected: File) => {
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF document.', 'error');
      return;
    }
    setFile(selected);
    setResultZipBlob(null);
    setTotalPages(0);

    try {
      const buf = await selected.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      setTotalPages(doc.getPageCount());
    } catch {
      onToast('Failed to load PDF file. The file may be password protected.', 'error');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    processSelectedFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processSelectedFile(dropped);
  };

  const handleConvert = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      const zipBlob = await pdfToImagesZip(file, imgFormat, (curr, tot) => {
        setProgressMsg(`Rendering page ${curr} of ${tot}...`);
      });
      setResultZipBlob(zipBlob);
      onToast(`Converted ${totalPages} pages to high-res ${imgFormat.toUpperCase()} images!`, 'success');
    } catch (err: unknown) {
      const friendly = parseFriendlyError(err, 'Failed to convert PDF pages to images.');
      onToast(`${friendly.title}: ${friendly.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultZipBlob || !file) return;
    const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
    saveAs(resultZipBlob, `${base}_images.zip`);
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
          PDF to Images (JPG / PNG)
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Render each page as a 2X high-resolution graphic and bundle into a ZIP archive.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {!file ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer border-stone-300 bg-white/60 hover:bg-white hover:border-sky-400 shadow-sm dark:border-[#2a3243] dark:bg-[#12161f]/60 dark:hover:bg-[#151a24]"
            >
              <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
              <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
                <FileImage className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-stone-800 dark:text-zinc-200">
                Drop PDF file here or <span className="text-sky-600 dark:text-sky-400 underline">browse</span>
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">Rendered strictly within browser canvas RAM.</p>
            </label>
          ) : (
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-[#222834]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-sm">{file.name}</h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{formatBytes(file.size)} • {totalPages} pages to export</p>
                  </div>
                </div>
                <label className="text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer hover:underline">
                  Change PDF
                  <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
                </label>
              </div>

              {/* Format */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Export Image Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImgFormat('png')}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      imgFormat === 'png'
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                        : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                    }`}
                  >
                    PNG (Lossless & Crisp)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgFormat('jpeg')}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      imgFormat === 'jpeg'
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                        : 'border-stone-200 dark:border-[#2a3243] text-stone-600 dark:text-zinc-400'
                    }`}
                  >
                    JPEG (Smaller Archive)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <FileImage className="w-4 h-4 text-sky-500" />
              <span>Convert to Images</span>
            </h2>

            {!resultZipBlob ? (
              <button
                onClick={handleConvert}
                disabled={!file || isProcessing}
                className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                  bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressMsg || 'Rendering...'}</span>
                  </>
                ) : (
                  <>
                    <FileImage className="w-4 h-4" />
                    <span>Export {totalPages} Pages as ZIP</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Conversion Ready!</span>
                  </div>
                  <p className="mt-1">All pages rendered to high-res {imgFormat.toUpperCase()} in ZIP ({formatBytes(resultZipBlob.size)}).</p>
                </div>

                <button
                  onClick={handleDownload}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ZIP Archive</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
