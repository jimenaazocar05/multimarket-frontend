import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-full"],
    queryFn: async () => {
      const [sp, py] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("payables").select("supplier_id,amount,amount_paid"),
      ]);
      const agg = new Map<string, { total: number; owed: number; count: number }>();
      for (const p of py.data ?? []) {
        if (!p.supplier_id) continue;
        const cur = agg.get(p.supplier_id) ?? { total: 0, owed: 0, count: 0 };
        cur.total += Number(p.amount); cur.count += 1;
        cur.owed += Number(p.amount) - Number(p.amount_paid);
        agg.set(p.supplier_id, cur);
      }
      return (sp.data ?? []).map((s) => ({ ...s, agg: agg.get(s.id) ?? { total: 0, owed: 0, count: 0 } }));
    },
  });
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.name.trim()) throw new Error("Nombre requerido.");
      if (f.id) {
        const { error } = await supabase.from("suppliers").update({ name: f.name, phone: f.phone || null, notes: f.notes || null }).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ name: f.name, phone: f.phone || null, notes: f.notes || null });
        if (error) throw error;
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
        <div className="flex gap-2">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button onClick={() => setEditing({ name: "", phone: "", notes: "" })}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Facturas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Debo</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.agg.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(s.agg.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.agg.owed > 0 ? <Badge variant="destructive">{money(s.agg.owed)}</Badge> : money(0)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setEditing({ id: s.id, name: s.name, phone: s.phone ?? "", notes: s.notes ?? "" })}><Pencil className="h-4 w-4" /></Button>
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
    </div>
  );
}
