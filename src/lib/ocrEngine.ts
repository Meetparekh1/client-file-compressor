import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  validateFileSize, 
  validatePageCount, 
  MAX_OCR_PAGES, 
  withExecutionTimeout 
} from './securityLimits';
import { registerWorker, terminateWorker, cleanupCanvas } from './resourceManager';

export interface OcrResult {
  text: string;
  pdfBlob?: Blob;
  throughput?: {
    totalPages: number;
    totalCharacters: number;
    durationMs: number;
    pagesPerSecond: number;
    charsPerSecond: number;
  };
}

export async function ocrScannedPdf(
  file: File,
  onProgress?: (stage: string, percent: number) => void,
  options?: { signal?: AbortSignal }
): Promise<OcrResult> {
  validateFileSize(file);
  const timeoutMs = 120_000; // 2 minutes max total OCR session

  // Validate input type and structure upfront
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Invalid file format. Please upload a valid PDF document for OCR processing.');
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let pdf: any = null;
  let reusableCanvas: HTMLCanvasElement | null = null;
  const startTime = performance.now();

  const signal = options?.signal;
  if (signal?.aborted) {
    throw new DOMException('OCR extraction cancelled by user', 'AbortError');
  }

  const ocrExecution = (async () => {
    onProgress?.('Initializing OCR Engine...', 5);
    
    // Set up tesseract worker
    const createdWorker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const p = Math.round(m.progress * 100);
          onProgress?.('Extracting text...', 30 + p * 0.6);
        }
      }
    });
    worker = registerWorker(createdWorker);

    if (signal?.aborted) {
      throw new DOMException('OCR extraction cancelled by user', 'AbortError');
    }

    // Load PDF
    onProgress?.('Loading PDF...', 15);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    if (!numPages || numPages <= 0) {
      throw new Error('The PDF document contains no pages or is empty.');
    }

    validatePageCount(numPages, MAX_OCR_PAGES, 'OCR Engine');

    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      if (signal?.aborted) {
        throw new DOMException('OCR extraction cancelled by user', 'AbortError');
      }

      onProgress?.(`Processing Page ${i}/${numPages}...`, 20 + ((i - 1) / numPages) * 70);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // higher scale for better OCR
      
      if (!reusableCanvas) {
        reusableCanvas = document.createElement('canvas');
      }
      reusableCanvas.width = viewport.width;
      reusableCanvas.height = viewport.height;
      const ctx = reusableCanvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        continue;
      }
      
      try {
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        if (signal?.aborted) {
          throw new DOMException('OCR extraction cancelled by user', 'AbortError');
        }

        // Extract Image Data for OCR
        const imgData = reusableCanvas.toDataURL('image/png');
        const { data: { text } } = await worker.recognize(imgData);
        const trimmedPageText = (text || '').trim();
        fullText += `--- Page ${i} ---\n${trimmedPageText || '[No recognizable text detected on this page]'}\n\n`;
      } finally {
        page.cleanup();
      }
    }
    
    onProgress?.('Done!', 100);
    const durationMs = Math.max(1, performance.now() - startTime);
    const cleanedText = fullText.trim();
    const totalChars = cleanedText.length;

    return {
      text: cleanedText || 'No text could be extracted from this document.',
      throughput: {
        totalPages: numPages,
        totalCharacters: totalChars,
        durationMs: Math.round(durationMs),
        pagesPerSecond: parseFloat(((numPages / durationMs) * 1000).toFixed(2)),
        charsPerSecond: parseFloat(((totalChars / durationMs) * 1000).toFixed(1)),
      },
    };
  })();

  try {
    return await withExecutionTimeout(ocrExecution, timeoutMs, 'OCR Text Extraction');
  } finally {
    if (reusableCanvas) {
      cleanupCanvas(reusableCanvas);
    }
    try {
      if (pdf) {
        await pdf.destroy();
      }
    } catch {
      // Ignore PDF destruction errors
    }
    if (worker) {
      await terminateWorker(worker);
      worker = null;
    }
  }
}
