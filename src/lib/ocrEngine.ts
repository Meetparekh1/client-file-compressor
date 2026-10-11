import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  validateFileSize, 
  validatePageCount, 
  MAX_OCR_PAGES, 
  withExecutionTimeout 
} from './securityLimits';

export async function ocrScannedPdf(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<{ text: string, pdfBlob?: Blob }> {
  validateFileSize(file);
  const timeoutMs = 120_000; // 2 minutes max total OCR session

  return withExecutionTimeout(
    (async () => {
      onProgress?.('Initializing OCR Engine...', 5);
      
      // Set up tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const p = Math.round(m.progress * 100);
            onProgress?.('Extracting text...', 30 + p * 0.6);
          }
        }
      });

      try {
        // Load PDF
        onProgress?.('Loading PDF...', 15);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        validatePageCount(numPages, MAX_OCR_PAGES, 'OCR Engine');

        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
          onProgress?.(`Processing Page ${i}/${numPages}...`, 20 + ((i - 1) / numPages) * 70);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // higher scale for better OCR
          
          // Render to canvas
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            page.cleanup();
            continue;
          }
          
          try {
            await page.render({ canvasContext: ctx, viewport }).promise;
            
            // Extract Image Data for OCR
            const imgData = canvas.toDataURL('image/png');
            const { data: { text } } = await worker.recognize(imgData);
            fullText += `--- Page ${i} ---\n${text}\n\n`;
          } finally {
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
          }
        }
        
        onProgress?.('Done!', 100);
        return { text: fullText.trim() };
      } finally {
        await worker.terminate();
      }
    })(),
    timeoutMs,
    'OCR Text Extraction'
  );
}
