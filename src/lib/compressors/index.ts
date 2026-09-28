import type { CompressionOptions, CompressionResult, SupportedCategory } from '../types';
import { compressImageToTarget } from './imageCompressor';
import { compressDocxToTarget } from './docxCompressor';
import { compressPdfToTarget } from './pdfCompressor';
import { compressSvgToTarget } from './svgCompressor';

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
    name.endsWith('.docx')
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

  if (name.endsWith('.doc')) {
    throw new Error(
      'Legacy binary .doc format cannot be processed client-side. Please re-save as modern .docx in Word or Google Docs.'
    );
  }

  switch (category) {
    case 'svg':
      return compressSvgToTarget(file, options);
    case 'image':
      return compressImageToTarget(file, options);
    case 'pdf':
      return compressPdfToTarget(file, options);
    case 'docx':
      return compressDocxToTarget(file, options);
    default:
      throw new Error(
        `Unsupported file type (${file.type || 'unknown'}). Supported formats: JPG, PNG, WebP, AVIF, SVG, GIF, BMP, PDF, and DOCX.`
      );
  }
}
