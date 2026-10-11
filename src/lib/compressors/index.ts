import type { CompressionOptions, CompressionResult, SupportedCategory } from '../types';
import { compressImageToTarget } from './imageCompressor';
import { compressDocxToTarget } from './docxCompressor';
import { compressPdfToTarget } from './pdfCompressor';
import { compressSvgToTarget } from './svgCompressor';
import { convertDocxToPdf, convertPdfToDocx } from '../remoteConverter';

export function detectFileCategory(file: File): SupportedCategory {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === 'image/svg+xml' || name.endsWith('.svg')) {
    return 'svg';
  }

  if (
    type.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.avif') ||
    name.endsWith('.gif') ||
    name.endsWith('.bmp') ||
    name.endsWith('.ico')
  ) {
    return 'image';
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword' ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    return 'docx';
  }

  return 'unsupported';
}

export async function compressFile(
  file: File,
  options: CompressionOptions
): Promise<CompressionResult> {
  const category = detectFileCategory(file);
  const name = file.name.toLowerCase();

  // 1. PDF Handling: Either convert to Word (DOCX) or compress PDF
  if (category === 'pdf') {
    if (options.outputFormat === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      options.onProgress?.(25, 'Initiating high-fidelity PDF to Word conversion...');
      const docxBlob = await convertPdfToDocx(file, {
        apiUrl: options.remoteApiUrl,
        onProgress: (msg) => options.onProgress?.(60, msg),
      });
      options.onProgress?.(100, 'PDF to Word conversion complete');
      return {
        blob: docxBlob,
        accuracy: 100,
        iterations: 1,
      };
    }
    return compressPdfToTarget(file, options);
  }

  // 2. Word Document Handling: Either convert to PDF or compress DOCX
  if (category === 'docx') {
    // If output format is PDF or file is legacy binary .doc, use converter microservice
    if (options.outputFormat === 'application/pdf' || name.endsWith('.doc')) {
      options.onProgress?.(25, 'Initiating high-fidelity Word to PDF conversion via LibreOffice...');
      const pdfBlob = await convertDocxToPdf(file, {
        apiUrl: options.remoteApiUrl,
        onProgress: (msg) => options.onProgress?.(60, msg),
      });
      options.onProgress?.(100, 'Word to PDF conversion complete');
      return {
        blob: pdfBlob,
        accuracy: 100,
        iterations: 1,
      };
    }

    // Default: in-browser media compression for .docx
    return compressDocxToTarget(file, options);
  }

  // 3. SVG Handling
  if (category === 'svg') {
    return compressSvgToTarget(file, options);
  }

  // 4. Raster Image Handling
  if (category === 'image') {
    return compressImageToTarget(file, options);
  }

  throw new Error(
    `Unsupported file type (${file.type || 'unknown'}). Supported formats: JPG, PNG, WebP, AVIF, SVG, GIF, BMP, PDF, DOCX, and DOC.`
  );
}
