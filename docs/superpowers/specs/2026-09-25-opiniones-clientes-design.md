# Opiniones de clientes

Fecha: 25/09/2026. Aprobado por el dueño en la misma fecha.

## Problema

La home tiene una sección Opiniones y el panel ya modera `testimonios` (pendiente / aprobado /
rechazado), pero los clientes no tienen dónde dejar un comentario: la tabla está vacía. El dueño
quiere una sección minimalista y atractiva que pregunte qué les pareció el producto (pizzas y
empanadas) y decidir él cuáles se publican.

## Decisiones del dueño

- **Dos puertas:** el seguimiento del pedido (cuando figura *Entregado*) pregunta por lo que pidió,
  y la home suma una invitación abierta a cualquiera (clientes del POS y del local incluidos).
- **Aprobar = publicar.** La home muestra las **6 aprobadas más recientes** (grilla en escritorio,
  carrusel en mobile).
- **Aviso por Telegram** cuando entra una opinión nueva.

## Datos

Migración sobre `testimonios`:

- `producto text not null default ''`: sobre qué opinó ("Diavola al Miele", "Empanadas").
- `pedido_id uuid null references pedidos(id) on delete set null` y `pedido_ref text not null default ''`.
  Vacíos si vino de la home. Con pedido = opinión verificada.
- Índice único parcial `(pedido_id) where pedido_id is not null`: una opinión por pedido.
- Índice `(sucursal_id, estado, created_at desc)` para la consulta de la home.

## Lógica pura: `lib/opiniones.ts` (testeable con `tsx`)

- `productosDelPedido(items)`: pizzas por nombre, mitad y mitad en sus dos gustos, cajas de
  empanadas como "Empanadas"; sin bebidas; sin repetidos; máximo 6.
- `preguntaOpinion(productos)`: uno solo → "¿Qué te pareció la X?" (o "¿Qué te parecieron las
  empanadas?"); varios → "¿Qué te pareció tu pedido?"; ninguno (home) → "¿Qué te pareció lo que
  probaste?".
- `lineaProducto(producto)`: "Probó la X" / "Probó las empanadas" / "" para la tarjeta.
- `validarOpinion(input, productosPermitidos)`: estrellas enteras 1–5; texto 5–500 caracteres
  (espacios colapsados); nombre 1–40; producto vacío o dentro de `productosPermitidos`.
  Devuelve `{ ok: true, opinion }` o `{ ok: false, error }` con mensaje mostrable.
- `textoAvisoOpinion(opinion, origen)`: texto del Telegram, en una línea por campo y sin formato
  (el cliente escribe todo; mismo cuidado que `lib/aviso-local.ts`).

## Servidor

- `POST /api/opiniones` (pública): límite `opinion` (5 por hora por IP) y campo trampa `sitio`
  (si viene lleno, responde OK sin guardar). Con `ref`: el pedido tiene que existir en
  `impasto`, estar `entregado` y no tener opinión; los productos permitidos salen del pedido.
  Sin `ref`: pizzas de la carta (no archivadas) y "Empanadas". Inserta `pendiente` y avisa por
  Telegram (sin romper si el aviso falla). Una opinión repetida responde 409 con un "gracias".
- `GET /api/orders/[ref]`: si está entregado, suma `opinion: { productos, yaOpino }`.
- `lib/catalog.ts`: aprobadas ordenadas por fecha, límite 6; `Review` suma `producto`.
- Panel: `Testimonial` suma `producto` y `pedidoRef`; la tarjeta los muestra
  ("Pedido IM-… · verificado" / "Desde la home").

## Cliente

- `components/opiniones/OpinionForm.tsx` (cliente): pregunta, estrellas doradas, chips o selector
  de producto, texto, nombre, campo trampa oculto, enviar; estados de éxito y error. Estilos
  `.opinion-*` en `app/impasto.css` (carbón, crema, dorado; el botón es el CTA terracota).
- Seguimiento: la tarjeta aparece bajo el estado cuando está entregado; si ya opinó, un "gracias".
- Home (`Reviews.tsx`): hasta 6 tarjetas con la línea del producto, la tarjeta de WhatsApp como
  hoy en escritorio y debajo la invitación "¿Ya probaste Impasto?" que despliega el formulario.
  Sin opiniones aprobadas, la sección muestra la invitación (también en mobile, donde hoy se oculta).

## Fuera de alcance

`aggregateRating`/estrellas en SEO (decisión tomada), respuestas del dueño, fotos, edición del
texto por el dueño, opiniones desde el POS.

## Pruebas

`tests/opiniones.test.ts` (nuevo, en `pnpm test`) para todo el módulo puro. Navegador: home con
opiniones y sin ellas, escritorio y mobile, y el formulario enviado con `/api/opiniones`
interceptado; seguimiento con `/api/orders/<ref>` interceptado como entregado. No se crean
opiniones ni pedidos reales. El panel lo prueba el dueño.
