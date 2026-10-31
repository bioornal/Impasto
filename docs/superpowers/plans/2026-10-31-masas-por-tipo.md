# Masas de la noche por tipo: plan de implementación

> Se ejecuta en la sesión que lo escribió, en las ramas `masas-por-tipo` de Impasto y Carro Fogón.

**Objetivo:** un cupo por masa (napoletana y al molde), cargado cada noche, que frene la venta en web y POS.

**Arquitectura:** el control vive en `crear_pedido_costeado`. `masas_noche` pasa a una fila por masa. `getBusinessConfig` aplica los números sobre las banderas de masa, así el resto de la web sigue leyendo `estadoMasas` sin cambios.

**Stack:** Next.js, InsForge (Postgres), `node --test`, Zustand en el POS.

## Restricciones globales

- Spec: `docs/superpowers/specs/2026-10-31-masas-por-tipo-design.md`.
- Nada se aplica a la base real sin el ok del dueño para publicar. Las pruebas de SQL corren en un solo bloque que siempre revierte.
- Textos al cliente en voseo, sin emojis.
- Error de la base: `MASAS_AGOTADAS|<quedan>|<masa>`.

## Interfaces compartidas

```ts
// lib/masas-noche.ts (web)
export interface FilaMasas { masa: Masa; cupo: number | null; vendidas: number }
export type QuedanMasas = Record<Masa, number>;
export function quedanMasas(filas?: ReadonlyArray<FilaMasas> | null): QuedanMasas | null;
export function conMasasDeLaNoche<T extends object>(config: T, quedan: QuedanMasas | null): T; // aplica la regla 2
export function aplicarMasas(catalogo: CatalogData, quedan: QuedanMasas | null): CatalogData;
export function pizzasPorMasa(items): Record<Masa, number>;
export function masaParaSumar(items, preferida: Masa, cantidad: number, quedan): Masa | null;
export function topeDePizzas(items, masa: Masa, cantidad: number, quedan): string | null;
export function excesoEnCarrito(items, quedan): string | null;
export function validarMasasNoche(items, catalogo: CatalogData): void;
export class MasasAgotadasError extends Error { quedan: number; masa: Masa }
export function errorDeMasasDeLaBase(error: unknown): MasasAgotadasError | null;
export function avisoMasas(quedan: QuedanMasas | null | undefined, hayEmpanadas?: boolean): string | null;

// src/lib/cupos.ts (POS)
export function quedanMasas(filas?): QuedanMasas | null;
export function aplicarMasas(productos, quedan: QuedanMasas | null);
export function mensajeDeMasas(error: unknown): string | null;
export function leerMasasQuedan(header: unknown): QuedanMasas | null;
```

## Tarea 1: migración

**Archivos:** crear `migrations/<timestamp>_masas-por-tipo.sql`; script de prueba en el scratchpad.

- [ ] Crear el archivo con `npx -y @insforge/cli db migrations new masas-por-tipo`, sin aplicarlo.
- [ ] Escribir tabla, `pedidos.masas_molde`, `masas_molde()`, `masas_mover()` de 5 argumentos, `fijar_masas_restantes()` de 3, `quitar_limite_masas()`, triggers y `crear_pedido_costeado`, partiendo de la versión publicada.
- [ ] Prueba: bloque `DO` que ejecuta la migración, corre los casos del spec y termina siempre con `RAISE EXCEPTION`, con el resultado en el mensaje.
- [ ] Confirmar con una consulta que no quedó rastro y commitear.

## Tarea 2: `lib/masas-noche.ts` y lectura en la web

**Archivos:** `lib/masas-noche.ts`, `tests/masas-noche.test.ts`, `lib/business.ts`, `lib/business-server.ts`, `lib/catalog.ts`, `types/index.ts`, `app/api/store-status/route.ts`, `lib/orders.ts`.

- [ ] Reescribir los tests con las interfaces de arriba: sin fila, una sola cargada, cada tope, cada aviso, error con masa. Ver que fallen.
- [ ] Implementar. Ver que pasen.
- [ ] Aplicar los números en `getBusinessConfig`, exponer `masasNoche` y leer las filas en carta y estado.
- [ ] Correr `pnpm test` y `tsc`, y commitear.

## Tarea 3: carrito de la web

**Archivos:** `components/providers/CartProvider.tsx`, `components/providers/StoreStatusProvider.tsx`, `components/cart/CartDrawer.tsx`, `components/sections/PizzaList.tsx`, `components/ui/AvisoCupo.tsx`.

- [ ] Tope por masa en `add`, `inc`, `incKey` y `setMasa`. La pizza entra en la otra masa si la suya está llena, y el aviso sale después del toast del que llamó.
- [ ] Exceso del carrito por masa y aviso sobre las pizzas.
- [ ] Correr `tsc` y commitear.

## Tarea 4: panel

**Archivos:** `app/api/admin/masas/route.ts`, crear `app/admin/components/MasasNocheProvider.tsx`, `app/admin/components/MasasNoche.tsx`, `app/admin/components/Arranque.tsx`, `app/admin/components/EstadoLocal.tsx`, `app/admin/page.tsx`, `app/admin/admin.css`.

- [ ] API: `GET` con filas, `PUT { masa, quedan }`, `PUT { quedan: null }`.
- [ ] Provider con refresco cada 30 s y un contador por masa.
- [ ] Interruptores con "Manda el número" y píldora con lo que queda.
- [ ] Correr `tsc` y commitear.

## Tarea 5: POS

**Archivos:** `next-app/src/lib/cupos.ts`, `next-app/tests/cupos.test.ts`, `next-app/app/api/productos/route.ts`, `next-app/src/store/useStore.ts`, `next-app/src/components/Cards.tsx`, `next-app/src/components/ProdEnTotal.tsx`.

- [ ] Reescribir los tests de masas y ver que fallen. Implementar.
- [ ] Header `X-Masas-Quedan`, número en el store (de sesión), masa agotada en el selector y pizza nueva en la masa que queda.
- [ ] Correr `npm test` y `npm run build`, y commitear.

## Tarea 6: verificación y documentación

- [ ] En el navegador, con la API simulada: panel en compu y a 375 px, carrito con cada tope.
- [ ] `pnpm test`, `tsc`, eslint de lo tocado, `pnpm build`.
- [ ] Sección nueva en `CLAUDE.md` de los dos repos y memoria actualizada.
- [ ] Pedir el ok del dueño para publicar: migración primero, después web y POS.
