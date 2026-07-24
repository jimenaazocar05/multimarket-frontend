import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Plus } from "lucide-react";
import { money, formatDate, daysBetween } from "@/lib/format";
import { registerPayment } from "@/lib/data";
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

type NewForm = { supplier_id: string; concept: string; amount: string; due_date: string; notes: string };

function Payables() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState<NewForm | null>(null);
  const [paying, setPaying] = useState<null | { payable_id: string; supplier: string; balance: number }>(null);
  const [amount, setAmount] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
  const { data = [] } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data } = await supabase.from("payables").select("*").order("issue_date");
      return (data ?? []).map((p) => ({
        ...p,
        balance: Number(p.amount) - Number(p.amount_paid),
        daysOld: daysBetween(new Date(), new Date(p.issue_date)),
        overdue: p.due_date ? new Date(p.due_date) < new Date() && Number(p.amount) - Number(p.amount_paid) > 0.001 : false,
      }));
    },
  });
  const openItems = data.filter((p) => p.balance > 0.001);
  const totalOwed = openItems.reduce((s, r) => s + r.balance, 0);

  const create = useMutation({
    mutationFn: async () => {
      if (!creating) return;
      if (!creating.concept.trim() || !creating.amount) throw new Error("Concepto y monto requeridos.");
      const supplier = suppliers.find((s) => s.id === creating.supplier_id);
      const { error } = await supabase.from("payables").insert({
        supplier_id: creating.supplier_id || null,
        supplier_name: supplier?.name ?? null,
        concept: creating.concept,
        amount: Number(creating.amount),
        due_date: creating.due_date || null,
        notes: creating.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cuenta registrada"); setCreating(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!paying) return;
      const v = Number(amount);
      if (!v || v <= 0) throw new Error("Monto inválido.");
      if (v > paying.balance + 0.001) throw new Error("El abono supera el saldo.");
      await registerPayment({ kind: "payable", payable_id: paying.payable_id, amount: v });
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
        <div className="flex items-center gap-3">
          <Card className="min-w-56"><CardContent className="pt-4">
            <div className="text-xs uppercase text-muted-foreground">Total por pagar</div>
            <div className="text-2xl font-semibold tabular-nums text-destructive">{money(totalOwed)}</div>
          </CardContent></Card>
          <Button onClick={() => setCreating({ supplier_id: "", concept: "", amount: "", due_date: "", notes: "" })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva cuenta
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Emitida</TableHead><TableHead>Proveedor</TableHead><TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{formatDate(p.issue_date)}</TableCell>
                  <TableCell className="font-medium">{p.supplier_name || "—"}</TableCell>
                  <TableCell>{p.concept}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(p.amount))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{money(Number(p.amount_paid))}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(p.balance)}</TableCell>
                  <TableCell>
                    {p.due_date ? (
                      <Badge variant={p.overdue ? "destructive" : "outline"}>{formatDate(p.due_date)}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {p.balance > 0.001 ? (
                      <Button size="sm" variant="outline" onClick={() => setPaying({ payable_id: p.id, supplier: p.supplier_name ?? "—", balance: p.balance })}>
                        <HandCoins className="h-4 w-4 mr-1" /> Pagar
                      </Button>
                    ) : <Badge variant="default">Pagada</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin cuentas por pagar.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva cuenta por pagar</DialogTitle></DialogHeader>
          {creating && (
            <div className="grid gap-3">
              <div>
                <Label>Proveedor</Label>
                <Select value={creating.supplier_id} onValueChange={(v) => setCreating({ ...creating, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            <Button variant="outline" onClick={() => setCreating(null)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Proveedor: <strong>{paying?.supplier}</strong></p>
            <p className="text-sm">Saldo: <strong className="tabular-nums">{paying && money(paying.balance)}</strong></p>
            <div><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
            <Button variant="outline" size="sm" onClick={() => paying && setAmount(String(paying.balance))}>Total</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
