import { pdfjsLib } from '../pdfjsClient';
import { PDFDocument } from 'pdf-lib';
import type { CompressionOptions, CompressionResult } from '../types';

function canvasToBlobSafe(canvas: HTMLCanvasElement, mime = 'image/jpeg', quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b && b.size > 0) resolve(b);
      else {
        canvas.toBlob((b2) => {
          if (b2 && b2.size > 0) resolve(b2);
          else reject(new Error('Failed to render page to image'));
        }, 'image/png');
      }
    }, mime, quality);
  });
}

/**
 * Compresses a PDF file client-side by rendering pages in memory,
 * optimizing imagery to fit the target size budget, and re-assembling
 * into a clean PDF that preserves original page aspect ratios and dimensions.
 */
export async function compressPdfToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, onProgress, signal } = options;

  if (signal?.aborted) {
    throw new DOMException('Compression cancelled by user', 'AbortError');
  }

  if (file.size <= 0) {
    throw new Error('File is empty (0 bytes).');
  }

  if (file.size <= targetSizeBytes) {
    onProgress?.(100, 'Already within target size');
    return {
      blob: file,
      accuracy: 100,
      iterations: 0,
    };
  }

  onProgress?.(10, 'Reading PDF document...');
  const arrayBuffer = await file.arrayBuffer();

  if (signal?.aborted) {
    throw new DOMException('Compression cancelled by user', 'AbortError');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // Security: Prevent browser tab crash from PDF bombs
  if (numPages > 500) {
    try {
      await pdf.destroy();
    } catch {
      // Ignore
    }
    throw new Error('PDF has over 500 pages. Please compress in smaller batches to avoid exceeding browser memory limits.');
  }

  onProgress?.(20, `Processing ${numPages} page${numPages > 1 ? 's' : ''}...`);

  // Target budget per page (leave 4KB header/trailer overhead)
  const overhead = Math.max(4000, numPages * 500);
  const targetBytesPerPage = Math.max(8000, Math.floor((targetSizeBytes - overhead) / numPages));

  // Determine scale factor based on target size budget
  const compressionRatio = targetSizeBytes / file.size;
  let renderScale = 1.4; // default crisp rendering
  let baseQuality = 0.75;

  if (compressionRatio < 0.25) {
    renderScale = 0.85;
    baseQuality = 0.45;
  } else if (compressionRatio < 0.5) {
    renderScale = 1.05;
    baseQuality = 0.6;
  } else if (compressionRatio < 0.75) {
    renderScale = 1.25;
    baseQuality = 0.7;
  }

  const newPdfDoc = await PDFDocument.create();
  let iterations = 1;

  // Reuse a single canvas across all pages instead of allocating numPages canvases
  let reusableCanvas: HTMLCanvasElement | null = null;

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (signal?.aborted) {
        throw new DOMException('Compression cancelled by user', 'AbortError');
      }

      const pageProgress = 20 + Math.round((pageNum / numPages) * 65);
      onProgress?.(pageProgress, `Optimizing page ${pageNum} of ${numPages}...`);

      const page = await pdf.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const renderViewport = page.getViewport({ scale: renderScale });

      const targetW = Math.max(10, Math.floor(renderViewport.width));
      const targetH = Math.max(10, Math.floor(renderViewport.height));

      if (!reusableCanvas) {
        reusableCanvas = document.createElement('canvas');
      }
      reusableCanvas.width = targetW;
      reusableCanvas.height = targetH;
      const ctx = reusableCanvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        // Fallback: create empty page matching dimensions
        newPdfDoc.addPage([unscaledViewport.width, unscaledViewport.height]);
        page.cleanup();
        continue;
      }

      try {
        // Render PDF page to Canvas
        await page.render({
          canvasContext: ctx,
          viewport: renderViewport,
        }).promise;

        if (signal?.aborted) {
          throw new DOMException('Compression cancelled by user', 'AbortError');
        }

        // Binary search quality for this page
        let lowQ = 0.08;
        let highQ = baseQuality;
        let bestBlob: Blob | null = null;

        for (let step = 0; step < 4; step++) {
          if (signal?.aborted) {
            throw new DOMException('Compression cancelled by user', 'AbortError');
          }
          iterations++;
          const midQ = (lowQ + highQ) / 2;
          try {
            const blob = await canvasToBlobSafe(reusableCanvas, 'image/jpeg', midQ);
            if (blob.size <= targetBytesPerPage) {
              bestBlob = blob;
              lowQ = midQ;
            } else {
              highQ = midQ;
              bestBlob = blob;
            }
          } catch {
            break;
          }
        }

        const finalPageBlob =
          bestBlob ||
          (await canvasToBlobSafe(reusableCanvas, 'image/jpeg', 0.35));

        const pageImgBytes = await finalPageBlob.arrayBuffer();
        const embeddedImage = await newPdfDoc.embedJpg(pageImgBytes);

        // Create new page with original unscaled physical dimensions (e.g. standard A4 / Letter)
        const newPage = newPdfDoc.addPage([unscaledViewport.width, unscaledViewport.height]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        });
      } finally {
        page.cleanup();
      }
    }

    if (signal?.aborted) {
      throw new DOMException('Compression cancelled by user', 'AbortError');
    }

    onProgress?.(90, 'Finalizing compressed document...');
    const pdfBytes = await newPdfDoc.save({ useObjectStreams: true });
    const compressedBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

    const accuracy = Math.max(
      0,
      Math.min(100, Math.round((1 - Math.abs(compressedBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10)
    );

    onProgress?.(100, 'PDF compression complete');
    return {
      blob: compressedBlob,
      accuracy,
      iterations,
    };
  } finally {
    if (reusableCanvas) {
      reusableCanvas.width = 0;
      reusableCanvas.height = 0;
    }
    try {
      await pdf.destroy();
    } catch {
      // Ignore worker cleanup errors
    }
  }
}
