import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Sale, Customer, Product, CreditMovement } from "@/lib/api";
import { updateSale, deleteSale, registerPayment, payCustomer } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { HandCoins, Eye, Pencil, Trash2, Search, ShoppingBag, X, FileSpreadsheet } from "lucide-react";
import { money, bolivares, formatDate, daysBetween } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { useTableSort } from "@/lib/sort";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const receivablesSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/receivables")({
  head: () => ({
    meta: [
      { title: "Cuentas por cobrar — Multimarket" },
      { name: "description", content: "Saldos pendientes de clientes y registro de abonos." },
      { property: "og:title", content: "Cuentas por cobrar — Multimarket" },
      { property: "og:description", content: "Saldos pendientes de clientes y registro de abonos." },
    ],
  }),
  validateSearch: receivablesSearchSchema,
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
  sales: Sale[];
  /** Saldo a favor del cliente (excedente de abonos anteriores). */
  credit_balance: number;
};

function groupByCustomer(data: Sale[]): ReceivableGroup[] {
  const map = new Map<string, ReceivableGroup>();
  const today = new Date();
  for (const s of data) {
    const key = s.customer_id ?? `sale:${s.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, customer_id: s.customer_id, customer_name: s.customer_name,
        total: 0, amount_paid: 0, balance: 0, days_old: 0, oldest_date: "", sales: [], credit_balance: 0,
      };
      map.set(key, g);
    }
    const balance = Number(s.total) - Number(s.amount_paid);
    g.total += Number(s.total);
    g.amount_paid += Number(s.amount_paid);
    g.balance += balance;
    // Fecha y antigüedad salen solo de las ventas aún pendientes: una
    // cuenta ya saldada no debe seguir marcando al cliente como atrasado.
    if (balance > 0.001) {
      g.days_old = Math.max(g.days_old, daysBetween(today, new Date(s.sale_date)));
      if (!g.oldest_date || s.sale_date < g.oldest_date) g.oldest_date = s.sale_date;
    }
    g.sales.push(s);
  }
  for (const g of map.values()) {
    g.sales.sort((a, b) => a.sale_date.localeCompare(b.sale_date));
    // Cliente al día: se muestra la fecha de su última compra.
    if (!g.oldest_date) g.oldest_date = g.sales[g.sales.length - 1].sale_date;
  }
  return Array.from(map.values());
}

const RATE_KEY = "mm_usd_ves_rate";
const loadRate = () => (typeof window === "undefined" ? "" : window.localStorage.getItem(RATE_KEY) ?? "");

type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

type EditForm = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  customerQuery: string;
  status: "paid" | "credit";
  saleDate: string;
  notes: string;
  cart: CartItem[];
};

function Receivables() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [paying, setPaying] = useState<ReceivableGroup | null>(null);
  const [amount, setAmount] = useState("");
  const [viewing, setViewing] = useState<ReceivableGroup | null>(null);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(search.from ?? "");
  const [dateTo, setDateTo] = useState(search.to ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "credit">("all");
  const [rate, setRate] = useState<string>(loadRate);

  const [editing, setEditing] = useState<EditForm | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  const rateNum = Number(rate) || 0;
  const bs = (usd: number) => bolivares(usd * rateNum);

  const updateRate = (v: string) => {
    setRate(v);
    if (typeof window !== "undefined") window.localStorage.setItem(RATE_KEY, v);
  };

  const { data: allSales = [] } = useQuery({
    queryKey: ["sales-for-receivables"],
    queryFn: () => apiGet<Sale[]>("/api/sales"),
  });

  // Una venta es "cuenta por cobrar" si sigue fiada, o si en algún momento
  // lo estuvo (tiene abonos registrados) aunque ya se haya saldado del todo:
  // al pagarse por completo el backend le cambia el status a "paid", por lo
  // que el status solo no alcanza para distinguirla de una venta de mostrador.
  const data = useMemo(
    () => allSales.filter((s) => s.status === "credit" || (s.payments && s.payments.length > 0)),
    [allSales],
  );
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/api/customers"),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
    enabled: !!editing,
  });

  const creditByCustomerId = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((c) => { if (Number(c.credit_balance) > 0.001) map.set(c.id, Number(c.credit_balance)); });
    return map;
  }, [customers]);

  const phoneByCustomerId = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => { if (c.phone) map.set(c.id, c.phone); });
    return map;
  }, [customers]);

  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return data;
    return data.filter((s) => {
      const d = s.sale_date.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return dateFiltered;
    return dateFiltered.filter((s) => {
      const balance = Number(s.total) - Number(s.amount_paid);
      return statusFilter === "paid" ? balance <= 0.001 : balance > 0.001;
    });
  }, [dateFiltered, statusFilter]);

  const groups = useMemo(
    () => groupByCustomer(statusFiltered).map((g) => ({
      ...g,
      credit_balance: g.customer_id ? creditByCustomerId.get(g.customer_id) ?? 0 : 0,
    })),
    [statusFiltered, creditByCustomerId],
  );

  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const needle = q.toLowerCase();
    return groups.filter((g) => {
      const phone = g.customer_id ? phoneByCustomerId.get(g.customer_id) ?? "" : "";
      return (g.customer_name ?? "").toLowerCase().includes(needle) || phone.toLowerCase().includes(needle);
    });
  }, [groups, q, phoneByCustomerId]);

  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(filteredGroups, "customer_name", "asc");

  const totalOwed = statusFiltered.reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);
  const totalPaid = statusFiltered.reduce((s, r) => s + Number(r.amount_paid), 0);

  const exportExcel = () => {
    exportToExcel(`cuentas-por-cobrar_${dateFrom || "todas"}_${dateTo || "todas"}`, [
      { name: "Resumen", rows: [{ Desde: dateFrom || "—", Hasta: dateTo || "—", "Total por cobrar": totalOwed, "Total cobrado": totalPaid }] },
      {
        name: "Detalle",
        rows: sorted.map((g) => ({
          Fecha: g.oldest_date, Cliente: g.customer_name || "—",
          Total: g.total, Pagado: g.amount_paid, Saldo: g.balance, "Saldo a favor": g.credit_balance, "Antigüedad (días)": g.days_old,
        })),
      },
    ]);
  };

  const productResults = useMemo(() => {
    if (!productQuery.trim()) return [];
    const qq = productQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(qq)).slice(0, 8);
  }, [productQuery, products]);

  const customerResults = useMemo(() => {
    if (!editing || !editing.customerQuery.trim()) return [];
    const qq = editing.customerQuery.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(qq)).slice(0, 6);
  }, [editing, customers]);

  const openEdit = (sale: Sale) => {
    setEditing({
      id: sale.id,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      customerQuery: "",
      status: sale.status,
      saleDate: sale.sale_date.slice(0, 10),
      notes: sale.notes ?? "",
      cart: (sale.items ?? [])
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id as string,
          product_name: i.product_name,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          unit_cost: Number(i.unit_cost),
        })),
    });
    setProductQuery("");
  };

  const addToEditCart = (p: Product) => {
    setEditing((f) => {
      if (!f) return f;
      const idx = f.cart.findIndex((i) => i.product_id === p.id);
      if (idx >= 0) {
        const copy = [...f.cart];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return { ...f, cart: copy };
      }
      return { ...f, cart: [...f.cart, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.price), unit_cost: Number(p.cost) }] };
    });
    setProductQuery("");
  };

  const editTotal = editing ? editing.cart.reduce((s, i) => s + i.quantity * i.unit_price, 0) : 0;

  const saveEdit = useMutation({
    mutationFn: async (f: EditForm) => {
      if (f.cart.length === 0) throw new Error("Agrega al menos un producto.");
      if (f.status === "credit" && !f.customerId) throw new Error("Elige un cliente para ventas fiadas.");
      await updateSale(f.id, {
        customer_id: f.customerId,
        customer_name: f.customerName,
        status: f.status,
        sale_date: f.saleDate ? `${f.saleDate}T12:00:00Z` : null,
        notes: f.notes || null,
        items: f.cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: i.unit_cost,
        })),
      });
    },
    onSuccess: () => { toast.success("Venta actualizada"); setEditing(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSale = useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: () => { toast.success("Venta eliminada"); setDeleteTarget(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Deuda real del cliente (sin filtros de fecha/estado): el backend reparte
  // el abono entre todas sus ventas fiadas pendientes.
  const payingDebt = useMemo(() => {
    if (!paying) return 0;
    if (!paying.customer_id) return paying.balance;
    return data
      .filter((s) => s.customer_id === paying.customer_id)
      .reduce((sum, s) => sum + Math.max(Number(s.total) - Number(s.amount_paid), 0), 0);
  }, [paying, data]);

  const pay = useMutation({
    mutationFn: async () => {
      if (!paying) return;
      const v = Number(amount);
      if (!v || v <= 0) throw new Error("Monto inválido.");
      if (paying.customer_id) {
        // El backend reparte el abono (más antiguas primero) y guarda el
        // excedente como saldo a favor del cliente.
        return payCustomer({ customer_id: paying.customer_id, amount: v });
      }
      if (v > paying.balance + 0.001) throw new Error("El abono supera el saldo.");
      // Se aplica a las ventas más antiguas primero.
      let remainingCents = Math.round(v * 100);
      for (const sale of paying.sales) {
        if (remainingCents <= 0) break;
        const balance = Number(sale.total) - Number(sale.amount_paid);
        const saleCents = Math.round(balance * 100);
        const applyCents = Math.min(remainingCents, saleCents);
        if (applyCents > 0) {
          await registerPayment({ kind: "receivable", sale_id: sale.id, amount: applyCents / 100 });
          remainingCents -= applyCents;
        }
      }
    },
    onSuccess: (res) => {
      if (res && res.credit_added > 0) {
        toast.success(`Abono registrado. ${money(res.credit_added)} quedaron como saldo a favor (total a favor: ${money(res.credit_balance)}).`);
      } else {
        toast.success("Abono registrado");
      }
      setPaying(null); setAmount(""); qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas por cobrar</h1>
          <p className="text-sm text-muted-foreground">{data.filter((s) => Number(s.total) - Number(s.amount_paid) > 0.001).length} facturas fiadas pendientes.</p>
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
          <div className="flex gap-3 w-full sm:w-auto">
            <Card className="flex-1 sm:min-w-40"><CardContent className="pt-4">
              <div className="text-xs uppercase text-muted-foreground">Total por cobrar</div>
              <div className="text-2xl font-semibold tabular-nums text-destructive">{money(totalOwed)}</div>
              {rateNum > 0 && <div className="text-sm text-muted-foreground tabular-nums">{bs(totalOwed)}</div>}
            </CardContent></Card>
            <Card className="flex-1 sm:min-w-40"><CardContent className="pt-4">
              <div className="text-xs uppercase text-muted-foreground">Total cobrado</div>
              <div className="text-2xl font-semibold tabular-nums text-success">{money(totalPaid)}</div>
              {rateNum > 0 && <div className="text-sm text-muted-foreground tabular-nums">{bs(totalPaid)}</div>}
            </CardContent></Card>
          </div>
          <Button variant="outline" onClick={exportExcel} className="w-full sm:w-auto">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar a Excel
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "credit", "paid"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {s === "all" ? "Todas" : s === "credit" ? "Por cobrar" : "Pagada"}
          </button>
        ))}
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
                const isPaid = g.balance <= 0.001;
                return (
                  <TableRow key={g.key}>
                    <TableCell className={cn("hidden md:table-cell text-xs", isOverdue && !isPaid && "text-destructive font-semibold")}>{formatDate(g.oldest_date)}</TableCell>
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
                      {g.credit_balance > 0.001 && (
                        <div className="text-xs font-normal text-success">A favor {money(g.credit_balance)}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {isPaid && g.credit_balance > 0.001 ? (
                        <Badge variant="outline" className="border-success text-success">Saldo a favor</Badge>
                      ) : isPaid ? (
                        <Badge variant="default">Pagada</Badge>
                      ) : (
                        <Badge variant={g.days_old > 30 ? "destructive" : g.days_old > 15 ? "secondary" : "outline"}>
                          {g.days_old} d
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewing(g)} title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(!isPaid || g.customer_id) && (
                          <Button size="sm" variant="outline" onClick={() => setPaying(g)}>
                            <HandCoins className="h-4 w-4 mr-1" /> Abonar
                          </Button>
                        )}
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
              Saldo pendiente: <strong className="tabular-nums">{paying && money(payingDebt)}</strong>
              {rateNum > 0 && paying && <span className="text-muted-foreground tabular-nums"> ({bs(payingDebt)})</span>}
            </p>
            {paying && paying.credit_balance > 0.001 && (
              <p className="text-sm">
                Saldo a favor actual: <strong className="tabular-nums text-success">{money(paying.credit_balance)}</strong>
              </p>
            )}
            {paying && paying.sales.filter((s) => Number(s.total) - Number(s.amount_paid) > 0.001).length > 1 && (
              <p className="text-xs text-muted-foreground">
                Tiene {paying.sales.filter((s) => Number(s.total) - Number(s.amount_paid) > 0.001).length} compras pendientes. El abono se aplica primero a la más antigua.
              </p>
            )}
            <div>
              <Label>Monto abonado</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              {rateNum > 0 && Number(amount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">≈ {bs(Number(amount))}</p>
              )}
              {paying && Number(amount) > payingDebt + 0.001 && (
                paying.customer_id ? (
                  <p className="text-xs text-success mt-1 tabular-nums">
                    Se aplicarán {money(payingDebt)} a la deuda y{" "}
                    <strong>{money(Number(amount) - payingDebt)}</strong> quedarán como saldo a favor,
                    que se descontará en su próxima compra fiada.
                  </p>
                ) : (
                  <p className="text-xs text-destructive mt-1">
                    Esta venta no tiene cliente asignado: el abono no puede superar el saldo.
                  </p>
                )
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => paying && setAmount(String(Math.round(payingDebt * 100) / 100))}>Total ({paying && money(payingDebt)})</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerDetailDialog
        group={viewing}
        onClose={() => setViewing(null)}
        rateNum={rateNum}
        onEdit={(s) => { setViewing(null); openEdit(s); }}
        onDelete={(s) => { setViewing(null); setDeleteTarget(s); }}
      />

      {/* ── Edit sale dialog ── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar venta</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4">
              <div>
                <Label>Cliente</Label>
                {editing.customerId || editing.customerName ? (
                  <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-1">
                    <div className="text-sm font-medium">{editing.customerName || "Venta de mostrador"}</div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditing({ ...editing, customerId: null, customerName: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Venta de mostrador (buscar cliente)…"
                      value={editing.customerQuery}
                      onChange={(e) => setEditing({ ...editing, customerQuery: e.target.value })}
                      className="mt-1"
                    />
                    {editing.customerQuery.trim() && (
                      <div className="border rounded-md divide-y max-h-48 overflow-auto mt-1">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEditing({ ...editing, customerId: c.id, customerName: c.name, customerQuery: "" })}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          >
                            <div className="font-medium">{c.name}</div>
                            {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                          </button>
                        ))}
                        {customerResults.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <Label>Estado</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    type="button" variant={editing.status === "paid" ? "default" : "outline"}
                    onClick={() => setEditing({ ...editing, status: "paid" })}
                  >
                    Pagado
                  </Button>
                  <Button
                    type="button" variant={editing.status === "credit" ? "default" : "outline"}
                    onClick={() => setEditing({ ...editing, status: "credit" })}
                  >
                    Fiado
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha de venta</Label><Input type="date" value={editing.saleDate} onChange={(e) => setEditing({ ...editing, saleDate: e.target.value })} /></div>
              </div>

              <div><Label>Notas</Label><Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>

              <div className="border-t pt-3">
                <Label className="mb-1.5 block">Buscar producto</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nombre…"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {productQuery.trim() && (
                  <div className="border rounded-md divide-y max-h-48 overflow-auto mt-1">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToEditCart(p)}
                        className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between items-center"
                      >
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-sm tabular-nums">{money(Number(p.price))}</div>
                      </button>
                    ))}
                    {productResults.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="font-medium text-sm">Productos ({editing.cart.length})</span>
                </div>
                {editing.cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Agrega al menos un producto.</p>
                ) : (
                  editing.cart.map((i, idx) => (
                    <div key={i.product_id} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-center">
                      <div className="min-w-0 text-sm font-medium truncate">{i.product_name}</div>
                      <Input
                        type="number" min="0" step="0.5" value={i.quantity}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setEditing((f) => f && { ...f, cart: f.cart.map((it, k) => k === idx ? { ...it, quantity: v } : it) });
                        }}
                        className="h-8"
                      />
                      <Input
                        type="number" min="0" step="0.01" value={i.unit_price}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setEditing((f) => f && { ...f, cart: f.cart.map((it, k) => k === idx ? { ...it, unit_price: v } : it) });
                        }}
                        className="h-8"
                      />
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setEditing((f) => f && { ...f, cart: f.cart.filter((_, k) => k !== idx) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold tabular-nums">{money(editTotal)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && saveEdit.mutate(editing)} disabled={saveEdit.isPending}>
              {saveEdit.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la venta a{" "}
              <strong>{deleteTarget?.customer_name ?? "venta de mostrador"}</strong> por{" "}
              <strong>{deleteTarget ? money(Number(deleteTarget.total)) : ""}</strong> y se revertirá el
              stock descontado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeSale.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) removeSale.mutate(deleteTarget.id);
              }}
            >
              {removeSale.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerDetailDialog({
  group,
  onClose,
  rateNum,
  onEdit,
  onDelete,
}: {
  group: ReceivableGroup | null;
  onClose: () => void;
  rateNum: number;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
}) {
  const bs = (usd: number) => bolivares(usd * rateNum);

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{group?.customer_name || "Cliente"}</DialogTitle></DialogHeader>
        {group && (
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {group.customer_id && (
              <CreditSection customerId={group.customer_id} creditBalance={group.credit_balance} rateNum={rateNum} bs={bs} />
            )}
            {group.sales.map((sale) => {
              const balance = Number(sale.total) - Number(sale.amount_paid);
              const isOverdue = balance > 0.001 && daysBetween(new Date(), new Date(sale.sale_date)) > 7;
              return (
                <div key={sale.id} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-medium", isOverdue && "text-destructive font-semibold")}>
                      {formatDate(sale.sale_date)}
                    </span>
                    <span className="tabular-nums text-muted-foreground text-right">
                      Total {money(Number(sale.total))} · Saldo <strong className="text-foreground">{money(balance)}</strong>
                      {rateNum > 0 && (
                        <><br /><span className="text-xs">{bs(Number(sale.total))} · {bs(balance)}</span></>
                      )}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(sale)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(sale)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                    </Button>
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Productos</div>
                    <SaleItemsTable items={sale.items} />
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Abonos</div>
                    <SalePaymentsTable payments={sale.payments} rateNum={rateNum} bs={bs} />
                  </div>
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
            <TableCell className={cn("py-1 text-right tabular-nums", p.from_credit ? "text-foreground" : "text-success")}>
              <div>{money(Number(p.amount))}</div>
              {rateNum > 0 && <div className="text-xs text-muted-foreground">{bs(Number(p.amount))}</div>}
            </TableCell>
            <TableCell className="py-1 text-xs text-muted-foreground">
              {p.from_credit ? (
                <Badge variant="outline" className="border-success text-success">Descontado del saldo a favor</Badge>
              ) : (
                p.notes || "—"
              )}
            </TableCell>
          </TableRow>
        ))}
        {payments.length === 0 && (
          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-2">Sin abonos registrados.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}

const CREDIT_KIND_LABEL: Record<CreditMovement["kind"], string> = {
  deposit: "Excedente de abono",
  applied: "Descontado en venta fiada",
  refund: "Devuelto (venta eliminada)",
};

function CreditSection({
  customerId,
  creditBalance,
  rateNum,
  bs,
}: {
  customerId: string;
  creditBalance: number;
  rateNum: number;
  bs: (usd: number) => string;
}) {
  const { data: movements = [] } = useQuery({
    queryKey: ["customer-credit-movements", customerId],
    queryFn: () => apiGet<CreditMovement[]>(`/api/customers/${customerId}/credit-movements`),
  });

  if (movements.length === 0 && creditBalance <= 0.001) return null;

  // Saldo acumulado tras cada movimiento, para ver cómo se fue descontando.
  let running = 0;
  const rows = movements.map((m) => {
    running += Number(m.amount);
    return { ...m, running };
  });

  return (
    <div className="border rounded-md p-3 space-y-2 border-success/40 bg-success/5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Saldo a favor</span>
        <span className="tabular-nums text-right">
          <strong className="text-success">{money(creditBalance)}</strong>
          {rateNum > 0 && <span className="block text-xs text-muted-foreground">{bs(creditBalance)}</span>}
        </span>
      </div>
      {rows.length > 0 && (
        <Table>
          <TableHeader><TableRow>
            <TableHead className="h-8">Fecha</TableHead>
            <TableHead className="h-8">Movimiento</TableHead>
            <TableHead className="h-8 text-right">Monto</TableHead>
            <TableHead className="h-8 text-right">Saldo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((m) => {
              const amt = Number(m.amount);
              return (
                <TableRow key={m.id}>
                  <TableCell className="py-1 text-xs">{formatDate(m.movement_date)}</TableCell>
                  <TableCell className="py-1 text-xs">{CREDIT_KIND_LABEL[m.kind] ?? m.kind}</TableCell>
                  <TableCell className={cn("py-1 text-right tabular-nums", amt >= 0 ? "text-success" : "text-destructive")}>
                    {amt >= 0 ? "+" : "−"}{money(Math.abs(amt))}
                  </TableCell>
                  <TableCell className="py-1 text-right tabular-nums">{money(m.running)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
