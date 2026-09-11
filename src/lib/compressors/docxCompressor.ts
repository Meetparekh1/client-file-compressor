import JSZip from 'jszip';
import type { CompressionOptions, CompressionResult } from '../types';
import { compressImageToTarget } from './imageCompressor';

/**
 * Compresses modern Word (.docx) files client-side.
 * Extracts embedded media from word/media, optimizes photos to fit the target size budget,
 * and recompresses the package with DEFLATE level 9.
 */
export async function compressDocxToTarget(
  file: File | Blob,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { targetSizeBytes, onProgress } = options;

  if (file.size <= targetSizeBytes) {
    onProgress?.(100, 'Already within target size');
    return {
      blob: file,
      accuracy: 100,
      iterations: 0,
    };
  }

  onProgress?.(10, 'Unpacking DOCX archive...');
  const zip = await JSZip.loadAsync(file);
  const mediaFolder = zip.folder('word/media');

  const mediaFiles: { path: string; file: JSZip.JSZipObject }[] = [];
  if (mediaFolder) {
    mediaFolder.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && /\.(jpe?g|png|webp|gif|bmp)$/i.test(relativePath)) {
        mediaFiles.push({ path: relativePath, file: zipEntry });
      }
    });
  }

  let iterations = 1;

  if (mediaFiles.length > 0) {
    onProgress?.(25, `Found ${mediaFiles.length} embedded media files to compress...`);
    
    // Calculate total size of media files to estimate target ratio
    let totalMediaBytes = 0;
    const loadedMedia: { path: string; blob: Blob; originalSize: number }[] = [];

    for (const item of mediaFiles) {
      const arrayBuffer = await item.file.async('arraybuffer');
      const ext = item.path.split('.').pop()?.toLowerCase() || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const blob = new Blob([arrayBuffer], { type: mime });
      totalMediaBytes += blob.size;
      loadedMedia.push({ path: item.path, blob, originalSize: blob.size });
    }

    // Target reduction factor needed
    const nonMediaOverhead = Math.max(20000, file.size - totalMediaBytes);
    const mediaBudget = Math.max(15000 * mediaFiles.length, targetSizeBytes - nonMediaOverhead);
    const targetScale = Math.min(0.9, mediaBudget / totalMediaBytes);

    for (let i = 0; i < loadedMedia.length; i++) {
      const item = loadedMedia[i];
      const progress = 25 + Math.round(((i + 1) / loadedMedia.length) * 50);
      onProgress?.(progress, `Compressing image ${i + 1}/${loadedMedia.length}...`);

      const targetImgBytes = Math.max(10000, Math.floor(item.originalSize * targetScale));
      if (item.originalSize > targetImgBytes) {
        try {
          const compResult = await compressImageToTarget(item.blob, {
            targetSizeBytes: targetImgBytes,
            tolerance: 0.05,
          });
          const newArrayBuffer = await compResult.blob.arrayBuffer();
          mediaFolder?.file(item.path, newArrayBuffer);
          iterations += compResult.iterations;
        } catch {
          // Fallback: keep original if image decode fails
        }
      }
    }
  } else {
    onProgress?.(40, 'No embedded raster media found. Applying maximum DEFLATE compression...');
  }

  onProgress?.(85, 'Re-bundling DOCX archive with maximum compression...');
  const compressedBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const accuracy = Math.max(0, Math.min(100, Math.round((1 - Math.abs(compressedBlob.size - targetSizeBytes) / targetSizeBytes) * 1000) / 10));

  onProgress?.(100, 'DOCX compression complete');
  return {
    blob: compressedBlob,
    accuracy,
    iterations,
  };
}
