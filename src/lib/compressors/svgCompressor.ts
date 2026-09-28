import type { CompressionOptions, CompressionResult } from '../types';
import { compressImageToTarget } from './imageCompressor';

/**
 * Sanitizes SVG markup to strip potential XSS, XXE, and script execution vectors.
 * Purges <script>, event handlers, foreignObject/iframe, and dangerous URI schemes.
 */
export function sanitizeSvg(svgText: string): string {
  let clean = svgText;

  // 1. Remove XML External Entity (XXE) definitions & DTD declarations
  clean = clean.replace(/<!DOCTYPE[\s\S]*?(?:\[[\s\S]*?\]\s*)?>/gi, '');
  clean = clean.replace(/<!ENTITY[\s\S]*?>/gi, '');

  // 2. Remove script tags (both paired and self-closing)
  clean = clean.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<script\b[^>]*\/>/gi, '');

  // 3. Remove inline HTML/executable containers (foreignObject, iframe, object, embed, applet)
  clean = clean.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '');
  clean = clean.replace(/<foreignObject\b[^>]*\/>/gi, '');
  clean = clean.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
  clean = clean.replace(/<object\b[\s\S]*?<\/object>/gi, '');
  clean = clean.replace(/<embed\b[^>]*\/?>/gi, '');

  // 4. Remove inline DOM event handlers (e.g. onload, onclick, onerror, onmouseover)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 5. Neutralize dangerous script URIs in href and xlink:href
  clean = clean.replace(
    /\s+(?:href|xlink:href)\s*=\s*["']\s*(?:javascript|vbscript|data:text\/html)[\s\S]*?["']/gi,
    ' href="#"'
  );

  return clean;
}

/**
 * Minifies SVG code in browser without external dependencies.
 * Strips comments, metadata, unnecessary namespaces, and collapses spaces.
 */
export function minifySvgString(svgText: string): string {
  // First, apply security sanitization
  let minified = sanitizeSvg(svgText);

  // Remove XML comments
  minified = minified.replace(/<!--[\s\S]*?-->/g, '');

  // Remove XML declaration
  minified = minified.replace(/<\?xml[\s\S]*?\?>/i, '');

  // Remove <metadata>...</metadata> blocks
  minified = minified.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');

  // Remove empty attributes and unneeded editor namespace tags
  minified = minified.replace(/\s(xmlns:sketch|xmlns:inkscape|xmlns:sodipodi)="[^"]*"/gi, '');
  minified = minified.replace(/\s(sketch:type|inkscape:[a-z-]+|sodipodi:[a-z-]+)="[^"]*"/gi, '');

  // Round excessive floating point precision in numbers (e.g. 12.345678 -> 12.35)
  minified = minified.replace(/(\d+\.\d{3,})/g, (match) => {
    return parseFloat(parseFloat(match).toFixed(2)).toString();
  });

  // Collapse redundant whitespace
  minified = minified.replace(/>\s+</g, '><');
  minified = minified.replace(/\s{2,}/g, ' ');

  return minified.trim();
}

/**
 * Compresses or converts an SVG file client-side.
 * If user selected raster/PDF output, renders to canvas and converts.
 * Otherwise, performs text minification and respects target size.
 */
export async function compressSvgToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, onProgress, outputFormat } = options;

  onProgress?.(15, 'Reading SVG markup...');
  const text = await file.text();

  // If conversion to raster format (JPEG, WebP, PNG, AVIF, PDF) is requested:
  if (outputFormat && outputFormat !== 'original') {
    onProgress?.(30, `Rendering SVG to ${outputFormat.replace('image/', '').toUpperCase()}...`);
    const sanitizedText = sanitizeSvg(text);
    const svgBlob = new Blob([sanitizedText], { type: 'image/svg+xml' });
    return compressImageToTarget(svgBlob, options);
  }

  // Minify and sanitize SVG vector markup
  onProgress?.(50, 'Sanitizing and minifying vector paths...');
  const minified = minifySvgString(text);
  const minifiedBlob = new Blob([minified], { type: 'image/svg+xml' });

  // If minified blob is already smaller than or close to target
  if (minifiedBlob.size <= targetSizeBytes || targetSizeBytes >= file.size) {
    onProgress?.(100, 'SVG optimization complete');
    const accuracy = Math.max(
      0,
      Math.min(100, Math.round((1 - Math.abs(minifiedBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10)
    );
    return {
      blob: minifiedBlob,
      accuracy,
      iterations: 1,
    };
  }

  // If target size is still much smaller than minified SVG, render to WebP/PNG
  onProgress?.(70, 'Target requires rasterization for requested budget...');
  const rasterOptions: CompressionOptions = {
    ...options,
    outputFormat: 'image/webp',
  };
  const svgBlob = new Blob([minified], { type: 'image/svg+xml' });
  return compressImageToTarget(svgBlob, rasterOptions);
}
