# Recuperación de pagos

Continuación autorizada del plan del ecosistema. Recuperar un intento significa consultar Mercado Pago, nunca volver a crear/cobrar una orden. Proveedores simulados para pruebas; no cobros, devoluciones ni mensajes reales de prueba.

## Contrato

Pedido de tarjeta pendiente: GET por mp_order_id si existe; si no, GET /v1/orders con referencia externa exacta y ventana de creación del pedido. Búsqueda vacía conserva pendiente, varias coincidencias o paginación incompleta requieren revisión y no eligen arbitrariamente. La orden recuperada debe tener id, referencia y total exactamente coincidentes; moneda ARS o país AR cuando la respuesta no incluye moneda. Para aprobación se valida el cobro completo total_paid_amount. Sin fecha válida para buscar se falla cerrado.

Persistir con comparación del estado y de identificadores anteriores para que una consulta atrasada no pise otra actualización. Aprobado nunca retrocede a pendiente/rechazado; reembolsado nunca vuelve a aprobado. Rechazado puede pasar a aprobado si la consulta actual lo acredita. Persistir identificadores incluso si el estado sigue pendiente. En una carrera se recarga y devuelve el estado confirmado; no se vuelve a cobrar.

Usar en el reintento del checkout sólo después de comprobar identidad del intento, en webhook validado consultando recurso proveedor y desde POST administrativo autenticado por id. El panel ofrece Consultar Mercado Pago para tarjeta online pendiente. Ausencia en el proveedor no prueba que nunca se cobró y no habilita otro cobro.

Avisos se gestionan por la cola de la segunda especificación; un webhook con estado sin cambios debe poder recuperar avisos elegibles. Devoluciones parciales y contabilidad histórica quedan en su etapa posterior, sin cambiar aquí mapOrderStatus de parciales.

Fuentes: https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/search-orders/get y https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/get-order/get.
