import React, { useState, useEffect } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getConverterApiUrl, setConverterApiUrl, checkConverterHealth } from '../lib/remoteConverter';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'idle' | 'online' | 'offline'>('idle');

  useEffect(() => {
    if (isOpen) {
      const current = getConverterApiUrl();
      setUrl(current);
      setHealthStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setHealthStatus('idle');
    const isOk = await checkConverterHealth(url);
    setTesting(false);
    setHealthStatus(isOk ? 'online' : 'offline');
  };

  const handleSave = () => {
    setConverterApiUrl(url);
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl p-6 border shadow-xl relative transition-all
        bg-white border-slate-200 text-slate-900
        dark:bg-[#0e1014] dark:border-[#21242c] dark:text-zinc-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#1a1c22] dark:hover:text-zinc-200 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Document Converter Engine</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">PDF ⟷ Word (.docx/.doc) REST API</p>
          </div>
        </div>

        <div className="my-4 space-y-3 text-xs">
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
            Image and PDF compression run <strong>100% in-browser</strong>. High-fidelity PDF ⟷ Word document conversions connect to your self-hosted microservice.
          </p>

          <div>
            <label className="block font-medium font-mono text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">
              Converter Service URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setHealthStatus('idle');
                }}
                placeholder="http://localhost:7860 or https://<app>.onrender.com"
                className="flex-1 px-3 py-2 rounded-xl border text-xs font-mono transition focus:outline-none focus:ring-2 focus:ring-blue-500/40
                  bg-slate-50 border-slate-200 text-slate-900
                  dark:bg-[#14161b] dark:border-[#252832] dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !url.trim()}
                className="px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40
                  bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700
                  dark:bg-[#181a20] dark:hover:bg-[#20232b] dark:border-[#282c36] dark:text-zinc-200"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Ping'}
              </button>
            </div>
          </div>

          {/* Test Status feedback */}
          {healthStatus === 'online' && (
            <div className="p-2.5 rounded-xl border flex items-center gap-2 font-mono text-[11px]
              bg-emerald-50 border-emerald-200 text-emerald-800
              dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Connected! LibreOffice & pdf2docx engine is active.</span>
            </div>
          )}

          {healthStatus === 'offline' && (
            <div className="p-2.5 rounded-xl border flex items-start gap-2 text-[11px]
              bg-rose-50 border-rose-200 text-rose-800
              dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold font-mono">Service not reachable at this URL</p>
                <p className="mt-0.5 text-slate-500 dark:text-zinc-400">
                  Ensure your Docker container is running locally (`docker run -p 7860:7860 converter-service`) or deployed to Render.
                </p>
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl border font-mono text-[11px] bg-slate-50 border-slate-200 dark:bg-[#121418] dark:border-[#1e222a] text-slate-500 dark:text-zinc-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Local Docker:</span>
              <code className="text-blue-600 dark:text-blue-400">http://localhost:7860</code>
            </div>
            <div className="flex items-center justify-between">
              <span>Cloud:</span>
              <span>Render Free Tier / Hugging Face</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#1c1f26]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer
              border-slate-200 text-slate-600 hover:bg-slate-100
              dark:border-[#252830] dark:text-zinc-400 dark:hover:bg-[#16181d]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-sm"
          >
            Save URL
          </button>
        </div>
      </div>
    </div>
  );
};
