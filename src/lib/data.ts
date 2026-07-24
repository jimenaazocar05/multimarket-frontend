import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Customer = Tables<"customers">;
export type Supplier = Tables<"suppliers">;
export type Sale = Tables<"sales">;
export type SaleItem = Tables<"sale_items">;
export type Payable = Tables<"payables">;
export type Payment = Tables<"payments">;
export type InventoryMovement = Tables<"inventory_movements">;

/** Register a sale with items, decrement stock, log movements. */
export async function createSale(input: {
  customer_id: string | null;
  customer_name: string | null;
  status: "paid" | "credit";
  notes?: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
  }>;
}) {
  const total = input.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const cost_total = input.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      status: input.status,
      total,
      cost_total,
      amount_paid: input.status === "paid" ? total : 0,
      notes: input.notes ?? null,
    } satisfies TablesInsert<"sales">)
    .select()
    .single();
  if (error) throw error;

  const itemRows: TablesInsert<"sale_items">[] = input.items.map((i) => ({
    sale_id: sale.id,
    product_id: i.product_id,
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost,
    subtotal: i.quantity * i.unit_price,
  }));
  const { error: ie } = await supabase.from("sale_items").insert(itemRows);
  if (ie) throw ie;

  // Decrement stock and record movements
  for (const i of input.items) {
    const { data: p } = await supabase
      .from("products")
      .select("stock")
      .eq("id", i.product_id)
      .single();
    if (p) {
      await supabase
        .from("products")
        .update({ stock: Number(p.stock) - i.quantity })
        .eq("id", i.product_id);
    }
    await supabase.from("inventory_movements").insert({
      product_id: i.product_id,
      movement_type: "sale",
      quantity_change: -i.quantity,
      reference_id: sale.id,
      notes: `Venta #${sale.id.slice(0, 8)}`,
    });
  }
  return sale;
}

/** Register a payment (abono) to a credit sale or a payable. */
export async function registerPayment(input: {
  kind: "receivable" | "payable";
  sale_id?: string;
  payable_id?: string;
  amount: number;
  notes?: string;
}) {
  const { error } = await supabase.from("payments").insert({
    kind: input.kind,
    sale_id: input.sale_id ?? null,
    payable_id: input.payable_id ?? null,
    amount: input.amount,
    notes: input.notes ?? null,
  });
  if (error) throw error;

  if (input.kind === "receivable" && input.sale_id) {
    const { data: s } = await supabase
      .from("sales")
      .select("amount_paid,total")
      .eq("id", input.sale_id)
      .single();
    if (s) {
      const newPaid = Number(s.amount_paid) + input.amount;
      await supabase
        .from("sales")
        .update({
          amount_paid: newPaid,
          status: newPaid >= Number(s.total) ? "paid" : "credit",
        })
        .eq("id", input.sale_id);
    }
  } else if (input.kind === "payable" && input.payable_id) {
    const { data: p } = await supabase
      .from("payables")
      .select("amount_paid")
      .eq("id", input.payable_id)
      .single();
    if (p) {
      await supabase
        .from("payables")
        .update({ amount_paid: Number(p.amount_paid) + input.amount })
        .eq("id", input.payable_id);
    }
  }
}

/** Manual stock adjustment. */
export async function adjustStock(input: {
  product_id: string;
  new_stock: number;
  notes?: string;
}) {
  const { data: p } = await supabase
    .from("products")
    .select("stock")
    .eq("id", input.product_id)
    .single();
  if (!p) return;
  const change = input.new_stock - Number(p.stock);
  await supabase
    .from("products")
    .update({ stock: input.new_stock })
    .eq("id", input.product_id);
  await supabase.from("inventory_movements").insert({
    product_id: input.product_id,
    movement_type: "adjustment",
    quantity_change: change,
    notes: input.notes ?? "Ajuste manual",
  });
}
