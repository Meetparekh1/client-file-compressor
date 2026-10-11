import React from 'react';
import { AlertTriangle, Server, Laptop, ShieldCheck } from 'lucide-react';
import { getConverterApiUrl } from '../lib/remoteConverter';
import { setRemoteProcessingConsent } from '../lib/remoteConsent';

interface RemoteConsentModalProps {
  isOpen: boolean;
  targetEndpoint?: string;
  toolName?: string;
  onConsentGranted: () => void;
  onCancel: () => void;
}

export const RemoteConsentModal: React.FC<RemoteConsentModalProps> = ({
  isOpen,
  targetEndpoint,
  toolName = 'Remote Conversion Engine',
  onConsentGranted,
  onCancel,
}) => {
  if (!isOpen) return null;

  const endpoint = targetEndpoint || getConverterApiUrl();

  const handleGrantConsent = () => {
    setRemoteProcessingConsent(true, endpoint);
    onConsentGranted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141824] rounded-3xl border border-stone-200 dark:border-[#252c3c] p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">
            Explicit Remote Processing Consent
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
            You requested an operation using <strong>{toolName}</strong>. This feature transmits your document
            across the network to the following external or self-hosted server endpoint:
          </p>
          <code className="block mt-2 text-xs font-mono bg-stone-100 dark:bg-[#1a1f2c] text-stone-800 dark:text-zinc-300 px-3 py-2 rounded-xl break-all border border-stone-200 dark:border-white/5">
            {endpoint}
          </code>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Privacy Notice:
          </p>
          <p>
            Your document data will leave this local device and be processed on that server. Only proceed if you control or trust this endpoint.
            For 100% private zero-network execution, choose <strong>Stay On-Device</strong>.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleGrantConsent}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
              bg-amber-600 hover:bg-amber-500 active:scale-95 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Server className="w-4 h-4" />
            <span>I Consent — Upload File</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
              bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-[#1e2330] dark:hover:bg-[#282f42] dark:text-zinc-300 transition-all cursor-pointer"
          >
            <Laptop className="w-4 h-4" />
            <span>Stay On-Device (Safer)</span>
          </button>
        </div>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-zinc-300 transition cursor-pointer"
          >
            Cancel operation
          </button>
        </div>
      </div>
    </div>
  );
};
