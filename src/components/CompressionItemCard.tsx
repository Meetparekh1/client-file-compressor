import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileType,
  Download,
  Eye,
  X,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  ChevronDown,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { formatBytes, parseBytes, downloadFile } from '../lib/utils';
import type { FileItem, TargetMode, OutputFormat } from '../lib/types';

interface CompressionItemCardProps {
  item: FileItem;
  onUpdateTarget: (id: string, targetBytes: number, mode: TargetMode, percentage: number) => void;
  onUpdateItem: (id: string, updates: Partial<FileItem>) => void;
  onCompress: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (item: FileItem) => void;
}

export const CompressionItemCard: React.FC<CompressionItemCardProps> = ({
  item,
  onUpdateTarget,
  onUpdateItem,
  onCompress,
  onRemove,
  onPreview,
}) => {
  const initialUnit = item.targetSize >= 1024 * 1024 ? 'MB' : 'KB';
  const initialNum =
    initialUnit === 'MB'
      ? parseFloat((item.targetSize / (1024 * 1024)).toFixed(2))
      : Math.round(item.targetSize / 1024);

  const [inputVal, setInputVal] = useState<string>(initialNum.toString());
  const [unit, setUnit] = useState<'MB' | 'KB'>(initialUnit);
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyImage = async () => {
    if (!item.compressedBlob) return;
    try {
      let blobToCopy = item.compressedBlob;
      if (blobToCopy.type !== 'image/png') {
        const bmp = await createImageBitmap(blobToCopy);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d');
        ctx?.drawImage(bmp, 0, 0);
        blobToCopy = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobToCopy }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore if clipboard permissions are restricted
    }
  };

  // Sync input value when targetSize changes externally
  useEffect(() => {
    const currentUnit = item.targetSize >= 1024 * 1024 ? 'MB' : 'KB';
    const num =
      currentUnit === 'MB'
        ? parseFloat((item.targetSize / (1024 * 1024)).toFixed(2))
        : Math.round(item.targetSize / 1024);
    setInputVal(num.toString());
    setUnit(currentUnit);
  }, [item.targetSize]);

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

  const handlePreset = (bytes: number) => {
    if (bytes >= item.originalSize) return;
    const isMB = bytes >= 1024 * 1024;
    setUnit(isMB ? 'MB' : 'KB');
    setInputVal(isMB ? (bytes / (1024 * 1024)).toString() : Math.round(bytes / 1024).toString());
    onUpdateTarget(item.id, bytes, 'target_size', item.targetPercentage);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bytes = Number(e.target.value);
    const currentUnit = bytes >= 1024 * 1024 ? 'MB' : 'KB';
    const num =
      currentUnit === 'MB'
        ? parseFloat((bytes / (1024 * 1024)).toFixed(2))
        : Math.round(bytes / 1024);
    setInputVal(num.toString());
    setUnit(currentUnit);
    onUpdateTarget(item.id, bytes, 'target_size', item.targetPercentage);
  };

  const handlePercentageChange = (pct: number) => {
    const targetBytes = Math.round(item.originalSize * (1 - pct / 100));
    onUpdateTarget(item.id, targetBytes, 'percentage', pct);
  };

  const handleRotate = () => {
    const currentRot = item.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    onUpdateItem(item.id, { rotation: nextRot });
  };

  const getCategoryBadge = () => {
    switch (item.category) {
      case 'image':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">IMG</span>;
      case 'pdf':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">PDF</span>;
      case 'docx':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">DOCX</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400">FILE</span>;
    }
  };

  return (
    <div className="bg-[#0e1013] border border-[#21242b] hover:border-[#2d313a] rounded-xl p-4 sm:p-5 transition-colors flex flex-col justify-between">
      <div>
        {/* Header: File info & remove */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Thumbnail with live rotation preview */}
            <div className="w-12 h-12 rounded-lg bg-[#16181d] border border-[#262932] flex items-center justify-center shrink-0 overflow-hidden relative group/thumb">
              {item.originalPreviewUrl ? (
                <img
                  src={item.originalPreviewUrl}
                  alt={item.name}
                  style={{
                    transform: `rotate(${item.rotation || 0}deg)`,
                    transition: 'transform 0.2s ease',
                  }}
                  className="w-full h-full object-cover"
                />
              ) : item.category === 'pdf' ? (
                <FileText className="w-5 h-5 text-rose-400" />
              ) : item.category === 'docx' ? (
                <FileType className="w-5 h-5 text-amber-400" />
              ) : (
                <ImageIcon className="w-5 h-5 text-zinc-400" />
              )}

              {/* Quick rotate overlay on hover for images */}
              {item.category === 'image' && item.status !== 'compressing' && (
                <button
                  type="button"
                  onClick={handleRotate}
                  title="Rotate 90° clockwise"
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-zinc-200 text-sm truncate max-w-[180px] sm:max-w-[240px]" title={item.name}>
                  {item.name}
                </h4>
                {getCategoryBadge()}
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400 font-mono">
                <span>{formatBytes(item.originalSize)}</span>
                {item.dimensions && (
                  <span className="text-zinc-500">
                    · {item.dimensions.originalWidth}×{item.dimensions.originalHeight}px
                  </span>
                )}
                {item.rotation ? (
                  <span className="text-blue-400 text-[10px]">· ↻ {item.rotation}°</span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded-md hover:bg-[#1b1e24] transition shrink-0"
            title="Remove from queue"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Sizing Controls (When pending) */}
        {item.status !== 'completed' && (
          <div className="space-y-3 pt-3 border-t border-[#1c1f25] mb-4">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-medium font-mono">
                Target Output
              </span>

              <div className="flex rounded-md bg-[#14161a] p-0.5 border border-[#22252c]">
                <button
                  type="button"
                  onClick={() => onUpdateTarget(item.id, item.targetSize, 'target_size', item.targetPercentage)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    item.targetMode === 'target_size'
                      ? 'bg-zinc-200 text-zinc-900 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Exact Size
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateTarget(item.id, item.targetSize, 'percentage', item.targetPercentage)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    item.targetMode === 'percentage'
                      ? 'bg-zinc-200 text-zinc-900 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Percentage
                </button>
              </div>
            </div>

            {item.targetMode === 'target_size' ? (
              <div className="space-y-2.5">
                {/* Numeric input and unit */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={inputVal}
                      onChange={handleInputChange}
                      disabled={item.status === 'compressing'}
                      className="w-full bg-[#14161a] border border-[#242730] focus:border-blue-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 font-mono focus:outline-none transition"
                    />
                  </div>

                  <div className="flex rounded-lg bg-[#14161a] border border-[#242730] p-0.5">
                    <button
                      type="button"
                      onClick={() => handleUnitChange('MB')}
                      className={`px-2.5 py-1 text-xs font-mono font-medium rounded ${
                        unit === 'MB' ? 'bg-[#272b33] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      MB
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitChange('KB')}
                      className={`px-2.5 py-1 text-xs font-mono font-medium rounded ${
                        unit === 'KB' ? 'bg-[#272b33] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      KB
                    </button>
                  </div>
                </div>

                {/* Range Slider for target size */}
                <div className="pt-1">
                  <input
                    type="range"
                    min={Math.min(50 * 1024, Math.round(item.originalSize * 0.05))}
                    max={item.originalSize}
                    step={10 * 1024}
                    value={item.targetSize}
                    onChange={handleSliderChange}
                    disabled={item.status === 'compressing'}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-1">
                    <span>min</span>
                    <span>target: {formatBytes(item.targetSize)}</span>
                    <span>orig</span>
                  </div>
                </div>

                {/* Real-World Quick Presets (Portal, Email, Discord) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-mono text-zinc-400 mr-0.5">Presets:</span>
                  {[
                    { label: '100KB', bytes: 100 * 1024 },
                    { label: '200KB', bytes: 200 * 1024 },
                    { label: '500KB', bytes: 500 * 1024 },
                    { label: '1MB', bytes: 1024 * 1024 },
                    { label: '2MB', bytes: 2 * 1024 * 1024 },
                    { label: '8MB', bytes: 8 * 1024 * 1024 },
                  ].map((preset) => {
                    if (preset.bytes >= item.originalSize) return null;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePreset(preset.bytes)}
                        className="px-2 py-0.5 rounded bg-[#16181d] hover:bg-[#20232a] border border-[#262932] text-zinc-300 hover:text-white text-[11px] font-mono transition"
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Percentage Slider */
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Reduce by:</span>
                  <span className="text-zinc-200 font-semibold">
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
                  className="w-full"
                />
              </div>
            )}

            {/* Advanced Transforms Accordion (Format, Dimension & Rotation) */}
            {item.category === 'image' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
                  className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Format & Resolution Options</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
                </button>

                {showOptions && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#14161a] border border-[#232730] space-y-2.5 text-xs">
                    {/* Format conversion selector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400 text-[11px] font-mono">Convert format:</span>
                      <select
                        value={item.outputFormat || 'original'}
                        onChange={(e) => onUpdateItem(item.id, { outputFormat: e.target.value as OutputFormat })}
                        className="bg-[#1a1c22] border border-[#292d37] text-zinc-200 text-[11px] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500"
                      >
                        <option value="original">Keep Original</option>
                        <option value="image/webp">WebP (Best Size)</option>
                        <option value="image/jpeg">JPEG</option>
                        <option value="image/png">PNG</option>
                      </select>
                    </div>

                    {/* Max dimension scaling */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400 text-[11px] font-mono">Max resolution:</span>
                      <select
                        value={item.maxWidth || ''}
                        onChange={(e) => onUpdateItem(item.id, { maxWidth: e.target.value ? Number(e.target.value) : undefined })}
                        className="bg-[#1a1c22] border border-[#292d37] text-zinc-200 text-[11px] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Original</option>
                        <option value="1920">Max 1920px (FHD)</option>
                        <option value="1280">Max 1280px (HD)</option>
                        <option value="800">Max 800px (Web)</option>
                      </select>
                    </div>

                    {/* Quick rotate button */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1f2229]">
                      <span className="text-zinc-400 text-[11px] font-mono">Rotate:</span>
                      <button
                        type="button"
                        onClick={handleRotate}
                        className="px-2 py-0.5 rounded bg-[#1c1f26] hover:bg-[#252933] text-zinc-300 text-[11px] font-mono flex items-center gap-1 transition"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Rotate 90° ({item.rotation || 0}°)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Compression Progress Bar */}
        {item.status === 'compressing' && (
          <div className="space-y-2 py-3 border-t border-[#1c1f25] mb-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-blue-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Processing...
              </span>
              <span className="text-zinc-400">{item.progress}%</span>
            </div>
            <div className="w-full h-1 bg-[#1a1c22] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {item.status === 'error' && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{item.errorMessage || 'An error occurred during compression.'}</span>
          </div>
        )}

        {/* Completed Results */}
        {item.status === 'completed' && item.compressedSize && (
          <div className="p-3.5 rounded-lg bg-[#14161a] border border-[#23272f] mb-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-mono">Output:</span>
                <span className="text-sm font-semibold font-mono text-emerald-400">
                  {formatBytes(item.compressedSize)}
                </span>
              </div>
              {item.savingsPercent !== undefined && (
                <span className="text-xs font-mono font-medium text-emerald-400">
                  -{item.savingsPercent}% saved
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1.5 border-t border-[#1f2229]">
              <span>Target accuracy: <strong className="text-zinc-300">{item.accuracy}%</strong></span>
              {item.iterations ? <span>{item.iterations} steps</span> : null}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Trigger */}
      <div>
        {item.status !== 'completed' ? (
          <button
            onClick={() => onCompress(item.id)}
            disabled={item.status === 'compressing'}
            className="w-full py-2 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {item.status === 'compressing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Compressing...</span>
              </>
            ) : (
              <span>Compress to ~{formatBytes(item.targetSize)}</span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {item.category === 'image' && (
              <>
                <button
                  onClick={() => onPreview(item)}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-[#181a20] hover:bg-[#20232a] border border-[#272b33] text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Compare</span>
                </button>
                <button
                  onClick={handleCopyImage}
                  className="py-2 px-2.5 rounded-lg bg-[#181a20] hover:bg-[#20232a] border border-[#272b33] text-zinc-300 text-xs font-medium flex items-center justify-center gap-1 transition"
                  title="Copy compressed image to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                  <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </>
            )}

            <button
              onClick={() => onCompress(item.id)}
              className="py-2 px-2.5 rounded-lg bg-[#181a20] hover:bg-[#20232a] border border-[#272b33] text-zinc-400 hover:text-zinc-200 text-xs transition"
              title="Re-compress with new settings"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                if (item.compressedBlob) {
                  downloadFile(item.compressedBlob, item.name, item.outputFormat);
                }
              }}
              className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
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
