import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money, formatDate } from "@/lib/format";
import { exportToExcel, exportToPDF } from "@/lib/export";

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

  const { data } = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const fromISO = new Date(from + "T00:00:00").toISOString();
      const toISO = new Date(to + "T23:59:59").toISOString();
      const [salesRes, itemsRes] = await Promise.all([
        supabase.from("sales").select("*").gte("sale_date", fromISO).lte("sale_date", toISO),
        supabase.from("sale_items").select("*, sales!inner(sale_date)").gte("sales.sale_date", fromISO).lte("sales.sale_date", toISO),
      ]);
      return { sales: salesRes.data ?? [], items: itemsRes.data ?? [] };
    },
  });

  const agg = useMemo(() => {
    if (!data) return null;
    const total = data.sales.reduce((s, r) => s + Number(r.total), 0);
    const cost = data.sales.reduce((s, r) => s + Number(r.cost_total), 0);
    const profit = total - cost;
    const productMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    for (const it of data.items) {
      const cur = productMap.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0, profit: 0 };
      cur.qty += Number(it.quantity);
      cur.revenue += Number(it.subtotal);
      cur.profit += (Number(it.unit_price) - Number(it.unit_cost)) * Number(it.quantity);
      productMap.set(it.product_name, cur);
    }
    const byRevenue = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
    const byProfit = Array.from(productMap.values()).sort((a, b) => b.profit - a.profit);
    return { total, cost, profit, salesCount: data.sales.length, byRevenue, byProfit };
  }, [data]);

  const exportExcel = () => {
    if (!agg) return;
    exportToExcel(`reporte_${from}_${to}`, agg.byRevenue.map((p) => ({
      Producto: p.name, Unidades: p.qty, Ingreso: p.revenue, Ganancia: p.profit,
    })));
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
          <div><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      {agg && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat title="Ventas" value={String(agg.salesCount)} />
            <Stat title="Ingreso" value={money(agg.total)} />
            <Stat title="Costo" value={money(agg.cost)} />
            <Stat title="Ganancia" value={money(agg.profit)} highlight />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Más vendidos (por ingreso)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Und</TableHead><TableHead className="text-right">Ingreso</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {agg.byRevenue.slice(0, 15).map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {agg.byRevenue.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin datos.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Más rentables (por ganancia)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Und</TableHead><TableHead className="text-right">Ganancia</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {agg.byProfit.slice(0, 15).map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                        <TableCell className="text-right tabular-nums text-success">{money(p.profit)}</TableCell>
                      </TableRow>
                    ))}
                    {agg.byProfit.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sin datos.</TableCell></TableRow>}
                  </TableBody>
                </Table>
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
