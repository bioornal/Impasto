# Promociones — etapa 2: web, POS y ganancias (13/11/2026)

Pedido del dueño: que al activar (aprobar) una promo, el carrito, los cobros, el POS y las ganancias del
recetario la manejen bien. Base: spec `2026-11-13-promociones-panel-design.md` (sección "Requisito para la
etapa 2") y el motor `lib/promos-aplicar.ts` (puro, con `tests/promos-aplicar.test.ts`).

## Reglas de negocio

- Solo promos `aprobada`, del día de la **noche de negocio** (corte 06:00, hora argentina) y dentro de
  `desde/hasta` (`ofertasVigentes`). **Una promo por pedido** (no acumulables). Un combo se puede repetir
  (4 Muzzarellas con Dúo = 2 dúos); la 2ª al X % se aplica por cada grupo de N pizzas.
- El cliente (o el operario del POS) **elige** la promo; el carrito preselecciona la de mayor ahorro entre
  las que aplican (`promosAplicables`). El regalo pide elegir la bebida, solo entre las vendibles ahora
  (disponibles y con stock).
- **El servidor manda**: recalcula con el motor sobre las líneas ya cotizadas a precio de lista. Si la promo
  pedida ya no aplica (vencida, pausada, combo incompleto, bebida agotada) responde 409 con el motivo del
  motor; nunca cobra distinto de lo que mostró la cotización.
- **El descuento va dentro del precio de cada línea**: una línea puede partirse en tramos (p. ej. 3
  Muzzarellas con Dúo = una línea de 2 a precio de combo + una de 1 a lista). El combo se prorratea por
  precio de lista y la suma da exacto su precio. El regalo es una **línea nueva** de la bebida con precio =
  suplemento (0). Cada línea con promo lleva `promo: { id, nombre, tipo, precioLista }`.
- `pedidos.promo jsonb` guarda `{ id, nombre, tipo, ahorro }` del pedido (migración nueva; la función
  `crear_pedido_costeado` ya inserta cualquier columna existente que venga en el JSON).
- Envío gratis, comisión y total se calculan sobre el subtotal ya descontado. Masas, cupos y stock no
  cambian: las líneas siguen siendo pizzas y bebidas normales (el regalo descuenta stock).
- Costeo: igual que hoy por línea; la bebida regalada entra con su costo.

## Web (Impasto)

- Carta: las promos vigentes se muestran en la sección de promos del home (título, descripción, precio o
  "−50 % en la 2ª", botón). Combo: "Agregar" agrega sus productos al carrito (con un selector si hay lugares a
  elección) y deja elegida esa promo. Las demás se ofrecen en el carrito.
- Carrito y checkout: bloque "Tu promo" con las aplicables (radio), la preseleccionada, el selector de
  bebida si es regalo, y el ahorro: "Dúo Muzza: ahorrás $4.100". El total del carrito coincide con la cotización.
- `CartItem` suma `promo?` (solo lo escribe el servidor). La cotización recibe `promo: { ofertaId,
  regaloProductoId? } | null`, aplica el motor y devuelve líneas en tramos + `promo` del pedido.
- Comanda, Telegram, mail y detalle del panel: muestran "Promo: Dúo Muzza (−$4.100)"; la bebida de regalo
  aparece como "1 x Pepsi 1.5 L (regalo)". Resumen diario y Dashboard ya suman bien por el total.
- El bot: puede mencionar las promos vigentes (título y descripción) sin cotizarlas.
- Panel Promociones: el aviso "todavía no se muestran en la web" se cambia por "Las aprobadas se muestran
  en la web y en el POS los días elegidos".

## POS (Carro Fogón)

- Copia del motor en `src/lib/promos-aplicar.ts` (mismos tests). Lee `ofertas` vigentes.
- En el formulario del pedido, selector "Promo" con las aplicables al pedido cargado (y la bebida si es
  regalo). `POST /api/pedidos` recibe la promo, resuelve nombres de la carta a ids, aplica el motor y guarda
  igual que la web (tramos, `promo` en líneas y en el pedido). 409 con motivo si no aplica.
- Ticket y comanda muestran la promo.

## Recetario (Ganancias)

- `desglosePedido` no cambia (ya reparte lo cobrado por precios de línea).
- Bloque nuevo "Promociones" del mes: por promo, pedidos, unidades, cobrado, resignado
  (Σ (precioLista − precio) × cantidad de líneas con esa promo), costo de esos pedidos (de `pedido_costeos`)
  y lo que dejaron; y el total del mes con y sin esos pedidos. Sin pedidos con promo: el bloque dice que no hubo.

## Orden de publicación

Migración `pedidos.promo` → web → POS → recetario. Verificación: tests de los tres, cotización real en
local contra la base (sin crear pedidos), `crear_pedido_costeado` con una promo dentro de `BEGIN … ROLLBACK`.
