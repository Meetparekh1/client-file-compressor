import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileType,
  Download,
  Eye,
  X,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { formatBytes, downloadFile } from '../lib/utils';
import type { FileItem, OutputFormat } from '../lib/types';

interface CompressionListViewProps {
  items: FileItem[];
  onUpdateTarget: (id: string, targetBytes: number, mode: 'target_size' | 'percentage', percentage: number) => void;
  onUpdateItem: (id: string, updates: Partial<FileItem>) => void;
  onCompress: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (item: FileItem) => void;
}

export const CompressionListView: React.FC<CompressionListViewProps> = ({
  items,
  onUpdateItem,
  onCompress,
  onRemove,
  onPreview,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (item: FileItem) => {
    if (!item.compressedBlob) return;
    try {
      let blob = item.compressedBlob;
      if (blob.type !== 'image/png') {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d');
        ctx?.drawImage(bmp, 0, 0);
        bmp.close();
        blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
        c.width = 0;
        c.height = 0;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  const getFormatBadge = (item: FileItem) => {
    if (item.category === 'svg') return <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">SVG</span>;
    if (item.category === 'pdf') return <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">PDF</span>;
    if (item.category === 'docx') return <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">DOCX</span>;
    return <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">IMG</span>;
  };

  return (
    <div className="border rounded-2xl overflow-hidden divide-y transition-colors shadow-sm
      bg-white border-slate-200 divide-slate-100
      dark:bg-[#0e1013] dark:border-[#21242b] dark:divide-[#1b1e25]"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors text-xs
            hover:bg-slate-50 dark:hover:bg-[#121418]"
        >
          {/* File Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border
              bg-slate-100 border-slate-200 dark:bg-[#16181d] dark:border-[#262932]"
            >
              {item.originalPreviewUrl ? (
                <img
                  src={item.originalPreviewUrl}
                  alt={item.name}
                  style={{ transform: `rotate(${item.rotation || 0}deg)` }}
                  className="w-full h-full object-cover"
                />
              ) : item.category === 'pdf' ? (
                <FileText className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              ) : item.category === 'docx' ? (
                <FileType className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              ) : (
                <ImageIcon className="w-4 h-4 text-slate-400 dark:text-zinc-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-zinc-200 truncate max-w-[160px] sm:max-w-[200px]" title={item.name}>
                  {item.name}
                </span>
                {getFormatBadge(item)}
              </div>
              <div className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5">
                {formatBytes(item.originalSize)}
              </div>
            </div>
          </div>

          {/* Format & Target Size */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono">
            {/* Format selection */}
            {(item.category === 'image' || item.category === 'svg') && item.status !== 'completed' && (
              <select
                value={item.outputFormat || 'original'}
                onChange={(e) => onUpdateItem(item.id, { outputFormat: e.target.value as OutputFormat })}
                className="rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none border transition cursor-pointer
                  bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500
                  dark:bg-[#14161a] dark:border-[#232730] dark:text-zinc-300 dark:focus:border-blue-500"
              >
                <option value="original">Original</option>
                <option value="image/webp">WebP</option>
                <option value="image/avif">AVIF</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
                <option value="application/pdf">PDF</option>
              </select>
            )}

            {/* Target size indicator */}
            {item.status !== 'completed' ? (
              <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border
                bg-slate-100 border-slate-200 text-slate-600
                dark:bg-[#14161a] dark:border-[#232730] dark:text-zinc-400"
              >
                <span>Target:</span>
                <strong className="text-slate-900 dark:text-zinc-200">{formatBytes(item.targetSize)}</strong>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{item.compressedSize ? formatBytes(item.compressedSize) : ''}</span>
                {item.savingsPercent !== undefined && (
                  <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-semibold">
                    -{item.savingsPercent}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            {item.status === 'compressing' && (
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-mono text-[11px] font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{item.progress}%</span>
              </span>
            )}

            {item.status === 'error' && (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 text-[11px]" title={item.errorMessage}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Failed</span>
              </span>
            )}

            {item.status !== 'completed' ? (
              <button
                onClick={() => onCompress(item.id)}
                disabled={item.status === 'compressing'}
                className="px-3.5 py-1 rounded-lg font-semibold text-xs transition cursor-pointer disabled:opacity-40 shadow-xs
                  bg-slate-900 hover:bg-slate-800 text-white
                  dark:bg-zinc-200 dark:hover:bg-white dark:text-zinc-950"
              >
                Compress
              </button>
            ) : (
              <>
                {item.category === 'image' && (
                  <>
                    <button
                      onClick={() => onPreview(item)}
                      className="p-1.5 rounded-lg transition cursor-pointer border
                        border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800
                        dark:hover:bg-[#1c1f26] dark:text-zinc-400 dark:hover:text-zinc-200"
                      title="Compare visual quality"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-1.5 rounded-lg transition cursor-pointer border
                        border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800
                        dark:hover:bg-[#1c1f26] dark:text-zinc-400 dark:hover:text-zinc-200"
                      title="Copy to clipboard"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                <button
                  onClick={() => onCompress(item.id)}
                  className="p-1.5 rounded-lg transition cursor-pointer border
                    border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800
                    dark:hover:bg-[#1c1f26] dark:text-zinc-400 dark:hover:text-zinc-200"
                  title="Re-compress"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    if (item.compressedBlob) {
                      downloadFile(item.compressedBlob, item.name, item.outputFormat);
                    }
                  }}
                  className="p-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1 transition shadow-xs cursor-pointer"
                  title="Download file"
                >
                  <Download className="w-3 h-3" />
                  <span>Get</span>
                </button>
              </>
            )}

            <button
              onClick={() => onRemove(item.id)}
              className="p-1.5 rounded-lg transition cursor-pointer
                text-slate-400 hover:text-slate-700 hover:bg-slate-100
                dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-[#1c1f26]"
              title="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
