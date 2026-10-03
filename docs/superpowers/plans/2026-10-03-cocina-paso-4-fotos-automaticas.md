# `/cocina` automática — Paso 4: fotos automáticas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la carta (lista, destacada, mitades, empanadas, bebidas, SEO) y `/cocina` muestren sola la foto más nueva de cada producto en el bucket `DB`, sin tocar código.

**Architecture:** `lib/fotos.ts` (puro) decide qué archivo del bucket es la foto de un producto. `lib/fotos-bucket.ts` (servidor) lista el bucket con la clave de backend, en caché un minuto con la etiqueta `fotos`. El catálogo agrega `foto` a cada pizza, empanada y bebida; los componentes la pasan como `src` a sus ilustraciones, que ya caen al mapa del código y al stock si falta.

**Tech Stack:** Next 16 (`unstable_cache`, `revalidateTag`), `@insforge/sdk` (`storage.from('DB').list`), tests con `tsx`.

**Diseño:** `docs/superpowers/specs/2026-10-03-cocina-y-fotos-automaticas-design.md` (parte 3).

## Global Constraints

- Candidatas de un producto: archivos en `fotos/<id del producto>/` (paso 5) y archivos de la raíz cuyo nombre sin extensión (jpg, jpeg, png, webp), sin mayúsculas, tildes, guiones ni guiones bajos, es el nombre del producto, solo o seguido de una versión (`v4`, `(1)`). Gana la más nueva por `uploadedAt`.
- Sin candidatas: `REAL_PRODUCT_PHOTOS` y después el stock, como hoy (lo resuelven `getPizzaImage` y compañía).
- Si el listado falla, no se rompe nada: se usa el respaldo. El listado se guarda un minuto (`revalidate: 60`, tag `fotos`).
- La portada (`STOCK_IMAGES.hero`) y las imágenes de stock no cambian.
- **Al publicar no cambia ninguna foto visible**: antes se comparan las fotos elegidas con las de hoy, y donde difieran se sube la actual con una versión nueva.

## Archivos

- Crear `lib/fotos.ts` y `tests/fotos.test.ts` (agregar a `pnpm test`).
- Crear `lib/fotos-bucket.ts`.
- Modificar `types/index.ts` (`foto?: string` en `Pizza`, `Empanada`, `Bebida`).
- Modificar `lib/catalog.ts` (agregar `foto`), `lib/seo.ts`.
- Modificar los usos de `PizzaIllus`, `EmpanadaIllus` y `DrinkIllus` con datos del catálogo: `components/sections/PizzaList.tsx` (4), `Hero.tsx`, `EmpanadasSection.tsx`, `Bebidas.tsx`, `components/cart/HalfModal.tsx` (2), `CartDrawer.tsx`.
- Modificar `app/cocina/page.tsx` (`fotoDe` con el bucket).

---

### Task 1: Elección de la foto

- [ ] **Step 1: Test que falla** — `tests/fotos.test.ts`:

```ts
import { elegirFoto, type ObjetoFoto } from "../lib/fotos";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}
const o = (key: string, uploadedAt: string): ObjetoFoto => ({ key, uploadedAt, url: `https://b/${encodeURIComponent(key)}` });
const objetos = [
  o("Diavola al Miele Piccante.jpg", "2026-10-01T10:00:00Z"),
  o("Diavola al Miele Piccante v3.jpg", "2026-10-03T13:30:00Z"),
  o("Diavola al Miele Piccante v2.jpg", "2026-10-03T13:13:00Z"),
  o("Pizza Fugazzeta Rellena.jpg", "2026-10-02T00:00:00Z"),
  o("pizza-fugazzeta (1).png", "2026-09-01T00:00:00Z"),
  o("Porteña de Jamón y Morrones.jpg", "2026-09-16T00:00:00Z"),
  o("PORTENA_DE_JAMON_Y_MORRONES-v2.webp", "2026-10-03T15:00:00Z"),
  o("fotos/p-quattro/20261003T150000.jpg", "2026-10-03T15:00:00Z"),
  o("Quattro Formaggi v9.jpg", "2026-10-03T16:00:00Z"),
  o("fotos/p-quattro/20261003T170000.jpg", "2026-10-03T17:00:00Z"),
  o("fotos/p-otro/20261004T000000.jpg", "2026-10-04T00:00:00Z"),
  o("Diavola al Miele Piccante.txt", "2026-10-05T00:00:00Z"),
];
const url = (producto: { id?: string; nombre: string }) => elegirFoto(producto, objetos)?.split("/").pop();

chequear("la versión más nueva gana", url({ id: "p-diavola", nombre: "Diavola al Miele Piccante" }) === encodeURIComponent("Diavola al Miele Piccante v3.jpg"));
chequear("sin mayúsculas, tildes, guiones ni guiones bajos", url({ nombre: "Porteña de Jamón y Morrones" }) === encodeURIComponent("PORTENA_DE_JAMON_Y_MORRONES-v2.webp"));
chequear("un nombre más largo no cuenta", url({ nombre: "Pizza Fugazzeta" }) === encodeURIComponent("pizza-fugazzeta (1).png"));
chequear("la carpeta del producto cuenta y gana si es más nueva", url({ id: "p-quattro", nombre: "Quattro Formaggi" }) === encodeURIComponent("fotos/p-quattro/20261003T170000.jpg"));
chequear("la carpeta de otro producto no cuenta", url({ id: "p-x", nombre: "Nada" }) === undefined);
chequear("solo imágenes", url({ nombre: "Diavola al Miele Piccante" }) === encodeURIComponent("Diavola al Miele Piccante v3.jpg"));
chequear("sin candidatas devuelve undefined", elegirFoto({ nombre: "Muzzarella Impasto" }, objetos) === undefined);
chequear("fecha inválida no gana", elegirFoto({ nombre: "X" }, [o("X v2.jpg", "basura"), o("X.jpg", "2026-01-01T00:00:00Z")])?.endsWith("X.jpg") === true);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Step 2:** `npx tsx tests/fotos.test.ts` → falla (no existe `lib/fotos`).

- [ ] **Step 3: Implementación** — `lib/fotos.ts`:

```ts
/**
 * Qué archivo del bucket `DB` es la foto de un producto. Puro, para testearse con `tsx`.
 *
 * Candidatas: lo que sube el admin en `fotos/<id del producto>/` y los archivos de la raíz
 * que se llaman como el producto, solos o con una versión al final ("v4", "(1)"). Gana la
 * más nueva. Nunca se reemplaza un archivo con el mismo nombre: el CDN de InsForge
 * seguiría sirviendo el viejo (comprobado el 03/10/2026).
 */
export interface ObjetoFoto { key: string; uploadedAt: string; url: string }

const EXTENSION = /\.(jpe?g|png|webp)$/i;
const VERSION = /^(v\d+|\(\d+\))$/;

export function normalizarNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function esDelProducto(key: string, producto: { id?: string; nombre: string }): boolean {
  if (!EXTENSION.test(key)) return false;
  if (key.includes("/")) return !!producto.id && key.startsWith(`fotos/${producto.id}/`);
  const base = normalizarNombre(key.replace(EXTENSION, ""));
  const nombre = normalizarNombre(producto.nombre);
  if (!nombre) return false;
  return base === nombre || (base.startsWith(`${nombre} `) && VERSION.test(base.slice(nombre.length + 1)));
}

/** URL de la foto más nueva del producto, o undefined si no hay ninguna. */
export function elegirFoto(producto: { id?: string; nombre: string }, objetos: ObjetoFoto[]): string | undefined {
  let mejor: ObjetoFoto | undefined;
  let mejorFecha = -Infinity;
  for (const objeto of objetos) {
    if (!esDelProducto(objeto.key, producto)) continue;
    const fecha = Date.parse(objeto.uploadedAt);
    const valor = Number.isFinite(fecha) ? fecha : -Infinity;
    if (!mejor || valor > mejorFecha) { mejor = objeto; mejorFecha = valor; }
  }
  return mejor?.url;
}
```

- [ ] **Step 4:** `npx tsx tests/fotos.test.ts` → "Todos los casos pasan". Agregar `&& tsx tests/fotos.test.ts` al script `test` de `package.json`.
- [ ] **Step 5:** Commit `feat(fotos): elegir la foto más nueva de cada producto en el bucket`.

### Task 2: Comparación con las fotos de hoy (antes de integrar)

- [ ] Script en el scratchpad que lista el bucket, lee los productos de Impasto (todos, incluidos archivados) y, para cada uno, compara `elegirFoto(...) ?? REAL_PRODUCT_PHOTOS[id]` con `REAL_PRODUCT_PHOTOS[id]`. Listar las diferencias.
- [ ] Por cada diferencia en un producto que hoy tiene foto en el mapa: subir esa foto actual al bucket como `<Nombre del producto> v<N>.<ext>` con N mayor que las existentes (si es un archivo local de `public/`, desde el disco; si es del bucket, desde el archivo local del dueño si existe; si no, avisar al dueño en vez de bajarla del CDN, que puede servir una versión vieja). Repetir hasta que no queden diferencias, salvo las que el dueño apruebe (por ejemplo, un producto sin foto que pasa a tener una suya).

### Task 3: Integración

- [ ] `lib/fotos-bucket.ts`:

```ts
import { unstable_cache } from "next/cache";
import { db } from "@/lib/insforge";
import type { ObjetoFoto } from "@/lib/fotos";

const leer = unstable_cache(async (): Promise<ObjetoFoto[]> => {
  const objetos: ObjetoFoto[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from("DB").list({ limit: 1000, offset });
    const pagina = (data as { data?: unknown } | null)?.data;
    if (error || !Array.isArray(pagina)) throw new Error("No se pudo listar el bucket de fotos");
    for (const o of pagina as Array<Record<string, unknown>>) {
      if (typeof o.key === "string" && typeof o.url === "string") {
        objetos.push({ key: o.key, url: o.url, uploadedAt: String(o.uploadedAt ?? o.uploaded_at ?? "") });
      }
    }
    if (pagina.length < 1000) return objetos;
  }
}, ["fotos-bucket"], { revalidate: 60, tags: ["fotos"] });

/** Archivos del bucket `DB`, guardados un minuto. Si falla, lista vacía: se usan las fotos de respaldo. */
export async function listarFotos(): Promise<ObjetoFoto[]> {
  try { return await leer(); } catch (error) {
    console.error("[fotos] No se pudo listar el bucket:", error);
    return [];
  }
}
```

- [ ] `types/index.ts`: `foto?: string;` en `Pizza`, `Empanada` y `Bebida`.
- [ ] `lib/catalog.ts`: después de armar el catálogo, `const objetos = await listarFotos();` y a cada pizza, empanada y bebida `foto: elegirFoto(p, objetos)` (solo si hay).
- [ ] Componentes: `<PizzaIllus … src={pizza.foto} />`, `<EmpanadaIllus … src={empanada.foto} />`, `<DrinkIllus … src={bebida.foto} />` en los usos listados en Archivos (confirmar en cada uno que el objeto viene del catálogo).
- [ ] `lib/seo.ts`: `imagen: pizza.foto ?? getPizzaImage(...)`, ídem empanadas y bebidas.
- [ ] `app/cocina/page.tsx`: `const objetos = await listarFotos();` y `fotoDe = (id, nombre) => elegirFoto({ id, nombre }, objetos) ?? (id ? REAL_PRODUCT_PHOTOS[id] : undefined) ?? FOTOS_EN_PRUEBA[nombre]`.

### Task 4: Verificación y publicación

- [ ] `npx tsc --noEmit`, eslint de lo tocado, `pnpm test`, `pnpm build`.
- [ ] `pnpm dev`: la carta y `/cocina` muestran las mismas fotos que producción (comparar las URL de cada producto en el HTML) salvo las aprobadas.
- [ ] Commit, `CLAUDE.md`, push, y en producción: subir una foto de prueba a la raíz con el nombre de un producto archivado sin foto + ` v1`, ver que aparece en `/cocina` en menos de 2 minutos, y avisar al dueño para borrarla (el borrado es definitivo y lo hace él).
