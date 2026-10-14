import UPNG from 'upng-js';

export interface QuantizePngRequest {
  id: string;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  colors: number;
}

export interface QuantizePngResponse {
  id: string;
  pngBuffer?: ArrayBuffer;
  error?: string;
}

self.onmessage = (e: MessageEvent<QuantizePngRequest>) => {
  const { id, buffer, width, height, colors } = e.data;
  try {
    const pngBuffer = UPNG.encode([buffer], width, height, colors);
    const resp: QuantizePngResponse = { id, pngBuffer };
    // Transfer buffer back to main thread zero-copy
    (self as unknown as Worker).postMessage(resp, [pngBuffer]);
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      id,
      error: err?.message || 'Failed to quantize PNG in Web Worker',
    });
  }
};
