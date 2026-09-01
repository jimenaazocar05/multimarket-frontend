import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Reports as ReportsData, Sale } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money, formatDate } from "@/lib/format";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { useTableSort } from "@/lib/sort";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reportes — Multimarket" },
      { name: "description", content: "Reportes de ganancia y ranking de productos. Exporta a Excel y PDF." },
      { property: "og:title", content: "Reportes — Multimarket" },
      { property: "og:description", content: "Reportes de ganancia y ranking de productos. Exporta a Excel y PDF." },
    ],
  }),
  component: Reports,
});

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function Reports() {
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const { data: report } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => apiGet<ReportsData>(`/api/reports?from=${from}&to=${to}`),
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["report-sales", from, to],
    queryFn: () => apiGet<Sale[]>(`/api/sales?from=${from}&to=${to}`),
  });

  const agg = report && {
    total: report.total_sales,
    cost: report.total_cost,
    profit: report.total_profit,
    salesCount: sales.length,
    byRevenue: report.top_by_revenue.map((p) => ({ name: p.product_name, qty: p.quantity, revenue: p.revenue, profit: p.profit })),
    byProfit: report.top_by_profit.map((p) => ({ name: p.product_name, qty: p.quantity, revenue: p.revenue, profit: p.profit })),
  };

  const exportExcel = () => {
    if (!agg) return;
    exportToExcel(`reporte_${from}_${to}`, [
      {
        name: "Resumen",
        rows: [{
          Desde: from, Hasta: to,
          Ventas: agg.salesCount, Ingreso: agg.total, Costo: agg.cost, Ganancia: agg.profit,
        }],
      },
      {
        name: "Top por ingreso",
        rows: agg.byRevenue.map((p) => ({ Producto: p.name, Unidades: p.qty, Ingreso: p.revenue, Ganancia: p.profit })),
      },
      {
        name: "Top por ganancia",
        rows: agg.byProfit.map((p) => ({ Producto: p.name, Unidades: p.qty, Ingreso: p.revenue, Ganancia: p.profit })),
      },
    ]);
  };
  const exportPdf = () => {
    if (!agg) return;
    exportToPDF({
      filename: `reporte_${from}_${to}`,
      title: "Reporte de ventas",
      subtitle: `Período ${from} → ${to} · Total ${money(agg.total)} · Ganancia ${money(agg.profit)}`,
      columns: ["Producto", "Und", "Ingreso", "Ganancia"],
      rows: agg.byRevenue.map((p) => [p.name, p.qty, money(p.revenue), money(p.profit)]),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">Ganancia por rango de fechas y ranking de productos.</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-auto"><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-full sm:w-auto"><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="w-full flex gap-2 sm:ml-auto sm:w-auto">
            <Button variant="outline" onClick={exportExcel} className="flex-1 sm:flex-none"><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={exportPdf} className="flex-1 sm:flex-none"><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      {agg && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Stat title="Ventas" value={String(agg.salesCount)} />
            <Stat title="Ingreso" value={money(agg.total)} />
            <Stat title="Costo" value={money(agg.cost)} />
            <Stat title="Ganancia" value={money(agg.profit)} highlight />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Más vendidos (por ingreso)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <RevenueTable items={agg.byRevenue} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Más rentables (por ganancia)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ProfitTable items={agg.byProfit} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-1 ${highlight ? "text-success" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function RevenueTable({ items }: { items: Array<{ name: string; qty: number; revenue: number }> }) {
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(items, "revenue", "desc");
  return (
    <Table>
      <TableHeader><TableRow>
        <SortableHead sortKey="name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Producto</SortableHead>
        <SortableHead sortKey="qty" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Und</SortableHead>
        <SortableHead sortKey="revenue" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Ingreso</SortableHead>
      </TableRow></TableHeader>
      <TableBody>
        {sorted.slice(0, 15).map((p) => (
          <TableRow key={p.name}>
            <TableCell className="font-medium max-w-[140px] truncate">{p.name}</TableCell>
            <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
            <TableCell className="text-right tabular-nums">{money(p.revenue)}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin datos.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function ProfitTable({ items }: { items: Array<{ name: string; qty: number; profit: number }> }) {
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(items, "profit", "desc");
  return (
    <Table>
      <TableHeader><TableRow>
        <SortableHead sortKey="name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Producto</SortableHead>
        <SortableHead sortKey="qty" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Und</SortableHead>
        <SortableHead sortKey="profit" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Ganancia</SortableHead>
      </TableRow></TableHeader>
      <TableBody>
        {sorted.slice(0, 15).map((p) => (
          <TableRow key={p.name}>
            <TableCell className="font-medium max-w-[140px] truncate">{p.name}</TableCell>
            <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
            <TableCell className="text-right tabular-nums text-success">{money(p.profit)}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin datos.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}
