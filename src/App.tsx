import { useState, useCallback, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dropzone } from './components/Dropzone';
import { CompressionItemCard } from './components/CompressionItemCard';
import { CompressionListView } from './components/CompressionListView';
import { BatchControls } from './components/BatchControls';
import { PreviewModal } from './components/PreviewModal';
import { FormatGuideModal } from './components/FormatGuideModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { Footer } from './components/Footer';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { compressFile, detectFileCategory } from './lib/compressors';
import { calculateSavings, formatBytes, mergeImagesToPdf, sanitizeFilename } from './lib/utils';
import { getConverterApiUrl } from './lib/remoteConverter';
import { useTheme } from './lib/useTheme';
import { saveAs } from 'file-saver';
import type { FileItem, TargetMode, ToolTab, ViewMode, OutputFormat } from './lib/types';
import { UploadCloud, LayoutGrid, List } from 'lucide-react';

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [items, setItems] = useState<FileItem[]>([]);
  const [activeTab, setActiveTab] = useState<ToolTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isWindowDragging, setIsWindowDragging] = useState(false);

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

  // Add files to queue with validation
  const handleFilesAdded = useCallback(
    async (newFiles: File[]) => {
      const newItems: FileItem[] = [];
      let skippedEmpty = 0;
      let skippedUnsupported = 0;

      for (const file of newFiles) {
        if (file.size === 0) {
          skippedEmpty++;
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
              // Ignore bitmap load errors for unusual formats
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
      if (skippedUnsupported > 0) {
        addToast(
          `Skipped ${skippedUnsupported} unsupported file(s). Supported: JPG, PNG, WebP, AVIF, SVG, GIF, BMP, PDF, DOCX, DOC.`,
          'error'
        );
      }

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
        addToast(`Added ${newItems.length} file(s) to queue.`, 'info');
      }
    },
    [addToast]
  );

  // Full-window drag and drop listener
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

  // Update target size or mode
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

  const handleUpdateItem = useCallback((id: string, updates: Partial<FileItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  // Compress single file with URL memory cleanup
  const handleCompress = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      // Clean up previous compressed preview URL if re-compressing
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
          remoteApiUrl: getConverterApiUrl(),
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
        const msg = err instanceof Error ? err.message : 'Compression failed';
        setItems((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, status: 'error', errorMessage: msg, progress: 0 } : i
          )
        );
        addToast(`Failed to compress "${item.name}": ${msg}`, 'error');
      }
    },
    [items, addToast]
  );

  // Compress all pending
  const handleCompressAll = useCallback(async () => {
    const pendingItems = items.filter((i) => i.status !== 'completed');
    for (const item of pendingItems) {
      await handleCompress(item.id);
    }
  }, [items, handleCompress]);

  // Remove single item with memory cleanup
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

  // Clear all items with memory cleanup
  const handleClearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.originalPreviewUrl) URL.revokeObjectURL(item.originalPreviewUrl);
      if (item.compressedPreviewUrl) URL.revokeObjectURL(item.compressedPreviewUrl);
    });
    setItems([]);
    addToast('Cleared queue.', 'info');
  }, [items, addToast]);

  // Apply batch preset
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

  // Convert all images format
  const handleConvertAllFormat = useCallback(
    (format: OutputFormat) => {
      setItems((prev) =>
        prev.map((i) =>
          i.category === 'image' || i.category === 'svg'
            ? { ...i, outputFormat: format }
            : i
        )
      );
      const label =
        format === 'original'
          ? 'Original'
          : format === 'application/pdf'
          ? 'PDF'
          : format.replace('image/', '').toUpperCase();
      addToast(`Set queued images to convert to ${label}.`, 'info');
    },
    [addToast]
  );

  // Merge all images into a consolidated single PDF
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
      addToast(`Successfully merged ${imageItems.length} images into merged_images.pdf!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PDF merge failed';
      addToast(`Failed to merge images: ${msg}`, 'error');
    }
  }, [items, addToast]);

  const isAnyCompressing = items.some((i) => i.status === 'compressing');

  // Filter items based on active tool tab
  const filteredItems = items.filter((item) => {
    if (activeTab === 'images') return item.category === 'image' || item.category === 'svg';
    if (activeTab === 'pdf') return item.category === 'pdf';
    if (activeTab === 'docx') return item.category === 'docx';
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#090a0f] text-slate-900 dark:text-zinc-100 selection:bg-blue-600 selection:text-white relative transition-colors duration-250">
      {/* Ambient background aura */}
      <div className="ambient-glow" />

      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenApiSettings={() => setIsApiSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Full-Window Drag and Drop Overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 pointer-events-none animate-in fade-in duration-100 border-2 border-dashed border-blue-500 bg-white/90 dark:bg-black/85 backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 animate-bounce shadow-sm">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Drop files anywhere to queue</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-mono">JPG, PNG, WebP, AVIF, SVG, GIF, BMP, PDF, DOCX</p>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        {/* Modern Studio Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium mb-3.5 border transition-colors shadow-2xs
            bg-blue-50/80 border-blue-200/80 text-blue-700
            dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>ShrinkByte • 100% In-Browser Compression & Conversion</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mb-2.5">
            Compress & convert files to an exact target size
          </h1>
          <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            Need a 5 MB file compressed down to 2 MB? Specify the exact target size and the local bisection engine hits within 1% of your target. Images, SVGs, PDFs, and Word documents processed 100% locally with zero server transit.
          </p>
        </div>

        {/* Upload Deck */}
        <div className="mb-8">
          <Dropzone
            activeTab={activeTab}
            hasItems={items.length > 0}
            onFilesAdded={handleFilesAdded}
          />
        </div>

        {/* Batch Controls (when files are loaded) */}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-400 px-1">
              <span>
                Queue ({filteredItems.length} {filteredItems.length === 1 ? 'file' : 'files'}
                {activeTab !== 'all' ? ` in ${activeTab}` : ''})
              </span>

              <div className="flex items-center gap-3">
                <span>
                  {items.filter((i) => i.status === 'completed').length} / {items.length} compressed
                </span>

                {/* View switcher: Grid vs List */}
                <div className="flex items-center p-0.5 rounded-xl border transition-colors
                  bg-slate-100 border-slate-200 text-slate-600
                  dark:bg-[#131518] dark:border-[#23272e] dark:text-zinc-400"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white text-slate-900 dark:bg-[#22252c] dark:text-zinc-100 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300'
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
                        ? 'bg-white text-slate-900 dark:bg-[#22252c] dark:text-zinc-100 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300'
                    }`}
                    title="List view"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border text-xs font-mono shadow-sm
                bg-white border-slate-200 text-slate-500
                dark:bg-[#0c0d10] dark:border-[#1f2228] dark:text-zinc-400"
              >
                <p>No files match the currently selected category ({activeTab}).</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="mt-2 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Show all {items.length} file(s)
                </button>
              </div>
            ) : viewMode === 'grid' ? (
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
      </main>

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

      {/* Converter API Settings Modal */}
      {isApiSettingsOpen && (
        <ApiSettingsModal
          isOpen={isApiSettingsOpen}
          onClose={() => setIsApiSettingsOpen(false)}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <Footer />
    </div>
  );
}

export default App;
