# Cuarta etapa — cobros y devoluciones

## Resultado

Impasto registra bruto, devolución y neto en un historial inmutable compartido. La devolución parcial conserva su importe real y su estado propio; GET posterior verifica los importes del proveedor y una conciliación puede reparar un registro local incompleto sin volver a cobrar o devolver.

Cada primera devolución nueva reserva su cuerpo y clave antes de POST. Las claves históricas se conservan. Solicitudes concurrentes de distinto importe se rechazan; una devolución ya confirmada se recupera por consulta. Los pedidos anteriores a la migración requieren revisión directa en Mercado Pago para iniciar una devolución, porque una consulta sin devolución visible no descarta un intento antiguo incierto. El panel puede conciliar sus devoluciones existentes.

Recetario web y Android usan el neto documentado por pedido, muestran movimientos mensuales en hora argentina y separan importes sin fecha conocida. Cancelar la preparación o cambiar el estado no borra dinero recibido. La estimación de producción conserva las unidades cuando hubo un cobro original, aunque después se devolviera. Comisiones y costos siguen siendo estimaciones a valores actuales.

Carro muestra neto y devoluciones sin inventar deuda por una devolución parcial. La consulta financiera pagina tanto pedidos como movimientos hasta agotar las filas y muestra error si no puede obtener todos los datos. Sus totales continúan agrupados por fecha del pedido, con esa distinción visible.

## Backend

Aplicada únicamente `20260930222815_movimientos-pago.sql` al backend compartido, el 30/09/2026 a las 23:31 UTC. Añade tablas y triggers; no modifica columnas de pedidos ni reconstruye datos históricos. Los cobros manuales nuevos son declaraciones de recepción, no acreditación bancaria. Las fechas de Mercado Pago quedan desconocidas mientras no exista evidencia documentada de la fecha efectiva.

Catálogo verificado después de aplicar: propietario postgres, RLS activo en ambas tablas; anon sin lectura; authenticated sólo puede leer movimientos con la política `es_usuario_recetario()`; tabla de intenciones sin acceso directo; project_admin sin INSERT directo. RPC de registro/reserva sólo ejecutables por project_admin, SECURITY DEFINER y search_path vacío. InsForge añade su política administrativa, pero no vuelve a conceder INSERT directo. No se hicieron pedidos, cobros, devoluciones ni envíos de prueba en producción.

## Validación

- Impasto: suite completa y build Next correctos; 11 pruebas del ledger de proveedor y 11 pruebas SQL PGlite. Pruebas de reserva, respuesta perdida, devolución parcial, conflicto, exceso, lectura incompleta, permisos, conservación de cobros antiguos y convivencia con el trigger de avisos.
- Recetario web: 216 pruebas en 14 archivos y build Astro/Netlify correctos.
- Android: 335 pruebas unitarias y assembleDebug correctos; APK generado. Esta etapa no instaló el APK en un dispositivo ni validó una sesión real.
- Carro: suite completa, comprobación de tipos y build Next correctos; cuatro pruebas nuevas de devolución parcial y paginación financiera.
- Revisión independiente: corregidos pérdida del cobro antiguo al reducir el saldo, INSERT administrativo sin validación y bloqueo de cambios de cocina con un parcial antiguo de precisión inválida. Revisados bloqueo de reserva, formato de claves históricas y RPC exclusiva.

Las pruebas SQL son locales y no acreditan concurrencia real entre sesiones del servidor. Los builds conservan avisos anteriores de imágenes/hooks en Carro y compatibilidad/browser data en Astro.

## Pendientes del plan

Costos y comisiones históricos por venta; liquidaciones y fechas bancarias verificadas; segunda intención de devolución y reversos manuales con su propio flujo; separación temporal de gastos en Ganancias; CI compartida y pruebas de integración con cuentas sandbox; revisión de despliegues efectivos y distribución Android. Las fases anteriores de seguridad, gramajes, escritura atómica de recetas, ventas idempotentes y cola de avisos permanecen documentadas en los informes previos.

Contrato de proveedor consultado: [GET Orders](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/get-order/get) y [Refund Orders](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/refund-order/post). Ninguna consulta HTTP real de pagos fue necesaria para las pruebas.
