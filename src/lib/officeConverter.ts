import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure PDF.js worker is registered
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Worker fallback
  }
}

export type OfficeFormat = 'docx' | 'xlsx' | 'pptx';

export interface ExtractedTableRow {
  cells: string[];
}

export interface ExtractedTable {
  headers?: string[];
  rows: ExtractedTableRow[];
}

export interface ExtractedPageContent {
  pageNumber: number;
  width: number;
  height: number;
  isLandscape: boolean;
  title: string;
  paragraphs: string[];
  bulletPoints: string[];
  tables: ExtractedTable[];
  rawText: string;
}

export interface DocumentAnalysis {
  totalPages: number;
  totalWords: number;
  hasSelectableText: boolean;
  hasTabularData: boolean;
  tableCount: number;
  isLandscapePresentation: boolean;
  recommendedFormat: OfficeFormat;
  formatCompatibility: {
    docx: {
      status: 'optimal' | 'compatible' | 'not_recommended';
      confidence: number;
      message: string;
    };
    xlsx: {
      status: 'optimal' | 'compatible' | 'incompatible';
      confidence: number;
      message: string;
    };
    pptx: {
      status: 'optimal' | 'compatible' | 'not_recommended';
      confidence: number;
      message: string;
    };
  };
}

/**
 * Escapes characters for safe inclusion in OpenXML XML nodes.
 */
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extracts and reconstructs structured text, paragraphs, and tables from a PDF file.
 */
export async function extractAndAnalyzePdf(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ pages: ExtractedPageContent[]; analysis: DocumentAnalysis }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPageContent[] = [];

  let totalWords = 0;
  let totalTables = 0;
  let landscapeCount = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const isLandscape = viewport.width > viewport.height;
    if (isLandscape) landscapeCount++;

    const textContent = await page.getTextContent();

    interface RawItem {
      text: string;
      x: number;
      y: number;
      height: number;
    }

    const items: RawItem[] = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        items.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          height: item.height || 12,
        });
      }
    }

    // Sort items top-to-bottom (Y descending), then left-to-right (X ascending)
    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.x - b.x;
    });

    // Reconstruct visual lines
    const visualLines: string[] = [];
    let currentLineItems: RawItem[] = [];
    let lastY: number | null = null;

    for (const item of items) {
      if (lastY === null || Math.abs(item.y - lastY) <= 4) {
        currentLineItems.push(item);
        lastY = item.y;
      } else {
        if (currentLineItems.length > 0) {
          currentLineItems.sort((a, b) => a.x - b.x);
          visualLines.push(currentLineItems.map((t) => t.text).join(' '));
        }
        currentLineItems = [item];
        lastY = item.y;
      }
    }
    if (currentLineItems.length > 0) {
      currentLineItems.sort((a, b) => a.x - b.x);
      visualLines.push(currentLineItems.map((t) => t.text).join(' '));
    }

    // Identify Title (first prominent line)
    const title = visualLines.length > 0 ? visualLines[0].trim() : `Page ${i}`;

    // Extract Tables vs Paragraphs
    const tables: ExtractedTable[] = [];
    const paragraphs: string[] = [];
    const bulletPoints: string[] = [];

    let activeTableRows: ExtractedTableRow[] = [];
    let currentParagraph = '';

    for (const line of visualLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentParagraph) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
        continue;
      }

      // Check if line represents tabular columns (multiple tabs or 2+ consecutive spaces separating words)
      const potentialCols = trimmed
        .split(/\t|\s{2,}/)
        .map((c) => c.trim())
        .filter(Boolean);

      // A table row typically has 2 or more distinct columns, often containing numbers or aligned codes
      const isTableRow =
        potentialCols.length >= 2 &&
        (potentialCols.some((c) => !isNaN(Number(c.replace(/[$,%]/g, '')))) ||
          potentialCols.length >= 3);

      if (isTableRow) {
        if (currentParagraph) {
          paragraphs.push(currentParagraph);
          currentParagraph = '';
        }
        activeTableRows.push({ cells: potentialCols });
      } else {
        if (activeTableRows.length > 0) {
          if (activeTableRows.length >= 2) {
            tables.push({
              headers: activeTableRows[0].cells,
              rows: activeTableRows.slice(1),
            });
            totalTables++;
          }
          activeTableRows = [];
        }

        // Check if line is a bullet item
        if (/^([•\-*]|\d+[.)])\s+/.test(trimmed)) {
          if (currentParagraph) {
            paragraphs.push(currentParagraph);
            currentParagraph = '';
          }
          bulletPoints.push(trimmed.replace(/^([•\-*]|\d+[.)])\s+/, ''));
        } else {
          // Reconstruct paragraph: if currentParagraph does not end with sentence punctuation, join with space
          if (
            currentParagraph &&
            !/[.?!:;]$/.test(currentParagraph) &&
            !/^[A-Z\s]{4,}$/.test(trimmed)
          ) {
            currentParagraph += ' ' + trimmed;
          } else {
            if (currentParagraph) paragraphs.push(currentParagraph);
            currentParagraph = trimmed;
          }
        }
      }
    }

    if (currentParagraph) paragraphs.push(currentParagraph);
    if (activeTableRows.length >= 2) {
      tables.push({
        headers: activeTableRows[0].cells,
        rows: activeTableRows.slice(1),
      });
      totalTables++;
    }

    const rawText = visualLines.join('\n');
    totalWords += rawText.split(/\s+/).filter(Boolean).length;

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      isLandscape,
      title,
      paragraphs,
      bulletPoints,
      tables,
      rawText,
    });
  }

  const hasSelectableText = totalWords > 20;
  const isLandscapePresentation = pdf.numPages > 0 && landscapeCount / pdf.numPages >= 0.7;
  const hasTabularData = totalTables > 0;

  // Compute format compatibility scores
  let recommendedFormat: OfficeFormat = 'docx';
  if (isLandscapePresentation) {
    recommendedFormat = 'pptx';
  } else if (hasTabularData && totalTables >= pdf.numPages * 0.5) {
    recommendedFormat = 'xlsx';
  }

  const analysis: DocumentAnalysis = {
    totalPages: pdf.numPages,
    totalWords,
    hasSelectableText,
    hasTabularData,
    tableCount: totalTables,
    isLandscapePresentation,
    recommendedFormat,
    formatCompatibility: {
      docx: {
        status: 'optimal',
        confidence: hasSelectableText ? 95 : 20,
        message: hasSelectableText
          ? 'Recommended: Perfect for articles, contracts, reports, and formatted text documents.'
          : 'Scanned document with minimal text. Output may be sparse without OCR.',
      },
      xlsx: {
        status: hasTabularData ? 'optimal' : 'incompatible',
        confidence: hasTabularData ? 90 : 10,
        message: hasTabularData
          ? `Detected ${totalTables} structured tables. Ready for spreadsheet grid export.`
          : 'No tabular structure found. This PDF contains continuous text, which cannot be meaningfully structured into spreadsheet cells.',
      },
      pptx: {
        status: isLandscapePresentation
          ? 'optimal'
          : pdf.numPages <= 20
          ? 'compatible'
          : 'not_recommended',
        confidence: isLandscapePresentation ? 95 : 60,
        message: isLandscapePresentation
          ? 'Slide deck detected (Landscape orientation). Perfect for PowerPoint presentation slides.'
          : 'Portrait text document. Converting to slides will distill each page into bullet points.',
      },
    },
  };

  return { pages, analysis };
}

/**
 * 1. HIGH-FIDELITY WORD CONVERTER (.docx)
 * Converts reconstructed paragraphs, headings, bullet lists, and genuine XML tables.
 */
export async function convertPdfToDocx(
  file: File,
  options: {
    preservePageBreaks?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<Blob> {
  const { pages } = await extractAndAnalyzePdf(file, options.onProgress);
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/>
      <w:color w:val="1E293B"/>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  // 5. word/document.xml
  let bodyXml = '';

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0 && (options.preservePageBreaks ?? true)) {
      bodyXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }

    // Page title / heading
    if (page.title && page.title.length < 80) {
      bodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="240" w:after="140"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="28"/>
            <w:color w:val="0F172A"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(page.title)}</w:t>
        </w:r>
      </w:p>`;
    }

    // Paragraphs
    for (const para of page.paragraphs) {
      if (!para.trim() || para === page.title) continue;
      bodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:after="160" w:line="280" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:t xml:space="preserve">${escapeXml(para)}</w:t>
        </w:r>
      </w:p>`;
    }

    // Bullet points
    for (const bullet of page.bulletPoints) {
      bodyXml += `
      <w:p>
        <w:pPr>
          <w:ind w:left="400"/>
          <w:spacing w:after="80"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/><w:color w:val="3B82F6"/></w:rPr>
          <w:t xml:space="preserve">•  </w:t>
        </w:r>
        <w:r>
          <w:t xml:space="preserve">${escapeXml(bullet)}</w:t>
        </w:r>
      </w:p>`;
    }

    // True Word XML Tables
    for (const table of page.tables) {
      let tableRowsXml = '';

      if (table.headers && table.headers.length > 0) {
        let headerCellsXml = '';
        for (const h of table.headers) {
          headerCellsXml += `
          <w:tc>
            <w:tcPr>
              <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
            </w:tcPr>
            <w:p>
              <w:r>
                <w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr>
                <w:t xml:space="preserve">${escapeXml(h)}</w:t>
              </w:r>
            </w:p>
          </w:tc>`;
        }
        tableRowsXml += `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCellsXml}</w:tr>`;
      }

      for (const row of table.rows) {
        let cellsXml = '';
        for (const c of row.cells) {
          cellsXml += `
          <w:tc>
            <w:p>
              <w:r><w:t xml:space="preserve">${escapeXml(c)}</w:t></w:r>
            </w:p>
          </w:tc>`;
        }
        tableRowsXml += `<w:tr>${cellsXml}</w:tr>`;
      }

      bodyXml += `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="none"/>
          </w:tblBorders>
        </w:tblPr>
        ${tableRowsXml}
      </w:tbl>
      <w:p/>`;
    }
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * 2. STRUCTURED EXCEL CONVERTER (.xlsx)
 * Extracts genuine tabular data with styled headers, auto column widths, and cell typing.
 */
export async function convertPdfToXlsx(
  file: File,
  options: {
    forceContinuousText?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<Blob> {
  const { pages, analysis } = await extractAndAnalyzePdf(file, options.onProgress);

  // Check custom exception: if no tabular data exists and user didn't force, throw friendly exception
  if (!analysis.hasTabularData && !options.forceContinuousText) {
    throw new Error(
      'NO_TABULAR_DATA: This PDF consists of continuous narrative text with no detected tables or spreadsheets. Converting text documents into Excel generates unreadable rows in Column A. We strongly recommend converting to Word (.docx) instead.'
    );
  }

  const zip = new JSZip();

  // OpenXML boilerplate
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Extracted Data" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  );

  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><name val="Calibri"/><sz val="11"/><b/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
</styleSheet>`
  );

  const getColLetter = (colIndex: number): string => {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  let sheetRowsXml = '';
  let rowIndex = 1;
  const colWidths = new Map<number, number>();

  const updateColWidth = (colIdx: number, textLength: number) => {
    const current = colWidths.get(colIdx) || 12;
    colWidths.set(colIdx, Math.max(current, Math.min(textLength + 3, 50)));
  };

  // If tables were detected, prioritize extracting those structured tables
  if (analysis.hasTabularData) {
    for (const page of pages) {
      if (page.tables.length === 0) continue;

      // Section separator
      sheetRowsXml += `<row r="${rowIndex}">
        <c r="A${rowIndex}" t="inlineStr" s="1"><is><t>[ Page ${page.pageNumber}: ${escapeXml(page.title)} ]</t></is></c>
      </row>`;
      updateColWidth(0, page.title.length + 15);
      rowIndex++;

      for (const table of page.tables) {
        if (table.headers && table.headers.length > 0) {
          sheetRowsXml += `<row r="${rowIndex}">`;
          table.headers.forEach((h, colIdx) => {
            const cellRef = `${getColLetter(colIdx)}${rowIndex}`;
            sheetRowsXml += `<c r="${cellRef}" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`;
            updateColWidth(colIdx, h.length);
          });
          sheetRowsXml += `</row>`;
          rowIndex++;
        }

        for (const row of table.rows) {
          sheetRowsXml += `<row r="${rowIndex}">`;
          row.cells.forEach((cellVal, colIdx) => {
            const cellRef = `${getColLetter(colIdx)}${rowIndex}`;
            const cleanVal = cellVal.replace(/[$,%]/g, '');
            const isNum = !isNaN(Number(cleanVal)) && cleanVal.trim() !== '';

            if (isNum) {
              sheetRowsXml += `<c r="${cellRef}" s="2"><v>${Number(cleanVal)}</v></c>`;
            } else {
              sheetRowsXml += `<c r="${cellRef}" t="inlineStr" s="2"><is><t>${escapeXml(cellVal)}</t></is></c>`;
            }
            updateColWidth(colIdx, cellVal.length);
          });
          sheetRowsXml += `</row>`;
          rowIndex++;
        }
        rowIndex++; // Empty space between tables
      }
    }
  } else {
    // Fallback if forced: output raw lines
    for (const page of pages) {
      sheetRowsXml += `<row r="${rowIndex}">
        <c r="A${rowIndex}" t="inlineStr" s="1"><is><t>[ Page ${page.pageNumber} ]</t></is></c>
      </row>`;
      rowIndex++;

      for (const para of page.paragraphs) {
        sheetRowsXml += `<row r="${rowIndex}">
          <c r="A${rowIndex}" t="inlineStr" s="2"><is><t>${escapeXml(para)}</t></is></c>
        </row>`;
        updateColWidth(0, para.length);
        rowIndex++;
      }
    }
  }

  // Generate column width definitions
  let colsXml = '<cols>';
  colWidths.forEach((width, colIdx) => {
    colsXml += `<col min="${colIdx + 1}" max="${colIdx + 1}" width="${width}" customWidth="1"/>`;
  });
  colsXml += '</cols>';

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  <sheetData>
    ${sheetRowsXml}
  </sheetData>
</worksheet>`;

  zip.file('xl/worksheets/sheet1.xml', worksheetXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * 3. PRESENTATION POWERPOINT CONVERTER (.pptx)
 * Transforms PDF pages into modern 16:9 widescreen presentation slides with headers and bullet cards.
 */
export async function convertPdfToPptx(
  file: File,
  options: {
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<Blob> {
  const { pages } = await extractAndAnalyzePdf(file, options.onProgress);
  const zip = new JSZip();

  let contentTypesSlideOverrides = '';
  pages.forEach((_, idx) => {
    contentTypesSlideOverrides += `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
  });

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${contentTypesSlideOverrides}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  let presRels = '';
  pages.forEach((_, idx) => {
    presRels += `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>\n`;
  });

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`
  );

  let sldIdLst = '';
  pages.forEach((_, idx) => {
    sldIdLst += `<p:sldId id="${256 + idx}" r:id="rId${idx + 1}"/>\n`;
  });

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    ${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  // Generate individual slides
  pages.forEach((page, idx) => {
    const slideNumber = idx + 1;
    const slideTitle = page.title || `Overview - Slide ${slideNumber}`;

    // Collect 3-6 key bullet items for the slide
    const slideBullets = [
      ...page.bulletPoints,
      ...page.paragraphs.slice(0, 4),
    ].slice(0, 6);

    let bulletsXml = '';
    slideBullets.forEach((bullet) => {
      const cleanBullet = bullet.length > 160 ? bullet.slice(0, 157) + '...' : bullet;
      bulletsXml += `
      <a:p>
        <a:pPr lvl="0" marL="288000">
          <a:buChar char="•"/>
        </a:pPr>
        <a:r>
          <a:rPr lang="en-US" sz="1800">
            <a:solidFill><a:srgbClr val="334155"/></a:solidFill>
          </a:rPr>
          <a:t>${escapeXml(cleanBullet)}</a:t>
        </a:r>
      </a:p>`;
    });

    if (slideBullets.length === 0) {
      bulletsXml = `
      <a:p>
        <a:r>
          <a:rPr lang="en-US" sz="1800">
            <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
          </a:rPr>
          <a:t>[Visual presentation slide content]</a:t>
        </a:r>
      </a:p>`;
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>

      <!-- Title Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title Box"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="609600"/>
            <a:ext cx="10363200" cy="1143000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="3200" b="1">
                <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slideTitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Content Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Body Box"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="2057400"/>
            <a:ext cx="10363200" cy="4114800"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/>
          <a:lstStyle/>
          ${bulletsXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.file(`ppt/slides/slide${slideNumber}.xml`, slideXml);
  });

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}
