# Auditoría actual del ecosistema Impasto

Fecha de cierre de comprobaciones: 21/09/2026, aproximadamente 15:37, Argentina.

## Estado de implementación posterior

Actualización del 22/09/2026, publicada en `origin/main` con el commit `3013480`; el
despliegue y la prueba operativa en producción todavía no fueron verificados:

- **A01 implementado y publicado:** la referencia del intento se crea y persiste antes del primer request; aprobado se recupera sin un nuevo cobro; pendiente abre seguimiento sin repetir la operación; rechazado habilita una referencia nueva; una referencia no se puede reutilizar con otro cliente o carrito.
- **A02 implementado y publicado en las escrituras críticas:** checkout y webhook comprueban errores y fila afectada al leer/guardar el estado de pago. Un fallo de persistencia responde como error reintentable y conserva la referencia.
- **A10 implementado y publicado:** el panel recuerda solo pedidos que alguna vez estuvieron habilitados para cocina. Una tarjeta pendiente queda a la espera y produce una única campanilla cuando Mercado Pago la acredita; cancelarla después no permite que vuelva a sonar.
- **A11 implementado y publicado:** una tarjeta pendiente o rechazada no puede avanzar a preparación, reparto o entrega ni generar una comanda. El panel no permite acreditarla manualmente y el servidor aplica la misma prohibición; efectivo y transferencia conservan la confirmación manual.
- Pruebas agregadas: `tests/card-attempt.test.ts`, `tests/db-result.test.ts` y `tests/admin-order-update.test.ts`; también se ampliaron los casos de `tests/pedido-visible.test.ts`. Suite completa, TypeScript y build de producción terminaron con código 0; ESLint quedó con 0 errores y las 11 advertencias preexistentes.
- Estos puntos deben considerarse cerrados operacionalmente solo después de verificar el SHA desplegado y ejecutar una prueba controlada con el ambiente de prueba de Mercado Pago. No se ejecutó ningún cobro real.

## 1. Dictamen ejecutivo

**No recomiendo habilitar una operación plena y sin supervisión con los tres sistemas en su estado actual.** Las aplicaciones están disponibles, hay protección de acceso y muchas correcciones anteriores funcionan. Sin embargo, quedan fallas importantes en reintentos de cobro, conciliación de pagos, interpretación de pedidos entre aplicaciones y cálculo de ganancias.

No significa que todos los pedidos fallen ni que se hayan demostrado cobros duplicados. Significa que hay caminos concretos, identificados en el código actual, que pueden producirlos o dejar información operativa incorrecta. No ejecuté cobros ni pedidos de prueba en producción.

Para un piloto supervisado: primero resolver los problemas de cocina, autorización y precios indicados abajo; mantener tarjeta fuera del piloto hasta comprobar su recuperación ante fallas; conciliar caja con los importes registrados y los comprobantes del proveedor, no con el resumen actual de Ganancias. Esa restricción es una recomendación, no un cambio realizado.

Prioridad inmediata:

1. Hacer que un mismo intento de compra no pueda crear otro cobro al reintentarse.
2. Comprobar y reconciliar la persistencia de estados de pago.
3. Unificar el contrato de pedidos de web/POS: productos, preparación, cobro, descuentos y modalidad.
4. Restringir el POS a operarios autorizados.
5. Impedir precios incompletos o cero por fallas de consulta.
6. Corregir Ganancias y el cierre de caja antes de usarlos para decidir rentabilidad.

## 2. Alcance y calidad de la evidencia

Se revisaron los repositorios locales, funciones de cálculo y autorización, pruebas automatizadas, endpoints públicos y consultas de solo lectura a la base compartida. No se modificaron tablas, pedidos, cobros, precios, permisos ni despliegues. El único entregable de negocio agregado por esta auditoría es este documento. Por solicitud directa del usuario también se registró la conexión MCP de InsForge en la configuración local de Codex; ninguna credencial se incorpora aquí.

Versiones locales observadas al cierre:

| Proyecto | Ruta | Commit observado |
|---|---|---|
| Web Impasto | `C:/Users/spezi/Documents/PROYECTOS/Impasto` | `40382fd` |
| Carro Fogón POS | `C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app` | repositorio `c7c6c8d` |
| Recetario Napolitano | `C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano` | `d0229a8` |

Hubo trabajo concurrente: al inicio se observaron otras revisiones de Impasto y del recetario y una modificación de CSS que luego desapareció del estado pendiente. No revertí ni incorporé esos cambios. Los hallazgos se apoyan en los archivos leídos, no en asumir que el repositorio estuvo inmóvil.

**Distinción fundamental:** una respuesta HTTP correcta no demuestra que producción ejecute exactamente esos commits. No se verificó la asociación entre cada despliegue y su SHA, ni todas las variables remotas. Las conclusiones de código se etiquetan como locales; las observaciones de base y HTTP sí corresponden a producción.

## 3. Cómo están coordinados hoy

| Área | Web | POS | Recetario |
|---|---|---|---|
| Venta | Checkout delivery/retiro | Carga manual | No es canal de toma de pedidos |
| Persistencia | `pedidos`, proyecto `impasto`, sucursal `iguazu` | Mismo proyecto y sucursal | Lee `pedidos` para unidades e ingresos por canal |
| Identificación | Referencia `IM-…`, número derivado del reloj | Número diario secuencial, referencia vacía | Distingue canales mediante heurísticas |
| Ítems | `name`, `qty`, `price`, `detail` | `nombre`, `cantidad`, `precio`, `extra` | Intenta interpretar ambos formatos |
| Preparación | `normal/nuevo`, `preparando`, `en-camino`, `entregado`, `cancelado` | `normal`, `pagado_mp`, `parcial_mp`, `entregado`, `cancelado` | Excluye cancelados |
| Pago | `metodo_pago` y `estado_pago` | Registra efectivo al crear; usa además `status` y `parcial_mp` | Comisión según método/estado; ventas con criterio distinto |
| Precio | Recalcula desde recetas/costos; redondea a $500 | Copia del mismo cálculo | Rendimiento configurable; precio al peso |

El panel web **ya consulta pedidos del POS**: ambos usan ahora `proyecto_id=impasto` y `sucursal_id=iguazu`. El problema actual no es necesariamente necesitar dos pantallas: es que los formatos y significados todavía no coinciden.

Evidencia: [consulta del panel](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/route.ts:9), [creación POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:152), [adaptador web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/adapt-order.ts:15), [tipos POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/types/index.ts:6).

## 4. Producción: observaciones verificadas

- `https://www.impastopizzas.com`: HTTP 200.
- `/api/store-status`: HTTP 200; ventas no pausadas manualmente, cerrado por horario; martes a domingo, 19:30–00:00. Mensaje público normal, no el mensaje inapropiado de la auditoría anterior.
- `/api/admin/pedidos`: HTTP 401 sin sesión.
- `https://carro-fogon.vercel.app`: HTTP 307; `/api/pedidos`: HTTP 401 sin sesión.
- `https://recetarionapolitano.netlify.app`: HTTP 200. Esto verifica disponibilidad, no autorización de todas sus pantallas.
- Base compartida: consulta `SELECT 1` exitosa; RLS habilitada en las 21 tablas públicas inspeccionadas.
- `es_usuario_recetario()` compara `auth.uid()` contra un UUID autorizado. Las políticas del recetario usan esa función tanto para lectura como para escritura. No se imprime el UUID aquí.
- `clientes`: política solo para `project_admin`. `pedidos`: administrador o usuario habilitado del recetario. `sucursales`: lectura pública y escritura de administrador. Los permisos SQL generales no anulan esas restricciones RLS.
- 36 productos no archivados del proyecto; ninguno marcado agotado; todos tienen coincidencia por nombre con una regla de `precios_venta`.
- Envío configurado: $3.000; envío gratis desde $35.000. Alias y CBU no vacíos. **No se certificó titularidad ni exactitud bancaria.**
- `gastos`: actualmente vacía. Por eso el defecto de doble resta existe en el código, pero no se acredita un perjuicio actual por filas ya cargadas.
- `notificaciones`: tres Telegram con estado `enviado` y tres email `omitido`. Son estados históricos en la base; no demuestran que el proveedor de correo siga sin configurar hoy.

Pedidos observados, sin datos personales:

| Método | Pago | Preparación | Cantidad | Importe registrado |
|---|---|---|---:|---:|
| Efectivo | Pendiente | Cancelado | 1 | $25.000 |
| Efectivo | Pendiente | Entregado | 1 | $23.500 |
| Mercado Pago | Aprobado | Entregado | 1 | $1.000 |
| Transferencia | Aprobado | Entregado | 1 | $15.000 |

Los tres pedidos no cancelados tienen referencia web y suman $39.500. No se certifica si cada registro representa una venta comercial o una prueba histórica. No se consultaron datos de tarjetas ni se provocaron pagos.

## 5. Hallazgos que requieren acción

### A01 — Alta: reintentar tarjeta todavía puede crear otra compra/cobro

La ruta reutiliza una referencia únicamente si el pedido encontrado **no** está aprobado. Si ya está aprobado, cae en `createPedido()` y genera otra referencia. Además, el navegador conoce la referencia recién al recibir y parsear la respuesta; si esta se pierde, no tiene identificador durable para recuperar el primer intento.

La clave de idempotencia enviada al proveedor es la referencia creada en el servidor. Si el reintento crea otra referencia, ya no representa la misma operación. Riesgo confirmado por flujo de código; no se ejecutó un cobro duplicado.

También se puede reutilizar un pedido pendiente/rechazado sin verificar que los datos actuales del carrito coincidan con el pedido original; en ese camino se reutiliza su total y no se vuelve a pasar por el control de horario de `createPedido`.

Evidencia: [búsqueda y condición de reutilización](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/payments/card/route.ts:69), [creación alternativa](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/payments/card/route.ts:114), [clave del proveedor](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/mercadopago.ts:80), [referencia en navegador](C:/Users/spezi/Documents/PROYECTOS/Impasto/components/Shell.tsx:464).

Acción: identificador estable creado antes del primer intento, pedido recuperable, respuesta idempotente para uno ya aprobado y conciliación ante resultado incierto. Cambiar de carrito debe crear explícitamente otra operación, no reutilizar silenciosamente una anterior.

Aceptación: doble clic, pérdida de respuesta, recarga, webhook adelantado y reintento de un aprobado dejan un solo pedido y un solo cobro. Ejecutar en ambiente de prueba del proveedor.

### A02 — Alta: checkout/webhook pueden dar éxito sin persistir el pago

El webhook descarta `error` en la lectura: una falla de base puede verse como pedido inexistente y terminar en HTTP 200 `ignored`. La actualización de pago también ignora el resultado de error del SDK. La ruta de tarjeta hace actualizaciones similares sin comprobar su resultado. El `catch` no alcanza porque el SDK puede devolver `{data,error}` sin lanzar excepción.

Impacto: proveedor cobrado y pedido local pendiente; aviso emitido con persistencia fallida; evento reconocido aunque no quedó aplicado. Si el estado ya coincide, el webhook sale sin recuperar avisos faltantes.

Evidencia: [lectura y actualización webhook](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/payments/webhook/route.ts:73), [actualizaciones tarjeta](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/payments/card/route.ts:141).

Acción: verificar cada resultado, distinguir ausencia real de falla, hacer transiciones consistentes y disponer de conciliación de pendientes. Aceptación: simular fallo de base antes/después de la aprobación y comprobar recuperación sin duplicación.

### A03 — Alta: autorización de operarios demasiado amplia

**Estado 22/09/2026: corregido y publicado en Carro Fogón (`4abfe7b`) con una única cuenta autorizada (`spezialichristian@gmail.com`), auditoría de actor y pruebas; pendiente de verificar el despliegue y hacer humo de acceso.**

`requireAuth()` acepta cualquier usuario que InsForge valide, sin comprobar pertenencia a la pizzería ni rol de operario. Login tampoco comprueba habilitación. Las rutas de pedidos/clientes operan después con el cliente de backend, separado de la identidad del usuario.

Por tanto, la protección del recetario por UUID no es equivalente a una autorización del POS. Una cuenta válida no habilitada para operar podría atravesar esos controles. No se registró una cuenta ajena ni se intentó explotar el acceso; no se verificó si el registro público está habilitado ni los secretos exactos desplegados en Vercel.

Evidencia: [requireAuth](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/auth.ts:57), [login](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/auth/route.ts:23), [cliente backend](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/insforge.ts:5), [uso en pedidos](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:21).

Acción: lista explícita o roles de empleados verificados en servidor. Aceptación: una cuenta válida pero no habilitada recibe 403 en todas las rutas operativas; un empleado solo dispone de las acciones previstas para su rol.

### A04 — Alta: estados incompatibles y cierre de caja incorrecto entre web y POS

El POS marca pagos mediante `status=pagado_mp/parcial_mp`, mientras la web usa `estado_pago` y reserva `status` para preparación. El PATCH del POS no actualiza el modelo de pago de la web. Al pasar un pedido del POS de `pagado_mp` a `entregado` en la web, se pierde la marca de cobro que la caja del POS utiliza.

La caja del POS suma MP únicamente con `status=pagado_mp`. El pedido web de $1.000 observado está aprobado en MP y entregado; ese criterio no lo cuenta como MP. También incluye todo pedido no cancelado, sin excluir tarjetas pendientes/rechazadas. El recetario reconoce comisión solo por `metodo_pago=mercadopago` y `estado_pago=aprobado`, por lo que un pago señalado solamente como `pagado_mp` en el POS no la genera.

Evidencia: [estados POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/types/index.ts:6), [PATCH](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/[id]/route.ts:42), [caja](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/totales/page.tsx:31), [adaptación web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/adapt-order.ts:37).

Acción: separar preparación y cobro en los tres sistemas; registrar importes por medio de pago y saldo pendiente. Aceptación: entregar, cancelar, cobrar parcialmente y reembolsar no destruyen ni reinterpretan el historial de pagos.

### A05 — Alta: reimprimir un pedido web en POS pierde los productos

El listado del POS trae pedidos web del mismo proyecto y pasa `p.productos` directamente a su impresor. Este solo entiende `nombre/cantidad/precio`; la web guarda `name/qty/price/detail`. La reimpresión de una compra web produce cantidades/precios cero y nombre vacío, aunque el total del pedido siga visible. Tampoco interpreta los sabores de cajas.

Además, esa reimpresión no pasa `modalidad`, `envio` ni notas al impresor; un retiro se rotula por defecto como delivery. Usa `!!total_con_descuento` como señal de descuento, aunque la web guarda ese campo incluso sin descuento: puede imprimir “Pago efectivo con descuento” en un pedido web con otro medio de pago.

Evidencia: [reimpresión POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/pedidos/page.tsx:14), [interpretación del ticket](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/print.ts:49), [formato web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/orders.ts:126).

Acción: un adaptador de pedido completo en el POS, incluyendo modalidad, detalles, descuento real y pago. Aceptación: reimprimir desde ambos paneles una pizza mitad y mitad, caja con sabores, bebida y retiro, obteniendo el mismo contenido.

### A06 — Alta: Ganancias no representa facturación histórica real

El recetario conoce los totales guardados por canal, pero el resumen principal calcula `precioVentaActual × unidades`. El precio se vuelve a formar con costos, markup y comisión actuales. Cambiar el costo de mozzarella o el margen modifica retrospectivamente la facturación del mes consultado.

Tampoco reproduce necesariamente redondeos comerciales de $500, descuentos, envío, promociones o el precio máximo de mitad y mitad. No es un libro de ventas: mezcla un modelo de precios con unidades vendidas.

Evidencia: [precio reconstruido](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:519), [resumen de facturación](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:839).

Acción: facturación desde importes históricos de pedidos válidos; separar proyección de rentabilidad y resultado real; almacenar costo histórico por ítem o declarar explícitamente que el margen es estimado a costo actual.

Aceptación: cambiar una receta o markup no cambia lo facturado en un mes cerrado. La suma se concilia con ventas netas y devoluciones.

### A07 — Alta, latente hoy: gastos duplicados y sin período

`totalOp` incluye todos los registros de `gastos`, sin filtro mensual. Luego `gastosData` filtra el mes y `gananciaNeta` resta tanto `totalOp` como `gastosExtra`. Un gasto del mes se descuenta dos veces y uno de otro mes sigue dentro del costo operativo.

El mismo histórico completo se suma al formar precios en web, POS y pantalla Precios. Cargar un gasto puede cambiar automáticamente la carta; un gasto viejo no deja de afectar al mes siguiente.

**Hoy la tabla está vacía:** defecto verificado en fórmulas, no dinero ya descontado dos veces. Ejemplo aislado: con resultado bruto $10.000, gasto mensual $1.000 y otros costos cero, el resumen resulta $8.000 en lugar de $9.000, manteniendo fijo el ingreso del ejemplo.

Evidencia: [costo operativo](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:473), [filtro mensual posterior](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:550), [doble resta](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:844), [precios web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/catalog.ts:43), [precios POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/precios-efectivos.ts:35), [Precios recetario](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/precios.astro:174).

Acción: distinguir presupuesto de costos para fijar precios y egresos reales del período; cada gasto debe afectar una sola vez al resultado que corresponda.

### A08 — Alta: ganancias incorpora tarjetas que no son ventas cobradas

El filtro de pedidos del recetario excluye cancelados y otros meses, pero no tarjetas pendientes, rechazadas o reembolsadas. `esCobroConTarjeta` se usa para comisión, no para excluir sus unidades/ventas. La caja POS tiene el mismo problema de incluir todo no cancelado.

Evidencia: [filtro y comisión](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:355), [filtro POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/totales/page.tsx:32). No se observaron tarjetas rechazadas en los cuatro pedidos actuales: riesgo latente, no suma errónea actual demostrada por ese estado.

Acción: definir venta válida, cuenta por cobrar y cobro real como conceptos separados y usar las mismas reglas en ambos reportes.

### A09 — Alta: una falla parcial de costos puede publicar/cobrar precios incorrectos

El catálogo web ahora falla si no puede leer productos, pero las consultas auxiliares de ingredientes, recetas o costos se convierten en listas vacías. El cálculo continúa y puede sobrescribir un precio guardado con un valor reducido o cero. POS usa el mismo patrón. No se trata siempre de volver al último precio válido, aunque un comentario lo sugiera.

Reproducción local con la función real: receta y regla existentes, consulta de ingredientes simulada como lista vacía, resultado **$0**. La cotización web de pizza/bebida no exige precio positivo; las cajas sí tienen una validación/fallback específico. No se provocó una caída en producción.

Evidencia: [degradación catálogo](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/catalog.ts:75), [cálculo](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/effective-prices.ts:115), [cotización](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/order-quote.ts:42), [POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/precios-efectivos.ts:48).

Acción: ante datos incompletos, detener venta del producto o servir una versión de precios válida previamente publicada. No inferir costo cero de un error. Aceptación: falla de cualquier fuente necesaria no reduce el precio ni habilita ventas gratuitas.

### A10 — Media/alta: campanilla no avisa cuando un pendiente conocido se aprueba

**Estado 22/09/2026: corregido, verificado y publicado en `3013480`; pendiente de verificar despliegue y prueba operativa.**

Se recuerdan los UUID de **todos** los pedidos recibidos, incluso pendientes de tarjeta. La campanilla exige UUID desconocido y pedido habilitado para cocina. Si primero entra pendiente y luego se aprueba, ya es conocido y no suena.

Reproducción ejecutada con `clavesDePedidos` y `pedidosNuevosParaCocina`: pendiente conocido → aprobado, **0 avisos**. El aviso por Telegram podría compensarlo si funciona, pero no arregla el panel.

Evidencia: [regla](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/pedido-visible.ts:44), [polling](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/admin/components/StoreProvider.tsx:294).

Acción: detectar entrada a condición “apto para cocina”, no solo creación de UUID. No alertar dos veces el mismo ingreso a preparación.

### A11 — Media/alta: todavía se puede preparar o aprobar manualmente una tarjeta pendiente

**Estado 22/09/2026: corregido, verificado y publicado en `3013480`; pendiente de verificar despliegue y prueba operativa.**

La regla `esPedidoParaCocina` se usa para campanilla y para ventas del Dashboard, pero no bloquea los botones de avanzar preparación/imprimir de la pantalla Pedidos. “Marcar pago recibido” aparece para cualquier pago pendiente, incluida tarjeta. El servidor acepta modificar `estado_pago` a aprobado desde el panel.

La comanda fue mejorada: una tarjeta pendiente/rechazada ahora dice **NO ENTREGAR SIN CONFIRMAR PAGO**, no “cobrar efectivo”. Aun así, eso no impide avanzar ni confundir confirmación manual con acreditación del proveedor.

Evidencia: [acciones de preparación/pago](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/admin/components/Orders.tsx:179), [actualización servidor](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/[id]/route.ts:17).

Acción: separación visible de pedidos pendientes de pago; aprobación de tarjeta exclusivamente por conciliación con proveedor, o excepción administrativa explícita y auditada que no simule una acreditación.

### A12 — Media/alta: POS no confirma al operador el total realmente guardado

El servidor recalcula precios al crear; devuelve solamente el número. Telegram y comanda se arman con el carrito anterior y el total calculado por el navegador. Si cambia un costo entre cargar la carta y confirmar, puede guardarse un monto e imprimirse otro.

POST consulta todos los productos del proyecto sin excluir `disponible=false` ni `archivado=true`, aunque GET de productos sí los excluye. Un carrito viejo puede vender un producto recién dado de baja o agotado.

Evidencia: [recalcular e insertar](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:76), [respuesta solo número](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:184), [aviso y ticket del navegador](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/components/FormCliente.tsx:93), [filtro GET](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/productos/route.ts:24).

Acción: devolver y utilizar el pedido persistido completo; reconfirmar cambios de precio; validar disponibilidad en el POST. Añadir idempotencia de creación para reintentos de red del POS, independiente del reintento de numeración.

### A13 — Media: fórmula de rendimiento diferente aunque hoy las nueve empanadas coinciden

Web y POS tienen copias idénticas de `effective-prices.ts` (hash SHA256 comparado); redondean al próximo múltiplo de $500 después de redondear al peso. No se detectó regreso al redondeo de $1.000.

Sin embargo, usan siempre 65 g para empanadas e ignoran `rend_tipo/rend_valor`. El recetario sí respeta rendimiento directo o gramos configurados. Hoy las cuatro recetas directas de una unidad pesan entre 75 y 80 g aproximadamente: dividir por `floor(peso/65g)` casualmente da uno. Las otras cinco usan peso/65 g. Por eso **no afirmo que las nueve empanadas estén actualmente mal por esta causa**.

Reproducción local con funciones reales: una receta de 130 g, rendimiento directo 1, costo $3.000 y markup 1 produce $1.500 en web/POS y $3.000 en recetario. Una futura edición puede reintroducir el problema.

Evidencia: [65 g y fórmula](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/effective-prices.ts:36), [campos consultados](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/catalog.ts:36), [rendimiento recetario](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/utils/pricing.ts:43).

Acción: contrato compartido de cálculo, con pruebas de paridad para rendimientos directos, por peso y valores no estándar. Mantener redondeo comercial de $500 acordado.

### A14 — Media/alta: los avisos no tienen recuperación confiable

Se inserta una reserva de notificación antes del envío. Cualquier error de inserción se trata como “ya existe” y corta el aviso. Una fila fallida/omitida/pendiente también impide reintentar con la misma clave única. `Promise.allSettled` evita propagar fallas al pedido, pero no las reprograma.

POS envía Telegram desde el navegador después del guardado y descarta errores. Cerrar la pestaña o perder conexión en ese punto puede dejar pedido sin aviso.

Evidencia: [reserva email](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/notifications.ts:87), [reserva Telegram](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/notifications.ts:124), [envío POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/components/FormCliente.tsx:106).

Acción: cola durable de avisos con estado, reintentos y alerta visible; distinguir duplicado de fallo real. No reenviar en masa los avisos históricos omitidos sin decidir primero si corresponde contactar a esos clientes.

### A15 — Media: edición de productos aún muestra éxito falso

`updateProduct` modifica el estado local y muestra éxito sin comprobar HTTP; `deleteProduct` también elimina visualmente antes de verificar. Si el operador marca agotado con sesión vencida o error, puede creer que dejó de venderse cuando no se guardó.

Evidencia: [edición productos](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/admin/components/StoreProvider.tsx:343). Las actualizaciones de estado/pago del pedido **sí** tienen ahora comprobación y reversión: no se generaliza el defecto a esas funciones.

Acción: comprobar respuesta, revertir interfaz y mostrar fallo. El campo stock se inicializa en 24 y no constituye inventario real; operar por disponibilidad hasta implementar stock y reservas verdaderos.

### A16 — Media: tarifa y jornada tienen dos fuentes de verdad

El POS fija $3.000/$35.000 en el formulario y acepta `envio` del navegador; la web lee la sucursal. Hoy coinciden, pero cambiar la sucursal no cambia el POS. La web usa `valor || default`, de modo que configurar tarifa cero no tiene el efecto esperado.

Web guarda fecha local de calendario; POS define jornada con corte a las 06:00. El error viejo de UTC a partir de las 21:00 está corregido. La diferencia de madrugada sigue siendo una decisión pendiente si se extiende el horario o se cargan pedidos después de medianoche.

Evidencia: [tarifa POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/components/FormCliente.tsx:64), [envío recibido](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/app/api/pedidos/route.ts:108), [tarifa web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/business-server.ts:45), [fecha web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/orders.ts:144), [jornada POS](C:/Users/spezi/Documents/PROYECTOS/carroFogon/next-app/src/lib/businessDate.ts:12).

Acción: configuración única de tarifa, umbral, zonas y jornada. Validar dirección/cobertura antes de prometer delivery; no asumir que una tarifa uniforme valida cualquier domicilio.

### A17 — Media: clientes e historial todavía son frágiles

La web actualiza cliente antes de terminar el pedido, borra dirección al recibir `dir` vacío y usa lectura+incremento para `cant_compras`. Un intento fallido puede incrementar compras y dos simultáneos perder un incremento. El teléfono se utiliza como clave sin una normalización común demostrada.

Panel web consulta todo el historial cada 15 s; Ganancias trae pedidos completos y filtra el mes en cliente, sin paginación explícita. No se demostró truncamiento con los cuatro registros actuales, pero no hay garantía de integridad del informe al crecer.

Evidencia: [cliente](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/orders.ts:62), [historial panel](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/route.ts:9), [historial recetario](C:/Users/spezi/Documents/PROYECTOS/recetario-napolitano/src/pages/ganancias.astro:331).

Acción: preservar valores existentes no reemplazados, normalización telefónica común, contadores derivados/atómicos y consultas por rango con paginación.

### A18 — Media: devoluciones parciales no tienen saldo acumulado correcto

Una orden `processed/partially_refunded` se traduce a `reembolsado`. La ruta solo permite devolver cuando está `aprobado`, por lo que bloquea posteriores devoluciones. No hay un saldo devuelto acumulado utilizado por los reportes. La clave de devolución depende de orden+monto, no de una operación única, lo que tampoco distingue dos devoluciones legítimas del mismo importe.

Evidencia: [mapa de estados](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/mercadopago.ts:146), [clave de devolución](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/mercadopago.ts:125), [validaciones y persistencia](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/[id]/refund/route.ts:35).

Acción: registrar transacciones de devolución y saldo neto, diferenciando parcial y total; conciliar con proveedor. No se efectuó ninguna devolución durante la auditoría.

### A19 — Media: colisión del número web y alcance de cambios administrativos

La referencia web tiene sufijo aleatorio, pero el número continúa como `Date.now()%900000+100000`. La base impone unicidad por fecha/proyecto/número. Dos solicitudes que produzcan el mismo número ese día pueden fallar, aunque sus referencias sean distintas. No hay reintento equivalente al implementado en el POS. No implica que todos los pedidos se dupliquen cada 15 minutos: requiere coincidencia del residuo temporal.

PUT/DELETE/devolución del panel filtran por sucursal y UUID, no también por proyecto. Con los datos actuales todos los pedidos son de Impasto; queda riesgo de aislamiento al incorporar otros proyectos/sucursales.

Evidencia: [número web](C:/Users/spezi/Documents/PROYECTOS/Impasto/lib/orders.ts:114), [update/delete](C:/Users/spezi/Documents/PROYECTOS/Impasto/app/api/admin/pedidos/[id]/route.ts:22). Índice único `pedidos_numero_uidx` verificado en producción.

Acción: número asignado de forma segura en base o reintento controlado; no usarlo como identificador de idempotencia. Acotar todas las mutaciones al proyecto y sucursal, verificar que afectaron una fila y preferir cancelación auditada sobre borrado de ventas.

## 6. Correcciones anteriores que sí se sostienen

- Prepizza y salsa excluidas de empanadas y bebidas en los cálculos revisados. Para otras categorías la regla sigue siendo “todo salvo esas dos”; no afirmar que ya es estrictamente “solo Pizzas”.
- Redondeo comercial de web/POS a $500, con ambas copias de cálculo idénticas.
- El recetario respeta rendimiento directo/por peso mediante `calcCostoPorUnidad`.
- Detalle de ítems preservado por el adaptador y comanda del panel web; ya no corresponde repetir el hallazgo de cajas sin sabores en ese panel. El defecto vigente de reimpresión está en el POS.
- Dashboard web excluye tarjetas no aprobadas y cancelados mediante `esPedidoValidoParaVentas`.
- Se usa UUID, no número visible, para identidad de pedidos del panel/campanilla.
- El primer pedido con panel previamente vacío ya no depende de `prevIds.size>0`.
- Polling muestra error de sesión vencida en HTTP 401. No es correcto afirmar que ese caso sigue siendo completamente silencioso. Errores de red/otros HTTP siguen sin indicador explícito de frescura.
- Cambio de estado/pago del panel comprueba respuesta y revierte el estado visual si falla.
- Horario y pausa manual se validan al crear pedido web. Fallar la lectura de sucursal deja ventas inactivas.
- Pedidos programados distintos de `asap` se rechazan por validación actual.
- Fecha web local, no UTC. POS con corte de jornada y reintento de número.
- Recetario usa variables de entorno y cliente de navegador con autenticación, no la clave administradora hardcodeada del reporte antiguo. RLS actual restringida y comprobada. No se auditó exhaustivamente la historia Git ni todos los bundles remotos para certificar eliminación de cualquier secreto histórico.
- Webhook valida firma y consulta el recurso en el proveedor; el problema vigente es consistencia/recuperación, no confiar ciegamente en el cuerpo recibido.

## 7. Pruebas ejecutadas y limitaciones

| Comprobación | Resultado |
|---|---|
| `pnpm test` en Impasto | Exit 0; secuencia de 17 archivos completada |
| `npm test` en recetario | 4 archivos, **111 pruebas aprobadas**, exit 0 |
| TypeScript web, `--noEmit --incremental false` | Exit 0 |
| TypeScript POS, `--noEmit --incremental false` | Exit 0 |
| ESLint web | Exit 0, 0 errores, 11 advertencias |
| Reproducción rendimiento con funciones reales | Web/POS $1.500 frente a recetario $3.000 en caso directo 1 / 130 g |
| Reproducción campanilla | Pendiente conocido → aprobado: 0 avisos |
| Reproducción ingredientes ausentes | Precio calculado $0 en caso aislado |
| Disponibilidad HTTP y acceso anónimo | Resultados en sección 4 |
| RLS, políticas, helper e índices | Consultas de lectura exitosas |

Pasar las pruebas existentes no demuestra que los flujos cruzados estén cubiertos. El POS no expone script `test` en el `package.json` inspeccionado; no se atribuye una suite integrada que no existe allí.

No realizado / no acreditado:

- Compra integral con tarjeta, rechazo, pérdida de respuesta, webhook, anulación y devolución en sandbox del proveedor.
- Prueba de turno completo con sesión prolongada, desconexiones y reconexiones.
- Impresión física, audio habilitado en el dispositivo de cocina, entrega real y ticket de retiro.
- Envío nuevo de correo/Telegram: se evitó contactar personas durante la auditoría.
- Prueba de abuso con cuenta no autorizada o creación de cuentas.
- Build completo nuevo de los tres proyectos, prueba de carga y auditoría integral de dependencias.
- Correspondencia commit/despliegue, inventario íntegro de variables remotas y validación bancaria.
- Backups restaurables y recuperación ante desastre. El asesor de InsForge consultado durante la revisión requirió renovar autenticación de plataforma; el acceso directo de lectura a la base sí funcionó. No se extrapola esa limitación a indisponibilidad del backend.
- Verificación del remoto Git mediante fetch: las marcas locales `main...origin/main` no prueban por sí solas que no haya cambios remotos nuevos.

## 8. Plan de cierre por etapas

Este es un orden de trabajo propuesto, no autorización para implementar ni desplegar automáticamente.

### Etapa 1 — Contrato y seguridad antes de habilitar ventas completas

- [ ] Decidir responsables de cocina, caja y cierre, y panel operativo principal.
- [ ] Restringir usuarios POS (A03).
- [ ] Unificar estado de preparación, medio de pago, acreditaciones parciales, reembolsos e ítems (A04/A05).
- [ ] Evitar precios a partir de fuentes incompletas; confirmar disponibilidad al guardar (A09/A12).
- [ ] Definir política de aprobación manual de transferencias y excepción de tarjetas (A11).
- [ ] Rotar de forma coordinada la clave administrativa compartida en la conversación y cualquier otra que siga expuesta; actualizar consumidores y verificar continuidad antes de revocar. No se rotó durante esta auditoría.

### Etapa 2 — Cobro y recepción resistentes a fallas

- [ ] Idempotencia durable y recuperación del checkout y POS (A01/A12/A19).
- [ ] Verificar escritura de pagos; conciliación de pendientes y devoluciones (A02/A18).
- [ ] Campanilla por ingreso efectivo a cocina y aviso durable con reintentos (A10/A14).
- [ ] Indicador visible de conexión/última actualización y errores al marcar agotado (A15).
- [ ] Pruebas con dos operadores y pérdida de conexión; sin cobros reales para simular fallas.

### Etapa 3 — Caja, precios y rentabilidad

- [ ] Ingresos desde pedidos históricos válidos, no precio actual por unidades (A06/A08).
- [ ] Gastos del período una sola vez; separar presupuestos y gastos reales (A07).
- [ ] Fórmula de rendimiento compartida y casos de paridad (A13).
- [ ] Fuente única de envío/jornada; normalización de clientes; paginación (A16/A17).
- [ ] Cierre de caja que concilie efectivo, transferencia, tarjeta, pendientes, descuentos, envío y devoluciones.

### Etapa 4 — Ensayo de apertura y decisión go/no-go

- [ ] Confirmar carta final, precios, alias/CBU, horarios, zonas, retiro, embalajes y tiempos prometidos.
- [ ] Ensayar web→cocina→entrega y WhatsApp/teléfono→POS→cocina→retiro.
- [ ] Probar caja con sabores, mitad y mitad, agotado, cambio de precio, cancelación, descuento y pago dividido.
- [ ] Mantener panel abierto un turno y comprobar expiración/renovación de sesión, campanilla y reconexión.
- [ ] Comprobar correo y Telegram autorizados, impresora y procedimiento manual de contingencia.
- [ ] Demostrar backup/restauración en entorno aislado y disponer de responsable de incidentes.
- [ ] Verificar SHA desplegado y humo postdespliegue en cada aplicación.
- [ ] Autorizar apertura plena solo después de cerrar los hallazgos altos y conciliar un ensayo completo sin diferencias.

## 9. Punto de reanudación

Empezar por A04/A05 para definir el contrato común; implementar en paralelo módulos independientes solo después de acordarlo. En pagos, cerrar A01/A02 antes de probar tarjeta en apertura. En informes, A06/A07/A08 se resuelven como una misma corrección de criterio contable operativo, manteniendo separadas ventas, cobros y estimaciones de margen.

La auditoría termina aquí: **no se corrigió código de negocio, no se alteraron datos y no se hizo commit, push ni deploy.** Los archivos no rastreados preexistentes de los tres repositorios se preservaron. Este informe debe mantenerse como lista de control, registrando evidencia de prueba y despliegue al cerrar cada punto, sin marcar como resuelto algo únicamente porque la interfaz cambió.
