-- El email pasa a ser el canal de avisos, así que se pide en todos los pedidos.
alter table pedidos add column if not exists email_cliente text not null default '';
alter table clientes add column if not exists email text not null default '';

create index if not exists pedidos_email_cliente_idx on pedidos (email_cliente);

-- Registro de avisos enviados, para no duplicar y para poder reintentar.
create table if not exists notificaciones (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  canal text not null default 'email',
  tipo text not null,                       -- 'pedido_recibido' | 'pago_aprobado' | 'estado'
  destino text not null,
  estado text not null default 'pendiente', -- 'enviado' | 'fallido' | 'omitido'
  detalle jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists notificaciones_unicas_idx on notificaciones (pedido_id, tipo, canal);
