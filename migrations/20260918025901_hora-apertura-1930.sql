-- La apertura había quedado en 06:30 mientras el horario publicado dice 19:30 — 00:00:
-- la web aceptaba pedidos, incluso con tarjeta, desde la mañana con el local cerrado.
update sucursales
   set hora_apertura = '19:30'
 where id = 'iguazu';
