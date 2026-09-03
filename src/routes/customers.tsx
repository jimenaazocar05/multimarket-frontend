import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import type { Customer, Sale } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Plus, Pencil, Eye, Trash2 } from "lucide-react";
import { money, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useTableSort } from "@/lib/sort";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Clientes — Multimarket" },
      { name: "description", content: "Ficha de clientes, contacto e historial de compras." },
      { property: "og:title", content: "Clientes — Multimarket" },
      { property: "og:description", content: "Ficha de clientes, contacto e historial de compras." },
    ],
  }),
  component: Customers,
});

type CustomerForm = { id?: string; name: string; phone: string; notes: string };

function Customers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<CustomerForm | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-full"],
    queryFn: () => apiGet<Customer[]>("/api/customers"),
  });
  const filtered = customers.filter((c) => {
    const needle = q.toLowerCase();
    return c.name.toLowerCase().includes(needle) || (c.phone ?? "").toLowerCase().includes(needle);
  });
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(filtered, "name", "asc");

  const save = useMutation({
    mutationFn: async (f: CustomerForm) => {
      if (!f.name.trim()) throw new Error("Nombre requerido.");
      const body = { name: f.name, phone: f.phone || null, notes: f.notes || null };
      if (f.id) {
        await apiPut(`/api/customers/${f.id}`, body);
      } else {
        await apiPost("/api/customers", body);
      }
    },
    onSuccess: () => { toast.success("Guardado"); setEditing(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/api/customers/${id}`),
    onSuccess: () => { toast.success("Cliente eliminado"); setDeleteTarget(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{customers.length} clientes registrados.</p>
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
              <SortableHead sortKey="agg.count" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden md:table-cell">Compras</SortableHead>
              <SortableHead sortKey="agg.total" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right" className="hidden sm:table-cell">Total</SortableHead>
              <SortableHead sortKey="agg.owed" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Debe</SortableHead>
              <TableHead className="w-16 sm:w-24"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">{c.agg.count}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums">{money(c.agg.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.agg.owed > 0 ? <Badge variant="destructive">{money(c.agg.owed)}</Badge> : money(0)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(c)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ id: c.id, name: c.name, phone: c.phone ?? "", notes: c.notes ?? "" })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin clientes.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
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

      <CustomerHistoryDialog customer={viewing} onClose={() => setViewing(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará a <strong>{deleteTarget?.name}</strong>. Sus ventas registradas se conservarán,
              pero quedarán sin cliente asociado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) remove.mutate(deleteTarget.id);
              }}
            >
              {remove.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerHistoryDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { data: sales = [] } = useQuery({
    queryKey: ["customer-hist", customer?.id],
    queryFn: () => apiGet<Sale[]>(`/api/customers/${customer!.id}/sales`),
    enabled: !!customer,
  });
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(sales, "sale_date", "desc");

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{customer?.name}</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Teléfono: {customer?.phone || "—"}</p>
          {customer?.notes && <p>Notas: {customer.notes}</p>}
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <SortableHead sortKey="sale_date" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Fecha</SortableHead>
              <SortableHead sortKey="status" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Estado</SortableHead>
              <SortableHead sortKey="total" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Total</SortableHead>
              <SortableHead sortKey="amount_paid" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} align="right">Pagado</SortableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{formatDate(s.sale_date)}</TableCell>
                  <TableCell><Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status === "paid" ? "Pagado" : "Fiado"}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(s.total))}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(s.amount_paid))}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sin compras.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
