/**
 * Custom Error Classification and Normalizer
 * Translates raw browser/PDF/worker exceptions into user-friendly messages with recovery advice.
 */

export interface FriendlyError {
  title: string;
  message: string;
  actionText?: string;
  category: 'network' | 'encrypted' | 'corrupt' | 'memory' | 'validation' | 'generic';
}

export function parseFriendlyError(error: unknown, fallbackMessage = 'An unexpected error occurred.'): FriendlyError {
  const rawMsg = error instanceof Error ? error.message : String(error || '');

  // 1. Worker fetch failure / Offline network drop
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

  // 2. Encrypted / Password protected PDF
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

  // 3. Out of memory / Buffer allocation failure
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

  // 4. Corrupted file / Invalid PDF structure
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

  // 5. Page range / validation errors
  if (
    rawMsg.toLowerCase().includes('page range') ||
    rawMsg.toLowerCase().includes('outside document range') ||
    rawMsg.toLowerCase().includes('valid page numbers')
  ) {
    return {
      title: 'Invalid Page Range',
      message: rawMsg,
      category: 'validation',
    };
  }

  // 6. Delete all pages error
  if (rawMsg.toLowerCase().includes('cannot delete all pages')) {
    return {
      title: 'Cannot Delete All Pages',
      message: 'A PDF document must keep at least one page. Please leave at least one page unselected.',
      category: 'validation',
    };
  }

  // Fallback generic friendly message
  return {
    title: 'Operation Failed',
    message: rawMsg.length > 120 ? `${rawMsg.slice(0, 117)}...` : (rawMsg || fallbackMessage),
    category: 'generic',
  };
}
