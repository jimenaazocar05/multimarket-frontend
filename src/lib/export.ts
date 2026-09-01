import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function exportToPDF(opts: {
  filename: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
  subtitle?: string;
}) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(opts.title, 14, 16);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(opts.subtitle, 14, 22);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows,
    startY: opts.subtitle ? 26 : 20,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [50, 90, 110] },
  });
  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}
