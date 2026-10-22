-- Masas disponibles (pedido del dueño, 22/10/2026): si se queda sin una de las dos masas, la
-- apaga desde el panel (Configuración → Masas) y la web deja de ofrecerla. Por defecto, las dos.
-- El panel y la API no dejan apagar las dos a la vez.
-- Servidor propio: sin OWNER TO postgres (todo es de project_admin).
alter table sucursales add column if not exists masa_napoletana_activa boolean not null default true;
alter table sucursales add column if not exists masa_molde_activa boolean not null default true;
