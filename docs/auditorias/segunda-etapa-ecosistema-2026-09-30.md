# Segunda etapa del ecosistema — 30/09/2026

Continuación autorizada de la auditoría y estabilización publicada. Esta entrega cierra guardado atómico de recetas y recuperación de ventas manuales por intento; no declara terminado el plan completo.

## Recetas web y Android

Migración `recetario-napolitano/migrations/20260930210905_recetas-atomicas.sql` aplicada individualmente mediante InsForge CLI. Añade versión, triggers de compatibilidad, registro privado de operaciones y RPC de lectura/guardado. Cabecera y líneas cambian dentro de una transacción; una versión antigua produce 409 sin sobrescribir el editor ajeno. Reintentos idénticos devuelven el resultado original y no crean otra receta.

Web conserva el snapshot pendiente en sessionStorage por usuario; Android en DataStore por usuario y bajo el mutex compartido de cuenta. No hay fallback al borrado/reinserción anterior. Versiones e identificadores de respuesta se validan; el id confirmado se conserva incluso si falla la lectura posterior. Android utiliza el HttpClient del SDK con JsonObject tipado: una prueba HTTP localhost descubrió que rpcRaw(Map<String,Any>) de 0.1.7 falla serializando objetos/JsonNull.

## Ventas manuales

Impasto usa `IM-MAN-UUID`, Carro `POS-UUID`, con el índice único de external_reference ya instalado. Navegadores persisten UUID y payload antes del POST; el servidor busca el pedido antes de cotizar o verificar horarios, y recupera después de una inserción cuya respuesta se perdió o de una colisión. Cambiar cliente, productos, cantidades o medio de pago para la misma clave se rechaza. Sólo una respuesta que confirma la referencia y totales borra el intento del navegador.

El contador POS incluye referencias históricas vacías y nuevas `POS-`. El botón y API de acreditación manual reconocen ambas. La recuperación de Impasto se abre también después de recargar con el local cerrado; la del POS funciona aunque se haya vaciado el carrito. La impresión POS utiliza una clave estable por intento, conservando la deduplicación del agente local.

## Comprobaciones

- Web Recetario: 209 tests y build Astro aprobados, incluyendo 11 pruebas ejecutadas sobre PostgreSQL embebido y 8 del cliente atómico.
- Android: 329 tests; assembleDebug y assembleDebugAndroidTest aprobados. APK instalada en AVD recetario y runner de tres rollbacks Room aprobado. No había teléfono físico conectado por ADB.
- Impasto y Carro: suites completas y builds Next aprobados; casos nuevos de carreras, respuesta perdida, payload incompatible y confirmación de respuesta. El build incluye TypeScript; Carro incluye ESLint con avisos previos.
- Backend instalado: ACL de RPC verificada, roles públicos sin CREATE en public, helper habilita sólo el dueño, lectura RPC probada. Ninguna receta/pedido/pago/cliente real creado o modificado como prueba; ninguna notificación real disparada.
- Primera entrega pública: Impasto y Recetario sirven marcadores compatibles; Carro responde pero no se acreditó el SHA exacto. Push y despliegue se registran separadamente.

## Límites pendientes

1. Clientes antiguos siguen guardando por varias peticiones. Los triggers detectan sus cambios pero no vuelven atómico ese flujo; además pueden producir deadlocks legacy child→parent frente a RPC parent→child. La transacción RPC se revierte, y el intento se conserva. PGlite no demuestra carreras reales multisesión.
2. Venta incierta retiene el intento incluso ante un rechazo posterior de horario/precio. Un reemplazo seguro necesita reserva/cancelación transaccional que impida insertar una petición antigua todavía en vuelo; no se rota automáticamente la clave. UI explica recuperación/verificación. No se deduplican dos compras deliberadas con claves diferentes.
3. Notificaciones y efectos secundarios posteriores al commit aún necesitan outbox y recuperación. Los reintentos recuperados no vuelven a incrementar compras del cliente ni repiten notificaciones; un fallo previo a esos efectos puede dejarlos pendientes.
4. Libro financiero histórico y devoluciones parciales; presupuesto mensual de pricing separado de gastos históricos; suite contractual común/CI, paginación, CRM y accesibilidad; release Android y backups continúan en el plan general.
5. Falta probar guardar/editar desde sesiones reales después de instalar/publicar los clientes. Las pruebas locales y consultas de sólo lectura no acreditan esa operación de negocio en producción.

Los archivos locales ajenos ya identificados siguen fuera de los commits de esta entrega.
