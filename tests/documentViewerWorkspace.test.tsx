import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentViewerWorkspace } from '../src/components/DocumentViewerWorkspace';
import { PDFDocument } from 'pdf-lib';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('DocumentViewerWorkspace Responsive & Accessibility Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders gracefully in modal mode with filename and badges', async () => {
    const onClose = vi.fn();
    const mockFile = new File(['%PDF-1.4 test'], 'test_manual.pdf', { type: 'application/pdf' });

    await act(async () => {
      root.render(
        <DocumentViewerWorkspace
          file={mockFile}
          fileName="test_manual.pdf"
          mode="modal"
          badgeLabel="Document Inspection"
          badgeColorClass="bg-blue-100 text-blue-700"
          onClose={onClose}
        />
      );
    });

    expect(document.body.textContent).toContain('test_manual.pdf');
    expect(document.body.textContent).toContain('Document Inspection');

    // Check zoom controls exist
    const zoomInBtn = document.body.querySelector('button[aria-label="Zoom In"]') as HTMLButtonElement;
    expect(zoomInBtn).toBeTruthy();

    const zoomOutBtn = document.body.querySelector('button[aria-label="Zoom Out"]') as HTMLButtonElement;
    expect(zoomOutBtn).toBeTruthy();

    // Check Close button works
    const closeBtn = document.body.querySelector('button[aria-label="Close Viewer"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders embedded mode within constrained height without modal overlay', async () => {
    const mockFile = new File(['%PDF-1.4 test'], 'embedded_doc.pdf', { type: 'application/pdf' });

    await act(async () => {
      root.render(
        <DocumentViewerWorkspace
          file={mockFile}
          fileName="embedded_doc.pdf"
          mode="embedded"
          embeddedHeight="400px"
        />
      );
    });

    expect(container.textContent).toContain('embedded_doc.pdf');
    const embeddedBox = container.querySelector('.rounded-3xl') as HTMLElement;
    expect(embeddedBox).toBeTruthy();
    expect(embeddedBox.style.height).toBe('400px');
  });

  it('supports image preview and compare mode with slider and side-by-side', async () => {
    const originalImg = new File(['image-bytes-1'], 'original.png', { type: 'image/png' });
    const processedImg = new File(['image-bytes-2'], 'processed.png', { type: 'image/png' });

    await act(async () => {
      root.render(
        <DocumentViewerWorkspace
          file={originalImg}
          fileName="original.png"
          compareFile={processedImg}
          compareFileName="processed.png"
          mode="embedded"
        />
      );
    });

    expect(container.textContent).toContain('original.png');
    // Compare button should be rendered
    const compareBtn = container.querySelector('button[title*="Comparison"]') as HTMLButtonElement;
    expect(compareBtn).toBeTruthy();

    act(() => {
      compareBtn.click();
    });

    expect(container.textContent).toContain('Original');
    expect(container.textContent).toContain('Output');
  });

  it('renders fallback state for unsupported raw formats honestly', async () => {
    const mockRawFile = new File(['raw binary data'], 'archive.bin', { type: 'application/octet-stream' });

    await act(async () => {
      root.render(
        <DocumentViewerWorkspace
          file={mockRawFile}
          fileName="archive.bin"
          mode="modal"
        />
      );
    });

    expect(document.body.textContent).toContain('archive.bin');
    expect(document.body.textContent).toContain('Direct in-browser visual preview is optimized for PDF and image formats');
    expect(document.body.textContent).toContain('Download Raw File');
  });
});
