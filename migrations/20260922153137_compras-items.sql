-- Lista de compras del recetario Android (sección COMPRAS, por voz).
-- Una fila por ítem. El id lo genera la app: si se corta la señal y la app
-- reintenta, no se duplica el ítem.
create table if not exists compras_items (
  id uuid primary key default gen_random_uuid(),
  ingrediente_id uuid references ingredientes(id) on delete set null, -- null = sin catálogo
  nombre text not null,                           -- lo que se muestra ("Muzzarella", "Servilletas")
  cantidad numeric check (cantidad is null or cantidad > 0),
  unidad text,                                    -- kg, g, l, ml, u, docena, cajón, bolsa, ...
  nota text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'comprado')),
  comprado_en timestamptz,                        -- cuándo se tildó
  precio_pagado numeric check (precio_pagado is null or precio_pagado >= 0),
  archivado boolean not null default false,       -- "Vaciar comprados de hoy" lo pasa al historial sin borrar
  created_at timestamptz not null default now()
);

alter table compras_items enable row level security;

revoke all on compras_items from anon;
grant select, insert, update, delete on compras_items to authenticated;
grant select, insert, update, delete on compras_items to project_admin;

-- project_admin_policy no se crea acá: InsForge la agrega sola a cada tabla nueva.

-- Igual que las demás tablas del recetario: solo la cuenta del dueño la ve.
create policy "Recetario: usuarios habilitados" on compras_items for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());
