-- Horarios estructurados: hasta ahora `horarios` era solo texto para mostrar,
-- así que se podía pedir (y cobrar) a cualquier hora.
-- dias_apertura usa la numeración de JS: 0=domingo … 6=sábado.
alter table sucursales add column if not exists dias_apertura text not null default '2,3,4,5,6,0';
alter table sucursales add column if not exists hora_apertura text not null default '19:30';
alter table sucursales add column if not exists hora_cierre text not null default '00:00';
alter table sucursales add column if not exists zona_horaria text not null default 'America/Argentina/Buenos_Aires';

-- Estas dos las leía business-server.ts pero no existían: siempre caía al
-- valor fijo del código, así que no eran configurables de verdad.
alter table sucursales add column if not exists envio_gratis_desde integer not null default 25000;
alter table sucursales add column if not exists borde_relleno integer not null default 1500;

-- Rate limiting con respaldo en base: las funciones serverless no comparten
-- memoria entre instancias, así que un contador en proceso no sirve.
create table if not exists rate_limit_intentos (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_clave_idx on rate_limit_intentos (clave, created_at desc);
