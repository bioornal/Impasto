-- Integridad de `pedidos` (Fase 1 — review de produccion).
--
-- `external_reference` es NOT NULL con default '': los pedidos del POS
-- (carroFogon) no la traen y quedan con cadena vacia. Por eso el indice unico es
-- PARCIAL: exige unicidad solo sobre referencias reales y deja convivir muchos ''.

-- 1. Un pedido por (fecha, proyecto, numero). El numero se calcula como MAX+1 en
--    la aplicacion, que no es atomico: dos terminales pueden calcular el mismo y
--    quedar duplicado. Este indice hace fallar la segunda escritura.
create unique index if not exists pedidos_numero_uidx
  on pedidos (fecha, proyecto_id, numero_pedido);

-- 2. La referencia de pago real es unica. El webhook de Mercado Pago y el
--    reintento de tarjeta buscan por ella con `.limit(1)`; una colision
--    actualizaria el pedido equivocado. Se conserva el indice no unico existente
--    para las busquedas que incluyen cadenas vacias.
create unique index if not exists pedidos_external_reference_uidx
  on pedidos (external_reference)
  where external_reference <> '';
