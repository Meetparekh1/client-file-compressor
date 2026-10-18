import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { cleanupCanvas } from './resourceManager';
import { 
  validateFileSize, 
  validatePageCount, 
  MAX_PDF_PAGES, 
  MAX_MERGE_IMAGES_COUNT,
  TIMEOUT_GENERAL_MS,
  withExecutionTimeout 
} from './securityLimits';

export type PageSizeFormat = 'a4' | 'letter' | 'auto';

export interface ImageToPdfOptions {
  pageSize: PageSizeFormat;
  margin?: number;
  orientation?: 'portrait' | 'landscape' | 'auto';
  filter?: 'original' | 'grayscale' | 'contrast';
}

/**
 * Prepares image file with optional image filtering (grayscale, contrast) via OffscreenCanvas / Canvas
 */
async function processImageElement(file: File, filter: ImageToPdfOptions['filter']): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const imgBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = imgBitmap.width;
  canvas.height = imgBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not access 2D canvas context.');

  if (filter === 'grayscale') {
    ctx.filter = 'grayscale(100%) contrast(120%)';
  } else if (filter === 'contrast') {
    ctx.filter = 'contrast(140%) brightness(105%)';
  }

  ctx.drawImage(imgBitmap, 0, 0);
  imgBitmap.close();
  return { canvas, width: canvas.width, height: canvas.height };
}

/**
 * Converts images/photos/scans to a clean standardized PDF (A4, Letter, or Fit to Image).
 */
export async function imagesToPdfDocument(
  files: File[],
  options: ImageToPdfOptions,
  onProgress?: (progress: number, fileName: string) => void
): Promise<Blob> {
  if (files.length === 0) {
    throw new Error('Please select at least one image or scan to convert.');
  }
  if (files.length > MAX_MERGE_IMAGES_COUNT) {
    throw new Error(`Exceeded maximum allowed images count (${MAX_MERGE_IMAGES_COUNT}).`);
  }

  for (const f of files) {
    validateFileSize(f);
  }

  return withExecutionTimeout(
    (async () => {
      const pdfDoc = await PDFDocument.create();

      // Standard dimensions in points (72 points per inch)
      const DIMENSIONS: Record<'a4' | 'letter', [number, number]> = {
        a4: [595.28, 841.89], // [width, height] in points
        letter: [612.00, 792.00],
      };

      const margin = options.margin ?? 20;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onProgress?.(Math.round(((i) / files.length) * 100), file.name);

        const { canvas, width: origW, height: origH } = await processImageElement(file, options.filter);
        let embeddedImage;

        try {
          const jpegBlob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b || new Blob([])), 'image/jpeg', 0.88)
          );
          const jpegBuffer = await jpegBlob.arrayBuffer();
          embeddedImage = await pdfDoc.embedJpg(jpegBuffer);
        } finally {
          cleanupCanvas(canvas);
        }

        let pageWidth: number;
        let pageHeight: number;

        if (options.pageSize === 'auto') {
          pageWidth = origW;
          pageHeight = origH;
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });
        } else {
          const [stdW, stdH] = DIMENSIONS[options.pageSize];
          const isLandscape = origW > origH;

          if (options.orientation === 'landscape' || (options.orientation === 'auto' && isLandscape)) {
            pageWidth = stdH;
            pageHeight = stdW;
          } else {
            pageWidth = stdW;
            pageHeight = stdH;
          }

          const availW = pageWidth - (margin * 2);
          const availH = pageHeight - (margin * 2);

          const scale = Math.min(availW / origW, availH / origH);
          const drawW = origW * scale;
          const drawH = origH * scale;

          const drawX = margin + (availW - drawW) / 2;
          const drawY = margin + (availH - drawH) / 2;

          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawImage(embeddedImage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
        }
      }

      onProgress?.(95, 'Saving document...');
      const pdfBytes = await pdfDoc.save();
      onProgress?.(100, 'Done');

      return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    })(),
    TIMEOUT_GENERAL_MS,
    'Images to PDF'
  );
}

export interface WatermarkOptions {
  type: 'text' | 'signature';
  text?: string;
  signatureDataUrl?: string;
  position: 'center' | 'bottom-right' | 'diagonal-all';
  opacity: number; // 0.1 to 1.0
  pageRange: 'all' | 'first' | 'custom';
  customPages?: number[];
}

/**
 * Stamps a digital signature image or text watermark onto PDF pages.
 */
export async function applyWatermarkOrSignature(
  sourcePdfFile: File,
  options: WatermarkOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  validateFileSize(sourcePdfFile);

  return withExecutionTimeout(
    (async () => {
    onProgress?.(15);
    const arrayBuffer = await sourcePdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    validatePageCount(totalPages, MAX_PDF_PAGES, 'Sign / Watermark PDF');
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let embeddedSignature;
  if (options.signatureDataUrl) {
    const sigBytes = await fetch(options.signatureDataUrl).then(res => res.arrayBuffer());
    embeddedSignature = await pdfDoc.embedPng(sigBytes);
  }

  // Determine pages to stamp
  let targetPagesIndices: number[] = [];
  if (options.pageRange === 'all') {
    targetPagesIndices = pdfDoc.getPageIndices();
  } else if (options.pageRange === 'first') {
    targetPagesIndices = [0];
  } else if (options.customPages && options.customPages.length > 0) {
    targetPagesIndices = options.customPages
      .filter(p => p >= 1 && p <= totalPages)
      .map(p => p - 1);
  } else {
    targetPagesIndices = pdfDoc.getPageIndices();
  }

  for (let i = 0; i < targetPagesIndices.length; i++) {
    const pageIdx = targetPagesIndices[i];
    const page = pdfDoc.getPage(pageIdx);
    const { width, height } = page.getSize();

    if (options.signatureDataUrl && embeddedSignature) {
      // Stamp Signature
      const sigScale = 0.35;
      const sigW = embeddedSignature.width * sigScale;
      const sigH = embeddedSignature.height * sigScale;

      let x = width - sigW - 36;
      let y = 36;

      if (options.position === 'center') {
        x = (width - sigW) / 2;
        y = (height - sigH) / 2;
      }

      page.drawImage(embeddedSignature, {
        x,
        y,
        width: sigW,
        height: sigH,
        opacity: options.opacity,
      });
    } else if (options.text) {
      // Stamp Text Watermark
      const text = options.text;
      const textSize = options.position === 'diagonal-all' ? 42 : 18;
      const textWidth = font.widthOfTextAtSize(text, textSize);

      if (options.position === 'diagonal-all') {
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: textSize,
          font,
          color: rgb(0.7, 0.7, 0.75),
          opacity: options.opacity,
          rotate: degrees(45),
        });
      } else if (options.position === 'center') {
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: textSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
          opacity: options.opacity,
        });
      } else {
        page.drawText(text, {
          x: width - textWidth - 28,
          y: 28,
          size: textSize,
          font,
          color: rgb(0.3, 0.3, 0.3),
          opacity: options.opacity,
        });
      }
    }

    onProgress?.(30 + Math.round(((i + 1) / targetPagesIndices.length) * 60));
  }

  onProgress?.(95);
  const pdfBytes = await pdfDoc.save();
  onProgress?.(100);

    return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    })(),
    TIMEOUT_GENERAL_MS,
    'Sign / Watermark PDF'
  );
}
