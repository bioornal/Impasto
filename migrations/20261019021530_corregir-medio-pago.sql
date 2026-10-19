-- Corregir el medio de pago de un pedido desde el panel (pedido del dueño, 18/10/2026): a veces el
-- POS lo carga mal y la rendición del efectivo del delivery no cierra.
-- * No se tocan los cobros con tarjeta de la web (los confirma Mercado Pago).
-- * El libro pedido_movimientos es inmutable: si el pedido ya tenía cobros, el neto de cada medio
--   distinto del nuevo se pasa al nuevo con un par devolución (medio viejo) + cobro (medio nuevo),
--   ambos con clave 'correccion-medio:…' y la fecha del cobro original. Los lectores del libro
--   (POS, recetario, panel) suman y restan por medio pero NO lo cuentan como devolución.
-- * Corregir a Mercado Pago da el pedido por cobrado (decisión del dueño).
-- Servidor propio: sin OWNER TO postgres (todo es de project_admin).
CREATE FUNCTION public.corregir_medio_pago(p_pedido uuid, p_metodo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.pedidos; r record; n integer; v_anterior text;
BEGIN
 IF p_metodo IS NULL OR p_metodo NOT IN ('efectivo','transferencia','mercadopago') THEN
  RAISE EXCEPTION 'MEDIO_INVALIDO';
 END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_pedido AND proyecto_id='impasto' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_NO_ENCONTRADO'; END IF;
 IF p.proveedor_pago='mercadopago' OR coalesce(p.mp_order_id,'')<>'' OR coalesce(p.id_pago,'')<>'' THEN
  RAISE EXCEPTION 'MEDIO_NO_EDITABLE';
 END IF;
 v_anterior:=p.metodo_pago;
 IF v_anterior IS NOT DISTINCT FROM p_metodo THEN RETURN to_jsonb(p); END IF;

 -- Número de esta corrección: las claves son únicas por pedido.
 SELECT count(*)+1 INTO n FROM public.pedido_movimientos WHERE pedido_id=p.id AND clave LIKE 'correccion-medio:%:entrada';
 FOR r IN
  SELECT metodo_pago,
   sum(CASE WHEN tipo='cobro' THEN monto_centavos ELSE -monto_centavos END) AS neto,
   min(ocurrido_en) FILTER (WHERE tipo='cobro') AS fecha
  FROM public.pedido_movimientos WHERE pedido_id=p.id AND metodo_pago<>p_metodo
  GROUP BY metodo_pago ORDER BY metodo_pago
 LOOP
  IF r.neto>0 THEN
   INSERT INTO public.pedido_movimientos(pedido_id,proyecto_id,sucursal_id,clave,tipo,monto_centavos,metodo_pago,ocurrido_en,fecha_fuente)
   VALUES (p.id,p.proyecto_id,p.sucursal_id,'correccion-medio:'||n||':'||r.metodo_pago||':salida','devolucion',r.neto,r.metodo_pago,
    r.fecha,CASE WHEN r.fecha IS NULL THEN 'desconocida' ELSE 'registro' END),
          (p.id,p.proyecto_id,p.sucursal_id,'correccion-medio:'||n||':'||r.metodo_pago||':entrada','cobro',r.neto,p_metodo,
    r.fecha,CASE WHEN r.fecha IS NULL THEN 'desconocida' ELSE 'registro' END);
  END IF;
 END LOOP;

 UPDATE public.pedidos
 SET metodo_pago=p_metodo,
     estado_pago=CASE WHEN p_metodo='mercadopago' THEN 'aprobado' ELSE estado_pago END
 WHERE id=p.id RETURNING * INTO p;

 INSERT INTO public.pedido_eventos(pedido_id,tipo,valor,origen,detalle)
 VALUES (p.id,'pago','medio:'||p_metodo,'panel',jsonb_build_object('anterior',v_anterior,'nuevo',p_metodo));
 RETURN to_jsonb(p);
END $$;
REVOKE ALL ON FUNCTION public.corregir_medio_pago(uuid,text) FROM PUBLIC, anon, authenticated;
