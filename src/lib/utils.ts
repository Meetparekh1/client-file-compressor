import { saveAs } from 'file-saver';

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function parseBytes(value: number, unit: 'KB' | 'MB'): number {
  if (unit === 'MB') {
    return Math.round(value * 1024 * 1024);
  }
  return Math.round(value * 1024);
}

export function calculateSavings(original: number, compressed: number): { bytes: number; percent: number } {
  const bytes = original - compressed;
  const percent = Math.max(0, Math.round(((original - compressed) / original) * 100));
  return { bytes, percent };
}

export function downloadFile(blob: Blob, originalName: string, prefix = 'compressed_'): void {
  const extIndex = originalName.lastIndexOf('.');
  const baseName = extIndex !== -1 ? originalName.substring(0, extIndex) : originalName;
  const ext = extIndex !== -1 ? originalName.substring(extIndex) : '';
  
  const newName = `${prefix}${baseName}${ext}`;
  saveAs(blob, newName);
}
