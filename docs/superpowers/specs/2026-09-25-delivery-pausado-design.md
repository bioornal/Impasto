# Delivery pausado: solo retiro en el local

Fecha: 25/09/2026. Aprobado por el dueño en la misma fecha.

## Problema

El local puede quedarse sin reparto (lluvia, repartidor faltante, moto rota, demanda) sin
dejar de cocinar. Hoy la única palanca del panel es "Venta pausada", que corta **todo**. Falta
poder pausar **solo el delivery**, avisarle al cliente de forma elegante y profesional por qué,
y que igual pueda pedir online para retirar.

## Decisiones del dueño

- El aviso se ve en **franja superior + carrito + checkout** (no ventana emergente).
- El motivo es **texto libre**; si queda vacío, sale una frase por defecto.
- Interruptor manual, sin vencimiento automático (mismo modelo que "Venta pausada").

## Datos

Migración nueva sobre `sucursales`:

```sql
alter table sucursales add column if not exists delivery_activo boolean not null default true;
alter table sucursales add column if not exists mensaje_delivery text not null default '';
```

`BusinessConfig` suma `deliveryActivo: boolean` y `mensajeDelivery: string`.
`getBusinessConfig()` lee `branch.delivery_activo !== false` (una columna ausente equivale a
delivery activo) y `mensaje_delivery`. Ante un error de base ya devuelve `ventasActivas: false`,
así que no hace falta un fail-closed propio del delivery.

`PUT /api/admin/sucursal` acepta `delivery_activo` (booleano) y `mensaje_delivery` (string, trim).

## Lógica pura (testeable con `tsx`)

En `lib/hours.ts`, junto a `estadoTienda()`:

- `MENSAJE_DELIVERY_DEFAULT = "Por el momento no estamos haciendo envíos a domicilio. Podés pedir online y retirarlo en el local."`
- `estadoDelivery(business): { activo: boolean; motivo: string }`: si está activo, `motivo`
  vacío; si está pausado, el `mensajeDelivery` recortado o el texto por defecto.
- `validarModalidad(business, mode)`: lanza `Error` con un mensaje mostrable si `mode` es
  `"delivery"` y el delivery está pausado. El mensaje es el motivo seguido de
  "Elegí retiro en el local para completar tu pedido."

## Servidor

- `createPedido()` (`lib/orders.ts`), después del chequeo de `estadoTienda`, llama a
  `validarModalidad(business, order.mode)`. Es el punto único por donde pasan efectivo,
  transferencia y tarjeta, y corre antes del INSERT y antes de contactar a Mercado Pago.
- La recuperación de un intento de tarjeta existente (`findExistingCardOrder`) ocurre antes de
  `createPedido` y **no** se bloquea: un pedido creado antes de la pausa conserva su cobro.
- `/api/orders/quote` no cambia: cotiza, no crea pedidos.
- `/api/store-status` devuelve además `delivery: { activo, motivo }`.

## Cliente

`StoreStatusProvider` suma `delivery: { activo, motivo }` al contexto (estado inicial desde el
servidor, refresco cada 60 s y al volver a la pestaña, como hoy). El valor por defecto del
contexto es `{ activo: true, motivo: "" }`.

**Franja (`AvisoDelivery`).** Debajo de la barra superior (`Topbar` en `Header.tsx`), en
escritorio y mobile. Se muestra cuando `!delivery.activo && !cierreManual` (si la venta está
pausada del todo, manda ese aviso). Estilo carbón (`--carbon`) con acento dorado (`--gold`),
sin naranjas ni marrones. Contenido:

- Título: "Por ahora, solo retiro en el local"
- El motivo.
- "Te esperamos en {dirección}".

**Barra superior.** Con el delivery pausado, escritorio cambia "Envío gratis desde $X" por
"Solo retiro en el local"; mobile cambia "Entrega {estimado}" por "Solo retiro".

**Carrito (`CartDrawer`).** Con el delivery pausado: sin barra de progreso de envío gratis, la
línea de envío dice "Retiro en el local · Sin cargo", el total no suma envío y debajo del botón
aparece el motivo en letra chica.

**Checkout (`Checkout.tsx`, bloques de escritorio y mobile).** El estado sale de
`useStoreStatus().delivery`, no de la prop `business` (que viene de la página con ISR y puede
tener un minuto). Con el delivery pausado:

- `mode` arranca en `"takeaway"` y un efecto lo fuerza a `"takeaway"` si la pausa llega con el
  checkout abierto.
- La tarjeta de Delivery queda `disabled`, atenuada, con la leyenda "Pausado por el momento".
- Una nota con el motivo sobre las opciones de entrega.
- Si el delivery se reactiva con el checkout abierto, la opción vuelve a estar disponible y el
  modo elegido no cambia.

**Panel (`Settings.tsx`, sección Delivery).** Botón igual al de Venta:
"✓ Haciendo envíos" / "✕ Delivery pausado · solo retiro". Pausado, aparece el campo "Motivo que
ve el cliente" con la frase por defecto como placeholder. Se guarda con "Guardar cambios".

## Chatbot

`promptVendedor()` no cambia de firma: calcula `estadoDelivery(business)` adentro. Si está
pausado, la sección EL ENVÍO dice que
hoy solo hay retiro en el local, con el motivo y la dirección, y que no ofrezca envío ni hable
del envío gratis. El bot usa una copia de `business` de hasta 5 minutos, el mismo desfase que ya
tiene con "Venta pausada"; el servidor bloquea igual el pedido con delivery.

## Fuera de alcance

- Textos de marca y SEO: hero, ticker, footer, JSON-LD, FAQ, `llms.txt`, `opengraph-image`,
  términos. Describen el servicio, no el estado del momento.
- Carro Fogón: el operario ya sabe que no hay reparto.
- Comandas, Telegram, mails, seguimiento: los pedidos de retiro ya se muestran bien.
- Vencimiento automático de la pausa y recordatorio en el panel.

## Migración y despliegue

1. `npx -y @insforge/cli db migrations new delivery-pausado` y aplicar **solo esa**. En el
   working tree hay una migración ajena sin commitear (`20260922153137_compras-items.sql`, del
   recetario Android): comparar `db migrations list` con `migrations/` antes de cualquier `up`.
2. Verificar que las columnas existen en la base.
3. Recién después, commit del código (en `main`, commitear es a un push de desplegar).

## Pruebas

- `tests/hours.test.ts`: `estadoDelivery` (activo, pausado con motivo, pausado sin motivo,
  motivo solo con espacios) y `validarModalidad` (delivery pausado lanza con el motivo;
  takeaway pausado pasa; delivery activo pasa).
- `tests/chat-prompt.test.ts`: con el delivery pausado el prompt dice solo retiro y no menciona
  el envío gratis; activo, sigue como hoy.
- Navegador: panel (pausar/reactivar y guardar), franja, barra superior, carrito y checkout en
  escritorio y mobile; intento de forzar delivery contra `/api/orders` con la pausa activa.
