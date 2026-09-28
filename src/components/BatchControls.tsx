import React, { useState } from 'react';
import { Play, Trash2, Archive, Sliders, CheckCircle2, FileText } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getOutputFilename, formatBytes } from '../lib/utils';
import type { FileItem, OutputFormat } from '../lib/types';

interface BatchControlsProps {
  items: FileItem[];
  onCompressAll: () => void;
  onClearAll: () => void;
  onApplyPresetAll: (targetBytes: number) => void;
  onConvertAllFormat?: (format: OutputFormat) => void;
  onMergeAllToPdf?: () => void;
  isAnyCompressing: boolean;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  items,
  onCompressAll,
  onClearAll,
  onApplyPresetAll,
  onConvertAllFormat,
  onMergeAllToPdf,
  isAnyCompressing,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const completedItems = items.filter((i) => i.status === 'completed' && i.compressedBlob && i.compressedSize);
  const completedCount = completedItems.length;
  const pendingCount = items.filter((i) => i.status !== 'completed').length;
  const imageCount = items.filter((i) => i.category === 'image' || i.category === 'svg').length;

  // Session cumulative statistics
  const totalOriginal = completedItems.reduce((acc, i) => acc + i.originalSize, 0);
  const totalCompressed = completedItems.reduce((acc, i) => acc + (i.compressedSize || 0), 0);
  const totalSavedBytes = Math.max(0, totalOriginal - totalCompressed);
  const totalSavedPercent = totalOriginal > 0 ? Math.round((totalSavedBytes / totalOriginal) * 100) : 0;

  const handleDownloadAllZip = async () => {
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      completedItems.forEach((item) => {
        if (item.compressedBlob) {
          const filename = getOutputFilename(item.name, item.outputFormat);
          zip.file(filename, item.compressedBlob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'compressed_files.zip');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 mb-6 flex flex-col gap-3 shadow-sm border transition-colors
      bg-white border-slate-200/90
      dark:bg-[#0e1014] dark:border-[#21242b]"
    >
      {/* Top row: Target size presets & Format bulk conversion */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono">
        {/* Batch target presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] mr-1 flex items-center gap-1 text-slate-500 dark:text-zinc-400 font-medium">
            <Sliders className="w-3.5 h-3.5" />
            Set all:
          </span>
          {[
            { label: '200KB', bytes: 200 * 1024 },
            { label: '500KB', bytes: 500 * 1024 },
            { label: '1MB', bytes: 1024 * 1024 },
            { label: '2MB', bytes: 2 * 1024 * 1024 },
            { label: '5MB', bytes: 5 * 1024 * 1024 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApplyPresetAll(preset.bytes)}
              className="px-2.5 py-1 rounded-md transition cursor-pointer border
                bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700
                dark:bg-[#16181d] dark:hover:bg-[#20232a] dark:border-[#262932] dark:text-zinc-300 dark:hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Bulk format conversion */}
        {imageCount > 0 && onConvertAllFormat && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 dark:text-zinc-400">Convert images:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onConvertAllFormat(e.target.value as OutputFormat);
                }
              }}
              className="rounded-lg px-2.5 py-1 font-mono focus:outline-none transition cursor-pointer border
                bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800
                dark:bg-[#14161a] dark:hover:border-[#333742] dark:border-[#262932] dark:text-zinc-200"
            >
              <option value="" disabled>Select format...</option>
              <option value="original">Original</option>
              <option value="image/webp">WebP (Best Size)</option>
              <option value="image/avif">AVIF (Ultra Dense)</option>
              <option value="image/jpeg">JPEG (Universal)</option>
              <option value="image/png">PNG (Lossless)</option>
              <option value="application/pdf">PDF Document</option>
            </select>
          </div>
        )}
      </div>

      {/* Middle row: Action triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#1a1c22]">
        <div className="flex items-center gap-2">
          {imageCount >= 2 && onMergeAllToPdf && (
            <button
              type="button"
              onClick={onMergeAllToPdf}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-2xs
                bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700
                dark:bg-[#16181e] dark:hover:bg-[#20232c] dark:border-[#282c38] dark:text-zinc-200"
              title="Combine all images into a single multi-page PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Merge {imageCount} Images to PDF</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={onCompressAll}
              disabled={isAnyCompressing}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-40
                bg-slate-900 hover:bg-slate-800 text-white
                dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Compress All ({pendingCount})</span>
            </button>
          )}

          {completedCount > 0 && (
            <button
              onClick={handleDownloadAllZip}
              disabled={isZipping}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isZipping ? 'Zipping...' : `Download All (${completedCount})`}</span>
            </button>
          )}

          <button
            onClick={onClearAll}
            disabled={isAnyCompressing}
            className="p-2 rounded-xl transition cursor-pointer border
              border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700
              dark:hover:bg-[#181a20] dark:text-zinc-400 dark:hover:text-zinc-200"
            title="Clear queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cumulative Saved Banner when items are completed */}
      {completedCount > 0 && (
        <div className="pt-2.5 border-t border-slate-100 dark:border-[#1a1c22] flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>
              {completedCount} of {items.length} files compressed
            </span>
          </div>
          <div>
            Total Saved:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatBytes(totalSavedBytes)}</strong>{' '}
            <span className="text-slate-400 dark:text-zinc-500">(-{totalSavedPercent}%)</span>
          </div>
        </div>
      )}
    </div>
  );
};
