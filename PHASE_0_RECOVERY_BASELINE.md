# Phase 0 — Recovery Baseline & Behavior Specification

## Recovery Point Details
- **Repository Remote:** `https://github.com/Meetparekh1/local-file-engine.git`
- **Audit Working Branch:** `audit-fixes`
- **Known-Good Tag:** `v0.1.0-baseline`
- **Known-Good Commit Hash:** `b667269`
- **Verified Build Status:** `tsc -b && vite build` passed successfully (Vite v8.3.0, production build clean).

---

## How to Return to Original Version Without Losing Work
If you ever need to restore the exact original state:
```bash
# 1. Stash or discard pending working tree changes
git stash

# 2. Checkout the known-good baseline tag
git checkout v0.1.0-baseline

# Or hard reset the audit branch to baseline:
git checkout audit-fixes
git reset --hard v0.1.0-baseline
```

---

## Baseline Behavior Audit Record

### 1. Compression Subsystem
- **Engines:**
  - `pdfCompressor.ts`: Client-side PDF page rasterization & recompression using `pdf-lib` and `pdfjs-dist`. Supports preset levels (Extreme, Recommended, Less) and bisection target size search.
  - `imageCompressor.ts`: Canvas-based compression & format recoding (JPEG, PNG, WebP) with UPNG-js optimization for PNG quantization.
  - `docxCompressor.ts`: JSZip-based inspection and re-compression of embedded media within `.docx` archives.
  - `svgCompressor.ts`: XML/DOM sanitation and whitespace/precision minimization.
- **Workflow:**
  - Drag & drop / upload via `Dropzone.tsx`.
  - Batch target selection (`TargetMode` with percentage or explicit byte targets).
  - Parallel batch compression queue with per-file status (`idle`, `compressing`, `done`, `error`).
  - Single file or ZIP archive downloads via FileSaver.

### 2. Theme Subsystem
- **Light / Dark Theme (`useTheme.ts`):**
  - Stored in `localStorage` under `local-file-engine-theme` (falls back to legacy keys `shrinkbyte-theme`, `zeroupload-theme`).
  - Sets `.dark` / `.light` class and `colorScheme` on `document.documentElement`.
  - Keyboard toggle hotkeys (`D` and `L`).
- **UI Mode (`useUiMode.ts`):**
  - Two aesthetic visual presentation modes: `classic` and `glassy` (Deep Frosted Glass).
  - Stored in `localStorage` under `docukit-ui-mode`.
  - Toggles CSS root classes `theme-glassy` and `theme-classic` with smooth transition morphing (`theme-transitioning`).

### 3. Navigation Subsystem
- **Layout (`App.tsx` & `Sidebar.tsx`):**
  - Left navigation sidebar with category filtering:
    - `all`: All Tools
    - `pages`: Page manipulation (Split, Delete Pages, Page Numbers)
    - `edit`: Editing & compression (Compress Files, Flatten PDF, Edit PDF, Unlock PDF)
    - `convert`: Format conversion (Images, Office, HTML, OCR)
    - `organize`: Document organization (Merge PDF, Rotate PDF, Scan to PDF)
    - `signatures`: Sign & Watermark
  - Responsive mobile drawer with backdrop blur and background scroll-lock when active.
  - Active tool view switching state (`activeView` switching between `dashboard`, `compress-pdf`, `merge-pdf`, etc.) with quick back navigation.

### 4. Conversion Subsystem
- **Tools Available:**
  - `MergePdfTool.tsx`: Merges multiple PDF files into one.
  - `SplitPdfTool.tsx`: Page extraction and range splitting.
  - `PdfToImagesTool.tsx`: Exports PDF pages as JPG/PNG image files.
  - `ScanToPdfTool.tsx`: Merges images/camera captures to PDF.
  - `SignWatermarkTool.tsx`: Canvas & Fabric.js signing and watermarking.
  - `PdfToOfficeTool.tsx`: Client-side conversion & remote conversion fallback options.
  - `HtmlToPdfTool.tsx` & `TextToPdfTool.tsx`: Document generator engines.
  - `OcrPdfTool.tsx`: Tesseract.js client-side OCR text extraction.
  - `AiSummarizerTool.tsx`: Transformer-based client-side summarization.
