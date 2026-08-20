# Saneamiento del catálogo

Fecha: 20 de agosto de 2026
Estado: aprobado, pendiente de plan de implementación

## Problema

`productos` es una tabla **global compartida** con un proyecto paralelo. No tiene `sucursal_id`
ni ninguna otra columna de pertenencia. Contiene 57 filas:

| `categoria`     | Filas | Dueño             | ¿Se ve en Impasto? |
|-----------------|-------|-------------------|--------------------|
| `pizzas`        | 32    | Impasto           | Sí                 |
| `empanadas`     | 9     | Impasto           | Sí                 |
| `hamburguesas`  | 8     | Proyecto paralelo | No                 |
| `calzones`      | 4     | Proyecto paralelo | No                 |
| `lomos`         | 3     | Proyecto paralelo | No                 |
| `otros`         | 1     | Proyecto paralelo | No                 |

Hoy esa separación **funciona por accidente**. `getCatalogData()` en `lib/catalog.ts:95`
consulta `select("*")` sin filtro, y `productType()` clasifica con una cadena de heurísticas
sobre `tipo`. Como las hamburguesas y los lomos no matchean ninguna, caen en el bucket `"otro"`,
que `getCatalogData()` descarta en silencio.

De ahí salen tres defectos:

1. **Fuga posible hacia producción.** Si el proyecto paralelo carga un producto con
   `categoria = 'pizzas'`, aparece en el sitio de Impasto en el próximo ISR (60 s) y es
   cobrable con credenciales de Mercado Pago de producción.
2. **Desaparición silenciosa.** Un producto de Impasto con la categoría mal escrita se descarta
   sin error ni log. No hay forma de notarlo salvo mirando la base.
3. **Bebidas bloqueadas.** El punto 3 del plan no se puede hacer mientras no exista un criterio
   explícito de pertenencia: insertar bebidas empujaría esos productos al proyecto paralelo.

### Causa raíz

La migración `database/002_catalogo_contenido.sql` agregó la columna con backfill:

```sql
alter table productos add column if not exists tipo text not null default 'pizza';
```

Ese `default 'pizza'` marcó **las 57 filas** como `tipo = 'pizza'`, hamburguesas y lomos
incluidos. Desde entonces `tipo` no informa nada, y la categorización real quedó en `categoria`.

### Defecto adicional: la pestaña Gourmet está muerta

`components/sections/PizzaList.tsx:33` filtra por `p.categoria === cat || p.tags.includes(cat)`,
con pestañas `clasica` y `gourmet`. En la base, `categoria` vale `'pizzas'` para las 32 pizzas y
`tags` está vacío en las 57 filas. **Ninguna pizza cae en Gourmet**: la pestaña existe y no
muestra nada.

La causa es una colisión de nombres:

- En la base, `categoria` es la **línea de producto** (`pizzas`, `hamburguesas`).
- En TypeScript, `Pizza.categoria` es el **estilo** (`clasica` | `gourmet`).

`mapPizza` los cruza: `product.categoria === "gourmet" ? "gourmet" : ... || "clasica"`. Como el
valor de la base nunca es `'gourmet'`, las 32 pizzas se mapean a `"clasica"`.

## Criterio de diseño

**La frontera entre los dos proyectos es la línea de producto, no la sucursal.** Solo queda la
sucursal Iguazú, así que `sucursal_id` sería un discriminador que no discrimina. Se descartó
agregar esa columna.

El criterio ya existe y ya está en uso: `app/api/admin/productos/route.ts:8` y
`app/api/productos/route.ts` filtran con `.in("categoria", ["pizzas", "empanadas", "bebidas"])`.
El sitio público es el único que no lo hace. **No se inventa una convención: se termina de
aplicar la que ya está escrita.**

Consecuencia: **este diseño no requiere migración** y no modifica la tabla compartida, así que el
proyecto paralelo sigue funcionando sin ningún cambio de su lado.

## Cambios

### 1. Constante única de pertenencia

En `lib/catalog.ts`, exportada:

```ts
export const CATEGORIAS_IMPASTO = ["pizzas", "empanadas", "bebidas"] as const;
```

Los tres lugares que hoy repiten el array literal la importan:

- `lib/catalog.ts` (`getCatalogData`)
- `app/api/productos/route.ts`
- `app/api/admin/productos/route.ts` (GET, POST, PUT)

### 2. Filtrar en la query del sitio público

`getCatalogData()` pasa de `select("*")` a:

```ts
db.database.from("productos").select("*")
  .not("disponible", "is", false)
  .in("categoria", CATEGORIAS_IMPASTO)
```

**Por qué `.not(... is false)` y no `.eq("disponible", true)`.** El código actual filtra en memoria
con `product.disponible !== false` (`activeProducts`), que **conserva las filas con `null`**.
`.eq("disponible", true)` las descartaría: sería un cambio de comportamiento silencioso.

`disponible` no aparece en ninguna migración —la tabla es anterior a `database/`—, así que no se
puede asumir que sea `not null`. Hoy hay 0 filas con `null` y 0 con `false` (verificado contra la
base el 20/08/2026), pero el proyecto paralelo inserta en esta misma tabla. Se preserva la
semántica exacta de hoy y el filtrado se mueve a la query.

### 3. `productType()` deja de adivinar

Pasa a leer **solo** `categoria`, que es el campo que discrimina de verdad. Se elimina:

- toda la cadena de heurísticas sobre `tipo` (vale `'pizza'` en las 57 filas, no informa nada)
- los lookups contra `STATIC_DATA` por nombre (nunca matchean; ver punto 4)

Se conserva la detección de combos por nombre (`/caja\s*(x|×)\s*(6|12|24)\b/i`), que alimenta
`boxPrices`. Hoy no hay ningún producto combo en la base, pero la rama es barata y su ausencia
cambiaría precios.

Una `categoria` fuera de la allowlist se descarta **con un log**, no en silencio. Eso cubre el
defecto 2.

### 4. Podar `STATIC_DATA`

`lib/data.ts` contiene un catálogo ficticio completo (Margherita, Tartufo, Bresaola,
Salmón & Burrata…) que no coincide con ningún producto real. El fallback es por nombre, así que
nunca matchea: su único efecto es aportar strings vacíos y confundir a quien lea el código.

Se borran los arrays `pizzas` y `empanadas`. **Se conserva `empanadaBoxPrices`**, que sí es un
fallback vivo en `lib/order-quote.ts:88` cuando alguna empanada no tiene precio unitario.

### 5. Guardarraíl en el alta

`POST` y `PUT` de `/api/admin/productos` aceptan hoy cualquier `categoria`, con
`categoria: categoria || "pizzas"` como único default. Si se carga `hamburguesas` desde el panel
de Impasto, el producto se crea y desaparece de la vista sin error.

Se valida contra `CATEGORIAS_IMPASTO` y se devuelve `400` con un mensaje explícito.

### 6. Estilo de pizza: se resuelve con `tags`, sin columna nueva

`PizzaList.tsx:33` ya matchea contra `tags`, y la línea 109 ya pinta el badge Gourmet. Etiquetar
una pizza con `"gourmet"` la hace aparecer en la pestaña **y** le pone el distintivo, sin tocar
código.

Este cambio es **de datos, no de código**, y se ejecuta en la misma pasada de contenido que las
descripciones (punto 2 del plan). Este spec deja el mecanismo verificado y funcionando; la
clasificación de las 32 pizzas es trabajo de contenido posterior.

`mapPizza` deja de leer `product.categoria` para el estilo —que es la colisión de nombres— y pasa
a derivarlo de `tags`: `tags.includes("gourmet") ? "gourmet" : "clasica"`.

### 7. Tests

`package.json` tiene `"test": "tsx tests/hours.test.ts"` — un archivo hardcodeado, no un runner.
Hay que ampliarlo para que corra los dos archivos.

Nuevo `tests/catalog.test.ts`, sobre un fixture que incluya hamburguesas, lomos y calzones:

1. Un fixture con las 6 categorías devuelve solo pizzas, empanadas y bebidas.
2. Un producto con `categoria = 'hamburguesas'` no aparece en ninguna de las tres listas.
3. Una `categoria` desconocida no tumba la carga y deja rastro en el log.
4. `mapPizza` deriva `"gourmet"` desde `tags`, no desde `categoria`.
5. Un producto con `disponible = false` no se devuelve.
6. Un producto con `disponible = null` **sí** se devuelve (preserva la semántica actual).

## Fuera de alcance

- **El filtro `SUCURSAL_ID` de `promociones` y `testimonios`.** Funciona; desarmarlo no aporta.
- **Los precios de calzones y esfihas** ($811, $1.622, $558 contra pizzas de $15.000–25.000,
  probablemente reales brasileños o una importación cruda). Son del proyecto paralelo.
- **`info_empresa_impasto`.** Sigue siendo global; su riesgo ya está documentado.
- **Descripciones, fotos, tags, alérgenos y bebidas.** Son el punto 2 y 3 del plan. Este spec los
  desbloquea; no los ejecuta.
- **Borrar `app/api/productos/route.ts`.** Ver decisión asumida abajo.

## Decisión asumida

`app/api/productos/route.ts` no tiene ningún consumidor en el repo: es una ruta pública muerta.
Quedó pendiente de confirmación y **se asume conservarla**, porque borrar un endpoint público
podría romper a algún consumidor externo que no se ve desde acá. Se la deja usando la constante
compartida y se anota como no utilizada en `CLAUDE.md`. Si se confirma que nadie la llama, borrarla
es un cambio de una línea.

## Riesgos de ejecución

**Finales de línea.** `CLAUDE.md` advierte que varios reemplazos por script fallaron por CRLF y que
TypeScript no los detecta. De los cinco archivos a tocar, tres tienen finales **mezclados**:

| Archivo                            | Finales      |
|------------------------------------|--------------|
| `lib/catalog.ts`                   | LF           |
| `lib/data.ts`                      | CRLF + LF    |
| `app/api/productos/route.ts`       | CRLF + LF    |
| `app/api/admin/productos/route.ts` | CRLF + LF    |
| `package.json`                     | LF           |
| `tests/hours.test.ts`              | LF           |

Cada archivo se edita respetando su final de línea. La verificación es en el navegador, no solo
con `tsc`.

**Gestor de paquetes.** `pnpm`, nunca `npm`. Un `package-lock.json` rompe la auth del panel.

## Verificación

1. `pnpm test` — los dos archivos de test pasan.
2. `pnpm build` — compila sin errores.
3. `pnpm lint` — sin advertencias nuevas.
4. En el navegador: la home muestra 32 pizzas y 9 empanadas, y **ninguna** hamburguesa, lomo,
   calzone ni esfiha.
5. En el navegador: la pestaña Gourmet sigue vacía (correcto: aún no hay ninguna pizza etiquetada),
   y al etiquetar una pizza como `gourmet` desde el panel, aparece ahí con su badge.
6. En el panel: crear un producto con `categoria = 'hamburguesas'` devuelve `400`.

## Actualización de `CLAUDE.md`

Al cerrar, se agrega:

- **`productos` es una tabla global compartida**, igual que `info_empresa_impasto`, y con Mercado
  Pago en producción del otro lado. La pertenencia se resuelve por `categoria` contra
  `CATEGORIAS_IMPASTO`. Va en *"Cosas que hay que recordar hacer"*.
- **El conteo real: 57 filas, 41 de Impasto.** Hoy el documento dice *"41 de 41 pizzas y
  empanadas"*, que se lee como que la tabla tiene 41 registros. Quien abra la base va a
  encontrar hamburguesas y lomos sin saber por qué.
- **`categoria` tiene doble sentido**: línea de producto en la base, estilo en TypeScript. El
  estilo se resuelve por `tags`.
- **`app/api/productos/route.ts` no lo consume nadie.**
