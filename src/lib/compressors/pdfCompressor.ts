import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import type { CompressionOptions, CompressionResult } from '../types';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Compresses a PDF file client-side by rendering pages, downsampling imagery to fit
 * the target size budget, and re-assembling into a clean PDF with pdf-lib.
 */
export async function compressPdfToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, onProgress } = options;

  if (file.size <= targetSizeBytes) {
    onProgress?.(100, 'Already within target size');
    return {
      blob: file,
      accuracy: 100,
      iterations: 0,
    };
  }

  onProgress?.(10, 'Loading PDF document...');
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  onProgress?.(20, `Processing ${numPages} page${numPages > 1 ? 's' : ''}...`);

  // Target budget per page (leaving 8KB overhead for PDF headers/trailer)
  const overhead = Math.max(5000, numPages * 800);
  const targetBytesPerPage = Math.max(12000, Math.floor((targetSizeBytes - overhead) / numPages));

  // Determine scale factor based on target size budget
  // e.g. for tight targets, use lower scale / DPI
  const estTotalBytes = file.size;
  const compressionRatio = targetSizeBytes / estTotalBytes;
  let renderScale = 1.5; // default sharp render
  let baseQuality = 0.75;

  if (compressionRatio < 0.25) {
    renderScale = 0.9;
    baseQuality = 0.45;
  } else if (compressionRatio < 0.5) {
    renderScale = 1.1;
    baseQuality = 0.6;
  } else if (compressionRatio < 0.75) {
    renderScale = 1.3;
    baseQuality = 0.7;
  }

  const newPdfDoc = await PDFDocument.create();
  let iterations = 1;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pageProgress = 20 + Math.round((pageNum / numPages) * 65);
    onProgress?.(pageProgress, `Compressing page ${pageNum} of ${numPages}...`);

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Render PDF page to Canvas
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    await page.render(renderContext as unknown as Parameters<typeof page.render>[0]).promise;

    // Binary search quality for this page
    let lowQ = 0.1;
    let highQ = baseQuality;
    let bestBlob: Blob | null = null;

    for (let step = 0; step < 4; step++) {
      iterations++;
      const midQ = (lowQ + highQ) / 2;
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', midQ));
      
      if (blob.size <= targetBytesPerPage) {
        bestBlob = blob;
        lowQ = midQ;
      } else {
        highQ = midQ;
        bestBlob = blob;
      }
    }

    const finalPageBlob = bestBlob || (await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.4)));
    const pageImgBytes = await finalPageBlob.arrayBuffer();

    const embeddedImage = await newPdfDoc.embedJpg(pageImgBytes);
    const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
  }

  onProgress?.(90, 'Finalizing compressed PDF...');
  const pdfBytes = await newPdfDoc.save({ useObjectStreams: true });
  const compressedBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

  const accuracy = Math.max(0, Math.min(100, Math.round((1 - Math.abs(compressedBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10));

  onProgress?.(100, 'PDF compression complete');
  return {
    blob: compressedBlob,
    accuracy,
    iterations,
  };
}
