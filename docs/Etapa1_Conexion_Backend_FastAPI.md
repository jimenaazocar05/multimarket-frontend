# Plan de implementación — Etapa 1: Conectar el frontend al backend FastAPI

**Objetivo de la etapa:** el frontend llamaba directo a Supabase (`supabase-js`) para leer y escribir cada tabla, sin pasar nunca por `multimarket-backend`. Esta etapa reemplaza esas llamadas por peticiones REST al backend FastAPI, y elimina la dependencia de Supabase del frontend por completo (datos **y** auth, ya que el backend tampoco tiene autenticación — ver `multimarket-backend/docs/Etapa7_Migracion_PostgreSQL_Local.md`).

**Requisito previo:** backend con las 9 rutas de negocio expuestas (Etapas 1-6 del backend) y, para esta etapa en particular, Etapa 7 del backend (Postgres local, sin auth) — si el backend siguiera exigiendo JWT de Supabase, esta migración no podría quitar `supabase-js` del todo.

---

## Paso 1 — Quitar la integración de Supabase ✅ Hecho

- `@supabase/supabase-js` fuera de `package.json`.
- Borrado `src/integrations/supabase/` completo (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`).
- `src/start.ts`: quitado el middleware global `attachSupabaseAuth` (ya no hay sesión de Supabase que adjuntar a las server functions).
- `.env`: quitadas las variables `SUPABASE_*`/`VITE_SUPABASE_*`; queda solo `VITE_API_URL=http://localhost:8000`.

---

## Paso 2 — Cliente HTTP y tipos (`src/lib/api.ts`) ✅ Hecho

Sin dependencias nuevas (no había `axios` en el proyecto) — un wrapper simple sobre `fetch`, sin manejo de token porque el backend no tiene auth:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(/* detail del body o statusText */);
  return res.json();
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
```

Junto al wrapper, `api.ts` define los tipos TS que reflejan los schemas Pydantic reales del backend (`Product`, `Customer`+`Agg`, `Supplier`+`Agg`, `Sale`/`SaleItem`, `Receivable`, `Payable`, `InventoryMovement`, `Dashboard`, `Reports`) — reemplazan a los `Tables<"...">` que generaba Supabase y que se borraron junto con `integrations/supabase/`.

---

## Paso 3 — `src/lib/data.ts`: de pasos manuales a una llamada ✅ Hecho

Antes, `createSale`/`registerPayment`/`adjustStock` hacían varios pasos contra Supabase desde el navegador (insertar venta → insertar items → leer stock → actualizar stock → insertar movimiento — sin transacción real). Ahora cada uno es **una sola llamada** al backend, que hace todo eso transaccionalmente con row-locking:

| Función | Antes | Ahora |
|---|---|---|
| `createSale` | 4+ llamadas a Supabase en un loop | `POST /api/sales` |
| `registerPayment` | insert + select + update manuales | `POST /api/receivables/pay` o `POST /api/payables/pay` según `kind` |
| `adjustStock` | select + update + insert manuales | `POST /api/inventory/adjust` |

---

## Paso 4 — Reescribir las 8 rutas ✅ Hecho

Mismo patrón en las ocho: cada `supabase.from("...").select/insert/update(...)` se reemplazó por una llamada a `src/lib/api.ts`.

| Ruta | Cambio principal |
|---|---|
| `index.tsx` (dashboard) | 5 queries + agregación en el navegador → **una sola** `GET /api/dashboard` (ya trae los totales calculados en SQL) + `GET /api/sales` para "últimas ventas" + `GET /api/receivables` para el conteo de "por cobrar" |
| `pos.tsx` | `GET /api/products?active=true`, `GET /api/customers`; guardar vía `createSale` |
| `inventory.tsx` | CRUD vía `/api/products`, ajustes vía `POST /api/inventory/adjust`, historial vía `GET /api/inventory/movements?product_id=` |
| `customers.tsx` | `GET /api/customers` ya trae `agg.total/owed/count` calculado en el servidor — **se eliminó** la query separada que agregaba las ventas en el navegador; el detalle de compras usa `GET /api/customers/{id}/sales` |
| `suppliers.tsx` | mismo patrón con `/api/suppliers` (también trae `agg` del servidor) |
| `receivables.tsx` | `GET /api/receivables` (balance y antigüedad ya calculados); abono vía `POST /api/receivables/pay` |
| `payables.tsx` | `GET /api/payables`, crear vía `POST /api/payables`, pagar vía `POST /api/payables/pay` |
| `reports.tsx` | agregación por rango de fechas en el navegador → `GET /api/reports?from=&to=` + `GET /api/sales?from=&to=` (solo para el conteo de ventas del período, que el reporte no expone) |

La exportación a Excel/PDF (`src/lib/export.ts`) no cambió — sigue siendo 100% client-side sobre los datos ya traídos.

---

## Paso 5 — Casos de prueba obligatorios ⏳ Pendiente de ejecutar

Nada de esto se ha corrido todavía:

1. `npm install` (o `bun install`) — no hay `node_modules` instalado con la nueva `package.json` (sin `@supabase/supabase-js`).
2. `npx tsc --noEmit` (o `npm run build`) sin errores de tipos — es la primera verificación real de que la reescritura de las 8 rutas tipa correctamente contra `src/lib/api.ts`.
3. Con el backend corriendo (`docker compose up` en `multimarket-backend`, ver su Etapa 7) y `VITE_API_URL` apuntando a él: `npm run dev` y recorrer manualmente Dashboard → POS (crear una venta) → Inventario (confirmar que el stock bajó) → Clientes/Proveedores (ver `agg`) → CxC/CxP (registrar un abono) → Reportes (filtrar por rango de fechas).
4. Confirmar que `FRONTEND_ORIGIN` en el `.env` del backend coincide con el origen real que usa Vite (CORS).
5. `grep -ri supabase src/` no debe devolver nada — ya verificado una vez, repetir tras cualquier cambio futuro.

---

## Checklist de salida de la etapa

- [x] `@supabase/supabase-js` y `src/integrations/supabase/` fuera del proyecto
- [x] `src/lib/api.ts` con cliente HTTP y tipos que reflejan los schemas del backend
- [x] `src/lib/data.ts` reescrito a una llamada por operación
- [x] Las 8 rutas migradas de `supabase.from(...)` a `src/lib/api.ts`
- [x] `.env` con `VITE_API_URL`, sin variables de Supabase
- [ ] `npm install` + typecheck/build sin errores (Paso 5.1-5.2)
- [ ] Recorrido manual de punta a punta con el backend real corriendo (Paso 5.3)

Con esto el frontend deja de depender de Supabase por completo y pasa a hablar únicamente con `multimarket-backend`.
