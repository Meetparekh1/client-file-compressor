# ZeroUpload — 100% Client-Side Precision File Compressor

A high-performance, privacy-first web application that compresses **Images (JPG, PNG, WebP), PDFs, and Word (.docx) documents** completely inside the browser using **Canvas APIs, WebAssembly, and JSZip**.

**Zero bytes are sent to any server.** All compression runs locally in memory on the user's computer.

---

## Key Features

1. **Precision Target Sizing (~99% Accuracy)**:
   - Need a 5 MB image compressed down to exactly 2.0 MB? Specify the exact target size in MB or KB, and our bisection binary search engine converges to within $1-2\%$ of your target without exceeding it.
2. **100% Client-Side / Zero-Server Privacy**:
   - Files are never uploaded to any remote server or cloud. Safe for sensitive documents, contracts, and confidential images.
3. **Multi-Format Support**:
   - **JPEG / WebP**: Iterative lossy quantization with resolution downsampling fallback.
   - **PNG**: 8-bit palette color quantization via `UPNG.js` with dithering.
   - **PDF**: Page raster and image stream optimization via `pdfjs-dist` and `pdf-lib`.
   - **Word (.docx)**: Extracts embedded graphics from `word/media/`, compresses high-res images, and re-packs with DEFLATE Level 9.
4. **Before vs After Visual Comparison**:
   - Interactive split slider and side-by-side view to inspect visual fidelity before downloading.
5. **Batch Processing**:
   - Drag and drop multiple files at once.
   - Set targets individually or apply batch presets (e.g. Set all to 1MB).
   - "Download All as ZIP" with one click.

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/client-file-compressor.git
cd client-file-compressor
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
client-file-compressor/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx             # Privacy indicators & format guide modal trigger
│   │   ├── Dropzone.tsx           # Multi-format drag-and-drop zone
│   │   ├── CompressionItemCard.tsx# Target size inputs, accuracy badge & live progress
│   │   ├── BatchControls.tsx      # Batch presets, compress all, download ZIP
│   │   ├── PreviewModal.tsx       # Split slider before/after image quality comparison
│   │   ├── FormatGuideModal.tsx   # Detailed technical guide for users
│   │   └── Footer.tsx             # Privacy assurance footer
│   ├── lib/
│   │   ├── types.ts               # Core interfaces and types
│   │   ├── utils.ts               # Byte formatting and download helpers
│   │   └── compressors/
│   │       ├── index.ts           # Unified compression dispatcher
│   │       ├── imageCompressor.ts # Binary search ~99% accuracy optimizer & UPNG
│   │       ├── docxCompressor.ts  # JSZip Word document media optimizer
│   │       └── pdfCompressor.ts   # pdfjs-dist & pdf-lib compressor
│   ├── App.tsx                    # Main app layout and queue state manager
│   ├── index.css                  # Tailwind CSS styling and theme
│   └── main.tsx                   # React root mount
├── package.json
└── vite.config.ts
```

---

## License

MIT License — free for personal and commercial use.
