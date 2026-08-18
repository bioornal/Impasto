alter table pedidos add column if not exists modalidad text not null default 'delivery';
alter table pedidos add column if not exists cuando text not null default 'asap';
alter table pedidos add column if not exists metodo_pago text not null default 'efectivo';
alter table pedidos add column if not exists cambio text not null default '';
alter table pedidos add column if not exists referencia text not null default '';
alter table pedidos add column if not exists notas text not null default '';
alter table pedidos add column if not exists subtotal integer not null default 0;
alter table pedidos add column if not exists envio integer not null default 0;
alter table pedidos add column if not exists estado_pago text not null default 'pendiente';
alter table pedidos add column if not exists proveedor_pago text not null default '';
alter table pedidos add column if not exists id_pago text not null default '';

create index if not exists pedidos_estado_pago_idx on pedidos (estado_pago);
