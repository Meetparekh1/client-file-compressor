import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  ChevronUp, 
  LayoutGrid, 
  Search, 
  Heart,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { TOOLS_REGISTRY, type ToolCategory, type ToolDefinition } from '../lib/toolsRegistry';
import { ToolCard } from './ToolCard';
import { getFavorites, toggleFavorite, subscribeFavorites } from '../lib/favoritesStore';
import { getHistoryEntries, getHistoryBlob, subscribeHistory, type HistoryItem } from '../lib/historyStore';
import { formatBytes, sanitizeFilename } from '../lib/utils';
import { saveAs } from 'file-saver';

interface DashboardProps {
  onSelectTool: (toolId: string) => void;
  selectedCategory: ToolCategory;
  onSelectCategory: (cat: ToolCategory) => void;
  onQuickUpload: (files: File[]) => void;
  onOpenFile?: (file: File, toolId?: string) => void;
  onPreviewBlob?: (blob: Blob, name: string) => void;
  onToast: (msg: string, type: 'info' | 'success' | 'error') => void;
  searchQuery?: string;
  onToggleShowAllTools?: (expanded: boolean) => void;
}

type FilterId = 'popular' | 'pages' | 'convert' | 'organize' | 'edit' | 'signatures' | 'all' | 'favorites';

interface FilterTab {
  id: FilterId;
  label: string;
  category?: ToolCategory;
}

const CATEGORY_TABS: FilterTab[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'pages', label: 'PDF Tools', category: 'pages' },
  { id: 'convert', label: 'Converters', category: 'convert' },
  { id: 'organize', label: 'Organize', category: 'organize' },
  { id: 'edit', label: 'Edit & Modify', category: 'edit' },
  { id: 'signatures', label: 'Security', category: 'signatures' },
  { id: 'all', label: 'All Tools', category: 'all' },
];

const POPULAR_TOOL_IDS = [
  'compress-pdf',
  'merge-pdf',
  'split-pdf',
  'pdf-to-word',
  'word-to-pdf',
  'pdf-to-images',
];

// Rich, solid saturated colors exactly matching target screenshot
const POPULAR_TOOL_OVERRIDES: Record<string, Partial<ToolDefinition>> = {
  'compress-pdf': {
    name: 'Compress PDF',
    title: 'Compress PDF',
    description: 'Reduce file size without losing quality.',
    iconBgColor: 'bg-[#ff4d4f] text-white border-transparent',
    iconDarkBgColor: 'dark:bg-[#ff4d4f] dark:text-white',
  },
  'merge-pdf': {
    name: 'Merge PDFs',
    title: 'Merge PDFs',
    description: 'Combine multiple PDFs into one file.',
    iconBgColor: 'bg-[#2f54eb] text-white border-transparent',
    iconDarkBgColor: 'dark:bg-[#2f54eb] dark:text-white',
  },
  'split-pdf': {
    name: 'Split PDF',
    title: 'Split PDF',
    description: 'Extract specific pages or split into multiple files.',
    iconBgColor: 'bg-[#722ed1] text-white border-transparent',
    iconDarkBgColor: 'dark:bg-[#722ed1] dark:text-white',
  },
  'pdf-to-word': {
    name: 'PDF to Word',
    title: 'PDF to Word',
    description: 'Convert PDF to editable Word (DOCX).',
    iconBgColor: 'bg-[#1890ff] text-white border-transparent',
    iconDarkBgColor: 'dark:bg-[#1890ff] dark:text-white',
  },
  'word-to-pdf': {
    name: 'Word to PDF',
    title: 'Word to PDF',
    description: 'Convert Word documents to high-quality PDF.',
    iconBgColor: 'bg-[#fa8c16] text-white border-transparent',
    iconDarkBgColor: 'dark:bg-[#fa8c16] dark:text-white',
  },
  'pdf-to-images': {
    name: 'PDF to Images',
    title: 'PDF to Images',
    description: 'Convert PDF pages to images (PNG, JPG, etc.).',
    iconBgColor: 'bg-[#52c41a] text-white border-transparent',
    iconDarkBgColor: 'dark:bg-[#52c41a] dark:text-white',
  },
};

const CATEGORY_HEADERS: Record<FilterId, { title: string; subtitle: string }> = {
  popular: {
    title: 'Popular Tools',
    subtitle: "The tools you'll use most, right at your fingertips.",
  },
  pages: {
    title: 'PDF Tools',
    subtitle: 'Extract, split, rotate, and manage PDF pages.',
  },
  convert: {
    title: 'Converters',
    subtitle: 'High-speed conversion between PDF, Word, images, and text formats.',
  },
  organize: {
    title: 'Organize',
    subtitle: 'Rearrange, merge, and organize pages and multi-file workflows.',
  },
  edit: {
    title: 'Edit & Modify',
    subtitle: 'Add annotations, page numbers, text, or compress and protect documents.',
  },
  signatures: {
    title: 'Security',
    subtitle: 'Digitally sign, protect, and watermark your files locally.',
  },
  all: {
    title: 'All Tools',
    subtitle: 'Browse all powerful local and cloud-assisted document tools.',
  },
  favorites: {
    title: 'Favorite Tools',
    subtitle: 'Your personal pinned shortcuts for quick access.',
  },
};

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectTool,
  selectedCategory,
  onSelectCategory,
  onOpenFile,
  onPreviewBlob,
  onToast,
  searchQuery: externalSearchQuery,
  onToggleShowAllTools,
}) => {
  const [internalSearchQuery] = useState('');
  const [showAllTools, setShowAllTools] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(getFavorites);
  const [recentFiles, setRecentFiles] = useState<HistoryItem[]>([]);
  
  const [activeFilter, setActiveFilter] = useState<FilterId>(() => {
    if ((selectedCategory as string) === 'favorites') {
      return 'favorites';
    }
    if (selectedCategory && selectedCategory !== 'all') {
      return selectedCategory;
    }
    return 'popular';
  });

  const prevPropCategory = useRef(selectedCategory);

  const handleSetShowAllTools = (expanded: boolean) => {
    setShowAllTools(expanded);
    onToggleShowAllTools?.(expanded);
  };

  // Sync favorites reactively
  useEffect(() => {
    const unsub = subscribeFavorites(() => {
      setFavoriteIds(getFavorites());
    });
    return unsub;
  }, []);

  // Sync recent files from cache/historyStore
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const records = await getHistoryEntries();
        setRecentFiles(records.slice(0, 4));
      } catch {
        // ignore
      }
    };
    loadRecent();
    const unsub = subscribeHistory(loadRecent);
    return unsub;
  }, []);

  // Sync with prop changes if sidebar selects a category or favorites
  useEffect(() => {
    if (selectedCategory !== prevPropCategory.current) {
      prevPropCategory.current = selectedCategory;
      if ((selectedCategory as string) === 'favorites') {
        setActiveFilter('favorites');
      } else if (selectedCategory === 'all') {
        setActiveFilter('all');
      } else {
        setActiveFilter(selectedCategory);
      }
      setShowAllTools(false);
      onToggleShowAllTools?.(false);
    }
  }, [selectedCategory, onToggleShowAllTools]);

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;

  const handleTabClick = (tab: FilterTab) => {
    setActiveFilter(tab.id);
    setShowAllTools(false);
    onToggleShowAllTools?.(false);
    if (tab.category) {
      onSelectCategory(tab.category);
    } else {
      onSelectCategory('all');
    }
  };

  const handleToggleFavorite = (toolId: string) => {
    const isNowFav = toggleFavorite(toolId);
    if (onToast) {
      const tool = TOOLS_REGISTRY.find((t) => t.id === toolId);
      onToast(
        isNowFav 
          ? `Added "${tool?.name || toolId}" to Favorites` 
          : `Removed "${tool?.name || toolId}" from Favorites`,
        'info'
      );
    }
  };

  const handleDownloadRecent = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await getHistoryBlob(item.id);
      if (!blob) {
        onToast?.('Cached file is no longer available.', 'error');
        return;
      }
      const filename = sanitizeFilename(item.resultFileName || item.fileName);
      saveAs(blob, filename);
      onToast?.(`Downloaded ${filename}`, 'success');
    } catch {
      onToast?.('Failed to download cached file.', 'error');
    }
  };

  const handleReopenRecent = async (item: HistoryItem) => {
    try {
      const blob = await getHistoryBlob(item.id);
      if (!blob) {
        onToast?.('Cached file is no longer available.', 'error');
        return;
      }
      const file = new File([blob], item.resultFileName || item.fileName, { type: blob.type || 'application/pdf' });
      if (onOpenFile) {
        onOpenFile(file, item.toolId);
      } else if (onPreviewBlob) {
        onPreviewBlob(blob, item.fileName);
      }
    } catch {
      onToast?.('Failed to reopen cached file.', 'error');
    }
  };

  // Determine tools to display
  let displayedTools: ToolDefinition[] = [];

  if (activeFilter === 'favorites') {
    displayedTools = TOOLS_REGISTRY.filter((t) => favoriteIds.includes(t.id));
  } else if (activeFilter === 'popular') {
    if (!showAllTools) {
      displayedTools = POPULAR_TOOL_IDS
        .map((id) => {
          const tool = TOOLS_REGISTRY.find((t) => t.id === id);
          if (!tool) return null;
          const override = POPULAR_TOOL_OVERRIDES[id];
          return override ? { ...tool, ...override } : tool;
        })
        .filter((t): t is ToolDefinition => t !== null);
    } else {
      displayedTools = TOOLS_REGISTRY;
    }
  } else if (activeFilter === 'all') {
    displayedTools = TOOLS_REGISTRY;
  } else {
    displayedTools = TOOLS_REGISTRY.filter((t) => t.category === activeFilter);
  }

  // Filter tools by search query if active
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    displayedTools = displayedTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
    );
  }

  const currentHeader =
    activeFilter === 'popular' && showAllTools
      ? {
          title: 'All Tools',
          subtitle: `Browse the complete collection of ${TOOLS_REGISTRY.length} document tools.`,
        }
      : CATEGORY_HEADERS[activeFilter] || CATEGORY_HEADERS.popular;

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto pb-8">
      {/* Dynamic Stagger Animation Styles */}
      <style>{`
        @keyframes toolCardEnter {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .tool-card-stagger {
          opacity: 0;
          animation: toolCardEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: opacity, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .tool-card-stagger {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Hero Section matching screenshot - Compact so all 6 popular cards fit on initial viewport */}
      <div className="space-y-2 pt-0.5 sm:pt-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>Local • Private • Fast</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[38px] font-black text-stone-900 dark:text-white tracking-tight leading-tight">
          Your Document Tools,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 dark:from-orange-400 dark:via-rose-400 dark:to-violet-400">
            Simplified.
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 max-w-2xl leading-normal">
          Powerful PDF and document tools, built for speed, privacy, and ease of use. No watermarks. No unnecessary uploads. Just tools that work.
        </p>
      </div>

      {/* Category Filter Pills matching screenshot */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1e232f] text-white shadow-xs dark:bg-white dark:text-stone-950 font-bold'
                  : 'bg-white dark:bg-[#131823] border border-stone-200/90 dark:border-[#202736] text-stone-600 dark:text-zinc-400 hover:bg-stone-50 hover:text-stone-900 dark:hover:bg-[#1a2130] dark:hover:text-zinc-200 shadow-2xs'
              }`}
            >
              {tab.label}
            </button>
          );
        })}

        {/* Dynamic Favorites Filter Pill if any favorites exist */}
        {favoriteIds.length > 0 && (
          <button
            onClick={() => {
              setActiveFilter('favorites');
              setShowAllTools(false);
              onToggleShowAllTools?.(false);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'favorites'
                ? 'bg-[#1e232f] text-white shadow-xs dark:bg-white dark:text-stone-950 font-bold'
                : 'bg-white dark:bg-[#131823] border border-stone-200/90 dark:border-[#202736] text-stone-600 dark:text-zinc-400 hover:bg-stone-50 hover:text-stone-900 dark:hover:bg-[#1a2130] dark:hover:text-zinc-200 shadow-2xs'
            }`}
          >
            <Heart className={`w-3 h-3 ${activeFilter === 'favorites' ? 'text-rose-500 fill-rose-500' : 'text-rose-500'}`} />
            <span>Favorites ({favoriteIds.length})</span>
          </button>
        )}
      </div>

      {/* Active Section Header */}
      <div className="space-y-0.5">
        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
          {currentHeader.title}
        </h2>
        <p className="text-xs text-stone-500 dark:text-zinc-400">
          {currentHeader.subtitle}
        </p>
      </div>

      {/* Tool Cards Grid - 3 cols for initial 6 popular cards, 4 cols for All Tools / Expanded */}
      <div>
        <div className={`grid gap-3.5 sm:gap-4 ${
          activeFilter === 'popular' && !showAllTools
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4'
        }`}>
          {displayedTools.map((tool, index) => (
            <div
              key={tool.id}
              className="tool-card-stagger flex flex-col h-full"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ToolCard
                tool={tool}
                onSelect={onSelectTool}
                isFavorited={favoriteIds.includes(tool.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          ))}
        </div>

        {/* Empty State when no tools match */}
        {displayedTools.length === 0 && (
          <div className="py-16 text-center text-stone-400 dark:text-zinc-500 space-y-3 rounded-2xl border border-dashed border-stone-200 dark:border-[#202736] p-8 bg-white/50 dark:bg-[#131823]/50">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800/50 flex items-center justify-center mx-auto text-stone-400 dark:text-stone-500">
              {activeFilter === 'favorites' ? <Heart className="w-5 h-5 text-rose-500" /> : <Search className="w-5 h-5" />}
            </div>
            <p className="text-sm font-semibold text-stone-700 dark:text-zinc-300">
              {activeFilter === 'favorites' 
                ? 'No favorite tools pinned yet' 
                : 'No tools found matching your criteria'}
            </p>
            <p className="text-xs text-stone-500 dark:text-zinc-500 max-w-sm mx-auto">
              {activeFilter === 'favorites'
                ? 'Click the heart icon on any tool card to pin it here for quick access.'
                : 'Try selecting another category or check back on "Popular Tools".'}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveFilter('popular');
                setShowAllTools(false);
                onSelectCategory('all');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
            >
              Reset to Popular Tools
            </button>
          </div>
        )}
      </div>

      {/* Show All Tools / Show Popular Tools Expansion Card (Active when in Popular tab) */}
      {activeFilter === 'popular' && (
        <div className="pt-2">
          {!showAllTools ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSetShowAllTools(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSetShowAllTools(true);
                }
              }}
              className="group relative w-full text-left rounded-2xl p-5 sm:p-6 border-2 border-dashed
                border-blue-300/90 hover:border-blue-500 bg-white hover:bg-blue-50/20
                dark:border-blue-500/40 dark:hover:border-blue-400 dark:bg-[#131823] dark:hover:bg-blue-950/20
                transition-all duration-300 cursor-pointer shadow-2xs hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0
                    bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50
                    group-hover:scale-105 transition-transform duration-200">
                    <LayoutGrid className="w-6 h-6" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Show All Tools
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                        bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        20+ Tools
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      Explore the complete collection of document tools.
                    </p>
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[#f0f5ff] text-[#2563eb] dark:bg-[#1a2538] dark:text-[#38bdf8]
                    flex items-center justify-center group-hover:bg-[#2563eb] group-hover:text-white dark:group-hover:bg-[#2563eb] dark:group-hover:text-white
                    transition-all duration-200 shadow-2xs group-hover:translate-x-1">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSetShowAllTools(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSetShowAllTools(false);
                }
              }}
              className="group relative w-full text-left rounded-2xl p-4 sm:p-5 border
                border-stone-200/90 dark:border-[#202736] bg-white hover:bg-stone-50
                dark:bg-[#131823] dark:hover:bg-[#181f2d]
                transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-zinc-300">
                    <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                      Show Popular Tools
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                      Show Less • Collapse the tools catalog back to the 6 featured tools.
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                  Collapse
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Files Section (Stored in Browser Cache / IndexedDB) */}
      {recentFiles.length > 0 && (
        <div className="pt-2">
          <div className="rounded-2xl p-4 sm:p-5 bg-white dark:bg-[#131823] border border-stone-200/90 dark:border-[#202736] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  Recent Files in Browser Cache
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-[#1c2331] text-stone-500 dark:text-zinc-400">
                  {recentFiles.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectTool('history')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                View All History
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {recentFiles.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleReopenRecent(item)}
                  className="p-2.5 rounded-xl bg-stone-50/80 dark:bg-[#181f2c]/80 border border-stone-200/60 dark:border-white/5 hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {item.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {item.fileName}
                      </p>
                      <p className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
                        {formatBytes(item.resultSize || item.fileSize)} • {item.toolName}
                      </p>
                    </div>
                  </div>

                  {item.hasBlob && (
                    <button
                      type="button"
                      onClick={(e) => handleDownloadRecent(item, e)}
                      className="p-1 rounded-lg text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-stone-200/50 dark:hover:bg-white/10 shrink-0"
                      title="Download cached file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
