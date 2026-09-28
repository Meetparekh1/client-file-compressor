# ShrinkByte — 100% Client-Side Precision File Compressor & Converter

A high-performance, privacy-first web application that compresses and converts **Images (JPG, PNG, WebP, AVIF, SVG, GIF, BMP), PDFs, and Word (.docx) documents** completely inside the browser using **HTML5 Canvas, WebAssembly, pdf-lib, pdfjs-dist, and JSZip**.

**Zero bytes are sent to any server.** All compression, conversion, and PDF merging run locally in memory on the user's computer.

---

## Key Features

1. **Precision Target Sizing (~99% Accuracy)**:
   - Need a 5 MB image or document compressed down to exactly 2.0 MB? Specify the exact target size in MB or KB, and our bisection binary search engine converges to within $1-2\%$ of your target without exceeding it.
2. **100% Client-Side / Zero-Server Privacy**:
   - Files are never uploaded to any remote server or cloud. Safe for sensitive documents, contracts, and confidential images.
3. **Multi-Format Compression & Universal Conversion**:
   - **JPEG / WebP / AVIF**: Iterative lossy quantization with auto-resolution downsampling and modern AV1 encoding.
   - **SVG Vector Graphics**: Automated vector minifier (strips metadata, comments, redundant XML namespaces, and rounds coordinates) plus direct conversion to WebP, PNG, JPEG, or PDF.
   - **PNG / GIF / BMP**: 8-bit palette color quantization via `UPNG.js` with Floyd-Steinberg dithering or conversion to ultra-compact WebP/AVIF.
   - **PDF**: Page raster and image stream optimization via `pdfjs-dist` and `pdf-lib`.
   - **Word (.docx)**: Extracts embedded graphics from `word/media/`, compresses high-res images, and re-packs with DEFLATE Level 9.
4. **Image to PDF & Multi-Image Consolidation**:
   - Convert individual images or SVGs directly to PDF documents.
   - Merge multiple uploaded images into a single consolidated PDF document with one click.
5. **Productivity Views & Category Filtering**:
   - Switch seamlessly between **Card Grid View** and high-density **Table List View**.
   - Filter your queue by category tabs: **All Tools**, **Images & SVG**, **PDF Tools**, and **Word DOCX**.
6. **Before vs After Visual Comparison**:
   - Interactive split slider and side-by-side view to inspect visual fidelity before downloading.
7. **Batch Controls & Bulk Actions**:
   - Drag and drop multiple files anywhere on the page or paste directly from clipboard (`Ctrl+V`).
   - Bulk format conversion (convert all queued images to WebP, AVIF, JPEG, PNG, or PDF).
   - Set targets individually or apply batch presets (e.g. Set all to 1MB).
   - "Download All as ZIP" with one click.

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/shrinkbyte.git
cd shrinkbyte
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4. Build for production
```bash
npm run build
```

---

## Project Structure

```
shrinkbyte/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Brand header, tool category tabs, format matrix trigger
│   │   ├── Dropzone.tsx           # Multi-format dropzone & quick-add command strip
│   │   ├── CompressionItemCard.tsx# Grid view card with quick format pills, rotation, & targets
│   │   ├── CompressionListView.tsx# Dense productivity list view for batch management
│   │   ├── BatchControls.tsx      # Batch presets, bulk format converter, merge to PDF, ZIP export
│   │   ├── PreviewModal.tsx       # Split slider before/after image quality comparison
│   │   ├── FormatGuideModal.tsx   # Detailed technical matrix and specs for users
│   │   ├── Toast.tsx              # Unobtrusive activity and status notifications
│   │   └── Footer.tsx             # Privacy assurance and technical attribution
│   ├── lib/
│   │   ├── types.ts               # Core interfaces, tool tabs, and format definitions
│   │   ├── utils.ts               # Byte formatting, download helpers, and PDF merger
│   │   └── compressors/
│   │       ├── index.ts           # Unified compression dispatcher
│   │       ├── imageCompressor.ts # Binary search ~99% accuracy optimizer, AVIF, & UPNG
│   │       ├── svgCompressor.ts   # Vector minification & SVG-to-raster/PDF converter
│   │       ├── docxCompressor.ts  # JSZip Word document media optimizer
│   │       └── pdfCompressor.ts   # pdfjs-dist & pdf-lib compressor
│   ├── App.tsx                    # Main app layout, tab filtering, and queue state manager
│   ├── index.css                  # Tailwind CSS styling and theme
│   └── main.tsx                   # React root mount
├── package.json
└── vite.config.ts
```

---

## License

MIT License — free for personal and commercial use.
