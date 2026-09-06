-- Datos bancarios para transferencias directas de la pizzería.
-- Permite al local configurar su Alias y CBU desde el panel de administración
-- para que los clientes sepan a dónde transferir.

alter table sucursales add column if not exists cbu text not null default '';
alter table sucursales add column if not exists alias_cbu text not null default '';
alter table sucursales add column if not exists banco text not null default '';
alter table sucursales add column if not exists titular_cuenta text not null default '';

-- Cargar valores por defecto de la sucursal Iguazú si están vacíos
update sucursales
   set alias_cbu = coalesce(nullif(alias_cbu, ''), 'IMPASTO.IGUAZU'),
       banco = coalesce(nullif(banco, ''), 'Mercado Pago / Banco Galicia'),
       titular_cuenta = coalesce(nullif(titular_cuenta, ''), 'Impasto Pizzería')
 where id = 'iguazu';
