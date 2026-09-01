import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { deleteExpense } from "@/lib/data";
import { money, formatDate } from "@/lib/format";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Wallet,
  Search,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Gastos — Multimarket" },
      { name: "description", content: "Gastos operativos: Punto de gastos y cuentas por pagar registradas directamente." },
    ],
  }),
  component: ExpensesPage,
});

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type PayableOut = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  concept: string;
  amount: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  issue_date: string | null;
  notes: string | null;
  days_old: number;
  overdue: boolean;
  items?: { id: string; product_name: string; quantity: number; unit_cost: number; subtotal: number }[];
};

function ExpensesPage() {
  const t = today();
  const qc = useQueryClient();
  const [from, setFrom] = useState(t);
  const [to, setTo] = useState(t);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayableOut | null>(null);

  const { data: payables = [], isLoading, isError } = useQuery({
    queryKey: ["payables-for-expenses", from, to],
    queryFn: () => apiGet<PayableOut[]>(`/api/payables?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  // Un "gasto" es una cuenta por pagar sin productos asociados: registrada
  // directamente en Punto de gastos o en Cuentas por pagar. Las compras a
  // proveedores (con productos asociados) nunca cuentan como gasto operativo.
  const expenses = useMemo(
    () => payables.filter((p) => !p.items || p.items.length === 0),
    [payables],
  );

  const removeExpense = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      toast.success("Gasto eliminado");
      setDeleteTarget(null);
      setExpanded((prev) => (prev === deleteTarget?.id ? null : prev));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (p) =>
        (p.supplier_name ?? "").toLowerCase().includes(q) ||
        p.concept.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const totalGastos = filtered.reduce((s, p) => s + Number(p.amount), 0);

  const exportExcel = () => {
    exportToExcel(`gastos_${from}_${to}`, [
      {
        name: "Resumen",
        rows: [{
          Desde: from, Hasta: to,
          "Total gastos": totalGastos, "Cantidad de gastos": filtered.length,
        }],
      },
      {
        name: "Detalle",
        rows: filtered.map((p) => ({
          Concepto: p.concept,
          Proveedor: p.supplier_name ?? "—",
          Fecha: p.issue_date,
          Total: Number(p.amount),
        })),
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            Gastos operativos: Punto de gastos y cuentas por pagar registradas directamente, por rango de fechas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
          <span className="text-muted-foreground text-sm font-medium">—</span>
          <div className="flex items-center gap-1.5 border rounded-lg px-3 py-2 bg-card shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm bg-transparent outline-none text-foreground w-36"
            />
          </div>
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar a Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total gastos operativos" value={money(totalGastos)} sub={`${filtered.length} gasto${filtered.length !== 1 ? "s" : ""}`} icon={Wallet} color="primary" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por concepto o proveedor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            {isLoading ? "Cargando gastos…" : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <p className="text-sm text-destructive p-6 text-center">
              Error al cargar los gastos. Verifica que el backend esté activo.
            </p>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay gastos para el período seleccionado.</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="divide-y">
              <div className="hidden sm:grid grid-cols-[1fr_140px_120px_40px] gap-4 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">
                <span>Concepto / Proveedor</span>
                <span>Fecha</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {filtered.map((expense) => {
                const isOpen = expanded === expense.id;

                return (
                  <div key={expense.id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : expense.id)}
                      className="w-full text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_120px_40px] gap-4 px-5 py-3.5 items-center">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{expense.concept}</div>
                          <div className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                            {expense.supplier_name ?? "—"}
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground hidden sm:block">
                          {formatDate(expense.issue_date)}
                        </div>

                        <div className="text-sm font-semibold tabular-nums text-right hidden sm:block">
                          {money(Number(expense.amount))}
                        </div>

                        <div className="sm:hidden flex items-center justify-end">
                          <span className="font-semibold text-sm tabular-nums">{money(Number(expense.amount))}</span>
                        </div>

                        <div className="flex justify-center text-muted-foreground">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t bg-muted/30 px-5 py-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Fecha: </span>
                              <span className="font-medium">{formatDate(expense.issue_date)}</span>
                            </div>
                            {expense.notes && (
                              <div>
                                <span className="text-muted-foreground">Notas: </span>
                                <span className="font-medium">{expense.notes}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => setDeleteTarget(expense)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el gasto <strong>{deleteTarget?.concept}</strong> por{" "}
              <strong>{deleteTarget ? money(Number(deleteTarget.amount)) : ""}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeExpense.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) removeExpense.mutate(deleteTarget.id);
              }}
            >
              {removeExpense.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-${color}/10 text-${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
