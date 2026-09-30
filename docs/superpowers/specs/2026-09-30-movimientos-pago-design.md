# Movimientos de cobros y devoluciones

Continuación autorizada del plan de auditoría. Objetivo: conservar cobro bruto, devoluciones confirmadas y neto; un parcial no se considera devolución total. Probar con fixtures y proveedores falsos, sin movimientos reales de prueba.

## Diseño elegido

Tabla nueva `pedido_movimientos` append-only, sin columnas nuevas en pedidos (compatibilidad del DTO Android antiguo). Campos: id uuid, pedido_id uuid, proyecto_id text, sucursal_id text, clave text, tipo text cobro/devolucion, monto_centavos bigint positivo, metodo_pago text, ocurrido_en timestamptz nullable, fecha_fuente text registro/proveedor/desconocida, registrado_en timestamptz. Unique(pedido_id,clave). Inmutabilidad y RLS; owner Recetario sólo lee y project_admin invoca RPC de registro. Sin credenciales, borrado en cascada ni backfill automático.

RPC `registrar_movimientos_pago(p_pedido_id uuid,p_mp_order_id text,p_movimientos jsonb)` devuelve JSONB de filas del pedido. Admin sólo, valida pedido online de Impasto, order id confirmado, tipos, claves, montos, total de cobros y devoluciones; misma clave mismo cuerpo recupera, otra versión rechaza y rollback. Fechas desconocidas quedan NULL. Trigger registra cobros manuales declarados por estado aprobado, parcial_mp y pagado_mp; cancelación de cocina no borra dinero. Cambios nuevos se registran en ese momento; saldo anterior documentado se conserva sin inventar fecha cuando se amplía un parcial antiguo.

Proveedor: tomar cobro del total_paid_amount completo y devoluciones únicamente de transactions.refunds procesadas con id/amount. No inferir monto de status_detail. GET fresco después de refund POST: respuesta de refund puede ser incompleta. Claves `mp-cobro:<order-id>` y `mp-devolucion:<refund-id>`; duplicados y datos inconsistentes fallan cerrado. Fechas presentes verificadas se usan; sin evidencia, NULL. No usar created_date de la orden como fecha del cobro/devolución. Estado `parcialmente_reembolsado` distingue devolución parcial; reembolsado total sigue terminal. Consulta GET puede corregir un antiguo reembolsado cuando evidencia de importes prueba parcial, sin volver a cobrar.

La primera solicitud se reserva bajo bloqueo del pedido en `pedido_devolucion_intentos`; se congelan cuerpo e idempotency key histórica `refund-order-amount|total` antes de POST. Una solicitud distinta se rechaza. Sólo pedidos creados tras la migración son elegibles: los anteriores podrían tener un POST incierto con otra clave, por lo que deben revisarse directamente en Mercado Pago antes de iniciar una devolución. Una devolución existente siempre puede conciliarse por GET sin reserva ni POST. No habilitar una segunda intención desde la app. Devoluciones adicionales realizadas externamente pueden sincronizarse por GET. Panel distingue recuperación de una solicitud nueva.

La RPC de movimientos deriva el estado parcial/total dentro de la misma transacción bajo bloqueo del pedido; rechaza snapshots que omiten una devolución previamente guardada. No se aplica un CAS previo del estado para devoluciones. Ambas RPC son SECURITY DEFINER con search_path vacío y EXECUTE exclusivo de project_admin; ni ese rol puede insertar directamente en el ledger. La lectura autenticada está restringida por la función de propietario Recetario. Un cobro manual anterior documentado se conserva íntegro con fecha desconocida incluso si el nuevo estado reduce el saldo declarado a cero; ese cambio no prueba una devolución.

Lectores web/Android: cargar tabla completa paginada y fallar visible ante error. Por pedido con movimientos, suma cobros menos devoluciones prevalece incluso si cancelado; sin movimientos se mantiene interpretación legacy y advertencias. Pedido marcado parcialmente_reembolsado sin importes no inventa neto. No mezclar ambos registros ni multiplicar por precios actuales.

Sección aparte en Ganancias: cobros/devoluciones/neto del mes por ocurrido_en convertido a America/Argentina/Buenos_Aires; fecha_fuente registro se explica como fecha de declaración, proveedor como fecha suministrada; NULL no entra al mes y se muestra globalmente sin fecha. Mes del pedido y costos actuales continúan como estimación distinta. No afirmar cierre de caja ni costos históricos.

Carro mantiene escritura normal: trigger compartido registra cobros manuales POS. Revisar visualización para no tratar parcialmente_reembolsado como pendiente/aprobado pleno.

## Límites

No reconstruir todo el pasado automáticamente. Comisiones reales, costos históricos por venta, segunda devolución desde app y reversos manuales dedicados quedan para siguiente tarea. Pruebas SQL locales no acreditan concurrencia multi-sesión. Cambios necesarios de esquema y push ya autorizados; aplicar sólo archivo revisado tras pruebas.
