# Presupuesto de precios — implementación

> Usar executing-plans; dispatching-parallel-agents para lectores independientes. Continuación y push autorizados.

**Goal:** un gasto real registrado no altera automáticamente el precio de una venta futura.
**Architecture:** fijos activos + variables mensuales previstos, excluyendo historial; mismos fixtures y errores visibles en todos los consumidores.
**Tech Stack:** Next/TypeScript, Astro/Vitest, Kotlin/JUnit.
**Spec:** ../specs/2026-09-30-presupuesto-precios-design.md

## Tareas

- [x] Impasto lib/catalog-source.ts/catalog.ts y tests/pricing-flow.test.ts: RED precio independiente del histórico/fallo de gastos; excluir la consulta y dependencia; validar presupuesto con fuentes actuales; suite/build.
- [x] Carro src/lib/precios-efectivos.ts y tests/pricing-flow.test.mjs: misma prueba funcional de independencia, sin fuente gastos en precios; presupuesto previsto válido y redondeo conservado; suite/build.
- [x] Web páginas Costos/Precios/Marketing/Ganancias y helper/tests: reemplazar gasto histórico en todos los cálculos de precio y planificación por presupuesto previsto. Ganancias sigue descontando gasto real del mes una vez. Errores de presupuesto visibles; UI explica edición de extras como variables; suite/build.
- [x] Android Costos/Precios/Ganancias/Marketing, helper dominio/tests: regla idéntica, sin consultas de gastos en las pantallas de presupuesto. Ganancias conserva gastos del mes para resultado. Costos presenta presupuesto; no DDL/DTOs nuevos; unit tests/build.
- [x] Fixture compartida verificable en TS/Kotlin; revisión independiente, informe de quinta etapa, commit/push exactos y SHA remoto.

## Foco de revisión

No borrar gastos ni convertirlos en una variable automática. No perder las validaciones por error remoto. Un cambio no se limita a la carta si Marketing/Ganancias aún calcula el precio con históricos. Gastos reales no entran dos veces en resultado. Presupuesto cero legítimo no debe bloquear receta sin costo operativo. Precio de venta guardado y cobros históricos no se reescriben.
