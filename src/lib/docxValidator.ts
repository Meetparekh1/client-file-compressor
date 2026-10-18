import JSZip from 'jszip';

export interface DocxValidationResult {
  valid: boolean;
  error?: string;
  hasDocumentXml: boolean;
  hasContentTypes: boolean;
  hasRels: boolean;
  fileCount: number;
}

/**
 * Validates that a generated or received Blob is a structurally sound OOXML Word document (.docx).
 * Checks ZIP container integrity and existence of required parts according to ECMA-376 standards.
 */
export async function validateDocxBlob(blob: Blob): Promise<DocxValidationResult> {
  if (!blob || blob.size === 0) {
    return {
      valid: false,
      error: 'Empty or zero-byte output file received.',
      hasDocumentXml: false,
      hasContentTypes: false,
      hasRels: false,
      fileCount: 0,
    };
  }

  // Minimum realistic DOCX package size is around 1KB
  if (blob.size < 500) {
    return {
      valid: false,
      error: `File size too small (${blob.size} bytes) to be a valid Word document package.`,
      hasDocumentXml: false,
      hasContentTypes: false,
      hasRels: false,
      fileCount: 0,
    };
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = Object.keys(zip.files);

    const hasContentTypes = Boolean(zip.file('[Content_Types].xml'));
    const hasRels = Boolean(zip.file('_rels/.rels'));
    const hasDocumentXml = Boolean(zip.file('word/document.xml'));

    if (!hasContentTypes) {
      return {
        valid: false,
        error: 'Missing required [Content_Types].xml in OOXML package.',
        hasDocumentXml,
        hasContentTypes: false,
        hasRels,
        fileCount: files.length,
      };
    }

    if (!hasDocumentXml) {
      return {
        valid: false,
        error: 'Missing required word/document.xml in Word document package.',
        hasDocumentXml: false,
        hasContentTypes,
        hasRels,
        fileCount: files.length,
      };
    }

    // Verify word/document.xml is non-empty and well-formed XML
    const docXmlStr = await zip.file('word/document.xml')?.async('string');
    if (!docXmlStr || docXmlStr.trim().length === 0) {
      return {
        valid: false,
        error: 'word/document.xml is empty.',
        hasDocumentXml: false,
        hasContentTypes,
        hasRels,
        fileCount: files.length,
      };
    }

    // Basic well-formedness check: must have closing </w:document>
    if (!docXmlStr.includes('</w:document>')) {
      return {
        valid: false,
        error: 'Malformed word/document.xml: missing root document closing tag.',
        hasDocumentXml: true,
        hasContentTypes,
        hasRels,
        fileCount: files.length,
      };
    }

    return {
      valid: true,
      hasDocumentXml: true,
      hasContentTypes: true,
      hasRels,
      fileCount: files.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Corrupted or unreadable ZIP archive';
    return {
      valid: false,
      error: `Failed to inspect DOCX ZIP structure: ${msg}`,
      hasDocumentXml: false,
      hasContentTypes: false,
      hasRels: false,
      fileCount: 0,
    };
  }
}
