@AGENTS.md

## Masas de la noche y WhatsApp "en camino" (24/10/2026)

- **Pedido del dueño:** cargar en el Arranque cuántas masas (prepizzas) hay y que la venta de pizzas se corte sola al terminarse; si se olvida de cargarlas al abrir, poner en cualquier momento **cuántas le quedan ahora**. Decisiones (el dueño no eligió entre opciones: se tomaron las recomendadas): **un solo número** para napoletana y al molde, al llegar a 0 **se cortan solo las pizzas** (empanadas y bebidas siguen), web y POS.
- **Base:** migración `20261025000845_masas-noche.sql` (**aplicada el 24/10/2026** por CLI, antes del deploy; tabla, columna y función verificadas). Tabla `masas_noche (proyecto_id, noche, cupo, vendidas)`; `cupo` NULL = sin límite. La fila de la noche se crea con el primer pedido con pizzas, así `vendidas` siempre está al día aunque no se haya cargado nada. `masas_consumo()` cuenta una masa por pizza (web: `type` pizza / pizza-half; POS: trae `masa`, es mitad y mitad o el nombre es de una pizza). `crear_pedido_costeado` bloquea primero los cupos por sabor y después la fila de masas; si no alcanza, `MASAS_AGOTADAS|<quedan>`. `pedidos.masas_consumo` + `cupo_noche`; los triggers de los cupos devuelven y vuelven a sumar las masas (cancelar, pago rechazado, eliminar). `fijar_masas_restantes(proyecto, quedan)`: cupo = vendidas + quedan en un paso; NULL = sin límite.
- **Panel:** bloque **"Masas de la noche"** arriba de todo en el Arranque (`MasasNoche.tsx`, `GET/PUT /api/admin/masas`): − [número] + con "Me quedan", guarda solo (flechitas 700 ms después del último toque; el número al salir del campo o con Enter), "Quitar límite". Estados: sin cargar (ámbar, con aviso "cargá cuántas tenés"), quedan 3 o menos (ámbar), 0 (rojo, "pizzas cortadas"). Refresca cada 30 s.
- **Web:** `lib/masas-noche.ts` (con `tests/masas-noche.test.ts`). La carta lee la fila (no crítico: si falla, sin límite y la base igual controla) y marca `CatalogData.masasQuedan`; en 0 todas las pizzas salen Agotado. Arriba de las pizzas (`AvisoMasas`): "¡Quedan solo 3 pizzas esta noche!", "¡Queda la última pizza de la noche!" o "Por esta noche se terminaron las pizzas." (+ "Todavía podés pedir empanadas." si hay). La cotización frena con 409 (`validarMasasNoche`) y el rechazo de la base se traduce igual (`errorDeMasasDeLaBase` en `lib/orders.ts`). Un pedido con masas invalida el caché de la carta.
- **WhatsApp desde Pedidos:** `mensajeAlCliente(nombre, ref, modalidad)`: delivery "¡Hola, Juan! Te escribimos de Impasto: tu pedido IM-… ya está en camino. Por favor, quedate pendiente: enseguida te va a estar llegando." (25/10/2026: sin el 🛵 del final, que en el WhatsApp del cliente salía como "�"; un test impide volver a poner emojis; el mismo día "estate atento" pasó a "quedate pendiente", que no tiene género); retiro "… ya está listo para retirar."; desde Clientes, el saludo de siempre.
- **POS (Carro Fogón), rama `masas-noche`:** la carta saca las pizzas con 0 masas y el rechazo de la base sale como 409 con el motivo.
- **Verificado:** el SQL en la base real dentro de una transacción sin confirmar (conteo web/POS, sin límite, cargar "quedan" con ventas previas, rechazo, cancelar/reactivar, pago rechazado, 0 y quitar límite; sin rastro después). En local con la base real: la web sin la tabla sigue vendiendo (cotización 200, solo un log). El bloque del panel y los avisos de la web se vieron en páginas temporales (ya borradas) con la API simulada: carga de 40, tres toques = un solo guardado, 2, 0, quitar límite, 375 px sin desborde. `pnpm test`, `tsc`, eslint de lo tocado (solo los 3 errores previos), `pnpm build`; POS `npm test` y `npm run build`. **No visto:** el panel real con la sesión del dueño ni un pedido real rechazado por masas.
- **Arreglo del 25/10/2026 (reclamo del dueño en plena venta, con 4 masas):** el carrito dejaba sumar 5 pizzas sin aviso, y en el checkout el 409 del servidor se veía como "No se pudo actualizar el total" con el botón trabado en "Actualizando total…" (el `.catch` descartaba el motivo; también les pasaba a los cupos por sabor desde el 18/10). El pedido nunca se guardó de más: la base frenaba. Ahora: `/api/store-status` trae `masasNoche` fresco (inicial desde la carta); `CartProvider.add/inc/incKey` devuelven `false` y avisan con un toast si no alcanzan las masas (`topeDePizzas`); el carrito avisa "Sacá N del pedido para seguir" y deshabilita Continuar si las masas bajaron mientras armaba (`excesoEnCarrito`); el checkout muestra el motivo de un 409 y el botón dice "Revisá tu pedido". Verificado en local contra la base real (quedaban 4): 5ª pizza frenada desde la tarjeta, otro sabor y el + del carrito; con `/api/store-status` y la cotización simulados, el aviso del carrito y el del checkout. Carritos de prueba vaciados (local y producción).
- **Publicado el 24/10/2026** a pedido del dueño ("aplicá la migración y publicá la web y el POS"): migración primero, después merge de `masas-noche` en `main` y push (Netlify), y el POS en su `main` (Vercel).

## Masa al molde oculta cuando está apagada (23/10/2026)

- **Pedido del dueño:** esta semana no puede preparar masa al molde y prefiere que los clientes **ni sepan que existe** (antes, con el molde apagado, la web avisaba "se nos terminó la masa al molde"). La semana que viene la vuelve a prender.
- **Cómo funciona:** el mismo interruptor "Masa al molde" del **Arranque**. Apagado = la opción desaparece de toda la web: sin bloque en el home (`MasasAviso` no se muestra), el encabezado de Pizzas no nombra las masas, el carrito no muestra el selector, el checkout no dice "masa napoletana", el asistente no habla de masas y la pregunta "¿Puedo pedir la pizza al molde?" sale del FAQ (y del `FAQPage` del SEO). Todas las pizzas salen napoletanas (`ajustarMasas`, `validarMasas` siguen igual). En el Arranque el interruptor dice "Oculta en la web".
- **Sin napoletana** (la de la casa) sigue como antes: el cliente ve que todas salen al molde.
- **Código:** `estadoMasas` devuelve aviso vacío con el molde apagado; `masasVisibles(estado)` en `lib/masa.ts`; `lib/faq.ts` lee `business.masaMoldeActiva`. Tests en `tests/masa.test.ts` y `tests/chat-prompt.test.ts`.
- **Verificado en local** con `/api/store-status` interceptado: bloque del home oculto, encabezado de Pizzas sin masas, carrito sin selector; carrito de prueba vaciado. El FAQ depende de la base (se ve sin la pregunta recién con el molde apagado de verdad). `pnpm test`, `tsc`, eslint de lo tocado.

## Panel rediseñado (22/10/2026)

- **Pedido del dueño:** el panel era lento de usar: los títulos de sección no se veían, Pedidos medía 5.566 px de alto a 1366 px, Productos 8.496 y no había un lugar donde prender la noche. Quería un panel **compacto, que se use igual de bien en la compu y en el celular**. Spec: `docs/superpowers/specs/2026-10-22-panel-admin-rediseno-design.md`. Plan: `docs/superpowers/plans/2026-10-22-panel-admin-rediseno.md`. Rama `panel-rediseno`.
- **Decisiones:**
  - **Menú por momento de uso** (no por tabla de la base), con el estado del local arriba (píldoras) y una sección inicial según la noche: abre en la última sección de la sesión; si no hay, en noche de apertura abre **Arranque** y el resto de los días **Dashboard** (`seccionInicial`).
  - **Arranque** (`Arranque.tsx`): lo que se toca al abrir y cerrar, en bloques: venta, delivery y masas con interruptor (`Interruptor.tsx`), cupos de la noche (`Cupos.tsx`, `CupoControl.tsx`) y los pedidos activos. **Los interruptores ya no están en Configuración**: Configuración quedó en 4 pestañas (Horario, Delivery, Datos del local, Cuentas para transferencias), solo con lo que casi no cambia, y avisa si se sale con cambios sin guardar. (22/10/2026: el botón "Recargar datos" se sacó de Configuración; `SucursalProvider` ya refresca la fila al volver a la pestaña.) Cada interruptor guarda de a un PUT por campo: mientras uno está en curso se deshabilita, un segundo toque se ignora, el rollback de un fallo no pisa un éxito posterior y la recarga al volver a la pestaña se salta si hay un guardado pendiente (`cambiar` / `pendiente` en `SucursalProvider`).
  - **Tabla compacta de pedidos:** una línea por pedido (objetivo 40–44 px; **medido 47 px por fila** el 22/10/2026), con avanzar estado e imprimir en la misma fila; el detalle se abre aparte (`OrderDetail.tsx`). Productos y Clientes también en filas de una línea. Dashboard por noche de servicio.
  - **Estilo neutro:** fondo `#f6f7f9`, superficie blanca, bordes `#e3e6eb`, Inter en todo (22/10/2026: quedan unas pocas etiquetas en tipografía monoespaciada, p. ej. el número de pedido), radios 8–10 px. Sin Playfair, sin naranja en el panel (la pantalla de carga tampoco).
  - **Buscador global** en la barra superior (`BusquedaGlobal.tsx`): pedidos, clientes y productos; buscar no pierde el estado de Pedidos.
  - Se usa en compu y en celular (≤ 760 px, menú por hamburguesa).
- **Causa del título invisible y arreglo:** `app/layout.tsx` importaba `impasto.css` para todas las rutas y su `.topbar` (más `.btn` y `h1…h5`) pisaba las del panel: el título salía `rgb(246,241,231)` sobre blanco. Arreglo (`07b428e`): la web pública pasó a `app/(sitio)/` (home, `pedido/`, `terminos/`, `privacidad/`, `reembolso/`, `cocina/`, `error.tsx`) con su propio layout, que es el único que importa `impasto.css`. Las URLs no cambian. **No volver a importar `impasto.css` en `app/layout.tsx`**: el panel (`/admin`, `/admin-login`) vuelve a quedar con los títulos invisibles. Lo que use una página nueva de la web va dentro de `app/(sitio)/`.
- **Módulos nuevos:** `lib/admin-pedidos.ts` (activos, siguiente estado, número corto; tests), `lib/inicio-admin.ts` (sección inicial según la noche), `lib/admin-dashboard.ts` (comparación de la noche, más vendidas, noches para el gráfico), `lib/busqueda-admin.ts` (búsqueda global). Componentes: `SucursalProvider` (estado del local compartido: la fila de `sucursales` y sus interruptores; el mail de la sesión vive en `AdminSesion`, no acá), `OrdersTable`, `OrderDetail`, `Arranque`, `BusquedaGlobal`. Reglas que no cambian: `esPedidoParaCocina` bloquea avanzar e imprimir una tarjeta sin acreditar; `updateOrderStatus` es el único camino para cambiar estados; `useCuposNoche` guarda a los 700 ms; `@media print` y `.comanda-print-ticket` intactos.
- **Medido (22/10/2026, sesión del dueño, base real):** Pedidos (Todos) **5.566 → 2.582 px** a 1366 px; Productos **8.496 → 1.282**; Dashboard **1.247 → 477**; el Arranque entra en **697 px**; sin desborde horizontal en ninguna sección. Verificado también: `pnpm test`, `tsc`, eslint de lo tocado y `pnpm build`.
- **Detalles del repaso final:** toast con ícono alineado, pantalla de carga neutra, "Sin semana previa" en el KPI, cantidades de "Más vendidas" con `formatoUnidades` (docenas de empanadas fraccionarias), avisos sin entregar en una barra de una línea ("Ver" / "Ocultar"), "En carta" con su contador, tooltip en "Salir".
- **Revisión final (22/10/2026):** `app/admin/error.tsx` (pantalla de error propia del panel), WhatsApp y casilla de selección también en las tarjetas del celular, "Sin ventas todavía" en el KPI de la noche cuando aún no hay ventas, toast de estado con número corto y etiqueta legible, reintentos de impresión compartidos entre Arranque y Pedidos (a nivel módulo en `Orders.tsx`), Ctrl/⌘+K sin efecto con un modal abierto y selección de pedidos que se limpia al cambiar filtro o búsqueda.
- **No verificado todavía:** los interruptores del Arranque contra la base real (prender y apagar delivery y una masa), el panel en un **celular real** (a 375 px en el navegador del escritorio no es lo mismo que el teléfono), y la **impresión desde el botón nuevo de la fila** de Pedidos (el agente térmico no se probó con la tabla nueva).
- **Sin publicar:** la rama `panel-rediseno` no se pusheó; el push a `main` (que publica en Netlify) lo autoriza el dueño después de ver las capturas.

## Masa agotada desde el panel (22/10/2026)

- **Pedido del dueño:** si se queda sin una de las dos masas (napoletana o al molde), apagarla desde el panel y que el cliente no la pueda elegir, con el mensaje correcto.
- **Panel → Configuración → Masas:** "✓ Napoletana disponible / ✕ Napoletana agotada" y lo mismo para al molde, con "Guardar cambios" (como el delivery). (22/10/2026, panel nuevo: estos dos interruptores están ahora en **Arranque** y se guardan al tocarlos, sin "Guardar cambios"; Configuración ya no tiene la pestaña Masas.) **No se pueden apagar las dos**: el botón se deshabilita y `PUT /api/admin/sucursal` responde 400 ("si no hay ninguna, pausá la venta"). Debajo se ve el texto que lee el cliente.
- **Base:** `sucursales.masa_napoletana_activa` y `masa_molde_activa` (`boolean not null default true`, migración `20261022122713_masas-disponibles.sql`, **aplicada el 22/10**). Sin la columna cuentan como disponibles. `BusinessConfig.masaNapoletanaActiva/masaMoldeActiva`.
- **Lógica** en `lib/masa.ts` (con tests): `estadoMasas` (aviso "Hoy se nos terminó la masa al molde: todas las pizzas salen con nuestra napoletana." o al revés; las dos apagadas = las dos disponibles), `masaUnica`, `ajustarMasas` (pasa las pizzas a la que queda y junta líneas), `validarMasas`. Viaja en `EstadoTienda.masas` (página y `/api/store-status`, refresco cada 60 s y al volver a la pestaña).
- **Cliente:** el carrito deriva sus ítems con `ajustarMasas` (`CartProvider`: `items` es un `useMemo` de lo guardado; cada cambio parte de lo ajustado), muestra el aviso arriba de los ítems y el botón de la masa agotada deshabilitado ("Al molde · agotada"). Si la masa vuelve en la misma visita, la pizza recupera la masa que el cliente había elegido. El bloque del home dice "Hoy, solo masa napoletana" con la otra en gris ("Hoy agotada") y el encabezado de Pizzas "Hoy todas salen con masa napoletana.". El bot recibe "- HOY: …" y no ofrece la otra.
- **Servidor:** `validarMasas` en `/api/orders/quote` (el checkout se entera antes de confirmar) y en `createPedidoNew`, después de `validarModalidad`: ninguna vía de pago acepta una masa agotada. Mensaje: "Hoy se nos terminó la masa al molde. Abrí el carrito: tus pizzas pasan a napoletana."
- **POS (Carro Fogón) no lo lee:** los operarios siguen viendo las dos masas.
- **Verificado en local** (base real con las dos masas, `/api/store-status` interceptado en el navegador para simular cada masa agotada): carrito en escritorio (pizza al molde pasa a napoletana, aviso, botón deshabilitado; y al revés), home a 375 px, vuelta a las dos, cotización con molde 200, PUT del panel sin sesión 401; carrito de prueba vaciado. `pnpm test`, `tsc`, eslint de lo tocado, `pnpm build`. **No visto:** la sección del panel (pide la contraseña del dueño) ni el rechazo del servidor contra la base (el modo auto no dejó apagar la masa en la base compartida; lo cubren los tests).

## Masa al molde — web y POS publicados (22/10/2026)

- **Pedido del dueño:** además de la napoletana (la de la casa), el cliente puede elegir masa **al molde**. Mismo precio, todas las pizzas (también la mitad y mitad), se elige **en el carrito, pizza por pizza**, con napoletana por defecto. Diseño: `docs/superpowers/specs/2026-10-17-masa-al-molde-design.md`. **El dueño aprobó cómo quedó todo** el 17/10.
- **Estado de la web: publicada el 22/10/2026** (merge de `masa-al-molde` en `main` y push, a pedido del dueño: "pushearla para desplegarla"). Netlify publica solo. Antes de publicar se trajo `main` a la rama conservando los dos lados (resumen diario, cupos, sesión del panel, medio de pago y la ✕ de bebidas, que estaba duplicada).
- **POS (Carro Fogón): publicado** en su `main` (`686ca40`, deploy de Vercel en verde) el 17/10, con permiso del dueño. Los operarios ya ven el selector de masa y los tickets del POS ya dicen [NAPOLETANA] / [AL MOLDE]. Ver el `CLAUDE.md` de carroFogon.
- **Home:** bloque `MasasAviso` entre el hero y las promos ("Nuevo · ¿Preferís la masa tradicional al molde?" + "Ya la tenemos, al mismo precio. En el carrito elegís el tipo de masa para cada pizza.", texto cambiado el 30/10/2026 a pedido del dueño; antes decía "Ahora también, al molde"). En escritorio: texto + botón "Ver pizzas" y las dos masas con descripción. **En celular (≤760 px) es una franja compacta** de ~200 px: título, una frase y las dos masas como chips en una fila, sin descripción ni botón (al dueño le pareció una "guarangada" la versión grande). Encabezado de Pizzas: "Masa napoletana o al molde: la elegís en el carrito."
- **Carrito:** fila propia por pizza, en un recuadro de una sola línea: "Elegí la masa" + interruptor Napoletana / Al molde (la elegida en terracota con ✓). Sin descripciones (el dueño pidió achicarlo). "¿Algo para tomar?" tiene una ✕ que lo oculta por esa visita (`sessionStorage` `impasto_sin_bebidas`). El resumen del checkout dice "masa napoletana" / "masa al molde".
- **Código:** `lib/masa.ts` (tipo, normalización, merge de líneas, `nombreCocina`, `masaCocina`, `detalleCocina`, `contarMasas`), `CartItem.masa`, `quoteItem` normaliza y pone `detail` "Masa al molde" (además borra cualquier `detail` que mande el navegador en pizzas y bebidas). Se guarda en `pedidos.productos` sin migración. Comanda de cocina impresa, comanda en pantalla y Telegram: la masa va **en el nombre**, que la impresora pone en negrita (`2 x Fugazzetta [NAPOLETANA]`, `1 x Muzzarela [AL MOLDE]`); se nombran las dos masas a pedido del dueño, y los pedidos de antes no llevan etiqueta. Los ítems del POS no traen `type`: sin `type` se confía en `masa`. La copia del cliente sigue con el nombre limpio y "Masa al molde" en el detalle. Panel: etiqueta NAPOLETANA / AL MOLDE en el detalle del pedido y "Masas elegidas" en el Dashboard (solo ítems con `masa`, web y POS).
- **Asistente:** FAQ nueva ("¿Puedo pedir la pizza al molde?") y prompt con las dos masas y cómo se elige (al abrir el carrito, no en la tarjeta). Probado en local con preguntas reales: responde bien. `lib/marca.ts` ("sin moldes") describe la napoletana y no se tocó. Visto de paso: a una pregunta en portugués contestó en español (no es de esta tarea).
- **Verificado en local** con la base real: home (escritorio y 375 px), selector del carrito, cierre de bebidas, borrador del servidor con `masa`. `pnpm test` (incluye `tests/masa.test.ts`, 11 casos), `tsc` y eslint de lo tocado (solo los errores previos de setState en efectos). **No verificado:** resumen del checkout (venta cerrada, no se prendió), panel (necesita login) ni impresión real.
- **Pendiente tras publicar:** mirar el home en celular, un pedido de prueba en el panel y el primer ticket impreso. El costeo de una pizza al molde usa la receta napoletana hasta que el recetario tenga la del molde.

## Cerrar "¿Algo para tomar?" en el carrito (21/10/2026)

- **Reclamo del dueño:** "los clientes podían quitar las bebidas con un botón y ya no". La ✕ que cierra las sugerencias de bebidas del carrito estaba **solo en `bb18d04`, dentro de la rama local `masa-al-molde`**, que nunca se publicó: los 25 últimos deploys de Netlify (hasta `e0fa509`, 19/10) salieron todos de `main` y el CSS de producción no tenía `.upsells-cerrar`. Lo vio en local, no en la web.
- **Arreglo:** solo la ✕ pasa a `main`, sin la masa al molde (que sigue esperando al dueño): `CartDrawer.tsx` (`SIN_BEBIDAS`, `sessionStorage`: no vuelve a aparecer en esa visita; el pedido no cambia) y `.upsells-acciones` / `.upsells-cerrar` en `impasto.css`. Mismo código que `bb18d04`: **al mergear `masa-al-molde`, quedarse con una sola copia** (va a dar conflicto en esas líneas).
- Verificado en local con la base real: la ✕ aparece, al tocarla se va "¿Algo para tomar?" y la pizza sigue en el pedido; carrito de prueba vaciado (`/api/cart/draft` con `items: []`). `pnpm test`, `tsc`, eslint del archivo y `pnpm build`.

## Corregir el medio de pago desde el Resumen diario (18/10/2026)

- **Pedido del dueño:** el POS a veces carga mal el medio (efectivo / transferencia / Mercado Pago) y la rendición del efectivo del delivery no cierra. En **Resumen diario → "Pedidos de la noche"** cada pedido tiene un selector de medio (con confirmación). Los pagos con **tarjeta de la web** (`proveedor_pago = mercadopago`, `mp_order_id` o `id_pago`) no se tocan.
- **Base:** `corregir_medio_pago(pedido, metodo)` (migración `20261019021530`, aplicada y probada dentro de `BEGIN … ROLLBACK`): cambia `metodo_pago`; si ya había cobros en `pedido_movimientos` (libro inmutable), pasa el neto de cada otro medio al nuevo con un par devolución + cobro de clave `correccion-medio:<n>:<medio>:salida|entrada` y la fecha del cobro original; **a Mercado Pago lo da por cobrado** (`estado_pago = aprobado`, decisión del dueño), y deja un `pedido_eventos` `pago / medio:<metodo>`. Errores: `MEDIO_NO_EDITABLE`, `PEDIDO_NO_ENCONTRADO`, `MEDIO_INVALIDO` (`lib/medio-pago.ts`).
- **Lectores del libro:** la corrección suma y resta por medio pero **no es devolución ni cobro nuevo**: `resumenGuardado` (`lib/payment-ledger.ts`), la caja del POS (`saldoMovimientos`, `142fbb7`) y Ganancias del recetario (`aa5b117`; deploy de Netlify no confirmado, otra cuenta). Android del recetario no lo tiene: ahí se vería como devolución + cobro.
- **Panel:** `POST /api/admin/pedidos/[id]/medio`, `updateOrderMethod` en el store (reemplaza el pedido con el que devuelve la base), `AdminOrder.medioEditable`. Un MP sin confirmar se marca "sin confirmar · no suma".
- **Verificado:** SQL en la base con rollback (efectivo cobrado → transferencia → MP, pendiente → MP con cobro registrado, mismo medio sin cambios, tarjeta rechazada), tests de los tres proyectos, builds. **No visto:** la tabla en el panel (pide contraseña).

## El panel ya no se cierra a los 15 minutos (18/10/2026)

- **Síntoma (dueño):** el panel se bloqueaba "cada 5 o 10 minutos" y había que volver a entrar con usuario y contraseña.
- **Causa:** en el InsForge propio el acceso dura **15 min** (`ACCESS_TOKEN_EXPIRES_IN`) y la renovación **7 días**. `getCurrentAdmin` (página /admin y las 21 rutas `/api/admin`) solo leía la cookie `insforge_access_token`, que vence con el token; la cookie `insforge_refresh_token` (httpOnly, la guarda el login) nunca se usaba y `/api/auth/refresh` no la llamaba nadie.
- **Arreglo:** `getCurrentAdmin` llama a `updateSession` (`@insforge/sdk/ssr/middleware`) antes de validar: si el acceso venció o vence en menos de 1 min y está la renovación, pide uno nuevo y lo guarda en la respuesta. En el layout (Server Component) Next no deja escribir cookies: `cookiesTolerantes` (`lib/admin-sesion.ts`, con test) ignora ese error y la renovación igual sirve para esa carga. Las renovaciones de InsForge son JWT sin estado (no rotan ni se revocan), así que dos rutas renovando a la vez no se pisan. Como el panel sondea cada 15 s, la sesión se estira sola mientras está abierto; cerrado, dura hasta 7 días.
- **Verificado en local** contra el servidor real: sin sesión 401; con una renovación inválida intenta renovar, InsForge la rechaza, se borran las cookies y /admin manda al login. `pnpm test`, `pnpm build`. **No verificado:** el camino feliz con una sesión real (requiere la contraseña del dueño): confirmarlo dejando el panel abierto más de 15 min.

## Cupos de la noche (18/10/2026)

- **Pedido del dueño:** cargar cuántas pizzas de cada sabor se pueden vender esta noche (de a media: "1,5 Fugazzetta"). Al agotarse sale **Agotado** en la web y desaparece de la carta del POS. Diseño: `docs/superpowers/specs/2026-10-18-cupos-noche-design.md`.
- **Lo controla la base**, para web y POS a la vez: `migrations/20261018202351_cupos-noche.sql` (aplicada el 18/10). Tabla `cupos_noche` en **mitades**; `crear_pedido_costeado` descuenta y, si no alcanza, lanza `CUPO_AGOTADO|<nombre>|<mitades que quedan>` y el pedido no se guarda. Cancelar, pago rechazado o eliminar devuelven el cupo (trigger, `cupo_liberado`). Noche: `noche_de_negocio()`, de 06:00 a 05:59 (UTC-3). Sin fila de cupo, sin límite.
- **Servidor propio:** `db migrations up` corre como `project_admin`, que es dueño de todo; **no poner `OWNER TO postgres`** en migraciones nuevas ("must be member of role postgres"). El CLI rechaza bloques `DO`: para probar SQL sin dejar rastro, `psql` por SSH (`docker compose exec -T postgres psql` en `~/insforge`) dentro de `BEGIN … ROLLBACK` con `SET LOCAL ROLE project_admin`.
- **Web:** `lib/cupos.ts` (con `tests/cupos.test.ts`). La carta lee los cupos (no crítico) y marca `Pizza.quedanMitades`; aviso con 2 o menos **dentro de la tarjeta, arriba del botón** (`components/ui/AvisoCupo.tsx`, `.cupo-aviso`; cambiado el 18/10 porque como cartelito sobre la foto no se veía): franja "¡Quedan solo 2 esta noche!" en tarjeta, destacada y ficha, y en las filas (celular y lista) una **barra terracota sobre la miniatura** "¡Quedan 2!" / "¡Última ½!" (`.cupo-foto-bar`, como la de Agotado): una píldora junto al precio lo corría y dejaba un hueco (dueño, 18/10); con media restante "Agregar" abre la mitad y mitad. La cotización (`quoteOrder`, no el borrador) frena lo que pasa el cupo con 409; el rechazo de la base se traduce igual (`errorDeCupoDeLaBase` en `lib/orders.ts`). Un pedido que consume cupo invalida el caché de la carta.
- **Panel (cambiado el mismo 18/10 a pedido del dueño):** el número es **"cuántas quedan para vender esta noche"**. Todas las pizzas arrancan la noche en **100** (sin fila = sin límite; 100 o más borra la fila) y el dueño baja las que tiene pocas. Se maneja con − [número] + **en la tabla de Productos** (columna "Quedan hoy", reemplazó al `stock` de mentira, que valía siempre 24 y no se guardaba) y en la sección "Cupos de la noche" (22/10/2026: la columna "Quedan hoy" de Productos se sacó; los cupos se editan solo en el **Arranque**, como grilla): `CupoControl.tsx` (`useCuposNoche`, guarda 700 ms después del último toque). `PUT /api/admin/cupos {producto_id, quedan}` llama a `fijar_cupo_restante` (migración `20261018210003`): cupo = vendidas + quedan en un solo paso, así un pedido que entra justo no se pisa. Cada venta descuenta sola.
- **Verificado:** en la base, dentro de `BEGIN … ROLLBACK`: entera web, rebote, mitad y mitad del POS por nombre, cancelar, reactivar, pago rechazado y pizza sin cupo. En local con la base real y la venta cerrada: cartelito, cotización (pasa justo / frena de más), última media que abre la mitad y mitad, y Agotado; el cupo de prueba se borró. `pnpm test`, `pnpm build`, `tsc`, eslint. **No visto:** la pantalla del panel (pide contraseña). Pedidos sin costeo no se pueden eliminar (regla previa), así que el trigger de eliminación es solo red de seguridad.

## Resumen diario en el panel (17/10/2026)

- **Pedido del dueño:** ver por noche cuántas unidades vendió y cuánto en efectivo, transferencia y Mercado Pago. **Unidad = una pizza (entera o mitad y mitad) o una docena de empanadas.** Sección nueva "Resumen diario" del panel, debajo de Dashboard. Diseño: `docs/superpowers/specs/2026-10-17-resumen-diario-design.md`.
- **Cómo cuenta:** noche de 06:00 a 05:59 (UTC-3, como el POS); web y POS juntos con la regla del Dashboard (`esPedidoValidoParaVentas`). Arriba la noche elegida (unidades, pedidos, total con envíos, y una tabla por medio de pago); abajo hasta 30 noches. El POS no guarda `type`: pizzas y empanadas se reconocen por el nombre de la carta (por **categoría**, porque el panel marca "pizza" a todo lo que no es empanada ni bebida) y "Mitad … / Mitad …". Las cajas web "Caja x6/x12/x24" valen 0,5 / 1 / 2. `AdminOrder.canal` (web/POS) sale de `external_reference`.
- **Código:** `lib/resumen-diario.ts` (con `tests/resumen-diario.test.ts`), `app/admin/components/ResumenDiario.tsx`, entrada en `Sidebar` y `page.tsx`. Sin cambios en la base.
- **Verificado en local:** `pnpm test`, `pnpm build`, `tsc` y eslint de lo tocado; la lógica corrida contra los pedidos reales de las últimas 3 semanas (sáb 17/10: 6 pizzas, 5 web y 1 POS, 4 pedidos, $135.500: $68.000 efectivo y $67.500 transferencia; lo único del POS que no cuenta son agua y vino). **No se vio la pantalla** en el navegador: el panel pide la contraseña del dueño.
- **La masa al molde sigue aparte**, en la rama local `masa-al-molde` (sin push): este resumen salió de `main` sin esos cambios.

## Se trabaja solo de viernes a domingo (14/10/2026)

- **Decisión del dueño:** viernes, sábado y domingo, 19:30 a 00:00 (último pedido 23:45), **con delivery y retiro**. De lunes a jueves, cerrado.
- **Base (`sucursales` iguazu), cambiada el 14/10 por CLI:** `horarios` "Viernes a Domingo · 19:30 — 00:00", `dias_apertura` "0,5,6", `delivery_activo` true (estaba pausado y la web decía "solo retiro"), `mensaje_cierre` "Abrimos de viernes a domingo, de 19:30 a 00:00, con delivery y retiro." (antes "Venta cerrada hasta próxima inaguración"). **`ventas_activas` sigue en false a pedido del dueño:** lo prende él desde el panel el viernes. Con la venta prendida, el horario solo cierra de lunes a jueves ("Cerrado · abre vie 19:30"). También `info_empresa_impasto` (horarios), que hoy no lee ninguna app.
- **Código:** `BUSINESS` (valor por defecto, y lo que usan términos, la miniatura OG y la pantalla de error) pasa a viernes a domingo. `listaDeDias` (`lib/hours.ts`) arma "viernes a domingo" / "lunes a jueves" con tramos de 3+ días; `diasCerrados` la usa ("Lunes a jueves cerrados"). `llms.txt` ya no tiene "Lunes: cerrado" ni "23:45" fijos. La cinta de la home dice "Viernes a domingo · último pedido 23:45" desde el panel. La pantalla de error ahora dice los días y horas en que se toman pedidos por WhatsApp (antes no los decía porque no estaban confirmados).
- Verificado en local con la base real: footer, cinta, barra, FAQ, JSON-LD (Fri/Sat/Sun), `llms.txt`, términos y `/api/store-status`. `pnpm test`, `tsc`, eslint de lo tocado (solo el error previo de `Shell.tsx:127`).
- **Fuera de la web, a cargo del dueño:** Google Business Profile, bio de Instagram y estados de WhatsApp.
- **Asistente (chat) probado en producción el 14/10** con la base nueva: "¿qué días abren?", "¿puedo pedir el martes?", "¿delivery el sábado?" y "¿están abiertos ahora?" → responde viernes a domingo 19:30–00:00, último pedido 23:45, lunes a jueves cerrado, y que hoy está cerrado.
- **Instagram oficial: `@pizzas.impasto`, con punto** (verificado en instagram.com el 14/10/2026: "Impasto · Pizzas a la piedra"). `@impasto.iguazu` (lo que tenía la web) no es de Impasto. El 14/10 se publicó por error `@pizzasimpasto` sin punto (`30a3b2e`) por un mensaje tipeado sin el punto; el dueño avisó que no abría y se volvió a `@pizzas.impasto`. Sale de `BUSINESS.instagram` (footer, chat, `llms.txt`, `sameAs` del JSON-LD); también `info_empresa_impasto`.

## InsForge propio en Oracle Cloud: `api.impastopizzas.com` (14/10/2026)

- **Por qué:** InsForge cloud dejó la organización `blocked` aun con el ciclo nuevo en 0 GB (`projects restore` → "Organization is blocked"; su FAQ: pausado "until you upgrade"). El dueño no quiere pagar Pro. Se mudó la base a **InsForge OSS 2.3.4** (mismo código y API: solo cambian URL y claves) en Oracle Cloud São Paulo, detrás de **`https://api.impastopizzas.com`** (registro `A api` en Hostinger; Caddy con Let's Encrypt).
- **Máquina actual = puente pago con créditos de prueba** (`VM.Standard.E3.Flex`, 1 OCPU/8 GB, ~US$27/mes de lista). **Vence con la prueba (~12/11/2026)**: hay que mudarla a la ARM Always Free (`VM.Standard.A1.Flex`). Los reintentos para conseguirla corren desde la PC del dueño (`PROYECTOS/servidor-impasto`, tarea de Windows "Impasto - pedir servidor ARM"). Detalle operativo (SSH, respaldos, restauración) en la memoria de Claude, no acá: este repo es público.
- **Datos:** las 29 tablas de `public` con las mismas filas que el backup del 12/10, los 2 usuarios reales con su contraseña, metadatos de storage y las 54 migraciones propias. **Fotos:** el backup de InsForge no las trae; se recuperaron 66 de la PC del dueño (comparadas por tamaño exacto). Sin archivo quedaron `2.png`, `3.png`, `Cinque Formaggi.jpg`, `Diavola al Miele Piccante v2.jpg` (sin uso) y 4 comprobantes de transferencia de clientes.
- **Migraciones:** InsForge OSS las corre como `project_admin`; los objetos de `public` se pasaron a ese dueño (si no, "must be owner of table"). `migrations/20261013200000_pedidos-updated-at.sql` **ya está aplicada** (14/10/2026, por CLI): el panel ya sondea incremental. `.insforge/project.json` apunta al servidor nuevo (copia de la conexión vieja en `.insforge/project.cloud-3agqcygs.json.bak`).
- **Producción:** Netlify `INSFORGE_API_BASE_URL`/`INSFORGE_API_KEY` nuevas; fotos fijas y CSP/`remotePatterns` al host nuevo (`765986c`). Verificado el 14/10: home con carta y 24 fotos del host nuevo, sin referencias a `3agqcygs`. Carro Fogón (Vercel `INSFORGE_URL`/`INSFORGE_ANON_KEY`, server-only) y el recetario (Netlify, ahora con la **anon key real**: antes publicaba la `ik_` admin en el navegador) redeployados. **El dueño confirmó el 14/10/2026 que los tres funcionan.**
- **Aviso de caídas:** `.github/workflows/vigilar-servidor.yml` revisa cada 10 min `api.impastopizzas.com/api/health` y `/api/store-status` de la web (3 intentos) y manda un mail por Resend **solo al cambiar de estado** (caído / volvió). Destinatario y key en los secrets `ALERTA_EMAIL` y `RESEND_API_KEY`. Mail de prueba: correr el workflow a mano con `probar_mail` (probado el 14/10/2026). GitHub desactiva los cron de un repo público tras 60 días sin actividad.
- **Pendiente:** apps Android (recompilar con URL y clave nuevas; el dueño autoriza los builds), subir los pedidos del modo `/sin-base`, y que el dueño pruebe login y guardado en el recetario con la anon key.

## Base pausada por InsForge: límite de egress del plan free (12/10/2026)

- **Qué pasó:** el 12/10/2026 a las 14:02 (hora AR) InsForge pausó `App_PedidosDelivery` con `paused_reason: usage_limit_exceeded`: **egress 5,52 GB contra 5 GB** (5368709120 bytes) del plan free. Cayeron juntos la web ("No pudimos cargar la carta"), el panel, Carro Fogón y el recetario, porque comparten la base. Los datos quedaron intactos.
- **Diagnóstico rápido si se repite:** `/api/health` del backend da 503 "No backend services available"; `npx -y @insforge/cli projects get --json` muestra `status: paused` y el `paused_reason`; `npx -y @insforge/cli usage --json` trae `exceeded_limits`. No es un error de código.
- **Cómo se vuelve:** `npx -y @insforge/cli projects restore` (el modo auto de Claude lo bloquea: lo corre o lo autoriza el dueño) o **Restore Project** en el panel. Según el FAQ de InsForge, una pausa por límite de uso sigue "until you upgrade"; **no está confirmado** que se pueda restaurar gratis cuando empieza el ciclo nuevo. Ciclo de facturación: del 14 al 13 de cada mes según la CLI (el panel lo muestra un día antes por la zona horaria). Pro: US$25/mes (US$20 pagando el año), 250 GB de egress y US$0,09 por GB extra, sin pausas. Un proyecto free pausado se puede restaurar hasta 30 días después de la pausa.
- **Backup del momento de la pausa:** el dueño lo bajó del panel (`20261012_170230.sql.gz`). **Tiene datos de clientes: no va a ningún repo** (los dos son públicos). Los precios exactos de la web salen de leer sus bloques COPY sin ejecutar el SQL y pasarlos a `assembleCatalogFromResults` (`lib/catalog-source.ts`). Ojo: `config_negocio.comision_en_precio` es `text[]`; leerlo como booleano deja afuera la comisión y baja todos los precios ~$1.500. Precios al 12/10: Muzzarella Impasto $16.500, Fugazzetta $18.000, Muzzarela y Jamon $20.000, Napoletana all'Aglio $20.500, resto de $21.000 a $24.500; Coca-Cola $6.500, 7-Up y Pepsi $4.500. En venta: 13 pizzas y bebidas; ninguna empanada activa.
- **Cómo se siguió vendiendo:**
  - **Carta para WhatsApp:** `output/carta-whatsapp/` (`carta-impasto-1..3.png` de 1080×1920 y `carta-impasto.pdf`): pizzas y bebidas con los precios del backup y las fotos de `C:\Users\spezi\Pictures\Impasto\Pizzas`. Se armó en HTML y se exportó con Chrome headless; el generador quedó en el scratchpad de la sesión, no en el repo.
  - **POS en modo sin base:** `carro-fogon.vercel.app/sin-base`, carta fija y pedidos guardados en el navegador, con impresión normal. Detalle en la sección "Modo sin base" del `CLAUDE.md` de Carro Fogón. Publicado con `a1dcf30`; **el dueño confirmó el 12/10/2026 que funciona.**
- **De dónde salía el egress:** ver "Egress: panel incremental y carta en caché (13/10/2026)", justo abajo.
- **Por qué no mudarse (evaluado el 13/10/2026):** Supabase free tiene el mismo tope de 5 GB y pausa proyectos inactivos; mudarse implica reescribir login, fotos y consultas en las 3 apps y Android. Si algún día hace falta independizarse, el camino es InsForge en un servidor propio (es open source, mismo código, solo cambian URL y claves). Primero se bajó el consumo.
- **Pendiente:** restaurar el proyecto; subir a la base los pedidos tomados sin base (desde el JSON que exporta el POS); publicar la tanda de egress y medir el resultado.

## Egress: panel incremental y carta en caché (13/10/2026)

- **Medido sobre el backup de la pausa** (tablas completas en JSON, aproximado): el panel bajaba **todos** los pedidos cada 15 s (33 pedidos = 35 KB; ~84 MB/día con el panel abierto 10 h, y crece con cada pedido); cada visita a la home leía ~280 KB de 12 tablas, igual que `manifest`, `opengraph-image`, `llms.txt` y `/api/productos` en cada pedido (los cuatro `force-dynamic`); el POS recalculaba la carta (~280 KB) en cada montaje y al volver a la pestaña.
- **Panel:** migración `migrations/20261013200000_pedidos-updated-at.sql` (`pedidos.updated_at` + trigger `pedidos_marcar_actualizado` + índice `(proyecto_id, updated_at)`). `GET /api/admin/pedidos?desde=<ISO>` trae solo lo que cambió (`gte updated_at`); sin `desde`, todo como antes. `StoreProvider` guarda el cursor (máximo `updated_at` visto), pide `desde = cursor − 60 s` (las transacciones que confirman tarde quedan cubiertas) y une por `_dbId` (`lib/pedidos-incrementales.ts`, con test); cada 40 sondeos (10 min) pide la lista completa. **Sin la columna** las filas no traen `updated_at`, el cursor queda nulo y el panel sigue con la lista completa: no se rompe si el deploy llega antes que la migración. La campanilla no cambia (el historial de conocidos es monótono).
- **Carta para mostrar:** `getCatalogDataVisible()` (`lib/catalog-cache.ts`) = `unstable_cache` de 60 s (tag `catalogo`), **nunca más vieja que 5 min** (`catalogoVigente`, `lib/catalog-vigencia.ts`, con test): pasado eso lee fresco y, con la base caída, error como siempre. La usan la home, `manifest.ts`, `opengraph-image.tsx`, `llms.txt` y `/api/productos`. **La cotización, el pedido y el chat siguen con `getCatalogData()` fresco** (A09 intacto). `invalidarCatalogo()` en las mutaciones del panel de productos (alta, edición, baja, foto), etiquetas y testimonios. Decisión del dueño (13/10/2026): un precio cambiado en el recetario tarda hasta 1 minuto en verse en la home. `unstable_cache` serializa a JSON: el costeo (WeakMap) no viaja; no usar `getCatalogDataVisible` para cobrar.
- **POS (Carro Fogón):** carta recalculada como mucho cada 5 minutos (decisión del dueño); ver su `CLAUDE.md`.
- `tests/carta-visible.test.ts` simula `@/lib/catalog-cache` además de `@/lib/catalog`.
- **Orden de publicación:** correr la migración (`npx -y @insforge/cli db migrations up --all`, nunca `db query`) **antes** del deploy de Impasto; necesita la base restaurada. Verificado en local (13/10/2026): `pnpm test` (180 tests + 665 casos), `tsc`, eslint de lo tocado, `pnpm build`. **Publicado** con `0053ca9` (Netlify `ready` el 13/10/2026); **la migración todavía no corrió** (base pausada): hasta entonces el panel sigue con la lista completa. **Sin medir todavía:** que el sondeo con `?desde` devuelva `[]` sin cambios y traiga un pedido nuevo, y el egress diario antes/después. Las fotos del bucket `DB` quedaron afuera hasta medirlas con los registros.
- Spec y plan: `docs/superpowers/specs/2026-10-13-reducir-egress-design.md`, `docs/superpowers/plans/2026-10-13-reducir-egress.md`.

## Estado de error de la tienda y pedidos por WhatsApp (12/10/2026)

- `app/error.tsx` usa una tarjeta clara con el logo oficial (`public/logo.png`), sin ilustración generada. El CTA principal abre WhatsApp con el mensaje de pedido prellenado y la configuración existente; **Reintentar** queda como acción secundaria.
- Copy aprobado por el dueño: “La tienda online no está disponible en este momento, pero estamos tomando pedidos por WhatsApp. Escribinos y te ayudamos.” El 12/10 se retiró la mención a viernes-domingo porque no estaba confirmada; el 14/10 el dueño la confirmó y la pantalla dice los días y horas desde `BUSINESS` (ver "Se trabaja solo de viernes a domingo").

## Testimonios: nombre completo y qué pizza probó (12/10/2026)

- **Pedido del dueño:** la opinión de un pedido real (Carlos Alberto Barrios, 11/10) llegó como "Carlos", sin producto, y el panel mostraba la referencia `IM-MAN-…`: aprobada, la web habría dicho "— Carlos · Cliente de Impasto".
- **Seguimiento:** el nombre del formulario se completa con el del pedido **entero** (decisión del dueño), `nombreParaPublicar` en `lib/opiniones.ts` (una línea, hasta 40, corta palabras enteras). El cliente lo puede cambiar.
- **Sin producto elegido, la opinión queda sobre todo lo que compró** (`productoDeLaOpinion`): las pizzas por nombre (la mitad y mitad en sus dos gustos) y "Empanadas"; nunca bebidas. Varios se guardan en `testimonios.producto` separados por `" + "` (`SEPARADOR_PRODUCTOS`) y `lineaProducto` los lee: "Probó la Diavola al Miele Piccante y la Muzzarela y Jamon".
- **Panel → Testimonios:** bajo la opinión, el nombre que se publica con **Editar** (nombre, con atajo "Usar el del pedido", y sobre qué opinó: todo el pedido o cada pizza; de la home, la carta). Debajo, un recuadro (`QueProbo`) con la misma línea que lee el cliente en la web ("Probó la Diavola al Miele Piccante y la Muzzarela y Jamon"). **La tarjeta del panel es la de la web: estrellas, comentario, nombre y qué probó.** El dueño pidió explícitamente sacar todo lo demás: fecha, hora, modalidad, monto, bebidas, el nombre repetido y "Pedido verificado" / "Desde la home" (versiones anteriores del mismo día los mostraban). No agregarlos. El pedido se busca en `state.orders` por `pedido_id` (`OrderItem.type` existe para eso). `PUT /api/admin/testimonios/[id]` acepta `estado`, `nombre` y `producto` (`validarCambioTestimonio`).
- **Telegram:** "Se publica como: X" y "Pedido de <cliente>" en vez de la referencia.
- La opinión de Carlos se corrigió desde el panel local (base real): nombre completo y "todo el pedido"; sigue **pendiente** para que la apruebe el dueño.
- Verificado: `pnpm test` (casos nuevos en `tests/opiniones.test.ts`), TypeScript, eslint de lo tocado; en el navegador con la sesión del dueño, la tarjeta, la edición y el guardado; el seguimiento de un pedido entregado sin opinión trae el nombre completo (no se envió nada). Publicado con `6a424d3`; Netlify `ready` el 12/10. En `www.impastopizzas.com` el seguimiento de un pedido entregado trae el nombre completo, sin errores en la consola. **Sin ver todavía en producción:** el panel con la sesión del dueño, la tarjeta de Carlos publicada en la home y el aviso de Telegram de una opinión nueva.

## WhatsApp con el cliente desde el panel (10/10/2026)

- **Pedido del dueño:** para resolver problemas con un pedido necesita escribirle al cliente. En **Pedidos**, el teléfono de cada fila es un enlace (ícono verde) que abre el chat sin abrir el detalle (`TelCliente`, que desde el 22/10/2026 vive en `OrdersTable.tsx`, `stopPropagation`; en la tabla de escritorio es solo el ícono, el número va en el `title`); el botón "WhatsApp" del detalle usa lo mismo. El chat se abre con "¡Hola, Juan! Te escribimos de Impasto por tu pedido IM-107345-K7QD." (la referencia solo si es de la web; la del POS, `IM-3`, el cliente nunca la vio).
- **El botón que ya había estaba roto para muchos formatos:** pegaba `54` delante de lo que escribió el cliente (con 0, 15, +54 o 6 cifras daba un número equivocado). Ahora `whatsappDeCliente` (`lib/contacto.ts`, tests en `tests/contacto.test.ts`) lo lleva a **54 + característica + número, sin el 9** (el formato del WhatsApp de Impasto, que el dueño probó y anda): saca 0, 00, +54, el 9 y el 15 (sabe dónde va el 15 con la lista de características de 3 cifras; la 11 es la única de 2); 6 cifras, o 15 + 6, se toman como de Iguazú (3757). Otro país, solo si viene con +. **Lo que no reconoce no tiene enlace** ("Número incompleto: sin WhatsApp"): mejor eso que abrir el chat de otra persona. Clientes → detalle tenía el mismo error: arreglado igual (saludo sin pedido).
- Con los 23 pedidos de la base al 10/10: 12 quedan con enlace; los 5 del POS del 24/09 cargados con 6 cifras dan **el mismo número** que el pedido web del 12/09 escrito completo (confirma la regla de Iguazú). Los 11 sin enlace: web con 11 cifras (375…, 512…) o 9 cifras (334…, 454…, 456…); POS con 7, 8, 10 (546…) u 11 (544…) cifras y uno "x+xxx+…".
- Verificado: `pnpm test`, TypeScript, eslint de lo tocado (solo los dos `set-state-in-effect` previos de `Orders.tsx`). Publicado con `3695744`; Netlify `ready` el 10/10 (home y login responden 200, `/admin` sin sesión redirige al login). **Nadie lo vio todavía en el navegador con la sesión del dueño.**

## La chipa salió de la carta (10/10/2026)

- La chipa se vende **fuera de Impasto** (negocio aparte del dueño): `productos` Chipa (`otros`) quedó `archivado = true` (migración `recetario-napolitano/migrations/20261010180813_chipa-negocio-aparte.sql`). El recetario la costea con un costo operativo propio (`precios_venta.negocio_aparte`, `costo_op_dia`, `unidades_dia`). **Impasto y Carro Fogón no leen esas columnas**: si alguien la reactiva en la carta, `lib/effective-prices.ts` le vuelve a sumar el costo operativo de la pizzería (unos $15.500 por chipa). Si algún día se vende por acá, hay que portar `costoOperativoUnidad` del recetario.

## WhatsApp flotante abajo a la izquierda (10/10/2026)

- **Pedido del dueño:** fuera del footer el número de WhatsApp casi no se veía y los clientes no encontraban cómo escribir. `components/chat/WhatsappFab.tsx` (en `Shell`, solo la home, como el chat): el mismo botón que el del asistente (`.chat-fab`, carbón y borde dorado) en la esquina opuesta, con la insignia en verde WhatsApp. Escritorio: píldora "Escribinos por WhatsApp" + el número; celular (≤520 px): círculo, 12 px sobre la barra de abajo, y se desvanece al bajar igual que el chat. Abre `wa.me` con "¡Hola! Les escribo desde la web." (`MENSAJE_CONSULTA_WHATSAPP`).
- El número que se muestra es `business.phone` **solo si sus últimos 10 dígitos coinciden con el de WhatsApp** (`telefonoSiEsWhatsapp` en `lib/contacto.ts`, con test): son dos campos aparte del panel.
- **El chat ya no se convierte en botón de WhatsApp:** sin key, o caído el asistente, `ChatWidget` no se muestra (antes habría dos botones de WhatsApp). Dentro del panel abierto, el aviso de falla y su link a WhatsApp siguen igual.
- Verificado en local (`pnpm dev` con la base real): 1280 px (las dos píldoras, enlace y número correctos), 375 px (círculos simétricos sobre la barra, se esconden al bajar y vuelven al subir; el panel del chat a pantalla completa tapa al de WhatsApp), sin errores en la consola. `pnpm test`, TypeScript y eslint de lo tocado (solo el error previo de `Shell.tsx:127`). En `pnpm dev` el botón "N" de Next queda encima de la insignia: es solo de desarrollo. Publicado con `c57bce1`; Netlify `ready` el 10/10. En `www.impastopizzas.com` se verificó: el HTML trae el botón con el enlace y el número, se ve en 375 px (círculo verde a la izquierda, simétrico con el chat) y en 1280 px (píldora con el número), sin errores en la consola. **El dueño lo probó en su teléfono el 10/10/2026 y confirmó que funciona bien.**

## CI otra vez en verde: `/cocina` ya no se arma en el build (10/10/2026)

- **Problema:** el paso "Production build without backend access" del CI falló en **todos** los pushes desde `ad4c368` (03/10, `/cocina` lee el recetario): con `revalidate = 60` Next generaba `/cocina` en el build, y el CI compila a propósito sin base (`INSFORGE_API_BASE_URL=http://127.0.0.1:9`) → "/cocina: no se pudo leer productos". Netlify sí tiene la base y publicaba igual, así que producción no estaba afectada; el CI quedó rojo dos semanas y dejó de avisar.
- **Arreglo:** `app/cocina/page.tsx` pasa a `dynamic = "force-dynamic"` (como la home) y `leerFilasGuia` (`lib/guia-cocina-datos.ts`) va dentro de `unstable_cache` con 60 s. Se conserva lo de antes: si la base falla al renovar, se sirven las últimas filas buenas (comprobado en `next/dist/server/web/spec-extension/unstable-cache.js` 16.3.8: un refresco que falla devuelve el valor viejo). Diferencia: sin caché todavía (deploy nuevo) y con la base caída, `/cocina` da error en vez de una versión del build. **Ojo:** en 16.3.8 `force-dynamic` no desactiva `unstable_cache` (solo `fetchCache = 'force-no-store'` lo hace); si se agrega ese export, el caché se pierde.
- Verificado: build local en un worktree limpio sin `.env.local` y con las variables del CI → falla antes, pasa después (`/cocina` sale `ƒ`). `/cocina` local con la base real: 23 pizzas, 19 preparaciones, 23 fotos, `noindex` (igual que producción); segunda carga 154 ms contra 1,7 s de la primera (caché). `pnpm test`, TypeScript, eslint de lo tocado. `tests/cocina-bases-render.test.ts` simula `next/cache`.

## Checkout: textos de ayuda y aviso de retiro (10/10/2026)

- **Revisado:** la dirección **ya era obligatoria** para delivery, en `Checkout.tsx` (`validate`) y en el servidor (`lib/orders.ts`). Los 4 pedidos web sin dirección del 09/10 (3 de clientes y uno de prueba) se guardaron todos como **retiro** (`modalidad = takeaway`, envío $0) con el delivery activo: el cliente eligió "Retiro en nuestra cocina", y con retiro el campo Dirección desaparece. No hubo un pedido delivery sin dirección.
- **Mejora pedida por el dueño:** texto de ayuda bajo WhatsApp ("Es el número que usamos para comunicarnos con vos por tu pedido."), Email y Dirección, en escritorio y mobile (`AYUDA_*`, enlazados con `aria-describedby`; el error ocupa su lugar). Con retiro elegido y el delivery activo, un aviso (`AvisoRetiro`, `.co-mode-note`) dice que por eso no se pide dirección y que para envío hay que elegir Delivery. `.field .hint` ahora también tiene estilo en escritorio.
- Verificado en local (escritorio y 375 px) con el guardado del carrito y el envío del pedido bloqueados en el navegador y el estado "abierto" simulado: textos, aviso, errores y el aviso oculto con el delivery pausado. `pnpm test`, TypeScript y eslint (solo el error previo de `set-state-in-effect`). **Sin publicar.**

## Cotización web rota del 03/10 al 06/10/2026

- **Desde el 03/10 ningún pedido web se podía cotizar** (encontrado el 06/10 al probar la caja en el precio). `agregarFotos` (`c626d43`) devuelve una copia del catálogo y el costeo vive en un `WeakMap` por objeto: `quoteOrder` fallaba siempre con "Costeo de la venta no disponible. Reintentá." (comprobado contra `www.impastopizzas.com/api/orders/quote` el 06/10). `getCatalogData` ahora usa `conservarCosteo` (`lib/catalog-costeo.ts`, test en `tests/pricing-flow.test.ts`). Probado en local: la cotización vuelve a responder 200.
- Publicado en `1baec70` el 06/10/2026: `POST /api/orders/quote` en `www.impastopizzas.com` volvió a responder `ok: true` (Muzzarella $16.000). Falta ver un pedido web real completo.

## Eliminar pedidos desde el panel (06/10/2026)

- **Pedidos → casillas de selección + "Eliminar seleccionados"** (22/10/2026: las casillas aparecen con "⋯ → Seleccionar pedidos"; el tacho por fila se sacó), y "Eliminar pedido" en el detalle. Pide confirmación con la cantidad; es irreversible y también saca el pedido de ventas y ganancias. `POST /api/admin/pedidos/eliminar` (solo admin, hasta 100 por vez) → función SQL `eliminar_pedidos_impasto` (migración `20261006200331_eliminar-pedidos.sql`, aplicada), que borra el pedido y lo que cuelga de él (eventos, avisos, intentos y operaciones de devolución) en una transacción, y el archivo del comprobante del bucket. Se quitó el `DELETE /api/admin/pedidos/[id]` crudo: no respetaba estas reglas.
- **No se eliminan** (`lib/eliminar-pedidos.ts`, test `tests/eliminar-pedidos.test.ts`): tarjeta con pago acreditado o devuelto (rastro de plata en Mercado Pago) ni los pedidos con costeo o movimientos de pago guardados: `pedido_costeos` y `pedido_movimientos` son **inmutables a propósito** (triggers `BEFORE DELETE`). Al 06/10/2026 hay 2 así (las transferencias `IM-MAN-…` del 06/10); borrarlos exigiría desactivar esos triggers, y eso lo decide el dueño.
- Verificado: `pnpm test`, TypeScript y eslint de lo tocado. **Sin probar:** la función SQL contra la base (el entorno bloqueó crear y borrar un pedido de prueba) y el panel en el navegador (necesita la sesión del dueño).

## Transferencia: no se prepara hasta acreditar + comprobante en la web (06/10/2026)

- **Regla (pedido del dueño):** mientras una transferencia está `pendiente`, el cliente no lee que "lo estamos preparando". Confirmación, seguimiento y mail dicen "Pedido registrado / Esperando comprobante". `lib/transferencia-pendiente.ts` (`esperaComprobante`, `estadoVisibleAlCliente`); `GET /api/orders/[ref]` informa "nuevo" aunque el panel haya movido el pedido a preparando. **La cocina sí ve la transferencia sin pagar** (decisión del dueño: no cambiar `esPedidoParaCocina`). Plantilla del mail en `lib/plantilla-email.ts`. Commit `3abb0cb`.
- **El cliente sube el comprobante** (se quitó el botón "Enviar comprobante por WhatsApp"): `components/checkout/SubirComprobante.tsx` en la confirmación y el seguimiento (achica fotos a 2000 px en el navegador; JPG/PNG/WebP/PDF, hasta 4 MB). `POST /api/orders/[ref]/comprobante` (límite `comprobante`: 10/h por IP; solo transferencia pendiente y no cancelada; valida por bytes, `lib/comprobante.ts`) guarda en el bucket **privado `comprobantes`** (`<pedido>/<fecha>.<ext>`, nunca pisa) y deja `pedidos.comprobante_clave/_tipo/_subido_at` (migración `20261006194827_comprobante-transferencia.sql`, aplicada). Avisa por Telegram ("COMPROBANTE RECIBIDO") y deja un evento `comprobante`. El panel muestra "📎 Comprobante" en la lista y "Ver comprobante" en el detalle (`GET /api/admin/pedidos/[id]/comprobante`, solo admin, sirve el archivo con la clave de backend). **Subir no acredita nada:** el local verifica y marca "Pago recibido".
- **Sin aviso al acreditar (decisión):** el seguimiento se refresca cada 15 s y pasa solo a "en preparación"; no se agregó mail "pago acreditado" para transferencia.
- Verificado en local con un pedido de prueba (borrado después): rechazo de HTML/vacío/ref inexistente, subida PNG, bucket privado (401 sin clave), descarga con clave, seguimiento "Verificando pago". Queda un archivo de prueba de 69 bytes en `comprobantes` (sin pedido). **Sin probar:** subir desde un celular real, el visor del panel con la sesión del dueño, el aviso de Telegram y el mail.

## Caja en el precio (06/10/2026)

- **Regla (decisiones del dueño del 06/10/2026):** la caja es un costo interno. **El cliente nunca ve una línea "caja"**: la paga dentro del precio. Se discrimina solo en las pantallas internas (Precios, Ganancias, Android). Va **al costo, sin margen**.
  - **Pizza:** una caja por pizza (la mitad y mitad cobra la más cara, que ya la trae). Precio = `round(costoReal × markup) + caja`, y recién ahí el redondeo hacia arriba a $500 de la carta. El costo de producción de la pizza incluye la caja.
  - **Empanadas (cambiado el mismo 06/10 a pedido del dueño):** cada empanada lleva **la caja ÷ 6** ($320 ÷ 6 ≈ $53) en su precio por unidad, al costo y antes del redondeo a $500, la pidan de a 6, 12 o 24 ("si piden 12, gano un poco más"). La caja de empanadas cobra solo la suma de sus empanadas. La primera versión (una caja cada 12, sumada al total de la caja; publicada en `14c557b`/`341baa9`/`f3d13dd`) no le gustó: se reemplazó y no quedó ningún pedido con `importe_cajas`.
  - **Editable** en Ingredientes, por unidad: "Caja de pizza" y "Caja de empanadas", $320 cada una al 06/10/2026 (migración `recetario-napolitano/migrations/20261006160617_cajas-en-el-precio.sql`, aplicada). Sin cargar valen 0 (se vende como antes); con un precio inválido no se venden las pizzas o las empanadas que la llevan.
- **Dónde:** solo `lib/effective-prices.ts` (`precioCaja`, `cajaPorUnidad`: la caja va al precio y al costo de producción de cada unidad) y `lib/pricing-safety.ts` (una caja con precio inválido bloquea lo que la lleva). Como la caja ya está dentro del precio de cada empanada, el carrito, la cotización, el costeo de la venta y el bot quedaron como antes de la caja: el total de una caja es la suma de sus empanadas y se ve mientras se arma. Tests: `tests/caja-precio.test.ts`.

## Prepizza y salsa como recetas — estado al 04/10/2026

- El recetario web y Android permiten guardar prepizzas y salsas como preparaciones con ingredientes, rinde y variantes. Impasto consume el `ingredientes.precio_kg` calculado por sus triggers y los gramos de las líneas de cada pizza; conserva su fórmula de precios existente.
- Contrato compartido: `preparaciones.tipo_base` nullable (`prepizza` / `salsa`), ingrediente producido enlazado en `receta_ingredientes` con `cantidad_kg = gramos / 1000` y `momento = base`. La base de datos mantiene en cero el importe fijo correspondiente para evitar un doble costo. Pizzas sin convertir mantienen el comportamiento anterior; las blancas no necesitan salsa.
- `/cocina` muestra una sola vez las bases enlazadas con sus gramos reales. La etiqueta anterior de salsa queda solo para recetas que todavía usan `precio_salsa`; se quitó el encabezado universal de 300 g. Las preparaciones se excluyen de Próximamente y En prueba.
- La lectura privada de preparaciones usa `select('*')` y toma `tipo_base` cuando está disponible, compatible antes y después de la migración. No agregar una consulta pública extra de metadata de preparaciones. Los costos históricos ya capturados se conservan.
- Migración aplicada y verificada: `recetario-napolitano/migrations/20261003180000_bases-como-recetas.sql`. No se inventaron recetas ni cantidades y no se convirtieron pizzas: el dueño debe ingresar recetas, rindes y consumos en el recetario.
- Cambios subidos a `main` en `ad407be`; tests y build verificados antes del push. El despliegue automático web no está confirmado. Guía de uso del ecosistema: `recetario-napolitano/docs/prepizza-salsa-recetas.md`.
- Android quedó listo para compilar, con instrucción vigente de no lanzar builds hasta nueva autorización del dueño y commits `[skip ci]`.

# Impasto · Estado del proyecto

Pizzería de **Puerto Iguazú, Misiones**. Next.js 16 + InsForge (Postgres) + Mercado Pago.
Deploy en Netlify: **https://www.impastopizzas.com** (dominio propio desde el 19/09/2026; el
subdominio `vocal-naiad-861a2c.netlify.app` sigue respondiendo). Ver "Dominio propio".

Última actualización: 2 de octubre de 2026.

## Cómo trabajar en este repo

- **`CLAUDE.md` es la memoria operativa del proyecto y se actualiza en cada bloque terminado.**
  Registrar fecha, alcance real, verificación ejecutada, commit/despliegue y pendientes que
  cambien. No marcar algo como verificado en producción solo porque pasó localmente o se
  pusheó. Nunca copiar claves, tokens ni valores secretos a este archivo.
- **El gestor de paquetes es `pnpm`**, no npm. Instalar con npm rompe la auth del panel:
  el `package-lock.json` fijaba `@insforge/sdk@1.2.5`, que no expone el subpath `/ssr`.
  Ese lockfile ya se eliminó; no volver a crearlo.
- `pnpm build`, `pnpm test` (tests de horarios, SEO, catálogo y fallas de chat), `pnpm dev`.
- **Migraciones:** `npx -y @insforge/cli db migrations new <nombre>` + `db migrations up --all`.
  Nunca con `db query`: **descarta el DDL en silencio y reporta éxito igual**.
- **Al editar archivos con scripts**, ojo con los finales de línea CRLF: varios reemplazos
  fallaron por eso y TypeScript no los detecta (una prop sin usar compila). Verificar en el
  navegador, no solo con `tsc`.
- El deploy de Netlify se dispara solo al pushear a `main`. **Cambiar una variable de entorno
  no afecta a los deploys ya publicados**: hay que reconstruir aunque la variable se lee en runtime.
  También se puede disparar manualmente con `npx netlify deploy --trigger`.
- `app/api/productos/route.ts` no lo consume nadie en el repo, pero podría tener clientes
  externos: desde A09 también entrega solo productos/precios validados y responde 503 si falla
  una fuente crítica. No volver a publicar allí `productos.precio` crudo.
- **`pnpm lint` también analiza `.worktrees/`** (al 25/09/2026 existe
  `.worktrees/impresion-termica`), porque `eslint.config.mjs` no la ignora: da cientos de errores
  ajenos al código de `main`. Para comparar contra el baseline, correr `pnpm exec eslint` sobre
  los archivos tocados o agregar `.worktrees/**` a `globalIgnores`.
- **Al verificar con `grep` que no quedan literales duplicados, incluí `.tsx`.** Un grep con
  solo `--include=*.ts` dio un falso negativo y dejó pasar una cuarta copia de la allowlist
  de categorías en `StoreProvider.tsx`.

## Estado actual del endurecimiento de pagos y cocina (22/09/2026)

Publicado en `main` con el commit **`3013480`** (`fix: harden card payment order flow`):

- **A01 — intento de tarjeta durable:** el navegador crea y conserva la referencia antes del
  primer request. Un aprobado se recupera sin cobrar de nuevo, un pendiente abre seguimiento
  sin repetir la operación y un rechazado permite iniciar un intento nuevo. La referencia no
  puede reutilizarse con otro cliente o carrito.
- **A02 — persistencia comprobada:** checkout y webhook distinguen ausencia de fila de error
  de base, validan cada escritura crítica y exigen exactamente una fila actualizada. Un fallo
  de persistencia queda como error reintentable y conserva la referencia del intento.
- **A10 — campanilla al acreditarse:** el panel recuerda solo pedidos que alguna vez quedaron
  habilitados para cocina. Una tarjeta pendiente produce una única campanilla cuando pasa a
  aprobada y no vuelve a sonar por cancelación/reactivación.
- **A11 — tarjeta sin acreditar bloqueada:** Mercado Pago pendiente o rechazado no puede avanzar
  a preparación/reparto/entrega, acreditarse manualmente ni imprimir comanda. La interfaz y el
  servidor aplican la misma regla; efectivo y transferencia conservan confirmación manual.
  La escritura administrativa compara además el estado de pago validado para cerrar carreras
  con el webhook y revierte el estado visual si el servidor rechaza el cambio.
- Pruebas nuevas: `tests/card-attempt.test.ts`, `tests/db-result.test.ts` y
  `tests/admin-order-update.test.ts`; `tests/pedido-visible.test.ts` cubre pendiente→aprobado y
  no repetición. Antes del push pasaron `pnpm test`, TypeScript, build de producción y ESLint
  con 0 errores (11 advertencias preexistentes).

**Todavía no equivale a verificación operativa en producción.** Falta confirmar el SHA
desplegado por Netlify y ejecutar humo controlado con el ambiente de prueba de Mercado Pago:
doble clic, pérdida de respuesta, pendiente→aprobado, rechazo, campanilla, bloqueo de comanda
y seguimiento. No se ejecutó ningún cobro real en esta tanda.

### A03 — acceso de operarios del POS

Implementado y publicado en `carroFogon/next-app` el 22/09/2026, commit `4abfe7b`: la única
cuenta permitida es `spezialichristian@gmail.com` y ninguna variable de entorno puede ampliar esa
autorización. Login y rutas API validan la política; hay pruebas del correo único y del inventario
de guards. Las creaciones y cambios de pedidos dejan actor ID/email en `pedido_eventos` como
auditoría best-effort. El dueño confirmó el 22/09/2026 que A03 fue probado en producción.

### A04/A05 — contrato de cobro, caja y comandas

Implementado el 22/09/2026 en Carro Fogón (commit `3cb82ea`) e Impasto; pendiente de prueba
operativa en producción. El POS ahora crea pedidos sin descuento automático y con un único medio
(`efectivo`, `transferencia` o `mercadopago`). El dueño verifica los cobros manuales MP en su app
y después los acredita desde el POS; los pagos web siguen bajo control del proveedor. Cocina
y cobro usan columnas separadas. La caja desglosa cobrado por medio y pendiente. `pagado_mp` y
`parcial_mp` históricos solo se interpretan para lectura. La reimpresión desde el POS adapta
productos web/pos, sabores, modalidad y notas, y bloquea tarjetas pendientes. El panel de
Impasto solo ofrece devolución automática cuando existe una orden MP gestionada por la web.
Faltan pruebas con pedidos reales y la corrección contable del recetario (A06/A08/A18).

### A09 — precios ante fallas de costos

Implementado en código local el 23/09/2026: web `037fe19` y `7b5183c`; POS `a69483b` y
`fc6854e`. **No pusheado, desplegado ni probado en producción.** El dueño eligió bloquear toda
venta cuando falla una fuente necesaria de precios, sin usar el último precio ni asumir costo
cero. Una receta/regla individual inválida bloquea solo ese producto, incluso si el precio
manual guardado es positivo. Los productos sin regla usan `productos.precio` solo si es finito
y positivo. El redondeo sigue hacia arriba a $500; no se tocó el recetario.

`getCatalogData()` verifica las nueve fuentes críticas (productos y ocho tablas de costos);
promociones, testimonios y etiquetas siguen siendo decorativas. La carta omite productos
con precio inválido y muestra aviso. Checkout recotiza pizzas, bebidas, mitades y cajas;
una caja no usa el precio del combo para ocultar un sabor inválido y el tamaño se bloquea si
su propia regla es inválida. La API pública `/api/productos` también usa los precios seguros.
Las rutas de cotización,
pedido y tarjeta responden 503 si falla una fuente crítica; el pedido se valida antes del
INSERT y antes de contactar a Mercado Pago. En el POS, GET/POST usan la misma resolución;
el POST responde 409 por un ítem ya no vendible y 503 por una fuente caída. El panel
administrativo del POS consulta `/api/productos?admin=1` para conservar la posibilidad de
editar productos que la carta vendible oculta.

Pruebas locales: `pnpm test`, TypeScript, lint (0 errores; 11 advertencias previas) y build
de Impasto; `npm test` y build de Carro Fogón. Falta confirmar SHA desplegado y hacer humo
controlado de web/POS antes de declarar A09 operativo. Diseño y plan:
`docs/superpowers/specs/2026-09-22-precios-fail-closed-design.md` y
`docs/superpowers/plans/2026-09-22-precios-fail-closed.md`.

## Los tres proyectos que comparten esta base

La base InsForge `3agqcygs.us-east.insforge.app` la usan **tres aplicaciones coordinadas**:

| Proyecto | Qué es | Stack | Producción |
|---|---|---|---|
| **Impasto** (este repo) | E-commerce exclusivo para clientes online (delivery y takeaway) | Next.js 16 | `www.impastopizzas.com` |
| **El Fogón — Dashboard** (`recetario-napolitano`) | Costeo, recetas, costos operativos, precios y análisis de ganancias | Astro 5 + Netlify | `recetarionapolitano.netlify.app` |
| **Carro Fogón** (`carroFogon/next-app`) | Terminal POS para operarios (toma de pedidos manuales por WhatsApp y teléfono) | Next.js 15 + Vercel | `carro-fogon.vercel.app` |

### Quién escribe qué

- `recetas`, `ingredientes`, `receta_ingredientes`, `precios_venta`, `costos_fijos`,
  `costos_variables`, `config_negocio`, `gastos`, `ventas_mes` → **las escribe el recetario**.
  Impasto **solo las lee**: de ahí salieron las descripciones y los tags, y desde el
  21/08/2026 también los precios efectivos. Escribirlas rompe el costeo del recetario.
- `productos`, `pedidos`, `clientes` → **compartidas entre Impasto y Carro Fogón**.
  - **Impasto Web**: clientes compran online con Mercado Pago, efectivo o transferencia (`external_reference = 'IM-...'`).
  - **Carro Fogón POS**: operarios cargan pedidos manuales de WhatsApp/llamadas
    (`proyecto_id = 'impasto'`; pago elegido entre efectivo, transferencia y MP desde A04).
- `etiquetas`, `carritos`, `pedido_eventos`, `notificaciones`, `promociones`, `testimonios`,
  `info_empresa_impasto` → hoy las usa Impasto, viven en la misma base.
- El recetario **lee `pedidos`** en `ganancias.astro` para calcular la ganancia del mes desglosando
  automáticamente los dos canales: `🍕 Impasto Web` y `📲 carroFogon`.

### Separación de tenants y Unificación Operativa (Septiembre 2026)

- Para la apertura de la pizzería, **Carro Fogón se adaptó como la terminal POS exclusiva para operarios de Impasto**:
  su `PROYECTO_ID` es `"impasto"` y su `sucursal_id` es `"iguazu"`.
- Cada pedido manual cargado por el operario en Carro Fogón ingresa de inmediato a la tabla `pedidos`,
  dispara la campanilla sonora en el panel `/admin` de cocina de Impasto e impacta en el recetario.
- Los pedidos de Carro Fogón imprimen su comanda térmica con el membrete `"IMPASTO · PIZZA NAPOLETANA · IGUAZÚ"`.
- `clientes` sigue compartida: un cliente que llama por teléfono queda unificado con su historial web.

- `productos` y `pedidos` llevan `proyecto_id` = `'impasto'` o `'carro'`. Quedó **nullable a
  propósito**: los inserts del código viejo no se rompen durante la ventana migración→deploy.
  Backfill verificado contra la base: `productos` 49 impasto / 16 carro, sin nulos. El de
  `pedidos` (`sucursal_id = 'iguazu' or external_reference like 'IM-%'`) **nunca se ejerció**:
  la tabla estaba vacía. Esa regla no está verificada contra datos reales.
- Impasto filtra y escribe `proyecto_id = 'impasto'` en los caminos principales que tocan
  `productos` o `pedidos` — catálogo, alta, edición y borrado por id, la ruta pública
  `/api/productos` y las dos de etiquetas (además de `CATEGORIAS_IMPASTO` y `sucursal_id`,
  que se conservan como defensa en profundidad). PUT/DELETE de pedidos quedaron acotados al
  proyecto en `3013480`; la ruta de devolución todavía debe auditarse/completarse como parte
  de A19. Si se agrega una consulta nueva, siempre lleva el filtro.
- **Desde la unificación de septiembre, Carro Fogón escribe `proyecto_id = 'impasto'`**, no
  `'carro'` (código del carro, su `CLAUDE.md` y la base lo confirman al 18/09/2026). Web y POS
  comparten `proyecto_id` y se distinguen por `external_reference`: la web siempre escribe
  `IM-XXXXXX-XXXX`, el POS deja el default `''`. **Hay dos numeraciones**: la web de seis cifras
  por reloj y el POS 1, 2, 3… por día. Todo lo que derive identidad de `numero_pedido` se rompe
  entre días (pasó con la campanilla del panel; ver "Cómo se entera el local").
- Las **60 filas de `productos` con `proyecto_id = 'carro'`** (hamburguesas, lomos, calzones y
  copias de pizzas, empanadas y bebidas) son del carro original y **hoy no las muestra ninguna
  app**: el POS lee las de `'impasto'`. No se borraron; si se confirma que no hacen falta,
  archivarlas es decisión del dueño.
- `clientes` queda **compartida a propósito**: el cliente es de la empresa, pida por la tienda
  o por el carro.

**El orden fue el correcto:** la migración corrió antes del deploy, así que el código nuevo
—que lee `proyecto_id`— nunca se encontró sin la columna. Se verificó en producción: el sitio
sigue sirviendo la carta completa. Si alguna vez hay que rehacerlo en otro entorno, ese orden
es obligatorio. Desde el endurecimiento del 17/09, una falla al leer `productos` hace fallar
`getCatalogData()`. Desde A09 (23/09), las fuentes de costo son críticas: un error o
`data:null` bloquea la venta; solo promociones, testimonios y etiquetas pueden degradarse.

## Historial de funcionalidades terminadas

La nota de cada punto indica si llegó a verificarse en producción. Para pagos y cocina, el
estado del 22/09/2026 documentado arriba prevalece sobre las descripciones históricas.

- **Auth del panel** — todas las rutas admin actuales protegidas + rate limiting en el login.
- **Mercado Pago (Checkout API vía Orders)** — formulario propio con Secure Fields (no Brick),
  `POST /v1/orders` con idempotencia, webhook con firma HMAC que falla cerrado, mapeo de estados
  y devoluciones totales y parciales desde el panel.
  **Credenciales de PRODUCCIÓN activas: cobra plata real.**
- **Transferencias bancarias completas (06/09/2026)** — Datos bancarios (`cbu`, `alias_cbu`,
  `banco`, `titular_cuenta`) en `sucursales` vía migración `20260906135520_datos-bancarios-sucursal.sql`
  (**desde el 25/09/2026 esas columnas ya no se leen: ver "Varias cuentas para transferencias"**).
  Configurables desde `/admin` (Configuración). En Checkout y Confirmation se visualiza tarjeta
  con CBU/Alias, botón de copiado en 1 clic y botón directo a WhatsApp con mensaje y comprobante prefirmado.
- **Seguimiento en vivo de pedidos (06/09/2026)** — Endpoint público `/api/orders/[ref]` y pantalla
  pública de tracking `/pedido/[ref]` con barra de progreso de 4 estados (*Recibido → Preparando → En camino / Listo para retirar → Entregado*), auto-polling de 15 segundos y banner superior discreto persistente en la cabecera cuando hay un pedido activo en `localStorage`.
- **Comanda térmica para cocina (06/09/2026)** — Layout físico de comanda para impresoras térmicas de
  80mm/58mm en `Orders.tsx`. `@media print` en `admin.css` aísla exclusivamente el ticket e inhabilita toda la interfaz del navegador al imprimir. Incluye `#IM-XXXX`, cliente, teléfono, dirección y referencias, ítems con cantidad resaltada, observaciones de cocina y estado de cobro claro (`[✓] PAGADO ONLINE` vs `[!] COBRAR EFECTIVO`). Botón de impresión directa en detalle y en la tabla de pedidos.
- **Panel Admin en tiempo real con campanilla sonora (06/09/2026)** — Auto-polling en segundo plano cada
  15 segundos en `StoreProvider.tsx` hacia `/api/admin/pedidos`. Al detectar una nueva comanda entrante, reproduce una campanilla bitonal elegante sintetizada en el navegador con la Web Audio API nativa. Botón de mute/unmute persistente en `Topbar`.
- **Dashboard con métricas reales y CRM (06/09/2026)** — Eliminación de semillas mock. Cálculo real de
  ventas hoy vs ayer con delta porcentual, pedidos hoy vs ayer, ticket promedio, comandas activas, selector de período de ventas `7d/14d/30d` y cálculo del gasto total real, cantidad de compras y producto favorito por cliente en `Customers.tsx`.
- **Chatbot vendedor DeepSeek verificado en producción (06/09/2026)** — `DEEPSEEK_API_KEY` sincronizada en
  Netlify CLI; verificado en vivo con streaming en tiempo real en `vocal-naiad-861a2c.netlify.app`.
- **Saneamiento de seguridad y linter (06/09/2026)** — Eliminada carpeta huérfana `public/admin/`,
  removido rewrite obsoleto en `next.config.ts`, desacoplada la tarjeta de WhatsApp en `Reviews.tsx` para que se muestre siempre. La suite siguió creciendo; no mantener aquí un conteo fijo, usar `pnpm test` como fuente de verdad.
- **Persistencia del pedido** — todos los campos + historial con timestamps en `pedido_eventos`.
- **Horarios y estado de venta** — configurables desde el panel, con interruptor manual para
  vacaciones. La validación vive en `createPedido`, el punto único por donde pasan todas las
  vías de pago. La hora se calcula en la zona del local, no del servidor (Netlify corre en UTC).
- **Rate limiting** con respaldo en base (las funciones serverless no comparten memoria).
- **Separación de tenants (`proyecto_id`)** — `productos` y `pedidos` aislados entre Impasto y
  Carro Fogón en la misma base (ver "Separación de tenants" más arriba).
- **Seguridad integral y RLS (12/09/2026)** — Clave expuesta de InsForge rotada e invalidada (retorna 401).
  RLS activado en **las 20 tablas de `public`** mediante migración `20260912205138_habilitar-rls-seguridad.sql`.
  Permisos de escritura revocados al rol `anon`. Lectura pública restringida al escaparate. Creados índices faltantes de clave foránea.
- **Tarifa plana de Delivery y Envío Gratis configurable (12/09/2026)** — Delivery base: **$3.000**,
  envío gratis a partir de **$35.000** (`migrations/20260912213000_configuracion-delivery-35000.sql`).
  Ambos parámetros configurables en `/admin` (Configuración → Delivery).
- **Comandas térmicas con desglose de gustos en cajas y mitades (12/09/2026)** — Extraído módulo
  `lib/adapt-order.ts` (100% testeado). Las comandas de cocina y modal imprimen las variedades exactas de
  empanadas (ej: `4 Pollo, 4 Carne, 4 Árabe` en Cajas x12) y las pizzas mitad y mitad.
- **Filtro de cocina para tarjetas (iniciado 12/09/2026, endurecido 22/09/2026)** —
  `lib/pedido-visible.ts` excluye pendientes/rechazadas; `3013480` agregó bloqueo de avance,
  acreditación manual e impresión tanto en panel como en servidor. Falta humo postdespliegue.
- **Idempotencia en Checkout (iniciada 12/09/2026, endurecida 22/09/2026)** — La versión
  vigente es A01 en `3013480`: referencia durable antes del request, recuperación de aprobado
  o pendiente y referencia nueva después de un rechazo definitivo. No restaurar el comportamiento
  histórico que reutilizaba silenciosamente un rechazado.
- **Eliminación de pedidos programados (12/09/2026)** — Opciones de programar horario removidas de `Checkout.tsx`.
  Todos los pedidos se aceptan como "Lo antes posible" (`asap`), validado server-side con `lib/validar-cuando.ts`.
- **Fecha en hora local argentina (12/09/2026)** — Función `fechaLocal()` en `lib/hours.ts` (`America/Argentina/Buenos_Aires`).
  Se elimina el bug donde pedidos nocturnos pasadas las 21:00 hs se registraban con la fecha UTC de mañana.
- **Sincronización con POS de Operarios y Recetario (12/09/2026)** — Integración total: pedidos de Carro Fogón
  entran a `/admin` de Impasto y ambos canales (`Impasto Web` y `carroFogon`) se desglosan automáticamente
  en `recetario-napolitano/ganancias.astro`.
- **Módulo de email con Resend (19/09/2026)** — dominio verificado y envío aceptado por la API;
  falta ver el primer pedido real con `enviado` en `notificaciones`. Ver pendiente 1.

- **Delivery pausado · solo retiro (25/09/2026)** — *(22/10/2026: el interruptor y el motivo se mudaron a **Arranque** y se guardan al tocarlos; Configuración → Delivery quedó con la tarifa y el envío gratis.)* Panel → Configuración → Delivery tenía un
  interruptor propio ("✓ Haciendo envíos" / "✕ Delivery pausado · solo retiro") y un motivo
  libre; vacío, sale `MENSAJE_DELIVERY_DEFAULT` (`lib/hours.ts`). Columnas
  `sucursales.delivery_activo` y `mensaje_delivery` (migración
  `20260925133228_delivery-pausado.sql`, **aplicada y verificada**). Es independiente de
  `ventas_activas`: con la venta pausada manda ese aviso y la franja no aparece.
  `estadoDelivery()` viaja dentro de `EstadoTienda` (página y `/api/store-status`), así que el
  sitio lo refleja en menos de un minuto. `createPedido` rechaza delivery con `validarModalidad()`
  antes del INSERT y antes de Mercado Pago. El cliente ve la franja carbón/dorado bajo la barra
  superior, el carrito sin envío y el checkout con Delivery deshabilitado; si la pausa llega con
  el checkout abierto, el modo efectivo se deriva a retiro (no hay efecto que pise el estado). El
  bot deja de ofrecer envío (con hasta 5 min de desfase por la foto del catálogo). No toca textos
  de marca/SEO ni Carro Fogón. Verificado localmente: tests, TypeScript, eslint de los archivos
  tocados, build, lectura real de la columna y capturas escritorio/mobile en Chrome headless con
  `/api/store-status` interceptado. Publicado en `main` con `43febe0`; Netlify lo desplegó
  (`ready`) el 25/09 y `www.impastopizzas.com/api/store-status` ya devuelve `delivery`.
  **El dueño lo probó en producción el 25/09/2026 con su sesión de admin y confirmó que
  funciona** (interruptor del panel y aviso en el sitio). El rechazo server-side de un pedido
  con delivery no lo ejercitó ningún agente contra producción: lo cubren
  `tests/hours.test.ts` (`validarModalidad`). Spec y plan: `docs/superpowers/specs/2026-09-25-delivery-pausado-design.md` y
  `docs/superpowers/plans/2026-09-25-delivery-pausado.md`.

- **Varias cuentas para transferencias (25/09/2026)** — Panel → Configuración → "Cuentas para
  transferencias": lista de cuentas (nombre corto, alias, CBU/CVU, banco, titular) y una sola
  **activa**, que es la única que ven los clientes. Vive en `sucursales.cuentas_transferencia`
  (jsonb) y se valida en `lib/cuentas-transferencia.ts` (puro, con test): alias 6–20 sin
  recortar, CBU/CVU de 22 dígitos, alias o CBU obligatorio, exactamente una activa. **Cada pedido
  por transferencia guarda la cuenta que se le mostró** en `pedidos.cuenta_transferencia`
  (jsonb, solo la escribe la web): confirmación, seguimiento, panel ("transferencia · ARQ") y
  Telegram ("PAGO SIN CONFIRMAR — revisar en ARQ") usan esa foto; los pedidos anteriores caen a
  la activa. Si la lista está dañada o hay cero/dos activas, no se muestran datos bancarios y se
  ofrece WhatsApp: nunca un valor de ejemplo. Migración `20260925141945_cuentas-transferencia.sql`
  (**aplicada**): copió la cuenta vieja dentro del SQL, sin literales. Las columnas `cbu`,
  `alias_cbu`, `banco`, `titular_cuenta` quedan en la tabla sin uso (no se borraron para poder
  volver atrás). Al 25/09 hay dos cuentas: **ARQ (activa)**, cargada por `db query` y no en el repo
  (que es público), y AstroPay guardada. **Nunca escribir alias ni CBU reales en el repo**, ni
  en tests ni en docs. Verificado localmente: tests, TypeScript, eslint de lo tocado, build,
  `GET /api/orders/<ref>` real de un pedido viejo por transferencia (devuelve ARQ) y la
  confirmación en Chrome headless con `/api/orders` interceptado (no se creó ningún pedido).
  Publicado con `f2b88fc`; Netlify `ready` el 25/09 y el seguimiento de un pedido por
  transferencia en `www.impastopizzas.com` ya devuelve ARQ. **El dueño lo probó en producción
  el 25/09/2026 y confirmó que funciona todo bien.** Ningún agente vio todavía la foto guardada
  en un pedido nuevo real (`pedidos.cuenta_transferencia` no nulo); revisarlo con el próximo
  pedido por transferencia. Spec y plan: `docs/superpowers/specs/2026-09-25-cuentas-transferencia-design.md` y
  `docs/superpowers/plans/2026-09-25-cuentas-transferencia.md`.

- **Opiniones de clientes (25/09/2026)** — Dos puertas: el seguimiento `/pedido/[ref]` pregunta
  por lo que se pidió cuando el pedido figura *Entregado* ("¿Qué te pareció la X?"; con varios
  productos, chips), y la home suma "¿Ya probaste Impasto? Contanos" abierto a cualquiera (sirve
  para clientes del POS y del local, que no tienen seguimiento). `POST /api/opiniones` es pública:
  límite `opinion` (8/h por IP), campo trampa `sitio` (lleno → 200 sin guardar), pedido
  `impasto` + `entregado` + una sola opinión por pedido (índice único parcial en
  `testimonios.pedido_id`); sin pedido, el producto tiene que ser una pizza no archivada o
  "Empanadas". Todo entra `pendiente` y avisa por Telegram (sin formato). **Aprobar = publicar:**
  la home muestra las 6 aprobadas más recientes (grilla / carrusel en mobile) con "Probó la X".
  El panel muestra "Pedido IM-… · verificado" o "Desde la home". Lógica pura y testeada en
  `lib/opiniones.ts`; formulario compartido en `components/opiniones/OpinionForm.tsx`. Migración
  `20260925154155_opiniones-pedido.sql` (**aplicada**). Sin `aggregateRating` (decisión SEO).
  Verificado localmente: tests, TypeScript, eslint de lo tocado, build; la ruta real con trampa,
  datos inválidos, pedido inexistente y no entregado (ninguna fila creada); y en Chrome headless la
  home vacía y con 6 opiniones ficticias (página temporal, borrada) y el seguimiento entregado,
  escritorio y 375 px, con los envíos interceptados. Publicado con `194febd` (Netlify `ready`
  el 25/09): la home de producción muestra la invitación y `POST /api/opiniones` con el campo
  trampa responde 200 sin crear filas. Sin probar: una opinión real guardada, el aviso de
  Telegram y la moderación en el panel. Spec y plan:
  `docs/superpowers/specs/2026-09-25-opiniones-clientes-design.md` y
  `docs/superpowers/plans/2026-09-25-opiniones-clientes.md`.

- **Ficha de producto: la foto en grande (28/09/2026)** — Tocar la foto de cualquier pizza,
  empanada o bebida abre una ficha con la foto grande, cartelitos, precio, descripción completa y
  el pie para pedir (Agregar · $X → `− n en el pedido +`, ½½; en empanadas, el `− n +` de la caja
  con "3 de 12 elegidas"). **Mobile:** hoja desde abajo; se cierra arrastrando hacia abajo, con ✕
  o tocando el fondo; deslizando a los costados pasa al producto anterior/siguiente **de la lista
  que el cliente está viendo** (respeta filtro y búsqueda; sin vuelta circular). En las filas de
  pizzas y bebidas también abre tocando el nombre/descripción; la destacada lleva una lupa fija.
  **Escritorio:** ventana centrada con flechas (pantalla y teclado), Esc y clic afuera; lupa y
  cursor de acercar al pasar el mouse. **El botón Atrás cierra la ficha** en vez de salir del
  sitio. Dónde vive: lógica pura en `lib/ficha.ts` (gestos, normalización y
  `lineaDePizza`/`lineaDeBebida`, que ahora usan también las tarjetas), `components/ui/ProductSheet.tsx`
  (ficha + hook `useCierreConAtras`), `components/cart/FichaAccion.tsx` (pie) y el estado en
  `Shell` (ids + índice, no objetos). El disparador es un `<button class="media-zoom">`
  transparente encima de cada foto: el contenedor no cambia. Decisiones: **sin pellizcar para
  acercar** (las fotos miden 1200 px, lo que un teléfono ya muestra a todo el ancho); cartelitos
  junto al nombre y no sobre la foto; el fondo se bloquea solo en mobile; el historial copia
  `history.state` para no romper el router de Next, y el hook vive en `Shell` porque en desarrollo
  React monta dos veces y un `pushState` en la ficha dejaría dos entradas. El umbral de gesto
  rápido quedó en **0,3 px/ms** (con 0,5 no pasaba un deslizamiento real de 70 px en 163 ms).
  Verificado localmente: `pnpm test` (suma `tests/ficha.test.ts`), TypeScript, eslint de lo
  tocado y build; en Chrome headless con táctil emulado, 33 casos mobile (abrir, agregar/sumar/
  restar, deslizar en medio y bordes, cerrar de cuatro formas, ½½, empanadas, bebidas, horizontal
  740×360 y 812×375), 22 de escritorio y 27 de Atrás (sin recarga, sin salto de scroll, carrito
  intacto, ✕/Esc/arrastre consumen la entrada), todos con el borrador del carrito interceptado.
  Comparación de estilos calculados de escritorio (1280/1000/800; página, carrito y checkout)
  contra la hoja de `8d7be50`: la única diferencia es `pointer-events:none` en `.p-price`.
  **Ojo al probar:** el panel del navegador con vista mobile emulada traduce mal las coordenadas
  de los clics (llegan a `<html>`); en `pnpm dev` el botón flotante de Next tapa el `−` del pie.
  No se probó una ficha de producto agotado en vivo (no había ninguno; lo cubren los tests).
  Commits `8ed8c15`, `2c810df`, `f13532a`, `3c05964`, `ebeebaa`. Publicado con `acec927`; Netlify
  `ready` el 28/09. En `www.impastopizzas.com`, Chrome headless verificó: el HTML trae los
  botones "Ver … en grande"; en 375 px la foto destacada abre la ficha, deslizar pasa a la
  siguiente y Atrás la cierra sin salir del sitio; en 1280 px el clic abre, la flecha pasa y Esc
  cierra; sin errores en la consola (no se agregó nada al carrito). **El dueño la probó en su
  teléfono en producción el 28/09/2026 y confirmó que funciona bien.** Ningún agente vio todavía
  la ficha de un producto agotado en vivo (no había ninguno). Spec y plan: `docs/superpowers/specs/2026-09-28-ficha-producto-design.md` y
  `docs/superpowers/plans/2026-09-28-ficha-producto.md`.

- **Logo y concepto "Pizza a la piedra, técnica napoletana" (01/10/2026)** — Reemplaza a
  "pizza híbrida" en todo el sitio. **Logo:** el dueño subió `4.jpg` y `5.jpg` al bucket `DB`
  (mismo dibujo; `5.jpg` trae el damero de "transparente" horneado, un JPG no tiene alfa). Se
  derivaron dos PNG sin fondo desde `4.jpg`, en `public/`: `logo.png` (navbar) y
  `logo-blanco-v2.png` (footer, **todo blanco**, pedido del dueño). Se renombró a `-v2` porque
  el optimizador de `next/image` seguía sirviendo la versión anterior con el mismo nombre.
  **Copy:** hero "Pizza a la piedra, *técnica napoletana.*" en dos líneas (h1 tope 80px,
  columnas 1.25fr/0.75fr); la bajada lleva los datos técnicos que el resto del hero no muestra
  (harina de fuerza, cornicione, 2 a 5 minutos) y el gusto argentino (mucha muzzarella y
  toppings). Nosotros explica el nombre, el proceso y la base fina y tierna, sin repetir el
  hero. **Regla del dueño: el hero y Nosotros se continúan, no repiten el mismo dato.**
  `lib/marca.ts`: "Masa madurada en frío" 48 a 72 hs (cifra "48-72 hs") y "Mucha muzzarella".
  Ticker, footer, FAQ, SEO (slogan y descripción) y `llms.txt` alineados; el `<title>` sigue
  con "napolitana" a propósito. Verificado en localhost con Chrome headless (1440/1000/375 px),
  tests y TypeScript. Commits `8ed1a22`…`9213e19`. Sin verificar todavía en producción.

- **Guía de armado para la cocina: `/cocina` (02/10/2026)** — Página para los cocineros: por cada
  pizza, foto, base (salsa de tomate, manteca de ajo confitado o blanca),
  ingredientes con gramos y lo que va después del horno, más las recetas de las preparaciones
  (mieles, pestos, provenzal, manteca de ajo, etc.). **Sin login, sin código y sin ningún enlace
  desde el sitio**: decisión del dueño por simpleza, aunque se le avisó dos veces que quien
  escriba la dirección ve las recetas. La defensa es `noindex, nofollow` en `app/cocina/layout.tsx`;
  **`/cocina` no está en `robots.ts` ni en `sitemap.ts` a propósito** (nombrarla anunciaría que
  existe). **Desde el 03/10/2026 (paso 3) la página se arma con el recetario y se renueva cada
  minuto (desde el 10/10, `force-dynamic` + `unstable_cache` de 60 s; ver "CI otra vez en verde"); ya no hace falta un deploy por cada receta** (ver el bloque "Paso 3"
  al final de este punto; lo que sigue describe la versión del 02/10).
  Solo entra lo confirmado, salvo las 3 pizzas nuevas con tomate (Pomodorini, Pesto Rosso,
  Puttanesca), que el dueño pidió ver en una sección "En prueba" con aviso, gramos de prueba y
  sin foto (las encontró a faltar y las agregué el 02/10); lo marcado "a probar" sigue afuera. El pesto de morrón asado de la Porteña entró el 02/10 a pedido del
  dueño (la dejé afuera por error al principio, por haberlo marcado "a probar"). Con ese pesto la
  Porteña lleva 120 g de morrón en tiras, no los 150 g que carga el recetario (decisión del dueño
  del 02/10; el recetario sigue con 150 g). Nada de costos, precios ni notas
  internas: `tests/guia-cocina.test.ts` (en `pnpm test`) lo comprueba, además de fotos y
  preparaciones enlazadas. Las fotos son las de `REAL_PRODUCT_PHOTOS` y se muestran con `<img>`,
  como el resto del sitio (la URL del bucket redirige al CDN y `next/image` solo acepta el host
  del bucket). **Las recetas de la crema de hongos secos, el pesto de pistacho y el pesto de
  verdeo las redactó Claude a partir de los gramos del recetario: el dueño tiene que
  revisarlas.** La hoja de trabajo con costos y pendientes no está en el repo. Verificado
  localmente: tests, TypeScript, eslint de lo tocado, build (`/cocina` sale estática) y navegador
  (18 fotos cargan, sin desborde a 375 px, robots, sitemap, llms.txt y home sin referencias).
  Spec y plan: `docs/superpowers/specs/2026-10-02-guia-cocina-design.md` y
  `docs/superpowers/plans/2026-10-02-guia-cocina.md`. Publicado con `127d87d`; Netlify lo
  desplegó el 02/10. En `www.impastopizzas.com/cocina` se verificó: HTTP 200, 18 pizzas, 15
  preparaciones y 18 fotos que responden 200, `noindex, nofollow`, y ninguna referencia en
  `robots.txt`, `sitemap.xml`, `llms.txt` ni enlaces desde la home. **El dueño todavía no la
  probó en la cocina ni en su teléfono.**
  **03/10/2026:** alineada con el recetario a pedido del dueño. La Fugazzetta (antes "al Provolone") va
  sin provolone ni pimentón; Diavola sin pesto y con 100 g de calabresa; Palmitos sin provenzal y con
  150 g de palmito; Quattro con muzzarella 250 g y provolone, roquefort y parmesano a 30 g; Porteña con
  100 g de jamón; Pepperoni con 100 g y sin ají molido; aceto de la Prosciutto a 25 ml. **Bianca ai
  Funghi salió** (al dueño no le gustó; está archivada) junto con su crema de hongos. La miel picante
  va en un hilo de 20 g, como costea el recetario (confirmado por el dueño; antes decía ~8 g). `orden-admin.ts`
  también pasó a "Fugazzetta".
  **Paso 3 (03/10/2026): `/cocina` lee el recetario.** Diseño `docs/superpowers/specs/2026-10-03-cocina-y-fotos-automaticas-design.md`,
  plan `docs/superpowers/plans/2026-10-03-cocina-paso-3-lee-el-recetario.md`. `lib/guia-cocina.ts` son funciones puras
  (`armarGuia`, `formatearCantidad`, `idDePreparacion`) sobre filas que lee `lib/guia-cocina-datos.ts` con la clave de
  backend (sin precios: `precio_salsa` queda como respaldo para recetas sin salsa enlazada; desde el 04/10 se usan las bases y sus gramos reales). En venta = productos `impasto`, categoría
  `pizzas`, no archivados, con receta por `precios_venta.nombre` exacto (la Chipa es categoría `otros` y no entra);
  Próximamente / En prueba = `recetas.en_cocina`; base, horno y después = `receta_ingredientes.momento`; nota =
  `recetas.indicaciones`; preparaciones (también las anidadas) con ingredientes, rinde, paso a paso y conservación.
  Nombres de ingredientes tal como están en la base. Una pizza en venta sin receta muestra "Receta no cargada en el
  recetario". Las fotos siguen en `REAL_PRODUCT_PHOTOS` y `FOTOS_EN_PRUEBA` hasta el paso 4. Al publicarlo aparecieron
  solas tres pizzas que el dueño había activado y la guía vieja no tenía: Blue Bacon, Quattro Fratelli y Muzzarela
  y Jamon (sin foto). Blue Bacon tiene el huevo duro cargado como 0,002 unidades: se muestra así a propósito.
  **Paso 4 (03/10/2026): fotos automáticas** (plan `docs/superpowers/plans/2026-10-03-cocina-paso-4-fotos-automaticas.md`).
  `lib/fotos.ts` (puro, `tests/fotos.test.ts`) elige la foto más nueva (`uploadedAt`) entre los archivos de
  `fotos/<id del producto>/` (paso 5) y los de la raíz del bucket `DB` que se llaman como el producto, solos o con
  versión (`v4`, `(1)`), sin mayúsculas, tildes, guiones ni guiones bajos; un nombre más largo no cuenta.
  `lib/fotos-bucket.ts` lista el bucket con `unstable_cache` (60 s, tag `fotos`) y si falla devuelve `[]`.
  `getCatalogData` agrega `foto` a pizzas, empanadas y bebidas (`agregarFotos`); `PizzaIllus`, `EmpanadaIllus` y
  `DrinkIllus` la reciben como `src` en la lista, la destacada, mitades, empanadas, bebidas y el carrito, y el SEO la
  usa; sin `foto` siguen `REAL_PRODUCT_PHOTOS` y el stock. `/cocina` usa la misma regla, con `FOTOS_EN_PRUEBA` de
  respaldo. **Regla para el dueño: subir con el nombre exacto del producto + versión nueva; nunca reemplazar un
  archivo con el mismo nombre (el CDN sigue sirviendo el viejo).** Antes de publicar se comprobó que ninguno de
  los 72 productos cambia de foto: Porteña y Bondiola usaban WebP del repo y el bucket tenía fotos más viejas con
  su nombre, así que se subieron esos WebP como `… v2.webp` (mismos bytes). Las copias `Diavola… v2.jpg` y
  `Palmitos… v2.jpg` del bucket son fotos viejas sin uso: el dueño las puede borrar.
  **Paso 5 (03/10/2026): foto desde el admin** (plan `docs/superpowers/plans/2026-10-03-cocina-paso-5-foto-desde-admin.md`).
  Productos → Editar producto tiene el campo **Foto** (`FotoProducto` en `Products.tsx`): elegir, ver la vista previa,
  "Subir foto". `POST /api/admin/productos/[id]/foto` (`requireAdmin`; id uuid; producto `impasto` de una categoría
  de Impasto) valida JPG/PNG/WebP por sus primeros bytes y hasta **4 MB** (`lib/foto-subida.ts`; Netlify limita el
  cuerpo a 6 MB en base64), sube a `fotos/<id>/<AAAAMMDDTHHMMSSmmmZ>.<ext>` (nunca pisa) y llama
  `revalidateTag("fotos", { expire: 0 })` + `revalidatePath("/cocina")`: se ve al instante. **La subida usa un PUT
  directo a la API de InsForge (`subirFoto` en `lib/fotos-bucket.ts`), como la CLI: `storage.upload` del SDK va por
  un formulario prefirmado de S3 que no fija el tipo y el archivo quedaba `binary/octet-stream`.** El GET del admin
  agrega `foto` (la misma regla del paso 4) y `ProductThumb` la usa primero. Productos nuevos: hay que guardarlos
  antes. Verificado en el navegador con la sesión del dueño: rechazo de un archivo que no es imagen, subida a la
  Bondiola (archivada) con la misma imagen, `image/webp` y mismos bytes, `/cocina` y la miniatura al instante.
  En la carpeta de la Bondiola quedaron dos copias de esa imagen (una de la primera prueba, como
  `binary/octet-stream`). El panel "Editar producto" ya se salía del ancho en celular (435 px en 375) antes de este
  cambio: queda pendiente.
  **06/10/2026: la foto se sube apenas se elige.** El dueño eligió fotos para la 7-Up y el Agua Misiones y apretó
  **Guardar**: salía "Producto actualizado", pero la foto se descartaba en silencio, porque solo la subía el botón
  aparte "Subir foto" (ningún archivo llegó al bucket). `FotoProducto` ahora sube en el `onChange` del input, con
  "Subiendo foto…" y el resultado debajo; no hay más botón "Subir foto" ni "Cancelar". La ruta no cambió. Las dos
  fotos se subieron por CLI a `fotos/<id>/` con la misma clave que usa la ruta (sha1 igual al archivo local) y se
  ven en `www.impastopizzas.com`. Verificado: `pnpm test`, TypeScript y eslint del archivo; **sin probar todavía
  en el navegador con la sesión del dueño**.

- **Etiquetas sobre la foto y "nuestra cocina" (05/10/2026)** — Ver "Cómo funcionan las
  etiquetas" y la decisión "No hay local a la calle". En la base, `gourmet` y `vegetariana`
  pasaron a `mostrar_badge = 'ambos'` (aplicado por `db query` y releído). Verificado
  localmente: `pnpm test`, TypeScript, eslint de lo tocado (el único error es previo, en
  `Checkout.tsx:79`) y Chrome headless contra `pnpm dev` con la base real: 1280 px (12 pizzas
  y 5 empanadas con sus cartelitos sobre la foto, ninguno junto al nombre) y 375 px (destacada,
  filas y empanadas, sin desborde); el aviso "solo retiro" se vio con `/api/store-status`
  interceptado. El ícono de esos avisos pasó de una fachada de negocio a una bolsa. Commits
  `e78eb6e` (etiquetas), `333560b` (copy) y `3347ee6` (docs); Netlify `ready` el 05/10. En
  `www.impastopizzas.com` se verificó: el HTML trae los cartelitos `.p-badge c-*` sobre la foto
  y ningún `.p-badge-tag`, la home dice "Retirá en nuestra cocina" y ningún "el local", y
  `llms.txt` lleva la dirección de nuestra cocina. Sin ver todavía: el checkout, la
  confirmación, el seguimiento y el mail de un pedido real para retirar, ni el dueño en su
  teléfono.

### Distinción que se presta a confusión

`hours` es el horario de trabajo que ve el cliente (**hasta las 00:00**).
`horaCierre` es la hora del **último pedido** (**23:45**). No son lo mismo y se editan por separado.

`categoria` también tiene dos sentidos. En la base es la **línea de producto** (`pizzas`,
`hamburguesas`); en TypeScript, `Pizza.categoria` es el **estilo** (`clasica` | `gourmet`).
El estilo se resuelve por `tags`: etiquetar una pizza como `"gourmet"` la hace aparecer en
esa pestaña y le pone el badge. `Veggie` y `Picantes` funcionan igual — son filtros por
`tags`, no por `categoria`. Los valores exactos que espera el filtro son `gourmet`,
`vegetariana` y `picante`; en empanadas, `picante`, `vegetariana` y `dulce`.

Las pestañas del sitio (`Todas`, `Clásicas`, `Gourmet`, `Veggie`, `Picantes`) están
**hardcodeadas** en `PizzaList.tsx` y filtran por `tags`. Los cartelitos, en cambio, salen
de la tabla `etiquetas` y se administran desde el panel. Son dos cosas distintas: una
etiqueta puede alimentar una pestaña, mostrar un cartelito, las dos o ninguna.

La columna `tipo` no influye en nada de lo que ve el cliente: la clasificación (pizza,
empanada, bebida, y con eso lo que pisa el catálogo del sitio) sale toda de `categoria`.
En el panel, el selector "Tipo" del formulario de productos ahora es quien manda: al
crear o editar un producto, cambiar el Tipo deriva `categoria` automáticamente
(`pizza→pizzas`, `empanada→empanadas`, `bebida→bebidas`), así no puede quedar un producto
con un Tipo que no se corresponda con su `categoria`. Ya no hay un selector de Categoría
aparte en el panel.

## Pendientes, en orden sugerido

### 1. Proveedor de email
**Configurado el 19/09/2026 con Resend** (InsForge está en plan free, donde `emails.send()` no
está disponible).
- Dominio `impastopizzas.com` verificado en Resend, región **São Paulo (sa-east-1)**. Registros
  en Hostinger: `TXT resend._domainkey` (DKIM), `CNAME rsend → rsend-sae1.forge.rmta.net` y
  `CNAME send → send.forge.rmta.net` (el SPF nuevo de Resend va por CNAME, no por MX + TXT) y
  `TXT _dmarc = v=DMARC1; p=none;`. Hostinger muestra los TXT entre comillas: es solo la
  presentación, el valor publicado no las lleva.
- Netlify: `EMAIL_PROVIDER=resend`, `EMAIL_FROM=Impasto <pedidos@impastopizzas.com>` y
  `RESEND_API_KEY` (secreta: Netlify no deja volver a leerla). Reconstruido.
- La key es **solo de envío** (`Sending access`, limitada al dominio): `GET /emails/{id}` da
  401. El estado de entrega se mira en el dashboard de Resend, no por API.
- La key también está en `.env.local`; ahí `EMAIL_PROVIDER` y `EMAIL_FROM` quedaron **vacías a
  propósito**, para que un pedido de prueba en `pnpm dev` no le mande mails reales a nadie.
- Prueba: la API aceptó un envío con el mismo payload que `sendConResend` (HTTP 200). **Falta
  ver el primer pedido real** con `estado = 'enviado'` en `notificaciones`.
- `lib/email.ts` importa el SDK de InsForge: no se puede probar bajo `tsx` (falla la
  resolución de `@insforge/shared-schemas`). Para probar el envío, llamar a la API de Resend
  directo con el mismo payload.
- `pedidos@impastopizzas.com` **solo envía**: no hay casilla. Por eso `lib/email.ts` manda
  `reply_to` desde `EMAIL_REPLY_TO`.
- **Desde el 19/09/2026 hay una sola casilla del negocio: `impastopizzas.pedidos@gmail.com`**,
  creada por el dueño y pública a propósito. Es a la vez el `EMAIL_REPLY_TO` de Netlify (antes
  era el Gmail personal del dueño, que **nunca va en el código: el repo es público**) y el mail
  de contacto del sitio: sale de `sucursales.email` (panel → Configuración) y, de respaldo, de
  `BUSINESS.email` en `lib/business.ts`; lo muestran el footer, el JSON-LD y `llms.txt`. Antes el
  sitio decía `hola@impastoiguazu.com.ar`, un dominio que no existe. No poner ahí
  `pedidos@impastopizzas.com`: `impastopizzas.com` no tiene MX y rebota.
- Ojo al cambiar `EMAIL_REPLY_TO`: el deploy tiene que **arrancar después** de guardar la
  variable. El 19/09 se reconstruyó justo antes de guardarla y el deploy quedó con el valor viejo;
  se detectó comparando el `updated_at` de la variable con el `created_at` del deploy
  (`netlify api getEnvVar` / `listSiteDeploys`).
- El dueño confirmó que la prueba llegó **a la bandeja de entrada**, no a spam.

### 2. Catálogo
**Descripciones y tags: hechos el 20/08/2026.** Las 41 pizzas y empanadas tienen
descripción, y los tags están cargados. Falta todavía: **fotos reales** (hoy son
ilustraciones generadas), alérgenos, tamaños y stock.

**Fotos de producto:** no hay columna de imagen en `productos`. Cada foto se enlaza por uuid
en `REAL_PRODUCT_PHOTOS` (`lib/stock-images.ts`), apuntando al bucket público `DB`, **al
archivo que subió el dueño** (el 26/09 borró las copias JPG optimizadas que había subido un
agente; no volver a crearlas sin preguntarle). **Reemplazar una foto con el mismo nombre no
alcanza:** la URL de storage redirige a `cdn.insforge.dev` (CloudFront), que sigue sirviendo
la versión vieja (`X-Cache: Hit`, sin `Cache-Control`) e ignora un `?v=` agregado. Una foto
nueva va con nombre nuevo (`… v2.png`, como `napoletana-aglio-v2.jpg`). Para comparar, bajar
con `npx -y @insforge/cli storage download`, que lee el original y no pasa por el CDN. El
26/09/2026 se sumaron las dos blancas: Bianca ai Funghi (`Bianca ai Funghi v2.png`, la
versión con champiñones) y Bianca all'Aglio Confit, que además recibió su descripción, sacada
de su receta.

Ojo con el conteo (18/09/2026): la tabla tiene 130 filas. **70 de Impasto** (53 pizzas,
9 empanadas y 8 bebidas; parte de las pizzas están archivadas) y **60 del carro original**,
que ninguna app muestra hoy (ver "Separación de tenants").

**Las descripciones no se inventaron: salen de las recetas reales.** Ver "El catálogo
tiene recetas" más abajo — es el hallazgo que más rinde de todo el proyecto.

Efecto secundario que conviene no romper: el buscador filtra por `nombre + desc`
(`PizzaList.tsx:36`), así que **los ingredientes nombrados en la descripción son
buscables**. Buscar "panceta" devuelve cinco pizzas, cuatro de las cuales no la tienen
en el nombre. Si se reescriben las descripciones sacando ingredientes, se pierde eso.

### 3. Bebidas
**Hecho.** Ya no son 0: hay 8 bebidas cargadas con precio (Vino Malbec, Coca-Cola 1.5 L,
Quilmes, Brahma, Sprite y agua con y sin gas), verificadas en el sitio el 24/08/2026. La
app las soporta y oculta la sección si no hay — hoy no hace falta que la oculte.
**06/10/2026:** 11 bebidas en carta (costos unitarios y nuevas cargadas desde el recetario). **Orden:** por tipo
(gaseosas, aguas, cervezas, vinos) y alfabético dentro de cada uno, con `ordenarBebidas` en `lib/catalog-build.ts`
(test en `tests/catalog.test.ts`). El tipo sale del nombre por palabras clave (`TIPOS_DE_BEBIDA`); lo que no
reconoce va con las gaseosas: una cerveza o un vino de marca nueva hay que sumarlo a esa lista.

### 4. Promociones
Tabla `promociones` vacía. Falta interfaz, reglas de aplicación, vigencias, límites de uso,
descuentos reales en la cotización y validación server-side.

### 5. Notificaciones y Seguimiento en Vivo
**Hecho el 06/09/2026.**
- **Aviso al local:** Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`).
- **Seguimiento en vivo:** `/pedido/[ref]` con stepper de 4 estados, auto-polling (15s) y banner superior.
- **Auto-polling en Admin:** `StoreProvider.tsx` consulta silenciosamente cada 15s y reproduce campanilla de cocina (Web Audio API) con botón de silencio en Topbar.
- **Comanda física:** Formato térmico de 80mm/58mm en `Orders.tsx` para enviar directamente a impresora de cocina.

### 6. Chatbot vendedor (DeepSeek)
**Hecho y verificado en producción (06/09/2026).** `DEEPSEEK_API_KEY` configurada en Netlify CLI.
El endpoint `/api/chat` responde en tiempo real con streaming y rate limit contra el catálogo real de Impasto.

### 7. Calidad y operación
Hay tests de horarios, catálogo, aviso al local y SEO, y páginas legales (`/terminos`,
`/privacidad`, `/reembolso`). Falta: tests de cotización y pedidos, logs estructurados, monitoreo,
limpieza automática de carritos abandonados, banner de consentimiento de cookies y analítica.

## Decisiones tomadas, para no rediscutirlas

- **Sin Brick de Mercado Pago.** El formulario es propio; solo número, vencimiento y CVV son
  iframes de MP (Secure Fields), porque lo contrario exige certificación PCI-DSS.
- **Sin borde relleno.** El local no lo hace; se eliminó de todo el flujo.
- **Sin pedidos anticipados.** Con el local cerrado no se toman pedidos, ni siquiera programados.
  Si se quiere habilitar, aceptarlos siempre que el horario elegido caiga dentro de la atención.
- **No hay local a la calle: el cliente retira en "nuestra cocina"** (pedido del dueño,
  05/10/2026). Todo texto que ve el cliente (carrito, checkout, confirmación, seguimiento, mail,
  hero, avisos de solo retiro, FAQ, legales, `llms.txt`) y el prompt del bot dicen "nuestra
  cocina"; `tests/chat-prompt.test.ts` comprueba que el prompt y el FAQ no digan "local", y el
  aviso de Telegram dice "Retira en la cocina". **No cambiar `pedidos.direccion = 'Retiro en
  local'`**: es un valor interno que comparan `card-attempt.ts`, `adapt-order.ts` y el POS.
  "Local" en comentarios y en nombres de código (`aviso-local`, `fechaLocal`) es interno.
- **Email como canal de avisos**, no WhatsApp.
- **Los tres proyectos conviven en la MISMA base** (no se crea base nueva). La separación es por
  la columna `proyecto_id` en `productos` y `pedidos`; `clientes` se comparte a propósito.
- **El chatbot ofrece alcohol como cualquier otra bebida.** Se le planteó al dueño el 23/08/2026
  que listar alcohol en la carta y tener un bot empujándolo son dos posturas distintas frente a
  la Ley 24.788, porque es un sistema automatizado sin verificación de edad. Decidió que sí, así
  que **no hay ninguna regla especial sobre alcohol en el prompt**: el Malbec y las cervezas se
  sugieren igual que una gaseosa. Si algún día se quiere restringir, es una línea en
  `lib/chat-prompt.ts`.
- **El copy del sitio no se unifica por refactor.** Pizzas dice “sin costo extra” y el modal de
  mitad y mitad dice “sin recargo”: significan lo mismo, y reemplazar una por la otra para que
  salgan de una sola constante le cambia la voz a una sección. Lo que tiene que salir de un
  solo lugar son los **datos verificables** (cifras, reglas de precio), no la redacción.

## El catálogo tiene recetas (hallazgo del 20/08/2026)

La base tiene **los ingredientes reales de cada producto**, y no estaba documentado. Son
tres tablas globales, que **escribe el recetario** (`recetario-napolitano`):

- `recetas` (81 filas) — una por producto, se cruza con `productos` **por `nombre`**.
- `ingredientes` (79) — con `precio_kg`, `tipo` y `multiplo_rendimiento`.
- `receta_ingredientes` (441) — la tabla puente, con `cantidad_kg` y `merma_factor`.

**El cruce cubre las 41 de Impasto sin un solo faltante.** De ahí salieron las
descripciones y los tags de `vegetariana` y `picante`. Antes de inventar cualquier dato
de producto, mirar acá primero.

Solo se leen: escribirlas afectaría el costeo del recetario.

### Errores de carga detectados en esas recetas

No los corregí porque son del sistema de costos del otro proyecto, pero **inflan costos**:

- `Pizza Anchoas` y `Napoletana Marinara`: **8.000 g de anchoas** cada una. Ocho kilos.
- `Empanadas Espinaca y Muzza`: cada ingrediente cargado **dos veces**.
- `Napoletana Margarita Especial`: `Pesto 0g`.
- Varias: `Huevo Duro 2g`, que parece ser "2 unidades" y no 2 gramos.

### Dos nombres que no coinciden con su receta

- `Pizza 5 Quesos` lleva **seis**: muzzarella, cheddar, roquefort, sardo, dambo y parmesano.
- `Pizza Rellena Provolone` **no lleva provolone**, lleva sardo. La que sí lo lleva es
  `Pizzeta Provolone Rellena`.

Las descripciones dicen lo que el producto **realmente** lleva, así que en esos dos casos
la descripción contradice al nombre. Hay que corregir el nombre o la receta.

## Cómo funcionan las etiquetas

Se administran desde la sección **Etiquetas** del panel y viven en la tabla `etiquetas`.

- **`slug` es inmutable** y es lo que se guarda en `productos.tags`. **`label`** es lo que
  ve el cliente y se puede renombrar sin tocar ningún producto. Esa separación es
  deliberada: renombrar el slug huerfanaría las marcas de todos los productos.
- **Todas las etiquetas visibles salen sobre la foto, arriba a la izquierda, en el `orden`
  del panel** (decisión del dueño del 05/10/2026). Antes se mostraba una sola, la de menor
  orden, junto al nombre; y "Veggie"/"Picante" estaban escritos fijos en `PizzaList.tsx` y
  `lib/ficha.ts` sin leer el panel, por eso unas salían sobre la foto y otras al lado del
  nombre. Hoy **nada se dibuja desde los tags**: tarjeta, destacada mobile, filas mobile,
  empanadas y ficha usan `cartelitosDePizza` / `cartelitosDeEmpanada` (`lib/ficha.ts`).
  Antes de ellas va el interruptor "★ popular" del producto: si una pizza lo tiene y también
  la etiqueta `mas-pedida`, sale dos veces.
- **`mostrar_badge`** (`ambos` / `pizzas` / `empanadas` / `ninguno`) decide **dónde se ve**
  el cartelito, no dónde se puede marcar. El 05/10/2026 `gourmet` estaba en `ninguno` (por
  eso no aparecía) y `vegetariana` en `empanadas`; las dos pasaron a `ambos` a pedido del dueño.
- **`sistema`** marca las que alimentan pestañas hardcodeadas (`gourmet`, `vegetariana`,
  `picante`). **No impide borrarlas**: el panel avisa qué pestaña queda vacía y cuántos
  productos pierden la marca, y el dueño decide.
- Al borrar una etiqueta, **el slug se quita de los productos** en la misma operación.
  Dejarlo huérfano lo volvería invisible desde el panel.
- El filtrado y orden viven en `resolverBadges()`, en `lib/catalog-build.ts` (`Pizza.badges`,
  `Empanada.badges`), cubiertos por `tests/catalog.test.ts`. Sobre la foto los cartelitos son
  rellenos (`.p-badge.c-<color>`) para leerse sobre cualquier imagen; `.p-badge-tag` ya no existe.
- La paleta de colores es fija y las variables CSS **tienen que existir en
  `app/impasto.css`**. `--a-sidebar` solo existe en `admin.css`: un badge con ese color se
  vería bien en el panel y roto en el sitio.

## Cómo se entera el local de que entró un pedido

Por **Telegram**, desde el 21/08/2026. Antes no había ningún aviso al local: el único que el
sistema mandaba era un mail **al cliente**, y encima sin proveedor configurado.

- `lib/telegram.ts` es el punto único de envío, espejo de `lib/email.ts`. Sin
  `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_IDS` devuelve `omitido` y no rompe nada.
- **Nunca agregarle `parse_mode`.** El mensaje lleva nombre y dirección escritos por el
  cliente; con Markdown activo un nombre podría inyectar formato o un link. `lib/aviso-local.ts`
  además aplana los saltos de línea, para que nadie falsifique una línea del aviso.
- `lib/aviso-local.ts` arma el texto y **no importa el SDK**, por eso se puede testear bajo
  `tsx` (`tests/aviso-local.test.ts`). Si alguna vez necesita `db`, el test deja de correr.
- La segunda línea del mensaje dice qué hacer con la plata: `COBRAR AL ENTREGAR $X` en
  efectivo, `PAGADO CON TARJETA` cuando MP aprobó, `PAGO SIN CONFIRMAR — revisar` en
  transferencia. No hay un "pago OK" genérico: en efectivo tampoco está cobrado.

Avisa en tres momentos: el checkout de efectivo y transferencia, la tarjeta cuando MP la
aprueba (rechazada no avisa), y **el webhook cuando un pago pendiente pasa a aprobado** — sin
ese tercero, una tarjeta que se acredita más tarde no le llega a nadie.

No se duplica: el índice único de `notificaciones` es `(pedido_id, tipo, canal)`, así que el
aviso de Telegram convive con el del mail y un reintento no manda dos veces.

**El panel se refresca solo** cada 15 segundos y hace sonar la campanilla con cada pedido nuevo
(`StoreProvider.tsx`). **La identidad de un pedido en el panel es `_dbId`** (el uuid de la fila),
**nunca `id`**: `id` es solo la etiqueta visible, y para un pedido del POS —que no tiene
`external_reference`— `adaptOrder` la arma con el número (`IM-0001`). El POS numera 1, 2, 3… y
reinicia cada día, y `/api/admin/pedidos` devuelve el histórico completo, así que el `#1` de hoy
y el de ayer comparten `id`. Deduplicar por `id` dejó la campanilla muda desde el segundo día de
venta; buscar por `id` hacía que un cambio de estado pudiera parchear la fila equivocada. Las
claves, la detección de nuevos y las acciones van por `_dbId` (`clavesDePedidos` y
`pedidosNuevosParaCocina` en `lib/pedido-visible.ts`, con test).

## El storage (arreglado el 23/08/2026)

Ninguna subida funcionaba, por ninguna vía — panel, SDK o CLI. El error visible era
`DATABASE_VALIDATION_ERROR`, que no dice nada; **el motivo real solo aparece en los logs del
backend** (`npx -y @insforge/cli logs insforge.logs --limit 40`):

    column "uploaded_via" of relation "objects" does not exist

El backend corre InsForge **2.1.1** e inserta `storage.objects.uploaded_via` en cada PUT, pero
la tabla de este proyecto seguía en el esquema anterior: **la migración de plataforma nunca
corrió acá**. Se arregló agregando la columna (`text`, nullable; el backend le escribe `rest`
o `s3`).

**No se puede hacer por migración.** El backend rechaza el DDL con *"Write operations on storage
schema are not allowed"*, así que `db migrations up` falla y dejar el archivo en `migrations/`
trabaría todas las migraciones siguientes. Se aplicó por **conexión directa a Postgres**
(`npx -y @insforge/cli db connection-string` + `pg`), que no pasa por ese guardia. Es la única
vía para tocar los esquemas de plataforma, y por eso este arreglo **no figura en
`db migrations list`**.

Si InsForge vuelve a actualizar el backend y el storage se rompe otra vez, mirar primero si
falta otra columna nueva: es el mismo síntoma.

Dos cosas más, para no repetir el diagnóstico:

- **El nombre del bucket no era el problema.** `DB` en mayúsculas funciona igual que
  `client-assets`. Los dos buckets fallaban idéntico, que fue lo que descartó al bucket.
- **Para assets fijos del sitio (el logo del navbar, íconos) no uses storage**: van en
  `public/` con `next/image`. Se sirven desde el dominio propio, entran en el build y no
  gastan el egress de InsForge. El storage es para lo que sube el dueño desde el panel —
  las fotos reales de productos, que siguen pendientes.

## SEO (hecho el 23/08/2026)

Antes el sitio tenía solo `title` y `description`: sin `robots.txt`, sin sitemap y sin
datos estructurados. Para Google era una página cualquiera, no una pizzería de Iguazú.

- **`lib/site.ts` define la URL canónica** y la usan todos: canonical, `og:url`, sitemap,
  robots y el JSON-LD. Sale de `NEXT_PUBLIC_SITE_URL`, si no de `URL` (que Netlify inyecta
  sola en el build), si no del subdominio actual. **Se lee en build**: al comprar el dominio
  hay que cargarla *y reconstruir*, igual que la public key de Mercado Pago.
- **Los metadatos del `layout` son estáticos** y salen de `BUSINESS`, no de la base: así el
  layout no depende de una consulta. Lo que Google realmente usa para horario, teléfono y
  precios es el **JSON-LD de `app/page.tsx`**, que sí lee la configuración viva del panel.
- **`lib/seo.ts` arma el JSON-LD y no importa `db`**, igual que `lib/aviso-local.ts`, por eso
  se puede testear con `tsx` (`tests/seo.test.ts`).
- **`serializarJsonLd()` escapa el `<`.** Las descripciones las escribe el dueño desde el
  panel: una que contenga `</script>` cortaría la etiqueta. Nunca sacar ese escape.
- **Sin `aggregateRating`.** Google no acepta como rich result las reseñas que el propio
  negocio recolecta y publica sobre sí mismo; declararlas es arriesgar un aviso en Search
  Console a cambio de nada. Tampoco queda ninguna cifra de reseñas hardcodeada en el sitio:
  el hero llegó a mostrar “4,9★ +1.200 reseñas” inventadas y ya no existen en el código.
- **`ciudad` en la base guarda “Puerto Iguazú, Misiones”**, ciudad y provincia juntas, porque
  el sitio la muestra así. schema.org las quiere separadas: `partesUbicacion()` las parte.
  Se descubrió mirando el JSON-LD renderizado contra la base, no con los tests.
- **El horario del JSON-LD cierra a las 23:45**, la hora del último pedido, no a las 00:00 en
  que cierra el local. Para un sitio de delivery es el dato útil. Ver la distinción de
  `hours` vs `horaCierre` más arriba.
- **La miniatura para compartir la genera `app/opengraph-image.tsx`** con `next/og`, en el
  build. No es un archivo en `public/`: si se cambia el texto, se regenera sola.
- El panel y la API quedan fuera del índice por `robots.ts` **y** por `robots: noindex` en
  `app/admin/layout.tsx` y `app/admin-login/layout.tsx`. Lo segundo cubre el caso de que
  alguien enlace la URL desde afuera: sin él, Google indexa la URL aunque no la rastree.

Lo que falta del lado de SEO: **Google Business Profile** (es lo que más mueve en búsqueda
local y no se hace desde el código), fotos reales, y rutas propias por producto — hoy la
carta entera vive en `/` y el sitemap tiene una sola entrada.

## El chatbot vendedor (23/08/2026)

Reemplazó al botón flotante de WhatsApp (`components/chat/ChatWidget.tsx`); desde el 10/10/2026
WhatsApp volvió como botón aparte en la esquina izquierda (ver "WhatsApp flotante"). **Vende, pero no
toma pedidos**: recomienda de la carta y dice dónde encontrar el producto; el que agrega al
carrito es siempre el cliente.

- **La IA va por DeepSeek directo**, no por InsForge. `lib/deepseek.ts` es el punto único de
  llamada, espejo de `lib/telegram.ts` (mismo patrón `{ estado: "omitido"; motivo }`): sin
  `DEEPSEEK_API_KEY` devuelve `omitido`, `hayChat()` da `false` y el widget no se muestra
  (queda el WhatsApp flotante de la izquierda). **La key es server-only, nunca `NEXT_PUBLIC_`.**
- **InsForge sí tiene IA funcionando** en el plan free de este proyecto —se probó contra el
  backend el 23/08/2026— pero el Model Gateway nuevo no está disponible y el helper viejo del
  SDK no hace streaming. Si algún día hay que volver, el camino es `db.ai.chat.completions`.
- **El modelo es `deepseek-v4-flash`** (default en `lib/deepseek.ts`, se puede pisar con
  `DEEPSEEK_MODEL`). Los viejos `deepseek-chat` y `deepseek-reasoner` ya no existen: verificar
  el nombre en la documentación antes de escribirlo de memoria.
- **`lib/chat-prompt.ts` es todo lo que el bot sabe.** No consulta nada durante la charla. Con
  la carta cerrada en el prompt no puede inventar un producto, y como sale de
  `getCatalogData()` —ya filtrado por `CATEGORIAS_IMPASTO`— no puede ofrecer nada del Carro
  Fogón. **Nunca consultar `productos` directo desde el chat.**
- **El bot no puede cotizar distinto que el carrito, o le miente al cliente.** La mitad y mitad
  cobra el precio de la más cara, y las empanadas se venden solo en cajas: sin esas reglas en
  el prompt, el bot sumaría dos precios donde el carrito cobra uno. Por eso existe
  `lib/reglas-carta.ts` —no estaba en el plan original—, que las escribe una sola vez y las usan
  `lib/chat-prompt.ts` y los componentes que de verdad cobran (`HalfModal.tsx`,
  `EmpanadasSection.tsx`). No importa `db` ni componentes de React, para poder testearse con
  `tsx`.
- **El historial lo manda el cliente y se sanea en `lib/chat-mensajes.ts`**: se descarta el rol
  `system`, se conservan los últimos 12 mensajes, y se cortan por tamaño — pero **el tope no es
  el mismo para los dos roles**. `user` se corta a 500 caracteres (una consulta de venta no
  necesita más); `assistant` se corta a 2.000, porque es lo que generó el propio modelo con
  `max_tokens: 400` (hasta ~1.400 caracteres en español): aplicarle el tope de 500 le
  devolvería al modelo, en el turno siguiente, una versión truncada de su propia respuesta. El
  prompt de sistema se arma siempre en el servidor y nunca viaja desde el cliente.
- **La ruta guarda una foto del catálogo con TTL de 5 minutos** (`app/api/chat/route.ts`).
  `getCatalogData()` consulta doce tablas y no puede correr en cada mensaje. Un precio recién
  editado tarda hasta cinco minutos en llegarle al bot; **no afecta lo que se cobra**, que
  sigue siendo server-side.
- **Esa foto nunca cachea una carta vacía.** `getCatalogData()` lanza cuando falla una fuente
  crítica. Una carta legítimamente vacía tampoco se cachea; cada mensaje vuelve a consultar
  (rate limit de `chat`: 40 mensajes cada 10 minutos por IP).
- **El widget tiene dos plazos de espera, no uno** (`ChatWidget.tsx`): uno hasta que llega el
  primer fragmento del stream y otro entre fragmentos una vez que ya arrancó, que se reinicia
  con cada fragmento nuevo. **El primero tiene que ser mayor que el timeout del servidor**
  (el `AbortController` de 20s de `lib/deepseek.ts`, que cubre solo la conexión, no el cuerpo
  del stream): si el del cliente fuera igual o menor, abortaría requests que el servidor
  todavía estaba atendiendo bien.
- **El streaming fue verificado en producción el 06/09/2026:** El endpoint `/api/chat` entrega los fragmentos en tiempo real con `X-Accel-Buffering: no`, probado en vivo en `vocal-naiad-861a2c.netlify.app`.
- **Manejo de créditos insuficientes y fallas del bot (`lib/chat-fallas.ts` y `lib/aviso-sistema.ts`):**
  - **Detección de saldo insuficiente (HTTP 402) y key rechazada (HTTP 401):** Cuando DeepSeek responde sin créditos (HTTP 402) o con credencial inválida (HTTP 401), `alertaPorFallo()` genera una alerta del sistema con el encabezado `CHAT CAÍDO`, el motivo exacto y el enlace directo de recarga (`https://platform.deepseek.com`). Errores transitorios de servidor (HTTP 500 o timeouts) no generan alerta para evitar ruido.
  - **Alerta al dueño por Telegram sin spam:** `lib/aviso-sistema.ts:avisarFalloDelChat` despacha el aviso por Telegram (`sendTelegram`), pero previene el spam mediante deduplicación en la tabla `rate_limit_intentos` con una ventana de 1 hora (`VENTANA_AVISO = 3600`). Si entran decenas de clientes mientras no hay saldo, el dueño recibe un único mensaje por hora.
  - **Fallback elegante a WhatsApp (`ChatWidget.tsx`):** El cliente `ChatWidget` evalúa el status con `esFallaDelAsistente(status)`. Si recibe un código terminal (502 de backend caído o 503 sin key), se rinde limpiamente (`setSinBot(true)`): el panel abierto ofrece WhatsApp en lugar del campo de texto y, al cerrarlo, el botón del chat desaparece (desde el 10/10/2026 ya no se convierte en un segundo botón de WhatsApp: está el flotante de la izquierda). Si el error es transitorio (429 por rate limit propio o 400), el widget no se rinde porque reintentar minutos después sí funciona.
  - **Tests dedicados:** La lógica completa está cubierta por `tests/chat-fallas.test.ts` y se ejecuta con `pnpm test`.
- **`lib/marca.ts` no alcanza si el sitio no lee de ahí.** Empezó con 3 argumentos sin `id`; hoy
  tiene 7, cada uno con `id` estable para pedirlo puntual con `argumento()`. Lo leen el prompt
  del bot, cinco secciones del sitio (`Story`, `Hero`, `PizzaList`, `EmpanadasSection`,
  `Header`) y `lib/seo.ts`. Antes de este módulo la misma afirmación estuvo duplicada en cinco
  lugares: solo entra acá lo que es verificablemente cierto del negocio.
- **`BusinessConfig.deliveryEstimate`** es el único tiempo de entrega: lo usan siete lugares
  del sitio —tres en `Confirmation.tsx`, tres en `Checkout.tsx`, uno en `CartDrawer.tsx`— más
  el prompt del bot.
- **Qué sabe además de la carta (01/10/2026).** Preguntado en producción, respondía "no lo tengo"
  a medios de pago, horario (con el local cerrado el horario no viajaba), último pedido,
  Instagram y teléfono. Ahora el prompt lleva **EL LOCAL** (estado, horario, último pedido y días
  cerrados desde `diasApertura`, dirección, teléfono, WhatsApp, Instagram, mail), **QUIÉNES SOMOS**
  (`LEMA` y `ORIGEN_DEL_NOMBRE` de `lib/marca.ts`) y las **PREGUNTAS FRECUENTES** del sitio
  (`lib/faq.ts`, sin copiarlas). Con el delivery pausado omite la pregunta marcada
  `soloConDelivery`, y si el FAQ choca con EL LOCAL o EL ENVÍO mandan estos. Nunca da CBU ni
  alias. El FAQ de horarios dejó de tener "23:45" y "lunes" escritos a mano. Verificado con el
  bot local (dev) y `tests/chat-prompt.test.ts`.
- Lo que el bot **no** hace: no arma carrito, no toca la pantalla, no captura datos y no
  consulta el estado de pedidos. Nada de la conversación se guarda.

## Dominio propio (19/09/2026)

- **`impastopizzas.com`**, comprado en Hostinger. **El DNS se quedó en Hostinger** (nameservers
  `aster`/`helios.dns-parking.com`), no se pasó a Netlify DNS: los registros de Resend van en ese
  mismo panel.
- Registros: `A @ → 75.2.60.5` (balanceador de Netlify) y `CNAME www →
  vocal-naiad-861a2c.netlify.app`. No agregar otro `A` ni un `AAAA` en `@`.
- **El principal es `www.impastopizzas.com`**: Netlify recomienda `www` cuando el DNS es externo
  (el apex por registro `A` no pasa por su CDN). `impastopizzas.com` es alias y redirige 301 a `www`.
- Certificado Let's Encrypt para los dos nombres; lo renueva Netlify solo.
- `NEXT_PUBLIC_SITE_URL=https://www.impastopizzas.com` en Netlify (todos los contextos),
  reconstruido y verificado en producción: canonical, `og:url`, JSON-LD, `robots.txt` y sitemap.
- **Webhook de MP** (app `ImpastoIguazu`, id `6099901691897793`): producción y sandbox en
  `https://www.impastopizzas.com/api/payments/webhook`. Se guardó por MCP pidiendo solo el tema
  `order` y MP dejó suscritos `order` y `payment`; el handler resuelve los dos y es idempotente.
  El secreto no cambió (se comparó el prefijo con `MERCADOPAGO_WEBHOOK_SECRET`).
- **El subdominio `netlify.app` no redirige al dominio nuevo** (sigue dando 200 al 19/09). Los
  links viejos —seguimientos `/pedido/...`, el portfolio de `selvaDigital`— siguen andando, y
  Google consolida por el canonical.
- **Orden obligatorio si hay que rehacerlo: DNS primero, dominio en Netlify después.** Al revés,
  si Netlify redirigiera el subdominio a un dominio que todavía apunta a otro lado, se caen el
  sitio y el webhook de MP.
- En Windows, `curl` al apex recién configurado dio `000`: es el chequeo de revocación de
  schannel con un certificado recién emitido, no una falla. `curl --ssl-no-revoke` o `fetch` de
  Node devuelven el 301 correcto.
- La sesión del panel `/admin` es por dominio: en el dominio nuevo hay que volver a entrar.

## Rediseño mobile (19/09/2026)

Sale del handoff `design_handoff_impasto_mobile` (carta, empanadas, carrito y checkout). Todo
vive detrás del corte **760px**: `@media (max-width:760px)` en `impasto.css` y
`matchMedia("(max-width: 760px)")` en JS.

- **Escritorio no se toca.** Pedido explícito del dueño. Los tokens que cambian (`--muted`
  más oscuro, 16px en los campos, `100dvh`) están redefinidos dentro del media query, no en
  `:root`. En `Checkout.tsx` el JSX de escritorio es el mismo que antes y el de mobile es un
  bloque aparte (`.checkout-scroll` + `.co-footbar`). Se verificó comparando los estilos
  calculados de cada elemento contra la hoja anterior: 0 diferencias a 1280, 1000 y 800px.
- **Barra inferior (`.dock`)**: pestañas Pizzas/Empanadas/Bebidas, más «Ver mi pedido» o «Tu
  caja». Shell mide su alto con un `ResizeObserver` y lo publica en `--dock-h` sobre `<html>`:
  de ahí cuelgan el FAB del chat, el aviso (`.toast`) y el padding del footer.
- **El header se esconde al bajar**, salvo durante un scroll programado (pestañas, búsqueda):
  si se escondiera, quedaría un hueco de 56px sobre el destino. Lo controla `navegando` en
  Shell, que se libera con `scrollend` o a los 1,5 s.
- **La caja de empanadas vive en Shell** (la usan la grilla, el aside de escritorio y «Tu
  caja»). Al agregarla, mobile vuelve a la carta; escritorio se queda donde está.
- **La búsqueda mobile no filtra la carta**: tiene su propio texto y al elegir un resultado
  lleva a esa pizza (limpia filtros y la resalta). La de escritorio sigue en `PizzaList`.
- **El header mobile lleva el logo**, no el wordmark tipográfico que pedía el handoff: el
  dueño lo quiere porque es la esencia de la marca. A 44px de alto entra en el header de
  56px, así que no cambian los desplazamientos de 56px (rail, selector de empanadas, Shell).
- **Hero compacto** (opción A, elegida por el dueño): titular, cifras y «Pizzas desde $X»; se
  ocultan la franja verde, el párrafo, los botones y tres de las cuatro features. La primera
  pizza pasó de 1.624px a 453px.
- **Los gestos de la hoja del carrito** (arrastre para cerrar, Esc, foco atrapado) solo
  corren en mobile. El arrastre necesita `touch-action:none` en la manija y la cabecera, o el
  navegador cancela el gesto.
- **De Bebidas al footer, compacto** (segunda tanda, mismo día): la página mobile pasó de
  10.204 a 8.130px. Bebidas en filas con el mismo `+` / `− n +` que las pizzas (reusa las
  clases `.p-row-add` y `.p-row-step`); «Pedí por WhatsApp» sube al cierre de la carta como
  `PedidoWhatsapp` (en mobile se oculta la tarjeta de Opiniones); Nosotros sin las cifras que
  ya muestra el hero; las preguntas en una lista, **las nueve**, porque alimentan el
  `FAQPage` de `lib/seo.ts`; footer compacto.
- **Footer, en escritorio y mobile** (aprobado aparte): teléfono, mail e Instagram son
  enlaces (`lib/contacto.ts`, con test) y los días cerrados salen de `diasApertura`
  (`diasCerrados()` en `lib/hours.ts`), no de un «Lunes cerrado» fijo. Facebook sigue como
  texto: `facebook` guarda el nombre visible, no la URL de la página. El botón de WhatsApp
  abre el chat con «¡Hola! Quiero hacer un pedido.» ya escrito.
- **El carrito de cualquier prueba se guarda en `carritos`** (borrador por cookie en
  `/api/cart/draft`). Después de probar, vaciarlo desde la hoja **y** confirmar con
  `GET /api/cart/draft`: si se vacía rápido, un POST viejo puede llegar después del DELETE y
  dejar el borrador vivo (pasó dos veces; bug abierto).

## Cosas que hay que recordar hacer

- **`productos` es una tabla global compartida** con **Carro Fogón**. Desde el 24/08/2026 la
  separación es `proyecto_id` (`'impasto'` vs `'carro'`), no solo `categoria`. Igual conviene
  **no borrar ni editar las filas del carro** (`hamburguesas`, `lomos`, `calzones`, `otros`):
  comparten base y Mercado Pago en producción.
- **Webhook de MP:** conviene separar la URL de sandbox de la de producción; hoy las dos
  apuntan a `https://www.impastopizzas.com/api/payments/webhook`.
- **`info_empresa_impasto`** sigue siendo una tabla global con datos de Iguazú. Si otro de los
  dos proyectos la consulta directamente, va a mostrar estos datos.
- Si se rota el secreto del webhook en el panel de MP, actualizar `MERCADOPAGO_WEBHOOK_SECRET`
  **y reconstruir**, o el webhook rechaza todo con 401.

## Endurecimiento de producción (17/09/2026)

Tanda de arreglos posterior al review de los tres proyectos. Todo mergeado y desplegado.

- **`.env.example`**: `EMAIL_FROM` y `TELEGRAM_BOT_TOKEN` no tenían `=`; copiar la plantilla
  dejaba los avisos al local y los emails apagados en silencio. Se agregó `EMAIL_FROM_NAME`.
- **`getBusinessConfig()` falla cerrado**: ante error de base o fila faltante devuelve
  `ventasActivas: false`. Antes caía a los defaults del código con `ventasActivas: true` y podía
  aceptar pedidos sin poder confirmar que el local esté abierto.
- **`getCatalogData()` lanza** si no puede leer `productos` (endurecimiento del 17/09). Desde
  A09 también lanza por cualquier fuente de costeo fallida; solo consultas decorativas pueden
  degradarse (sin promos, testimonios o etiquetas).
- **Chat**: si el catálogo no está disponible responde 502; se agregó `app/error.tsx` con mensaje
  reintentable.
- **Migración `20260917210103_uniques-pedidos.sql`** (aplicada): `pedidos_numero_uidx` unique
  `(fecha, proyecto_id, numero_pedido)` y `pedidos_external_reference_uidx` unique **parcial**
  (`external_reference <> ''`). Ojo: `external_reference` es `NOT NULL DEFAULT ''` (los pedidos
  del POS quedan con `''`), por eso el unique es parcial. `clientes.telefono` ya tenía unique.
- **Migración `20260917211335_rls-acceso-minimo.sql`** (aplicada): se quitó la policy genérica de
  `authenticated` sobre `clientes` (PII) y `sucursales`. Ninguna app las usa con token de usuario
  (el recetario no las consulta; Impasto y Carro entran con la key de backend). El recetario **sí**
  sigue necesitando `authenticated` sobre `recetas`, `ingredientes`, `receta_ingredientes`,
  `costos_fijos`, `costos_variables`, `gastos`, `precios_venta`, `config_negocio`, `productos` y
  `pedidos`: **no quitarlas** o se rompe el dashboard.
- **Headers de seguridad** en `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` y HSTS.
- **Roles en la base**: `anon`, `authenticated` y `project_admin` (rol de la key `ik_`, sin login).
  Cada tabla tiene `project_admin_policy` (ALL, `using(true)`). La key `ik_` de
  `.insforge/project.json` está en texto plano (gitignoreada) y conviene rotarla.

### Cierre de esa tanda (18/09/2026)

- **Separación por rol — hecha.** Migración `20260918023143_recetario-solo-duenio.sql`: las
  tablas que el recetario lee con token de usuario (costos, recetas, `productos`, `pedidos`,
  `ventas_mes`) tienen la política `Recetario: usuarios habilitados`, que pide
  `public.es_usuario_recetario()`. Hoy es `true` solo para `spezialichristian@gmail.com`; las
  otras cuentas del pool (`megamuebles.lafalda@gmail.com` y las dos semilla de la plataforma)
  ven todo vacío. Impasto y el POS no se enteran: entran con la key de backend. Verificado
  simulando cada usuario con `set local role authenticated` + `request.jwt.claims` dentro de un
  `do $$ … raise exception $$`, que revierte todo (la CLI solo devuelve la última sentencia y
  rechaza SQL dinámico).
- **`ventas_mes` — creada.** Migración `20260918023148_ventas-mes.sql`. InsForge agrega
  `project_admin_policy` sola a cada tabla nueva: **no declararla en la migración** o falla con
  "already exists" (la migración se revierte entera, no queda a medias).
- **Contador de `numero_pedido` del POS — resuelto sin RPC.** El POS reintenta si dos terminales
  chocan (`insertarConNumero` en el carro). La web usa otro rango y no choca con el POS, pero
  su número derivado del reloj todavía puede colisionar con otro pedido web: pendiente A19.
- **CSP — en `Report-Only`** (`next.config.ts`): registra en la consola lo que bloquearía sin
  bloquear. **Pasarlo a `Content-Security-Policy` después de un pago real con tarjeta** que no
  deje violaciones en la consola.
- **Pendiente: rotar la key `ik_`.** Además de estar en texto plano en `.insforge/project.json`,
  el 17/09/2026 quedó impresa en la salida de `netlify env:list --plain` durante una sesión. La
  rotación toca `INSFORGE_API_KEY` en Netlify (Impasto), **`INSFORGE_ANON_KEY` en Vercel (el
  carro: a pesar del nombre, guarda la `ik_` de backend, solo del lado del servidor)**, los
  `.env.local` y `.insforge/project.json`. El recetario no: usa la anon key de verdad. La hace el
  dueño, porque implica manejar la key nueva. Después, reconstruir Impasto y el carro.

## Impresión térmica directa — avance 24/09/2026

Implementación publicada en `main`; desarrollo conservado en la rama
`feat/impresion-termica`. Plan: `docs/superpowers/plans/2026-09-23-impresion-termica-directa.md`.

- Agente C#/.NET Framework sin dependencias: ESC/POS 42 columnas, WPC1252,
  Winspool RAW, servidor 127.0.0.1:8765, CORS y secreto, registro durable anti-duplicados.
- Ticket corto ficticio confirmado legible, cortado y sin papel sobrante; ticket
  largo completo, cortado y con acentos correctos. Largo exacto no medido.
- 27 pruebas del agente aprobadas. Secreto en archivo local ignorado; nunca
  copiar su valor a esta memoria. Edge confirmó HTTPS → loopback desde ambas
  URLs reales con `403 pairing_required` usando un token de prueba incorrecto.
- El panel Impasto tiene envío manual al agente, reintento con la misma clave,
  emparejamiento por navegador y respaldo HTML. Carro Fogón guarda antes de
  imprimir, conserva el pedido si falla y ofrece reimpresión desde Comandas.
  Ambos cambios se publicaron en `main` el 24/09. El dueño confirmó al menos
  una comanda desde cada interfaz; faltan la matriz completa delivery/retiro,
  fallo de agente y la verificación de un solo registro por pedido en producción.
- `queued` solo significa enviado a cola; no equivale a papel impreso. Mercado
  Pago pendiente/rechazado no entra a cocina. No se cambiaron pagos ni la base.
- Arranque y recuperación: `printer-agent/README.md`; ejecutar
  el `start.ps1` instalado en `%LOCALAPPDATA%\ImpastoPrinter\agent\` en la PC
  de la Epson. La clave estable está en `config.local.json` en la carpeta padre
  y el acceso directo del escritorio **Clave impresora Impasto y Carro Fogón**
  abre ese archivo para copiarla. El secreto sigue siendo el mismo hasta que
  se rote; cada sitio lo recuerda por navegador/perfil. Si se cae el agente,
  comprobar `/health` con `Origin` permitido y revisar cola/papel antes de
  reimprimir. No borrar el
  ledger. Para volver manualmente, usar `Imprimir con navegador` en Impasto.

- Selección dual (24/09/2026, implementada): Impasto y Carro Fogón muestran un
  selector independiente en Pedidos/Comandas. El agente acepta solo IDs
  `epson` y `3nstar`, vinculados a colas locales configuradas, y guarda las
  elecciones en `%LOCALAPPDATA%\ImpastoPrinter\printer-selection.json`.
  Epson sigue como predeterminada. La cola USB `3nStar RPT006B` existe sobre
  `USB002` con `Generic / Text Only` para RAW. Windows rechazó el INF `POS-80`
  sin firma; no se desactivó esa protección. Ticket corto confirmado con
  acentos/corte. El primer ticket largo se cortó atravesando Pago; el perfil
  3nStar ahora avanza tres líneas adicionales antes del corte. El dueño
  confirmó que la segunda prueba larga cortó bien. `secondaryQueueName` local
  está activado; ambos orígenes informan
  las dos colas disponibles. Se comprobó por HTTP que elegir 3nStar en una web
  no cambia la otra y se restauró Epson en ambas. No copiar ni rotar el token
  al actualizar.

- **Copia del cliente (09/10/2026):** "Enviar a impresora térmica" imprime la comanda de cocina y después la copia para pegar en la caja (sin número de pedido, notas ni `REIMPRESIÓN`; con IMPASTO, precios, subtotal, envío, total, pago en texto para el cliente y pie de contacto), cada una con su corte. El detalle suma "Copia cliente". El formato vive en el agente versión 3 (`copy: "cliente"`); `lib/local-printer.ts` es idéntico al del POS y solo manda esa copia a un agente 3+. Reintentar manda solo las copias que faltaron, con sus claves (`<clave>` y `<clave>:cliente`). El agente ahora calcula la huella anti-duplicados sobre los bytes recibidos (reserializar el pedido no era estable). Diseño y plan: `docs/superpowers/specs/2026-10-09-copia-cliente-design.md`, `docs/superpowers/plans/2026-10-09-copia-cliente.md`.
- **Número corto en la comanda (09/10/2026):** la comanda térmica imprime `numero_pedido` (seis cifras en la web, 1, 2, 3… en el POS), como Carro Fogón, en lugar de la referencia `IM-MAN-…`/`POS-…` de más de 40 caracteres. `AdminOrder.numero` es solo para imprimir: `id`, la búsqueda y la base no cambian.
