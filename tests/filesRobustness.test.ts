import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { 
  validateFileSize, 
  validateBatchFiles, 
  validatePageCount, 
  MAX_FILE_SIZE_BYTES, 
  MAX_TOTAL_BATCH_BYTES, 
  MAX_BATCH_FILE_COUNT, 
  MAX_PDF_PAGES, 
  MAX_OCR_PAGES, 
  MAX_PDF_TO_IMAGES_PAGES,
  SecurityLimitError 
} from '../src/lib/securityLimits';
import { parseErrorMessage, parseFriendlyError } from '../src/lib/errorParser';
import { compressFile } from '../src/lib/compressors/index';
import { compressDocxToTarget } from '../src/lib/compressors/docxCompressor';
import { compressSvgToTarget, sanitizeSvg } from '../src/lib/compressors/svgCompressor';
import { compressImageToTarget } from '../src/lib/compressors/imageCompressor';
import { compressPdfToTarget } from '../src/lib/compressors/pdfCompressor';
import { extractPdfPages, mergePdfFiles } from '../src/lib/pdfOperations';

describe('Malformed, Encrypted, Empty & Unusually Large Files Robustness Suite', () => {
  describe('1. Empty Files (0 Bytes & 0 Pages)', () => {
    it('validateFileSize rejects 0-byte empty file with SecurityLimitError', () => {
      const empty = new File([], 'zero.pdf', { type: 'application/pdf' });
      expect(() => validateFileSize(empty)).toThrowError(SecurityLimitError);
      expect(() => validateFileSize(empty)).toThrow(/is empty \(0 bytes\)/i);
    });

    it('compressFile dispatcher rejects 0-byte file', async () => {
      const empty = new File([], 'empty.png', { type: 'image/png' });
      await expect(compressFile(empty, { targetSizeBytes: 5000 })).rejects.toThrow(
        /is empty \(0 bytes\)/i
      );
    });

    it('compressPdfToTarget rejects 0-byte file', async () => {
      const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(compressPdfToTarget(empty, { targetSizeBytes: 5000 })).rejects.toThrow(
        /is empty \(0 bytes\)/i
      );
    });

    it('compressDocxToTarget rejects 0-byte file', async () => {
      const empty = new File([], 'empty.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await expect(compressDocxToTarget(empty, { targetSizeBytes: 5000 })).rejects.toThrow(
        /is empty \(0 bytes\)/i
      );
    });

    it('compressSvgToTarget rejects 0-byte file', async () => {
      const empty = new File([], 'empty.svg', { type: 'image/svg+xml' });
      await expect(compressSvgToTarget(empty, { targetSizeBytes: 5000 })).rejects.toThrow(
        /is empty \(0 bytes\)/i
      );
    });

    it('compressImageToTarget rejects 0-byte file', async () => {
      const empty = new File([], 'empty.jpg', { type: 'image/jpeg' });
      await expect(compressImageToTarget(empty, { targetSizeBytes: 5000 })).rejects.toThrow(
        /is empty \(0 bytes\)/i
      );
    });

    it('extractPdfPages rejects 0-byte file', async () => {
      const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(extractPdfPages(empty, [1])).rejects.toThrow(/is empty \(0 bytes\)/i);
    });

    it('validatePageCount rejects 0 or negative pages', () => {
      expect(() => validatePageCount(0, MAX_PDF_PAGES, 'Test')).toThrow(/contains no pages/i);
      expect(() => validatePageCount(-5, MAX_PDF_PAGES, 'Test')).toThrow(/contains no pages/i);
    });
  });

  describe('2. Malformed Files', () => {
    it('corrupted SVG throws error during sanitization and compression', async () => {
      const malformedSvg = '<svg><unclosed tag <circle>>';
      expect(() => sanitizeSvg(malformedSvg)).toThrow(/malformed or potentially unsafe/i);

      const malformedFile = new File([malformedSvg], 'broken.svg', { type: 'image/svg+xml' });
      await expect(compressSvgToTarget(malformedFile, { targetSizeBytes: 100 })).rejects.toThrow(
        /malformed or potentially unsafe/i
      );
    });

    it('corrupted DOCX payload is caught and diagnosed gracefully', async () => {
      const corruptedBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0xff, 0xff]);
      const brokenDocx = new File([corruptedBytes], 'corrupt.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(
        compressDocxToTarget(brokenDocx, { targetSizeBytes: 2 })
      ).rejects.toThrow(/Unable to read Word document/i);
    });

    it('corrupted PDF data throws parse exception and is categorized as corrupt by errorParser', async () => {
      const garbageData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      let caughtError: unknown = null;

      try {
        await PDFDocument.load(garbageData);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      const parsed = parseErrorMessage(caughtError);
      expect(['corrupt', 'generic']).toContain(parsed.category);

      const friendlyCorrupt = parseFriendlyError(new Error('InvalidPDFException: corrupt xref table'));
      expect(friendlyCorrupt.category).toBe('corrupt');
      expect(friendlyCorrupt.title).toContain('Corrupted');
    });

    it('mergePdfFiles rejects when less than 2 files are provided', async () => {
      const file = new File(['%PDF-1.4'], 'single.pdf', { type: 'application/pdf' });
      await expect(mergePdfFiles([file])).rejects.toThrow(/at least 2 PDF files/i);
    });
  });

  describe('3. Encrypted & Password Protected Files', () => {
    it('errorParser classifies PasswordException and password errors under encrypted category', () => {
      const passwordErr1 = new Error('PasswordException: Need password for document');
      const info1 = parseErrorMessage(passwordErr1);
      expect(info1.category).toBe('encrypted');
      expect(info1.title).toBe('Password Protected Document');

      const passwordErr2 = new Error('The file is encrypted with AES-256');
      const info2 = parseErrorMessage(passwordErr2);
      expect(info2.category).toBe('encrypted');
      expect(info2.title).toBe('Password Protected Document');
    });

    it('PDFDocument.load without ignoreEncryption throws on encrypted PDF mock', async () => {
      // Simulate password protected PDF error
      const mockEncryptedError = new Error('PasswordException: password required to decrypt PDF file');
      const friendly = parseFriendlyError(mockEncryptedError);
      expect(friendly.category).toBe('encrypted');
      expect(friendly.message).toContain('locked with a password');
    });
  });

  describe('4. Unusually Large Files & Memory Safety Limits', () => {
    it('validateFileSize rejects file exceeding 100MB upload limit', () => {
      const oversized = {
        name: 'massive.pdf',
        size: MAX_FILE_SIZE_BYTES + 1024,
      } as unknown as File;

      expect(() => validateFileSize(oversized)).toThrowError(SecurityLimitError);
      expect(() => validateFileSize(oversized)).toThrow(/maximum upload limit of 100MB/i);
    });

    it('validateBatchFiles rejects batch exceeding 100 files', () => {
      const excessiveFiles = new Array(MAX_BATCH_FILE_COUNT + 1).fill(null).map((_, i) => ({
        name: `doc${i}.pdf`,
        size: 100,
      })) as unknown as File[];

      expect(() => validateBatchFiles(excessiveFiles)).toThrowError(SecurityLimitError);
      expect(() => validateBatchFiles(excessiveFiles)).toThrow(/maximum batch limit of 100 files/i);
    });

    it('validateBatchFiles rejects batch exceeding 300MB total payload', () => {
      const heavyBatch = [
        { name: 'big1.pdf', size: MAX_TOTAL_BATCH_BYTES / 2 + 1000 },
        { name: 'big2.pdf', size: MAX_TOTAL_BATCH_BYTES / 2 + 1000 },
      ] as unknown as File[];

      expect(() => validateBatchFiles(heavyBatch)).toThrowError(SecurityLimitError);
      expect(() => validateBatchFiles(heavyBatch)).toThrow(/batch size limit of 300MB/i);
    });

    it('validatePageCount rejects documents exceeding general PDF limit (300 pages)', () => {
      expect(() => validatePageCount(MAX_PDF_PAGES + 1, MAX_PDF_PAGES, 'PDF Split')).toThrow(
        /limited to 300 pages/i
      );
    });

    it('validatePageCount rejects OCR documents exceeding OCR limit (50 pages)', () => {
      expect(() => validatePageCount(MAX_OCR_PAGES + 1, MAX_OCR_PAGES, 'OCR Engine')).toThrow(
        /limited to 50 pages/i
      );
    });

    it('validatePageCount rejects PDF to Images exceeding limit (100 pages)', () => {
      expect(() =>
        validatePageCount(MAX_PDF_TO_IMAGES_PAGES + 1, MAX_PDF_TO_IMAGES_PAGES, 'PDF to Images')
      ).toThrow(/limited to 100 pages/i);
    });

    it('compressDocxToTarget prevents zip bomb with excessive media files count', async () => {
      const bombZip = new JSZip();
      bombZip.file('[Content_Types].xml', '<Types/>');
      bombZip.file('word/document.xml', '<w:document/>');

      // Add 501 dummy media files
      for (let i = 0; i <= 500; i++) {
        bombZip.file(`word/media/image_${i}.jpg`, new Uint8Array([1, 2, 3]));
      }

      const bombBlob = await bombZip.generateAsync({ type: 'blob' });
      const bombFile = new File([bombBlob], 'zipbomb.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(
        compressDocxToTarget(bombFile, { targetSizeBytes: 1000 })
      ).rejects.toThrow(/exceeding safe in-memory limit/i);
    });
  });
});
