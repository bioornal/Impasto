# Saneamiento del catálogo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer explícito el criterio por el que un producto de la tabla global `productos` pertenece a Impasto, para que el catálogo del proyecto paralelo no pueda filtrarse al sitio y un producto propio no pueda desaparecer en silencio.

**Architecture:** La pertenencia se resuelve por `categoria` contra una allowlist (`pizzas`, `empanadas`, `bebidas`) que hoy ya usan las dos rutas API y que el sitio público no usa. Se centraliza en `lib/categorias.ts`, se aplica en la query del storefront, y se valida en la escritura del panel. La lógica de armado del catálogo se extrae a una función pura `buildCatalog()` para poder testearla sin mocks.

**Tech Stack:** Next.js 16 (App Router, ISR 60 s), TypeScript, InsForge SDK (PostgREST), tests con `tsx` sin framework.

Spec: [`docs/superpowers/specs/2026-08-20-saneamiento-catalogo-design.md`](../specs/2026-08-20-saneamiento-catalogo-design.md)

## Global Constraints

- **Gestor de paquetes: `pnpm`, nunca `npm`.** Un `package-lock.json` fija `@insforge/sdk@1.2.5`, que no expone el subpath `/ssr`, y rompe la auth del panel. No crear lockfiles de npm.
- **Este plan no incluye ninguna migración.** No se modifica el esquema de `productos`. Si algún paso parece necesitar DDL, es señal de que se desvió del spec: parar y preguntar.
- **Finales de línea: el problema es matchear, no escribir.** `CLAUDE.md` advierte que
  varios reemplazos por script fallaron por CRLF y que TypeScript no lo detecta. La causa
  real, verificada el 20/08/2026:

  - `core.autocrlf = true`, y **los archivos están en LF en el index de git**. El CRLF del
    working tree lo produce git al hacer checkout, y lo normaliza de vuelta a LF al commitear.
  - Por lo tanto **no hay que preservar CRLF**: es imposible, git lo revierte igual. Cualquier
    paso que diga "conservar CRLF" está equivocado.
  - Lo que sí importa: **un reemplazo literal contra un archivo del working tree con `\r\n`
    falla si el patrón usa `\n`.** Al editar, verificar el contenido real en disco antes de
    matchear, y confirmar que el reemplazo se aplicó — no darlo por hecho.
  - `git commit` puede emitir `warning: LF will be replaced by CRLF`. Es esperado y correcto.
  - **La verificación que vale es en el navegador, no `tsc`**: una prop sin usar compila igual.

- **`productos` es una tabla global compartida** con otro proyecto (hamburguesas, lomos, calzones, esfihas). **No borrar, no editar ni marcar `disponible = false` ninguna fila.** Todo el saneamiento es del lado del código de Impasto.
- **Mercado Pago está en producción y cobra plata real.** Cualquier cambio que altere qué productos o qué precios se muestran tiene que verificarse en el navegador antes de pushear.
- **El deploy de Netlify se dispara solo al pushear a `main`.**

## Refinamiento sobre el spec

El spec asigna el arreglo del defecto 2 (desaparición silenciosa) al log de `productType()`. Al escribir el plan quedó claro que **ese log no puede cubrirlo**: si un producto de Impasto tiene la categoría mal escrita (`'pizza'` en singular, o con un espacio de más), el filtro `.in()` de la query lo excluye antes de que llegue al código, y no hay nada que loguear.

El defecto 2 se arregla **en la escritura, no en la lectura**: la validación de `categoria` en `POST` y `PUT` (Task 5) impide que la categoría mal escrita llegue a la base. El log de `buildCatalog()` queda igual, pero como defensa en profundidad —se dispara si alguien saca el filtro de la query—, no como el arreglo principal.

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `lib/categorias.ts` | Allowlist de categorías, su tipo y el guard. Sin dependencias, para que los tests y las rutas lo importen sin arrastrar el SDK. | Crear |
| `lib/catalog-build.ts` | Armado puro del catálogo: `buildCatalog`, `productType` y los mapeadores. **Sin ningún import del SDK**, para que los tests lo puedan importar. | Crear |
| `lib/catalog.ts` | Solo I/O contra InsForge (`getCatalogData`). Delega el armado en `catalog-build.ts`. | Modificar |
| `lib/data.ts` | Solo `empanadaBoxPrices`. Se podan los catálogos ficticios. | Modificar |
| `app/api/productos/route.ts` | Importa la allowlist en vez del array literal. | Modificar |
| `app/api/admin/productos/route.ts` | Íd. + valida `categoria` en `POST`. | Modificar |
| `app/api/admin/productos/[id]/route.ts` | Valida `categoria` en `PUT`. | Modificar |
| `tests/catalog.test.ts` | Tests de `buildCatalog` sobre fixtures. | Crear |
| `package.json` | El script `test` corre los dos archivos. | Modificar |
| `CLAUDE.md` | Documentar la tabla compartida, el conteo real y la colisión de nombres. | Modificar |

---

### Task 1: Allowlist centralizada y `buildCatalog` puro

Extrae el armado del catálogo a una función pura, sin tocar todavía la lógica de clasificación. Los tests de este task son de caracterización: fijan el comportamiento actual antes de cambiarlo.

**Files:**
- Create: `lib/categorias.ts`
- Create: `lib/catalog-build.ts`
- Create: `tests/catalog.test.ts`
- Modify: `lib/catalog.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `CATEGORIAS_IMPASTO: readonly ["pizzas", "empanadas", "bebidas"]`, `type CategoriaImpasto`, `esCategoriaImpasto(valor: unknown): valor is CategoriaImpasto` desde `lib/categorias.ts`.
- Produces: `buildCatalog(products: DatabaseProduct[], promosRaw: unknown, reviewsRaw: unknown): CatalogData` y `export interface DatabaseProduct` desde **`lib/catalog-build.ts`** (no desde `catalog.ts`).
- Consumes: `CatalogData`, `Pizza`, `Empanada`, `Bebida`, `Promo`, `Review` de `@/types`.

- [ ] **Step 1: Crear `lib/categorias.ts` (LF)**

```ts
/**
 * `productos` es una tabla global compartida con otro proyecto, y no tiene
 * ninguna columna de pertenencia. Esta lista es el único criterio por el que
 * un producto es de Impasto: las demás categorías (hamburguesas, lomos,
 * calzones, otros) son del proyecto paralelo y no se muestran ni se editan.
 *
 * Ver docs/superpowers/specs/2026-08-20-saneamiento-catalogo-design.md
 */
export const CATEGORIAS_IMPASTO = ["pizzas", "empanadas", "bebidas"] as const;

export type CategoriaImpasto = (typeof CATEGORIAS_IMPASTO)[number];

export const esCategoriaImpasto = (valor: unknown): valor is CategoriaImpasto =>
  typeof valor === "string" && (CATEGORIAS_IMPASTO as readonly string[]).includes(valor);
```

- [ ] **Step 2: Escribir el test que falla (`tests/catalog.test.ts`, LF)**

```ts
import { buildCatalog, type DatabaseProduct } from "../lib/catalog-build";

// Réplica reducida de lo que hay en la base: 3 productos de Impasto y 3 del
// proyecto paralelo, con los mismos valores de `tipo` y `categoria` reales.
const fixture: DatabaseProduct[] = [
  { id: "1", nombre: "Pizza Muzzarela",     tipo: "pizza", categoria: "pizzas",       precio: 15000, disponible: true, desc: "", tags: [] },
  { id: "2", nombre: "Empanadas de Pollo",  tipo: "pizza", categoria: "empanadas",    precio: 3200,  disponible: true, desc: "", tags: [] },
  { id: "3", nombre: "Coca-Cola 1.5L",      tipo: "pizza", categoria: "bebidas",      precio: 2500,  disponible: true, desc: "", tags: [] },
  { id: "4", nombre: "Hamburguesa Simple",  tipo: "pizza", categoria: "hamburguesas", precio: 8000,  disponible: true, desc: "", tags: [] },
  { id: "5", nombre: "Lomo Completo",       tipo: "pizza", categoria: "lomos",        precio: 15000, disponible: true, desc: "", tags: [] },
  { id: "6", nombre: "Calzone Napolitano",  tipo: "pizza", categoria: "calzones",     precio: 1622,  disponible: true, desc: "", tags: [] },
];

let fallos = 0;
const check = (nombre: string, real: unknown, esperado: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { fallos++; console.log(`FALLA  ${nombre}: esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(real)}`); }
  else console.log(`PASA   ${nombre}`);
};

const catalogo = buildCatalog(fixture, null, null);

check("solo la pizza de Impasto llega a pizzas",     catalogo.pizzas.map((p) => p.nombre),    ["Pizza Muzzarela"]);
check("solo la empanada de Impasto llega a empanadas", catalogo.empanadas.map((e) => e.nombre), ["Empanadas de Pollo"]);
check("solo la bebida de Impasto llega a bebidas",   catalogo.bebidas.map((b) => b.nombre),   ["Coca-Cola 1.5L"]);

const todos = [...catalogo.pizzas, ...catalogo.empanadas, ...catalogo.bebidas].map((p) => p.nombre);
check("ningún producto del proyecto paralelo se filtra", todos.filter((n) => ["Hamburguesa Simple", "Lomo Completo", "Calzone Napolitano"].includes(n)), []);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Step 3: Ampliar el script de tests en `package.json` (LF)**

`package.json` tiene hoy un archivo hardcodeado, no un runner. Reemplazar la línea del script `test`:

```json
    "test": "tsx tests/hours.test.ts && tsx tests/catalog.test.ts"
```

- [ ] **Step 4: Correr el test para verificar que falla**

Run:
```bash
pnpm test
```
Expected: FALLA al importar — `lib/catalog-build.ts` todavía no existe.

- [ ] **Step 5: Mover la lógica pura a `lib/catalog-build.ts` (LF)**

**Por qué un archivo aparte y no `lib/catalog.ts`.** `lib/catalog.ts` importa `db` de
`@/lib/insforge`, que arrastra `@insforge/sdk` → `@insforge/shared-schemas`. Ese paquete no
declara la condición `"require"` en sus `exports`, así que **cualquier test que importe
`lib/catalog.ts` revienta** bajo `tsx` en modo CJS con `ERR_PACKAGE_PATH_NOT_EXPORTED`. Que
`buildCatalog` sea una función pura no sirve de nada si vive en un módulo que importa el SDK.

`lib/catalog-build.ts` no puede importar `@/lib/insforge` **ni ningún módulo que lo importe**.
Sus únicos imports permitidos son `@/types` (solo tipos), `@/lib/data` y `@/lib/categorias`.

**5a.** Crear `lib/catalog-build.ts` con este encabezado, y mover a él —sin modificarlos— la
interfaz `DatabaseProduct` (ahora exportada), `asTags`, `productType`, `mapPizza`, `mapEmpanada`,
`mapBebida`, `mapPromos` y `mapReviews`, tal como están hoy en `lib/catalog.ts`:

```ts
import { STATIC_DATA } from "@/lib/data";
import type { Bebida, CatalogData, Empanada, Pizza, Promo, Review } from "@/types";

export interface DatabaseProduct {
  id?: string | number;
  nombre?: string;
  tipo?: string;
  type?: string;
  categoria?: string;
  precio?: number;
  disponible?: boolean;
  desc?: string;
  descripcion?: string;
  tags?: unknown;
  popular?: boolean;
}
```

**5b.** Agregar al final de `lib/catalog-build.ts`:

```ts
export function buildCatalog(
  products: DatabaseProduct[],
  promosRaw: unknown,
  reviewsRaw: unknown,
): CatalogData {
  const disponibles = products.filter((product) => product.disponible !== false);
  const clasificados = disponibles.map((product) => ({ product, type: productType(product) }));

  const descartados = clasificados.filter((item) => item.type === "otro");
  if (descartados.length > 0) {
    const detalle = descartados.map((item) => `${item.product.nombre} (${item.product.categoria})`).join(", ");
    console.warn(`[catalog] ${descartados.length} producto(s) fuera de CATEGORIAS_IMPASTO: ${detalle}`);
  }

  const deTipo = (type: string) => clasificados.filter((item) => item.type === type).map((item) => item.product);

  const boxPrices = { ...STATIC_DATA.empanadaBoxPrices };
  for (const box of deTipo("combo")) {
    const match = String(box.nombre || "").match(/(?:x|×)\s*(6|12|24)\b/i);
    if (match && Number(box.precio) > 0) boxPrices[Number(match[1]) as 6 | 12 | 24] = Number(box.precio);
  }

  return {
    pizzas: deTipo("pizza").map(mapPizza),
    empanadas: deTipo("empanada").map(mapEmpanada),
    bebidas: deTipo("bebida").map(mapBebida),
    empanadaBoxPrices: boxPrices,
    promos: mapPromos(promosRaw),
    reviews: mapReviews(reviewsRaw),
  };
}

```

**5c.** Reemplazar el contenido **completo** de `lib/catalog.ts` por esto. El archivo queda solo
con la I/O: se va todo lo que se movió a `catalog-build.ts`.

```ts
import { db } from "@/lib/insforge";
import type { CatalogData } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";
import { buildCatalog, type DatabaseProduct } from "@/lib/catalog-build";

export { buildCatalog, type DatabaseProduct };

export async function getCatalogData(): Promise<CatalogData> {
  try {
    const safeQuery = (query: PromiseLike<{ data?: unknown }>) => Promise.resolve(query).catch(() => ({ data: null }));
    const [productsResult, promosResult, reviewsResult] = await Promise.all([
      safeQuery(db.database.from("productos").select("*")),
      safeQuery(db.database.from("promociones").select("*").eq("activo", true).eq("sucursal_id", SUCURSAL_ID)),
      safeQuery(db.database.from("testimonios").select("*").eq("estado", "aprobado").eq("sucursal_id", SUCURSAL_ID)),
    ]);
    const products = Array.isArray(productsResult.data) ? productsResult.data as DatabaseProduct[] : [];
    return buildCatalog(products, promosResult.data, reviewsResult.data);
  } catch {
    return buildCatalog([], null, null);
  }
}
```

El re-export mantiene compatible a cualquier import existente de `lib/catalog.ts`.

**5d.** Verificar que el módulo puro no arrastra el SDK:

```bash
grep -n "insforge\|business" lib/catalog-build.ts
```
Expected: sin resultados. Si aparece alguno, el test va a volver a reventar.

- [ ] **Step 6: Correr los tests**

Run:
```bash
pnpm test
```
Expected: PASA. Los 4 casos de catálogo y los 13 de horarios.

Nota: el test imprime una línea `[catalog] 3 producto(s) fuera de CATEGORIAS_IMPASTO: ...`. Es correcto — el fixture incluye a propósito productos del proyecto paralelo.

- [ ] **Step 7: Verificar que compila**

Run:
```bash
pnpm build
```
Expected: compila sin errores.

- [ ] **Step 8: Commit**

```bash
git add lib/categorias.ts lib/catalog-build.ts lib/catalog.ts tests/catalog.test.ts package.json
git commit -m "Extraer buildCatalog y centralizar las categorias de Impasto"
```

---

### Task 2: `productType()` deja de adivinar y se poda `STATIC_DATA`

**Files:**
- Modify: `lib/catalog-build.ts`
- Modify: `lib/data.ts`
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `CATEGORIAS_IMPASTO`, `esCategoriaImpasto` de `lib/categorias.ts` (Task 1); `buildCatalog`, `DatabaseProduct` de `lib/catalog-build.ts` (Task 1).
- Produces: `STATIC_DATA: Pick<CatalogData, "empanadaBoxPrices">` desde `lib/data.ts`.

- [ ] **Step 1: Agregar los tests que fallan**

En `tests/catalog.test.ts`, insertar antes de la línea `console.log(fallos === 0 ...)`:

```ts
// La clasificación tiene que salir de `categoria`, no de `tipo`: las 57 filas
// de la base tienen tipo = 'pizza' porque la migración 002 lo backfilleó así.
const tipoMentiroso: DatabaseProduct[] = [
  { id: "7", nombre: "Hamburguesa BBQ", tipo: "pizza", categoria: "hamburguesas", precio: 10000, disponible: true, desc: "", tags: [] },
];
check("tipo='pizza' no alcanza para entrar al catálogo", buildCatalog(tipoMentiroso, null, null).pizzas, []);

// Una categoría desconocida se descarta sin tumbar la carga.
const categoriaRara: DatabaseProduct[] = [
  { id: "8", nombre: "Producto Raro", tipo: "pizza", categoria: "sushi", precio: 1000, disponible: true, desc: "", tags: [] },
  { id: "9", nombre: "Pizza Napolitana", tipo: "pizza", categoria: "pizzas", precio: 18000, disponible: true, desc: "", tags: [] },
];
check("una categoría desconocida no rompe el resto", buildCatalog(categoriaRara, null, null).pizzas.map((p) => p.nombre), ["Pizza Napolitana"]);

// El filtrado de disponibles conserva la semántica actual (`!== false`).
const disponibilidad: DatabaseProduct[] = [
  { id: "10", nombre: "Pizza Oculta",  tipo: "pizza", categoria: "pizzas", precio: 15000, disponible: false, desc: "", tags: [] },
  { id: "11", nombre: "Pizza Sin Dato", tipo: "pizza", categoria: "pizzas", precio: 15000, desc: "", tags: [] },
];
check("disponible=false se descarta y disponible ausente se conserva", buildCatalog(disponibilidad, null, null).pizzas.map((p) => p.nombre), ["Pizza Sin Dato"]);
```

- [ ] **Step 2: Correr los tests — acá tienen que PASAR, no fallar**

Run:
```bash
pnpm test
```
Expected: **PASA**, los tres casos nuevos incluidos.

Esto es deliberado y rompe el ciclo TDD normal: **este task es un refactor puro, sin cambio de comportamiento.** La `productType` vieja ya clasifica bien estos tres casos, solo que por accidente — llega a `"otro"` después de recorrer una cadena de heurísticas sobre `tipo` que no informan nada, y de dos lookups contra `STATIC_DATA` que nunca matchean.

Los tests son de **caracterización**: fijan el comportamiento actual para que el refactor no lo altere. Si alguno falla acá, el problema está en el fixture, no en el código.

El único test genuinamente rojo de este plan es el del Task 3, donde sí hay un arreglo funcional.

- [ ] **Step 3: Reescribir `productType` y los mapeadores en `lib/catalog-build.ts` (LF)**

Reemplazar todo el bloque que va desde `const asTags` hasta el final de `mapBebida` por:

```ts
const asTags = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

type ProductType = "pizza" | "empanada" | "bebida" | "combo" | "otro";

/**
 * La categorización sale solo de `categoria`. La columna `tipo` vale 'pizza'
 * en las 57 filas —la migración 002 la creó con `default 'pizza'`— así que no
 * informa nada.
 */
const productType = (product: DatabaseProduct): ProductType => {
  const categoria = String(product.categoria || "").toLowerCase();
  if (!esCategoriaImpasto(categoria)) return "otro";
  if (/caja\s*(?:x|×)\s*(?:6|12|24)\b/i.test(String(product.nombre || ""))) return "combo";
  if (categoria === "pizzas") return "pizza";
  if (categoria === "empanadas") return "empanada";
  return "bebida";
};

function mapPizza(product: DatabaseProduct): Pizza {
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Producto"),
    categoria: "clasica",
    precio: Number(product.precio ?? 0),
    desc: String(product.desc ?? ""),
    tags,
    popular: product.popular,
  };
}

function mapEmpanada(product: DatabaseProduct): Empanada {
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Empanada"),
    precio: product.precio == null ? undefined : Number(product.precio),
    desc: String(product.desc ?? ""),
    tags: asTags(product.tags),
  };
}

function mapBebida(product: DatabaseProduct): Bebida {
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Bebida"),
    precio: Number(product.precio ?? 0),
  };
}
```

Ajustar los imports del tope del archivo: se elimina el campo `descripcion` de `DatabaseProduct` (la columna no existe en la base; consultarla devuelve el error `42703`) y se agrega el import de la allowlist:

```ts
import { esCategoriaImpasto } from "@/lib/categorias";
```

En la interfaz `DatabaseProduct`, borrar las líneas `type?: string;` y `descripcion?: string;`.

- [ ] **Step 4: Podar `lib/data.ts`**

**Este archivo tiene CRLF en el working tree.** No hay que preservarlo (git normaliza a LF al
commitear), pero si se edita por reemplazo literal en vez de reescribir el archivo entero, el
patrón tiene que contemplar los `\r\n` o no va a matchear. Acá se reescribe entero, así que da
igual. Contenido completo:

```ts
import type { CatalogData } from "@/types";

/**
 * Lo único que queda del catálogo estático: los precios de caja, que siguen
 * siendo el fallback de lib/order-quote.ts cuando alguna empanada no tiene
 * precio unitario. Los catálogos ficticios que había acá no coincidían con
 * ningún producto real y solo aportaban strings vacíos.
 */
export const STATIC_DATA: Pick<CatalogData, "empanadaBoxPrices"> = {
  empanadaBoxPrices: { 6: 8400, 12: 15900, 24: 30500 },
};
```

- [ ] **Step 5: Verificar que la poda se aplicó de verdad**

No verificar finales de línea: son irrelevantes (ver Global Constraints). Verificar que el
contenido quedó como corresponde:

```bash
grep -c "Margherita\|Tartufo\|Bresaola\|Salmón" lib/data.ts; grep -c "empanadaBoxPrices" lib/data.ts
```
Expected: `0` y luego `1`. Si el primero no es `0`, el reemplazo no se aplicó —el caso que
`CLAUDE.md` advierte— y hay que rehacer el step 4.

- [ ] **Step 6: Correr los tests**

Run:
```bash
pnpm test
```
Expected: PASA. 7 casos de catálogo y 13 de horarios.

- [ ] **Step 7: Verificar que compila**

Run:
```bash
pnpm build
```
Expected: compila sin errores. Si `tsc` se queja de `STATIC_DATA.pizzas` o `STATIC_DATA.empanadas`, quedó una referencia sin borrar en `lib/catalog-build.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/catalog-build.ts lib/data.ts tests/catalog.test.ts
git commit -m "Clasificar productos por categoria y podar el catalogo estatico"
```

---

### Task 3: El estilo de pizza sale de `tags`

Arregla la pestaña Gourmet, que hoy no muestra ninguna pizza.

**Files:**
- Modify: `lib/catalog-build.ts`
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `mapPizza` de `lib/catalog-build.ts` (Task 2), vía `buildCatalog`.
- Produces: `Pizza.categoria` derivado de `tags`, que consume `components/sections/PizzaList.tsx:33` (sin cambios en ese archivo).

- [ ] **Step 1: Agregar el test que falla**

En `tests/catalog.test.ts`, insertar antes de la línea `console.log(fallos === 0 ...)`:

```ts
// `categoria` significa dos cosas distintas: en la base es la línea de
// producto ('pizzas'), en TypeScript es el estilo ('clasica' | 'gourmet').
// El estilo se resuelve por tags, que es contra lo que PizzaList ya filtra.
const estilos: DatabaseProduct[] = [
  { id: "12", nombre: "Pizza Muzzarela",          tipo: "pizza", categoria: "pizzas", precio: 15000, disponible: true, desc: "", tags: [] },
  { id: "13", nombre: "Pizza Rucula y Jamon Crudo", tipo: "pizza", categoria: "pizzas", precio: 25000, disponible: true, desc: "", tags: ["gourmet"] },
];
const conEstilos = buildCatalog(estilos, null, null);
check("una pizza sin tags es clasica",        conEstilos.pizzas.find((p) => p.nombre === "Pizza Muzzarela")?.categoria,          "clasica");
check("una pizza con tag gourmet es gourmet", conEstilos.pizzas.find((p) => p.nombre === "Pizza Rucula y Jamon Crudo")?.categoria, "gourmet");
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run:
```bash
pnpm test
```
Expected: FALLA en `una pizza con tag gourmet es gourmet`: esperado `"gourmet"`, obtuvo `"clasica"`.

- [ ] **Step 3: Derivar el estilo desde `tags` en `mapPizza`**

En `lib/catalog-build.ts`, dentro de `mapPizza`, reemplazar la línea:

```ts
    categoria: "clasica",
```

por:

```ts
    categoria: tags.includes("gourmet") ? "gourmet" : "clasica",
```

- [ ] **Step 4: Correr los tests**

Run:
```bash
pnpm test
```
Expected: PASA. 9 casos de catálogo y 13 de horarios.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog-build.ts tests/catalog.test.ts
git commit -m "Derivar el estilo de pizza desde tags para reactivar la pestana Gourmet"
```

---

### Task 4: Filtrar en la query del sitio público

Hasta acá el filtrado ocurre en memoria. Este task lo mueve a la base, que es donde evita traer las 57 filas en cada refresco de ISR.

**Files:**
- Modify: `lib/catalog.ts`

**Interfaces:**
- Consumes: `CATEGORIAS_IMPASTO` de `lib/categorias.ts` (Task 1).
- Produces: nada nuevo. `buildCatalog` sigue filtrando por su cuenta como defensa en profundidad.

- [ ] **Step 1: Cambiar la query en `getCatalogData`**

En `lib/catalog.ts`, reemplazar la línea:

```ts
      safeQuery(db.database.from("productos").select("*")),
```

por:

```ts
      safeQuery(db.database.from("productos").select("*")
        .not("disponible", "is", false)
        .in("categoria", [...CATEGORIAS_IMPASTO])),
```

**`.not("disponible", "is", false)` y no `.eq("disponible", true)`.** El filtrado en memoria usa `!== false`, que conserva las filas con `null`; `.eq(true)` las descartaría. `disponible` no aparece en ninguna migración —la tabla es anterior a `database/`— así que no se puede asumir que sea `not null`, y el proyecto paralelo inserta en esta misma tabla.

Agregar `CATEGORIAS_IMPASTO` al import ya existente de `@/lib/categorias`:

```ts
import { CATEGORIAS_IMPASTO, esCategoriaImpasto } from "@/lib/categorias";
```

- [ ] **Step 2: Correr los tests**

Run:
```bash
pnpm test
```
Expected: PASA, sin cambios. `buildCatalog` es puro y no toca la base, así que este cambio no lo afecta — que es justamente la razón de haberlo extraído.

- [ ] **Step 3: Verificar contra la base real que la query devuelve 41 filas**

Run:
```bash
pnpm dev
```

Con el server levantado, en otra terminal:

```bash
curl -s "http://localhost:3000/api/productos" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log('total:',r.data.length);const c={};for(const p of r.data)c[p.categoria]=(c[p.categoria]||0)+1;console.log(c)})"
```

Expected: `total: 41` y `{ pizzas: 32, empanadas: 9 }`. Sin `hamburguesas`, `lomos`, `calzones` ni `otros`.

- [ ] **Step 4: Verificar en el navegador**

Abrir `http://localhost:3000` y confirmar:
1. La sección de pizzas lista 32 productos.
2. La sección de empanadas lista 9.
3. No aparece ninguna hamburguesa, lomo, calzone ni esfiha.
4. La sección de bebidas sigue oculta (no hay ninguna cargada).
5. La pestaña Gourmet sigue vacía. **Es correcto**: ninguna pizza está etiquetada todavía. Ese es trabajo de contenido, fuera de este plan.

`CLAUDE.md` advierte que TypeScript no detecta los errores de este tipo y que hay que mirar el navegador, no solo `tsc`. No saltear este step.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.ts
git commit -m "Filtrar el catalogo por categoria en la query del sitio publico"
```

---

### Task 5: Guardarraíl en la escritura del panel

Es el arreglo real del defecto 2: impedir que se escriba una categoría que después haga desaparecer el producto.

**Files:**
- Modify: `app/api/admin/productos/route.ts`
- Modify: `app/api/admin/productos/[id]/route.ts`
- Modify: `app/api/productos/route.ts`

**Interfaces:**
- Consumes: `CATEGORIAS_IMPASTO`, `esCategoriaImpasto` de `lib/categorias.ts` (Task 1).
- Produces: `400 { ok: false, error: string }` cuando `categoria` no pertenece a la allowlist.

- [ ] **Step 1: Validar en el `POST` de `app/api/admin/productos/route.ts`**

**Nota:** este archivo tiene CRLF en el working tree; al hacer reemplazo literal, el patrón debe contemplarlo o no matchea. No hay que preservarlo.

Agregar el import bajo los que ya están:

```ts
import { CATEGORIAS_IMPASTO, esCategoriaImpasto } from "@/lib/categorias";
```

En el `GET`, reemplazar el array literal por la constante:

```ts
  const { data, error } = await db.database.from("productos").select("*").in("categoria", [...CATEGORIAS_IMPASTO]);
```

En el `POST`, después de la validación de `nombre` y `precio`, agregar:

```ts
  const categoriaFinal = categoria || "pizzas";
  if (!esCategoriaImpasto(categoriaFinal)) {
    return NextResponse.json(
      { ok: false, error: `categoria inválida: "${categoriaFinal}". Solo se admiten ${CATEGORIAS_IMPASTO.join(", ")}.` },
      { status: 400 },
    );
  }
```

Y en el `insert`, reemplazar la línea `categoria: categoria || "pizzas",` por:

```ts
      categoria: categoriaFinal,
```

- [ ] **Step 2: Validar en el `PUT` de `app/api/admin/productos/[id]/route.ts`**

**Nota:** este archivo tiene CRLF en el working tree; al hacer reemplazo literal, el patrón debe contemplarlo o no matchea. Agregar el import:

```ts
import { CATEGORIAS_IMPASTO, esCategoriaImpasto } from "@/lib/categorias";
```

Reemplazar la línea `if (body.categoria !== undefined) fields.categoria = body.categoria;` por:

```ts
  if (body.categoria !== undefined) {
    if (!esCategoriaImpasto(body.categoria)) {
      return NextResponse.json(
        { ok: false, error: `categoria inválida: "${body.categoria}". Solo se admiten ${CATEGORIAS_IMPASTO.join(", ")}.` },
        { status: 400 },
      );
    }
    fields.categoria = body.categoria;
  }
```

- [ ] **Step 3: Usar la constante en `app/api/productos/route.ts`**

**Nota:** este archivo tiene CRLF en el working tree; al hacer reemplazo literal, el patrón debe contemplarlo o no matchea. Esta ruta no la consume nadie en el repo; se conserva por decisión del spec. Agregar el import:

```ts
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
```

Y reemplazar `.in("categoria", ["pizzas", "empanadas", "bebidas"]);` por:

```ts
    .in("categoria", [...CATEGORIAS_IMPASTO]);
```

- [ ] **Step 4: Verificar que los tres reemplazos se aplicaron**

No verificar finales de línea: son irrelevantes (ver Global Constraints). Verificar que ya no
queda ningún array literal de categorías y que los tres archivos importan la constante:

```bash
grep -rn '"pizzas", "empanadas", "bebidas"' app/ lib/ --include=*.ts | grep -v categorias.ts; echo "--- imports ---"; grep -rln "@/lib/categorias" app/api/
```
Expected: la primera búsqueda no devuelve nada (el único lugar con el literal es
`lib/categorias.ts`). La segunda lista los tres archivos de ruta.

- [ ] **Step 5: Verificar que compila y que los tests siguen pasando**

Run:
```bash
pnpm build && pnpm test
```
Expected: compila sin errores, 9 casos de catálogo y 13 de horarios pasan.

- [ ] **Step 6: Verificar el rechazo contra el panel corriendo**

**No crear ningún producto de prueba.** La base es compartida y de producción; el camino del
`400` rechaza antes de escribir, así que la validación se verifica sin insertar nada.

Levantar `pnpm dev`, entrar al panel e iniciar sesión. Desde la consola del navegador, ya
autenticado, disparar el rechazo:

```js
await (await fetch("/api/admin/productos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nombre: "PRUEBA-NO-CREAR", precio: 1, categoria: "hamburguesas" }),
})).json()
```

Expected: `{ ok: false, error: 'categoria inválida: "hamburguesas". Solo se admiten pizzas, empanadas, bebidas.' }`
con status `400`.

Repetir cambiando `categoria` por `"pizzas "` (con un espacio al final), que es el caso real que
motivó la validación — una categoría mal escrita que haría desaparecer el producto. Expected: el
mismo `400`.

Confirmar después que no se creó nada:

```bash
curl -s "$INSFORGE_API_BASE_URL/api/database/records/productos?select=nombre&nombre=eq.PRUEBA-NO-CREAR" -H "Authorization: Bearer $INSFORGE_API_KEY"
```
Expected: `[]`.

- [ ] **Step 7: Commit**

```bash
git add app/api/productos/route.ts app/api/admin/productos/route.ts "app/api/admin/productos/[id]/route.ts"
git commit -m "Validar la categoria al crear y editar productos desde el panel"
```

---

### Task 6: Documentar en `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (LF)

**Interfaces:**
- Consumes: nada. Task de documentación.

- [ ] **Step 1: Corregir el conteo del catálogo**

En la sección `### 2. Catálogo (el punto más flojo)`, reemplazar la línea:

```
**41 de 41 pizzas y empanadas no tienen descripción.** Tampoco fotos reales (se usan
```

por:

```
**41 de 41 pizzas y empanadas no tienen descripción.** Ojo: la tabla tiene 57 filas, no 41
— las otras 16 (hamburguesas, lomos, calzones, esfihas) son del proyecto paralelo y el
código de Impasto las filtra. Tampoco hay fotos reales (se usan
```

- [ ] **Step 2: Documentar la tabla compartida**

En la sección `## Cosas que hay que recordar hacer`, agregar como primer ítem:

```
- **`productos` es una tabla global compartida** con el proyecto paralelo, y no tiene ninguna
  columna de pertenencia. El único criterio es `categoria` contra `CATEGORIAS_IMPASTO`
  (`lib/categorias.ts`): `pizzas`, `empanadas` y `bebidas` son de Impasto; `hamburguesas`,
  `lomos`, `calzones` y `otros` son del otro proyecto. **No borrar ni editar esas filas.**
  Es el mismo problema que `info_empresa_impasto`, pero con Mercado Pago en producción del
  otro lado: si el proyecto paralelo carga algo con `categoria = 'pizzas'`, aparece en el
  sitio y es cobrable.
```

- [ ] **Step 3: Documentar la colisión de nombres**

En la sección `### Distinción que se presta a confusión`, agregar al final:

```

`categoria` también tiene dos sentidos. En la base es la **línea de producto** (`pizzas`,
`hamburguesas`); en TypeScript, `Pizza.categoria` es el **estilo** (`clasica` | `gourmet`).
El estilo se resuelve por `tags`: etiquetar una pizza como `"gourmet"` la hace aparecer en
esa pestaña y le pone el badge. Mientras ninguna esté etiquetada, la pestaña está vacía.
```

- [ ] **Step 4: Anotar la ruta sin consumidores**

En la sección `## Cómo trabajar en este repo`, agregar al final de la lista:

```
- `app/api/productos/route.ts` no lo consume nadie en el repo. Se conservó por si algún
  cliente externo lo llama. Si se confirma que no, borrarlo es un cambio de un archivo.
```

- [ ] **Step 5: Actualizar la fecha del encabezado**

Reemplazar `Última actualización: 18 de agosto de 2026.` por:

```
Última actualización: 20 de agosto de 2026.
```

- [ ] **Step 6: Verificar que los cinco reemplazos se aplicaron**

Run:
```bash
grep -c "57 filas, no 41" CLAUDE.md; grep -c "tabla global compartida" CLAUDE.md; grep -c "20 de agosto de 2026" CLAUDE.md
```
Expected: `1`, `1` y `1`. Un `0` en cualquiera significa que ese reemplazo no matcheó.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "Documentar la tabla compartida de productos y el doble sentido de categoria"
```

---

## Verificación final

Después del Task 6, antes de considerar el trabajo terminado:

- [ ] `pnpm test` — 9 casos de catálogo y 13 de horarios pasan.
- [ ] `pnpm build` — compila sin errores.
- [ ] `pnpm lint` — sin advertencias nuevas respecto de la base.
- [ ] `git status` — limpio, sin `package-lock.json` (rompería la auth del panel).
- [ ] En el navegador con `pnpm dev`: 32 pizzas, 9 empanadas, ninguna hamburguesa ni lomo, sección de bebidas oculta.
- [ ] En el panel: crear con `categoria = 'hamburguesas'` devuelve `400`; no quedaron productos de prueba en la base.
- [ ] Confirmar contra la base que sigue habiendo **57 filas** en `productos` — este plan no borra ni modifica ninguna:

```bash
curl -s "$INSFORGE_API_BASE_URL/api/database/records/productos?select=id" -H "Authorization: Bearer $INSFORGE_API_KEY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('filas:',JSON.parse(s).length))"
```

## Qué desbloquea esto

Con el criterio de pertenencia explícito, quedan habilitados los puntos 2 y 3 del plan del proyecto, que pasan a ser una sola pasada de contenido sobre 41 productos:

- Descripciones de las 32 pizzas y las 9 empanadas.
- Etiquetar como `gourmet` las que correspondan, que reactiva la pestaña.
- Cargar bebidas con `categoria = 'bebidas'`, que ya no se filtran al proyecto paralelo.

Ninguno de los tres requiere más código.
