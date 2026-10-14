import { describe, it, expect } from 'vitest';
import { sanitizeFilename, getOutputFilename } from '../src/lib/utils';

describe('Filename Sanitization & Output Formatting', () => {
  describe('Directory Traversal & Path Stripping', () => {
    it('strips Unix directory traversal and path segments', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('/var/www/uploads/doc.pdf')).toBe('doc.pdf');
      expect(sanitizeFilename('folder/subfolder/file.png')).toBe('file.png');
    });

    it('strips Windows directory traversal and drive letters', () => {
      expect(sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFilename('C:\\Users\\admin\\Desktop\\data.xlsx')).toBe('data.xlsx');
      expect(sanitizeFilename('D:\\nested\\secret.txt')).toBe('secret.txt');
    });

    it('handles mixed forward and backward slashes', () => {
      expect(sanitizeFilename('..\\path/to\\target.pdf')).toBe('target.pdf');
    });

    it('decodes URI encoded traversal characters before stripping', () => {
      expect(sanitizeFilename('%2e%2e%2f%2e%2e%2fhidden.key')).toBe('hidden.key');
      expect(sanitizeFilename('%2e%2e%5csecret.pdf')).toBe('secret.pdf');
    });
  });

  describe('Windows Reserved Device Names', () => {
    const reservedBases = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    reservedBases.forEach((resName) => {
      it(`shields reserved device name "${resName}" with prefix safe_`, () => {
        expect(sanitizeFilename(resName)).toBe(`safe_${resName}`);
        expect(sanitizeFilename(`${resName}.txt`)).toBe(`safe_${resName}.txt`);
        expect(sanitizeFilename(`${resName.toLowerCase()}.pdf`)).toBe(`safe_${resName.toLowerCase()}.pdf`);
      });
    });
  });

  describe('Illegal File System & Control Characters', () => {
    it('replaces reserved characters <>:"/\\|?* with underscore', () => {
      expect(sanitizeFilename('annual:report*2026?.pdf')).toBe('annual_report_2026_.pdf');
      expect(sanitizeFilename('<script>"alert"</script>.html')).toBe('script_.html');
      expect(sanitizeFilename('<tag>name?*.pdf')).toBe('_tag_name__.pdf');
      expect(sanitizeFilename('file|pipe>out.doc')).toBe('file_pipe_out.doc');
    });

    it('replaces ASCII non-printable control characters (< 32 and 127) with underscore', () => {
      const withNullAndTab = `my\x00file\x07name\x1f.pdf`;
      const sanitized = sanitizeFilename(withNullAndTab);
      expect(sanitized).toBe('my_file_name_.pdf');
    });

    it('strips leading and trailing dots and spaces', () => {
      expect(sanitizeFilename('   my_document.pdf   ')).toBe('my_document.pdf');
      expect(sanitizeFilename('document.pdf.....')).toBe('document.pdf');
      expect(sanitizeFilename('....hidden.pdf')).toBe('hidden.pdf');
    });
  });

  describe('Boundary Conditions & Length Constraints', () => {
    it('falls back to "file" for empty or non-string inputs', () => {
      expect(sanitizeFilename('')).toBe('file');
      expect(sanitizeFilename('   ')).toBe('file');
      expect(sanitizeFilename('.....')).toBe('file');
      expect(sanitizeFilename(null as unknown as string)).toBe('file');
      expect(sanitizeFilename(undefined as unknown as string)).toBe('file');
    });

    it('constrains long filenames to 200 characters while preserving extension', () => {
      const veryLong = 'A'.repeat(250) + '.pdf';
      const safe = sanitizeFilename(veryLong);
      expect(safe.length).toBeLessThanOrEqual(200);
      expect(safe.endsWith('.pdf')).toBe(true);
    });
  });

  describe('getOutputFilename formatting', () => {
    it('prepends default prefix for identical formats', () => {
      expect(getOutputFilename('report.pdf', 'original')).toBe('compressed_report.pdf');
      expect(getOutputFilename('image.png', undefined)).toBe('compressed_image.png');
    });

    it('changes extension and prefix for converted image formats', () => {
      expect(getOutputFilename('photo.png', 'image/webp')).toBe('converted_photo.webp');
      expect(getOutputFilename('photo.png', 'image/jpeg')).toBe('converted_photo.jpg');
      expect(getOutputFilename('photo.webp', 'image/png')).toBe('converted_photo.png');
      expect(getOutputFilename('photo.jpg', 'image/avif')).toBe('converted_photo.avif');
    });

    it('changes extension and prefix for converted document formats', () => {
      expect(getOutputFilename('document.pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
        .toBe('converted_document.docx');
      expect(getOutputFilename('contract.docx', 'application/pdf')).toBe('converted_contract.pdf');
    });

    it('sanitizes malicious filename when generating output filename', () => {
      expect(getOutputFilename('../../../secret:file.pdf', 'image/webp')).toBe('converted_secret_file.webp');
    });
  });
});
