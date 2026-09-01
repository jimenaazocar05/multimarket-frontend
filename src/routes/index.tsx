import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Dashboard as DashboardData, Sale, Receivable, MonthlyKpis, Reports as ReportsData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaleDetailDialog } from "@/components/sale-detail-dialog";
import { money, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  Eye,
  Wallet,
  Receipt,
  Clock,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Multimarket" },
      { name: "description", content: "Resumen del negocio: ventas, gastos, deudas y ganancia por rango de fechas." },
      { property: "og:title", content: "Dashboard — Multimarket" },
      { property: "og:description", content: "Resumen del negocio: ventas, gastos, deudas y ganancia por rango de fechas." },
    ],
  }),
  component: Dashboard,
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

function Dashboard() {
  const [viewing, setViewing] = useState<Sale | null>(null);
  const initialRange = monthBounds();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  // Datos de estado actual, no dependen del rango seleccionado (stock e inventario
  // son una foto de "ahora", no algo que tenga sentido acotar a un período pasado).
  const { data: staticData, isLoading: staticLoading } = useQuery({
    queryKey: ["dashboard-static"],
    queryFn: async () => {
      const [dashboard, receivables] = await Promise.all([
        apiGet<DashboardData>("/api/dashboard"),
        apiGet<Receivable[]>("/api/receivables"),
      ]);
      return { dashboard, receivables };
    },
  });

  // Todo lo demás se recalcula para el rango de fechas elegido arriba.
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => apiGet<ReportsData>(`/api/reports?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
  const { data: periodSales, isLoading: salesLoading } = useQuery({
    queryKey: ["period-sales", from, to],
    queryFn: () => apiGet<Sale[]>(`/api/sales?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
  const { data: monthlyKpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["monthly-kpis", from, to],
    queryFn: () => apiGet<MonthlyKpis>(`/api/monthly-report/kpis?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  if (staticLoading || !staticData) {
    return <div className="p-6 text-muted-foreground">Cargando…</div>;
  }

  const { dashboard, receivables } = staticData;
  const lowStock = dashboard.low_stock;
  const periodLoading = reportLoading || salesLoading || kpisLoading;
  const hasPeriodData = !periodLoading && !!report && !!monthlyKpis && !!periodSales;

  const exportExcel = () => {
    if (!hasPeriodData || !report || !monthlyKpis || !periodSales) return;
    exportToExcel(`dashboard_${from}_${to}`, [
      {
        name: "Resumen",
        rows: [{
          Desde: from, Hasta: to,
          Ventas: report.total_sales,
          "Costo de mercadería": report.total_cost,
          "Utilidad bruta": report.total_profit,
          "Utilidad neta": monthlyKpis.profit_loss.net_profit,
          "Margen neto %": monthlyKpis.profit_loss.net_margin_pct,
          "Flujo de caja neto": monthlyKpis.cash_flow.net_cash_flow,
          "Deuda vigente (CxP)": monthlyKpis.open_payables_total,
          "Por cobrar (CxC)": monthlyKpis.open_receivables_total,
        }],
      },
      {
        name: "Top productos",
        rows: report.top_by_revenue.map((p) => ({ Producto: p.product_name, Unidades: p.quantity, Ingreso: p.revenue, Ganancia: p.profit })),
      },
      {
        name: "Ventas del período",
        rows: periodSales.map((s) => ({
          Cliente: s.customer_name || "Venta de mostrador",
          Fecha: s.sale_date,
          Total: Number(s.total),
          Pagado: Number(s.amount_paid),
          Estado: s.status === "paid" ? "Pagado" : "Fiado",
        })),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen del negocio para el rango de fechas seleccionado.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              id="dashboard-from"
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
              id="dashboard-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
          <Button variant="outline" onClick={exportExcel} disabled={!hasPeriodData}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar a Excel
          </Button>
        </div>
      </div>

      {periodLoading || !report || !monthlyKpis || !periodSales ? (
        <div className="p-6 text-sm text-muted-foreground">Calculando el período seleccionado…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat title="Ventas" value={money(report.total_sales)} icon={DollarSign} accent="primary" href="/sales" search={{ from, to }} />
            <Stat title="Costo de mercadería" value={money(report.total_cost)} icon={Package} accent="chart-2" href="/monthly-report" search={{ from, to }} />
            <Stat title="Utilidad bruta" value={money(report.total_profit)} icon={ShoppingBag} accent="chart-3" href="/monthly-report" search={{ from, to }} />
            <Stat
              title="Utilidad neta"
              value={money(monthlyKpis.profit_loss.net_profit)}
              subtitle={`Margen neto ${monthlyKpis.profit_loss.net_margin_pct.toFixed(1)}%`}
              icon={monthlyKpis.profit_loss.net_profit >= 0 ? TrendingUp : TrendingDown}
              accent={monthlyKpis.profit_loss.net_profit >= 0 ? "success" : "destructive"}
              href="/monthly-report"
              search={{ from, to }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              title="Margen neto vs período anterior"
              value={`${monthlyKpis.net_margin_change_pct >= 0 ? "+" : ""}${monthlyKpis.net_margin_change_pct.toFixed(1)} pp`}
              icon={monthlyKpis.net_margin_change_pct >= 0 ? TrendingUp : TrendingDown}
              accent={monthlyKpis.net_margin_change_pct >= 0 ? "success" : "destructive"}
              href="/monthly-report"
              search={{ from, to }}
            />
            <Stat
              title="Flujo de caja neto"
              value={money(monthlyKpis.cash_flow.net_cash_flow)}
              subtitle={`Cobrado ${money(monthlyKpis.cash_flow.cash_in)} · Pagado ${money(monthlyKpis.cash_flow.cash_out)}`}
              icon={Wallet}
              accent={monthlyKpis.cash_flow.net_cash_flow >= 0 ? "success" : "destructive"}
              href="/monthly-report"
              search={{ from, to }}
            />
            <Stat
              title="Deuda vigente (CxP)"
              value={money(monthlyKpis.open_payables_total)}
              subtitle={`Antigüedad promedio ${Math.round(monthlyKpis.open_payables_avg_days_old)} días`}
              icon={Receipt}
              accent="warning"
              href="/payables"
              search={{ from, to }}
            />
            <Stat
              title="Por cobrar (CxC)"
              value={money(monthlyKpis.open_receivables_total)}
              subtitle={`Antigüedad promedio ${Math.round(monthlyKpis.open_receivables_avg_days_old)} días`}
              icon={Users}
              accent="destructive"
              href="/receivables"
              search={{ from, to }}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Top gastos del período</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyKpis.top_expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin gastos registrados en este rango.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {monthlyKpis.top_expenses.map((e) => (
                      <li key={e.payable_id} className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{e.concept}</div>
                          {e.supplier_name && <div className="text-xs text-muted-foreground truncate">{e.supplier_name}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-medium tabular-nums">{money(e.amount)}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(e.issue_date)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Clock className="h-4 w-4 text-warning" />
                <CardTitle className="text-base">Por vencer / vencidas</CardTitle>
                <Badge variant="secondary" className="ml-auto">{monthlyKpis.due_soon.length}</Badge>
              </CardHeader>
              <CardContent>
                {monthlyKpis.due_soon.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay cuentas por pagar por vencer.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {monthlyKpis.due_soon.slice(0, 6).map((d) => (
                      <li key={d.payable_id} className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{d.concept}</div>
                          {d.supplier_name && <div className="text-xs text-muted-foreground truncate">{d.supplier_name}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-medium tabular-nums">{money(d.balance)}</div>
                          <div className={`text-xs ${d.days_until_due < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {d.days_until_due < 0
                              ? `Vencida hace ${Math.abs(d.days_until_due)} días`
                              : d.days_until_due === 0
                              ? "Vence hoy"
                              : `Vence en ${d.days_until_due} días`}
                          </div>
                        </div>
                      </li>
                    ))}
                    {monthlyKpis.due_soon.length > 6 && (
                      <li><Link to="/payables" className="text-primary text-xs">Ver todas →</Link></li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Top productos (período seleccionado)</CardTitle></CardHeader>
              <CardContent>
                {report.top_by_revenue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay ventas en este rango.</p>
                ) : (
                  <div className="space-y-2">
                    {report.top_by_revenue.slice(0, 10).map((p, i) => {
                      const max = report.top_by_revenue[0].revenue;
                      return (
                        <div key={p.product_id ?? p.product_name} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 text-sm">
                          <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                          <div>
                            <div className="font-medium truncate">{p.product_name}</div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(p.revenue / max) * 100}%` }} />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium tabular-nums">{money(p.revenue)}</div>
                            <div className="text-xs text-muted-foreground">{p.quantity} und</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <AlertCircle className="h-4 w-4 text-warning" />
                <CardTitle className="text-base">Stock bajo</CardTitle>
                <Badge variant="secondary" className="ml-auto">{lowStock.length}</Badge>
              </CardHeader>
              <CardContent>
                {lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todo el inventario está en niveles seguros.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {lowStock.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-warning font-medium tabular-nums">{p.stock}</span>
                      </li>
                    ))}
                    {lowStock.length > 8 && (
                      <li><Link to="/inventory" className="text-primary text-xs">Ver todos →</Link></li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <CardTitle>Ventas del período</CardTitle>
              <Badge variant="secondary" className="ml-auto">{periodSales.length}</Badge>
            </CardHeader>
            <CardContent>
              {periodSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas en este rango.</p>
              ) : (
                <div className="divide-y">
                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-[1fr_120px_100px_90px_90px_32px] gap-4 px-2 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Cliente</span>
                    <span>Fecha</span>
                    <span className="text-right">Total</span>
                    <span className="text-right">Pagado</span>
                    <span className="text-center">Estado</span>
                    <span />
                  </div>

                  {periodSales.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setViewing(s)}
                      className="w-full text-left hover:bg-accent/50 transition-colors -mx-2 px-2 rounded-md"
                    >
                      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_100px_90px_90px_32px] gap-4 py-2.5 items-center text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.customer_name || "Venta de mostrador"}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{formatDate(s.sale_date)}</div>
                        </div>

                        <div className="text-sm text-muted-foreground hidden sm:block">
                          {formatDate(s.sale_date)}
                        </div>

                        <div className="font-medium tabular-nums text-right hidden sm:block">
                          {money(Number(s.total))}
                        </div>

                        <div className="tabular-nums text-right hidden sm:block">
                          {money(Number(s.amount_paid))}
                        </div>

                        <div className="hidden sm:flex justify-center">
                          <Badge variant={s.status === "paid" ? "default" : "secondary"} className={s.status === "credit" ? "text-warning" : ""}>
                            {s.status === "paid" ? "Pagado" : "Fiado"}
                          </Badge>
                        </div>

                        {/* Mobile: compact */}
                        <div className="sm:hidden flex flex-col items-end gap-1">
                          <span className="font-medium text-sm tabular-nums">{money(Number(s.total))}</span>
                          <Badge variant={s.status === "paid" ? "default" : "secondary"} className={`text-xs ${s.status === "credit" ? "text-warning" : ""}`}>
                            {s.status === "paid" ? "Pagado" : "Fiado"}
                          </Badge>
                        </div>

                        <div className="hidden sm:flex justify-center text-muted-foreground">
                          <Eye className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  ))}
                  {periodSales.length > 8 && (
                    <div className="pt-2">
                      <Link to="/sales" className="text-primary text-xs">Ver todas →</Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <SaleDetailDialog sale={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Stat({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  href,
  search,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  accent: string;
  href?: string;
  search?: { from: string; to: string };
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
            {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-${accent}/10 text-${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {href && (
          <Link to={href} search={search} className="text-primary text-xs mt-3 inline-block">
            Ver detalle →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
