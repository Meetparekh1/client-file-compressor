import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function convertHtmlToPdf(
  htmlContent: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<Blob> {
  onProgress?.(10, 'Preparing HTML rendering environment...');
  
  // Create a hidden container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '800px'; // fixed width for A4 proportion approximation
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '20px';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    onProgress?.(40, 'Rendering HTML to Canvas...');
    const canvas = await html2canvas(container, {
      scale: 2, // higher resolution
      useCORS: true,
      logging: false,
    });
    
    onProgress?.(70, 'Building PDF...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Scale image to fit A4 width
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    // If it's a very long HTML page, we should split it across pages
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    onProgress?.(100, 'Done!');
    const blob = pdf.output('blob');
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}
