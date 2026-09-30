# Movimientos de pagos — plan

> Usar executing-plans y dispatching-parallel-agents para lectores independientes; revisión final antes de publicar. Continuación y push autorizados en la sesión.

**Goal:** bruto, devuelto y neto documentados, sin perder parciales ni inventar fechas.
**Architecture:** ledger append-only + RPC transaccional + snapshot proveedor validado + lectores web/Android equivalentes.
**Tech Stack:** PostgreSQL/InsForge, PGlite, TypeScript/Next/Astro, Kotlin/Compose/JUnit.
**Spec:** ../specs/2026-09-30-movimientos-pago-design.md

## Tareas

- [x] SQL en migrations/*_movimientos-pago.sql y tests/payment-ledger-sql.test.ts: cobro y parcial, repetición, rollback, over-refund, inmutabilidad/RLS, manual parcial+saldo, cancelación conserva cobro. RPC devuelve filas con contrato de spec.
- [x] Impasto lib/payment-ledger.ts y tests: importes en centavos, identidad/moneda, refund procesado con id, parcial no total, respuesta incompleta bloquea; integrar consulta y refund GET posterior, estado/UI seguros.
- [x] Web src/utils/movimientos.ts + tests, ganancias.ts y ganancias.astro: lectura paginada, overlay de neto por pedido y sección mensual separada, unknown dates visible, error no $0.
- [x] Android domain/ganancias/Movimientos.kt + tests, GananciasRepository/ViewModel/Screen: mismo contrato, suma y mes AR, no nuevo campo en DTO de pedidos, fallo visible y mismo neto.
- [x] Carro revisión de pagoOperativo/resumen para estado parcial y trigger manual compatible, sin pruebas reales.
- [x] Revisión independiente; suites/build apropiados; migración exacta; informe; commit/push y SHA remoto.

## Foco de revisión

Refund POST puede devolver sólo cambios: GET fresco necesario. Parcial sin monto no es cero ni total. Refund antiguo sin fecha no se atribuye a hoy. Cancelar cocina no equivale devolver dinero. Legacy sin ledger no se cuenta dos veces. Unknown columnas Android evitarse usando tabla nueva. Fechas de límite mensual con UTC/AR y fallos de carga se prueban.
