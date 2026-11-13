# Promociones y combos en el panel — diseño (13/11/2026)

## Pedido del dueño

Ventas flojas (≈4,8 pizzas por noche, equilibrio ≈4,3). Para pautar en Meta Ads hacen falta promos.
El dueño pidió una **sección exclusiva del panel** para crear, **editar** y **aprobar** promociones y
combos; "luego los anunciaremos en la página del cliente". Entran las propuestas de Claude y las suyas.

## Alcance por etapas

1. **Esta etapa: solo el panel.** Tabla nueva, sección "Promociones", alta/edición/aprobación/pausa,
   programación por días y fechas, y el margen de cada promo calculado con los costos reales.
   **El cliente no ve nada todavía**: ni la carta, ni el carrito, ni la cotización, ni el bot leen la tabla nueva.
2. Etapa siguiente (spec propio): mostrar las promos aprobadas en la web y aplicarlas en carrito,
   cotización y pedido (server-side, no acumulables), comanda y costeo.
3. Etapa aparte: Meta Pixel + eventos del embudo.

## Tres tipos de promo

| Tipo | Ejemplo | Configuración |
|---|---|---|
| `combo` | Dúo Muzza: 2 Muzzarella Impasto $26.900 | precio fijo + lugares; cada lugar es un producto fijo o "a elección" entre varios, con cantidad |
| `descuento_cantidad` | 2ª pizza al 50 % | cada N pizzas, la(s) más barata(s) con X % de descuento; vale para todas las pizzas o una lista |
| `regalo` | Llevando 2 pizzas, gaseosa 1,5 L de regalo | mínimo de pizzas, opciones de regalo (bebidas) y suplemento opcional por opción (Coca +$2.000) |

**Reglas comunes:** nombre interno, título y descripción para el cliente, días de la semana
(por defecto viernes a domingo), fechas desde/hasta opcionales, orden. **No acumulables** (se
aplicará en la etapa 2: una promo por pedido, la más conveniente para el cliente).

## Estados y aprobación

- `pendiente` → `aprobada` → `pausada` ⇄ `aprobada`. Toda promo nueva nace **pendiente**,
  incluidas las cargadas por Claude. Solo el botón **Aprobar** del panel la pasa a aprobada.
- **Editar una aprobada no la despublica** (el dueño es quien aprueba); queda registrada la fecha
  de la última edición. Si algún día quiere que vuelva a pendiente, es una línea en la API.
- Eliminar pide confirmación. Una promo aprobada que hace referencia a un producto archivado o no
  disponible se marca "Revisar" y, en la etapa 2, no se aplica.

## Margen (solo panel, nunca al cliente)

Con `productionCosts` y los precios efectivos de `lib/effective-prices.ts` (receta + caja), sin
contar delivery ni luz y sin comisión de tarjeta (casi nadie paga con tarjeta; se muestra aparte "con tarjeta"):

- **Combo:** precio − costo; con lugares "a elección", el peor y el mejor caso. Ahorro para el cliente
  contra la suma de precios de lista.
- **Descuento por cantidad:** lo que deja la pizza descontada en el peor caso (la de menor margen
  entre las elegibles) y el pedido mínimo típico.
- **Regalo:** costo del regalo (peor opción) y lo que deja el pedido mínimo con las pizzas más baratas.

Semáforo: rojo si algún caso deja ≤ $0 (no se puede aprobar), ámbar si la pizza o el pedido deja
menos de $2.000, verde el resto. El cálculo es puro (`lib/promos.ts`) y testeado.

## Datos

Tabla nueva **`ofertas`** (la vieja `promociones` es decorativa, la lee la carta pública y el bot;
no se toca ni se reutiliza para no publicar nada por accidente):

```
ofertas(id uuid pk, proyecto_id text not null default 'impasto', tipo text check (combo|descuento_cantidad|regalo),
  nombre text not null, titulo text not null, descripcion text not null default '',
  estado text not null default 'pendiente' check (pendiente|aprobada|pausada),
  config jsonb not null, dias int[] not null default '{5,6,0}', desde date, hasta date,
  orden int not null default 0, aprobada_en timestamptz, creada_en timestamptz default now(),
  actualizada_en timestamptz default now())
```

`config` según tipo (validado en `lib/promos.ts`, ids de `productos`):

- combo: `{ precio, lugares: [{ etiqueta?, cantidad, productos: [id…] }] }` (un solo id = fijo)
- descuento_cantidad: `{ cada, porcentaje, productos: [id…] | null }` (null = todas las pizzas)
- regalo: `{ minimoPizzas, cantidad, opciones: [{ producto, suplemento }] }`

RLS habilitado, sin política pública (solo la clave de backend). Migración con las 5 propuestas
como **pendientes**, buscando los productos por nombre:

1. Combo **Dúo Muzza**: 2 Muzzarella Impasto — $26.900.
2. Combo **Pizza + gaseosa**: Muzzarela y Jamon + (Pepsi 1.5 L o 7-Up 1.5 L) — $21.500.
3. Combo **Noche Impasto**: Muzzarella Impasto + Muzzarela y Jamon + 1 especial a elección
   (Napoletana all'Aglio, Diavola al Miele Piccante, Palmitos y Salsa Golf, Provoleta Impasto,
   Fugazzetta) + Coca-Cola 1.5 L — $55.000.
4. Descuento **2ª pizza al 50 %**: cada 2 pizzas, la más barata al 50 %, todas las pizzas.
5. Regalo **Gaseosa de regalo**: llevando 2 pizzas, Pepsi o 7-Up 1,5 L ($0) o Coca-Cola 1,5 L (+$2.000).

Fuera de esta etapa: "Primera pizza $11.900" (necesita reconocer cliente nuevo) y bajar el envío
gratis a $30.000 (ya se edita en Configuración → Delivery).

## Panel

- Menú: **Promociones** (con contador de pendientes), junto a Productos/Etiquetas.
- Lista compacta (una fila por promo, como Productos): nombre, tipo, resumen ("2 × Muzzarella ·
  $26.900"), días, estado, margen con semáforo, acciones Aprobar / Pausar / Reanudar / Editar / Eliminar.
  Filtros Pendientes · Aprobadas · Pausadas · Todas.
- Editor (modal, como el de productos), con el margen en vivo mientras se edita: tipo, textos,
  lugares/opciones con buscador de productos de la carta, precio o porcentaje, días y fechas.
- Mismo estilo neutro del panel; usable a 375 px.

## API

`GET/POST /api/admin/ofertas`, `PUT/DELETE /api/admin/ofertas/[id]`, `POST /api/admin/ofertas/[id]/estado`
(`aprobar|pausar|reanudar`). Todas con `requireAdmin`, filtro `proyecto_id = 'impasto'`, validación con
`lib/promos.ts`; aprobar se rechaza (400) si el margen da rojo o la config es inválida. El GET devuelve
cada promo con su margen calculado y la lista de productos elegibles (pizzas y bebidas en venta).

## Verificación

`pnpm test` (casos nuevos de validación y margen), `tsc`, eslint de lo tocado, `pnpm build`; la
migración probada en la base real dentro de `BEGIN … ROLLBACK` antes de aplicarla; el panel en local
con la sesión del dueño (escritorio y 375 px). **Aplicar la migración en producción y publicar
requieren el OK del dueño.**
