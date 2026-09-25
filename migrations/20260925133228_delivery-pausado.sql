-- Interruptor del reparto: el local puede seguir vendiendo solo para retirar.
-- Mismo modelo que ventas_activas / mensaje_cierre (20260818215638_config-tienda.sql).
alter table sucursales add column if not exists delivery_activo boolean not null default true;
alter table sucursales add column if not exists mensaje_delivery text not null default '';
