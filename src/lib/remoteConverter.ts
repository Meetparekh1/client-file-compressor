import { sanitizeFilename } from './utils';
import { assertRemoteProcessingConsent } from './remoteConsent';
import { TIMEOUT_REMOTE_MS, validateFileSize } from './securityLimits';
import { sanitizeErrorMessage } from './errorParser';

/**
 * Validates that an API URL uses a permitted http or https protocol scheme.
 * Disallows javascript:, file:, data:, and malformed URIs.
 */
export function isValidConverterApiUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const DEFAULT_API_URL = 'http://localhost:7860';

export function getConverterApiUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('converter-api-url');
    if (saved && isValidConverterApiUrl(saved)) return saved.trim();
  }
  const envUrl = import.meta.env.VITE_CONVERTER_API_URL;
  if (envUrl && isValidConverterApiUrl(envUrl)) return envUrl;
  return DEFAULT_API_URL;
}

export function setConverterApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const trimmed = url.trim();
    if (!isValidConverterApiUrl(trimmed)) {
      throw new Error('Invalid Converter API URL. Must begin with http:// or https://');
    }
    localStorage.setItem('converter-api-url', trimmed);
  }
}

export async function checkConverterHealth(apiUrl?: string): Promise<boolean> {
  const rawUrl = apiUrl || getConverterApiUrl();
  if (!isValidConverterApiUrl(rawUrl)) return false;
  const baseUrl = rawUrl.replace(/\/+$/, '');
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
  skipConsentCheck?: boolean;
}

/**
 * Converts a PDF file to a Word (.docx) file via the REST API.
 */
export async function convertPdfToDocx(
  file: File,
  options: ConvertOptions = {}
): Promise<Blob> {
  validateFileSize(file);
  const targetUrl = options.apiUrl || getConverterApiUrl();
  if (!isValidConverterApiUrl(targetUrl)) {
    throw new Error('Invalid API URL for remote converter service.');
  }
  const baseUrl = targetUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/convert/pdf-to-docx`;

  if (!options.skipConsentCheck) {
    assertRemoteProcessingConsent(baseUrl);
  }

  const formData = new FormData();
  formData.append('file', file);

  if (options.onProgress) {
    options.onProgress('Connecting to converter engine...');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_REMOTE_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `Conversion failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail && typeof errorJson.detail === 'string') {
          // Sanitize raw error string
          errorMessage = sanitizeErrorMessage(errorJson.detail);
        }
      } catch {
        // Ignore JSON error
      }
      throw new Error(errorMessage);
    }

    return await response.blob();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Remote conversion timed out after ${TIMEOUT_REMOTE_MS / 1000} seconds. Please check your backend service.`
      );
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach converter API at ${baseUrl}. Ensure your backend service is running (e.g. Docker locally or on Render) or update the API URL in Settings.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Converts a Word (.docx/.doc) file to a PDF file via the REST API.
 */
export async function convertDocxToPdf(
  file: File,
  options: ConvertOptions = {}
): Promise<Blob> {
  validateFileSize(file);
  const targetUrl = options.apiUrl || getConverterApiUrl();
  if (!isValidConverterApiUrl(targetUrl)) {
    throw new Error('Invalid API URL for remote converter service.');
  }
  const baseUrl = targetUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/convert/docx-to-pdf`;

  if (!options.skipConsentCheck) {
    assertRemoteProcessingConsent(baseUrl);
  }

  const formData = new FormData();
  formData.append('file', file);

  if (options.onProgress) {
    options.onProgress('Connecting to LibreOffice PDF engine...');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_REMOTE_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `Conversion failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail && typeof errorJson.detail === 'string') {
          errorMessage = sanitizeErrorMessage(errorJson.detail);
        }
      } catch {
        // Ignore JSON error
      }
      throw new Error(errorMessage);
    }

    return await response.blob();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Remote conversion timed out after ${TIMEOUT_REMOTE_MS / 1000} seconds. Please check your backend service.`
      );
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach converter API at ${baseUrl}. Ensure your backend service is running (e.g. Docker locally or on Render) or update the API URL in Settings.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Triggers a browser file download for the received Blob.
 * Sanitizes output filenames to prevent directory traversal and illegal characters.
 */
export function downloadBlob(blob: Blob, suggestedFilename: string): void {
  const safeFilename = sanitizeFilename(suggestedFilename);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
