# Estabilización del ecosistema — 30 de septiembre de 2026

Seguimiento de la [auditoría](auditoria-ecosistema-2026-09-30.md). Cambios locales sobre los cuatro repositorios; no se aplicaron migraciones ni modificaciones de datos en producción. El cambio web de gramaje publicado por el otro chat está en `c0e4d52`.

## Correcciones implementadas

| Aplicación | Corrección | Límite práctico |
|---|---|---|
| Android | DTO acepta `gramos_por_unidad`; conversión de masa neta y peso por unidad en recetas y costeo; gramaje conservado en Room | La APK instalada necesita actualizarse. Un push web no actualiza el teléfono |
| Android | Tapa automática por empanada en Precios, Ganancias y Marketing | Requiere que la tapa exista y tenga un precio válido en ingredientes |
| Android | Borrado carta → precios → receta con IDs exactos y confirmación de las filas afectadas | La secuencia todavía requiere una transacción backend para atomicidad completa |
| Android | Guardado local y encolado transaccionales; conserva rechazos para revisión; 429 transitorio; propaga cancelaciones | Un rechazo exige revisión y reintento explícito; no se descartan cambios automáticamente |
| Android | Propietario de caché/cola identificado; mutex entre sincronización y cambios de sesión; emisiones conservan su propietario original | Bloquea entrar con otra cuenta si quedan cambios pendientes de la anterior; legado se atribuye a la sesión persistida |
| Impasto y Carro | Gramaje incluido al calcular rendimiento; MR afecta costo, no masa neta | Se mantienen los mismos contratos de costo y redondeo vigentes |
| Impasto | Total aceptado por checkout comprobado antes de crear/cobrar tarjeta; resumen se actualiza ante conflicto | No hay una cotización persistente versionada; clientes antiguos deben recargar |
| Impasto | CRUD administrativo comprueba respuesta antes de cambiar memoria; tarifas cero respetadas | No sustituye la confirmación de filas en todos los endpoints existentes |
| Impasto | Devolución consulta primero el proveedor; diferencia reembolso confirmado de persistencia fallida y permite conciliar | No resuelve devolución parcial sucesiva ni solicitudes simultáneas |
| Carro | Conserva cobro parcial al cambiar preparación; rechazo y reembolso siguen terminales | No reconstruye un historial de eventos de cobro |
| Carro | Fecha operativa completa con corte a las 06:00 de Argentina; delivery calculado en servidor con subtotal definitivo | Las reglas comerciales actuales de envío se conservan |
| Carro | Reintenta numeración sólo ante conflicto único demostrado; informa comandas desactualizadas tras fallo de recarga | No hay idempotencia completa del intento de venta |
| Ganancias web y Android | Usa importes guardados y cobros documentados; excluye estados terminales; separa gastos del mes y costo operativo; ajustes manuales fuera del resultado | Resultado estimado con costos y comisión actuales, atribuido al mes del pedido |
| Recetario web | Guardados de márgenes, ingredientes y costos exigen confirmación de filas; valida números; calculadoras vacías preservan defaults; propagación conserva excepciones cero | La propagación puede ser parcial y lo informa; todavía no es transaccional |
| Recetario web | Marketing verifica acceso mediante RLS antes de usar la API paga; valida productos y propuesta; exige margen objetivo al combo | Costos recibidos del navegador autorizado; no hubo una llamada paga de verificación |
| Recetario web | Permite zoom en pantallas móviles | No reemplaza una auditoría visual y de accesibilidad completa |
| Ganancias y Marketing web | Lecturas fallidas no se convierten en costos cero: resultado no disponible o generación bloqueada | Un catálogo incompleto pero leído correctamente sigue requiriendo revisión de datos |

## Validación de esta ronda

- Impasto: suite completa de 31 archivos de pruebas y compilación Next.js correctas.
- Carro: suite completa de 16 scripts de pruebas y compilación Next.js correctas. Permanecen tres advertencias preexistentes de imágenes y dependencias de un efecto.
- Android: **322 pruebas, cero fallos/errores/omitidas**. `testDebugUnitTest assembleDebug assembleDebugAndroidTest` terminó correctamente. APK principal y APK instrumental generadas. Dos pruebas confirman la decodificación estricta del DTO, incluyendo datos antiguos sin gramaje.
- La revisión independiente de los cambios iniciales no identificó bloqueadores nuevos. Es una revisión estática, no una prueba de producción.
- Recetario web: **190 pruebas y compilación Astro correctas**, incluidas las lecturas críticas. Incluye pruebas de vistas de recetas procedentes de otro trabajo; esos archivos se conservaron.

`git diff --check` terminó sin errores en los cuatro repositorios. Hay advertencias preexistentes de compilación relacionadas con herramientas Android, aserciones `!!`, SDK web y Browserslist.

Las regresiones de gramaje, cobros/fechas, cantidades inválidas, reintentos y propietario de emisiones se reprodujeron con pruebas fallidas antes de corregirlas. Esto comprueba esos escenarios concretos; no representa una prueba integral de todos los sistemas en producción.

## Próximos cambios estructurales

1. **Guardar recetas de forma atómica.** Una operación autenticada debe validar cabecera y líneas, comprobar versión y guardar todo en una transacción. Una interrupción debe conservar íntegra la versión anterior. No activar clientes que dependan de esa operación antes de desplegarla y probar sus permisos.
2. **Identificar cada intento de venta.** Clave durable generada antes del POST, restricción única y recuperación del mismo pedido tras timeout. El reintento no puede insertar una venta distinta ni reservar otro número. Incluye efectivo y transferencia en ambos canales.
3. **Recuperar pagos y avisos.** Fases técnicas, lease y conciliación durable; no reenviar automáticamente un resultado incierto. Diseño detallado en `Impasto/docs/estabilizacion-pagos-pendientes.md`.
4. **Registrar eventos financieros e históricos.** Cobro, devolución y costo/precio de venta inmutables, con fecha efectiva. El estado de preparación no determina el saldo. Devoluciones parciales necesitan monto acumulado, saldo remanente e identidad de operación.
5. **Separar el presupuesto de precios del historial de gastos.** Esta ronda corrige la doble imputación en resultados. El presupuesto usado para fijar precios conserva la fórmula vigente en los cuatro consumidores; cambiarla exige una regla comercial compartida y fixtures de paridad.

## Comprobaciones pendientes de entorno

No se realizaron pagos ni reembolsos reales, impresiones físicas ni instalación en un teléfono. No había un dispositivo ADB conectado. Las tres comprobaciones instrumentales de rollback Room están escritas y compiladas, **no ejecutadas**; también falta verificar las migraciones de Room sobre una instalación real previa. La revisión de políticas RLS fue de lectura; el diagnóstico SQL completo y el advisor quedaron sin verificar por restricciones de acceso del entorno.

APK de esta ronda: `recetario-android/app/build/outputs/apk/debug/app-debug.apk` (compilación debug). No es una publicación release firmada.

Para publicar estos cambios, revisar diffs, separar archivos ajenos preexistentes, actualizar los despliegues web y distribuir una APK nueva. No se hicieron commits ni pushes de esta ronda.
