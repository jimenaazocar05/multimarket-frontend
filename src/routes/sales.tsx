import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Sale } from "@/lib/api";
import { money, formatDate } from "@/lib/format";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  CreditCard,
  Search,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Ventas — Multimarket" },
      { name: "description", content: "Historial de ventas por rango de fechas." },
    ],
  }),
  component: SalesPage,
});

/** Devuelve la fecha local hoy como string YYYY-MM-DD */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function SalesPage() {
  const t = today();
  const [from, setFrom] = useState(t);
  const [to, setTo] = useState(t);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "credit">("all");

  const { data: sales = [], isLoading, isError } = useQuery({
    queryKey: ["sales", from, to],
    queryFn: () => apiGet<Sale[]>(`/api/sales?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const filtered = useMemo(() => {
    let list = sales;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.customer_name ?? "venta de mostrador").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sales, statusFilter, search]);

  // Totales del período
  const totalVentas = filtered.reduce((s, v) => s + Number(v.total), 0);
  const totalPagado = filtered.reduce((s, v) => s + Number(v.amount_paid), 0);
  const totalFiado = totalVentas - totalPagado;
  const nroPagadas = filtered.filter((v) => v.status === "paid").length;
  const nroFiadas = filtered.filter((v) => v.status === "credit").length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Historial de ventas filtrado por rango de fechas.
          </p>
        </div>

        {/* Date range picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              id="sales-from"
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
              id="sales-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total ventas"
          value={money(totalVentas)}
          sub={`${filtered.length} venta${filtered.length !== 1 ? "s" : ""}`}
          icon={ShoppingBag}
          color="primary"
        />
        <StatCard
          label="Cobrado"
          value={money(totalPagado)}
          sub={`${nroPagadas} pagada${nroPagadas !== 1 ? "s" : ""}`}
          icon={DollarSign}
          color="success"
        />
        <StatCard
          label="Pendiente (fiado)"
          value={money(totalFiado)}
          sub={`${nroFiadas} fiada${nroFiadas !== 1 ? "s" : ""}`}
          icon={CreditCard}
          color="warning"
        />
        <StatCard
          label="Ganancia estimada"
          value={money(filtered.reduce((s, v) => s + Number(v.total) - Number(v.cost_total), 0))}
          sub="total − costo"
          icon={TrendingUp}
          color="chart-3"
        />
      </div>

      {/* ── Filters bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="sales-search"
            placeholder="Buscar por cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "paid", "credit"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {s === "all" ? "Todas" : s === "paid" ? "Pagadas" : "Fiadas"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table / list ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            {isLoading
              ? "Cargando ventas…"
              : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <p className="text-sm text-destructive p-6 text-center">
              Error al cargar las ventas. Verifica que el backend esté activo.
            </p>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay ventas para el período seleccionado.</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="divide-y">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_140px_120px_100px_90px_40px] gap-4 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                <span>Cliente</span>
                <span>Fecha</span>
                <span className="text-right">Total</span>
                <span className="text-right">Pagado</span>
                <span className="text-center">Estado</span>
                <span />
              </div>

              {filtered.map((sale) => {
                const isOpen = expanded === sale.id;
                const balance = Number(sale.total) - Number(sale.amount_paid);
                return (
                  <div key={sale.id}>
                    {/* Row */}
                    <button
                      id={`sale-row-${sale.id}`}
                      onClick={() => setExpanded(isOpen ? null : sale.id)}
                      className="w-full text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_120px_100px_90px_40px] gap-4 px-5 py-3.5 items-center">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {sale.customer_name ?? "Venta de mostrador"}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 hidden sm:block">
                            #{sale.id.slice(0, 8)}
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground hidden sm:block">
                          {formatDate(sale.sale_date)}
                        </div>

                        <div className="text-sm font-semibold tabular-nums text-right hidden sm:block">
                          {money(Number(sale.total))}
                        </div>

                        <div className="text-sm tabular-nums text-right hidden sm:block">
                          {money(Number(sale.amount_paid))}
                        </div>

                        <div className="hidden sm:flex justify-center">
                          <Badge
                            variant={sale.status === "paid" ? "default" : "secondary"}
                            className={sale.status === "credit" ? "text-warning" : ""}
                          >
                            {sale.status === "paid" ? "Pagado" : "Fiado"}
                          </Badge>
                        </div>

                        {/* Mobile: compact */}
                        <div className="sm:hidden flex flex-col items-end gap-1">
                          <span className="font-semibold text-sm tabular-nums">
                            {money(Number(sale.total))}
                          </span>
                          <Badge
                            variant={sale.status === "paid" ? "default" : "secondary"}
                            className={`text-xs ${sale.status === "credit" ? "text-warning" : ""}`}
                          >
                            {sale.status === "paid" ? "Pagado" : "Fiado"}
                          </Badge>
                        </div>

                        <div className="flex justify-center text-muted-foreground">
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t bg-muted/30 px-5 py-4 space-y-4">
                        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Fecha: </span>
                            <span className="font-medium">{formatDate(sale.sale_date)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">ID: </span>
                            <span className="font-mono text-xs">{sale.id}</span>
                          </div>
                          {sale.notes && (
                            <div>
                              <span className="text-muted-foreground">Notas: </span>
                              <span>{sale.notes}</span>
                            </div>
                          )}
                          {balance > 0 && (
                            <div>
                              <span className="text-muted-foreground">Pendiente: </span>
                              <span className="font-medium text-warning">{money(balance)}</span>
                            </div>
                          )}
                        </div>

                        {/* Items table */}
                        {sale.items && sale.items.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Productos
                            </div>
                            <div className="rounded-md border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                                    <th className="text-left px-3 py-2">Producto</th>
                                    <th className="text-right px-3 py-2">Cant.</th>
                                    <th className="text-right px-3 py-2">P. Unit.</th>
                                    <th className="text-right px-3 py-2">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {sale.items.map((item) => (
                                    <tr key={item.id} className="bg-card">
                                      <td className="px-3 py-2 font-medium">{item.product_name}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {Number(item.quantity)}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {money(Number(item.unit_price))}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                                        {money(Number(item.subtotal))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-muted/30 font-semibold text-sm">
                                    <td colSpan={3} className="px-3 py-2 text-right">
                                      Total
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {money(Number(sale.total))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-${color}/10 text-${color}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
