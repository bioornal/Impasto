-- Draft carts are anonymous and contain no customer PII.
create table if not exists carritos (
  sucursal_id text not null default 'iguazu',
  session_id text primary key,
  items jsonb not null default '[]'::jsonb,
  subtotal integer not null default 0,
  estado text not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carritos_updated_at_idx on carritos (updated_at);
