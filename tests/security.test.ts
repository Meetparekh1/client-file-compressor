import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeSvg } from '../src/lib/compressors/svgCompressor';
import { sanitizeHtml } from '../src/lib/htmlToPdfEngine';
import { sanitizeFilename } from '../src/lib/utils';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_BATCH_BYTES,
  MAX_BATCH_FILE_COUNT,
  MAX_PDF_PAGES,
  MAX_HTML_LENGTH,
  validateFileSize,
  validateBatchFiles,
  validatePageCount,
  withExecutionTimeout,
} from '../src/lib/securityLimits';
import { sanitizeErrorMessage, parseErrorMessage } from '../src/lib/errorParser';
import {
  hasRemoteProcessingConsent,
  setRemoteProcessingConsent,
  assertRemoteProcessingConsent,
} from '../src/lib/remoteConsent';
import { isValidConverterApiUrl } from '../src/lib/remoteConverter';
import { TOOLS_REGISTRY } from '../src/lib/toolsRegistry';

describe('Phase 1 Security & Privacy Regression Suite', () => {
  beforeEach(() => {
    // Reset consent state
    setRemoteProcessingConsent(false);
  });

  describe('1. HTML Injection & SVG Sanitization', () => {
    it('strips <script> tags and malicious event handlers from HTML', () => {
      const malicious = '<div onclick="alert(1)">Hello <script>alert("xss")</script><p>World</p></div>';
      const clean = sanitizeHtml(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert("xss")');
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('Hello');
      expect(clean).toContain('World');
    });

    it('strips javascript: pseudo-protocols from links and attributes in HTML', () => {
      const payload = '<a href="javascript:alert(1)">Click</a><img src="javascript:evil()" onerror="alert(2)" />';
      const clean = sanitizeHtml(payload);
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('onerror');
    });

    it('strips external http/https/network src URLs while preserving safe data/blob image URLs', () => {
      const payload = '<img src="https://evil.com/tracker.png" /><img src="http://localhost:8080/ssrf" /><img src="data:image/png;base64,iVBORw0KGgo=" />';
      const clean = sanitizeHtml(payload);
      expect(clean).not.toContain('https://evil.com/tracker.png');
      expect(clean).not.toContain('http://localhost:8080/ssrf');
      expect(clean).toContain('data:image/png;base64,iVBORw0KGgo=');
    });

    it('enforces MAX_HTML_LENGTH truncation or limits in sanitizeHtml', () => {
      const hugeHtml = '<div>' + 'A'.repeat(MAX_HTML_LENGTH + 500) + '</div>';
      const sanitized = sanitizeHtml(hugeHtml);
      expect(sanitized.length).toBeLessThanOrEqual(MAX_HTML_LENGTH);
    });

    it('strips script, animate, and malicious handlers from SVG', () => {
      const rawSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" onload="alert('owned')">
          <script>evilScript()</script>
          <circle cx="50" cy="50" r="40" fill="red" onclick="exploit()" />
          <animate attributeName="href" values="javascript:alert(1)" />
        </svg>
      `;
      const cleaned = sanitizeSvg(rawSvg);
      expect(cleaned).not.toContain('<script');
      expect(cleaned).not.toContain('onload');
      expect(cleaned).not.toContain('onclick');
      expect(cleaned).not.toContain('<animate');
      expect(cleaned).toContain('<circle');
    });

    it('rejects malformed SVG instead of falling back to unsafe raw output', () => {
      const unclosedSvg = '<svg><unclosed tag';
      expect(() => sanitizeSvg(unclosedSvg)).toThrow();
    });
  });

  describe('2. Path Traversal & Windows Reserved Name Sanitization', () => {
    it('strips directory traversal sequences', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFilename('/nested/folder/report.pdf')).toBe('report.pdf');
    });

    it('shields Windows reserved device names', () => {
      expect(sanitizeFilename('CON.txt')).toBe('safe_CON.txt');
      expect(sanitizeFilename('prn.pdf')).toBe('safe_prn.pdf');
      expect(sanitizeFilename('aux.png')).toBe('safe_aux.png');
      expect(sanitizeFilename('nul')).toBe('safe_nul');
      expect(sanitizeFilename('COM1.docx')).toBe('safe_COM1.docx');
      expect(sanitizeFilename('LPT9.xlsx')).toBe('safe_LPT9.xlsx');
    });

    it('strips forbidden characters, control characters, and trailing dots/spaces', () => {
      expect(sanitizeFilename('my:file*name?.pdf')).toBe('my_file_name_.pdf');
      expect(sanitizeFilename('document.pdf...')).toBe('document.pdf');
      expect(sanitizeFilename('presentation.pptx   ')).toBe('presentation.pptx');
      expect(sanitizeFilename('')).toBe('file');
    });
  });

  describe('3. Upload, Page Count & Execution Time Limits', () => {
    it('validates file size within limit and rejects oversized files', () => {
      const validFile = new File(['valid content'], 'valid.pdf', { type: 'application/pdf' });
      expect(() => validateFileSize(validFile)).not.toThrow();

      const fakeLargeFile = {
        name: 'huge.pdf',
        size: MAX_FILE_SIZE_BYTES + 1024,
      } as unknown as File;
      expect(() => validateFileSize(fakeLargeFile)).toThrow(/upload limit of 100MB/i);
    });

    it('validates batch size and batch file count limits', () => {
      const normalBatch = [
        new File(['1'], 'file1.png', { type: 'image/png' }),
        new File(['2'], 'file2.png', { type: 'image/png' }),
      ];
      expect(() => validateBatchFiles(normalBatch)).not.toThrow();

      const excessiveCount = new Array(MAX_BATCH_FILE_COUNT + 1).fill(null).map((_, i) => ({
        name: `file${i}.png`,
        size: 100,
      })) as unknown as File[];
      expect(() => validateBatchFiles(excessiveCount)).toThrow(/maximum batch limit of 100 files/i);

      const excessiveBytes = [
        { name: 'big1.pdf', size: MAX_TOTAL_BATCH_BYTES / 2 + 1000 },
        { name: 'big2.pdf', size: MAX_TOTAL_BATCH_BYTES / 2 + 1000 },
      ] as unknown as File[];
      expect(() => validateBatchFiles(excessiveBytes)).toThrow(/batch size limit of 300MB/i);
    });

    it('enforces maximum PDF page counts', () => {
      expect(() => validatePageCount(50, MAX_PDF_PAGES, 'PDF')).not.toThrow();
      expect(() => validatePageCount(MAX_PDF_PAGES + 1, MAX_PDF_PAGES, 'PDF Compressor')).toThrow(
        /limited to 300 pages/i
      );
    });

    it('enforces execution timeouts via withExecutionTimeout', async () => {
      const fastOp = () => Promise.resolve('fast result');
      await expect(withExecutionTimeout(fastOp(), 1000, 'Fast Op')).resolves.toBe('fast result');

      const hangingOp = new Promise((resolve) => setTimeout(() => resolve('too late'), 300));
      await expect(withExecutionTimeout(hangingOp, 50, 'Slow Op')).rejects.toThrow(
        /exceeded maximum execution time limit/i
      );
    });
  });

  describe('4. Error Sanitization & Categorization', () => {
    it('redacts Windows and Unix absolute filesystem paths from error messages', () => {
      const rawError = 'Fatal error at C:\\Users\\Administrator\\Project\\secret.key: memory dump';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('C:\\Users');
      expect(sanitized).not.toContain('secret.key');
      expect(sanitized).toContain('[path-redacted]');

      const unixError = 'Error in /home/developer/app/config.json: invalid syntax';
      const sanitizedUnix = sanitizeErrorMessage(unixError);
      expect(sanitizedUnix).not.toContain('/home/developer');
      expect(sanitizedUnix).toContain('[path-redacted]');
    });

    it('redacts internal IPv4 addresses', () => {
      const ipError = 'Failed to connect to backend at http://192.168.1.55:8080/convert';
      const sanitized = sanitizeErrorMessage(ipError);
      expect(sanitized).not.toContain('192.168.1.55');
      expect(sanitized).toContain('[ip-redacted]');
    });

    it('correctly categorizes timeout and consent error types', () => {
      const timeoutInfo = parseErrorMessage(new Error('Operation timed out after 30000ms'));
      expect(timeoutInfo.type).toBe('timeout');

      const consentInfo = parseErrorMessage(new Error('User consent is required for remote processing'));
      expect(consentInfo.type).toBe('consent');
    });
  });

  describe('5. Remote Consent & Converter URL Validation', () => {
    it('requires explicit consent before assertRemoteProcessingConsent succeeds', () => {
      expect(hasRemoteProcessingConsent()).toBe(false);
      expect(() => assertRemoteProcessingConsent('Remote PDF Service')).toThrow(/explicit user consent/i);

      setRemoteProcessingConsent(true);
      expect(hasRemoteProcessingConsent()).toBe(true);
      expect(() => assertRemoteProcessingConsent('Remote PDF Service')).not.toThrow();
    });

    it('validates HTTP/HTTPS endpoints for converter APIs and rejects unsafe protocols', () => {
      expect(isValidConverterApiUrl('https://api.shrinkbyte.com/convert')).toBe(true);
      expect(isValidConverterApiUrl('http://localhost:3000/api')).toBe(true);
      expect(isValidConverterApiUrl('ftp://evil.com/upload')).toBe(false);
      expect(isValidConverterApiUrl('javascript:alert(1)')).toBe(false);
      expect(isValidConverterApiUrl('file:///etc/passwd')).toBe(false);
      expect(isValidConverterApiUrl('not-a-valid-url')).toBe(false);
    });
  });

  describe('6. Tool Registry Destination Metadata Integrity', () => {
    it('every tool in TOOLS_REGISTRY specifies an explicit destination and destination label', () => {
      expect(TOOLS_REGISTRY.length).toBeGreaterThanOrEqual(17);
      
      for (const tool of TOOLS_REGISTRY) {
        expect(['local', 'hybrid', 'local_cdn_model']).toContain(tool.destination);
        expect(tool.destinationLabel).toBeDefined();
        expect(tool.destinationLabel.length).toBeGreaterThan(0);
        
        if (tool.destination === 'local') {
          expect(tool.destinationLabel).toMatch(/Local/i);
        } else if (tool.destination === 'local_cdn_model') {
          expect(tool.destinationLabel).toMatch(/Local AI/i);
        } else if (tool.destination === 'hybrid') {
          expect(tool.destinationLabel).toMatch(/Hybrid/i);
        }
      }
    });

    it('ensures pdf-to-word and word-to-pdf are correctly identified as hybrid destination', () => {
      const pdfToWord = TOOLS_REGISTRY.find((t) => t.id === 'pdf-to-word');
      expect(pdfToWord).toBeDefined();
      expect(pdfToWord?.destination).toBe('hybrid');

      const wordToPdf = TOOLS_REGISTRY.find((t) => t.id === 'word-to-pdf');
      expect(wordToPdf).toBeDefined();
      expect(wordToPdf?.destination).toBe('hybrid');
    });

    it('ensures ai-summarizer and ocr-pdf have accurate local designations', () => {
      const summarizer = TOOLS_REGISTRY.find((t) => t.id === 'ai-summarizer');
      expect(summarizer).toBeDefined();
      expect(summarizer?.destination).toBe('local_cdn_model');

      const ocrPdf = TOOLS_REGISTRY.find((t) => t.id === 'ocr-pdf');
      expect(ocrPdf).toBeDefined();
      expect(ocrPdf?.destination).toBe('local');
    });
  });
});
