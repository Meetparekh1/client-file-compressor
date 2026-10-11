import React from 'react';
import { 
  FileArchive, 
  Files, 
  Scissors, 
  PenTool, 
  FileSpreadsheet, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Camera,
  RotateCw,
  Trash2,
  Binary,
  FileImage,
  Lock,
  FileText,
  Brain
} from 'lucide-react';
import type { ToolDefinition } from '../lib/toolsRegistry';

interface ToolCardProps {
  tool: ToolDefinition;
  onSelect: (toolId: string) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onSelect }) => {
  const isComingSoon = tool.status === 'coming_soon';

  const renderIcon = () => {
    switch (tool.iconName) {
      case 'compress':
        return <FileArchive className="w-6 h-6" />;
      case 'merge':
        return <Files className="w-6 h-6" />;
      case 'split':
        return <Scissors className="w-6 h-6" />;
      case 'sign':
        return <PenTool className="w-6 h-6" />;
      case 'word':
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
      case 'text':
        return <FileText className="w-6 h-6" />;
      default:
        return <FileArchive className="w-6 h-6" />;
    }
  };

  return (
    <div
      onClick={() => {
        if (!isComingSoon) {
          onSelect(tool.id);
        }
      }}
      className={`group relative rounded-3xl p-4 sm:p-6 transition-all duration-300 border flex flex-col justify-between
        bg-white border-stone-200/80 shadow-sm hover:shadow-md hover:border-stone-300 glass-card
        dark:bg-[#12161f] dark:border-[#202735] dark:hover:border-[#323d52] dark:shadow-none
        ${isComingSoon ? 'opacity-80 cursor-default' : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg'}`}
    >
      <div>
        {/* Top Header: Icon + Badge + On-Device Shield */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-105 shadow-sm
              ${tool.iconBgColor} ${tool.iconDarkBgColor}`}
          >
            {renderIcon()}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Explicit Processing Destination Badge */}
            <span
              title={tool.destinationLabel}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                tool.destination === 'hybrid'
                  ? 'bg-blue-50 border-blue-200/80 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800/60 dark:text-blue-300'
                  : tool.destination === 'local_cdn_model'
                  ? 'bg-purple-50 border-purple-200/80 text-purple-700 dark:bg-purple-950/60 dark:border-purple-800/60 dark:text-purple-300'
                  : 'bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {tool.destination === 'hybrid'
                  ? 'Hybrid Local/Server'
                  : tool.destination === 'local_cdn_model'
                  ? 'Local AI'
                  : 'On-Device'}
              </span>
            </span>

            {/* Status / Feature badge */}
            {tool.badgeLabel && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border
                  ${
                    tool.badgeType === 'coming_soon'
                      ? 'bg-stone-100 border-stone-300/80 text-stone-600 dark:bg-stone-800/80 dark:border-stone-700 dark:text-stone-300'
                      : tool.badgeType === 'new'
                      ? 'bg-indigo-50 border-indigo-200/80 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800/60 dark:text-indigo-300'
                      : 'bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300'
                  }`}
              >
                {tool.badgeType === 'new' && <Sparkles className="w-3 h-3 text-indigo-500" />}
                {tool.badgeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Title & Headline */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            {tool.name}
          </span>
          <h3 className="text-lg font-bold text-stone-900 dark:text-white mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {tool.title}
          </h3>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-2 leading-relaxed">
            {tool.description}
          </p>
        </div>
      </div>

      {/* Card Footer: Action indication */}
      <div className="pt-5 mt-4 border-t border-stone-100 dark:border-white/5 flex items-center justify-between">
        {isComingSoon ? (
          <span className="text-xs font-semibold text-stone-400 dark:text-stone-500">
            Server Tool • Coming Soon
          </span>
        ) : (
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1.5 group-hover:gap-2 transition-all">
            <span>Open Tool</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
};
