import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Dashboard } from '../src/components/Dashboard';

// Configure React act environment for testing
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Dashboard Redesign Component Tests', () => {
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

  it('renders the hero section with badge, heading, and subtitle', async () => {
    const onSelectTool = vi.fn();
    const onSelectCategory = vi.fn();
    const onQuickUpload = vi.fn();
    const onToast = vi.fn();

    await act(async () => {
      root.render(
        <Dashboard
          onSelectTool={onSelectTool}
          selectedCategory="all"
          onSelectCategory={onSelectCategory}
          onQuickUpload={onQuickUpload}
          onToast={onToast}
        />
      );
    });

    // Badge
    expect(container.textContent).toContain('Local • Private • Fast');

    // Heading
    expect(container.textContent).toContain('Your Document Tools,');
    expect(container.textContent).toContain('Simplified.');

    // Subtitle
    expect(container.textContent).toContain(
      'Powerful PDF and document tools, built for speed, privacy, and ease of use. No watermarks. No unnecessary uploads. Just tools that work.'
    );
  });

  it('renders category filter pills with Popular selected by default', async () => {
    const onSelectTool = vi.fn();
    const onSelectCategory = vi.fn();
    const onQuickUpload = vi.fn();
    const onToast = vi.fn();

    await act(async () => {
      root.render(
        <Dashboard
          onSelectTool={onSelectTool}
          selectedCategory="all"
          onSelectCategory={onSelectCategory}
          onQuickUpload={onQuickUpload}
          onToast={onToast}
        />
      );
    });

    const pills = ['Popular', 'PDF Tools', 'Converters', 'Organize', 'Edit & Modify', 'Security', 'All Tools'];
    pills.forEach((label) => {
      expect(container.textContent).toContain(label);
    });

    // Active pill has indigo class
    const popularBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Popular');
    expect(popularBtn).toBeTruthy();
    expect(popularBtn?.className).toMatch(/bg-\[#1e232f\]|bg-indigo-600/);
  });

  it('renders 6 popular tools and the Show All Tools card by default', async () => {
    const onSelectTool = vi.fn();
    const onSelectCategory = vi.fn();
    const onQuickUpload = vi.fn();
    const onToast = vi.fn();

    await act(async () => {
      root.render(
        <Dashboard
          onSelectTool={onSelectTool}
          selectedCategory="all"
          onSelectCategory={onSelectCategory}
          onQuickUpload={onQuickUpload}
          onToast={onToast}
        />
      );
    });

    // Check Popular Tools header
    expect(container.textContent).toContain('Popular Tools');
    expect(container.textContent).toContain("The tools you'll use most, right at your fingertips.");

    // Check the 6 tools are rendered
    expect(container.textContent).toContain('Compress PDF');
    expect(container.textContent).toContain('Merge PDFs');
    expect(container.textContent).toContain('Split PDF');
    expect(container.textContent).toContain('PDF to Word');
    expect(container.textContent).toContain('Word to PDF');
    expect(container.textContent).toContain('PDF to Images');

    // Show All Tools card is visible
    expect(container.textContent).toContain('Show All Tools');
    expect(container.textContent).toContain('20+ Tools');
  });

  it('expands all tools and toggles card to Show Popular Tools when clicked', async () => {
    const onSelectTool = vi.fn();
    const onSelectCategory = vi.fn();
    const onQuickUpload = vi.fn();
    const onToast = vi.fn();

    await act(async () => {
      root.render(
        <Dashboard
          onSelectTool={onSelectTool}
          selectedCategory="all"
          onSelectCategory={onSelectCategory}
          onQuickUpload={onQuickUpload}
          onToast={onToast}
        />
      );
    });

    // Find the Show All Tools card
    const expandCard = Array.from(container.querySelectorAll('div[role="button"]')).find((el) =>
      el.textContent?.includes('Show All Tools')
    );
    expect(expandCard).toBeTruthy();

    await act(async () => {
      expandCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Now all tools are visible, including tools like OCR Scanned PDF or HTML to PDF
    expect(container.textContent).toContain('OCR Scanned PDF');
    expect(container.textContent).toContain('HTML to PDF');

    // Card should toggle to Show Popular Tools
    expect(container.textContent).toContain('Show Popular Tools');
    expect(container.textContent).toContain('Show Less');

    // Clicking Show Popular Tools collapses back
    const collapseCard = Array.from(container.querySelectorAll('div[role="button"]')).find((el) =>
      el.textContent?.includes('Show Popular Tools')
    );
    expect(collapseCard).toBeTruthy();

    await act(async () => {
      collapseCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Show All Tools');
    expect(container.textContent).not.toContain('OCR Scanned PDF');
  });

  it('switches category when clicking category pill', async () => {
    const onSelectTool = vi.fn();
    const onSelectCategory = vi.fn();
    const onQuickUpload = vi.fn();
    const onToast = vi.fn();

    await act(async () => {
      root.render(
        <Dashboard
          onSelectTool={onSelectTool}
          selectedCategory="all"
          onSelectCategory={onSelectCategory}
          onQuickUpload={onQuickUpload}
          onToast={onToast}
        />
      );
    });

    // Click 'Converters'
    const convertersBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Converters'
    );
    expect(convertersBtn).toBeTruthy();

    await act(async () => {
      convertersBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectCategory).toHaveBeenCalledWith('convert');
    expect(container.textContent).toContain('Converters');
    expect(container.textContent).toContain('High-speed conversion between PDF, Word, images, and text formats.');
  });

  it('displays empty state when search query matches no tools', async () => {
    const onSelectTool = vi.fn();
    const onSelectCategory = vi.fn();
    const onQuickUpload = vi.fn();
    const onToast = vi.fn();

    await act(async () => {
      root.render(
        <Dashboard
          onSelectTool={onSelectTool}
          selectedCategory="all"
          onSelectCategory={onSelectCategory}
          onQuickUpload={onQuickUpload}
          onToast={onToast}
          searchQuery="xyznonexistentquery999"
        />
      );
    });

    expect(container.textContent).toContain('No tools found matching your criteria');
    expect(container.textContent).toContain('Reset to Popular Tools');
  });
});
