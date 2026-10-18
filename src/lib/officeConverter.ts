import JSZip from 'jszip';
import { pdfjsLib } from './pdfjsClient';
import { validateFileSize, validatePageCount, MAX_PDF_PAGES } from './securityLimits';

export type OfficeFormat = 'docx' | 'xlsx' | 'pptx';

export interface ExtractedTableRow {
  cells: string[];
}

export interface ExtractedTable {
  headers?: string[];
  rows: ExtractedTableRow[];
}

export interface ExtractedRun {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  fontSizePt?: number;
  fontFamily?: string;
}

export type BlockType = 'heading' | 'paragraph' | 'bullet' | 'table';

export interface ExtractedBlock {
  type: BlockType;
  headingLevel?: 1 | 2 | 3;
  bulletChar?: string;
  text?: string;
  runs?: ExtractedRun[];
  table?: ExtractedTable;
  align?: 'left' | 'center' | 'right';
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
  blocks?: ExtractedBlock[];
  widthTwips?: number;
  heightTwips?: number;
  marginsTwips?: { top: number; right: number; bottom: number; left: number };
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
 * Normalizes font family names for OOXML compatibility.
 */
function normalizeFontFamily(raw: string): string {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('times')) return 'Times New Roman';
  if (lower.includes('courier')) return 'Courier New';
  if (lower.includes('arial')) return 'Arial';
  if (lower.includes('georgia')) return 'Georgia';
  if (lower.includes('cambria')) return 'Cambria';
  return 'Calibri';
}

interface RawPdfItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSizePt: number;
  isBold: boolean;
  isItalic: boolean;
  fontFamily: string;
}

interface VisualLine {
  y: number;
  xMin: number;
  xMax: number;
  height: number;
  runs: ExtractedRun[];
  text: string;
}

/**
 * Extracts and reconstructs structured text, paragraphs, headings, multi-column reading order,
 * and tables from a PDF file.
 */
export async function extractAndAnalyzePdf(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ pages: ExtractedPageContent[]; analysis: DocumentAnalysis }> {
  validateFileSize(file);
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  validatePageCount(pdf.numPages, MAX_PDF_PAGES, 'PDF to Office');
  const pages: ExtractedPageContent[] = [];

  let totalWords = 0;
  let totalTables = 0;
  let landscapeCount = 0;

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i, pdf.numPages);
      const page = await pdf.getPage(i);
      try {
        const viewport = page.getViewport({ scale: 1.0 });
        const isLandscape = viewport.width > viewport.height;
        if (isLandscape) landscapeCount++;

    const textContent = await page.getTextContent();
    const items: RawPdfItem[] = [];
    const fontSizes: number[] = [];

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        const str = item.str;
        const fontName = item.fontName || '';
        const style = (textContent.styles && textContent.styles[fontName]) as { fontFamily?: string } | undefined;
        const scaleY = item.transform ? Math.abs(item.transform[3]) : 12;
        const fontSizePt = Math.max(scaleY, item.height || 10);
        fontSizes.push(fontSizePt);

        const isBold =
          /bold|black|heavy|semibold/i.test(fontName) ||
          (style?.fontFamily ? /bold/i.test(style.fontFamily) : false);
        const isItalic =
          /italic|oblique/i.test(fontName) ||
          (style?.fontFamily ? /italic/i.test(style.fontFamily) : false);
        const fontFamily = normalizeFontFamily(style?.fontFamily || fontName);

        items.push({
          text: str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || str.length * fontSizePt * 0.5,
          height: item.height || fontSizePt,
          fontSizePt,
          isBold,
          isItalic,
          fontFamily,
        });
      }
    }

    // Determine most frequent (mode) font size for body text
    const freqMap = new Map<number, number>();
    for (const sz of fontSizes) {
      const rounded = Math.round(sz);
      freqMap.set(rounded, (freqMap.get(rounded) || 0) + 1);
    }
    let bodyFontSize = 11;
    let maxFreq = 0;
    freqMap.forEach((count, sz) => {
      if (count > maxFreq || (count === maxFreq && sz < bodyFontSize)) {
        maxFreq = count;
        bodyFontSize = sz;
      }
    });

    // Detect multi-column layout
    // If text cleanly divides into two distinct columns separated by a central gutter
    const pageWidth = viewport.width;
    const midX = pageWidth / 2;

    let leftColCount = 0;
    let rightColCount = 0;
    let crossingCount = 0;

    for (const item of items) {
      if (item.x + item.width <= midX + 15) {
        leftColCount++;
      } else if (item.x >= midX - 15) {
        rightColCount++;
      } else {
        crossingCount++;
      }
    }

    const isTwoColumn =
      items.length >= 6 &&
      leftColCount >= items.length * 0.25 &&
      rightColCount >= items.length * 0.25 &&
      crossingCount <= items.length * 0.2;

    // Sort items respecting reading order
    if (isTwoColumn) {
      items.sort((a, b) => {
        // Group full-width headers at the top
        const aHeader = a.y > viewport.height * 0.85 && a.width > pageWidth * 0.5;
        const bHeader = b.y > viewport.height * 0.85 && b.width > pageWidth * 0.5;
        if (aHeader !== bHeader) return aHeader ? -1 : 1;

        // Group left column first, then right column
        const aCol = a.x + a.width <= midX + 15 ? 0 : 1;
        const bCol = b.x + b.width <= midX + 15 ? 0 : 1;
        if (aCol !== bCol) return aCol - bCol;

        // Within column: Top-to-bottom (Y descending), then left-to-right (X ascending)
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 3.5) return yDiff;
        return a.x - b.x;
      });
    } else {
      // Standard single-column reading order: Top-to-bottom, then left-to-right
      items.sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 3.5) return yDiff;
        return a.x - b.x;
      });
    }

    // Group items into visual lines
    const visualLines: VisualLine[] = [];
    let currentLineRuns: RawPdfItem[] = [];
    let lastY: number | null = null;

    const flushLine = () => {
      if (currentLineRuns.length === 0) return;
      currentLineRuns.sort((a, b) => a.x - b.x);

      const runs: ExtractedRun[] = [];
      let fullText = '';
      let prevRunEnd = -1;

      for (const item of currentLineRuns) {
        if (prevRunEnd !== -1 && item.x - prevRunEnd > 2.5) {
          if (!fullText.endsWith(' ')) {
            fullText += ' ';
            if (runs.length > 0) runs[runs.length - 1].text += ' ';
          }
        }
        runs.push({
          text: item.text,
          isBold: item.isBold,
          isItalic: item.isItalic,
          fontSizePt: item.fontSizePt,
          fontFamily: item.fontFamily,
        });
        fullText += item.text;
        prevRunEnd = item.x + item.width;
      }

      const xMin = currentLineRuns[0].x;
      const xMax = currentLineRuns[currentLineRuns.length - 1].x + currentLineRuns[currentLineRuns.length - 1].width;
      const lineHeight = Math.max(...currentLineRuns.map((r) => r.height));

      visualLines.push({
        y: lastY ?? 0,
        xMin,
        xMax,
        height: lineHeight,
        runs,
        text: fullText.trim(),
      });
      currentLineRuns = [];
    };

    for (const item of items) {
      if (lastY === null || Math.abs(item.y - lastY) <= 3.5) {
        currentLineRuns.push(item);
        lastY = item.y;
      } else {
        flushLine();
        currentLineRuns = [item];
        lastY = item.y;
      }
    }
    flushLine();

    // Identify Title (first prominent line)
    const title = visualLines.length > 0 ? visualLines[0].text : `Page ${i}`;

    // Structure lines into blocks: Headings, Bullet Lists, Tables, Reflowable Paragraphs
    const blocks: ExtractedBlock[] = [];
    const tables: ExtractedTable[] = [];
    const paragraphs: string[] = [];
    const bulletPoints: string[] = [];

    let activeTableRows: ExtractedTableRow[] = [];
    let currentParagraphRuns: ExtractedRun[] = [];
    let currentParagraphText = '';
    let lastLineY: number | null = null;
    let lastLineHeight = bodyFontSize;

    const flushParagraph = () => {
      if (!currentParagraphText.trim()) return;
      paragraphs.push(currentParagraphText.trim());
      blocks.push({
        type: 'paragraph',
        text: currentParagraphText.trim(),
        runs: currentParagraphRuns,
      });
      currentParagraphRuns = [];
      currentParagraphText = '';
    };

    const flushTable = () => {
      if (activeTableRows.length >= 2) {
        const table: ExtractedTable = {
          headers: activeTableRows[0].cells,
          rows: activeTableRows.slice(1),
        };
        tables.push(table);
        blocks.push({
          type: 'table',
          table,
        });
        totalTables++;
      }
      activeTableRows = [];
    };

    for (const line of visualLines) {
      const trimmed = line.text;
      if (!trimmed) {
        flushParagraph();
        continue;
      }

      // Check if line is tabular data (columns separated by 2+ spaces or tabs)
      const potentialCols = trimmed
        .split(/\t|\s{2,}/)
        .map((c) => c.trim())
        .filter(Boolean);

      const isTableRow =
        potentialCols.length >= 2 &&
        (potentialCols.some((c) => !isNaN(Number(c.replace(/[$,%]/g, '')))) ||
          potentialCols.length >= 3);

      if (isTableRow) {
        flushParagraph();
        activeTableRows.push({ cells: potentialCols });
        lastLineY = line.y;
        lastLineHeight = line.height;
        continue;
      } else {
        if (activeTableRows.length > 0) {
          flushTable();
        }
      }

      // Check if line is a bullet item
      const bulletMatch = trimmed.match(/^([•◦▪\-*]|\d+[.)]|[a-zA-Z][.)])\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        const bulletChar = bulletMatch[1];
        const content = bulletMatch[2];
        bulletPoints.push(content);
        blocks.push({
          type: 'bullet',
          bulletChar,
          text: content,
          runs: line.runs,
        });
        lastLineY = line.y;
        lastLineHeight = line.height;
        continue;
      }

      // Check if line is a Heading based on font size and structure
      const maxFontSizeInLine = Math.max(...line.runs.map((r) => r.fontSizePt || bodyFontSize));
      const isBoldLine = line.runs.every((r) => r.isBold);
      const isHeading1 = maxFontSizeInLine >= bodyFontSize * 1.55 && trimmed.length < 90;
      const isHeading2 = maxFontSizeInLine >= bodyFontSize * 1.25 && trimmed.length < 110;
      const isHeading3 = isBoldLine && maxFontSizeInLine >= bodyFontSize * 1.1 && trimmed.length < 80;

      if ((isHeading1 || isHeading2 || isHeading3) && !/[.,;]$/.test(trimmed)) {
        flushParagraph();
        const level: 1 | 2 | 3 = isHeading1 ? 1 : isHeading2 ? 2 : 3;
        blocks.push({
          type: 'heading',
          headingLevel: level,
          text: trimmed,
          runs: line.runs,
        });
        lastLineY = line.y;
        lastLineHeight = line.height;
        continue;
      }

      // Regular narrative paragraph reflow:
      // If line is close to previous line (deltaY <= 1.55 * line height), combine into same paragraph
      const deltaY = lastLineY !== null ? Math.abs(lastLineY - line.y) : 999;
      const shouldReflow =
        currentParagraphText.length > 0 &&
        deltaY <= Math.max(lastLineHeight, line.height) * 1.55 &&
        !/[.?!:;]$/.test(currentParagraphText);

      if (shouldReflow) {
        // Handle end-of-line hyphenation
        if (currentParagraphText.endsWith('-')) {
          currentParagraphText = currentParagraphText.slice(0, -1) + trimmed;
          if (currentParagraphRuns.length > 0) {
            const lastRun = currentParagraphRuns[currentParagraphRuns.length - 1];
            if (lastRun.text.endsWith('-')) {
              lastRun.text = lastRun.text.slice(0, -1);
            }
          }
        } else {
          currentParagraphText += ' ' + trimmed;
          if (currentParagraphRuns.length > 0) {
            currentParagraphRuns[currentParagraphRuns.length - 1].text += ' ';
          }
        }
        currentParagraphRuns.push(...line.runs);
      } else {
        flushParagraph();
        currentParagraphText = trimmed;
        currentParagraphRuns = [...line.runs];
      }

      lastLineY = line.y;
      lastLineHeight = line.height;
    }

    flushParagraph();
    flushTable();

    const rawText = visualLines.map((l) => l.text).join('\n');
    totalWords += rawText.split(/\s+/).filter(Boolean).length;

    // Convert page dimensions to Word twips (1 pt = 20 twips)
    const widthTwips = Math.round(viewport.width * 20);
    const heightTwips = Math.round(viewport.height * 20);

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
      blocks,
      widthTwips,
      heightTwips,
      marginsTwips: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    });
      } finally {
        page.cleanup?.();
      }
    }
  } finally {
    try {
      await pdf.destroy();
    } catch {
      // ignore
    }
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
          ? 'Recommended: High-fidelity layout with reflowable paragraphs, genuine Word tables, and heading typography.'
          : 'Scanned document with minimal selectable text. Running Searchable OCR first is strongly advised.',
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
 * 1. ADOBE-POWERED WORD CONVERTER (.docx)
 * The obsolete local OOXML builder has been removed in favor of Adobe PDF Services API.
 * Re-exports convertPdfToDocx from remoteConverter for enterprise document fidelity.
 */
export { convertPdfToDocx } from './remoteConverter';

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

  if (!analysis.hasTabularData && !options.forceContinuousText) {
    throw new Error(
      'NO_TABULAR_DATA: This PDF consists of continuous narrative text with no detected tables or spreadsheets. Converting text documents into Excel generates unreadable rows in Column A. We strongly recommend converting to Word (.docx) instead.'
    );
  }

  const zip = new JSZip();

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

  if (analysis.hasTabularData) {
    for (const page of pages) {
      if (page.tables.length === 0) continue;

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
        rowIndex++;
      }
    }
  } else {
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
  if (!pages || pages.length === 0) {
    throw new Error('PDF conversion failed: document contains no extractable pages.');
  }

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

  pages.forEach((page, idx) => {
    const slideNumber = idx + 1;
    const slideTitle = page.title || `Overview - Slide ${slideNumber}`;

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
