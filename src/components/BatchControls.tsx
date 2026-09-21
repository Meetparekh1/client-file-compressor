import React, { useState } from 'react';
import { Play, Trash2, Archive, Sliders } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { parseBytes, getOutputFilename } from '../lib/utils';
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
    <div className="bg-[#0e1013] border border-[#21242b] rounded-xl p-3.5 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Batch target presets */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
        <span className="text-zinc-400 text-[11px] mr-1 flex items-center gap-1">
          <Sliders className="w-3.5 h-3.5" />
          Set all:
        </span>
        {[0.5, 1, 2, 5].map((mb) => (
          <button
            key={mb}
            type="button"
            onClick={() => onApplyPresetAll(parseBytes(mb, 'MB'))}
            className="px-2 py-1 rounded bg-[#16181d] hover:bg-[#20232a] border border-[#262932] text-zinc-300 hover:text-white transition"
          >
            {mb}MB
          </button>
        ))}
      </div>

      {/* Batch actions */}
      <div className="flex items-center gap-2 justify-end">
        {pendingCount > 0 && (
          <button
            onClick={onCompressAll}
            disabled={isAnyCompressing}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Compress All ({pendingCount})</span>
          </button>
        )}

        {completedCount > 0 && (
          <button
            onClick={handleDownloadAllZip}
            disabled={isZipping}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Zipping...' : `Download All (${completedCount})`}</span>
          </button>
        )}

        <button
          onClick={onClearAll}
          disabled={isAnyCompressing}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#181a20] transition"
          title="Clear queue"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
