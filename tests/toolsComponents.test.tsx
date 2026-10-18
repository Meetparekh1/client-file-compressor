import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { MergePdfTool } from '../src/components/MergePdfTool';
import { DeletePagesTool } from '../src/components/DeletePagesTool';
import { RotatePdfTool } from '../src/components/RotatePdfTool';
import { FlattenPdfTool } from '../src/components/FlattenPdfTool';
import { TextToPdfTool } from '../src/components/TextToPdfTool';
import { UnlockPdfTool } from '../src/components/UnlockPdfTool';
import { PageNumbersTool } from '../src/components/PageNumbersTool';

// Configure React act environment for testing
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Helper to create valid mock PDF files
async function createValidPdfFile(name = 'sample.pdf', pages = 2): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([300, 300]);
    page.drawText(`Page ${i + 1}`);
  }
  const bytes = await doc.save();
  return new File([bytes as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' });
}

describe('New Component Tests: Upload, Validation, Progress, Error & Download availability', () => {
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

  describe('1. MergePdfTool Component', () => {
    it('validates uploads and rejects non-PDF files with toast notification', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<MergePdfTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      // Attempt to upload invalid text file
      const invalidFile = new File(['hello text'], 'notes.txt', { type: 'text/plain' });
      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [invalidFile],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/upload valid PDF documents/i),
        'error'
      );
    });

    it('enables merge action only after uploading 2 or more PDFs, displays progress, and offers download', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<MergePdfTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file1 = await createValidPdfFile('first.pdf', 1);
      const file2 = await createValidPdfFile('second.pdf', 1);

      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [file1, file2],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      // Sequence list should render both files
      expect(container.textContent).toContain('first.pdf');
      expect(container.textContent).toContain('second.pdf');

      // Click Merge PDFs Now
      const mergeBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Merge PDFs Now')
      );
      expect(mergeBtn).toBeTruthy();
      expect(mergeBtn?.disabled).toBe(false);

      await act(async () => {
        mergeBtn?.click();
      });

      // Verify completion state and download button availability
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/Merged 2 PDFs/i),
        'success'
      );
      expect(container.textContent).toContain('Download Merged PDF');
    });
  });

  describe('2. DeletePagesTool Component', () => {
    it('loads PDF, renders page grid, and validates page selection before deletion', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<DeletePagesTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = await createValidPdfFile('doc_to_delete.pdf', 3);

      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      // Shows page numbers p. 1, p. 2, p. 3
      expect(container.textContent).toContain('p. 1');
      expect(container.textContent).toContain('p. 2');
      expect(container.textContent).toContain('p. 3');

      // Delete button is disabled until a page is selected
      const deleteBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Delete') && btn.textContent?.includes('Page(s)')
      );
      expect(deleteBtn?.disabled).toBe(true);

      // Select page 2
      const page2Btn = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === 'p. 2'
      );
      await act(async () => {
        page2Btn?.click();
      });

      expect(deleteBtn?.disabled).toBe(false);

      // Perform deletion
      await act(async () => {
        deleteBtn?.click();
      });

      // Download cleaned PDF button should now be available
      expect(container.textContent).toContain('Download Cleaned PDF');
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/Deleted 1 page\(s\)/i),
        'success'
      );
    });
  });

  describe('3. RotatePdfTool Component', () => {
    it('validates upload, handles custom page range error, and enables download upon rotation', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<RotatePdfTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = await createValidPdfFile('rotate_doc.pdf', 2);

      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      // Switch to custom range button
      const customModeBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Custom Page Numbers')
      );
      await act(async () => {
        customModeBtn?.click();
      });

      const rangeInput = container.querySelector('input[placeholder*="e.g. 1, 3, 5"]') as HTMLInputElement;
      expect(rangeInput).toBeTruthy();

      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(rangeInput, '99'); // Out of range for 2-page document
        rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
        rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const rotateBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Rotate PDF by')
      );

      await act(async () => {
        rotateBtn?.click();
      });

      // Error toast triggered for out-of-range page
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/outside document range/i),
        'error'
      );

      // Fix range to valid page 1
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(rangeInput, '1');
        rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
        rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await act(async () => {
        rotateBtn?.click();
      });

      expect(container.textContent).toContain('Download Rotated PDF');
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/Rotated PDF by 90°/i),
        'success'
      );
    });
  });

  describe('4. FlattenPdfTool Component', () => {
    it('validates file upload, processes flattening, and renders download button', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<FlattenPdfTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = await createValidPdfFile('form.pdf', 1);

      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      expect(container.textContent).toContain('form.pdf');

      const flattenBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Flatten Form Fields')
      );
      expect(flattenBtn).toBeTruthy();

      await act(async () => {
        flattenBtn?.click();
      });

      expect(container.textContent).toContain('Download Flattened PDF');
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/Flattened PDF form fields/i),
        'success'
      );
    });
  });

  describe('5. TextToPdfTool Component', () => {
    it('disables generation when content is empty and produces downloadable A4 document upon entry', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<TextToPdfTool onBack={onBack} onToast={onToast} />);
      });

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();

      const generateBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Create PDF Document')
      );
      expect(generateBtn).toBeTruthy();

      // Clear textarea: button should become disabled
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(textarea, '');
        const ev = new Event('change', { bubbles: true });
        Object.defineProperty(ev, 'target', { value: textarea, enumerable: true });
        textarea.dispatchEvent(ev);
      });

      expect(generateBtn?.disabled).toBe(true);

      // Provide valid text
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(textarea, 'Hello World from verified client-side test suite!');
        const ev = new Event('change', { bubbles: true });
        Object.defineProperty(ev, 'target', { value: textarea, enumerable: true });
        textarea.dispatchEvent(ev);
      });

      expect(generateBtn?.disabled).toBe(false);

      await act(async () => {
        generateBtn?.click();
      });

      expect(container.textContent).toContain('Download Created PDF');
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/Generated A4 PDF/i),
        'success'
      );
    });
  });

  describe('6. UnlockPdfTool Component', () => {
    it('validates upload, disables unlock without password, and accepts password input', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<UnlockPdfTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = await createValidPdfFile('locked.pdf', 1);

      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      const unlockBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Unlock Document')
      );
      expect(unlockBtn).toBeTruthy();
      // Unlock button is disabled when password is empty
      expect(unlockBtn?.disabled).toBe(true);

      // Enter password
      const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
      expect(passwordInput).toBeTruthy();

      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeSetter?.call(passwordInput, 'secret123');
        const ev = new Event('change', { bubbles: true });
        Object.defineProperty(ev, 'target', { value: passwordInput, enumerable: true });
        passwordInput.dispatchEvent(ev);
      });

      expect(unlockBtn?.disabled).toBe(false);
    });
  });

  describe('7. PageNumbersTool Component', () => {
    it('validates upload and applies page numbers, making output available for download', async () => {
      const onToast = vi.fn();
      const onBack = vi.fn();

      await act(async () => {
        root.render(<PageNumbersTool onBack={onBack} onToast={onToast} />);
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = await createValidPdfFile('numbered.pdf', 2);

      await act(async () => {
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          configurable: true,
        });
        fileInput.dispatchEvent(changeEvent);
      });

      expect(container.textContent).toContain('numbered.pdf');

      const applyBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Insert Page Numbers')
      );
      expect(applyBtn).toBeTruthy();

      await act(async () => {
        applyBtn?.click();
      });

      expect(container.textContent).toContain('Download Numbered PDF');
      expect(onToast).toHaveBeenCalledWith(
        expect.stringMatching(/Added page numbers successfully/i),
        'success'
      );
    });
  });
});
