-- ============================================================================
-- Migración: Habilitar RLS y Seguridad en las 20 Tablas Públicas
-- ============================================================================

-- 1. Índices faltantes para rendimiento y relaciones de clave foránea
create index if not exists idx_precios_venta_receta_id on precios_venta (receta_id);
create index if not exists idx_receta_ingredientes_receta_id on receta_ingredientes (receta_id);
create index if not exists idx_receta_ingredientes_ingrediente_id on receta_ingredientes (ingrediente_id);

-- 2. Habilitar Row Level Security (RLS) en las 20 tablas de public
alter table carritos enable row level security;
alter table clientes enable row level security;
alter table config_negocio enable row level security;
alter table costos_fijos enable row level security;
alter table costos_variables enable row level security;
alter table etiquetas enable row level security;
alter table gastos enable row level security;
alter table info_empresa_impasto enable row level security;
alter table ingredientes enable row level security;
alter table notificaciones enable row level security;
alter table pedido_eventos enable row level security;
alter table pedidos enable row level security;
alter table precios_venta enable row level security;
alter table productos enable row level security;
alter table promociones enable row level security;
alter table rate_limit_intentos enable row level security;
alter table receta_ingredientes enable row level security;
alter table recetas enable row level security;
alter table sucursales enable row level security;
alter table testimonios enable row level security;

-- 3. Revocar permisos de escritura directos al rol anónimo
revoke insert, update, delete on all tables in schema public from anon;

-- 4. Políticas de lectura pública (Storefront y catálogo web)
drop policy if exists "Lectura pública de productos" on productos;
create policy "Lectura pública de productos" on productos for select using (true);

drop policy if exists "Lectura pública de etiquetas" on etiquetas;
create policy "Lectura pública de etiquetas" on etiquetas for select using (true);

drop policy if exists "Lectura pública de sucursales" on sucursales;
create policy "Lectura pública de sucursales" on sucursales for select using (true);

drop policy if exists "Lectura pública de promociones" on promociones;
create policy "Lectura pública de promociones" on promociones for select using (true);

drop policy if exists "Lectura pública de testimonios" on testimonios;
create policy "Lectura pública de testimonios" on testimonios for select using (true);

-- 5. Políticas de gestión para usuarios autenticados (Dashboard / Recetario / POS)
drop policy if exists "Acceso autenticado recetas" on recetas;
create policy "Acceso autenticado recetas" on recetas for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado ingredientes" on ingredientes;
create policy "Acceso autenticado ingredientes" on ingredientes for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado receta_ingredientes" on receta_ingredientes;
create policy "Acceso autenticado receta_ingredientes" on receta_ingredientes for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado costos_fijos" on costos_fijos;
create policy "Acceso autenticado costos_fijos" on costos_fijos for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado costos_variables" on costos_variables;
create policy "Acceso autenticado costos_variables" on costos_variables for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado gastos" on gastos;
create policy "Acceso autenticado gastos" on gastos for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado precios_venta" on precios_venta;
create policy "Acceso autenticado precios_venta" on precios_venta for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado config_negocio" on config_negocio;
create policy "Acceso autenticado config_negocio" on config_negocio for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado productos" on productos;
create policy "Acceso autenticado productos" on productos for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado pedidos" on pedidos;
create policy "Acceso autenticado pedidos" on pedidos for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado clientes" on clientes;
create policy "Acceso autenticado clientes" on clientes for all to authenticated using (true) with check (true);

drop policy if exists "Acceso autenticado sucursales" on sucursales;
create policy "Acceso autenticado sucursales" on sucursales for all to authenticated using (true) with check (true);
