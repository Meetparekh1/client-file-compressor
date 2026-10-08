/**
 * Document Converter Client Helper
 * Connects your React / Vite frontend to your self-hosted converter microservice.
 */

export function getConverterApiUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('converter-api-url');
    if (saved && saved.trim()) return saved.trim();
  }
  return import.meta.env.VITE_CONVERTER_API_URL || 'http://localhost:7860';
}

export function setConverterApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('converter-api-url', url.trim());
  }
}

export async function checkConverterHealth(apiUrl?: string): Promise<boolean> {
  const baseUrl = (apiUrl || getConverterApiUrl()).replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export interface ConvertOptions {
  apiUrl?: string;
  onProgress?: (status: string) => void;
}

/**
 * Converts a PDF file to a Word (.docx) file via the REST API.
 */
export async function convertPdfToDocx(
  file: File,
  options: ConvertOptions = {}
): Promise<Blob> {
  const baseUrl = (options.apiUrl || getConverterApiUrl()).replace(/\/+$/, '');
  const endpoint = `${baseUrl}/convert/pdf-to-docx`;

  const formData = new FormData();
  formData.append('file', file);

  if (options.onProgress) {
    options.onProgress('Connecting to converter engine...');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Conversion failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) errorMessage = errorJson.detail;
      } catch {
        // Ignore JSON error
      }
      throw new Error(errorMessage);
    }

    return await response.blob();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach converter API at ${baseUrl}. Ensure your backend service is running (e.g. Docker locally or on Render) or update the API URL in Settings.`
      );
    }
    throw err;
  }
}

/**
 * Converts a Word (.docx/.doc) file to a PDF file via the REST API.
 */
export async function convertDocxToPdf(
  file: File,
  options: ConvertOptions = {}
): Promise<Blob> {
  const baseUrl = (options.apiUrl || getConverterApiUrl()).replace(/\/+$/, '');
  const endpoint = `${baseUrl}/convert/docx-to-pdf`;

  const formData = new FormData();
  formData.append('file', file);

  if (options.onProgress) {
    options.onProgress('Connecting to LibreOffice PDF engine...');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Conversion failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) errorMessage = errorJson.detail;
      } catch {
        // Ignore JSON error
      }
      throw new Error(errorMessage);
    }

    return await response.blob();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach converter API at ${baseUrl}. Ensure your backend service is running (e.g. Docker locally or on Render) or update the API URL in Settings.`
      );
    }
    throw err;
  }
}

/**
 * Triggers a browser file download for the received Blob.
 */
export function downloadBlob(blob: Blob, suggestedFilename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
