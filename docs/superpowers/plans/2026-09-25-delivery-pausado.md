# Delivery pausado (solo retiro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño pueda pausar solo el delivery desde el panel y el sitio siga vendiendo para retirar, con un aviso elegante del motivo.

**Architecture:** Dos columnas nuevas en `sucursales` (`delivery_activo`, `mensaje_delivery`) viajan en `BusinessConfig`. `lib/hours.ts` calcula `estadoDelivery()` (puro, testeable) y lo agrega a `EstadoTienda`, que ya llega al cliente por la página y por `/api/store-status`. `createPedido()` rechaza delivery en pausa; franja, carrito, checkout y chat leen el mismo estado.

**Tech Stack:** Next.js 16, React 19, TypeScript, InsForge (Postgres), tests con `tsx`, pnpm.

Spec: `docs/superpowers/specs/2026-09-25-delivery-pausado-design.md`.

## Global Constraints

- Gestor de paquetes: `pnpm` (nunca npm).
- Migraciones con `npx -y @insforge/cli db migrations new|up`; nunca DDL por `db query`.
- Hay una migración ajena sin commitear (`migrations/20260922153137_compras-items.sql`): no aplicarla ni commitearla.
- La base es compartida con producción: la migración va antes de cualquier commit de código.
- Colores: carbón `--carbon` + dorado `--gold`; nada de naranja/marrón en superficies nuevas.
- Texto por defecto (exacto): `Por el momento no estamos haciendo envíos a domicilio. Podés pedir online y retirarlo en el local.`
- Título del aviso (exacto): `Por ahora, solo retiro en el local`
- Varios archivos tienen CRLF: editar con Edit, no con `sed -i`.
- No commitear archivos ajenos (`.codex/`, `docs/impresion-termica.md`, `scripts/`, la migración de compras).

---

### Task 1: Migración `sucursales.delivery_activo` / `mensaje_delivery`

**Files:**
- Create: `migrations/<timestamp>_delivery-pausado.sql` (lo genera la CLI)

**Interfaces:**
- Produces: columnas `sucursales.delivery_activo boolean not null default true` y `sucursales.mensaje_delivery text not null default ''`.

- [ ] **Step 1: Comparar migraciones aplicadas con la carpeta**

Run: `npx -y @insforge/cli db migrations list`
Expected: ver si `20260922153137_compras-items` figura aplicada. Anotarlo; no se toca.

- [ ] **Step 2: Crear la migración**

Run: `npx -y @insforge/cli db migrations new delivery-pausado`
Contenido del archivo generado:

```sql
-- Interruptor del reparto: el local puede seguir vendiendo solo para retirar.
-- Mismo modelo que ventas_activas / mensaje_cierre (20260818215638_config-tienda.sql).
alter table sucursales add column if not exists delivery_activo boolean not null default true;
alter table sucursales add column if not exists mensaje_delivery text not null default '';
```

- [ ] **Step 3: Aplicar solo esa migración**

Si `compras-items` ya está aplicada, `db migrations up --all` aplica solo la nueva. Si no lo está, mover temporalmente `migrations/20260922153137_compras-items.sql` fuera de la carpeta (al scratchpad), correr `up --all` y devolverlo a su lugar.

- [ ] **Step 4: Verificar columnas en la base**

Run: `npx -y @insforge/cli db query "select id, delivery_activo, mensaje_delivery from sucursales"`
Expected: la fila `iguazu` con `delivery_activo = true`, `mensaje_delivery = ''`.

---

### Task 2: Estado del delivery, validación en el servidor y API del panel

**Files:**
- Modify: `lib/business.ts` (interfaz + `BUSINESS`)
- Modify: `lib/business-server.ts` (lectura de columnas)
- Modify: `lib/hours.ts` (`MENSAJE_DELIVERY_DEFAULT`, `EstadoDelivery`, `estadoDelivery`, `validarModalidad`, `EstadoTienda.delivery`)
- Modify: `lib/orders.ts` (`createPedido` llama a `validarModalidad`)
- Modify: `app/api/admin/sucursal/route.ts` (acepta los dos campos)
- Test: `tests/hours.test.ts`

**Interfaces:**
- Produces:
  - `BusinessConfig.deliveryActivo: boolean`, `BusinessConfig.mensajeDelivery: string`
  - `export const MENSAJE_DELIVERY_DEFAULT: string` (lib/hours)
  - `export interface EstadoDelivery { activo: boolean; motivo: string }` (lib/hours)
  - `export function estadoDelivery(business: BusinessConfig): EstadoDelivery`
  - `export function validarModalidad(business: BusinessConfig, mode: string): void` (lanza `Error`)
  - `EstadoTienda.delivery: EstadoDelivery`

- [ ] **Step 1: Tests que fallan** — agregar a `tests/hours.test.ts`

Import (reemplaza la primera línea):

```ts
import { estaAbierto, proximaApertura, fechaLocal, diasCerrados, estadoDelivery, validarModalidad, estadoTienda, MENSAJE_DELIVERY_DEFAULT, type HorarioConfig } from "../lib/hours";
import { BUSINESS, type BusinessConfig } from "../lib/business";
```

Antes de `console.log(fallos === 0 ? ...)`:

```ts
/* ── delivery pausado ── */
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}
const errorDe = (fn: () => void) => {
  try { fn(); return ""; } catch (e) { return e instanceof Error ? e.message : String(e); }
};

const conDelivery: BusinessConfig = { ...BUSINESS };
const sinDelivery: BusinessConfig = { ...BUSINESS, deliveryActivo: false, mensajeDelivery: "Por la lluvia pausamos el delivery." };
const sinDeliverySinPunto: BusinessConfig = { ...BUSINESS, deliveryActivo: false, mensajeDelivery: "Sin repartidores esta noche" };
const sinDeliveryNiMotivo: BusinessConfig = { ...BUSINESS, deliveryActivo: false, mensajeDelivery: "   " };

const activo = estadoDelivery(conDelivery);
chequear("estadoDelivery · activo, sin motivo", activo.activo === true && activo.motivo === "");
const pausado = estadoDelivery(sinDelivery);
chequear("estadoDelivery · pausado con el motivo del panel", pausado.activo === false && pausado.motivo === "Por la lluvia pausamos el delivery.");
chequear("estadoDelivery · pausado sin motivo usa el texto por defecto", estadoDelivery(sinDeliveryNiMotivo).motivo === MENSAJE_DELIVERY_DEFAULT);

chequear("validarModalidad · delivery activo acepta delivery", errorDe(() => validarModalidad(conDelivery, "delivery")) === "");
chequear("validarModalidad · pausado acepta retiro", errorDe(() => validarModalidad(sinDelivery, "takeaway")) === "");
chequear(
  "validarModalidad · pausado rechaza delivery con el motivo",
  errorDe(() => validarModalidad(sinDelivery, "delivery")) === "Por la lluvia pausamos el delivery. Elegí retiro en el local para completar tu pedido.",
);
chequear(
  "validarModalidad · agrega el punto si el motivo no lo tiene",
  errorDe(() => validarModalidad(sinDeliverySinPunto, "delivery")) === "Sin repartidores esta noche. Elegí retiro en el local para completar tu pedido.",
);

// Sábado 21:00 en Iguazú: abierto por horario.
const sabado = new Date("2026-08-22T00:00:00Z");
const tiendaSinDelivery = estadoTienda(sinDelivery, sabado);
chequear("estadoTienda · abierto y sin delivery conviven", tiendaSinDelivery.abierto && !tiendaSinDelivery.delivery.activo);
chequear("estadoTienda · la venta pausada también lleva el delivery", estadoTienda({ ...sinDelivery, ventasActivas: false }, sabado).delivery.activo === false);
chequear("estadoTienda · cerrado por horario también lo lleva", estadoTienda(conDelivery, new Date("2026-08-25T00:00:00Z")).delivery.activo === true);
```

- [ ] **Step 2: Ver que falla**

Run: `pnpm exec tsx tests/hours.test.ts`
Expected: FAIL (`estadoDelivery` no existe / `deliveryActivo` no existe en el tipo; tsx no chequea tipos, falla en runtime con `estadoDelivery is not a function`).

- [ ] **Step 3: `lib/business.ts`**

En `BusinessConfig`, después de `mensajeCierre: string;`:

```ts
  /**
   * Interruptor manual del reparto. Apagado, el sitio sigue vendiendo pero solo
   * para retirar en el local. Independiente de `ventasActivas`.
   */
  deliveryActivo: boolean;
  /** Motivo mostrado al cliente cuando el delivery está pausado. */
  mensajeDelivery: string;
```

En `BUSINESS`, después de `mensajeCierre: "",`:

```ts
  deliveryActivo: true,
  mensajeDelivery: "",
```

- [ ] **Step 4: `lib/business-server.ts`**

Después de `mensajeCierre: String(branch.mensaje_cierre || ""),`:

```ts
      // Sin la columna (antes de la migración) cuenta como delivery activo.
      deliveryActivo: branch.delivery_activo !== false,
      mensajeDelivery: String(branch.mensaje_delivery || ""),
```

- [ ] **Step 5: `lib/hours.ts`**

Reemplazar la interfaz `EstadoTienda` y `estadoTienda()` por:

```ts
export const MENSAJE_DELIVERY_DEFAULT =
  "Por el momento no estamos haciendo envíos a domicilio. Podés pedir online y retirarlo en el local.";

export interface EstadoDelivery {
  activo: boolean;
  /** Motivo para el cliente; vacío mientras el delivery funciona. */
  motivo: string;
}

/**
 * Estado del reparto, aparte del horario: el local puede estar abierto y sin
 * delivery (lluvia, sin repartidor). Lo pausa el dueño desde el panel.
 */
export function estadoDelivery(business: BusinessConfig): EstadoDelivery {
  if (business.deliveryActivo !== false) return { activo: true, motivo: "" };
  return { activo: false, motivo: (business.mensajeDelivery || "").trim() || MENSAJE_DELIVERY_DEFAULT };
}

/**
 * Rechaza un pedido con delivery mientras el reparto está pausado. La llama
 * `createPedido`, el punto único por donde pasan los tres medios de pago.
 */
export function validarModalidad(business: BusinessConfig, mode: string): void {
  if (mode !== "delivery") return;
  const delivery = estadoDelivery(business);
  if (delivery.activo) return;
  const motivo = /[.!?…]$/.test(delivery.motivo) ? delivery.motivo : `${delivery.motivo}.`;
  throw new Error(`${motivo} Elegí retiro en el local para completar tu pedido.`);
}

export interface EstadoTienda {
  abierto: boolean;
  /** Frase completa, para el carrito y los mensajes de error. */
  motivo: string;
  /** Versión corta para la barra superior, donde el espacio es escaso. */
  etiqueta: string;
  /** true si lo cortó el interruptor manual y no el horario. */
  cierreManual: boolean;
  /** Viaja con el estado de venta para llegar al cliente por el mismo camino. */
  delivery: EstadoDelivery;
}
```

(Se conserva `aperturaCorta` donde está.) En `estadoTienda()`, calcular `const delivery = estadoDelivery(business);` al principio y agregar `delivery` a los tres `return`.

- [ ] **Step 6: Correr el test**

Run: `pnpm exec tsx tests/hours.test.ts`
Expected: todos PASA, "Todos los casos pasan".

- [ ] **Step 7: `lib/orders.ts`**

Import: `import { estadoTienda, fechaLocal, validarModalidad } from "@/lib/hours";`
En `createPedido`, después de `if (!estado.abierto) throw new Error(estado.motivo);`:

```ts
  // Con el reparto pausado solo se aceptan pedidos para retirar. Corre antes
  // del INSERT y, con tarjeta, antes de contactar a Mercado Pago.
  validarModalidad(business, order.mode);
```

- [ ] **Step 8: `app/api/admin/sucursal/route.ts`**

Agregar `"mensaje_delivery"` a la lista de campos string, y después de la línea de `ventas_activas`:

```ts
  if (body.delivery_activo !== undefined) updates.delivery_activo = Boolean(body.delivery_activo);
```

- [ ] **Step 9: Tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores. (`StoreStatusProvider` todavía no suma `delivery`; `Shell` recibe `EstadoTienda` como `EstadoTiendaCliente`, que es un supertipo: compila.)

---

### Task 3: Estado en el cliente, franja y barra superior

**Files:**
- Modify: `components/providers/StoreStatusProvider.tsx`
- Modify: `components/layout/Header.tsx` (`Topbar`)
- Modify: `app/impasto.css` (bloque nuevo `.aviso-delivery`)

**Interfaces:**
- Consumes: `EstadoDelivery` de `lib/hours`; `/api/store-status` ya devuelve `delivery` por el spread de `estadoTienda`.
- Produces: `useStoreStatus().delivery: EstadoDelivery`.

- [ ] **Step 1: Provider**

```tsx
import type { EstadoDelivery } from "@/lib/hours";

export interface EstadoTiendaCliente {
  abierto: boolean;
  motivo: string;
  etiqueta: string;
  cierreManual: boolean;
  delivery: EstadoDelivery;
}

const DELIVERY_ACTIVO: EstadoDelivery = { activo: true, motivo: "" };

const StoreStatusContext = createContext<EstadoTiendaCliente>({ abierto: true, motivo: "", etiqueta: "", cierreManual: false, delivery: DELIVERY_ACTIVO });
```

y en `consultar`:

```tsx
          setEstado({
            abierto: datos.abierto,
            motivo: datos.motivo,
            etiqueta: datos.etiqueta,
            cierreManual: datos.cierreManual,
            delivery: datos.delivery ?? DELIVERY_ACTIVO,
          });
```

- [ ] **Step 2: Topbar**

En `Topbar`, `const sinDelivery = !tienda.delivery.activo;`. La píldora dorada de escritorio:

```tsx
            <span className="gold">
              {sinDelivery ? "Solo retiro en el local" : <>Envío gratis desde {fmt(business.freeShippingFrom)}</>}
            </span>
```

La de mobile:

```tsx
            <span className="m-status-eta">{sinDelivery ? "Solo retiro" : <>Entrega {business.deliveryEstimate}</>}</span>
```

Y después del `<div className="m-status">…</div>`:

```tsx
      {/* Delivery pausado desde el panel. Si la venta está cortada del todo, manda
          ese aviso y esta franja sobra. */}
      {sinDelivery && !tienda.cierreManual && (
        <div className="aviso-delivery" role="status">
          <div className="container aviso-delivery-inner">
            <span className="aviso-delivery-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10l2-6h16l2 6" /><path d="M2 10h20" /><path d="M4 10v10h16V10" /><path d="M10 20v-5h4v5" /></svg>
            </span>
            <p>
              <b>Por ahora, solo retiro en el local</b>
              <span>{tienda.delivery.motivo}</span>
              <span className="aviso-delivery-dir">Te esperamos en {business.address}.</span>
            </p>
          </div>
        </div>
      )}
```

- [ ] **Step 3: CSS** — agregar después del bloque TOPBAR de `app/impasto.css` (después de `@media (max-width:760px){ .topbar-links{ display:none; } }`)

```css
/* ============ AVISO: DELIVERY PAUSADO ============ */
/* Lo prende el panel (Configuración → Delivery). Carbón y dorado, como la
   píldora del asistente: informa sin alarmar. */
.aviso-delivery{
  background:var(--carbon); color:rgba(246,241,231,.78);
  border-top:1px solid rgba(240,182,74,.22); border-bottom:1px solid rgba(240,182,74,.4);
}
.aviso-delivery-inner{ display:flex; align-items:center; justify-content:center; gap:14px; padding-block:12px; }
.aviso-delivery-icon{
  width:34px; height:34px; flex:none; border-radius:999px; display:grid; place-items:center;
  border:1px solid rgba(240,182,74,.55); color:var(--gold);
}
.aviso-delivery p{ margin:0; font-size:13.5px; line-height:1.5; }
.aviso-delivery b{ font-family:var(--font-display); font-size:15.5px; font-weight:600; color:var(--gold); margin-right:10px; }
.aviso-delivery-dir{ color:rgba(246,241,231,.55); margin-left:6px; }
@media (max-width:760px){
  .aviso-delivery-inner{ justify-content:flex-start; align-items:flex-start; gap:12px; }
  .aviso-delivery b, .aviso-delivery p span{ display:block; margin:0; }
  .aviso-delivery b{ margin-bottom:2px; }
}
```

- [ ] **Step 4: Tipos** — `pnpm exec tsc --noEmit` sin errores.

---

### Task 4: Carrito y barra inferior mobile

**Files:**
- Modify: `components/cart/CartDrawer.tsx`
- Modify: `components/Shell.tsx` (dock «Ver mi pedido»)
- Modify: `app/impasto.css` (`.drawer-ship.is-pickup`)

**Interfaces:**
- Consumes: `useStoreStatus().delivery`.

- [ ] **Step 1: Cálculo**

```tsx
  const sinDelivery = !tienda.delivery.activo;
  const freeShipping = subtotal >= business.freeShippingFrom;
  const progress = Math.min(100, (subtotal / business.freeShippingFrom) * 100);
  // Sin reparto no hay envío que cobrar: el pedido es para retirar.
  const shipping = sinDelivery || freeShipping ? 0 : business.deliveryFee;
```

- [ ] **Step 2: Bloque de arriba** — envolver el `<div className={`drawer-ship ...`}>` existente:

```tsx
          {sinDelivery ? (
            <div className="drawer-ship is-pickup">
              <div className="drawer-ship-top">
                <span className="ship-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10l2-6h16l2 6" /><path d="M2 10h20" /><path d="M4 10v10h16V10" /><path d="M10 20v-5h4v5" /></svg>
                </span>
                <div className="ship-text">
                  <b>Por ahora, solo retiro en el local</b>
                  <small>{tienda.delivery.motivo}</small>
                </div>
              </div>
            </div>
          ) : (
            /* bloque drawer-ship existente, sin cambios */
          )}
```

- [ ] **Step 3: Pie**

```tsx
            <div className="tot-row">
              <span>{sinDelivery ? "Retiro en el local" : "Envío"}</span>
              {sinDelivery ? (
                <span>Sin cargo</span>
              ) : freeShipping ? (
                <span className="free"><s className="was">{fmt(business.deliveryFee)}</s> Gratis</span>
              ) : (
                <span>{fmt(business.deliveryFee)}</span>
              )}
            </div>
```

y la nota:

```tsx
            <small className="drawer-note">
              Sin costo de servicio · {sinDelivery ? "Listo para retirar en" : "Entrega estimada"} {business.deliveryEstimate}
            </small>
```

- [ ] **Step 4: CSS** — después de `.drawer-ship.is-free .ship-icon{…}`:

```css
/* Delivery pausado: el aviso ocupa el lugar del envío gratis. */
.drawer-ship.is-pickup{ background:var(--carbon); border-color:var(--carbon); }
.drawer-ship.is-pickup .drawer-ship-top{ margin-bottom:0; }
.drawer-ship.is-pickup .ship-icon{ background:transparent; border:1px solid rgba(240,182,74,.55); color:var(--gold); }
.drawer-ship.is-pickup .ship-text b{ color:var(--gold); }
.drawer-ship.is-pickup .ship-text small{ color:rgba(246,241,231,.72); }
```

- [ ] **Step 5: Shell dock** — en `SiteContent`, `const { delivery } = useStoreStatus();` (import de `useStoreStatus`), y:

```tsx
              <small>{delivery.activo ? <>Entrega {business.deliveryEstimate}</> : <>Listo en {business.deliveryEstimate}</>}</small>
```

Verificar primero que `SiteContent` se renderiza dentro de `StoreStatusProvider` (sí: `Shell` lo envuelve).

- [ ] **Step 6: Tipos** — `pnpm exec tsc --noEmit` sin errores.

---

### Task 5: Checkout

**Files:**
- Modify: `components/checkout/Checkout.tsx`
- Modify: `app/impasto.css` (`.co-pickup-note`, `:disabled` de las tarjetas)

**Interfaces:**
- Consumes: `useStoreStatus().delivery`.

- [ ] **Step 1: Modo efectivo**

```tsx
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
…
  const { delivery } = useStoreStatus();
  const [data, setData] = useState<CheckoutData>({
    mode: delivery.activo ? "delivery" : "takeaway", when: "asap", nombre: "", tel: "", email: "", dir: "", ref: "",
    pago: "efectivo", cambio: "", notas: "",
  });
  …
  // Con el reparto pausado el pedido es para retirar aunque el cliente hubiera
  // elegido delivery antes de la pausa. Derivado, no un efecto que pise el estado.
  const mode: CheckoutData["mode"] = delivery.activo ? data.mode : "takeaway";
  const quoteKey = JSON.stringify({ items, mode });
```

Reemplazar cada `data.mode` restante por `mode` (fetch de cotización, deps del efecto `[mode, items, quoteKey]`, `shipping`, `isDelivery`). En `confirm` y `payWithCard`: `{ ...data, mode, items: [...items] }`.

- [ ] **Step 2: Opciones de escritorio** — antes de `<div className="co-modes">` de la card 1 (escritorio):

```tsx
            {!delivery.activo && (
              <div className="co-pickup-note" role="status">
                <b>Por ahora, solo retiro en el local.</b> {delivery.motivo}
              </div>
            )}
```

Botón Delivery:

```tsx
              <button className={`radio-card ${isDelivery ? "on" : ""}`} onClick={() => set("mode", "delivery")} disabled={!delivery.activo}>
                <span className="radio-card-top">
                  <b>Delivery</b>
                  <span className={`dot ${isDelivery ? "on" : ""}`} />
                </span>
                <small>
                  {delivery.activo ? (
                    <>
                      A domicilio en {business.deliveryEstimate} · {fmt(business.deliveryFee)}<br />
                      Gratis desde {fmt(business.freeShippingFrom)}
                    </>
                  ) : (
                    "Pausado por el momento"
                  )}
                </small>
              </button>
```

- [ ] **Step 3: Opciones de mobile** — misma nota antes del `co-modes` mobile, y:

```tsx
            <button className={`m-radio ${isDelivery ? "on" : ""}`} onClick={() => set("mode", "delivery")} disabled={!delivery.activo}>
              <span className="m-radio-dot" />
              <span className="m-radio-body">
                <b>Delivery</b>
                <small>
                  {delivery.activo
                    ? <>A domicilio en {business.deliveryEstimate} · {fmt(business.deliveryFee)}. Gratis desde {fmt(business.freeShippingFrom)}.</>
                    : "Pausado por el momento"}
                </small>
              </span>
            </button>
```

- [ ] **Step 4: CSS** — después de `.radio-card small{…}`:

```css
.radio-card:disabled, .m-radio:disabled{ opacity:.5; cursor:not-allowed; }
.radio-card:disabled:hover{ border-color:var(--line); }
/* Delivery pausado: el motivo, arriba de las opciones de entrega. */
.co-pickup-note{
  margin-bottom:12px; padding:12px 14px; border-radius:13px;
  background:var(--carbon); color:rgba(246,241,231,.78); font-size:13.5px; line-height:1.5;
}
.co-pickup-note b{ color:var(--gold); font-weight:600; }
```

- [ ] **Step 5: Tipos y lint** — `pnpm exec tsc --noEmit` y `pnpm lint` (0 errores; las advertencias previas son 11).

---

### Task 6: Panel → Configuración → Delivery

**Files:**
- Modify: `app/admin/components/Settings.tsx`

- [ ] **Step 1: Tipos e import**

```tsx
import { MENSAJE_DELIVERY_DEFAULT } from "@/lib/hours";
…
  delivery_activo?: boolean;
  mensaje_delivery?: string;
```

- [ ] **Step 2: Sección** — reemplazar el `<h4>Delivery</h4>` y agregar antes del `form-grid` de tarifas:

```tsx
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 4 }}>Delivery</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Si hoy no podés hacer envíos, pausá el delivery: el sitio sigue vendiendo, pero solo
              para retirar en el local, y el cliente ve el motivo antes de armar su pedido.
            </div>
            <button
              className={`btn ${deliveryActivo ? "btn-success" : "btn-danger"}`}
              onClick={() => set("delivery_activo", !deliveryActivo)}
            >
              {deliveryActivo ? "✓ Haciendo envíos" : "✕ Delivery pausado · solo retiro"}
            </button>
            {!deliveryActivo && (
              <div className="field" style={{ marginTop: 12 }}>
                <label>Motivo que ve el cliente</label>
                <input
                  placeholder={MENSAJE_DELIVERY_DEFAULT}
                  value={config.mensaje_delivery || ""}
                  onChange={(e) => set("mensaje_delivery", e.target.value)}
                />
                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Si lo dejás vacío, se muestra el texto de ejemplo.
                </div>
              </div>
            )}
            <div className="form-grid" style={{ marginTop: 16 }}>
```

con `const deliveryActivo = config.delivery_activo !== false;` junto a `diasActivos`.

- [ ] **Step 3: Tipos** — `pnpm exec tsc --noEmit`.

---

### Task 7: Chatbot

**Files:**
- Modify: `lib/chat-prompt.ts`
- Test: `tests/chat-prompt.test.ts`

- [ ] **Step 1: Test que falla** — antes de `console.log(fallos === 0 ? …)`:

```ts
/* ── delivery pausado: el bot no puede ofrecer lo que el checkout rechaza ── */
const sinDelivery: BusinessConfig = { ...business, deliveryActivo: false, mensajeDelivery: "Por la lluvia pausamos el delivery." };
const promptSinDelivery = promptVendedor(catalogo, sinDelivery, estadoTienda(sinDelivery, new Date("2026-08-26T00:00:00Z")));
chequear("con el delivery activo ofrece el envío gratis", /Envío GRATIS a partir/.test(prompt));
chequear("con el delivery pausado dice que solo hay retiro, con la dirección", /solo .*retir/i.test(promptSinDelivery) && promptSinDelivery.includes(business.address));
chequear("y lleva el motivo que cargó el local", promptSinDelivery.includes("Por la lluvia pausamos el delivery."));
chequear("y no ofrece envío gratis ni la tarifa", !/gratis a partir/i.test(promptSinDelivery) && !promptSinDelivery.includes("$3.000"));
```

- [ ] **Step 2: Ver que falla** — `pnpm exec tsx tests/chat-prompt.test.ts`: FALLA en los tres casos de pausa.

- [ ] **Step 3: Implementación** — en `promptVendedor`, antes del `return`:

```ts
  // Con el reparto pausado el bot no puede ofrecer envío: el checkout lo rechaza.
  const envio = estado.delivery.activo
    ? `- Delivery: ${pesos(business.deliveryFee)}.
- Envío GRATIS a partir de ${pesos(business.freeShippingFrom)} de subtotal. Si la persona está
  cerca de ese monto, decíselo: es el argumento que más cierra.
- También se puede retirar por el local: ${business.address}.
- Tiempo estimado, tanto para delivery como para retiro: ${business.deliveryEstimate}. Es un
  estimado y lo decís como estimado: nunca prometas una hora exacta de llegada.`
    : `- HOY NO HAY DELIVERY. ${estado.delivery.motivo}
- Solo se puede pedir para retirar por el local: ${business.address}. Si preguntan por el
  envío, explicalo con amabilidad y ofrecé el retiro. No ofrezcas envío a domicilio.
- Tiempo estimado para retirar: ${business.deliveryEstimate}. Es un estimado y lo decís como
  estimado: nunca prometas una hora exacta.`;
```

y en el template, la sección queda:

```
EL ENVÍO
${envio}
${sobreElProducto()}
LA CARTA
```

- [ ] **Step 4: Tests** — `pnpm test` completo: todo PASA.

---

### Task 8: Verificación, documentación y commit

- [ ] **Step 1:** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint` (0 errores), `pnpm build`.
- [ ] **Step 2:** Levantar `pnpm dev` (preview). Con `delivery_activo = true` (estado real): el sitio igual que antes, sin franja.
- [ ] **Step 3:** Poner la pausa en la base (`update sucursales set delivery_activo = false, mensaje_delivery = 'Por la lluvia pausamos el delivery hasta mañana.' where id = 'iguazu'`; producción todavía no lee la columna). Verificar en escritorio y a 375px: franja, barra superior, carrito (con un producto), checkout con Delivery deshabilitado y retiro elegido.
- [ ] **Step 4:** Con la pausa activa, `POST /api/orders` con `mode: "delivery"` → 400 con el motivo. **No** enviar un pedido de retiro real (crearía un pedido y avisos reales).
- [ ] **Step 5:** Restaurar `delivery_activo = true, mensaje_delivery = ''` y confirmar con un select. Vaciar el carrito de prueba (`DELETE /api/cart/draft`).
- [ ] **Step 6:** Actualizar `CLAUDE.md` (sección nueva "Delivery pausado", fecha y pendientes: probar el interruptor del panel con sesión de admin).
- [ ] **Step 7:** Commit de los archivos de esta tarea únicamente (sin push: pushear despliega y lo decide el dueño).
