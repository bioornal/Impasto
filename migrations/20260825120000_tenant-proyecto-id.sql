-- Separación de tenants en la MISMA base (sin base nueva).
--
-- `productos` y `pedidos` son tablas compartidas entre Impasto y Carro Fogón
-- sin columna de pertenencia: el único criterio era `categoria` (frágil y
-- fuente de la fuga documentada) o `sucursal_id` (solo lo escribe Impasto).
-- `clientes` queda compartida a propósito: el cliente es de la empresa,
-- pida por la tienda o por el carro.
--
-- La columna queda NULLABLE a propósito: así los inserts del código viejo no
-- se rompen durante la ventana entre esta migración y el deploy del código que
-- escribe `proyecto_id`. Los inserts nuevos lo escriben siempre (ver código).

alter table productos add column if not exists proyecto_id text;
alter table pedidos   add column if not exists proyecto_id text;

-- Backfill de productos por categoría (criterio documentado en lib/categorias.ts).
update productos set proyecto_id = 'impasto'
 where categoria in ('pizzas', 'empanadas', 'bebidas');

-- Todo lo demás (hamburguesas, lomos, calzones, otros, o categoría nula) es del carro.
update productos set proyecto_id = 'carro'
 where proyecto_id is null;

-- Backfill de pedidos: Impasto pone sucursal_id = 'iguazu' y
-- external_reference = 'IM-…'; el carro no escribe ninguno de los dos.
update pedidos set proyecto_id = 'impasto'
 where sucursal_id = 'iguazu' or external_reference like 'IM-%';

update pedidos set proyecto_id = 'carro'
 where proyecto_id is null;

create index if not exists productos_proyecto_idx on productos (proyecto_id);
create index if not exists pedidos_proyecto_idx on pedidos (proyecto_id);
