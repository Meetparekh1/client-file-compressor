import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePageRangeString } from '../src/lib/pdfOperations';
import { compressFile, detectFileCategory } from '../src/lib/compressors';
import { parseFriendlyError, sanitizeErrorMessage } from '../src/lib/errorParser';
import {
  convertPdfToDocx,
  convertDocxToPdf,
  isValidConverterApiUrl,
  checkConverterHealth,
} from '../src/lib/remoteConverter';
import { setRemoteProcessingConsent } from '../src/lib/remoteConsent';

describe('Focused Unit Tests: src/lib Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. Range Parsing (parsePageRangeString)', () => {
    it('parses single pages, commas, and hyphenated ranges correctly', () => {
      const res = parsePageRangeString('1, 3-5, 8', 10);
      expect(res).toEqual([1, 3, 4, 5, 8]);
    });

    it('throws when page number exceeds totalPages', () => {
      expect(() => parsePageRangeString('2-4, 15', 5)).toThrow(
        /outside document range/i
      );
    });

    it('rejects invalid range orders and non-numeric formats', () => {
      expect(() => parsePageRangeString('5-3', 10)).toThrow(
        /Invalid page range/i
      );
      expect(() => parsePageRangeString('abc', 10)).toThrow(
        /outside document range/i
      );
      expect(() => parsePageRangeString('1-2-3', 10)).toThrow(
        /Invalid page range/i
      );
    });

    it('deduplicates duplicate page specifications and handles empty input', () => {
      const res = parsePageRangeString('1, 1, 2, 2-4', 5);
      expect(res).toEqual([1, 2, 3, 4]);
      expect(parsePageRangeString('', 10)).toEqual([]);
    });
  });

  describe('2. Compression Dispatch & Category Detection', () => {
    it('detects file categories accurately based on MIME and extensions', () => {
      expect(detectFileCategory(new File([], 'doc.pdf', { type: 'application/pdf' }))).toBe('pdf');
      expect(detectFileCategory(new File([], 'photo.png', { type: 'image/png' }))).toBe('image');
      expect(detectFileCategory(new File([], 'photo.webp', { type: 'image/webp' }))).toBe('image');
      expect(detectFileCategory(new File([], 'vector.svg', { type: 'image/svg+xml' }))).toBe('svg');
      expect(detectFileCategory(new File([], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toBe('docx');
      expect(detectFileCategory(new File([], 'legacy.doc', { type: 'application/msword' }))).toBe('docx');
      expect(detectFileCategory(new File([], 'unknown.xyz', { type: 'application/octet-stream' }))).toBe('unsupported');
    });

    it('rejects unsupported file formats during compression dispatch', async () => {
      const unsupportedFile = new File(['data'], 'archive.bin', { type: 'application/octet-stream' });
      await expect(
        compressFile(unsupportedFile, { targetSizeBytes: 50000 })
      ).rejects.toThrow(/unsupported file type/i);
    });

    it('rejects files exceeding MAX_FILE_SIZE_BYTES (100MB)', async () => {
      const oversizedFile = new File([], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversizedFile, 'size', { value: 105 * 1024 * 1024 });

      await expect(
        compressFile(oversizedFile, { targetSizeBytes: 1024 * 1024 })
      ).rejects.toThrow(/exceeds the maximum upload limit/i);
    });
  });

  describe('3. Error Parsing & Message Sanitization', () => {
    it('sanitizes local file system paths from error messages', () => {
      const raw = 'Failed at C:\\Users\\Administrator\\Documents\\secret.pdf: cannot read';
      const clean = sanitizeErrorMessage(raw);
      expect(clean).not.toContain('C:\\Users');
      expect(clean).toContain('[path-redacted]');
    });

    it('sanitizes Unix paths and credentials', () => {
      const raw = 'Error loading /Users/john/repo/test.pdf with token=secret123456';
      const clean = sanitizeErrorMessage(raw);
      expect(clean).not.toContain('/Users/john');
      expect(clean).toContain('[path-redacted]');
      expect(clean).toContain('token=[redacted]');
    });

    it('classifies remote consent errors properly', () => {
      const err = new Error('Remote consent is required before transmitting document to server');
      const parsed = parseFriendlyError(err);
      expect(parsed.category).toBe('consent');
      expect(parsed.title).toContain('Consent');
    });

    it('classifies password-protected documents accurately', () => {
      const err = new Error('PasswordException: Document is encrypted and requires a password');
      const parsed = parseFriendlyError(err);
      expect(parsed.category).toBe('encrypted');
      expect(parsed.title).toContain('Password Protected');
    });

    it('classifies out-of-memory errors with actionable advice', () => {
      const err = new Error('RangeError: Array buffer allocation failed out of memory');
      const parsed = parseFriendlyError(err);
      expect(parsed.category).toBe('memory');
      expect(parsed.title).toContain('Memory');
    });

    it('classifies corrupted PDF structures', () => {
      const err = new Error('InvalidPDFException: bad xref structure corrupt file');
      const parsed = parseFriendlyError(err);
      expect(parsed.category).toBe('corrupt');
    });
  });

  describe('4. Converter Failure & Health Handling', () => {
    it('validates permitted URL schemes for remote converter', () => {
      expect(isValidConverterApiUrl('http://localhost:7860')).toBe(true);
      expect(isValidConverterApiUrl('https://api.example.com/engine')).toBe(true);
      expect(isValidConverterApiUrl('javascript:alert(1)')).toBe(false);
      expect(isValidConverterApiUrl('file:///etc/passwd')).toBe(false);
      expect(isValidConverterApiUrl('ftp://example.com')).toBe(false);
      expect(isValidConverterApiUrl('not-a-url')).toBe(false);
    });

    it('checkConverterHealth returns false when server is unreachable or offline', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
      const isHealthy = await checkConverterHealth('http://localhost:9999');
      expect(isHealthy).toBe(false);
      vi.unstubAllGlobals();
    });

    it('checkConverterHealth returns true when health endpoint responds with 200 OK', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      const isHealthy = await checkConverterHealth('http://localhost:7860');
      expect(isHealthy).toBe(true);
      vi.unstubAllGlobals();
    });

    it('convertPdfToDocx rejects without remote consent when consent is required', async () => {
      const pdfFile = new File(['%PDF-1.4 dummy'], 'doc.pdf', { type: 'application/pdf' });
      await expect(
        convertPdfToDocx(pdfFile, { apiUrl: 'http://localhost:7860', skipConsentCheck: false })
      ).rejects.toThrow(/consent/i);
    });

    it('convertPdfToDocx handles remote HTTP 500 error gracefully', async () => {
      setRemoteProcessingConsent(true, 'http://localhost:7860');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({ detail: 'Conversion failed in LibreOffice worker' }),
          headers: new Headers(),
        })
      );

      const pdfFile = new File(['%PDF-1.4 dummy'], 'doc.pdf', { type: 'application/pdf' });
      await expect(
        convertPdfToDocx(pdfFile, { apiUrl: 'http://localhost:7860' })
      ).rejects.toThrow(/Conversion failed in LibreOffice worker/i);

      vi.unstubAllGlobals();
    });

    it('convertDocxToPdf handles empty 0-byte remote response error', async () => {
      setRemoteProcessingConsent(true, 'http://localhost:7860');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          blob: vi.fn().mockResolvedValue(new Blob([], { type: 'application/pdf' })),
        })
      );

      const docxFile = new File(['dummy docx'], 'doc.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(
        convertDocxToPdf(docxFile, { apiUrl: 'http://localhost:7860' })
      ).rejects.toThrow(/empty file/i);

      vi.unstubAllGlobals();
    });
  });
});
