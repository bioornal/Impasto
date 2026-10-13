-- Hora de la última modificación de cada pedido. El panel sondea solo lo que
-- cambió desde la última vez (antes bajaba todo el historial cada 15 s y eso
-- agotó el egress del plan free el 12/10/2026). La pone la base, así cubre la
-- web, el POS, el webhook de Mercado Pago y cualquier SQL.
alter table public.pedidos add column if not exists updated_at timestamptz not null default now();

create or replace function public.pedidos_marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists pedidos_marcar_actualizado on public.pedidos;
create trigger pedidos_marcar_actualizado
  before update on public.pedidos
  for each row execute function public.pedidos_marcar_actualizado();

create index if not exists pedidos_proyecto_updated_at_idx on public.pedidos (proyecto_id, updated_at);
