# Cupos de la noche — diseño (18/10/2026)

## Qué pidió el dueño

Poder decir cuántas pizzas de cada sabor se pueden vender esta noche ("me quedan 2 de rúcula y una
fugazzeta y media"). Al agotarse, la pizza pasa a Agotado y nadie la puede seguir pidiendo.

## Decisiones del dueño

- Frena a la **web y al POS**: el cupo es uno solo para toda la noche.
- **Se borra solo** a las 06:00 (noche de 06:00 a 05:59, hora de Argentina, como el POS y el resumen diario).
- Al cliente se le avisa **cuando quedan 2 o menos** ("¡Quedan 2!", "¡Última media!").
- Un pedido **cancelado** o con **pago rechazado** devuelve sus pizzas al cupo.

## Diseño

- **Mitades:** el cupo se guarda en mitades. Entera = 2, mitad y mitad = 1 de cada sabor. "1,5" = 3.
- **Base** (`migrations/20261018202351_cupos-noche.sql`): tabla `cupos_noche (proyecto_id, noche, producto_id,
  cupo_mitades, vendidas_mitades)`. `crear_pedido_costeado` (la usan web y POS) calcula el consumo con
  `cupos_consumo`, bloquea las filas, y si no alcanza lanza `CUPO_AGOTADO|<nombre>|<mitades que quedan>`:
  el pedido no se guarda. Si alcanza, descuenta y guarda en el pedido `cupo_consumo` y `cupo_noche`.
  Un trigger devuelve el cupo al cancelar, rechazar el pago o eliminar, una sola vez (`cupo_liberado`), y lo
  vuelve a sumar si el pedido vuelve a valer. Sin fila de cupo, no hay límite: igual que antes.
- **Web:** la carta lee los cupos de la noche (fuente no crítica; si falla, la base igual controla) y marca
  `quedanMitades`; en 0 la pizza sale Agotado. Cartelito "¡Quedan N!" cuando quedan 2 o menos. Con media
  restante, "Agregar" abre la mitad y mitad. La cotización frena el carrito que pide de más (409 con el
  texto para el cliente); el borrador del carrito no. Un pedido que consume cupo invalida el caché de la carta.
- **Panel:** sección "Cupos de la noche": por pizza, cupo (de a media), vendidas, quedan, Guardar y
  "Sin límite". `GET/PUT/DELETE /api/admin/cupos`. El cupo cuenta lo que se venda desde que se carga.
- **POS:** la carta saca la pizza con cupo en 0 (como un agotado) y muestra "Quedan N"; al guardar, el
  rechazo de la base vuelve como 409 con un mensaje para el operario.
