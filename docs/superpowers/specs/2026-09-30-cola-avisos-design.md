# Cola durable de avisos de Impasto

La tabla notificaciones existente reserva antes de enviar, pero trata cualquier error de inserción como duplicado y no recupera fallidos. Un corte antes de esa reserva pierde el aviso. Se reutiliza la tabla; no se cambian destinatarios ni se realizan envíos reales de prueba.

## Transacción y entrega

Trigger en pedidos crea los avisos email/telegram en la misma transacción que un nuevo pedido web manual o una aprobación online. Sólo proyecto impasto y referencia IM-. La cola POS queda para integrar después con su propio flujo de avisos. El snapshot del pedido queda en payload; no hay envío HTTP desde PostgreSQL.

Cada consumidor reclama una fila con lock y UUID claim. Estado procesando, contador y mensaje congelado; finalizar requiere el mismo claim. Enviado es terminal. Procesamiento vencido pasa a incierto y no se reenvía automáticamente: Telegram e InsForge email no ofrecen prueba universal de entrega única. Fallos definitivos y omitidos requieren reintento explícito; resultado incierto requiere aceptación visible de posible duplicado. Pendientes legacy sin payload también se consideran inciertos. No se dispara una recuperación masiva histórica al desplegar.

Resend usa Idempotency-Key estable con mensaje persistido (garantía del proveedor limitada a 24 h). Cada resultado Telegram conserva recibos por chat; un reintento omite chats cuyo envío ya fue confirmado. Timeout/5xx/respuesta sin recibo se clasifican inciertos; no se declaran enviados. Si no hay configuración, no se envía y se informa omitido. No persistir secretos.

RPC de reclamar/finalizar sólo project_admin, invoker, búsqueda por id y comprobación de pedido impasto; cliente autenticado normal y anon sin acceso. No se envían avisos de pedidos cancelados, pagos rechazados/reembolsados o aprobación inexistente. Encola antes de envío y valida toda confirmación DB.

## Recuperación visible

Panel administrativo con GET de estado y POST de reintento autenticados. Listado acotado de avisos pendientes/fallidos/inciertos; selección por id. GET no envía. POST sólo procesa el id seleccionado y reclama antes del proveedor; dos operadores no envían simultáneamente. No crear cron ni tarea periódica oculta. Los flujos existentes intentan entregar después del commit; si se cortan, el aviso aparece en el panel.

Fuentes: https://resend.com/docs/dashboard/emails/idempotency-keys. Pruebas locales de SQL/rollback, exclusión de consumidores y transportes falsos; cero mensajes reales en pruebas.
