# Masa al molde — diseño (17/10/2026)

## Qué pidió el dueño

Que el cliente pueda elegir, además de la napoletana (el estilo principal, con el cornicione
inflado), la masa **al molde**, bien argentina. Hace falta un aviso bien visible en el home,
la elección al comprar y un conteo para saber qué prefiere la gente de Puerto Iguazú.
Por ahora queda en local: no se sube hasta que el dueño tenga las masas, quizás desde el lunes 20/10.

## Decisiones del dueño

- **Mismo precio** para las dos masas.
- **Todas las pizzas**, incluida la mitad y mitad, se pueden pedir al molde.
- **Se elige en el carrito, por pizza.** Agregar sigue siendo un toque; cada pizza del carrito
  muestra `Masa: Napoletana | Al molde`, con napoletana por defecto.
- **El POS (Carro Fogón) también elige masa**, como segunda parte, en su repo.
- **Aviso en el home:** un bloque entre el hero y las promos.

## Datos

- `CartItem.masa?: "napoletana" | "molde"`, solo en `pizza` y `pizza-half`. Va en el ítem y no en
  `variant` porque la mitad y mitad ya usa `variant`.
- `key` sigue siendo el id del producto (el servidor busca la pizza por `key`). Dos líneas con la
  misma `key` y distinta masa conviven en el carrito; `add` junta solo si coinciden `key` y masa.
- `quoteItem` normaliza: cualquier valor que no sea `"molde"` es `"napoletana"`. Si es al molde,
  `detail` dice `Masa al molde` (en la mitad y mitad: `Pizza mitad y mitad · Masa al molde`).
- `pedidos.productos` guarda el `CartItem` entero, así que `masa` queda guardada **sin migración**.
- Lógica compartida en `lib/masa.ts`: tipo, normalización, texto del detalle y conteo.

## Cocina

- Comanda impresa (copia cocina) y Telegram: el detalle de una pizza al molde sale en mayúsculas,
  `MASA AL MOLDE`. La napoletana no agrega texto: es la de siempre.
- Panel (detalle y comanda en pantalla): la línea al molde se resalta.
- Cliente (carrito, seguimiento, mail): `Masa al molde` en minúsculas, como confirmación.

## Conteo

Tarjeta "Masas elegidas" en el Dashboard del panel: suma las pizzas (unidades) de pedidos válidos
**que traen el campo `masa`**. Los pedidos viejos no cuentan, porque entonces no se podía elegir.

## Home y textos

- Bloque `MasasAviso` entre `Hero` y `Promos`: "Nuevo · Ahora también al molde", las dos masas lado
  a lado y el botón "Ver pizzas".
- El FAQ y el prompt del asistente dejan de decir "sin moldes" como regla de la casa y explican
  que hay dos masas a elección, al mismo precio.

## Fuera de alcance

- El costeo: una pizza al molde se costea como napoletana hasta que el recetario tenga la receta.
- POS: segunda parte, en `carroFogon`, con el mismo campo `masa`.
- No hay interruptor para apagar el molde: se publica cuando haya masas.
