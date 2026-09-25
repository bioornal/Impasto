# Opiniones de clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los clientes dejen su opinión (desde el seguimiento del pedido entregado o desde la home), que el dueño la apruebe en el panel y que la home muestre las 6 aprobadas más recientes.

**Architecture:** Validación y textos en un módulo puro (`lib/opiniones.ts`); ruta pública `POST /api/opiniones` con rate limit, campo trampa y verificación del pedido; formulario cliente compartido (`OpinionForm`) usado por el seguimiento y la home; `testimonios` suma producto y pedido.

**Tech Stack:** Next.js 16, React 19, TypeScript, InsForge (Postgres), `tsx`, pnpm.

Spec: `docs/superpowers/specs/2026-09-25-opiniones-clientes-design.md`.

## Global Constraints

- Nada se publica sin aprobación (`estado` por defecto `pendiente`).
- Todo lo que escribe el cliente va sin formato a Telegram (sin `parse_mode`) y en una línea por campo.
- Sin `aggregateRating` ni estrellas en el JSON-LD.
- No crear opiniones ni pedidos reales para probar (la base es producción).
- Colores: crema, carbón, dorado; terracota solo en el botón de enviar.
- Migración antes que el código; comparar `db migrations list` antes de `up --all`.

---

### Task 1: Módulo puro `lib/opiniones.ts` + `tests/opiniones.test.ts`

**Produces:**
- `productosDelPedido(items: unknown): string[]`
- `preguntaOpinion(productos: string[]): string`
- `lineaProducto(producto: string): string`
- `validarOpinion(input: unknown, productosPermitidos: string[]): { ok: true; opinion: Opinion } | { ok: false; error: string }` con `Opinion = { rating: number; texto: string; nombre: string; producto: string }`
- `textoAvisoOpinion(opinion: Opinion, origen: { ref?: string }): string`
- `EMPANADAS = "Empanadas"`

- [ ] Test primero (casos: pizza, mitad y mitad en dos gustos, caja → "Empanadas", bebida fuera, sin repetidos, tope 6, entrada basura → []; preguntas para 0/1/varios y empanadas; línea de producto; validación de estrellas 0/6/2.5/"5", texto corto/largo/colapsado, nombre vacío/largo, producto fuera de la lista, producto vacío válido; aviso con estrellas, nombre, texto aplanado, pedido o "desde la home").
- [ ] Ver fallar, implementar, ver pasar; sumar a `pnpm test`.

### Task 2: Migración `opiniones-pedido`

```sql
alter table testimonios add column if not exists producto text not null default '';
alter table testimonios add column if not exists pedido_id uuid references pedidos(id) on delete set null;
alter table testimonios add column if not exists pedido_ref text not null default '';
create unique index if not exists testimonios_pedido_uidx on testimonios (pedido_id) where pedido_id is not null;
create index if not exists testimonios_home_idx on testimonios (sucursal_id, estado, created_at desc);
```

- [ ] Aplicar solo esta y verificar columnas e índices.

### Task 3: Servidor

- [ ] `lib/rate-limit.ts`: `opinion: { max: 5, ventana: 3600 }` con comentario.
- [ ] `app/api/opiniones/route.ts`: POST según el spec (trampa → `{ ok: true }` sin guardar;
  con `ref`: `normalizarReferencia` + `esReferenciaValida`, pedido `impasto`/`iguazu`, `status === "entregado"`,
  sin opinión previa (consulta + índice único → 409); sin `ref`: `productos` pizzas no archivadas + `EMPANADAS`;
  insert; `sendTelegram(textoAvisoOpinion(...))` en try/catch con `await`).
- [ ] `GET /api/orders/[ref]`: sumar `id` al select; si `status === "entregado"`, consultar
  `testimonios` por `pedido_id` y devolver `opinion: { productos: productosDelPedido(pedido.productos), yaOpino }`.
- [ ] `lib/catalog.ts`: `.order("created_at", { ascending: false }).limit(6)` en testimonios.
- [ ] `types/index.ts`: `Review.producto?: string`; `lib/catalog-build.ts` `mapReviews` lo lee.
- [ ] Panel: `Testimonial.producto`, `Testimonial.pedidoRef`; `adaptTestimonial` los lee; la tarjeta
  muestra `lineaProducto` y "Pedido IM-… · verificado" o "Desde la home".

### Task 4: Formulario y home

- [ ] `components/opiniones/OpinionForm.tsx` con props
  `{ productos: string[]; modo: "pedido" | "home"; referencia?: string; nombreInicial?: string; yaOpino?: boolean }`.
  Pedido con un producto: se envía ese; con varios: chips opcionales. Home: `<select>` opcional
  "¿Qué probaste?". Estrellas como radios accesibles. Campo `sitio` oculto (tabIndex −1, aria-hidden).
- [ ] Estilos `.opinion-*` en `app/impasto.css` (y `.reviews-*` nuevos: línea de producto,
  invitación, carrusel mobile dentro de `@media (max-width:760px)`; quitar `.reviews-empty` del
  `display:none` mobile para que la invitación se vea).
- [ ] `Reviews.tsx`: hasta 6 tarjetas + `lineaProducto`; WhatsApp como hoy; invitación que
  despliega `OpinionForm modo="home"`. Sin opiniones: solo invitación (+ WhatsApp en escritorio).
  `Shell` le pasa `productos` = nombres de `data.pizzas` + `EMPANADAS` si hay empanadas.
- [ ] Seguimiento: tarjeta con `OpinionForm modo="pedido"` bajo el estado cuando `order.opinion` existe.

### Task 5: Verificación, docs y commit

- [ ] `pnpm test`, `tsc`, eslint de lo tocado, `pnpm build`.
- [ ] Chrome headless: home (0 y 6 opiniones, interceptando el HTML no: interceptar no aplica al SSR →
  verificar 0 opiniones real + formulario desplegado y enviado con `/api/opiniones` interceptado);
  seguimiento con `/api/orders/<ref>` interceptado como entregado; escritorio y 375 px.
- [ ] Validar la ruta real sin guardar: `POST /api/opiniones` con el campo trampa lleno → 200 sin
  fila nueva; con datos inválidos → 400; con una referencia inexistente → 404.
- [ ] `CLAUDE.md`, commit; push solo con confirmación del dueño.
