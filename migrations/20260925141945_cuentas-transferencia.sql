-- Varias cuentas para transferencias; los clientes ven solo la activa.
-- La cuenta que ya estaba cargada pasa a la lista copiándola de la propia fila:
-- los datos bancarios no se escriben en el repo, que es público.
alter table sucursales add column if not exists cuentas_transferencia jsonb not null default '[]'::jsonb;

update sucursales
   set cuentas_transferencia = jsonb_build_array(jsonb_build_object(
         'id', gen_random_uuid()::text,
         'nombre', coalesce(nullif(banco, ''), 'Cuenta principal'),
         'alias', alias_cbu,
         'cbu', cbu,
         'banco', banco,
         'titular', titular_cuenta,
         'activa', true))
 where cuentas_transferencia = '[]'::jsonb
   and (alias_cbu <> '' or cbu <> '');

-- La cuenta que se le mostró al cliente, para que el pedido la conserve
-- aunque después cambie la activa. Solo la escribe la web.
alter table pedidos add column if not exists cuenta_transferencia jsonb;
