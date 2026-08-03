const API_URL = import.meta.env.VITE_API_URL || process.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // respuesta sin cuerpo JSON, usar statusText
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPut = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined });

// --- Tipos (reflejan los schemas Pydantic de multimarket-backend/app/schemas) ---

export type Product = {
  id: string;
  name: string;
  cost: number;
  price: number;
  stock: number;
  low_stock_threshold: number;
  unit: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  code?: string | null;
  name: string;
  cost?: number;
  price?: number;
  low_stock_threshold?: number;
  unit?: string;
  active?: boolean;
  notes?: string | null;
  stock?: number;
};

export type Agg = { total: number; owed: number; count: number };

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  agg: Agg;
};

export type CustomerInput = { name: string; phone?: string | null; notes?: string | null };

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  agg: Agg;
};

export type SupplierInput = { name: string; phone?: string | null; notes?: string | null };

export type SaleItemInput = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

export type SaleInput = {
  customer_id: string | null;
  customer_name: string | null;
  status: "paid" | "credit";
  notes?: string | null;
  items: SaleItemInput[];
};

export type SaleItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
};

export type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
};

export type Sale = {
  id: string;
  sale_date: string;
  customer_id: string | null;
  customer_name: string | null;
  total: number;
  cost_total: number;
  status: "paid" | "credit";
  amount_paid: number;
  notes: string | null;
  items: SaleItem[];
  payments: Payment[];
};

export type Receivable = {
  id: string;
  sale_date: string;
  customer_id: string | null;
  customer_name: string | null;
  total: number;
  amount_paid: number;
  balance: number;
  days_old: number;
};

export type PurchaseItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
};

export type Payable = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  concept: string;
  amount: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  issue_date: string;
  days_old: number;
  overdue: boolean;
  payments: Payment[];
  items: PurchaseItem[];
};

export type PayableInput = {
  supplier_id?: string | null;
  supplier_name?: string | null;
  concept: string;
  amount: number;
  due_date?: string | null;
  notes?: string | null;
};

export type PurchaseItemInput = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
};

export type PurchaseInput = {
  supplier_id: string | null;
  supplier_name: string | null;
  concept: string;
  due_date?: string | null;
  notes?: string | null;
  items: PurchaseItemInput[];
};

export type PaymentInput = { amount: number };

export type InventoryMovement = {
  id: string;
  product_id: string;
  movement_type: "sale" | "purchase" | "adjustment" | "initial";
  quantity_change: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
};

export type StockAdjustmentInput = { product_id: string; new_stock: number; notes?: string | null };

export type TopProduct = {
  product_id: string | null;
  product_name: string;
  revenue: number;
  profit: number;
  quantity: number;
};

export type LowStockProduct = { id: string; name: string; stock: number; low_stock_threshold: number };

export type Dashboard = {
  day_total: number;
  week_total: number;
  month_total: number;
  month_profit: number;
  top_products: TopProduct[];
  low_stock: LowStockProduct[];
  open_receivables: number;
  customer_count: number;
};

export type Reports = {
  total_sales: number;
  total_cost: number;
  total_profit: number;
  top_by_revenue: TopProduct[];
  top_by_profit: TopProduct[];
};
