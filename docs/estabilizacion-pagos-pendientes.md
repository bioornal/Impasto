# Estabilización: pendientes que requieren diseño persistente

Las correcciones locales de esta entrega no cambian estados financieros ni aplican migraciones. Estas dos ventanas de fallo siguen abiertas y necesitan trabajo específico antes de habilitar recuperación automática.

## Avisos al local y al cliente

`notificaciones` tiene una restricción única por pedido/tipo/canal, estado, detalle y fecha de creación. La reserva se inserta antes de llamar al proveedor. Un aviso `pendiente` puede significar que todavía no se envió, que el proceso murió o que el proveedor lo envió y se perdió la respuesta. Reenviarlo por antigüedad puede duplicar el aviso.

Diseño propuesto: outbox con `attempt_id`, `lease_until`, `attempt_count`, `next_attempt_at`, última causa y confirmación del proveedor; reclamar una fila mediante operación atómica. No reenviar `enviado`. No tratar todos los errores de INSERT como duplicados: distinguir conflicto único de indisponibilidad. Un worker debe recuperar reservas vencidas y fallos, con backoff y observabilidad.

El lease evita workers concurrentes; no resuelve por sí solo el corte después de enviar y antes de persistir. Email debe usar idempotencia del proveedor si existe. Para Telegram, que no garantiza la misma deduplicación, separar fallo definitivo de resultado incierto y pedir revisión operativa de los inciertos antes de reenviar. Verificar capacidades reales de cada proveedor antes de definir garantías. Probar corte antes/después del envío, reservas simultáneas y fallos al confirmar.

## Tarjeta: pedido creado antes de enviar a Mercado Pago

Un pedido pendiente se inserta antes del POST a MP. El reintento actual devuelve espera sin repetir ese POST; si el proceso muere antes de enviarlo, no habrá webhook. Cambiar todos los pendientes para reenviar tampoco es seguro: pueden corresponder a un pago externo real aún no confirmado.

Diseño propuesto: una fase técnica separada de `estado_pago` (`creado`, `enviando`, `enviado`, `resultado_incierto`), referencia/idempotency key inmutable y lease para reclamar envío. Reconciliar por referencia/recurso antes de reanudar un resultado incierto. No guardar PAN/CVV ni persistir tokens de tarjeta sin revisar su vigencia y política. La recuperación puede necesitar nueva tokenización con la misma referencia idempotente y el mismo monto aceptado; verificar el contrato de MP antes de implementar.

Probar caída antes del POST, timeout después de cobrar, webhook antes de respuesta checkout, doble submit y persistencia fallida después de respuesta MP. La suite local actual no reemplaza estas pruebas de integración.

## Devoluciones parciales

Se conserva el estado financiero existente: `partially_refunded` continúa mapeando a `reembolsado`. La nueva recuperación consulta MP y concilia una devolución previa sin iniciar otra, pero no habilita devoluciones sucesivas ni calcula saldo remanente. Eso requiere monto devuelto/acumulado, saldo y métricas de ventas netas, con una operación identificada por devolución. La respuesta `recovered` indica reconciliación de una devolución existente y no confirma que una solicitud nueva por otro monto haya sido ejecutada.

## Validación del monto aceptado

Checkout manda `expectedTotal` numérico y el servidor lo compara con la cotización que persistirá y cobrará. Si difiere o falta, devuelve 409 antes de crear el pedido y llamar a MP; el cliente cierra tarjeta y actualiza el resumen. Clientes antiguos que no manden el campo deberán actualizar la página. No se congela el precio mediante una cotización versionada: cualquier cambio posterior necesita otra confirmación visual.
