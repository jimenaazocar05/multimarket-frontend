import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, PackagePlus, History } from "lucide-react";
import { money, formatDateTime } from "@/lib/format";
import { adjustStock, type Product } from "@/lib/data";
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
  code: "", name: "", cost: 0, price: 0, stock: 0, low_stock_threshold: 5, unit: "unidad", active: true, notes: "",
};

function Inventory() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.code ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const save = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      if (!p.name?.trim()) throw new Error("El nombre es obligatorio.");
      if (p.id) {
        const { error } = await supabase.from("products").update({
          code: p.code, name: p.name, cost: p.cost, price: p.price,
          low_stock_threshold: p.low_stock_threshold, unit: p.unit, active: p.active, notes: p.notes,
        }).eq("id", p.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert({
          code: p.code, name: p.name!, cost: p.cost ?? 0, price: p.price ?? 0, stock: p.stock ?? 0,
          low_stock_threshold: p.low_stock_threshold ?? 5, unit: p.unit ?? "unidad", active: p.active ?? true, notes: p.notes,
        }).select().single();
        if (error) throw error;
        if (data && Number(p.stock) > 0) {
          await supabase.from("inventory_movements").insert({
            product_id: data.id, movement_type: "initial", quantity_change: Number(p.stock), notes: "Stock inicial",
          });
        }
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
          <p className="text-sm text-muted-foreground">{products.length} productos registrados.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const margin = Number(p.price) - Number(p.cost);
                const marginPct = Number(p.cost) > 0 ? (margin / Number(p.cost)) * 100 : 0;
                const low = Number(p.stock) <= Number(p.low_stock_threshold);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.unit}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {low ? <Badge variant="destructive">{Number(p.stock)}</Badge> : Number(p.stock)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(Number(p.cost))}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(Number(p.price))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin productos.</TableCell></TableRow>
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
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Código</Label><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
                <div><Label>Unidad</Label><Input value={editing.unit ?? ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} /></div>
              </div>
              <div><Label>Nombre *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
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

function HistoryDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data = [] } = useQuery({
    queryKey: ["inv-mov", product?.id],
    queryFn: async () => {
      if (!product) return [];
      return (await supabase.from("inventory_movements").select("*").eq("product_id", product.id).order("created_at", { ascending: false }).limit(50)).data ?? [];
    },
    enabled: !!product,
  });
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Historial — {product?.name}</DialogTitle></DialogHeader>
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Cambio</TableHead><TableHead>Nota</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{formatDateTime(m.created_at)}</TableCell>
                  <TableCell><Badge variant="outline">{m.movement_type}</Badge></TableCell>
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
