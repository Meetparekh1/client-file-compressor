/**
 * Centralized Security & Operational Limits
 * Protects against memory exhaustion, browser tab crashes, DoS, and runaway execution.
 */

// File upload limits
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB per file
export const MAX_TOTAL_BATCH_BYTES = 300 * 1024 * 1024; // 300 MB total batch queue
export const MAX_BATCH_FILE_COUNT = 100; // 100 files max per session
export const MAX_HTML_LENGTH = 1_000_000; // 1MB max raw HTML string length

// Page count limits for memory safety
export const MAX_PDF_PAGES = 300; // Maximum pages for general PDF operations (compress, merge, split)
export const MAX_OCR_PAGES = 50; // Maximum pages for compute-heavy OCR
export const MAX_PDF_TO_IMAGES_PAGES = 100; // Maximum pages for high-res canvas image extraction
export const MAX_MERGE_IMAGES_COUNT = 150; // Maximum images in single PDF consolidation

// Execution timeout limits (milliseconds)
export const TIMEOUT_COMPRESSION_MS = 60_000; // 60s
export const TIMEOUT_CONVERSION_MS = 90_000; // 90s
export const TIMEOUT_REMOTE_MS = 60_000; // 60s
export const TIMEOUT_HTML_RENDER_MS = 30_000; // 30s
export const TIMEOUT_OCR_PAGE_MS = 30_000; // 30s per page
export const TIMEOUT_GENERAL_MS = 60_000; // 60s

export class SecurityLimitError extends Error {
  readonly limitType: 'upload' | 'pages' | 'timeout';

  constructor(message: string, limitType: 'upload' | 'pages' | 'timeout') {
    super(message);
    this.name = 'SecurityLimitError';
    this.limitType = limitType;
  }
}

/**
 * Validates a file against maximum upload size limits.
 */
export function validateFileSize(file: File, maxBytes = MAX_FILE_SIZE_BYTES): void {
  if (file.size <= 0) {
    throw new SecurityLimitError(`File "${file.name}" is empty (0 bytes).`, 'upload');
  }
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new SecurityLimitError(
      `File "${file.name}" exceeds the maximum upload limit of ${maxMb}MB.`,
      'upload'
    );
  }
}

/**
 * Validates a batch of files against count and cumulative memory limits.
 */
export function validateBatchFiles(
  files: File[],
  maxCount = MAX_BATCH_FILE_COUNT,
  maxBytes = MAX_TOTAL_BATCH_BYTES
): void {
  if (files.length > maxCount) {
    throw new SecurityLimitError(
      `Batch contains ${files.length} files, which exceeds the maximum batch limit of ${maxCount} files per queue.`,
      'upload'
    );
  }

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  if (totalBytes > maxBytes) {
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new SecurityLimitError(
      `Total batch size (${totalMb}MB) exceeds the maximum batch size limit of ${maxMb}MB.`,
      'upload'
    );
  }
}

/**
 * Validates document page count against safety limits.
 */
export function validatePageCount(
  pageCount: number,
  maxPages = MAX_PDF_PAGES,
  toolName = 'This operation'
): void {
  if (pageCount <= 0) {
    throw new SecurityLimitError('Document contains no pages.', 'pages');
  }
  if (pageCount > maxPages) {
    throw new SecurityLimitError(
      `${toolName} is limited to ${maxPages} pages per session to prevent memory exhaustion (received ${pageCount} pages).`,
      'pages'
    );
  }
}

/**
 * Wraps a promise in an execution timeout to prevent runaway processing or deadlocks.
 */
export async function withExecutionTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new SecurityLimitError(
          `Operation "${operationName}" exceeded maximum execution time limit (${Math.round(
            timeoutMs / 1000
          )}s).`,
          'timeout'
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}
