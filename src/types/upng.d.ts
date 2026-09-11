declare module 'upng-js' {
  export interface ImageArea {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export function decode(buffer: ArrayBuffer): {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: ImageArea[];
    data: Uint8Array;
  };

  export function toRGBA8(out: { frames: ImageArea[]; width: number; height: number }): ArrayBuffer[];

  export function encode(
    bufs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[]
  ): ArrayBuffer;

  export function encodeLL(
    bufs: ArrayBuffer[],
    w: number,
    h: number,
    cc?: number,
    ac?: number,
    depth?: number,
    dels?: number[]
  ): ArrayBuffer;
}
