/**
 * Resource Manager for deterministic cleanup and leak prevention:
 * - OCR workers (Tesseract.js workers)
 * - Object URLs (URL.createObjectURL / URL.revokeObjectURL)
 * - Temporary canvases (zeroing dimensions to release GPU textures)
 */

export interface TrackedWorker {
  terminate: () => Promise<unknown> | unknown;
}

const activeWorkers = new Set<TrackedWorker>();
const activeObjectUrls = new Set<string>();

/**
 * Registers an active worker (e.g. Tesseract or PDF worker) for tracking and guaranteed cleanup.
 */
export function registerWorker<T extends TrackedWorker>(worker: T): T {
  activeWorkers.add(worker);
  return worker;
}

/**
 * Terminates and unregisters a specific tracked worker.
 */
export async function terminateWorker(worker: TrackedWorker): Promise<void> {
  activeWorkers.delete(worker);
  try {
    await worker.terminate();
  } catch {
    // Ignore termination errors during cleanup
  }
}

/**
 * Terminates all currently tracked workers (e.g. on application unload or test teardown).
 */
export async function terminateAllWorkers(): Promise<void> {
  const workers = Array.from(activeWorkers);
  activeWorkers.clear();
  await Promise.allSettled(
    workers.map(async (w) => {
      try {
        await w.terminate();
      } catch {
        // Ignore termination errors
      }
    })
  );
}

/**
 * Returns the count of currently registered active workers.
 */
export function getActiveWorkerCount(): number {
  return activeWorkers.size;
}

/**
 * Creates and registers a tracked object URL.
 */
export function createTrackedObjectURL(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  activeObjectUrls.add(url);
  return url;
}

/**
 * Revokes a tracked object URL and removes it from active tracking.
 */
export function revokeTrackedObjectURL(url: string): void {
  activeObjectUrls.delete(url);
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore revoke errors in non-browser envs
  }
}

/**
 * Revokes all currently active tracked object URLs.
 */
export function revokeAllTrackedObjectURLs(): void {
  const urls = Array.from(activeObjectUrls);
  activeObjectUrls.clear();
  for (const url of urls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  }
}

/**
 * Returns the count of currently registered active object URLs.
 */
export function getActiveObjectURLCount(): number {
  return activeObjectUrls.size;
}

/**
 * Executes a callback with a temporary object URL, guaranteeing revocation in all exit paths.
 */
export async function withTemporaryObjectURL<T>(
  blob: Blob,
  fn: (url: string) => Promise<T> | T
): Promise<T> {
  const url = createTrackedObjectURL(blob);
  try {
    return await fn(url);
  } finally {
    revokeTrackedObjectURL(url);
  }
}

/**
 * Safely releases canvas memory by clearing context and resetting dimensions to 0.
 */
export function cleanupCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } catch {
    // Ignore
  }
  canvas.width = 0;
  canvas.height = 0;
}
