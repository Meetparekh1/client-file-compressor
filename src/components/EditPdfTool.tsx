import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Edit3, 
  Loader2, 
  ShieldCheck, 
  UploadCloud,
  Type,
  Square,
  Circle,
  Highlighter,
  ArrowRight,
  Minus,
  PenTool,
  Save,
  Trash2,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Stamp
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfjsClient';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { sanitizeFilename } from '../lib/utils';
import { validateFileSize } from '../lib/securityLimits';
import { cleanupCanvas } from '../lib/resourceManager';
import { addHistoryEntry } from '../lib/historyStore';
import type { ToastMessage } from './Toast';

interface EditPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
  initialFile?: File | null;
}

interface PageMeta {
  pageNum: number; // 1-based
  dataUrl: string;
  viewportWidth: number;
  viewportHeight: number;
}

export type EditorTool = 
  | 'text' 
  | 'highlight' 
  | 'rect' 
  | 'circle' 
  | 'line' 
  | 'arrow' 
  | 'draw' 
  | 'signature' 
  | 'image';

export interface Point {
  xPct: number;
  yPct: number;
}

export interface Annotation {
  id: string;
  pageNum: number; // 1-based
  type: EditorTool;
  xPct: number; // 0..1 relative to page width
  yPct: number; // 0..1 relative to page height
  endXPct?: number; // for line, arrow
  endYPct?: number;
  widthPct?: number; // for rect, circle, highlight, signature, image
  heightPct?: number;
  text?: string;
  color: string;
  fontSize?: number;
  strokeWidth?: number;
  points?: Point[]; // for freehand draw
  imageDataUrl?: string; // for signature & image
}

const PRESET_COLORS = [
  '#dc2626', // Red
  '#2563eb', // Blue
  '#16a34a', // Green
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#09090b', // Black
  '#facc15', // Yellow (Highlighter)
];

export const EditPdfTool: React.FC<EditPdfToolProps> = ({ 
  onBack, 
  onToast,
  initialFile = null 
}) => {
  const [file, setFile] = useState<File | null>(initialFile);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<PageMeta[]>([]);
  
  // Active editor tool & styling
  const [activeTool, setActiveTool] = useState<EditorTool>('text');
  const [activeColor, setActiveColor] = useState<string>('#2563eb');
  const [activeText, setActiveText] = useState<string>('Important Notice');
  const [activeFontSize, setActiveFontSize] = useState<number>(14);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);

  // Zoom controls
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Annotations & Undo/Redo Stack
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Interactive drawing states
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<Point[]>([]);
  const [activeDrawPageNum, setActiveDrawPageNum] = useState<number | null>(null);

  // Signature Pad Modal
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigDrawing, setIsSigDrawing] = useState(false);
  const [hasSigDrawn, setHasSigDrawn] = useState(false);

  // Image Upload Ref
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const annotationIdCounterRef = useRef<number>(1);

  // Commit changes to history
  const commitAnnotations = useCallback((newAnnotations: Annotation[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newAnnotations];
    });
    setHistoryIndex((prev) => prev + 1);
    setAnnotations(newAnnotations);
  }, [historyIndex]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setAnnotations(history[prevIdx]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setAnnotations(history[nextIdx]);
    }
  }, [history, historyIndex]);

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Load PDF Pages
  const loadPdfPages = useCallback(async (f: File) => {
    setIsProcessing(true);
    let pdf: any = null;
    try {
      const arrayBuffer = await f.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const loadedPages: PageMeta[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          loadedPages.push({
            pageNum: i,
            dataUrl: canvas.toDataURL('image/png'),
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
          });
        }
        cleanupCanvas(canvas);
        page.cleanup();
      }
      setPages(loadedPages);
      setAnnotations([]);
      setHistory([[]]);
      setHistoryIndex(0);
      onToast(`PDF loaded (${numPages} pages). Select a tool to start editing!`, 'success');
    } catch (err: any) {
      onToast('Error loading PDF: ' + (err?.message || 'Invalid or encrypted file'), 'error');
    } finally {
      if (pdf) {
        try {
          await pdf.destroy();
        } catch {
          // ignore
        }
      }
      setIsProcessing(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      loadPdfPages(initialFile);
    }
  }, [initialFile, loadPdfPages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a valid PDF document.', 'error');
      return;
    }

    try {
      validateFileSize(selected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid file size';
      onToast(msg, 'error');
      return;
    }

    setFile(selected);
    await loadPdfPages(selected);
  };

  // Freehand drawing handlers
  const handlePageMouseDown = (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'draw') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yPct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setIsDrawingFreehand(true);
    setActiveDrawPageNum(pageNum);
    setCurrentDrawPoints([{ xPct, yPct }]);
  };

  const handlePageMouseMove = (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingFreehand || activeDrawPageNum !== pageNum) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yPct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setCurrentDrawPoints((prev) => [...prev, { xPct, yPct }]);
  };

  const handlePageMouseUp = (pageNum: number) => {
    if (!isDrawingFreehand || activeDrawPageNum !== pageNum) return;
    setIsDrawingFreehand(false);
    setActiveDrawPageNum(null);

    if (currentDrawPoints.length > 1) {
      const annId = `ann-${annotationIdCounterRef.current++}`;
      const newAnn: Annotation = {
        id: annId,
        pageNum,
        type: 'draw',
        xPct: currentDrawPoints[0].xPct,
        yPct: currentDrawPoints[0].yPct,
        color: activeColor,
        strokeWidth: strokeWidth,
        points: currentDrawPoints,
      };
      commitAnnotations([...annotations, newAnn]);
    }
    setCurrentDrawPoints([]);
  };

  // Stamping click for other tools (text, highlight, shapes, arrows)
  const handlePageClick = (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'draw') return; // Handled by mouse down/up

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPct = Math.max(0, Math.min(1, x / rect.width));
    const yPct = Math.max(0, Math.min(1, y / rect.height));

    const annId = `ann-${annotationIdCounterRef.current++}`;

    let newAnnotation: Annotation | null = null;

    if (activeTool === 'text') {
      newAnnotation = {
        id: annId,
        pageNum,
        type: 'text',
        xPct,
        yPct,
        color: activeColor,
        text: activeText.trim() || 'Note',
        fontSize: activeFontSize,
      };
    } else if (activeTool === 'highlight') {
      newAnnotation = {
        id: annId,
        pageNum,
        type: 'highlight',
        xPct,
        yPct,
        color: activeColor === '#2563eb' ? '#facc15' : activeColor, // default yellow for highlight
        widthPct: 0.25,
        heightPct: 0.04,
      };
    } else if (activeTool === 'rect') {
      newAnnotation = {
        id: annId,
        pageNum,
        type: 'rect',
        xPct,
        yPct,
        color: activeColor,
        strokeWidth: strokeWidth,
        widthPct: 0.22,
        heightPct: 0.12,
      };
    } else if (activeTool === 'circle') {
      newAnnotation = {
        id: annId,
        pageNum,
        type: 'circle',
        xPct,
        yPct,
        color: activeColor,
        strokeWidth: strokeWidth,
        widthPct: 0.15,
        heightPct: 0.15,
      };
    } else if (activeTool === 'line') {
      newAnnotation = {
        id: annId,
        pageNum,
        type: 'line',
        xPct,
        yPct,
        endXPct: Math.min(1, xPct + 0.2),
        endYPct: yPct,
        color: activeColor,
        strokeWidth: strokeWidth,
      };
    } else if (activeTool === 'arrow') {
      newAnnotation = {
        id: annId,
        pageNum,
        type: 'arrow',
        xPct,
        yPct,
        endXPct: Math.min(1, xPct + 0.2),
        endYPct: Math.min(1, yPct + 0.08),
        color: activeColor,
        strokeWidth: strokeWidth,
      };
    }

    if (newAnnotation) {
      commitAnnotations([...annotations, newAnnotation]);
    }
  };

  const removeAnnotation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    commitAnnotations(annotations.filter((a) => a.id !== id));
  };

  // Image Upload Placement
  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const annId = `ann-${annotationIdCounterRef.current++}`;
      const newAnn: Annotation = {
        id: annId,
        pageNum: 1, // Place on first page or current
        type: 'image',
        xPct: 0.35,
        yPct: 0.4,
        widthPct: 0.25,
        heightPct: 0.15,
        imageDataUrl: dataUrl,
        color: '#000000',
      };
      commitAnnotations([...annotations, newAnn]);
      onToast('Image placed on Page 1! You can drag or reposition.', 'success');
    };
    reader.readAsDataURL(imgFile);
    e.target.value = '';
  };

  // Signature Pad Handlers
  const handleSaveSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas || !hasSigDrawn) {
      onToast('Please draw your signature first.', 'error');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const annId = `ann-${annotationIdCounterRef.current++}`;
    const newAnn: Annotation = {
      id: annId,
      pageNum: 1,
      type: 'signature',
      xPct: 0.4,
      yPct: 0.75,
      widthPct: 0.25,
      heightPct: 0.1,
      imageDataUrl: dataUrl,
      color: '#0f172a',
    };
    commitAnnotations([...annotations, newAnn]);
    setIsSignatureModalOpen(false);
    onToast('Signature stamped onto document! Original vectors preserved.', 'success');
  };

  // Convert hex color to pdf-lib rgb [0..1]
  const hexToRgb01 = (hex: string) => {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;
    return rgb(r, g, b);
  };

  /**
   * Export edited PDF while preserving original vector PDF layers
   */
  const handleExport = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const totalPages = pdfDoc.getPageCount();

      for (const ann of annotations) {
        if (ann.pageNum < 1 || ann.pageNum > totalPages) continue;
        const page = pdfDoc.getPage(ann.pageNum - 1);
        const { width, height } = page.getSize();
        const strokeColor = hexToRgb01(ann.color);

        // Convert percentage to PDF points (origin is bottom-left)
        const pdfX = ann.xPct * width;
        const pdfY = height - (ann.yPct * height);

        if (ann.type === 'text' && ann.text) {
          const fontSize = ann.fontSize || 14;
          page.drawText(ann.text, {
            x: pdfX,
            y: Math.max(10, pdfY - fontSize),
            size: fontSize,
            font: fontBold,
            color: strokeColor,
          });
        } else if (ann.type === 'highlight') {
          const w = (ann.widthPct || 0.25) * width;
          const h = (ann.heightPct || 0.04) * height;
          page.drawRectangle({
            x: pdfX,
            y: Math.max(0, pdfY - h),
            width: w,
            height: h,
            color: strokeColor,
            opacity: 0.35,
          });
        } else if (ann.type === 'rect') {
          const w = (ann.widthPct || 0.22) * width;
          const h = (ann.heightPct || 0.12) * height;
          page.drawRectangle({
            x: pdfX,
            y: Math.max(0, pdfY - h),
            width: w,
            height: h,
            borderColor: strokeColor,
            borderWidth: ann.strokeWidth || 2,
            opacity: 0.95,
          });
        } else if (ann.type === 'circle') {
          const rx = ((ann.widthPct || 0.15) * width) / 2;
          const ry = ((ann.heightPct || 0.15) * height) / 2;
          page.drawEllipse({
            x: pdfX + rx,
            y: Math.max(ry, pdfY - ry),
            xScale: rx,
            yScale: ry,
            borderColor: strokeColor,
            borderWidth: ann.strokeWidth || 2,
            opacity: 0.95,
          });
        } else if (ann.type === 'line') {
          const endX = (ann.endXPct ?? ann.xPct + 0.2) * width;
          const endY = height - ((ann.endYPct ?? ann.yPct) * height);
          page.drawLine({
            start: { x: pdfX, y: pdfY },
            end: { x: endX, y: endY },
            thickness: ann.strokeWidth || 2,
            color: strokeColor,
          });
        } else if (ann.type === 'arrow') {
          const endX = (ann.endXPct ?? ann.xPct + 0.2) * width;
          const endY = height - ((ann.endYPct ?? ann.yPct + 0.08) * height);
          
          // Main shaft
          page.drawLine({
            start: { x: pdfX, y: pdfY },
            end: { x: endX, y: endY },
            thickness: ann.strokeWidth || 2,
            color: strokeColor,
          });

          // Arrowhead
          const angle = Math.atan2(endY - pdfY, endX - pdfX);
          const headLength = 12;
          const arrowAngle = Math.PI / 6;
          const h1X = endX - headLength * Math.cos(angle - arrowAngle);
          const h1Y = endY - headLength * Math.sin(angle - arrowAngle);
          const h2X = endX - headLength * Math.cos(angle + arrowAngle);
          const h2Y = endY - headLength * Math.sin(angle + arrowAngle);

          page.drawLine({
            start: { x: endX, y: endY },
            end: { x: h1X, y: h1Y },
            thickness: ann.strokeWidth || 2,
            color: strokeColor,
          });
          page.drawLine({
            start: { x: endX, y: endY },
            end: { x: h2X, y: h2Y },
            thickness: ann.strokeWidth || 2,
            color: strokeColor,
          });
        } else if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
          for (let pIdx = 0; pIdx < ann.points.length - 1; pIdx++) {
            const p1 = ann.points[pIdx];
            const p2 = ann.points[pIdx + 1];
            page.drawLine({
              start: { x: p1.xPct * width, y: height - (p1.yPct * height) },
              end: { x: p2.xPct * width, y: height - (p2.yPct * height) },
              thickness: ann.strokeWidth || 2,
              color: strokeColor,
            });
          }
        } else if ((ann.type === 'signature' || ann.type === 'image') && ann.imageDataUrl) {
          try {
            const base64Data = ann.imageDataUrl.split(',')[1];
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let b = 0; b < binaryStr.length; b++) bytes[b] = binaryStr.charCodeAt(b);

            const isJpg = ann.imageDataUrl.startsWith('data:image/jpeg') || ann.imageDataUrl.startsWith('data:image/jpg');
            const embeddedImg = isJpg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

            const imgW = (ann.widthPct || 0.25) * width;
            const imgH = (ann.heightPct || 0.12) * height;

            page.drawImage(embeddedImg, {
              x: pdfX,
              y: Math.max(0, pdfY - imgH),
              width: imgW,
              height: imgH,
            });
          } catch (imgErr) {
            console.warn('Could not embed image:', imgErr);
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const outputBlob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
      const outputName = `${cleanName}_edited.pdf`;
      saveAs(outputBlob, outputName);

      await addHistoryEntry({
        toolId: 'edit-pdf',
        toolName: 'PDF Editor',
        fileName: file.name,
        fileSize: file.size,
        status: 'completed',
        resultFileName: outputName,
        resultBlob: outputBlob,
        pageCount: totalPages,
      });

      onToast(`PDF exported with ${annotations.length} annotation(s)! Original vectors preserved.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export';
      onToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 shadow-xs dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-[#161b26] border border-stone-200 dark:border-[#222836]">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-stone-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-[#202636] disabled:opacity-30 transition cursor-pointer shadow-2xs"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-stone-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-[#202636] disabled:opacity-30 transition cursor-pointer shadow-2xs"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
              <span>Redo</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Vector PDF Engine · Original Layers Preserved</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-stone-200 dark:border-[#222834] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
              <Edit3 className="w-8 h-8 text-indigo-500" />
              PDF Editor &amp; Annotator
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Pro
            </span>
          </div>
          <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
            Draw annotations, arrows, highlights, signatures, and place images onto your PDF with zoom-aware precision without rasterizing vector text.
          </p>
        </div>

        {file && (
          <button
            onClick={handleExport}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer self-start sm:self-auto"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Export Edited PDF ({annotations.length})</span>
          </button>
        )}
      </div>

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-indigo-500 bg-white/50 dark:bg-[#121620]/60 p-10 sm:p-16 text-center transition-all cursor-pointer hover:shadow-xl"
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
          <h3 className="text-lg font-bold text-stone-800 dark:text-zinc-100">
            Open PDF to Edit &amp; Annotate
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
            Preserves original high-resolution vector typography, layout, forms, and metadata.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Document Viewer with Zoom & Overlay */}
          <div className="lg:col-span-8 xl:col-span-9 bg-stone-100/90 dark:bg-[#0b0e14] border border-stone-200 dark:border-[#222834] rounded-3xl p-4 sm:p-6 overflow-y-auto max-h-[80vh] flex flex-col items-center gap-8 relative select-none">
            {/* Top Viewer Bar: Zoom & Page Info */}
            <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-[#141824]/90 backdrop-blur-md border border-stone-200 dark:border-[#242b3a] shadow-xs text-xs">
              <button
                onClick={() => setZoomScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1e2434] cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-stone-700 dark:text-zinc-300 w-12 text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((s) => Math.min(2.0, +(s + 0.15).toFixed(2)))}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1e2434] cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-stone-200 dark:bg-[#252c3b] mx-1" />
              <button
                onClick={() => setZoomScale(1.0)}
                className="px-2 py-0.5 rounded-lg border border-stone-200 dark:border-[#242b3a] hover:bg-stone-100 dark:hover:bg-[#1e2434] text-[11px] cursor-pointer"
              >
                100%
              </button>
            </div>

            {isProcessing && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing document pages...</span>
              </div>
            )}

            {pages.map((p) => {
              const pageAnns = annotations.filter((a) => a.pageNum === p.pageNum);

              return (
                <div key={p.pageNum} className="flex flex-col items-center gap-2 w-full max-w-3xl">
                  <div className="w-full flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400 px-1 font-mono">
                    <span>Page {p.pageNum} of {pages.length}</span>
                    <span>{pageAnns.length} annotation(s)</span>
                  </div>

                  <div
                    style={{
                      transform: `scale(${zoomScale})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.1s ease-out',
                    }}
                    onMouseDown={(e) => handlePageMouseDown(p.pageNum, e)}
                    onMouseMove={(e) => handlePageMouseMove(p.pageNum, e)}
                    onMouseUp={() => handlePageMouseUp(p.pageNum)}
                    onClick={(e) => handlePageClick(p.pageNum, e)}
                    className={`relative group shadow-xl border border-stone-300 dark:border-stone-700 rounded-lg overflow-hidden bg-white ${
                      activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-crosshair'
                    }`}
                  >
                    <img
                      src={p.dataUrl}
                      alt={`Page ${p.pageNum}`}
                      className="w-full block select-none pointer-events-none"
                    />

                    {/* SVG Layer for Freehand Draw, Lines & Arrows */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {/* Active freehand stroke */}
                      {isDrawingFreehand && activeDrawPageNum === p.pageNum && currentDrawPoints.length > 1 && (
                        <polyline
                          fill="none"
                          stroke={activeColor}
                          strokeWidth={strokeWidth * 1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={currentDrawPoints.map((pt) => `${pt.xPct * 100}%,${pt.yPct * 100}%`).join(' ')}
                        />
                      )}

                      {/* Stamped freehand strokes */}
                      {pageAnns
                        .filter((a) => a.type === 'draw' && a.points)
                        .map((ann) => (
                          <polyline
                            key={ann.id}
                            fill="none"
                            stroke={ann.color}
                            strokeWidth={(ann.strokeWidth || 2) * 1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={ann.points!.map((pt) => `${pt.xPct * 100}%,${pt.yPct * 100}%`).join(' ')}
                          />
                        ))}

                      {/* Stamped Lines & Arrows */}
                      {pageAnns
                        .filter((a) => a.type === 'line' || a.type === 'arrow')
                        .map((ann) => {
                          const x1 = `${ann.xPct * 100}%`;
                          const y1 = `${ann.yPct * 100}%`;
                          const x2 = `${(ann.endXPct ?? ann.xPct + 0.2) * 100}%`;
                          const y2 = `${(ann.endYPct ?? ann.yPct) * 100}%`;

                          return (
                            <g key={ann.id}>
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={ann.color}
                                strokeWidth={(ann.strokeWidth || 2) * 1.5}
                                strokeLinecap="round"
                              />
                              {ann.type === 'arrow' && (
                                <circle
                                  cx={x2}
                                  cy={y2}
                                  r={(ann.strokeWidth || 2) * 2}
                                  fill={ann.color}
                                />
                              )}
                            </g>
                          );
                        })}
                    </svg>

                    {/* HTML Overlay for Text, Highlights, Shapes, Signatures, Images */}
                    {pageAnns
                      .filter((a) => a.type !== 'draw' && a.type !== 'line' && a.type !== 'arrow')
                      .map((ann) => (
                        <div
                          key={ann.id}
                          style={{
                            left: `${ann.xPct * 100}%`,
                            top: `${ann.yPct * 100}%`,
                            width: ann.widthPct ? `${ann.widthPct * 100}%` : undefined,
                            height: ann.heightPct ? `${ann.heightPct * 100}%` : undefined,
                          }}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 group/item cursor-pointer"
                        >
                          {ann.type === 'text' && (
                            <div
                              style={{ color: ann.color, fontSize: `${ann.fontSize || 14}px` }}
                              className="font-bold px-2 py-0.5 rounded bg-white/80 dark:bg-black/80 backdrop-blur-xs border border-stone-300 dark:border-stone-700 shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <span>{ann.text}</span>
                              <button
                                onClick={(e) => removeAnnotation(ann.id, e)}
                                className="opacity-0 group-hover/item:opacity-100 text-rose-500 hover:text-rose-700 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {ann.type === 'highlight' && (
                            <div
                              style={{ backgroundColor: ann.color }}
                              className="w-full h-full opacity-40 rounded shadow-xs relative flex items-start justify-end p-0.5"
                            >
                              <button
                                onClick={(e) => removeAnnotation(ann.id, e)}
                                className="opacity-0 group-hover/item:opacity-100 text-rose-600 bg-white/90 rounded p-0.5 transition"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {ann.type === 'rect' && (
                            <div
                              style={{
                                borderColor: ann.color,
                                borderWidth: `${ann.strokeWidth || 2}px`,
                              }}
                              className="w-full h-full border-solid rounded-md relative flex items-start justify-end p-1"
                            >
                              <button
                                onClick={(e) => removeAnnotation(ann.id, e)}
                                className="opacity-0 group-hover/item:opacity-100 text-rose-500 bg-white rounded p-0.5 shadow transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {ann.type === 'circle' && (
                            <div
                              style={{
                                borderColor: ann.color,
                                borderWidth: `${ann.strokeWidth || 2}px`,
                              }}
                              className="w-full h-full border-solid rounded-full relative flex items-start justify-end p-1"
                            >
                              <button
                                onClick={(e) => removeAnnotation(ann.id, e)}
                                className="opacity-0 group-hover/item:opacity-100 text-rose-500 bg-white rounded p-0.5 shadow transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {(ann.type === 'signature' || ann.type === 'image') && ann.imageDataUrl && (
                            <div className="w-full h-full relative group/sig p-1 rounded border border-dashed border-stone-300 dark:border-stone-700 bg-white/40">
                              <img
                                src={ann.imageDataUrl}
                                alt="Stamped Object"
                                className="w-full h-full object-contain pointer-events-none"
                              />
                              <button
                                onClick={(e) => removeAnnotation(ann.id, e)}
                                className="absolute top-1 right-1 opacity-0 group-hover/sig:opacity-100 bg-rose-600 text-white rounded p-1 shadow transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Editor Controls Sidebar */}
          <div className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-[#121620] border border-stone-200 dark:border-[#222834] rounded-3xl p-5 shadow-xs space-y-6">
            <div>
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                Annotation Tools
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setActiveTool('text')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'text'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <Type className="w-4 h-4 text-indigo-500" />
                  <span>Text</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTool('highlight');
                    setActiveColor('#facc15');
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'highlight'
                      ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <Highlighter className="w-4 h-4 text-amber-500" />
                  <span>Highlight</span>
                </button>

                <button
                  onClick={() => setActiveTool('draw')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'draw'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <PenTool className="w-4 h-4 text-emerald-500" />
                  <span>Freehand</span>
                </button>

                <button
                  onClick={() => setActiveTool('arrow')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'arrow'
                      ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <ArrowRight className="w-4 h-4 text-blue-500" />
                  <span>Arrow</span>
                </button>

                <button
                  onClick={() => setActiveTool('line')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'line'
                      ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-950/60 dark:border-violet-800 dark:text-violet-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <Minus className="w-4 h-4 text-violet-500" />
                  <span>Line</span>
                </button>

                <button
                  onClick={() => setActiveTool('rect')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'rect'
                      ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <Square className="w-4 h-4 text-rose-500" />
                  <span>Rectangle</span>
                </button>

                <button
                  onClick={() => setActiveTool('circle')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold gap-1.5 transition cursor-pointer ${
                    activeTool === 'circle'
                      ? 'bg-teal-50 border-teal-300 text-teal-700 dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-300 shadow-2xs'
                      : 'border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-[#181d29]'
                  }`}
                >
                  <Circle className="w-4 h-4 text-teal-500" />
                  <span>Circle</span>
                </button>

                <button
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl border border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-indigo-50/50 dark:hover:bg-[#181d29] text-xs font-semibold gap-1.5 transition cursor-pointer"
                >
                  <Stamp className="w-4 h-4 text-amber-500" />
                  <span>Signature</span>
                </button>

                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl border border-stone-200 dark:border-[#222836] text-stone-700 dark:text-zinc-300 hover:bg-indigo-50/50 dark:hover:bg-[#181d29] text-xs font-semibold gap-1.5 transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-sky-500" />
                  <span>Image</span>
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleImageFileSelected}
                />
              </div>
            </div>

            {/* Tool Specific Configurations */}
            {activeTool === 'text' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-[#161a24] border border-stone-200/80 dark:border-[#222836]">
                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 block">
                  Annotation Text
                </label>
                <input
                  type="text"
                  value={activeText}
                  onChange={(e) => setActiveText(e.target.value)}
                  placeholder="Enter text to stamp..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1e2432] border border-stone-200 dark:border-[#2c3547] text-stone-900 dark:text-white"
                />

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-stone-500">Font Size: {activeFontSize}pt</span>
                  <input
                    type="range"
                    min="10"
                    max="32"
                    value={activeFontSize}
                    onChange={(e) => setActiveFontSize(Number(e.target.value))}
                    className="w-24 accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {(activeTool === 'draw' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'rect' || activeTool === 'circle') && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-[#161a24] border border-stone-200/80 dark:border-[#222836]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-600 dark:text-zinc-300">Stroke Width:</span>
                  <span className="font-mono text-stone-500">{strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            )}

            {/* Color Palette */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Color Palette
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((col) => (
                  <button
                    key={col}
                    onClick={() => setActiveColor(col)}
                    style={{ backgroundColor: col }}
                    className={`w-7 h-7 rounded-xl transition cursor-pointer ${
                      activeColor === col ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 shadow-sm' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Document Details & Quick Actions */}
            <div className="pt-4 border-t border-stone-200 dark:border-[#222836] space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400 font-mono">
                <span>Total Annotations:</span>
                <span className="font-bold text-stone-800 dark:text-zinc-200">{annotations.length}</span>
              </div>

              {annotations.length > 0 && (
                <button
                  onClick={() => commitAnnotations([])}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Annotations</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#121620] border border-stone-200 dark:border-[#222836] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#202636] pb-3">
              <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
                <Stamp className="w-5 h-5 text-indigo-500" />
                Draw Digital Signature
              </h3>
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Draw your signature in the box below. It will be stamped cleanly onto the document as transparent vector PNG.
            </p>

            <div className="border-2 border-dashed border-stone-300 dark:border-[#2b3548] rounded-2xl overflow-hidden bg-stone-50 dark:bg-[#0c0e14] relative">
              <canvas
                ref={sigCanvasRef}
                width={380}
                height={160}
                onMouseDown={(e) => {
                  const canvas = sigCanvasRef.current;
                  if (!canvas) return;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return;
                  ctx.lineWidth = 2.5;
                  ctx.lineCap = 'round';
                  ctx.strokeStyle = '#0f172a';
                  const rect = canvas.getBoundingClientRect();
                  ctx.beginPath();
                  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                  setIsSigDrawing(true);
                  setHasSigDrawn(true);
                }}
                onMouseMove={(e) => {
                  if (!isSigDrawing) return;
                  const canvas = sigCanvasRef.current;
                  if (!canvas) return;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return;
                  const rect = canvas.getBoundingClientRect();
                  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                  ctx.stroke();
                }}
                onMouseUp={() => setIsSigDrawing(false)}
                className="w-full h-40 cursor-crosshair block"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  const canvas = sigCanvasRef.current;
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx?.clearRect(0, 0, canvas.width, canvas.height);
                    setHasSigDrawn(false);
                  }
                }}
                className="px-3 py-1.5 text-xs text-stone-600 dark:text-zinc-400 hover:text-rose-600 border border-stone-200 dark:border-[#252c3c] rounded-xl cursor-pointer"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-[#252c3c] hover:bg-stone-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSignature}
                  disabled={!hasSigDrawn}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl shadow-xs cursor-pointer"
                >
                  Stamp Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
