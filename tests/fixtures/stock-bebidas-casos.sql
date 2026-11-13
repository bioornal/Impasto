-- Ejecutar con project_admin DESPUÉS de aplicar la migración, en una sesión de
-- mantenimiento. No crea ventas persistentes: termina siempre con ROLLBACK.
-- Si una aserción falla, ejecutar ROLLBACK antes de continuar en esa sesión.
BEGIN;

CREATE FUNCTION pg_temp.stock_assert(p_ok boolean,p_mensaje text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'STOCK_QA: %',p_mensaje; END IF;
END $$;

CREATE FUNCTION pg_temp.stock_falla(p_sql text,p_error text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 BEGIN
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  IF position(p_error IN SQLERRM)>0 THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'STOCK_QA: se esperaba %',p_error;
END $$;

CREATE TEMP TABLE stock_qa_productos AS
 SELECT id,nombre,row_number() OVER(ORDER BY id) n
 FROM productos WHERE proyecto_id='impasto' AND NOT COALESCE(archivado,false)
 AND (tipo='bebida' OR categoria ILIKE '%bebida%') ORDER BY id LIMIT 2;
SELECT pg_temp.stock_assert(count(*)=2,'Se necesitan dos bebidas activas de Impasto') FROM stock_qa_productos;
CREATE TEMP TABLE stock_qa_pizza AS
 SELECT id,nombre FROM productos WHERE proyecto_id='impasto' AND NOT COALESCE(archivado,false)
 AND tipo='pizza' ORDER BY id LIMIT 1;
SELECT pg_temp.stock_assert(count(*)=1,'Se necesita una pizza de Impasto') FROM stock_qa_pizza;
CREATE TEMP TABLE stock_qa_pedidos(caso text PRIMARY KEY,id uuid NOT NULL);

CREATE FUNCTION pg_temp.stock_pedido(p_productos jsonb) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_pedido jsonb; v_numero integer;
BEGIN
 SELECT COALESCE(max(numero_pedido),0)+1 INTO v_numero FROM public.pedidos
 WHERE proyecto_id='impasto' AND fecha::text=public.noche_de_negocio(now())::text;
 v_pedido:=public.crear_pedido_costeado(jsonb_build_object(
  'numero_pedido',v_numero,'proyecto_id','impasto','sucursal_id','iguazu',
  'modalidad','takeaway','status','normal','direccion','Retiro: prueba transaccional stock',
  'productos',p_productos,'subtotal',0,'envio',0,'total',0,
  'metodo_pago','efectivo','estado_pago','aprobado','proveedor_pago','manual',
  'fecha',public.noche_de_negocio(now()),'cuando','asap',
  'external_reference','IM-STOCK-QA-'||gen_random_uuid()::text
 ),jsonb_build_object('costo_produccion_centavos',0,'comision_pct',0));
 RETURN (v_pedido->>'id')::uuid;
END $$;

-- Venta web por id, repetida: agrega una sola entrada de consumo de 3 unidades.
SELECT fijar_stock_bebida(id,8) FROM stock_qa_productos;
INSERT INTO stock_qa_pedidos SELECT 'web',pg_temp.stock_pedido(jsonb_build_array(
 jsonb_build_object('key',id,'type','bebida','qty',2,'price',0),
 jsonb_build_object('key',id,'type','bebida','qty',1,'price',0))) FROM stock_qa_productos WHERE n=1;
SELECT pg_temp.stock_assert(s.unidades=5 AND p.stock_consumo=jsonb_build_array(jsonb_build_object('producto_id',s.producto_id,'unidades',3)),
 'Web descuenta tres y agrupa el consumo')
 FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id AND q.n=1
 CROSS JOIN stock_qa_pedidos t JOIN pedidos p ON p.id=t.id WHERE t.caso='web';

-- POS por nombre sin type: cuenta también los regalos (precio cero).
INSERT INTO stock_qa_pedidos SELECT 'pos',pg_temp.stock_pedido(jsonb_build_array(jsonb_build_object('nombre',nombre,'cantidad',2,'precio',0)))
 FROM stock_qa_productos WHERE n=2;
SELECT pg_temp.stock_assert(s.unidades=6,'POS descuenta dos') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=2;

-- Rechazo: la primera bebida alcanza y la segunda no; nada queda parcialmente descontado.
SELECT pg_temp.stock_falla(format('SELECT pg_temp.stock_pedido(%L::jsonb)',
 (SELECT jsonb_agg(jsonb_build_object('key',id,'type','bebida','qty',CASE WHEN n=1 THEN 1 ELSE 99 END) ORDER BY n) FROM stock_qa_productos)),
 'STOCK_AGOTADO|'||(SELECT nombre FROM stock_qa_productos WHERE n=2)||'|6');
SELECT pg_temp.stock_assert(s.unidades=CASE WHEN q.n=1 THEN 5 ELSE 6 END,'Rechazo sin descuento parcial')
 FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id;

-- Cancelar devuelve una vez, aun con updates posteriores.
UPDATE pedidos SET status='cancelado' WHERE id=(SELECT id FROM stock_qa_pedidos WHERE caso='web');
UPDATE pedidos SET status='cancelado' WHERE id=(SELECT id FROM stock_qa_pedidos WHERE caso='web');
SELECT pg_temp.stock_assert(s.unidades=8,'Cancelación idempotente') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=1;

-- Reactivación insuficiente rechaza atómicamente y conserva cancelado/liberado.
SELECT fijar_stock_bebida(id,2) FROM stock_qa_productos WHERE n=1;
SELECT pg_temp.stock_falla(format('UPDATE pedidos SET status=''normal'' WHERE id=%L',id),
 'STOCK_AGOTADO|'||(SELECT nombre FROM stock_qa_productos WHERE n=1)||'|2') FROM stock_qa_pedidos WHERE caso='web';
SELECT pg_temp.stock_assert(p.status='cancelado' AND p.stock_liberado,'Reactivación fallida conserva estado')
 FROM pedidos p JOIN stock_qa_pedidos q ON q.id=p.id WHERE q.caso='web';
SELECT fijar_stock_bebida(id,8) FROM stock_qa_productos WHERE n=1;
UPDATE pedidos SET status='normal' WHERE id=(SELECT id FROM stock_qa_pedidos WHERE caso='web');
SELECT pg_temp.stock_assert(s.unidades=5,'Reactivar vuelve a descontar tres') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=1;

-- Pago rechazado devuelve; eliminarlo después no vuelve a devolver.
UPDATE pedidos SET estado_pago='rechazado' WHERE id=(SELECT id FROM stock_qa_pedidos WHERE caso='web');
DELETE FROM pedidos WHERE id=(SELECT id FROM stock_qa_pedidos WHERE caso='web');
SELECT pg_temp.stock_assert(s.unidades=8,'Pago rechazado y delete sin doble devolución') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=1;
DELETE FROM pedidos WHERE id=(SELECT id FROM stock_qa_pedidos WHERE caso='pos');
SELECT pg_temp.stock_assert(s.unidades=8,'Eliminar venta activa devuelve stock') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=2;

-- NULL y ausencia de fila: vender sin control y no inventar devolución al activarlo.
SELECT fijar_stock_bebida(id,NULL) FROM stock_qa_productos WHERE n=1;
INSERT INTO stock_qa_pedidos SELECT 'null',pg_temp.stock_pedido(jsonb_build_array(jsonb_build_object('key',id,'type','bebida','qty',99))) FROM stock_qa_productos WHERE n=1;
SELECT pg_temp.stock_assert(s.unidades IS NULL,'NULL permite vender sin control') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=1;
DELETE FROM stock_bebidas WHERE producto_id=(SELECT id FROM stock_qa_productos WHERE n=2);
INSERT INTO stock_qa_pedidos SELECT 'sin_fila',pg_temp.stock_pedido(jsonb_build_array(jsonb_build_object('nombre',nombre,'cantidad',99))) FROM stock_qa_productos WHERE n=2;
SELECT fijar_stock_bebida(id,3) FROM stock_qa_productos;
DELETE FROM pedidos WHERE id IN(SELECT id FROM stock_qa_pedidos WHERE caso IN('null','sin_fila'));
SELECT pg_temp.stock_assert(s.unidades=3,'Ventas sin control no devuelven unidades al activar stock') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id;

-- Cargas aditivas y ajustes quedan en historial con actor.
SELECT cargar_stock_bebida(id,4,'carga') FROM stock_qa_productos WHERE n=1;
SELECT pg_temp.stock_assert(s.unidades=7,'Compra suma al saldo actual') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id WHERE q.n=1;
SELECT fijar_stock_bebida(id,2) FROM stock_qa_productos WHERE n=1;
SELECT pg_temp.stock_assert(EXISTS(SELECT 1 FROM stock_movimientos m JOIN stock_qa_productos q ON q.id=m.producto_id WHERE q.n=1 AND m.motivo='ajuste' AND m.delta=-5 AND m.actor IS NOT NULL),'Ajuste con delta y actor');
SELECT pg_temp.stock_assert(EXISTS(SELECT 1 FROM stock_movimientos m JOIN stock_qa_pedidos q ON q.id=m.pedido_id WHERE q.caso='web' AND m.motivo='venta' AND m.delta=-3),'Historial de venta conserva pedido eliminado');
SELECT pg_temp.stock_assert(EXISTS(SELECT 1 FROM stock_movimientos m JOIN stock_qa_pedidos q ON q.id=m.pedido_id WHERE q.caso='web' AND m.motivo='devolucion' AND m.delta=3),'Historial de devolución conserva pedido eliminado');

-- Pizzas, mitades y cajas jamás consumen bebida aunque traigan el mismo key.
SELECT pg_temp.stock_assert(stock_consumo(jsonb_build_array(
 jsonb_build_object('key',id,'type','pizza','qty',1),
 jsonb_build_object('key',id,'type','pizza-half','qty',1),
 jsonb_build_object('key',id,'type','empanadas','qty',1)))='[]'::jsonb,'Pizzas/cajas no consumen bebidas') FROM stock_qa_productos WHERE n=1;

-- Cupos/masas: una pizza sigue usando dos mitades y una masa de su tipo.
INSERT INTO cupos_noche(proyecto_id,noche,producto_id,cupo_mitades,vendidas_mitades)
 SELECT 'impasto',noche_de_negocio(now()),id,2000,0 FROM stock_qa_pizza
 ON CONFLICT(proyecto_id,noche,producto_id) DO UPDATE SET cupo_mitades=2000,vendidas_mitades=0;
SELECT fijar_masas_restantes('impasto','molde',10);
CREATE TEMP TABLE stock_qa_masas AS SELECT masa,vendidas FROM masas_noche WHERE proyecto_id='impasto' AND noche=noche_de_negocio(now());
INSERT INTO stock_qa_pedidos SELECT 'pizza',pg_temp.stock_pedido(jsonb_build_array(jsonb_build_object('key',id,'type','pizza','qty',1,'masa','molde'))) FROM stock_qa_pizza;
SELECT pg_temp.stock_assert(c.vendidas_mitades=2,'Pizza mantiene cupos') FROM cupos_noche c JOIN stock_qa_pizza q ON q.id=c.producto_id WHERE c.proyecto_id='impasto' AND c.noche=noche_de_negocio(now());
SELECT pg_temp.stock_assert(m.vendidas=q.vendidas+CASE WHEN m.masa='molde' THEN 1 ELSE 0 END,'Pizza mantiene masas por tipo') FROM masas_noche m JOIN stock_qa_masas q USING(masa) WHERE m.proyecto_id='impasto' AND m.noche=noche_de_negocio(now());
SELECT pg_temp.stock_assert(s.unidades=CASE WHEN q.n=1 THEN 2 ELSE 3 END,'Pizza no toca stock') FROM stock_bebidas s JOIN stock_qa_productos q ON q.id=s.producto_id;

-- ACL y RLS reales: sin políticas nuevas, RPCs sólo para project_admin.
SELECT pg_temp.stock_assert(NOT has_function_privilege('anon',firma,'EXECUTE') AND NOT has_function_privilege('authenticated',firma,'EXECUTE') AND has_function_privilege('project_admin',firma,'EXECUTE'),'ACL de '||firma)
 FROM (VALUES('stock_consumo(jsonb)'),('cargar_stock_bebida(uuid,integer,text)'),('fijar_stock_bebida(uuid,integer)'),('crear_pedido_costeado(jsonb,jsonb)')) f(firma);
SELECT pg_temp.stock_assert(relrowsecurity,'RLS de '||relname) FROM pg_class WHERE oid IN('stock_bebidas'::regclass,'stock_movimientos'::regclass);
SELECT pg_temp.stock_assert(count(*)=0,'Sin nuevas políticas') FROM pg_policies WHERE schemaname='public' AND tablename IN('stock_bebidas','stock_movimientos');
SELECT 'Todos los casos de stock terminaron; se revierte la transacción.' resultado;
ROLLBACK;
