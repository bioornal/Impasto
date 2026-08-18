-- Historial de cambios de estado (pendiente del punto 3 del plan).
create table if not exists pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  tipo text not null,                       -- 'estado' | 'pago'
  valor text not null,                      -- nuevo valor del estado
  origen text not null default 'sistema',   -- 'checkout' | 'panel' | 'webhook' | 'sistema'
  detalle jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists pedido_eventos_pedido_idx on pedido_eventos (pedido_id, created_at desc);

-- Campos propios de Mercado Pago (Checkout API vía Orders).
alter table pedidos add column if not exists mp_order_id text not null default '';
alter table pedidos add column if not exists external_reference text not null default '';
alter table pedidos add column if not exists pagado_en timestamptz;

create index if not exists pedidos_external_reference_idx on pedidos (external_reference);
create index if not exists pedidos_mp_order_id_idx on pedidos (mp_order_id);
