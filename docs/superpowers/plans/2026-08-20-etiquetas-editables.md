# Etiquetas editables desde el panel · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño pueda crear, editar, reordenar y borrar etiquetas desde el panel, y marcar cualquier producto con cualquiera de ellas, sin tocar código ni deployar.

**Architecture:** Las definiciones de etiqueta pasan de estar hardcodeadas en tres componentes a una tabla `etiquetas`. La resolución del badge ganador ocurre en `lib/catalog-build.ts` —el módulo puro, testeable sin base— y los componentes reciben el badge ya resuelto. El panel suma una sección de CRUD y el editor de producto deja de tener la lista fija.

**Tech Stack:** Next.js 16 (App Router, ISR 60 s), TypeScript, InsForge (PostgREST), tests con `tsx` sin framework.

Spec: [`docs/superpowers/specs/2026-08-20-etiquetas-editables-design.md`](../specs/2026-08-20-etiquetas-editables-design.md)

## Global Constraints

- **Gestor de paquetes: `pnpm`, nunca `npm`.** Un `package-lock.json` fija `@insforge/sdk@1.2.5`, que no expone el subpath `/ssr`, y rompe la auth del panel.
- **Migraciones: solo con el CLI.** `npx -y @insforge/cli db migrations new <nombre>` y `db migrations up --all`. **Nunca con `db query`: descarta el DDL en silencio y reporta éxito igual.**
- **`lib/catalog-build.ts` no puede importar `@/lib/insforge` ni `@/lib/business`**, ni ningún módulo que los importe: revienta todos los tests bajo `tsx` con `ERR_PACKAGE_PATH_NOT_EXPORTED`, porque `@insforge/shared-schemas` no declara la condición `"require"`. Imports permitidos: `@/lib/data`, `@/types`, `@/lib/categorias`, `@/lib/etiquetas`.
- **`productos` es una tabla global compartida** con otro proyecto (`hamburguesas`, `lomos`, `calzones`, `otros`). **No borrar, editar ni crear filas fuera de las categorías de Impasto.**
- **Mercado Pago está en producción y cobra plata real.** Este plan no toca precios ni disponibilidad, pero sí lo que se ve en las tarjetas: verificar en el navegador antes de pushear.
- **Finales de línea: el problema es matchear, no escribir.** `core.autocrlf = true` y los archivos van en LF al index; git normaliza al commitear. Pero varios archivos del working tree tienen CRLF, así que **un reemplazo literal con patrón `\n` no matchea**. Verificar el contenido en disco antes de editar y confirmar que cada reemplazo se aplicó.
- **Los greps de verificación deben incluir `.tsx`.** Usar `--include=*.ts --include=*.tsx`. En la rama anterior un grep con solo `--include=*.ts` dio un falso negativo y dejó pasar una copia del array de categorías.
- **El deploy de Netlify se dispara solo al pushear a `main`.**

## Refinamiento sobre el spec

El spec propone `buildCatalog(products, etiquetas, promosRaw, reviewsRaw)`. **Se cambia a
agregar el parámetro al final con valor por defecto:**

```ts
buildCatalog(products, promosRaw, reviewsRaw, etiquetas: Etiqueta[] = [])
```

Motivo: `tests/catalog.test.ts` tiene 10 casos que llaman a `buildCatalog` con tres argumentos.
Insertar un parámetro en la posición 2 los rompe a todos y obliga a reescribirlos en el mismo
commit que cambia la lógica, que es la peor forma de refactorizar: si algo falla, no se sabe si
fue el cambio o la reescritura. Con el parámetro al final y por defecto `[]`, los 10 tests
existentes siguen pasando sin tocarse y los nuevos se agregan al lado.

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `migrations/<ts>_etiquetas.sql` | Tabla `etiquetas` + seed de las 7 iniciales | Crear (vía CLI) |
| `lib/etiquetas.ts` | Tipo `Etiqueta`, paleta de colores y el guard. Sin dependencias | Crear |
| `lib/catalog-build.ts` | Suma `resolverBadge()` y lo aplica en los mapeadores | Modificar |
| `lib/catalog.ts` | `getCatalogData` consulta `etiquetas` y las pasa a `buildCatalog` | Modificar |
| `types/index.ts` | `EtiquetaBadge`; `Pizza` y `Empanada` suman `badge?` | Modificar |
| `components/sections/PizzaList.tsx` | Renderiza el badge resuelto en vez del `gourmet` fijo | Modificar |
| `components/sections/EmpanadasSection.tsx` | Íd., reemplaza los tres `if` sueltos | Modificar |
| `app/impasto.css` | Clases de color del badge | Modificar |
| `app/api/admin/etiquetas/route.ts` | `GET` (con conteo de uso) y `POST` | Crear |
| `app/api/admin/etiquetas/[id]/route.ts` | `PUT` y `DELETE` (con limpieza de slugs) | Crear |
| `app/admin/components/Etiquetas.tsx` | La sección nueva del panel | Crear |
| `app/admin/components/StoreProvider.tsx` | Carga etiquetas y expone su CRUD | Modificar |
| `app/admin/components/types.ts` | `AdminEtiqueta` y el estado | Modificar |
| `app/admin/components/Sidebar.tsx` | Ítem de navegación | Modificar |
| `app/admin/page.tsx` | Ruteo y títulos | Modificar |
| `app/admin/components/Products.tsx` | Los botones salen de la tabla | Modificar |
| `tests/catalog.test.ts` | Casos nuevos de resolución de badge | Modificar |
| `CLAUDE.md` | Documentar el sistema de etiquetas | Modificar |

---

### Task 1: La tabla `etiquetas` y su semilla

**Files:**
- Create: `migrations/<timestamp>_etiquetas.sql` (el CLI genera el nombre)

**Interfaces:**
- Produces: tabla `etiquetas` con las 7 filas iniciales, que consumen los tasks 2, 4 y 5.

- [ ] **Step 1: Crear el archivo de migración con el CLI**

Run:
```bash
npx -y @insforge/cli db migrations new etiquetas
```
Expected: imprime la ruta del archivo creado en `migrations/`. Anotala: es la que editás en el step 2.

**No uses `db query` para nada de este task.** Descarta el DDL en silencio y reporta éxito igual.

- [ ] **Step 2: Escribir el DDL y la semilla**

Contenido completo del archivo que generó el CLI:

```sql
-- Las etiquetas de producto dejan de estar hardcodeadas en tres componentes.
-- `slug` es lo que se guarda en productos.tags y es inmutable; `label` es lo
-- que ve el cliente y se puede renombrar sin migrar datos.
create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  color text not null default 'gris',
  orden integer not null default 100,
  mostrar_badge text not null default 'ambos',
  sistema boolean not null default false,
  sucursal_id text not null default 'iguazu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint etiquetas_slug_sucursal_unico unique (slug, sucursal_id),
  constraint etiquetas_color_valido check (color in ('dorado','rojo','verde','oliva','gris','negro')),
  constraint etiquetas_mostrar_valido check (mostrar_badge in ('ambos','pizzas','empanadas','ninguno'))
);

-- `sistema` marca las que alimentan pestañas hardcodeadas de PizzaList.tsx.
-- No impide borrarlas: sirve para que el panel avise qué se rompe.
insert into etiquetas (slug, label, color, orden, mostrar_badge, sistema) values
  ('mas-pedida',   'Más pedida',         'rojo',   1, 'ambos',      false),
  ('nueva',        'Nueva',              'verde',  2, 'ambos',      false),
  ('clasica-casa', 'Clásica de la casa', 'oliva',  3, 'pizzas',     false),
  ('gourmet',      'Gourmet',            'dorado', 4, 'ambos',      true),
  ('picante',      'Picante',            'rojo',   5, 'ambos',      true),
  ('vegetariana',  'Vegetariana',        'verde',  6, 'empanadas',  true),
  ('dulce',        'Dulce',              'dorado', 7, 'empanadas',  false)
on conflict (slug, sucursal_id) do nothing;
```

`vegetariana` nace en `empanadas` porque el dueño no quiere ese cartelito en pizzas. La pestaña Veggie no se ve afectada: filtra por el tag, no por el badge.

- [ ] **Step 3: Aplicar la migración**

Run:
```bash
npx -y @insforge/cli db migrations up --all
```
Expected: reporta la migración aplicada, sin errores.

- [ ] **Step 4: Verificar que la tabla existe con las 7 filas**

Run:
```bash
BASE=$(grep '^INSFORGE_API_BASE_URL' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); KEY=$(grep '^INSFORGE_API_KEY' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); curl -s "$BASE/api/database/records/etiquetas?select=slug,label,color,orden,mostrar_badge,sistema&order=orden" -H "Authorization: Bearer $KEY"
```
Expected: 7 filas en orden 1..7, con los slugs `mas-pedida`, `nueva`, `clasica-casa`, `gourmet`, `picante`, `vegetariana`, `dulce`.

**Si devuelve `[]` o un 404, la migración no se aplicó** aunque el CLI haya dicho que sí. No sigas: revisá el step 3.

- [ ] **Step 5: Verificar que los productos no se tocaron**

Run:
```bash
BASE=$(grep '^INSFORGE_API_BASE_URL' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); KEY=$(grep '^INSFORGE_API_KEY' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); curl -s "$BASE/api/database/records/productos?select=id" -H "Authorization: Bearer $KEY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('filas:',JSON.parse(s).length))"
```
Expected: `filas: 65`. Este task no debe crear, borrar ni modificar ningún producto.

- [ ] **Step 6: Commit**

```bash
git add migrations/
git commit -m "Agregar la tabla etiquetas con las siete iniciales"
```

---

### Task 2: Resolución del badge en el módulo puro

**Files:**
- Create: `lib/etiquetas.ts`
- Modify: `lib/catalog-build.ts`
- Modify: `types/index.ts`
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: la forma de las filas de `etiquetas` (Task 1).
- Produces: `type Etiqueta`, `COLORES_ETIQUETA`, `esColorValido()` desde `lib/etiquetas.ts`; `EtiquetaBadge` desde `@/types`; `buildCatalog(products, promosRaw, reviewsRaw, etiquetas?)` desde `lib/catalog-build.ts`.

- [ ] **Step 1: Crear `lib/etiquetas.ts` (LF)**

```ts
/**
 * Las etiquetas viven en la tabla `etiquetas` y se administran desde el panel.
 * Este módulo solo define su forma y la paleta: no toca la base, para que
 * lib/catalog-build.ts lo pueda importar sin arrastrar el SDK.
 */
export const COLORES_ETIQUETA = ["dorado", "rojo", "verde", "oliva", "gris", "negro"] as const;

export type ColorEtiqueta = (typeof COLORES_ETIQUETA)[number];

/** Dónde se muestra el cartelito. `ninguno` = la etiqueta sirve para filtrar, pero no se ve. */
export const MOSTRAR_BADGE = ["ambos", "pizzas", "empanadas", "ninguno"] as const;

export type MostrarBadge = (typeof MOSTRAR_BADGE)[number];

export interface Etiqueta {
  id?: string;
  slug: string;
  label: string;
  color: ColorEtiqueta;
  orden: number;
  mostrar_badge: MostrarBadge;
  sistema?: boolean;
}

export const esColorValido = (valor: unknown): valor is ColorEtiqueta =>
  typeof valor === "string" && (COLORES_ETIQUETA as readonly string[]).includes(valor);

export const esMostrarValido = (valor: unknown): valor is MostrarBadge =>
  typeof valor === "string" && (MOSTRAR_BADGE as readonly string[]).includes(valor);

/** Genera el slug de un label. Solo se usa al crear: después el slug es inmutable. */
export const slugificar = (label: string): string =>
  label
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
```

- [ ] **Step 2: Agregar `EtiquetaBadge` a `types/index.ts`**

Agregar antes de `export interface Pizza`:

```ts
export interface EtiquetaBadge {
  label: string;
  color: string;
}
```

En `export interface Pizza`, agregar como último campo:

```ts
  badge?: EtiquetaBadge;
```

En `export interface Empanada`, agregar como último campo:

```ts
  badge?: EtiquetaBadge;
```

- [ ] **Step 3: Escribir los tests que fallan**

En `tests/catalog.test.ts`, agregar el import al tope, junto al que ya existe:

```ts
import type { Etiqueta } from "../lib/etiquetas";
```

Y antes de la línea `console.log(fallos === 0 ...)`, agregar:

```ts
// ── resolución del badge ──────────────────────────────────────────────
// Gana la etiqueta de menor `orden` entre las que el producto tiene y que
// aplican a su tipo. `mostrar_badge` decide dónde se ve, no dónde se marca.
const etiquetas: Etiqueta[] = [
  { slug: "mas-pedida",  label: "Más pedida",  color: "rojo",   orden: 1, mostrar_badge: "ambos" },
  { slug: "gourmet",     label: "Gourmet",     color: "dorado", orden: 4, mostrar_badge: "ambos" },
  { slug: "vegetariana", label: "Vegetariana", color: "verde",  orden: 6, mostrar_badge: "empanadas" },
  { slug: "interna",     label: "Interna",     color: "gris",   orden: 2, mostrar_badge: "ninguno" },
];

const conTags = (nombre: string, categoria: string, tags: string[]): DatabaseProduct =>
  ({ id: nombre, nombre, tipo: "pizza", categoria, precio: 1000, disponible: true, desc: "", tags });

const bc = (p: DatabaseProduct[]) => buildCatalog(p, null, null, etiquetas);

check("gana la etiqueta de menor orden",
  bc([conTags("A", "pizzas", ["gourmet", "mas-pedida"])]).pizzas[0].badge?.label, "Más pedida");

check("una etiqueta de empanadas no aparece en una pizza",
  bc([conTags("B", "pizzas", ["vegetariana"])]).pizzas[0].badge, undefined);

check("la misma etiqueta sí aparece en una empanada",
  bc([conTags("C", "empanadas", ["vegetariana"])]).empanadas[0].badge?.label, "Vegetariana");

check("mostrar_badge=ninguno nunca genera badge, aunque gane por orden",
  bc([conTags("D", "pizzas", ["interna", "gourmet"])]).pizzas[0].badge?.label, "Gourmet");

check("un producto sin etiquetas no tiene badge",
  bc([conTags("E", "pizzas", [])]).pizzas[0].badge, undefined);

check("un slug que no existe en etiquetas se ignora sin romper",
  bc([conTags("F", "pizzas", ["fantasma", "gourmet"])]).pizzas[0].badge?.label, "Gourmet");

check("el badge trae el color de la etiqueta",
  bc([conTags("G", "pizzas", ["gourmet"])]).pizzas[0].badge?.color, "dorado");

// El badge es independiente de Pizza.categoria, que alimenta la pestaña Clásicas.
check("categoria sigue derivandose de tags, no del badge",
  bc([conTags("H", "pizzas", ["gourmet"])]).pizzas[0].categoria, "gourmet");

check("sin etiquetas cargadas, buildCatalog sigue funcionando",
  buildCatalog([conTags("I", "pizzas", ["gourmet"])], null, null).pizzas[0].badge, undefined);

// El slug se genera del label y tiene que sacar los acentos. Si el regex de
// diacríticos se rompe, "Más pedida" da "m-s-pedida" y nada lo delata.
check("slugificar saca acentos",   slugificar("Más pedida"),          "mas-pedida");
check("slugificar saca la eñe",    slugificar("Con Ñoquis"),          "con-noquis");
check("slugificar limpia bordes",  slugificar("  ¡Nueva!  "),         "nueva");
check("slugificar junta espacios", slugificar("Clásica de la casa"),  "clasica-de-la-casa");
```

El import de `slugificar` va junto al de `Etiqueta`, al tope del archivo de tests:

```ts
import { slugificar, type Etiqueta } from "../lib/etiquetas";
```

- [ ] **Step 4: Correr los tests para verificar que fallan**

Run:
```bash
pnpm test
```
Expected: FALLA. El primer error debería ser de TypeScript o de runtime: `buildCatalog` todavía acepta 3 parámetros y `badge` no existe en `Pizza`.

- [ ] **Step 5: Implementar la resolución en `lib/catalog-build.ts` (LF)**

Agregar el import al tope, junto a los que ya están:

```ts
import type { Etiqueta } from "@/lib/etiquetas";
```

Agregar `EtiquetaBadge` al import de tipos que ya existe desde `@/types`.

Agregar esta función antes de `mapPizza`:

```ts
type DestinoBadge = "pizzas" | "empanadas";

/**
 * Devuelve el cartelito ganador para un producto: la etiqueta de menor `orden`
 * entre las que tiene y que se muestran en ese destino. Un solo badge por
 * tarjeta es decisión de diseño: cuando todo se destaca, nada se destaca.
 */
function resolverBadge(tags: string[], etiquetas: Etiqueta[], destino: DestinoBadge): EtiquetaBadge | undefined {
  const aplicables = etiquetas.filter((e) =>
    tags.includes(e.slug) &&
    (e.mostrar_badge === "ambos" || e.mostrar_badge === destino));
  if (aplicables.length === 0) return undefined;
  const gana = aplicables.reduce((a, b) => (b.orden < a.orden ? b : a));
  return { label: gana.label, color: gana.color };
}
```

Cambiar la firma de `mapPizza` y `mapEmpanada` para que reciban las etiquetas, y agregar el campo. `mapPizza` queda:

```ts
function mapPizza(product: DatabaseProduct, etiquetas: Etiqueta[]): Pizza {
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Producto"),
    categoria: tags.includes("gourmet") ? "gourmet" : "clasica",
    precio: Number(product.precio ?? 0),
    desc: String(product.desc ?? ""),
    tags,
    popular: product.popular,
    badge: resolverBadge(tags, etiquetas, "pizzas"),
  };
}
```

`mapEmpanada` queda:

```ts
function mapEmpanada(product: DatabaseProduct, etiquetas: Etiqueta[]): Empanada {
  const tags = asTags(product.tags);
  return {
    id: String(product.id ?? product.nombre),
    nombre: String(product.nombre || "Empanada"),
    precio: product.precio == null ? undefined : Number(product.precio),
    desc: String(product.desc ?? ""),
    tags,
    badge: resolverBadge(tags, etiquetas, "empanadas"),
  };
}
```

En `buildCatalog`, cambiar la firma agregando el parámetro **al final, con valor por defecto**:

```ts
export function buildCatalog(
  products: DatabaseProduct[],
  promosRaw: unknown,
  reviewsRaw: unknown,
  etiquetas: Etiqueta[] = [],
): CatalogData {
```

Y en el `return` de `buildCatalog`, pasar las etiquetas a los mapeadores:

```ts
    pizzas: deTipo("pizza").map((p) => mapPizza(p, etiquetas)),
    empanadas: deTipo("empanada").map((p) => mapEmpanada(p, etiquetas)),
```

`mapBebida` no cambia: `Bebida` no tiene badge.

- [ ] **Step 6: Correr los tests**

Run:
```bash
pnpm test
```
Expected: PASA. 13 casos de horarios y 23 de catálogo (los 10 que ya existían, más 9 de badge y 4 de slugificar).

Si alguno de los 10 viejos falla, el parámetro quedó en la posición equivocada: tiene que ir **al final** y con `= []`.

- [ ] **Step 7: Verificar que el módulo puro sigue puro**

Run:
```bash
grep -n "insforge\|@/lib/business" lib/catalog-build.ts lib/etiquetas.ts
```
Expected: sin resultados. Si aparece alguno, los tests van a reventar bajo `tsx`.

- [ ] **Step 8: Verificar que compila**

Run:
```bash
pnpm build
```
Expected: compila sin errores.

- [ ] **Step 9: Commit**

```bash
git add lib/etiquetas.ts lib/catalog-build.ts types/index.ts tests/catalog.test.ts
git commit -m "Resolver el badge ganador de cada producto en el modulo puro"
```

---

### Task 3: El sitio muestra el badge

**Files:**
- Modify: `lib/catalog.ts`
- Modify: `components/sections/PizzaList.tsx`
- Modify: `components/sections/EmpanadasSection.tsx`
- Modify: `app/impasto.css`

**Interfaces:**
- Consumes: `buildCatalog(products, promosRaw, reviewsRaw, etiquetas?)` y `Pizza.badge` / `Empanada.badge` (Task 2); la tabla `etiquetas` (Task 1).
- Produces: nada que consuman tasks posteriores.

- [ ] **Step 1: `getCatalogData` consulta las etiquetas**

En `lib/catalog.ts`, agregar el import:

```ts
import type { Etiqueta } from "@/lib/etiquetas";
```

Dentro del `Promise.all`, agregar una cuarta consulta después de la de `testimonios`:

```ts
      safeQuery(db.database.from("etiquetas").select("*").eq("sucursal_id", SUCURSAL_ID).order("orden")),
```

Cambiar el destructuring para recibirla:

```ts
    const [productsResult, promosResult, reviewsResult, etiquetasResult] = await Promise.all([
```

Antes del `return`, agregar:

```ts
    if (etiquetasResult.error) console.error("[catalog] error al consultar etiquetas:", etiquetasResult.error);
    const etiquetas = Array.isArray(etiquetasResult.data) ? etiquetasResult.data as Etiqueta[] : [];
```

Y cambiar el `return` para pasarlas:

```ts
    return buildCatalog(products, promosResult.data, reviewsResult.data, etiquetas);
```

El `catch` del final no cambia: `buildCatalog([], null, null)` sigue siendo válido gracias al valor por defecto.

- [ ] **Step 2: Agregar las clases de color al CSS**

En `app/impasto.css`, después de la regla `.p-gourmet` que ya existe, agregar:

```css
/* Badge de etiqueta: misma forma que .p-gourmet, cambia solo el color.
   Las variables tienen que existir en este archivo, no en admin.css. */
.p-badge-tag{
  font-family:var(--font-mono); font-size:8.5px; letter-spacing:.2em; text-transform:uppercase;
  padding:3px 7px; border-radius:999px; white-space:nowrap;
}
.p-badge-tag.c-dorado{ color:var(--gold);      border:1px solid color-mix(in srgb, var(--gold) 60%, transparent); }
.p-badge-tag.c-rojo{   color:var(--accent);    border:1px solid color-mix(in srgb, var(--accent) 60%, transparent); }
.p-badge-tag.c-verde{  color:var(--accent-2);  border:1px solid color-mix(in srgb, var(--accent-2) 60%, transparent); }
.p-badge-tag.c-oliva{  color:var(--green);     border:1px solid color-mix(in srgb, var(--green) 60%, transparent); }
.p-badge-tag.c-gris{   color:var(--muted);     border:1px solid color-mix(in srgb, var(--muted) 60%, transparent); }
.p-badge-tag.c-negro{  color:var(--ink);       border:1px solid color-mix(in srgb, var(--ink) 60%, transparent); }
```

- [ ] **Step 3: `PizzaList` renderiza el badge resuelto**

En `components/sections/PizzaList.tsx`, reemplazar la línea:

```tsx
                      {pizza.tags.includes("gourmet") && <span className="p-gourmet">Gourmet</span>}
```

por:

```tsx
                      {pizza.badge && <span className={`p-badge-tag c-${pizza.badge.color}`}>{pizza.badge.label}</span>}
```

**No toques la línea 33** (`result.filter((p) => p.categoria === cat || p.tags.includes(cat))`): es el filtro de pestañas y sigue funcionando por tags, no por badge.

- [ ] **Step 4: `EmpanadasSection` renderiza el badge resuelto**

En `components/sections/EmpanadasSection.tsx`, reemplazar las tres líneas:

```tsx
                    {empanada.tags.includes("picante") && <span className="emp-flag hot">picante</span>}
                    {empanada.tags.includes("vegetariana") && <span className="emp-flag veg">veggie</span>}
                    {empanada.tags.includes("dulce") && <span className="emp-flag sweet">dulce</span>}
```

por:

```tsx
                    {empanada.badge && <span className={`p-badge-tag c-${empanada.badge.color}`}>{empanada.badge.label}</span>}
```

- [ ] **Step 5: Verificar que los reemplazos se aplicaron**

Run:
```bash
grep -n "p-gourmet\|emp-flag hot\|emp-flag veg\|emp-flag sweet" components/sections/PizzaList.tsx components/sections/EmpanadasSection.tsx; echo "---"; grep -c "p-badge-tag" components/sections/PizzaList.tsx components/sections/EmpanadasSection.tsx app/impasto.css
```
Expected: la primera búsqueda no devuelve nada. La segunda devuelve `1`, `1` y `7`.

- [ ] **Step 6: Correr tests y build**

Run:
```bash
pnpm test && pnpm build
```
Expected: 13 + 23 casos en verde, compila sin errores.

- [ ] **Step 7: Verificar en el navegador**

Levantar `pnpm dev` y abrir `http://localhost:3000`.

Expected, con los datos de hoy:
1. Las 9 pizzas con tag `gourmet` muestran el cartelito **GOURMET** en dorado.
2. **Ninguna pizza muestra un cartelito de vegetariana**, porque esa etiqueta está en `mostrar_badge = 'empanadas'`. Hay 15 pizzas con ese tag: si aparece en alguna, `resolverBadge` está ignorando `mostrar_badge`.
3. La pizza con tag `picante` (Calabresa) muestra **PICANTE** en rojo, salvo que también sea gourmet.
4. Las 4 empanadas vegetarianas muestran **VEGETARIANA**, y la Árabe muestra **PICANTE**.
5. Las pestañas siguen dando: Todas 32, Clásicas 23, Gourmet 9, Veggie 15, Picantes 1.

El punto 5 es el que confirma que no se rompió el filtrado al cambiar el renderizado.

`CLAUDE.md` advierte que TypeScript no detecta esta clase de error: no saltear este step.

- [ ] **Step 8: Commit**

```bash
git add lib/catalog.ts components/sections/PizzaList.tsx components/sections/EmpanadasSection.tsx app/impasto.css
git commit -m "Mostrar en el sitio el badge resuelto desde la tabla etiquetas"
```

---

### Task 4: Rutas de API para administrar etiquetas

**Files:**
- Create: `app/api/admin/etiquetas/route.ts`
- Create: `app/api/admin/etiquetas/[id]/route.ts`

**Interfaces:**
- Consumes: la tabla `etiquetas` (Task 1); `esColorValido`, `esMostrarValido`, `slugificar` de `lib/etiquetas.ts` (Task 2).
- Produces: los cuatro endpoints que consume el Task 5.

- [ ] **Step 1: Crear `app/api/admin/etiquetas/route.ts` (LF)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { SUCURSAL_ID } from "@/lib/business";
import { esColorValido, esMostrarValido, slugificar } from "@/lib/etiquetas";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";

/** Cuántos productos de Impasto usan cada slug. */
async function conteoDeUso(): Promise<Record<string, number>> {
  const { data } = await db.database
    .from("productos")
    .select("tags")
    .in("categoria", [...CATEGORIAS_IMPASTO]);
  const conteo: Record<string, number> = {};
  for (const fila of Array.isArray(data) ? data : []) {
    const tags = Array.isArray((fila as { tags?: unknown }).tags) ? (fila as { tags: unknown[] }).tags : [];
    for (const t of tags) conteo[String(t)] = (conteo[String(t)] || 0) + 1;
  }
  return conteo;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await db.database
    .from("etiquetas").select("*").eq("sucursal_id", SUCURSAL_ID).order("orden");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const conteo = await conteoDeUso();
  const conUso = (Array.isArray(data) ? data : []).map((e) => ({
    ...(e as Record<string, unknown>),
    usos: conteo[String((e as { slug: string }).slug)] || 0,
  }));
  return NextResponse.json({ ok: true, data: conUso });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { label, color, orden, mostrar_badge } = await req.json().catch(() => ({}));
  if (typeof label !== "string" || !label.trim())
    return NextResponse.json({ ok: false, error: "El nombre es obligatorio" }, { status: 400 });

  const slug = slugificar(label);
  if (!slug)
    return NextResponse.json({ ok: false, error: "El nombre necesita al menos una letra o número" }, { status: 400 });
  if (color !== undefined && !esColorValido(color))
    return NextResponse.json({ ok: false, error: `Color inválido: "${color}"` }, { status: 400 });
  if (mostrar_badge !== undefined && !esMostrarValido(mostrar_badge))
    return NextResponse.json({ ok: false, error: `Valor inválido para mostrar_badge: "${mostrar_badge}"` }, { status: 400 });

  const { data: existentes } = await db.database
    .from("etiquetas").select("slug").eq("sucursal_id", SUCURSAL_ID).eq("slug", slug);
  if (Array.isArray(existentes) && existentes.length > 0)
    return NextResponse.json({ ok: false, error: `Ya existe una etiqueta con el nombre "${label}"` }, { status: 400 });

  const { data, error } = await db.database.from("etiquetas").insert([{
    slug,
    label: label.trim(),
    color: color || "gris",
    orden: Number.isInteger(orden) ? orden : 100,
    mostrar_badge: mostrar_badge || "ambos",
    sistema: false,
    sucursal_id: SUCURSAL_ID,
  }]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
```

El `insert` va con array —`[{...}]`— como pide `AGENTS.md`.

- [ ] **Step 2: Crear `app/api/admin/etiquetas/[id]/route.ts` (LF)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { SUCURSAL_ID } from "@/lib/business";
import { esColorValido, esMostrarValido } from "@/lib/etiquetas";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const fields: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) fields.label = body.label.trim();
  if (body.color !== undefined) {
    if (!esColorValido(body.color))
      return NextResponse.json({ ok: false, error: `Color inválido: "${body.color}"` }, { status: 400 });
    fields.color = body.color;
  }
  if (body.mostrar_badge !== undefined) {
    if (!esMostrarValido(body.mostrar_badge))
      return NextResponse.json({ ok: false, error: `Valor inválido: "${body.mostrar_badge}"` }, { status: 400 });
    fields.mostrar_badge = body.mostrar_badge;
  }
  if (Number.isInteger(body.orden)) fields.orden = body.orden;

  // El slug es inmutable: productos.tags lo guarda y renombrarlo huerfanaría las marcas.
  if (body.slug !== undefined)
    return NextResponse.json({ ok: false, error: "El slug no se puede cambiar" }, { status: 400 });
  if (Object.keys(fields).length === 0)
    return NextResponse.json({ ok: false, error: "Nada para actualizar" }, { status: 400 });

  fields.updated_at = new Date().toISOString();
  const { data, error } = await db.database
    .from("etiquetas").update(fields).eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const { data: filas } = await db.database
    .from("etiquetas").select("slug").eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  const slug = Array.isArray(filas) && filas[0] ? String((filas[0] as { slug: string }).slug) : null;
  if (!slug) return NextResponse.json({ ok: false, error: "La etiqueta no existe" }, { status: 404 });

  // Quitar el slug de los productos que lo tengan: dejarlo huérfano lo volvería
  // invisible e imposible de rastrear desde el panel.
  const { data: productos } = await db.database
    .from("productos").select("id,tags").in("categoria", [...CATEGORIAS_IMPASTO]);
  let limpiados = 0;
  for (const p of Array.isArray(productos) ? productos : []) {
    const fila = p as { id: string; tags?: unknown };
    const tags = Array.isArray(fila.tags) ? fila.tags.map(String) : [];
    if (!tags.includes(slug)) continue;
    await db.database.from("productos").update({ tags: tags.filter((t) => t !== slug) }).eq("id", fila.id);
    limpiados++;
  }

  const { error } = await db.database
    .from("etiquetas").delete().eq("id", id).eq("sucursal_id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, limpiados });
}
```

- [ ] **Step 3: Verificar que compila**

Run:
```bash
pnpm build
```
Expected: compila sin errores, y en la lista de rutas aparecen `/api/admin/etiquetas` y `/api/admin/etiquetas/[id]`.

- [ ] **Step 4: Verificar que las rutas exigen sesión**

Levantar `pnpm dev` en una terminal y, en otra:

```bash
curl -s -o /dev/null -w "GET  %{http_code}\n" http://localhost:3000/api/admin/etiquetas
curl -s -o /dev/null -w "POST %{http_code}\n" -X POST http://localhost:3000/api/admin/etiquetas -H "Content-Type: application/json" -d '{"label":"Prueba"}'
```
Expected: `401` en las dos. Si el `POST` devuelve `400`, la validación quedó antes de `requireAdmin()` y hay que invertirla: la autenticación va primero.

- [ ] **Step 5: Confirmar que no se creó nada**

Run:
```bash
BASE=$(grep '^INSFORGE_API_BASE_URL' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); KEY=$(grep '^INSFORGE_API_KEY' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); curl -s "$BASE/api/database/records/etiquetas?select=slug" -H "Authorization: Bearer $KEY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('etiquetas:',JSON.parse(s).length))"
```
Expected: `etiquetas: 7`.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/etiquetas/
git commit -m "Agregar las rutas de administracion de etiquetas"
```

---

### Task 5: La sección Etiquetas del panel

**Files:**
- Create: `app/admin/components/Etiquetas.tsx`
- Modify: `app/admin/components/types.ts`
- Modify: `app/admin/components/StoreProvider.tsx`
- Modify: `app/admin/components/Sidebar.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: los cuatro endpoints del Task 4; `COLORES_ETIQUETA`, `MOSTRAR_BADGE` de `lib/etiquetas.ts` (Task 2).
- Produces: `AdminEtiqueta` en `types.ts`; `createEtiqueta`, `updateEtiqueta`, `deleteEtiqueta` en el contexto del store, que consume el Task 6.

- [ ] **Step 1: Agregar el tipo en `app/admin/components/types.ts`**

Agregar antes de `export interface AdminState`:

```ts
export interface AdminEtiqueta {
  _dbId: string;
  slug: string;
  label: string;
  color: string;
  orden: number;
  mostrar_badge: string;
  sistema: boolean;
  usos: number;
}
```

Y en `export interface AdminState`, agregar como último campo:

```ts
  etiquetas: AdminEtiqueta[];
```

- [ ] **Step 2: Cargar y exponer el CRUD en `StoreProvider.tsx`**

Agregar el import de `AdminEtiqueta` al import de tipos que ya existe.

Agregar el adaptador junto a los otros, después de `adaptTestimonial`:

```ts
function adaptEtiqueta(e: Record<string, unknown>): AdminEtiqueta {
  return {
    _dbId: String(e.id),
    slug: String(e.slug || ""),
    label: String(e.label || e.slug || ""),
    color: String(e.color || "gris"),
    orden: Number(e.orden ?? 100),
    mostrar_badge: String(e.mostrar_badge || "ambos"),
    sistema: Boolean(e.sistema),
    usos: Number(e.usos ?? 0),
  };
}
```

En `loadAll`, agregar la consulta al `Promise.all` y al destructuring:

```ts
  const [prodRes, pedRes, cliRes, etiRes] = await Promise.all([
    fetch("/api/admin/productos").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/pedidos").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/clientes").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/etiquetas").then(r => r.json()).catch(() => ({ data: [] })),
  ]);
```

Y en el objeto que devuelve `loadAll`, agregar:

```ts
    etiquetas: (etiRes.data || []).map(adaptEtiqueta),
```

**En el mismo `loadAll`, corregir el filtro de productos.** Hoy repite el array literal de categorías, que es la cuarta copia del criterio y no se detectó antes porque el grep de verificación excluía `.tsx`. Reemplazar:

```ts
    products: (prodRes.data || []).filter((p: Record<string, unknown>) => ["pizzas", "empanadas", "bebidas"].includes(String(p.categoria || "").toLowerCase())).map(adaptProduct),
```

por:

```ts
    products: (prodRes.data || []).filter((p: Record<string, unknown>) => esCategoriaImpasto(String(p.categoria || ""))).map(adaptProduct),
```

Y agregar el import correspondiente al tope del archivo:

```ts
import { esCategoriaImpasto } from "@/lib/categorias";
```

Ojo: `esCategoriaImpasto` compara exacto, sin `toLowerCase`. Es a propósito — es el mismo criterio que usa la query del sitio.

En la interfaz `StoreCtx`, agregar las tres funciones junto a las de producto:

```ts
  createEtiqueta: (label: string, color: string, mostrar_badge: string) => Promise<void>;
  updateEtiqueta: (id: string, patch: Partial<AdminEtiqueta>) => Promise<void>;
  deleteEtiqueta: (id: string) => Promise<void>;
```

Y en el objeto que implementa el contexto, junto a `createProduct`:

```ts
    createEtiqueta: async (label, color, mostrar_badge) => {
      const orden = Math.max(0, ...stateRef.current.etiquetas.map(e => e.orden)) + 1;
      const r = await fetch("/api/admin/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, color, mostrar_badge, orden }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.error || "No se pudo crear la etiqueta"); return; }
      await load();
      showToast("Etiqueta creada");
    },

    updateEtiqueta: async (id, patch) => {
      const eti = stateRef.current.etiquetas.find(e => e._dbId === id);
      if (!eti) return;
      const body: Record<string, unknown> = {};
      if (patch.label !== undefined) body.label = patch.label;
      if (patch.color !== undefined) body.color = patch.color;
      if (patch.orden !== undefined) body.orden = patch.orden;
      if (patch.mostrar_badge !== undefined) body.mostrar_badge = patch.mostrar_badge;
      const r = await fetch(`/api/admin/etiquetas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.error || "No se pudo actualizar"); return; }
      await load();
      showToast("Etiqueta actualizada");
    },

    deleteEtiqueta: async (id) => {
      const r = await fetch(`/api/admin/etiquetas/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.error || "No se pudo borrar"); return; }
      await load();
      showToast(j.limpiados > 0 ? `Etiqueta borrada y quitada de ${j.limpiados} producto(s)` : "Etiqueta borrada");
    },
```

Estas tres **sí miran el status del `fetch`**, a diferencia de `updateProduct`, que toastea éxito siempre. Un `400` de la validación tiene que verse.

En el estado inicial del provider, agregar `etiquetas: []` junto a `products: []`.

- [ ] **Step 3: Crear `app/admin/components/Etiquetas.tsx` (LF)**

```tsx
"use client";
import { useState } from "react";
import { useStore } from "./StoreProvider";
import { COLORES_ETIQUETA, MOSTRAR_BADGE } from "@/lib/etiquetas";
import type { AdminEtiqueta } from "./types";

const DONDE: Record<string, string> = {
  ambos: "Pizzas y empanadas",
  pizzas: "Solo pizzas",
  empanadas: "Solo empanadas",
  ninguno: "No se muestra",
};

/** Las pestañas del sitio filtran por estos slugs: borrarlos las vacía. */
const PESTANAS: Record<string, string> = {
  gourmet: "Gourmet",
  vegetariana: "Veggie",
  picante: "Picantes",
};

export function Etiquetas() {
  const { state, createEtiqueta, updateEtiqueta, deleteEtiqueta } = useStore();
  const [nuevo, setNuevo] = useState("");
  const [color, setColor] = useState<string>("gris");
  const [donde, setDonde] = useState<string>("ambos");

  const ordenadas = [...state.etiquetas].sort((a, b) => a.orden - b.orden);

  // Las dos actualizaciones van secuenciales y esperadas: `updateEtiqueta`
  // recarga el store al terminar, así que dispararlas en paralelo hace que la
  // segunda respuesta pise a la primera y la tabla muestre el orden viejo.
  const mover = async (eti: AdminEtiqueta, dir: -1 | 1) => {
    const i = ordenadas.findIndex(e => e._dbId === eti._dbId);
    const otro = ordenadas[i + dir];
    if (!otro) return;
    await updateEtiqueta(eti._dbId, { orden: otro.orden });
    await updateEtiqueta(otro._dbId, { orden: eti.orden });
  };

  const borrar = (eti: AdminEtiqueta) => {
    const avisos: string[] = [];
    if (PESTANAS[eti.slug]) avisos.push(`La pestaña "${PESTANAS[eti.slug]}" del sitio va a quedar vacía.`);
    if (eti.usos > 0) avisos.push(`Se va a quitar de ${eti.usos} producto(s).`);
    const texto = [`¿Borrar la etiqueta "${eti.label}"?`, ...avisos].join("\n\n");
    if (confirm(texto)) deleteEtiqueta(eti._dbId);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Etiquetas</h3>
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          El orden define qué cartelito gana cuando un producto tiene varias etiquetas.
        </span>
      </div>

      <div className="panel-body">
        <div className="toolbar" style={{ gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            placeholder="Nombre de la etiqueta nueva"
            style={{ minWidth: 220 }}
          />
          <select value={color} onChange={e => setColor(e.target.value)}>
            {COLORES_ETIQUETA.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={donde} onChange={e => setDonde(e.target.value)}>
            {MOSTRAR_BADGE.map(m => <option key={m} value={m}>{DONDE[m]}</option>)}
          </select>
          <button
            className="btn btn-primary"
            disabled={!nuevo.trim()}
            onClick={() => { createEtiqueta(nuevo.trim(), color, donde); setNuevo(""); }}
          >
            Crear
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Orden</th><th>Etiqueta</th><th>Color</th><th>Dónde se ve</th><th>Usos</th><th></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((eti, i) => (
              <tr key={eti._dbId}>
                <td>
                  <button className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => mover(eti, -1)}>↑</button>
                  <button className="btn btn-sm btn-ghost" disabled={i === ordenadas.length - 1} onClick={() => mover(eti, 1)}>↓</button>
                </td>
                <td>
                  <input
                    defaultValue={eti.label}
                    onBlur={e => { if (e.target.value.trim() && e.target.value !== eti.label) updateEtiqueta(eti._dbId, { label: e.target.value.trim() }); }}
                  />
                  <div className="text-muted" style={{ fontSize: 11 }}>{eti.slug}</div>
                </td>
                <td>
                  <select value={eti.color} onChange={e => updateEtiqueta(eti._dbId, { color: e.target.value })}>
                    {COLORES_ETIQUETA.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <select value={eti.mostrar_badge} onChange={e => updateEtiqueta(eti._dbId, { mostrar_badge: e.target.value })}>
                    {MOSTRAR_BADGE.map(m => <option key={m} value={m}>{DONDE[m]}</option>)}
                  </select>
                </td>
                <td>{eti.usos}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => borrar(eti)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

El `slug` se muestra debajo del label, en gris, como recordatorio de que es lo que se guarda en el producto y no cambia al renombrar.

- [ ] **Step 4: Agregar la navegación en `Sidebar.tsx`**

En el array `items`, agregar después del ítem de `products`:

```tsx
    { key: "etiquetas", label: "Etiquetas", icon: <Icon.Pizza /> },
```

Se reutiliza `Icon.Pizza` a propósito: agregar un ícono nuevo es un cambio de otro archivo y no aporta a este task.

- [ ] **Step 5: Rutear la sección en `app/admin/page.tsx`**

Agregar el import junto a los otros:

```tsx
import { Etiquetas } from "./components/Etiquetas";
```

Agregar `"etiquetas"` al tipo `Page`:

```tsx
type Page = "dashboard" | "orders" | "products" | "etiquetas" | "customers" | "testimonials" | "settings";
```

Agregar la entrada en `TITLES`, después de la de `products`:

```tsx
  etiquetas:    ["Etiquetas",       "Los cartelitos que aparecen en las tarjetas del sitio"],
```

Y el render, después del de `products`:

```tsx
          {page === "etiquetas"    && <Etiquetas />}
```

- [ ] **Step 6: Verificar que ya no queda el array literal en ningún `.tsx`**

Run:
```bash
grep -rn '"pizzas", "empanadas", "bebidas"' app/ lib/ --include=*.ts --include=*.tsx | grep -v categorias.ts
```
Expected: sin resultados.

**Este grep incluye `.tsx` a propósito.** El de la rama anterior usaba solo `--include=*.ts` y por eso no detectó la copia de `StoreProvider.tsx`.

- [ ] **Step 7: Verificar tests y build**

Run:
```bash
pnpm test && pnpm build && pnpm lint
```
Expected: 13 + 23 casos en verde, compila, y `pnpm lint` sin advertencias nuevas respecto de las 4 preexistentes en `app/layout.tsx`, `app/admin/layout.tsx`, `components/cart/HalfModal.tsx` y `lib/order-quote.ts`.

- [ ] **Step 8: Commit**

```bash
git add app/admin/components/Etiquetas.tsx app/admin/components/types.ts app/admin/components/StoreProvider.tsx app/admin/components/Sidebar.tsx app/admin/page.tsx
git commit -m "Agregar la seccion Etiquetas al panel"
```

---

### Task 6: El editor de producto usa las etiquetas de la tabla

**Files:**
- Modify: `app/admin/components/Products.tsx`

**Interfaces:**
- Consumes: `state.etiquetas` del store (Task 5).
- Produces: nada que consuman tasks posteriores.

- [ ] **Step 1: Pasar las etiquetas al formulario**

En `app/admin/components/Products.tsx`, el componente `ProductEdit` recibe hoy `product`, `onClose`, `onSave` e `isNew`. Necesita las etiquetas.

Dentro de `ProductEdit`, agregar al principio del cuerpo:

```tsx
  const { state } = useStore();
  const etiquetasOrdenadas = [...state.etiquetas].sort((a, b) => a.orden - b.orden);
```

`useStore` ya está importado en este archivo por el componente `Products`.

- [ ] **Step 2: Reemplazar los botones hardcodeados**

Reemplazar el bloque:

```tsx
                {["vegetariana","picante","gourmet","dulce"].map(t => (
                  <button key={t} className={`btn btn-sm ${(data.tags || []).includes(t) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleTag(t)}>
                    {(data.tags || []).includes(t) && <Icon.Check />} {t}
                  </button>
                ))}
```

por:

```tsx
                {etiquetasOrdenadas.length === 0 && (
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    No hay etiquetas todavía. Creá una en la sección Etiquetas.
                  </span>
                )}
                {etiquetasOrdenadas.map(e => (
                  <button key={e.slug} className={`btn btn-sm ${(data.tags || []).includes(e.slug) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleTag(e.slug)}>
                    {(data.tags || []).includes(e.slug) && <Icon.Check />} {e.label}
                  </button>
                ))}
```

El botón muestra el `label` pero guarda el `slug`: eso es lo que hace que renombrar no rompa las marcas existentes.

- [ ] **Step 3: Verificar que no quedó la lista vieja**

Run:
```bash
grep -n '"vegetariana","picante","gourmet","dulce"' app/admin/components/Products.tsx
```
Expected: sin resultados.

- [ ] **Step 4: Verificar tests y build**

Run:
```bash
pnpm test && pnpm build
```
Expected: en verde y compila.

- [ ] **Step 5: Verificar el circuito completo en el panel**

Levantar `pnpm dev`, entrar al panel e iniciar sesión.

1. **Sección Etiquetas:** se ven las 7, ordenadas 1..7, con la columna Usos mostrando 9 para `gourmet`, 19 para `vegetariana` y 2 para `picante`.
2. **Crear una:** poné "Prueba temporal", color gris, "No se muestra". Se crea al final de la lista.
3. **Editor de producto:** abrí cualquier pizza. Los botones de etiqueta ahora son 8, con los nombres de la tabla, y "Prueba temporal" entre ellos.
4. **Renombrar:** cambiá el label de "Prueba temporal" a "Otro nombre". El editor de producto debe mostrar el nombre nuevo, y el slug debajo debe seguir siendo `prueba-temporal`.
5. **Borrar:** borrá "Otro nombre". Confirmá que el diálogo no menciona ninguna pestaña (no es de sistema) y que desaparece de las dos pantallas.
6. **La advertencia de sistema:** tocá Borrar en `vegetariana` y confirmá que el diálogo avisa que **la pestaña Veggie va a quedar vacía** y que se quita de 19 productos. **Cancelá: no la borres.**

El punto 6 solo verifica el texto de la advertencia. Si la borrás, perdés los tags de 19 productos.

- [ ] **Step 6: Confirmar que quedaron las 7 originales**

Run:
```bash
BASE=$(grep '^INSFORGE_API_BASE_URL' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); KEY=$(grep '^INSFORGE_API_KEY' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); curl -s "$BASE/api/database/records/etiquetas?select=slug&order=orden" -H "Authorization: Bearer $KEY"
```
Expected: exactamente 7 slugs, sin `prueba-temporal`. Si aparece, borrala desde el panel antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add app/admin/components/Products.tsx
git commit -m "Listar las etiquetas de la tabla en el editor de producto"
```

---

### Task 7: Documentar en `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (LF)

**Interfaces:**
- Consumes: nada. Task de documentación.

- [ ] **Step 1: Reemplazar el párrafo de las pestañas**

En la sección `### Distinción que se presta a confusión`, reemplazar el bloque que empieza con "Las cuatro pestañas están cargadas desde el 20/08/2026" y termina en "Jamón Crudo, Anchoas, Pizzeta Provolone Rellena)." por:

```
Las pestañas del sitio (`Todas`, `Clásicas`, `Gourmet`, `Veggie`, `Picantes`) están
**hardcodeadas** en `PizzaList.tsx` y filtran por `tags`. Los cartelitos, en cambio, salen
de la tabla `etiquetas` y se administran desde el panel. Son dos cosas distintas: una
etiqueta puede alimentar una pestaña, mostrar un cartelito, las dos o ninguna.
```

- [ ] **Step 2: Agregar la sección del sistema de etiquetas**

Antes de `## Cosas que hay que recordar hacer`, agregar:

```
## Cómo funcionan las etiquetas

Se administran desde la sección **Etiquetas** del panel y viven en la tabla `etiquetas`.

- **`slug` es inmutable** y es lo que se guarda en `productos.tags`. **`label`** es lo que
  ve el cliente y se puede renombrar sin tocar ningún producto. Esa separación es
  deliberada: renombrar el slug huerfanaría las marcas de todos los productos.
- **`orden` define la prioridad.** Cada tarjeta muestra **un solo cartelito**: el de menor
  orden entre los que el producto tenga. Es decisión de diseño, no una limitación técnica.
- **`mostrar_badge`** (`ambos` / `pizzas` / `empanadas` / `ninguno`) decide **dónde se ve**
  el cartelito, no dónde se puede marcar. Por eso `vegetariana` está en `empanadas`: filtra
  15 pizzas en la pestaña Veggie sin ensuciarles la tarjeta.
- **`sistema`** marca las que alimentan pestañas hardcodeadas (`gourmet`, `vegetariana`,
  `picante`). **No impide borrarlas**: el panel avisa qué pestaña queda vacía y cuántos
  productos pierden la marca, y el dueño decide.
- Al borrar una etiqueta, **el slug se quita de los productos** en la misma operación.
  Dejarlo huérfano lo volvería invisible desde el panel.
- La resolución del cartelito vive en `resolverBadge()`, en `lib/catalog-build.ts`, y está
  cubierta por tests. Los componentes reciben el badge ya resuelto.
- La paleta de colores es fija y las variables CSS **tienen que existir en
  `app/impasto.css`**. `--a-sidebar` solo existe en `admin.css`: un badge con ese color se
  vería bien en el panel y roto en el sitio.
```

- [ ] **Step 3: Corregir la nota del grep en la sección de trabajo**

En `## Cómo trabajar en este repo`, agregar al final de la lista:

```
- **Al verificar con `grep` que no quedan literales duplicados, incluí `.tsx`.** Un grep con
  solo `--include=*.ts` dio un falso negativo y dejó pasar una cuarta copia de la allowlist
  de categorías en `StoreProvider.tsx`.
```

- [ ] **Step 4: Verificar que los reemplazos se aplicaron**

Run:
```bash
grep -c "Cómo funcionan las etiquetas" CLAUDE.md; grep -c "incluí \`.tsx\`" CLAUDE.md; grep -c "Las cuatro pestañas están cargadas" CLAUDE.md
```
Expected: `1`, `1` y `0`. Un `0` en los dos primeros, o un `1` en el tercero, significa que ese reemplazo no matcheó.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Documentar el sistema de etiquetas administrable"
```

---

## Verificación final

- [ ] `pnpm test` — 13 casos de horarios y 23 de catálogo.
- [ ] `pnpm build` — compila sin errores.
- [ ] `pnpm lint` — 0 errores y las mismas 4 advertencias preexistentes, ninguna nueva.
- [ ] `git status` — limpio, sin `package-lock.json`.
- [ ] En el sitio: las 9 gourmet con su cartelito; **ninguna pizza con cartelito de vegetariana**; las 4 empanadas veggie con el suyo; pestañas en Todas 32, Clásicas 23, Gourmet 9, Veggie 15, Picantes 1.
- [ ] En el panel: crear, renombrar, recolorear, reordenar y borrar una etiqueta de prueba, y que no quede en la base.
- [ ] La tabla `etiquetas` tiene exactamente 7 filas y `productos` sigue con 65.

```bash
BASE=$(grep '^INSFORGE_API_BASE_URL' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); KEY=$(grep '^INSFORGE_API_KEY' .env.local | cut -d= -f2- | tr -d '"'"'"'\r'); for t in etiquetas productos; do printf "%-12s " "$t"; curl -s "$BASE/api/database/records/$t?select=id" -H "Authorization: Bearer $KEY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).length))"; done
```

## Qué queda fuera

- **Pestañas de filtro dinámicas.** Siguen hardcodeadas: el dueño pidió cartelitos, no filtros.
- **Más de un cartelito por tarjeta.** Decisión del dueño.
- **Etiquetas en bebidas.** `Bebida` solo tiene id, nombre y precio.
- **Reordenar arrastrando.** Se resuelve con flechas ↑↓, que es una fracción del trabajo.
- **`updateProduct` sigue sin mirar el status del `fetch`** y toastea éxito siempre. Es un
  defecto preexistente, anotado pero fuera de alcance. Las tres funciones nuevas de etiqueta
  sí lo miran.
