-- Separación por rol del pool de usuarios compartido.
--
-- El recetario es la única app que lee con el token del usuario: Impasto y Carro
-- Fogón entran con la key de backend (rol project_admin), así que esto no las
-- toca. Hasta acá cualquier usuario logueado del pool —incluidas cuentas que no
-- son del dueño— leía los costos y los pedidos con datos de clientes.
--
-- Para habilitar a otra persona, agregar su uuid de auth.users a esta lista.
create or replace function public.es_usuario_recetario()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.uid() in ('473cfc8b-46d1-4428-96e5-80b841be8bce'::uuid), false)
$$;

revoke all on function public.es_usuario_recetario() from public;
grant execute on function public.es_usuario_recetario() to authenticated;

drop policy if exists "Acceso autenticado recetas" on recetas;
create policy "Recetario: usuarios habilitados" on recetas for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado ingredientes" on ingredientes;
create policy "Recetario: usuarios habilitados" on ingredientes for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado receta_ingredientes" on receta_ingredientes;
create policy "Recetario: usuarios habilitados" on receta_ingredientes for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado precios_venta" on precios_venta;
create policy "Recetario: usuarios habilitados" on precios_venta for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado costos_fijos" on costos_fijos;
create policy "Recetario: usuarios habilitados" on costos_fijos for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado costos_variables" on costos_variables;
create policy "Recetario: usuarios habilitados" on costos_variables for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado config_negocio" on config_negocio;
create policy "Recetario: usuarios habilitados" on config_negocio for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado gastos" on gastos;
create policy "Recetario: usuarios habilitados" on gastos for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

-- productos conserva además su "Lectura pública de productos": la carta es pública.
drop policy if exists "Acceso autenticado productos" on productos;
create policy "Recetario: usuarios habilitados" on productos for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());

drop policy if exists "Acceso autenticado pedidos" on pedidos;
create policy "Recetario: usuarios habilitados" on pedidos for all to authenticated
  using (public.es_usuario_recetario()) with check (public.es_usuario_recetario());
