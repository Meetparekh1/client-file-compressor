# Changelog

All notable changes to **Local File Engine (ShrinkByte)** will be documented in this file.

---

## [Security & Hardening Update] - 2026-10-08

### 🛡️ Security Vulnerabilities Resolved (GitHub CodeQL Alerts #1 through #6)

This release addresses all 6 **High Severity** CodeQL security alerts reported by GitHub code scanning on `src/lib/compressors/svgCompressor.ts`:

| Alert ID | CodeQL Rule ID | CWE | Vulnerability Description | Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **#1** | `js/bad-tag-filter` | CWE-80 | Ineffective HTML filtering via `<script\b[\s\S]*?<\/script>` regex. | Replaced regex with native XML `DOMParser` element traversal and removal. |
| **#2** | `js/incomplete-multi-character-sanitization` | CWE-80 | Tag removal regex bypass via nested patterns (e.g. `<scr<script>ipt>`). | Complete migration to parsed XML DOM node removal (`removeNode(el)`). |
| **#3** | `js/incomplete-multi-character-sanitization` | CWE-80 | Self-closing script regex `<script\b[^>]*\/>` bypass. | Handled comprehensively by `doc.getElementsByTagName('script')`. |
| **#4** | `js/incomplete-multi-character-sanitization` | CWE-80 | Embedded HTML containers regex `<foreignObject>` bypass. | Pruned during DOM traversal across all dangerous tags (`foreignObject`, `iframe`, `object`, `embed`, etc.). |
| **#5** | `js/incomplete-multi-character-sanitization` | CWE-80 | Inline event handler regex `\s+on[a-zA-Z]+=` multi-character bypass. | Iterated element attribute collections directly; stripped any attribute starting with `on*` or matching script protocols (`javascript:`, `vbscript:`). |
| **#6** | `js/incomplete-multi-character-sanitization` | CWE-20 | Comment stripping regex `<!--[\s\S]*?-->` susceptible to multi-character injection. | Replaced regex with native `TreeWalker` (`NodeFilter.SHOW_COMMENT`) to safely delete comment nodes from the DOM tree. |

---

### 🔧 Key Technical Changes

1. **DOM-Based SVG Sanitizer (`src/lib/compressors/svgCompressor.ts`):**
   - Eliminated regex string replacements for HTML tags, comments, and event handlers.
   - Implemented `sanitizeSvgDocument()` using `DOMParser().parseFromString(..., 'image/svg+xml')` and `XMLSerializer()`.
   - Stripped executable elements: `script`, `foreignobject`, `iframe`, `object`, `embed`, `applet`, `meta`, and `link`.
   - Traversed all document elements to eliminate inline event handlers (`onclick`, `onload`, `onerror`) and dangerous URI schemes in `href`/`xlink:href`.
   - Used `createTreeWalker(root, NodeFilter.SHOW_COMMENT)` for safe removal of XML comments.

2. **Hardened File Path Sanitization (`src/lib/utils.ts`):**
   - Replaced multi-character regex path replacement in `sanitizeFilename` with strict `.split(/[\\/]/).pop()` isolation to guarantee path traversal protection across Windows and POSIX systems.

3. **Multi-Format & Engine Fixes:**
   - Preserved vector format integrity for SVG files during target compression (prevented unintended conversion to WebP with `.svg` extension).
   - Added `prepareSvgForCanvas()` with explicit dimensions from `viewBox` for robust canvas and image rendering without `createImageBitmap` exceptions.
   - Added support for `.doc` alongside `.docx` with bidirectional PDF conversion.
   - Integrated API settings modal and self-hosted converter microservice connection checks.
