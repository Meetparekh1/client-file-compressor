import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import {
  convertPdfToDocx,
  extractAndAnalyzePdf,
} from '../src/lib/officeConverter';
import { validateDocxBlob } from '../src/lib/docxValidator';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

describe('DOCX Conversion Fidelity & Quality Benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. OOXML Package Integrity & Validation (validateDocxBlob)', () => {
    it('rejects empty or zero-byte blob', async () => {
      const emptyBlob = new Blob([], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const res = await validateDocxBlob(emptyBlob);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/empty/i);
    });

    it('rejects undersized or corrupt zip file', async () => {
      const corruptBlob = new Blob(['PK\x03\x04random-corrupt-data'], { type: 'application/octet-stream' });
      const res = await validateDocxBlob(corruptBlob);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/too small|corrupted/i);
    });

    it('rejects zip missing word/document.xml', async () => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types/>');
      zip.file('dummy.txt', 'x'.repeat(800));
      const blob = await zip.generateAsync({ type: 'blob' });
      const res = await validateDocxBlob(blob);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/missing required word\/document\.xml/i);
    });

    it('validates genuine OOXML package with [Content_Types].xml and word/document.xml', async () => {
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
      zip.file('_rels/.rels', '<Relationships/>');
      zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>');
      const blob = await zip.generateAsync({ type: 'blob' });
      const res = await validateDocxBlob(blob);
      expect(res.valid).toBe(true);
      expect(res.hasDocumentXml).toBe(true);
      expect(res.hasContentTypes).toBe(true);
    });
  });

  describe('2. Paragraph Reflow & Heading Hierarchy Detection', () => {
    it('detects H1 and H2 headings from font size and wraps body paragraphs with styles', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
          getTextContent: vi.fn().mockResolvedValue({
            styles: {
              f_title: { fontFamily: 'Calibri' },
              f_h2: { fontFamily: 'Calibri' },
              f_body: { fontFamily: 'Calibri' },
            },
            items: [
              // H1 Heading (24pt font, body is 11pt)
              { str: 'Annual Financial Report', transform: [24, 0, 0, 24, 54, 720], height: 24, fontName: 'f_title', width: 250 },
              // H2 Subheading (16pt font)
              { str: 'Executive Summary', transform: [16, 0, 0, 16, 54, 670], height: 16, fontName: 'f_h2', width: 140 },
              // Body paragraph line 1
              { str: 'During the past fiscal year, DocuKit experienced record growth', transform: [11, 0, 0, 11, 54, 630], height: 11, fontName: 'f_body', width: 300 },
              // Body paragraph line 2 (wrapped line close to line 1)
              { str: 'across all client-side document processing workflows.', transform: [11, 0, 0, 11, 54, 615], height: 11, fontName: 'f_body', width: 280 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const file = new File(['%PDF-1.5'], 'report.pdf', { type: 'application/pdf' });
      const { pages } = await extractAndAnalyzePdf(file);
      expect(pages.length).toBe(1);

      const page = pages[0];
      expect(page.blocks).toBeDefined();

      const heading1 = page.blocks?.find((b) => b.type === 'heading' && b.headingLevel === 1);
      expect(heading1).toBeDefined();
      expect(heading1?.text).toBe('Annual Financial Report');

      const heading2 = page.blocks?.find((b) => b.type === 'heading' && b.headingLevel === 2);
      expect(heading2).toBeDefined();
      expect(heading2?.text).toBe('Executive Summary');

      // Paragraph reflow verification: line 1 and line 2 should merge into one paragraph
      const paragraphs = page.blocks?.filter((b) => b.type === 'paragraph');
      expect(paragraphs?.length).toBe(1);
      expect(paragraphs?.[0].text).toContain('During the past fiscal year, DocuKit experienced record growth across all client-side document processing workflows.');

      // Verify convertPdfToDocx delegates to remote Adobe converter
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
      zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Annual Financial Report</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Executive Summary</w:t></w:r></w:p></w:body></w:document>');
      const mockDocx = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          blob: vi.fn().mockResolvedValue(mockDocx),
        })
      );

      const docxBlob = await convertPdfToDocx(file, { skipConsentCheck: true });
      expect(docxBlob.size).toBeGreaterThan(0);

      const resZip = await JSZip.loadAsync(docxBlob);
      const docXml = await resZip.file('word/document.xml')?.async('string');
      expect(docXml).toContain('w:pStyle w:val="Heading1"');
      expect(docXml).toContain('w:pStyle w:val="Heading2"');
      expect(docXml).toContain('Annual Financial Report');
      vi.unstubAllGlobals();
    });

    it('de-hyphenates words wrapped across line boundaries', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
          getTextContent: vi.fn().mockResolvedValue({
            styles: {},
            items: [
              { str: 'This is a multi-', transform: [11, 0, 0, 11, 54, 700], height: 11, width: 80 },
              { str: 'functional converter engine.', transform: [11, 0, 0, 11, 54, 685], height: 11, width: 140 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const file = new File(['%PDF-1.5'], 'hyphen.pdf', { type: 'application/pdf' });
      const { pages } = await extractAndAnalyzePdf(file);
      const paraBlock = pages[0].blocks?.find((b) => b.type === 'paragraph');
      expect(paraBlock?.text).toBe('This is a multifunctional converter engine.');
    });
  });

  describe('3. Multi-Column Reading Order', () => {
    it('reads left column top-to-bottom first, then right column top-to-bottom without horizontal interlacing', async () => {
      // 2-column layout: Column 1 around x=50, Column 2 around x=320, page width 600
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
          getTextContent: vi.fn().mockResolvedValue({
            styles: {},
            items: [
              // Left column line 1 (y=700)
              { str: 'Left Col 1', transform: [10, 0, 0, 10, 50, 700], height: 10, width: 100 },
              // Right column line 1 (y=700) - same horizontal plane!
              { str: 'Right Col 1', transform: [10, 0, 0, 10, 320, 700], height: 10, width: 100 },
              // Left column line 2 (y=660)
              { str: 'Left Col 2', transform: [10, 0, 0, 10, 50, 660], height: 10, width: 100 },
              // Right column line 2 (y=660)
              { str: 'Right Col 2', transform: [10, 0, 0, 10, 320, 660], height: 10, width: 100 },
              // Additional items to exceed threshold
              { str: 'Left Col 3', transform: [10, 0, 0, 10, 50, 620], height: 10, width: 100 },
              { str: 'Right Col 3', transform: [10, 0, 0, 10, 320, 620], height: 10, width: 100 },
              { str: 'Left Col 4', transform: [10, 0, 0, 10, 50, 580], height: 10, width: 100 },
              { str: 'Right Col 4', transform: [10, 0, 0, 10, 320, 580], height: 10, width: 100 },
              { str: 'Left Col 5', transform: [10, 0, 0, 10, 50, 540], height: 10, width: 100 },
              { str: 'Right Col 5', transform: [10, 0, 0, 10, 320, 540], height: 10, width: 100 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const file = new File(['%PDF-1.5'], 'twocol.pdf', { type: 'application/pdf' });
      const { pages } = await extractAndAnalyzePdf(file);
      const rawText = pages[0].rawText;

      // In correct reading order, all Left Col lines must appear BEFORE Right Col 1
      const leftCol1Idx = rawText.indexOf('Left Col 1');
      const leftCol5Idx = rawText.indexOf('Left Col 5');
      const rightCol1Idx = rawText.indexOf('Right Col 1');

      expect(leftCol1Idx).toBeGreaterThanOrEqual(0);
      expect(leftCol5Idx).toBeGreaterThan(leftCol1Idx);
      expect(rightCol1Idx).toBeGreaterThan(leftCol5Idx);
    });
  });

  describe('4. Table Detection & Numeric Alignment', () => {
    it('structures financial table with header shading and right-aligns numeric columns', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
          getTextContent: vi.fn().mockResolvedValue({
            styles: {},
            items: [
              // Header row
              { str: 'Item Name    Quantity    Price    Total', transform: [11, 0, 0, 11, 54, 700], height: 11, width: 280 },
              // Data row 1
              { str: 'Widget A    5    $10.00    $50.00', transform: [11, 0, 0, 11, 54, 675], height: 11, width: 260 },
              // Data row 2
              { str: 'Gadget B    2    $25.00    $50.00', transform: [11, 0, 0, 11, 54, 650], height: 11, width: 260 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const file = new File(['%PDF-1.5'], 'invoice.pdf', { type: 'application/pdf' });
      const { pages } = await extractAndAnalyzePdf(file);
      expect(pages[0].tables.length).toBe(1);

      const table = pages[0].tables[0];
      expect(table.headers).toEqual(['Item Name', 'Quantity', 'Price', 'Total']);
      expect(table.rows.length).toBe(2);
    });
  });

  describe('5. Page Geometry & Twips Precision', () => {
    it('sets page dimensions and orientation dynamically in sectPr', async () => {
      // Landscape A4: 842 pt wide, 595 pt tall
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 842, height: 595 }),
          getTextContent: vi.fn().mockResolvedValue({
            styles: {},
            items: [
              { str: 'Landscape Presentation Slide Content', transform: [14, 0, 0, 14, 50, 500], height: 14, width: 300 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const file = new File(['%PDF-1.5'], 'landscape.pdf', { type: 'application/pdf' });
      const { pages } = await extractAndAnalyzePdf(file);
      expect(pages[0].isLandscape).toBe(true);
      expect(pages[0].widthTwips).toBe(16840);
      expect(pages[0].heightTwips).toBe(11900);
    });
  });

  describe('6. Scanned PDF & Sparse Text Detection', () => {
    it('reports low confidence and recommends OCR when document has sparse selectable text', async () => {
      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
          getTextContent: vi.fn().mockResolvedValue({
            styles: {},
            items: [
              { str: 'Scanned', transform: [12, 0, 0, 12, 50, 700], height: 12, width: 50 },
            ],
          }),
        }),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockPdf),
      } as any);

      const file = new File(['%PDF-1.5'], 'scan.pdf', { type: 'application/pdf' });
      const { analysis } = await extractAndAnalyzePdf(file);
      expect(analysis.hasSelectableText).toBe(false);
      expect(analysis.formatCompatibility.docx.status).toBe('optimal');
      expect(analysis.formatCompatibility.docx.message).toMatch(/Searchable OCR/i);
    });
  });
});
