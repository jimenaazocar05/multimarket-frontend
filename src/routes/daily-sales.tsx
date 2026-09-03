import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { DailyReport } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Search, FileSpreadsheet } from "lucide-react";
import { money } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { useTableSort } from "@/lib/sort";

export const Route = createFileRoute("/daily-sales")({
  head: () => ({
    meta: [
      { title: "Utilidad Bruta — Multimarket" },
      { name: "description", content: "Detalle de ventas por producto para un día específico." },
      { property: "og:title", content: "Utilidad Bruta — Multimarket" },
      { property: "og:description", content: "Detalle de ventas por producto para un día específico." },
    ],
  }),
  component: DailySales,
});

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function DailySales() {
  const today = isoDate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");

  const { data: report } = useQuery({
    queryKey: ["daily-sales", from, to],
    queryFn: () => apiGet<DailyReport>(`/api/reports/daily?from=${from}&to=${to}`),
  });

  const items = (report?.items ?? []).filter((p) =>
    p.product_name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(items, "product_name", "asc");
  const totalQuantity = (report?.items ?? []).reduce((sum, p) => sum + p.quantity, 0);

  const exportExcel = () => {
    if (!report) return;
    exportToExcel(`utilidad-bruta_${from}_${to}`, [
      { name: "Resumen", rows: [{ Desde: from, Hasta: to, Venta: report.total_sales, Costo: report.total_cost, Utilidad: report.total_profit }] },
      {
        name: "Detalle",
        rows: sorted.map((p) => ({
          Producto: p.product_name, Cantidad: p.quantity, Venta: p.sale_total, Costo: p.cost_total, Utilidad: p.profit,
        })),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Utilidad Bruta</h1>
        <p className="text-sm text-muted-foreground">Detalle por producto: cantidad, venta, costo y utilidad en el rango de fechas seleccionado.</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-auto">
            <Label htmlFor="daily-sales-from">Desde</Label>
            <Input id="daily-sales-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-full sm:w-auto">
            <Label htmlFor="daily-sales-to">Hasta</Label>
            <Input id="daily-sales-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="daily-sales-search">Producto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="daily-sales-search"
                placeholder="Buscar por nombre de producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button variant="outline" onClick={exportExcel} disabled={!report}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar a Excel
          </Button>
        </CardContent>
      </Card>

      {report && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Stat title="Venta" value={money(report.total_sales)} />
          <Stat title="Costo" value={money(report.total_cost)} />
          <Stat title="Utilidad" value={money(report.total_profit)} highlight />
          <Stat title="Productos vendidos" value={totalQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 })} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="product_name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Producto</SortableHead>
                <SortableHead sortKey="quantity" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Cant.</SortableHead>
                <SortableHead sortKey="sale_total" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Venta</SortableHead>
                <SortableHead sortKey="cost_total" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Costo</SortableHead>
                <SortableHead sortKey="profit" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Utilidad</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.product_id ?? p.product_name}>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.sale_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.cost_total)}</TableCell>
                  <TableCell className="text-right tabular-nums text-success">{money(p.profit)}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    {search.trim()
                      ? "Ningún producto coincide con la búsqueda."
                      : "Sin ventas registradas para este rango de fechas."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
