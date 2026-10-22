# Rediseño del panel de administración — diseño

Fecha: 22/10/2026. Pedido del dueño: "mejorar el panel para que sea súper profesional": Configuración incómoda, tablas con demasiado espacio entre celdas, Dashboard demasiado espacioso, revisar si conviene reestructurar las secciones.

Decisiones del dueño, tomadas sobre maquetas (`.superpowers/brainstorm/`, fuera del repo):

1. **Ordenar el panel por momento de uso**, con una pantalla nueva **Arranque de la noche** (opción A de "estructura").
2. **Pedidos como tabla compacta** con acciones en la fila (opción A de "pedidos"), tarjetas en el celular.
3. **Estilo visual neutro**, tipo herramienta de gestión (opción B de "dashboard y estilo"): grises, negro, una sola tipografía, sin la identidad de la web.
4. Usa el panel **en la computadora del local y en el celular por igual**. Durante el servicio: mirar pedidos, cambiarles el estado e imprimir comandas. Al empezar la noche: prender o apagar venta, delivery y masas.

## Diagnóstico (medido el 22/10/2026 con los datos reales, 1366 px)

| Sección | Hoy | Causa |
|---|---|---|
| Título de cada sección | invisible (`rgb(246,241,231)` sobre blanco) | `app/layout.tsx` carga `impasto.css` en todas las rutas; su `.topbar` (y `.btn`, `h1…h5`) pisa las del panel |
| Pedidos | filas de 119–123 px, página de 5.566 px con 45 pedidos, desborde horizontal (tabla 1.152 px en 1.033) | la columna Orden muestra la referencia `IM-MAN-<uuid>` (5 líneas); Items se parte en 3–4 líneas |
| Productos | filas de 121 px, página de 8.496 px con 72 productos, desborde horizontal | foto arriba del nombre; mezcla productos en carta y dados de baja |
| Clientes | filas de 63–70 px, página de 2.870 px | `td` con 14×20 px de relleno, notas sin cortar |
| Configuración | un formulario de 2.162 px con un solo "Guardar" al final | mezcla interruptores de cada noche con datos que casi nunca cambian |
| Dashboard | tarjetas de 146 px con un solo número; filas de 67 px | tipografía display de 34 px, rellenos de 20–22 px |
| Detalles | buscador de arriba sin función (`⌘K` decorativo); pie "Mauro"; Cupos, Productos y Etiquetas con el mismo ícono; cupos editables en dos lugares; subtítulo de Configuración "zonas de envío" (no existen) | — |

## 1. Estructura y navegación

**Menú lateral, agrupado:**

- **Esta noche:** Arranque · Pedidos (contador de nuevos) · Resumen diario
- **Carta:** Productos · Etiquetas
- **Negocio:** Dashboard · Clientes · Testimonios (contador de pendientes)
- **Ajustes:** Configuración · Ver sitio público

"Cupos de la noche" deja de ser sección: vive en el Arranque. La columna "Quedan hoy" sale de Productos (un solo lugar para los cupos).

**Pantalla de inicio:** si hoy es un día de apertura (`sucursales.dias_apertura`), el panel abre en **Arranque**; si no, en **Dashboard**. Dentro de la sesión del navegador recuerda la última sección (`sessionStorage`, con `try/catch`).

**Barra superior (todas las pantallas):**

- Título y subtítulo de la sección, visibles.
- Píldoras de estado **Venta · Delivery · Masas** (verde prendido, rojo apagado/agotada; "Masas" dice "Molde agotada" o "Napoletana agotada" si falta una). Tocar una lleva al Arranque.
- Sonido (como hoy).
- **Buscador funcional** (ver §6). En el celular se abre con un ícono.

**Pie del menú:** el mail de la sesión en vez de "Mauro", y "Salir". `app/admin/layout.tsx` ya llama a `getCurrentAdmin()`; le pasa el mail al panel (prop o contexto), sin consultas nuevas. Cada sección tiene su ícono propio.

**Celular (≤ 760 px):** menú por hamburguesa (como hoy); las píldoras de estado quedan visibles debajo del título.

## 2. Arranque de la noche (pantalla nueva)

De arriba abajo:

1. **Interruptores**, guardado inmediato (sin botón):
   - **Tomando pedidos** (`ventas_activas`). Apagado muestra "Motivo que ve el cliente" (`mensaje_cierre`).
   - **Delivery** (`delivery_activo`). Apagado muestra el motivo (`mensaje_delivery`, con `MENSAJE_DELIVERY_DEFAULT` de placeholder).
   - **Napoletana** y **Al molde** (`masa_napoletana_activa`, `masa_molde_activa`). La que quedaría sola no se puede apagar (deshabilitada con explicación); debajo, el texto que ve el cliente (`estadoMasas(...).aviso`).
   - Cada cambio: actualización optimista, `PUT /api/admin/sucursal` solo con ese campo, aviso ("Delivery pausado"). Si falla, vuelve al valor anterior y muestra el error del servidor. Los motivos se guardan al salir del campo (blur) o con Enter.
2. **Cupos de la noche:** la lista actual de `Cupos.tsx`/`CupoControl.tsx` (mismo `useCuposNoche`, mismo guardado a los 700 ms), ordenada con las agotadas y las de 2 o menos arriba y marcadas.
3. **Pedidos activos:** la misma tabla de Pedidos (§3) filtrada en Activos, sin la barra de filtros; enlace "Ver todos los pedidos".

## 3. Pedidos

- **Filtros:** **Activos** (por defecto: `nuevo`, `preparando`, `en-camino`) · Nuevos · Preparando · En camino · Entregados · Cancelados · Todos, con contadores. Buscador por número o cliente.
- **Columnas** (filas de ~44 px, sin desborde a 1.024 px):
  - **#**: `numero` corto (`107345`; POS: `POS 3`). La referencia larga queda en el detalle.
  - **Cliente**: nombre + enlace de WhatsApp (`TelCliente`) y "hace X min" en gris, en una línea si entra.
  - **Pedido**: ítems en una línea con "…" y "+N" si hay más.
  - **Entrega**: ícono + Delivery / Retiro.
  - **Pago**: medio + avisos actuales ("pago pendiente", "entregado · falta registrar pago", "📎 comprobante" / "sin comprobante").
  - **Total**, **Estado** (chip).
  - **Acciones:** botón **"→ siguiente estado"** e **imprimir**.
- **Siguiente estado:** `nuevo → preparando → en-camino → entregado`; para retiro, `en-camino` se lee "Listo para retirar". Con las reglas actuales: si el pedido no está habilitado para cocina (`esPedidoParaCocina` falso, p. ej. tarjeta sin acreditar), el botón y la impresión quedan deshabilitados con el motivo en el `title`. Usa `updateOrderStatus` (el mismo camino que el detalle). Entregados y cancelados no tienen botón.
- **Quedan en el detalle** (se abre tocando la fila, como hoy): cancelar, eliminar, cobros, devolución, copia cliente.
- **Menú "⋯"** junto al buscador: Seleccionar (muestra las casillas y "Eliminar seleccionados"), Emparejar impresora, selector de impresora (Epson / 3nStar).
- **"Avisos pendientes de entrega"** (`NotificationsRecovery`) solo se muestra si hay avisos pendientes.
- **Celular:** cada pedido es una tarjeta (número, chip de estado, cliente · entrega · total, una línea de ítems, botón "→ siguiente estado" a todo el ancho + imprimir).

## 4. El resto de las secciones

**Dashboard:**

- 4 tarjetas de ~70 px: **Ventas esta noche** (noche de negocio de 06:00 a 05:59, como el Resumen diario; comparada con la misma noche de la semana anterior), **Pedidos** (web · POS), **Ticket promedio** (últimos 30 días), **Activos ahora** (con cuántos tienen pago pendiente).
- Dos columnas: gráfico de ventas **por noche de servicio** (7 / 14 / 30 noches con ventas o de apertura; sin barras en cero de lunes a jueves) y "Más vendidas" (top 5, **solo pizzas y empanadas**, reconocidas como en `lib/resumen-diario.ts`) con la barra de masas debajo.
- Sale "Pedidos recientes".

**Productos:** foto de 32 px junto al nombre en la misma línea, descripción en una línea con "…" (filas de ~48 px). Filtro nuevo **En carta / Dados de baja** (por defecto En carta; `archivado`) además de Pizzas / Empanadas / Bebidas. Sale "Quedan hoy". "Disponible" queda como interruptor en la fila. El formulario de edición no cambia de contenido; se ajusta al estilo.

**Clientes:** filas de una línea (~44 px); notas cortadas con "…", completas en el detalle.

**Resumen diario, Etiquetas, Testimonios:** mismo contenido, estilo y densidad nuevos.

**Configuración:** solo lo que casi nunca cambia, en pestañas: **Horario** (días, abre, último pedido, texto) · **Delivery** (tarifa, envío gratis desde) · **Datos del local** · **Cuentas para transferencias**. Cada pestaña tiene su "Guardar" y avisa si se cambia de pestaña o de sección con cambios sin guardar. Subtítulo: "Horario, delivery, datos del local y cuentas".

## 5. Sistema visual

- **Separar los estilos del sitio y del panel:** la web pública pasa a un grupo de rutas `app/(sitio)/` con su propio layout, que importa `impasto.css`. El layout raíz conserva `<html>`, `<body>`, metadatos y `globals.css`. El panel (`/admin`, `/admin-login`) deja de recibir `impasto.css`. Las URLs no cambian (los grupos entre paréntesis no forman parte de la ruta).
- **Paleta neutra** (variables `--a-*` de `admin.css`): fondo `#f6f7f9`, superficie `#fff`, bordes `#e3e6eb`, texto `#111827`, secundario `#6b7280`. Color solo para estados (verde ok, ámbar pendiente, rojo problema, azul nuevo, violeta en camino) y el botón principal (casi negro).
- **Tipografía:** Inter en todo (títulos con peso 600–650). Sin Playfair, sin mayúsculas espaciadas en encabezados de tabla (texto chico gris en minúscula/tipo oración).
- **Menú lateral claro** (blanco con borde), sección activa en gris oscuro.
- **Medidas:** filas de tabla 40–44 px (`td` 8×12 px), encabezados de 32 px, tarjetas de ~70 px, márgenes del contenido 16–20 px (hoy 28), radios de 8–10 px, sombras mínimas.
- La comanda térmica (`@media print`) no cambia.

## 6. Arquitectura

**Unidades nuevas o divididas:**

- `app/admin/components/SucursalProvider.tsx` — contexto con la fila de `sucursales` (`GET /api/admin/sucursal`), `cambiar(campo, valor)` con guardado optimista y reversión, y `guardar(parcial)` para las pestañas de Configuración. Lo usan la barra superior (píldoras), el Arranque y Configuración. Se refresca al volver a la pestaña del navegador.
- `app/admin/components/Arranque.tsx` — pantalla nueva (interruptores + cupos + pedidos activos).
- `app/admin/components/Interruptor.tsx` — interruptor accesible (`role="switch"`, `aria-checked`), reutilizado en Arranque y Productos.
- `Orders.tsx` (611 líneas) se divide: `OrdersTable.tsx` (tabla/tarjetas, filtros, acciones de fila; recibe `filtro` y `compacta`), `OrderDetail.tsx` (el detalle actual, sin cambios de lógica) y lo que queda de `Orders.tsx` (impresión, selección, eliminación).
- `Settings.tsx` pasa a pestañas usando `SucursalProvider`; los interruptores salen de ahí.
- `app/admin/components/BusquedaGlobal.tsx` — buscador de la barra superior.
- `app/(sitio)/layout.tsx` — layout de la web con `impasto.css`; se mueven ahí `page.tsx`, `pedido/`, `terminos/`, `privacidad/`, `reembolso/`, `cocina/`, `not-found.tsx`, `error.tsx` y los archivos que solo usa la web. `api/`, `admin/`, `admin-login/`, `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`, `llms.txt` y `favicon.ico` quedan donde están si no dependen de `impasto.css` (se verifica en el plan).

**Lógica pura en `lib/` (testeable con `tsx`):**

- `lib/admin-pedidos.ts`: `siguienteEstado(pedido)` → `{ estado, etiqueta } | null` (respeta `esPedidoParaCocina` y la modalidad), `esActivo(pedido)`, `numeroCorto(pedido)` (`107345` / `POS 3`), `resumenItems(items, max)` → `{ texto, resto }`.
- `lib/admin-dashboard.ts`: ventas por noche de servicio (reusa `diaDeNegocio`), comparación con la misma noche de la semana anterior, top de pizzas y empanadas.
- `lib/busqueda-admin.ts`: `buscar(texto, { pedidos, clientes, productos })` → hasta 8 resultados agrupados (por número, nombre de cliente, teléfono, nombre de producto; sin tildes ni mayúsculas).
- `lib/inicio-admin.ts`: `seccionInicial(diasApertura, ahora, guardada)`.

**Búsqueda global:** busca en lo que el panel ya tiene cargado (`state.orders`, `state.customers`, `state.products`); no hace consultas nuevas. Elegir un resultado lleva a la sección y abre el detalle (pedido), el detalle del cliente o la edición del producto. `Ctrl+K` / `⌘K` enfoca el buscador; Esc lo cierra.

**Sin cambios de base ni de API**, salvo que el panel use los campos parciales que `PUT /api/admin/sucursal` ya acepta.

## 7. Errores y casos borde

- Interruptor que falla al guardar: vuelve al valor anterior, aviso con el error del servidor (incluido el 400 de "tiene que quedar al menos una masa").
- Sin sesión o sesión vencida en un guardado (401): el comportamiento actual del panel (`getCurrentAdmin` renueva; si no puede, va al login).
- Sucursal que no carga: el Arranque y las píldoras muestran "No se pudo cargar el estado del local" con "Reintentar"; el resto del panel funciona.
- Pedido que cambia de estado mientras se mira (sondeo cada 15 s): la fila se actualiza; si el botón "siguiente estado" se toca con un estado viejo, el servidor manda (como hoy en el detalle).
- `sessionStorage` bloqueado: se ignora y arranca con la regla del día.

## 8. Pruebas y verificación

- Tests nuevos (`tsx`, en `pnpm test`): `tests/admin-pedidos.test.ts`, `tests/admin-dashboard.test.ts`, `tests/busqueda-admin.test.ts`, `tests/inicio-admin.test.ts`.
- `pnpm test`, `tsc`, eslint de lo tocado, `pnpm build`.
- En el navegador, con la sesión del dueño y la base real, a 1366 px y 375 px: cada sección; filas de Pedidos ≤ 48 px y sin desborde horizontal; título visible; interruptores (prender y apagar delivery y una masa, y volver a dejarlos como estaban); "→ siguiente estado" sobre un pedido de prueba o uno ya entregado (sin tocar pedidos reales activos sin permiso); búsqueda; pestañas de Configuración con aviso de cambios sin guardar.
- La web pública después de mover a `app/(sitio)/`: home, carrito, checkout, `/pedido/[ref]`, `/cocina`, legales, `robots.txt`, `sitemap.xml`, `llms.txt`, miniatura OG y 404, comparando estilos calculados con la versión anterior (sin diferencias).

## Fuera de alcance

- El POS (Carro Fogón) y el recetario.
- Cambios de lógica de pedidos, cobros, impresión o cupos (solo cambia dónde y cómo se muestran).
- Modo oscuro del panel.
