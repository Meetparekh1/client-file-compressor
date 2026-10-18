import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  Info,
  Search,
  FileText,
  Loader2,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeftRight,
  AlertCircle,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfjsClient';
import { cleanupCanvas } from '../lib/resourceManager';
import { formatBytes } from '../lib/utils';
import { saveAs } from 'file-saver';

export type DocumentViewerMode = 'modal' | 'embedded';

export interface DocumentViewerProps {
  /** The primary file/blob to display */
  file: File | Blob | null;
  /** Primary file display title */
  fileName?: string;
  /** Secondary comparison file/blob (e.g. compressed or converted output) */
  compareFile?: File | Blob | null;
  compareFileName?: string;
  /** Whether displayed as a full-screen overlay modal or an embedded workspace widget */
  mode?: DocumentViewerMode;
  /** Height for embedded mode, e.g. "500px", "65vh", or "100%" (default: "560px") */
  embeddedHeight?: string;
  /** Callback when close button is clicked (applicable in modal mode or when dismissible) */
  onClose?: () => void;
  /** Custom extra action buttons to show in the header/toolbar */
  extraActions?: React.ReactNode;
  /** Custom title badge or label */
  badgeLabel?: string;
  /** Custom badge styling class */
  badgeColorClass?: string;
  /** Initial rotation in degrees */
  initialRotation?: number;
  /** Active page changed callback */
  onPageChange?: (page: number, total: number) => void;
}

interface SearchMatch {
  pageNum: number;
  snippet: string;
}

interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pdfVersion?: string;
  pageWidth?: number;
  pageHeight?: number;
}

export const DocumentViewerWorkspace: React.FC<DocumentViewerProps> = ({
  file,
  fileName = 'Document',
  compareFile = null,
  compareFileName = 'Processed Output',
  mode = 'modal',
  embeddedHeight = '560px',
  onClose,
  extraActions,
  badgeLabel,
  badgeColorClass,
  initialRotation = 0,
  onPageChange,
}) => {
  // Determine file type category: 'pdf' | 'image' | 'unsupported'
  const isPdf =
    (file instanceof File && file.name.toLowerCase().endsWith('.pdf')) ||
    (file?.type === 'application/pdf') ||
    fileName.toLowerCase().endsWith('.pdf');

  const isImage =
    (file instanceof File && file.type.startsWith('image/')) ||
    (file?.type?.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(fileName);

  // Compare mode toggle ('single' vs 'compare')
  const [viewCompare, setViewCompare] = useState<boolean>(false);
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [compareSplitMode, setCompareSplitMode] = useState<'slider' | 'side-by-side'>('slider');

  // PDF Page & Zoom state
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'custom' | 'width' | 'page'>('page');
  const [rotation, setRotation] = useState<number>(initialRotation);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sidebar panels
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [showTextPanel, setShowTextPanel] = useState<boolean>(false);
  const [extractedPageText, setExtractedPageText] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Thumbnails lazy cache
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});

  // Image Object URLs
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [compareImageUrl, setCompareImageUrl] = useState<string | null>(null);

  // Refs
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const currentRenderTaskRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compareCanvasRef = useRef<HTMLCanvasElement>(null);
  const comparePdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initialRotation prop
  useEffect(() => {
    setRotation(initialRotation);
  }, [initialRotation]);

  // Generate Image Object URLs safely and clean up
  useEffect(() => {
    if (isImage && file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setIsLoadingDoc(false);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [isImage, file]);

  useEffect(() => {
    if (compareFile) {
      const url = URL.createObjectURL(compareFile);
      setCompareImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setCompareImageUrl(null);
    }
  }, [compareFile]);

  // Load PDF Document
  useEffect(() => {
    if (!isPdf || !file) {
      if (!isImage && file) {
        setIsLoadingDoc(false);
      }
      return;
    }

    let isCancelled = false;
    setIsLoadingDoc(true);
    setLoadError(null);
    setThumbnailUrls({});
    setCurrentPage(1);

    const loadDoc = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: `${import.meta.env.BASE_URL}cmaps/`,
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        onPageChange?.(1, doc.numPages);

        // Fetch document metadata
        try {
          const metaData = await doc.getMetadata();
          const info = (metaData?.info as any) || {};
          const firstPage = await doc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1.0 });

          setMetadata({
            title: info.Title || fileName,
            author: info.Author,
            subject: info.Subject,
            keywords: info.Keywords,
            creator: info.Creator,
            producer: info.Producer,
            creationDate: info.CreationDate ? String(info.CreationDate) : undefined,
            modDate: info.ModDate ? String(info.ModDate) : undefined,
            pdfVersion: info.PDFFormatVersion,
            pageWidth: Math.round(vp.width),
            pageHeight: Math.round(vp.height),
          });
          firstPage.cleanup();
        } catch {
          // ignore metadata failure
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load PDF document';
          setLoadError(msg);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDoc(false);
        }
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
        pdfDocRef.current = null;
      }
      if (canvasRef.current) {
        cleanupCanvas(canvasRef.current);
      }
    };
  }, [isPdf, file, fileName, onPageChange]);

  // Load Compare PDF document if provided
  useEffect(() => {
    if (!compareFile) {
      comparePdfDocRef.current = null;
      return;
    }
    const isComparePdf =
      compareFile.type === 'application/pdf' ||
      (compareFile instanceof File && compareFile.name.toLowerCase().endsWith('.pdf')) ||
      compareFileName.toLowerCase().endsWith('.pdf');

    if (!isComparePdf) return;

    let isCancelled = false;
    const loadCompareDoc = async () => {
      try {
        const buf = await compareFile.arrayBuffer();
        if (isCancelled) return;
        const task = pdfjsLib.getDocument({ data: buf });
        const doc = await task.promise;
        if (!isCancelled) {
          comparePdfDocRef.current = doc;
        }
      } catch {
        // ignore
      }
    };
    loadCompareDoc();

    return () => {
      isCancelled = true;
      if (comparePdfDocRef.current) {
        try {
          comparePdfDocRef.current.destroy();
        } catch {
          // ignore
        }
        comparePdfDocRef.current = null;
      }
    };
  }, [compareFile, compareFileName]);

  // Render current PDF page
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current || !isPdf) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentRenderTaskRef.current) {
      try {
        currentRenderTaskRef.current.cancel();
      } catch {
        // ignore cancellation
      }
    }

    setIsRenderingPage(true);
    try {
      const page = await pdfDocRef.current.getPage(currentPage);
      const totalRotation = (page.rotate + rotation) % 360;

      let targetScale = scale;
      if (fitMode === 'width' && containerRef.current) {
        const vp1 = page.getViewport({ scale: 1, rotation: totalRotation });
        const availableW = containerRef.current.clientWidth - 40;
        targetScale = Math.max(0.15, Math.min(4.0, availableW / vp1.width));
      } else if (fitMode === 'page' && containerRef.current) {
        const vp1 = page.getViewport({ scale: 1, rotation: totalRotation });
        const availableW = containerRef.current.clientWidth - 40;
        const availableH = containerRef.current.clientHeight - 40;
        targetScale = Math.max(0.15, Math.min(4.0, Math.min(availableW / vp1.width, availableH / vp1.height)));
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for memory efficiency
      const viewport = page.getViewport({ scale: targetScale * dpr, rotation: totalRotation });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const task = page.render(renderContext);
      currentRenderTaskRef.current = task;
      await task.promise;
      currentRenderTaskRef.current = null;
      page.cleanup();

      // Also render comparison canvas if in split compare mode
      if (viewCompare && comparePdfDocRef.current && compareCanvasRef.current) {
        try {
          const compPageNum = Math.min(currentPage, comparePdfDocRef.current.numPages);
          const compPage = await comparePdfDocRef.current.getPage(compPageNum);
          const compCanvas = compareCanvasRef.current;
          const compCtx = compCanvas.getContext('2d');
          if (compCtx) {
            compCanvas.width = viewport.width;
            compCanvas.height = viewport.height;
            compCanvas.style.width = `${viewport.width / dpr}px`;
            compCanvas.style.height = `${viewport.height / dpr}px`;
            await compPage.render({ canvasContext: compCtx, viewport }).promise;
            compPage.cleanup();
          }
        } catch {
          // ignore compare render error
        }
      }

      // Extract text content for text panel
      try {
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        setExtractedPageText(text);
      } catch {
        setExtractedPageText('');
      }
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('Page render error:', err);
      }
    } finally {
      setIsRenderingPage(false);
    }
  }, [currentPage, scale, fitMode, rotation, isPdf, viewCompare]);

  useEffect(() => {
    if (!isLoadingDoc && numPages > 0) {
      renderCurrentPage();
    }
  }, [isLoadingDoc, currentPage, scale, fitMode, rotation, renderCurrentPage, numPages]);

  // Window resize re-calculation for fitMode
  useEffect(() => {
    const handleResize = () => {
      if (fitMode !== 'custom') {
        renderCurrentPage();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitMode, renderCurrentPage]);

  // Lazy render thumbnail for page
  const loadThumbnail = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current || thumbnailUrls[pageNum]) return;
      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        const totalRot = (page.rotate + rotation) % 360;
        const viewport = page.getViewport({ scale: 0.22, rotation: totalRot });
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = viewport.width;
        thumbCanvas.height = viewport.height;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.75);
          setThumbnailUrls((prev) => ({ ...prev, [pageNum]: dataUrl }));
        }
        cleanupCanvas(thumbCanvas);
        page.cleanup();
      } catch {
        // ignore
      }
    },
    [thumbnailUrls, rotation]
  );

  // Pre-load visible thumbnails around current page
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0 || !showThumbnails) return;
    const start = Math.max(1, currentPage - 3);
    const end = Math.min(numPages, currentPage + 5);
    for (let i = start; i <= end; i++) {
      loadThumbnail(i);
    }
  }, [currentPage, numPages, showThumbnails, loadThumbnail]);

  // Search across pages
  const handleSearch = async () => {
    if (!pdfDocRef.current || !searchQuery.trim()) {
      setSearchMatches([]);
      setActiveMatchIndex(-1);
      return;
    }

    setIsSearching(true);
    const term = searchQuery.toLowerCase();
    const matches: SearchMatch[] = [];

    try {
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocRef.current.getPage(i);
        const textContent = await page.getTextContent();
        const fullPageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');

        const idx = fullPageText.toLowerCase().indexOf(term);
        if (idx !== -1) {
          const start = Math.max(0, idx - 25);
          const end = Math.min(fullPageText.length, idx + term.length + 25);
          const snippet = `...${fullPageText.substring(start, end)}...`;
          matches.push({ pageNum: i, snippet });
        }
        page.cleanup();
      }

      setSearchMatches(matches);
      if (matches.length > 0) {
        setActiveMatchIndex(0);
        setCurrentPage(matches[0].pageNum);
        onPageChange?.(matches[0].pageNum, numPages);
      } else {
        setActiveMatchIndex(-1);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(nextIdx);
    setCurrentPage(searchMatches[nextIdx].pageNum);
    onPageChange?.(searchMatches[nextIdx].pageNum, numPages);
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prevIdx);
    setCurrentPage(searchMatches[prevIdx].pageNum);
    onPageChange?.(searchMatches[prevIdx].pageNum, numPages);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (mode === 'modal' && onClose) {
          onClose();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < numPages) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          onPageChange?.(nextPage, numPages);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) {
          const prevPage = currentPage - 1;
          setCurrentPage(prevPage);
          onPageChange?.(prevPage, numPages);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '+' || e.key === '=') {
        setFitMode('custom');
        setScale((s) => Math.min(3.0, +(s + 0.15).toFixed(2)));
      } else if (e.key === '-') {
        setFitMode('custom');
        setScale((s) => Math.max(0.2, +(s - 0.15).toFixed(2)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, isFullscreen, mode, onClose, onPageChange]);

  const handleDownload = () => {
    if (file) {
      saveAs(file, fileName);
    }
  };

  const copyExtractedText = () => {
    if (!extractedPageText) return;
    navigator.clipboard.writeText(extractedPageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const rotateCw = () => {
    setRotation((r) => (r + 90) % 360);
    setThumbnailUrls({});
  };

  const rotateCcw = () => {
    setRotation((r) => (r + 270) % 360);
    setThumbnailUrls({});
  };

  // Responsive workspace classes based on mode & fullscreen
  const workspaceContainerClass =
    mode === 'modal' || isFullscreen
      ? 'fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200'
      : 'relative w-full rounded-3xl border border-stone-200 dark:border-[#222834] bg-white dark:bg-[#0c0f15] shadow-sm overflow-hidden flex flex-col';

  const innerModalClass =
    mode === 'modal' || isFullscreen
      ? 'relative w-full max-w-7xl h-[94dvh] rounded-3xl shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-[#0c0f15] border border-stone-200 dark:border-[#222834]'
      : 'w-full flex-1 flex flex-col overflow-hidden';

  const containerStyle =
    mode === 'embedded' && !isFullscreen ? { height: embeddedHeight, minHeight: '380px' } : undefined;

  const content = (
    <div ref={workspaceRef} className={workspaceContainerClass} style={containerStyle}>
      <div className={innerModalClass}>
        {/* ========================================================= */}
        {/* TOP WORKSPACE HEADER BAR */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-stone-200 dark:border-[#1d232e] bg-stone-50/90 dark:bg-[#12161f] shrink-0">
          {/* Left: Thumbnail toggle & Document Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {isPdf && (
              <button
                onClick={() => setShowThumbnails((v) => !v)}
                className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-[#1d2330] transition cursor-pointer"
                title={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}
                aria-label={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}
              >
                {showThumbnails ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                  {fileName}
                </h3>
                {badgeLabel && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      badgeColorClass || 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {badgeLabel}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">
                {isPdf ? `${numPages} page(s) · ` : ''}
                {file ? formatBytes(file.size) : 'No file'}
                {rotation > 0 ? ` · ${rotation}°` : ''}
              </p>
            </div>
          </div>

          {/* Center: Search in PDF (Desktop/Tablet) */}
          {isPdf && (
            <div className="hidden md:flex items-center gap-1.5">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-stone-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search in PDF..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (searchMatches.length > 0) nextMatch();
                      else handleSearch();
                    }
                  }}
                  className="w-36 lg:w-48 pl-8 pr-14 py-1 text-xs rounded-xl bg-white dark:bg-[#1a202c] border border-stone-200 dark:border-[#283244] text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 cursor-pointer"
                >
                  {isSearching ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Find'}
                </button>
              </div>

              {searchMatches.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-stone-600 dark:text-zinc-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
                  <span>
                    {activeMatchIndex + 1}/{searchMatches.length}
                  </span>
                  <button onClick={prevMatch} className="p-0.5 hover:text-indigo-600 cursor-pointer" title="Previous match">
                    ▲
                  </button>
                  <button onClick={nextMatch} className="p-0.5 hover:text-indigo-600 cursor-pointer" title="Next match">
                    ▼
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Right: Compare Toggle, Extra Actions, Fullscreen, and Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compare Before/After Toggle if compareFile provided */}
            {compareFile && (
              <button
                onClick={() => setViewCompare((v) => !v)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                  viewCompare
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-[#1a202c] text-stone-700 dark:text-zinc-300 border-stone-200 dark:border-[#283244] hover:bg-stone-100 dark:hover:bg-[#202736]'
                }`}
                title="Toggle Before/After Comparison"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">{viewCompare ? 'Exit Compare' : 'Compare'}</span>
              </button>
            )}

            {/* Extra user-provided action buttons */}
            {extraActions}

            {/* Metadata Info Inspector */}
            {isPdf && (
              <button
                onClick={() => setShowMetadata((v) => !v)}
                className={`p-1.5 rounded-xl border transition cursor-pointer text-xs flex items-center gap-1 ${
                  showMetadata
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                    : 'bg-white dark:bg-[#1a202c] text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-[#283244] hover:bg-stone-100 dark:hover:bg-[#202736]'
                }`}
                title="Document Info"
                aria-label="Document Metadata"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Info</span>
              </button>
            )}

            {/* Extracted Text Inspector */}
            {isPdf && (
              <button
                onClick={() => setShowTextPanel((v) => !v)}
                className={`p-1.5 rounded-xl border transition cursor-pointer text-xs flex items-center gap-1 ${
                  showTextPanel
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                    : 'bg-white dark:bg-[#1a202c] text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-[#283244] hover:bg-stone-100 dark:hover:bg-[#202736]'
                }`}
                title="Extracted Text"
                aria-label="Extracted Text"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Text</span>
              </button>
            )}

            {/* Rotation controls */}
            <div className="flex items-center gap-0.5 bg-white dark:bg-[#1a202c] border border-stone-200 dark:border-[#283244] rounded-xl p-0.5">
              <button
                onClick={rotateCcw}
                className="p-1 rounded-lg text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#232c3f] transition cursor-pointer"
                title="Rotate Counter-Clockwise"
                aria-label="Rotate Counter-Clockwise"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={rotateCw}
                className="p-1 rounded-lg text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#232c3f] transition cursor-pointer"
                title="Rotate Clockwise"
                aria-label="Rotate Clockwise"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-xl bg-white dark:bg-[#1a202c] text-stone-600 dark:text-zinc-300 border border-stone-200 dark:border-[#283244] hover:bg-stone-100 dark:hover:bg-[#202736] transition cursor-pointer"
              title="Download File"
              aria-label="Download File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen((v) => !v)}
              className="p-1.5 rounded-xl bg-white dark:bg-[#1a202c] text-stone-600 dark:text-zinc-300 border border-stone-200 dark:border-[#283244] hover:bg-stone-100 dark:hover:bg-[#202736] transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button (if modal mode or provided) */}
            {(mode === 'modal' || onClose) && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-[#1d2330] transition cursor-pointer ml-1"
                title="Close Viewer"
                aria-label="Close Viewer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SUB-TOOLBAR: Zoom & Page Navigation (Responsive) */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 border-b border-stone-200/60 dark:border-[#1d232e] bg-white dark:bg-[#0f1218] text-xs shrink-0">
          {/* Page navigation */}
          {isPdf ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const p = Math.max(1, currentPage - 1);
                  setCurrentPage(p);
                  onPageChange?.(p, numPages);
                }}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-[#252c3b] hover:bg-stone-100 dark:hover:bg-[#1c222e] disabled:opacity-30 cursor-pointer"
                title="Previous Page (Left Arrow)"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 font-mono text-stone-700 dark:text-zinc-300">
                <span className="hidden sm:inline">Page</span>
                <input
                  type="number"
                  min={1}
                  max={numPages || 1}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= numPages) {
                      setCurrentPage(val);
                      onPageChange?.(val, numPages);
                    }
                  }}
                  className="w-11 text-center py-0.5 rounded-md border border-stone-200 dark:border-[#252c3b] bg-stone-50 dark:bg-[#141822] text-xs font-mono"
                  aria-label="Current Page Number"
                />
                <span>/ {numPages || 1}</span>
              </div>

              <button
                onClick={() => {
                  const p = Math.min(numPages, currentPage + 1);
                  setCurrentPage(p);
                  onPageChange?.(p, numPages);
                }}
                disabled={currentPage >= numPages}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-[#252c3b] hover:bg-stone-100 dark:hover:bg-[#1c222e] disabled:opacity-30 cursor-pointer"
                title="Next Page (Right Arrow)"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-stone-500 dark:text-zinc-400 font-mono text-[11px]">
              {isImage ? 'Image Document View' : 'Document View'}
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setFitMode('custom');
                setScale((s) => Math.max(0.2, +(s - 0.15).toFixed(2)));
              }}
              className="p-1 rounded-lg border border-stone-200 dark:border-[#252c3b] hover:bg-stone-100 dark:hover:bg-[#1c222e] cursor-pointer"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-stone-600 dark:text-zinc-300 w-12 text-center text-[11px]">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={() => {
                setFitMode('custom');
                setScale((s) => Math.min(3.5, +(s + 0.15).toFixed(2)));
              }}
              className="p-1 rounded-lg border border-stone-200 dark:border-[#252c3b] hover:bg-stone-100 dark:hover:bg-[#1c222e] cursor-pointer"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-stone-200 dark:bg-[#252c3b] mx-0.5" />

            <button
              onClick={() => {
                setFitMode('width');
                renderCurrentPage();
              }}
              className={`px-2 py-0.5 rounded-lg border text-[11px] transition cursor-pointer ${
                fitMode === 'width'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 font-semibold'
                  : 'border-stone-200 dark:border-[#252c3b] hover:bg-stone-100 dark:hover:bg-[#1c222e]'
              }`}
            >
              Fit Width
            </button>

            <button
              onClick={() => {
                setFitMode('page');
                renderCurrentPage();
              }}
              className={`px-2 py-0.5 rounded-lg border text-[11px] transition cursor-pointer ${
                fitMode === 'page'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 font-semibold'
                  : 'border-stone-200 dark:border-[#252c3b] hover:bg-stone-100 dark:hover:bg-[#1c222e]'
              }`}
            >
              Fit Page
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MAIN WORKSPACE BODY: Thumbnails + Canvas Viewport + Side Drawers */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden relative min-h-0 min-w-0">
          {/* Thumbnails Sidebar (Collapsible) */}
          {isPdf && showThumbnails && numPages > 0 && (
            <div className="w-36 sm:w-48 border-r border-stone-200 dark:border-[#1d232e] bg-stone-50/70 dark:bg-[#0e1117] overflow-y-auto p-2.5 space-y-2.5 shrink-0 scrollbar-none">
              <div className="flex items-center justify-between text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">
                <span>Pages</span>
                <span className="font-mono">{numPages}</span>
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
                  const isCurrent = p === currentPage;
                  const hasMatch = searchMatches.some((m) => m.pageNum === p);

                  return (
                    <div
                      key={p}
                      onClick={() => {
                        setCurrentPage(p);
                        onPageChange?.(p, numPages);
                      }}
                      className={`group relative rounded-xl border p-1.5 transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/5 shadow-xs'
                          : 'border-stone-200 dark:border-[#222836] hover:border-stone-400 bg-white dark:bg-[#141822]'
                      } ${hasMatch ? 'border-amber-400 dark:border-amber-500' : ''}`}
                    >
                      <div className="aspect-[3/4] bg-stone-100 dark:bg-[#181d29] rounded-lg overflow-hidden flex items-center justify-center relative">
                        {thumbnailUrls[p] ? (
                          <img src={thumbnailUrls[p]} alt={`Page ${p}`} className="w-full h-full object-contain pointer-events-none" />
                        ) : (
                          <span className="text-[10px] text-stone-400 font-mono">Page {p}</span>
                        )}

                        {hasMatch && (
                          <span
                            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"
                            title="Matches search term"
                          />
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-stone-500 px-0.5">
                        <span>{p}</span>
                        {isCurrent && <span className="text-indigo-600 dark:text-indigo-400 font-bold">Active</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Central Canvas Viewport Area */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-stone-200/60 dark:bg-[#080a0f] p-3 sm:p-6 flex items-center justify-center relative min-w-0 min-h-0 select-none"
          >
            {/* Loading Overlay */}
            {isLoadingDoc && (
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/90 dark:bg-[#131722]/90 backdrop-blur-md border border-stone-200 dark:border-[#222834] shadow-lg">
                <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                <p className="text-xs font-semibold text-stone-700 dark:text-zinc-200">
                  Loading document preview...
                </p>
              </div>
            )}

            {/* Error Overlay */}
            {loadError && !isLoadingDoc && (
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-rose-50/90 dark:bg-rose-950/50 backdrop-blur-md border border-rose-200 dark:border-rose-900 shadow-lg max-w-sm text-center">
                <AlertCircle className="w-8 h-8 text-rose-500" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to render document</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">{loadError}</p>
                </div>
              </div>
            )}

            {/* Rendering Page Badge */}
            {isRenderingPage && !isLoadingDoc && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#161a24]/80 backdrop-blur-md border border-stone-200 dark:border-[#242b3a] shadow-xs text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rendering Page {currentPage}...</span>
              </div>
            )}

            {/* VIEW MODE 1: Standard PDF Render Canvas */}
            {isPdf && !viewCompare && !loadError && (
              <div
                className="relative shadow-2xl rounded-lg overflow-hidden border border-stone-300 dark:border-stone-800 bg-white transition-transform"
                style={fitMode === 'custom' ? { transform: `scale(${scale})`, transformOrigin: 'center center' } : undefined}
              >
                <canvas ref={canvasRef} className="block max-w-none" />
              </div>
            )}

            {/* VIEW MODE 2: PDF Compare Slider or Side-by-Side */}
            {isPdf && viewCompare && !loadError && (
              <div className="flex flex-col items-center gap-3 w-full h-full max-w-full justify-center">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setCompareSplitMode('slider')}
                    className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                      compareSplitMode === 'slider'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-[#161b24] text-stone-700 dark:text-zinc-300 border-stone-300'
                    }`}
                  >
                    Split Slider
                  </button>
                  <button
                    onClick={() => setCompareSplitMode('side-by-side')}
                    className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                      compareSplitMode === 'side-by-side'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-[#161b24] text-stone-700 dark:text-zinc-300 border-stone-300'
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>

                {compareSplitMode === 'slider' ? (
                  <div
                    className="relative max-w-full overflow-hidden rounded-lg shadow-2xl cursor-ew-resize border border-stone-300 dark:border-stone-800 bg-white select-none"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      setSliderPos(pos);
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
                      setSliderPos(pos);
                    }}
                  >
                    {/* Compare (Output) */}
                    <canvas ref={compareCanvasRef} className="block max-w-none" />

                    {/* Original (Clipped on top) */}
                    <div
                      className="absolute inset-0 overflow-hidden border-r-2 border-indigo-500 shadow-xl"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <canvas ref={canvasRef} className="block max-w-none" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 text-white font-mono">
                        Original
                      </span>
                    </div>

                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white font-mono">
                      Output
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-4 max-w-full overflow-auto p-2">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-stone-600 dark:text-zinc-300">
                        Original Document
                      </span>
                      <div className="shadow-xl rounded-lg overflow-hidden border border-stone-300 bg-white">
                        <canvas ref={canvasRef} className="block max-w-none" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        Processed Output
                      </span>
                      <div className="shadow-xl rounded-lg overflow-hidden border border-stone-300 bg-white">
                        <canvas ref={compareCanvasRef} className="block max-w-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW MODE 3: Image Document Render */}
            {isImage && imageUrl && !viewCompare && (
              <div
                className="relative shadow-2xl rounded-xl overflow-hidden border border-stone-300 dark:border-stone-800 bg-white dark:bg-stone-900 transition-transform flex items-center justify-center max-w-full max-h-full"
                style={{
                  transform: `rotate(${rotation}deg) scale(${scale})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={imageUrl}
                  alt={fileName}
                  className="max-w-full max-h-[75vh] object-contain pointer-events-none"
                />
              </div>
            )}

            {/* VIEW MODE 4: Image Comparison (Slider or Side-by-side) */}
            {isImage && imageUrl && viewCompare && compareImageUrl && (
              <div className="flex flex-col items-center gap-3 w-full h-full justify-center">
                <div
                  className="relative max-w-full max-h-[70vh] overflow-hidden rounded-xl shadow-2xl cursor-ew-resize border border-stone-300 dark:border-[#1f2229] select-none"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    setSliderPos(pos);
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
                    setSliderPos(pos);
                  }}
                >
                  <img
                    src={compareImageUrl}
                    alt={compareFileName}
                    className="max-h-[65vh] w-auto object-contain block pointer-events-none"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden border-r-2 border-indigo-500 shadow-xl"
                    style={{ width: `${sliderPos}%` }}
                  >
                    <img
                      src={imageUrl}
                      alt={fileName}
                      className="max-h-[65vh] w-auto object-contain block max-w-none pointer-events-none"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/75 text-white font-mono">
                      Original
                    </span>
                  </div>
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white font-mono">
                    Output
                  </span>
                </div>
              </div>
            )}

            {/* VIEW MODE 5: Fallback for unsupported format */}
            {!isPdf && !isImage && (
              <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white/90 dark:bg-[#131722]/90 backdrop-blur-md border border-stone-200 dark:border-[#222834] shadow-lg max-w-sm text-center">
                <FileText className="w-12 h-12 text-stone-400" />
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">{fileName}</h4>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                    Direct in-browser visual preview is optimized for PDF and image formats. Your file is ready for processing.
                  </p>
                </div>
                {file && (
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Raw File</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Extracted Text Inspector Drawer (Right) */}
          {showTextPanel && isPdf && (
            <div className="w-64 sm:w-80 border-l border-stone-200 dark:border-[#1d232e] bg-white dark:bg-[#10141d] p-3.5 flex flex-col space-y-3 shrink-0">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#1e2533] pb-2">
                <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  Page {currentPage} Text
                </span>
                <button
                  onClick={copyExtractedText}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-[#1b2230] dark:hover:bg-[#232c3f] text-stone-700 dark:text-zinc-300 transition cursor-pointer"
                  title="Copy text to clipboard"
                >
                  {copiedText ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto text-xs leading-relaxed text-stone-700 dark:text-zinc-300 font-mono bg-stone-50 dark:bg-[#0c0f16] p-3 rounded-xl border border-stone-200 dark:border-[#1d2433] select-text">
                {extractedPageText ? (
                  extractedPageText
                ) : (
                  <span className="text-stone-400 italic">No selectable text found on this page (document may be a scan or artwork).</span>
                )}
              </div>
            </div>
          )}

          {/* Metadata Inspector Drawer (Right) */}
          {showMetadata && isPdf && (
            <div className="w-64 sm:w-80 border-l border-stone-200 dark:border-[#1d232e] bg-white dark:bg-[#10141d] p-4 flex flex-col space-y-3 shrink-0 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#1e2533] pb-2">
                <span className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500" />
                  Document Details
                </span>
                <button
                  onClick={() => setShowMetadata(false)}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1c222e] text-stone-400 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">Title</span>
                  <p className="font-semibold text-stone-800 dark:text-zinc-200 truncate">{metadata?.title || 'Untitled'}</p>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">Author</span>
                  <p className="text-stone-800 dark:text-zinc-200 truncate">{metadata?.author || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">Total Pages</span>
                  <p className="text-stone-800 dark:text-zinc-200 font-mono">{numPages}</p>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">Dimensions</span>
                  <p className="text-stone-800 dark:text-zinc-200 font-mono">
                    {metadata?.pageWidth} × {metadata?.pageHeight} pt
                  </p>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">File Size</span>
                  <p className="text-stone-800 dark:text-zinc-200 font-mono">{file ? formatBytes(file.size) : '0 B'}</p>
                </div>
                <div>
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">Format Version</span>
                  <p className="text-stone-800 dark:text-zinc-200 font-mono">{metadata?.pdfVersion || 'PDF 1.4 - 1.7'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if ((mode === 'modal' || isFullscreen) && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};
