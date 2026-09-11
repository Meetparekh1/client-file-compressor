import React, { useState } from 'react';
import { Play, Trash2, SlidersHorizontal, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { parseBytes } from '../lib/utils';
import type { FileItem } from '../lib/types';

interface BatchControlsProps {
  items: FileItem[];
  onCompressAll: () => void;
  onClearAll: () => void;
  onApplyPresetAll: (targetBytes: number) => void;
  isAnyCompressing: boolean;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  items,
  onCompressAll,
  onClearAll,
  onApplyPresetAll,
  isAnyCompressing,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const completedCount = items.filter((i) => i.status === 'completed' && i.compressedBlob).length;
  const pendingCount = items.filter((i) => i.status !== 'completed').length;

  const handleDownloadAllZip = async () => {
    const completedItems = items.filter((i) => i.status === 'completed' && i.compressedBlob);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      completedItems.forEach((item) => {
        if (item.compressedBlob) {
          zip.file(`compressed_${item.name}`, item.compressedBlob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'compressed_files.zip');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
      {/* Left: Quick Batch Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1.5 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          Set All Targets:
        </span>
        {[0.5, 1, 2, 5].map((mb) => (
          <button
            key={mb}
            type="button"
            onClick={() => onApplyPresetAll(parseBytes(mb, 'MB'))}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            {mb} MB
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex flex-wrap items-center gap-2.5 justify-end">
        {/* Compress All */}
        {pendingCount > 0 && (
          <button
            onClick={onCompressAll}
            disabled={isAnyCompressing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Compress All ({pendingCount})</span>
          </button>
        )}

        {/* Download All as ZIP */}
        {completedCount > 0 && (
          <button
            onClick={handleDownloadAllZip}
            disabled={isZipping}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            {isZipping ? (
              <span>Creating ZIP...</span>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Download All ZIP ({completedCount})</span>
              </>
            )}
          </button>
        )}

        {/* Clear All */}
        <button
          onClick={onClearAll}
          disabled={isAnyCompressing}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-red-400 text-slate-400 transition"
          title="Clear queue"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
