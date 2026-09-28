# Ficha de producto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tocar la foto de cualquier producto de la carta abre una ficha con la foto en grande y todo lo necesario para pedir; en mobile es una hoja que se cierra deslizando hacia abajo y pasa de producto deslizando a los costados.

**Architecture:** La lógica de gestos, la normalización de productos y las líneas del carrito viven en `lib/ficha.ts` (pura, testeada con `tsx`). `components/ui/ProductSheet.tsx` es solo presentación y gestos; `components/cart/FichaAccion.tsx` arma el pie (agregar, stepper, ½½, caja de empanadas) con las mismas funciones que las tarjetas. `Shell` guarda qué ficha está abierta (ids + índice) y un hook agrega una entrada al historial para que Atrás la cierre.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, CSS global en `app/impasto.css`, tests con `tsx` (sin framework: `chequear(nombre, condicion)`).

**Spec:** `docs/superpowers/specs/2026-09-28-ficha-producto-design.md`

## Global Constraints

- Gestor de paquetes: **`pnpm`**. Nunca `npm install` (rompe la auth del panel).
- Corte mobile: **`@media (max-width:760px)`** en CSS y **`matchMedia("(max-width: 760px)")`** en JS.
- **Escritorio no cambia** salvo: botón `.media-zoom` sobre las fotos, cursor y lupa al pasar el mouse, `pointer-events:none` en `.p-price`, y la ventana de la ficha. Cualquier otra diferencia de estilos calculados en escritorio es una regresión.
- Sin librerías nuevas. Sin pellizcar para acercar.
- Copy en español rioplatense, sin inventar datos: los textos de la ficha salen del producto (nombre, descripción, precio) o reusan frases que ya están en el sitio.
- Colores: carbón + dorado limpio; terracota (`--accent`) solo en el CTA de agregar. Nada de marrón.
- Archivos con CRLF: editar con Edit/Write, **nunca `sed -i`** (Git Bash convierte todo el archivo a LF).
- `pnpm lint` analiza `.worktrees/`: correr **`pnpm exec eslint <archivos tocados>`**.
- Trabajo directo en `main`, working tree compartido con otra sesión. **Cada commit tiene que dejar el sitio desplegable** (tests, TypeScript y build en verde antes de commitear), porque la otra sesión puede pushear cualquier commit. **No pushear**: el push despliega a producción y lo decide el dueño (Task 6).
- Carrito de pruebas: se guarda en la tabla compartida `carritos`. Al terminar cada prueba en navegador, vaciar el carrito y hacer `DELETE /api/cart/draft`.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/ficha.ts` | Crear | Tipos de la ficha, normalización de pizza/empanada/bebida, líneas del carrito, navegación y gestos (puro) |
| `lib/stock-images.ts` | Modificar | `imagenDeProducto()`: la URL que muestra cada tipo, para precargar |
| `tests/ficha.test.ts` | Crear | Tests de todo lo anterior |
| `package.json` | Modificar | Sumar `tsx tests/ficha.test.ts` al script `test` |
| `components/ui/PizzaIllus.tsx`, `components/ui/Illus.tsx` | Modificar | Prop opcional `loading` (default `"lazy"`) |
| `components/ui/ProductSheet.tsx` | Crear | La ficha (hoja mobile / ventana escritorio), gestos, teclado, foco, precarga; hook `useCierreConAtras` |
| `components/cart/FichaAccion.tsx` | Crear | Pie de la ficha: Agregar / `− n +` / ½½ / caja de empanadas |
| `components/sections/PizzaList.tsx`, `EmpanadasSection.tsx`, `Bebidas.tsx` | Modificar | Botón `.media-zoom` sobre cada foto, toque en el texto de las filas mobile, `onVerFicha` |
| `components/Shell.tsx` | Modificar | Estado de la ficha, render de `ProductSheet` + `FichaAccion`, cierre con Atrás |
| `app/impasto.css` | Modificar | Sección nueva "FICHA DE PRODUCTO" |
| `CLAUDE.md` | Modificar | Registrar el bloque terminado (Task 6) |

---

### Task 1: Lógica pura de la ficha

**Files:**
- Create: `lib/ficha.ts`
- Modify: `lib/stock-images.ts` (agregar al final)
- Create: `tests/ficha.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `fmt` de `lib/utils.ts`; tipos `Pizza`, `Empanada`, `Bebida`, `CartItem` de `types/index.ts`; `getPizzaImage`, `getEmpanadaImage`, `getDrinkImage` de `lib/stock-images.ts`.
- Produces (los usan las Tasks 2–5):
  - `type TipoFicha = "pizza" | "empanada" | "bebida"`
  - `interface BadgeFicha { texto: string; clase: string }`
  - `interface FichaItem { id: string; tipo: TipoFicha; nombre: string; desc: string; precio: number; precioTexto: string; badges: BadgeFicha[]; agotado: boolean; tags: string[] }`
  - `fichaDePizza(p: Pizza): FichaItem`, `fichaDeEmpanada(e: Empanada, pesoTexto: string): FichaItem`, `fichaDeBebida(b: Bebida): FichaItem`
  - `type LineaCarrito = Omit<CartItem, "cartId">`; `lineaDePizza(p: { id: string; nombre: string; precio: number }): LineaCarrito`; `lineaDeBebida(b: { id: string; nombre: string; precio: number }): LineaCarrito`
  - `vecino(indice: number, total: number, sentido: 1 | -1): number | null`
  - `type Eje = "horizontal" | "vertical"`; `ejeDelGesto(dx: number, dy: number): Eje | null`
  - `type Soltar = "anterior" | "siguiente" | "cerrar" | "quedarse"`; `resolverSoltar(g: GestoSoltado): Soltar` con `interface GestoSoltado { eje: Eje | null; dx: number; dy: number; dt: number; ancho: number; hayAnterior: boolean; haySiguiente: boolean }`
  - `resistencia(dx: number, hayVecino: boolean): number`
  - `CORTE_MOBILE = "(max-width: 760px)"`, `esMobile(): boolean`, `sinAnimaciones(): boolean`
  - En `lib/stock-images.ts`: `imagenDeProducto(tipo: "pizza" | "empanada" | "bebida", nombre: string, id: string, tags?: string[]): string`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/ficha.test.ts`:

```ts
import {
  vecino,
  ejeDelGesto,
  resolverSoltar,
  resistencia,
  fichaDePizza,
  fichaDeEmpanada,
  fichaDeBebida,
  lineaDePizza,
  lineaDeBebida,
  UMBRAL_CIERRE,
} from "../lib/ficha";
import { imagenDeProducto, REAL_PRODUCT_PHOTOS, getPizzaImage, getEmpanadaImage, getDrinkImage } from "../lib/stock-images";
import type { Pizza, Empanada, Bebida } from "../types";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── vecinos: sin vuelta circular ── */
chequear("vecino · siguiente en el medio", vecino(3, 10, 1) === 4);
chequear("vecino · anterior en el medio", vecino(3, 10, -1) === 2);
chequear("vecino · no hay anterior del primero", vecino(0, 10, -1) === null);
chequear("vecino · no hay siguiente del último", vecino(9, 10, 1) === null);
chequear("vecino · lista de uno no tiene vecinos", vecino(0, 1, 1) === null && vecino(0, 1, -1) === null);

/* ── eje del gesto ── */
chequear("eje · un temblor no decide", ejeDelGesto(4, 5) === null);
chequear("eje · horizontal", ejeDelGesto(-30, 8) === "horizontal");
chequear("eje · vertical", ejeDelGesto(6, 40) === "vertical");
chequear("eje · diagonal gana el mayor", ejeDelGesto(20, -25) === "vertical");

/* ── soltar ── */
const base = { dt: 400, ancho: 400, hayAnterior: true, haySiguiente: true };
chequear("soltar · sin eje se queda (toque)", resolverSoltar({ ...base, eje: null, dx: 0, dy: 0 }) === "quedarse");
chequear("soltar · izquierda lejos pasa al siguiente", resolverSoltar({ ...base, eje: "horizontal", dx: -120, dy: 0 }) === "siguiente");
chequear("soltar · derecha lejos vuelve al anterior", resolverSoltar({ ...base, eje: "horizontal", dx: 120, dy: 0 }) === "anterior");
chequear("soltar · poco y lento se queda", resolverSoltar({ ...base, eje: "horizontal", dx: -60, dy: 0 }) === "quedarse");
chequear("soltar · poco pero rápido pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -60, dy: 0, dt: 80 }) === "siguiente");
chequear("soltar · rápido pero cortito no pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -20, dy: 0, dt: 20 }) === "quedarse");
chequear("soltar · en el último no pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -200, dy: 0, haySiguiente: false }) === "quedarse");
chequear("soltar · en el primero no vuelve", resolverSoltar({ ...base, eje: "horizontal", dx: 200, dy: 0, hayAnterior: false }) === "quedarse");
chequear("soltar · bajar más del umbral cierra", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: UMBRAL_CIERRE + 1 }) === "cerrar");
chequear("soltar · bajar poco y lento se queda", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: 60 }) === "quedarse");
chequear("soltar · bajar rápido cierra", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: 60, dt: 90 }) === "cerrar");
chequear("soltar · subir nunca cierra", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: -300, dt: 90 }) === "quedarse");

/* ── resistencia en los bordes ── */
chequear("resistencia · con vecino sigue al dedo", resistencia(-90, true) === -90);
chequear("resistencia · sin vecino, un tercio", resistencia(-90, false) === -30);

/* ── normalización ── */
const pizza: Pizza = {
  id: "p1", nombre: "Diavola", categoria: "gourmet", precio: 14500, desc: "Salame picante y miel",
  tags: ["picante", "vegetariana"], disponible: true, popular: true,
};
const fp = fichaDePizza(pizza);
chequear("pizza · tipo y precio", fp.tipo === "pizza" && fp.precio === 14500 && fp.precioTexto === "$14.500");
chequear("pizza · descripción completa", fp.desc === "Salame picante y miel");
chequear("pizza · cartelitos en el orden de la tarjeta",
  fp.badges.map((b) => b.texto).join("|") === "★ Más pedida|Veggie|Picante");
chequear("pizza · clases de la tarjeta", fp.badges[0].clase === "p-badge top" && fp.badges[2].clase === "p-badge hot");
const agotada = fichaDePizza({ ...pizza, disponible: false });
chequear("pizza · agotada", agotada.agotado === true);
chequear("pizza · agotada no dice Más pedida", !agotada.badges.some((b) => b.texto.includes("Más pedida")));

const empanada: Empanada = { id: "e1", nombre: "Carne", precio: 1800, desc: "Cortada a cuchillo", tags: [], disponible: true, badge: { label: "Nueva", color: "dorado" } };
const fe = fichaDeEmpanada(empanada, "180 g");
chequear("empanada · precio unitario", fe.tipo === "empanada" && fe.precioTexto === "$1.800");
chequear("empanada · etiqueta", fe.badges.length === 1 && fe.badges[0].clase === "p-badge-tag c-dorado" && fe.badges[0].texto === "Nueva");
const sinPrecio = fichaDeEmpanada({ ...empanada, precio: undefined, badge: undefined }, "180 g");
chequear("empanada · sin precio muestra el peso", sinPrecio.precioTexto === "180 g" && sinPrecio.precio === 0);
chequear("empanada · sin etiqueta", sinPrecio.badges.length === 0);

const bebida: Bebida = { id: "b1", nombre: "Quilmes", precio: 3500, disponible: false };
const fb = fichaDeBebida(bebida);
chequear("bebida · sin descripción ni cartelitos", fb.tipo === "bebida" && fb.desc === "" && fb.badges.length === 0);
chequear("bebida · agotada", fb.agotado === true);

/* ── líneas del carrito: las mismas que arma la tarjeta ── */
const lp = lineaDePizza(pizza);
chequear("línea pizza", lp.key === "p1" && lp.type === "pizza" && lp.name === "Diavola" && lp.price === 14500 && lp.illus === "p1" && lp.qty === 1);
const lb = lineaDeBebida(bebida);
chequear("línea bebida", lb.key === "b1" && lb.type === "bebida" && lb.name === "Quilmes" && lb.price === 3500 && lb.qty === 1 && lb.illus === undefined);

/* ── imagen: la misma que resuelve cada ilustración ── */
const idConFoto = Object.keys(REAL_PRODUCT_PHOTOS)[0];
chequear("imagen · foto real por id", imagenDeProducto("pizza", "x", idConFoto) === REAL_PRODUCT_PHOTOS[idConFoto]);
chequear("imagen · pizza igual que getPizzaImage", imagenDeProducto("pizza", "Fugazzeta", "sin-foto", ["gourmet"]) === getPizzaImage("Fugazzeta", "sin-foto", ["gourmet"]));
chequear("imagen · empanada igual que getEmpanadaImage", imagenDeProducto("empanada", "Pollo", "sin-foto") === getEmpanadaImage("Pollo", "sin-foto"));
chequear("imagen · bebida igual que getDrinkImage", imagenDeProducto("bebida", "Coca-Cola", "sin-foto") === getDrinkImage("Coca-Cola", "sin-foto"));

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `pnpm exec tsx tests/ficha.test.ts`
Expected: error de resolución — `Cannot find module '../lib/ficha'`.

- [ ] **Step 3: Implementar `lib/ficha.ts`**

```ts
/**
 * Ficha de producto: la foto en grande con lo necesario para pedir.
 * Spec: docs/superpowers/specs/2026-09-28-ficha-producto-design.md
 *
 * Sin React ni `db`: se testea con `tsx` (tests/ficha.test.ts).
 */
import { fmt } from "./utils";
import type { Bebida, CartItem, Empanada, Pizza } from "../types";

export type TipoFicha = "pizza" | "empanada" | "bebida";

/** `clase` es la misma que usa la tarjeta, para que el cartelito se vea igual. */
export interface BadgeFicha { texto: string; clase: string }

export interface FichaItem {
  id: string;
  tipo: TipoFicha;
  nombre: string;
  desc: string;
  precio: number;
  /** Lo que muestra la tarjeta como precio (en empanadas sin precio, el peso). */
  precioTexto: string;
  badges: BadgeFicha[];
  agotado: boolean;
  tags: string[];
}

/* ── normalización: mismos cartelitos y precio que la tarjeta ── */

export function fichaDePizza(p: Pizza): FichaItem {
  const agotado = p.disponible === false;
  const badges: BadgeFicha[] = [];
  if (p.popular && !agotado) badges.push({ texto: "★ Más pedida", clase: "p-badge top" });
  if (p.tags.includes("vegetariana")) badges.push({ texto: "Veggie", clase: "p-badge veg" });
  if (p.tags.includes("picante")) badges.push({ texto: "Picante", clase: "p-badge hot" });
  return {
    id: p.id, tipo: "pizza", nombre: p.nombre, desc: p.desc,
    precio: p.precio, precioTexto: fmt(p.precio), badges, agotado, tags: p.tags,
  };
}

/** `pesoTexto`: lo que muestra la tarjeta cuando la empanada no tiene precio unitario. */
export function fichaDeEmpanada(e: Empanada, pesoTexto: string): FichaItem {
  const precio = Number(e.precio) || 0;
  return {
    id: e.id, tipo: "empanada", nombre: e.nombre, desc: e.desc,
    precio, precioTexto: precio > 0 ? fmt(precio) : pesoTexto,
    badges: e.badge ? [{ texto: e.badge.label, clase: `p-badge-tag c-${e.badge.color}` }] : [],
    agotado: e.disponible === false, tags: e.tags,
  };
}

export function fichaDeBebida(b: Bebida): FichaItem {
  return {
    id: b.id, tipo: "bebida", nombre: b.nombre, desc: "",
    precio: b.precio, precioTexto: fmt(b.precio), badges: [], agotado: b.disponible === false, tags: [],
  };
}

/* ── líneas del carrito: las usan la tarjeta y la ficha, así no pueden diferir ── */

export type LineaCarrito = Omit<CartItem, "cartId">;

export function lineaDePizza(p: { id: string; nombre: string; precio: number }): LineaCarrito {
  return { key: p.id, type: "pizza", name: p.nombre, price: p.precio, illus: p.id, qty: 1 };
}

export function lineaDeBebida(b: { id: string; nombre: string; precio: number }): LineaCarrito {
  return { key: b.id, type: "bebida", name: b.nombre, price: b.precio, qty: 1 };
}

/* ── navegación y gestos ── */

/** Índice anterior o siguiente; `null` en los bordes (no hay vuelta circular). */
export function vecino(indice: number, total: number, sentido: 1 | -1): number | null {
  const destino = indice + sentido;
  return destino >= 0 && destino < total ? destino : null;
}

export type Eje = "horizontal" | "vertical";

/** Distancia mínima antes de decidir el eje: un temblor del dedo no mueve nada. */
export const UMBRAL_EJE = 10;
/** Mismo umbral que la hoja del carrito (CartDrawer). */
export const UMBRAL_CIERRE = 120;
/** px/ms. Un gesto más rápido que esto cuenta aunque sea corto… */
export const VELOCIDAD_RAPIDA = 0.5;
/** …siempre que recorra al menos esto: si no, un toque nervioso cerraría la ficha. */
export const DISTANCIA_MINIMA_RAPIDA = 30;

/**
 * `null` hasta que el dedo se mueve UMBRAL_EJE; después, el eje que domina.
 * Quien lo llama lo fija durante todo el gesto: un deslizamiento en diagonal
 * no mueve la foto en dos direcciones.
 */
export function ejeDelGesto(dx: number, dy: number): Eje | null {
  if (Math.hypot(dx, dy) < UMBRAL_EJE) return null;
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

export type Soltar = "anterior" | "siguiente" | "cerrar" | "quedarse";

export interface GestoSoltado {
  eje: Eje | null;
  dx: number;
  dy: number;
  /** ms entre apoyar y soltar. */
  dt: number;
  /** Ancho de la foto en px. */
  ancho: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
}

function esRapido(distancia: number, dt: number): boolean {
  return distancia >= DISTANCIA_MINIMA_RAPIDA && distancia / Math.max(1, dt) >= VELOCIDAD_RAPIDA;
}

export function resolverSoltar(g: GestoSoltado): Soltar {
  if (g.eje === "horizontal") {
    const distancia = Math.abs(g.dx);
    if (distancia <= g.ancho / 4 && !esRapido(distancia, g.dt)) return "quedarse";
    if (g.dx < 0) return g.haySiguiente ? "siguiente" : "quedarse";
    return g.hayAnterior ? "anterior" : "quedarse";
  }
  if (g.eje === "vertical" && g.dy > 0 && (g.dy > UMBRAL_CIERRE || esRapido(g.dy, g.dt))) return "cerrar";
  return "quedarse";
}

/** En un borde la foto se resiste: se mueve un tercio de lo que se mueve el dedo. */
export function resistencia(dx: number, hayVecino: boolean): number {
  return hayVecino ? dx : dx / 3;
}

/* ── entorno (no se testea: depende del navegador) ── */

/** Mismo corte que `@media (max-width:760px)` en impasto.css. */
export const CORTE_MOBILE = "(max-width: 760px)";
export const esMobile = () => typeof window !== "undefined" && window.matchMedia(CORTE_MOBILE).matches;
export const sinAnimaciones = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

Agregar al final de `lib/stock-images.ts`:

```ts
/**
 * La URL que muestra cada ilustración según el tipo. La usa la ficha de
 * producto para precargar la foto del producto anterior y la del siguiente.
 */
export function imagenDeProducto(tipo: "pizza" | "empanada" | "bebida", nombre: string, id: string, tags: string[] = []): string {
  if (tipo === "bebida") return getDrinkImage(nombre, id);
  if (tipo === "empanada") return getEmpanadaImage(nombre, id);
  return getPizzaImage(nombre, id, tags);
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `pnpm exec tsx tests/ficha.test.ts`
Expected: todas las líneas `PASA` y `Todos los casos pasan`.

- [ ] **Step 5: Sumar el test al script y correr la suite completa**

En `package.json`, agregar al final del script `test` (después de `tsx tests/opiniones.test.ts`): ` && tsx tests/ficha.test.ts`.

Run: `pnpm test`
Expected: termina con código 0; la última sección es la de ficha con `Todos los casos pasan`.

- [ ] **Step 6: TypeScript y lint de lo tocado**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.
Run: `pnpm exec eslint lib/ficha.ts lib/stock-images.ts tests/ficha.test.ts`
Expected: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add lib/ficha.ts lib/stock-images.ts tests/ficha.test.ts package.json
git commit -m "feat(ficha): lógica pura de la ficha de producto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Las tarjetas usan las líneas compartidas

Refactor sin cambio visible: `PizzaList` y `Bebidas` arman la línea del carrito con `lineaDePizza` / `lineaDeBebida`, las mismas que va a usar la ficha. Así la tarjeta y la ficha no pueden agregar cosas distintas.

**Files:**
- Modify: `components/sections/PizzaList.tsx` (función `addPizza`, ~línea 62)
- Modify: `components/sections/Bebidas.tsx` (función `agregar`, ~línea 14)

**Interfaces:**
- Consumes: `lineaDePizza`, `lineaDeBebida` de `lib/ficha.ts` (Task 1).
- Produces: nada nuevo.

- [ ] **Step 1: Reemplazar la línea armada a mano en `PizzaList.tsx`**

Import (junto a los otros de `@/lib`):

```ts
import { lineaDePizza } from "@/lib/ficha";
```

Reemplazar:

```ts
  const addPizza = (pizza: Pizza) => {
    add({ key: pizza.id, type: "pizza", name: pizza.nombre, price: pizza.precio, illus: pizza.id, qty: 1 });
    toast(`${pizza.nombre} agregada`);
  };
```

por:

```ts
  const addPizza = (pizza: Pizza) => {
    add(lineaDePizza(pizza));
    toast(`${pizza.nombre} agregada`);
  };
```

- [ ] **Step 2: Lo mismo en `Bebidas.tsx`**

Import:

```ts
import { lineaDeBebida } from "@/lib/ficha";
```

Reemplazar:

```ts
    add({ key: bebida.id, type: "bebida", name: bebida.nombre, price: bebida.precio, qty: 1 });
```

por:

```ts
    add(lineaDeBebida(bebida));
```

- [ ] **Step 3: Verificar**

Run: `pnpm test` → código 0.
Run: `pnpm exec tsc --noEmit` → sin errores.
Run: `pnpm exec eslint components/sections/PizzaList.tsx components/sections/Bebidas.tsx` → 0 errores.

- [ ] **Step 4: Commit**

```bash
git add components/sections/PizzaList.tsx components/sections/Bebidas.tsx
git commit -m "refactor(carta): líneas del carrito compartidas con la ficha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Componente `ProductSheet` y sus estilos

La ficha, sin conectar todavía (nadie la renderiza: el sitio no cambia con este commit).

**Files:**
- Modify: `components/ui/PizzaIllus.tsx`, `components/ui/Illus.tsx` (prop `loading`)
- Create: `components/ui/ProductSheet.tsx`
- Modify: `app/impasto.css` (sección nueva al final del archivo)

**Interfaces:**
- Consumes: de `lib/ficha.ts`: `FichaItem`, `Eje`, `vecino`, `ejeDelGesto`, `resolverSoltar`, `resistencia`, `esMobile`, `sinAnimaciones`; de `lib/stock-images.ts`: `imagenDeProducto`.
- Produces:
  - `ProductSheet(props: { items: FichaItem[]; indice: number; onIndice: (indice: number) => void; onClose: () => void; accion: React.ReactNode })`
  - Clases CSS que usa la Task 4 en el pie: `.ficha-accion`, `.ficha-agregar`, `.ficha-half`, `.ficha-step`, `.ficha-caja`.

- [ ] **Step 1: Prop `loading` en las ilustraciones**

En `components/ui/PizzaIllus.tsx`:

```ts
interface PizzaIllusProps {
  id?: string;
  name?: string;
  tags?: string[];
  src?: string;
  /** La ficha de producto carga la foto visible sin esperar. */
  loading?: "lazy" | "eager";
}

export function PizzaIllus({ id = "p01", name = "", tags = [], src, loading = "lazy" }: PizzaIllusProps) {
```

y en el `<img>`: `loading={loading}` en lugar de `loading="lazy"`.

En `components/ui/Illus.tsx`, lo mismo para `EmpanadaIllus` y `DrinkIllus` (no tocar `SceneIllus`):

```ts
export function EmpanadaIllus({ id = "e01", name = "", src, loading = "lazy" }: { id?: string; name?: string; src?: string; loading?: "lazy" | "eager" }) {
```

```ts
export function DrinkIllus({ id = "b01", label = "", name = "", src, loading = "lazy" }: { id?: string; label?: string; name?: string; src?: string; loading?: "lazy" | "eager" }) {
```

y en sus dos `<img>`: `loading={loading}`.

- [ ] **Step 2: Crear `components/ui/ProductSheet.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { EmpanadaIllus, DrinkIllus } from "@/components/ui/Illus";
import { imagenDeProducto } from "@/lib/stock-images";
import {
  ejeDelGesto,
  esMobile,
  resistencia,
  resolverSoltar,
  sinAnimaciones,
  vecino,
  type Eje,
  type FichaItem,
} from "@/lib/ficha";

/** ms. Igual que la transición de `.ficha-pista` que se pone en línea abajo. */
const DURACION_PASO = 220;

function FotoDeFicha({ item, carga }: { item: FichaItem; carga: "lazy" | "eager" }) {
  if (item.tipo === "bebida") return <DrinkIllus id={item.id} label={item.nombre} name={item.nombre} loading={carga} />;
  if (item.tipo === "empanada") return <EmpanadaIllus id={item.id} name={item.nombre} loading={carga} />;
  return <PizzaIllus id={item.id} name={item.nombre} tags={item.tags} loading={carga} />;
}

interface ProductSheetProps {
  /** La lista que el cliente está viendo en esa sección, en el mismo orden. */
  items: FichaItem[];
  indice: number;
  onIndice: (indice: number) => void;
  onClose: () => void;
  /** El pie (agregar, stepper, ½½): lo arma quien abre la ficha. */
  accion: ReactNode;
}

interface Arrastre { puntero: number; x0: number; y0: number; t0: number; eje: Eje | null }

/**
 * Ficha de producto. Mobile: hoja desde abajo; se cierra arrastrando hacia
 * abajo y pasa de producto deslizando a los costados sobre la foto. Escritorio:
 * ventana centrada con flechas. Spec:
 * docs/superpowers/specs/2026-09-28-ficha-producto-design.md
 */
export function ProductSheet({ items, indice, onIndice, onClose, accion }: ProductSheetProps) {
  const hojaRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const pasando = useRef(false);
  const [pista, setPista] = useState({ x: 0, animada: false });
  const [bajada, setBajada] = useState(0);

  const item = items[indice];
  const anterior = vecino(indice, items.length, -1);
  const siguiente = vecino(indice, items.length, 1);

  // Al abrir: el foco entra a la hoja y el fondo deja de desplazarse (la clase
  // solo bloquea el scroll en mobile, ver impasto.css). Al cerrar, el foco
  // vuelve a quien la abrió.
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hojaRef.current?.focus({ preventScroll: true });
    document.documentElement.classList.add("ficha-abierta");
    return () => {
      document.documentElement.classList.remove("ficha-abierta");
      previo?.focus({ preventScroll: true });
    };
  }, []);

  // Teclado: Esc cierra, flechas pasan de producto, Tab queda atrapado adentro.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowRight" && siguiente !== null) { e.preventDefault(); onIndice(siguiente); return; }
      if (e.key === "ArrowLeft" && anterior !== null) { e.preventDefault(); onIndice(anterior); return; }
      if (e.key !== "Tab" || !hojaRef.current) return;
      const focusables = hojaRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === hojaRef.current)) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onClose, onIndice, anterior, siguiente]);

  // Las miniaturas cargan en diferido: una fila lejos de la pantalla puede no
  // haber bajado su foto. Se precargan las dos vecinas para que al deslizar no
  // aparezca un hueco.
  useEffect(() => {
    for (const i of [anterior, siguiente]) {
      if (i === null) continue;
      const otro = items[i];
      const img = new Image();
      img.src = imagenDeProducto(otro.tipo, otro.nombre, otro.id, otro.tags);
    }
  }, [items, anterior, siguiente]);

  if (!item) return null;

  const ancho = () => mediaRef.current?.clientWidth || window.innerWidth;

  const pasarA = (destino: number, sentido: 1 | -1) => {
    if (sinAnimaciones()) { setPista({ x: 0, animada: false }); onIndice(destino); return; }
    pasando.current = true;
    setPista({ x: -sentido * ancho(), animada: true });
    window.setTimeout(() => {
      // Mismo cuadro: la vecina ya ocupa el centro. Sin transición, no se ve el cambio.
      pasando.current = false;
      setPista({ x: 0, animada: false });
      onIndice(destino);
    }, DURACION_PASO);
  };

  // Gestos solo en mobile. El puntero queda capturado por la foto, que lleva
  // touch-action:none: sin eso el navegador toma el gesto como scroll.
  const alApoyar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pasando.current || !esMobile()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Un toque en ✕ o en las flechas es un clic, no un arrastre: capturar el
    // puntero acá le robaría el clic al botón.
    if ((e.target as HTMLElement).closest("button")) return;
    arrastre.current = { puntero: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, eje: null };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPista({ x: 0, animada: false });
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.puntero !== e.pointerId) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (a.eje === null) a.eje = ejeDelGesto(dx, dy);
    if (a.eje === "horizontal") setPista({ x: resistencia(dx, (dx < 0 ? siguiente : anterior) !== null), animada: false });
    else if (a.eje === "vertical") setBajada(Math.max(0, dy));
  };

  const alSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.puntero !== e.pointerId) return;
    arrastre.current = null;
    const resultado = resolverSoltar({
      eje: a.eje,
      dx: e.clientX - a.x0,
      dy: e.clientY - a.y0,
      dt: e.timeStamp - a.t0,
      ancho: ancho(),
      hayAnterior: anterior !== null,
      haySiguiente: siguiente !== null,
    });
    setBajada(0);
    if (resultado === "cerrar") { onClose(); return; }
    if (resultado === "siguiente" && siguiente !== null) { pasarA(siguiente, 1); return; }
    if (resultado === "anterior" && anterior !== null) { pasarA(anterior, -1); return; }
    setPista({ x: 0, animada: true });
  };

  const alCancelar = () => {
    arrastre.current = null;
    setBajada(0);
    setPista({ x: 0, animada: true });
  };

  const lugares: Array<[number | null, number]> = [[anterior, -1], [indice, 0], [siguiente, 1]];

  return (
    <div className="ficha-fondo" onClick={onClose}>
      <div
        ref={hojaRef}
        className="ficha-hoja"
        data-tipo={item.tipo}
        role="dialog"
        aria-modal="true"
        aria-label={item.nombre}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={bajada ? { transform: `translateY(${bajada}px)`, transition: "none" } : undefined}
      >
        <div
          ref={mediaRef}
          className="ficha-media"
          onPointerDown={alApoyar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alCancelar}
        >
          <div
            className="ficha-pista"
            style={{
              transform: `translate3d(${pista.x}px,0,0)`,
              transition: pista.animada ? `transform ${DURACION_PASO}ms cubic-bezier(.22,1,.36,1)` : "none",
            }}
          >
            {lugares.map(([i, lugar]) => i === null ? null : (
              <div key={items[i].id} className="ficha-foto" style={{ left: `${lugar * 100}%` }} aria-hidden={lugar !== 0}>
                <FotoDeFicha item={items[i]} carga={lugar === 0 ? "eager" : "lazy"} />
                {items[i].agotado && <div className="media-agotado-bar">Agotado</div>}
              </div>
            ))}
          </div>
          <span className="ficha-manija" aria-hidden="true" />
          {items.length > 1 && <span className="ficha-contador" aria-hidden="true">{indice + 1} / {items.length}</span>}
          {anterior !== null && (
            <button type="button" className="ficha-flecha prev" onClick={() => onIndice(anterior)} aria-label="Producto anterior">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          {siguiente !== null && (
            <button type="button" className="ficha-flecha next" onClick={() => onIndice(siguiente)} aria-label="Producto siguiente">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
        </div>

        <button type="button" className="ficha-cerrar" onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <div className="ficha-info">
          {item.badges.length > 0 && (
            <div className="ficha-badges">
              {item.badges.map((b) => <span key={b.texto} className={b.clase}>{b.texto}</span>)}
            </div>
          )}
          <h3 className="ficha-titulo">{item.nombre}</h3>
          <b className="ficha-precio">{item.precioTexto}</b>
          {item.desc && <p className="ficha-desc">{item.desc}</p>}
        </div>

        <div className="ficha-pie">{accion}</div>

        {/* Lector de pantalla: anuncia el producto al pasar con flechas o deslizando. */}
        <span className="ficha-anuncio" aria-live="polite">
          {items.length > 1 ? `${item.nombre}, ${indice + 1} de ${items.length}` : item.nombre}
        </span>
      </div>
    </div>
  );
}
```

Nota para el revisor: los cartelitos van junto al nombre y no sobre la foto (en la tarjeta de empanadas la etiqueta es de contorno, pensada para fondo crema, y sobre una foto no se lee). Actualizar esa línea de la spec en el Step 4.

- [ ] **Step 3: Estilos — agregar al final de `app/impasto.css`**

```css
/* ============ FICHA DE PRODUCTO ============ */
/* components/ui/ProductSheet.tsx. Escritorio: ventana centrada, foto a la
   izquierda. Mobile (≤760px): hoja desde abajo. z-index 105: por encima de la
   barra de abajo (61), el chat (65/66) y el carrito (100); debajo del aviso
   (200). La mitad y mitad (110) nunca convive: ½½ cierra la ficha antes. */
.ficha-fondo{
  position:fixed; inset:0; z-index:105;
  background:rgba(18,16,13,.62); backdrop-filter:blur(5px);
  display:flex; align-items:center; justify-content:center; padding:28px;
  animation:imp-fade .18s ease;
}
.ficha-hoja{
  position:relative; width:100%; max-width:980px; height:min(620px, calc(100vh - 56px));
  background:var(--bg); border-radius:22px; overflow:hidden; outline:none;
  box-shadow:0 40px 90px rgba(0,0,0,.4);
  display:grid; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto;
  grid-template-areas:"media info" "media pie";
  animation:imp-slideup .26s cubic-bezier(.2,.8,.2,1);
  transition:transform .22s ease;
}
.ficha-media{
  grid-area:media; position:relative; overflow:hidden; background:var(--bg-2);
  touch-action:none; user-select:none; -webkit-user-select:none;
}
.ficha-pista{ position:absolute; inset:0; will-change:transform; }
.ficha-foto{ position:absolute; top:0; bottom:0; width:100%; overflow:hidden; }
.ficha-foto img{ -webkit-user-drag:none; }
/* Las bebidas son fotos de botella sobre blanco: enteras, sin recortar.
   !important: la ilustración trae object-fit:cover en línea. */
.ficha-hoja[data-tipo="bebida"] .ficha-media{ background:#fff; }
.ficha-hoja[data-tipo="bebida"] .ficha-foto img{ object-fit:contain !important; padding:24px; }
.ficha-manija{ display:none; }
.ficha-contador{
  position:absolute; left:14px; top:14px; z-index:2; pointer-events:none;
  font-family:var(--font-mono); font-size:10.5px; letter-spacing:.16em; font-variant-numeric:tabular-nums;
  padding:6px 10px; border-radius:999px; background:rgba(24,22,20,.62); color:#f6f1e7;
}
.ficha-flecha{
  position:absolute; top:50%; z-index:2; width:44px; height:44px; margin-top:-22px; border-radius:999px;
  background:rgba(255,250,240,.92); color:var(--ink); box-shadow:0 8px 20px rgba(0,0,0,.18);
  display:grid; place-items:center; transition:transform .15s ease, background .15s ease;
}
.ficha-flecha:hover{ background:#fff; transform:scale(1.06); }
.ficha-flecha.prev{ left:14px; }
.ficha-flecha.next{ right:14px; }
.ficha-cerrar{
  position:absolute; top:14px; right:14px; z-index:3; width:40px; height:40px; border-radius:999px;
  background:var(--surface); border:1px solid var(--line); color:var(--ink); display:grid; place-items:center;
}
.ficha-flecha:focus-visible, .ficha-cerrar:focus-visible,
.ficha-pie button:focus-visible{ outline:3px solid var(--gold); outline-offset:2px; }
.ficha-info{
  grid-area:info; min-height:0; overflow-y:auto; overscroll-behavior:contain;
  padding:34px 30px 12px; display:flex; flex-direction:column; align-items:flex-start; gap:10px;
}
.ficha-badges{ display:flex; gap:6px; flex-wrap:wrap; }
.ficha-titulo{
  font-family:var(--font-display); font-size:30px; font-weight:600; letter-spacing:-.025em;
  line-height:1.1; margin:0; padding-right:44px;
}
.ficha-precio{ font-family:var(--font-display); font-size:24px; font-weight:600; font-variant-numeric:lining-nums tabular-nums; color:var(--ink); }
.ficha-desc{ margin:4px 0 0; font-size:15px; line-height:1.6; color:var(--ink-2); text-wrap:pretty; }
.ficha-pie{ grid-area:pie; padding:16px 30px 28px; border-top:1px solid var(--line); background:var(--bg); }
.ficha-accion{ display:flex; gap:10px; align-items:center; }
.ficha-agregar{
  flex:1; height:52px; border-radius:14px; background:var(--accent); color:var(--accent-ink);
  font-weight:600; font-size:15.5px; box-shadow:0 10px 22px rgba(178,71,42,.3); transition:background .15s;
}
.ficha-agregar:hover:not(:disabled){ background:var(--accent-hover); }
.ficha-agregar:disabled{ background:var(--bg-2); color:var(--muted); box-shadow:none; cursor:not-allowed; }
.ficha-half{
  flex:none; width:64px; height:52px; border-radius:14px; border:1px solid var(--line);
  background:var(--surface); color:var(--ink); font-weight:600; font-size:16px;
}
.ficha-half:disabled{ opacity:.5; cursor:not-allowed; }
.ficha-step{
  flex:1; display:flex; align-items:center; justify-content:space-between; height:52px;
  padding:0 6px; border-radius:14px; background:var(--carbon); color:#f6f1e7;
}
.ficha-step button{ width:44px; height:44px; border-radius:999px; font-size:22px; line-height:1; color:#f6f1e7; }
.ficha-step button:disabled{ opacity:.35; cursor:not-allowed; }
.ficha-step span{ font-weight:600; font-size:15px; font-variant-numeric:tabular-nums; }
.ficha-caja{
  flex:1; min-width:0; font-family:var(--font-mono); font-size:11px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--muted);
}
.ficha-caja + .ficha-step{ flex:0 0 150px; }
.ficha-anuncio{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
/* Con la ficha abierta el aviso "X agregada" sube arriba: abajo taparía el pie. */
html.ficha-abierta .toast{ top:calc(14px + env(safe-area-inset-top)); bottom:auto; }
@keyframes ficha-sube{ from{ transform:translateY(100%); } to{ transform:translateY(0); } }
@media (prefers-reduced-motion:reduce){
  .ficha-fondo, .ficha-hoja{ animation:none; transition:none; }
}

@media (max-width:760px){
  html.ficha-abierta{ overflow:hidden; }
  .ficha-fondo{ align-items:flex-end; padding:0; }
  .ficha-hoja{
    display:flex; flex-direction:column; max-width:none; height:auto; max-height:calc(100dvh - 20px);
    border-radius:22px 22px 0 0; animation:ficha-sube .3s cubic-bezier(.2,.8,.2,1);
  }
  /* En horizontal la foto se achica: el pie con el botón siempre queda a la vista. */
  .ficha-media{ flex:none; width:100%; aspect-ratio:4/3; max-height:48dvh; }
  .ficha-manija{
    display:block; position:absolute; top:8px; left:50%; z-index:2; width:40px; height:5px; margin-left:-20px;
    border-radius:999px; background:rgba(255,255,255,.88); box-shadow:0 1px 4px rgba(0,0,0,.25); pointer-events:none;
  }
  .ficha-contador{ top:12px; left:12px; }
  .ficha-flecha{ display:none; }
  .ficha-cerrar{ top:10px; right:10px; width:36px; height:36px; background:rgba(24,22,20,.62); border-color:transparent; color:#f6f1e7; }
  .ficha-info{ flex:1; padding:16px 18px 8px; gap:8px; }
  .ficha-titulo{ font-size:24px; padding-right:0; }
  .ficha-precio{ font-size:20px; }
  .ficha-desc{ font-size:14.5px; }
  .ficha-pie{ flex:none; padding:12px 16px calc(12px + env(safe-area-inset-bottom)); }
  .ficha-agregar, .ficha-half, .ficha-step{ height:50px; }
}
@media (max-width:760px) and (prefers-reduced-motion:reduce){
  .ficha-hoja{ animation:none; transition:none; }
}
```

- [ ] **Step 4: Ajustar la spec**

En `docs/superpowers/specs/2026-09-28-ficha-producto-design.md`, sección "Mobile", reemplazar el ítem 2:

```
2. La foto a todo el ancho, proporción 4:3, con los cartelitos que ya muestra la tarjeta
   (★ Más pedida, Veggie, Picante; en empanadas, el badge de etiqueta).
```

por:

```
2. La foto a todo el ancho, proporción 4:3.
```

y el ítem 3 por:

```
3. Los cartelitos que ya muestra la tarjeta (★ Más pedida, Veggie, Picante; en empanadas, la
   etiqueta), nombre, precio y la descripción **completa** (en las filas se corta). Los
   cartelitos van junto al nombre y no sobre la foto: la etiqueta de empanadas es de contorno,
   pensada para fondo crema, y sobre una foto no se lee.
```

- [ ] **Step 5: Verificar**

Run: `pnpm exec tsc --noEmit` → sin errores.
Run: `pnpm exec eslint components/ui/ProductSheet.tsx components/ui/PizzaIllus.tsx components/ui/Illus.tsx` → 0 errores (las advertencias `@next/next/no-img-element` de las ilustraciones son preexistentes).
Run: `pnpm test` → código 0.
Run: `pnpm build` → termina sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/ui/ProductSheet.tsx components/ui/PizzaIllus.tsx components/ui/Illus.tsx app/impasto.css docs/superpowers/specs/2026-09-28-ficha-producto-design.md
git commit -m "feat(ficha): componente de la ficha de producto y sus estilos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Abrir la ficha desde la carta

Conecta todo: botón sobre cada foto, toque en el texto de las filas mobile, estado en `Shell` y el pie con las mismas acciones que la tarjeta. Al terminar esta task la función está completa salvo el botón Atrás (Task 5).

**Files:**
- Create: `components/cart/FichaAccion.tsx`
- Modify: `components/sections/PizzaList.tsx`
- Modify: `components/sections/EmpanadasSection.tsx`
- Modify: `components/sections/Bebidas.tsx`
- Modify: `components/Shell.tsx`
- Modify: `app/impasto.css` (bloque del disparador, dentro de la sección "FICHA DE PRODUCTO")

**Interfaces:**
- Consumes: `ProductSheet` (Task 3); `FichaItem`, `fichaDePizza`, `fichaDeEmpanada`, `fichaDeBebida`, `lineaDePizza`, `lineaDeBebida`, `esMobile` (Task 1); `argumento` de `lib/marca.ts`; `useCart`, `useToast`.
- Produces:
  - Prop nueva en las tres secciones: `onVerFicha: (ids: string[], indice: number) => void`.
  - `FichaAccion(props: { item: FichaItem; onHalf?: () => void; caja?: { cantidad: number; elegidas: number; tamanio: number; onPick: (delta: number) => void } })`.
  - En `Shell`: estado `ficha` y función `cerrarFicha` (la Task 5 la reemplaza por la versión con historial).

- [ ] **Step 1: Crear `components/cart/FichaAccion.tsx`**

```tsx
"use client";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { lineaDeBebida, lineaDePizza, type FichaItem } from "@/lib/ficha";

interface FichaAccionProps {
  item: FichaItem;
  /** Pizzas: cierra la ficha y abre la mitad y mitad con esta pizza. */
  onHalf?: () => void;
  /** Empanadas: la caja que se está armando (mismo estado que la grilla y la barra de abajo). */
  caja?: { cantidad: number; elegidas: number; tamanio: number; onPick: (delta: number) => void };
}

/**
 * Pie de la ficha de producto. Usa las mismas funciones que la tarjeta
 * (`add`, `incKey`, `decKey`, `onPick`) y el mismo aviso: la ficha no tiene
 * reglas de venta propias.
 */
export function FichaAccion({ item, onHalf, caja }: FichaAccionProps) {
  const { items, add, incKey, decKey } = useCart();
  const toast = useToast();

  if (item.tipo === "empanada" && caja) {
    const llena = caja.elegidas >= caja.tamanio;
    return (
      <div className="ficha-accion">
        <span className="ficha-caja">{item.agotado ? "Agotado" : `${caja.elegidas} de ${caja.tamanio} elegidas`}</span>
        <div className="ficha-step">
          <button type="button" onClick={() => caja.onPick(-1)} disabled={caja.cantidad === 0} aria-label={`Quitar ${item.nombre}`}>−</button>
          <span>{caja.cantidad}</span>
          <button type="button" onClick={() => caja.onPick(1)} disabled={item.agotado || llena} aria-label={`Sumar ${item.nombre}`}>+</button>
        </div>
      </div>
    );
  }

  const tipoCarrito = item.tipo === "bebida" ? "bebida" : "pizza";
  const qty = items.find((i) => i.key === item.id && i.type === tipoCarrito)?.qty || 0;
  const agregar = () => {
    add(item.tipo === "bebida" ? lineaDeBebida(item) : lineaDePizza(item));
    toast(`${item.nombre} agregada`);
  };

  return (
    <div className="ficha-accion">
      {item.agotado ? (
        <button type="button" className="ficha-agregar" disabled>Agotado</button>
      ) : qty > 0 ? (
        <div className="ficha-step">
          <button type="button" onClick={() => decKey(item.id)} aria-label={`Quitar una ${item.nombre}`}>−</button>
          <span>{qty} en el pedido</span>
          <button type="button" onClick={() => incKey(item.id)} aria-label={`Sumar una ${item.nombre}`}>+</button>
        </div>
      ) : (
        <button type="button" className="ficha-agregar" onClick={agregar}>Agregar · {item.precioTexto}</button>
      )}
      {onHalf && (
        <button type="button" className="ficha-half" onClick={onHalf} disabled={item.agotado} title="Mitad y mitad" aria-label="Mitad y mitad">½½</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `PizzaList.tsx` — prop y disparadores**

Agregar a `PizzaListProps`:

```ts
  /** Abre la ficha de producto recorriendo la lista que se está viendo. */
  onVerFicha: (ids: string[], indice: number) => void;
```

y desestructurarla: `export function PizzaList({ pizzas, onHalf, destacadaId, foco, onVerFicha }: PizzaListProps) {`

Después de `addPizza`, agregar:

```tsx
  // La ficha recorre `list`: respeta el filtro y la búsqueda, con la destacada primero.
  const verFicha = (id: string) => onVerFicha(list.map((p) => p.id), list.findIndex((p) => p.id === id));
  const botonFoto = (pizza: Pizza) => (
    <button type="button" className="media-zoom" onClick={() => verFicha(pizza.id)} aria-label={`Ver ${pizza.nombre} en grande`} />
  );
```

Insertar `{botonFoto(pizza)}` inmediatamente después de cada `<PizzaIllus id={pizza.id} name={pizza.nombre} tags={pizza.tags} />` que está dentro de `.p-media`, `.lrow-media`, `.p-feat-media` y `.p-row-media` (son cuatro; `HalfModal` no se toca).

En la fila mobile, reemplazar `<div className="p-row-main">` por:

```tsx
                <div className="p-row-main" onClick={() => verFicha(pizza.id)}>
```

(`.p-row-main` no contiene botones: los de agregar y ½½ están en `.p-row-side`.)

- [ ] **Step 3: `EmpanadasSection.tsx` — prop y disparador**

Agregar a `EmpanadasSectionProps`: `onVerFicha: (ids: string[], indice: number) => void;` y sumarla a la desestructuración de la función.

Dentro del `map`, reemplazar:

```tsx
                  <div className="emp-media">
                    <EmpanadaIllus id={empanada.id} name={empanada.nombre} />
```

por:

```tsx
                  <div className="emp-media">
                    <EmpanadaIllus id={empanada.id} name={empanada.nombre} />
                    <button
                      type="button"
                      className="media-zoom"
                      onClick={() => onVerFicha(empanadas.map((e) => e.id), empanadas.indexOf(empanada))}
                      aria-label={`Ver ${empanada.nombre} en grande`}
                    />
```

- [ ] **Step 4: `Bebidas.tsx` — prop, disparador y toque en el texto (solo mobile)**

Firma:

```tsx
export function Bebidas({ bebidas, onVerFicha }: { bebidas: Bebida[]; onVerFicha: (ids: string[], indice: number) => void }) {
```

Import: `import { esMobile, lineaDeBebida } from "@/lib/ficha";` (reemplaza el import de la Task 2).

Después de `agregar`:

```tsx
  const verFicha = (id: string) => onVerFicha(bebidas.map((b) => b.id), bebidas.findIndex((b) => b.id === id));
```

Reemplazar:

```tsx
                <div className="drink-media">
                  <DrinkIllus id={bebida.id} label={bebida.nombre} name={bebida.nombre} />
```

por:

```tsx
                <div className="drink-media">
                  <DrinkIllus id={bebida.id} label={bebida.nombre} name={bebida.nombre} />
                  <button type="button" className="media-zoom" onClick={() => verFicha(bebida.id)} aria-label={`Ver ${bebida.nombre} en grande`} />
```

y `<div style={{ flex: 1 }}>` por:

```tsx
                {/* Mobile: la miniatura es chica, así que el nombre también abre la ficha. */}
                <div style={{ flex: 1 }} onClick={() => esMobile() && verFicha(bebida.id)}>
```

- [ ] **Step 5: `Shell.tsx` — estado, render y pie**

Imports nuevos:

```ts
import { ProductSheet } from "@/components/ui/ProductSheet";
import { FichaAccion } from "@/components/cart/FichaAccion";
import { fichaDeBebida, fichaDeEmpanada, fichaDePizza, type FichaItem } from "@/lib/ficha";
import { argumento } from "@/lib/marca";
```

Arriba del componente `SiteContent` (junto a `esMobile`):

```ts
/** Lo que muestra la tarjeta de una empanada sin precio unitario. */
const EMPANADA_PESO = argumento("empanadas-peso").cifra ?? "";

type SeccionFicha = "pizzas" | "empanadas" | "bebidas";
```

Dentro de `SiteContent`, después del estado de empanadas (`cajaExpandida`):

```ts
  // Ficha de producto: se guardan ids y no objetos, así la cantidad en el
  // carrito y el estado agotado se leen siempre de `data` y del carrito vivos.
  const [ficha, setFicha] = useState<{ seccion: SeccionFicha; ids: string[]; indice: number } | null>(null);
  const abrirFicha = (seccion: SeccionFicha) => (ids: string[], indice: number) => {
    if (indice < 0) return;
    setFicha({ seccion, ids, indice });
  };
  const cerrarFicha = () => setFicha(null);
  const fichaItems = useMemo<FichaItem[]>(() => {
    if (!ficha) return [];
    if (ficha.seccion === "pizzas") {
      return ficha.ids.flatMap((id) => { const p = data.pizzas.find((x) => x.id === id); return p ? [fichaDePizza(p)] : []; });
    }
    if (ficha.seccion === "empanadas") {
      return ficha.ids.flatMap((id) => { const e = data.empanadas.find((x) => x.id === id); return e ? [fichaDeEmpanada(e, EMPANADA_PESO)] : []; });
    }
    return ficha.ids.flatMap((id) => { const b = data.bebidas.find((x) => x.id === id); return b ? [fichaDeBebida(b)] : []; });
  }, [ficha, data.pizzas, data.empanadas, data.bebidas]);
  const fichaActual = ficha ? fichaItems[ficha.indice] : undefined;
```

(El catálogo llega como props estáticas de la página: un id no desaparece con la ficha abierta. Si pasara, `ProductSheet` recibe un índice sin producto y no renderiza nada.)

Pasar la prop a las secciones:

```tsx
        <PizzaList pizzas={data.pizzas} onHalf={openHalf} destacadaId={destacadaId} foco={focoPizza} onVerFicha={abrirFicha("pizzas")} />
```

```tsx
          priceFor={empPriceFor}
          onVerFicha={abrirFicha("empanadas")}
        />
        <Bebidas bebidas={data.bebidas} onVerFicha={abrirFicha("bebidas")} />
```

Render, justo antes de `<CartDrawer`:

```tsx
      {ficha && fichaActual && (
        <ProductSheet
          items={fichaItems}
          indice={ficha.indice}
          onIndice={(indice) => setFicha((actual) => (actual ? { ...actual, indice } : actual))}
          onClose={cerrarFicha}
          accion={
            <FichaAccion
              item={fichaActual}
              onHalf={fichaActual.tipo === "pizza" ? () => {
                const pizza = data.pizzas.find((p) => p.id === fichaActual.id);
                cerrarFicha();
                if (pizza) openHalf(pizza);
              } : undefined}
              caja={fichaActual.tipo === "empanada" ? {
                cantidad: empSelection[fichaActual.id] || 0,
                elegidas: empSelected,
                tamanio: empTier,
                onPick: (delta) => empPick(fichaActual.id, delta),
              } : undefined}
            />
          }
        />
      )}
```

Nota: `onIndice` y `onClose` cambian de identidad en cada render de `Shell`; el efecto de teclado de `ProductSheet` se vuelve a suscribir, lo cual es correcto y barato (no hay que memoizarlos).

- [ ] **Step 6: CSS del disparador — agregar dentro de la sección "FICHA DE PRODUCTO", antes de `.ficha-fondo`**

```css
/* Botón invisible sobre cada foto de la carta: abre la ficha. Va encima de la
   imagen y debajo de cartelitos, precio y barra de agotado (z 2–3), que dejan
   pasar el toque. El contenedor de la foto no cambia. */
.media-zoom{
  position:absolute; inset:0; z-index:1; width:100%; height:100%;
  padding:0; border:0; background:none; cursor:zoom-in; -webkit-tap-highlight-color:transparent;
}
.media-zoom:focus-visible{ outline:3px solid var(--gold); outline-offset:-3px; }
/* Lupa: aparece al pasar el mouse (solo dispositivos con hover). */
.media-zoom::after{
  content:""; position:absolute; top:10px; right:10px; width:32px; height:32px; border-radius:999px;
  background:rgba(24,22,20,.72) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f6f1e7' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='6.5'/%3E%3Cpath d='m20 20-4.2-4.2M11 8.5v5M8.5 11h5'/%3E%3C/svg%3E") center/16px no-repeat;
  opacity:0; transform:scale(.9); transition:opacity .18s ease, transform .18s ease; pointer-events:none;
}
@media (hover:hover){
  .media-zoom:hover::after{ opacity:1; transform:scale(1); }
}
.media-zoom:focus-visible::after{ opacity:1; transform:scale(1); }
/* El precio sobre la foto deja pasar el toque al botón. */
.p-price{ pointer-events:none; }
```

Y dentro del bloque `@media (max-width:760px)` de la sección "FICHA DE PRODUCTO" (el que ya existe de la Task 3), agregar:

```css
  /* Pista en la destacada: la lupa se ve siempre. Las filas no la llevan. */
  .p-feat .media-zoom::after{ opacity:1; transform:none; }
  .p-feat-badge, .p-feat-price{ pointer-events:none; }
```

- [ ] **Step 7: Verificar tipos, lint, tests y build**

Run: `pnpm exec tsc --noEmit` → sin errores.
Run: `pnpm exec eslint components/cart/FichaAccion.tsx components/sections/PizzaList.tsx components/sections/EmpanadasSection.tsx components/sections/Bebidas.tsx components/Shell.tsx` → 0 errores.
Run: `pnpm test` → código 0.
Run: `pnpm build` → sin errores.

- [ ] **Step 8: Humo en el navegador (sin Atrás todavía)**

Levantar el dev server con `preview_start` (`{ name: "impasto-dev" }`) y en el Browser pane:

1. `resize_window` preset `mobile`, recargar. `find` "Ver" → aparecen los botones `Ver <pizza> en grande`.
2. Clic en el botón de la destacada → `read_page`: existe un `dialog` con el nombre de la pizza, su precio, la descripción completa, el botón `Agregar · $…` y `½½`.
3. Clic en `Agregar · …` → el pie pasa a `− 1 en el pedido +`; cerrar con `Cerrar`; la fila de esa pizza muestra `− 1 +`.
4. Abrir una fila tocando el nombre (`.p-row-main`) → abre la ficha de esa pizza con el contador correcto (`n / total`).
5. `left_click_drag` horizontal de derecha a izquierda sobre la foto (más de un cuarto del ancho) → el nombre del diálogo cambia al de la pizza siguiente; en la última, el nombre no cambia.
6. `left_click_drag` hacia abajo 200 px sobre la foto → el diálogo desaparece.
7. Empanadas: abrir desde la foto, `+` dos veces → el pie dice `2 de 12 elegidas` (o el tamaño elegido) y la tarjeta muestra `2`.
8. `resize_window` preset `desktop`: clic en una foto de la grilla → ventana centrada; `ArrowRight` pasa de producto; `Escape` cierra.
9. `read_console_messages` con `onlyErrors: true` → sin errores nuevos.
10. Limpiar: vaciar el carrito desde la hoja del carrito y ejecutar en la página `await fetch('/api/cart/draft', { method: 'DELETE' })`, después `await (await fetch('/api/cart/draft')).json()` sin borrador.

Si algún paso falla, arreglarlo antes de commitear (este commit puede terminar en producción).

- [ ] **Step 9: Commit**

```bash
git add components/cart/FichaAccion.tsx components/sections/PizzaList.tsx components/sections/EmpanadasSection.tsx components/sections/Bebidas.tsx components/Shell.tsx app/impasto.css
git commit -m "feat(ficha): tocar la foto abre la ficha para ver y pedir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Atrás cierra la ficha

**Files:**
- Modify: `components/ui/ProductSheet.tsx` (exportar el hook)
- Modify: `components/Shell.tsx` (usar el hook en lugar de `cerrarFicha` simple)

**Interfaces:**
- Consumes: estado `ficha` y `setFicha` de `Shell` (Task 4).
- Produces: `useCierreConAtras(abierta: boolean, alCerrar: () => void): () => void` exportado desde `components/ui/ProductSheet.tsx`.

- [ ] **Step 1: Agregar el hook al final de `components/ui/ProductSheet.tsx`**

Sumar `useCallback` al import de React: `import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";`

```tsx
/**
 * Atrás del teléfono (o del navegador) cierra la ficha en vez de sacar al
 * cliente del sitio. Abrirla agrega una entrada al historial con la misma URL;
 * pasar de producto no agrega nada, así que un Atrás siempre cierra. Cerrar
 * desde la interfaz consume esa entrada, para no dejar un Atrás "vacío".
 *
 * Se usa en Shell y no dentro de la ficha: en desarrollo React monta dos veces
 * cada componente nuevo, y un pushState en el montaje de la ficha dejaría dos
 * entradas. Shell ya está montado cuando la ficha se abre.
 *
 * Se copia el estado que tenía la entrada (`...history.state`): el router de
 * Next guarda ahí su árbol y lo necesita al volver.
 */
export function useCierreConAtras(abierta: boolean, alCerrar: () => void): () => void {
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => { alCerrarRef.current = alCerrar; });

  useEffect(() => {
    if (!abierta) return;
    window.history.pushState({ ...window.history.state, fichaImpasto: true }, "");
    const alVolver = () => alCerrarRef.current();
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, [abierta]);

  return useCallback(() => {
    const conEntrada = window.history.state?.fichaImpasto === true;
    // Primero se cierra (y se quita el listener); después se consume la entrada.
    // El popstate de este back() ya no encuentra a quién cerrar.
    alCerrarRef.current();
    if (conEntrada) window.history.back();
  }, []);
}
```

- [ ] **Step 2: Usarlo en `Shell.tsx`**

Import: `import { ProductSheet, useCierreConAtras } from "@/components/ui/ProductSheet";`

Reemplazar:

```ts
  const cerrarFicha = () => setFicha(null);
```

por:

```ts
  const cerrarFicha = useCierreConAtras(ficha !== null, () => setFicha(null));
```

(Todo lo demás —`onClose={cerrarFicha}` y el ½½ que llama a `cerrarFicha()` antes de `openHalf`— queda igual.)

- [ ] **Step 3: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit` → sin errores.
Run: `pnpm exec eslint components/ui/ProductSheet.tsx components/Shell.tsx` → 0 errores.

- [ ] **Step 4: Probar Atrás en el navegador (riesgo de la spec: el router de Next)**

En el Browser pane, preset `mobile`, con el dev server:

1. Bajar hasta la mitad de la carta. En consola: `window.__y = scrollY; history.length`.
2. Abrir una ficha desde una fila. `history.length` subió en 1.
3. `navigate` con `url: "back"` → el diálogo desapareció; `location.pathname` es `/`; `Math.abs(scrollY - window.__y) < 5`; no hubo recarga (una variable puesta antes, p. ej. `window.__marca = 1`, sigue existiendo).
4. Abrir una ficha, deslizar a la siguiente dos veces, `navigate` back → cierra de una (no vuelve a la anterior).
5. Abrir una ficha y cerrar con ✕ → `history.state?.fichaImpasto` no es `true` (la entrada de la ficha se consumió: el próximo Atrás hace lo mismo que hacía antes de abrirla).
6. Abrir una ficha de pizza y tocar ½½ → se abre la mitad y mitad con esa pizza de un lado, y la ficha no está.
7. Con un producto en el carrito, repetir el paso 3 → el carrito conserva el producto.
8. Preset `desktop`: abrir, `navigate` back → cierra; `Escape` → cierra y consume la entrada.
9. Limpiar el carrito (vaciar + `DELETE /api/cart/draft`, confirmar con `GET`).

Si el router de Next navega, recarga o mueve el scroll en el paso 3: diagnosticar con superpowers:systematic-debugging antes de cambiar nada (mirar qué hay en `history.state` antes y después del `pushState`).

- [ ] **Step 5: Tests y build**

Run: `pnpm test` → código 0.
Run: `pnpm build` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/ui/ProductSheet.tsx components/Shell.tsx
git commit -m "feat(ficha): el botón Atrás cierra la ficha en vez de salir del sitio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verificación final, escritorio intacto y registro

**Files:**
- Modify: `CLAUDE.md` (Historial de funcionalidades terminadas)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: capturas para el dueño, registro en `CLAUDE.md`.

- [ ] **Step 1: Matriz completa en mobile (375 px)**

Browser pane, preset `mobile`, dev server. Si el pane está oculto y las capturas salen en blanco, usar Chrome headless por CDP (ver la memoria `capturas-chrome-headless`: lanzar `chrome.exe --headless=new --remote-debugging-port=9333 --user-data-dir=<scratchpad>/profile` desde bash en segundo plano; al terminar matar solo esos procesos).

Recorrer y capturar:
- Ficha abierta desde la destacada (captura).
- Ficha de una fila, tocando el nombre; deslizar al medio de la lista y en el primer/último elemento (la foto se resiste y vuelve).
- Cerrar: arrastrando, con ✕, tocando el fondo oscuro, con Atrás.
- Agregar, sumar y restar desde la ficha; el aviso "X agregada" aparece arriba y no tapa el pie (captura).
- Producto agotado: si hay alguno agotado en la carta, abrir su ficha (foto con la barra "Agotado" y botón deshabilitado). Si no hay ninguno, **no** marcar uno como agotado para probar (`pnpm dev` usa la base de producción): dejar constancia de que no se probó en vivo; lo cubre `tests/ficha.test.ts`.
- Empanada con la caja llena: el `+` queda deshabilitado.
- Bebida: foto entera sobre blanco (captura).
- Horizontal (812×375 con `resize_window` custom): el botón del pie sigue visible.

- [ ] **Step 2: Escritorio (1280 px)**

Clic en foto de mosaico y de lista, lupa visible al pasar el mouse (captura con `hover`), ventana centrada (captura), flechas en pantalla y del teclado, Esc, clic en el fondo, Atrás.

- [ ] **Step 3: Escritorio sin cambios colaterales**

Se hace en Chrome headless por CDP (la hoja anterior pesa ~100 KB: no se pega a mano en una herramienta). `SCRATCH` = el directorio scratchpad de la sesión; el dev server corriendo en el puerto que informó `preview_start`.

```bash
git show 8d7be50:app/impasto.css > "$SCRATCH/impasto-base.css"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir="$SCRATCH/profile" about:blank &
```

Crear `$SCRATCH/comparar-escritorio.mjs` (Node 24, `WebSocket` nativo):

```js
import fs from "node:fs";

const [, , base, puerto = "3000"] = process.argv;
const cssBase = fs.readFileSync(base, "utf8");
const tabs = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(tabs.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0;
const enviar = (method, params = {}) => new Promise((resolve) => {
  const id = ++n;
  const alMensaje = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === id) { ws.removeEventListener("message", alMensaje); resolve(m.result); }
  };
  ws.addEventListener("message", alMensaje);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluar = async (expression) =>
  (await enviar("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

const FOTO = `(() => [...document.querySelectorAll("body *:not(.media-zoom)")].map((el) => {
  const cs = getComputedStyle(el);
  return el.tagName + "." + (el.getAttribute("class") || "") + "{" + [...cs].map((p) => p + ":" + cs.getPropertyValue(p)).join(";") + "}";
}))()`;

for (const ancho of [1280, 1000, 800]) {
  await enviar("Emulation.setDeviceMetricsOverride", { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
  await enviar("Page.navigate", { url: `http://localhost:${puerto}/` });
  await new Promise((r) => setTimeout(r, 6000));
  const actual = await evaluar(FOTO);
  await evaluar(`(() => {
    for (const s of document.styleSheets) {
      try { if ([...s.cssRules].some((r) => r.cssText.includes(".ficha-fondo"))) s.disabled = true; } catch {}
    }
    const st = document.createElement("style");
    // Sin su hoja, los botones nuevos quedarían en el flujo y moverían a sus vecinos.
    st.textContent = ${JSON.stringify(cssBase + "\n.media-zoom{display:none!important}")};
    document.head.appendChild(st);
  })()`);
  const anterior = await evaluar(FOTO);
  const distintos = actual.flatMap((a, i) => (a === anterior[i] ? [] : [a.slice(0, a.indexOf("{"))]));
  console.log(`${ancho}px: ${actual.length} elementos, ${distintos.length} distintos`);
  for (const d of [...new Set(distintos)]) console.log("   ", d);
}
ws.close();
```

Run: `node "$SCRATCH/comparar-escritorio.mjs" "$SCRATCH/impasto-base.css" <puerto>`

Expected: en cada ancho, los únicos elementos distintos son `SPAN.p-price` (por `pointer-events`). Cualquier otro es una regresión: ver qué propiedad cambió (imprimir el par de strings) y corregir antes de seguir. Repetir la comparación con la hoja del carrito abierta y con el checkout abierto (agregar al script, antes de cada `FOTO`, el clic que los abre). Al terminar, matar solo los `chrome.exe` cuyo `CommandLine` contenga `remote-debugging-port=9333`.

- [ ] **Step 4: Suite completa**

Run: `pnpm test` → código 0.
Run: `pnpm exec tsc --noEmit` → sin errores.
Run: `pnpm exec eslint lib/ficha.ts lib/stock-images.ts tests/ficha.test.ts components/ui/ProductSheet.tsx components/ui/PizzaIllus.tsx components/ui/Illus.tsx components/cart/FichaAccion.tsx components/sections/PizzaList.tsx components/sections/EmpanadasSection.tsx components/sections/Bebidas.tsx components/Shell.tsx` → 0 errores.
Run: `pnpm build` → sin errores.

- [ ] **Step 5: Limpiar el carrito de pruebas**

En la página: vaciar el carrito, `await fetch('/api/cart/draft', { method: 'DELETE' })` y confirmar con `await (await fetch('/api/cart/draft')).json()` que no queda borrador.

- [ ] **Step 6: Registrar en `CLAUDE.md`**

Agregar al final de "Historial de funcionalidades terminadas" (antes de "### Distinción que se presta a confusión") un ítem con: fecha (28/09/2026), qué hace (ficha al tocar la foto; mobile con arrastre, deslizamiento y Atrás; escritorio con ventana y flechas), dónde vive (`lib/ficha.ts`, `components/ui/ProductSheet.tsx`, `components/cart/FichaAccion.tsx`, estado en `Shell`), las decisiones (sin pellizcar porque las fotos miden 1200 px; cartelitos junto al nombre; historial copiando `history.state` de Next; hook en Shell por el doble montaje de desarrollo), la verificación **realmente ejecutada** con sus resultados, los commits, y que **no está pusheado ni probado en producción**. Actualizar también la fecha de "Última actualización".

- [ ] **Step 7: Commit del registro**

```bash
git add CLAUDE.md
git commit -m "docs: registrar la ficha de producto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Mostrar al dueño y pedir el OK para publicar**

Enviar las capturas (mobile y escritorio) con `SendUserFile`. **No pushear sin su confirmación**: el push a `main` despliega a producción. Cuando confirme:

```bash
git fetch
git status --short --untracked-files=no
```

Si `origin/main` avanzó y no hay cambios trackeados sin commitear de la otra sesión: `git rebase origin/main`, volver a correr `pnpm test`, `pnpm exec tsc --noEmit` y `pnpm build`, y recién ahí `git push`. Seguir el deploy (`npx netlify api listSiteDeploys` hasta `ready` con el SHA propio), comprobar en `https://www.impastopizzas.com` que el botón `Ver … en grande` existe y abre la ficha, y actualizar `CLAUDE.md` con el SHA desplegado (commit + push de docs).
