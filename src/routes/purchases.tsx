import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { Product, Supplier } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Search, ShoppingBasket, X } from "lucide-react";
import { money } from "@/lib/format";
import { createPurchase } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Compras — Multimarket" },
      { name: "description", content: "Registrar facturas de compra a proveedores y actualizar inventario." },
      { property: "og:title", content: "Compras — Multimarket" },
      { property: "og:description", content: "Registrar facturas de compra a proveedores y actualizar inventario." },
    ],
  }),
  component: Purchases,
});

type CartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  stock: number;
};

function Purchases() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [newProduct, setNewProduct] = useState<{ name: string; price: string } | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [newSupplier, setNewSupplier] = useState<{ name: string; phone: string } | null>(null);

  const [concept, setConcept] = useState("Compra de mercancía");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiGet<Supplier[]>("/api/suppliers"),
  });

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, products]);

  const supplierResults = useMemo(() => {
    if (!supplierQuery.trim()) return [];
    const q = supplierQuery.toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone ?? "").toLowerCase().includes(q),
    ).slice(0, 6);
  }, [supplierQuery, suppliers]);

  const addToCart = (p: Product) => {
    setCart((c) => {
      const idx = c.findIndex((i) => i.product_id === p.id);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...c, {
        product_id: p.id, product_name: p.name,
        quantity: 1, unit_cost: Number(p.cost), stock: Number(p.stock),
      }];
    });
    setQuery("");
  };

  const createProduct = useMutation({
    mutationFn: async () => {
      if (!newProduct) return null;
      if (!newProduct.name.trim()) throw new Error("El nombre es obligatorio.");
      return apiPost<Product>("/api/products", {
        name: newProduct.name.trim(),
        price: Number(newProduct.price) || 0,
        cost: 0,
        stock: 0,
      });
    },
    onSuccess: (product) => {
      if (!product) return;
      addToCart(product);
      setNewProduct(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto creado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const save = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Agrega al menos un producto.");
      if (!concept.trim()) throw new Error("El concepto es obligatorio.");
      await createPurchase({
        supplier_id: selectedSupplier?.id ?? null,
        supplier_name: selectedSupplier?.name ?? null,
        concept,
        due_date: dueDate || null,
        notes: notes || null,
        items: cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Compra registrada");
      setCart([]); setNotes(""); setDueDate(""); setConcept("Compra de mercancía");
      setSelectedSupplier(null); setSupplierQuery("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
        <p className="text-sm text-muted-foreground">Registra facturas de compra a proveedores y actualiza el inventario.</p>
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
            {query.trim() && (
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
                    <div className="text-sm font-medium tabular-nums">{money(Number(p.cost))}</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewProduct({ name: query.trim(), price: "" })}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm text-primary"
                >
                  <Plus className="h-3 w-3 inline mr-1" /> Crear producto "{query.trim()}"
                </button>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBasket className="h-4 w-4" />
                <span className="font-medium">Productos comprados ({cart.length})</span>
              </div>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Busca un producto para empezar.</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((i, idx) => (
                    <div key={i.product_id} className="grid grid-cols-[1fr_auto] gap-2 items-start sm:grid-cols-[1fr_80px_100px_40px_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{i.product_name}</div>
                        <div className="text-xs text-muted-foreground">Stock actual: {i.stock}</div>
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
                          type="number" min="0" step="0.01" value={i.unit_cost}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setCart((c) => c.map((it, k) => k === idx ? { ...it, unit_cost: v } : it));
                          }}
                          className="h-8"
                        />
                        <div className="text-right text-sm font-medium tabular-nums self-center">
                          {money(i.quantity * i.unit_cost)}
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
          <CardHeader><CardTitle>Confirmar compra</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Proveedor</Label>
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
                  <Input
                    placeholder="Buscar o escribir proveedor nuevo…"
                    value={supplierQuery}
                    onChange={(e) => setSupplierQuery(e.target.value)}
                    className="mt-1"
                  />
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
            <div><Label>Concepto</Label><Input value={concept} onChange={(e) => setConcept(e.target.value)} /></div>
            <div><Label>Fecha de vencimiento (opcional)</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><Label>Notas (opcional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums">{money(total)}</span>
            </div>
            <Button className="w-full" size="lg" disabled={save.isPending || cart.length === 0} onClick={() => save.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> {save.isPending ? "Guardando…" : "Registrar compra"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Aumenta el stock de cada producto y genera una cuenta por pagar al proveedor.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!newProduct} onOpenChange={(o) => !o && setNewProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo producto</DialogTitle></DialogHeader>
          {newProduct && (
            <div className="grid gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <Label>Precio de venta (opcional)</Label>
                <Input
                  type="number" step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El costo se completa automáticamente con el precio unitario que ingreses en la compra.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProduct(null)}>Cancelar</Button>
            <Button onClick={() => createProduct.mutate()} disabled={createProduct.isPending}>
              {createProduct.isPending ? "Creando…" : "Crear y agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
