# Varias cuentas para transferencias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar varias cuentas para transferencias, elegir la activa desde el panel y que cada pedido conserve la cuenta que se le mostró.

**Architecture:** Lista jsonb en `sucursales.cuentas_transferencia` validada por un módulo puro (`lib/cuentas-transferencia.ts`). `getBusinessConfig()` expone solo la activa; `createPedido` guarda su foto en `pedidos.cuenta_transferencia`; confirmación, seguimiento, panel y Telegram leen esa foto.

**Tech Stack:** Next.js 16, TypeScript, InsForge (Postgres/PostgREST), tests con `tsx`, pnpm.

Spec: `docs/superpowers/specs/2026-09-25-cuentas-transferencia-design.md`.

## Global Constraints

- Ningún dato bancario real en el repo (es público): ni en migraciones, ni en tests, ni en docs.
- Ante datos mal formados: sin datos bancarios + "Pedir los datos por WhatsApp". Nunca un ejemplo.
- Migración antes que el código; `db migrations up --all` solo tras comparar con `db migrations list`.
- `pnpm`, CRLF: editar con Edit, no `sed -i`. No tocar archivos ajenos sin trackear.
- No crear pedidos reales para probar (la base es producción).

---

### Task 1: Módulo puro y sus tests

**Files:**
- Create: `lib/cuentas-transferencia.ts`
- Create: `tests/cuentas-transferencia.test.ts`
- Modify: `package.json` (script `test`: agregar `&& tsx tests/cuentas-transferencia.test.ts`)

**Interfaces — Produces:**
- `interface CuentaTransferencia { id: string; nombre: string; alias: string; cbu: string; banco: string; titular: string; activa: boolean }`
- `type DatosTransferencia = Omit<CuentaTransferencia, "id" | "activa">`
- `leerCuentas(raw: unknown): CuentaTransferencia[]`
- `cuentaActiva(cuentas: CuentaTransferencia[]): DatosTransferencia | null`
- `validarCuentas(input: unknown, nuevoId?: () => string): { ok: true; cuentas: CuentaTransferencia[] } | { ok: false; error: string }`
- `datosDesdePedido(raw: unknown): DatosTransferencia | null`

- [ ] **Step 1: Test que falla** — `tests/cuentas-transferencia.test.ts`

```ts
import { leerCuentas, cuentaActiva, validarCuentas, datosDesdePedido, type CuentaTransferencia } from "../lib/cuentas-transferencia";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

// Datos ficticios: el repo es público, nunca van cuentas reales acá.
const cuenta = (over: Partial<CuentaTransferencia>): CuentaTransferencia => ({
  id: "a", nombre: "Billetera A", alias: "PRUEBA.ALIAS.UNO", cbu: "0".repeat(21) + "1",
  banco: "Banco de Prueba", titular: "Titular Ficticio", activa: false, ...over,
});

/* ── lectura ── */
chequear("leerCuentas · no es lista → vacía", leerCuentas("basura").length === 0 && leerCuentas(null).length === 0);
chequear("leerCuentas · descarta entradas sin alias ni CBU", leerCuentas([cuenta({ alias: "", cbu: "" })]).length === 0);
chequear("leerCuentas · descarta entradas que no son objeto", leerCuentas([1, "x", null]).length === 0);
chequear("leerCuentas · conserva una cuenta válida", leerCuentas([cuenta({})]).length === 1);

/* ── la activa ── */
chequear("cuentaActiva · sin activa → null", cuentaActiva([cuenta({})]) === null);
const activa = cuentaActiva([cuenta({}), cuenta({ id: "b", nombre: "Billetera B", activa: true })]);
chequear("cuentaActiva · devuelve la marcada, sin id ni activa", activa?.nombre === "Billetera B" && !("id" in (activa ?? {})) && !("activa" in (activa ?? {})));
chequear("cuentaActiva · dos activas es ambiguo → null", cuentaActiva([cuenta({ activa: true }), cuenta({ id: "b", activa: true })]) === null);
chequear("cuentaActiva · activa leída de un JSON dañado a medias", cuentaActiva(leerCuentas([{ id: "z", activa: true }, cuenta({ activa: true })]))?.nombre === "Billetera A");

/* ── validación del panel ── */
const ok = (r: ReturnType<typeof validarCuentas>) => r.ok;
const error = (r: ReturnType<typeof validarCuentas>) => (r.ok ? "" : r.error);
chequear("validar · lista vacía es válida", ok(validarCuentas([])));
chequear("validar · no es lista → error", !ok(validarCuentas({})));
chequear("validar · una activa válida", ok(validarCuentas([cuenta({ activa: true })])));
chequear("validar · ninguna activa → error", /activa/i.test(error(validarCuentas([cuenta({})]))));
chequear("validar · dos activas → error", /activa/i.test(error(validarCuentas([cuenta({ activa: true }), cuenta({ id: "b", activa: true })]))));
chequear("validar · CBU corto → error", /22/.test(error(validarCuentas([cuenta({ activa: true, cbu: "123" })]))));
chequear("validar · alias de más de 20 no se recorta: error", /alias/i.test(error(validarCuentas([cuenta({ activa: true, alias: "A".repeat(25) })]))));
chequear("leerCuentas · alias de más de 20 no se recorta: se descarta", leerCuentas([cuenta({ alias: "A".repeat(25), cbu: "" })]).length === 0);
chequear("validar · alias con espacios → error", /alias/i.test(error(validarCuentas([cuenta({ activa: true, alias: "mi alias" })]))));
chequear("validar · sin alias ni CBU → error", !ok(validarCuentas([cuenta({ activa: true, alias: "", cbu: "" })])));
chequear("validar · sin nombre → error", /nombre/i.test(error(validarCuentas([cuenta({ activa: true, nombre: " " })]))));
chequear("validar · ids repetidos → error", !ok(validarCuentas([cuenta({ activa: true }), cuenta({})])));
const normalizada = validarCuentas([cuenta({ id: "", activa: true, cbu: "0000-0000 00000000000001 " })], () => "nuevo-id");
chequear(
  "validar · genera id y normaliza el CBU",
  normalizada.ok && normalizada.cuentas[0].id === "nuevo-id" && normalizada.cuentas[0].cbu === "0".repeat(21) + "1",
);
chequear("validar · más de 10 cuentas → error", !ok(validarCuentas(Array.from({ length: 11 }, (_, i) => cuenta({ id: `c${i}`, activa: i === 0 })))));

/* ── la foto guardada en el pedido ── */
chequear("datosDesdePedido · null → null", datosDesdePedido(null) === null);
chequear("datosDesdePedido · sin alias ni CBU → null", datosDesdePedido({ nombre: "X", alias: "", cbu: "" }) === null);
chequear("datosDesdePedido · lee la foto", datosDesdePedido({ nombre: "Billetera A", alias: "PRUEBA.ALIAS.UNO", cbu: "", banco: "B", titular: "T" })?.alias === "PRUEBA.ALIAS.UNO");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Step 2:** `pnpm exec tsx tests/cuentas-transferencia.test.ts` → falla (módulo inexistente).

- [ ] **Step 3: Implementación** — `lib/cuentas-transferencia.ts`

```ts
/**
 * Cuentas para transferencias. Son el único dato del negocio al que un cliente
 * le manda plata, así que ante cualquier duda este módulo devuelve "nada" y el
 * sitio ofrece pedir los datos por WhatsApp: nunca un valor de ejemplo.
 *
 * Sin dependencias: se testea con `tsx`.
 */

export interface CuentaTransferencia {
  id: string;
  /** Nombre corto para el dueño ("ARQ", "AstroPay"): panel y aviso de Telegram. */
  nombre: string;
  alias: string;
  /** CBU o CVU, solo dígitos (22). Vacío si la cuenta se usa por alias. */
  cbu: string;
  banco: string;
  titular: string;
  activa: boolean;
}

/** Lo que ve el cliente y queda guardado en el pedido. */
export type DatosTransferencia = Omit<CuentaTransferencia, "id" | "activa">;

const MAX_CUENTAS = 10;
const ALIAS = /^[A-Za-z0-9.-]{6,20}$/;
const CBU = /^\d{22}$/;

const texto = (valor: unknown, max: number) => (typeof valor === "string" ? valor.trim().slice(0, max) : "");
const soloDigitos = (valor: unknown) => (typeof valor === "string" ? valor.replace(/[\s-]/g, "") : "");

function datos(valor: Record<string, unknown>): DatosTransferencia | null {
  // Sin recortar antes de validar: un alias truncado sería otro alias.
  const alias = texto(valor.alias, 64);
  const cbu = soloDigitos(valor.cbu);
  const aliasOk = ALIAS.test(alias);
  const cbuOk = CBU.test(cbu);
  if (!aliasOk && !cbuOk) return null;
  return {
    nombre: texto(valor.nombre, 40),
    alias: aliasOk ? alias : "",
    cbu: cbuOk ? cbu : "",
    banco: texto(valor.banco, 80),
    titular: texto(valor.titular, 80),
  };
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** La lista guardada en `sucursales`. Lo que no tenga forma de cuenta se descarta. */
export function leerCuentas(raw: unknown): CuentaTransferencia[] {
  if (!Array.isArray(raw)) return [];
  const cuentas: CuentaTransferencia[] = [];
  for (const valor of raw) {
    if (!esObjeto(valor)) continue;
    const id = texto(valor.id, 64);
    const leidos = datos(valor);
    if (!id || !leidos) continue;
    cuentas.push({ id, ...leidos, activa: valor.activa === true });
  }
  return cuentas;
}

/** La cuenta que ven los clientes. Dos activas es ambiguo: mejor ninguna que la equivocada. */
export function cuentaActiva(cuentas: CuentaTransferencia[]): DatosTransferencia | null {
  const activas = cuentas.filter((cuenta) => cuenta.activa);
  if (activas.length !== 1) return null;
  const { nombre, alias, cbu, banco, titular } = activas[0];
  return { nombre, alias, cbu, banco, titular };
}

/** Valida lo que manda el panel. Los mensajes se muestran tal cual al dueño. */
export function validarCuentas(
  input: unknown,
  nuevoId: () => string = () => crypto.randomUUID(),
): { ok: true; cuentas: CuentaTransferencia[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "La lista de cuentas no es válida" };
  if (input.length > MAX_CUENTAS) return { ok: false, error: `Podés guardar hasta ${MAX_CUENTAS} cuentas` };

  const cuentas: CuentaTransferencia[] = [];
  const ids = new Set<string>();
  for (const [indice, valor] of input.entries()) {
    const posicion = `Cuenta ${indice + 1}`;
    if (!esObjeto(valor)) return { ok: false, error: `${posicion}: datos inválidos` };
    const nombre = texto(valor.nombre, 40);
    if (!nombre) return { ok: false, error: `${posicion}: poné un nombre corto (por ejemplo, el banco)` };
    const alias = texto(valor.alias, 64);
    if (alias && !ALIAS.test(alias)) return { ok: false, error: `${nombre}: el alias debe tener entre 6 y 20 letras, números, puntos o guiones` };
    const cbu = soloDigitos(valor.cbu);
    if (cbu && !CBU.test(cbu)) return { ok: false, error: `${nombre}: el CBU/CVU debe tener 22 dígitos` };
    if (!alias && !cbu) return { ok: false, error: `${nombre}: cargá el alias o el CBU/CVU` };
    const id = texto(valor.id, 64) || nuevoId();
    if (ids.has(id)) return { ok: false, error: `${nombre}: identificador repetido; recargá la página` };
    ids.add(id);
    cuentas.push({
      id, nombre, alias, cbu,
      banco: texto(valor.banco, 80),
      titular: texto(valor.titular, 80),
      activa: valor.activa === true,
    });
  }

  const activas = cuentas.filter((cuenta) => cuenta.activa).length;
  if (cuentas.length > 0 && activas !== 1) {
    return { ok: false, error: "Elegí una sola cuenta activa: es la que ven los clientes" };
  }
  return { ok: true, cuentas };
}

/** La foto que guardó el pedido al crearse. */
export function datosDesdePedido(raw: unknown): DatosTransferencia | null {
  return esObjeto(raw) ? datos(raw) : null;
}
```

- [ ] **Step 4:** agregar el test al script `test` de `package.json` y correr `pnpm exec tsx tests/cuentas-transferencia.test.ts` → todos PASA.

---

### Task 2: Migración y carga de ARQ

**Files:**
- Create: `migrations/<ts>_cuentas-transferencia.sql` (vía `db migrations new cuentas-transferencia`)

- [ ] **Step 1:** `db migrations list` para confirmar que no hay pendientes ajenas.
- [ ] **Step 2:** contenido:

```sql
-- Varias cuentas para transferencias; los clientes ven solo la activa.
-- La cuenta que ya estaba cargada pasa a la lista copiándola de la propia fila:
-- los datos bancarios no se escriben en el repo, que es público.
alter table sucursales add column if not exists cuentas_transferencia jsonb not null default '[]'::jsonb;

update sucursales
   set cuentas_transferencia = jsonb_build_array(jsonb_build_object(
         'id', gen_random_uuid()::text,
         'nombre', coalesce(nullif(banco, ''), 'Cuenta principal'),
         'alias', alias_cbu,
         'cbu', cbu,
         'banco', banco,
         'titular', titular_cuenta,
         'activa', true))
 where cuentas_transferencia = '[]'::jsonb
   and (alias_cbu <> '' or cbu <> '');

-- La cuenta que se le mostró al cliente, para que el pedido la conserve
-- aunque después cambie la activa. Solo la escribe la web.
alter table pedidos add column if not exists cuenta_transferencia jsonb;
```

- [ ] **Step 3:** `db migrations up --all`; verificar con `select jsonb_array_length(cuentas_transferencia) from sucursales` (1) y que `pedidos.cuenta_transferencia` existe.
- [ ] **Step 4:** agregar ARQ por `db query` (no en el repo): desactivar las existentes y sumar ARQ activa con nombre `ARQ`, alias, CVU, banco y titular que dio el dueño. Verificar: 2 cuentas, 1 activa (ARQ). El código de producción actual no lee esta columna: no cambia nada hasta el deploy.

---

### Task 3: Servidor

**Files:** `lib/business.ts`, `lib/business-server.ts`, `lib/orders.ts`, `app/api/orders/route.ts`, `app/api/orders/[ref]/route.ts`, `app/api/admin/sucursal/route.ts`, `lib/aviso-local.ts`, `tests/aviso-local.test.ts`

- [ ] **Step 1 (test que falla):** en `tests/aviso-local.test.ts`, junto al caso de transferencia:

```ts
const transferenciaConCuenta = plantillaLocal({ ...base, metodoPago: "transferencia", cuentaTransferencia: "Billetera A" }, "pedido_recibido");
chequear("la transferencia dice en qué cuenta revisar", transferenciaConCuenta.includes("PAGO SIN CONFIRMAR — revisar en Billetera A"));
```

- [ ] **Step 2:** `lib/aviso-local.ts`: `AvisoPedido.cuentaTransferencia?: string` y

```ts
  if (aviso.metodoPago === "transferencia") {
    const cuenta = unaLinea(aviso.cuentaTransferencia);
    return `PAGO SIN CONFIRMAR — revisar${cuenta ? ` en ${cuenta}` : ""}`;
  }
```

- [ ] **Step 3:** `lib/business.ts`: reemplazar `cbu?`, `aliasCbu?`, `banco?`, `titularCuenta?` por

```ts
  /**
   * La cuenta activa para transferencias, o `null`. Es el único dato al que un
   * cliente le manda plata: sin cuenta activa válida el sitio no muestra datos
   * bancarios y ofrece pedirlos por WhatsApp. Ver `lib/cuentas-transferencia.ts`.
   */
  cuentaTransferencia: DatosTransferencia | null;
```

y en `BUSINESS` reemplazar los cuatro campos vacíos por `cuentaTransferencia: null,` (conservando el comentario de por qué nunca va un valor de ejemplo).

- [ ] **Step 4:** `lib/business-server.ts`: reemplazar las cuatro líneas por
  `cuentaTransferencia: cuentaActiva(leerCuentas(branch.cuentas_transferencia)),`.
- [ ] **Step 5:** `lib/orders.ts`: `CreatedOrder.cuentaTransferencia: DatosTransferencia | null`;
  antes del insert `const cuentaTransferencia = payment.metodoPago === "transferencia" ? business.cuentaTransferencia : null;`,
  en el insert `cuenta_transferencia: cuentaTransferencia,` y `return { id, numero, referencia, ...quote, cuentaTransferencia };`.
- [ ] **Step 6:** `app/api/orders/route.ts`: en el aviso `cuentaTransferencia: created.cuentaTransferencia?.nombre,`
  y en la respuesta `cuentaTransferencia: created.cuentaTransferencia,`.
- [ ] **Step 7:** `app/api/orders/[ref]/route.ts`: agregar `cuenta_transferencia` al select y

```ts
  // La cuenta que se le mostró al cliente al pedir. Los pedidos anteriores a la
  // lista de cuentas no la tienen: para esos, la activa, como antes.
  const cuenta = pedido.metodo_pago === "transferencia"
    ? datosDesdePedido(pedido.cuenta_transferencia) ?? business.cuentaTransferencia
    : null;
  …
      bancoInfo: cuenta ? { alias: cuenta.alias, cbu: cuenta.cbu, banco: cuenta.banco, titular: cuenta.titular } : null,
```

- [ ] **Step 8:** `app/api/admin/sucursal/route.ts`: sacar `"cbu", "alias_cbu", "banco", "titular_cuenta"` de la lista de strings y agregar

```ts
  if (body.cuentas_transferencia !== undefined) {
    const cuentas = validarCuentas(body.cuentas_transferencia);
    if (!cuentas.ok) return NextResponse.json({ ok: false, error: cuentas.error }, { status: 400 });
    updates.cuentas_transferencia = cuentas.cuentas;
  }
```

- [ ] **Step 9:** `pnpm exec tsx tests/aviso-local.test.ts` pasa; `pnpm exec tsc --noEmit` señala los consumidores pendientes (Confirmation, Settings) que resuelve la Task 4.

---

### Task 4: Cliente y panel

**Files:** `components/Shell.tsx`, `components/checkout/Confirmation.tsx`, `app/admin/components/Settings.tsx`, `lib/adapt-order.ts`, `app/admin/components/types.ts`, `app/admin/components/Orders.tsx`, `tests/adapt-order.test.ts`

- [ ] **Step 1 (test que falla):** `tests/adapt-order.test.ts`:

```ts
const conCuenta = adaptOrder({ ...rawConDetalle, metodo_pago: "transferencia", cuenta_transferencia: { nombre: "Billetera A", alias: "PRUEBA.ALIAS.UNO", cbu: "", banco: "", titular: "" } });
if (conCuenta.cuentaTransferencia === "Billetera A") console.log("PASA   adaptOrder lee la cuenta de la transferencia");
else { fallos++; console.log("FALLA  cuenta de transferencia:", conCuenta.cuentaTransferencia); }
```

- [ ] **Step 2:** `types.ts`: `cuentaTransferencia?: string;` en `AdminOrder`. `adapt-order.ts`:
  `cuentaTransferencia: datosDesdePedido(p.cuenta_transferencia)?.nombre ?? "",`.
- [ ] **Step 3:** `Orders.tsx` detalle: `{order.pago}{order.cuentaTransferencia ? ` · ${order.cuentaTransferencia}` : ""}`;
  comanda de transferencia: `(Verificar comprobante{order.cuentaTransferencia ? ` en ${order.cuentaTransferencia}` : ""})`.
- [ ] **Step 4:** `Shell.tsx`: `ConfirmedOrder.cuentaTransferencia?: DatosTransferencia | null` y en el `setOrder` de `onConfirm`
  `cuentaTransferencia: result.cuentaTransferencia ?? null,`.
- [ ] **Step 5:** `Confirmation.tsx`: `Order.cuentaTransferencia?: DatosTransferencia | null`; reemplazar
  `business.aliasCbu/titularCuenta/banco/cbu` por `const cuenta = order.cuentaTransferencia ?? null;` y
  `cuenta?.alias`, `cuenta?.titular`, `cuenta?.banco`, `cuenta?.cbu`.
- [ ] **Step 6:** `Settings.tsx`: `cuentas_transferencia?: CuentaTransferencia[]` en `Sucursal` (sin los cuatro campos
  viejos). El editor trabaja sobre el array crudo del estado (`config.cuentas_transferencia ?? []`), sin pasarlo por
  `leerCuentas`, para no descartar una cuenta a medio tipear; la validación la hace el servidor al guardar. Helpers `cambiarCuenta(id, campo, valor)`,
  `usarCuenta(id)`, `quitarCuenta(id)` (con `confirm`, y si era la activa, pasa a la primera restante),
  `agregarCuenta()` (id `crypto.randomUUID()`, activa si es la primera). Sección "Cuentas para transferencias"
  con una tarjeta por cuenta y el botón "+ Agregar cuenta".
- [ ] **Step 7:** `pnpm test`, `tsc`, eslint de los archivos tocados.

---

### Task 5: Verificación, docs y publicación

- [ ] `pnpm build`.
- [ ] Local: `GET /api/orders/<ref de un pedido por transferencia viejo>` devuelve `bancoInfo` de ARQ (fallback a la activa).
- [ ] Chrome headless: checkout con transferencia, `/api/orders` interceptado con una respuesta que trae `cuentaTransferencia` de ARQ; la confirmación muestra ARQ. No se crea ningún pedido real.
- [ ] `CLAUDE.md`: sección nueva y actualizar la mención a los datos bancarios de "Transferencias bancarias completas".
- [ ] Commit, `git fetch` + rebase si hace falta, re-test. **Push solo con confirmación del dueño**: publicar es lo que pone ARQ frente a los clientes. Después, seguir el deploy hasta `ready`.
