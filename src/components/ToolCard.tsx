import React from 'react';
import { 
  FileArchive, 
  Files, 
  Scissors, 
  PenTool, 
  FileSpreadsheet, 
  ArrowRight,
  Camera,
  RotateCw,
  Trash2,
  Binary,
  FileImage,
  Lock,
  LockOpen,
  FileText,
  Brain,
  LayoutGrid,
  Eye,
  Edit3,
  Scan,
  Layout,
  Heart
} from 'lucide-react';
import type { ToolDefinition } from '../lib/toolsRegistry';
import { isFavorite, toggleFavorite } from '../lib/favoritesStore';

interface ToolCardProps {
  tool: ToolDefinition;
  onSelect: (toolId: string) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (toolId: string) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ 
  tool, 
  onSelect, 
  isFavorited: controlledFavorited,
  onToggleFavorite 
}) => {
  const isComingSoon = tool.status === 'coming_soon';
  const isFav = controlledFavorited !== undefined ? controlledFavorited : isFavorite(tool.id);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(tool.id);
    } else {
      toggleFavorite(tool.id);
    }
  };

  const renderIcon = () => {
    switch (tool.iconName) {
      case 'word':
        return <span className="font-black text-xl leading-none text-white font-sans select-none">W</span>;
      case 'compress':
        return <FileArchive className="w-6 h-6" />;
      case 'merge':
        return <Files className="w-6 h-6" />;
      case 'split':
        return <Scissors className="w-6 h-6" />;
      case 'sign':
        return <PenTool className="w-6 h-6" />;
      case 'office':
        return <FileSpreadsheet className="w-6 h-6" />;
      case 'ai':
        return <Brain className="w-6 h-6" />;
      case 'camera':
        return <Camera className="w-6 h-6" />;
      case 'rotate':
        return <RotateCw className="w-6 h-6" />;
      case 'delete':
        return <Trash2 className="w-6 h-6" />;
      case 'numbers':
        return <Binary className="w-6 h-6" />;
      case 'images':
        return <FileImage className="w-6 h-6" />;
      case 'flatten':
        return <Lock className="w-6 h-6" />;
      case 'organize':
        return <LayoutGrid className="w-6 h-6" />;
      case 'preview':
        return <Eye className="w-6 h-6" />;
      case 'edit':
        return <Edit3 className="w-6 h-6" />;
      case 'text':
        return <FileText className="w-6 h-6" />;
      case 'scan':
        return <Scan className="w-6 h-6" />;
      case 'unlock':
      case 'lock':
        return <LockOpen className="w-6 h-6" />;
      case 'layout':
        return <Layout className="w-6 h-6" />;
      default:
        return <FileArchive className="w-6 h-6" />;
    }
  };

  return (
    <div
      role={isComingSoon ? undefined : "button"}
      tabIndex={isComingSoon ? -1 : 0}
      aria-disabled={isComingSoon}
      onClick={() => {
        if (!isComingSoon) {
          onSelect(tool.id);
        }
      }}
      onKeyDown={(e) => {
        if (!isComingSoon && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(tool.id);
        }
      }}
      className={`group relative rounded-2xl p-3.5 sm:p-4 transition-all duration-200 border flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0b0e14]
        bg-white border-stone-200/90 shadow-2xs hover:shadow-md hover:-translate-y-[2px] hover:border-blue-200/80
        dark:bg-[#131823] dark:border-[#202736] dark:hover:border-blue-500/40
        ${isComingSoon ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
    >
      <div>
        {/* Top Row: Icon Container + Favorite Heart Button */}
        <div className="flex items-start justify-between">
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105
              ${tool.iconBgColor} ${tool.iconDarkBgColor}`}
          >
            {renderIcon()}
          </div>

          <button
            type="button"
            onClick={handleHeartClick}
            className="p-1 -mr-1 -mt-1 rounded-full text-stone-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
            title={isFav ? "Remove from favorites" : "Add to favorites"}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart 
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-150 ${
                isFav 
                  ? "text-rose-500 fill-rose-500 scale-110" 
                  : "text-stone-300 dark:text-zinc-600 group-hover:text-stone-400"
              }`} 
            />
          </button>
        </div>

        {/* Tool Name & Description */}
        <div className="mt-2.5 sm:mt-3">
          <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">
            {tool.name}
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>

      {/* Bottom Row: Arrow Button */}
      <div className="flex items-center justify-between mt-2.5 sm:mt-3 pt-0.5">
        {isComingSoon ? (
          <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500">
            Coming Soon
          </span>
        ) : (
          <div />
        )}
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200
            ${isComingSoon 
              ? 'opacity-50 bg-stone-100 text-stone-400 dark:bg-[#1a2333] dark:text-zinc-500' 
              : 'bg-[#f0f5ff] text-[#2563eb] dark:bg-[#1a2538] dark:text-[#38bdf8] group-hover:bg-[#2563eb] group-hover:text-white dark:group-hover:bg-[#2563eb] dark:group-hover:text-white shadow-2xs'}`}
        >
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
};
