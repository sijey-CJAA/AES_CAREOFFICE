export interface PdfExportOptions {
  filename: string;
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export async function exportTableToPDF({
  filename,
  title,
  headers,
  rows,
}: PdfExportOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const heading = title || `${filename.replace(/\.pdf$/i, '').toUpperCase()} REPORT`;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(heading, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((r) =>
      r.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
    ),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [221, 221, 221],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    margin: { top: 20, left: 10, right: 10 },
  });

  doc.save(filename);
}
