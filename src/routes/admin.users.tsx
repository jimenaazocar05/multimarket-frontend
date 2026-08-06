import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { AppUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableHead } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useTableSort } from "@/lib/sort";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Usuarios y roles — Multimarket" },
      { name: "description", content: "Gestión de usuarios, contraseñas y roles." },
      { property: "og:title", content: "Usuarios y roles — Multimarket" },
      { property: "og:description", content: "Gestión de usuarios, contraseñas y roles." },
    ],
  }),
  component: AdminUsers,
});

type Form = { id?: string; name: string; username: string; password: string; role: "admin" | "vendedor"; active: boolean };

const emptyForm: Form = { name: "", username: "", password: "", role: "vendedor", active: true };

function AdminUsers() {
  const { user: currentUser } = useAuth();

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-xl font-semibold">No autorizado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta sección es exclusiva para administradores.</p>
      </div>
    );
  }

  return <UsersManager currentUserId={currentUser.id} />;
}

function UsersManager({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Form | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGet<AppUser[]>("/api/users"),
  });
  const filtered = users.filter((u) => {
    const needle = q.toLowerCase();
    return u.name.toLowerCase().includes(needle) || u.username.toLowerCase().includes(needle);
  });
  const { sorted, sortKey, sortOrder, handleSort } = useTableSort(filtered, "name", "asc");

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.name.trim()) throw new Error("Nombre requerido.");
      if (!f.username.trim()) throw new Error("Usuario requerido.");
      if (!f.id && !f.password.trim()) throw new Error("Contraseña requerida.");
      if (f.id) {
        const body: Record<string, unknown> = { name: f.name, role: f.role, active: f.active };
        if (f.password.trim()) body.password = f.password;
        await apiPut(`/api/users/${f.id}`, body);
      } else {
        await apiPost("/api/users", { name: f.name, username: f.username, password: f.password, role: f.role });
      }
    },
    onSuccess: () => { toast.success("Guardado"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios y roles</h1>
          <p className="text-sm text-muted-foreground">{users.length} usuarios registrados.</p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
          <Input placeholder="Buscar por nombre o usuario…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
          <Button className="w-full sm:w-auto" onClick={() => setEditing({ ...emptyForm })}><Plus className="h-4 w-4 mr-1" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <SortableHead sortKey="name" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Nombre</SortableHead>
              <SortableHead sortKey="username" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden sm:table-cell">Usuario</SortableHead>
              <SortableHead sortKey="role" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort}>Rol</SortableHead>
              <TableHead>Estado</TableHead>
              <SortableHead sortKey="created_at" currentSort={sortKey} currentOrder={sortOrder} onSort={handleSort} className="hidden md:table-cell">Creado</SortableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{u.username}</TableCell>
                  <TableCell><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? "Admin" : "Vendedor"}</Badge></TableCell>
                  <TableCell>{u.active ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing({ id: u.id, name: u.name, username: u.username, password: "", role: u.role, active: u.active })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin usuarios.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar usuario" : "Nuevo usuario"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nombre *</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div>
                <Label>Usuario *</Label>
                <Input
                  value={editing.username}
                  disabled={!!editing.id}
                  onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                />
              </div>
              <div>
                <Label>{editing.id ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</Label>
                <Input type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
              </div>
              <div>
                <Label>Rol</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v as Form["role"] })}
                  disabled={editing.id === currentUserId}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.id && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editing.active}
                    disabled={editing.id === currentUserId}
                    onCheckedChange={(c) => setEditing({ ...editing, active: c })}
                  />
                  <Label>Usuario activo</Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
