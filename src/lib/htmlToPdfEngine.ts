import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { MAX_HTML_LENGTH, TIMEOUT_HTML_RENDER_MS, withExecutionTimeout, SecurityLimitError } from './securityLimits';

/**
 * Sanitizes user-provided HTML before mounting to DOM.
 * Strips script tags, iframes, executable objects, forms, inline event handlers,
 * dangerous style expressions, and non-whitelisted schemes to prevent DOM XSS.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (rawHtml.length > MAX_HTML_LENGTH) {
    rawHtml = rawHtml.slice(0, MAX_HTML_LENGTH);
  }

  if (typeof DOMParser === 'undefined') {
    return rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const DANGEROUS_TAGS = [
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'meta',
    'link',
    'base',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'frame',
    'frameset',
  ];

  for (const tag of DANGEROUS_TAGS) {
    const elements = Array.from(doc.getElementsByTagName(tag));
    for (const el of elements) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  }

  const allElements = Array.from(doc.getElementsByTagName('*'));
  for (const el of allElements) {
    const attrsToRemove: string[] = [];

    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();

      // Block inline event handlers (e.g. onload, onerror, onclick)
      if (name.startsWith('on')) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // Block dangerous URI schemes
      if (name === 'href' || name === 'src' || name === 'action' || name === 'formaction' || name === 'data') {
        if (
          val.startsWith('javascript:') ||
          val.startsWith('vbscript:') ||
          val.startsWith('data:text/html') ||
          val.startsWith('data:image/svg+xml') ||
          val.includes('javascript:')
        ) {
          attrsToRemove.push(attr.name);
          continue;
        }
      }

      // Block CSS expressions in inline style
      if (name === 'style') {
        if (
          val.includes('expression(') ||
          val.includes('javascript:') ||
          val.includes('behavior:') ||
          val.includes('@import')
        ) {
          attrsToRemove.push(attr.name);
          continue;
        }
      }
    }

    for (const name of attrsToRemove) {
      el.removeAttribute(name);
    }
  }

  const sanitized = doc.body.innerHTML;
  return sanitized.length > MAX_HTML_LENGTH ? sanitized.slice(0, MAX_HTML_LENGTH) : sanitized;
}

export async function convertHtmlToPdf(
  htmlContent: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<Blob> {
  if (htmlContent.length > MAX_HTML_LENGTH) {
    throw new SecurityLimitError(
      `HTML content exceeds maximum allowed limit of ${Math.round(MAX_HTML_LENGTH / 1000)}KB.`,
      'upload'
    );
  }

  return withExecutionTimeout(
    (async () => {
      onProgress?.(10, 'Sanitizing HTML and preparing rendering environment...');
      
      const safeHtml = sanitizeHtml(htmlContent);

      // Create a hidden container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '800px'; // fixed width for A4 proportion approximation
      container.style.backgroundColor = '#ffffff';
      container.style.padding = '20px';
      container.innerHTML = safeHtml;
      document.body.appendChild(container);

      try {
        onProgress?.(40, 'Rendering HTML to Canvas...');
        // Restrict CORS: useCORS false to prevent unrestricted cross-origin asset leakage
        const canvas = await html2canvas(container, {
          scale: 2, // higher resolution
          useCORS: false,
          logging: false,
        });
        
        onProgress?.(70, 'Building PDF...');
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Scale image to fit A4 width
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        // Split long HTML across pages
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        let pageCount = 1;
        while (heightLeft >= 0) {
          if (pageCount >= 50) {
            // Memory guard against endless page explosion
            break;
          }
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
          pageCount++;
        }

        onProgress?.(100, 'Done!');
        const blob = pdf.output('blob');
        return blob;
      } finally {
        if (container.parentNode) {
          document.body.removeChild(container);
        }
      }
    })(),
    TIMEOUT_HTML_RENDER_MS,
    'HTML to PDF Conversion'
  );
}
