# Etiquetas editables desde el panel

Fecha: 20 de agosto de 2026
Estado: aprobado, pendiente de plan de implementación

## Problema

Las etiquetas de producto funcionan, pero **la lista de etiquetas posibles está hardcodeada
en tres lugares distintos**, y ninguno se puede tocar sin deployar:

| Lugar | Qué tiene hardcodeado |
|---|---|
| `app/admin/components/Products.tsx:136` | Los 4 botones del editor: `vegetariana`, `picante`, `gourmet`, `dulce` |
| `components/sections/PizzaList.tsx:109` | El único badge de pizza: `gourmet` |
| `components/sections/EmpanadasSection.tsx:87-89` | Tres `if` sueltos: `picante`, `vegetariana`, `dulce` |

Hoy el dueño puede marcar y desmarcar esas cuatro, pero no crear una quinta. Cada etiqueta
nueva es un cambio de código, un push y un deploy.

Además el sistema es **asimétrico sin una razón**: `dulce` se puede marcar y se muestra en
empanadas, pero no existe como pestaña de pizzas; y hay estilos CSS escritos y nunca usados
(`.p-badge.veg`, `.p-badge.hot`) para badges de pizza que el componente no renderiza.

## Decisión de alcance

Se evaluó una **versión corta** —centralizar la lista hardcodeada en un módulo
`lib/etiquetas.ts`— que costaba 8 archivos contra ~17 y no requería migración.

**El dueño la descartó explícitamente:** quiere crear y editar etiquetas desde el panel, y
aplicar cualquier etiqueta a cualquier producto, sin depender de un deploy. Este spec
implementa esa versión.

## Criterios de diseño

**Un solo badge por tarjeta.** Decisión del dueño. Cuando un producto tiene varias etiquetas,
gana la de menor `orden`. Eso obliga a que las etiquetas tengan prioridad explícita y editable.

**El badge y el filtro son cosas distintas.** Una etiqueta puede alimentar una pestaña del
sitio, mostrar un cartelito, ambas o ninguna. Hoy `vegetariana` hace las dos cosas y el dueño
quiere el cartelito solo en empanadas — de ahí el campo `mostrar_badge`.

**Las pestañas del sitio no se tocan.** Siguen siendo las cinco actuales y siguen hardcodeadas
en `PizzaList.tsx`. El dueño pidió cartelitos, no filtros nuevos: generar pestañas dinámicas
llenaría el sitio de filtros vacíos.

**Se avisa, no se bloquea.** Borrar una etiqueta que alimenta una pestaña la deja vacía en
silencio. La respuesta no es prohibirlo —el dueño pidió control, "y punto"— sino advertir con
precisión qué se rompe y cuántos productos pierden la marca.

## La tabla `etiquetas`

Una fila por etiqueta:

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | Lo que se guarda en `productos.tags`. Inmutable después de crear |
| `label` | text | Lo que se ve en el cartelito |
| `color` | text | Uno de la paleta fija |
| `orden` | int | Prioridad: gana el más bajo |
| `mostrar_badge` | text | `ambos` \| `pizzas` \| `empanadas` \| `ninguno` |
| `sistema` | bool | Marca las que alimentan pestañas del sitio |
| `sucursal_id` | text | `iguazu` por defecto |
| `created_at` / `updated_at` | timestamptz | |

**Por qué `slug` y `label` separados.** Permite renombrar sin migrar datos: cambiar el label de
"Gourmet" a "De autor" no toca los 9 productos, porque `productos.tags` guarda el slug. El slug
es inmutable justamente para que ese contrato no se rompa.

**Por qué `sucursal_id`.** Misma convención que `promociones` y `testimonios`. La base es
compartida con el proyecto paralelo y ya nos mordió una vez: es una columna barata que evita
repetir el problema.

**Por qué `sistema`.** No bloquea el borrado. Marca las etiquetas cuyo slug está hardcodeado en
`PizzaList.tsx` (`gourmet`, `vegetariana`, `picante`) para que el panel pueda advertir con
precisión: "esto vacía la pestaña Veggie, que hoy filtra 15 pizzas".

### Paleta de colores

Fija, no un selector libre, para que el sitio no se desarme visualmente. Seis valores, cada uno
mapeado a una variable CSS que **existe en `app/impasto.css`**, verificado:

| Valor | Variable | Nota |
|---|---|---|
| `dorado` | `--gold` | El que usa hoy `.p-gourmet` |
| `rojo` | `--accent` | |
| `verde` | `--accent-2` | |
| `oliva` | `--green` | |
| `gris` | `--muted` | |
| `negro` | `--ink` | |

**No usar `--a-sidebar`.** Está definida solo en `app/admin/admin.css` y no existe en el sitio
público: un badge con ese color no renderizaría del lado del cliente.

El badge reutiliza la forma de `.p-gourmet` —mono, 8.5px, mayúsculas, borde redondeado con el
color al 60%— cambiando solo la variable. Así una etiqueta nueva se ve como parte del diseño y
no como un injerto.

## Datos iniciales

La migración siembra las cuatro actuales más las tres nuevas, en este orden:

| orden | slug | label | color | mostrar_badge | sistema |
|---|---|---|---|---|---|
| 1 | `mas-pedida` | Más pedida | rojo | ambos | no |
| 2 | `nueva` | Nueva | verde | ambos | no |
| 3 | `clasica-casa` | Clásica de la casa | oliva | pizzas | no |
| 4 | `gourmet` | Gourmet | dorado | ambos | **sí** |
| 5 | `picante` | Picante | rojo | ambos | **sí** |
| 6 | `vegetariana` | Vegetariana | verde | **empanadas** | **sí** |
| 7 | `dulce` | Dulce | dorado | empanadas | no |

`vegetariana` nace en `empanadas` porque el dueño no quiere el cartelito en pizzas. La pestaña
Veggie sigue funcionando: filtra por el tag, no por el badge.

`clasica-casa` es un **sello curado a mano**, no una categoría. No se confunde con
`Pizza.categoria === "clasica"`, que se deriva sola y hoy alcanza a 23 pizzas. El slug lleva
sufijo `-casa` justamente para no colisionar con ese valor.

## Resolución del badge

Pasa en `lib/catalog-build.ts`, el módulo puro, no en los componentes. Firma nueva:

```ts
buildCatalog(products, etiquetas, promosRaw, reviewsRaw): CatalogData
```

Para cada producto, entre las etiquetas cuyo `slug` está en `productos.tags`:

1. Se descartan las que no aplican a ese tipo (`mostrar_badge`).
2. Se descartan las de `mostrar_badge = 'ninguno'`.
3. Gana la de menor `orden`.
4. Se resuelve a `{ label, color }` y se guarda en `Pizza.badge` / `Empanada.badge`.

Los componentes reciben el badge ya resuelto y no deciden nada. Eso lo hace testeable sin
tocar la base, que es la razón por la que `catalog-build.ts` existe.

**Restricción heredada:** `lib/catalog-build.ts` no puede importar `@/lib/insforge` ni
`@/lib/business`. Sus imports permitidos son `@/lib/data`, `@/types` y `@/lib/categorias`.

## Cambios en los tipos

```ts
export interface EtiquetaBadge { label: string; color: string; }
```

`Pizza` y `Empanada` suman `badge?: EtiquetaBadge`. Opcional: un producto sin etiquetas
aplicables no tiene badge.

`Pizza.categoria` (`clasica` | `gourmet`) **no se toca**: sigue derivándose de
`tags.includes("gourmet")`, porque alimenta la pestaña Clásicas.

## El panel

**Sección nueva "Etiquetas"** en el sidebar: listar, crear, editar label y color, reordenar y
borrar.

- El `slug` se genera del label al crear y después es de solo lectura.
- El reordenamiento define la prioridad del badge.
- Cada fila muestra **cuántos productos la usan**.

**Editor de producto:** los cuatro botones hardcodeados se reemplazan por la lista que venga de
la tabla. El dueño puede aplicar cualquier etiqueta a cualquier producto, sin restricción por
tipo — `mostrar_badge` decide dónde se ve, no dónde se puede marcar.

### Borrar una etiqueta

Dos advertencias antes de confirmar, ambas con números concretos:

1. Si `sistema = true`: qué pestaña del sitio queda vacía y cuántos productos filtra hoy.
2. Si hay productos usándola: cuántos, y que el slug se les va a quitar de `productos.tags`.

Al confirmar, se borra la fila **y** se quita el slug de los productos afectados, en la misma
operación. Dejar slugs huérfanos sería peor: quedarían invisibles y sin forma de rastrearlos.

## Rutas de API

- `GET /api/admin/etiquetas` — listar, con el conteo de uso por etiqueta.
- `POST /api/admin/etiquetas` — crear. Valida slug único y color contra la paleta.
- `PUT /api/admin/etiquetas/[id]` — editar label, color, orden y `mostrar_badge`. **No** el slug.
- `DELETE /api/admin/etiquetas/[id]` — borrar y limpiar el slug de los productos.

Las cuatro con `requireAdmin()` primero, como el resto del panel.

El sitio público no expone las etiquetas por API: las lee `getCatalogData` server-side y llegan
ya resueltas en el catálogo.

## Tests

Sobre `buildCatalog` con fixtures, sin tocar la base:

1. Un producto con varias etiquetas muestra la de menor `orden`.
2. Una etiqueta con `mostrar_badge = 'empanadas'` no aparece en una pizza.
3. Una etiqueta con `mostrar_badge = 'ninguno'` nunca genera badge.
4. Un producto sin etiquetas aplicables no tiene `badge`.
5. Un slug en `productos.tags` que no existe en `etiquetas` se ignora sin romper la carga.
6. `Pizza.categoria` sigue derivándose de `tags.includes("gourmet")`, independiente del badge.

El caso 5 importa: es exactamente lo que queda si alguien borra una etiqueta por fuera del panel.

## Fuera de alcance

- **Pestañas de filtro dinámicas.** Decisión del dueño: cartelitos, no filtros nuevos.
- **Más de un badge por tarjeta.** Decisión del dueño.
- **Selector de color libre.** Paleta fija, para no romper la coherencia visual.
- **Etiquetas en bebidas.** Hoy `Bebida` solo tiene id, nombre y precio.
- **Renombrar slugs.** Inmutables por diseño.

## Riesgos

**La tabla `productos` es global y compartida.** `etiquetas` lleva `sucursal_id`, pero
`productos.tags` no tiene forma de saber de quién es un slug. Si el proyecto paralelo escribe
tags, aparecerían como slugs desconocidos y el caso 5 los ignora.

**Mercado Pago está en producción.** Ningún cambio de este spec toca precios ni disponibilidad,
pero sí lo que se muestra en las tarjetas: hay que verificar en el navegador.

**Migración:** con `npx -y @insforge/cli db migrations new` + `db migrations up --all`. Nunca
con `db query`, que descarta el DDL en silencio y reporta éxito igual.
