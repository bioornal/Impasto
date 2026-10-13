# Bajar el egress de InsForge — diseño (13/10/2026)

## Por qué

El 12/10/2026 InsForge pausó la base por pasar los 5 GB de egress del plan free (5,52 GB). La base pesa 16 MB: el egress sale de lecturas repetidas. Medido sobre el backup de la pausa (tablas completas en JSON, aproximado):

- **Panel de Impasto:** cada 15 s baja **todos** los pedidos (`select *`, 33 pedidos = 35 KB). Con el panel abierto 10 h/día son ~84 MB/día, ~2,5 GB/mes, y crece con cada pedido.
- **Carta de la web:** `getCatalogData()` lee 12 tablas (~280 KB) en cada visita a la home, y también en cada pedido de `manifest`, `opengraph-image` y `llms.txt` (los cuatro `force-dynamic`) y de `/api/productos`.
- **POS:** `GET /api/productos` recalcula la carta (8 tablas, ~280 KB) cada vez que se monta "Nuevo pedido" y cada vez que la pestaña vuelve a estar visible.

Supabase free tiene el mismo tope de 5 GB: el arreglo es leer menos, no mudarse. Decisiones del dueño (13/10/2026): un precio cambiado tarda hasta **1 minuto** en verse en la home; el POS refresca la carta como mucho cada **5 minutos**.

## 1. Panel: solo lo que cambió

- **Migración** `migrations/20261013200000_pedidos-updated-at.sql`: `pedidos.updated_at timestamptz not null default now()`, función `public.pedidos_marcar_actualizado()` (`set search_path = ''`, `new.updated_at := pg_catalog.now()`) y trigger `before update` que la llama; índice `(proyecto_id, updated_at)`. Cubre cambios de la web, del POS, del webhook de MP y de SQL. Las filas existentes quedan con la hora de la migración. Carro Fogón y el recetario no se enteran (columna nueva con default).
- **`GET /api/admin/pedidos?desde=<ISO>`:** igual que hoy pero con `.gte("updated_at", desde)`. `desde` inválido → 400. Sin `desde`, la lista completa de siempre.
- **Panel (`StoreProvider`):** guarda un cursor = máximo `updated_at` recibido. Cada 15 s pide `?desde=cursor − 60 s` (el solapamiento cubre transacciones que confirman tarde: `now()` es la hora de inicio de la transacción) y **une** los cambios por `_dbId`, ordenados como el servidor (`created_at` desc, `id` asc). Cada 40 sondeos (10 min) pide la lista completa y la reemplaza (reconcilia pedidos eliminados desde otro dispositivo).
- **Sin la columna** (deploy antes de la migración): las filas no traen `updated_at`, el cursor queda nulo y el panel sigue pidiendo la lista completa como hoy; si `?desde` falla, reintenta completo en el mismo sondeo. Nunca deja de recibir pedidos.
- La campanilla no cambia: `pedidosNuevosParaCocina` y `registrarPedidosConocidosParaCocina` ya trabajan sobre cualquier lista (el historial de conocidos es monótono).
- Lógica pura en `lib/pedidos-incrementales.ts`: `cursorDePedidos`, `desdeParaConsulta`, `unirPedidos`, `POLLS_ENTRE_RECARGAS`.

## 2. Web: carta en caché de 1 minuto, nunca más vieja que 5

- `lib/catalog-cache.ts`: `getCatalogDataVisible()` envuelve `getCatalogData()` en `unstable_cache` (60 s, tag `catalogo`) y guarda la hora de lectura. Si lo cacheado tiene más de **5 minutos** (`catalogoVigente`, puro, en `lib/catalog-vigencia.ts`), lee fresco: con la base caída más de 5 minutos, la home muestra la pantalla de error con WhatsApp como hoy.
- La usan la home, `manifest.ts`, `opengraph-image.tsx`, `llms.txt` y `/api/productos`.
- **Siguen frescos** `lib/order-quote.ts` (cotización y pedido) y el chat (su foto de 5 min): la venta se sigue bloqueando si falla una fuente de precios (A09).
- `revalidateTag("catalogo", { expire: 0 })` en las mutaciones del panel que cambian la carta: productos (alta, edición, baja, foto), etiquetas y testimonios. El dueño ve su cambio al instante.
- El caché solo guarda datos para mostrar: `unstable_cache` serializa a JSON y el costeo (WeakMap) no viaja, pero la home no lo usa.

## 3. POS (Carro Fogón): carta como mucho cada 5 minutos

- `src/lib/carta-refresco.ts`: `debeRecargarCarta(cargadaAt, ahora, maxMs = 5 min)`.
- El store guarda `productosCargadosAt` (de sesión, no persistido). `Cards` no vuelve a pedir `/api/productos` al montarse ni al volver a la pestaña si la carta tiene menos de 5 minutos y no hubo error. Recargar la página (F5) siempre trae la carta.
- `POST /api/pedidos` sigue validando con precios frescos y devuelve 409 si un producto ya no se vende: la comanda imprime el precio real del servidor.

## Fuera de alcance

Fotos del bucket `DB` (medir con los registros cuando vuelva la base), la cotización del checkout, `/api/store-status` (1–2 KB por minuto por pestaña).

## Pruebas y publicación

- Tests: `tests/pedidos-incrementales.test.ts`, `tests/catalog-vigencia.test.ts` (Impasto) y `tests/carta-refresco.test.ts` (Carro Fogón); `pnpm test`, TypeScript, eslint y build en Impasto; `npm test` y build en Carro Fogón.
- Orden: **migración primero** (necesita la base), después el deploy de Impasto. El POS y la caché de la carta no dependen de la migración.
- Con la base de vuelta: comprobar en producción que el sondeo con `?desde` devuelve `[]` sin cambios y trae un pedido nuevo, y comparar el egress diario antes y después.
