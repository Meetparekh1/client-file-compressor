/**
 * Custom Error Classification and Normalizer
 * Translates raw browser/PDF/worker exceptions into user-friendly messages with recovery advice.
 * Sanitizes all output to prevent filesystem path exposure, stack trace leaks, and injection.
 */

export interface FriendlyError {
  title: string;
  message: string;
  actionText?: string;
  category: 'network' | 'encrypted' | 'corrupt' | 'memory' | 'validation' | 'timeout' | 'consent' | 'generic';
}

/**
 * Sanitizes an error message string to eliminate sensitive system information:
 * - Local filesystem paths (Windows and Unix)
 * - Stack traces
 * - Internal IPs and tokens
 * - Malicious HTML characters
 */
export function sanitizeErrorMessage(rawMsg: string): string {
  if (!rawMsg || typeof rawMsg !== 'string') return '';

  let sanitized = rawMsg;

  // 1. Strip local filesystem paths (C:\..., /Users/..., /home/..., /var/...)
  sanitized = sanitized.replace(/[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n\s]+(?:\\+)?)+/gi, '[path-redacted]');
  sanitized = sanitized.replace(/\/(?:Users|home|var|tmp|etc|usr|bin)\/[^\s:;,"'<>|]+/gi, '[path-redacted]');
  sanitized = sanitized.replace(/file:\/\/\/[^\s]+/gi, '[redacted-uri]');

  // 2. Strip internal IP addresses and auth query strings
  sanitized = sanitized.replace(/\b(?:127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)\b/g, '[ip-redacted]');
  sanitized = sanitized.replace(/(token|key|secret|password|auth)=[\w.-]+/gi, '$1=[redacted]');

  // 3. Strip stack traces (e.g. \n at Function.xyz (file:1:2) or at xyz (file:1:2))
  sanitized = sanitized.replace(/(?:\r?\n|^)\s*at\s+.+/gi, '');
  sanitized = sanitized.replace(/\bat\s+[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/Error:\s*/gi, '');

  // 4. Escape HTML to prevent XSS in error banners
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 5. Normalization & truncation
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized.length > 150 ? `${sanitized.slice(0, 147)}...` : sanitized;
}

export function parseErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred.') {
  const friendly = parseFriendlyError(error, fallbackMessage);
  return {
    ...friendly,
    type: friendly.category,
  };
}

export function parseFriendlyError(error: unknown, fallbackMessage = 'An unexpected error occurred.'): FriendlyError {
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  const cleanMsg = sanitizeErrorMessage(rawMsg);

  // 1. Remote consent requirement
  if (rawMsg.toLowerCase().includes('consent') && rawMsg.toLowerCase().includes('remote')) {
    return {
      title: 'Remote Processing Consent Required',
      message: 'Zero files leave this device without explicit consent. Please grant consent in the confirmation dialog to use remote server processing.',
      actionText: 'Review Consent',
      category: 'consent',
    };
  }

  // 2. Security limit / Execution timeout
  if (
    rawMsg.toLowerCase().includes('exceeded maximum execution time') ||
    rawMsg.toLowerCase().includes('timed out') ||
    rawMsg.toLowerCase().includes('timeout')
  ) {
    return {
      title: 'Execution Timed Out',
      message: 'The operation took too long and was aborted to preserve browser responsiveness.',
      actionText: 'Try Smaller File',
      category: 'timeout',
    };
  }

  // 3. Upload and page limits
  if (
    rawMsg.toLowerCase().includes('upload limit') ||
    rawMsg.toLowerCase().includes('pages per session') ||
    rawMsg.toLowerCase().includes('maximum allowed limit') ||
    rawMsg.toLowerCase().includes('too many images')
  ) {
    return {
      title: 'Safety Limit Exceeded',
      message: cleanMsg || 'The document exceeds memory safety limits.',
      category: 'validation',
    };
  }

  // 4. Worker fetch failure / Offline network drop
  if (
    rawMsg.includes('Failed to fetch dynamically imported module') ||
    rawMsg.includes('Setting up fake worker failed') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('Failed to fetch') ||
    !navigator.onLine
  ) {
    return {
      title: 'Connection or Resource Loading Error',
      message: 'Could not load the processing engine. Please check your internet connection or refresh the page to reload cached components.',
      actionText: 'Refresh Page',
      category: 'network',
    };
  }

  // 5. Encrypted / Password protected PDF
  if (
    rawMsg.toLowerCase().includes('password') ||
    rawMsg.toLowerCase().includes('encrypted') ||
    rawMsg.includes('PasswordException')
  ) {
    return {
      title: 'Password Protected Document',
      message: 'This document is locked with a password. Please unlock the file or provide an unencrypted PDF.',
      category: 'encrypted',
    };
  }

  // 6. Out of memory / Buffer allocation failure
  if (
    rawMsg.toLowerCase().includes('out of memory') ||
    rawMsg.toLowerCase().includes('allocation failed') ||
    rawMsg.toLowerCase().includes('arraybuffer')
  ) {
    return {
      title: 'Memory Limit Reached',
      message: 'The file is too large for your browser’s available memory. Try splitting the document or closing other browser tabs.',
      category: 'memory',
    };
  }

  // 7. Corrupted file / Invalid PDF structure
  if (
    rawMsg.includes('InvalidPDFException') ||
    rawMsg.toLowerCase().includes('corrupt') ||
    rawMsg.toLowerCase().includes('invalid pdf') ||
    rawMsg.toLowerCase().includes('bad xref')
  ) {
    return {
      title: 'Corrupted or Unsupported File',
      message: 'Unable to parse this document. The file may be damaged or saved in an unrecognized format.',
      category: 'corrupt',
    };
  }

  // 8. Page range / validation errors
  if (
    rawMsg.toLowerCase().includes('page range') ||
    rawMsg.toLowerCase().includes('outside document range') ||
    rawMsg.toLowerCase().includes('valid page numbers')
  ) {
    return {
      title: 'Invalid Page Range',
      message: cleanMsg,
      category: 'validation',
    };
  }

  // 9. Delete all pages error
  if (rawMsg.toLowerCase().includes('cannot delete all pages')) {
    return {
      title: 'Cannot Delete All Pages',
      message: 'A PDF document must keep at least one page. Please leave at least one page unselected.',
      category: 'validation',
    };
  }

  // Fallback sanitized generic message
  return {
    title: 'Operation Failed',
    message: cleanMsg || fallbackMessage,
    category: 'generic',
  };
}
