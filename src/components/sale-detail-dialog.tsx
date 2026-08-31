import type { Sale } from "@/lib/api";
import { money, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { useTableSort } from "@/lib/sort";
import { Pencil, Trash2 } from "lucide-react";

export function SaleDetailDialog({
  sale,
  onClose,
  onEdit,
  onDelete,
}: {
  sale: Sale | null;
  onClose: () => void;
  onEdit?: (sale: Sale) => void;
  onDelete?: (sale: Sale) => void;
}) {
  const items = sale?.items ?? [];
  const payments = sale?.payments ?? [];
  const { sorted: sortedItems, sortKey: itemsSortKey, sortOrder: itemsSortOrder, handleSort: handleItemsSort } = useTableSort(items, "product_name", "asc");
  const { sorted: sortedPayments, sortKey: paySortKey, sortOrder: paySortOrder, handleSort: handlePaySort } = useTableSort(payments, "payment_date", "desc");
  const balance = sale ? Number(sale.total) - Number(sale.amount_paid) : 0;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale?.customer_name || "Venta de mostrador"}</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 items-center">
                <div>
                  <span className="text-muted-foreground">Fecha: </span>
                  <span className="font-medium">{formatDate(sale.sale_date)}</span>
                </div>
                <Badge variant={sale.status === "paid" ? "default" : "secondary"} className={sale.status === "credit" ? "text-warning" : ""}>
                  {sale.status === "paid" ? "Pagado" : "Fiado"}
                </Badge>
              </div>
              <div className="text-right tabular-nums">
                <div>Total <strong>{money(Number(sale.total))}</strong></div>
                {balance > 0 && (
                  <div className="text-warning">Pendiente <strong>{money(balance)}</strong></div>
                )}
              </div>
            </div>

            {sale.notes && (
              <p className="text-sm">
                <span className="text-muted-foreground">Notas: </span>
                {sale.notes}
              </p>
            )}

            {(onEdit || onDelete) && (
              <div className="flex gap-2">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(sale)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(sale)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                  </Button>
                )}
              </div>
            )}

            <div>
              <div className="text-xs font-medium mb-1 text-muted-foreground">Productos</div>
              <Table>
                <TableHeader><TableRow>
                  <SortableHead sortKey="product_name" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} className="h-8">Producto</SortableHead>
                  <SortableHead sortKey="quantity" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} align="right" className="h-8">Cant.</SortableHead>
                  <SortableHead sortKey="unit_price" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} align="right" className="h-8">P. Unit.</SortableHead>
                  <SortableHead sortKey="subtotal" currentSort={itemsSortKey} currentOrder={itemsSortOrder} onSort={handleItemsSort} align="right" className="h-8">Subtotal</SortableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="py-1">{i.product_name}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums">{Number(i.quantity)}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums">{money(Number(i.unit_price))}</TableCell>
                      <TableCell className="py-1 text-right tabular-nums font-medium">{money(Number(i.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-2">Sin productos.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {sale.status === "credit" && (
              <div>
                <div className="text-xs font-medium mb-1 text-muted-foreground">Abonos</div>
                <Table>
                  <TableHeader><TableRow>
                    <SortableHead sortKey="payment_date" currentSort={paySortKey} currentOrder={paySortOrder} onSort={handlePaySort} className="h-8">Fecha</SortableHead>
                    <SortableHead sortKey="amount" currentSort={paySortKey} currentOrder={paySortOrder} onSort={handlePaySort} align="right" className="h-8">Monto</SortableHead>
                    <SortableHead sortKey="notes" currentSort={paySortKey} currentOrder={paySortOrder} onSort={handlePaySort} className="h-8">Nota</SortableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sortedPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="py-1 text-xs">{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="py-1 text-right tabular-nums text-success">{money(Number(p.amount))}</TableCell>
                        <TableCell className="py-1 text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-2">Sin abonos registrados.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
