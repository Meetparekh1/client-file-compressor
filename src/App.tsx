import { useState, useCallback, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dropzone } from './components/Dropzone';
import { CompressionItemCard } from './components/CompressionItemCard';
import { BatchControls } from './components/BatchControls';
import { PreviewModal } from './components/PreviewModal';
import { FormatGuideModal } from './components/FormatGuideModal';
import { Footer } from './components/Footer';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { compressFile, detectFileCategory } from './lib/compressors';
import { calculateSavings, formatBytes } from './lib/utils';
import type { FileItem, TargetMode } from './lib/types';
import { UploadCloud } from 'lucide-react';

export function App() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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

        if (category === 'image') {
          previewUrl = URL.createObjectURL(file);
          try {
            const bitmap = await createImageBitmap(file);
            dimensions = {
              originalWidth: bitmap.width,
              originalHeight: bitmap.height,
            };
          } catch {
            // Ignore bitmap load errors for unusual formats
          }
        }

        newItems.push({
          id,
          file,
          name: file.name,
          category,
          mimeType: file.type,
          originalSize: file.size,
          targetMode: 'target_size',
          targetSize: defaultTargetBytes,
          targetPercentage: 50,
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
        addToast(`Skipped ${skippedUnsupported} unsupported file(s). Supported: JPG, PNG, WebP, PDF, DOCX.`, 'error');
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
          onProgress: (progress) => {
            setItems((prev) =>
              prev.map((i) => (i.id === id ? { ...i, progress } : i))
            );
          },
        });

        const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
        const savings = calculateSavings(item.originalSize, result.blob.size);
        let compressedPreviewUrl: string | undefined;

        if (item.category === 'image') {
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

  const isAnyCompressing = items.some((i) => i.status === 'compressing');

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0c] text-zinc-100 selection:bg-blue-600 selection:text-white relative">
      <Navbar onOpenGuide={() => setIsGuideOpen(true)} />

      {/* Full-Window Drag and Drop Overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm border-2 border-dashed border-blue-500 flex flex-col items-center justify-center p-6 pointer-events-none animate-in fade-in duration-100">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-4 animate-bounce">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">Drop files anywhere to queue</h2>
          <p className="text-xs text-zinc-400 mt-1 font-mono">JPG, PNG, WebP, PDF, DOCX</p>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Clean, Human-Crafted Hero */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight mb-2">
            Compress files to an exact target size
          </h1>
          <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
            Need a 5 MB file compressed down to 2 MB? Specify the exact target size and the local bisection engine hits within 1% of your target. Images, PDFs, and Word documents processed 100% in-browser.
          </p>
        </div>

        {/* Upload Deck */}
        <div className="mb-8">
          <Dropzone onFilesAdded={handleFilesAdded} />
        </div>

        {/* Batch Controls (when files are loaded) */}
        {items.length > 0 && (
          <BatchControls
            items={items}
            onCompressAll={handleCompressAll}
            onClearAll={handleClearAll}
            onApplyPresetAll={handleApplyPresetAll}
            isAnyCompressing={isAnyCompressing}
          />
        )}

        {/* File Queue */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
              <span>
                Queue ({items.length} {items.length === 1 ? 'file' : 'files'})
              </span>
              <span>
                {items.filter((i) => i.status === 'completed').length} / {items.length} compressed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {items.map((item) => (
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <Footer />
    </div>
  );
}

export default App;
