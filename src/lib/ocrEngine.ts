import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

export async function ocrScannedPdf(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<{ text: string, pdfBlob?: Blob }> {
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

  // Load PDF
  onProgress?.('Loading PDF...', 15);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`Processing Page ${i}/${numPages}...`, 20 + ((i - 1) / numPages) * 10);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // higher scale for better OCR
    
    // Render to canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    // Extract Image Data for OCR
    const imgData = canvas.toDataURL('image/png');
    
    const { data: { text } } = await worker.recognize(imgData);
    fullText += `--- Page ${i} ---\n${text}\n\n`;

    // Optionally overlay invisible text on a new PDF or just return text.
    // For simplicity of this feature, we create a new PDF with the text printed, 
    // or just return the extracted text and let the user copy/export to Word.
    // Here we will just output the raw text and return a plain text doc.
  }
  
  await worker.terminate();
  onProgress?.('Done!', 100);

  return { text: fullText.trim() };
}
