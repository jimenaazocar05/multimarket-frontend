import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { Product, Customer } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Search, ShoppingCart, X } from "lucide-react";
import { money } from "@/lib/format";
import { createSale } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Punto de venta — Multimarket" },
      { name: "description", content: "Registrar ventas rápidamente y actualizar inventario." },
      { property: "og:title", content: "Punto de venta — Multimarket" },
      { property: "og:description", content: "Registrar ventas rápidamente y actualizar inventario." },
    ],
  }),
  component: POS,
});

type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  stock: number;
};

function POS() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [status, setStatus] = useState<"paid" | "credit">("paid");
  const [notes, setNotes] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: () => apiGet<Product[]>("/api/products?active=true"),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/api/customers"),
  });

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, products]);

  const customerResults = useMemo(() => {
    if (!customerQuery.trim()) return [];
    const q = customerQuery.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q),
    ).slice(0, 6);
  }, [customerQuery, customers]);

  const createCustomer = useMutation({
    mutationFn: async () => {
      if (!newCustomer) return null;
      if (!newCustomer.name.trim()) throw new Error("El nombre es obligatorio.");
      return apiPost<Customer>("/api/customers", { name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || null });
    },
    onSuccess: (customer) => {
      if (!customer) return;
      setSelectedCustomer(customer);
      setNewCustomer(null);
      setCustomerQuery("");
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToCart = (p: typeof products[number]) => {
    setCart((c) => {
      const idx = c.findIndex((i) => i.product_id === p.id);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...c, {
        product_id: p.id, product_name: p.name,
        quantity: 1, unit_price: Number(p.price), unit_cost: Number(p.cost), stock: Number(p.stock),
      }];
    });
    setQuery("");
  };

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const save = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Agrega al menos un producto.");
      if (status === "credit" && !selectedCustomer) throw new Error("Elige un cliente para ventas fiadas.");
      await createSale({
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer?.name ?? null,
        status,
        notes: notes || null,
        items: cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: i.unit_cost,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Venta registrada");
      setCart([]); setNotes(""); setStatus("paid"); setSelectedCustomer(null); setCustomerQuery("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Punto de venta</h1>
        <p className="text-sm text-muted-foreground">Busca productos, arma el carrito y confirma la venta.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" /> Buscar producto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              autoFocus
              placeholder="Nombre o código…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <div className="border rounded-md divide-y max-h-72 overflow-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Stock: {Number(p.stock)} {p.unit}
                      </div>
                    </div>
                    <div className="text-sm font-medium tabular-nums">{money(Number(p.price))}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-medium">Carrito ({cart.length})</span>
              </div>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Busca un producto para empezar.</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((i, idx) => (
                    <div key={i.product_id} className="grid grid-cols-[1fr_auto] gap-2 items-start sm:grid-cols-[1fr_80px_100px_40px_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{i.product_name}</div>
                        <div className="text-xs text-muted-foreground">Stock: {i.stock}</div>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 sm:order-last"
                        onClick={() => setCart((c) => c.filter((_, k) => k !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="col-span-2 grid grid-cols-3 gap-2 sm:contents">
                        <Input
                          type="number" min="0" step="0.5" value={i.quantity}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setCart((c) => c.map((it, k) => k === idx ? { ...it, quantity: v } : it));
                          }}
                          className="h-8"
                        />
                        <Input
                          type="number" min="0" step="0.01" value={i.unit_price}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setCart((c) => c.map((it, k) => k === idx ? { ...it, unit_price: v } : it));
                          }}
                          className="h-8"
                        />
                        <div className="text-right text-sm font-medium tabular-nums self-center">
                          {money(i.quantity * i.unit_price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Confirmar venta</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-1">
                  <div>
                    <div className="text-sm font-medium">{selectedCustomer.name}</div>
                    {selectedCustomer.phone && <div className="text-xs text-muted-foreground">{selectedCustomer.phone}</div>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCustomer(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Venta de mostrador (buscar o escribir cliente nuevo)…"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    className="mt-1"
                  />
                  {customerQuery.trim() && (
                    <div className="border rounded-md divide-y max-h-48 overflow-auto mt-1">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCustomer(c); setCustomerQuery(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        >
                          <div className="font-medium">{c.name}</div>
                          {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setNewCustomer({ name: customerQuery.trim(), phone: "" })}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm text-primary"
                      >
                        <Plus className="h-3 w-3 inline mr-1" /> Crear cliente "{customerQuery.trim()}"
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <Label>Estado</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button
                  type="button" variant={status === "paid" ? "default" : "outline"}
                  onClick={() => setStatus("paid")}
                >
                  Pagado
                </Button>
                <Button
                  type="button" variant={status === "credit" ? "default" : "outline"}
                  onClick={() => setStatus("credit")}
                >
                  Fiado
                </Button>
              </div>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums">{money(total)}</span>
            </div>
            <Button className="w-full" size="lg" disabled={save.isPending || cart.length === 0} onClick={() => save.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> {save.isPending ? "Guardando…" : "Registrar venta"}
            </Button>
            {status === "credit" && (
              <Badge variant="secondary" className="w-full justify-center">Se agregará a cuentas por cobrar</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!newCustomer} onOpenChange={(o) => !o && setNewCustomer(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
          {newCustomer && (
            <div className="grid gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label>Teléfono (opcional)</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustomer(null)}>Cancelar</Button>
            <Button onClick={() => createCustomer.mutate()} disabled={createCustomer.isPending}>
              {createCustomer.isPending ? "Creando…" : "Crear y usar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
