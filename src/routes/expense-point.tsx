import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { Supplier } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Wallet, X } from "lucide-react";
import { createExpense } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/expense-point")({
  head: () => ({
    meta: [
      { title: "Punto de gastos — Multimarket" },
      { name: "description", content: "Registrar gastos del negocio (servicios, sueldos, alquiler, etc.)." },
      { property: "og:title", content: "Punto de gastos — Multimarket" },
      { property: "og:description", content: "Registrar gastos del negocio." },
    ],
  }),
  component: ExpensePoint,
});

function ExpensePoint() {
  const qc = useQueryClient();

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [newSupplier, setNewSupplier] = useState<{ name: string; phone: string } | null>(null);

  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiGet<Supplier[]>("/api/suppliers"),
  });

  const supplierResults = useMemo(() => {
    if (!supplierQuery.trim()) return [];
    const q = supplierQuery.toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone ?? "").toLowerCase().includes(q),
    ).slice(0, 6);
  }, [supplierQuery, suppliers]);

  const createSupplier = useMutation({
    mutationFn: async () => {
      if (!newSupplier) return null;
      if (!newSupplier.name.trim()) throw new Error("El nombre es obligatorio.");
      return apiPost<Supplier>("/api/suppliers", { name: newSupplier.name.trim(), phone: newSupplier.phone.trim() || null });
    },
    onSuccess: (supplier) => {
      if (!supplier) return;
      setSelectedSupplier(supplier);
      setNewSupplier(null);
      setSupplierQuery("");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!concept.trim()) throw new Error("El concepto es obligatorio.");
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) throw new Error("Ingresa un monto válido.");
      await createExpense({
        supplier_id: selectedSupplier?.id ?? null,
        supplier_name: selectedSupplier?.name ?? null,
        concept: concept.trim(),
        amount: amountNum,
        issue_date: issueDate || null,
        due_date: null,
        notes: notes || null,
        is_cash: true,
      });
    },
    onSuccess: () => {
      toast.success("Gasto registrado");
      setConcept(""); setAmount(""); setNotes(""); setIssueDate("");
      setSelectedSupplier(null); setSupplierQuery("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Punto de gastos</h1>
        <p className="text-sm text-muted-foreground">Registra gastos del negocio: servicios, sueldos, alquiler y otros egresos.</p>
      </div>

      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Nuevo gasto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Concepto *</Label>
              <Input
                autoFocus
                placeholder="Ej: Pago de luz, sueldo, alquiler…"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              />
            </div>

            <div>
              <Label>Monto *</Label>
              <Input
                type="number" min="0" step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <Label>Proveedor / beneficiario (opcional)</Label>
              {selectedSupplier ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-1">
                  <div>
                    <div className="text-sm font-medium">{selectedSupplier.name}</div>
                    {selectedSupplier.phone && <div className="text-xs text-muted-foreground">{selectedSupplier.phone}</div>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSupplier(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar o escribir proveedor nuevo…"
                      value={supplierQuery}
                      onChange={(e) => setSupplierQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {supplierQuery.trim() && (
                    <div className="border rounded-md divide-y max-h-48 overflow-auto mt-1">
                      {supplierResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSelectedSupplier(s); setSupplierQuery(""); }}
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

            <div><Label>Fecha del gasto (opcional)</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>Notas (opcional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

            <Button className="w-full" size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> {save.isPending ? "Guardando…" : "Registrar gasto"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Los gastos quedan registrados como pagados de contado.
            </p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
