import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { MonthlyKpis } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Calendar, TrendingUp, TrendingDown, FileSpreadsheet } from "lucide-react";

const monthlyReportSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/monthly-report")({
  head: () => ({
    meta: [
      { title: "Resultado neto — Multimarket" },
      { name: "description", content: "Utilidad neta y flujo de caja: ventas, costo, gastos y deudas relacionados en un solo lugar." },
      { property: "og:title", content: "Resultado neto — Multimarket" },
      { property: "og:description", content: "Utilidad neta y flujo de caja: ventas, costo, gastos y deudas relacionados en un solo lugar." },
    ],
  }),
  validateSearch: monthlyReportSearchSchema,
  component: MonthlyReportPage,
});

/** Primer y último día del mes actual, como strings YYYY-MM-DD en hora local. */
function monthBounds(): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  };
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function MonthlyReportPage() {
  const search = Route.useSearch();
  const initial = monthBounds();
  const [from, setFrom] = useState(search.from ?? initial.from);
  const [to, setTo] = useState(search.to ?? initial.to);

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-report-detail", from, to],
    queryFn: () => apiGet<MonthlyKpis>(`/api/monthly-report/kpis?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const exportExcel = () => {
    if (!data) return;
    exportToExcel(`resultado-neto_${from}_${to}`, [
      {
        name: "Estado de resultados",
        rows: [{
          Desde: from, Hasta: to,
          Ventas: data.profit_loss.revenue,
          "Costo de mercadería": data.profit_loss.cogs,
          "Utilidad bruta": data.profit_loss.gross_profit,
          "Margen bruto %": data.profit_loss.gross_margin_pct,
          "Gastos operativos": data.profit_loss.operating_expenses,
          "Utilidad neta": data.profit_loss.net_profit,
          "Margen neto %": data.profit_loss.net_margin_pct,
          "Margen neto vs período anterior (pp)": data.net_margin_change_pct,
          "Utilidad neta período anterior": data.profit_loss_prev.net_profit,
        }],
      },
      {
        name: "Flujo de caja",
        rows: [{
          Desde: from, Hasta: to,
          "Ventas al contado": data.cash_flow.cash_in_from_sales,
          "Abonos a cuentas por cobrar": data.cash_flow.cash_in_from_receivables,
          "Total cobrado": data.cash_flow.cash_in,
          "Gastos operativos pagados": data.cash_flow.cash_out_from_expenses,
          "Compras a proveedores pagadas": data.cash_flow.cash_out_from_purchases,
          "Total pagado": data.cash_flow.cash_out,
          "Flujo de caja neto": data.cash_flow.net_cash_flow,
        }],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resultado neto</h1>
          <p className="text-sm text-muted-foreground">
            Utilidad neta y flujo de caja del rango seleccionado: cómo se relacionan ventas, gastos y deudas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
          <span className="text-muted-foreground text-sm font-medium">—</span>
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
          <Button variant="outline" onClick={exportExcel} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar a Excel
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="p-6 text-sm text-muted-foreground">Calculando el período seleccionado…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Estado de resultados</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <Line label="Ventas" value={money(data.profit_loss.revenue)} />
              <Line label="Costo de mercadería" value={`− ${money(data.profit_loss.cogs)}`} muted />
              <Line label="Utilidad bruta" value={money(data.profit_loss.gross_profit)} bold />
              <div className="text-xs text-muted-foreground pl-0 -mt-1 pb-1">
                Margen bruto {data.profit_loss.gross_margin_pct.toFixed(1)}%
              </div>
              <Line label="Gastos operativos" value={`− ${money(data.profit_loss.operating_expenses)}`} muted />
              <div className="border-t my-2" />
              <Line
                label="Utilidad neta"
                value={money(data.profit_loss.net_profit)}
                bold
                accent={data.profit_loss.net_profit >= 0 ? "success" : "destructive"}
              />
              <div className="text-xs text-muted-foreground pl-0 -mt-1">
                Margen neto {data.profit_loss.net_margin_pct.toFixed(1)}%
              </div>

              <div className="border-t my-3" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vs. período anterior ({formatRange(data.profit_loss_prev.period_from, data.profit_loss_prev.period_to)})</span>
                <div className="flex items-center gap-1.5">
                  {data.net_margin_change_pct >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`font-medium tabular-nums ${data.net_margin_change_pct >= 0 ? "text-success" : "text-destructive"}`}>
                    {data.net_margin_change_pct >= 0 ? "+" : ""}
                    {data.net_margin_change_pct.toFixed(1)} pp
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Utilidad neta anterior: {money(data.profit_loss_prev.net_profit)} ({data.profit_loss_prev.net_margin_pct.toFixed(1)}% margen)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Flujo de caja</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-1">Cobrado</div>
              <Line label="Ventas al contado" value={money(data.cash_flow.cash_in_from_sales)} />
              <Line label="Abonos a cuentas por cobrar" value={money(data.cash_flow.cash_in_from_receivables)} />
              <Line label="Total cobrado" value={money(data.cash_flow.cash_in)} bold />

              <div className="border-t my-3" />

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-1">Pagado</div>
              <Line label="Gastos operativos" value={money(data.cash_flow.cash_out_from_expenses)} />
              <Line label="Compras a proveedores" value={money(data.cash_flow.cash_out_from_purchases)} />
              <Line label="Total pagado" value={money(data.cash_flow.cash_out)} bold />

              <div className="border-t my-3" />

              <Line
                label="Flujo de caja neto"
                value={money(data.cash_flow.net_cash_flow)}
                bold
                accent={data.cash_flow.net_cash_flow >= 0 ? "success" : "destructive"}
              />
              <p className="text-xs text-muted-foreground pt-2">
                Diferencia con la utilidad neta: la utilidad cuenta gastos incurridos aunque no se hayan pagado; el flujo de caja solo cuenta dinero que realmente entró o salió.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatRange(from: string, to: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const f = new Date(from + "T00:00:00").toLocaleDateString("es-DO", opts);
  const t = new Date(to + "T00:00:00").toLocaleDateString("es-DO", opts);
  return `${f} – ${t}`;
}

function Line({
  label,
  value,
  bold,
  muted,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: "success" | "destructive";
}) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={`tabular-nums ${bold ? "font-semibold text-base" : ""} ${
          accent ? (accent === "success" ? "text-success" : "text-destructive") : muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
