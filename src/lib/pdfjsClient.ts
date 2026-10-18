import * as pdfjsLib from 'pdfjs-dist';

// Ensure PDF.js worker is initialized once globally with local bundled worker
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

export * from 'pdfjs-dist';
export { pdfjsLib };
export default pdfjsLib;
