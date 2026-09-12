# Plan maestro de apertura — ecosistema Impasto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Este archivo es la **hoja de ruta y el punto de retome**. Cubre tres repos y varios subsistemas independientes, así que los bloques marcados **«requiere plan detallado»** se bajan a su propio plan con `superpowers:writing-plans` antes de escribir código (en `docs/superpowers/plans/` del repo que corresponda). No se programa directo desde acá.

**Goal:** Abrir la pizzería (solo delivery y take-away) con la web, la carga telefónica y el recetario coordinados, sin la llave maestra expuesta, con precios y pedidos coherentes entre los tres, y con un ensayo general verificado.

**Architecture:** Tres apps sobre una sola base InsForge (`3agqcygs.us-east.insforge.app`, proyecto `App_PedidosDelivery`). La **Fase 0** (seguridad) es secuencial y bloquea el resto. Después el trabajo se reparte en **tracks por repo** (A web, C carro, R recetario, B base, D dueño) que corren en paralelo, con las dependencias marcadas. Todo converge en el **ensayo general** y la **noche de apertura**.

**Tech Stack:** Impasto: Next.js 16 + `@insforge/sdk` + Mercado Pago (Orders API), Netlify, `pnpm`, tests con `tsx`. Carro Fogón: Next.js 15 + Zustand, Vercel, `npm`, sin tests. Recetario: Astro 5 SSR + Tailwind 4, Netlify, `npm`, tests con `vitest`.

## Global Constraints

- Impasto usa **`pnpm`**; carro y recetario usan **`npm`**. No crear `package-lock.json` en Impasto.
- **Commit en `main` = deploy a producción** en los tres (Netlify: web y recetario; Vercel: carro). Commitear solo con OK explícito del dueño, por cambio.
- En Impasto **dos sesiones comparten el mismo working tree y la rama `main`**: `git fetch` antes de pushear, `git add` con rutas explícitas, nunca `reset`/`rebase` sobre `main`.
- Migraciones: `npx -y @insforge/cli db migrations new <nombre>` + `db migrations up --all`. **Nunca DDL con `db query`**: lo descarta en silencio.
- `lib/effective-prices.ts` (Impasto) y `next-app/src/lib/effective-prices.ts` (carro) son **copias idénticas**: todo cambio va en las dos y se verifica con `diff`.
- Toda consulta nueva a `productos` o `pedidos` lleva `proyecto_id` (`'impasto'` o `'carro'`).
- Las tablas del costeo (`recetas`, `ingredientes`, `receta_ingredientes`, `precios_venta`, `costos_*`, `config_negocio`, `gastos`) las escribe **solo el recetario**. Corregir datos ahí requiere OK del dueño.
- **Nunca imprimir claves** (`ik_…`, MP, Telegram, DeepSeek). Solo nombres de variables.
- Verificar contra el sistema real (navegador, base, precios en vivo), no solo con tests.
- Greps de verificación con `--include=*.ts --include=*.tsx` (y `*.astro` en el recetario).
- Impasto y carro usan el **puerto 3000**: no levantar los dos dev servers a la vez.
- `npm run build` del recetario **falla en Windows al final** (`EPERM: operation not permitted, symlink` en el hook de `@astrojs/netlify`). Si antes dice `✓ built`, el código compila; Netlify construye en Linux.
- El login del recetario es solo del lado del cliente y las pantallas están detrás de él: no se automatiza la verificación en navegador con contraseña.
- Carro: el repo es privado y el deploy de Vercel **no se puede verificar desde la CLI**; se confirma en el panel de Vercel.

---

## Cómo retomar (5 minutos)

1. Leer este archivo entero, `CLAUDE.md` de los tres repos y la memoria del proyecto (`auditoria-apertura-2026-09-12`).
2. Ver el estado real de los tres repos:
   ```bash
   for d in Impasto carroFogon recetario-napolitano; do git -C "C:/Users/spezi/Documents/PROYECTOS/$d" fetch --quiet; echo "== $d"; git -C "C:/Users/spezi/Documents/PROYECTOS/$d" status --short; git -C "C:/Users/spezi/Documents/PROYECTOS/$d" log --oneline -3; done
   ```
3. Buscar el primer `- [ ]` sin marcar de la **Fase 0**. Si la Fase 0 está completa, elegir un track libre en el [mapa de paralelismo](#mapa-de-trabajo-en-paralelo).
4. Anotar lo hecho en la [Bitácora](#bitácora) al final.

| Repo | Ruta | Verificar | Deploy |
|---|---|---|---|
| Web Impasto | `C:\Users\spezi\Documents\PROYECTOS\Impasto` | `pnpm test` · `pnpm lint` · `npx tsc --noEmit` | Netlify, site `59704321-c8d7-4be4-ab7f-72f4b936435e` |
| Carro Fogón | `C:\Users\spezi\Documents\PROYECTOS\carroFogon\next-app` | `npx tsc --noEmit` · `npm run lint` | Vercel (panel) |
| Recetario | `C:\Users\spezi\Documents\PROYECTOS\recetario-napolitano` | `npx vitest run` · `npm run build` (ver restricción EPERM) | Netlify, site `7f09693b-1069-4482-899e-8c453f206713` |

Estado de un deploy de Netlify (desde `Impasto/`):
```bash
npx netlify api listSiteDeploys --data '{"site_id":"<site_id>","per_page":3}'
```
Consulta de solo lectura a la base (desde `Impasto/`):
```bash
npx -y @insforge/cli db query "select proyecto_id, count(*) from pedidos group by 1" --json
```
Precios publicados en la web: el HTML de `https://vocal-naiad-861a2c.netlify.app/` trae el JSON-LD con cada `"@type":"MenuItem"` y su `"price"`.

---

## Estado al 12/09/2026

**Datos en producción:** `pedidos` y `clientes` con 0 filas (nunca pasó un pedido real) · `sucursales.ventas_activas = false` con mensaje público “Cerrado de onda! No queremos trabajar!” · `productos`: 49 de Impasto + 60 del carro (44 son copia de la carta de Impasto) · advisor: 20 críticos `security/rls-disabled` + 3 avisos de índices · rol `anon` con INSERT/UPDATE/DELETE en las 20 tablas · Telegram ya cargado en Netlify · sin proveedor de email.

**Números del negocio** (recetario, precios con redondeo de a $500): costo operativo $2.040.000/mes · objetivo 450 pizzas · costo operativo $4.533 por pizza y $378 por empanada · pizza promedio $20.368, ingredientes $8.535, contribución $11.833 · **equilibrio 173 pizzas/mes (≈7 por noche de 26)** · con alquiler ($5.000.000) y delivery ($800.000), hoy inactivos: 663/mes (25,5 por noche).

### Ya hecho — no rehacer

- [x] Auditoría de los tres proyectos (informe: https://claude.ai/code/artifact/5bf9cb0c-1096-4f62-aaed-6c1f8fde9dcc)
- [x] Empanadas y bebidas sin prepizza ni salsa: datos de las 9 recetas en 0 + regla en los tres cálculos — Impasto `becbc40`, carro `3dbbfcd`, recetario `d7128b9`
- [x] Página de precios del recetario respeta el rendimiento “Directo” (`calcCostoPorUnidad`) — recetario `097234f`
- [x] Redondeo hacia arriba de a $500 sobre el precio al peso del recetario, en web y carro — Impasto `59573a6`, carro `b9ca349`
- [x] El carro guarda en el pedido el mismo precio que muestra (`src/lib/precios-efectivos.ts`) — carro `b9ca349`

---

## Mapa de trabajo en paralelo

```
FASE 0 (secuencial, dueño + código) ──┬──> Track A  Web Impasto ─────────┐
  0.1 rotar clave                     ├──> Track C  Carro (según D1) ────┤
  0.2 cargar clave y reconstruir      ├──> Track R  Recetario ──> B1 RLS ┼──> ENSAYO GENERAL ──> NOCHE DE APERTURA ──> PRIMER MES
  0.3 repo recetario privado          ├──> Track B  Base (B2, B3) ───────┤
  0.4 cartel de cierre y CBU          └──> Track D  Decisiones y cuentas ┘
```

| Track | Repo | Depende de | En paralelo con | Choques de archivos a evitar |
|---|---|---|---|---|
| A | Impasto | Fase 0; A6 depende de D1; A8 de D3; A11 de D5 | C, R, B, D | A1, A2 y A3 tocan `app/admin/components/StoreProvider.tsx` → en serie o en la misma sesión. A4 y A5 tocan `lib/orders.ts` → en serie |
| C | carroFogon | Fase 0 y **D1** | A, R, B, D | Si se toca `effective-prices.ts`, replicar en Impasto |
| R | recetario | Fase 0; R2 usa A5 para la fecha | A, C, D | R1 cambia cómo accede a la base **todo** el recetario: hacerlo antes que R2–R4 |
| B | Impasto (`migrations/`) | B1 depende de **R1** | A, C, D | Migraciones: una sesión por vez |
| D | — (dueño) | nada | todos | — |

---

## Fase 0 — Seguridad (hoy, secuencial)

**Por qué:** la API key `ik_…` de InsForge es de administrador (saltea cualquier regla) y está publicada en `/_astro/insforge.*.js` del recetario en producción, en `src/lib/insforge.ts:4` y en `.mcp.json` (trackeado) del repo **público** `bioornal/recetario-napolitano`. Es la misma que usan la web (`INSFORGE_API_KEY`) y el carro (`INSFORGE_ANON_KEY`). El repo guarda además otra `ik_` distinta en `docs/superpowers/plans/2026-04-26-dashboard-pizzeria.md`.

**Efecto asumido:** entre 0.1 y el fin de 0.2 la web y el carro no leen la base (con la tienda cerrada no afecta a nadie). **El recetario queda sin datos hasta terminar R1** porque tiene la clave vieja escrita en el código; no hace falta para vender, pero mientras tanto no se editan costos.

- [ ] **0.1 Rotar la clave** *(dueño)*. En el panel de InsForge, regenerar la API key del proyecto `App_PedidosDelivery`. Si la segunda `ik_` del documento de `docs/` pertenece a otro proyecto vivo, rotarla también.
  - Verificar: una consulta con la clave vieja responde 401.
- [ ] **0.2 Cargar la clave nueva y reconstruir** *(dueño)*. Netlify (Impasto): `INSFORGE_API_KEY`. Vercel (carro): `INSFORGE_ANON_KEY`. **Reconstruir los dos**: cambiar una variable no afecta deploys publicados (Impasto: “Trigger deploy” en Netlify o `npx netlify deploy --trigger`; carro: “Redeploy” en Vercel).
  - Verificar web: el JSON-LD de la home lista 49 productos.
  - Verificar carro: iniciar sesión y ver la carta en `/home`.
- [ ] **0.3 Repo del recetario en privado** *(dueño)*. GitHub → `bioornal/recetario-napolitano` → Settings → Change visibility. Verificar: `curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/bioornal/recetario-napolitano` responde 404.
- [ ] **0.4 Datos visibles** *(dueño, desde el panel de Impasto → Configuración)*: cambiar `mensaje_cierre` por un texto presentable y confirmar que CBU, alias, banco y titular son los reales. Borrar la fila `categoria = 'medio_pago'` de `info_empresa_impasto` (CBU viejo, alias `IMPASTO.PIZZA`): hoy ningún código la lee.
  - Verificar: el HTML de la home ya no contiene “No queremos trabajar”.

Después de 0.2 el riesgo inmediato queda cerrado. **B1 (RLS)** cierra el resto y depende de R1.

---

## Track A — Web Impasto

Rutas relativas a `C:\Users\spezi\Documents\PROYECTOS\Impasto`.

### A1. Una tarjeta no aprobada no entra a cocina ni a ventas · BLOQUEANTE · requiere plan detallado

- **Hoy:** el pedido se crea antes de cobrar (`app/api/payments/card/route.ts:69`) con `status: "normal"` (`lib/orders.ts:128`) y el rechazo solo actualiza `estado_pago` (`card/route.ts:95`). El panel lo trata como nuevo (suena la campanilla), la comanda imprime `[!] COBRAR AL ENTREGAR` (`app/admin/components/Orders.tsx:335`), suma en el Dashboard y en Ganancias del recetario. Si MP responde 5xx la ruta devuelve 202 con `ok:false` (`card/route.ts:120`), el cliente reintenta y se crea **otro pedido con otra referencia y otra clave de idempotencia**: riesgo de doble cobro.
- **Qué hacer:**
  1. Módulo puro `lib/pedido-visible.ts` con `esPedidoParaCocina(p: { metodo_pago: string; estado_pago: string; status: string }): boolean` → `false` si `metodo_pago === "mercadopago"` y `estado_pago !== "aprobado"`, o si `status === "cancelado"`.
  2. Usarlo en `StoreProvider.tsx` (lista de pedidos, detección de nuevos y campanilla), en `Orders.tsx` (comanda) y en `Dashboard.tsx` (ventas).
  3. Reintento con la misma referencia: el checkout de tarjeta reenvía la `external_reference` del intento anterior y `card/route.ts` reutiliza ese pedido si existe y no está aprobado, en vez de crear otro.
- **Test (`tests/pedido-visible.test.ts`, agregar a `pnpm test`):** tarjeta `pendiente` → false · tarjeta `rechazado` → false · tarjeta `aprobado` → true · efectivo `pendiente` → true · transferencia `pendiente` → true · efectivo `cancelado` → false.
- **Hecho cuando:** en el ensayo, una tarjeta rechazada no suena, no se imprime y no suma ventas; un reintento no crea un segundo pedido.

### A2. La comanda imprime sabores y mitades · BLOQUEANTE

- **Hoy:** `adaptOrder` copia solo `name`, `qty` y `price` y descarta `detail` (`app/admin/components/StoreProvider.tsx:32`). Una “Caja x12” sale sin gustos; solo Telegram los trae (`lib/aviso-local.ts`).
- **Qué hacer:** mover `adaptOrder` a `lib/adapt-order.ts` (sin React, testeable con `tsx`) conservando `detail: String(i.detail || i.detalle || "")`; mostrarlo debajo de cada ítem en el detalle del panel y en la comanda de `Orders.tsx`.
- **Test (`tests/adapt-order.test.ts`):** un pedido con `productos: [{ name: "Caja x12", qty: 1, price: 30000, detail: "4 Pollo, 4 Carne, 4 Árabe" }]` conserva el `detail`; un ítem sin detalle da `""`.
- **Hecho cuando:** la comanda de prueba del ensayo con mitad y mitad y caja de 12 sale completa en la impresora térmica.

### A3. Panel: sesión vencida visible y campanilla desde el primer pedido · BLOQUEANTE

- **Hoy:**
  - el polling ignora cualquier error (`StoreProvider.tsx:318`, `if (!res.ok) return;`) y `lib/admin-auth.ts:11` lee el token de la cookie sin renovarlo: al vencer la sesión **dejan de entrar pedidos sin aviso**;
  - `updateOrderStatus`/`updateProduct` no revisan la respuesta;
  - la campanilla exige `prevIds.size > 0` (`StoreProvider.tsx:325`): con el panel vacío (noche de apertura) el primer pedido no suena;
  - se crea un `AudioContext` por aviso y el navegador lo bloquea hasta que alguien toca la pantalla.
- **Qué hacer:**
  - con 401, banner fijo rojo “Sesión vencida — volvé a entrar” e intento de renovación antes de mostrarlo;
  - revisar `res.ok` en los updates y mostrar el error;
  - condición de campanilla solo `!isInitialLoadRef.current`;
  - un único `AudioContext`, creado y reanudado en el primer click del panel, con un aviso “Tocá la pantalla para activar el sonido” mientras esté suspendido.
- **Verificar:** en el ensayo, panel abierto 3 horas seguidas recibe pedidos; con cookie borrada a mano aparece el banner; el primer pedido de un panel vacío suena.

### A4. Quitar “Programar 21:00 / 22:00” · BLOQUEANTE

- **Hoy:** `components/checkout/Checkout.tsx:36-37` ofrece horarios y el servidor guarda cualquier `cuando`. Contradice la decisión documentada “sin pedidos anticipados”. Si D4 cambia esa decisión, este ítem se reemplaza por validar el horario elegido contra la atención.
- **Qué hacer:** dejar solo “Lo antes posible” en `Checkout.tsx` y rechazar en el servidor un `cuando` distinto de `"asap"` con 400 y mensaje “Por ahora solo tomamos pedidos para ya”. La validación va en un módulo sin `db` para poder testearla (`lib/orders.ts` importa el SDK).
- **Test:** `validarCuando("asap")` ok · `validarCuando("21:00")` error.

### A5. Fecha del pedido en hora de Argentina · IMPORTANTE

- **Hoy:** `lib/orders.ts:143` graba `new Date().toISOString().slice(0, 10)` (UTC): todo pedido desde las 21:00 queda con la fecha del día siguiente, y Ganancias (que filtra por `fecha`) pasa la última noche del mes al mes siguiente.
- **Qué hacer:** función pura `fechaLocal(d: Date, zona = "America/Argentina/Buenos_Aires"): string` con `new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)`, junto a la lógica de `lib/hours.ts`, y usarla en `orders.ts:143`.
- **Test (en `tests/hours.test.ts`):** `fechaLocal(new Date("2026-09-13T01:30:00Z"))` → `"2026-09-12"` · `fechaLocal(new Date("2026-09-12T15:00:00Z"))` → `"2026-09-12"`.

### A6. “Pedido manual” en el panel · requiere plan detallado · depende de D1

Solución definitiva para teléfono y WhatsApp (hasta tenerla, el operario carga el pedido en el checkout de la web). Migración `pedidos.origen text not null default 'web'` (valores `web`, `telefono`, `whatsapp`); formulario en el panel que reutiliza la cotización de `lib/order-quote.ts` y crea el pedido con `createPedido` desde una ruta protegida por `requireAdmin`; la comanda y Ganancias muestran el origen.

### A7. Envío · IMPORTANTE · depende de D3

- **Hoy:** tarifa única; `lib/business-server.ts:42` usa `branch.delivery_fee || BUSINESS.deliveryFee`, así que un envío de $0 es imposible; no hay zonas ni pedido mínimo, aunque el panel promete “zonas”; “Listo para retirar” reutiliza el estado `en-camino`.
- **Qué hacer:** cambiar `||` por `??` (test: `delivery_fee: 0` → 0). Zonas y mínimo según D3, con su propio plan.

### A8. Clientes compartidos · IMPORTANTE

- **Hoy:** un retiro borra la dirección guardada (`lib/orders.ts:74`, `direccion: order.dir || ""`); teléfonos sin normalizar duplican clientes; `cant_compras` se lee y reescribe (`orders.ts:64-75`) y pierde incrementos; el carro pisa `detalles` con `null`.
- **Qué hacer:** `normalizarTelefono(t: string): string` (solo dígitos) usado en web y carro; no pisar `direccion` cuando la modalidad es retiro; incremento atómico con una función SQL por migración (`update clientes set cant_compras = cant_compras + 1 where telefono = $1`).

### A9. Mercado Pago: devolución parcial · IMPORTANTE

`lib/mercadopago.ts:149` pasa un `partially_refunded` a `reembolsado`: bloquea una segunda devolución y la comanda lo muestra como no pagado. Agregar un estado `reembolso_parcial` y mapearlo en panel y comanda.

### A10. Stock y email · IMPORTANTE

- Stock: `StoreProvider.tsx:23` fija `stock: 24` y el campo no se guarda. Sacar el campo del formulario de productos (para agotar se usa `disponible`).
- Email: el checkout promete confirmación por mail y no hay proveedor. Hasta D-cuentas, quitar esa promesa del texto del checkout; cuando esté Resend, cargar `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` en Netlify y reconstruir.

### A11. Precios que se mueven solos · IMPORTANTE · depende de D5

`lib/catalog.ts:40` suma **todos** los `gastos`, sin fecha: cada gasto cargado sube la carta para siempre (el recetario hace lo mismo en `precios.astro`, `index.astro` y `marketing.astro`). Si falla una consulta de costos, los precios bajan en silencio. Opciones según D5: filtrar `gastos` por mes en los cuatro lugares, o publicar una lista de precios aprobada (tabla nueva) y dejar el cálculo en vivo solo como sugerencia del recetario.

### A12. Mejoras sin apuro

- [ ] PUT/DELETE de pedidos filtran solo `sucursal_id`: agregar `.eq("proyecto_id", "impasto")` en `app/api/admin/pedidos/[id]/route.ts:22,36`.
- [ ] `numero_pedido` sale del reloj y se repite cada 15 minutos (`lib/orders.ts:113`).
- [ ] `rate_limit_intentos` crece: la limpieza corre en el 2 % de los requests (`lib/rate-limit.ts:86`).
- [ ] El panel descarga todo el historial cada 15 s: limitar a los últimos 2 días.
- [ ] React #418 por las metas que inyecta Netlify: dejar de escribir `<head>` a mano en `app/layout.tsx` y pasar las fuentes a `next/font`.
- [ ] Logs estructurados y monitoreo básico de errores.

---

## Track C — Carro Fogón · depende de D1

Rutas relativas a `C:\Users\spezi\Documents\PROYECTOS\carroFogon\next-app`.

**Si D1 = “el carro vuelve a ser solo de El Fogón”** (recomendado, con A6 para la pizzería):

- [ ] **C1. Allowlist de operarios.** Hoy entra cualquier usuario del Auth compartido; el admin está hardcodeado (`src/lib/auth.ts:4`). Variable `CARRO_OPERARIOS_EMAILS` como `INSFORGE_ADMIN_EMAILS` de Impasto; `requireAuth` rechaza con 403 a quien no esté.
- [ ] **C2. El middleware valida la sesión.** `middleware.ts:12` solo mira que exista la cookie `token` (con `token=x` se ve `/home`). Validar contra `/api/auth/sessions/current` o decodificar y verificar vencimiento.
- [ ] **C3. Numeración sin duplicados.** Lectura del máximo del día y después insert, sin bloqueo (`app/api/pedidos/route.ts`); el número local persiste en `localStorage` y solo se sincroniza al montar `Total.tsx:34`. Índice único `(proyecto_id, fecha, numero_pedido)` por migración + reintento con el siguiente número; el insert con `.select()` para imprimir el número real.
- [ ] **C4. `/api/telegram` no reenvía texto libre.** Hoy manda cualquier texto de un usuario logueado (`app/api/telegram/route.ts`). Armar el mensaje en el servidor a partir del pedido guardado.
- [ ] **C5. Mantenimiento.** Borrar `../package-lock.json` (89 bytes, sin trackear); `npm audit` (10 vulnerabilidades, 2 críticas); rate limit del login en memoria (`app/api/auth/route.ts:7`) no sirve en serverless.
- [ ] **C6. Filas copiadas de la carta de Impasto.** 44 filas `proyecto_id='carro'` de pizzas, empanadas y bebidas: si El Fogón no las vende, marcarlas `disponible=false` (con OK del dueño), no borrarlas.

**Si D1 = “el carro sigue siendo la central telefónica de la pizzería”:** requiere plan detallado. Tendría que escribir `proyecto_id='impasto'` y `sucursal_id='iguazu'`, respetar horario, envío, modalidad, mitad y mitad, cajas y medios de pago de Impasto, imprimir la marca Impasto (`src/lib/print.ts:72-73` dice “EL FOGÓN / DELIVERY IGUAZÚ”) y resolver el 10 % en efectivo (`src/store/useStore.ts:104`) según D2. Es rehacer la web en otro repo: por eso se recomienda A6.

---

## Track R — Recetario

Rutas relativas a `C:\Users\spezi\Documents\PROYECTOS\recetario-napolitano`.

### R1. Acceso real y ninguna clave de administrador en el navegador · BLOQUEANTE · requiere plan detallado · bloquea B1

- **Hoy:**
  - `src/lib/insforge.ts:4` tiene la clave escrita y todas las pantallas (`costos`, `ganancias`, `ingredientes`, `marketing`, `precios`, `recetas`) leen y escriben la base desde el navegador;
  - `src/layouts/Layout.astro:45` redirige a `/login` solo en el cliente;
  - `src/pages/api/marketing.ts` está abierto (rate limit en memoria por `x-forwarded-for`, falsificable) y gasta OpenAI sin techo.
- **Decisión de diseño a tomar en el plan detallado** (antes de programar, consultando las skills `insforge` e `insforge-cli`):
  - **(a) Anon key + sesión + RLS con políticas:** el navegador usa la anon key real y el JWT del usuario logueado; políticas que permiten leer y escribir las tablas del costeo, y leer `pedidos`, solo a usuarios de una allowlist. Menos refactor. Ojo: OAuth Google/GitHub está habilitado y no hay verificación de email, así que “authenticated” no alcanza: la allowlist es obligatoria.
  - **(b) Todo por endpoints del servidor:** rutas `src/pages/api/*` con la clave de servidor y sesión verificada; el navegador no habla con InsForge. Más refactor, RLS sin políticas (deny all).
- **En cualquiera de las dos:**
  - sacar la clave de `src/lib/insforge.ts` y de `.mcp.json`, y quitar `.mcp.json` de git con `git rm --cached .mcp.json` + `.gitignore`;
  - borrar la `ik_` de `docs/superpowers/plans/2026-04-26-dashboard-pizzeria.md`;
  - proteger `/api/marketing` con la misma sesión y un límite por usuario.
- **Hecho cuando:** ningún archivo de `/_astro/*.js` en producción contiene `ik_`; sin sesión, las pantallas no muestran datos y la API responde 401.

### R2. Ganancias confiable · IMPORTANTE · depende de R1 (y de A5 para la fecha)

- [ ] `src/pages/ganancias.astro:369` usa `unidadesFogon.get(...)`, que no existe: debe ser `unidadesFogonMap.get(...)`. El primer pedido del carro rompe la página.
- [ ] Los gastos del mes se restan dos veces: `totalOp` ya los incluye (`ganancias.astro:428`, `totalFijos + totalVariables + totalGastos`) y `gananciaNeta = gananciaBruta - totalOp - gastosExtra` (`:763-764`) los vuelve a restar. Dejar una sola resta y que las tarjetas `res-costo-op` y `res-gastos` (`:782-783`) no se superpongan.
- [ ] Facturación teórica: usa precio de receta × unidades en vez del total cobrado, así que mitades y cajas quedan afuera. Usar `total_con_descuento ?? total` de cada pedido.
- [ ] Solo excluye `cancelado` (`ganancias.astro:340`): excluir también pagos con tarjeta no aprobados y reembolsados (misma regla que A1).
- [ ] Canal por heurística (`:342-352`): usar `proyecto_id`.
- [ ] `ventas_mes` no existe (`:319`, `:796`) y “Guardar ventas” muestra ✓ igual: quitar la función o crear la tabla por migración (decidir en el plan).
- **Test:** extraer el armado del resumen a `src/utils/ganancias.ts` puro y cubrirlo en `src/utils/ganancias.test.ts` (pedido cancelado, tarjeta rechazada, pedido del carro, caja de empanadas).

### R3. Escrituras frágiles · IMPORTANTE

- [ ] `src/utils/fmt.ts:30`: `dbWrite` reintenta INSERTs no idempotentes; es el origen probable de los ingredientes duplicados. Reintentar solo lecturas y updates.
- [ ] `src/pages/recetas.astro:508-518`: al guardar se borran todos los ingredientes y se reinsertan; si el insert falla la receta queda vacía y la web cobra solo el costo operativo. Insertar primero y borrar lo viejo después, o una función SQL transaccional.

### R4. Modelo de costos · IMPORTANTE · depende de D6

- [ ] Agregar comisión de Mercado Pago (% sobre precio), caja o packaging por producto y costo de delivery.
- [ ] `recetas.astro:479`: “+ Nueva” precarga prepizza y salsa en toda receta nueva; precargar 0 y dejar el valor por defecto solo para pizzas.
- [ ] Filtro de `gastos` por mes en `precios.astro`, `index.astro` y `marketing.astro` (junto con A11).

### R5. Datos de costeo · dueño, desde el recetario

- [ ] Anchoas 8 kg en `Pizza Anchoas` y `Napoletana Marinara` (y un `precio_kg` de 414 que no es por kilo).
- [ ] Ingredientes duplicados en `Empanadas Espinaca y Muzza`, `Empanadas Arabe` y una receta sin nombre.
- [ ] `Pesto 0 g` en `Napoletana Margarita Especial`.
- [ ] `Huevo Duro 0,002` (unidades cargadas como kg) en Blue Bacon, Carbonara, Palmito Especial, Primavera y Calzone Super.
- [ ] `precio_kg = 0` en Pan, Mayonesa, Sésamo y Agua; cheddar cargado en kg en hamburguesas (carro).
- [ ] 3 recetas sin nombre y `Prepizza Económica` sin ingredientes.
- [ ] 78 de 87 ingredientes sin actualizar hace más de 60 días.
- [ ] Nombre contra receta: `Pizza 5 Quesos` lleva seis; `Pizza Rellena Provolone` lleva sardo (D9).
- **No es error:** “Directo 1” en Caprese, Palmito, Jamón y Muzza y Espinaca y Muzza es una receta de una empanada.

---

## Track B — Base InsForge

Migraciones en `Impasto/migrations/` con la CLI (ver Global Constraints).

### B1. RLS en las 20 tablas y sin escritura para `anon` · BLOQUEANTE · depende de R1

- **Qué hacer:** migración `rls-tablas-publicas` que, para cada tabla de `public`, ejecute `alter table <t> enable row level security;` y `revoke insert, update, delete on <t> from anon;`, más las políticas que defina R1 (si eligió la opción a). Las apps de servidor usan la clave de administrador, que saltea RLS.
- **Verificar:**
  ```bash
  npx -y @insforge/cli db query "select grantee, string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where table_schema='public' and grantee='anon' group by 1" --json
  npx -y @insforge/cli diagnose advisor --json
  ```
  Esperado: `anon` sin INSERT/UPDATE/DELETE; advisor sin `security/rls-disabled`. Después: la web lista 49 productos, el carro carga `/home` y el recetario funciona con sesión.

### B2. Índices de claves foráneas · MEJORA

Migración `indices-costeo`:
```sql
create index if not exists idx_precios_venta_receta_id on precios_venta (receta_id);
create index if not exists idx_receta_ingredientes_receta_id on receta_ingredientes (receta_id);
create index if not exists idx_receta_ingredientes_ingrediente_id on receta_ingredientes (ingrediente_id);
```
Verificar: `diagnose advisor` sin `performance/missing-fk-index`.

### B3. Limpiezas periódicas · MEJORA · requiere plan detallado

Carritos abandonados (`carritos`) y `rate_limit_intentos` de más de 1 hora, con un schedule de InsForge. Si se alarga la ventana del aviso del chat (`VENTANA_AVISO`), alargar también la limpieza.

---

## Track D — Decisiones y cuentas del dueño

| # | Decisión | Destraba | Estado |
|---|---|---|---|
| D1 | ¿Pedidos telefónicos por la web ahora y “Pedido manual” en el panel después? ¿El carro vuelve a ser solo de El Fogón o se retira? | A6, Track C | [ ] |
| D2 | ¿Existe el 10 % de descuento en efectivo? Hoy solo lo aplica el carro | C (rama central telefónica) | [ ] |
| D3 | Zonas de envío, pedido mínimo, envío gratis desde $45.000 | A7 | [ ] |
| D4 | ¿Pedidos programados? (la decisión documentada es que no) | A4 | [ ] |
| D5 | ¿Precios en vivo desde el recetario o lista aprobada? ¿`gastos` del mes o acumulados? | A11, R4 | [ ] |
| D6 | ¿Alquiler ($5.000.000) y delivery ($800.000) son reales? ¿Objetivo 450 pizzas y 26 noches? ¿$900.000 cubren a todo el equipo? | R4, precios | [ ] |
| D7 | ¿Quién tiene el panel abierto, en qué equipo y cuántas terminales cargan pedidos? | A3, C3 | [ ] |
| D8 | ¿Qué usuarios hay en InsForge Auth y se cierra el registro abierto (OAuth habilitado, sin verificar email)? | R1, C1 | [ ] |
| D9 | `Pizza 5 Quesos` y `Pizza Rellena Provolone`: ¿cambia el nombre o la receta? | R5 | [ ] |
| D10 | ¿Los calzones llevan prepizza y salsa? (hoy sí) | regla `llevaPrepizzaYSalsa` | [ ] |

Cuentas y operación:
- [ ] Resend (dominio por DNS) → `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` en Netlify + reconstruir. Paso a paso en `docs/P0-configuracion-cuentas.md`.
- [ ] Google Business Profile de la pizzería.
- [ ] Fotos reales de productos (se suben desde el panel al storage).
- [ ] Impresora térmica (80 o 58 mm) conectada a la PC de cocina.
- [ ] Cadete con celular y cambio; respuesta rápida de WhatsApp con el link de la web.

---

## Ensayo general · depende de Fase 0, A1–A4, R1 y B1

Con la tienda abierta solo para el dueño. Anotar resultado en la Bitácora.

- [ ] Delivery en efectivo: llega el aviso de Telegram, suena la campanilla, sale la comanda.
- [ ] Retiro en local: no se borra la dirección guardada del cliente (si A8 está hecho).
- [ ] Transferencia: el cliente ve CBU, alias, banco y titular correctos.
- [ ] Tarjeta real aprobada y devolución desde el panel.
- [ ] Tarjeta rechazada: no suena, no se imprime, no suma ventas; reintentar no crea otro pedido.
- [ ] Mitad y mitad + caja de 12: la comanda sale con sabores.
- [ ] Pedido telefónico cargado por el operario desde el checkout de la web (o con A6).
- [ ] Intento fuera de horario: se rechaza con el mensaje configurado.
- [ ] Comanda en la impresora térmica real.
- [ ] Panel abierto 3 horas seguidas: sigue recibiendo pedidos.
- [ ] Ganancias del recetario del mes muestra los pedidos de prueba con fecha correcta.
- [ ] Borrar los pedidos de prueba (con OK del dueño) y confirmar que Ganancias vuelve a cero.

## Noche de apertura (martes a domingo, 19:30 a 00:00; último pedido 23:45)

- [ ] 18:45 PC de cocina: `/admin` con sesión recién iniciada.
- [ ] 18:50 Tocar la pantalla del panel (habilita el sonido).
- [ ] 18:55 Rollo cargado e imprimir una comanda de prueba.
- [ ] 19:00 Telegram abierto en el celular del encargado.
- [ ] 19:15 Cadete con celular y cambio.
- [ ] 19:25 Panel → Configuración → Ventas activas: sí.
- [ ] 19:30 Abierto. Si el panel no suena en 15 minutos con pedidos esperados: recargar `/admin` y mirar Telegram.
- [ ] 00:00 Cierre: revisar pedidos sin entregar.

## Primer mes (una revisión por semana)

- [ ] Pedidos por noche contra el equilibrio (≈7 pizzas por noche con los costos activos).
- [ ] Ticket promedio y cuántos pedidos pasan el envío gratis ($45.000).
- [ ] Canal: web contra teléfono.
- [ ] Cancelaciones y tarjetas rechazadas.
- [ ] Tiempo real de entrega contra el que promete la web (`deliveryEstimate`).
- [ ] Avanzar con los IMPORTANTES de A, C y R en ese orden.

---

## Bitácora

| Fecha | Quién / sesión | Qué se hizo | Commits |
|---|---|---|---|
| 12/09/2026 | Claude (auditoría) | Auditoría de los tres proyectos, correcciones de precios de empanadas, rendimiento “Directo”, redondeo de a $500, precio guardado en el carro, este plan | Impasto `becbc40` `59573a6` · carro `3dbbfcd` `b9ca349` · recetario `d7128b9` `097234f` |
