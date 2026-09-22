# A09 Safe Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que Impasto o Carro Fogón publiquen o guarden pedidos con precios reducidos por datos de costos faltantes o inválidos.

**Architecture:** Validar resultados de las consultas críticas antes de calcular; distinguir fallo general de fuente de defecto de una receta. Una función pura resolverá el precio vendible de cada producto y ambos servidores la usarán tanto al mostrar como al confirmar pedidos. No habrá caché de precios ni cambio de esquema.

**Tech Stack:** Next.js 16 + TypeScript + InsForge SDK en Impasto; Next.js 15 + TypeScript + InsForge SDK en Carro Fogón; pruebas `tsx` y Node.

**Spec:** `docs/superpowers/specs/2026-09-22-precios-fail-closed-design.md`

## Global Constraints

- Repositorios: este plan vive en `C:/Users/spezi/Documents/PROYECTOS/Impasto`; el POS vive en `C:/Users/spezi/Documents/PROYECTOS/carroFogon`.
- No modificar fórmulas ni datos del recetario, base de producción, cobros, medios de pago o redondeo hacia arriba en múltiplos de $500.
- `productos`, `recetas`, `receta_ingredientes`, `ingredientes`, `precios_venta`, `config_negocio`, `costos_fijos`, `costos_variables` y `gastos` son fuentes críticas. `promociones`, `testimonios` y `etiquetas` no lo son.
- Error de fuente crítica: bloquear toda cotización y alta de pedido. Error lógico de un producto: bloquear solo ese producto, incluidos mitad y mitad y cajas con ese sabor.
- Un producto sin regla calculada usa `productos.precio` solo si es finito y positivo. Un producto con regla rota nunca cae a ese campo. No modificar `productos.disponible` en base.
- Probar fallas simuladas sin insertar pedidos ni cobrar en producción. Preservar `.codex/`, `migrations/20260922153137_compras-items.sql` y `add_productos_carrofogon.sql`, que son archivos ajenos no rastreados.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `Impasto/lib/pricing-safety.ts` y `carroFogon/next-app/src/lib/pricing-safety.ts` | Mismo contrato puro: resultados de lectura, reglas/ingredientes válidos y precio vendible. Copias verificadas con un caso de paridad; no introducir un paquete externo para dos aplicaciones. |
| `Impasto/lib/catalog-source.ts`, `lib/catalog.ts` | Componer y probar resultados de consultas sin red; distinguir fuentes críticas/decorativas y excluir productos con precio inválido. |
| `Impasto/lib/order-quote.ts` | Revalidar carrito y rechazar cualquier ítem sin precio vendible. |
| `Impasto/app/api/orders/{quote,route.ts}` y `app/api/payments/card/route.ts` | Respuesta HTTP 503 y mensaje seguro ante fuente crítica; no crear pedido ni contactar MP. |
| `Impasto/types/index.ts`, `components/Shell.tsx` | Indicación de productos temporalmente omitidos sin rotularlos como agotados. |
| `carroFogon/next-app/src/lib/precios-efectivos.ts` | Lecturas críticas verificadas y resolución validada. |
| `carroFogon/next-app/app/api/productos/route.ts` | Devolver solo productos vendibles; 503 si fallan fuentes críticas. |
| `carroFogon/next-app/app/api/pedidos/route.ts` | Revalidar con la misma función antes de insertar; 503/409 para falla de fuente/producto, sin confiar en el precio del cliente. |
| `carroFogon/next-app/src/components/Cards.tsx`, `FormCliente.tsx` | Mostrar causa y permitir reintento; conservar el carrito si el pedido no se guardó. |

## Review Focus

1. Respuesta de InsForge `{data:null,error:null}`: tratarla como lectura fallida, no como lista vacía (Tasks 1, 2, 3).
2. Dos reglas de `precios_venta` con el mismo nombre: no escoger arbitrariamente una (Tasks 1, 3).
3. Ingrediente referenciado pero ausente, o cantidad/markup `NaN`, negativa o infinita: no publicar precio parcial (Tasks 1, 3).
4. Carrito cargado antes de una falla o baja lógica: el POST vuelve a validar, no guarda ni cobra (Tasks 2, 4).
5. Error solo en promociones/testimonios/etiquetas: el resto de la carta sigue vendible, sin ocultar una caída real de costos (Task 2).

---

### Task 1: Contrato puro de precios seguros en Impasto

**Files:** Create `lib/pricing-safety.ts`, `tests/pricing-safety.test.ts`; modify `package.json` para incluir el test en `pnpm test`.

**Interfaces:** Produce `PricingUnavailableError`, `requirePricingRows<T>(source, result): T[]`, `resolveValidatedPrices(input: { recipes: PricingRecipe[]; recipeIngredients: RecipeIngredient[]; ingredients: PricingIngredient[]; rules: SalePriceRule[]; defaults?: PricingDefaults; totalOperativo: number }): PriceResolution`, `PriceResolution = { calculated: Map<string, number>; invalid: Set<string> }` y `sellablePrice(product, resolution): number | null`. Consume los tipos y `buildEffectivePrices` de `lib/effective-prices.ts`; no altera su redondeo.

- [ ] **Step 1: Escribir primero pruebas fallidas.** Ejemplos que deben estar en `tests/pricing-safety.test.ts`, además de los otros casos de Review Focus:

```ts
import assert from "node:assert/strict";
assert.throws(() => requirePricingRows("ingredientes", { data: null, error: new Error("red") }), PricingUnavailableError);
assert.throws(() => requirePricingRows("ingredientes", { data: null, error: null }), PricingUnavailableError);
assert.equal(sellablePrice({ nombre: "Agua", precio: 2500 }, { calculated: new Map(), invalid: new Set() }), 2500);
assert.equal(sellablePrice({ nombre: "Palmito", precio: 9000 }, { calculated: new Map(), invalid: new Set(["Palmito"]) }), null);
```

- [ ] **Step 2: Ejecutar `pnpm exec tsx tests/pricing-safety.test.ts`; verificar fallo por módulo o símbolos ausentes.**
- [ ] **Step 3: Implementar `requirePricingRows` y la resolución pura.** Un error o `data` no-array lanza `PricingUnavailableError(source)` con mensaje público fijo; el nombre de la fuente queda en `source` para el log. Para cada regla: verificar nombre único, `receta_id`, markup finito y positivo, receta existente, componentes no vacíos, cada ingrediente existente y sus valores numéricos (`cantidad_kg > 0`, `precio_kg >= 0`, `multiplo_rendimiento > 0`). Una regla inválida marca su nombre en `invalid`, aunque `buildEffectivePrices` devuelva algo positivo por costos operativos. Si los costos operativos son positivos, una regla requiere `pizzas_objetivo_mes > 0`; no aceptar que un denominador faltante transforme esos costos en cero. Para reglas completas, aceptar solo resultado finito y positivo.

```ts
export class PricingUnavailableError extends Error {
  constructor(readonly source: string) { super("Los precios no están disponibles. Reintentá en unos minutos."); }
}
export function requirePricingRows<T>(source: string, result: { data?: unknown; error?: unknown }): T[] {
  if (result.error || !Array.isArray(result.data)) throw new PricingUnavailableError(source);
  return result.data as T[];
}
export function sellablePrice(
  product: { nombre?: string; precio?: unknown },
  resolution: { calculated: Map<string, number>; invalid: Set<string> },
): number | null {
  const name = String(product.nombre || "");
  if (resolution.invalid.has(name)) return null;
  const value = resolution.calculated.get(name) ?? Number(product.precio);
  return Number.isFinite(value) && value > 0 ? value : null;
}
```

- [ ] **Step 4: Reejecutar test y `pnpm test`; exigir código 0.** Cubrir receta sin componentes, ingrediente ausente, markup inválido, valor final cero, duplicado y precio manual nulo/0/infinito. Comparar fixture válido existente: pizza y empanada mantienen el mismo precio redondeado a $500.
- [ ] **Step 5: Revisar `git diff --check` y commitear únicamente estos archivos.** Mensaje: `test: fijar contrato de precios vendibles`.

### Task 2: Aplicar el contrato al catálogo y checkout web

**Files:** Create `lib/catalog-source.ts`, `tests/pricing-flow.test.ts`; modify `lib/catalog.ts`, `lib/catalog-build.ts`, `lib/order-quote.ts`, `types/index.ts`, `components/Shell.tsx`, `app/api/orders/quote/route.ts`, `app/api/orders/route.ts`, `app/api/payments/card/route.ts`, `tests/catalog.test.ts`, `package.json`.

**Interfaces:** Consume `requirePricingRows`, `resolveValidatedPrices`, `sellablePrice`, `PricingUnavailableError` de Task 1. Produce `assembleCatalogFromResults(results: CatalogQueryResults): CatalogData` en el módulo puro `lib/catalog-source.ts`, `CatalogData.preciosNoDisponibles?: string[]` (IDs de productos omitidos) y `quoteItemsWithCatalog(rawItems: CartItem[], data: CatalogData): CartItem[]`.

- [ ] **Step 1: Escribir pruebas fallidas de lectura y carrito.** Definir en `lib/catalog-source.ts` el contrato `CatalogQueryResults` con claves `productos`, `promociones`, `testimonios`, `etiquetas`, `recetas`, `receta_ingredientes`, `ingredientes`, `precios_venta`, `config_negocio`, `costos_fijos`, `costos_variables`, `gastos`, cada una `{data?: unknown; error?: unknown}`. `assembleCatalogFromResults` no importa el cliente DB. En `tests/pricing-flow.test.ts` construir un fixture con productos manuales positivos y las ocho listas de costeo vacías salvo `config_negocio` (una fila con `pizzas_objetivo_mes: 800`); inyectar error y respuesta nula por cada fuente crítica. Repetir con fuente decorativa y exigir catálogo vendible. Probar cotización pura con pizza, bebida, mitad y caja que contienen un ID en `preciosNoDisponibles`; todos deben fallar.

```ts
import assert from "node:assert/strict";
const okResults = {
  productos: { data: [{ id: "pizza-1", nombre: "Muzza", categoria: "pizzas", precio: 9000, disponible: true }], error: null },
  promociones: { data: [], error: null }, testimonios: { data: [], error: null }, etiquetas: { data: [], error: null },
  recetas: { data: [], error: null }, receta_ingredientes: { data: [], error: null },
  ingredientes: { data: [], error: null }, precios_venta: { data: [], error: null },
  config_negocio: { data: [{ pizzas_objetivo_mes: 800 }], error: null },
  costos_fijos: { data: [], error: null }, costos_variables: { data: [], error: null }, gastos: { data: [], error: null },
};
const catalogo = assembleCatalogFromResults(okResults);
const failed = { data: null, error: new Error("DB") };
const critical = ["productos", "recetas", "receta_ingredientes", "ingredientes", "precios_venta", "config_negocio", "costos_fijos", "costos_variables", "gastos"] as const;
for (const source of critical) {
  const input = { ...okResults, [source]: failed };
  assert.throws(() => assembleCatalogFromResults(input), PricingUnavailableError);
}
assert.doesNotThrow(() => assembleCatalogFromResults({ ...okResults, promociones: failed }));
const pizzaVieja = [{ key: "pizza-1", cartId: "viejo", type: "pizza", name: "Muzza", price: 9000, qty: 1 }];
assert.throws(() => quoteItemsWithCatalog(pizzaVieja, { ...catalogo, preciosNoDisponibles: ["pizza-1"] }), /precio no disponible/i);
```

- [ ] **Step 2: Ejecutar `pnpm exec tsx tests/pricing-flow.test.ts` y comprobar fallo.**
- [ ] **Step 3: Implementar las lecturas verificadas en `lib/catalog-source.ts` y `lib/catalog.ts`.** Mantener `Promise.all` y `safeQuery`; probar también que una promesa rechazada se normaliza a `{data:null,error}`. `assembleCatalogFromResults` llama `requirePricingRows` para nueve fuentes críticas y `getCatalogData` registra fuente en servidor al capturar el error. Solo las tres decorativas pueden ser `[]` cuando fallan. Resolver precios una vez, excluir los productos con `sellablePrice === null`, y conservar IDs omitidos en `preciosNoDisponibles`. `buildCatalog` recibe solo productos vendibles; sus pruebas existentes no cambian para fixtures válidos.
- [ ] **Step 4: Revalidar el carrito en `lib/order-quote.ts`.** Exportar `quoteItemsWithCatalog(rawItems, data)` como parte pura; antes del cálculo comprobar `preciosNoDisponibles` para cada ID, incluido cada lado de mitad y cada sabor de caja. Comprobar `Number.isFinite(price) && price > 0` en todos los tipos, sin fallback de combo que oculte un sabor inválido.

```ts
const precioValido = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0;
if (data.preciosNoDisponibles?.includes(rawItem.key)) throw new Error("Precio no disponible. Actualizá el carrito e intentá de nuevo.");
if (!precioValido(product.precio)) throw new Error("Precio no disponible. Actualizá el carrito e intentá de nuevo.");
```

- [ ] **Step 5: Hacer visible la omisión y distinguir 503.** Añadir a `CatalogData` el campo opcional; `Shell` muestra un aviso discreto si hay IDs omitidos. Las rutas de cotización, pedido manual y tarjeta devuelven 503 y un texto fijo cuando reciben `PricingUnavailableError`. En tarjeta, la comprobación ocurre dentro de `createPedido`, antes de `createCardOrder`; probar que el proveedor no se invoca cuando la cotización falla. Otros errores de validación siguen con su estado actual.
- [ ] **Step 6: Ejecutar `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint` y `pnpm build`.** Exigir 0 errores; anotar advertencias preexistentes. Revisar prueba de carrito antiguo y de caja con sabor inválido.
- [ ] **Step 7: Revisar diff y commitear únicamente archivos de Task 2.** Mensaje: `fix: bloquear ventas web sin precio seguro`.

### Task 3: Replicar contrato puro en Carro Fogón

**Files:** Create `../carroFogon/next-app/src/lib/pricing-safety.ts`, `../carroFogon/next-app/tests/pricing-safety.test.mjs`; modify `../carroFogon/next-app/package.json`.

**Interfaces:** Mismas cuatro exportaciones y misma semántica que Task 1. Importar `buildEffectivePrices` desde `./effective-prices`; conservar el archivo de fórmula bit a bit igual al de Impasto.

- [ ] **Step 1: Escribir en POS las pruebas fallidas del mismo fixture usado en Task 1.** Cubrir error SDK, respuesta nula, receta vacía, ingrediente ausente, regla duplicada, costo operativo sin denominador, manual positivo, manual cero y redondeo de $500. El test Node importa `../src/lib/pricing-safety.ts` como los tests actuales.

```js
assert.throws(() => requirePricingRows("gastos", { data: null, error: null }), PricingUnavailableError);
assert.equal(sellablePrice({ nombre: "Agua", precio: 2500 }, { calculated: new Map(), invalid: new Set() }), 2500);
assert.equal(sellablePrice({ nombre: "Palmito", precio: 9000 }, { calculated: new Map(), invalid: new Set(["Palmito"]) }), null);
```

- [ ] **Step 2: Ejecutar `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/pricing-safety.test.mjs`; comprobar fallo.**
- [ ] **Step 3: Implementar la copia del contrato de Task 1 con imports relativos y sin modificar la fórmula.** En el POS, importar `./effective-prices.ts` con extensión para que el test nativo de Node resuelva el módulo; `next-app/tsconfig.json` ya permite esa extensión. Actualizar `npm test` para incluir la prueba. Comparar las dos copias de `pricing-safety.ts` con fixture común y `Get-FileHash` de ambos `effective-prices.ts` (hoy comparten SHA256 `297F8DC0A7055EC743E4BDFE4D18FEED2D09060C3FD62C6615501D356A50DC92`).
- [ ] **Step 4: Ejecutar el test nuevo y `npm test`; exigir código 0.**
- [ ] **Step 5: Revisar diff y commitear únicamente archivos de Task 3 en Carro Fogón.** Mensaje: `test: validar precios vendibles en POS`.

### Task 4: Aplicar bloqueo y revalidación en POS

**Files:** Modify `../carroFogon/next-app/src/lib/precios-efectivos.ts`, `../carroFogon/next-app/app/api/productos/route.ts`, `../carroFogon/next-app/app/api/pedidos/route.ts`, `../carroFogon/next-app/src/components/Cards.tsx`, `../carroFogon/next-app/src/components/FormCliente.tsx`; create `../carroFogon/next-app/tests/pricing-flow.test.mjs`; modify `../carroFogon/next-app/package.json`, `../carroFogon/CLAUDE.md`.

**Interfaces:** Consume Task 3. `cargarPreciosEfectivos(client): Promise<PriceResolution>` devolverá `PriceResolution`, no solo `Map`; actualizar ambos callsites. Extraer en `src/lib/precios-efectivos.ts` `productosVendibles<T extends {nombre: string; precio: number}>(productos: T[], resolution: PriceResolution): T[]` para que GET y POST utilicen el mismo filtro y precio. El POST conserva el importe recalculado en servidor.

- [ ] **Step 1: Escribir pruebas fallidas de fuentes y productos.** Con un cliente falso/inyección de resultados simular las nueve fuentes críticas y exigir error/503; simular respuestas nulas y rechazo de promesa. Para `productosVendibles`, probar que omite solo el producto inválido y que el POST rechaza un ítem omitido aunque el navegador envíe precio positivo. Probar producto recientemente archivado o agotado en el POST, sin ampliar A12 a conciliación de cambios de precio.

```js
const visible = productosVendibles([{ nombre: "Agua", precio: 2500 }, { nombre: "Palmito", precio: 9000 }], {
  calculated: new Map(), invalid: new Set(["Palmito"]),
});
assert.deepEqual(visible.map((p) => p.nombre), ["Agua"]);
assert.equal(visible.some((p) => p.nombre === "Palmito"), false);
```

- [ ] **Step 2: Ejecutar el test POS y comprobar fallo.**
- [ ] **Step 3: Sustituir `safeQuery` silencioso por `requirePricingRows` en `cargarPreciosEfectivos`.** Loguear fuente en servidor; usar `resolveValidatedPrices`. Reemplazar los usos de `preciosDeVenta` y de `effectivePrices.get` por `productosVendibles` en `GET /api/productos` y `POST /api/pedidos`; comprobar también `{error,data}` de `productos`, excluir `disponible=false` y `archivado=true`, y responder 503 ante fuente caída. No permitir `[]`/precio del cliente como salida ante error.

```ts
type ProductoDb = { nombre: string; precio: number; disponible?: boolean; archivado?: boolean };
const { data: productsData, error: productsError } = await productsQuery;
const products = requirePricingRows<ProductoDb>("productos", { data: productsData, error: productsError });
const vendibles = productosVendibles(products.filter((p) => p.disponible !== false && p.archivado !== true), resolution);
if (input.productos.some((item) => !vendibles.some((p) => p.nombre === item.nombre))) {
  return NextResponse.json({ error: "Producto sin precio disponible. Actualizá la carta." }, { status: 409 });
}
```

- [ ] **Step 4: Dar feedback al operario.** Si GET omite productos, informar conteo con cabecera `X-Precios-No-Disponibles`; `Cards.tsx` muestra aviso “Algunos productos no están disponibles por precio”. Si POST devuelve 503 o 409, `FormCliente.tsx` muestra el mensaje público del servidor y conserva carrito/datos para reintentar; nunca imprime ni avisa por Telegram antes de un insert confirmado.
- [ ] **Step 5: Ejecutar `npm test` y `npm run build`; exigir código 0.** Verificar que los métodos efectivo, transferencia y MP manual conservan su comportamiento cuando los precios son válidos.
- [ ] **Step 6: Actualizar `../carroFogon/CLAUDE.md` con alcance, pruebas y límites; revisar diff y commitear archivos de Task 4.** Mensaje: `fix: bloquear pedidos POS sin precio seguro`.

### Task 5: Verificación cruzada y documentación de estado

**Files:** Modify `CLAUDE.md`, `docs/auditorias/2026-09-21-ecosistema-produccion.md`; opcionalmente ajustar tests de Tasks 1–4 si una prueba de paridad revela diferencias.

**Interfaces:** No nuevas. Confirmar que ambos proyectos implementan el mismo contrato aprobado.

- [ ] **Step 1: Ejecutar las suites completas y builds en los dos repositorios; comprobar `git diff --check`.** No aceptar pruebas anteriores a la última modificación.
- [ ] **Step 2: Comparar fixtures compartidos:** pizza, empanada y bebida válidas mantienen los mismos precios entre web/POS; error de cada fuente bloquea; producto individual inválido solo desaparece de la venta; carrito antiguo falla en ambos POST. Revisar que ningún test requiera red o cobros reales.
- [ ] **Step 3: Actualizar `CLAUDE.md` y la auditoría A09:** registrar commits, pruebas y advertir que el despliegue/humo en producción todavía no están verificados. Marcar como implementado en código, no como operativo, hasta confirmar ambos SHA y probar el flujo real.
- [ ] **Step 4: Commitear únicamente documentación final en Impasto.** Mensaje: `docs: registrar A09 y pruebas cruzadas`. No pushear ni desplegar sin decisión explícita del dueño; un push a `main` puede activar despliegues automáticos.
