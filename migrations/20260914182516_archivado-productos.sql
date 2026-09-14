-- Baja de carta sin borrar: `archivado = true` saca el producto de la web y de
-- Carro Fogón, pero conserva la fila, la receta y el historial de costos.
-- Distinto de `disponible = false`, que es faltante temporal de stock (la web
-- lo muestra agotado). Todas las filas existentes quedan en false: el cliente
-- no ve ningún cambio hasta que alguien archive un producto.
-- Tiene que estar aplicada ANTES de desplegar el código que filtra por esta
-- columna (lib/catalog.ts, carro GET /api/productos, recetario precios.astro):
-- sin ella, la web muestra la carta vacía y el POS responde 500.
alter table public.productos
  add column if not exists archivado boolean not null default false;

create index if not exists productos_archivado_idx
  on public.productos (proyecto_id, archivado);
