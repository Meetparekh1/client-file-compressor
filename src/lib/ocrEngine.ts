import { createWorker } from 'tesseract.js';
import { pdfjsLib } from './pdfjsClient';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { 
  validateFileSize, 
  validatePageCount, 
  MAX_OCR_PAGES, 
  withExecutionTimeout 
} from './securityLimits';
import { registerWorker, terminateWorker, cleanupCanvas } from './resourceManager';

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OcrPageResult {
  pageNum: number;
  text: string;
  confidence: number;
  words: OcrWord[];
  pageWidth: number;
  pageHeight: number;
  previewDataUrl?: string;
}

export interface OcrResult {
  text: string;
  pdfBlob?: Blob; // Searchable PDF with invisible text layer
  pages?: OcrPageResult[];
  overallConfidence?: number;
  totalWords?: number;
  language?: string;
  throughput?: {
    totalPages: number;
    totalCharacters: number;
    durationMs: number;
    pagesPerSecond: number;
    charsPerSecond: number;
  };
}

export interface OcrOptions {
  signal?: AbortSignal;
  language?: string;
  makeSearchablePdf?: boolean;
}

export const SUPPORTED_OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish (Español)' },
  { code: 'fra', label: 'French (Français)' },
  { code: 'deu', label: 'German (Deutsch)' },
  { code: 'ita', label: 'Italian (Italiano)' },
  { code: 'por', label: 'Portuguese (Português)' },
  { code: 'nld', label: 'Dutch (Nederlands)' },
  { code: 'chi_sim', label: 'Chinese Simplified (简体中文)' },
  { code: 'jpn', label: 'Japanese (日本語)' },
  { code: 'kor', label: 'Korean (한국어)' },
  { code: 'rus', label: 'Russian (Русский)' },
  { code: 'hin', label: 'Hindi (हिन्दी)' },
  { code: 'ara', label: 'Arabic (العربية)' },
  { code: 'eng+spa', label: 'English + Spanish' },
  { code: 'eng+fra', label: 'English + French' },
  { code: 'eng+deu', label: 'English + German' },
];

/**
 * Extracts words with bounding boxes from Tesseract recognition output.
 */
function extractWordsFromData(data: any): OcrWord[] {
  if (Array.isArray(data?.words) && data.words.length > 0) {
    return data.words.map((w: any) => ({
      text: w.text || '',
      confidence: typeof w.confidence === 'number' ? w.confidence : 80,
      bbox: w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
    }));
  }

  const words: OcrWord[] = [];
  if (Array.isArray(data?.blocks)) {
    for (const block of data.blocks) {
      if (Array.isArray(block?.paragraphs)) {
        for (const para of block.paragraphs) {
          if (Array.isArray(para?.lines)) {
            for (const line of para.lines) {
              if (Array.isArray(line?.words)) {
                for (const w of line.words) {
                  if (w?.text) {
                    words.push({
                      text: w.text,
                      confidence: typeof w.confidence === 'number' ? w.confidence : line.confidence || 80,
                      bbox: w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Fallback if no structured words found but text exists
  if (words.length === 0 && data?.text) {
    const rawWords = data.text.trim().split(/\s+/);
    for (const rw of rawWords) {
      if (rw) {
        words.push({
          text: rw,
          confidence: typeof data.confidence === 'number' ? data.confidence : 75,
          bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
        });
      }
    }
  }

  return words;
}

export async function ocrScannedPdf(
  file: File,
  onProgress?: (stage: string, percent: number) => void,
  options?: OcrOptions
): Promise<OcrResult> {
  validateFileSize(file);
  const timeoutMs = 180_000; // 3 minutes max total session

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

  const selectedLang = options?.language || 'eng';
  const makeSearchable = options?.makeSearchablePdf !== false;

  const ocrExecution = (async () => {
    onProgress?.(`Initializing OCR Engine (${selectedLang})...`, 5);
    
    // Set up tesseract worker with selected language
    const createdWorker = await createWorker(selectedLang, 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const p = Math.round(m.progress * 100);
          onProgress?.(`Extracting text (${selectedLang})...`, 30 + p * 0.6);
        }
      }
    });
    worker = registerWorker(createdWorker);

    if (signal?.aborted) {
      throw new DOMException('OCR extraction cancelled by user', 'AbortError');
    }

    // Load PDF
    onProgress?.('Loading PDF document...', 15);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    if (!numPages || numPages <= 0) {
      throw new Error('The PDF document contains no pages or is empty.');
    }

    validatePageCount(numPages, MAX_OCR_PAGES, 'OCR Engine');

    // Attempt to load PDF with pdf-lib to construct searchable invisible text layer
    let searchablePdfDoc: PDFDocument | null = null;
    let helveticaFont: any = null;
    if (makeSearchable) {
      try {
        searchablePdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        helveticaFont = await searchablePdfDoc.embedFont(StandardFonts.Helvetica);
      } catch {
        searchablePdfDoc = null;
      }
    }

    let fullText = '';
    const pageResults: OcrPageResult[] = [];
    let totalConfidenceSum = 0;
    let totalWordCount = 0;

    for (let i = 1; i <= numPages; i++) {
      if (signal?.aborted) {
        throw new DOMException('OCR extraction cancelled by user', 'AbortError');
      }

      onProgress?.(`Processing Page ${i}/${numPages}...`, 20 + ((i - 1) / numPages) * 70);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for high recognition accuracy
      
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

        const previewDataUrl = reusableCanvas.toDataURL('image/jpeg', 0.85);
        const imgData = reusableCanvas.toDataURL('image/png');
        const recognizeResult = await worker.recognize(imgData);
        const data = recognizeResult?.data || {};
        const pageText = (data.text || '').trim();
        const words = extractWordsFromData(data);
        const pageConfidence = typeof data.confidence === 'number' ? data.confidence : 80;

        fullText += `--- Page ${i} ---\n${pageText || '[No recognizable text detected on this page]'}\n\n`;
        totalConfidenceSum += pageConfidence;
        totalWordCount += words.length;

        pageResults.push({
          pageNum: i,
          text: pageText,
          confidence: Math.round(pageConfidence),
          words,
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          previewDataUrl,
        });

        // Add invisible searchable text layer to this page in the PDFDocument
        if (searchablePdfDoc && helveticaFont && i <= searchablePdfDoc.getPageCount()) {
          const pdfPage = searchablePdfDoc.getPage(i - 1);
          const { width: pWidth, height: pHeight } = pdfPage.getSize();
          const scaleX = pWidth / viewport.width;
          const scaleY = pHeight / viewport.height;

          for (const word of words) {
            const cleanWord = word.text.trim();
            if (!cleanWord) continue;

            const boxH = Math.max(1, (word.bbox.y1 - word.bbox.y0) * scaleY);
            const x = word.bbox.x0 * scaleX;
            // PDF origin is bottom-left, canvas is top-left
            const y = pHeight - (word.bbox.y1 * scaleY);
            const fontSize = Math.max(4, Math.min(72, boxH * 0.85));

            try {
              pdfPage.drawText(cleanWord, {
                x,
                y,
                size: fontSize,
                font: helveticaFont,
                opacity: 0, // Invisible searchable text layer!
              });
            } catch {
              // Ignore word drawing error for unsupported characters
            }
          }
        }
      } finally {
        page.cleanup();
      }
    }

    let resultPdfBlob: Blob | undefined;
    if (searchablePdfDoc) {
      try {
        const pdfBytes = await searchablePdfDoc.save();
        resultPdfBlob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      } catch (err) {
        console.warn('Could not compile searchable PDF blob:', err);
      }
    }
    
    onProgress?.('Finalizing searchable document...', 98);
    const durationMs = Math.max(1, performance.now() - startTime);
    const cleanedText = fullText.trim();
    const totalChars = cleanedText.length;
    const overallConfidence = numPages > 0 ? Math.round(totalConfidenceSum / numPages) : 0;

    onProgress?.('Done!', 100);

    return {
      text: cleanedText || 'No text could be extracted from this document.',
      pdfBlob: resultPdfBlob,
      pages: pageResults,
      overallConfidence,
      totalWords: totalWordCount,
      language: selectedLang,
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
