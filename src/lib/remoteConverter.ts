import { sanitizeFilename } from './utils';
import { assertRemoteProcessingConsent } from './remoteConsent';
import { TIMEOUT_REMOTE_MS, validateFileSize, MAX_FILE_SIZE_BYTES } from './securityLimits';
import { sanitizeErrorMessage } from './errorParser';
import { validateDocxBlob } from './docxValidator';

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

export interface ConverterHealthDetails {
  online: boolean;
  service?: string;
  engine?: string;
  adobeConfigured?: boolean;
}

async function fetchWithFallback(endpoint: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(endpoint, init);
  } catch (err) {
    if (endpoint.includes('localhost:7860')) {
      const alt = endpoint.replace('localhost:7860', '127.0.0.1:7860');
      try {
        return await fetch(alt, init);
      } catch {}
    } else if (endpoint.includes('127.0.0.1:7860')) {
      const alt = endpoint.replace('127.0.0.1:7860', 'localhost:7860');
      try {
        return await fetch(alt, init);
      } catch {}
    }
    if (typeof window !== 'undefined' && endpoint.startsWith('http')) {
      try {
        const parsed = new URL(endpoint);
        const rel = parsed.pathname + parsed.search;
        return await fetch(rel, init);
      } catch {}
    }
    throw err;
  }
}

export async function checkConverterHealth(apiUrl?: string): Promise<boolean> {
  const rawUrl = apiUrl || getConverterApiUrl();
  if (!isValidConverterApiUrl(rawUrl)) return false;
  const baseUrl = rawUrl.replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetchWithFallback(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkConverterHealthDetails(apiUrl?: string): Promise<ConverterHealthDetails> {
  const rawUrl = apiUrl || getConverterApiUrl();
  if (!isValidConverterApiUrl(rawUrl)) return { online: false };
  const baseUrl = rawUrl.replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetchWithFallback(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return { online: false };
    if (typeof res.json === 'function') {
      const data = await res.json();
      return {
        online: true,
        service: data.service,
        engine: data.engine,
        adobeConfigured: Boolean(data.adobe_configured),
      };
    }
    return { online: true };
  } catch {
    return { online: false };
  }
}

export interface ConvertOptions {
  apiUrl?: string;
  onProgress?: (status: string) => void;
  skipConsentCheck?: boolean;
}

const VALID_DOCX_MIMES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
];

const VALID_PDF_MIMES = [
  'application/pdf',
  'application/x-pdf',
  'application/octet-stream',
];

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
    options.onProgress('Connecting to Adobe PDF Services engine...');
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    timeoutId = setTimeout(() => controller.abort(), TIMEOUT_REMOTE_MS);

    if (options.onProgress) {
      options.onProgress('Uploading document to Adobe for cloud processing...');
    }

    const response = await fetchWithFallback(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (options.onProgress) {
      options.onProgress('Processing with Adobe PDF Services API...');
    }

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

    // Verify response MIME type
    const contentType = (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    if (contentType && !VALID_DOCX_MIMES.includes(contentType)) {
      throw new Error(`Remote converter returned invalid media type: ${contentType}. Expected Word document (.docx).`);
    }

    // Verify Content-Length header if present
    const contentLengthStr = response.headers.get('content-length');
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (!isNaN(contentLength) && contentLength > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Converted response exceeds maximum allowed download size limit (${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB).`);
      }
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Remote converter returned an empty file (0 bytes).');
    }
    if (blob.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Converted response exceeds maximum allowed download size limit (${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB).`);
    }

    if (options.onProgress) {
      options.onProgress('Validating generated Word package structure...');
    }

    const validation = await validateDocxBlob(blob);
    if (!validation.valid) {
      throw new Error(`Remote converter returned an invalid Word package: ${validation.error}`);
    }

    return blob;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Remote conversion timed out after ${TIMEOUT_REMOTE_MS / 1000} seconds. Please check your backend service.`
      );
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach converter API at ${baseUrl}. Ensure your backend service is running or update the API URL in Settings.`
      );
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Converts a Word (.docx/.doc) file to a PDF file via the REST API using Adobe PDF Services.
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
    options.onProgress('Connecting to Adobe PDF Services engine...');
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    timeoutId = setTimeout(() => controller.abort(), TIMEOUT_REMOTE_MS);

    if (options.onProgress) {
      options.onProgress('Uploading Word document to Adobe for cloud processing...');
    }

    const response = await fetchWithFallback(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (options.onProgress) {
      options.onProgress('Generating PDF with Adobe PDF Services API...');
    }

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

    // Verify response MIME type
    const contentType = (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    if (contentType && !VALID_PDF_MIMES.includes(contentType)) {
      throw new Error(`Remote converter returned invalid media type: ${contentType}. Expected PDF document.`);
    }

    // Verify Content-Length header if present
    const contentLengthStr = response.headers.get('content-length');
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (!isNaN(contentLength) && contentLength > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Converted response exceeds maximum allowed download size limit (${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB).`);
      }
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Remote converter returned an empty file (0 bytes).');
    }
    if (blob.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Converted response exceeds maximum allowed download size limit (${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB).`);
    }

    if (options.onProgress) {
      options.onProgress('Validating generated PDF header and structure...');
    }

    // Validate %PDF magic header
    const headerSlice = await blob.slice(0, 5).text();
    if (!headerSlice.startsWith('%PDF')) {
      throw new Error('Remote converter returned an invalid PDF file (missing %PDF header).');
    }

    return blob;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Remote conversion timed out after ${TIMEOUT_REMOTE_MS / 1000} seconds. Please check your backend service.`
      );
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(
        `Unable to reach converter API at ${baseUrl}. Ensure your backend service is running or update the API URL in Settings.`
      );
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
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
