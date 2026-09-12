-- Actualizar tarifa de delivery a $3.000 y envío gratis desde $35.000 en sucursales
update sucursales
   set delivery_fee = 3000,
       envio_gratis_desde = 35000
 where id = 'iguazu' or id is not null;
