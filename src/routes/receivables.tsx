import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Receivable, Sale, Customer } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Eye } from "lucide-react";
import { money, bolivares, formatDate } from "@/lib/format";
import { registerPayment } from "@/lib/data";
import { useTableSort } from "@/lib/sort";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/receivables")({
  head: () => ({
    meta: [
      { title: "Cuentas por cobrar — Multimarket" },
      { name: "description", content: "Saldos pendientes de clientes y registro de abonos." },
      { property: "og:title", content: "Cuentas por cobrar — Multimarket" },
      { property: "og:description", content: "Saldos pendientes de clientes y registro de abonos." },
    ],
  }),
  component: Receivables,
});

type ReceivableGroup = {
  key: string;
  customer_id: string | null;
  customer_name: string | null;
  total: number;
  amount_paid: number;
  balance: number;
  days_old: number;
  oldest_date: string;
  sales: Receivable[];
};

function groupByCustomer(data: Receivable[]): ReceivableGroup[] {
  const map = new Map<string, ReceivableGroup>();
  for (const r of data) {
    const key = r.customer_id ?? `sale:${r.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, customer_id: r.customer_id, customer_name: r.customer_name,
        total: 0, amount_paid: 0, balance: 0, days_old: 0, oldest_date: r.sale_date, sales: [],
      };
      map.set(key, g);
    }
    g.total += Number(r.total);
    g.amount_paid += Number(r.amount_paid);
    g.balance += r.balance;
    g.days_old = Math.max(g.days_old, r.days_old);
    if (r.sale_date < g.oldest_date) g.oldest_date = r.sale_date;
    g.sales.push(r);
  }
  for (const g of map.values()) g.sales.sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  return Array.from(map.values());
}

const RATE_KEY = "mm_usd_ves_rate";
const loadRate = () => (typeof window === "undefined" ? "" : window.localStorage.getItem(RATE_KEY) ?? "");

function Receivables() {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<ReceivableGroup | null>(null);
  const [amount, setAmount] = useState("");
  const [viewing, setViewing] = useState<ReceivableGroup | null>(null);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rate, setRate] = useState<string>(loadRate);

  const rateNum = Number(rate) || 0;
  const bs = (usd: number) => bolivares(usd * rateNum);

  const updateRate = (v: string) => {
    setRate(v);
    if (typeof window !== "undefined") window.localStorage.setItem(RATE_KEY, v);
  };

  const { data = [] } = useQuery({
    queryKey: ["receivables"],
    queryFn: () => apiGet<Receivable[]>("/api/receivables"),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/api/customers"),
  });

  const phoneByCustomerId = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => { if (c.phone) map.set(c.id, c.phone); });
    return map;
  }, [customers]);

  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return data;
    return data.filter((r) => {
      const d = r.sale_date.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const groups = useMemo(() => groupByCustomer(dateFiltered), [dateFiltered]);

  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const needle = q.toLowerCase();
    return groups.filter((g) => {
      const phone = g.customer_id ? phoneByCustomerId.get(g.customer_id) ?? "" : "";
      return (g.customer_name ?? "").toLowerCase().includes(needle) || phone.toLowerCase().includes(needle);
    });
  }, [groups, q, phoneByCustomerId]);

  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(filteredGroups, "customer_name", "asc");

  const totalOwed = data.reduce((s, r) => s + r.balance, 0);

  const pay = useMutation({
    mutationFn: async () => {
      if (!paying) return;
      const v = Number(amount);
      if (!v || v <= 0) throw new Error("Monto inválido.");
      if (v > paying.balance + 0.001) throw new Error("El abono supera el saldo.");
      // Se aplica a las ventas más antiguas primero.
      let remainingCents = Math.round(v * 100);
      for (const sale of paying.sales) {
        if (remainingCents <= 0) break;
        const saleCents = Math.round(sale.balance * 100);
        const applyCents = Math.min(remainingCents, saleCents);
        if (applyCents > 0) {
          await registerPayment({ kind: "receivable", sale_id: sale.id, amount: applyCents / 100 });
          remainingCents -= applyCents;
        }
      }
    },
    onSuccess: () => { toast.success("Abono registrado"); setPaying(null); setAmount(""); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas por cobrar</h1>
          <p className="text-sm text-muted-foreground">{data.length} facturas fiadas pendientes.</p>
        </div>
        <div className="flex flex-col gap-3 w-full sm:flex-row sm:flex-wrap sm:items-end sm:w-auto">
          <Input placeholder="Buscar por nombre o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
          <div className="w-full sm:w-36">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
          </div>
          <div className="w-full sm:w-36">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
          </div>
          <div className="w-full sm:w-36">
            <Label className="text-xs text-muted-foreground">Tasa Bs./$ del día</Label>
            <Input
              type="number" step="0.01" min="0" placeholder="Ej: 190.5"
              value={rate} onChange={(e) => updateRate(e.target.value)}
            />
          </div>
          <Card className="w-full sm:min-w-56"><CardContent className="pt-4">
            <div className="text-xs uppercase text-muted-foreground">Total por cobrar</div>
            <div className="text-2xl font-semibold tabular-nums text-destructive">{money(totalOwed)}</div>
            {rateNum > 0 && <div className="text-sm text-muted-foreground tabular-nums">{bs(totalOwed)}</div>}
          </CardContent></Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <SortableHead sortKey="oldest_date" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden md:table-cell">Fecha</SortableHead>
              <SortableHead sortKey="customer_name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Cliente</SortableHead>
              <SortableHead sortKey="total" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Total</SortableHead>
              <SortableHead sortKey="amount_paid" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Pagado</SortableHead>
              <SortableHead sortKey="balance" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Saldo</SortableHead>
              <SortableHead sortKey="days_old" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden sm:table-cell">Antigüedad</SortableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map((g) => {
                const isOverdue = g.days_old > 7;
                return (
                  <TableRow key={g.key}>
                    <TableCell className={cn("hidden md:table-cell text-xs", isOverdue && "text-destructive font-semibold")}>{formatDate(g.oldest_date)}</TableCell>
                    <TableCell className="font-medium">
                      {g.customer_name || "—"}
                      {g.sales.length > 1 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({g.sales.length} compras)</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      <div>{money(g.total)}</div>
                      {rateNum > 0 && <div className="text-xs text-muted-foreground">{bs(g.total)}</div>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                      <div>{money(g.amount_paid)}</div>
                      {rateNum > 0 && <div className="text-xs">{bs(g.amount_paid)}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      <div>{money(g.balance)}</div>
                      {rateNum > 0 && <div className="text-xs font-normal text-muted-foreground">{bs(g.balance)}</div>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={g.days_old > 30 ? "destructive" : g.days_old > 15 ? "secondary" : "outline"}>
                        {g.days_old} d
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewing(g)} title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPaying(g)}>
                          <HandCoins className="h-4 w-4 mr-1" /> Abonar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredGroups.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {data.length === 0 ? "Todo cobrado 🎉" : "Sin resultados para esa búsqueda o rango de fechas."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar abono</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Cliente: <strong>{paying?.customer_name}</strong></p>
            <p className="text-sm">
              Saldo pendiente: <strong className="tabular-nums">{paying && money(paying.balance)}</strong>
              {rateNum > 0 && paying && <span className="text-muted-foreground tabular-nums"> ({bs(paying.balance)})</span>}
            </p>
            {paying && paying.sales.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Tiene {paying.sales.length} compras pendientes. El abono se aplica primero a la más antigua.
              </p>
            )}
            <div>
              <Label>Monto abonado</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              {rateNum > 0 && Number(amount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">≈ {bs(Number(amount))}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => paying && setAmount(String(paying.balance))}>Total ({paying && money(paying.balance)})</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerDetailDialog group={viewing} onClose={() => setViewing(null)} rateNum={rateNum} />
    </div>
  );
}

function CustomerDetailDialog({ group, onClose, rateNum }: { group: ReceivableGroup | null; onClose: () => void; rateNum: number }) {
  const bs = (usd: number) => bolivares(usd * rateNum);
  const saleIds = group?.sales.map((s) => s.id) ?? [];
  const results = useQueries({
    queries: saleIds.map((id) => ({
      queryKey: ["sale-detail", id],
      queryFn: () => apiGet<Sale>(`/api/sales/${id}`),
      enabled: !!group,
    })),
  });

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{group?.customer_name || "Cliente"}</DialogTitle></DialogHeader>
        {group && (
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {group.sales.map((summary, idx) => {
              const sale = results[idx]?.data;
              const isOverdue = summary.days_old > 7;
              return (
                <div key={summary.id} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-medium", isOverdue && "text-destructive font-semibold")}>
                      {formatDate(summary.sale_date)}
                    </span>
                    <span className="tabular-nums text-muted-foreground text-right">
                      Total {money(Number(summary.total))} · Saldo <strong className="text-foreground">{money(summary.balance)}</strong>
                      {rateNum > 0 && (
                        <><br /><span className="text-xs">{bs(Number(summary.total))} · {bs(summary.balance)}</span></>
                      )}
                    </span>
                  </div>
                  {!sale ? (
                    <p className="text-xs text-muted-foreground">Cargando…</p>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Productos</div>
                        <SaleItemsTable items={sale.items} />
                      </div>

                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Abonos</div>
                        <SalePaymentsTable payments={sale.payments} rateNum={rateNum} bs={bs} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SaleItemsTable({ items }: { items: Sale["items"] }) {
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(items, "product_name", "asc");
  return (
    <Table>
      <TableHeader><TableRow>
        <SortableHead sortKey="product_name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="h-8">Producto</SortableHead>
        <SortableHead sortKey="quantity" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="h-8">Cant.</SortableHead>
        <SortableHead sortKey="subtotal" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="h-8">Subtotal</SortableHead>
      </TableRow></TableHeader>
      <TableBody>
        {sorted.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="py-1">{i.product_name}</TableCell>
            <TableCell className="py-1 text-right tabular-nums">{Number(i.quantity)}</TableCell>
            <TableCell className="py-1 text-right tabular-nums">{money(Number(i.subtotal))}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-2">Sin productos.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function SalePaymentsTable({ payments, rateNum, bs }: { payments: Sale["payments"]; rateNum: number; bs: (usd: number) => string }) {
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(payments, "payment_date", "desc");
  return (
    <Table>
      <TableHeader><TableRow>
        <SortableHead sortKey="payment_date" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="h-8">Fecha</SortableHead>
        <SortableHead sortKey="amount" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="h-8">Monto</SortableHead>
        <SortableHead sortKey="notes" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="h-8">Nota</SortableHead>
      </TableRow></TableHeader>
      <TableBody>
        {sorted.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="py-1 text-xs">{formatDate(p.payment_date)}</TableCell>
            <TableCell className="py-1 text-right tabular-nums text-success">
              <div>{money(Number(p.amount))}</div>
              {rateNum > 0 && <div className="text-xs text-muted-foreground">{bs(Number(p.amount))}</div>}
            </TableCell>
            <TableCell className="py-1 text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
          </TableRow>
        ))}
        {payments.length === 0 && (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-2">Sin abonos registrados.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}
