import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { detectFileCategory, compressFile } from '../src/lib/compressors/index';
import { compressSvgToTarget, minifySvgString } from '../src/lib/compressors/svgCompressor';
import { compressDocxToTarget } from '../src/lib/compressors/docxCompressor';
import { MAX_FILE_SIZE_BYTES } from '../src/lib/securityLimits';

async function createValidDocx(includeImage = false): Promise<File> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Test Docx</w:t></w:r></w:p></w:body></w:document>'
  );

  if (includeImage) {
    // 1x1 transparent png bytes
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
      0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
      0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
      0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    zip.file('word/media/image1.png', pngBytes);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'test.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

async function createValidPdf(): Promise<File> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawText('Sample PDF content', { x: 20, y: 100 });
  const bytes = await doc.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], 'test.pdf', { type: 'application/pdf' });
}

describe('Compression Engine Test Suite', () => {
  describe('File Category Detection', () => {
    it('detects SVG category by MIME type or extension', () => {
      expect(detectFileCategory(new File([''], 'logo.svg', { type: 'image/svg+xml' }))).toBe('svg');
      expect(detectFileCategory(new File([''], 'icon.svg', { type: '' }))).toBe('svg');
    });

    it('detects raster image categories', () => {
      const extensions = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'ico'];
      extensions.forEach((ext) => {
        expect(detectFileCategory(new File([''], `photo.${ext}`, { type: '' }))).toBe('image');
      });
      expect(detectFileCategory(new File([''], 'pic.dat', { type: 'image/png' }))).toBe('image');
    });

    it('detects PDF category by MIME or extension', () => {
      expect(detectFileCategory(new File([''], 'doc.pdf', { type: 'application/pdf' }))).toBe('pdf');
      expect(detectFileCategory(new File([''], 'doc.pdf', { type: '' }))).toBe('pdf');
    });

    it('detects Word documents (.docx, .doc)', () => {
      expect(
        detectFileCategory(
          new File([''], 'doc.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          })
        )
      ).toBe('docx');
      expect(detectFileCategory(new File([''], 'legacy.doc', { type: 'application/msword' }))).toBe('docx');
    });

    it('classifies unsupported file formats correctly', () => {
      expect(detectFileCategory(new File([''], 'plain.txt', { type: 'text/plain' }))).toBe('unsupported');
      expect(detectFileCategory(new File([''], 'archive.zip', { type: 'application/zip' }))).toBe('unsupported');
      expect(detectFileCategory(new File([''], 'binary.exe', { type: 'application/octet-stream' }))).toBe('unsupported');
    });
  });

  describe('SVG Compression & Minification', () => {
    it('minifies SVG by removing comments and collapsing redundant whitespace', () => {
      const rawSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <!-- Author metadata comment -->
          <circle cx="50" cy="50" r="40" fill="red" />
        </svg>
      `;
      const minified = minifySvgString(rawSvg);
      expect(minified).not.toContain('Author metadata comment');
      expect(minified).toContain('<circle');
      expect(minified.length).toBeLessThan(rawSvg.length);
    });

    it('compresses SVG file to target and returns result metadata', async () => {
      const svgText = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <!-- Developer notes -->
          <rect width="100" height="100" fill="#2563eb" />
          <circle cx="50" cy="50" r="30" fill="#ffffff" />
        </svg>
      `;
      const svgFile = new File([svgText], 'graphic.svg', { type: 'image/svg+xml' });
      const progressUpdates: number[] = [];

      const result = await compressSvgToTarget(svgFile, {
        targetSizeBytes: 200,
        onProgress: (p) => progressUpdates.push(p),
      });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('image/svg+xml');
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(progressUpdates).toContain(100);
    });

    it('returns fast-path when SVG is already smaller than target', async () => {
      const svgFile = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'tiny.svg', {
        type: 'image/svg+xml',
      });
      const result = await compressSvgToTarget(svgFile, {
        targetSizeBytes: 50000,
      });
      expect(result.accuracy).toBe(100);
    });
  });

  describe('DOCX Compression', () => {
    it('unpacks, processes, and recompresses valid DOCX package', async () => {
      const docxFile = await createValidDocx(true);
      const progressList: number[] = [];

      const result = await compressDocxToTarget(docxFile, {
        targetSizeBytes: Math.floor(docxFile.size * 0.9),
        onProgress: (p) => progressList.push(p),
      });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(progressList).toContain(100);

      // Verify recompressed package is a valid zip
      const reloaded = await JSZip.loadAsync(await result.blob.arrayBuffer());
      expect(reloaded.file('word/document.xml')).not.toBeNull();
    });

    it('returns immediately if DOCX is already within target budget', async () => {
      const docxFile = await createValidDocx(false);
      const result = await compressDocxToTarget(docxFile, {
        targetSizeBytes: docxFile.size + 1000,
      });

      expect(result.iterations).toBe(0);
      expect(result.accuracy).toBe(100);
    });

    it('throws meaningful error when DOCX is corrupted or non-zip', async () => {
      const corruptFile = new File(['this is not a zip or docx file'], 'bad.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(
        compressDocxToTarget(corruptFile, { targetSizeBytes: 10 })
      ).rejects.toThrow(/Unable to read Word document/i);
    });
  });

  describe('compressFile Dispatcher & Limit Validation', () => {
    it('routes SVG file to SVG compressor', async () => {
      const svgFile = new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'], 'box.svg', {
        type: 'image/svg+xml',
      });
      const result = await compressFile(svgFile, { targetSizeBytes: 5000 });
      expect(result.blob.type).toBe('image/svg+xml');
    });

    it('routes PDF file to PDF compressor and respects target size', async () => {
      const pdfFile = await createValidPdf();
      const result = await compressFile(pdfFile, { targetSizeBytes: pdfFile.size + 1000 });
      expect(result.accuracy).toBe(100);
      expect(result.blob).toBeDefined();
    });

    it('rejects unsupported file type', async () => {
      const txtFile = new File(['just text'], 'notes.txt', { type: 'text/plain' });
      await expect(compressFile(txtFile, { targetSizeBytes: 100 })).rejects.toThrow(
        /Unsupported file type/i
      );
    });

    it('rejects oversized files exceeding 100MB', async () => {
      const oversized = {
        name: 'huge.pdf',
        size: MAX_FILE_SIZE_BYTES + 1000,
        type: 'application/pdf',
      } as unknown as File;

      await expect(compressFile(oversized, { targetSizeBytes: 5000 })).rejects.toThrow(
        /maximum upload limit/i
      );
    });

    it('rejects 0-byte empty files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(compressFile(emptyFile, { targetSizeBytes: 100 })).rejects.toThrow(
        /is empty \(0 bytes\)/i
      );
    });
  });
});
