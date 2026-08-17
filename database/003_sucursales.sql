create table if not exists sucursales (
  id text primary key,
  nombre text not null,
  ciudad text not null,
  direccion text not null,
  telefono text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  horarios text not null default '',
  delivery_fee integer not null default 3000,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into sucursales (id, nombre, ciudad, direccion, telefono, email, whatsapp, horarios, delivery_fee)
values (
  'iguazu',
  'Impasto - Pizzeria y Empanadas',
  'Puerto Iguazú, Misiones',
  'Santa María esq. Obispo Angelelli',
  '(03757) 42-1840',
  'hola@impastoiguazu.com.ar',
  '543757421840',
  'Martes a Domingo · 19:30 — 00:00',
  3000
)
on conflict (id) do update set
  nombre = excluded.nombre,
  ciudad = excluded.ciudad,
  direccion = excluded.direccion,
  telefono = excluded.telefono,
  email = excluded.email,
  whatsapp = excluded.whatsapp,
  horarios = excluded.horarios,
  delivery_fee = excluded.delivery_fee,
  updated_at = now();

alter table pedidos add column if not exists sucursal_id text not null default 'neuquen';
create index if not exists pedidos_sucursal_id_idx on pedidos (sucursal_id);

alter table carritos add column if not exists sucursal_id text not null default 'iguazu';
create index if not exists carritos_sucursal_id_idx on carritos (sucursal_id);

alter table promociones add column if not exists sucursal_id text not null default 'iguazu';
alter table testimonios add column if not exists sucursal_id text not null default 'iguazu';
