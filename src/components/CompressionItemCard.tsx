import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileType,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from 'lucide-react';
import { formatBytes, parseBytes } from '../lib/utils';
import type { FileItem, TargetMode } from '../lib/types';

interface CompressionItemCardProps {
  item: FileItem;
  onUpdateTarget: (id: string, targetBytes: number, mode: TargetMode, percentage: number) => void;
  onCompress: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (item: FileItem) => void;
}

export const CompressionItemCard: React.FC<CompressionItemCardProps> = ({
  item,
  onUpdateTarget,
  onCompress,
  onRemove,
  onPreview,
}) => {
  // Local state for exact target inputs
  const initialUnit = item.targetSize >= 1024 * 1024 ? 'MB' : 'KB';
  const initialVal =
    initialUnit === 'MB'
      ? (item.targetSize / (1024 * 1024)).toFixed(1)
      : Math.round(item.targetSize / 1024).toString();

  const [inputVal, setInputVal] = useState<string>(initialVal);
  const [unit, setUnit] = useState<'MB' | 'KB'>(initialUnit);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      const bytes = parseBytes(num, unit);
      onUpdateTarget(item.id, bytes, 'target_size', item.targetPercentage);
    }
  };

  const handleUnitChange = (newUnit: 'MB' | 'KB') => {
    setUnit(newUnit);
    const num = parseFloat(inputVal);
    if (!isNaN(num) && num > 0) {
      const bytes = parseBytes(num, newUnit);
      onUpdateTarget(item.id, bytes, 'target_size', item.targetPercentage);
    }
  };

  const handlePreset = (targetMB: number) => {
    setUnit('MB');
    setInputVal(targetMB.toString());
    const bytes = parseBytes(targetMB, 'MB');
    onUpdateTarget(item.id, bytes, 'target_size', item.targetPercentage);
  };

  const handlePercentageChange = (pct: number) => {
    const targetBytes = Math.round(item.originalSize * (1 - pct / 100));
    onUpdateTarget(item.id, targetBytes, 'percentage', pct);
  };

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'docx':
        return <FileType className="w-5 h-5 text-indigo-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all duration-200">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Thumbnail or Icon */}
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
            {item.originalPreviewUrl ? (
              <img
                src={item.originalPreviewUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              getCategoryIcon()
            )}
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-white text-sm truncate" title={item.name}>
              {item.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">
                Original: <strong className="text-slate-300">{formatBytes(item.originalSize)}</strong>
              </span>
              {item.dimensions && (
                <span className="text-[11px] text-slate-500">
                  ({item.dimensions.originalWidth}×{item.dimensions.originalHeight})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onRemove(item.id)}
          className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition shrink-0"
          title="Remove file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Target Sizing Settings (Only editable if not completed/compressing) */}
      {item.status !== 'completed' && (
        <div className="space-y-3 pt-2 border-t border-slate-800/80 mb-4">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Target File Size
            </span>

            <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => onUpdateTarget(item.id, item.targetSize, 'target_size', item.targetPercentage)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  item.targetMode === 'target_size'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Exact Size (e.g. 2MB)
              </button>
              <button
                type="button"
                onClick={() => onUpdateTarget(item.id, item.targetSize, 'percentage', item.targetPercentage)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  item.targetMode === 'percentage'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                % Reduction
              </button>
            </div>
          </div>

          {/* Exact Target Input Form */}
          {item.targetMode === 'target_size' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0.05"
                    value={inputVal}
                    onChange={handleInputChange}
                    disabled={item.status === 'compressing'}
                    placeholder="2.0"
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                    Target
                  </span>
                </div>

                {/* Unit selector */}
                <div className="flex rounded-lg bg-slate-950 border border-slate-700/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleUnitChange('MB')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      unit === 'MB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MB
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitChange('KB')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded ${
                      unit === 'KB' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    KB
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 mr-1">Quick:</span>
                {[0.5, 1, 2, 5].map((mb) => {
                  const bytes = mb * 1024 * 1024;
                  if (bytes >= item.originalSize) return null; // Don't show preset if larger than original
                  return (
                    <button
                      key={mb}
                      type="button"
                      onClick={() => handlePreset(mb)}
                      className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                    >
                      {mb} MB
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Percentage Reduction Slider */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Reduce by:</span>
                <span className="font-semibold text-indigo-400 font-mono">
                  {item.targetPercentage}% (~{formatBytes(Math.round(item.originalSize * (1 - item.targetPercentage / 100)))})
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={item.targetPercentage}
                onChange={(e) => handlePercentageChange(Number(e.target.value))}
                disabled={item.status === 'compressing'}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          )}
        </div>
      )}

      {/* Compression Progress Bar */}
      {item.status === 'compressing' && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-indigo-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Optimizing size...
            </span>
            <span className="text-slate-400 font-mono">{item.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {item.status === 'error' && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{item.errorMessage || 'An error occurred during compression.'}</span>
        </div>
      )}

      {/* Completed Results Overview */}
      {item.status === 'completed' && item.compressedSize && (
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Compressed to:</span>
              <strong className="text-emerald-300 font-semibold text-sm">
                {formatBytes(item.compressedSize)}
              </strong>
            </div>

            {item.savingsPercent !== undefined && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
                -{item.savingsPercent}%
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Target Match Accuracy:</span>
              <span className="text-amber-300 font-semibold">{item.accuracy}%</span>
            </div>

            {item.iterations && (
              <span>Converged in {item.iterations} iterations</span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        {item.status !== 'completed' ? (
          <button
            onClick={() => onCompress(item.id)}
            disabled={item.status === 'compressing'}
            className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {item.status === 'compressing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Compressing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Compress to ~{formatBytes(item.targetSize)}</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full">
            {/* Preview Before/After (Images only) */}
            {item.category === 'image' && (
              <button
                onClick={() => onPreview(item)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>Compare Quality</span>
              </button>
            )}

            {/* Re-compress */}
            <button
              onClick={() => onCompress(item.id)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
              title="Re-compress with different target"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Download */}
            <button
              onClick={() => {
                if (item.compressedBlob) {
                  const url = URL.createObjectURL(item.compressedBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `compressed_${item.name}`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
