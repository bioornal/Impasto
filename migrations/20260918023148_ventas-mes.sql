-- Unidades vendidas cargadas a mano en el recetario (página Ganancias).
--
-- El recetario ya tenía la pantalla y el botón "Guardar" escritos contra esta
-- tabla, pero la tabla nunca se creó: cada carga mostraba "No se pudieron cargar:
-- ventas_mes" y guardar fallaba. El esquema sale de ese código: una fila por
-- precio de venta y mes ('YYYY-MM'), y la unidad manual pisa a la automática.
create table if not exists ventas_mes (
  id uuid primary key default gen_random_uuid(),
  precio_venta_id uuid not null references precios_venta(id) on delete cascade,
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  unidades integer not null default 0 check (unidades >= 0),
  created_at timestamp not null default now(),
  unique (precio_venta_id, mes)
);

alter table ventas_mes enable row level security;

revoke all on ventas_mes from anon;
grant select, insert, update, delete on ventas_mes to authenticated;
grant select, insert, update, delete on ventas_mes to project_admin;

-- project_admin_policy no se crea acá: InsForge la agrega sola a cada tabla nueva,
-- y declararla hace fallar la migración con "already exists".

create policy "Recetario: usuarios habilitados" on ventas_mes for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());
