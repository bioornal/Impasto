# Bajar el egress de InsForge — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el panel, la web y el POS dejen de releer la base completa a cada rato, para quedar muy por debajo de los 5 GB de egress del plan free.

**Architecture:** Columna `pedidos.updated_at` con trigger + sondeo incremental del panel (`?desde`), caché de 60 s de la carta para lo que solo se muestra (con tope de 5 min), y límite de 5 min para recalcular la carta en el POS. Cotización y pedidos siguen leyendo precios frescos.

**Tech Stack:** Next.js 16 (Impasto, Netlify), Next.js 15 (Carro Fogón, Vercel), InsForge SDK, `unstable_cache`/`revalidateTag`, tests con `tsx` + `node:test` (Impasto) y `node --test` (Carro Fogón).

Spec: `docs/superpowers/specs/2026-10-13-reducir-egress-design.md`.

## Global Constraints

- Cotización (`lib/order-quote.ts`), pedidos y chat siguen con `getCatalogData()` fresco: la venta se bloquea si falla una fuente de precios (A09).
- La carta mostrada nunca tiene más de 5 minutos (`CATALOGO_MAX_VIEJO_MS = 300000`); se renueva cada 60 s (tag `catalogo`).
- POS: carta recalculada como mucho cada 5 minutos (`CARTA_MAX_VIEJA_MS = 300000`).
- Panel: sondeo cada 15 s, solapamiento de 60 s (`SOLAPE_MS = 60000`), recarga completa cada 40 sondeos (`POLLS_ENTRE_RECARGAS = 40`). Sin `updated_at` en las filas, el panel sigue con la lista completa.
- Migración antes del deploy de Impasto. No usar `db query` para DDL (lo descarta en silencio): `npx -y @insforge/cli db migrations up --all`.
- No tocar `CLAUDE.md`/`AGENTS.md` ajenos: commitear solo archivos propios.

---

### Task 1: Columna `updated_at` y unión de pedidos

**Files:**
- Create: `migrations/20261013200000_pedidos-updated-at.sql`
- Create: `lib/pedidos-incrementales.ts`
- Test: `tests/pedidos-incrementales.test.ts`
- Modify: `package.json` (script `test`: agregar `&& tsx tests/pedidos-incrementales.test.ts`)

**Interfaces:**
- Produces: `POLLS_ENTRE_RECARGAS = 40`, `SOLAPE_MS = 60000`, `cursorDePedidos(filas: ReadonlyArray<Record<string, unknown>>, anterior: string | null): string | null`, `desdeParaConsulta(cursor: string, solapeMs?: number): string`, `unirPedidos<T extends { _dbId: string; fecha: string }>(actuales: readonly T[], cambios: readonly T[]): T[]`.

- [ ] **Step 1: Migración**

```sql
-- Hora de la última modificación de cada pedido. El panel sondea solo lo que
-- cambió desde la última vez (antes bajaba todo el historial cada 15 s y eso
-- agotó el egress del plan free el 12/10/2026). La pone la base, así cubre la
-- web, el POS, el webhook de Mercado Pago y cualquier SQL.
alter table public.pedidos add column if not exists updated_at timestamptz not null default now();

create or replace function public.pedidos_marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists pedidos_marcar_actualizado on public.pedidos;
create trigger pedidos_marcar_actualizado
  before update on public.pedidos
  for each row execute function public.pedidos_marcar_actualizado();

create index if not exists pedidos_proyecto_updated_at_idx on public.pedidos (proyecto_id, updated_at);
```

- [ ] **Step 2: Test que falla**

```ts
// tests/pedidos-incrementales.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cursorDePedidos, desdeParaConsulta, unirPedidos, SOLAPE_MS } from '../lib/pedidos-incrementales';

test('el cursor es el updated_at más nuevo, y conserva el anterior si no llega nada más nuevo', () => {
  const filas = [{ updated_at: '2026-10-13T20:00:00.123456+00:00' }, { updated_at: '2026-10-13T20:05:00+00:00' }, { updated_at: null }];
  assert.equal(cursorDePedidos(filas, null), '2026-10-13T20:05:00.000Z');
  assert.equal(cursorDePedidos([], '2026-10-13T20:05:00.000Z'), '2026-10-13T20:05:00.000Z');
  assert.equal(cursorDePedidos([{ updated_at: '2026-10-13T19:00:00Z' }], '2026-10-13T20:05:00.000Z'), '2026-10-13T20:05:00.000Z');
});

test('sin updated_at en las filas (migración sin correr) el cursor queda nulo', () => {
  assert.equal(cursorDePedidos([{ id: 'a' }, { id: 'b' }], null), null);
});

test('la consulta pide desde un minuto antes del cursor', () => {
  assert.equal(SOLAPE_MS, 60000);
  assert.equal(desdeParaConsulta('2026-10-13T20:05:00.000Z'), '2026-10-13T20:04:00.000Z');
});

test('unir reemplaza por _dbId, agrega los nuevos y ordena como el servidor', () => {
  const a = { _dbId: 'a', fecha: '2026-10-13T19:00:00Z', estado: 'nuevo' };
  const b = { _dbId: 'b', fecha: '2026-10-13T20:00:00Z', estado: 'nuevo' };
  const bListo = { ...b, estado: 'entregado' };
  const c = { _dbId: 'c', fecha: '2026-10-13T21:00:00Z', estado: 'nuevo' };
  const d = { _dbId: 'd', fecha: '2026-10-13T21:00:00Z', estado: 'nuevo' };
  assert.deepEqual(unirPedidos([b, a], [bListo, d, c]).map((p) => `${p._dbId}:${p.estado}`), ['c:nuevo', 'd:nuevo', 'b:entregado', 'a:nuevo']);
  const actuales = [b, a];
  assert.equal(unirPedidos(actuales, []), actuales);
});
```

- [ ] **Step 3: Correr y ver que falla** — `npx tsx tests/pedidos-incrementales.test.ts` → falla (no existe el módulo).

- [ ] **Step 4: Implementar**

```ts
// lib/pedidos-incrementales.ts
// Sondeo del panel: trae solo los pedidos que cambiaron desde el último
// `updated_at` visto (migración 20261013200000). Ver el spec del 13/10/2026.

/** 40 sondeos de 15 s = cada 10 minutos la lista completa, que reconcilia pedidos eliminados desde otro dispositivo. */
export const POLLS_ENTRE_RECARGAS = 40;

/** `now()` es la hora de inicio de la transacción: una que confirma tarde puede quedar detrás del cursor. */
export const SOLAPE_MS = 60_000;

export function cursorDePedidos(filas: ReadonlyArray<Record<string, unknown>>, anterior: string | null): string | null {
  let max = anterior ? Date.parse(anterior) : NaN;
  for (const fila of filas) {
    const t = typeof fila.updated_at === 'string' ? Date.parse(fila.updated_at) : NaN;
    if (Number.isFinite(t) && (!Number.isFinite(max) || t > max)) max = t;
  }
  return Number.isFinite(max) ? new Date(max).toISOString() : null;
}

export function desdeParaConsulta(cursor: string, solapeMs = SOLAPE_MS): string {
  return new Date(Date.parse(cursor) - solapeMs).toISOString();
}

/** Reemplaza por `_dbId` y ordena como el servidor: más nuevos primero, desempate por id. */
export function unirPedidos<T extends { _dbId: string; fecha: string }>(actuales: readonly T[], cambios: readonly T[]): T[] {
  if (cambios.length === 0) return actuales as T[];
  const porId = new Map(actuales.map((p) => [p._dbId, p]));
  for (const p of cambios) porId.set(p._dbId, p);
  return [...porId.values()].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha) || a._dbId.localeCompare(b._dbId));
}
```

- [ ] **Step 5: Correr y ver que pasa** — `npx tsx tests/pedidos-incrementales.test.ts` → 4 tests pass. Agregar el test al script `test`.

- [ ] **Step 6: Commit** — `git add migrations/20261013200000_pedidos-updated-at.sql lib/pedidos-incrementales.ts tests/pedidos-incrementales.test.ts package.json && git commit -m "feat(panel): updated_at en pedidos y unión incremental"`

### Task 2: Ruta `?desde` y sondeo incremental del panel

**Files:**
- Modify: `app/api/admin/pedidos/route.ts`
- Modify: `app/admin/components/StoreProvider.tsx` (`loadAll`, `load`, el `setInterval`)

**Interfaces:**
- Consumes: Task 1.

- [ ] **Step 1: Ruta**

```ts
import { readPages } from "@/lib/read-pages";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";

// Sin `desde`: todo el historial (carga inicial y reconciliación cada 10 min).
// Con `desde`: solo lo que cambió desde esa hora (el sondeo de cada 15 s).
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const desde = req.nextUrl.searchParams.get("desde");
  if (desde !== null && !Number.isFinite(Date.parse(desde))) {
    return NextResponse.json({ ok: false, error: "Parámetro desde inválido" }, { status: 400 });
  }
  const { data, error } = await readPages((start, end) => {
    let query = db.database
      .from("pedidos")
      .select("*")
      .eq("proyecto_id", "impasto")
      .eq("sucursal_id", SUCURSAL_ID);
    if (desde !== null) query = query.gte("updated_at", new Date(desde).toISOString());
    return query.order("created_at", { ascending: false }).order("id", { ascending: true }).range(start, end);
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
```

- [ ] **Step 2: Panel**
  - `loadAll` devuelve además `ordersCursor: cursorDePedidos(pedRes.data || [], null)` (y el tipo de retorno lo declara).
  - `load()`: `const { ordersCursor, ...data } = await loadAll();` → `cursorRef.current = ordersCursor; pollsRef.current = 0;` y `setState({ loading: false, error: null, ...data })`.
  - Nuevos refs: `const cursorRef = useRef<string | null>(null); const pollsRef = useRef(0);`
  - El intervalo:

```ts
const timer = setInterval(async () => {
  try {
    pollsRef.current += 1;
    const cursor = cursorRef.current;
    let completa = cursor === null || pollsRef.current >= POLLS_ENTRE_RECARGAS;
    let res = await fetch(completa ? "/api/admin/pedidos" : `/api/admin/pedidos?desde=${encodeURIComponent(desdeParaConsulta(cursor!))}`);
    if (!res.ok && res.status !== 401 && !completa) {
      // Sin la columna (migración pendiente) o un error puntual: la lista completa de siempre.
      res = await fetch("/api/admin/pedidos");
      completa = true;
    }
    if (!res.ok) {
      if (res.status === 401) {
        setState(s => ({ ...s, error: "Sesión vencida — por favor volvé a iniciar sesión para seguir recibiendo pedidos" }));
      }
      return;
    }
    const j = await res.json();
    if (!j.ok || !Array.isArray(j.data)) return;

    const filas = j.data as Record<string, unknown>[];
    const recibidos: AdminOrder[] = filas.map(adaptOrder);
    const prevIds = knownOrderIdsRef.current;

    if (!isInitialLoadRef.current) {
      const freshOrders = pedidosNuevosParaCocina(prevIds, recibidos);
      if (freshOrders.length > 0) {
        if (soundEnabledRef.current) playKitchenChime();
        showToast(`🔔 ¡${freshOrders.length} nuevo(s) pedido(s) recibido(s)!`);
      }
    }

    knownOrderIdsRef.current = registrarPedidosConocidosParaCocina(prevIds, recibidos);
    cursorRef.current = cursorDePedidos(filas, completa ? null : cursor);
    if (completa) pollsRef.current = 0;
    setState(s => ({ ...s, orders: completa ? recibidos : unirPedidos(s.orders, recibidos) }));
  } catch {
    // Silently ignore polling hiccups
  }
}, 15000);
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` sin errores nuevos; `pnpm exec eslint app/api/admin/pedidos/route.ts app/admin/components/StoreProvider.tsx lib/pedidos-incrementales.ts`.
- [ ] **Step 4: Commit** — `feat(panel): sondeo incremental de pedidos`.

### Task 3: Carta en caché para lo que solo se muestra

**Files:**
- Create: `lib/catalog-vigencia.ts`, `lib/catalog-cache.ts`
- Test: `tests/catalog-vigencia.test.ts` (y al script `test`)
- Modify: `app/page.tsx`, `app/manifest.ts`, `app/opengraph-image.tsx`, `app/llms.txt/route.ts`, `app/api/productos/route.ts` (`getCatalogData` → `getCatalogDataVisible`)
- Modify (invalidar): `app/api/admin/productos/route.ts` (POST), `app/api/admin/productos/[id]/route.ts` (PUT, DELETE), `app/api/admin/productos/[id]/foto/route.ts`, `app/api/admin/etiquetas/route.ts` (POST), `app/api/admin/etiquetas/[id]/route.ts` (PUT, DELETE), `app/api/admin/testimonios/[id]/route.ts` (PUT, DELETE)

**Interfaces:**
- Produces: `CATALOGO_MAX_VIEJO_MS = 300000`, `catalogoVigente(leidoAt: number, ahora: number, maxMs?: number): boolean`, `getCatalogDataVisible(): Promise<CatalogData>`, `invalidarCatalogo(): void`.

- [ ] **Step 1: Test que falla**

```ts
// tests/catalog-vigencia.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogoVigente, CATALOGO_MAX_VIEJO_MS } from '../lib/catalog-vigencia';

test('la carta guardada sirve hasta 5 minutos', () => {
  const t = Date.parse('2026-10-13T20:00:00Z');
  assert.equal(CATALOGO_MAX_VIEJO_MS, 300000);
  assert.equal(catalogoVigente(t, t + 60_000), true);
  assert.equal(catalogoVigente(t, t + 300_000), true);
  assert.equal(catalogoVigente(t, t + 300_001), false);
  assert.equal(catalogoVigente(t, t - 1_000), true);
  assert.equal(catalogoVigente(Number.NaN, t), false);
});
```

- [ ] **Step 2: Implementar**

```ts
// lib/catalog-vigencia.ts
/** La carta que se muestra puede venir del caché hasta 5 minutos; más vieja, se vuelve a leer (y si la base no responde, error como siempre). */
export const CATALOGO_MAX_VIEJO_MS = 5 * 60_000;

export function catalogoVigente(leidoAt: number, ahora: number, maxMs = CATALOGO_MAX_VIEJO_MS): boolean {
  return Number.isFinite(leidoAt) && Math.abs(ahora - leidoAt) <= maxMs;
}
```

```ts
// lib/catalog-cache.ts
import { revalidateTag, unstable_cache } from "next/cache";
import { getCatalogData } from "@/lib/catalog";
import { catalogoVigente } from "@/lib/catalog-vigencia";
import type { CatalogData } from "@/types";

// Una lectura de las 12 tablas por minuto en vez de una por visita (egress, 13/10/2026).
const leer = unstable_cache(
  async () => ({ datos: await getCatalogData(), leidoAt: Date.now() }),
  ["catalogo-visible"],
  { revalidate: 60, tags: ["catalogo"] },
);

/**
 * Carta para mostrar: home, manifest, imagen para compartir, llms.txt y /api/productos.
 * La cotización y el pedido usan `getCatalogData()` fresco: la venta se sigue
 * bloqueando si falla una fuente de precios. El caché serializa a JSON: el
 * costeo (WeakMap) no viaja, y nada de lo que se muestra lo usa.
 */
export async function getCatalogDataVisible(): Promise<CatalogData> {
  const { datos, leidoAt } = await leer();
  return catalogoVigente(leidoAt, Date.now()) ? datos : getCatalogData();
}

/** Después de cambiar productos, etiquetas u opiniones desde el panel: el dueño ve su cambio al instante. */
export function invalidarCatalogo() {
  revalidateTag("catalogo", { expire: 0 });
}
```

- [ ] **Step 3: Consumidores** — en los cinco archivos, `import { getCatalogDataVisible } from "@/lib/catalog-cache"` y reemplazar la llamada. En `app/page.tsx`: `const catalogoActual = cache(getCatalogDataVisible);` y actualizar el comentario de `force-dynamic` ("los precios se reflejan en menos de un minuto"). Verificar que ninguno use el costeo (`grep -n costeo`).
- [ ] **Step 4: Invalidar** — `invalidarCatalogo();` justo antes de cada `return NextResponse.json({ ok: true ... })` de las mutaciones listadas (en la foto, junto al `revalidateTag("fotos", …)`).
- [ ] **Step 5: Verificar** — `npx tsx tests/catalog-vigencia.test.ts`, `npx tsc --noEmit`, eslint de lo tocado.
- [ ] **Step 6: Commit** — `feat(web): carta en caché de un minuto para lo que solo se muestra`.

### Task 4: POS — carta como mucho cada 5 minutos (repo `carroFogon/next-app`)

**Files:**
- Create: `src/lib/carta-refresco.ts`
- Test: `tests/carta-refresco.test.ts` (y al script `test`)
- Modify: `src/store/useStore.ts` (`productosCargadosAt`, `productosOmitidos`, sin persistir), `src/components/Cards.tsx`

**Interfaces:**
- Produces: `CARTA_MAX_VIEJA_MS = 300000`, `debeRecargarCarta(cargadaAt: number | null, ahora: number, maxMs?: number): boolean`.

- [ ] **Step 1: Test que falla**

```ts
// tests/carta-refresco.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { debeRecargarCarta, CARTA_MAX_VIEJA_MS } from '../src/lib/carta-refresco.ts';

test('recarga sin carta, o con una de más de 5 minutos', () => {
  const t = Date.parse('2026-10-13T20:00:00Z');
  assert.equal(CARTA_MAX_VIEJA_MS, 300000);
  assert.equal(debeRecargarCarta(null, t), true);
  assert.equal(debeRecargarCarta(t, t + 60_000), false);
  assert.equal(debeRecargarCarta(t, t + 300_001), true);
  assert.equal(debeRecargarCarta(t + 10_000, t), false);
});
```

- [ ] **Step 2: Implementar**

```ts
// src/lib/carta-refresco.ts
/** El POS recalcula la carta (8 tablas de costos) como mucho cada 5 minutos (decisión del dueño, 13/10/2026, para bajar el egress). El POST sigue validando precios frescos. */
export const CARTA_MAX_VIEJA_MS = 5 * 60_000;

export function debeRecargarCarta(cargadaAt: number | null, ahora: number, maxMs = CARTA_MAX_VIEJA_MS): boolean {
  return cargadaAt === null || !(Math.abs(ahora - cargadaAt) <= maxMs);
}
```

- [ ] **Step 3: Store y Cards** — el store suma `productosCargadosAt: number | null` y `productosOmitidos: number` con `marcarCartaCargada(at: number | null, omitidos: number)`; `partialize` no los persiste. En `Cards`, `cargar(forzar = false)`: si `!forzar`, hay productos y `!debeRecargarCarta(productosCargadosAt, Date.now())`, usa los del store (`setOmitidos(productosOmitidos)`, `setLoaded(true)`) y no llama a la API. Al cargar bien, `marcarCartaCargada(Date.now(), omitidos)`; al fallar, `marcarCartaCargada(null, 0)`. El botón de reintento (si existe) llama `cargar(true)`.
- [ ] **Step 4: Verificar** — `npm test`, `npm run build`, eslint de lo tocado.
- [ ] **Step 5: Commit** — `feat(pos): recalcular la carta como mucho cada 5 minutos`.

### Task 5: Verificación completa y documentación

- [ ] Impasto: `pnpm test`, `npx tsc --noEmit`, `pnpm exec eslint` de lo tocado, `pnpm build`.
- [ ] Carro Fogón: `npm test`, `npm run build`.
- [ ] `CLAUDE.md` de cada repo: sección "Egress" con qué cambió, el orden migración → deploy y lo que falta verificar con la base de vuelta (sondeo con `?desde`, egress diario antes/después, fotos).
