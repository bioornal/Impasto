-- Etapa 1: administración privada. No modifica promociones ni la carta pública.
create table ofertas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id text not null default 'impasto',
  tipo text not null check (tipo in ('combo', 'descuento_cantidad', 'regalo')),
  nombre text not null,
  titulo text not null,
  descripcion text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'pausada')),
  config jsonb not null,
  dias int[] not null default '{5,6,0}',
  desde date,
  hasta date,
  orden int not null default 0,
  aprobada_en timestamptz,
  creada_en timestamptz default now(),
  actualizada_en timestamptz default now()
);
create index ofertas_proyecto_estado_idx on ofertas (proyecto_id, estado);
alter table ofertas enable row level security;
-- InsForge administra la política de backend; no se concede acceso público.

insert into ofertas (nombre, titulo, descripcion, tipo, estado, orden, config) values
('Dúo Muzza', 'Dúo Muzza', 'Dos muzzas para compartir.', 'combo', 'pendiente', 0,
 jsonb_build_object('precio', 26900, 'lugares', jsonb_build_array(jsonb_build_object('cantidad', 2, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Muzzarella Impasto' and not archivado limit 1))))));

insert into ofertas (nombre, titulo, descripcion, tipo, estado, orden, config) values
('Pizza + gaseosa', 'Pizza y gaseosa', 'Jamón y muzza con tu gaseosa favorita.', 'combo', 'pendiente', 1,
 jsonb_build_object('precio', 21500, 'lugares', jsonb_build_array(jsonb_build_object('cantidad', 1, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Muzzarela y Jamon' and not archivado limit 1))),
 jsonb_build_object('cantidad', 1, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Pepsi 1.5 L' and not archivado limit 1), (select id from productos where proyecto_id='impasto' and nombre='7-Up 1.5 L' and not archivado limit 1))))));

insert into ofertas (nombre, titulo, descripcion, tipo, estado, orden, config) values
('Noche Impasto', 'Noche Impasto', 'Tres pizzas y Coca grande para la mesa.', 'combo', 'pendiente', 2,
 jsonb_build_object('precio', 55000, 'lugares', jsonb_build_array(jsonb_build_object('cantidad', 1, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Muzzarella Impasto' and not archivado limit 1))),
 jsonb_build_object('cantidad', 1, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Muzzarela y Jamon' and not archivado limit 1))),
 jsonb_build_object('cantidad', 1, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Napoletana all''Aglio' and not archivado limit 1), (select id from productos where proyecto_id='impasto' and nombre='Diavola al Miele Piccante' and not archivado limit 1), (select id from productos where proyecto_id='impasto' and nombre='Palmitos y Salsa Golf' and not archivado limit 1), (select id from productos where proyecto_id='impasto' and nombre='Provoleta Impasto' and not archivado limit 1), (select id from productos where proyecto_id='impasto' and nombre='Fugazzetta' and not archivado limit 1))),
 jsonb_build_object('cantidad', 1, 'productos', jsonb_build_array((select id from productos where proyecto_id='impasto' and nombre='Coca-Cola 1.5 L' and not archivado limit 1))))));

insert into ofertas (nombre, titulo, descripcion, tipo, estado, orden, config) values
('2ª pizza al 50 %', 'La segunda, a mitad de precio', 'Pedí dos pizzas y pagá la más barata al 50%.', 'descuento_cantidad', 'pendiente', 3,
 jsonb_build_object('cada', 2, 'porcentaje', 50, 'productos', null));

insert into ofertas (nombre, titulo, descripcion, tipo, estado, orden, config) values
('Gaseosa de regalo', 'La gaseosa va de regalo', 'Llevá dos pizzas y elegí Pepsi o 7-Up. Coca por $2.000 más.', 'regalo', 'pendiente', 4,
 jsonb_build_object('minimoPizzas', 2, 'cantidad', 1, 'opciones', jsonb_build_array(
 jsonb_build_object('producto', (select id from productos where proyecto_id='impasto' and nombre='Pepsi 1.5 L' and not archivado limit 1), 'suplemento', 0),
 jsonb_build_object('producto', (select id from productos where proyecto_id='impasto' and nombre='7-Up 1.5 L' and not archivado limit 1), 'suplemento', 0),
 jsonb_build_object('producto', (select id from productos where proyecto_id='impasto' and nombre='Coca-Cola 1.5 L' and not archivado limit 1), 'suplemento', 2000))));
