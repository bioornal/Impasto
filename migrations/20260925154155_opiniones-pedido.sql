-- Opiniones de clientes: sobre qué opinaron y, si vinieron del seguimiento,
-- de qué pedido. Sin pedido = vino de la home (cualquiera puede opinar; el
-- dueño aprueba antes de publicar).
alter table testimonios add column if not exists producto text not null default '';
alter table testimonios add column if not exists pedido_id uuid references pedidos(id) on delete set null;
alter table testimonios add column if not exists pedido_ref text not null default '';

-- Una sola opinión por pedido.
create unique index if not exists testimonios_pedido_uidx on testimonios (pedido_id) where pedido_id is not null;

-- La home lee las aprobadas más recientes de la sucursal.
create index if not exists testimonios_home_idx on testimonios (sucursal_id, estado, created_at desc);
