import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerWorker,
  terminateWorker,
  terminateAllWorkers,
  getActiveWorkerCount,
  createTrackedObjectURL,
  revokeTrackedObjectURL,
  revokeAllTrackedObjectURLs,
  getActiveObjectURLCount,
  withTemporaryObjectURL,
  cleanupCanvas,
  type TrackedWorker,
} from '../src/lib/resourceManager';
import { ocrScannedPdf } from '../src/lib/ocrEngine';

// Mock tesseract.js and pdfjs-dist for OCR worker lifecycle verification
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

describe('Resource Cleanup & Leak Prevention Suite', () => {
  beforeEach(async () => {
    await terminateAllWorkers();
    revokeAllTrackedObjectURLs();
    vi.clearAllMocks();
  });

  describe('1. OCR Worker Lifecycle & Guaranteed Termination', () => {
    it('registers and terminates worker cleanly', async () => {
      let terminated = false;
      const mockWorker: TrackedWorker = {
        terminate: vi.fn().mockImplementation(async () => {
          terminated = true;
        }),
      };

      registerWorker(mockWorker);
      expect(getActiveWorkerCount()).toBe(1);

      await terminateWorker(mockWorker);
      expect(getActiveWorkerCount()).toBe(0);
      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(terminated).toBe(true);
    });

    it('terminates all tracked workers during cleanup', async () => {
      const workerA = { terminate: vi.fn().mockResolvedValue(true) };
      const workerB = { terminate: vi.fn().mockResolvedValue(true) };

      registerWorker(workerA);
      registerWorker(workerB);
      expect(getActiveWorkerCount()).toBe(2);

      await terminateAllWorkers();
      expect(getActiveWorkerCount()).toBe(0);
      expect(workerA.terminate).toHaveBeenCalledTimes(1);
      expect(workerB.terminate).toHaveBeenCalledTimes(1);
    });

    it('swallows errors when terminating faulty workers to guarantee full sweep', async () => {
      const faultyWorker = {
        terminate: vi.fn().mockRejectedValue(new Error('Process already destroyed')),
      };
      const healthyWorker = {
        terminate: vi.fn().mockResolvedValue(true),
      };

      registerWorker(faultyWorker);
      registerWorker(healthyWorker);

      await expect(terminateAllWorkers()).resolves.not.toThrow();
      expect(getActiveWorkerCount()).toBe(0);
      expect(faultyWorker.terminate).toHaveBeenCalledTimes(1);
      expect(healthyWorker.terminate).toHaveBeenCalledTimes(1);
    });

    it('guarantees worker termination in ocrScannedPdf even when PDF processing fails', async () => {
      const { createWorker } = await import('tesseract.js');
      const pdfjs = await import('pdfjs-dist');

      const mockWorker = {
        terminate: vi.fn().mockResolvedValue(true),
        recognize: vi.fn(),
      };
      vi.mocked(createWorker).mockResolvedValue(mockWorker as any);

      // Make PDF loading fail
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.reject(new Error('Corrupted PDF bytes')),
        destroy: vi.fn(),
      } as any);

      const fakeFile = new File(['%PDF-corrupt'], 'broken.pdf', { type: 'application/pdf' });

      await expect(ocrScannedPdf(fakeFile)).rejects.toThrow(/Corrupted PDF bytes/i);

      // Verify worker was properly terminated despite failure
      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(getActiveWorkerCount()).toBe(0);
    });
  });

  describe('2. Object URL Tracking & Revocation', () => {
    it('tracks created object URLs and revokes them explicitly', () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-1');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const blob = new Blob(['sample data'], { type: 'text/plain' });
      const url = createTrackedObjectURL(blob);

      expect(url).toBe('blob:http://localhost/mock-1');
      expect(getActiveObjectURLCount()).toBe(1);

      revokeTrackedObjectURL(url);
      expect(getActiveObjectURLCount()).toBe(0);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/mock-1');

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('revokes all active object URLs in bulk', () => {
      let counter = 0;
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++counter}`);
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const blob = new Blob(['data'], { type: 'text/plain' });
      createTrackedObjectURL(blob);
      createTrackedObjectURL(blob);
      createTrackedObjectURL(blob);

      expect(getActiveObjectURLCount()).toBe(3);

      revokeAllTrackedObjectURLs();
      expect(getActiveObjectURLCount()).toBe(0);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(3);

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('guarantees URL revocation via withTemporaryObjectURL even if callback throws', async () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temp-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const blob = new Blob(['temp content'], { type: 'text/plain' });

      await expect(
        withTemporaryObjectURL(blob, (_url) => {
          throw new Error('Failure during processing');
        })
      ).rejects.toThrow('Failure during processing');

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:temp-url');
      expect(getActiveObjectURLCount()).toBe(0);

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('3. Canvas Memory & Temporary Resource Disposal', () => {
    it('safely cleans up HTMLCanvasElement dimensions and 2D context', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;

      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(800);

      cleanupCanvas(canvas);

      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });

    it('handles null and undefined canvas references safely without throwing', () => {
      expect(() => cleanupCanvas(null)).not.toThrow();
      expect(() => cleanupCanvas(undefined)).not.toThrow();
    });
  });
});
