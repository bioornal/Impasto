delete from clientes c
where c.telefono in (
  select p.telefono_cliente
  from pedidos p
  where p.sucursal_id = 'neuquen'
)
and not exists (
  select 1
  from pedidos p2
  where p2.telefono_cliente = c.telefono
    and p2.sucursal_id <> 'neuquen'
);

delete from pedidos where sucursal_id = 'neuquen';
delete from carritos where sucursal_id = 'neuquen';
delete from promociones where sucursal_id = 'neuquen';
delete from testimonios where sucursal_id = 'neuquen';

alter table pedidos alter column sucursal_id set default 'iguazu';
