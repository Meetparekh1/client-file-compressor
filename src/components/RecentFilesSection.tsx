import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Trash2, 
  Download, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { 
  getHistoryEntries, 
  deleteHistoryEntry, 
  clearAllHistory, 
  getHistoryBlob, 
  subscribeHistory,
  type HistoryItem 
} from '../lib/historyStore';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { saveAs } from 'file-saver';

function formatTimeAgo(ts: number): string {
  const elapsed = Math.floor((Date.now() - ts) / 1000);
  if (elapsed < 60) return 'Just now';
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

interface RecentFilesSectionProps {
  onOpenFile?: (file: File, toolId?: string) => void;
  onPreviewBlob?: (blob: Blob, name: string) => void;
  onSelectTool?: (toolId: string) => void;
  onToast: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export const RecentFilesSection: React.FC<RecentFilesSectionProps> = ({
  onOpenFile,
  onPreviewBlob,
  onSelectTool,
  onToast,
}) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'failed'>('all');

  const loadData = async () => {
    try {
      const records = await getHistoryEntries();
      setItems(records);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeHistory(loadData);
    return () => unsubscribe();
  }, []);

  const handleDownload = async (item: HistoryItem) => {
    try {
      const blob = await getHistoryBlob(item.id);
      if (!blob) {
        onToast('The cached file content is no longer available.', 'error');
        return;
      }
      const filename = sanitizeFilename(item.resultFileName || item.fileName);
      saveAs(blob, filename);
      onToast(`Downloaded ${filename}`, 'success');
    } catch {
      onToast('Failed to download file from local cache.', 'error');
    }
  };

  const handleReopen = async (item: HistoryItem) => {
    try {
      const blob = await getHistoryBlob(item.id);
      if (!blob) {
        onToast('The cached file content is no longer available.', 'error');
        return;
      }
      const file = new File([blob], item.resultFileName || item.fileName, { type: blob.type || 'application/pdf' });
      if (onOpenFile) {
        onOpenFile(file, item.toolId);
      } else if (onPreviewBlob) {
        onPreviewBlob(blob, item.fileName);
      }
    } catch {
      onToast('Failed to reopen file.', 'error');
    }
  };

  const handlePreview = async (item: HistoryItem) => {
    try {
      const blob = await getHistoryBlob(item.id);
      if (!blob) {
        onToast('The cached file is not available for preview.', 'error');
        return;
      }
      if (onPreviewBlob) {
        onPreviewBlob(blob, item.resultFileName || item.fileName);
      }
    } catch {
      onToast('Could not preview file.', 'error');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteHistoryEntry(id);
    onToast('History item removed.', 'info');
  };

  const handleClear = async () => {
    if (confirm('Clear all recent files and temporary processing history? File records stored locally will be permanently removed.')) {
      await clearAllHistory();
      onToast('Recent files & history cleared.', 'success');
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'completed') return item.status === 'completed';
    if (activeTab === 'failed') return item.status === 'failed';
    return true;
  });

  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-[#12161f]/80 backdrop-blur-md border border-stone-200/80 dark:border-[#202735] rounded-3xl p-12 shadow-xs flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-zinc-400 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
        <span>Loading recent files...</span>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-[#12161f]/80 backdrop-blur-md border border-stone-200/80 dark:border-[#202735] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/60 dark:border-[#202735] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              Recent Files &amp; Processing History
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-[#1d2330] text-stone-600 dark:text-zinc-400">
                {items.length}
              </span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              100% on-device private history. Reopen files, view status, and download cached outputs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex items-center p-0.5 rounded-xl bg-stone-100 dark:bg-[#181d28] border border-stone-200 dark:border-[#242c3d] text-xs font-medium">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#202636] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-white dark:bg-[#202636] text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'failed'
                  ? 'bg-white dark:bg-[#202636] text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
              }`}
            >
              Errors
            </button>
          </div>

          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-stone-200 dark:border-[#202735] transition cursor-pointer"
            title="Clear all recent files & free local resources"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear History</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-stone-100 dark:bg-[#1a202c] text-stone-400 dark:text-zinc-500 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-800 dark:text-zinc-200">No Recent Files Yet</p>
            <p className="text-xs text-stone-500 dark:text-zinc-400 max-w-sm mx-auto">
              Your processed, converted, or compressed files will appear here for fast access and re-download. All processing stays 100% on-device and private.
            </p>
            <button
              type="button"
              onClick={() => onSelectTool?.('dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
            >
              Explore Tools
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-stone-400 dark:text-zinc-500">
            No history records matching this filter.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50/70 dark:bg-[#171c26]/70 border border-stone-200/60 dark:border-[#222837] hover:border-indigo-400/50 transition-all text-xs"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="shrink-0 mt-0.5 sm:mt-0">
                  {item.status === 'completed' ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : item.status === 'failed' ? (
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-stone-900 dark:text-white truncate max-w-xs sm:max-w-md">
                      {item.fileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectTool?.(item.toolId)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-[#202735] text-stone-700 dark:text-zinc-300 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition cursor-pointer"
                    >
                      {item.toolName}
                    </button>
                    <span className="text-[10px] font-mono text-stone-400 dark:text-zinc-500">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500 dark:text-zinc-400 font-mono">
                    <span>Input: {formatBytes(item.fileSize)}</span>
                    {item.resultSize && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Output: {formatBytes(item.resultSize)}
                        </span>
                      </>
                    )}
                    {item.pageCount && (
                      <>
                        <span>•</span>
                        <span>{item.pageCount} page(s)</span>
                      </>
                    )}
                  </div>

                  {item.errorMessage && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10">
                      Error: {item.errorMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {item.hasBlob && (
                  <>
                    <button
                      onClick={() => handlePreview(item)}
                      title="Preview Document"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-medium bg-white dark:bg-[#1e2432] text-stone-700 dark:text-zinc-200 border border-stone-200 dark:border-[#2a3346] hover:bg-stone-100 transition cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden md:inline">Preview</span>
                    </button>

                    <button
                      onClick={() => handleReopen(item)}
                      title="Reopen in Tool"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 transition cursor-pointer shadow-2xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Reopen</span>
                    </button>

                    <button
                      onClick={() => handleDownload(item)}
                      title="Download file"
                      className="p-1.5 rounded-xl bg-white dark:bg-[#1e2432] text-stone-600 dark:text-zinc-300 border border-stone-200 dark:border-[#2a3346] hover:bg-stone-100 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  </>
                )}

                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  title="Remove from history"
                  className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-200/50 dark:hover:bg-[#202736] transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
