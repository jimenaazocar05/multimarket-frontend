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
import { Plus, Pencil, Eye } from "lucide-react";
import { money, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
  const [viewing, setViewing] = useState<string | null>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-full"],
    queryFn: async () => {
      const [cs, ss] = await Promise.all([
        supabase.from("customers").select("*").order("name"),
        supabase.from("sales").select("customer_id,total,amount_paid,status"),
      ]);
      const agg = new Map<string, { total: number; owed: number; count: number }>();
      for (const s of ss.data ?? []) {
        if (!s.customer_id) continue;
        const cur = agg.get(s.customer_id) ?? { total: 0, owed: 0, count: 0 };
        cur.total += Number(s.total); cur.count += 1;
        cur.owed += Number(s.total) - Number(s.amount_paid);
        agg.set(s.customer_id, cur);
      }
      return (cs.data ?? []).map((c) => ({ ...c, agg: agg.get(c.id) ?? { total: 0, owed: 0, count: 0 } }));
    },
  });
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  const save = useMutation({
    mutationFn: async (f: CustomerForm) => {
      if (!f.name.trim()) throw new Error("Nombre requerido.");
      if (f.id) {
        const { error } = await supabase.from("customers").update({ name: f.name, phone: f.phone || null, notes: f.notes || null }).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ name: f.name, phone: f.phone || null, notes: f.notes || null });
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
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{customers.length} clientes registrados.</p>
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
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.agg.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(c.agg.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.agg.owed > 0 ? <Badge variant="destructive">{money(c.agg.owed)}</Badge> : money(0)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewing(c.id)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ id: c.id, name: c.name, phone: c.phone ?? "", notes: c.notes ?? "" })}><Pencil className="h-4 w-4" /></Button>
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

      <CustomerHistoryDialog id={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function CustomerHistoryDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["customer-hist", id],
    queryFn: async () => {
      if (!id) return null;
      const [c, s] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).single(),
        supabase.from("sales").select("*").eq("customer_id", id).order("sale_date", { ascending: false }),
      ]);
      return { customer: c.data, sales: s.data ?? [] };
    },
    enabled: !!id,
  });
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{data?.customer?.name}</DialogTitle></DialogHeader>
        {data?.customer?.notes && <p className="text-sm text-muted-foreground">{data.customer.notes}</p>}
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pagado</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.sales ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{formatDate(s.sale_date)}</TableCell>
                  <TableCell><Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status === "paid" ? "Pagado" : "Fiado"}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(s.total))}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(s.amount_paid))}</TableCell>
                </TableRow>
              ))}
              {(data?.sales?.length ?? 0) === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sin compras.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
