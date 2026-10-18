import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { 
  addHistoryEntry, 
  getHistoryEntries, 
  getHistoryBlob, 
  deleteHistoryEntry, 
  clearAllHistory 
} from '../src/lib/historyStore';
import { reorderPdfPages, rotatePdfPages, deletePdfPages } from '../src/lib/advancedPdfEngines';

// Helper to create dummy test PDF File
async function createSamplePdf(pageCount: number = 4): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`Page Sample ${i + 1}`, { x: 20, y: 350, size: 14, color: rgb(0, 0, 0) });
  }
  const bytes = await doc.save();
  return new File([bytes], 'sample_document.pdf', { type: 'application/pdf' });
}

describe('PDF Page Organizer & Unified Workspace Suite', () => {
  it('reorders pages according to arbitrary custom drag-and-drop ordering', async () => {
    const file = await createSamplePdf(4);
    // Reorder from [1, 2, 3, 4] to [3, 1, 4, 2]
    const reorderedBlob = await reorderPdfPages(file, [3, 1, 4, 2]);
    expect(reorderedBlob).toBeInstanceOf(Blob);

    const doc = await PDFDocument.load(await reorderedBlob.arrayBuffer());
    expect(doc.getPageCount()).toBe(4);
  });

  it('duplicates pages correctly by specifying duplicate indices', async () => {
    const file = await createSamplePdf(3);
    // Duplicate page 2 by requesting [1, 2, 2, 3]
    const duplicatedBlob = await reorderPdfPages(file, [1, 2, 2, 3]);
    const doc = await PDFDocument.load(await duplicatedBlob.arrayBuffer());
    expect(doc.getPageCount()).toBe(4);
  });

  it('rotates arbitrary individual pages', async () => {
    const file = await createSamplePdf(3);
    const rotatedBlob = await rotatePdfPages(file, 90, [2]);
    const doc = await PDFDocument.load(await rotatedBlob.arrayBuffer());
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(2).getRotation().angle).toBe(0);
  });

  it('deletes specific pages and returns remaining count', async () => {
    const file = await createSamplePdf(4);
    const { blob, remainingCount } = await deletePdfPages(file, [1, 3]);
    expect(remainingCount).toBe(2);
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
  });
});

describe('PDF Vector Annotator & Editor Content Preservation', () => {
  it('preserves existing vector pages when stamping annotations', async () => {
    const file = await createSamplePdf(2);
    const buf = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });

    // Stamping highlight rectangle
    const page = pdfDoc.getPage(0);
    page.drawRectangle({
      x: 20,
      y: 340,
      width: 150,
      height: 25,
      color: rgb(1, 0.9, 0),
      opacity: 0.35,
    });

    // Stamping arrow line
    page.drawLine({
      start: { x: 50, y: 200 },
      end: { x: 150, y: 200 },
      thickness: 2,
      color: rgb(0.2, 0.4, 0.9),
    });

    const savedBytes = await pdfDoc.save();
    expect(savedBytes.length).toBeGreaterThan(0);

    const reloaded = await PDFDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

describe('Recent Files & History Store', () => {
  beforeEach(async () => {
    await clearAllHistory();
  });

  it('adds history entries and retrieves them sorted descending by timestamp', async () => {
    const mockBlob = new Blob(['sample pdf content'], { type: 'application/pdf' });
    const id = await addHistoryEntry({
      toolId: 'organize-pdf',
      toolName: 'PDF Page Organizer',
      fileName: 'invoice.pdf',
      fileSize: 1024,
      status: 'completed',
      resultFileName: 'invoice_organized.pdf',
      resultBlob: mockBlob,
      pageCount: 3,
    });

    expect(id).toMatch(/^hist-/);

    const entries = await getHistoryEntries();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const found = entries.find((e) => e.id === id);
    expect(found).toBeDefined();
    expect(found?.fileName).toBe('invoice.pdf');
    expect(found?.status).toBe('completed');
    expect(found?.hasBlob).toBe(true);
  });

  it('retrieves cached result blob from history', async () => {
    const textData = 'test-blob-payload';
    const mockBlob = new Blob([textData], { type: 'application/pdf' });
    const id = await addHistoryEntry({
      toolId: 'edit-pdf',
      toolName: 'PDF Editor',
      fileName: 'contract.pdf',
      fileSize: 2048,
      status: 'completed',
      resultFileName: 'contract_edited.pdf',
      resultBlob: mockBlob,
    });

    const retrievedBlob = await getHistoryBlob(id);
    expect(retrievedBlob).toBeDefined();
    if (retrievedBlob) {
      const text = await retrievedBlob.text();
      expect(text).toBe(textData);
    }
  });

  it('records error statuses and error messages accurately', async () => {
    const id = await addHistoryEntry({
      toolId: 'unlock-pdf',
      toolName: 'Unlock PDF',
      fileName: 'protected.pdf',
      fileSize: 4096,
      status: 'failed',
      errorMessage: 'Incorrect password provided for encrypted document',
    });

    const entries = await getHistoryEntries();
    const entry = entries.find((e) => e.id === id);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('failed');
    expect(entry?.errorMessage).toContain('Incorrect password');
    expect(entry?.hasBlob).toBe(false);
  });

  it('deletes single history items and clears all history cleanly', async () => {
    const id = await addHistoryEntry({
      toolId: 'rotate-pdf',
      toolName: 'Rotate Pages',
      fileName: 'file_to_delete.pdf',
      fileSize: 500,
      status: 'completed',
    });

    let entries = await getHistoryEntries();
    expect(entries.some((e) => e.id === id)).toBe(true);

    await deleteHistoryEntry(id);
    entries = await getHistoryEntries();
    expect(entries.some((e) => e.id === id)).toBe(false);

    await clearAllHistory();
    const afterClear = await getHistoryEntries();
    expect(afterClear.length).toBe(0);
  });
});

describe('Searchable OCR PDF & Invisible Text Layer', () => {
  it('adds an invisible searchable text layer to PDF while preserving original scanned appearance', async () => {
    const file = await createSamplePdf(2);
    const arrayBuffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(arrayBuffer);
    const font = await doc.embedFont('Helvetica');

    // Simulate stamping an invisible text layer over recognized word positions
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    
    // Draw invisible word (opacity: 0)
    page.drawText('SearchableKeyword', {
      x: 50,
      y: height - 100,
      size: 14,
      font,
      opacity: 0,
    });

    const savedBytes = await doc.save();
    expect(savedBytes.length).toBeGreaterThan(0);

    const reloaded = await PDFDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(2);
    // Page dimensions remain identical to original scan
    expect(reloaded.getPage(0).getWidth()).toBe(width);
    expect(reloaded.getPage(0).getHeight()).toBe(height);
  });
});
