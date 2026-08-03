import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { Supplier, Payable } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Plus, Eye, X } from "lucide-react";
import { money, formatDate } from "@/lib/format";
import { registerPayment } from "@/lib/data";
import { useTableSort } from "@/lib/sort";
import { toast } from "sonner";

export const Route = createFileRoute("/payables")({
  head: () => ({
    meta: [
      { title: "Cuentas por pagar — Multimarket" },
      { name: "description", content: "Deudas con proveedores y registro de pagos." },
      { property: "og:title", content: "Cuentas por pagar — Multimarket" },
      { property: "og:description", content: "Deudas con proveedores y registro de pagos." },
    ],
  }),
  component: Payables,
});

type NewForm = { supplier: Supplier | null; concept: string; amount: string; due_date: string; notes: string };

type PayableGroup = {
  key: string;
  supplier_id: string | null;
  supplier_name: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  days_old: number;
  oldest_date: string;
  nearest_due_date: string | null;
  overdue: boolean;
  payables: Payable[];
};

function groupBySupplier(data: Payable[]): PayableGroup[] {
  const map = new Map<string, PayableGroup>();
  for (const p of data) {
    const key = p.supplier_id ?? `payable:${p.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, supplier_id: p.supplier_id, supplier_name: p.supplier_name,
        amount: 0, amount_paid: 0, balance: 0, days_old: 0, oldest_date: p.issue_date,
        nearest_due_date: null, overdue: false, payables: [],
      };
      map.set(key, g);
    }
    g.amount += Number(p.amount);
    g.amount_paid += Number(p.amount_paid);
    g.balance += p.balance;
    g.payables.push(p);
    // La antigüedad y el "emitida"/"vence" que se muestran priorizan las facturas
    // aún pendientes; si todo está pagado, se usa el conjunto completo.
    const pending = g.payables.filter((x) => x.balance > 0.001);
    const reference = pending.length > 0 ? pending : g.payables;
    g.oldest_date = reference.reduce((min, x) => (x.issue_date < min ? x.issue_date : min), reference[0].issue_date);
    g.days_old = reference.reduce((max, x) => Math.max(max, x.days_old), 0);
    const dueDates = pending.map((x) => x.due_date).filter((d): d is string => !!d);
    g.nearest_due_date = dueDates.length > 0 ? dueDates.reduce((min, d) => (d < min ? d : min)) : null;
    g.overdue = pending.some((x) => x.overdue);
  }
  for (const g of map.values()) g.payables.sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  return Array.from(map.values());
}

function Payables() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState<NewForm | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [newSupplier, setNewSupplier] = useState<{ name: string; phone: string } | null>(null);
  const [paying, setPaying] = useState<PayableGroup | null>(null);
  const [amount, setAmount] = useState("");
  const [viewing, setViewing] = useState<PayableGroup | null>(null);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiGet<Supplier[]>("/api/suppliers"),
  });
  const { data = [] } = useQuery({
    queryKey: ["payables"],
    queryFn: () => apiGet<Payable[]>("/api/payables"),
  });
  const openItems = data.filter((p) => p.balance > 0.001);
  const totalOwed = openItems.reduce((s, r) => s + r.balance, 0);

  const phoneBySupplierId = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => { if (s.phone) map.set(s.id, s.phone); });
    return map;
  }, [suppliers]);

  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return data;
    return data.filter((p) => {
      const d = p.issue_date.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const groups = useMemo(() => groupBySupplier(dateFiltered), [dateFiltered]);

  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const needle = q.toLowerCase();
    return groups.filter((g) => {
      const phone = g.supplier_id ? phoneBySupplierId.get(g.supplier_id) ?? "" : "";
      return (g.supplier_name ?? "").toLowerCase().includes(needle) || phone.toLowerCase().includes(needle);
    });
  }, [groups, q, phoneBySupplierId]);

  const supplierResults = useMemo(() => {
    if (!supplierQuery.trim()) return [];
    const needle = supplierQuery.toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(needle) || (s.phone ?? "").toLowerCase().includes(needle),
    ).slice(0, 6);
  }, [supplierQuery, suppliers]);

  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(filteredGroups, "supplier_name", "asc");

  const closeCreating = () => { setCreating(null); setSupplierQuery(""); };

  const create = useMutation({
    mutationFn: async () => {
      if (!creating) return;
      if (!creating.concept.trim() || !creating.amount) throw new Error("Concepto y monto requeridos.");
      await apiPost("/api/payables", {
        supplier_id: creating.supplier?.id ?? null,
        supplier_name: creating.supplier?.name ?? null,
        concept: creating.concept,
        amount: Number(creating.amount),
        due_date: creating.due_date || null,
        notes: creating.notes || null,
      });
    },
    onSuccess: () => { toast.success("Cuenta registrada"); closeCreating(); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSupplier = useMutation({
    mutationFn: async () => {
      if (!newSupplier) return null;
      if (!newSupplier.name.trim()) throw new Error("El nombre es obligatorio.");
      return apiPost<Supplier>("/api/suppliers", { name: newSupplier.name.trim(), phone: newSupplier.phone.trim() || null });
    },
    onSuccess: (supplier) => {
      if (!supplier) return;
      setCreating((c) => (c ? { ...c, supplier } : c));
      setNewSupplier(null);
      setSupplierQuery("");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!paying) return;
      const v = Number(amount);
      if (!v || v <= 0) throw new Error("Monto inválido.");
      if (v > paying.balance + 0.001) throw new Error("El abono supera el saldo.");
      // Se aplica a las facturas más antiguas primero.
      let remainingCents = Math.round(v * 100);
      for (const payable of paying.payables) {
        if (remainingCents <= 0) break;
        const balanceCents = Math.round(payable.balance * 100);
        const applyCents = Math.min(remainingCents, balanceCents);
        if (applyCents > 0) {
          await registerPayment({ kind: "payable", payable_id: payable.id, amount: applyCents / 100 });
          remainingCents -= applyCents;
        }
      }
    },
    onSuccess: () => { toast.success("Pago registrado"); setPaying(null); setAmount(""); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas por pagar</h1>
          <p className="text-sm text-muted-foreground">{openItems.length} facturas pendientes.</p>
        </div>
        <div className="flex flex-col gap-3 w-full sm:flex-row sm:flex-wrap sm:items-end sm:w-auto">
          <Input placeholder="Buscar por proveedor o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
          <div className="w-full sm:w-36">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
          </div>
          <div className="w-full sm:w-36">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
          </div>
          <Card className="w-full sm:min-w-56"><CardContent className="pt-4">
            <div className="text-xs uppercase text-muted-foreground">Total por pagar</div>
            <div className="text-2xl font-semibold tabular-nums text-destructive">{money(totalOwed)}</div>
          </CardContent></Card>
          <Button className="w-full sm:w-auto" onClick={() => setCreating({ supplier: null, concept: "", amount: "", due_date: "", notes: "" })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva cuenta
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <SortableHead sortKey="oldest_date" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden md:table-cell">Emitida</SortableHead>
              <SortableHead sortKey="supplier_name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Proveedor</SortableHead>
              <SortableHead sortKey="amount" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Monto</SortableHead>
              <SortableHead sortKey="amount_paid" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Pagado</SortableHead>
              <SortableHead sortKey="balance" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Saldo</SortableHead>
              <SortableHead sortKey="nearest_due_date" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden sm:table-cell">Vence</SortableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map((g) => (
                <TableRow key={g.key}>
                  <TableCell className="hidden md:table-cell text-xs">{formatDate(g.oldest_date)}</TableCell>
                  <TableCell className="font-medium">
                    {g.supplier_name || "—"}
                    {g.payables.length > 1 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">({g.payables.length} facturas)</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">{money(g.amount)}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">{money(g.amount_paid)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(g.balance)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {g.nearest_due_date ? (
                      <Badge variant={g.overdue ? "destructive" : "outline"}>{formatDate(g.nearest_due_date)}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(g)} title="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {g.balance > 0.001 ? (
                        <Button size="sm" variant="outline" onClick={() => setPaying(g)}>
                          <HandCoins className="h-4 w-4 mr-1" /> Pagar
                        </Button>
                      ) : <Badge variant="default" className="self-center">Pagada</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {data.length === 0 ? "Sin cuentas por pagar." : "Sin resultados para esa búsqueda o rango de fechas."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!creating} onOpenChange={(o) => !o && closeCreating()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva cuenta por pagar</DialogTitle></DialogHeader>
          {creating && (
            <div className="grid gap-3">
              <div>
                <Label>Proveedor</Label>
                {creating.supplier ? (
                  <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-1">
                    <div>
                      <div className="text-sm font-medium">{creating.supplier.name}</div>
                      {creating.supplier.phone && <div className="text-xs text-muted-foreground">{creating.supplier.phone}</div>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreating({ ...creating, supplier: null })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Buscar o escribir proveedor nuevo…"
                      value={supplierQuery}
                      onChange={(e) => setSupplierQuery(e.target.value)}
                      className="mt-1"
                    />
                    {supplierQuery.trim() && (
                      <div className="border rounded-md divide-y max-h-48 overflow-auto mt-1">
                        {supplierResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setCreating({ ...creating, supplier: s }); setSupplierQuery(""); }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          >
                            <div className="font-medium">{s.name}</div>
                            {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setNewSupplier({ name: supplierQuery.trim(), phone: "" })}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm text-primary"
                        >
                          <Plus className="h-3 w-3 inline mr-1" /> Crear proveedor "{supplierQuery.trim()}"
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div><Label>Concepto *</Label><Input value={creating.concept} onChange={(e) => setCreating({ ...creating, concept: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Monto *</Label><Input type="number" step="0.01" value={creating.amount} onChange={(e) => setCreating({ ...creating, amount: e.target.value })} /></div>
                <div><Label>Vence</Label><Input type="date" value={creating.due_date} onChange={(e) => setCreating({ ...creating, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Notas</Label><Textarea rows={2} value={creating.notes} onChange={(e) => setCreating({ ...creating, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeCreating}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newSupplier} onOpenChange={(o) => !o && setNewSupplier(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo proveedor</DialogTitle></DialogHeader>
          {newSupplier && (
            <div className="grid gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label>Teléfono (opcional)</Label>
                <Input
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSupplier(null)}>Cancelar</Button>
            <Button onClick={() => createSupplier.mutate()} disabled={createSupplier.isPending}>
              {createSupplier.isPending ? "Creando…" : "Crear y usar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Proveedor: <strong>{paying?.supplier_name || "—"}</strong></p>
            <p className="text-sm">Saldo: <strong className="tabular-nums">{paying && money(paying.balance)}</strong></p>
            {paying && paying.payables.filter((p) => p.balance > 0.001).length > 1 && (
              <p className="text-xs text-muted-foreground">
                Tiene varias facturas pendientes. El pago se aplica primero a la más antigua.
              </p>
            )}
            <div><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
            <Button variant="outline" size="sm" onClick={() => paying && setAmount(String(paying.balance))}>Total</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierDetailDialog group={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function SupplierDetailDialog({ group, onClose }: { group: PayableGroup | null; onClose: () => void }) {
  const payableIds = group?.payables.map((p) => p.id) ?? [];
  const results = useQueries({
    queries: payableIds.map((id) => ({
      queryKey: ["payable-detail", id],
      queryFn: () => apiGet<Payable>(`/api/payables/${id}`),
      enabled: !!group,
    })),
  });

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{group?.supplier_name || "Proveedor"}</DialogTitle></DialogHeader>
        {group && (
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {group.payables.map((summary, idx) => {
              const payable = results[idx]?.data;
              return (
                <div key={summary.id} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{summary.concept}</div>
                      <div className="text-xs text-muted-foreground">
                        Emitida {formatDate(summary.issue_date)}
                        {summary.due_date && ` · Vence ${formatDate(summary.due_date)}`}
                      </div>
                    </div>
                    <span className="tabular-nums text-muted-foreground text-right">
                      Monto {money(Number(summary.amount))}<br />
                      Saldo <strong className="text-foreground">{money(summary.balance)}</strong>
                    </span>
                  </div>
                  {!payable ? (
                    <p className="text-xs text-muted-foreground">Cargando…</p>
                  ) : (
                    <>
                      {payable.items.length > 0 && (
                        <div>
                          <div className="text-xs font-medium mb-1 text-muted-foreground">Productos</div>
                          <PayableItemsTable items={payable.items} />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Abonos</div>
                        <PayablePaymentsTable payments={payable.payments} />
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

function PayableItemsTable({ items }: { items: Payable["items"] }) {
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
      </TableBody>
    </Table>
  );
}

function PayablePaymentsTable({ payments }: { payments: Payable["payments"] }) {
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
            <TableCell className="py-1 text-right tabular-nums text-success">{money(Number(p.amount))}</TableCell>
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
