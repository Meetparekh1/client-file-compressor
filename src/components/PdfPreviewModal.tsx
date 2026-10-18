import React from 'react';
import { DocumentViewerWorkspace } from './DocumentViewerWorkspace';

export interface PdfPreviewModalProps {
  file: File | Blob;
  fileName?: string;
  onClose: () => void;
  compareFile?: File | Blob | null;
  compareFileName?: string;
}

/**
 * PdfPreviewModal
 * Backwards-compatible wrapper delegating to the unified DocumentViewerWorkspace
 */
export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  file,
  fileName = 'Document.pdf',
  onClose,
  compareFile,
  compareFileName,
}) => {
  return (
    <DocumentViewerWorkspace
      file={file}
      fileName={fileName}
      compareFile={compareFile}
      compareFileName={compareFileName}
      mode="modal"
      onClose={onClose}
    />
  );
};
