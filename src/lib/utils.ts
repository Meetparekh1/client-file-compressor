import { saveAs } from 'file-saver';
import { PDFDocument } from 'pdf-lib';

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

/**
 * Sanitizes user-provided or extracted file names to prevent
 * Zip Slip path traversal, backend output-path injection, and malicious file system characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return 'file';

  // Decode URI encoding if present (e.g. %2e%2e%2f or %2e%2e%5c)
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    // If malformed URI encoding, keep raw filename
  }

  // Strip any directory paths (both Unix and Windows style, plus protocol schemes)
  const basename = decoded.split(/[\\/]/).pop() || 'file';

  // Replace illegal file system, traversal, and non-printable control characters
  const cleanChars = Array.from(basename)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127 || '<>:"/\\|?*'.includes(char)) {
        return '_';
      }
      return char;
    })
    .join('');

  // Strip leading and trailing dots and spaces to prevent traversal or hidden/truncated files
  let safe = cleanChars.replace(/^\.+/, '').trim().replace(/\.+$/, '');

  // Block Windows reserved filenames (CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9)
  const baseWithoutExt = safe.split('.')[0].toUpperCase();
  const RESERVED_NAMES = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  if (RESERVED_NAMES.includes(baseWithoutExt)) {
    safe = `safe_${safe}`;
  }

  // Constrain filename length to prevent filesystem buffer issues
  if (safe.length > 200) {
    const extIndex = safe.lastIndexOf('.');
    const ext = extIndex !== -1 ? safe.slice(extIndex) : '';
    safe = safe.slice(0, 200 - ext.length) + ext;
  }

  return safe || 'file';
}

export function getOutputFilename(originalName: string, outputFormat?: string, prefix = 'compressed_'): string {
  const safeName = sanitizeFilename(originalName);
  const extIndex = safeName.lastIndexOf('.');
  const baseName = extIndex !== -1 ? safeName.substring(0, extIndex) : safeName;
  let ext = extIndex !== -1 ? safeName.substring(extIndex) : '';

  let actualPrefix = prefix;
  if (outputFormat === 'image/webp') { ext = '.webp'; actualPrefix = 'converted_'; }
  else if (outputFormat === 'image/jpeg') { ext = '.jpg'; actualPrefix = 'converted_'; }
  else if (outputFormat === 'image/png') { ext = '.png'; actualPrefix = 'converted_'; }
  else if (outputFormat === 'image/avif') { ext = '.avif'; actualPrefix = 'converted_'; }
  else if (outputFormat === 'application/pdf') { ext = '.pdf'; actualPrefix = 'converted_'; }
  else if (outputFormat === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    ext = '.docx';
    actualPrefix = 'converted_';
  }

  // If format didn't change, retain default prefix (e.g. compressed_)
  const isOriginal = !outputFormat || outputFormat === 'original';
  return `${isOriginal ? prefix : actualPrefix}${baseName}${ext}`;
}

export function downloadFile(blob: Blob, originalName: string, outputFormat?: string): void {
  const filename = getOutputFilename(originalName, outputFormat);
  saveAs(blob, filename);
}

/**
 * Universal safe canvas renderer for images and SVGs (prevents createImageBitmap SVG crashes).
 */
async function renderBlobToCanvas(blob: Blob): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  if (blob.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ canvas, width: canvas.width, height: canvas.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to render SVG image'));
      };
      img.src = url;
    });
  }

  try {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(bmp, 0, 0);
    bmp.close();
    return { canvas, width: canvas.width, height: canvas.height };
  } catch {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ canvas, width: canvas.width, height: canvas.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image data'));
      };
      img.src = url;
    });
  }
}

/**
 * Merges multiple image files or blobs (including SVGs) into a single consolidated PDF document.
 * Includes native GPU memory disposal and batch limits.
 */
export async function mergeImagesToPdf(imageItems: { blob: Blob; name: string }[]): Promise<Blob> {
  if (imageItems.length > 300) {
    throw new Error('Too many images to merge in a single session (limit is 300 images).');
  }

  const pdfDoc = await PDFDocument.create();

  for (const item of imageItems) {
    let rendered: { canvas: HTMLCanvasElement; width: number; height: number } | null = null;

    try {
      rendered = await renderBlobToCanvas(item.blob);
      const jpegBlob = await new Promise<Blob>((res) =>
        rendered!.canvas.toBlob((b) => res(b!), 'image/jpeg', 0.88)
      );
      const jpegBuffer = await jpegBlob.arrayBuffer();

      const embedded = await pdfDoc.embedJpg(jpegBuffer);
      const page = pdfDoc.addPage([rendered.width, rendered.height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: rendered.width,
        height: rendered.height,
      });
    } finally {
      if (rendered?.canvas) {
        rendered.canvas.width = 0;
        rendered.canvas.height = 0;
      }
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}
