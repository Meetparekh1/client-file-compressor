import { useState, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dropzone } from './components/Dropzone';
import { CompressionItemCard } from './components/CompressionItemCard';
import { BatchControls } from './components/BatchControls';
import { PreviewModal } from './components/PreviewModal';
import { FormatGuideModal } from './components/FormatGuideModal';
import { Footer } from './components/Footer';
import { compressFile, detectFileCategory } from './lib/compressors';
import { calculateSavings } from './lib/utils';
import type { FileItem, TargetMode } from './lib/types';
import { Sparkles, Shield, Cpu, Zap } from 'lucide-react';

export function App() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Add files to queue
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    const newItems: FileItem[] = [];

    for (const file of newFiles) {
      const category = detectFileCategory(file);
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Smart default target size:
      // If file > 2MB, default target is 2MB; otherwise 50% of original
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

    setItems((prev) => [...prev, ...newItems]);
  }, []);

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

  // Compress single file
  const handleCompress = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Set compressing state
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: 'compressing', progress: 5, errorMessage: undefined } : i
      )
    );

    try {
      const result = await compressFile(item.file, {
        targetSizeBytes: item.targetSize,
        tolerance: 0.02,
        onProgress: (progress) => {
          setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, progress } : i))
          );
        },
      });

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compression failed';
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'error', errorMessage: msg, progress: 0 } : i
        )
      );
    }
  }, [items]);

  // Compress all pending
  const handleCompressAll = useCallback(async () => {
    const pendingItems = items.filter((i) => i.status !== 'completed');
    for (const item of pendingItems) {
      await handleCompress(item.id);
    }
  }, [items, handleCompress]);

  // Remove single item
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

  // Clear all items
  const handleClearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.originalPreviewUrl) URL.revokeObjectURL(item.originalPreviewUrl);
      if (item.compressedPreviewUrl) URL.revokeObjectURL(item.compressedPreviewUrl);
    });
    setItems([]);
  }, [items]);

  // Apply batch preset
  const handleApplyPresetAll = useCallback((targetBytes: number) => {
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
  }, []);

  const isAnyCompressing = items.some((i) => i.status === 'compressing');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <Navbar onOpenGuide={() => setIsGuideOpen(true)} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Target File Size Precision Engine (~99% Accuracy)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Compress Files Locally{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Without Server Uploads
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Need a 5 MB image compressed to exactly 2 MB? Specify your target size and our in-browser bisection algorithm hits it with 99% accuracy. Zero data leaves your computer.
          </p>

          {/* Quick Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>100% Private (Client-Side)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Exact Target Size</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>JPG, PNG, PDF & DOCX</span>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="mb-8">
          <Dropzone onFilesAdded={handleFilesAdded} />
        </div>

        {/* Batch Controls (if items exist) */}
        {items.length > 0 && (
          <BatchControls
            items={items}
            onCompressAll={handleCompressAll}
            onClearAll={handleClearAll}
            onApplyPresetAll={handleApplyPresetAll}
            isAnyCompressing={isAnyCompressing}
          />
        )}

        {/* File Cards Queue */}
        {items.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Queue ({items.length} {items.length === 1 ? 'file' : 'files'})
              </span>
              <span>
                {items.filter((i) => i.status === 'completed').length} of {items.length} compressed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <CompressionItemCard
                  key={item.id}
                  item={item}
                  onUpdateTarget={handleUpdateTarget}
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

      <Footer />
    </div>
  );
}

export default App;
