import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Dashboard as DashboardData, Sale, Receivable } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money, formatDate } from "@/lib/format";
import { AlertCircle, TrendingUp, DollarSign, ShoppingBag, Package, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Multimarket" },
      { name: "description", content: "Resumen del día: ventas, ganancia, top productos y alertas." },
      { property: "og:title", content: "Dashboard — Multimarket" },
      { property: "og:description", content: "Resumen del día: ventas, ganancia, top productos y alertas." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [dashboard, recentSales, receivables] = await Promise.all([
        apiGet<DashboardData>("/api/dashboard"),
        apiGet<Sale[]>("/api/sales"),
        apiGet<Receivable[]>("/api/receivables"),
      ]);
      return { dashboard, recentSales, receivables };
    },
  });

  if (isLoading || !data) {
    return <div className="p-6 text-muted-foreground">Cargando…</div>;
  }

  const { dashboard, recentSales, receivables } = data;
  const top = dashboard.top_products;
  const lowStock = dashboard.low_stock;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen del negocio hoy, esta semana y este mes.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Ventas hoy" value={money(dashboard.day_total)} icon={DollarSign} accent="primary" />
        <Stat title="Ventas semana" value={money(dashboard.week_total)} icon={TrendingUp} accent="chart-2" />
        <Stat title="Ventas mes" value={money(dashboard.month_total)} icon={ShoppingBag} accent="chart-3" />
        <Stat title="Ganancia mes" value={money(dashboard.month_profit)} icon={TrendingUp} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Top 10 productos (este mes)</CardTitle></CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay ventas este mes.</p>
            ) : (
              <div className="space-y-2">
                {top.map((p, i) => {
                  const max = top[0].revenue;
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

        <div className="space-y-4">
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
                  {lowStock.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="truncate">{p.name}</span>
                      <span className="text-warning font-medium tabular-nums">{p.stock}</span>
                    </li>
                  ))}
                  {lowStock.length > 6 && (
                    <li><Link to="/inventory" className="text-primary text-xs">Ver todos →</Link></li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base">Por cobrar</CardTitle>
              <Badge variant="secondary" className="ml-auto">{receivables.length}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{money(dashboard.open_receivables)}</div>
              <p className="text-xs text-muted-foreground mt-1">Saldo pendiente de clientes.</p>
              <Link to="/receivables" className="text-primary text-xs mt-2 inline-block">Ver detalle →</Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimas ventas</CardTitle></CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ventas registradas.</p>
          ) : (
            <div className="divide-y">
              {recentSales.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{s.customer_name || "Venta de mostrador"}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(s.sale_date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.status === "paid" ? "default" : "secondary"}>
                      {s.status === "paid" ? "Pagado" : "Fiado"}
                    </Badge>
                    <span className="font-medium tabular-nums">{money(Number(s.total))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value, icon: Icon, accent }: { title: string; value: string; icon: any; accent: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-${accent}/10 text-${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
