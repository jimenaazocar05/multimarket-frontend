import { apiPost, apiPut, apiDelete } from "@/lib/api";
import type { Payable, Receivable, Sale, SaleInput, StockAdjustmentInput, Product, PurchaseInput, PayableInput } from "@/lib/api";

export type { Product, Customer, Supplier, Sale, SaleItem, Payable, InventoryMovement } from "@/lib/api";

/** Registra una venta: el backend crea la venta + items, descuenta stock y
 * registra el movimiento de inventario en una sola transaccion. */
export async function createSale(input: SaleInput): Promise<Sale> {
  return apiPost<Sale>("/api/sales", input);
}

/** Edita una venta existente: reemplaza sus items, revirtiendo y
 * reaplicando el stock correspondiente en el backend. */
export async function updateSale(id: string, input: SaleInput): Promise<Sale> {
  return apiPut<Sale>(`/api/sales/${id}`, input);
}

/** Elimina una venta: revierte el stock descontado por sus items y
 * borra los abonos asociados. */
export async function deleteSale(id: string): Promise<void> {
  return apiDelete<void>(`/api/sales/${id}`);
}

/** Registra una compra a proveedor: el backend crea la cuenta por pagar,
 * aumenta el stock de cada producto y registra el movimiento de inventario. */
export async function createPurchase(input: PurchaseInput): Promise<Payable> {
  return apiPost<Payable>("/api/payables/purchase", input);
}

/** Edita una compra existente: reemplaza sus items, revirtiendo y
 * reaplicando el stock correspondiente en el backend. */
export async function updatePurchase(id: string, input: PurchaseInput): Promise<Payable> {
  return apiPut<Payable>(`/api/payables/purchase/${id}`, input);
}

/** Elimina una compra (cuenta por pagar): revierte el stock aportado por
 * sus items y borra los pagos asociados. */
export async function deletePurchase(id: string): Promise<void> {
  return apiDelete<void>(`/api/payables/${id}`);
}

/** Registra un gasto (cuenta por pagar sin productos asociados). */
export async function createExpense(input: PayableInput): Promise<Payable> {
  return apiPost<Payable>("/api/payables", input);
}

/** Edita una cuenta por pagar sin productos asociados (si tiene productos,
 * es una compra y debe editarse con updatePurchase). */
export async function updatePayable(id: string, input: PayableInput): Promise<Payable> {
  return apiPut<Payable>(`/api/payables/${id}`, input);
}

/** Elimina un gasto o cualquier cuenta por pagar. */
export async function deleteExpense(id: string): Promise<void> {
  return apiDelete<void>(`/api/payables/${id}`);
}

/** Registra un abono (a una venta fiada o a una cuenta por pagar). */
export async function registerPayment(input: {
  kind: "receivable" | "payable";
  sale_id?: string;
  payable_id?: string;
  amount: number;
  notes?: string;
}): Promise<Receivable | Payable> {
  if (input.kind === "receivable") {
    if (!input.sale_id) throw new Error("sale_id es obligatorio para abonos a cuentas por cobrar");
    return apiPost<Receivable>("/api/receivables/pay", { sale_id: input.sale_id, amount: input.amount });
  }
  if (!input.payable_id) throw new Error("payable_id es obligatorio para abonos a cuentas por pagar");
  return apiPost<Payable>("/api/payables/pay", { payable_id: input.payable_id, amount: input.amount });
}

/** Abono a la deuda total de un cliente: se aplica a sus ventas fiadas más
 * antiguas primero y el excedente queda como saldo a favor. */
export async function payCustomer(input: { customer_id: string; amount: number }): Promise<{
  applied: number;
  credit_added: number;
  credit_balance: number;
}> {
  return apiPost("/api/receivables/pay-customer", input);
}

/** Ajuste manual de stock. */
export async function adjustStock(input: StockAdjustmentInput): Promise<Product> {
  return apiPost<Product>("/api/inventory/adjust", input);
}
