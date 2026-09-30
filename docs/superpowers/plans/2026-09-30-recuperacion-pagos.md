# Recuperación de pagos — implementación

> Usar executing-plans o subagent-driven-development; comprobar cada tarea con pruebas antes de declarar terminada.

**Goal:** resolver pagos pendientes sin un segundo cobro ni sobrescribir estados confirmados.
**Architecture:** consulta GET de Mercado Pago + validación estricta + compare-and-swap en InsForge; adaptadores checkout/webhook/admin comparten contrato.
**Tech Stack:** Next, TypeScript, InsForge SDK, pruebas tsx con proveedores falsos.
**Spec:** ../specs/2026-09-30-recuperacion-pagos-design.md

- [x] Pruebas RED de búsqueda vacía/múltiple, identidad, monto/moneda, estado atrasado y carrera.
- [x] Implementar consulta/contrato puro y persistencia verificada, sin POST al proveedor.
- [x] Integrar checkout existente, webhook y endpoint administrativo con guard de auth.
- [x] Añadir acción de consulta al panel conservando estado si falla.
- [x] Revisar integración de avisos, suites y build; commit/push autorizados; registrar límites.

Root implementa cola de avisos por separado; pago no modifica notifications/email/telegram ni SQL. Integración final secuencial. No compartir archivos con la tarea de cola.

## Evidencia del agente de pagos

- RED: ocho casos del contrato/coordinador fallaron antes de implementación. La elegibilidad del botón también se probó RED. Quitar filtros CAS de identificadores hizo fallar ambas pruebas de concurrencia del adaptador; restaurarlos volvió GREEN. El transporte falló por falta de escape de payment ID antes de la corrección.
- GREEN local: `tests/payment-recovery.test.ts` (9), `tests/payment-recovery-store.test.ts` (3), `tests/payment-provider-transport.test.ts` (1), `tests/payment-card-recovery.test.ts` (2), usando `npx --no-install tsx`.
- `npm test`, `npx --no-install tsc --noEmit`, `npm run build` y `git diff --check`: exit 0. Root añade los cuatro archivos nuevos al script global de pruebas.
- Sin consultas de proveedor reales, cobros, reembolsos, avisos ni writes de producción de prueba; sin SQL, commit o push por este agente.
- Webhook `payment` consulta su recurso firmado fresco y luego Orders por id guardado/búsqueda. No reutiliza `payment.order.id` porque puede ser una merchant order legacy. Search vacío mantiene el estado confirmado y nunca crea una orden nueva.
- La cola verifica elegibilidad de avisos por separado. El código sólo llama `notificarPedido` usando una fila confirmada, incluso en aprobación sin cambio; la carrera CAS recarga la fila antes de esa llamada.
- Pruebas de concurrencia usan proveedor/repositorio falsos: queda a root revisar la migración y la integración real del SDK/cola sin cobros de prueba. El mapping de devolución parcial se extrajo sin cambiar semántica.

## Cierre verificado por root

- Script general incluye los cinco archivos de pagos y los tres de avisos; `pnpm test` y `pnpm build` aprobados tras integrar ambas tareas.
- Revisión corrigió 408/409/423/429 para conservar pendiente; administrador limitado a sucursal actual y referencias web IM-. Dos pruebas adicionales del clasificador completan 17 pruebas de pagos.
- Migración de cola aplicada y permisos inspeccionados. Código publicado: `2f32ebbb54ee3c16dbc925cecc11c06cf13d9782`, remoto main idéntico a HEAD tras push.
- Sin pruebas de cobro ni entrega real. La contabilidad de devoluciones parciales y los avisos POS quedan pendientes en el plan global.
