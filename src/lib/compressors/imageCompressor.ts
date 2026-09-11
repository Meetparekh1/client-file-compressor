import UPNG from 'upng-js';
import type { CompressionOptions, CompressionResult } from '../types';

/**
 * Helper to convert canvas to blob with promise
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Precision Image Compressor using Bisection / Binary Search algorithm
 * Reaches ~99% accuracy against user-defined target file size.
 */
export async function compressImageToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, tolerance = 0.02, onProgress } = options;
  
  if (file.size <= targetSizeBytes) {
    onProgress?.(100, 'Already within target size');
    return {
      blob: file,
      accuracy: 100,
      iterations: 0,
    };
  }

  onProgress?.(5, 'Decoding image...');
  const bitmap = await createImageBitmap(file);
  const origWidth = bitmap.width;
  const origHeight = bitmap.height;

  let currentWidth = origWidth;
  let currentHeight = origHeight;

  const canvas = document.createElement('canvas');
  canvas.width = currentWidth;
  canvas.height = currentHeight;
  let ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(bitmap, 0, 0, currentWidth, currentHeight);

  const isPNG = file.type === 'image/png';
  let mimeType = file.type || 'image/jpeg';
  if (!['image/jpeg', 'image/webp', 'image/png'].includes(mimeType)) {
    mimeType = 'image/jpeg';
  }

  // PNG Compression using UPNG color quantization
  if (isPNG) {
    return compressPNGWithTarget(canvas, targetSizeBytes, {
      origWidth,
      origHeight,
      onProgress,
      tolerance,
    });
  }

  // JPEG / WebP Compression with Bisection Algorithm
  let iterations = 0;
  const maxIterations = 8;
  let lowQ = 0.01;
  let highQ = 1.00;
  let bestBlob: Blob | null = null;
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

    // Keep candidate that is <= targetSizeBytes or has closest diff
    if (candidateSize <= targetSizeBytes && diff < bestDiff) {
      bestBlob = candidateBlob;
      bestDiff = diff;
    }

    // Check if within 98% - 100% of target
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

  // Phase 2: If even quality 0.01 is still larger than target, downscale dimensions
  if (!bestBlob || bestBlob.size > targetSizeBytes) {
    onProgress?.(75, 'Adjusting resolution to reach target...');
    let currentBlob = bestBlob || (await canvasToBlob(canvas, mimeType, 0.5));
    
    let scaleAttempts = 0;
    while (currentBlob.size > targetSizeBytes && scaleAttempts < 5) {
      scaleAttempts++;
      iterations++;
      
      // Calculate geometric scale ratio based on bytes surplus
      const areaRatio = targetSizeBytes / currentBlob.size;
      const linearRatio = Math.max(0.3, Math.min(0.9, Math.sqrt(areaRatio) * 0.96));
      
      currentWidth = Math.max(80, Math.floor(currentWidth * linearRatio));
      currentHeight = Math.max(80, Math.floor(currentHeight * linearRatio));

      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, currentWidth, currentHeight);

      // Binary search quality at this new resolution (3 quick steps)
      lowQ = 0.2;
      highQ = 0.9;
      for (let s = 0; s < 3; s++) {
        iterations++;
        const testQ = (lowQ + highQ) / 2;
        const testBlob = await canvasToBlob(canvas, mimeType, testQ);
        if (testBlob.size <= targetSizeBytes) {
          bestBlob = testBlob;
          lowQ = testQ;
        } else {
          highQ = testQ;
        }
      }

      currentBlob = bestBlob || (await canvasToBlob(canvas, mimeType, 0.7));
    }
  }

  const finalBlob = bestBlob || (await canvasToBlob(canvas, mimeType, 0.05));
  const accuracy = Math.max(0, Math.min(100, Math.round((1 - Math.abs(finalBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10));

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

  // Palette color steps to try
  const colorSteps = [256, 128, 64, 32, 16];
  let bestBlob: Blob | null = null;
  let currentWidth = canvas.width;
  let currentHeight = canvas.height;

  for (let i = 0; i < colorSteps.length; i++) {
    iterations++;
    const colors = colorSteps[i];
    onProgress?.(30 + i * 12, `Quantizing PNG to ${colors} colors...`);

    const imgData = ctx.getImageData(0, 0, currentWidth, currentHeight);
    const pngBuffer = UPNG.encode([imgData.data.buffer], currentWidth, currentHeight, colors);
    const candidateBlob = new Blob([pngBuffer], { type: 'image/png' });

    if (candidateBlob.size <= targetSizeBytes) {
      bestBlob = candidateBlob;
      break;
    }
    bestBlob = candidateBlob;
  }

  // If still too large, downscale canvas dimensions
  if (bestBlob && bestBlob.size > targetSizeBytes) {
    onProgress?.(80, 'Scaling PNG resolution for target size...');
    const scale = Math.max(0.3, Math.min(0.85, Math.sqrt(targetSizeBytes / bestBlob.size) * 0.95));
    currentWidth = Math.max(64, Math.floor(currentWidth * scale));
    currentHeight = Math.max(64, Math.floor(currentHeight * scale));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentWidth;
    tempCanvas.height = currentHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (tempCtx) {
      tempCtx.drawImage(canvas, 0, 0, currentWidth, currentHeight);
      const imgData = tempCtx.getImageData(0, 0, currentWidth, currentHeight);
      const pngBuffer = UPNG.encode([imgData.data.buffer], currentWidth, currentHeight, 64);
      bestBlob = new Blob([pngBuffer], { type: 'image/png' });
      iterations++;
    }
  }

  const finalBlob = bestBlob || (await canvasToBlob(canvas, 'image/png'));
  const accuracy = Math.max(0, Math.min(100, Math.round((1 - Math.abs(finalBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10));

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
