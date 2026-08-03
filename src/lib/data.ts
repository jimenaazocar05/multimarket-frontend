import { apiPost } from "@/lib/api";
import type { Payable, Receivable, Sale, SaleInput, StockAdjustmentInput, Product, PurchaseInput } from "@/lib/api";

export type { Product, Customer, Supplier, Sale, SaleItem, Payable, InventoryMovement } from "@/lib/api";

/** Registra una venta: el backend crea la venta + items, descuenta stock y
 * registra el movimiento de inventario en una sola transaccion. */
export async function createSale(input: SaleInput): Promise<Sale> {
  return apiPost<Sale>("/api/sales", input);
}

/** Registra una compra a proveedor: el backend crea la cuenta por pagar,
 * aumenta el stock de cada producto y registra el movimiento de inventario. */
export async function createPurchase(input: PurchaseInput): Promise<Payable> {
  return apiPost<Payable>("/api/payables/purchase", input);
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

/** Ajuste manual de stock. */
export async function adjustStock(input: StockAdjustmentInput): Promise<Product> {
  return apiPost<Product>("/api/inventory/adjust", input);
}
