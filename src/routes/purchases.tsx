import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Product, Supplier } from "@/lib/api";
import { updatePurchase, deletePurchase } from "@/lib/data";
import { money, formatDate } from "@/lib/format";
import {
  Calendar,
  Eye,
  ShoppingBasket,
  TrendingDown,
  DollarSign,
  CreditCard,
  Search,
  ReceiptText,
  Pencil,
  Trash2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
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
import { exportToExcel } from "@/lib/export";
import { useTableSort } from "@/lib/sort";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Compras — Multimarket" },
      { name: "description", content: "Historial de compras por rango de fechas." },
    ],
  }),
  component: PurchasesPage,
});

/** Devuelve la fecha local hoy como string YYYY-MM-DD */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type PayableOut = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  concept: string;
  amount: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  issue_date: string | null;
  notes: string | null;
  days_old: number;
  overdue: boolean;
  is_expense?: boolean;
  items?: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
  }[];
  payments?: {
    id: string;
    amount: number;
    payment_date: string;
    notes: string | null;
  }[];
};

type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
};

type EditForm = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierQuery: string;
  concept: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  cart: CartItem[];
};

function PurchasesPage() {
  const t = today();
  const qc = useQueryClient();
  const [from, setFrom] = useState(t);
  const [to, setTo] = useState(t);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<PayableOut | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "credit">("all");

  const [editing, setEditing] = useState<EditForm | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PayableOut | null>(null);

  const { data: purchases = [], isLoading, isError } = useQuery({
    queryKey: ["purchases", from, to],
    queryFn: () => apiGet<PayableOut[]>(`/api/payables?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
    enabled: !!editing,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiGet<Supplier[]>("/api/suppliers"),
    enabled: !!editing,
  });

  const productResults = useMemo(() => {
    if (!productQuery.trim()) return [];
    const q = productQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [productQuery, products]);

  const supplierResults = useMemo(() => {
    if (!editing || !editing.supplierQuery.trim()) return [];
    const q = editing.supplierQuery.toLowerCase();
    return suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [editing, suppliers]);

  const openEdit = (purchase: PayableOut) => {
    setEditing({
      id: purchase.id,
      supplierId: purchase.supplier_id,
      supplierName: purchase.supplier_name,
      supplierQuery: "",
      concept: purchase.concept,
      issueDate: purchase.issue_date ?? "",
      dueDate: purchase.due_date ?? "",
      notes: purchase.notes ?? "",
      cart: (purchase.items ?? [])
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id as string,
          product_name: i.product_name,
          quantity: Number(i.quantity),
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
      return { ...f, cart: [...f.cart, { product_id: p.id, product_name: p.name, quantity: 1, unit_cost: Number(p.cost) }] };
    });
    setProductQuery("");
  };

  const editTotal = editing ? editing.cart.reduce((s, i) => s + i.quantity * i.unit_cost, 0) : 0;

  const saveEdit = useMutation({
    mutationFn: async (f: EditForm) => {
      if (f.cart.length === 0) throw new Error("Agrega al menos un producto.");
      if (!f.concept.trim()) throw new Error("El concepto es obligatorio.");
      await updatePurchase(f.id, {
        supplier_id: f.supplierId,
        supplier_name: f.supplierName,
        concept: f.concept,
        issue_date: f.issueDate || null,
        due_date: f.dueDate || null,
        notes: f.notes || null,
        items: f.cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Compra actualizada");
      setEditing(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePurchase = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: () => {
      toast.success("Compra eliminada");
      setDeleteTarget(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = purchases.filter((p) => p.items && p.items.length > 0);
    if (statusFilter !== "all") {
      list = list.filter((p) => {
        const isCredit = p.balance > 0;
        return statusFilter === "credit" ? isCredit : !isCredit;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.supplier_name ?? "proveedor desconocido").toLowerCase().includes(q) ||
          p.concept.toLowerCase().includes(q)
      );
    }
    return list;
  }, [purchases, statusFilter, search]);

  // Totales del período
  const totalCompras = filtered.reduce((s, p) => s + Number(p.amount), 0);
  const totalPagado = filtered.reduce((s, p) => s + Number(p.amount_paid), 0);
  const totalCredito = filtered.reduce((s, p) => s + Number(p.balance), 0);
  const nroPagadas = filtered.filter((p) => p.balance <= 0).length;
  const nroCredito = filtered.filter((p) => p.balance > 0).length;

  const exportExcel = () => {
    exportToExcel(`compras_${from}_${to}`, [
      {
        name: "Resumen",
        rows: [{
          Desde: from, Hasta: to,
          "Total compras": totalCompras, Pagado: totalPagado, "Deuda generada": totalCredito,
        }],
      },
      {
        name: "Detalle",
        rows: filtered.map((p) => ({
          Proveedor: p.supplier_name ?? "Proveedor desconocido",
          Concepto: p.concept,
          Fecha: p.issue_date,
          Total: Number(p.amount),
          Pagado: Number(p.amount_paid),
          Estado: Number(p.balance) > 0 ? "Crédito" : "Pagado",
        })),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Historial de compras filtrado por rango de fechas.
          </p>
        </div>

        {/* Date range picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              id="purchases-from"
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
              id="purchases-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar a Excel
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total compras"
          value={money(totalCompras)}
          sub={`${filtered.length} compra${filtered.length !== 1 ? "s" : ""}`}
          icon={ShoppingBasket}
          color="primary"
        />
        <StatCard
          label="Pagado"
          value={money(totalPagado)}
          sub={`${nroPagadas} de contado`}
          icon={DollarSign}
          color="success"
        />
        <StatCard
          label="Deuda generada"
          value={money(totalCredito)}
          sub={`${nroCredito} a crédito`}
          icon={CreditCard}
          color="destructive"
        />
        <StatCard
          label="Egreso total"
          value={money(totalPagado)}
          sub="dinero que salió"
          icon={TrendingDown}
          color="chart-3"
        />
      </div>

      {/* ── Filters bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="purchases-search"
            placeholder="Buscar por proveedor o concepto…"
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
              {s === "all" ? "Todas" : s === "paid" ? "Contado" : "Crédito"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table / list ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="h-4 w-4" />
            {isLoading
              ? "Cargando compras…"
              : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <p className="text-sm text-destructive p-6 text-center">
              Error al cargar las compras. Verifica que el backend esté activo.
            </p>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <ShoppingBasket className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay compras para el período seleccionado.</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="divide-y">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_140px_120px_100px_90px_40px] gap-4 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                <span>Proveedor / Concepto</span>
                <span>Fecha</span>
                <span className="text-right">Total</span>
                <span className="text-right">Pagado</span>
                <span className="text-center">Estado</span>
                <span />
              </div>

              {filtered.map((purchase) => {
                const isCredit = Number(purchase.balance) > 0;

                return (
                  <div key={purchase.id}>
                    {/* Row */}
                    <button
                      id={`purchase-row-${purchase.id}`}
                      onClick={() => setViewing(purchase)}
                      className="w-full text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_120px_100px_90px_40px] gap-4 px-5 py-3.5 items-center">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {purchase.supplier_name ?? "Proveedor desconocido"}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                            {purchase.concept}
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground hidden sm:block">
                          {formatDate(purchase.issue_date)}
                        </div>

                        <div className="text-sm font-semibold tabular-nums text-right hidden sm:block">
                          {money(Number(purchase.amount))}
                        </div>

                        <div className="text-sm tabular-nums text-right hidden sm:block">
                          {money(Number(purchase.amount_paid))}
                        </div>

                        <div className="hidden sm:flex justify-center">
                          <Badge
                            variant={!isCredit ? "default" : "secondary"}
                            className={isCredit ? "text-warning" : ""}
                          >
                            {!isCredit ? "Pagado" : "Crédito"}
                          </Badge>
                        </div>

                        {/* Mobile: compact */}
                        <div className="sm:hidden flex flex-col items-end gap-1">
                          <span className="font-semibold text-sm tabular-nums">
                            {money(Number(purchase.amount))}
                          </span>
                          <Badge
                            variant={!isCredit ? "default" : "secondary"}
                            className={`text-xs ${isCredit ? "text-warning" : ""}`}
                          >
                            {!isCredit ? "Pagado" : "Crédito"}
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
      <PurchaseDetailDialog
        purchase={viewing}
        onClose={() => setViewing(null)}
        onEdit={(p) => { setViewing(null); openEdit(p); }}
        onDelete={(p) => { setViewing(null); setDeleteTarget(p); }}
      />

      {/* ── Edit dialog ── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar compra</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4">
              <div>
                <Label>Proveedor</Label>
                {editing.supplierId || editing.supplierName ? (
                  <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-1">
                    <div className="text-sm font-medium">{editing.supplierName}</div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditing({ ...editing, supplierId: null, supplierName: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Buscar proveedor…"
                      value={editing.supplierQuery}
                      onChange={(e) => setEditing({ ...editing, supplierQuery: e.target.value })}
                      className="mt-1"
                    />
                    {editing.supplierQuery.trim() && (
                      <div className="border rounded-md divide-y max-h-48 overflow-auto mt-1">
                        {supplierResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setEditing({ ...editing, supplierId: s.id, supplierName: s.name, supplierQuery: "" })}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          >
                            <div className="font-medium">{s.name}</div>
                            {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                          </button>
                        ))}
                        {supplierResults.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div><Label>Concepto</Label><Input value={editing.concept} onChange={(e) => setEditing({ ...editing, concept: e.target.value })} /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha de compra</Label><Input type="date" value={editing.issueDate} onChange={(e) => setEditing({ ...editing, issueDate: e.target.value })} /></div>
                <div><Label>Fecha de vencimiento</Label><Input type="date" value={editing.dueDate} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} /></div>
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
                        <div className="text-sm tabular-nums">{money(Number(p.cost))}</div>
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
                  <ShoppingBasket className="h-4 w-4" />
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
                        type="number" min="0" step="0.01" value={i.unit_cost}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setEditing((f) => f && { ...f, cart: f.cart.map((it, k) => k === idx ? { ...it, unit_cost: v } : it) });
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
            <AlertDialogTitle>¿Eliminar esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la compra a{" "}
              <strong>{deleteTarget?.supplier_name ?? "proveedor desconocido"}</strong> por{" "}
              <strong>{deleteTarget ? money(Number(deleteTarget.amount)) : ""}</strong> y se revertirá el
              stock que había ingresado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removePurchase.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) removePurchase.mutate(deleteTarget.id);
              }}
            >
              {removePurchase.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PurchaseDetailDialog({
  purchase,
  onClose,
  onEdit,
  onDelete,
}: {
  purchase: PayableOut | null;
  onClose: () => void;
  onEdit: (purchase: PayableOut) => void;
  onDelete: (purchase: PayableOut) => void;
}) {
  const items = purchase?.items ?? [];
  const payments = purchase?.payments ?? [];
  const { sorted: sortedItems, sortKey: itemsSortKey, sortOrder: itemsSortOrder, handleSort: handleItemsSort } = useTableSort(items, "product_name", "asc");
  const { sorted: sortedPayments, sortKey: paySortKey, sortOrder: paySortOrder, handleSort: handlePaySort } = useTableSort(payments, "payment_date", "desc");
  const balance = purchase ? Number(purchase.balance) : 0;
  const isCredit = balance > 0;

  return (
    <Dialog open={!!purchase} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{purchase?.supplier_name || "Proveedor desconocido"}</DialogTitle>
        </DialogHeader>
        {purchase && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 items-center">
                <div>
                  <span className="text-muted-foreground">Fecha: </span>
                  <span className="font-medium">{formatDate(purchase.issue_date)}</span>
                </div>
                {isCredit && purchase.due_date && (
                  <div>
                    <span className="text-muted-foreground">Vence: </span>
                    <span className="font-medium">{formatDate(purchase.due_date)}</span>
                  </div>
                )}
                <Badge variant={!isCredit ? "default" : "secondary"} className={isCredit ? "text-warning" : ""}>
                  {!isCredit ? "Pagado" : "Crédito"}
                </Badge>
              </div>
              <div className="text-right tabular-nums">
                <div>Total <strong>{money(Number(purchase.amount))}</strong></div>
                {isCredit && (
                  <div className="text-warning">Pendiente <strong>{money(balance)}</strong></div>
                )}
              </div>
            </div>

            {purchase.notes && (
              <p className="text-sm">
                <span className="text-muted-foreground">Notas: </span>
                {purchase.notes}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(purchase)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(purchase)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
              </Button>
            </div>

            <div>
              <div className="text-xs font-medium mb-1 text-muted-foreground">Productos</div>
              <Table>
                <TableHeader><TableRow>
                  <SortableHead sortKey="product_name" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} className="h-8">Producto</SortableHead>
                  <SortableHead sortKey="quantity" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} align="right" className="h-8">Cant.</SortableHead>
                  <SortableHead sortKey="unit_cost" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} align="right" className="h-8">Costo Unit.</SortableHead>
                  <SortableHead sortKey="subtotal" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} align="right" className="h-8">Subtotal</SortableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="py-1">{i.product_name}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums">{Number(i.quantity)}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums">{money(Number(i.unit_cost))}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums font-medium">{money(Number(i.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-2">Sin productos.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {isCredit && (
              <div>
                <div className="text-xs font-medium mb-1 text-muted-foreground">Abonos</div>
                <Table>
                  <TableHeader><TableRow>
                    <SortableHead sortKey="payment_date" currentSort={paySortKey} currentOrder={paySortOrder} onSort={handlePaySort} className="h-8">Fecha</SortableHead>
                    <SortableHead sortKey="amount" currentSort={paySortKey} currentOrder={paySortOrder} onSort={handlePaySort} align="right" className="h-8">Monto</SortableHead>
                    <SortableHead sortKey="notes" currentSort={paySortKey} currentOrder={paySortOrder} onSort={handlePaySort} className="h-8">Nota</SortableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sortedPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="py-1 text-xs">{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="py-1 text-right tabular-nums text-success">{money(Number(p.amount))}</TableCell>
                        <TableCell className="py-1 text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-2">Sin abonos registrados.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
