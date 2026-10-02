# Guía de armado para la cocina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `/cocina`, una página sin enlaces ni login que muestra a los cocineros cómo se arma cada pizza.

**Architecture:** Página de servidor estática (`app/cocina/page.tsx`) que lee datos tipados de `lib/guia-cocina.ts`. Sin consultas a la base. Fotos desde `REAL_PRODUCT_PHOTOS` con `next/image`. Un test `tsx` protege la integridad de los datos y que no se filtren costos.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `tsx` para tests, CSS propio con prefijo `ck-`. Gestor: `pnpm`.

**Spec:** `docs/superpowers/specs/2026-10-02-guia-cocina-design.md`

## Global Constraints

- Ruta única `/cocina`, sin login, sin código, sin enlaces desde el sitio.
- `noindex, nofollow` en el layout. No nombrar `/cocina` en `robots.ts` ni en `sitemap.ts`.
- Contenido en el código, sin consultas a la base.
- Solo lo confirmado: nada "a probar", nada de costos, precios ni notas internas.
- Entran 18 pizzas (10 en venta, 8 próximamente). Las 3 nuevas con tomate no entran.
- "Napoletana", no "napolitana"; "ingredientes", no "materia prima".
- No tocar los archivos ajenos sin seguimiento: `.codex/`, `docs/impresion-termica.md`, `migrations/20260922153137_compras-items.sql`, `scripts/`.
- `git add` siempre con rutas explícitas, nunca `-A`.

---

### Task 1: Datos y test

**Files:**
- Create: `lib/guia-cocina.ts`
- Create: `tests/guia-cocina.test.ts`
- Modify: `package.json` (agregar `&& tsx tests/guia-cocina.test.ts` al final del script `test`)

**Interfaces:**
- Produces:
  ```ts
  export type EstadoPizza = "venta" | "proximamente";
  export interface Ingrediente { nombre: string; cantidad: string }
  export interface PizzaGuia {
    nombre: string; productoId: string; estado: EstadoPizza;
    base: string; ingredientes: Ingrediente[];
    despues?: string; nota?: string; preparaciones: string[];
  }
  export interface PreparacionGuia {
    nombre: string; para: string; receta: string; conservacion: string;
    proximamente: boolean;
  }
  export const BASE_DE_TODAS: string[];
  export const PIZZAS: PizzaGuia[];
  export const PREPARACIONES: PreparacionGuia[];
  export function idDePreparacion(nombre: string): string;
  ```

- [ ] **Step 1: Escribir el test que falla** (`tests/guia-cocina.test.ts`), con el mismo estilo `chequear` de `tests/ficha.test.ts`. Comprueba: 18 pizzas, 10 en venta y 8 próximamente; cada pizza con al menos un ingrediente con cantidad; nombres únicos; cada `productoId` en `REAL_PRODUCT_PHOTOS`; cada preparación nombrada existe y cada preparación la usa alguna pizza; y que ningún texto visible contenga `$`, "costo", "precio", "recetario", "a probar" o "decime".
- [ ] **Step 2: Correr y ver que falla** con `pnpm exec tsx tests/guia-cocina.test.ts` (no existe `lib/guia-cocina.ts`).
- [ ] **Step 3: Escribir `lib/guia-cocina.ts`** con los tipos de arriba y los datos de las 18 pizzas y las 15 preparaciones de la sección "Contenido" del spec.
- [ ] **Step 4: Correr el test y ver que pasa.**
- [ ] **Step 5: Commit** `feat(cocina): datos de la guía de armado y su test`.

### Task 2: Página `/cocina`

**Files:**
- Create: `app/cocina/layout.tsx`
- Create: `app/cocina/page.tsx`
- Create: `app/cocina/cocina.css`

**Interfaces:**
- Consumes: `PIZZAS`, `PREPARACIONES`, `BASE_DE_TODAS`, `idDePreparacion` de `lib/guia-cocina.ts`; `REAL_PRODUCT_PHOTOS` de `lib/stock-images.ts`.

- [ ] **Step 1: Layout.** `metadata = { title: "Armado de pizzas", robots: { index: false, follow: false } }`, importa `./cocina.css` y devuelve `children`.
- [ ] **Step 2: Página.** Componente de servidor con: encabezado y base de todas; atajos `#venta`, `#proximamente`, `#preparaciones`; tarjetas de pizza con `next/image` (4:3, `sizes`), base, ingredientes, después del horno, nota y enlaces a sus preparaciones; sección de preparaciones con ancla `prep-<id>`.
- [ ] **Step 3: Estilos** `ck-` con carbón y dorado, tipografía grande para tablet, una columna en celular y dos o tres en pantalla ancha.
- [ ] **Step 4: Commit** `feat(cocina): página /cocina`.

### Task 3: Verificación, documentación y publicación

**Files:**
- Modify: `CLAUDE.md` (sección "Historial de funcionalidades terminadas", fecha de última actualización)

- [ ] **Step 1:** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/cocina lib/guia-cocina.ts tests/guia-cocina.test.ts` y `pnpm build`.
- [ ] **Step 2:** `pnpm dev` y revisar `/cocina` en el navegador (escritorio y 375 px): fotos, anclas, sin errores en consola. Comprobar que `/cocina` no aparece en `/robots.txt` ni en `/sitemap.xml`.
- [ ] **Step 3:** Actualizar `CLAUDE.md` sin copiar claves ni datos sensibles.
- [ ] **Step 4:** `git fetch`, rebase si hace falta, `pnpm test` otra vez y `git push origin main`.
- [ ] **Step 5:** Verificar en producción `www.impastopizzas.com/cocina` cuando Netlify marque el deploy como listo, y dejar anotado en `CLAUDE.md` que el dueño todavía no la probó.
