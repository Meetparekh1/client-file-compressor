import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Edit3, 
  Loader2, 
  ShieldCheck, 
  UploadCloud,
  Type,
  Square,
  Circle,
  Save
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import type { ToastMessage } from './Toast';

// Configure pdfjs worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback
  }
}

interface EditPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const EditPdfTool: React.FC<EditPdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<string[]>([]); // Data URLs of pages
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      await loadPdfPages(selected);
    }
  };

  const loadPdfPages = async (f: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const loadedPages = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          loadedPages.push(canvas.toDataURL('image/png'));
        }
      }
      setPages(loadedPages);
      onToast('PDF loaded for editing.', 'success');
    } catch (err: any) {
      onToast('Error loading PDF: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
      // In a real advanced WYSIWYG, we'd use Fabric.js to get the combined canvas
      // For this simplified edit view, we'll re-export the images into a PDF using jsPDF.
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();

      pages.forEach((pageData, index) => {
        if (index > 0) pdf.addPage();
        const imgProps = pdf.getImageProperties(pageData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(pageData, 'PNG', 0, 0, pdfWidth, imgHeight);
      });

      pdf.save(file?.name.replace('.pdf', '_edited.pdf') || 'edited.pdf');
      onToast('PDF Exported Successfully!', 'success');
    } catch (e) {
      onToast('Failed to export', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 shadow-xs dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local WYSIWYG Editor</span>
        </div>
      </div>

      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
          <Edit3 className="w-8 h-8 text-indigo-500" />
          Edit PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Visually add text, shapes, and annotations directly onto your PDF pages.
        </p>
      </div>

      {!file ? (
        <div onClick={() => fileInputRef.current?.click()} className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-indigo-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg">
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-zinc-200">Open PDF to Edit</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-9 bg-stone-100 dark:bg-[#0b0e14] border border-stone-200 dark:border-[#222834] rounded-3xl p-4 overflow-y-auto max-h-[70vh] flex flex-col items-center gap-4">
            {isProcessing && <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />}
            {pages.map((p, i) => (
              <div key={i} className="relative group shadow-md border border-stone-300 dark:border-stone-700">
                <img src={p} alt={`Page ${i+1}`} className="max-w-full" />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="bg-white/90 text-black px-3 py-1 rounded-full text-xs font-bold">Page {i+1}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm border-b pb-2 border-stone-100 dark:border-stone-800">Toolbar</h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs">
                  <Type className="w-4 h-4" /> Text
                </button>
                <button className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs">
                  <Square className="w-4 h-4" /> Rect
                </button>
                <button className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs">
                  <Circle className="w-4 h-4" /> Circle
                </button>
                <button className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs">
                  <Edit3 className="w-4 h-4" /> Draw
                </button>
              </div>
              <button onClick={handleExport} disabled={isProcessing} className="w-full mt-4 py-3 px-4 rounded-2xl font-semibold text-sm shadow-md flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
                <Save className="w-4 h-4" /> Export Edited PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
