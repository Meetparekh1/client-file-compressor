import type { CompressionOptions, CompressionResult } from '../types';
import { compressImageToTarget } from './imageCompressor';

/**
 * Safely removes a node from its parent.
 */
function removeNode(node: Node): void {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

/**
 * Recursively strips all XML comments from the DOM tree.
 * Replaces regex comment matching to resolve CodeQL js/incomplete-multi-character-sanitization.
 */
function stripComments(root: Node): void {
  if (typeof document === 'undefined') return;
  const iterator = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  let current = iterator.nextNode();
  while (current) {
    comments.push(current as Comment);
    current = iterator.nextNode();
  }
  for (const comment of comments) {
    removeNode(comment);
  }
}

/**
 * Security: DOM-based sanitizer for SVG documents.
 * Traverses the parsed XML DOM tree to remove executable elements (<script>, <foreignObject>, etc.),
 * inline event handlers (on*), script URIs, and dangerous namespaces.
 * Fully eliminates regex HTML/SVG parsing anti-patterns (CWE-20, CWE-80).
 */
export function sanitizeSvgDocument(doc: Document): void {
  // 1. Remove XML comments
  stripComments(doc);

  // 2. Remove dangerous executable / embedding elements
  const DANGEROUS_TAGS = [
    'script',
    'foreignobject',
    'iframe',
    'object',
    'embed',
    'applet',
    'meta',
    'link',
  ];

  for (const tag of DANGEROUS_TAGS) {
    const elements = Array.from(doc.getElementsByTagName(tag));
    for (const el of elements) {
      removeNode(el);
    }
  }

  // 3. Remove metadata elements
  const metadataElements = Array.from(doc.getElementsByTagName('metadata'));
  for (const meta of metadataElements) {
    removeNode(meta);
  }

  // 4. Clean attributes across all elements in the SVG DOM
  const allElements = Array.from(doc.getElementsByTagName('*'));
  for (const el of allElements) {
    const attributesToRemove: string[] = [];

    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.trim().toLowerCase();

      // Block inline event handlers (e.g. onload, onclick, onerror)
      if (attrName.startsWith('on')) {
        attributesToRemove.push(attr.name);
        continue;
      }

      // Neutralize dangerous script URIs in href and xlink:href
      if (attrName === 'href' || attrName.endsWith(':href')) {
        if (
          attrValue.startsWith('javascript:') ||
          attrValue.startsWith('vbscript:') ||
          attrValue.startsWith('data:text/html')
        ) {
          attributesToRemove.push(attr.name);
          continue;
        }
      }

      // Strip unneeded editor namespace tags and editor properties
      if (
        attrName.startsWith('xmlns:sketch') ||
        attrName.startsWith('xmlns:inkscape') ||
        attrName.startsWith('xmlns:sodipodi') ||
        attrName.startsWith('sketch:') ||
        attrName.startsWith('inkscape:') ||
        attrName.startsWith('sodipodi:')
      ) {
        attributesToRemove.push(attr.name);
      }
    }

    for (const name of attributesToRemove) {
      el.removeAttribute(name);
    }
  }
}

/**
 * Sanitizes SVG markup using native browser DOMParser instead of regular expressions.
 */
export function sanitizeSvg(svgText: string): string {
  if (typeof DOMParser === 'undefined') return svgText;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      // Fallback: parse via text/html if XML parser encountered minor syntax variance
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(svgText, 'text/html');
      const svgEl = htmlDoc.querySelector('svg');
      if (svgEl) {
        const newDoc = parser.parseFromString(svgEl.outerHTML, 'image/svg+xml');
        sanitizeSvgDocument(newDoc);
        return new XMLSerializer().serializeToString(newDoc);
      }
    }

    sanitizeSvgDocument(doc);
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgText;
  }
}

/**
 * Prepares SVG text for safe canvas rendering by ensuring xmlns and explicit width/height
 * are properly declared on the root <svg> element.
 */
export function prepareSvgForCanvas(svgText: string): { text: string; width: number; height: number } {
  let width = 800;
  let height = 600;

  if (typeof DOMParser === 'undefined') {
    return { text: svgText, width, height };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    sanitizeSvgDocument(doc);

    const svgEl = doc.querySelector('svg');
    if (svgEl) {
      if (!svgEl.getAttribute('xmlns')) {
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      // Check existing width and height
      const wAttr = svgEl.getAttribute('width');
      const hAttr = svgEl.getAttribute('height');
      const parsedW = wAttr ? parseFloat(wAttr) : NaN;
      const parsedH = hAttr ? parseFloat(hAttr) : NaN;

      if (!isNaN(parsedW) && parsedW > 0 && !isNaN(parsedH) && parsedH > 0) {
        width = parsedW;
        height = parsedH;
      } else {
        // Parse viewBox (e.g. "0 0 1200 800")
        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            width = parts[2];
            height = parts[3];
            svgEl.setAttribute('width', width.toString());
            svgEl.setAttribute('height', height.toString());
          }
        } else {
          svgEl.setAttribute('width', width.toString());
          svgEl.setAttribute('height', height.toString());
        }
      }

      const serializer = new XMLSerializer();
      const text = serializer.serializeToString(doc);
      return { text, width, height };
    }
  } catch {
    // If parsing fails, return sanitized text fallback
  }

  return { text: sanitizeSvg(svgText), width, height };
}

/**
 * Minifies SVG vector code by DOM sanitization and inter-tag whitespace compaction.
 */
export function minifySvgString(svgText: string): string {
  const sanitized = sanitizeSvg(svgText);
  // Safely collapse inter-tag whitespace
  return sanitized.replace(/>\s+</g, '><').trim();
}

/**
 * Compresses or converts an SVG file client-side.
 * - If user selected raster/PDF output, renders to canvas and converts.
 * - Otherwise, performs clean vector minification and respects vector format.
 */
export async function compressSvgToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, onProgress, outputFormat } = options;

  onProgress?.(15, 'Reading SVG markup...');
  const text = await file.text();

  // If conversion to raster/document format (JPEG, WebP, PNG, AVIF, PDF) is requested:
  if (outputFormat && outputFormat !== 'original') {
    onProgress?.(30, `Rendering SVG to ${outputFormat.replace('image/', '').replace('application/', '').toUpperCase()}...`);
    const prepared = prepareSvgForCanvas(text);
    const svgBlob = new Blob([prepared.text], { type: 'image/svg+xml' });
    return compressImageToTarget(svgBlob, options);
  }

  // Minify and sanitize SVG vector markup
  onProgress?.(50, 'Sanitizing and minifying vector paths via DOM tree...');
  const minified = minifySvgString(text);
  const minifiedBlob = new Blob([minified], { type: 'image/svg+xml' });

  onProgress?.(100, 'SVG vector optimization complete');
  const accuracy = Math.max(
    0,
    Math.min(100, Math.round((1 - Math.abs(minifiedBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10)
  );

  return {
    blob: minifiedBlob,
    accuracy: minifiedBlob.size <= targetSizeBytes ? 100 : accuracy,
    iterations: 1,
  };
}
