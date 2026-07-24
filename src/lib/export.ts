import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(filename: string, rows: Record<string, unknown>[], sheetName = "Datos") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
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
