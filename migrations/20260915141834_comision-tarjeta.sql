-- Comisión de Mercado Pago por venta con tarjeta, en %, IVA incluido.
-- La escribe el recetario (Costos) y la leen Precios y Ganancias.
-- 7,99 % es lo que retuvo MP en la primera venta real (15/09/2026, dinero al instante).
-- Tiene que estar aplicada ANTES de desplegar el recetario que la lee (costos,
-- precios y ganancias .astro): sin ella falla toda la consulta de config_negocio
-- y esas páginas calculan con sus defaults (800 pizzas/mes) sin mostrar error.
alter table public.config_negocio
  add column if not exists comision_tarjeta_pct numeric not null default 7.99;
