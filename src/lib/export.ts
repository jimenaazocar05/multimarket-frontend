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

// Paleta del sistema (ver src/styles.css): azul del logo, azul marino del sidebar,
// y los acentos rojo / amarillo / verde del logo.
const BRAND = {
  navy: [11, 26, 61] as [number, number, number],
  blue: [0, 119, 255] as [number, number, number],
  red: [255, 31, 25] as [number, number, number],
  yellow: [255, 204, 0] as [number, number, number],
  green: [163, 217, 54] as [number, number, number],
  zebra: [236, 244, 255] as [number, number, number],
};

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo_multimarket.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportToPDF(opts: {
  filename: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
  subtitle?: string;
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerHeight = 34;

  // Banda de encabezado con el logo y el título
  doc.setFillColor(...BRAND.navy);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  const logo = await loadLogo();
  let textX = 14;
  if (logo) {
    doc.addImage(logo, "PNG", 12, 5, 24, 24);
    textX = 42;
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(opts.title, textX, opts.subtitle ? 17 : 21);
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 215, 245);
    doc.text(opts.subtitle, textX, 24);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.yellow);
  doc.text("Multimarket", pageWidth - 14, 20, { align: "right" });

  // Franja tricolor bajo el encabezado
  const third = pageWidth / 3;
  doc.setFillColor(...BRAND.red);
  doc.rect(0, headerHeight, third, 2, "F");
  doc.setFillColor(...BRAND.yellow);
  doc.rect(third, headerHeight, third, 2, "F");
  doc.setFillColor(...BRAND.green);
  doc.rect(third * 2, headerHeight, third, 2, "F");

  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows,
    startY: headerHeight + 8,
    margin: { left: 14, right: 14, bottom: 16 },
    styles: { fontSize: 10, cellPadding: 3, textColor: BRAND.navy },
    headStyles: { fillColor: BRAND.blue, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: BRAND.zebra },
    // La última columna (precio u otros montos) se alinea a la derecha
    columnStyles: { [opts.columns.length - 1]: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === opts.columns.length - 1) {
        data.cell.styles.halign = "right";
      }
    },
  });

  // Pie de página con numeración
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.blue);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Multimarket", 14, pageHeight - 7);
    doc.text(`Página ${i} de ${pages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}
