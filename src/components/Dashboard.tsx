import React, { useState } from 'react';
import { 
  Search, 
  UploadCloud, 
  Sparkles
} from 'lucide-react';
import { TOOLS_REGISTRY, type ToolCategory } from '../lib/toolsRegistry';
import { ToolCard } from './ToolCard';

interface DashboardProps {
  onSelectTool: (toolId: string) => void;
  selectedCategory: ToolCategory;
  onSelectCategory: (cat: ToolCategory) => void;
  onQuickUpload: (files: File[]) => void;
}

const CATEGORY_TABS: { id: ToolCategory; label: string; activeColor: string }[] = [
  { id: 'all', label: 'All Tools', activeColor: 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' },
  { id: 'edit', label: 'PDF Editors', activeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800' },
  { id: 'convert', label: 'Converters', activeColor: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800' },
  { id: 'organize', label: 'Organizers', activeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' },
  { id: 'pages', label: 'Pages & Split', activeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800' },
  { id: 'signatures', label: 'Signatures', activeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' },
];

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectTool,
  selectedCategory,
  onSelectCategory,
  onQuickUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = TOOLS_REGISTRY.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || tool.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleDropzoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onQuickUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Header Row with Search & Quick Upload Pill */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Modern Frosted Search Input */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 dark:text-zinc-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools or features..."
            className="w-full pl-10 pr-12 py-2.5 text-xs sm:text-sm rounded-2xl
              bg-white/80 border border-stone-200/80 shadow-xs text-stone-900 placeholder:text-stone-400
              dark:bg-[#12161f]/80 dark:border-[#202735] dark:text-white dark:placeholder:text-zinc-500
              focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-md transition-all glass-control"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-[#1c222e] text-stone-500 dark:text-zinc-400 border border-stone-200 dark:border-white/5">
              ⌘K
            </span>
          </div>
        </div>

        {/* Quick Upload Drop Pill */}
        <label className="w-full md:w-auto flex items-center justify-center gap-3 px-5 py-2.5 rounded-2xl cursor-pointer border border-dashed transition-all
          bg-stone-50/70 border-stone-300 hover:bg-white hover:border-indigo-400 text-stone-700
          dark:bg-[#161a23]/60 dark:border-[#293244] dark:hover:bg-[#1a202c] dark:hover:border-indigo-500/80 dark:text-zinc-300 shadow-xs glass-control">
          <UploadCloud className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-bold leading-tight">Quick Compress Upload</p>
            <p className="text-[10px] text-stone-400 dark:text-zinc-500 leading-tight">Drop files to compress instantly</p>
          </div>
          <input
            type="file"
            multiple
            onChange={handleDropzoneInput}
            className="sr-only"
          />
        </label>
      </div>

      {/* Hero Section */}
      <div className="relative pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
              bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Free, Private & Zero Server Uploads</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 dark:text-white tracking-tight leading-tight">
              All Your File Tools.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 dark:from-amber-400 dark:via-rose-400 dark:to-indigo-400">
                Locally Crafted.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-stone-600 dark:text-zinc-400 max-w-2xl">
              Powerful high-speed local processing for PDFs and documents. Zero watermarks, complete privacy on your device.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const isSelected = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectCategory(tab.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                isSelected
                  ? tab.activeColor + ' shadow-xs'
                  : 'bg-white/60 dark:bg-[#141822]/60 border-stone-200/70 dark:border-white/5 text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-[#1a202c]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grid of Tools */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onSelect={onSelectTool}
            />
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="py-16 text-center text-stone-400 dark:text-zinc-500 space-y-2">
            <p className="text-sm font-semibold">No tools found matching your search</p>
            <p className="text-xs">Try searching for "compress", "merge", or select "All Tools"</p>
          </div>
        )}
      </div>
    </div>
  );
};
