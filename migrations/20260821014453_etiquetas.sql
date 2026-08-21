-- Las etiquetas de producto dejan de estar hardcodeadas en tres componentes.
-- `slug` es lo que se guarda en productos.tags y es inmutable; `label` es lo
-- que ve el cliente y se puede renombrar sin migrar datos.
create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  color text not null default 'gris',
  orden integer not null default 100,
  mostrar_badge text not null default 'ambos',
  sistema boolean not null default false,
  sucursal_id text not null default 'iguazu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint etiquetas_slug_sucursal_unico unique (slug, sucursal_id),
  constraint etiquetas_color_valido check (color in ('dorado','rojo','verde','oliva','gris','negro')),
  constraint etiquetas_mostrar_valido check (mostrar_badge in ('ambos','pizzas','empanadas','ninguno'))
);

-- `sistema` marca las que alimentan pestañas hardcodeadas de PizzaList.tsx.
-- No impide borrarlas: sirve para que el panel avise qué se rompe.
insert into etiquetas (slug, label, color, orden, mostrar_badge, sistema) values
  ('mas-pedida',   'Más pedida',         'rojo',   1, 'ambos',      false),
  ('nueva',        'Nueva',              'verde',  2, 'ambos',      false),
  ('clasica-casa', 'Clásica de la casa', 'oliva',  3, 'pizzas',     false),
  ('gourmet',      'Gourmet',            'dorado', 4, 'ambos',      true),
  ('picante',      'Picante',            'rojo',   5, 'ambos',      true),
  ('vegetariana',  'Vegetariana',        'verde',  6, 'empanadas',  true),
  ('dulce',        'Dulce',              'dorado', 7, 'empanadas',  false)
on conflict (slug, sucursal_id) do nothing;
