import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { InventoryMovement } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, PackagePlus, History } from "lucide-react";
import { money, formatDateTime } from "@/lib/format";
import { adjustStock, type Product } from "@/lib/data";
import { useTableSort } from "@/lib/sort";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventario — Multimarket" },
      { name: "description", content: "Productos, costos, precios, márgenes y movimientos." },
      { property: "og:title", content: "Inventario — Multimarket" },
      { property: "og:description", content: "Productos, costos, precios, márgenes y movimientos." },
    ],
  }),
  component: Inventory,
});

const empty: Partial<Product> = {
  name: "", cost: 0, price: 0, stock: 0, low_stock_threshold: 5, unit: "unidad", active: true, notes: "",
};

function Inventory() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(
    filtered,
    "name",
    "asc",
    (p, key) => (key === "margin" ? Number(p.price) - Number(p.cost) : undefined)
  );

  const totalCostValue = products.reduce((acc, p) => {
    const stock = Math.max(0, Number(p.stock));
    const cost = Number(p.cost);
    const unit = (p.unit || "").trim().toLowerCase();
    const isGramOrMl = /^(gr|g|gramo|gramos|grs|ml|mililitro|mililitros|cc)$/.test(unit);
    return acc + (isGramOrMl ? (stock / 1000) * cost : stock * cost);
  }, 0);

  const save = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      if (!p.name?.trim()) throw new Error("El nombre es obligatorio.");
      if (p.id) {
        await apiPut(`/api/products/${p.id}`, {
          name: p.name, cost: p.cost, price: p.price,
          low_stock_threshold: p.low_stock_threshold, unit: p.unit, active: p.active, notes: p.notes,
        });
      } else {
        await apiPost("/api/products", {
          name: p.name!, cost: p.cost ?? 0, price: p.price ?? 0, stock: p.stock ?? 0,
          low_stock_threshold: p.low_stock_threshold ?? 5, unit: p.unit ?? "unidad", active: p.active ?? true, notes: p.notes,
        });
      }
    },
    onSuccess: () => { toast.success("Producto guardado"); setEditing(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} productos registrados · Valor en costo: <strong className="text-foreground">{money(totalCostValue)}</strong>
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
          <Button className="w-full sm:w-auto" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Producto</SortableHead>
                <SortableHead sortKey="stock" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Stock</SortableHead>
                <SortableHead sortKey="cost" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden sm:table-cell">Costo</SortableHead>
                <SortableHead sortKey="price" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden sm:table-cell">Precio</SortableHead>
                <SortableHead sortKey="margin" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Margen</SortableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => {
                const margin = Number(p.price) - Number(p.cost);
                const marginPct = Number(p.cost) > 0 ? (margin / Number(p.cost)) * 100 : 0;
                const low = Number(p.stock) <= Number(p.low_stock_threshold);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.unit}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {low ? <Badge variant="destructive">{Number(p.stock)}</Badge> : Number(p.stock)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{money(Number(p.cost))}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{money(Number(p.price))}</TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                      {money(margin)} <span className="text-xs">({marginPct.toFixed(0)}%)</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setAdjustProduct(p)} title="Ajustar stock"><PackagePlus className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setHistoryProduct(p)} title="Historial"><History className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin productos.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nombre *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Unidad</Label><Input value={editing.unit ?? ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} /></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div><Label>Costo</Label><Input type="number" step="0.01" value={editing.cost ?? 0} onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })} /></div>
                <div><Label>Precio</Label><Input type="number" step="0.01" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Umbral bajo</Label><Input type="number" step="1" value={editing.low_stock_threshold ?? 5} onChange={(e) => setEditing({ ...editing, low_stock_threshold: Number(e.target.value) })} /></div>
              </div>
              {!editing.id && (
                <div><Label>Stock inicial</Label><Input type="number" step="1" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
              )}
              <div><Label>Notas</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdjustDialog product={adjustProduct} onClose={() => setAdjustProduct(null)} onDone={() => qc.invalidateQueries()} />
      <HistoryDialog product={historyProduct} onClose={() => setHistoryProduct(null)} />
    </div>
  );
}

function AdjustDialog({ product, onClose, onDone }: { product: Product | null; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!product) return;
      await adjustStock({ product_id: product.id, new_stock: Number(value), notes });
    },
    onSuccess: () => { toast.success("Stock actualizado"); onDone(); onClose(); setValue(""); setNotes(""); },
  });
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajustar stock — {product?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Stock actual: <strong>{product && Number(product.stock)}</strong></p>
          <div><Label>Nuevo stock</Label><Input type="number" step="0.5" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div><Label>Motivo (merma, conteo, etc.)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!value}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Venta",
  purchase: "Compra",
  adjustment: "Ajuste",
  initial: "Inicial",
};

function HistoryDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data = [] } = useQuery({
    queryKey: ["inv-mov", product?.id],
    queryFn: async () => {
      if (!product) return [];
      return apiGet<InventoryMovement[]>(`/api/inventory/movements?product_id=${product.id}`);
    },
    enabled: !!product,
  });
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(data, "created_at", "desc");
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Historial — {product?.name}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="created_at" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Fecha</SortableHead>
                <SortableHead sortKey="movement_type" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Tipo</SortableHead>
                <SortableHead sortKey="quantity_change" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Cambio</SortableHead>
                <SortableHead sortKey="notes" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Nota</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{formatDateTime(m.created_at)}</TableCell>
                  <TableCell><Badge variant="outline">{MOVEMENT_TYPE_LABELS[m.movement_type?.toLowerCase()] || m.movement_type}</Badge></TableCell>
                  <TableCell className={`text-right tabular-nums ${Number(m.quantity_change) < 0 ? "text-destructive" : "text-success"}`}>
                    {Number(m.quantity_change) > 0 ? "+" : ""}{Number(m.quantity_change)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.notes}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin movimientos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
