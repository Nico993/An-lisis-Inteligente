'use client';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Captura un nodo DOM y genera un PDF multipágina (A4 vertical).
 * @param {HTMLElement | null} element
 * @param {string} [filename]
 */
export async function exportElementToPdf(element, filename = 'insights_rappi.pdf') {
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#0f1419',
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
