-- Los pedidos se toman hasta las 23:45, no hasta medianoche.
update sucursales set hora_cierre = '23:45' where hora_cierre = '00:00';

-- Interruptor manual: vacaciones, imprevistos, corte de luz.
-- Manda por encima del horario: si está en false, no se vende aunque sea la hora.
alter table sucursales add column if not exists ventas_activas boolean not null default true;
alter table sucursales add column if not exists mensaje_cierre text not null default '';

-- El local no hace borde relleno.
alter table sucursales drop column if exists borde_relleno;
