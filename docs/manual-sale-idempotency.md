# Intentos de venta manual

El navegador guarda `impasto_manual_attempt` en localStorage antes del POST: UUIDv4 secreto y snapshot del pedido. La API exige `attemptKey`, rechaza clientes anteriores con 409 y persiste `IM-MAN-UUID` como `external_reference`. Se apoya en el índice único existente `pedidos_external_reference_uidx` (para referencias no vacías); no requiere migración.

Antes de consultar precios u horarios, el servidor busca esa referencia dentro de `proyecto_id=impasto`. La posesión del UUID permite recuperar sólo ese intento; además se comparan cliente, dirección, modalidad, pago, notas, referencia del domicilio, cambio, momento y composición de los ítems. Los precios del navegador no forman parte de la identidad. Las claves de mitades y cajas se normalizan igual que la cotización. Una incompatibilidad devuelve 409 sin datos del pedido encontrado.

Un reintento devuelve ítems, subtotal, envío, total y cuenta de transferencia persistidos. Un error del INSERT (incluyendo 23505 o respuesta perdida después del commit) dispara una lectura por la misma referencia. No dispara otro INSERT. El CRM, el evento inicial y las notificaciones se ejecutan sólo en el camino nuevo. Estos efectos no son transaccionales: un corte después del commit puede omitirlos; esta etapa evita duplicarlos, pero no agrega una outbox de entrega garantizada.

La referencia sólo se borra cuando el navegador recibió éxito confirmado. Ante errores, recargas y cambios del formulario se conserva el snapshot original. La UI avisa que reintentar recupera el original. El botón de recuperación funciona aunque la cotización actual falle. El seguimiento acepta el nuevo formato secreto; el flujo de tarjeta conserva sus referencias y su guardia `expectedTotal`.

## Límite operativo y trabajo posterior

También se conserva el intento tras un rechazo de precio u horario. Ese intento podrá reintentarse cuando su condición permita completarlo, pero no puede reemplazarse automáticamente por otro carrito. Un rechazo local no prueba que una solicitud concurrente del mismo intento no esté por commitear. Para cancelar/reemplazar con seguridad hace falta una reserva transaccional de intentos con estados de cancelación y reconciliación, más una UX explícita para verificar el intento y habilitar su reemplazo. Hasta entonces la UI pide contactar al local si el original no puede completarse. No borrar localStorage como mecanismo de reintento.

Las pruebas locales modelan commits perdidos y competencia por el índice; no enviaron pedidos, pagos ni avisos reales al backend. `npm test` incluye las pruebas del coordinador, persistencia de navegador e identidad de los datos.
