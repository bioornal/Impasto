# Impresión térmica directa para Impasto y Carro Fogón

Fecha: 2026-09-23

## Objetivo y límites

Una sola PC Windows atiende Impasto y Carro Fogón y tiene conectada por USB una Epson TM-T20II de 80 mm. El personal necesita comandas legibles que terminen y se corten al acabar el contenido, sin el diálogo de impresión ni unos 30 cm de papel sobrante. Carro Fogón debe imprimir automáticamente después de guardar un pedido manual; Impasto debe imprimir cuando un operador pulse el botón de la comanda en el panel. No se pretende imprimir desde otros equipos ni operar sin Internet. La aplicación y la impresora deben poder fallar por separado: un fallo de impresión nunca vuelve a crear un pedido.

## Diagnóstico que motiva el cambio

La Epson ya funciona por USB y Windows imprime una página de prueba. Edge con `--kiosk-printing` elimina el diálogo, pero tanto las comandas actuales como una prueba CSS de `80mm × 60mm` salen con mucho papel en blanco. El controlador presenta un formulario de rollo de `80 × 297 mm`; el navegador sigue enviando trabajos de página. La opción de Epson «Extra Lower Space Reduction» tampoco resolvió la prueba física. La TM-T20II admite ESC/POS. Por eso la ruta propuesta envía comandos RAW al spooler y ordena cortar al final, sin depender del tamaño de página del navegador.

## Decisión de arquitectura

Un pequeño agente local de Windows, instalado y ejecutado en **esa PC**, escucha únicamente en `127.0.0.1`. Expone un endpoint de salud y otro para imprimir una comanda estructurada. Las dos aplicaciones web llaman al agente desde sus interfaces; el agente valida la solicitud, compone texto para 80 mm, lo codifica en ESC/POS y lo envía como trabajo RAW a la cola de la Epson mediante Winspool. El primer paso técnico será imprimir una comanda de prueba aislada por RAW. Si el controlador Epson no admite esa ruta, se ensayará una cola «Generic / Text Only» o el mecanismo RAW compatible de Epson antes de integrar las webs; no se dará por resuelto hasta medir un ticket real.

Se propone implementar el agente en C# sobre el .NET Framework disponible en la PC, sin servicio de nube, InsForge adicional ni dependencia de QZ Tray. Deberá arrancar con la sesión de Windows, mostrar claramente si está disponible y registrar errores locales mínimos. La cola de impresión se selecciona por nombre en configuración local, no por coincidencias vagas de dispositivos.

## Contrato local y seguridad

`GET /health` devuelve disponibilidad del agente, versión y nombre de la cola configurada, sin datos de clientes. `POST /print` recibe un identificador de intento, origen (`impasto` o `carro-fogon`), identificador de pedido, tipo (`delivery` o `retiro`), fecha y campos ya normalizados de la comanda: ítems, cantidades, detalles necesarios para cocina, observaciones, cobro y destino. El agente limita el tamaño del cuerpo y las longitudes de texto, escapa los caracteres de control y no acepta bytes ESC/POS enviados por el navegador. Devuelve el estado «enviado a la cola» o un error legible; no afirma que el papel haya salido físicamente.

El agente solo acepta conexiones de loopback, comprueba una lista explícita de orígenes de las dos apps y exige un secreto local de emparejamiento en cada `POST`. El secreto se genera en la PC, se configura una vez en cada navegador autorizado y no se incluye en el repositorio ni en el bundle público. CORS permite únicamente esos orígenes; solicitudes sin `Origin` no imprimen salvo la prueba local explícita. No se registran direcciones, teléfonos ni notas en los logs. Antes de integrar la interfaz se probará la llamada HTTPS → loopback en el navegador operativo, incluida la política de acceso a red local y el preflight; si la bloquea, el diseño vuelve a revisión en vez de desplegar una integración que no imprime.

Cada intento lleva una clave única y estable durante sus reintentos. El agente guarda un registro local pequeño de claves ya aceptadas para no repetir el trabajo cuando la respuesta se pierde. Una reimpresión voluntaria crea una clave nueva y queda señalada como reimpresión. El registro es local a esta PC; no es una garantía global si se reinstala el agente o se cambia de equipo.

## Integración con Carro Fogón

El POS guarda el pedido mediante su flujo actual y espera confirmación e identificador persistido. **Solo después** solicita la impresión local; delivery y retiro comparten el mismo camino de impresión, con los datos de destino correspondientes. El resultado de guardar y el de imprimir se representan por separado: «Pedido guardado; comanda enviada», o «Pedido guardado; no se pudo enviar a impresora» con botón para reintentar sin repetir el alta. Si el guardado falla, no se imprime. También se ofrece reimprimir desde Comandas usando el pedido ya guardado. El manejo de excepciones separará explícitamente ambas fases para que una excepción de impresión no se muestre como «Error al guardar el pedido».

Hay una incidencia de datos independiente que debe corregirse antes de validar el delivery: `pedidos.notas` es `NOT NULL`, mientras el POST actual puede enviar `null` cuando no hay nota. Esto ya produjo errores de base en pedidos de prueba. La corrección será enviar `''` para notas vacías y verificar que la API no sobreescriba el valor por defecto de la columna. No se usará impresión como explicación ni remedio de ese error.

## Integración con Impasto

El botón de imprimir del panel solicita al agente local la comanda del pedido que el operador está viendo, conservando el detalle de ítems, sabores y notas. Muestra «enviado a la cola» o el error con opción de reintentar. No cambia el pedido ni su estado de pago. Los pedidos de tarjeta pendientes o rechazados no deben confundirse con pagos aprobados: la comanda siempre muestra el estado real de cobro y no instruye «cobrar al entregar» por un rechazo. La impresión automática de pedidos web no forma parte de esta entrega.

## Formato del ticket

Ancho útil calibrado con la Epson de 80 mm; tipografía ESC/POS normal o doble para pedido y tipo de entrega, sin escala diminuta de página web. Orden: número/referencia y hora local; delivery o retiro; datos indispensables para preparar y entregar; cada ítem con cantidad, variantes y notas; total y estado de cobro; marca «REIMPRESIÓN» cuando corresponda. Se evitan datos sensibles innecesarios. El trabajo termina con un avance corto calibrado y comando de corte; jamás con una página fija de 297 mm. Caracteres españoles y signos monetarios se prueban físicamente y se elige la página de códigos compatible.

## Pruebas y criterios de aceptación

1. Prueba RAW aislada: comanda corta y larga, tildes/ñ, corte y medición. Una comanda corta debe terminar cerca del contenido, sin la cola en blanco observada de ~30 cm; si no, se detiene la integración.
2. Prueba de seguridad y navegador: health, emparejamiento, CORS, preflight y acceso a loopback desde las dos URLs reales; origen o secreto incorrecto no imprimen.
3. Pruebas unitarias del agente: composición de ESC/POS, saneamiento, límites de entrada, duplicado de clave, error de cola y reimpresión. No se imprimen datos de cliente en logs.
4. POS: guardar retiro y delivery, ambos con y sin notas, imprime una sola vez; error de guardado no imprime; impresora apagada conserva el pedido y ofrece reintento; el reintento no crea otro pedido.
5. Impasto: impresión manual de una comanda con variantes y detalle; estados de pago visibles con exactitud; fallo de agente no modifica pedido; reimpresión explícita.
6. Verificación presencial con la Epson TM-T20II en la PC operativa. La confirmación «enviado a la cola» se distingue de la salida física del papel.

## Despliegue y reversión

Primero se valida RAW y el navegador en la PC real. Luego se instala y configura el agente local, con arranque al iniciar sesión y un procedimiento simple de prueba y recuperación. Después se integra Carro Fogón y por último Impasto, conservando temporalmente la impresión tradicional como alternativa manual claramente etiquetada hasta pasar las pruebas físicas. Si el agente no está disponible, no se oculta el pedido ni se intenta guardarlo otra vez. No se requieren migraciones de InsForge para esta solución.

## Fuera de alcance

Impresión automática de pedidos web, impresión desde celulares u otras PCs, funcionamiento sin conexión, cambios de pricing/pagos, y confirmación de impresión física mediante sensores de la Epson. Cualquier ampliación de esos puntos exige un diseño propio.
