-- Categorías de precios_venta (Pizzas, Empanadas, ...) cuyo precio de venta absorbe la
-- comisión de Mercado Pago: markup ÷ (1 − comision_tarjeta_pct). La escribe el recetario
-- (Precios) y la leen el recetario, la web de Impasto y Carro Fogón.
-- Vacía por defecto: aplicarla no cambia ningún precio.
-- Tiene que estar aplicada ANTES de desplegar cualquiera de los tres: el código nuevo pide
-- esta columna a config_negocio y, si no existe, esa consulta falla y la web y el carro
-- calculan con costo operativo 0 (precios más bajos) sin mostrar error.
alter table public.config_negocio
  add column if not exists comision_en_precio text[] not null default '{}';
