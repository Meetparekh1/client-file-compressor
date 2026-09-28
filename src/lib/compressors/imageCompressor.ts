import UPNG from 'upng-js';
import { PDFDocument } from 'pdf-lib';
import type { CompressionOptions, CompressionResult } from '../types';

/**
 * Helper to convert canvas to blob with promise and AVIF fallback
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // If AVIF was requested but browser generated PNG fallback due to lack of support:
          if (mimeType === 'image/avif' && blob.type !== 'image/avif') {
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) resolve(fallbackBlob);
                else resolve(blob);
              },
              'image/webp',
              quality
            );
          } else {
            resolve(blob);
          }
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Universal image decoder supporting ImageBitmap with HTMLImageElement fallback (for SVG/BMP/ICO)
 */
async function decodeImage(file: File | Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void;
  cleanup?: () => void;
}> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(bitmap, dx, dy, dw, dh),
      cleanup: () => {
        try {
          bitmap.close();
        } catch {
          // Ignore
        }
      },
    };
  } catch {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width || 800,
          height: img.naturalHeight || img.height || 600,
          draw: (ctx, dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh),
          cleanup: () => {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // Ignore
            }
          },
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to decode image format'));
      };
      img.src = url;
    });
  }
}

/**
 * Helper to draw rotated and/or scaled image onto canvas
 */
function drawTransformedImage(
  ctx: CanvasRenderingContext2D,
  imageObj: { draw: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void },
  width: number,
  height: number,
  rotation = 0
) {
  if (rotation !== 0) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const isRotated90or270 = rotation === 90 || rotation === 270;
    const drawW = isRotated90or270 ? height : width;
    const drawH = isRotated90or270 ? width : height;
    imageObj.draw(ctx, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  } else {
    imageObj.draw(ctx, 0, 0, width, height);
  }
}

/**
 * Precision Image Compressor using Bisection / Binary Search algorithm.
 * Reaches ~99% accuracy against user-defined target file size.
 * Supports AVIF, WebP, JPEG, PNG, Image -> PDF conversion, and resolution downscaling.
 */
export async function compressImageToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, tolerance = 0.02, onProgress, rotation = 0, maxWidth, outputFormat } = options;

  onProgress?.(5, 'Decoding image stream...');
  const decoded = await decodeImage(file);
  const origWidth = decoded.width;
  const origHeight = decoded.height;

  const isRotated90or270 = rotation === 90 || rotation === 270;
  let baseWidth = isRotated90or270 ? origHeight : origWidth;
  let baseHeight = isRotated90or270 ? origWidth : origHeight;

  // Max width downscaling if configured
  if (maxWidth && baseWidth > maxWidth) {
    const scale = maxWidth / baseWidth;
    baseWidth = Math.max(32, Math.floor(maxWidth));
    baseHeight = Math.max(32, Math.floor(baseHeight * scale));
  }

  // Security: Protection against Canvas Dimension & GPU Memory bombs (16384px limit)
  const MAX_CANVAS_DIMENSION = 16384;
  if (baseWidth > MAX_CANVAS_DIMENSION || baseHeight > MAX_CANVAS_DIMENSION) {
    const maxDimScale = Math.min(MAX_CANVAS_DIMENSION / baseWidth, MAX_CANVAS_DIMENSION / baseHeight);
    baseWidth = Math.max(32, Math.floor(baseWidth * maxDimScale));
    baseHeight = Math.max(32, Math.floor(baseHeight * maxDimScale));
  }

  let currentWidth = baseWidth;
  let currentHeight = baseHeight;

  const canvas = document.createElement('canvas');
  canvas.width = currentWidth;
  canvas.height = currentHeight;
  let ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    decoded.cleanup?.();
    throw new Error('Could not get canvas context');
  }

  try {
    drawTransformedImage(ctx, decoded, currentWidth, currentHeight, rotation);

  // Conversion Mode: Image -> PDF
  if (outputFormat === 'application/pdf') {
    onProgress?.(40, 'Converting image to PDF document...');
    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
    const jpegBuffer = await jpegBlob.arrayBuffer();

    const pdfDoc = await PDFDocument.create();
    const embeddedImage = await pdfDoc.embedJpg(jpegBuffer);
    const page = pdfDoc.addPage([currentWidth, currentHeight]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: currentWidth,
      height: currentHeight,
    });

    onProgress?.(85, 'Finalizing PDF package...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

    onProgress?.(100, 'Image to PDF conversion complete');
    return {
      blob: pdfBlob,
      accuracy: 100,
      iterations: 1,
      originalWidth: origWidth,
      originalHeight: origHeight,
      newWidth: currentWidth,
      newHeight: currentHeight,
    };
  }

  // Determine output MIME type
  let mimeType = outputFormat && outputFormat !== 'original'
    ? outputFormat
    : (file.type || 'image/jpeg');

  if (!['image/jpeg', 'image/webp', 'image/png', 'image/avif'].includes(mimeType)) {
    mimeType = 'image/jpeg';
  }

  const isPNG = mimeType === 'image/png';

  // Fast path: if no transforms were requested and file is already smaller than target
  if (file.size <= targetSizeBytes && rotation === 0 && !maxWidth && (!outputFormat || outputFormat === 'original')) {
    onProgress?.(100, 'Already within target size');
    return {
      blob: file,
      accuracy: 100,
      iterations: 0,
      originalWidth: origWidth,
      originalHeight: origHeight,
      newWidth: origWidth,
      newHeight: origHeight,
    };
  }

  // PNG Compression using UPNG color quantization
  if (isPNG) {
    return await compressPNGWithTarget(canvas, targetSizeBytes, {
      origWidth,
      origHeight,
      onProgress,
      tolerance,
    });
  }

  // JPEG / WebP / AVIF Compression with Bisection Algorithm
  let iterations = 0;
  const maxIterations = 8;
  let lowQ = 0.01;
  let highQ = 1.00;
  let bestBlob: Blob | null = null;
  let minCandidateBlob: Blob | null = null;
  let bestDiff = Infinity;

  // Phase 1: Binary search on Quality
  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    const midQ = (lowQ + highQ) / 2;
    const progressPercent = Math.round(15 + (i / maxIterations) * 55);
    onProgress?.(progressPercent, `Refining quality: ${Math.round(midQ * 100)}% (Step ${i + 1}/${maxIterations})`);

    const candidateBlob = await canvasToBlob(canvas, mimeType, midQ);
    const candidateSize = candidateBlob.size;
    const diff = Math.abs(candidateSize - targetSizeBytes);

    if (!minCandidateBlob || candidateSize < minCandidateBlob.size) {
      minCandidateBlob = candidateBlob;
    }

    if (candidateSize <= targetSizeBytes && diff < bestDiff) {
      bestBlob = candidateBlob;
      bestDiff = diff;
    }

    const ratio = candidateSize / targetSizeBytes;
    if (ratio >= (1 - tolerance) && ratio <= 1.0) {
      bestBlob = candidateBlob;
      break;
    }

    if (candidateSize > targetSizeBytes) {
      highQ = midQ;
    } else {
      lowQ = midQ;
    }
  }

  // Phase 2: If lowest quality is still larger than target, downscale dimensions
  if (!bestBlob || bestBlob.size > targetSizeBytes) {
    onProgress?.(75, 'Adjusting resolution to reach target...');
    let currentBlob = bestBlob || minCandidateBlob || (await canvasToBlob(canvas, mimeType, 0.05));

    let scaleAttempts = 0;
    while (currentBlob.size > targetSizeBytes && scaleAttempts < 5) {
      scaleAttempts++;
      iterations++;

      const areaRatio = targetSizeBytes / currentBlob.size;
      const linearRatio = Math.max(0.25, Math.min(0.88, Math.sqrt(areaRatio) * 0.95));

      currentWidth = Math.max(48, Math.floor(currentWidth * linearRatio));
      currentHeight = Math.max(48, Math.floor(currentHeight * linearRatio));

      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) break;

      drawTransformedImage(ctx, decoded, currentWidth, currentHeight, rotation);

      lowQ = 0.05;
      highQ = 0.85;
      for (let s = 0; s < 3; s++) {
        iterations++;
        const testQ = (lowQ + highQ) / 2;
        const testBlob = await canvasToBlob(canvas, mimeType, testQ);

        if (!minCandidateBlob || testBlob.size < minCandidateBlob.size) {
          minCandidateBlob = testBlob;
        }

        if (testBlob.size <= targetSizeBytes) {
          bestBlob = testBlob;
          lowQ = testQ;
        } else {
          highQ = testQ;
        }
      }

      currentBlob = bestBlob || minCandidateBlob || (await canvasToBlob(canvas, mimeType, 0.4));
    }
  }

  const finalBlob = bestBlob || minCandidateBlob || (await canvasToBlob(canvas, mimeType, 0.05));
  const accuracy = Math.max(
    0,
    Math.min(100, Math.round((1 - Math.abs(finalBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10)
  );

    onProgress?.(100, 'Completed');
    return {
      blob: finalBlob,
      accuracy,
      iterations,
      originalWidth: origWidth,
      originalHeight: origHeight,
      newWidth: currentWidth,
      newHeight: currentHeight,
    };
  } finally {
    decoded.cleanup?.();
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Specialized PNG quantization and target compressor
 */
async function compressPNGWithTarget(
  canvas: HTMLCanvasElement,
  targetSizeBytes: number,
  options: {
    origWidth: number;
    origHeight: number;
    onProgress?: (progress: number, note?: string) => void;
    tolerance: number;
  }
): Promise<CompressionResult> {
  const { origWidth, origHeight, onProgress } = options;
  let iterations = 0;

  onProgress?.(20, 'Analyzing PNG color palette...');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context missing');

  const colorSteps = [256, 128, 64, 32, 16];
  let bestBlob: Blob | null = null;
  let minBlob: Blob | null = null;
  let currentWidth = canvas.width;
  let currentHeight = canvas.height;

  for (let i = 0; i < colorSteps.length; i++) {
    iterations++;
    const colors = colorSteps[i];
    onProgress?.(30 + i * 10, `Quantizing PNG (${colors} colors)...`);

    const imgData = ctx.getImageData(0, 0, currentWidth, currentHeight);
    const pngBuffer = UPNG.encode([imgData.data.buffer], currentWidth, currentHeight, colors);
    const candidateBlob = new Blob([pngBuffer], { type: 'image/png' });

    if (!minBlob || candidateBlob.size < minBlob.size) {
      minBlob = candidateBlob;
    }

    if (candidateBlob.size <= targetSizeBytes) {
      bestBlob = candidateBlob;
      break;
    }
  }

  let activeBlob = bestBlob || minBlob;
  let scaleRounds = 0;
  while (activeBlob && activeBlob.size > targetSizeBytes && scaleRounds < 3) {
    scaleRounds++;
    iterations++;
    onProgress?.(75 + scaleRounds * 7, `Scaling resolution for target size...`);

    const scale = Math.max(0.3, Math.min(0.85, Math.sqrt(targetSizeBytes / activeBlob.size) * 0.95));
    currentWidth = Math.max(48, Math.floor(currentWidth * scale));
    currentHeight = Math.max(48, Math.floor(currentHeight * scale));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentWidth;
    tempCanvas.height = currentHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0, currentWidth, currentHeight);
      const imgData = tempCtx.getImageData(0, 0, currentWidth, currentHeight);
      const pngBuffer = UPNG.encode([imgData.data.buffer], currentWidth, currentHeight, 64);
      tempCanvas.width = 0;
      tempCanvas.height = 0;
      activeBlob = new Blob([pngBuffer], { type: 'image/png' });
      if (activeBlob.size <= targetSizeBytes) {
        bestBlob = activeBlob;
        break;
      }
    }
  }

  const finalBlob = bestBlob || activeBlob || (await canvasToBlob(canvas, 'image/png'));
  const accuracy = Math.max(
    0,
    Math.min(100, Math.round((1 - Math.abs(finalBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10)
  );

  onProgress?.(100, 'Completed');
  return {
    blob: finalBlob,
    accuracy,
    iterations,
    originalWidth: origWidth,
    originalHeight: origHeight,
    newWidth: currentWidth,
    newHeight: currentHeight,
  };
}
