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
 * Zip Slip path traversal and malicious file system character injection.
 */
export function sanitizeFilename(filename: string): string {
  // Strip any directory paths (both Unix and Windows style)
  let safe = filename.replace(/^.*[\\/]/, '');
  // Replace illegal file system and control characters with underscores
  safe = safe.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_');
  // Prevent relative path traversal dots at the start
  safe = safe.replace(/^\.+/, '');
  return safe.trim() || 'file';
}

export function getOutputFilename(originalName: string, outputFormat?: string, prefix = 'compressed_'): string {
  const safeName = sanitizeFilename(originalName);
  const extIndex = safeName.lastIndexOf('.');
  const baseName = extIndex !== -1 ? safeName.substring(0, extIndex) : safeName;
  let ext = extIndex !== -1 ? safeName.substring(extIndex) : '';

  if (outputFormat === 'image/webp') ext = '.webp';
  else if (outputFormat === 'image/jpeg') ext = '.jpg';
  else if (outputFormat === 'image/png') ext = '.png';
  else if (outputFormat === 'image/avif') ext = '.avif';
  else if (outputFormat === 'application/pdf') ext = '.pdf';

  return `${prefix}${baseName}${ext}`;
}

export function downloadFile(blob: Blob, originalName: string, outputFormat?: string): void {
  const filename = getOutputFilename(originalName, outputFormat);
  saveAs(blob, filename);
}

/**
 * Merges multiple image files or blobs into a single consolidated PDF document.
 * Includes native GPU memory disposal and batch limits.
 */
export async function mergeImagesToPdf(imageItems: { blob: Blob; name: string }[]): Promise<Blob> {
  if (imageItems.length > 300) {
    throw new Error('Too many images to merge in a single session (limit is 300 images).');
  }

  const pdfDoc = await PDFDocument.create();

  for (const item of imageItems) {
    let bmp: ImageBitmap | null = null;
    let canvas: HTMLCanvasElement | null = null;

    try {
      bmp = await createImageBitmap(item.blob);
      const currentCanvas = document.createElement('canvas');
      canvas = currentCanvas;
      currentCanvas.width = bmp.width;
      currentCanvas.height = bmp.height;
      const ctx = currentCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(bmp, 0, 0);

      const jpegBlob = await new Promise<Blob>((res) => currentCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.88));
      const jpegBuffer = await jpegBlob.arrayBuffer();

      const embedded = await pdfDoc.embedJpg(jpegBuffer);
      const page = pdfDoc.addPage([currentCanvas.width, currentCanvas.height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: currentCanvas.width,
        height: currentCanvas.height,
      });
    } finally {
      if (bmp) {
        try {
          bmp.close();
        } catch {
          // Ignore
        }
      }
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}
