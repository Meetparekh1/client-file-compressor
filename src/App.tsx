import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { MergePdfTool } from './components/MergePdfTool';
import { SplitPdfTool } from './components/SplitPdfTool';
import { ScanToPdfTool } from './components/ScanToPdfTool';
import { SignWatermarkTool } from './components/SignWatermarkTool';
import { RotatePdfTool } from './components/RotatePdfTool';
import { DeletePagesTool } from './components/DeletePagesTool';
import { PageNumbersTool } from './components/PageNumbersTool';
import { PdfToImagesTool } from './components/PdfToImagesTool';
import { FlattenPdfTool } from './components/FlattenPdfTool';
import { TextToPdfTool } from './components/TextToPdfTool';
import { PdfToOfficeTool } from './components/PdfToOfficeTool';
import { AiSummarizerTool } from './components/AiSummarizerTool';
import { OcrPdfTool } from './components/OcrPdfTool';
import { HtmlToPdfTool } from './components/HtmlToPdfTool';
import { EditPdfTool } from './components/EditPdfTool';
import { UnlockPdfTool } from './components/UnlockPdfTool';
import { Dropzone } from './components/Dropzone';
import { CompressionItemCard } from './components/CompressionItemCard';
import { CompressionListView } from './components/CompressionListView';
import { BatchControls } from './components/BatchControls';
import { PreviewModal } from './components/PreviewModal';
import { FormatGuideModal } from './components/FormatGuideModal';
import { Footer } from './components/Footer';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { compressFile, detectFileCategory } from './lib/compressors';
import { calculateSavings, formatBytes, mergeImagesToPdf, sanitizeFilename } from './lib/utils';
import { parseFriendlyError } from './lib/errorParser';
import { useTheme } from './lib/useTheme';
import { useUiMode } from './lib/useUiMode';
import { saveAs } from 'file-saver';
import type { FileItem, TargetMode, ToolTab, ViewMode, OutputFormat } from './lib/types';
import type { ToolCategory } from './lib/toolsRegistry';
import { MAX_FILE_SIZE_BYTES, MAX_TOTAL_BATCH_BYTES, MAX_BATCH_FILE_COUNT } from './lib/securityLimits';
import { UploadCloud, LayoutGrid, List, ArrowLeft, ShieldCheck, Menu } from 'lucide-react';

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [uiMode, setUiMode] = useUiMode();
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Compression engine state
  const [items, setItems] = useState<FileItem[]>([]);
  const [activeTab] = useState<ToolTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Prevent background scroll and page shift when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Add files to compression queue
  const handleFilesAdded = useCallback(
    async (newFiles: File[]) => {
      const newItems: FileItem[] = [];
      let skippedEmpty = 0;
      let skippedUnsupported = 0;
      let skippedTooLarge = 0;

      for (const file of newFiles) {
        if (file.size === 0) {
          skippedEmpty++;
          continue;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          skippedTooLarge++;
          continue;
        }

        const category = detectFileCategory(file);
        if (category === 'unsupported') {
          skippedUnsupported++;
          continue;
        }

        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        let defaultTargetBytes = Math.round(file.size * 0.5);
        if (file.size > 2 * 1024 * 1024) {
          defaultTargetBytes = 2 * 1024 * 1024;
        }

        let previewUrl: string | undefined;
        let dimensions: FileItem['dimensions'] | undefined;

        if (category === 'image' || category === 'svg') {
          previewUrl = URL.createObjectURL(file);
          if (category === 'image') {
            try {
              const bitmap = await createImageBitmap(file);
              dimensions = {
                originalWidth: bitmap.width,
                originalHeight: bitmap.height,
              };
              bitmap.close();
            } catch {
              // Ignore
            }
          }
        }

        const isDoc = file.name.toLowerCase().endsWith('.doc');
        newItems.push({
          id,
          file,
          name: sanitizeFilename(file.name),
          category,
          mimeType: file.type,
          originalSize: file.size,
          targetMode: 'target_size',
          targetSize: defaultTargetBytes,
          targetPercentage: 50,
          outputFormat: isDoc ? 'application/pdf' : undefined,
          status: 'idle',
          progress: 0,
          originalPreviewUrl: previewUrl,
          dimensions,
        });
      }

      if (skippedEmpty > 0) {
        addToast(`Skipped ${skippedEmpty} empty (0-byte) file(s).`, 'error');
      }
      if (skippedTooLarge > 0) {
        addToast(
          `Skipped ${skippedTooLarge} file(s) exceeding upload limit of ${Math.round(
            MAX_FILE_SIZE_BYTES / (1024 * 1024)
          )}MB.`,
          'error'
        );
      }
      if (skippedUnsupported > 0) {
        addToast(
          `Skipped ${skippedUnsupported} unsupported file(s).`,
          'error'
        );
      }

      if (newItems.length > 0) {
        setItems((prev) => {
          if (prev.length + newItems.length > MAX_BATCH_FILE_COUNT) {
            addToast(`Queue limited to maximum ${MAX_BATCH_FILE_COUNT} files.`, 'error');
            return [...prev, ...newItems.slice(0, Math.max(0, MAX_BATCH_FILE_COUNT - prev.length))];
          }
          const totalBytes = [...prev, ...newItems].reduce((acc, curr) => acc + curr.originalSize, 0);
          if (totalBytes > MAX_TOTAL_BATCH_BYTES) {
            addToast(
              `Total queue size exceeds safe limit (${Math.round(
                MAX_TOTAL_BATCH_BYTES / (1024 * 1024)
              )}MB).`,
              'error'
            );
          }
          return [...prev, ...newItems];
        });
        addToast(`Added ${newItems.length} file(s) to compression queue.`, 'info');
        setActiveView('compress-pdf');
      }
    },
    [addToast]
  );

  // Drag and drop listeners
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsWindowDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsWindowDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFilesAdded]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
        } else {
          setActiveView('dashboard');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUpdateTarget = useCallback(
    (id: string, targetBytes: number, mode: TargetMode, percentage: number) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                targetSize: targetBytes,
                targetMode: mode,
                targetPercentage: percentage,
              }
            : item
        )
      );
    },
    []
  );

  const handleCompress = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      if (item.compressedPreviewUrl) {
        URL.revokeObjectURL(item.compressedPreviewUrl);
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'compressing', progress: 5, errorMessage: undefined } : i
        )
      );

      const startTime = performance.now();

      try {
        const result = await compressFile(item.file, {
          targetSizeBytes: item.targetSize,
          tolerance: 0.02,
          rotation: item.rotation,
          maxWidth: item.maxWidth,
          outputFormat: item.outputFormat,
          onProgress: (progress) => {
            setItems((prev) =>
              prev.map((i) => (i.id === id ? { ...i, progress } : i))
            );
          },
        });

        const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
        const savings = calculateSavings(item.originalSize, result.blob.size);
        let compressedPreviewUrl: string | undefined;

        if ((item.category === 'image' || item.category === 'svg') && item.outputFormat !== 'application/pdf') {
          compressedPreviewUrl = URL.createObjectURL(result.blob);
        }

        setItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'completed',
                  progress: 100,
                  compressedBlob: result.blob,
                  compressedSize: result.blob.size,
                  accuracy: result.accuracy,
                  iterations: result.iterations,
                  savingsPercent: savings.percent,
                  compressedPreviewUrl,
                  dimensions: {
                    originalWidth: result.originalWidth || i.dimensions?.originalWidth || 0,
                    originalHeight: result.originalHeight || i.dimensions?.originalHeight || 0,
                    newWidth: result.newWidth,
                    newHeight: result.newHeight,
                  },
                }
              : i
          )
        );

        addToast(
          `"${item.name}" compressed to ${formatBytes(result.blob.size)} (-${savings.percent}%) in ${elapsedSec}s.`,
          'success'
        );
        } catch (err: unknown) {
          const friendly = parseFriendlyError(err, 'Failed to compress document.');
          setItems((prev) =>
            prev.map((i) =>
              i.id === id ? { ...i, status: 'error', errorMessage: friendly.message, progress: 0 } : i
            )
          );
          addToast(`${friendly.title}: ${friendly.message}`, 'error');
        }
      },
      [items, addToast]
  );

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        if (item.originalPreviewUrl) URL.revokeObjectURL(item.originalPreviewUrl);
        if (item.compressedPreviewUrl) URL.revokeObjectURL(item.compressedPreviewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleCompressAll = useCallback(async () => {
    const pendingItems = items.filter((i) => i.status !== 'completed');
    for (const item of pendingItems) {
      await handleCompress(item.id);
    }
  }, [items, handleCompress]);

  const handleClearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.originalPreviewUrl) URL.revokeObjectURL(item.originalPreviewUrl);
      if (item.compressedPreviewUrl) URL.revokeObjectURL(item.compressedPreviewUrl);
    });
    setItems([]);
  }, [items]);

  const handleApplyPresetAll = useCallback(
    (targetBytes: number) => {
      setItems((prev) =>
        prev.map((i) =>
          i.status !== 'completed'
            ? {
                ...i,
                targetSize: targetBytes,
                targetMode: 'target_size',
              }
            : i
        )
      );
      addToast(`Set target to ${formatBytes(targetBytes)} for all files.`, 'info');
    },
    [addToast]
  );

  const handleConvertAllFormat = useCallback(
    (format: OutputFormat) => {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          outputFormat: format,
        }))
      );
      addToast(`Set target format to ${format || 'original'} for all items`, 'info');
    },
    [addToast]
  );

  const handleMergeAllToPdf = useCallback(async () => {
    const imageItems = items.filter(
      (i) => (i.category === 'image' || i.category === 'svg') && (i.compressedBlob || i.file)
    );
    if (imageItems.length === 0) {
      addToast('No images available to merge into PDF.', 'error');
      return;
    }
    try {
      addToast(`Merging ${imageItems.length} images into a single PDF...`, 'info');
      const inputFiles = imageItems.map((i) => ({
        blob: i.compressedBlob || i.file,
        name: i.name,
      }));
      const mergedBlob = await mergeImagesToPdf(inputFiles);
      saveAs(mergedBlob, 'merged_images.pdf');
      addToast('Images merged to PDF successfully!', 'success');
    } catch {
      addToast('Failed to merge images to PDF.', 'error');
    }
  }, [items, addToast]);

  const handleUpdateItem = useCallback((id: string, updates: Partial<FileItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const isAnyCompressing = items.some((i) => i.status === 'compressing');
  const filteredItems = items.filter((item) => {
    if (activeTab === 'images') return item.category === 'image' || item.category === 'svg';
    if (activeTab === 'pdf') return item.category === 'pdf';
    if (activeTab === 'docx') return item.category === 'docx';
    return true;
  });

  return (
    <div className={`min-h-screen text-stone-900 dark:text-zinc-100 flex flex-col transition-colors duration-300 relative overflow-x-clip ${
      uiMode === 'glassy'
        ? 'bg-transparent'
        : 'bg-[#fbf9f4] dark:bg-[#0b0e14]'
    }`}>
      {/* Dynamic Theme Background Layers */}
      {uiMode === 'glassy' ? (
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          {/* Animated Pastel Gradient Mesh */}
          <div className="absolute inset-0 bg-glassy-mesh transition-opacity duration-700" />
          
          {/* Ambient Glowing Glass Orbs */}
          {/* Top-Left Rose/Peach Orb */}
          <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-rose-300/40 via-pink-200/30 to-transparent dark:from-purple-900/30 dark:via-pink-900/20 dark:to-transparent blur-3xl animate-float-slow" />
          
          {/* Top-Right Lavender/Violet Orb */}
          <div className="absolute top-10 -right-28 w-[580px] h-[580px] rounded-full bg-gradient-to-br from-purple-300/35 via-indigo-200/25 to-transparent dark:from-indigo-900/30 dark:via-purple-900/20 dark:to-transparent blur-3xl animate-float-reverse" />
          
          {/* Bottom-Left Cyan/Sky Blue Orb */}
          <div className="absolute -bottom-40 left-1/4 w-[620px] h-[620px] rounded-full bg-gradient-to-tr from-sky-300/35 via-teal-200/20 to-transparent dark:from-blue-900/25 dark:via-cyan-900/15 dark:to-transparent blur-3xl animate-float-medium" />

          {/* Bottom-Right Warm Amber/Rose Orb */}
          <div className="absolute -bottom-24 -right-24 w-[480px] h-[480px] rounded-full bg-gradient-to-tl from-amber-200/30 via-rose-200/20 to-transparent dark:from-rose-950/20 dark:via-purple-950/20 dark:to-transparent blur-3xl animate-float-slow" />
        </div>
      ) : (
        /* Classic Background with Dot Pattern and Ambient Glow */
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-grid-pattern opacity-60" />
          <div className="ambient-glow" />
        </div>
      )}

      {/* Full-Window Drag and Drop Overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 pointer-events-none animate-in fade-in duration-100 border-2 border-dashed border-indigo-500 bg-white/95 dark:bg-[#0b0e14]/95 backdrop-blur-md">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 animate-bounce shadow-md">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
            Drop files anywhere to queue
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 font-mono">
            PDF, JPG, PNG, WebP, AVIF, SVG, DOCX
          </p>
        </div>
      )}

      {/* Mobile Top Navigation Header */}
      <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30 transition-all ${
        uiMode === 'glassy'
          ? 'glass-sidebar border-white/60 dark:border-white/10'
          : 'bg-white/90 dark:bg-[#12161f]/90 border-stone-200/80 dark:border-[#202735] backdrop-blur-md'
      }`}>
        <div 
          onClick={() => { setActiveView('dashboard'); setSelectedCategory('all'); }}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-xs font-black text-sm">
            D
          </div>
          <span className="font-extrabold text-base tracking-tight text-stone-900 dark:text-white">
            DocuKit
          </span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-xl text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-[#181d28] border border-stone-200 dark:border-white/5 cursor-pointer"
          aria-label="Open Tools Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Main Layout Container with Responsive Sidebar */}
      <div className="flex-1 w-full max-w-[1540px] mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-5 flex flex-col md:flex-row md:gap-6 items-start">
        {/* Responsive Sidebar (Desktop Sticky + Mobile Drawer) */}
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setActiveView('dashboard');
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
          uiMode={uiMode}
          onChangeUiMode={setUiMode}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Dynamic Center Stage with Smooth Transitions */}
        <main key={activeView} className="flex-1 w-full min-w-0 page-transition-enter">
          {activeView === 'dashboard' && (
            <Dashboard
              onSelectTool={(toolId) => setActiveView(toolId)}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onQuickUpload={handleFilesAdded}
            />
          )}

          {activeView === 'merge-pdf' && (
            <MergePdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'split-pdf' && (
            <SplitPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'scan-pdf' && (
            <ScanToPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'sign-watermark-pdf' && (
            <SignWatermarkTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'rotate-pdf' && (
            <RotatePdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'delete-pages' && (
            <DeletePagesTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'page-numbers' && (
            <PageNumbersTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'pdf-to-images' && (
            <PdfToImagesTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'flatten-pdf' && (
            <FlattenPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'text-to-pdf' && (
            <TextToPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'pdf-to-office' && (
            <PdfToOfficeTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'ai-summarizer' && (
            <AiSummarizerTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'ocr-pdf' && (
            <OcrPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'html-to-pdf' && (
            <HtmlToPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'edit-pdf' && (
            <EditPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'unlock-pdf' && (
            <UnlockPdfTool
              onBack={() => setActiveView('dashboard')}
              onToast={addToast}
            />
          )}

          {activeView === 'compress-pdf' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={() => setActiveView('dashboard')}
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

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
                  Compress Files to Exact Target Size
                </h1>
                <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
                  Specify target sizes for PDFs, images, DOCX and SVGs with local bisection precision. Zero server transit.
                </p>
              </div>

              {/* Upload Dropzone */}
              <Dropzone
                activeTab={activeTab}
                hasItems={items.length > 0}
                onFilesAdded={handleFilesAdded}
              />

              {/* Batch Controls */}
              {items.length > 0 && (
                <BatchControls
                  items={items}
                  onCompressAll={handleCompressAll}
                  onClearAll={handleClearAll}
                  onApplyPresetAll={handleApplyPresetAll}
                  onConvertAllFormat={handleConvertAllFormat}
                  onMergeAllToPdf={handleMergeAllToPdf}
                  isAnyCompressing={isAnyCompressing}
                />
              )}

              {/* File Queue */}
              {items.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono text-stone-500 dark:text-zinc-400 px-1">
                    <span>Queue ({filteredItems.length} files)</span>
                    <div className="flex items-center gap-3">
                      <span>
                        {items.filter((i) => i.status === 'completed').length} / {items.length} compressed
                      </span>
                      <div className="flex items-center p-0.5 rounded-xl border transition-colors bg-stone-100 border-stone-200 text-stone-600 dark:bg-[#131518] dark:border-[#23272e] dark:text-zinc-400">
                        <button
                          type="button"
                          onClick={() => setViewMode('grid')}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            viewMode === 'grid'
                              ? 'bg-white text-stone-900 dark:bg-[#22252c] dark:text-zinc-100 shadow-xs font-semibold'
                              : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300'
                          }`}
                          title="Grid view"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('list')}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            viewMode === 'list'
                              ? 'bg-white text-stone-900 dark:bg-[#22252c] dark:text-zinc-100 shadow-xs font-semibold'
                              : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300'
                          }`}
                          title="List view"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {filteredItems.map((item) => (
                        <CompressionItemCard
                          key={item.id}
                          item={item}
                          onUpdateTarget={handleUpdateTarget}
                          onUpdateItem={handleUpdateItem}
                          onCompress={handleCompress}
                          onRemove={handleRemove}
                          onPreview={(previewItem) => setPreviewItem(previewItem)}
                        />
                      ))}
                    </div>
                  ) : (
                    <CompressionListView
                      items={filteredItems}
                      onUpdateTarget={handleUpdateTarget}
                      onUpdateItem={handleUpdateItem}
                      onCompress={handleCompress}
                      onRemove={handleRemove}
                      onPreview={(previewItem) => setPreviewItem(previewItem)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Comparison Modal */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* Format Guide Modal */}
      {isGuideOpen && (
        <FormatGuideModal onClose={() => setIsGuideOpen(false)} />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Footer with On-Device Security */}
      <Footer />
    </div>
  );
}

export default App;
