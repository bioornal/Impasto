# Rediseño del panel de administración — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel de Impasto ordenado por momento de uso (Arranque de la noche, Pedidos compactos, Dashboard por noche, Configuración en pestañas), en estilo neutro y denso, sin que el CSS de la web lo pise.

**Architecture:** La web pública pasa a `app/(sitio)/` con su propio layout que importa `impasto.css`; el panel queda solo con `admin.css`, reescrito con tokens neutros. La lógica nueva (siguiente estado, número corto, sección inicial, métricas por noche, búsqueda) va en módulos puros de `lib/` con tests `tsx`. Un `SucursalProvider` comparte la fila de `sucursales` entre la barra superior, el Arranque y Configuración.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS plano (`app/admin/admin.css`), tests con `node:test` + `tsx`, `pnpm`.

**Spec:** `docs/superpowers/specs/2026-10-22-panel-admin-rediseno-design.md`.

## Global Constraints

- Gestor de paquetes: **`pnpm`** (nunca npm). Tests: `pnpm test` (lista explícita en `package.json` → `scripts.test`: cada test nuevo se agrega al final con `&& tsx tests/<archivo>.test.ts`).
- **Las URLs no cambian.** Ninguna ruta de API cambia. Sin migraciones de base.
- **No cambia la lógica** de pedidos, cobros, impresión ni cupos: solo dónde y cómo se muestran. Reglas que se conservan: `esPedidoParaCocina` bloquea avanzar e imprimir una tarjeta sin acreditar; `updateOrderStatus` es el único camino para cambiar estados; `useCuposNoche` guarda a los 700 ms.
- **Archivos con CRLF:** varios archivos del repo usan CRLF. Editar con la herramienta Edit (no con scripts de reemplazo); si un reemplazo por script falla en silencio, TypeScript no lo detecta. Verificar en el navegador.
- Copy en español rioplatense, de vos. Nombres de código en español como el resto del repo (`siguienteEstado`, `numeroCorto`).
- Estilo neutro (del spec, §5): fondo `#f6f7f9`, superficie `#fff`, bordes `#e3e6eb`, texto `#111827`, secundario `#6b7280`; Inter en todo; filas de tabla 40–44 px (`td` 8×12 px); tarjetas ~70 px; márgenes del contenido 16–20 px; radios 8–10 px.
- La comanda térmica (`@media print`, `.comanda-print-ticket`) no se toca.
- Eslint: correr `pnpm exec eslint <archivos tocados>` (no `pnpm lint`: analiza `.worktrees/`). Los errores previos de `react-hooks/set-state-in-effect` en `Orders.tsx` no cuentan, pero no agregar nuevos.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **No pushear** (push a `main` publica en Netlify): lo decide el dueño al final.
- Verificación en el navegador: `preview_start` con `name: "impasto-web"` (`.claude/launch.json`). El panel pide la contraseña del dueño: **la escribe él**, nunca el agente. Con la sesión abierta en el pane se puede recorrer el panel.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/(sitio)/layout.tsx` (nuevo) | Layout de la web: importa `../impasto.css` |
| `app/layout.tsx` | Layout raíz sin `impasto.css` |
| `app/(sitio)/{page.tsx,error.tsx,pedido/,terminos/,privacidad/,reembolso/,cocina/}` (movidos) | La web pública, mismas URLs |
| `lib/admin-pedidos.ts` (nuevo) | `esActivo`, `etiquetaEstado`, `siguienteEstado`, `numeroCorto`, `resumenItems` |
| `lib/inicio-admin.ts` (nuevo) | `SeccionAdmin`, `seccionInicial` |
| `lib/admin-dashboard.ts` (nuevo) | `nochesParaGrafico`, `comparacionNoche`, `masVendidas` |
| `lib/busqueda-admin.ts` (nuevo) | `buscar` |
| `app/admin/admin.css` | Sistema visual neutro y denso |
| `app/admin/layout.tsx` | Solo Inter; pasa el mail de la sesión |
| `app/admin/components/AdminSesion.tsx` (nuevo) | Contexto con el mail de la sesión |
| `app/admin/components/SucursalProvider.tsx` (nuevo) | Fila de `sucursales`, `cambiar`, `guardar` |
| `app/admin/components/Interruptor.tsx` (nuevo) | Switch accesible |
| `app/admin/components/EstadoLocal.tsx` (nuevo) | Píldoras Venta · Delivery · Masas |
| `app/admin/components/BusquedaGlobal.tsx` (nuevo) | Buscador de la barra superior |
| `app/admin/components/Topbar.tsx` (nuevo, sale de `Dashboard.tsx`) | Barra superior |
| `app/admin/components/Sidebar.tsx` | Menú agrupado, íconos, mail |
| `app/admin/page.tsx` | Secciones nuevas, sección inicial, navegación desde la búsqueda |
| `app/admin/components/Arranque.tsx` (nuevo) | Interruptores + cupos + pedidos activos |
| `app/admin/components/Orders.tsx` | Estado, impresión, eliminación; usa `OrdersTable` y `OrderDetail` |
| `app/admin/components/OrdersTable.tsx` (nuevo) | Tabla/tarjetas compactas, `TelCliente` |
| `app/admin/components/OrderDetail.tsx` (nuevo, sale de `Orders.tsx`) | Detalle, `RefundBox`, `ComandaTicket` |
| `app/admin/components/Cupos.tsx` | Lista de cupos compacta para el Arranque |
| `app/admin/components/NotificationsRecovery.tsx` | Se consulta solo y se oculta si no hay avisos |
| `app/admin/components/Settings.tsx` | Pestañas, sin interruptores |
| `app/admin/components/Dashboard.tsx` | Dashboard compacto por noche |
| `app/admin/components/Products.tsx`, `Customers.tsx` | Filas de una línea, filtro En carta |
| `tests/admin-pedidos.test.ts`, `tests/inicio-admin.test.ts`, `tests/admin-dashboard.test.ts`, `tests/busqueda-admin.test.ts` (nuevos) | Tests de la lógica pura |
| `tests/cocina-bases-render.test.ts` | Ruta nueva de `/cocina` |

---

### Task 1: Separar el CSS de la web y del panel

El panel recibe `impasto.css` porque lo importa `app/layout.tsx`. Su `.topbar` (fondo oscuro, `color: var(--bg)`) pinta de crema el título del panel (`rgb(246,241,231)` sobre blanco). Se mueve la web a un grupo de rutas.

**Files:**
- Create: `app/(sitio)/layout.tsx`
- Move: `app/page.tsx` → `app/(sitio)/page.tsx`; `app/error.tsx` → `app/(sitio)/error.tsx`; `app/error.module.css` → `app/(sitio)/error.module.css`; `app/pedido/` → `app/(sitio)/pedido/`; `app/terminos/`, `app/privacidad/`, `app/reembolso/`, `app/cocina/` → `app/(sitio)/…`
- Modify: `app/layout.tsx:3` (quitar `import "./impasto.css";`)
- Modify: `app/(sitio)/error.tsx:4-7` (imports relativos)
- Modify: `tests/cocina-bases-render.test.ts:54`
- Quedan en `app/`: `layout.tsx`, `globals.css`, `impasto.css`, `not-found.tsx` (estilos en línea), `admin/`, `admin-login/` (CSS module propio), `api/`, `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`, `llms.txt`, `favicon.ico`, `page.module.css`.

**Interfaces:**
- Produces: la web sigue en las mismas URLs; `/admin` ya no carga `impasto.css`.

- [ ] **Step 1: Medir el estado previo de la web (para comparar después)**

Con `preview_start` (`impasto-web`), en `http://localhost:3000/` correr con `javascript_tool` y guardar la salida en el scratchpad:

```js
const sel = ['body', '.topbar', '.hero h1', '.header', '.menu .section-head h2', '.footer', '.masas-card', '.btn-primary'];
JSON.stringify(sel.map(s => { const el = document.querySelector(s); if (!el) return [s, null]; const c = getComputedStyle(el); return [s, c.color, c.backgroundColor, c.fontFamily.slice(0, 30), c.fontSize, c.padding]; }))
```

Hacer lo mismo en `/terminos`, `/cocina` y `/pedido/IM-INEXISTENTE` (con el selector `body` y `h1`).

- [ ] **Step 2: Mover los archivos con git**

```bash
cd Impasto
mkdir -p "app/(sitio)"
git mv app/page.tsx "app/(sitio)/page.tsx"
git mv app/error.tsx "app/(sitio)/error.tsx"
git mv app/error.module.css "app/(sitio)/error.module.css"
git mv app/pedido "app/(sitio)/pedido"
git mv app/terminos "app/(sitio)/terminos"
git mv app/privacidad "app/(sitio)/privacidad"
git mv app/reembolso "app/(sitio)/reembolso"
git mv app/cocina "app/(sitio)/cocina"
```

- [ ] **Step 3: Crear el layout de la web**

`app/(sitio)/layout.tsx`:

```tsx
import "../impasto.css";

/**
 * La web pública. `impasto.css` va acá y no en el layout raíz: sus clases (`.topbar`, `.btn`,
 * `h1…h5`) pisaban las del panel y dejaban el título de cada sección crema sobre blanco.
 * El grupo `(sitio)` no forma parte de la URL.
 */
export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Quitar `impasto.css` del layout raíz**

En `app/layout.tsx`, borrar la línea `import "./impasto.css";` (la 3). Dejar `import "./globals.css";`.

- [ ] **Step 5: Arreglar imports relativos**

En `app/(sitio)/error.tsx`, cambiar:

```tsx
import { BUSINESS } from "../lib/business";
import { enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP } from "../lib/contacto";
import { listaDeDias } from "../lib/hours";
```

por:

```tsx
import { BUSINESS } from "@/lib/business";
import { enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP } from "@/lib/contacto";
import { listaDeDias } from "@/lib/hours";
```

Buscar otros imports relativos que suban de carpeta en lo movido y pasarlos a `@/`:

Run: `grep -rn "from \"\.\./\|from '\.\./" "app/(sitio)"`
Expected: sin resultados después del cambio (el `import "../impasto.css"` del layout es un import sin `from` y queda).

En `tests/cocina-bases-render.test.ts:54`, cambiar `'../app/cocina/page.tsx'` por `'../app/(sitio)/cocina/page.tsx'`.

- [ ] **Step 6: Tipos, tests y build**

Run: `npx tsc --noEmit && pnpm test && pnpm build`
Expected: sin errores; el build lista `/`, `/pedido/[ref]`, `/terminos`, `/privacidad`, `/reembolso`, `/cocina`, `/admin`, `/admin-login`.

- [ ] **Step 7: Comparar la web y mirar el panel**

Con `pnpm dev` (preview), repetir el script del Step 1 en las mismas páginas. Expected: valores idénticos. Mirar `/` a 375 px y 1280 px (screenshot), abrir el carrito y el checkout. En `/admin` (con la sesión del dueño), el título de la sección se ve oscuro:

```js
getComputedStyle(document.querySelector('.topbar h1')).color
```
Expected: distinto de `rgb(246, 241, 231)`.

- [ ] **Step 8: Commit**

```bash
git add -A "app/(sitio)" app/layout.tsx tests/cocina-bases-render.test.ts
git commit -m "refactor: la web pública a app/(sitio) para que impasto.css no pise el panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lógica de pedidos del panel (`lib/admin-pedidos.ts`)

**Files:**
- Create: `lib/admin-pedidos.ts`
- Test: `tests/admin-pedidos.test.ts`
- Modify: `package.json` (`scripts.test`)

**Interfaces:**
- Consumes: `esPedidoParaCocina(p: PedidoVisibleParams): boolean` de `lib/pedido-visible.ts`; tipos `AdminOrder`, `OrderItem` de `app/admin/components/types.ts`.
- Produces:
  - `ESTADOS_ACTIVOS: readonly ["nuevo", "preparando", "en-camino"]`
  - `esActivo(p: Pick<AdminOrder, "estado">): boolean`
  - `etiquetaEstado(estado: string, mode: AdminOrder["mode"]): string`
  - `siguienteEstado(p: Pick<AdminOrder, "estado" | "mode" | "pago" | "pagoEstado">): { estado: string; etiqueta: string } | null`
  - `numeroCorto(p: Pick<AdminOrder, "numero" | "canal" | "id">): string`
  - `resumenItems(items: ReadonlyArray<Pick<OrderItem, "qty" | "name">>, max?: number): { texto: string; resto: number }`

- [ ] **Step 1: Escribir el test que falla**

`tests/admin-pedidos.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { esActivo, etiquetaEstado, numeroCorto, resumenItems, siguienteEstado } from "../lib/admin-pedidos";

const pedido = (extra: Record<string, unknown> = {}) =>
  ({ estado: "nuevo", mode: "delivery", pago: "efectivo", pagoEstado: "pendiente", ...extra }) as Parameters<typeof siguienteEstado>[0];

test("esActivo: nuevo, preparando y en camino; no entregado ni cancelado", () => {
  assert.equal(esActivo({ estado: "nuevo" }), true);
  assert.equal(esActivo({ estado: "preparando" }), true);
  assert.equal(esActivo({ estado: "en-camino" }), true);
  assert.equal(esActivo({ estado: "entregado" }), false);
  assert.equal(esActivo({ estado: "cancelado" }), false);
});

test("etiquetaEstado: en camino es 'Listo para retirar' en retiro", () => {
  assert.equal(etiquetaEstado("en-camino", "delivery"), "En camino");
  assert.equal(etiquetaEstado("en-camino", "takeaway"), "Listo para retirar");
  assert.equal(etiquetaEstado("nuevo", "takeaway"), "Nuevo");
  assert.equal(etiquetaEstado("raro", "takeaway"), "raro");
});

test("siguienteEstado: avanza un paso y nombra el destino según la entrega", () => {
  assert.deepEqual(siguienteEstado(pedido()), { estado: "preparando", etiqueta: "Preparando" });
  assert.deepEqual(siguienteEstado(pedido({ estado: "preparando" })), { estado: "en-camino", etiqueta: "En camino" });
  assert.deepEqual(siguienteEstado(pedido({ estado: "preparando", mode: "takeaway" })), { estado: "en-camino", etiqueta: "Listo para retirar" });
  assert.deepEqual(siguienteEstado(pedido({ estado: "en-camino" })), { estado: "entregado", etiqueta: "Entregado" });
});

test("siguienteEstado: nada después de entregado ni para cancelados", () => {
  assert.equal(siguienteEstado(pedido({ estado: "entregado" })), null);
  assert.equal(siguienteEstado(pedido({ estado: "cancelado" })), null);
});

test("siguienteEstado: una tarjeta sin acreditar no avanza (misma regla que la cocina)", () => {
  assert.equal(siguienteEstado(pedido({ pago: "mercadopago", pagoEstado: "pendiente" })), null);
  assert.deepEqual(siguienteEstado(pedido({ pago: "mercadopago", pagoEstado: "aprobado" })), { estado: "preparando", etiqueta: "Preparando" });
});

test("numeroCorto: el número de la comanda; el POS con prefijo; sin número, la referencia", () => {
  assert.equal(numeroCorto({ numero: "107345", canal: "web", id: "IM-107345-K7QD" }), "107345");
  assert.equal(numeroCorto({ numero: "3", canal: "pos", id: "IM-0003" }), "POS 3");
  assert.equal(numeroCorto({ numero: "", canal: "web", id: "IM-MAN-36E8" }), "IM-MAN-36E8");
  assert.equal(numeroCorto({ id: "IM-1" }), "IM-1");
});

test("resumenItems: entra lo que cabe y cuenta el resto", () => {
  const items = [{ qty: 1, name: "Fugazzetta" }, { qty: 2, name: "Muzzarella Impasto" }, { qty: 1, name: "Coca-Cola 1.5 L" }];
  assert.deepEqual(resumenItems(items, 60), { texto: "1× Fugazzetta, 2× Muzzarella Impasto, 1× Coca-Cola 1.5 L", resto: 0 });
  assert.deepEqual(resumenItems(items, 30), { texto: "1× Fugazzetta", resto: 2 });
  // El primero siempre entra, aunque sea largo (la tabla lo corta con "…").
  assert.deepEqual(resumenItems([{ qty: 1, name: "Mitad Napoletana all'Aglio / Mitad Prosciutto, Rucola e Parmigiano" }], 20).resto, 0);
  assert.deepEqual(resumenItems([], 30), { texto: "", resto: 0 });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx tsx tests/admin-pedidos.test.ts`
Expected: FAIL (`Cannot find module '../lib/admin-pedidos'`).

- [ ] **Step 3: Implementar**

`lib/admin-pedidos.ts`:

```ts
import type { AdminOrder, OrderItem } from "../app/admin/components/types";
import { esPedidoParaCocina } from "./pedido-visible";

/** Lo que todavía hay que preparar o entregar: la vista por defecto de Pedidos y del Arranque. */
export const ESTADOS_ACTIVOS = ["nuevo", "preparando", "en-camino"] as const;
const RECORRIDO = ["nuevo", "preparando", "en-camino", "entregado"];

export const esActivo = (p: Pick<AdminOrder, "estado">) => (ESTADOS_ACTIVOS as readonly string[]).includes(p.estado);

/** El estado como lo lee el local: en retiro, "en camino" es "Listo para retirar". */
export function etiquetaEstado(estado: string, mode: AdminOrder["mode"]): string {
  switch (estado) {
    case "nuevo": return "Nuevo";
    case "preparando": return "Preparando";
    case "en-camino": return mode === "delivery" ? "En camino" : "Listo para retirar";
    case "entregado": return "Entregado";
    case "cancelado": return "Cancelado";
    default: return estado;
  }
}

/**
 * El paso siguiente del botón de la fila. Misma regla que el detalle: lo que no entra a la
 * cocina (tarjeta sin acreditar, cancelado) no avanza.
 */
export function siguienteEstado(p: Pick<AdminOrder, "estado" | "mode" | "pago" | "pagoEstado">): { estado: string; etiqueta: string } | null {
  const i = RECORRIDO.indexOf(p.estado);
  if (i < 0 || i >= RECORRIDO.length - 1) return null;
  if (!esPedidoParaCocina(p)) return null;
  const estado = RECORRIDO[i + 1];
  return { estado, etiqueta: etiquetaEstado(estado, p.mode) };
}

/** El número de la comanda (`107345`, `POS 3`); la referencia larga solo si no hay número. */
export function numeroCorto(p: Pick<AdminOrder, "numero" | "canal" | "id">): string {
  const numero = String(p.numero ?? "").trim();
  if (!numero) return p.id;
  return p.canal === "pos" ? `POS ${numero}` : numero;
}

/** Los ítems en una línea de hasta `max` caracteres; el primero entra siempre. */
export function resumenItems(items: ReadonlyArray<Pick<OrderItem, "qty" | "name">>, max = 48): { texto: string; resto: number } {
  const partes = items.map((i) => `${i.qty}× ${i.name}`);
  let texto = "";
  let usados = 0;
  for (const parte of partes) {
    const siguiente = texto ? `${texto}, ${parte}` : parte;
    if (texto && siguiente.length > max) break;
    texto = siguiente;
    usados++;
  }
  return { texto, resto: partes.length - usados };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx tsx tests/admin-pedidos.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Sumar el test a `pnpm test` y commit**

En `package.json`, al final de `scripts.test` (antes de la comilla de cierre), agregar ` && tsx tests/admin-pedidos.test.ts`.

```bash
git add lib/admin-pedidos.ts tests/admin-pedidos.test.ts package.json
git commit -m "feat(admin): lógica de pedidos para la tabla compacta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sección inicial (`lib/inicio-admin.ts`)

**Files:**
- Create: `lib/inicio-admin.ts`
- Test: `tests/inicio-admin.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `diaDeNegocio(iso: string): string` de `lib/resumen-diario.ts` (noche de 06:00 a 05:59, UTC-3).
- Produces:
  - `type SeccionAdmin = "arranque" | "pedidos" | "resumen" | "productos" | "etiquetas" | "dashboard" | "clientes" | "testimonios" | "configuracion"`
  - `SECCIONES_ADMIN: readonly SeccionAdmin[]`
  - `esSeccionAdmin(valor: unknown): valor is SeccionAdmin`
  - `seccionInicial(diasApertura: string | null | undefined, ahora: Date, guardada: string | null): SeccionAdmin`

- [ ] **Step 1: Test que falla**

`tests/inicio-admin.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { esSeccionAdmin, seccionInicial } from "../lib/inicio-admin";

const VIE_SAB_DOM = "0,5,6";

test("seccionInicial: la sección guardada en la sesión manda", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-21T15:00:00Z"), "productos"), "productos");
});

test("seccionInicial: una guardada inválida se ignora", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-21T15:00:00Z"), "cupos"), "dashboard");
});

test("seccionInicial: día de apertura abre el Arranque; si no, el Dashboard", () => {
  // vie 23/10 20:00 en Argentina
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-23T23:00:00Z"), null), "arranque");
  // mié 21/10 12:00 en Argentina
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-21T15:00:00Z"), null), "dashboard");
});

test("seccionInicial: a las 01:00 del sábado sigue siendo la noche del viernes", () => {
  // sáb 24/10 01:00 en Argentina = 04:00 UTC
  assert.equal(seccionInicial("5", new Date("2026-10-24T04:00:00Z"), null), "arranque");
});

test("seccionInicial: lunes 01:00 es la noche del domingo; lunes 10:00 ya no", () => {
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-26T04:00:00Z"), null), "arranque");
  assert.equal(seccionInicial(VIE_SAB_DOM, new Date("2026-10-26T13:00:00Z"), null), "dashboard");
});

test("seccionInicial: sin días cargados, Dashboard", () => {
  assert.equal(seccionInicial("", new Date("2026-10-23T23:00:00Z"), null), "dashboard");
  assert.equal(seccionInicial(null, new Date("2026-10-23T23:00:00Z"), null), "dashboard");
});

test("esSeccionAdmin", () => {
  assert.equal(esSeccionAdmin("arranque"), true);
  assert.equal(esSeccionAdmin("cupos"), false);
  assert.equal(esSeccionAdmin(undefined), false);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx tsx tests/inicio-admin.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

`lib/inicio-admin.ts`:

```ts
import { diaDeNegocio } from "./resumen-diario";

export type SeccionAdmin =
  | "arranque" | "pedidos" | "resumen"
  | "productos" | "etiquetas"
  | "dashboard" | "clientes" | "testimonios"
  | "configuracion";

export const SECCIONES_ADMIN: readonly SeccionAdmin[] = [
  "arranque", "pedidos", "resumen", "productos", "etiquetas", "dashboard", "clientes", "testimonios", "configuracion",
];

export const esSeccionAdmin = (valor: unknown): valor is SeccionAdmin =>
  typeof valor === "string" && (SECCIONES_ADMIN as readonly string[]).includes(valor);

/**
 * Dónde abre el panel: la última sección de esta sesión; si no hay, el Arranque en una noche de
 * apertura (la noche va de 06:00 a 05:59, como el Resumen diario) y el Dashboard el resto.
 */
export function seccionInicial(diasApertura: string | null | undefined, ahora: Date, guardada: string | null): SeccionAdmin {
  if (esSeccionAdmin(guardada)) return guardada;
  const dias = String(diasApertura || "")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const noche = diaDeNegocio(ahora.toISOString());
  const diaSemana = new Date(`${noche}T12:00:00Z`).getUTCDay();
  return dias.includes(diaSemana) ? "arranque" : "dashboard";
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx tsx tests/inicio-admin.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Sumar a `pnpm test` y commit**

Agregar ` && tsx tests/inicio-admin.test.ts` al final de `scripts.test`.

```bash
git add lib/inicio-admin.ts tests/inicio-admin.test.ts package.json
git commit -m "feat(admin): sección inicial según la noche de apertura

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sistema visual neutro (`admin.css`)

Reescribe los tokens y los componentes base. Todavía no cambia el markup: las secciones se ven con la paleta nueva y más densas.

**Files:**
- Modify: `app/admin/admin.css` (bloques `:root`, SIDEBAR, MAIN, CARDS/PANELS, KPI GRID, TABLE, STATUS CHIPS, BUTTONS, FILTERS, MODAL, FORM, switch, DASHBOARD SPECIFIC, TOAST, RESPONSIVE SIDEBAR, ORDER DETAIL, RESUMEN DIARIO, CUPOS)
- Modify: `app/admin/layout.tsx` (fuentes)

**Interfaces:**
- Produces: clases nuevas que usan las tareas siguientes: `.nav-group`, `.nav-item` (menú claro), `.pill`, `.pill-ok`, `.pill-off`, `.pill-warn`, `.tabs`, `.tabs button.active`, `.menu-mas`, `.menu-mas-pop`, `.ord-num`, `.ord-items`, `.ord-sub`, `.btn-next`, `.ord-cards`, `.ord-card`, `.int` (interruptor), `.int-row`, `.arranque-grid`, `.kpi` compacta, `.dash-grid`, `.chart` por noche, `.busqueda`, `.busqueda-pop`, `.busqueda-item`.

- [ ] **Step 1: Tokens neutros**

Reemplazar el bloque `:root{…}` (líneas 2–31) por:

```css
:root{
  --a-bg: #f6f7f9;
  --a-bg-2: #eef0f3;
  --a-surface: #ffffff;
  --a-sidebar: #ffffff;
  --a-sidebar-hover: #f3f4f6;
  --a-ink: #111827;
  --a-ink-2: #374151;
  --a-muted: #6b7280;
  --a-line: #e3e6eb;
  --a-line-strong: #d1d5db;
  --a-accent: #111827;
  --a-accent-soft: #f3f4f6;
  --a-gold: #b45309;
  --a-success: #047857;
  --a-success-soft: #ecfdf5;
  --a-warn: #b45309;
  --a-warn-soft: #fffbeb;
  --a-danger: #b91c1c;
  --a-danger-soft: #fef2f2;
  --a-info: #1d4ed8;
  --a-info-soft: #eff6ff;
  --a-violet: #6d28d9;
  --a-violet-soft: #f5f3ff;
  --a-radius: 10px;
  --a-radius-sm: 8px;
  --a-shadow-sm: 0 1px 2px rgba(17,24,39,.04);
  --a-shadow: 0 8px 24px rgba(17,24,39,.08), 0 2px 6px rgba(17,24,39,.04);
  --a-font-display: "Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  --a-font-body: "Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  --a-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

`--a-font-display` pasa a Inter: así los cientos de usos actuales en línea (`fontFamily: "var(--a-font-display)"`) se vuelven neutros sin tocar cada componente. `--a-accent` pasa a casi negro (botón principal y sección activa).

- [ ] **Step 2: Base, layout, menú lateral claro y barra superior**

Reemplazar los bloques LAYOUT, SIDEBAR y MAIN (líneas 47–170) por:

```css
/* ============ LAYOUT ============ */
.admin{ display:grid; grid-template-columns:232px 1fr; min-height:100vh; }

/* ============ SIDEBAR ============ */
.sidebar{
  background:var(--a-sidebar); color:var(--a-ink-2);
  border-right:1px solid var(--a-line);
  padding:14px 10px; position:sticky; top:0; height:100vh; overflow:auto;
  display:flex; flex-direction:column; gap:1px;
}
.sidebar-brand{ display:flex; align-items:center; gap:10px; padding:4px 8px 14px; }
.sidebar-brand .logo-mark{
  width:28px; height:28px; border-radius:8px; background:var(--a-ink); color:#fff;
  display:grid; place-items:center; font-weight:700; font-size:14px;
}
.sidebar-brand-name{ font-size:15px; font-weight:650; color:var(--a-ink); letter-spacing:-.01em; line-height:1.1; }
.sidebar-brand-name small{ display:block; font-size:11px; font-weight:400; color:var(--a-muted); }
.nav-group{ font-size:11px; font-weight:600; color:var(--a-muted); padding:12px 10px 4px; }
.nav-item{
  display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:7px;
  color:var(--a-ink-2); font-size:13.5px; font-weight:500; cursor:pointer;
  border:0; background:none; width:100%; text-align:left;
}
.nav-item svg{ flex-shrink:0; width:16px; height:16px; color:var(--a-muted); }
.nav-item:hover{ background:var(--a-sidebar-hover); color:var(--a-ink); }
.nav-item.active{ background:var(--a-bg-2); color:var(--a-ink); font-weight:600; }
.nav-item.active svg{ color:var(--a-ink); }
.nav-item .badge{
  margin-left:auto; background:var(--a-info); color:#fff;
  font-size:11px; font-weight:600; padding:0 6px; border-radius:999px; line-height:18px;
}
.sidebar-footer{
  margin-top:auto; padding:10px 8px 2px; border-top:1px solid var(--a-line);
  display:flex; align-items:center; gap:8px; min-width:0;
}
.sidebar-footer-info{ min-width:0; flex:1; }
.sidebar-footer-info b{ display:block; font-size:12px; font-weight:600; color:var(--a-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sidebar-footer-info small{ font-size:11px; color:var(--a-muted); }
.sidebar-signout{
  padding:4px 8px; border:1px solid var(--a-line); border-radius:6px;
  font-size:12px; color:var(--a-ink-2); background:var(--a-surface);
}
.sidebar-signout:hover{ background:var(--a-bg); }

/* ============ MAIN ============ */
.main{ min-width:0; display:flex; flex-direction:column; }
.topbar{
  background:var(--a-surface); border-bottom:1px solid var(--a-line);
  padding:10px 20px; display:flex; align-items:center; gap:12px;
  position:sticky; top:0; z-index:20; flex-wrap:wrap;
}
.topbar h1{ font-size:17px; font-weight:650; letter-spacing:-.01em; margin:0; color:var(--a-ink); }
.topbar h1 small{ display:block; font-size:12px; font-weight:400; color:var(--a-muted); margin-top:1px; }
.topbar-spacer{ flex:1; }
.content{ padding:16px 20px 32px; max-width:100%; }
```

- [ ] **Step 3: Paneles, tarjetas, tabla, chips, botones, filtros**

Reemplazar CARDS/PANELS, KPI GRID, TABLE (hasta antes de `.row-thumb`), STATUS CHIPS, BUTTONS y FILTERS por:

```css
/* ============ CARDS / PANELS ============ */
.panel{ background:var(--a-surface); border:1px solid var(--a-line); border-radius:var(--a-radius); }
.panel-head{
  padding:10px 14px; border-bottom:1px solid var(--a-line);
  display:flex; align-items:center; gap:10px; flex-wrap:wrap; min-height:48px;
}
.panel-head h3{ font-size:14px; font-weight:600; margin:0; }
.panel-head .panel-head-spacer{ flex:1; }
.panel-body{ padding:14px; }
.panel-body.no-pad{ padding:0; }

/* ============ KPI ============ */
.kpi-grid{ display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:12px; }
@media (max-width:1100px){ .kpi-grid{ grid-template-columns:repeat(2, 1fr); } }
.kpi{ background:var(--a-surface); border:1px solid var(--a-line); border-radius:var(--a-radius); padding:10px 12px; }
.kpi-label{ font-size:12px; color:var(--a-muted); }
.kpi-value{ font-size:22px; font-weight:650; letter-spacing:-.02em; line-height:1.2; margin:2px 0; }
.kpi-delta{ font-size:12px; font-weight:500; color:var(--a-muted); }
.kpi-delta.up{ color:var(--a-success); }
.kpi-delta.down{ color:var(--a-danger); }
.kpi-delta.warn{ color:var(--a-warn); }

/* ============ TABLE ============ */
.tbl-wrap{ overflow-x:auto; }
.tbl{ width:100%; border-collapse:collapse; font-size:13px; }
.tbl th{
  text-align:left; padding:7px 12px; font-size:12px; font-weight:500; color:var(--a-muted);
  background:var(--a-bg); border-bottom:1px solid var(--a-line); white-space:nowrap;
}
.tbl td{ padding:8px 12px; border-bottom:1px solid var(--a-line); vertical-align:middle; }
.tbl tbody tr:hover{ background:#fafbfc; }
.tbl tbody tr.order-payment-pending{ background:var(--a-warn-soft); }
.tbl tbody tr.order-payment-pending td:first-child{ box-shadow:inset 3px 0 0 var(--a-warn); }
.order-payment-reminder{ display:inline-block; margin-left:6px; padding:1px 6px; border-radius:5px; background:var(--a-warn-soft); color:var(--a-warn); font-size:11px; font-weight:600; }
.tbl tbody tr:last-child td{ border-bottom:none; }
.tbl .tbl-mono{ font-family:var(--a-font-mono); font-size:12px; color:var(--a-ink-2); }
.tbl .tbl-strong{ font-weight:600; color:var(--a-ink); }
.tbl .tbl-muted{ color:var(--a-muted); font-size:12px; }
.tbl .tbl-wa{ display:inline-flex; align-items:center; gap:4px; text-decoration:none; }
.tbl .tbl-wa svg{ color:#25d366; flex:none; }
.tbl .tbl-wa:hover{ color:var(--a-ink); text-decoration:underline; }
.tbl .tbl-price{ font-weight:600; font-variant-numeric:tabular-nums; }
.tbl .tbl-actions{ display:flex; gap:2px; justify-content:flex-end; }
.tbl td.right, .tbl th.right{ text-align:right; }
.tbl .nowrap{ white-space:nowrap; }
.tbl .ellipsis{ max-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
```

(Conservar `.row-thumb` pero con `width:32px; height:32px; border-radius:6px; margin-right:8px; flex:none;` y `.row-thumb.lg` igual que hoy.)

```css
/* ============ STATUS CHIPS ============ */
.chip{
  display:inline-flex; align-items:center; gap:5px; white-space:nowrap;
  font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:999px;
}
.chip::before{ content:""; width:6px; height:6px; border-radius:999px; background:currentColor; }
.chip-nuevo{ background:var(--a-info-soft); color:var(--a-info); }
.chip-preparando{ background:var(--a-warn-soft); color:var(--a-warn); }
.chip-en-camino{ background:var(--a-violet-soft); color:var(--a-violet); }
.chip-entregado{ background:var(--a-success-soft); color:var(--a-success); }
.chip-cancelado{ background:var(--a-danger-soft); color:var(--a-danger); }
.chip-activo, .chip-aprobado{ background:var(--a-success-soft); color:var(--a-success); }
.chip-inactivo{ background:var(--a-bg-2); color:var(--a-muted); }
.chip-pendiente{ background:var(--a-warn-soft); color:var(--a-warn); }
.chip-rechazado{ background:var(--a-danger-soft); color:var(--a-danger); }

/* ============ PILLS (estado del local en la barra superior) ============ */
.pill{
  display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px;
  font-size:12px; font-weight:600; border:1px solid transparent; cursor:pointer; white-space:nowrap;
}
.pill::before{ content:""; width:6px; height:6px; border-radius:999px; background:currentColor; }
.pill-ok{ background:var(--a-success-soft); color:var(--a-success); }
.pill-off{ background:var(--a-danger-soft); color:var(--a-danger); }
.pill-warn{ background:var(--a-warn-soft); color:var(--a-warn); }
.estado-local{ display:flex; gap:6px; flex-wrap:wrap; }

/* ============ BUTTONS ============ */
.btn{
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  padding:6px 12px; border-radius:7px; font-size:13px; font-weight:500;
  border:1px solid transparent; white-space:nowrap;
}
.btn:disabled{ opacity:.45; cursor:not-allowed; }
.btn-primary{ background:var(--a-ink); color:#fff; }
.btn-primary:hover:not(:disabled){ background:#1f2937; }
.btn-ghost{ background:var(--a-surface); border-color:var(--a-line); color:var(--a-ink); }
.btn-ghost:hover:not(:disabled){ background:var(--a-bg); }
.btn-muted{ background:var(--a-bg-2); color:var(--a-muted); }
.btn-danger{ background:var(--a-danger-soft); color:var(--a-danger); }
.btn-danger:hover:not(:disabled){ background:var(--a-danger); color:#fff; }
.btn-success{ background:var(--a-success-soft); color:var(--a-success); }
.btn-success:hover:not(:disabled){ background:var(--a-success); color:#fff; }
.btn-icon{ width:30px; height:30px; padding:0; }
.btn-icon.btn-ghost{ background:transparent; border-color:transparent; }
.btn-icon.btn-ghost:hover:not(:disabled){ background:var(--a-bg-2); }
.btn-sm{ padding:4px 9px; font-size:12px; }
.btn-lg{ padding:9px 16px; font-size:14px; }
/* "→ Preparando": avanzar el pedido sin abrir el detalle */
.btn-next{
  display:inline-flex; align-items:center; gap:4px; padding:4px 9px; border-radius:7px;
  font-size:12px; font-weight:600; white-space:nowrap;
  background:var(--a-ink); color:#fff; border:0;
}
.btn-next:hover:not(:disabled){ background:#1f2937; }
.btn-next:disabled{ opacity:.35; cursor:not-allowed; }

/* ============ FILTERS ============ */
.toolbar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.seg{ display:inline-flex; background:var(--a-bg-2); padding:2px; border-radius:8px; flex-wrap:wrap; }
.seg button{ padding:4px 10px; font-size:12.5px; font-weight:500; color:var(--a-muted); border-radius:6px; white-space:nowrap; }
.seg button.active{ background:var(--a-surface); color:var(--a-ink); box-shadow:var(--a-shadow-sm); }
.seg button .count{ margin-left:5px; font-size:11px; color:var(--a-muted); font-variant-numeric:tabular-nums; }
.search-input{
  display:flex; align-items:center; gap:6px; padding:5px 10px;
  background:var(--a-surface); border:1px solid var(--a-line); border-radius:7px; min-width:200px;
}
.search-input input{ background:none; border:0; outline:0; width:100%; font-size:13px; }
.select-input{ padding:5px 28px 5px 10px; border:1px solid var(--a-line); border-radius:7px; font-size:13px; background-color:var(--a-surface); }

/* ============ TABS (Configuración) ============ */
.tabs{ display:flex; gap:2px; border-bottom:1px solid var(--a-line); padding:0 14px; overflow-x:auto; }
.tabs button{ padding:10px 12px; font-size:13px; font-weight:500; color:var(--a-muted); border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; }
.tabs button.active{ color:var(--a-ink); border-bottom-color:var(--a-ink); font-weight:600; }

/* ============ MENÚ "⋯" ============ */
.menu-mas{ position:relative; }
.menu-mas-pop{
  position:absolute; right:0; top:calc(100% + 4px); z-index:40; min-width:240px;
  background:var(--a-surface); border:1px solid var(--a-line); border-radius:var(--a-radius); box-shadow:var(--a-shadow);
  padding:6px; display:flex; flex-direction:column; gap:2px;
}
.menu-mas-pop > button{ text-align:left; padding:7px 10px; border-radius:6px; font-size:13px; }
.menu-mas-pop > button:hover{ background:var(--a-bg); }
.menu-mas-pop label{ display:flex; flex-direction:column; gap:4px; padding:7px 10px; font-size:12px; color:var(--a-muted); }
```

- [ ] **Step 4: Modal, formularios, interruptor, dashboard, toast, responsive**

Reemplazar MODAL, FORM, `.switch`, DASHBOARD SPECIFIC (hasta antes de TIMELINE), TOAST y RESPONSIVE SIDEBAR por:

```css
/* ============ MODAL ============ */
.modal-bg{ position:fixed; inset:0; background:rgba(17,24,39,.35); z-index:100; display:flex; justify-content:flex-end; animation:fadeIn .15s ease; }
@keyframes fadeIn{ from{ opacity:0; } to{ opacity:1; } }
.modal-side{ width:100%; max-width:520px; background:var(--a-surface); display:flex; flex-direction:column; height:100%; box-shadow:var(--a-shadow); animation:slideIn .2s ease; }
@keyframes slideIn{ from{ transform:translateX(16px); opacity:0; } to{ transform:none; opacity:1; } }
.modal-head{ padding:14px 18px; border-bottom:1px solid var(--a-line); display:flex; align-items:center; gap:12px; }
.modal-head h3{ font-size:16px; font-weight:650; margin:0; }
.modal-head small{ display:block; color:var(--a-muted); font-size:12px; margin-top:1px; }
.modal-body{ flex:1; overflow:auto; padding:16px 18px; }
.modal-foot{ padding:12px 18px; border-top:1px solid var(--a-line); display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; background:var(--a-bg); }

/* ============ FORM ============ */
.form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.form-grid.cols-3{ grid-template-columns:1fr 1fr 1fr; }
.form-grid .full{ grid-column:1 / -1; }
@media (max-width:640px){ .form-grid, .form-grid.cols-3{ grid-template-columns:1fr; } }
.field{ display:flex; flex-direction:column; gap:4px; }
.field label{ font-size:12.5px; font-weight:500; color:var(--a-ink-2); }
.field input, .field textarea, .field select{
  padding:7px 10px; border-radius:7px; background:var(--a-surface); border:1px solid var(--a-line-strong); outline:0; font-size:13.5px;
}
.field input:focus, .field textarea:focus, .field select:focus{ border-color:var(--a-ink); box-shadow:0 0 0 3px rgba(17,24,39,.08); }
.field .hint{ font-size:12px; color:var(--a-muted); }
.field-row{ display:flex; gap:8px; align-items:center; }

/* Interruptor de productos (div.switch, se conserva) */
.switch{ position:relative; width:32px; height:18px; background:var(--a-line-strong); border-radius:999px; cursor:pointer; transition:background .15s; flex:none; }
.switch::after{ content:""; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:999px; background:#fff; transition:transform .15s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
.switch.on{ background:var(--a-success); }
.switch.on::after{ transform:translateX(14px); }

/* Interruptor accesible (Interruptor.tsx) */
.int{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid var(--a-line); border-radius:var(--a-radius); background:var(--a-surface); width:100%; text-align:left; }
.int:disabled{ opacity:.55; cursor:not-allowed; }
.int-text b{ display:block; font-size:13.5px; font-weight:600; color:var(--a-ink); }
.int-text small{ display:block; font-size:12px; color:var(--a-muted); }
.int-track{ position:relative; width:36px; height:20px; border-radius:999px; background:var(--a-line-strong); flex:none; transition:background .15s; }
.int-track::after{ content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:transform .15s; }
.int[aria-checked="true"] .int-track{ background:var(--a-success); }
.int[aria-checked="true"] .int-track::after{ transform:translateX(16px); }
.int.apagado{ border-color:#fecaca; background:var(--a-danger-soft); }
.int-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:8px; }
.int-motivo{ grid-column:1 / -1; }

/* ============ DASHBOARD ============ */
.dash-grid{ display:grid; grid-template-columns:1.6fr 1fr; gap:12px; }
@media (max-width:900px){ .dash-grid{ grid-template-columns:1fr; } }
.chart{ display:flex; align-items:flex-end; gap:6px; height:150px; padding:18px 0 22px; }
.chart-bar{ flex:1; background:var(--a-ink); border-radius:4px 4px 0 0; min-height:3px; position:relative; }
.chart-bar:hover{ opacity:.8; }
.chart-bar::after{ content:attr(data-label); position:absolute; bottom:-18px; left:50%; transform:translateX(-50%); font-size:10.5px; color:var(--a-muted); white-space:nowrap; }
.chart-bar .val{ position:absolute; top:-17px; left:50%; transform:translateX(-50%); font-size:10.5px; font-weight:600; white-space:nowrap; opacity:0; }
.chart-bar:hover .val{ opacity:1; }
.top-list{ display:flex; flex-direction:column; }
.top-row{ display:flex; align-items:center; gap:8px; padding:6px 2px; border-bottom:1px solid var(--a-line); font-size:13px; }
.top-row:last-child{ border-bottom:0; }
.top-rank{ width:18px; color:var(--a-muted); font-size:12px; font-variant-numeric:tabular-nums; }
.top-row .top-val{ margin-left:auto; font-weight:600; font-variant-numeric:tabular-nums; }

/* ============ TOAST ============ */
.toast{ position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--a-ink); color:#fff; padding:9px 16px; border-radius:8px; font-size:13px; font-weight:500; box-shadow:var(--a-shadow); z-index:200; animation:toastIn .2s ease; }
@keyframes toastIn{ from{ transform:translate(-50%, 12px); opacity:0; } to{ transform:translate(-50%, 0); opacity:1; } }

/* ============ RESPONSIVE ============ */
.sidebar-toggle{ display:none; width:34px; height:34px; border-radius:7px; background:var(--a-surface); border:1px solid var(--a-line); place-items:center; }
.sidebar-overlay{ display:none; }
@media (max-width:900px){
  .admin{ grid-template-columns:1fr; }
  .sidebar{ position:fixed; left:0; top:0; z-index:60; width:250px; transform:translateX(-100%); transition:transform .2s; box-shadow:var(--a-shadow); }
  .sidebar.open{ transform:none; }
  .sidebar-overlay.open{ display:block; position:fixed; inset:0; z-index:55; background:rgba(17,24,39,.3); }
  .sidebar-toggle{ display:grid; }
  .topbar{ padding:8px 12px; gap:8px; }
  .content{ padding:12px 12px 28px; }
  .estado-local{ order:5; width:100%; }
}
```

Ajustar también ORDER DETAIL (`.od-customer`, `.od-items`) quitando `font-family:var(--a-font-display)` de `.od-items .od-row.tot` y bajando rellenos a `10px 12px`. En RESUMEN DIARIO, `.resumen-nav b` pasa a `font-size:17px; font-weight:650;` (sin `font-family`).

- [ ] **Step 5: Fuentes del panel**

En `app/admin/layout.tsx`, cambiar el `href` de Google Fonts a solo Inter:

```tsx
href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&display=swap"
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && pnpm build`
Expected: sin errores.

Con la sesión del dueño en el preview, medir en Pedidos y Clientes:

```js
({ fila: document.querySelector('.tbl tbody tr')?.offsetHeight, titulo: getComputedStyle(document.querySelector('.topbar h1')).color, fuente: getComputedStyle(document.body).fontFamily.slice(0, 10) })
```
Expected: `titulo` `rgb(17, 24, 39)`, `fuente` empieza con `Inter`. (Las filas de Pedidos siguen altas hasta la Task 7.) Screenshot de Dashboard y Configuración.

- [ ] **Step 7: Commit**

```bash
git add app/admin/admin.css app/admin/layout.tsx
git commit -m "style(admin): sistema visual neutro y más denso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Estado del local compartido (`SucursalProvider`, `Interruptor`, sesión)

**Files:**
- Create: `app/admin/components/SucursalProvider.tsx`
- Create: `app/admin/components/Interruptor.tsx`
- Create: `app/admin/components/AdminSesion.tsx`
- Modify: `app/admin/layout.tsx` (envolver con `AdminSesion`)
- Modify: `app/admin/page.tsx` (envolver con `SucursalProvider` dentro de `StoreProvider`)

**Interfaces:**
- Consumes: `useStore().showToast(msg: string)`; `GET/PUT /api/admin/sucursal` (el PUT acepta cualquier subconjunto de campos y responde `{ ok, error? }`; con las dos masas en `false` responde 400).
- Produces:
  - `interface Sucursal { nombre: string; ciudad: string; direccion: string; telefono: string; email: string; whatsapp: string; horarios: string; dias_apertura: string; hora_apertura: string; hora_cierre: string; delivery_fee: number; envio_gratis_desde: number; ventas_activas: boolean; mensaje_cierre: string; delivery_activo?: boolean; mensaje_delivery?: string; masa_napoletana_activa?: boolean; masa_molde_activa?: boolean; cuentas_transferencia?: CuentaTransferencia[] }`
  - `useSucursal(): { sucursal: Sucursal | null; cargando: boolean; error: string; recargar: () => Promise<void>; cambiar: <K extends keyof Sucursal>(campo: K, valor: Sucursal[K], aviso?: string) => Promise<boolean>; guardar: (parcial: Partial<Sucursal>) => Promise<boolean> }`
  - `<Interruptor checked label detalle? disabled? title? onChange={(v: boolean) => void} />`
  - `useAdminSesion(): { email: string }`

- [ ] **Step 1: `AdminSesion`**

`app/admin/components/AdminSesion.tsx`:

```tsx
"use client";
import { createContext, useContext } from "react";

const Ctx = createContext<{ email: string }>({ email: "" });

/** El mail de quien inició sesión, para el pie del menú. Lo pone `app/admin/layout.tsx`. */
export function AdminSesion({ email, children }: { email: string; children: React.ReactNode }) {
  return <Ctx.Provider value={{ email }}>{children}</Ctx.Provider>;
}

export const useAdminSesion = () => useContext(Ctx);
```

En `app/admin/layout.tsx`:

```tsx
import { AdminSesion } from "./components/AdminSesion";
// …
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin-login");
  return (
    <>
      {/* links de fuentes (Task 4) */}
      <AdminSesion email={String(admin.email || "")}>{children}</AdminSesion>
    </>
  );
}
```

- [ ] **Step 2: `SucursalProvider`**

`app/admin/components/SucursalProvider.tsx`:

```tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useStore } from "./StoreProvider";
import type { CuentaTransferencia } from "@/lib/cuentas-transferencia";

export interface Sucursal {
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  horarios: string;
  dias_apertura: string;
  hora_apertura: string;
  hora_cierre: string;
  delivery_fee: number;
  envio_gratis_desde: number;
  ventas_activas: boolean;
  mensaje_cierre: string;
  delivery_activo?: boolean;
  mensaje_delivery?: string;
  masa_napoletana_activa?: boolean;
  masa_molde_activa?: boolean;
  cuentas_transferencia?: CuentaTransferencia[];
}

interface SucursalCtx {
  sucursal: Sucursal | null;
  cargando: boolean;
  error: string;
  recargar: () => Promise<void>;
  /** Interruptores y motivos del Arranque: se ve al instante y vuelve atrás si el servidor dice que no. */
  cambiar: <K extends keyof Sucursal>(campo: K, valor: Sucursal[K], aviso?: string) => Promise<boolean>;
  /** Pestañas de Configuración: guarda varios campos juntos. */
  guardar: (parcial: Partial<Sucursal>) => Promise<boolean>;
}

const Ctx = createContext<SucursalCtx | null>(null);

export const useSucursal = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSucursal must be inside SucursalProvider");
  return ctx;
};

async function enviar(parcial: Partial<Sucursal>): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/sucursal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parcial),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && json.ok ? null : json.error || "No se pudo guardar";
  } catch {
    return "No se pudo guardar: revisá la conexión";
  }
}

/** La fila de `sucursales`, compartida por la barra superior, el Arranque y Configuración. */
export function SucursalProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useStore();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sucursal", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error || "No se pudo cargar el estado del local");
      setSucursal(json.data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el estado del local");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API, como el resto del panel
    void recargar();
    const alVolver = () => { if (document.visibilityState === "visible") void recargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  const cambiar = useCallback(async <K extends keyof Sucursal>(campo: K, valor: Sucursal[K], aviso?: string) => {
    if (!sucursal) return false;
    const antes = sucursal[campo];
    setSucursal((s) => (s ? { ...s, [campo]: valor } : s));
    const fallo = await enviar({ [campo]: valor } as Partial<Sucursal>);
    if (fallo) {
      setSucursal((s) => (s ? { ...s, [campo]: antes } : s));
      showToast(fallo);
      return false;
    }
    if (aviso) showToast(aviso);
    return true;
  }, [sucursal, showToast]);

  const guardar = useCallback(async (parcial: Partial<Sucursal>) => {
    const fallo = await enviar(parcial);
    if (fallo) { showToast(fallo); return false; }
    setSucursal((s) => (s ? { ...s, ...parcial } : s));
    showToast("Cambios guardados");
    return true;
  }, [showToast]);

  return <Ctx.Provider value={{ sucursal, cargando, error, recargar, cambiar, guardar }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 3: `Interruptor`**

`app/admin/components/Interruptor.tsx`:

```tsx
"use client";

interface InterruptorProps {
  checked: boolean;
  label: string;
  /** Debajo del nombre: "Tomando pedidos", "Agotada", etc. */
  detalle?: string;
  disabled?: boolean;
  title?: string;
  onChange: (valor: boolean) => void;
}

/** Interruptor accesible del Arranque: todo el recuadro es el botón. */
export function Interruptor({ checked, label, detalle, disabled, title, onChange }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`int ${checked ? "" : "apagado"}`}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="int-text"><b>{label}</b>{detalle && <small>{detalle}</small>}</span>
      <span className="int-track" aria-hidden="true" />
    </button>
  );
}
```

- [ ] **Step 4: Montar el provider**

En `app/admin/page.tsx`, `AdminPage` queda:

```tsx
export default function AdminPage() {
  return (
    <StoreProvider>
      <SucursalProvider>
        <AdminApp />
      </SucursalProvider>
    </StoreProvider>
  );
}
```

(con `import { SucursalProvider } from "./components/SucursalProvider";`).

- [ ] **Step 5: Verificar y commit**

Run: `npx tsc --noEmit && pnpm exec eslint app/admin/components/SucursalProvider.tsx app/admin/components/Interruptor.tsx app/admin/components/AdminSesion.tsx app/admin/layout.tsx app/admin/page.tsx`
Expected: sin errores.

```bash
git add app/admin/components/SucursalProvider.tsx app/admin/components/Interruptor.tsx app/admin/components/AdminSesion.tsx app/admin/layout.tsx app/admin/page.tsx
git commit -m "feat(admin): estado del local compartido, interruptor y mail de la sesión

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Navegación nueva (menú agrupado, barra superior con estado, sección inicial)

**Files:**
- Create: `app/admin/components/Topbar.tsx`
- Create: `app/admin/components/EstadoLocal.tsx`
- Modify: `app/admin/components/Dashboard.tsx` (quitar `Topbar`)
- Modify: `app/admin/components/Sidebar.tsx`
- Modify: `app/admin/components/Icons.tsx` (íconos nuevos)
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `SeccionAdmin`, `seccionInicial`, `esSeccionAdmin` (Task 3); `useSucursal` (Task 5); `estadoMasas(config)` y `masaUnica(estado)` de `lib/masa.ts`; `useAdminSesion` (Task 5).
- Produces:
  - `<Topbar title subtitle onMenu right? />` (con `EstadoLocal` y el sonido; la búsqueda se suma en la Task 11)
  - `<EstadoLocal onIr={() => void} />`
  - `<Sidebar current: SeccionAdmin onNav: (s: SeccionAdmin) => void open onClose />`
  - En `page.tsx`: `irA(seccion: SeccionAdmin)` (guarda en `sessionStorage` la clave `impasto_admin_seccion`).

- [ ] **Step 1: Íconos**

En `app/admin/components/Icons.tsx`, agregar al objeto `Icon` (mismo estilo `s`):

```tsx
  Power: () => <svg {...s}><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>,
  Calendar: () => <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Tag: () => <svg {...s}><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  More: () => <svg {...sm}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>,
```

- [ ] **Step 2: `EstadoLocal`**

`app/admin/components/EstadoLocal.tsx`:

```tsx
"use client";
import { useSucursal } from "./SucursalProvider";
import { estadoMasas, masaUnica, nombreMasa } from "@/lib/masa";

/** Venta · Delivery · Masas, siempre a la vista. Tocar una lleva al Arranque, donde se cambia. */
export function EstadoLocal({ onIr }: { onIr: () => void }) {
  const { sucursal, error } = useSucursal();
  if (error && !sucursal) return <button className="pill pill-warn" onClick={onIr}>Estado del local sin cargar</button>;
  if (!sucursal) return null;
  const masas = estadoMasas({ masaNapoletanaActiva: sucursal.masa_napoletana_activa, masaMoldeActiva: sucursal.masa_molde_activa });
  const queda = masaUnica(masas);
  const delivery = sucursal.delivery_activo !== false;
  return (
    <div className="estado-local" aria-label="Estado del local">
      <button className={`pill ${sucursal.ventas_activas ? "pill-ok" : "pill-off"}`} onClick={onIr}>
        {sucursal.ventas_activas ? "Tomando pedidos" : "Venta pausada"}
      </button>
      <button className={`pill ${delivery ? "pill-ok" : "pill-off"}`} onClick={onIr}>
        {delivery ? "Delivery" : "Solo retiro"}
      </button>
      <button className={`pill ${queda ? "pill-warn" : "pill-ok"}`} onClick={onIr}>
        {queda ? `Solo masa ${nombreMasa(queda)}` : "Dos masas"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `Topbar` propio**

`app/admin/components/Topbar.tsx` (sale de `Dashboard.tsx`, sin el buscador falso):

```tsx
"use client";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { EstadoLocal } from "./EstadoLocal";

export function Topbar({ title, subtitle, onMenu, onEstado, buscador, right }: {
  title: string; subtitle: string; onMenu: () => void; onEstado: () => void; buscador?: React.ReactNode; right?: React.ReactNode;
}) {
  const { soundEnabled, toggleSound } = useStore();
  return (
    <header className="topbar">
      <button className="sidebar-toggle" onClick={onMenu} aria-label="Abrir el menú"><Icon.Menu /></button>
      <h1>{title}{subtitle && <small>{subtitle}</small>}</h1>
      <EstadoLocal onIr={onEstado} />
      <div className="topbar-spacer" />
      {buscador}
      <button
        className={`btn btn-sm ${soundEnabled ? "btn-ghost" : "btn-muted"}`}
        onClick={toggleSound}
        title={soundEnabled ? "Sonido de pedidos nuevos activado (clic para silenciar)" : "Sonido silenciado (clic para activar)"}
      >
        {soundEnabled ? <Icon.Volume2 /> : <Icon.VolumeX />}
        <span>{soundEnabled ? "Sonido" : "Silenciado"}</span>
      </button>
      {right}
    </header>
  );
}
```

En `app/admin/components/Dashboard.tsx`, borrar la función `Topbar` (líneas 17–41) y el import de `Icon.Search` si queda sin uso.

- [ ] **Step 4: `Sidebar` agrupado**

Reemplazar el cuerpo de `app/admin/components/Sidebar.tsx`:

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useStore } from "./StoreProvider";
import { useAdminSesion } from "./AdminSesion";
import { Icon } from "./Icons";
import type { SeccionAdmin } from "@/lib/inicio-admin";

interface SidebarProps {
  current: SeccionAdmin;
  onNav: (seccion: SeccionAdmin) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ current, onNav, open, onClose }: SidebarProps) {
  const router = useRouter();
  const { state } = useStore();
  const { email } = useAdminSesion();
  const nuevos = state.orders.filter((o) => o.estado === "nuevo").length;
  const opinionesPendientes = state.testimonials.filter((t) => t.estado === "pendiente").length;

  const grupos: { titulo: string; items: { key: SeccionAdmin; label: string; icon: React.ReactNode; badge?: number }[] }[] = [
    { titulo: "Esta noche", items: [
      { key: "arranque", label: "Arranque", icon: <Icon.Power /> },
      { key: "pedidos", label: "Pedidos", icon: <Icon.Orders />, badge: nuevos },
      { key: "resumen", label: "Resumen diario", icon: <Icon.Calendar /> },
    ] },
    { titulo: "Carta", items: [
      { key: "productos", label: "Productos", icon: <Icon.Pizza /> },
      { key: "etiquetas", label: "Etiquetas", icon: <Icon.Tag /> },
    ] },
    { titulo: "Negocio", items: [
      { key: "dashboard", label: "Dashboard", icon: <Icon.Dashboard /> },
      { key: "clientes", label: "Clientes", icon: <Icon.Users /> },
      { key: "testimonios", label: "Testimonios", icon: <Icon.Star />, badge: opinionesPendientes },
    ] },
    { titulo: "Ajustes", items: [
      { key: "configuracion", label: "Configuración", icon: <Icon.Settings /> },
    ] },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo-mark">I</div>
          <div className="sidebar-brand-name">Impasto<small>Panel</small></div>
        </div>
        {grupos.map((g) => (
          <div key={g.titulo}>
            <div className="nav-group">{g.titulo}</div>
            {g.items.map((i) => (
              <button key={i.key} className={`nav-item ${current === i.key ? "active" : ""}`} aria-current={current === i.key ? "page" : undefined} onClick={() => { onNav(i.key); onClose(); }}>
                {i.icon}<span>{i.label}</span>{(i.badge ?? 0) > 0 && <span className="badge">{i.badge}</span>}
              </button>
            ))}
          </div>
        ))}
        <a className="nav-item" href="/" target="_blank" rel="noreferrer"><Icon.ExternalLink /><span>Ver sitio público</span></a>
        <div className="sidebar-footer">
          <div className="sidebar-footer-info"><b title={email}>{email || "Sesión iniciada"}</b><small>Administrador</small></div>
          <button className="sidebar-signout" onClick={async () => { await fetch("/api/auth/sign-out", { method: "POST" }); router.replace("/admin-login"); router.refresh(); }}>Salir</button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 5: `page.tsx` con secciones nuevas y sección inicial**

Reemplazar `AdminApp` en `app/admin/page.tsx`. `Arranque` todavía no existe: en esta tarea se usa un marcador temporal que la Task 8 reemplaza.

```tsx
"use client";
import { useEffect, useState } from "react";
import { StoreProvider } from "./components/StoreProvider";
import { SucursalProvider, useSucursal } from "./components/SucursalProvider";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Dashboard } from "./components/Dashboard";
import { Orders } from "./components/Orders";
import { NotificationsRecovery } from "./components/NotificationsRecovery";
import { Products } from "./components/Products";
import { Etiquetas } from "./components/Etiquetas";
import { Customers } from "./components/Customers";
import { Testimonials } from "./components/Testimonials";
import { Settings } from "./components/Settings";
import { ResumenDiario } from "./components/ResumenDiario";
import { Cupos } from "./components/Cupos";
import { seccionInicial, type SeccionAdmin } from "@/lib/inicio-admin";

const CLAVE_SECCION = "impasto_admin_seccion";

const TITLES: Record<SeccionAdmin, [string, string]> = {
  arranque:      ["Arranque de la noche", "Venta, delivery, masas, cupos y pedidos activos"],
  pedidos:       ["Pedidos", "Los pedidos de la web y del POS"],
  resumen:       ["Resumen diario", "Pizzas, pedidos y cobros de cada noche"],
  productos:     ["Productos", "Pizzas, empanadas y bebidas de la carta"],
  etiquetas:     ["Etiquetas", "Los cartelitos de las tarjetas del sitio"],
  dashboard:     ["Dashboard", "Cómo vienen las ventas"],
  clientes:      ["Clientes", "Base de clientes y su historial"],
  testimonios:   ["Testimonios", "Opiniones que aparecen en el sitio"],
  configuracion: ["Configuración", "Horario, delivery, datos del local y cuentas"],
};

const leerGuardada = () => { try { return sessionStorage.getItem(CLAVE_SECCION); } catch { return null; } };

function AdminApp() {
  const { sucursal, cargando } = useSucursal();
  const [page, setPage] = useState<SeccionAdmin | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // La sección inicial depende de los días de apertura: se decide cuando llega la sucursal.
  useEffect(() => {
    if (page || cargando) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se decide una sola vez, al cargar la sucursal
    setPage(seccionInicial(sucursal?.dias_apertura, new Date(), leerGuardada()));
  }, [page, cargando, sucursal]);

  const irA = (seccion: SeccionAdmin) => {
    setPage(seccion);
    try { sessionStorage.setItem(CLAVE_SECCION, seccion); } catch { /* sin sessionStorage, no se recuerda */ }
  };

  const actual = page ?? "dashboard";
  const [title, subtitle] = TITLES[actual];

  return (
    <div className="admin">
      <Sidebar current={actual} onNav={irA} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar title={title} subtitle={subtitle} onMenu={() => setSidebarOpen(true)} onEstado={() => irA("arranque")} />
        <div className="content">
          {page === null && <div className="text-muted">Cargando…</div>}
          {page === "arranque"      && <Cupos />}
          {page === "pedidos"       && <><NotificationsRecovery /><Orders /></>}
          {page === "resumen"       && <ResumenDiario />}
          {page === "productos"     && <Products />}
          {page === "etiquetas"     && <Etiquetas />}
          {page === "dashboard"     && <Dashboard />}
          {page === "clientes"      && <Customers />}
          {page === "testimonios"   && <Testimonials />}
          {page === "configuracion" && <Settings />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar y commit**

Run: `npx tsc --noEmit && pnpm exec eslint app/admin/page.tsx app/admin/components/Sidebar.tsx app/admin/components/Topbar.tsx app/admin/components/EstadoLocal.tsx app/admin/components/Dashboard.tsx app/admin/components/Icons.tsx`
Expected: sin errores.

En el navegador (sesión del dueño): el menú muestra los 4 grupos, el pie el mail, las píldoras el estado real, un día de apertura abre "Arranque" (hoy con la lista de cupos), recargar la pestaña vuelve a la última sección, y a 375 px el menú abre con la hamburguesa y se cierra tocando afuera.

```bash
git add app/admin/page.tsx app/admin/components/Sidebar.tsx app/admin/components/Topbar.tsx app/admin/components/EstadoLocal.tsx app/admin/components/Dashboard.tsx app/admin/components/Icons.tsx
git commit -m "feat(admin): menú por momento de uso, estado del local arriba y sección inicial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pedidos compactos

**Files:**
- Create: `app/admin/components/OrderDetail.tsx` (mover `RefundBox`, `OrderDetail`, `ComandaTicket` y `whatsappDelPedido` desde `Orders.tsx`, sin cambios de lógica)
- Create: `app/admin/components/OrdersTable.tsx`
- Modify: `app/admin/components/Orders.tsx`
- Modify: `app/admin/components/NotificationsRecovery.tsx`

**Interfaces:**
- Consumes: `esActivo`, `siguienteEstado`, `numeroCorto`, `resumenItems`, `etiquetaEstado` (Task 2); `useStore().updateOrderStatus(dbId, estado): Promise<boolean>`; `esPedidoParaCocina`.
- Produces:
  - `export function Orders({ soloActivos }: { soloActivos?: boolean })` — `soloActivos` oculta filtros y menú (lo usa el Arranque).
  - `export function OrdersTable(props: { pedidos: AdminOrder[]; onAbrir: (o: AdminOrder) => void; onAvanzar: (o: AdminOrder, estado: string) => void; onImprimir: (o: AdminOrder) => void; imprimiendo: boolean; seleccionando: boolean; marcados: Set<string>; onMarcar: (id: string, marcado: boolean) => void; onMarcarTodos: (marcado: boolean) => void })`
  - `export function TelCliente({ order }: { order: AdminOrder })` (en `OrdersTable.tsx`)
  - `export function OrderDetail(...)` (misma firma que hoy) y `export function ComandaTicket(...)` en `OrderDetail.tsx`.

- [ ] **Step 1: Mover el detalle**

Crear `app/admin/components/OrderDetail.tsx` con `"use client";`, los imports que usan esas funciones (`useState`, `useEffect`, `loadProviderRefundIntent`, `prepareProviderRefundIntent`, `completeProviderRefundIntent`, `ManualRefundBox`, `ManualRefund`, `Icon`, `AdminOrder`, `esPedidoParaCocina`, `enlaceWhatsapp`, `mensajeAlCliente`, `whatsappDeCliente`, `detalleCocina`, `masaCocina`, `nombreCocina`), los helpers `fmt`, `timeAgo`, `fmtDateTime`, `whatsappDelPedido`, y las funciones `RefundBox`, `OrderDetail` (ahora `export function OrderDetail`) y `ComandaTicket` copiadas tal cual desde `Orders.tsx` (líneas 287–611 de hoy). Borrarlas de `Orders.tsx`.

En `OrderDetail`, cambiar el título del detalle a `Pedido {numeroCorto(order)}` y agregar debajo de la fecha la referencia larga: `<small>{fmtDateTime(order.fecha)} · {timeAgo(order.fecha)} · {order.id}</small>`, y el chip a `{etiquetaEstado(order.estado, order.mode)}` (imports de `@/lib/admin-pedidos`).

Run: `npx tsc --noEmit`
Expected: sin errores (Orders.tsx importa `OrderDetail` desde `./OrderDetail`).

- [ ] **Step 2: `OrdersTable`**

`app/admin/components/OrdersTable.tsx`:

```tsx
"use client";
import { Icon } from "./Icons";
import type { AdminOrder } from "./types";
import { esPedidoParaCocina } from "@/lib/pedido-visible";
import { etiquetaEstado, numeroCorto, resumenItems, siguienteEstado } from "@/lib/admin-pedidos";
import { enlaceWhatsapp, mensajeAlCliente, whatsappDeCliente } from "@/lib/contacto";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const hace = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
};
const medio = (o: AdminOrder) => (o.pago === "mercadopago" ? "Mercado Pago" : o.pago.charAt(0).toUpperCase() + o.pago.slice(1));

/** El teléfono en la lista: abre el chat de WhatsApp sin abrir el detalle. */
export function TelCliente({ order }: { order: AdminOrder }) {
  const numero = whatsappDeCliente(order.tel);
  if (!numero) return <span className="tbl-muted">{order.tel}</span>;
  return (
    <a className="tbl-muted tbl-wa" href={enlaceWhatsapp(numero, mensajeAlCliente(order.cliente, order.id))} target="_blank" rel="noreferrer" title={`Escribirle a ${order.cliente} por WhatsApp`} onClick={(e) => e.stopPropagation()}>
      <Icon.Whatsapp /> {order.tel}
    </a>
  );
}

function AvisoPago({ o }: { o: AdminOrder }) {
  if (o.estado === "cancelado") return null;
  if (o.pago === "transferencia" && o.pagoEstado === "pendiente") {
    return <span className="order-payment-reminder">{o.comprobanteSubidoAt ? "📎 comprobante" : "sin comprobante"}</span>;
  }
  if (o.pagoEstado === "pendiente") {
    return <span className="order-payment-reminder">{o.estado === "entregado" ? "falta registrar pago" : "pago pendiente"}</span>;
  }
  return null;
}

interface OrdersTableProps {
  pedidos: AdminOrder[];
  onAbrir: (o: AdminOrder) => void;
  onAvanzar: (o: AdminOrder, estado: string) => void;
  onImprimir: (o: AdminOrder) => void;
  imprimiendo: boolean;
  seleccionando: boolean;
  marcados: Set<string>;
  onMarcar: (id: string, marcado: boolean) => void;
  onMarcarTodos: (marcado: boolean) => void;
}

/** Una fila por pedido (~44 px); en el celular, una tarjeta. Avanzar e imprimir sin abrir el detalle. */
export function OrdersTable({ pedidos, onAbrir, onAvanzar, onImprimir, imprimiendo, seleccionando, marcados, onMarcar, onMarcarTodos }: OrdersTableProps) {
  const acciones = (o: AdminOrder, ancho = false) => {
    const sig = siguienteEstado(o);
    const cocina = esPedidoParaCocina(o);
    return (
      <>
        {sig && (
          <button className="btn-next" style={ancho ? { flex: 1, justifyContent: "center" } : undefined} onClick={(e) => { e.stopPropagation(); onAvanzar(o, sig.estado); }}>
            → {sig.etiqueta}
          </button>
        )}
        {!sig && o.pago === "mercadopago" && !cocina && o.estado !== "cancelado" && <span className="tbl-muted">tarjeta sin acreditar</span>}
        <button className="btn btn-icon btn-ghost" title={cocina ? "Imprimir comanda" : "Pago sin acreditar: la comanda está bloqueada"} aria-label={`Imprimir el pedido ${numeroCorto(o)}`} disabled={!cocina || imprimiendo} onClick={(e) => { e.stopPropagation(); onImprimir(o); }}>
          <Icon.Printer />
        </button>
      </>
    );
  };

  return (
    <>
      <div className="tbl-wrap ord-tabla">
        <table className="tbl">
          <thead>
            <tr>
              {seleccionando && <th style={{ width: 32 }}><input type="checkbox" aria-label="Seleccionar todos" checked={pedidos.length > 0 && pedidos.every((o) => marcados.has(o._dbId))} onChange={(e) => onMarcarTodos(e.target.checked)} /></th>}
              <th>#</th><th>Cliente</th><th>Pedido</th><th>Entrega</th><th>Pago</th><th className="right">Total</th><th>Estado</th><th className="right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((o) => {
              const items = resumenItems(o.items);
              return (
                <tr key={o._dbId} className={o.pagoEstado === "pendiente" && o.estado !== "cancelado" ? "order-payment-pending" : undefined} style={{ cursor: "pointer" }} onClick={() => onAbrir(o)}>
                  {seleccionando && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar el pedido ${numeroCorto(o)}`} checked={marcados.has(o._dbId)} onChange={(e) => onMarcar(o._dbId, e.target.checked)} /></td>}
                  <td className="tbl-mono tbl-strong nowrap">{numeroCorto(o)}</td>
                  <td className="nowrap"><span className="tbl-strong">{o.cliente}</span> <span className="tbl-muted">· {hace(o.fecha)}</span><div><TelCliente order={o} /></div></td>
                  <td className="ellipsis" style={{ width: "32%" }} title={o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}>{items.texto}{items.resto > 0 && <span className="tbl-muted"> +{items.resto}</span>}</td>
                  <td className="nowrap"><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{o.mode === "delivery" ? <Icon.Truck /> : <Icon.Shop />}{o.mode === "delivery" ? "Delivery" : "Retiro"}</span></td>
                  <td className="nowrap">{medio(o)}<AvisoPago o={o} /></td>
                  <td className="right tbl-price nowrap">{fmt(o.total)}</td>
                  <td className="nowrap"><span className={`chip chip-${o.estado}`}>{etiquetaEstado(o.estado, o.mode)}</span></td>
                  <td className="right nowrap"><div className="tbl-actions" style={{ alignItems: "center" }}>{acciones(o)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ord-cards">
        {pedidos.map((o) => {
          const items = resumenItems(o.items, 40);
          return (
            <div key={o._dbId} className={`ord-card ${o.pagoEstado === "pendiente" && o.estado !== "cancelado" ? "pendiente" : ""}`} onClick={() => onAbrir(o)}>
              <div className="ord-card-top"><b className="tbl-mono">{numeroCorto(o)}</b><span className={`chip chip-${o.estado}`}>{etiquetaEstado(o.estado, o.mode)}</span></div>
              <div><b>{o.cliente}</b> · {o.mode === "delivery" ? "Delivery" : "Retiro"} · <b>{fmt(o.total)}</b> <span className="tbl-muted">· {hace(o.fecha)}</span></div>
              <div className="tbl-muted ord-card-items">{items.texto}{items.resto > 0 && ` +${items.resto}`}</div>
              <div className="tbl-muted">{medio(o)}<AvisoPago o={o} /></div>
              <div className="ord-card-acciones">{acciones(o, true)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

Agregar a `admin.css` (bloque nuevo `/* ============ PEDIDOS ============ */`):

```css
.ord-cards{ display:none; }
@media (max-width:760px){
  .ord-tabla{ display:none; }
  .ord-cards{ display:flex; flex-direction:column; gap:8px; padding:10px; }
  .ord-card{ background:var(--a-surface); border:1px solid var(--a-line); border-radius:var(--a-radius); padding:10px 12px; display:flex; flex-direction:column; gap:4px; font-size:13px; }
  .ord-card.pendiente{ border-left:3px solid var(--a-warn); }
  .ord-card-top{ display:flex; justify-content:space-between; align-items:center; }
  .ord-card-items{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ord-card-acciones{ display:flex; gap:6px; align-items:center; margin-top:4px; }
  .ord-card-acciones .btn-next{ padding:8px 10px; font-size:13px; }
}
```

- [ ] **Step 3: `Orders.tsx` con Activos, menú "⋯" y `soloActivos`**

En `Orders.tsx`:

1. Firma: `export function Orders({ soloActivos = false }: { soloActivos?: boolean })`.
2. Filtros: reemplazar `FILTERS` por

```tsx
const FILTERS: [string, string][] = [["activos","Activos"],["nuevo","Nuevos"],["preparando","Preparando"],["en-camino","En camino"],["entregado","Entregados"],["cancelado","Cancelados"],["todos","Todos"]];
```

con `useState("activos")`, y en `filtered`:

```tsx
if (soloActivos || filter === "activos") list = list.filter(esActivo);
else if (filter !== "todos") list = list.filter(o => o.estado === filter);
if (q.trim()) {
  const t = q.trim().toLowerCase();
  list = list.filter(o => (numeroCorto(o) + " " + o.id + " " + o.cliente + " " + o.tel).toLowerCase().includes(t));
}
```

y `counts.activos = state.orders.filter(esActivo).length;`.
3. Estado nuevo: `const [seleccionando, setSeleccionando] = useState(false);` y `const [menu, setMenu] = useState(false);`.
4. Cabecera (`panel-head`): si `soloActivos`, solo `<h3>Pedidos activos</h3>`. Si no: el `seg` de filtros, el buscador y el menú:

```tsx
<div className="menu-mas">
  <button className="btn btn-ghost btn-icon" aria-label="Más opciones" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Icon.More /></button>
  {menu && (
    <div className="menu-mas-pop" onMouseLeave={() => setMenu(false)}>
      <button onClick={() => { setSeleccionando(s => !s); setMarcados(new Set()); setMenu(false); }}>{seleccionando ? "Terminar selección" : "Seleccionar pedidos"}</button>
      <button onClick={() => { setMenu(false); void pairPrinter(); }}>Emparejar impresora</button>
      <label>Impresora de Impasto
        {/* el <select> de impresora actual, sin cambios */}
      </label>
    </div>
  )}
</div>
```

5. Barra de selección (cuando `seleccionando`): `<b>{marcados.size} seleccionado(s)</b>`, botón "Eliminar seleccionados" (el actual, con `eliminar([...marcados])`) y "Deseleccionar".
6. Reemplazar la `<table>` entera por:

```tsx
<OrdersTable
  pedidos={filtered}
  onAbrir={setSelected}
  onAvanzar={(o, estado) => void updateOrderStatus(o._dbId, estado)}
  onImprimir={(o) => void printOrder(o)}
  imprimiendo={printing}
  seleccionando={seleccionando && !soloActivos}
  marcados={marcados}
  onMarcar={(id, marcado) => setMarcados(prev => { const sig = new Set(prev); if (marcado) sig.add(id); else sig.delete(id); return sig; })}
  onMarcarTodos={(marcado) => setMarcados(marcado ? new Set(filtered.map(o => o._dbId)) : new Set())}
/>
{filtered.length === 0 && <div className="empty"><b>{soloActivos || filter === "activos" ? "No hay pedidos activos" : "Sin pedidos"}</b><div>{soloActivos || filter === "activos" ? "Los pedidos nuevos aparecen acá solos." : "No hay pedidos con ese filtro."}</div></div>}
```

7. Borrar `TelCliente` de `Orders.tsx` (ahora vive en `OrdersTable.tsx`) e importar `OrdersTable` y `OrderDetail`. El mensaje de impresión (`printState`) queda como está.

- [ ] **Step 4: Avisos pendientes solo si hay**

En `NotificationsRecovery.tsx`, cargar al montar y no renderizar nada si no hay filas ni error:

```tsx
import { useEffect, useState } from 'react';
// … dentro del componente, después de declarar load():
useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- una consulta al abrir Pedidos
if (loaded && rows.length === 0 && !error) return null;
if (!loaded && !error) return null;
```

(El `return null` va después de los hooks, antes del `return <section…>`.) Cambiar `className="card"` por `className="panel"` y el `style` a `{ padding: 12, marginBottom: 12 }`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && pnpm test && pnpm exec eslint app/admin/components/Orders.tsx app/admin/components/OrdersTable.tsx app/admin/components/OrderDetail.tsx app/admin/components/NotificationsRecovery.tsx`
Expected: tsc y tests sin errores; eslint sin errores nuevos.

En el navegador (sesión del dueño), Pedidos a 1366 px:

```js
({ filas: [...new Set([...document.querySelectorAll('.ord-tabla tbody tr')].slice(0, 8).map(r => r.offsetHeight))], desborde: document.querySelector('.ord-tabla').scrollWidth > document.querySelector('.ord-tabla').clientWidth, primera: document.querySelector('.ord-tabla tbody td.tbl-mono')?.textContent })
```
Expected: filas ≤ 48 (filas con aviso de pago pueden llegar a ~56 por el teléfono en segunda línea), `desborde: false`, número corto. Filtros: Activos/Entregados/Todos con contadores. Abrir un pedido entregado: el detalle es el de siempre. **No tocar "→" sobre pedidos reales activos sin permiso del dueño**: para probar el botón, pedirle al dueño un pedido de prueba o que lo toque él. A 375 px: tarjetas con el botón a todo el ancho.

- [ ] **Step 6: Commit**

```bash
git add app/admin/components/Orders.tsx app/admin/components/OrdersTable.tsx app/admin/components/OrderDetail.tsx app/admin/components/NotificationsRecovery.tsx app/admin/admin.css
git commit -m "feat(admin): pedidos compactos con avanzar e imprimir en la fila

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Arranque de la noche

**Files:**
- Create: `app/admin/components/Arranque.tsx`
- Modify: `app/admin/components/Cupos.tsx` (compacto, ordenado)
- Modify: `app/admin/page.tsx` (`arranque` → `<Arranque />`)
- Modify: `app/admin/admin.css` (bloque `ARRANQUE`)

**Interfaces:**
- Consumes: `useSucursal()` (Task 5), `Interruptor` (Task 5), `estadoMasas`, `MENSAJE_DELIVERY_DEFAULT` (`lib/hours.ts`), `Orders({ soloActivos: true })` (Task 7), `useCuposNoche`, `CupoControl`.
- Produces: `export function Arranque({ onVerPedidos }: { onVerPedidos: () => void })`; `Orders` suma la prop `onVerTodos?: () => void` (solo se usa con `soloActivos`).

- [ ] **Step 1: Cupos compactos y ordenados**

En `Cupos.tsx`: ordenar las pizzas con las agotadas y las de 2 o menos primero, y achicar el texto de ayuda:

```tsx
const pizzas = useMemo(() => {
  const lista = state.products.filter((p) => /pizz/i.test(p.categoria) && !p.archivado);
  const prioridad = (id: string) => { const n = cupos.quedan(id); return n === 0 ? 0 : n <= 2 ? 1 : 2; };
  return lista.sort((a, b) => prioridad(a._dbId) - prioridad(b._dbId) || a.nombre.localeCompare(b.nombre));
}, [state.products, cupos]);
```

Título del panel: `Cupos {cupos.noche ? `· ${etiquetaDia(cupos.noche)}` : "de esta noche"}`. Ayuda en una línea: `Arrancan en 100 (sin límite). Bajá las que tenés pocas; cada venta descuenta sola y a las 06:00 vuelve todo a 100.` Fila con 2 o menos: clase `cupo-poco` (además de `cupo-agotado` en 0). En `admin.css`: `.cupos-tbl tbody tr.cupo-poco{ background:var(--a-warn-soft); }` y `.cupos-tbl tbody tr.cupo-agotado{ background:var(--a-danger-soft); }`.

- [ ] **Step 2: `Arranque.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useSucursal } from "./SucursalProvider";
import { Interruptor } from "./Interruptor";
import { Cupos } from "./Cupos";
import { Orders } from "./Orders";
import { estadoMasas } from "@/lib/masa";
import { MENSAJE_DELIVERY_DEFAULT } from "@/lib/hours";

/** Un motivo para el cliente: se guarda al salir del campo o con Enter, no en cada tecla. */
function Motivo({ valor, placeholder, onGuardar }: { valor: string; placeholder: string; onGuardar: (texto: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const guardar = () => { if (texto.trim() !== valor.trim()) onGuardar(texto.trim()); };
  return (
    <div className="field int-motivo">
      <label>Lo que ve el cliente</label>
      <input value={texto} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

/**
 * Lo que se toca al empezar la noche (pedido del dueño, 22/10/2026): venta, delivery y masas
 * (se guardan al tocarlos), cupos y los pedidos activos.
 */
export function Arranque({ onVerPedidos }: { onVerPedidos: () => void }) {
  const { sucursal, error, recargar, cambiar } = useSucursal();

  if (!sucursal) {
    return (
      <div className="panel"><div className="panel-body">
        {error ? <>No se pudo cargar el estado del local. <button className="btn btn-ghost btn-sm" onClick={() => void recargar()}>Reintentar</button></> : "Cargando…"}
      </div></div>
    );
  }

  const delivery = sucursal.delivery_activo !== false;
  const napoletana = sucursal.masa_napoletana_activa !== false;
  const molde = sucursal.masa_molde_activa !== false;
  const avisoMasas = estadoMasas({ masaNapoletanaActiva: napoletana, masaMoldeActiva: molde }).aviso;

  return (
    <div className="arranque">
      <section className="panel">
        <div className="panel-head"><h3>Interruptores</h3><span className="tbl-muted">Se guardan al tocarlos</span></div>
        <div className="panel-body int-grid">
          <Interruptor checked={sucursal.ventas_activas} label="Tomando pedidos" detalle={sucursal.ventas_activas ? "La web acepta pedidos en horario" : "La web no toma pedidos"}
            onChange={(v) => void cambiar("ventas_activas", v, v ? "Venta prendida" : "Venta pausada")} />
          <Interruptor checked={delivery} label="Delivery" detalle={delivery ? "Haciendo envíos" : "Solo retiro"}
            onChange={(v) => void cambiar("delivery_activo", v, v ? "Delivery prendido" : "Delivery pausado")} />
          <Interruptor checked={napoletana} label="Masa napoletana" detalle={napoletana ? "Disponible" : "Agotada"} disabled={napoletana && !molde}
            title={napoletana && !molde ? "La al molde está agotada: tiene que quedar al menos una masa" : undefined}
            onChange={(v) => void cambiar("masa_napoletana_activa", v, v ? "Napoletana disponible" : "Napoletana agotada")} />
          <Interruptor checked={molde} label="Masa al molde" detalle={molde ? "Disponible" : "Agotada"} disabled={molde && !napoletana}
            title={molde && !napoletana ? "La napoletana está agotada: tiene que quedar al menos una masa" : undefined}
            onChange={(v) => void cambiar("masa_molde_activa", v, v ? "Al molde disponible" : "Al molde agotada")} />
          {!sucursal.ventas_activas && (
            <Motivo key="cierre" valor={sucursal.mensaje_cierre || ""} placeholder="Cerramos por vacaciones hasta el 5 de enero"
              onGuardar={(t) => void cambiar("mensaje_cierre", t, "Motivo guardado")} />
          )}
          {!delivery && (
            <Motivo key="delivery" valor={sucursal.mensaje_delivery || ""} placeholder={MENSAJE_DELIVERY_DEFAULT}
              onGuardar={(t) => void cambiar("mensaje_delivery", t, "Motivo guardado")} />
          )}
          {avisoMasas && <div className="int-motivo tbl-muted">El cliente ve: “{avisoMasas}”</div>}
        </div>
      </section>
      <div className="arranque-grid">
        <Cupos />
        <section className="panel"><Orders soloActivos onVerTodos={onVerPedidos} /></section>
      </div>
    </div>
  );
}
```

En `Orders.tsx`, la cabecera con `soloActivos` queda: `<h3>Pedidos activos</h3><div className="panel-head-spacer" />{onVerTodos && <button className="btn btn-ghost btn-sm" onClick={onVerTodos}>Ver todos los pedidos</button>}` (firma: `export function Orders({ soloActivos = false, onVerTodos }: { soloActivos?: boolean; onVerTodos?: () => void })`; la Task 12 le suma `abrirId`).

Nota: `Orders` hoy envuelve su contenido en `<div className="panel">`. Con `soloActivos`, que no lo envuelva (devolver el contenido con `<>`), para no anidar paneles; ajustar en `Orders.tsx`: `const Envoltorio = soloActivos ? Fragment : "div"` no sirve con `className`, así que usar `soloActivos ? <>{contenido}</> : <div className="panel">{contenido}</div>` armando `contenido` como variable.

CSS (`admin.css`, bloque nuevo):

```css
/* ============ ARRANQUE ============ */
.arranque{ display:flex; flex-direction:column; gap:12px; }
.arranque-grid{ display:grid; grid-template-columns:minmax(280px, 1fr) 2fr; gap:12px; align-items:start; }
@media (max-width:1100px){ .arranque-grid{ grid-template-columns:1fr; } }
```

- [ ] **Step 3: Conectar en `page.tsx`**

Reemplazar `{page === "arranque" && <Cupos />}` por `{page === "arranque" && <Arranque onVerPedidos={() => irA("pedidos")} />}`, importar `Arranque` y quitar el import de `Cupos` de `page.tsx`.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && pnpm exec eslint app/admin/components/Arranque.tsx app/admin/components/Cupos.tsx app/admin/components/Orders.tsx app/admin/page.tsx`
Expected: sin errores.

En el navegador, **solo con permiso del dueño en ese momento** (el panel local escribe en la base real, así que el cambio se ve también en la web publicada): apagar y prender **Delivery** y **Masa al molde**, y confirmar que la píldora de arriba cambia, que aparece el aviso y que `http://localhost:3000/api/store-status` muestra el cambio. Dejar todo como estaba y confirmarlo con el mismo endpoint. Intentar apagar la napoletana con el molde apagado: el interruptor está deshabilitado. A 375 px: interruptores en una columna, cupos y pedidos debajo.

- [ ] **Step 5: Commit**

```bash
git add app/admin/components/Arranque.tsx app/admin/components/Cupos.tsx app/admin/components/Orders.tsx app/admin/page.tsx app/admin/admin.css
git commit -m "feat(admin): Arranque de la noche con interruptores, cupos y pedidos activos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Configuración en pestañas

**Files:**
- Modify: `app/admin/components/Settings.tsx`

**Interfaces:**
- Consumes: `useSucursal()` (`sucursal`, `guardar`), tipo `Sucursal`.
- Produces: `export function Settings()` con pestañas `horario | delivery | datos | cuentas`.

- [ ] **Step 1: Reescribir la estructura**

Cambios en `Settings.tsx`:

1. Borrar la interfaz local `Sucursal`, el `fetch` inicial y el `useEffect`: usar `const { sucursal, guardar } = useSucursal();`.
2. Borrador por pestaña: `const [config, setConfig] = useState<Sucursal | null>(sucursal);` y, cuando llega la sucursal por primera vez, inicializar con el patrón de ajuste en render:

```tsx
const [base, setBase] = useState(sucursal);
if (sucursal && base !== sucursal && !sucio) { setBase(sucursal); setConfig(sucursal); }
```

donde `const sucio = !!config && !!base && JSON.stringify(camposDe(pestana, config)) !== JSON.stringify(camposDe(pestana, base));`.
3. Pestañas y campos:

```tsx
type Pestana = "horario" | "delivery" | "datos" | "cuentas";
const PESTANAS: [Pestana, string][] = [["horario", "Horario"], ["delivery", "Delivery"], ["datos", "Datos del local"], ["cuentas", "Cuentas para transferencias"]];
const CAMPOS: Record<Pestana, (keyof Sucursal)[]> = {
  horario: ["dias_apertura", "hora_apertura", "hora_cierre", "horarios"],
  delivery: ["delivery_fee", "envio_gratis_desde"],
  datos: ["nombre", "telefono", "email", "whatsapp", "direccion", "ciudad"],
  cuentas: ["cuentas_transferencia"],
};
const camposDe = (p: Pestana, c: Sucursal) => Object.fromEntries(CAMPOS[p].map((k) => [k, c[k]]));
```

4. Cambiar de pestaña con cambios sin guardar pide confirmación:

```tsx
const irA = (p: Pestana) => {
  if (sucio && !confirm("Tenés cambios sin guardar en esta pestaña. ¿Descartarlos?")) return;
  setConfig(base);
  setPestana(p);
};
```

y un aviso del navegador al salir de la página:

```tsx
useEffect(() => {
  if (!sucio) return;
  const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
  window.addEventListener("beforeunload", avisar);
  return () => window.removeEventListener("beforeunload", avisar);
}, [sucio]);
```

5. Guardar solo los campos de la pestaña (los números como `Number`):

```tsx
const onGuardar = async () => {
  if (!config) return;
  setGuardando(true);
  const parcial = camposDe(pestana, config) as Partial<Sucursal>;
  if ("delivery_fee" in parcial) parcial.delivery_fee = Number(parcial.delivery_fee);
  if ("envio_gratis_desde" in parcial) parcial.envio_gratis_desde = Number(parcial.envio_gratis_desde);
  if (await guardar(parcial)) setBase({ ...(base as Sucursal), ...parcial });
  setGuardando(false);
};
```

6. Render: `<div className="panel"><div className="tabs">{PESTANAS.map(…)}</div><div className="panel-body" style={{ maxWidth: 640 }}>…contenido de la pestaña…</div><div className="panel-body" style={{ borderTop: "1px solid var(--a-line)", display: "flex", gap: 8, alignItems: "center" }}><button className="btn btn-primary" disabled={!sucio || guardando} onClick={onGuardar}>{guardando ? "Guardando…" : "Guardar cambios"}</button>{sucio && <span className="tbl-muted">Cambios sin guardar</span>}</div></div>`.
   - **Horario:** los botones de días, Abre / Último pedido y el texto (lo de hoy, con el párrafo de ayuda en una línea: "El último pedido es la hora en que la web deja de aceptar pedidos; el texto es lo que se muestra.").
   - **Delivery:** Tarifa de envío y Envío gratis desde (el interruptor y el motivo ya no están: viven en el Arranque; poner una línea "Para pausar el delivery, usá el Arranque.").
   - **Datos del local:** los seis campos de hoy.
   - **Cuentas:** el editor de cuentas de hoy, sin cambios de lógica.
7. Borrar las secciones Venta, Masas y Delivery-interruptor, el botón "Recargar datos" (lo reemplaza el refresco del provider) y el texto del pie.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && pnpm exec eslint app/admin/components/Settings.tsx`
Expected: sin errores.

En el navegador: "Guardar cambios" está deshabilitado sin cambios; cambiar el texto del horario sin guardar y pasar a otra pestaña pide confirmación, y al aceptar se descarta el cambio. **No guardar cambios reales sin permiso del dueño.**

- [ ] **Step 3: Commit**

```bash
git add app/admin/components/Settings.tsx
git commit -m "feat(admin): Configuración en pestañas, solo con datos que casi no cambian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dashboard por noche de servicio

**Files:**
- Create: `lib/admin-dashboard.ts`
- Test: `tests/admin-dashboard.test.ts`
- Modify: `app/admin/components/Dashboard.tsx`, `package.json`

**Interfaces:**
- Consumes: `resumenPorDia(orders, carta): ResumenDia[]` (ordenado de la noche más nueva a la más vieja), `diaDeNegocio`, `etiquetaDia`, `pizzasDeItems`, `docenasDeItems`, `CartaResumen` de `lib/resumen-diario.ts`; `esPedidoValidoParaVentas`; `contarMasas`.
- Produces:
  - `nochesParaGrafico(dias: ReadonlyArray<ResumenDia>, cantidad: number): { dia: string; etiqueta: string; total: number }[]` (de la más vieja a la más nueva)
  - `comparacionNoche(dias: ReadonlyArray<ResumenDia>, hoy: string): { actual: number; pedidos: number; web: number; pos: number; anterior: number | null; pct: number | null }`
  - `masVendidas(orders: ReadonlyArray<AdminOrder>, carta: CartaResumen, n?: number): { nombre: string; cantidad: number }[]`
  - `restarDias(dia: string, n: number): string`

- [ ] **Step 1: Test que falla**

`tests/admin-dashboard.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { comparacionNoche, masVendidas, nochesParaGrafico, restarDias } from "../lib/admin-dashboard";
import { resumenPorDia } from "../lib/resumen-diario";
import type { AdminOrder } from "../app/admin/components/types";

const carta = { pizzas: new Set(["Muzzarella Impasto", "Fugazzetta"]), empanadas: new Set(["Empanada de Carne"]) };
const pedido = (extra: Partial<AdminOrder>): AdminOrder => ({
  _dbId: Math.random().toString(36).slice(2), id: "IM-1", cliente: "", tel: "", mode: "takeaway", dir: "", zona: "",
  items: [], subtotal: 0, shipping: 0, total: 0, pago: "efectivo", pagoEstado: "aprobado", cambio: "", referencia: "",
  cuando: "asap", estado: "entregado", fecha: "2026-10-17T23:00:00.000Z", notas: "", canal: "web", ...extra,
});
// sáb 17/10 y sáb 10/10 a las 20:00 de Argentina; vie 16/10 a las 21:00
const orders = [
  pedido({ total: 30000, fecha: "2026-10-17T23:00:00.000Z", items: [{ name: "Fugazzetta", qty: 2, price: 15000, type: "pizza" }] }),
  pedido({ total: 20000, fecha: "2026-10-17T23:30:00.000Z", canal: "pos", items: [{ name: "Muzzarella Impasto", qty: 1, price: 16000, type: "" }, { name: "Coca-Cola", qty: 1, price: 4000, type: "" }] }),
  pedido({ total: 40000, fecha: "2026-10-10T23:00:00.000Z", items: [{ name: "Fugazzetta", qty: 1, price: 15000, type: "pizza" }, { name: "Caja x12", qty: 1, price: 25000, type: "empanadas" }] }),
  pedido({ total: 10000, fecha: "2026-10-17T00:00:00.000Z", items: [{ name: "Mitad Fugazzetta / Mitad Muzzarella Impasto", qty: 1, price: 10000, type: "pizza-half" }] }),
  pedido({ total: 99999, fecha: "2026-10-17T23:00:00.000Z", estado: "cancelado", items: [{ name: "Fugazzetta", qty: 9, price: 1, type: "pizza" }] }),
];
const dias = resumenPorDia(orders, carta);

test("restarDias", () => {
  assert.equal(restarDias("2026-10-17", 7), "2026-10-10");
  assert.equal(restarDias("2026-11-02", 7), "2026-10-26");
});

test("nochesParaGrafico: solo noches con ventas, de la más vieja a la más nueva", () => {
  assert.deepEqual(nochesParaGrafico(dias, 7).map((n) => [n.dia, n.total]), [["2026-10-10", 40000], ["2026-10-16", 10000], ["2026-10-17", 50000]]);
  assert.deepEqual(nochesParaGrafico(dias, 2).map((n) => n.dia), ["2026-10-16", "2026-10-17"]);
  assert.equal(nochesParaGrafico(dias, 7)[2].etiqueta, "Sáb 17/10");
});

test("comparacionNoche: esta noche contra la misma de la semana anterior", () => {
  assert.deepEqual(comparacionNoche(dias, "2026-10-17"), { actual: 50000, pedidos: 2, web: 1, pos: 1, anterior: 40000, pct: 25 });
  assert.deepEqual(comparacionNoche(dias, "2026-10-18"), { actual: 0, pedidos: 0, web: 0, pos: 0, anterior: null, pct: null });
});

test("masVendidas: pizzas y empanadas; bebidas y cancelados no; mitad y mitad aparte", () => {
  assert.deepEqual(masVendidas(orders, carta), [
    { nombre: "Fugazzetta", cantidad: 3 },
    { nombre: "Empanadas (docenas)", cantidad: 1 },
    { nombre: "Mitad y mitad", cantidad: 1 },
    { nombre: "Muzzarella Impasto", cantidad: 1 },
  ]);
  assert.equal(masVendidas(orders, carta, 1).length, 1);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx tsx tests/admin-dashboard.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

`lib/admin-dashboard.ts`:

```ts
import type { AdminOrder } from "../app/admin/components/types";
import { docenasDeItems, etiquetaDia, pizzasDeItems, type CartaResumen, type ResumenDia } from "./resumen-diario";
import { esPedidoValidoParaVentas } from "./pedido-visible";

const MITAD_Y_MITAD = /^Mitad .+ \/ Mitad .+/;

export function restarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Las últimas `cantidad` noches con ventas, para el gráfico: sin barras en cero de lunes a jueves. */
export function nochesParaGrafico(dias: ReadonlyArray<ResumenDia>, cantidad: number) {
  return dias.slice(0, cantidad).reverse().map((d) => ({ dia: d.dia, etiqueta: etiquetaDia(d.dia), total: d.total }));
}

/** Esta noche (06:00 a 05:59) contra la misma noche de la semana anterior. */
export function comparacionNoche(dias: ReadonlyArray<ResumenDia>, hoy: string) {
  const actual = dias.find((d) => d.dia === hoy);
  const previa = dias.find((d) => d.dia === restarDias(hoy, 7));
  const total = actual?.total ?? 0;
  const anterior = previa ? previa.total : null;
  return {
    actual: total,
    pedidos: actual?.pedidos ?? 0,
    web: actual ? actual.pedidos - actual.pedidosPos : 0,
    pos: actual?.pedidosPos ?? 0,
    anterior,
    pct: anterior ? Math.round(((total - anterior) / anterior) * 100) : null,
  };
}

/** Top de pizzas (por nombre; las mitad y mitad juntas) y empanadas (en docenas). Sin bebidas. */
export function masVendidas(orders: ReadonlyArray<AdminOrder>, carta: CartaResumen, n = 5) {
  const cuenta = new Map<string, number>();
  const sumar = (nombre: string, cantidad: number) => { if (cantidad > 0) cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + cantidad); };
  for (const o of orders) {
    if (!esPedidoValidoParaVentas(o)) continue;
    for (const item of o.items) {
      const pizzas = pizzasDeItems([item], carta.pizzas);
      if (pizzas > 0) { sumar(MITAD_Y_MITAD.test(item.name) ? "Mitad y mitad" : item.name, pizzas); continue; }
      sumar("Empanadas (docenas)", docenasDeItems([item], carta.empanadas));
    }
  }
  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre))
    .slice(0, n);
}
```

`ResumenDia` todavía no cuenta pedidos por canal. En `lib/resumen-diario.ts`:

1. En la interfaz `ResumenDia`, después de `pedidos: number;`, agregar:

```ts
  /** Pedidos del POS esa noche (el resto son de la web). */
  pedidosPos: number;
```

2. En `resumenPorDia`, en el objeto inicial, agregar `pedidosPos: 0,` después de `pedidos: 0,`; y después de `r.pedidos++;` agregar `if (o.canal === "pos") r.pedidosPos++;`.

Correr `npx tsx tests/resumen-diario.test.ts` para confirmar que el cambio no rompe nada (si algún test compara un `ResumenDia` completo con `deepEqual`, sumarle `pedidosPos` con el valor que corresponda).

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx tsx tests/admin-dashboard.test.ts && npx tsx tests/resumen-diario.test.ts`
Expected: PASS.

- [ ] **Step 5: `Dashboard.tsx` compacto**

Reemplazar el componente `Dashboard` (todo lo que queda del archivo tras la Task 6):

```tsx
"use client";
import { useMemo, useState } from "react";
import { useStore } from "./StoreProvider";
import { diaDeNegocio, resumenPorDia } from "@/lib/resumen-diario";
import { comparacionNoche, masVendidas, nochesParaGrafico } from "@/lib/admin-dashboard";
import { esPedidoValidoParaVentas } from "@/lib/pedido-visible";
import { esActivo } from "@/lib/admin-pedidos";
import { contarMasas } from "@/lib/masa";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const PERIODOS = [7, 14, 30] as const;
const TREINTA_DIAS = 30 * 86_400_000;

export function Dashboard() {
  const { state } = useStore();
  const [noches, setNoches] = useState<(typeof PERIODOS)[number]>(7);
  const carta = useMemo(() => ({
    pizzas: new Set(state.products.filter((p) => /pizz/i.test(p.categoria)).map((p) => p.nombre)),
    empanadas: new Set(state.products.filter((p) => /empan/i.test(p.categoria)).map((p) => p.nombre)),
  }), [state.products]);
  const dias = useMemo(() => resumenPorDia(state.orders, carta), [state.orders, carta]);
  const hoy = diaDeNegocio(new Date().toISOString());
  const noche = comparacionNoche(dias, hoy);
  const grafico = nochesParaGrafico(dias, noches);
  const max = Math.max(1, ...grafico.map((g) => g.total));
  const validos = state.orders.filter(esPedidoValidoParaVentas);
  const ultimos30 = validos.filter((o) => Date.now() - new Date(o.fecha).getTime() <= TREINTA_DIAS);
  const ticket = ultimos30.length ? ultimos30.reduce((s, o) => s + o.total, 0) / ultimos30.length : 0;
  const activos = state.orders.filter(esActivo);
  const sinCobrar = activos.filter((o) => o.pagoEstado === "pendiente").length;
  const desde = grafico[0]?.dia;
  const masas = contarMasas(desde ? validos.filter((o) => diaDeNegocio(o.fecha) >= desde) : []);
  const totalMasas = masas.napoletana + masas.molde;
  const top = masVendidas(desde ? validos.filter((o) => diaDeNegocio(o.fecha) >= desde) : [], carta);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Ventas esta noche</div><div className="kpi-value">{fmt(noche.actual)}</div>
          <div className={`kpi-delta ${noche.pct === null ? "" : noche.pct >= 0 ? "up" : "down"}`}>{noche.pct === null ? "Sin la misma noche de la semana pasada" : `${noche.pct >= 0 ? "↑" : "↓"} ${Math.abs(noche.pct)}% vs la semana pasada`}</div></div>
        <div className="kpi"><div className="kpi-label">Pedidos esta noche</div><div className="kpi-value">{noche.pedidos}</div><div className="kpi-delta">{noche.web} web · {noche.pos} POS</div></div>
        <div className="kpi"><div className="kpi-label">Ticket promedio</div><div className="kpi-value">{fmt(ticket)}</div><div className="kpi-delta">últimos 30 días</div></div>
        <div className="kpi"><div className="kpi-label">Activos ahora</div><div className="kpi-value">{activos.length}</div><div className={`kpi-delta ${sinCobrar ? "warn" : ""}`}>{sinCobrar ? `${sinCobrar} con pago pendiente` : "Al día"}</div></div>
      </div>
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head"><h3>Ventas por noche</h3><div className="panel-head-spacer" />
            <div className="seg">{PERIODOS.map((p) => <button key={p} className={noches === p ? "active" : ""} onClick={() => setNoches(p)}>{p} noches</button>)}</div>
          </div>
          <div className="panel-body">
            {grafico.length === 0 ? <div className="tbl-muted">Todavía no hay ventas.</div> : (
              <div className="chart">
                {grafico.map((g) => (
                  <div key={g.dia} className="chart-bar" style={{ height: `${Math.max(3, (g.total / max) * 100)}%` }} data-label={g.etiqueta} title={`${g.etiqueta}: ${fmt(g.total)}`}>
                    <span className="val">{fmt(g.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Más vendidas</h3><span className="tbl-muted">últimas {noches} noches</span></div>
          <div className="panel-body">
            <div className="top-list">
              {top.map((t, i) => <div className="top-row" key={t.nombre}><span className="top-rank">{i + 1}</span><span>{t.nombre}</span><span className="top-val">×{t.cantidad}</span></div>)}
              {top.length === 0 && <div className="tbl-muted">Sin ventas en el período.</div>}
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 6px" }}>Masas</h3>
            {totalMasas === 0 ? <div className="tbl-muted">Sin pizzas con masa elegida en el período.</div> : (
              <div className="masas-conteo">
                {([["Napoletana", masas.napoletana], ["Al molde", masas.molde]] as const).map(([nombre, n]) => (
                  <div className="masas-fila" key={nombre}><b>{nombre}</b><div className="masas-barra"><span style={{ width: `${Math.round((n / totalMasas) * 100)}%` }} /></div><span>{n} · {Math.round((n / totalMasas) * 100)}%</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

En `admin.css`, `.masas-barra span` pasa a `background:var(--a-ink)` y `.masas-fila` a `grid-template-columns:84px 1fr 80px; font-size:12.5px;`.

- [ ] **Step 6: Verificar y commit**

Sumar ` && tsx tests/admin-dashboard.test.ts` a `scripts.test`.

Run: `pnpm test && npx tsc --noEmit && pnpm exec eslint app/admin/components/Dashboard.tsx lib/admin-dashboard.ts lib/resumen-diario.ts`
Expected: todo en verde.

En el navegador: tarjetas de ~70 px (`document.querySelector('.kpi').offsetHeight` ≤ 80), gráfico con vie/sáb/dom, "Más vendidas" sin bebidas.

```bash
git add lib/admin-dashboard.ts tests/admin-dashboard.test.ts lib/resumen-diario.ts app/admin/components/Dashboard.tsx app/admin/admin.css package.json
git commit -m "feat(admin): Dashboard compacto por noche de servicio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Productos y Clientes compactos

**Files:**
- Modify: `app/admin/components/Products.tsx`
- Modify: `app/admin/components/Customers.tsx`

**Interfaces:**
- Consumes: `AdminProduct.archivado`, `ProductThumb`, `CeldaEtiquetas`.
- Produces: Productos con filtro `enCarta: boolean` (por defecto `true`).

- [ ] **Step 1: Productos**

En `Products.tsx`:

1. Quitar `useCuposNoche`, `CupoControl` (imports y uso) y la columna "Quedan hoy" (encabezado y celda).
2. Estado `const [baja, setBaja] = useState(false);` y en `filtered`, antes del filtro por tipo: `list = list.filter(p => !!p.archivado === baja);`. Contadores (`counts`) calculados sobre la lista ya filtrada por `baja`.
3. Junto a los tipos, un segundo `seg`:

```tsx
<div className="seg">
  <button className={!baja ? "active" : ""} onClick={() => setBaja(false)}>En carta</button>
  <button className={baja ? "active" : ""} onClick={() => setBaja(true)}>Dados de baja<span className="count">{state.products.filter(p => p.archivado).length}</span></button>
</div>
```

4. Celda Producto en una línea:

```tsx
<td>
  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
    <span className="row-thumb"><ProductThumb item={p} /></span>
    <div style={{ minWidth: 0 }}>
      <div className="tbl-strong" style={{ whiteSpace: "nowrap" }}>{p.nombre}</div>
      {p.desc && <div className="tbl-muted" style={{ maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>}
    </div>
  </div>
</td>
```

5. Columna Tipo: texto capitalizado en `tbl-muted`. Disponibilidad: `div.switch` + texto "Disponible"/"Agotado" con `color: p.active ? "var(--a-success)" : "var(--a-muted)"`. Acciones: agregar `aria-label` a editar ("Editar {nombre}") y eliminar ("Eliminar {nombre}").

- [ ] **Step 2: Clientes**

En `Customers.tsx`, en cada fila:

- Cliente: quitar el `avatar`; solo `<div className="tbl-strong" style={{ whiteSpace: "nowrap" }}>{c.nombre}</div>`.
- Contacto: teléfono y mail en una línea: `<span className="tbl-mono">{c.tel}</span>{c.email && <span className="tbl-muted"> · {c.email}</span>}` con `className="nowrap"` en la celda.
- Notas: `<td className="tbl-muted ellipsis" style={{ width: "24%" }} title={c.notas}>{c.notas || "—"}</td>`.
- Compras: el aviso "sin importe documentado" como `title` de la celda y un asterisco `*` junto al número, en vez de una segunda línea.

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit && pnpm exec eslint app/admin/components/Products.tsx app/admin/components/Customers.tsx`
Expected: sin errores nuevos.

En el navegador: filas de Productos ≤ 52 px y sin desborde a 1366 px; "En carta" muestra solo lo que se vende; Clientes con filas ≤ 48 px.

```bash
git add app/admin/components/Products.tsx app/admin/components/Customers.tsx
git commit -m "feat(admin): Productos y Clientes en filas de una línea

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Búsqueda global

**Files:**
- Create: `lib/busqueda-admin.ts`
- Test: `tests/busqueda-admin.test.ts`
- Create: `app/admin/components/BusquedaGlobal.tsx`
- Modify: `app/admin/page.tsx`, `app/admin/components/Topbar.tsx` (sin cambios de firma: usa la prop `buscador`), `app/admin/components/Orders.tsx`, `app/admin/components/Customers.tsx`, `app/admin/components/Products.tsx` (abrir lo elegido), `app/admin/admin.css`, `package.json`

**Interfaces:**
- Consumes: `numeroCorto` (Task 2); `AdminOrder`, `AdminCustomer`, `AdminProduct`.
- Produces:
  - `type ResultadoBusqueda = { tipo: "pedido" | "cliente" | "producto"; id: string; titulo: string; detalle: string }`
  - `buscar(texto: string, datos: { pedidos: ReadonlyArray<AdminOrder>; clientes: ReadonlyArray<AdminCustomer>; productos: ReadonlyArray<AdminProduct> }, max?: number): ResultadoBusqueda[]`
  - `<BusquedaGlobal onElegir={(r: ResultadoBusqueda) => void} />`
  - Props nuevas: `Orders({ soloActivos?, onVerTodos?, abrirId?: string | null })`, `Customers({ abrirId?: string | null })`, `Products({ abrirId?: string | null })` — si llega `abrirId`, abren ese detalle/edición al montar.

- [ ] **Step 1: Test que falla**

`tests/busqueda-admin.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buscar } from "../lib/busqueda-admin";
import type { AdminCustomer, AdminOrder, AdminProduct } from "../app/admin/components/types";

const pedido = (extra: Partial<AdminOrder>) => ({ _dbId: "p1", id: "IM-107345-K7QD", numero: "107345", canal: "web", cliente: "Patricia Machado", tel: "3757570585", total: 43500, estado: "nuevo", fecha: "2026-10-17T23:00:00Z", ...extra }) as AdminOrder;
const cliente = (extra: Partial<AdminCustomer>) => ({ _dbId: "c1", id: "c1", nombre: "Matías Sanabria", tel: "3757574590", email: "", ...extra }) as AdminCustomer;
const producto = (extra: Partial<AdminProduct>) => ({ _dbId: "x1", id: "x1", nombre: "Fugazzetta", precio: 18000, type: "pizza", ...extra }) as AdminProduct;
const datos = {
  pedidos: [pedido({}), pedido({ _dbId: "p2", id: "IM-0003", numero: "3", canal: "pos", cliente: "Saul" })],
  clientes: [cliente({}), cliente({ _dbId: "c2", id: "c2", nombre: "Patricia Machado", tel: "3757570585" })],
  productos: [producto({}), producto({ _dbId: "x2", id: "x2", nombre: "Muzzarella Impasto" })],
};

test("buscar: menos de 2 letras no busca", () => {
  assert.deepEqual(buscar("p", datos), []);
  assert.deepEqual(buscar("  ", datos), []);
});

test("buscar: por número de pedido (también POS)", () => {
  assert.deepEqual(buscar("107345", datos).map((r) => [r.tipo, r.id]), [["pedido", "p1"]]);
  assert.deepEqual(buscar("pos 3", datos).map((r) => [r.tipo, r.id]), [["pedido", "p2"]]);
});

test("buscar: sin tildes ni mayúsculas, pedidos antes que clientes", () => {
  assert.deepEqual(buscar("patricia", datos).map((r) => [r.tipo, r.id]), [["pedido", "p1"], ["cliente", "c2"]]);
  assert.deepEqual(buscar("MATIAS", datos).map((r) => [r.tipo, r.id]), [["cliente", "c1"]]);
});

test("buscar: por teléfono (solo dígitos) y por producto", () => {
  assert.deepEqual(buscar("574590", datos).map((r) => r.id), ["c1"]);
  assert.deepEqual(buscar("fugaz", datos).map((r) => [r.tipo, r.titulo]), [["producto", "Fugazzetta"]]);
});

test("buscar: tope de resultados", () => {
  const muchos = { ...datos, productos: Array.from({ length: 20 }, (_, i) => producto({ _dbId: `m${i}`, id: `m${i}`, nombre: `Muzza ${i}` })) };
  assert.equal(buscar("muzza", muchos).length, 8);
  assert.equal(buscar("muzza", muchos, 3).length, 3);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx tsx tests/busqueda-admin.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

`lib/busqueda-admin.ts`:

```ts
import type { AdminCustomer, AdminOrder, AdminProduct } from "../app/admin/components/types";
import { numeroCorto } from "./admin-pedidos";

export interface ResultadoBusqueda {
  tipo: "pedido" | "cliente" | "producto";
  id: string;
  titulo: string;
  detalle: string;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const digitos = (s: string) => s.replace(/\D/g, "");
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

/**
 * Buscador de la barra superior: busca en lo que el panel ya tiene cargado, sin consultas nuevas.
 * Pedidos primero (por número, cliente o teléfono), después clientes y productos.
 */
export function buscar(
  texto: string,
  datos: { pedidos: ReadonlyArray<AdminOrder>; clientes: ReadonlyArray<AdminCustomer>; productos: ReadonlyArray<AdminProduct> },
  max = 8,
): ResultadoBusqueda[] {
  const t = normalizar(texto);
  if (t.length < 2) return [];
  const tDigitos = digitos(t);
  const porTelefono = (tel: string) => tDigitos.length >= 4 && digitos(tel).includes(tDigitos);
  const resultados: ResultadoBusqueda[] = [];

  for (const o of datos.pedidos) {
    const numero = normalizar(numeroCorto(o));
    if (numero === t || numero.startsWith(t) || normalizar(o.id).includes(t) || normalizar(o.cliente).includes(t) || porTelefono(o.tel)) {
      resultados.push({ tipo: "pedido", id: o._dbId, titulo: `Pedido ${numeroCorto(o)}`, detalle: `${o.cliente} · ${fmt(o.total)}` });
    }
  }
  for (const c of datos.clientes) {
    if (normalizar(c.nombre).includes(t) || porTelefono(c.tel)) {
      resultados.push({ tipo: "cliente", id: c.id, titulo: c.nombre, detalle: c.tel });
    }
  }
  for (const p of datos.productos) {
    if (normalizar(p.nombre).includes(t)) {
      resultados.push({ tipo: "producto", id: p.id, titulo: p.nombre, detalle: fmt(p.precio || 0) });
    }
  }
  return resultados.slice(0, max);
}
```

Nota: en el test, "patricia" encuentra el pedido `p1` y el cliente `c2`; el pedido `p2` (Saul) no. "pos 3" coincide con `numeroCorto` normalizado `"pos 3"`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx tsx tests/busqueda-admin.test.ts`
Expected: PASS, 5 tests. Sumar ` && tsx tests/busqueda-admin.test.ts` a `scripts.test`.

- [ ] **Step 5: `BusquedaGlobal`**

`app/admin/components/BusquedaGlobal.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { buscar, type ResultadoBusqueda } from "@/lib/busqueda-admin";

const TIPO: Record<ResultadoBusqueda["tipo"], string> = { pedido: "Pedido", cliente: "Cliente", producto: "Producto" };

/** Pedidos, clientes y productos ya cargados. Ctrl+K / ⌘K para enfocar, Esc para cerrar. */
export function BusquedaGlobal({ onElegir }: { onElegir: (r: ResultadoBusqueda) => void }) {
  const { state } = useStore();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const resultados = useMemo(
    () => buscar(texto, { pedidos: state.orders, clientes: state.customers, productos: state.products }),
    [texto, state.orders, state.customers, state.products],
  );

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setAbierto(true); }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  const elegir = (r: ResultadoBusqueda) => { onElegir(r); setTexto(""); setAbierto(false); input.current?.blur(); };

  return (
    <div className="busqueda">
      <div className="search-input">
        <Icon.Search />
        <input
          ref={input}
          placeholder="Buscar pedido, cliente o producto"
          aria-label="Buscar pedido, cliente o producto"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setAbierto(false); input.current?.blur(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, resultados.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && resultados[activo]) elegir(resultados[activo]);
          }}
        />
      </div>
      {abierto && texto.trim().length >= 2 && (
        <div className="busqueda-pop" role="listbox">
          {resultados.length === 0 && <div className="tbl-muted" style={{ padding: "8px 10px" }}>Sin resultados</div>}
          {resultados.map((r, i) => (
            <button key={`${r.tipo}-${r.id}`} role="option" aria-selected={i === activo} className={`busqueda-item ${i === activo ? "on" : ""}`} onMouseDown={(e) => { e.preventDefault(); elegir(r); }}>
              <span className="busqueda-tipo">{TIPO[r.tipo]}</span><b>{r.titulo}</b><span className="tbl-muted">{r.detalle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

CSS:

```css
/* ============ BÚSQUEDA GLOBAL ============ */
.busqueda{ position:relative; }
.busqueda .search-input{ min-width:260px; }
.busqueda-pop{ position:absolute; right:0; top:calc(100% + 4px); width:min(360px, 92vw); z-index:45; background:var(--a-surface); border:1px solid var(--a-line); border-radius:var(--a-radius); box-shadow:var(--a-shadow); padding:4px; }
.busqueda-item{ display:grid; grid-template-columns:64px 1fr; column-gap:8px; width:100%; text-align:left; padding:6px 8px; border-radius:6px; font-size:13px; }
.busqueda-item .tbl-muted{ grid-column:2; font-size:12px; }
.busqueda-item.on, .busqueda-item:hover{ background:var(--a-bg); }
.busqueda-tipo{ grid-row:span 2; font-size:11px; color:var(--a-muted); padding-top:2px; }
@media (max-width:900px){ .busqueda .search-input{ min-width:0; width:100%; } .busqueda{ order:6; width:100%; } }
```

- [ ] **Step 6: Abrir lo elegido**

En `page.tsx`:

```tsx
const [abrir, setAbrir] = useState<{ tipo: ResultadoBusqueda["tipo"]; id: string } | null>(null);
const elegir = (r: ResultadoBusqueda) => {
  setAbrir({ tipo: r.tipo, id: r.id });
  irA(r.tipo === "pedido" ? "pedidos" : r.tipo === "cliente" ? "clientes" : "productos");
};
// …
<Topbar … buscador={<BusquedaGlobal onElegir={elegir} />} />
// …
{page === "pedidos"   && <><NotificationsRecovery /><Orders key={abrir?.tipo === "pedido" ? abrir.id : "lista"} abrirId={abrir?.tipo === "pedido" ? abrir.id : null} /></>}
{page === "clientes"  && <Customers key={abrir?.tipo === "cliente" ? abrir.id : "lista"} abrirId={abrir?.tipo === "cliente" ? abrir.id : null} />}
{page === "productos" && <Products key={abrir?.tipo === "producto" ? abrir.id : "lista"} abrirId={abrir?.tipo === "producto" ? abrir.id : null} />}
```

(el `key` remonta la sección para que el estado inicial tome el `abrirId`).

En cada componente, inicializar el estado con lo pedido:

- `Orders`: `const [selected, setSelected] = useState<AdminOrder | null>(() => (abrirId ? state.orders.find(o => o._dbId === abrirId) ?? null : null));` y `useState(abrirId ? "todos" : "activos")` para el filtro (un pedido viejo tiene que verse).
- `Customers`: `const [selected, setSelected] = useState<string | null>(abrirId ?? null);`.
- `Products`: `const [edit, setEdit] = useState<AdminProduct | null>(() => (abrirId ? state.products.find(p => p.id === abrirId) ?? null : null));` y `useState(() => !!state.products.find(p => p.id === abrirId)?.archivado)` para `baja`.

- [ ] **Step 7: Verificar y commit**

Run: `pnpm test && npx tsc --noEmit && pnpm exec eslint lib/busqueda-admin.ts app/admin/components/BusquedaGlobal.tsx app/admin/page.tsx app/admin/components/Orders.tsx app/admin/components/Customers.tsx app/admin/components/Products.tsx`
Expected: en verde.

En el navegador: Ctrl+K enfoca; buscar un número de pedido entregado abre su detalle en Pedidos; un nombre de cliente abre su ficha; "fugaz" abre la edición de Fugazzetta (cerrar sin guardar).

```bash
git add lib/busqueda-admin.ts tests/busqueda-admin.test.ts app/admin/components/BusquedaGlobal.tsx app/admin/page.tsx app/admin/components/Orders.tsx app/admin/components/Customers.tsx app/admin/components/Products.tsx app/admin/admin.css package.json
git commit -m "feat(admin): buscador de pedidos, clientes y productos en la barra superior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Repaso de secciones chicas, verificación completa y documentación

**Files:**
- Modify: `app/admin/components/ResumenDiario.tsx`, `Etiquetas.tsx`, `Testimonials.tsx` (solo estilos en línea que usan tamaños grandes)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Estilos en línea heredados**

Buscar tamaños y fuentes viejas en línea:

Run: `grep -n "fontFamily\|fontSize: 1[89]\|fontSize: 2[0-9]\|padding: 2[0-9]\|padding: 1[68]" app/admin/components/*.tsx`

Reemplazar por clases o valores del sistema nuevo: títulos de sección `fontSize: 14, fontWeight: 600`; rellenos de recuadros `10px 12px`; `fontFamily: "var(--a-font-mono)"` en etiquetas de sección → quitar (queda Inter). No cambiar lógica ni textos.

- [ ] **Step 2: Verificación completa**

Run: `pnpm test && npx tsc --noEmit && pnpm build`
Expected: todo en verde.

Con la sesión del dueño, a 1366 px y a 375 px, recorrer: Arranque, Pedidos (Activos, Todos, detalle, imprimir deshabilitado en tarjeta sin acreditar si hay uno), Resumen diario, Productos (En carta / Dados de baja, editar y cerrar), Etiquetas, Dashboard, Clientes (ficha), Testimonios, Configuración (cuatro pestañas). Medir en cada sección:

```js
({ seccion: document.querySelector('.topbar h1')?.childNodes[0]?.textContent, alto: document.querySelector('.content').scrollHeight, desborde: document.documentElement.scrollWidth > innerWidth, fila: document.querySelector('.tbl tbody tr')?.offsetHeight ?? null })
```

Expected: `desborde: false` en todas; filas ≤ 52. Comparar `alto` de Pedidos (Todos) y Productos con el diagnóstico (5.566 y 8.496 px): tienen que bajar a menos de la mitad. Revisar la web pública (home, carrito, checkout, `/pedido/<ref de un pedido real entregado>`) y que la consola no tenga errores.

Screenshots para el dueño: Arranque, Pedidos, Dashboard y Configuración (escritorio) y Pedidos (celular).

- [ ] **Step 3: `CLAUDE.md`**

Agregar al principio de `CLAUDE.md` (después de `@AGENTS.md`) una sección `## Panel rediseñado (22/10/2026)` con: el pedido del dueño; las decisiones (menú por momento de uso, Arranque, tabla compacta, estilo neutro, uso en compu y celular); la causa del título invisible y el arreglo (`app/(sitio)/`, `impasto.css` fuera del layout raíz; **no volver a importarlo en `app/layout.tsx`**); los módulos nuevos (`lib/admin-pedidos.ts`, `lib/inicio-admin.ts`, `lib/admin-dashboard.ts`, `lib/busqueda-admin.ts`, `SucursalProvider`); que los interruptores ya no están en Configuración; lo verificado y lo que no (con fecha). Spec y plan: `docs/superpowers/specs/2026-10-22-panel-admin-rediseno-design.md`, `docs/superpowers/plans/2026-10-22-panel-admin-rediseno.md`.

- [ ] **Step 4: Commit (sin push)**

```bash
git add app/admin/components CLAUDE.md
git commit -m "docs: panel rediseñado; repaso de estilos de las secciones chicas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

El push a `main` (que publica en Netlify) lo autoriza el dueño después de ver las capturas.
