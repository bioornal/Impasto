# Tercera etapa: recuperación de pagos y avisos

Impasto incorpora recuperación del intento existente de Mercado Pago y una cola de avisos persistida en la misma transacción del pedido. Esta etapa no modifica las aplicaciones de Recetario ni Carro Fogón.

## Pagos

- Checkout recupera un intento pendiente después de verificar identidad del carrito. Consulta GET por id guardado o búsqueda por referencia y ventana de creación; nunca crea otro cobro al recuperar.
- Valida identidad, monto total, monto pagado completo y moneda/país. Búsqueda ambigua o incompleta requiere revisión; búsqueda vacía conserva pendiente.
- Cambios con comparación del estado y ambos identificadores anteriores; una carrera recarga el pedido confirmado. Aprobado no retrocede a pendiente/rechazado y reembolsado no vuelve a aprobado.
- Webhook valida firma y recurso, consulta evidencia fresca y recupera avisos aunque el pago ya esté aprobado.
- El panel permite consultar Mercado Pago para pendientes online web, con autorización y filtro de sucursal.
- Errores 408/409/423/429 al crear mantienen el mismo intento pendiente, evitando que una respuesta incierta habilite otro cobro.

## Avisos

- Trigger encola email y Telegram al crear un pedido web manual o aprobar uno online. Un rollback del pedido también revierte los avisos.
- Reserva exclusiva y token para confirmar el resultado. Mensaje y destinatarios congelados; sin credenciales persistidas.
- Un envío confirmado es terminal. Fallidos/omitidos requieren recuperación explícita. Proceso vencido, respuesta perdida, HTTP 5xx o comprobante faltante se muestran como inciertos.
- Telegram conserva comprobantes por chat: reintentar un lote parcial omite destinatarios ya confirmados, incluso si otro intento falla inesperadamente.
- Resend recibe una clave estable por aviso. Su garantía de idempotencia dura 24 horas; no se afirma entrega exactamente una vez fuera de esa ventana. El email nativo y Telegram tampoco ofrecen esa garantía.
- Administración muestra avisos paginados y permite recuperar uno elegido. Reenvíos inciertos requieren confirmar posible duplicado. GET no envía ni cambia estados; los estados vencidos/históricos se presentan como inciertos.
- RPC restringidas a project_admin; endpoints administrativos verifican la sesión antes de consultar datos.

## Verificación

- `pnpm test`: suite completa aprobada e incluye las nuevas regresiones.
- 37 pruebas nuevas: pagos 17, transportes 4, consumidor 5, SQL 11.
- `npx tsc --noEmit` y `pnpm build`: aprobados.
- Revisión independiente detectó y se corrigieron clasificación de errores ambiguos, alcance de sucursal y omisión de nuevos tests en el script general.
- Migración `20260930220253_cola-avisos.sql` aplicada al backend compartido; inspección de catálogo confirma trigger activo y permisos de las tres funciones. RLS existente conservado.
- Proveedores falsos y fixtures PGlite; sin cobros, reembolsos, creación de pedidos de prueba ni avisos reales en producción.

## Límites y próximos pasos

- Sin backfill automático ni cron: evita reenviar históricos. La recuperación elegida queda disponible en el panel; la entrega normal se intenta después del commit.
- Cola de esta etapa sólo para pedidos web `IM-` de Impasto. Avisos POS y Carro Fogón quedan para extender el mismo contrato.
- Pruebas de carrera del repositorio usan adaptadores simulados; PGlite prueba SQL secuencial. Falta validación con conexiones concurrentes reales y un entorno aislado con proveedores de prueba.
- La elegibilidad se comprueba al reservar; un pedido podría cancelarse durante la llamada HTTP ya iniciada. El bloqueo SQL no puede abarcar de forma segura toda esa entrega externa.
- Los primeros nueve casos SQL se ejecutaron después de implementarlos; sólo el ajuste del orden de locks tiene RED SQL registrado. No se declara TDD íntegro para esa migración.
- Un intento pendiente sin orden encontrada no habilita otro pago automáticamente: requiere resolución para evitar cobrar dos veces.
- El tratamiento contable de devoluciones parciales permanece pendiente de la siguiente etapa: libro de movimientos, importes históricos y paridad financiera web/Android.
- Push de código y comprobación de despliegue público son comprobaciones distintas. El build local y el catálogo del backend no acreditan por sí solos la versión del frontend publicada.

## Referencias de proveedores

- [Mercado Pago: buscar órdenes](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/search-orders/get)
- [Mercado Pago: obtener orden](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/get-order/get)
- [Mercado Pago: crear orden y errores de idempotencia](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/create-order/post)
- [Resend: claves de idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys)
