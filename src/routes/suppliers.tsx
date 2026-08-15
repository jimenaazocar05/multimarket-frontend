import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Supplier } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Plus, Pencil, Eye } from "lucide-react";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useTableSort } from "@/lib/sort";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Proveedores — Multimarket" },
      { name: "description", content: "Gestión de proveedores y deuda pendiente." },
      { property: "og:title", content: "Proveedores — Multimarket" },
      { property: "og:description", content: "Gestión de proveedores y deuda pendiente." },
    ],
  }),
  component: Suppliers,
});

type Form = { id?: string; name: string; phone: string; notes: string };

function Suppliers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Form | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-full"],
    queryFn: () => apiGet<Supplier[]>("/api/suppliers"),
  });
  const filtered = suppliers.filter((s) => {
    const needle = q.toLowerCase();
    return s.name.toLowerCase().includes(needle) || (s.phone ?? "").toLowerCase().includes(needle);
  });
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(filtered, "name", "asc");

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.name.trim()) throw new Error("Nombre requerido.");
      const body = { name: f.name, phone: f.phone || null, notes: f.notes || null };
      if (f.id) {
        await apiPut(`/api/suppliers/${f.id}`, body);
      } else {
        await apiPost("/api/suppliers", body);
      }
    },
    onSuccess: () => { toast.success("Guardado"); setEditing(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} proveedores registrados.</p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
          <Input placeholder="Buscar por nombre o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
          <Button className="w-full sm:w-auto" onClick={() => setEditing({ name: "", phone: "", notes: "" })}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <SortableHead sortKey="name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Nombre</SortableHead>
              <SortableHead sortKey="phone" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden sm:table-cell">Teléfono</SortableHead>
              <SortableHead sortKey="agg.count" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Facturas</SortableHead>
              <SortableHead sortKey="agg.total" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden sm:table-cell">Total</SortableHead>
              <SortableHead sortKey="agg.owed" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Debo</SortableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{s.phone || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">{s.agg.count}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums">{money(s.agg.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.agg.owed > 0 ? <Badge variant="destructive">{money(s.agg.owed)}</Badge> : money(0)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ id: s.id, name: s.name, phone: s.phone ?? "", notes: s.notes ?? "" })}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin proveedores.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nombre *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea rows={3} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewing?.name}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Teléfono: {viewing?.phone || "—"}</p>
            {viewing?.notes && <p>Notas: {viewing.notes}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
