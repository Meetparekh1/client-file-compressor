/**
 * Standardized Consent Management for Remote Server Processing
 * Ensures that zero user documents leave the local device without explicit consent.
 */

const REMOTE_CONSENT_KEY = 'docukit_remote_processing_consent';

export interface RemoteConsentState {
  granted: boolean;
  timestamp?: number;
  endpointUrl?: string;
}

/**
 * Checks whether the user has explicitly consented to remote processing.
 */
export function hasRemoteProcessingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(REMOTE_CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as RemoteConsentState;
    return Boolean(parsed && parsed.granted);
  } catch {
    return false;
  }
}

/**
 * Sets explicit user consent for remote processing.
 */
export function setRemoteProcessingConsent(granted: boolean, endpointUrl?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const state: RemoteConsentState = {
      granted,
      timestamp: Date.now(),
      endpointUrl,
    };
    localStorage.setItem(REMOTE_CONSENT_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage write failure in restricted environments
  }
}

/**
 * Revokes consent for remote processing.
 */
export function revokeRemoteProcessingConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REMOTE_CONSENT_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Asserts that remote processing consent is active before any off-device network transmission.
 * Throws a SecurityError if consent is missing.
 */
export function assertRemoteProcessingConsent(endpointUrl?: string): void {
  if (!hasRemoteProcessingConsent()) {
    throw new Error(
      `Remote processing requires explicit user consent before files are transmitted off-device${
        endpointUrl ? ` to ${endpointUrl}` : ''
      }. Please confirm in the remote processing prompt.`
    );
  }
}
