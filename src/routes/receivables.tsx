import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HandCoins } from "lucide-react";
import { money, formatDate, daysBetween } from "@/lib/format";
import { registerPayment } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/receivables")({
  head: () => ({
    meta: [
      { title: "Cuentas por cobrar — Multimarket" },
      { name: "description", content: "Saldos pendientes de clientes y registro de abonos." },
      { property: "og:title", content: "Cuentas por cobrar — Multimarket" },
      { property: "og:description", content: "Saldos pendientes de clientes y registro de abonos." },
    ],
  }),
  component: Receivables,
});

function Receivables() {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<null | { sale_id: string; customer: string; balance: number }>(null);
  const [amount, setAmount] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data: sales } = await supabase.from("sales").select("*").eq("status", "credit").order("sale_date");
      return (sales ?? []).map((s) => ({
        ...s,
        balance: Number(s.total) - Number(s.amount_paid),
        daysOld: daysBetween(new Date(), new Date(s.sale_date)),
      })).filter((s) => s.balance > 0.001);
    },
  });

  const totalOwed = data.reduce((s, r) => s + r.balance, 0);

  const pay = useMutation({
    mutationFn: async () => {
      if (!paying) return;
      const v = Number(amount);
      if (!v || v <= 0) throw new Error("Monto inválido.");
      if (v > paying.balance + 0.001) throw new Error("El abono supera el saldo.");
      await registerPayment({ kind: "receivable", sale_id: paying.sale_id, amount: v });
    },
    onSuccess: () => { toast.success("Abono registrado"); setPaying(null); setAmount(""); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas por cobrar</h1>
          <p className="text-sm text-muted-foreground">{data.length} facturas fiadas pendientes.</p>
        </div>
        <Card className="min-w-56"><CardContent className="pt-4">
          <div className="text-xs uppercase text-muted-foreground">Total por cobrar</div>
          <div className="text-2xl font-semibold tabular-nums text-destructive">{money(totalOwed)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead><TableHead>Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Antigüedad</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{formatDate(s.sale_date)}</TableCell>
                  <TableCell className="font-medium">{s.customer_name || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(Number(s.total))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{money(Number(s.amount_paid))}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(s.balance)}</TableCell>
                  <TableCell>
                    <Badge variant={s.daysOld > 30 ? "destructive" : s.daysOld > 15 ? "secondary" : "outline"}>
                      {s.daysOld} d
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setPaying({ sale_id: s.id, customer: s.customer_name ?? "—", balance: s.balance })}>
                      <HandCoins className="h-4 w-4 mr-1" /> Abonar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Todo cobrado 🎉</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar abono</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Cliente: <strong>{paying?.customer}</strong></p>
            <p className="text-sm">Saldo pendiente: <strong className="tabular-nums">{paying && money(paying.balance)}</strong></p>
            <div><Label>Monto abonado</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => paying && setAmount(String(paying.balance))}>Total ({paying && money(paying.balance)})</Button>
            </div>
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
