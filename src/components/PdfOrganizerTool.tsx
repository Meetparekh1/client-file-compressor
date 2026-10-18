import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  LayoutGrid, 
  RotateCw, 
  RotateCcw, 
  Trash2, 
  Copy, 
  Download, 
  UploadCloud, 
  Loader2, 
  ShieldCheck, 
  Undo, 
  Redo, 
  CheckSquare, 
  Square, 
  Eye, 
  FileDown, 
  GripVertical
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfjsClient';
import { PDFDocument, degrees } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { sanitizeFilename, formatBytes } from '../lib/utils';
import { validateFileSize } from '../lib/securityLimits';
import { cleanupCanvas } from '../lib/resourceManager';
import { addHistoryEntry } from '../lib/historyStore';
import { PdfPreviewModal } from './PdfPreviewModal';
import type { ToastMessage } from './Toast';

interface PdfOrganizerToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
  initialFile?: File | null;
}

export interface PageItem {
  id: string; // Unique instance ID
  originalPageIndex: number; // 0-based index in the donor document
  rotation: number; // Additional relative rotation in degrees: 0, 90, 180, 270
}

export const PdfOrganizerTool: React.FC<PdfOrganizerToolProps> = ({
  onBack,
  onToast,
  initialFile = null,
}) => {
  const [file, setFile] = useState<File | null>(initialFile);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<PageItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Processing & Memory Optimization
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedThumbnails, setRenderedThumbnails] = useState<Record<number, string>>({});
  
  // Drag and Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Preview Modal
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<any>(null);
  const uniqueIdCounterRef = useRef<number>(1);
  const renderingIndicesRef = useRef<Set<number>>(new Set());

  // Push new state to history
  const commitChange = useCallback((newPages: PageItem[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newPages];
    });
    setHistoryIndex((prev) => prev + 1);
    setPages(newPages);
  }, [historyIndex]);

  // Load PDF file
  const loadPdf = useCallback(async (selectedFile: File) => {
    try {
      validateFileSize(selectedFile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid file';
      onToast(msg, 'error');
      return;
    }

    setIsLoadingDoc(true);
    setPages([]);
    setSelectedIds(new Set());
    setRenderedThumbnails({});
    setHistory([]);
    setHistoryIndex(-1);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;

      const pageCount = pdf.numPages;
      const initialPages: PageItem[] = [];
      for (let i = 0; i < pageCount; i++) {
        initialPages.push({
          id: `p-${uniqueIdCounterRef.current++}`,
          originalPageIndex: i,
          rotation: 0,
        });
      }

      setFile(selectedFile);
      setPages(initialPages);
      setHistory([initialPages]);
      setHistoryIndex(0);
      onToast(`Loaded ${pageCount} pages. Drag to reorder, rotate, or duplicate.`, 'success');
    } catch (err: any) {
      onToast('Failed to load PDF: ' + (err?.message || 'Invalid or password-protected document'), 'error');
      setFile(null);
    } finally {
      setIsLoadingDoc(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (initialFile) {
      loadPdf(initialFile);
    }
  }, [initialFile, loadPdf]);

  // Lazy render thumbnail for originalPageIndex
  const renderThumbnail = useCallback(async (originalIndex: number) => {
    if (!pdfDocRef.current || renderedThumbnails[originalIndex] || renderingIndicesRef.current.has(originalIndex)) {
      return;
    }
    renderingIndicesRef.current.add(originalIndex);

    try {
      const page = await pdfDocRef.current.getPage(originalIndex + 1);
      // Fast scale for crisp thumbnail without high memory overhead
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setRenderedThumbnails((prev) => ({ ...prev, [originalIndex]: dataUrl }));
      }
      cleanupCanvas(canvas);
      page.cleanup();
    } catch {
      // ignore
    } finally {
      renderingIndicesRef.current.delete(originalIndex);
    }
  }, [renderedThumbnails]);

  // IntersectionObserver to render thumbnails on demand
  useEffect(() => {
    if (pages.length === 0) return;
    // Render first 8 pages immediately
    const limit = Math.min(pages.length, 8);
    for (let i = 0; i < limit; i++) {
      renderThumbnail(pages[i].originalPageIndex);
    }
  }, [pages, renderThumbnail]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setPages(history[targetIndex]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setPages(history[targetIndex]);
    }
  }, [history, historyIndex]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+A)
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && file) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          setSelectedIds(new Set(pages.map((p) => p.id)));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, pages, file]);

  // Page Selection Handlers
  const toggleSelectPage = (id: string, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedId) {
      const lastIdx = pages.findIndex((p) => p.id === lastSelectedId);
      const currIdx = pages.findIndex((p) => p.id === id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        const rangeIds = pages.slice(start, end + 1).map((p) => p.id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
        setLastSelectedId(id);
        return;
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(pages.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Rotation
  const rotateSinglePage = (id: string, delta: number) => {
    const updated = pages.map((p) =>
      p.id === id ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
    );
    commitChange(updated);
  };

  const rotateSelected = (delta: number) => {
    if (selectedIds.size === 0) return;
    const updated = pages.map((p) =>
      selectedIds.has(p.id) ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
    );
    commitChange(updated);
    onToast(`Rotated ${selectedIds.size} page(s) by ${delta > 0 ? '+90°' : '-90°'}.`, 'info');
  };

  const rotateAllPages = (delta: number) => {
    const updated = pages.map((p) => ({
      ...p,
      rotation: (p.rotation + delta + 360) % 360,
    }));
    commitChange(updated);
    onToast(`Rotated all pages by ${delta > 0 ? '+90°' : '-90°'}.`, 'info');
  };

  // Duplicate
  const duplicateSinglePage = (id: string) => {
    const idx = pages.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const target = pages[idx];
    const newPage: PageItem = {
      id: `p-${uniqueIdCounterRef.current++}`,
      originalPageIndex: target.originalPageIndex,
      rotation: target.rotation,
    };
    const nextPages = [...pages.slice(0, idx + 1), newPage, ...pages.slice(idx + 1)];
    commitChange(nextPages);
    onToast(`Duplicated page ${idx + 1}.`, 'info');
  };

  const duplicateSelected = () => {
    if (selectedIds.size === 0) return;
    const nextPages: PageItem[] = [];
    for (const p of pages) {
      nextPages.push(p);
      if (selectedIds.has(p.id)) {
        nextPages.push({
          id: `p-${uniqueIdCounterRef.current++}`,
          originalPageIndex: p.originalPageIndex,
          rotation: p.rotation,
        });
      }
    }
    commitChange(nextPages);
    onToast(`Duplicated ${selectedIds.size} page(s).`, 'info');
  };

  // Delete
  const deleteSinglePage = (id: string) => {
    if (pages.length <= 1) {
      onToast('The document must have at least one page.', 'error');
      return;
    }
    const nextPages = pages.filter((p) => p.id !== id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    commitChange(nextPages);
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size >= pages.length) {
      onToast('Cannot delete all pages. At least one page must remain.', 'error');
      return;
    }
    const count = selectedIds.size;
    const nextPages = pages.filter((p) => !selectedIds.has(p.id));
    setSelectedIds(new Set());
    commitChange(nextPages);
    onToast(`Deleted ${count} page(s).`, 'info');
  };

  // Drag and Drop Reordering
  const handleDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${idx}`);
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDrop = (targetIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...pages];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIdx, 0, moved);

    setDraggedIndex(null);
    setDragOverIndex(null);
    commitChange(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Export / Extract PDF using native pdf-lib
  const generatePdfBlob = async (targetPages: PageItem[]): Promise<Blob> => {
    if (!file) throw new Error('No PDF file loaded');
    const arrayBuffer = await file.arrayBuffer();
    const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const outputDoc = await PDFDocument.create();

    const indicesToCopy = targetPages.map((p) => p.originalPageIndex);
    const copiedPages = await outputDoc.copyPages(sourceDoc, indicesToCopy);

    for (let i = 0; i < copiedPages.length; i++) {
      const page = copiedPages[i];
      const pageConfig = targetPages[i];
      const existingRot = page.getRotation().angle;
      page.setRotation(degrees((existingRot + pageConfig.rotation) % 360));
      outputDoc.addPage(page);
    }

    const pdfBytes = await outputDoc.save();
    return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  };

  const handleExportFull = async () => {
    if (!file || pages.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await generatePdfBlob(pages);
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
      const outputName = `${cleanName}_organized.pdf`;
      saveAs(blob, outputName);

      await addHistoryEntry({
        toolId: 'organize-pdf',
        toolName: 'PDF Page Organizer',
        fileName: file.name,
        fileSize: file.size,
        status: 'completed',
        resultFileName: outputName,
        resultBlob: blob,
        pageCount: pages.length,
      });

      onToast(`Exported organized PDF (${pages.length} pages) successfully!`, 'success');
    } catch (err: any) {
      onToast('Export failed: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExtractSelected = async () => {
    if (!file || selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const selectedPages = pages.filter((p) => selectedIds.has(p.id));
      const blob = await generatePdfBlob(selectedPages);
      const cleanName = sanitizeFilename(file.name.replace(/\.pdf$/i, ''));
      const outputName = `${cleanName}_extracted_${selectedPages.length}pages.pdf`;
      saveAs(blob, outputName);

      await addHistoryEntry({
        toolId: 'organize-pdf',
        toolName: 'Extract Selected Pages',
        fileName: file.name,
        fileSize: file.size,
        status: 'completed',
        resultFileName: outputName,
        resultBlob: blob,
        pageCount: selectedPages.length,
      });

      onToast(`Extracted ${selectedPages.length} selected page(s) successfully!`, 'success');
    } catch (err: any) {
      onToast('Extraction failed: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewPage = async (pageItem: PageItem) => {
    try {
      const blob = await generatePdfBlob([pageItem]);
      setPreviewBlob(blob);
      setPreviewTitle(`Page Preview (Original Page ${pageItem.originalPageIndex + 1})`);
    } catch {
      onToast('Could not preview page.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumb */}
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
              title="Undo last action (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-stone-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-[#202636] disabled:opacity-30 transition cursor-pointer shadow-2xs"
              title="Redo action (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
              <span>Redo</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% On-Device Unified Workspace</span>
          </div>
        </div>
      </div>

      {/* Tool Title */}
      <div className="border-b border-stone-200 dark:border-[#222834] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <LayoutGrid className="w-8 h-8 text-indigo-500" />
              PDF Page Organizer
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Unified
            </span>
          </div>
          <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
            Preview, drag to reorder, rotate, delete, duplicate, and extract pages in one seamless workflow with live thumbnails and full undo/redo.
          </p>
        </div>

        {file && (
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleExtractSelected}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Extract Selected ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={handleExportFull}
              disabled={isExporting || pages.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Export New PDF ({pages.length} pgs)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Workspace Body */}
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
            onChange={(e) => {
              if (e.target.files?.[0]) loadPdf(e.target.files[0]);
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-stone-800 dark:text-zinc-100">
            Open PDF to Organize Pages
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto">
            Drag-and-drop or click to select a document. Fast thumbnail preview with zero data transferred to any remote servers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoadingDoc && (
            <div className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Parsing document and preparing page thumbnails...</span>
            </div>
          )}

          {/* Action Ribbon & Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#131722] border border-stone-200 dark:border-[#212735] shadow-xs">
            {/* Selection Status & Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={selectedIds.size === pages.length ? handleDeselectAll : handleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-[#1c2230] dark:hover:bg-[#252c3e] text-stone-700 dark:text-zinc-300 transition cursor-pointer"
              >
                {selectedIds.size === pages.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{selectedIds.size === pages.length ? 'Deselect All' : 'Select All'}</span>
              </button>

              <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                {selectedIds.size} of {pages.length} selected
              </span>

              {/* Document Filename Pill */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-stone-500 dark:text-zinc-400 pl-2 border-l border-stone-200 dark:border-[#222836]">
                <span className="truncate max-w-[200px]">{file.name}</span>
                <span>({formatBytes(file.size)})</span>
              </div>
            </div>

            {/* Bulk Toolbar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedIds.size > 0 ? (
                <>
                  <button
                    onClick={() => rotateSelected(-90)}
                    className="p-1.5 rounded-xl border border-stone-200 dark:border-[#262d3d] hover:bg-stone-100 dark:hover:bg-[#1f2534] text-stone-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                    title="Rotate selected pages 90° counter-clockwise"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">-90°</span>
                  </button>

                  <button
                    onClick={() => rotateSelected(90)}
                    className="p-1.5 rounded-xl border border-stone-200 dark:border-[#262d3d] hover:bg-stone-100 dark:hover:bg-[#1f2534] text-stone-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                    title="Rotate selected pages 90° clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">+90°</span>
                  </button>

                  <button
                    onClick={duplicateSelected}
                    className="p-1.5 rounded-xl border border-stone-200 dark:border-[#262d3d] hover:bg-stone-100 dark:hover:bg-[#1f2534] text-stone-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                    title="Duplicate selected pages"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Duplicate</span>
                  </button>

                  <button
                    onClick={deleteSelected}
                    className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1 cursor-pointer"
                    title="Delete selected pages"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Delete</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => rotateAllPages(90)}
                    className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-[#262d3d] hover:bg-stone-100 dark:hover:bg-[#1f2534] text-stone-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    title="Rotate all pages clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate All</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-[#262d3d] hover:bg-stone-100 dark:hover:bg-[#1f2534] text-stone-600 dark:text-zinc-400 text-xs cursor-pointer"
                title="Change File"
              >
                Change PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) loadPdf(e.target.files[0]);
                }}
              />
            </div>
          </div>

          {/* Grid of Pages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 rounded-3xl bg-stone-100/70 dark:bg-[#0c0e14] border border-stone-200/80 dark:border-[#1e2330] min-h-[450px]">
            {pages.map((page, index) => {
              const isSelected = selectedIds.has(page.id);
              const isBeingDragged = draggedIndex === index;
              const isDragTarget = dragOverIndex === index;
              const thumbUrl = renderedThumbnails[page.originalPageIndex];

              return (
                <div
                  key={page.id}
                  draggable
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  onDragEnd={handleDragEnd}
                  className={`group relative rounded-2xl border p-2 flex flex-col justify-between transition-all select-none cursor-grab active:cursor-grabbing ${
                    isBeingDragged
                      ? 'opacity-40 scale-95 border-dashed border-indigo-500'
                      : isDragTarget
                      ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-102 bg-indigo-50/20'
                      : isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-md'
                      : 'border-stone-200 dark:border-[#202636] bg-white dark:bg-[#131722] hover:border-stone-400 hover:shadow-md'
                  }`}
                >
                  {/* Top Bar on Card: Page Number + Select Checkbox */}
                  <div className="flex items-center justify-between pb-1.5 px-0.5 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-stone-100 dark:bg-[#1c2230] text-stone-700 dark:text-zinc-300 font-bold flex items-center justify-center text-[11px]">
                        {index + 1}
                      </div>
                      {page.originalPageIndex !== index && (
                        <span className="text-[10px] text-stone-400" title="Original page number in input document">
                          (orig {page.originalPageIndex + 1})
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectPage(page.id, e);
                      }}
                      className="cursor-pointer text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Thumbnail Container */}
                  <div
                    onClick={(e) => toggleSelectPage(page.id, e)}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden bg-stone-50 dark:bg-[#0a0c10] border border-stone-200/60 dark:border-stone-800 flex items-center justify-center cursor-pointer group-hover:shadow-inner"
                  >
                    {thumbUrl ? (
                      <div
                        className="w-full h-full flex items-center justify-center transition-transform duration-200"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                      >
                        <img
                          src={thumbUrl}
                          alt={`Page ${index + 1}`}
                          className="max-w-full max-h-full object-contain pointer-events-none"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div
                        ref={(el) => {
                          if (el) {
                            renderThumbnail(page.originalPageIndex);
                          }
                        }}
                        className="flex flex-col items-center gap-1.5 text-stone-400"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span className="text-[10px] font-mono">Loading...</span>
                      </div>
                    )}

                    {/* Rotation Badge */}
                    {page.rotation > 0 && (
                      <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-stone-900/80 text-white backdrop-blur-xs">
                        {page.rotation}°
                      </span>
                    )}

                    {/* Hover Quick Actions Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[2px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rotateSinglePage(page.id, 90);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 text-stone-800 hover:bg-white hover:scale-110 transition cursor-pointer shadow-sm"
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewPage(page);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 text-stone-800 hover:bg-white hover:scale-110 transition cursor-pointer shadow-sm"
                        title="Preview Page"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateSinglePage(page.id);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 text-stone-800 hover:bg-white hover:scale-110 transition cursor-pointer shadow-sm"
                        title="Duplicate Page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSinglePage(page.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 hover:scale-110 transition cursor-pointer shadow-sm"
                        title="Delete Page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Bottom Drag Grip */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-stone-400">
                    <span className="font-mono text-[10px]">
                      {page.rotation > 0 ? `${page.rotation}° rot` : 'Portrait'}
                    </span>
                    <GripVertical className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Preview Modal if triggered */}
      {previewBlob && (
        <PdfPreviewModal
          file={previewBlob}
          fileName={previewTitle}
          onClose={() => setPreviewBlob(null)}
        />
      )}
    </div>
  );
};
