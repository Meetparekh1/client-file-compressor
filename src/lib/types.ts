export type FileStatus = 'idle' | 'compressing' | 'completed' | 'error';
export type TargetMode = 'target_size' | 'percentage';

export type SupportedCategory = 'image' | 'pdf' | 'docx' | 'svg' | 'unsupported';
export type OutputFormat =
  | 'original'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/png'
  | 'image/avif'
  | 'application/pdf';

export type ToolTab = 'all' | 'images' | 'pdf' | 'docx';
export type ViewMode = 'grid' | 'list';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  category: SupportedCategory;
  mimeType: string;
  originalSize: number;

  // Target preferences
  targetMode: TargetMode;
  targetSize: number; // in bytes
  targetPercentage: number; // 10 to 90%
  outputFormat?: OutputFormat;
  maxWidth?: number; // Optional max dimension constraint
  rotation?: number; // 0, 90, 180, 270 degrees

  // Results
  compressedBlob?: Blob;
  compressedSize?: number;
  originalPreviewUrl?: string;
  compressedPreviewUrl?: string;

  // Progress & Stats
  status: FileStatus;
  progress: number; // 0 to 100
  accuracy?: number; // e.g. 98.8%
  iterations?: number;
  savingsPercent?: number;
  dimensions?: {
    originalWidth: number;
    originalHeight: number;
    newWidth?: number;
    newHeight?: number;
  };
  pdfPageCount?: number;
  errorMessage?: string;
}

export interface CompressionOptions {
  targetSizeBytes: number;
  tolerance?: number; // default 0.02 (2% error tolerance -> 98-100% target accuracy)
  outputFormat?: OutputFormat;
  maxWidth?: number;
  rotation?: number;
  onProgress?: (progress: number, note?: string) => void;
}

export interface CompressionResult {
  blob: Blob;
  accuracy: number;
  iterations: number;
  originalWidth?: number;
  originalHeight?: number;
  newWidth?: number;
  newHeight?: number;
  pdfPageCount?: number;
}
