alter table productos add column if not exists tipo text not null default 'pizza';
alter table productos add column if not exists categoria text not null default 'clasica';
alter table productos add column if not exists "desc" text not null default '';
alter table productos add column if not exists tags jsonb not null default '[]'::jsonb;
alter table productos add column if not exists popular boolean not null default false;

create table if not exists promociones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null default '',
  badge text not null default 'Promo',
  sucursal_id text not null default 'iguazu',
  activo boolean not null default true,
  condiciones jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists testimonios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  texto text not null,
  rating integer not null check (rating between 1 and 5),
  sucursal_id text not null default 'iguazu',
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
