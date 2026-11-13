# Stock de bebidas — diseño (13/11/2026)

## Pedido del dueño

"Debe existir el stock de bebidas para que el sistema sepa si puede dejar escoger una determinada bebida",
pensado para la promo "+ Bebida de regalo" (el cliente elige cualquier bebida según stock) y para la venta
normal. Eligió **inventario que se arrastra** entre noches (no cupo por noche).

## Reglas

- Cada bebida de Impasto tiene **unidades en stock** o **sin control** (NULL). Sin cargar = sin control: se
  vende como hoy. Así nada cambia hasta que el dueño cargue números.
- **Cada venta descuenta**, venga de la web o del POS, se cobre o se regale (en la etapa 2 el regalo es una
  línea de bebida normal, así que descuenta igual). Pedidos de cajas, mitades y pizzas no tocan el stock.
- **Devuelve** cuando el pedido se cancela, el pago con tarjeta se rechaza o el pedido se elimina; vuelve a
  descontar si se reactiva (mismo patrón que `cupos_noche`: `pedidos.stock_consumo` jsonb + `stock_liberado`).
- **Nunca se vende de más:** `crear_pedido_costeado` bloquea las filas de stock de las bebidas del pedido
  (orden fijo por id, junto con cupos y masas) y rechaza con `STOCK_AGOTADO|<nombre>|<quedan>`. La web y el
  POS lo traducen: "Nos quedan 2 Coca-Cola 1.5 L: ajustá la cantidad."
- Con 0 la bebida sale **Agotado** en la web (no se puede agregar ni elegir como regalo) y desaparece de la
  carta del POS. Con 3 o menos, la tarjeta avisa "¡Quedan 3!" como las pizzas.
- **Historial:** cada cambio queda en `stock_movimientos` (producto, delta, motivo `carga|ajuste|venta|devolucion`,
  pedido, quién, cuándo). Sirve para entender un número raro; no se muestra al cliente.

## Datos

Migración nueva en `Impasto/migrations/`:

```
stock_bebidas(producto_id uuid pk references productos(id), proyecto_id text not null default 'impasto',
  unidades int check (unidades >= 0), actualizado_en timestamptz default now())
stock_movimientos(id uuid pk, producto_id uuid, delta int, motivo text check (...), pedido_id uuid null,
  actor text null, creado_en timestamptz default now())
pedidos.stock_consumo jsonb null, pedidos.stock_liberado boolean not null default false
```

Funciones: `cargar_stock_bebida(producto, delta, motivo)` (suma una compra o corrige, nunca deja negativo),
`fijar_stock_bebida(producto, unidades | null)` (null = sin control) y `stock_consumo(productos jsonb)` que
reconoce bebidas por id (web, `type` bebida) o por nombre (POS, sin `type`), igual que `masas_consumo`.
`crear_pedido_costeado` se reescribe sobre la versión vigente (`20261031122631_masas-por-tipo.sql`) sin
cambiar nada más de su comportamiento; los triggers de cupos se extienden para devolver y re-descontar stock.
RLS habilitado, sin políticas nuevas (el backend entra con `project_admin`). Sin `OWNER TO`, sin bloques `DO`.

## Panel

En **Arranque**, bloque "Stock de bebidas" (debajo de masas): una fila por bebida en carta con
− [unidades] + , botón **"+ Compra"** (pide cuántas entraron y suma) y "Sin control". Ámbar con ≤ 3, rojo en 0.
También visible como columna "Stock" en Productos para bebidas. Guarda con el mismo patrón de 700 ms de
`CupoControl`. API `GET/PUT /api/admin/stock` (requireAdmin).

## Web y POS

- Carta y ficha: Agotado / "¡Quedan N!" para bebidas con stock. `/api/store-status` o la carta traen el stock
  fresco; el carrito no deja sumar más de lo que queda (como `topeDePizzas`).
- La cotización valida stock (409) antes de crear el pedido; el rechazo de la base se traduce igual.
- POS (Carro Fogón): la carta oculta bebidas en 0 y el 409 se muestra con el motivo.

## Verificación

Tests de `stock_consumo` y de la lógica de carrito; SQL probado en la base real dentro de `BEGIN … ROLLBACK`
(venta web, venta POS por nombre, rechazo, cancelar, reactivar, pago rechazado, eliminar, sin control);
local con la base real; `pnpm test`, `tsc`, eslint, `pnpm build` y en el POS `npm test` y `npm run build`.
Migración y publicación con OK del dueño, migración antes del deploy.
