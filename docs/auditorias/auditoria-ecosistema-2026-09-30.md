# Auditoría del ecosistema Impasto / Recetario Napolitano / Carro Fogón / Recetario Android

Fecha: 30 de septiembre de 2026. Evaluación del código disponible en los cuatro repositorios locales, pruebas y compilaciones, y políticas de acceso consultadas en el backend compartido. No se modificó código fuente ni datos de producción.

## Dictamen

El ecosistema tiene una estructura de producto coherente: Recetario define costos y precios; Impasto vende al público; Carro Fogón registra y administra la operación; Android permite gestionar desde el teléfono, con compras y precios offline. Hay trabajo sustancial en protección de precios, permisos, impresión e integración de pagos.

La mayor deuda está en integridad de negocio: los informes financieros no representan de manera estable los cobros históricos; Android ya diverge de la web; algunas operaciones que afectan varios sistemas carecen de recuperación ante interrupciones. Conviene estabilizar esas bases antes de agregar más funcionalidades.

Los hallazgos describen defectos y escenarios demostrables en código. No significan que todos hayan ocurrido en producción. P1 indica riesgo alto para ventas, cobros, costos o datos; P2 indica riesgo relevante de operación, mantenimiento o experiencia.

## Arquitectura observada

| Aplicación | Responsabilidad actual | Fortalezas | Principal deuda |
|---|---|---|---|
| Impasto | Carta, checkout, pagos, seguimiento y administración | Precio calculado en servidor, validación de disponibilidad, protección de tarjeta, seguimiento | Recuperación de pagos/avisos, devoluciones parciales, escrituras que muestran éxito sin persistir |
| Recetario Napolitano | Ingredientes, recetas, costos, precios, masa, ganancias y marketing | Dominio de costeo probado, herramientas de producción, retiro seguro de carta | Contabilidad histórica, escrituras no atómicas, manejo desigual de errores |
| Carro Fogón | POS, comandas, cobros, resumen de caja e impresión | API protegida, validación de precios, separación moderna de pago/preparación | Estados de pago heredados, idempotencia de venta, filtros temporales |
| Recetario Android | Gestión móvil, compras por voz, precios offline, masa y marketing local | Kotlin/Compose, dominio separado, Room/WorkManager, sesión tolerante a cortes | Paridad, propiedad de caché/cola, recuperación offline y release |

Todos comparten el backend InsForge. Impasto y Carro usan credenciales privilegiadas únicamente en el servidor; Recetario web y Android operan con sesión de usuario y políticas RLS. El CRM compartido entre aplicaciones es una decisión explícita, no un defecto de aislamiento.

## Hallazgos prioritarios compartidos

### 1. P1 — Ganancias no debe usarse todavía como cierre financiero definitivo

En web, los gastos de todo el historial entran a `totalOp`, y los gastos del mes se vuelven a restar como extras. Referencias: [carga y costo operativo](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:476), [filtrado mensual](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:551), [ganancia neta](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:845).

Ejemplo aislado: un gasto de septiembre de $10.000 reduce la ganancia de septiembre dos veces; un gasto de agosto sigue entrando al costo operativo de septiembre. Además, el historial de gastos entra en el cálculo del precio de venta de ambos canales: [Impasto](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/catalog.ts:44), [Carro](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/precios-efectivos.ts:31), [Recetario](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/precios.astro:179). Por lo tanto afecta precios, no solamente un informe.

La facturación del resumen se reconstruye con precio calculado actual × unidades, en lugar de usar importes históricos cobrados: [resumen](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:840). Cambiar margen o precio de ingrediente modifica meses anteriores. El recetario muestra el precio al peso, mientras los canales redondean hacia arriba a múltiplos de $500. Descuentos, envío y devoluciones tampoco se concilian mediante esa multiplicación. Las métricas de canales sí suman importes de pedidos: hoy conviven dos definiciones distintas de facturación.

La selección de pedidos excluye cancelados, pero no filtra sistemáticamente pagos pendientes/rechazados/reembolsados: [procesamiento](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:355). No todo pedido registrado es una venta cobrada.

**Mejora:** separar presupuesto de costeo, resultado económico y caja real. Definir gastos mensuales sin doble imputación; conservar costo/precio/cobro/devolución del momento de la venta; conciliar cada canal contra pagos. Mostrar claramente cualquier estimación.

### 2. P1 — Android perdió paridad de empanadas y retiro de carta

Android no incorpora la tapa de empanada que ya incluye la web: [ListaPrecios](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/domain/precios/ListaPrecios.kt:70), [regla web](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/utils/pricing.ts:55). Si la tapa cuesta $100, Android subestima el costo en $100 por empanada; Precios, Ganancias y Marketing heredan la diferencia.

Android borra recetas/precios pero deja `productos` vivos: [borrar receta](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/RecetasRepository.kt:118), [borrar precio](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/RecetasRepository.kt:158). La web agregó el borrado carta→precios→receta: [borrado seguro](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/utils/borrado-carta.ts:83). Un producto puede seguir vendiéndose con su precio de respaldo después de eliminarlo desde Android.

**Mejora:** portar ambas reglas y establecer fixtures compartidas de paridad con los cuatro consumidores, incluyendo precio calculado y precio final cobrado. Los 287 tests Android actuales no detectan estas diferencias entre repositorios.

### 3. P1 — Guardar una receta puede dejarla sin ingredientes

Web y Android actualizan la cabecera, borran todas las líneas y reinsertan en solicitudes distintas: [web](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/recetas.astro:717), [Android](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/RecetasRepository.kt:88). Una caída después del borrado deja una receta incompleta y afecta el costeo de los canales. La web además no comprueba el resultado del borrado antes de continuar.

**Mejora:** guardar cabecera y líneas en una transacción del backend, con versión para detectar ediciones simultáneas. Mantener la versión anterior completa ante cualquier fallo.

### 4. P1/P2 — Las ventas sin tarjeta carecen de idempotencia de extremo a extremo

Impasto efectivo/transferencia genera otro pedido en cada POST: [ruta](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/orders/route.ts:34). En Carro no existe identificador durable del intento de venta: [POST](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:168). El helper de numeración puede reinsertar cuando el primer INSERT fue confirmado pero devolvió un error de respuesta: [numeración](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/numero-pedido.ts:16). Se reprodujo el segundo caso con funciones reales y un backend simulado: quedaron pedidos #1 y #2.

**Mejora:** UUID de intento generado antes de enviar, restricción única y recuperación del pedido ya creado. Reintentar una comanda y reintentar una venta son operaciones distintas; la deduplicación de impresora ya resuelve la primera.

## Impasto: pagos, avisos y administración

### 5. P1 — Intentos de tarjeta sin recuperación antes de contactar Mercado Pago

Se inserta el pedido antes de llamar a MP. Si termina el proceso entre ambos pasos, los reintentos encuentran un pedido pendiente y esperan; no hay operación externa ni webhook que pueda resolverlo. [Ruta tarjeta](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/payments/card/route.ts:163), [decisión de reintento](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/card-attempt.ts:136).

**Mejora:** estado explícito creado/enviado, recuperación con la misma clave idempotente y conciliación por referencia. No reenviar a ciegas pagos de resultado desconocido.

### 6. P1 — Un pedido pagado puede quedarse sin aviso al local

Las notificaciones se reservan antes de enviarse. Una reserva fallida se interpreta como duplicado; una reserva ya existente bloquea futuros envíos aunque Telegram/email haya fallado. El webhook con estado sin cambios retorna antes de recuperar avisos pendientes. [Notificaciones](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/notifications.ts:83), [webhook](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/payments/webhook/route.ts:80).

**Mejora:** cola durable de avisos con pendiente/enviado/fallido, reintentos, último error y alerta operativa. Preservar deduplicación sin convertir el primer fallo en pérdida definitiva.

### 7. P1/P2 — Devoluciones parciales y persistencia incompletas

`partially_refunded` se convierte en `reembolsado`, la devolución siguiente requiere `aprobado` y las métricas dejan de contar toda la venta. [Mapeo](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/mercadopago.ts:149), [devolución](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/[id]/refund/route.ts:36). La ruta ignora el error del UPDATE posterior al reembolso y puede responder éxito aunque el estado local no se haya guardado: [persistencia](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/[id]/refund/route.ts:65).

**Mejora:** registrar montos cobrados, devueltos y saldo; distinguir parcial/total; comprobar exactamente una fila actualizada y reconciliar cuando MP y DB difieran.

### 8. P2 — El importe cobrado puede diferir del mostrado al completar la tarjeta

Checkout obtiene una cotización, pero creación vuelve a calcular con datos actuales sin comparar el total aceptado. Si cambian costos/envío/márgenes durante el ingreso de tarjeta, el servidor puede cobrar otro monto. [Checkout](C:/Users/spezi/Documents/PROYECTOS/Impasto/components/checkout/Checkout.tsx:82), [recotización](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/orders.ts:116).

**Mejora:** cotización versionada con vencimiento o rechazo por cambio de importe seguido de confirmación del nuevo total.

### 9. P2 — Configuración de envío cero y éxito optimista incorrecto

La API admite tarifa/umbral cero, pero la lectura usa `||` y repone el valor por defecto: [configuración](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/business-server.ts:57). El CRUD de productos y testimonios modifica estado y anuncia éxito sin verificar HTTP: [StoreProvider](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/admin/components/StoreProvider.tsx:348). Marcar agotado con una sesión vencida puede dejarlo vendible aunque el panel aparente lo contrario.

**Mejora:** distinguir cero de ausencia; comprobar respuesta y filas; revertir cambios optimistas fallidos.

## Carro Fogón: caja y comandas

### 10. P1 — Cambiar preparación pierde el cobro parcial histórico

El cambio sustituye `status=parcial_mp`, pero Caja solo reconoce el parcial cuando sigue en ese status. [Cambio](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/pedido-pago.ts:53), [caja](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/resumen-caja.ts:35).

Reproducción con funciones reales: total $10.000, MP parcial $4.000 → caja cuenta $4.000; cambiar a preparando → caja cuenta $0 de MP y pendiente $10.000. El monto sigue en la fila, pero deja de interpretarse.

### 11. P1 — Cancelar un legado reembolsado puede contarlo como aprobado

Cuando `status=pagado_mp`, cambiar preparación escribe `estado_pago=aprobado` sin preservar reembolsado/rechazado. [Conversión](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/pedido-pago.ts:54). Reproducción real: pedido reembolsado de $10.000, cancelarlo → vuelve a contar $10.000 cobrados MP.

**Mejora para ambos:** migración explícita de legados hacia campos separados y reglas que nunca inventen un cobro al modificar preparación. Cubrir cada combinación con pruebas de transición y conciliación.

### 12. P2 — Envío, filtros de fecha y datos desactualizados

- El servidor recalcula subtotal, pero acepta envío del carrito viejo. Al cruzar el umbral de envío gratis por un cambio de precio, guarda una tarifa incompatible: [POST](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:101). Calcular regla completa en servidor, con posibilidad explícita de ajuste autorizado si el negocio lo requiere.
- “Hoy” usa últimas 24 horas y luego agrupa por fecha, en lugar de filtrar el día operativo desde 06:00: [GET](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:40), [Totales](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/totales/page.tsx:40). Los extremos de semana/mes también pueden quedar parciales. Usar límites de fecha de negocio.
- Si recarga falla y hay filas previas, Comandas oculta el error: [pantalla](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/pedidos/page.tsx:183). Mostrar última actualización y aviso persistente de datos desactualizados.
- El contrato térmico descarta subtotal/envío/extras aunque el total los incluye: [adaptación](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/pos-print-flow.ts:27). El encoder imprime solo líneas y total: [encoder](C:/Users/spezi/Documents/PROYECTOS/Impasto/printer-agent/ReceiptEncoder.cs:38). Agregar desglose para que el ticket cuadre.

## Android: datos locales, sincronización y distribución

### 13. P1 — Caché y pendientes no pertenecen a una cuenta

Room usa una base global y logout solo limpia sesión. Los workers usan el cliente de la sesión actual: [base local](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/local/BaseLocal.kt:162), [logout](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/AuthRepository.kt:22), [worker](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/ComprasRepository.kt:181).

Una cuenta distinta puede acceder a caché anterior y los pendientes se intentan enviar con otra sesión. El permiso actual limitado al dueño reduce escrituras cruzadas entre cuentas habilitadas, pero no protege datos locales ni evita rechazo/descarte de pendientes.

**Mejora:** propietario de cada caché/cola y worker, cancelación/suspensión al salir, política explícita de conservar pendientes sin exponerlos a otra cuenta.

### 14. P2 — Cambios offline pueden perderse sin explicación

Compras descarta 4xx definitivos y después refresca desde remoto; el usuario no obtiene el cambio rechazado ni su causa. En precios, el worker no comunica rechazos al usuario. [Compras](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/ComprasRepository.kt:115), [precios](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/IngredientesRepository.kt:248).

Guardar localmente y encolar son dos operaciones separadas; terminar el proceso entre ambas deja un cambio sin sincronización. [Mutación compras](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/ComprasRepository.kt:72), [mutación precios](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/data/repos/IngredientesRepository.kt:117).

**Mejora:** transacción Room para cambio+pendiente, cola de rechazados visible con explicación/reintento, pruebas de proceso muerto, cuenta cambiada y conflicto de edición.

### 15. P2 — CI y release no completan el ciclo de calidad

Android tiene 287 tests, pero CI solo ejecuta `assembleDebug`: [workflow](C:/Users/spezi/Documents/PROYECTOS/recetario-android/.github/workflows/build.yml:36). Release sigue con versión 0.1.0 y sin signingConfig: [Gradle](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/build.gradle.kts:24). No hay evidencia de release firmado ni aceptación actual en teléfono.

`allowBackup=true` sin exclusiones requiere definir tratamiento de DataStore/sesión y cola Room al restaurar: [manifest](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/AndroidManifest.xml:19). No se verificó comportamiento real de backup.

## Experiencia, seguridad y mantenimiento

### 16. P2 — Recetario web maneja de forma desigual fallos y cambios sensibles

Guardar márgenes, editar/eliminar ingredientes y guardar costos base ignora algunos resultados de escritura; la pantalla puede quedar distinta de producción: [márgenes](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/precios.astro:462), [ingredientes](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ingredientes.astro:120), [costos](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/costos.astro:504). Conviene unificar confirmación real, rollback y mensaje específico.

Propagar costos sobrescribe prepizza y salsa de todas las recetas seleccionadas, incluso una pizza con salsa cero: [propagación](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/costos.astro:583). Mostrar vista previa por receta y conservar excepciones. La calculadora vacía puede guardar costo base cero sin una confirmación específica; Android sí tiene una protección adicional.

### 17. P2 — Identidad de producto depende del nombre

Receta/precio/carta se enlazan parcialmente por igualdad textual de nombres, mientras Ganancias normaliza tildes y espacios. Cambiar un nombre puede romper precio efectivo y usar precio de respaldo. La UI web ya advierte desalineación, una buena mitigación: [aviso](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/precios.astro:363), [resolución](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/pricing-safety.ts:115).

**Mejora:** FK explícita producto→precio/receta, identificador de canal explícito en pedidos y esquema común para líneas. No usar nombre/email/formato del JSON como identidad estable.

### 18. P2 — Marketing debe verificar matemáticamente la rentabilidad

Web solicita promociones rentables a un modelo, pero devuelve el JSON sin validar esquema ni comprobar precio sugerido contra costo/margen mínimo: [API](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/api/marketing.ts:155). El endpoint comprueba autenticación, no habilitación específica de recetario: [autorización](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/api/marketing.ts:34). Otra cuenta válida del pool puede enviar datos propios y consumir API paga, aunque no pueda leer costos por RLS.

**Mejora:** permitir solo rol autorizado, validar números/esquema, precio mínimo calculado por código y límite por usuario durable. Mantener generación de textos separada del cálculo financiero. Android ya tiene Marketing local; la documentación que dice que falta quedó desactualizada.

### 19. P2 — Accesibilidad y operación móvil

Web impide zoom: [viewport](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/layouts/Layout.astro:15). Android tiene acciones “✕” sin descripción suficiente ni mínimo explícito de objetivo táctil y navegación sin semántica de pestaña seleccionada: [Precios](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/ui/precios/PreciosScreen.kt:313), [Compras](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/ui/compras/ComprasScreen.kt:344), [navegación](C:/Users/spezi/Documents/PROYECTOS/recetario-android/app/src/main/java/ar/elfogon/recetario/ui/RecetarioRoot.kt:195).

**Mejora:** zoom, descripción de acciones, objetivos táctiles mayores, teclado y TalkBack/font scaling reales. Sustituir prompts/alerts del recetario por formularios y estados de guardado cuando se trabaje esa interfaz. No se hizo inspección visual en navegador/teléfono; esta evaluación de UX se basa en implementación.

### 20. P2 — Historial, CRM y observabilidad

Impasto carga todo el historial y repite la consulta cada 15 segundos: [API pedidos](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/route.ts:10), [polling](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/admin/components/StoreProvider.tsx:288). Recetario también carga pedidos históricos y filtra el mes en cliente. Agregar filtros server-side, paginación y actualización incremental; el límite efectivo de filas del backend no se verificó.

Los contadores de compras del CRM usan leer+incrementar+guardar y pierden incrementos concurrentes. Impasto cuenta antes de confirmar pedido/pago: [CRM](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/orders.ts:67), [Carro](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/clientes/route.ts:72). Derivar compras de ventas válidas o incremento atómico tras confirmación.

Agregar tablero operativo de pagos pendientes envejecidos, avisos fallidos, última sincronización y cambios rechazados. Los eventos best-effort no equivalen a historial financiero garantizado.

## Qué está bien logrado y conviene preservar

1. **Roles de producto claros.** Se cubre venta, operación, preparación y gestión móvil con herramientas adaptadas a su función.
2. **Precios del lado del servidor.** Ambos canales resuelven receta/ingredientes/margen/comisión/rendimiento/redondeo; no confían en precio arbitrario del navegador. Las fuentes críticas fallidas bloquean venta en lugar de regalar productos. Los archivos `effective-prices.ts` de Impasto y Carro son idénticos al normalizar saltos de línea.
3. **Carta controlada.** Productos archivados/agotados no vendibles; nuevas recetas entran ocultas; web avisa nombres desalineados y borrado parcial. Hay separación entre lo que se vende y recetas conservadas.
4. **Seguridad sustancial.** Handlers operativos/admin comprueban autorización; Mercado Pago tokeniza tarjeta, verifica firma y consulta recurso remoto; el recetario tiene políticas para usuarios habilitados. En la consulta de políticas vivas, clientes/carritos tienen solo project_admin y las tablas de recetario exigen `es_usuario_recetario()`.
5. **Impresión muy cuidada.** Solo loopback, origen permitido, token, cuerpo limitado, control de caracteres ESC/POS, registro durable sin texto de clientes, mismo intento para reintento, marca de reimpresión, selección independiente por app, y fallo ambiguo que no repite a ciegas. Distingue cola de Windows de papel impreso.
6. **Android con fundamentos sólidos.** Dominio puro, StateFlow, Room/WorkManager, UUID/upsert de compras, cola coalescida, reemplazo remoto transaccional preservando pendientes, migración aditiva y guardia de sesión ante cortes. Compras por voz y Marketing local evitan depender de IA paga.
7. **Herramientas gastronómicas reales.** Costeo por rendimiento, tapa de empanada en web/canales, comisión configurable, masa/poolish/heladera y metas productivas están modelados y probados. Su corrección matemática no sustituye validación gastronómica real.
8. **Cobertura de pruebas significativa.** Existe una base rápida para prevenir regresiones de precios, masa, pagos, impresión y cálculos. La próxima inversión debería cubrir integración y fallos intermedios.

## Acceso vivo y límites

`db policies --json` respondió con las políticas actuales. No se simuló cada permiso ni se inspeccionó el cuerpo vivo de `es_usuario_recetario()`. `pedidos` tiene ALL para cuentas de recetario, aunque las apps de recetario solo necesitan leerlos; `productos` tiene ALL para esas cuentas sin condición de proyecto. Conviene mínimo privilegio: SELECT en pedidos y alcance explícito de proyecto al escribir carta, especialmente si se habilitan más usuarios.

`diagnose db` no pudo ejecutar sus consultas por “Unrestricted SQL execution is disabled on this project”. Sus salidas “0%/undefined/None” no constituyen métricas válidas. Advisor no pudo refrescar el token de plataforma. No se alteraron ajustes para habilitar diagnósticos. CPU/memoria, índices, backups/restauración, límites de filas y salud de infraestructura quedan sin verificar.

No hubo compras/cobros/reembolsos reales, escrituras de prueba en producción, simulación de crash de proceso en dispositivo, inspección visual de navegador/emulador/teléfono, TalkBack, ticket físico ni comparación de SHA local contra despliegues. La auditoría no certifica esos aspectos ni ausencia total de vulnerabilidades.

## Verificaciones ejecutadas

| Componente | Resultado |
|---|---|
| Impasto | `npm test`: 29 archivos de pruebas aprobados; TypeScript sin emitir aprobado; `npm run build` aprobado |
| Recetario web | 6 suites, 161 tests aprobados; build Astro/Netlify/PWA aprobado |
| Carro Fogón | 14 archivos de pruebas aprobados; build y lint aprobados con 3 advertencias |
| Android | `testDebugUnitTest --rerun-tasks`: 19 suites, 287 tests, 0 fallos/errores; 28 tareas ejecutadas |
| Agente térmico | 30 pruebas C# aprobadas, sin imprimir pedidos reales |
| Reproducciones | Pérdida de parcial MP, conversión de reembolso a aprobado y doble INSERT de numeración POS con funciones reales/datos simulados |

Advertencias de web: módulo crypto externalizado para navegador y Browserslist desactualizado. No bloquearon compilación; corresponde verificar login/refresh en navegador. Android presentó 4 warnings de `!!` innecesario. Pasar estas pruebas no invalida los escenarios descubiertos: las suites actuales no cubren todas esas ventanas y divergencias.

## Orden de mejora propuesto

1. **Integridad del dinero y del catálogo:** corregir gastos/facturación histórica; transiciones legacy de caja; tapa/borrado Android; receta atómica; idempotencia de venta.
2. **Recuperación operativa:** pagos interrumpidos, cola de avisos, devoluciones parciales/reconciliación, confirmación real de cada escritura, monto aceptado y envío calculado en servidor.
3. **Consistencia del ecosistema:** fixtures comunes TS/Kotlin, vínculos por ID, esquema explícito de pedido/canal, caché y pendientes por cuenta, errores offline recuperables.
4. **Calidad continua:** ejecutar tests además de build en CI Android; agregar CI web/POS si no existe fuera de estos repos; prueba de integración con base separada y datos ficticios, nunca una prueba destructiva en producción.
5. **Cierre de producto:** filtros operativos exactos, paginación, accesibilidad, release Android firmado, documentación actual y procedimiento probado de backup/restauración.

La primera entrega de estabilización debería ser pequeña y verificable: paridad tapa/borrado Android, transiciones de caja y errores de guardado. La reforma de Ganancias necesita definir antes qué representa cada métrica y aprobar fixtures de cobros/gastos históricos; cambiar una fórmula aislada puede corregir una cifra y romper precios compartidos.
