import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { 
  validateFileSize, 
  validatePageCount, 
  MAX_PDF_PAGES, 
  MAX_PDF_TO_IMAGES_PAGES 
} from './securityLimits';
import { cleanupCanvas } from './resourceManager';

// Configure pdfjs worker if available
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // fallback gracefully
  }
}

/**
 * 1. ROTATE PDF
 * Rotates all pages or specific pages by 90, 180, 270 degrees.
 */
export async function rotatePdfPages(
  file: File,
  angle: 90 | 180 | 270,
  targetPages: 'all' | number[] = 'all'
): Promise<Blob> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  validatePageCount(totalPages, MAX_PDF_PAGES, 'Rotate PDF');

  const indicesToRotate = targetPages === 'all'
    ? pdfDoc.getPageIndices()
    : targetPages.filter(p => p >= 1 && p <= totalPages).map(p => p - 1);

  for (const idx of indicesToRotate) {
    const page = pdfDoc.getPage(idx);
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + angle) % 360));
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * 2. DELETE PAGES
 * Deletes specified 1-based page numbers from a PDF document.
 */
export async function deletePdfPages(
  file: File,
  pagesToDelete: number[]
): Promise<{ blob: Blob; remainingCount: number }> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  validatePageCount(totalPages, MAX_PDF_PAGES, 'Delete Pages');

  // Validate and deduplicate pages to delete
  const uniquePages = Array.from(new Set(pagesToDelete.filter(p => Number.isInteger(p) && p >= 1 && p <= totalPages)));
  if (uniquePages.length === 0) {
    throw new Error('Please specify at least one valid page number to delete.');
  }

  if (uniquePages.length >= totalPages) {
    throw new Error('You cannot delete all pages in the document. At least one page must remain.');
  }

  // Sort descending so indices don't shift during deletion
  const sortedIndices = uniquePages
    .map(p => p - 1)
    .sort((a, b) => b - a);

  for (const idx of sortedIndices) {
    pdfDoc.removePage(idx);
  }

  const remainingCount = pdfDoc.getPageCount();
  if (remainingCount <= 0) {
    throw new Error('You cannot delete all pages in the document. At least one page must remain.');
  }

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    remainingCount
  };
}

/**
 * 3. REORDER PAGES
 * Reorders PDF pages based on a custom 1-based page order array (e.g. [3, 1, 2]).
 */
export async function reorderPdfPages(
  file: File,
  newOrder: number[]
): Promise<Blob> {
  validateFileSize(file);
  if (!Array.isArray(newOrder) || newOrder.length === 0) {
    throw new Error('Invalid page reordering order specified.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();
  validatePageCount(totalPages, MAX_PDF_PAGES, 'Reorder Pages');

  const validPages = newOrder.filter(p => Number.isInteger(p) && p >= 1 && p <= totalPages);
  if (validPages.length === 0) {
    throw new Error('Page reordering list contains no valid pages.');
  }

  const newPdf = await PDFDocument.create();
  const zeroBasedIndices = validPages.map(p => p - 1);
  const copiedPages = await newPdf.copyPages(sourcePdf, zeroBasedIndices);

  for (const page of copiedPages) {
    newPdf.addPage(page);
  }

  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * 4. ADD PAGE NUMBERS
 * Inserts page numbers (e.g., "Page 1 of 10" or "1") into header or footer.
 */
export async function addPageNumbersToPdf(
  file: File,
  options: {
    position: 'bottom-center' | 'bottom-right' | 'top-right';
    format: 'page-of-total' | 'number-only';
    startAt?: number;
    fontSize?: number;
  }
): Promise<Blob> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  validatePageCount(totalPages, MAX_PDF_PAGES, 'Add Page Numbers');
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const fontSize = typeof options.fontSize === 'number' && options.fontSize > 0 && options.fontSize <= 72
    ? options.fontSize
    : 10;
  const startNum = typeof options.startAt === 'number' && Number.isInteger(options.startAt)
    ? options.startAt
    : 1;

  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const currentNumber = startNum + i;
    const text = options.format === 'page-of-total' 
      ? `Page ${currentNumber} of ${totalPages}` 
      : `${currentNumber}`;

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    let x = (width - textWidth) / 2;
    let y = 24;

    if (options.position === 'bottom-right') {
      x = width - textWidth - 36;
      y = 24;
    } else if (options.position === 'top-right') {
      x = width - textWidth - 36;
      y = height - 32;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.35),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * 5. FLATTEN PDF FORMS
 * Freezes interactive form fields and widgets so they can no longer be edited.
 */
export async function flattenPdfForm(file: File): Promise<Blob> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  validatePageCount(totalPages, MAX_PDF_PAGES, 'Flatten PDF Form');
  const form = pdfDoc.getForm();
  
  try {
    form.flatten();
  } catch {
    // Form might already be flat or empty
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * 6. CROP PDF PAGES
 * Adjusts margin trims on all or selected pages.
 */
export async function cropPdfPages(
  file: File,
  margins: { top: number; bottom: number; left: number; right: number }
): Promise<Blob> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  validatePageCount(totalPages, MAX_PDF_PAGES, 'Crop PDF');

  const top = Math.max(0, margins.top || 0);
  const bottom = Math.max(0, margins.bottom || 0);
  const left = Math.max(0, margins.left || 0);
  const right = Math.max(0, margins.right || 0);

  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    const { x, y, width, height } = page.getMediaBox();

    const newX = x + left;
    const newY = y + bottom;
    const newWidth = Math.max(50, width - left - right);
    const newHeight = Math.max(50, height - top - bottom);

    page.setMediaBox(newX, newY, newWidth, newHeight);
    page.setCropBox(newX, newY, newWidth, newHeight);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * 7. TEXT / NOTE TO PDF
 * Generates a clean PDF from raw text notes or markdown.
 */
export async function textToPdf(
  title: string,
  content: string,
  author?: string
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - (margin * 2);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;

  // Title
  page.drawText(title || 'Document Note', {
    x: margin,
    y: currentY,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.15),
  });
  currentY -= 26;

  // Author / Date metadata
  const metaText = `Generated on ${new Date().toLocaleDateString()} ${author ? `• by ${author}` : ''}`;
  page.drawText(metaText, {
    x: margin,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.55),
  });
  currentY -= 24;

  // Divider line
  page.drawLine({
    start: { x: margin, y: currentY },
    end: { x: pageWidth - margin, y: currentY },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.88),
  });
  currentY -= 20;

  // Simple paragraph wrapping
  const lines = content.split('\n');
  const fontSize = 11;
  const lineHeight = 16;

  for (const rawLine of lines) {
    if (currentY < margin + 30) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
    }

    if (!rawLine.trim()) {
      currentY -= 10;
      continue;
    }

    // Wrap long lines
    const words = rawLine.split(' ');
    let currentLineStr = '';

    for (const word of words) {
      const testLine = currentLineStr ? `${currentLineStr} ${word}` : word;
      const testWidth = fontRegular.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > contentWidth && currentLineStr) {
        page.drawText(currentLineStr, {
          x: margin,
          y: currentY,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.25),
        });
        currentY -= lineHeight;
        if (currentY < margin + 30) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        currentLineStr = word;
      } else {
        currentLineStr = testLine;
      }
    }

    if (currentLineStr) {
      page.drawText(currentLineStr, {
        x: margin,
        y: currentY,
        size: fontSize,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.25),
      });
      currentY -= lineHeight;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * 8. PDF TO IMAGES (ZIP)
 * Converts each page of a PDF into PNG images packaged in a ZIP.
 */
export async function pdfToImagesZip(
  file: File,
  format: 'png' | 'jpeg' = 'png',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  let pdf: any = null;

  try {
    pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    validatePageCount(numPages, MAX_PDF_TO_IMAGES_PAGES, 'PDF to Images');
    const zip = new JSZip();

    for (let i = 1; i <= numPages; i++) {
      onProgress?.(i, numPages);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x high resolution
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        cleanupCanvas(canvas);
        continue;
      }

      try {
        // Render page
        const renderContext = {
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        };
        await page.render(renderContext).promise;

        const dataUrl = canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
        const base64Data = dataUrl.split(',')[1];
        zip.file(`page_${i}.${format === 'jpeg' ? 'jpg' : 'png'}`, base64Data, { base64: true });
      } finally {
        // Free canvas bitmap buffer and page resources immediately
        cleanupCanvas(canvas);
        page.cleanup();
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  } finally {
    try {
      if (pdf) {
        await pdf.destroy();
      }
    } catch {
      // Ignore pdf destruction errors
    }
    try {
      loadingTask.destroy();
    } catch {
      // Ignore task destruction errors
    }
  }
}
