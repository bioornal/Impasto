-- Fase 1C: recorta el acceso generico de `authenticated`.
--
-- Hasta ahora cualquier usuario logueado del pool compartido (operario, dueno,
-- etc.) tenia ALL sobre las tablas de negocio via la policy generica. Estas dos
-- no las necesita ninguna app con el token del usuario:
--   * Impasto y Carro Fogon entran con la key de backend (rol project_admin).
--   * El recetario (unico consumidor con token de usuario) no consulta ninguna
--     de las dos.
--
-- `clientes` guarda PII (nombre, telefono, direccion): se quita la policy
-- generica para que un usuario autenticado cualquiera no pueda leerla ni tocarla
-- desde el navegador con la anon key publica. Queda solo project_admin.
drop policy if exists "Acceso autenticado clientes" on clientes;

-- `sucursales` ya tiene lectura publica (la carta la muestra al cliente) y solo
-- se edita desde el panel, tambien con la key de backend. Se quita el ALL
-- generico para que no se pueda modificar con un token de usuario.
drop policy if exists "Acceso autenticado sucursales" on sucursales;
