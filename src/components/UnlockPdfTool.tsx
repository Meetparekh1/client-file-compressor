import React, { useState, useRef } from 'react';
import { ArrowLeft, Unlock, Download, ShieldCheck, UploadCloud, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { formatBytes } from '../lib/utils';
import type { ToastMessage } from './Toast';

interface UnlockPdfToolProps {
  onBack: () => void;
  onToast: (msg: string, type: ToastMessage['type']) => void;
}

export const UnlockPdfTool: React.FC<UnlockPdfToolProps> = ({ onBack, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [unlockedBlob, setUnlockedBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUnlockedBlob(null);
    }
  };

  const handleUnlock = async () => {
    if (!file) return;
    if (!password) {
      onToast('Please enter the password to unlock.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password } as any);
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      setUnlockedBlob(blob);
      onToast('PDF Unlocked successfully!', 'success');
    } catch (err: any) {
      if (err.message.includes('password')) {
        onToast('Incorrect password or encrypted file type not supported.', 'error');
      } else {
        onToast('Failed to unlock PDF: ' + err.message, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (unlockedBlob && file) {
      saveAs(unlockedBlob, file.name.replace('.pdf', '_unlocked.pdf'));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-white/80 border border-stone-200 text-stone-700 hover:bg-stone-100 shadow-xs dark:bg-[#161a23] dark:border-white/10 dark:text-zinc-300 transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          <span>All Tools</span>
        </button>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local Decryption</span>
        </div>
      </div>

      <div className="border-b border-stone-200 dark:border-[#222834] pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
          <Unlock className="w-8 h-8 text-red-500" />
          Unlock PDF
        </h1>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">
          Remove password protection from PDFs completely offline.
        </p>
      </div>

      {!file ? (
        <div onClick={() => fileInputRef.current?.click()} className="group relative rounded-3xl border-2 border-dashed border-stone-300 dark:border-[#262c3a] hover:border-red-500/60 bg-white/50 dark:bg-[#121620]/60 p-8 sm:p-12 text-center transition-all cursor-pointer hover:shadow-lg">
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-zinc-200">Upload Protected PDF</h3>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#12161f] border border-stone-200 dark:border-[#222834] rounded-3xl p-6 shadow-sm space-y-4 max-w-lg mx-auto mt-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-xs">PDF</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{file.name}</p>
              <p className="text-xs text-stone-500">{formatBytes(file.size)}</p>
            </div>
            <button onClick={() => setFile(null)} className="text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded text-stone-600 dark:bg-[#1e2330] dark:text-zinc-400">Change</button>
          </div>

          {!unlockedBlob ? (
            <div className="space-y-4 pt-4 border-t border-stone-100 dark:border-[#222834]">
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Enter PDF Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 border border-stone-300 dark:border-[#2a3243] bg-stone-50 dark:bg-[#171b25] text-stone-900 dark:text-white rounded-xl text-sm"
                  placeholder="Enter password..."
                />
              </div>
              <button 
                onClick={handleUnlock} 
                disabled={isProcessing || !password}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Unlock Document
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-4 border-t border-stone-100 dark:border-[#222834]">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-semibold text-center">
                PDF successfully unlocked!
              </div>
              <button 
                onClick={handleDownload}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex justify-center items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Unlocked PDF
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
