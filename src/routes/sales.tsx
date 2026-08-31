import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Product, Customer, Sale } from "@/lib/api";
import { updateSale, deleteSale } from "@/lib/data";
import { money, formatDate } from "@/lib/format";
import {
  Calendar,
  Eye,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  CreditCard,
  Search,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { SaleDetailDialog } from "@/components/sale-detail-dialog";
import { toast } from "sonner";

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

function SalesPage() {
  const t = today();
  const qc = useQueryClient();
  const [from, setFrom] = useState(t);
  const [to, setTo] = useState(t);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "credit">("all");

  const [editing, setEditing] = useState<EditForm | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  const { data: sales = [], isLoading, isError } = useQuery({
    queryKey: ["sales", from, to],
    queryFn: () => apiGet<Sale[]>(`/api/sales?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
    enabled: !!editing,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/api/customers"),
    enabled: !!editing,
  });

  const productResults = useMemo(() => {
    if (!productQuery.trim()) return [];
    const q = productQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [productQuery, products]);

  const customerResults = useMemo(() => {
    if (!editing || !editing.customerQuery.trim()) return [];
    const q = editing.customerQuery.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
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
    onSuccess: () => {
      toast.success("Venta actualizada");
      setEditing(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSale = useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: () => {
      toast.success("Venta eliminada");
      setDeleteTarget(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
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
                return (
                  <div key={sale.id}>
                    {/* Row */}
                    <button
                      id={`sale-row-${sale.id}`}
                      onClick={() => setViewing(sale)}
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
                          <Eye className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail dialog ── */}
      <SaleDetailDialog
        sale={viewing}
        onClose={() => setViewing(null)}
        onEdit={(s) => { setViewing(null); openEdit(s); }}
        onDelete={(s) => { setViewing(null); setDeleteTarget(s); }}
      />

      {/* ── Edit dialog ── */}
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
